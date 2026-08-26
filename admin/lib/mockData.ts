export type DriverApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type DriverOnlineStatus = 'ONLINE' | 'OFFLINE' | 'BUSY';

export type Driver = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  serviceType: 'BIKE' | 'ECONOMY' | 'COMFORT';
  approvalStatus: DriverApprovalStatus;
  onlineStatus: DriverOnlineStatus;
  rating: number;
  totalTrips: number;
  acceptanceRate: number;
  cancellationRate: number;
  earningsThisMonth: number;
  joinedDate: string;
  documents: { label: string; verified: boolean }[];
};

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export type PlatformUser = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: UserStatus;
  totalTrips: number;
  walletBalance: number;
  joinedDate: string;
};

export type TripStatus = 'COMPLETED' | 'CANCELLED' | 'IN_PROGRESS' | 'NO_DRIVER_FOUND';

export type Trip = {
  id: string;
  customerName: string;
  driverName: string | null;
  serviceType: 'BIKE' | 'ECONOMY' | 'COMFORT';
  pickup: string;
  destination: string;
  fare: number;
  status: TripStatus;
  date: string;
  rating: number | null;
};

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type SupportTicket = {
  id: string;
  customerName: string;
  category: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  date: string;
};

export const drivers: Driver[] = [
  {
    id: 'drv-001', name: 'Eric Niyonzima', phone: '+250 788 111 222', vehicle: 'TVS Motorcycle · Black', plate: 'RAD 412 B',
    serviceType: 'BIKE', approvalStatus: 'APPROVED', onlineStatus: 'ONLINE', rating: 4.9, totalTrips: 1204,
    acceptanceRate: 96, cancellationRate: 2, earningsThisMonth: 412000, joinedDate: '2026-02-14',
    documents: [{ label: 'National ID', verified: true }, { label: 'Driving licence', verified: true }, { label: 'Vehicle registration', verified: true }, { label: 'Insurance', verified: true }],
  },
  {
    id: 'drv-002', name: 'Chantal Mukamana', phone: '+250 788 222 333', vehicle: 'Toyota Vitz · Silver', plate: 'RAC 118 C',
    serviceType: 'ECONOMY', approvalStatus: 'APPROVED', onlineStatus: 'ONLINE', rating: 4.8, totalTrips: 856,
    acceptanceRate: 91, cancellationRate: 4, earningsThisMonth: 380000, joinedDate: '2026-01-22',
    documents: [{ label: 'National ID', verified: true }, { label: 'Driving licence', verified: true }, { label: 'Vehicle registration', verified: true }, { label: 'Insurance', verified: true }],
  },
  {
    id: 'drv-003', name: 'Patrick Iradukunda', phone: '+250 788 333 444', vehicle: 'Toyota Premio · White', plate: 'RAB 902 D',
    serviceType: 'COMFORT', approvalStatus: 'PENDING', onlineStatus: 'OFFLINE', rating: 0, totalTrips: 0,
    acceptanceRate: 0, cancellationRate: 0, earningsThisMonth: 0, joinedDate: '2026-08-20',
    documents: [{ label: 'National ID', verified: true }, { label: 'Driving licence', verified: true }, { label: 'Vehicle registration', verified: false }, { label: 'Insurance', verified: false }],
  },
  {
    id: 'drv-004', name: 'Divine Uwase', phone: '+250 788 444 555', vehicle: 'Honda Motorcycle · Red', plate: 'RAD 205 A',
    serviceType: 'BIKE', approvalStatus: 'APPROVED', onlineStatus: 'BUSY', rating: 4.6, totalTrips: 623,
    acceptanceRate: 88, cancellationRate: 9, earningsThisMonth: 265000, joinedDate: '2026-03-05',
    documents: [{ label: 'National ID', verified: true }, { label: 'Driving licence', verified: true }, { label: 'Vehicle registration', verified: true }, { label: 'Insurance', verified: true }],
  },
  {
    id: 'drv-005', name: 'Jean Claude Habimana', phone: '+250 788 555 666', vehicle: 'Toyota Vitz · Blue', plate: 'RAC 771 E',
    serviceType: 'ECONOMY', approvalStatus: 'SUSPENDED', onlineStatus: 'OFFLINE', rating: 3.9, totalTrips: 302,
    acceptanceRate: 68, cancellationRate: 21, earningsThisMonth: 0, joinedDate: '2026-04-11',
    documents: [{ label: 'National ID', verified: true }, { label: 'Driving licence', verified: true }, { label: 'Vehicle registration', verified: true }, { label: 'Insurance', verified: true }],
  },
  {
    id: 'drv-006', name: 'Aline Uwimana', phone: '+250 788 666 777', vehicle: 'TVS Motorcycle · Green', plate: 'RAD 553 F',
    serviceType: 'BIKE', approvalStatus: 'PENDING', onlineStatus: 'OFFLINE', rating: 0, totalTrips: 0,
    acceptanceRate: 0, cancellationRate: 0, earningsThisMonth: 0, joinedDate: '2026-08-22',
    documents: [{ label: 'National ID', verified: true }, { label: 'Driving licence', verified: false }, { label: 'Vehicle registration', verified: true }, { label: 'Insurance', verified: false }],
  },
];

