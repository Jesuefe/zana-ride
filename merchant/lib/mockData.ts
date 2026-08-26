export type DeliveryStatus = 'REQUESTED' | 'COURIER_ASSIGNED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED';

export type MerchantDelivery = {
  id: string;
  receiverName: string;
  receiverPhone: string;
  dropoffAddress: string;
  packageType: 'DOCUMENT' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'FRAGILE';
  courierName: string | null;
  status: DeliveryStatus;
  fee: number;
  date: string;
};

export const merchant = {
  businessName: 'Kigali Fresh Grocers',
  branch: 'Kimihurura Branch',
  walletBalance: 86500,
  whatsappNumber: '+250 788 700 100',
};

export const merchantDeliveries: MerchantDelivery[] = [
  { id: 'del-2001', receiverName: 'Aline K.', receiverPhone: '+250 788 111 000', dropoffAddress: 'Kacyiru, KG 11 Ave', packageType: 'MEDIUM', courierName: 'Eric Niyonzima', status: 'DELIVERED', fee: 2200, date: '2026-08-25 09:40' },
  { id: 'del-2000', receiverName: 'Robert M.', receiverPhone: '+250 788 222 000', dropoffAddress: 'Remera, KG 17 Ave', packageType: 'SMALL', courierName: 'Divine Uwase', status: 'PICKED_UP', fee: 1800, date: '2026-08-25 08:55' },
  { id: 'del-1999', receiverName: 'Yvonne N.', receiverPhone: '+250 788 333 000', dropoffAddress: 'Nyamirambo, KG 3 St', packageType: 'FRAGILE', courierName: null, status: 'REQUESTED', fee: 2500, date: '2026-08-25 08:30' },
  { id: 'del-1998', receiverName: 'Eric S.', receiverPhone: '+250 788 444 000', dropoffAddress: 'Kimihurura, KG 9 Ave', packageType: 'LARGE', courierName: 'Chantal Mukamana', status: 'DELIVERED', fee: 3200, date: '2026-08-24 17:10' },
];
