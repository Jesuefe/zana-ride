import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDecipheriv, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { OrdersService } from '../merchant/orders.service';
import { MarketsService } from '../markets/markets.service';

type Location = { lat: number; lng: number; address?: string };
type ChatTurn = { role: 'user' | 'model'; text: string };
type MarketDraft = {
  id: string; customerId: string; marketId: string; marketName: string;
  items: Array<{ ingredient: string; quantity: number; productId: string; productName: string; unitPrice: number }>;
  missing: string[]; subtotal: number; deliveryFee: number; total: number;
  dropoffLat?: number; dropoffLng?: number; dropoffAddress?: string; createdAt: string;
};

@Injectable()
export class ZanaAiService {
  private readonly endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';
  private readonly settingsEntity = { entityType: 'AI_SETTINGS', entityId: 'GEMINI', action: 'ZANA_AI_SETTINGS_UPDATED' };

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly orders: OrdersService,
    private readonly markets: MarketsService,
  ) {}

  private decrypt(value: string) {
    const master = this.config.get<string>('SETTINGS_ENCRYPTION_KEY') || this.config.get<string>('JWT_SECRET');
    if (!master) throw new ServiceUnavailableException('SETTINGS_ENCRYPTION_KEY_NOT_CONFIGURED');
    const [ivHex, tagHex, cipherHex] = value.split(':');
    if (!ivHex || !tagHex || !cipherHex) throw new ServiceUnavailableException('INVALID_AI_SECRET');
    const key = createHash('sha256').update(master).digest();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(cipherHex, 'hex')), decipher.final()]).toString('utf8');
  }

  private async getProviderSettings() {
    const row = await this.prisma.auditLog.findFirst({
      where: this.settingsEntity,
      orderBy: { createdAt: 'desc' },
    });
    const stored = row?.afterJson ? JSON.parse(row.afterJson) : null;
    if (stored) {
      return {
        enabled: stored.enabled !== false,
        model: String(stored.model || 'gemini-3.8-flash'),
        apiKey: stored.apiKeyEncrypted ? this.decrypt(stored.apiKeyEncrypted) : '',
        features: stored.features || {},
      };
    }
    return {
      enabled: Boolean(this.config.get<string>('GEMINI_API_KEY')),
      model: this.config.get<string>('GEMINI_MODEL') || 'gemini-3.8-flash',
      apiKey: this.config.get<string>('GEMINI_API_KEY') || '',
      features: {},
    };
  }

  async testConnection() {
    const settings = await this.getProviderSettings();
    if (!settings.apiKey) throw new ServiceUnavailableException('ZANA_AI_NOT_CONFIGURED');
    const response = await this.generate({
      contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: Zana AI connection OK' }] }],
    }, settings.apiKey, settings.model);
    return {
      ok: true,
      model: settings.model,
      response: this.extractText(response) || 'Zana AI connection OK',
    };
  }

  async chat(customerId: string, message: string, history: ChatTurn[] = [], location?: Location) {
    if (!message?.trim()) throw new BadRequestException('MESSAGE_REQUIRED');
    const settings = await this.getProviderSettings();
    if (!settings.enabled || !settings.apiKey) throw new ServiceUnavailableException('ZANA_AI_NOT_CONFIGURED');
    if (settings.features.customerChat === false) throw new ServiceUnavailableException('ZANA_AI_CUSTOMER_CHAT_DISABLED');

    const contents = [
      ...history.slice(-12).map(turn => ({ role: turn.role, parts: [{ text: turn.text }] })),
      { role: 'user', parts: [{ text: message.trim() }] },
    ];

    const tools = [{
      functionDeclarations: [{
        name: 'search_market_for_ingredients',
        description: 'Search Zana market inventory for a recipe or shopping list. Prefer one active market that can fulfill the entire basket. Never invent products or prices. The tool creates a temporary unpaid draft cart for the customer when it finds products.',
        parameters: {
          type: 'object',
          properties: {
            ingredients: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  searchTerms: { type: 'array', items: { type: 'string' } },
                  quantity: { type: 'number' },
                },
                required: ['name', 'quantity'],
              },
            },
            servings: { type: 'integer' },
          },
          required: ['ingredients'],
        },
      }],
    }];

    const systemInstruction = {
      parts: [{
        text: [
          'You are Zana AI, the single intelligent assistant for Zana in Kigali.',
          'You help users with rides, food, market shopping, deliveries and place discovery.',
          'Do not pretend that Zana has completed an action unless a Zana tool returned the action result.',
          'For market shopping, understand recipes and convert them into practical ingredient quantities.',
          'When the user asks to buy ingredients, call search_market_for_ingredients.',
          'The market tool prefers ONE market. If one market cannot fulfill everything, report what is missing and explain that using another market would create another delivery fee.',
          'Never invent Zana market inventory, product prices, delivery fees or order IDs.',
          'Do not expose internal tool names, database details or API details.',
          'Keep replies concise, warm and action-oriented. Ask only for information that is genuinely missing.',
          location ? `Customer drop-off context: ${JSON.stringify(location)}` : 'Customer location is not currently available.',
        ].join(' '),
      }],
    };

    const first = await this.generate({ contents, tools, systemInstruction }, settings.apiKey, settings.model);
    const functionCall = first?.candidates?.[0]?.content?.parts?.find((part: any) => part.functionCall)?.functionCall;

    if (!functionCall) {
      return { text: this.extractText(first) ?? 'How can I help you today?', action: null };
    }

    let toolResult: any;
    if (functionCall.name === 'search_market_for_ingredients') {
      toolResult = await this.searchMarketForIngredients(customerId, functionCall.args ?? {}, location);
    } else {
      toolResult = { error: 'Unsupported Zana action' };
    }

    const modelContent = first.candidates?.[0]?.content;
    const followupContents = [
      ...contents,
      modelContent,
      { role: 'user', parts: [{ functionResponse: {
        name: functionCall.name,
        id: functionCall.id,
        response: { result: toolResult },
      }}]},
    ];

    const final = await this.generate({ contents: followupContents, tools, systemInstruction }, settings.apiKey, settings.model);
    return {
      text: this.extractText(final) ?? this.fallbackToolText(toolResult),
      action: toolResult?.action ?? null,
    };
  }

  private async generate(body: any, apiKey: string, model: string) {
    const response = await fetch(`${this.endpoint}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error('[ZANA AI] Gemini error', response.status, detail);
      throw new ServiceUnavailableException('ZANA_AI_PROVIDER_ERROR');
    }
    return response.json();
  }

  private extractText(response: any): string | null {
    const parts = response?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((part: any) => typeof part.text === 'string').map((part: any) => part.text).join('').trim();
    return text || null;
  }

  private async searchMarketForIngredients(customerId: string, args: {
    ingredients?: Array<{ name: string; searchTerms?: string[]; quantity?: number }>;
  }, location?: Location) {
    const ingredients = (args.ingredients ?? []).filter(item => item?.name).map(item => ({
      name: String(item.name).trim(),
      quantity: Math.max(1, Number(item.quantity ?? 1)),
      searchTerms: [item.name, ...(item.searchTerms ?? [])].map(term => String(term).toLowerCase().trim()).filter(Boolean),
    }));

    if (!ingredients.length) return { action: null, message: 'No shopping items were supplied.' };

    const markets = await this.prisma.market.findMany({
      where: { active: true },
      include: {
        products: {
          where: { status: 'APPROVED', available: true },
          select: { id: true, name: true, price: true, referenceCost: true, available: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    if (!markets.length) return { action: null, message: 'No active Zana markets are available right now.' };

    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const scoreProduct = (productName: string, terms: string[]) => {
      const product = normalize(productName);
      let score = 0;
      for (const term of terms) {
        const normalizedTerm = normalize(term);
        if (!normalizedTerm) continue;
        if (product === normalizedTerm) score = Math.max(score, 100);
        else if (product.includes(normalizedTerm) || normalizedTerm.includes(product)) score = Math.max(score, 80);
        else {
          const tokens = normalizedTerm.split(' ').filter(Boolean);
          const hits = tokens.filter(token => product.includes(token)).length;
          score = Math.max(score, hits * 10);
        }
      }
      return score;
    };

    const candidates = markets.map(market => {
      const matched: MarketDraft['items'] = [];
      const missing: string[] = [];
      for (const ingredient of ingredients) {
        const best = market.products.map(product => ({
          product,
          score: scoreProduct(product.name, ingredient.searchTerms),
        })).filter(row => row.score > 0).sort((a, b) => b.score - a.score)[0];

        if (!best) missing.push(ingredient.name);
        else matched.push({
          ingredient: ingredient.name,
          quantity: ingredient.quantity,
          productId: best.product.id,
          productName: best.product.name,
          unitPrice: Number(best.product.price),
        });
      }
      return { market, matched, missing };
    }).sort((a, b) => {
      const aComplete = a.missing.length === 0 ? 1 : 0;
      const bComplete = b.missing.length === 0 ? 1 : 0;
      if (aComplete !== bComplete) return bComplete - aComplete;
      if (a.matched.length !== b.matched.length) return b.matched.length - a.matched.length;
      return a.market.name.localeCompare(b.market.name);
    });

    const chosen = candidates[0];
    const subtotal = chosen.matched.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const deliveryFee = this.calculateDeliveryFee(chosen.market.lat, chosen.market.lng, location?.lat, location?.lng);
    const draftId = `mkt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    const draft: MarketDraft = {
      id: draftId, customerId, marketId: chosen.market.id, marketName: chosen.market.name,
      items: chosen.matched, missing: chosen.missing, subtotal, deliveryFee, total: subtotal + deliveryFee,
      dropoffLat: location?.lat, dropoffLng: location?.lng, dropoffAddress: location?.address,
      createdAt: new Date().toISOString(),
    };

    await this.redis.set(`zana-ai:market-draft:${draftId}`, JSON.stringify(draft), 15 * 60);

    return {
      action: {
        type: 'MARKET_DRAFT',
        draftId, marketId: draft.marketId, marketName: draft.marketName,
        items: draft.items, missing: draft.missing, subtotal: draft.subtotal,
        deliveryFee: draft.deliveryFee, total: draft.total, oneMarket: true,
        extraMarketDeliveryWarning: draft.missing.length ? 'A second market would mean a second delivery fee.' : null,
      },
      message: draft.missing.length
        ? `I found ${draft.items.length} of ${ingredients.length} items at ${draft.market.name}.`
        : `I found all ${ingredients.length} items at ${draft.market.name}.`,
    };
  }

  private calculateDeliveryFee(pickupLat: number, pickupLng: number, dropoffLat?: number, dropoffLng?: number) {
    if (dropoffLat == null || dropoffLng == null) return 950;
    const R = 6371;
    const dLat = ((dropoffLat - pickupLat) * Math.PI) / 180;
    const dLng = ((dropoffLng - pickupLng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((pickupLat * Math.PI) / 180) * Math.cos((dropoffLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.asin(Math.sqrt(a));
    return Math.min(3000, Math.max(500, Math.round(500 + distance * 150)));
  }

  async executeMarketDraft(customerId: string, draftId: string, paymentMethod: 'WALLET' | 'MOBILE_MONEY') {
    const raw = await this.redis.get(`zana-ai:market-draft:${draftId}`);
    if (!raw) throw new BadRequestException('MARKET_DRAFT_EXPIRED');
    const draft = JSON.parse(raw) as MarketDraft;
    if (draft.customerId !== customerId) throw new BadRequestException('MARKET_DRAFT_NOT_YOURS');
    if (draft.missing.length) throw new BadRequestException('MARKET_DRAFT_HAS_MISSING_ITEMS');
    if (!draft.items.length) throw new BadRequestException('MARKET_DRAFT_EMPTY');
    if (draft.dropoffLat == null || draft.dropoffLng == null) throw new BadRequestException('DROP_OFF_LOCATION_REQUIRED');

    const order = await this.orders.create(customerId, {
      marketId: draft.marketId,
      items: draft.items.map(item => ({ productId: item.productId, quantity: item.quantity })),
      dropoffLat: draft.dropoffLat,
      dropoffLng: draft.dropoffLng,
      dropoffAddress: draft.dropoffAddress,
      paymentMethod,
      deliveryFee: draft.deliveryFee,
    });

    await this.redis.del(`zana-ai:market-draft:${draftId}`);
    return { type: 'MARKET_ORDER_CREATED', orderId: order.id, trackingCode: order.trackingCode, total: order.total, marketName: draft.marketName };
  }

  private fallbackToolText(toolResult: any) {
    const action = toolResult?.action;
    if (!action) return toolResult?.message ?? 'I could not complete that request.';
    if (action.type === 'MARKET_DRAFT') {
      return action.missing?.length
        ? `I found ${action.items.length} items at ${action.marketName}, but ${action.missing.join(', ')} is missing there.`
        : `I found everything at ${action.marketName}. Your shopping basket is ready.`;
    }
    return 'I prepared that for you.';
  }
}
