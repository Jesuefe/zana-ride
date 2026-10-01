import { api } from './client';

export type ZanaAiLocation = { lat: number; lng: number; address?: string };

export type ZanaAiAction = {
  type: 'MARKET_DRAFT' | string;
  draftId?: string;
  marketId?: string;
  marketName?: string;
  items?: Array<{
    ingredient: string;
    quantity: number;
    productId: string;
    productName: string;
    unitPrice: number;
  }>;
  missing?: string[];
  subtotal?: number;
  deliveryFee?: number;
  total?: number;
  oneMarket?: boolean;
  extraMarketDeliveryWarning?: string | null;
};

export async function sendZanaAiMessage(data: {
  message: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
  location?: ZanaAiLocation;
}) {
  return api.post<{ text: string; action: ZanaAiAction | null }>('/zana-ai/chat', data);
}

export async function executeZanaMarketDraft(
  draftId: string,
  paymentMethod: 'WALLET' | 'MOBILE_MONEY' = 'WALLET',
) {
  return api.post<{
    type: string;
    orderId: string;
    trackingCode: string;
    total: number;
    marketName: string;
  }>('/zana-ai/market/execute', { draftId, paymentMethod });
}
