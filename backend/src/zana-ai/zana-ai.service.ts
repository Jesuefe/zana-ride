import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDecipheriv, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { OrdersService } from '../merchant/orders.service';
import { MarketsService } from '../markets/markets.service';
import { TripsService } from '../trips/trips.service';
import { ServiceType } from '@prisma/client';

type Location = { lat: number; lng: number; address?: string };
type ChatTurn = { role: 'user' | 'model'; text: string };
type AiProvider = 'gemini' | 'groq' | 'openrouter';
type RideDraft = {
  id: string; customerId: string; serviceType: ServiceType;
  pickupLat: number; pickupLng: number; pickupAddress: string;
  destinationLat: number; destinationLng: number; destinationAddress: string;
  distanceKm: number; durationMinutes: number; fare: number; createdAt: string;
};
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
  private readonly providerDefaults: Record<AiProvider, { model: string; baseUrl: string }> = {
    gemini: { model: 'gemini-3.8-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models' },
    groq: { model: 'openai/gpt-oss-120b', baseUrl: 'https://api.groq.com/openai/v1' },
    openrouter: { model: 'openrouter/free', baseUrl: 'https://openrouter.ai/api/v1' },
  };

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly orders: OrdersService,
    private readonly markets: MarketsService,
    private readonly trips: TripsService,
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

  private async getProviderSettings(provider: AiProvider = 'gemini') {
    const entityId = provider.toUpperCase();
    const row = await this.prisma.auditLog.findFirst({
      where: { entityType: 'AI_SETTINGS', entityId, action: 'ZANA_AI_PROVIDER_UPDATED' },
      orderBy: { createdAt: 'desc' },
    });
    let stored = row?.afterJson ? JSON.parse(row.afterJson) : null;
    if (!stored && provider === 'gemini') {
      const legacy = await this.prisma.auditLog.findFirst({ where: this.settingsEntity, orderBy: { createdAt: 'desc' } });
      stored = legacy?.afterJson ? JSON.parse(legacy.afterJson) : null;
    }
    const defaults = this.providerDefaults[provider];
    if (stored) return { enabled: stored.enabled !== false, model: String(stored.model || defaults.model), apiKey: stored.apiKeyEncrypted ? this.decrypt(stored.apiKeyEncrypted) : '', features: stored.features || {} };
    return { enabled: provider === 'gemini' && Boolean(this.config.get<string>('GEMINI_API_KEY')), model: provider === 'gemini' ? (this.config.get<string>('GEMINI_MODEL') || defaults.model) : defaults.model, apiKey: provider === 'gemini' ? (this.config.get<string>('GEMINI_API_KEY') || '') : '', features: {} };
  }

  private async getActiveProviders() {
    const primary = (await this.getPrimaryProvider()) as AiProvider;
    const order: AiProvider[] = [primary, 'groq', 'openrouter', 'gemini'];
    const out: Array<{ provider: AiProvider; model: string; apiKey: string }> = [];
    for (const provider of order) {
      if (out.some(x => x.provider === provider)) continue;
      const settings = await this.getProviderSettings(provider);
      if (settings.enabled && settings.apiKey) out.push({ provider, model: settings.model, apiKey: settings.apiKey });
    }
    return out;
  }

  private async getPrimaryProvider(): Promise<AiProvider> {
    const row = await this.prisma.auditLog.findFirst({ where: { entityType: 'AI_SETTINGS', entityId: 'PRIMARY', action: 'ZANA_AI_PRIMARY_UPDATED' }, orderBy: { createdAt: 'desc' } });
    const provider = row?.afterJson ? JSON.parse(row.afterJson)?.provider : null;
    return provider === 'groq' || provider === 'openrouter' || provider === 'gemini' ? provider : 'gemini';
  }

  async testConnection() {
    const providers = await this.getActiveProviders();
    if (!providers.length) throw new ServiceUnavailableException('ZANA_AI_NOT_CONFIGURED');
    const selected = providers[0];
    const response = await this.generate({ contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: Zana AI connection OK' }] }] }, selected.provider, selected.apiKey, selected.model);
    return {
      ok: true,
      provider: selected.provider,
      model: selected.model,
      response: this.extractText(response) || 'Zana AI connection OK',
    };
  }

  private async getCustomerAccountContext(customerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { firstName: true, lastName: true, createdAt: true },
    });
    if (!user) throw new BadRequestException('CUSTOMER_NOT_FOUND');

    // Query each customer-owned resource directly. This keeps the AI context
    // compatible with the generated Prisma client even when User relation
    // fields are not exposed in the selected client shape.
    const [rides, deliveries, orders, completedRides, completedDeliveries, deliveredOrders, rideSpend, directDeliverySpend, orderSpend] = await Promise.all([
      this.prisma.trip.findMany({
        where: { customerId },
        orderBy: { requestedAt: 'desc' },
        take: 10,
        select: { id: true, status: true, finalFare: true, estimatedFare: true, destinationAddress: true, requestedAt: true, completedAt: true },
      }),
      this.prisma.delivery.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, trackingCode: true, status: true, fee: true, itemDescription: true, pickupAddress: true, dropoffAddress: true, createdAt: true, deliveredAt: true, orderId: true },
      }),
      this.prisma.order.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, trackingCode: true, status: true, total: true, deliveryFee: true, marketId: true, merchantId: true, createdAt: true, updatedAt: true },
      }),
      this.prisma.trip.count({ where: { customerId, status: 'RIDE_COMPLETED' } }),
      this.prisma.delivery.count({ where: { customerId, status: 'DELIVERED', orderId: null } }),
      this.prisma.order.count({ where: { customerId, status: 'DELIVERED' } }),
      this.prisma.trip.aggregate({ where: { customerId, status: 'RIDE_COMPLETED' }, _sum: { finalFare: true } }),
      this.prisma.delivery.aggregate({ where: { customerId, status: 'DELIVERED', orderId: null }, _sum: { fee: true } }),
      this.prisma.order.aggregate({ where: { customerId, status: 'DELIVERED' }, _sum: { total: true } }),
    ]);

    return {
      customerName: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Customer',
      accountCreatedAt: user.createdAt,
      totals: {
        rides: completedRides,
        deliveries: completedDeliveries,
        orders: deliveredOrders,
        amountSpentRwf: Number(rideSpend._sum.finalFare || 0) + Number(directDeliverySpend._sum.fee || 0) + Number(orderSpend._sum.total || 0),
      },
      activeRides: rides.filter(t => !['RIDE_COMPLETED', 'CUSTOMER_CANCELLED', 'DRIVER_CANCELLED', 'NO_DRIVER_FOUND'].includes(t.status)).slice(0, 5),
      activeDeliveries: deliveries.filter(d => !['DELIVERED', 'CANCELLED'].includes(d.status)).slice(0, 5),
      recentOrders: orders.slice(0, 5),
      recentRides: rides.slice(0, 5),
      recentDeliveries: deliveries.slice(0, 5),
    };
  }

  async chat(customerId: string, message: string, history: ChatTurn[] = [], location?: Location) {
    if (!message?.trim()) throw new BadRequestException('MESSAGE_REQUIRED');
    const providers = await this.getActiveProviders();
    if (!providers.length) throw new ServiceUnavailableException('ZANA_AI_NOT_CONFIGURED');
    if ((await this.getProviderSettings(providers[0].provider)).features.customerChat === false) throw new ServiceUnavailableException('ZANA_AI_CUSTOMER_CHAT_DISABLED');

    const account = await this.getCustomerAccountContext(customerId);

    const contents = [
      ...history.slice(-12).map(turn => ({ role: turn.role, parts: [{ text: turn.text }] })),
      { role: 'user', parts: [{ text: message.trim() }] },
    ];

    const tools = [{
      functionDeclarations: [
        {
          name: 'search_market_inventory',
          description: 'Search the LIVE Zana market inventory stored in the app database. Use this whenever the customer asks what is available, what products exist, what is in a named market, or asks about prices/availability. Never answer from general knowledge or memory. If a market name is provided, search that market first. Return only products that are currently APPROVED and AVAILABLE in Zana.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'What the customer wants to see, e.g. all products, tomatoes, fruits, ingredients, drinks.' },
              marketName: { type: 'string', description: 'Optional Zana market name, e.g. Kimironko Market.' },
              limit: { type: 'integer', description: 'Maximum products to return, default 30.' },
            },
            required: ['query'],
          },
        },
        {
          name: 'estimate_ride',
          description: 'Create a REAL Zana ride quote using the existing Zana fare engine. Use this before any ride booking. Resolve the destination to real coordinates, calculate distance, duration and fare, and save a short-lived quote. Never invent a fare. If the customer location is unavailable, ask for pickup instead of guessing.',
          parameters: {
            type: 'object', properties: {
              serviceType: { type: 'string', enum: ['MOTO', 'CAR'] },
              destination: { type: 'string', description: 'The destination/place the customer wants to travel to.' },
            }, required: ['serviceType', 'destination'],
          },
        },
        {
          name: 'book_ride',
          description: 'Book the customer using the latest confirmed Zana AI ride quote. Only call this after the customer clearly confirms the quote. It creates the REAL Trip and starts real driver dispatch. Never say the driver is on the way unless the returned trip status is DRIVER_ASSIGNED or later.',
          parameters: { type: 'object', properties: {}, required: [] },
        },
        {
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
          'You have a LIVE private account context for the authenticated customer. Use it to personalize replies. This data belongs only to this customer and must never be exposed as another users data.',
          `Customer account context: ${JSON.stringify(account)}`,
          'You may tell the customer their name, completed ride/delivery/order totals, total amount spent in RWF, and the current status of their active rides or deliveries when relevant. Use the live context, not guesses.',
          'For a delivery-status question, identify the customer delivery from activeDeliveries or recentDeliveries and give its current status/tracking code when available. If there are multiple deliveries, ask which one unless the request clearly identifies one.',

          'You help users with rides, food, market shopping, deliveries and place discovery.',
          'RIDE RULE: For every ride request, first use estimate_ride. Show a short quote with vehicle, distance, ETA and fare. Wait for a clear confirmation such as yes, confirm, book it, or do it before using book_ride.',
          'After book_ride, report only the real returned trip status. SEARCHING_DRIVER means Zana is looking for a driver; DRIVER_ASSIGNED means a driver accepted. Never claim a driver is on the way without DRIVER_ASSIGNED or later.',
          'Keep ride replies short. Do not produce Markdown tables. Prefer short lines and bullets.',
          'Do not pretend that Zana has completed an action unless a Zana tool returned the action result.',
          'For market shopping, understand recipes and convert them into practical ingredient quantities.',
          'When the user asks what is available in a market, call search_market_inventory and use the returned live database results. Do not answer availability questions from model knowledge.',
          'When the user asks to buy ingredients or asks for a recipe shopping basket, call search_market_for_ingredients.',
          'The market tools read the live Zana market/product database. Never invent products, prices, availability or market names.',
          'The market shopping tool prefers ONE market. If one market cannot fulfill everything, report what is missing and explain that using another market would create another delivery fee.',
          'Never invent Zana market inventory, product prices, delivery fees or order IDs.',
          'Do not expose internal tool names, database details or API details.',
          'Keep replies concise, warm and action-oriented. Ask only for information that is genuinely missing.',
          location ? `Customer drop-off context: ${JSON.stringify(location)}` : 'Customer location is not currently available.',
        ].join(' '),
      }],
    };

    const firstResult = await this.generateWithFallback({ contents, tools, systemInstruction }, providers);
    const first = firstResult.response;
    const functionCall = first?.candidates?.[0]?.content?.parts?.find((part: any) => part.functionCall)?.functionCall;

    if (!functionCall) {
      return { text: this.extractText(first) ?? 'How can I help you today?', action: null };
    }

    let toolResult: any;
    if (functionCall.name === 'estimate_ride') {
      toolResult = await this.estimateRide(customerId, functionCall.args ?? {}, location);
    } else if (functionCall.name === 'book_ride') {
      toolResult = await this.bookRide(customerId);
    } else if (functionCall.name === 'search_market_inventory') {
      toolResult = await this.searchMarketInventory(functionCall.args ?? {});
    } else if (functionCall.name === 'search_market_for_ingredients') {
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

    const finalResult = await this.generateWithFallback({ contents: followupContents, tools, systemInstruction }, providers);
    const final = finalResult.response;
    return {
      text: this.extractText(final) ?? this.fallbackToolText(toolResult),
      action: toolResult?.action ?? null,
    };
  }

  private async generateWithFallback(body: any, providers: Array<{ provider: AiProvider; model: string; apiKey: string }>) {
    let last: any = null;
    for (const provider of providers) {
      try { return { provider: provider.provider, response: await this.generate(body, provider.provider, provider.apiKey, provider.model) }; }
      catch (error) { last = error; console.error('[ZANA AI] provider failed', provider.provider, error?.message || error); }
    }
    throw last || new ServiceUnavailableException('ZANA_AI_PROVIDER_ERROR');
  }

  private async generate(body: any, provider: AiProvider, apiKey: string, model: string) {
    if (provider === 'gemini') {
      const models = [model, 'gemini-3.7-flash'].filter((value, index, list) => value && list.indexOf(value) === index);
      let lastStatus = 503;
      let lastDetail = '';
      for (const candidate of models) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const response = await fetch(`${this.endpoint}/${candidate}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: JSON.stringify(body) });
          if (response.ok) return response.json();
          const detail = await response.text(); lastStatus = response.status; lastDetail = detail;
          console.error('[ZANA AI] Gemini error', response.status, candidate, detail);
          if (response.status !== 429 && response.status !== 503) break;
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 700));
        }
      }
      throw new ServiceUnavailableException(`ZANA_AI_GEMINI_${lastStatus}`);
    }

    const messages: any[] = [];
    if (body.systemInstruction?.parts?.length) messages.push({ role: 'system', content: body.systemInstruction.parts.map((p: any) => p.text || '').join('') });
    for (const item of body.contents || []) {
      if (item.role === 'user' && item.parts?.some((p: any) => p.functionResponse)) {
        for (const part of item.parts.filter((p: any) => p.functionResponse)) messages.push({ role: 'tool', tool_call_id: part.functionResponse.id || part.functionResponse.name, content: JSON.stringify(part.functionResponse.response?.result ?? part.functionResponse.response) });
        continue;
      }
      const toolCalls = item.parts?.filter((p: any) => p.functionCall).map((p: any) => ({ id: p.functionCall.id || `${p.functionCall.name}-${messages.length}`, type: 'function', function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args || {}) } }));
      const text = item.parts?.filter((p: any) => typeof p.text === 'string').map((p: any) => p.text).join('');
      messages.push({ role: item.role === 'model' ? 'assistant' : 'user', content: text || null, ...(toolCalls?.length ? { tool_calls: toolCalls } : {}) });
    }
    const tools = (body.tools?.[0]?.functionDeclarations || []).map((fn: any) => ({ type: 'function', function: fn }));
    const base = provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1';
    const response = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://zana-ride.pages.dev', 'X-Title': 'Zana Ride' } : {}) }, body: JSON.stringify({ model, messages, ...(tools.length ? { tools, tool_choice: 'auto' } : {}) }) });
    if (!response.ok) { const detail = await response.text(); console.error(`[ZANA AI] ${provider} error`, response.status, detail); throw new ServiceUnavailableException(`ZANA_AI_${provider.toUpperCase()}_${response.status}`); }
    const data = await response.json();
    const msg = data?.choices?.[0]?.message;
    const parts: any[] = [];
    if (msg?.content) parts.push({ text: msg.content });
    for (const call of msg?.tool_calls || []) parts.push({ functionCall: { name: call.function?.name, args: JSON.parse(call.function?.arguments || '{}'), id: call.id } });
    return { candidates: [{ content: { role: 'model', parts } }] };
  }

  private extractText(response: any): string | null {
    const parts = response?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((part: any) => typeof part.text === 'string').map((part: any) => part.text).join('').trim();
    return text || null;
  }

  private async geocodeDestination(query: string) {
    const q = query.trim();
    if (!q) throw new BadRequestException('DESTINATION_REQUIRED');
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=rw&q=${encodeURIComponent(q + ', Kigali, Rwanda')}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Zana-Ride/1.0 (support@zanaride.rw)' } });
    if (!response.ok) throw new BadRequestException('DESTINATION_LOOKUP_FAILED');
    const rows = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
    if (!rows.length) throw new BadRequestException('DESTINATION_NOT_FOUND');
    return { lat: Number(rows[0].lat), lng: Number(rows[0].lon), address: rows[0].display_name };
  }

  private async estimateRide(customerId: string, args: { serviceType?: string; destination?: string }, location?: Location) {
    if (!location) return { action: null, message: 'I need your pickup location before I can quote the ride.' };
    const serviceType = args.serviceType === 'CAR' ? ServiceType.CAR : ServiceType.MOTO;
    let destination: { lat: number; lng: number; address: string };
    try { destination = await this.geocodeDestination(String(args.destination || '')); }
    catch (error: any) { return { action: null, message: 'I could not locate that destination. Please give me the place name or address.' }; }
    const quote = this.trips.estimate({ lat: location.lat, lng: location.lng }, destination, serviceType);
    const draftId = `ride_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    const draft: RideDraft = {
      id: draftId, customerId, serviceType,
      pickupLat: location.lat, pickupLng: location.lng,
      pickupAddress: location.address || 'Current location',
      destinationLat: destination.lat, destinationLng: destination.lng,
      destinationAddress: destination.address,
      distanceKm: quote.distanceKm, durationMinutes: quote.durationMinutes, fare: quote.fare,
      createdAt: new Date().toISOString(),
    };
    await this.redis.set(`zana-ai:ride-draft:${draftId}`, JSON.stringify(draft), 10 * 60);
    await this.redis.set(`zana-ai:ride-draft:latest:${customerId}`, draftId, 10 * 60);
    return {
      action: { type: 'RIDE_QUOTE', draftId, serviceType, pickupAddress: draft.pickupAddress, destinationAddress: draft.destinationAddress, distanceKm: quote.distanceKm, durationMinutes: quote.durationMinutes, fare: quote.fare },
      message: `Ride quote ready. ${serviceType === ServiceType.MOTO ? 'Moto' : 'Car'} · ${quote.distanceKm} km · about ${quote.durationMinutes} min · ${quote.fare.toLocaleString()} RWF.`,
    };
  }

  private async bookRide(customerId: string) {
    const draftId = await this.redis.get(`zana-ai:ride-draft:latest:${customerId}`);
    if (!draftId) return { action: null, message: 'Please get a ride quote first, then confirm it.' };
    const raw = await this.redis.get(`zana-ai:ride-draft:${draftId}`);
    if (!raw) return { action: null, message: 'That ride quote has expired. I can create a new quote.' };
    const draft = JSON.parse(raw) as RideDraft;
    if (draft.customerId !== customerId) throw new BadRequestException('RIDE_DRAFT_NOT_YOURS');
    const trip = await this.trips.create(customerId, {
      serviceType: draft.serviceType,
      pickupAddress: draft.pickupAddress,
      pickupLat: draft.pickupLat,
      pickupLng: draft.pickupLng,
      destinationAddress: draft.destinationAddress,
      destinationLat: draft.destinationLat,
      destinationLng: draft.destinationLng,
      paymentMethod: 'CASH',
    });
    await this.redis.del(`zana-ai:ride-draft:${draftId}`);
    await this.redis.del(`zana-ai:ride-draft:latest:${customerId}`);
    const assigned = ['DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'RIDE_IN_PROGRESS'].includes(String(trip.status));
    return {
      action: { type: 'RIDE_BOOKED', tripId: trip.id, status: trip.status, fare: trip.estimatedFare, destinationAddress: trip.destinationAddress },
      message: assigned
        ? `Ride booked. A driver has been assigned. Fare: ${Number(trip.estimatedFare).toLocaleString()} RWF.`
        : String(trip.status) === 'NO_DRIVER_FOUND'
          ? 'I could not find an available driver right now. You can try again.'
          : `Ride requested. I am looking for a driver. Fare: ${Number(trip.estimatedFare).toLocaleString()} RWF.`,
    };
  }

  private async searchMarketInventory(args: { query?: string; marketName?: string; limit?: number }) {
    const query = String(args.query || '').trim();
    const marketName = String(args.marketName || '').trim();
    const limit = Math.min(50, Math.max(1, Number(args.limit || 30)));

    const markets = await this.prisma.market.findMany({
      where: {
        active: true,
        ...(marketName ? { name: { contains: marketName, mode: 'insensitive' } } : {}),
      },
      include: {
        products: {
          where: { status: 'APPROVED', available: true },
          orderBy: { name: 'asc' },
          take: 200,
          select: { id: true, name: true, price: true, referenceCost: true, available: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    if (!markets.length) {
      return { action: null, message: marketName ? `I could not find an active Zana market matching "${marketName}".` : 'No active Zana markets are available right now.' };
    }

    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
    const terms = normalize(query).split(' ').filter(Boolean);
    const score = (name: string) => {
      if (!terms.length || ['all', 'everything', 'anything', 'products', 'available', 'today', 'market'].every(x => !terms.includes(x))) {
        return terms.length ? terms.filter(t => normalize(name).includes(t)).length : 1;
      }
      const n = normalize(name);
      return terms.reduce((s, t) => s + (n.includes(t) ? 10 : 0), 0);
    };

    const results = markets.map(market => {
      const products = market.products
        .map(product => ({ ...product, price: Number(product.price), referenceCost: Number(product.referenceCost || 0), _score: score(product.name) }))
        .filter(product => !terms.length || product._score > 0 || ['all','everything','anything','products','available','today','market'].some(t => terms.includes(t)))
        .slice(0, limit)
        .map(({ _score, ...product }) => product);
      return { marketId: market.id, marketName: market.name, productCount: market.products.length, products };
    }).filter(row => row.products.length);

    return {
      action: null,
      live: true,
      query,
      markets: results,
      message: results.length
        ? `Live Zana inventory found in ${results.length} market(s).`
        : 'No matching available products were found in the active Zana market inventory.',
    };
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
        ? `I found ${draft.items.length} of ${ingredients.length} items at ${draft.marketName}.`
        : `I found all ${ingredients.length} items at ${draft.marketName}.`,
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