export const users: PlatformUser[] = [
  { id: 'usr-001', name: 'David Uwase', phone: '+250 788 900 111', email: 'david.u@gmail.com', status: 'ACTIVE', totalTrips: 42, walletBalance: 24500, joinedDate: '2026-01-10' },
  { id: 'usr-002', name: 'Grace Mutesi', phone: '+250 788 900 222', status: 'ACTIVE', totalTrips: 128, walletBalance: 5000, joinedDate: '2025-11-02' },
  { id: 'usr-003', name: 'Samuel Bizimana', phone: '+250 788 900 333', email: 'sam.b@yahoo.com', status: 'SUSPENDED', totalTrips: 9, walletBalance: 0, joinedDate: '2026-06-30' },
  { id: 'usr-004', name: 'Claudine Ingabire', phone: '+250 788 900 444', status: 'ACTIVE', totalTrips: 67, walletBalance: 12000, joinedDate: '2026-02-18' },
  { id: 'usr-005', name: 'Moses Nkurunziza', phone: '+250 788 900 555', status: 'BANNED', totalTrips: 3, walletBalance: 0, joinedDate: '2026-07-14' },
];

export const trips: Trip[] = [
  { id: 'trip-1001', customerName: 'David Uwase', driverName: 'Eric Niyonzima', serviceType: 'BIKE', pickup: 'Kigali Heights', destination: 'Kigali Convention Centre', fare: 2000, status: 'COMPLETED', date: '2026-08-25 08:42', rating: 5 },
  { id: 'trip-1000', customerName: 'Grace Mutesi', driverName: 'Chantal Mukamana', serviceType: 'ECONOMY', pickup: 'Remera', destination: 'Kimihurura', fare: 4500, status: 'COMPLETED', date: '2026-08-25 07:15', rating: 4 },
  { id: 'trip-0999', customerName: 'Claudine Ingabire', driverName: null, serviceType: 'BIKE', pickup: 'Nyamirambo', destination: 'Airport', fare: 0, status: 'NO_DRIVER_FOUND', date: '2026-08-24 22:03', rating: null },
  { id: 'trip-0998', customerName: 'Samuel Bizimana', driverName: 'Divine Uwase', serviceType: 'BIKE', pickup: 'Kacyiru', destination: 'Nyarugenge', fare: 1800, status: 'CANCELLED', date: '2026-08-24 18:47', rating: null },
  { id: 'trip-0997', customerName: 'Moses Nkurunziza', driverName: 'Eric Niyonzima', serviceType: 'BIKE', pickup: 'Gisozi', destination: 'Downtown', fare: 2200, status: 'COMPLETED', date: '2026-08-24 15:20', rating: 5 },
];

export const supportTickets: SupportTicket[] = [
  { id: 'tkt-501', customerName: 'Samuel Bizimana', category: 'Payment Problem', subject: 'Charged twice for one ride', status: 'OPEN', priority: 'HIGH', date: '2026-08-25 09:10' },
  { id: 'tkt-500', customerName: 'Grace Mutesi', category: 'Driver Behavior', subject: 'Driver took a longer route', status: 'IN_PROGRESS', priority: 'MEDIUM', date: '2026-08-24 20:33' },
  { id: 'tkt-499', customerName: 'Claudine Ingabire', category: 'Lost Item', subject: 'Left phone in the car', status: 'WAITING_CUSTOMER', priority: 'MEDIUM', date: '2026-08-24 14:02' },
  { id: 'tkt-498', customerName: 'David Uwase', category: 'Ride Problem', subject: 'Driver cancelled after accepting', status: 'RESOLVED', priority: 'LOW', date: '2026-08-23 11:47' },
];

export const revenueSeries = [
  { day: 'Mon', revenue: 480000, trips: 210 },
  { day: 'Tue', revenue: 512000, trips: 224 },
  { day: 'Wed', revenue: 465000, trips: 198 },
  { day: 'Thu', revenue: 590000, trips: 251 },
  { day: 'Fri', revenue: 710000, trips: 302 },
  { day: 'Sat', revenue: 820000, trips: 340 },
  { day: 'Sun', revenue: 640000, trips: 276 },
];

export const zones = [
  { id: 'zone-1', name: 'Kigali CBD', surge: 1.2, deliveryEnabled: true },
  { id: 'zone-2', name: 'Kimihurura', surge: 1.0, deliveryEnabled: true },
  { id: 'zone-3', name: 'Kacyiru', surge: 1.0, deliveryEnabled: false },
  { id: 'zone-4', name: 'Remera', surge: 1.1, deliveryEnabled: true },
  { id: 'zone-5', name: 'Nyamirambo', surge: 1.0, deliveryEnabled: false },
];

export const pricingConfig = [
  { service: 'Zana Moto', baseFare: 500, minFare: 1000, perKm: 250, perMin: 30, bookingFee: 100 },
  { service: 'Zana Car', baseFare: 1000, minFare: 1500, perKm: 400, perMin: 50, bookingFee: 200 },
  { service: 'Zana Comfort', baseFare: 1500, minFare: 2500, perKm: 600, perMin: 70, bookingFee: 300 },
];
