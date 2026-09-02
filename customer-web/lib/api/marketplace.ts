import { api } from './client';

export type MarketplaceProduct = {
  id: string; name: string; description?: string;
  price: number; imageUrl?: string; category: string;
  stock: number; available: boolean;
};

export type MarketplaceMerchant = {
  id: string; businessName: string; branch?: string;
  businessAddress?: string; businessLat?: number; businessLng?: number;
  deliveryFee: number; distanceText: string; distKm: number;
  products: MarketplaceProduct[];
};

export type CartItem = { product: MarketplaceProduct; quantity: number; merchantId: string };

export async function fetchMarketplaceWithLocation(
  category: string,
  lat: number,
  lng: number,
): Promise<MarketplaceMerchant[]> {
  return api.get<MarketplaceMerchant[]>(
    `/marketplace?category=${category}&lat=${lat}&lng=${lng}`
  );
}

export async function placeOrder(data: {
  merchantId: string;
  items: { productId: string; quantity: number }[];
  dropoffLat: number; dropoffLng: number; dropoffAddress: string;
  paymentMethod: 'WALLET' | 'MOBILE_MONEY';
}) {
  return api.post<any>('/orders', data);
}
