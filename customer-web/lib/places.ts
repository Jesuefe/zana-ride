export const KIGALI_CENTER = { lat: -1.9536, lng: 30.0605 };

export type Place = { id: string; name: string; address: string; lat: number; lng: number };

export const landmarks: Place[] = [
  { id: 'l1', name: 'Kigali Convention Centre', address: 'KG 2 Roundabout, Kigali', lat: -1.9536, lng: 30.0937 },
  { id: 'l2', name: 'Kigali Heights', address: 'KG 7 Ave, Kacyiru', lat: -1.9468, lng: 30.0913 },
  { id: 'l3', name: 'Kigali International Airport', address: 'Kanombe, Kigali', lat: -1.9686, lng: 30.1395 },
  { id: 'l4', name: 'Nyamirambo', address: 'Nyamirambo, Kigali', lat: -1.9767, lng: 30.0431 },
  { id: 'l5', name: 'Remera', address: 'Remera, Kigali', lat: -1.9558, lng: 30.1044 },
  { id: 'l6', name: 'Kigali Genocide Memorial', address: 'Gisozi, Kigali', lat: -1.9367, lng: 30.0619 },
];
