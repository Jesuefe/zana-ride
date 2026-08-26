import type React from 'react';

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type DriverOnlineStatus = 'OFFLINE' | 'ONLINE' | 'BUSY';

export type TripRequest = {
  id: string;
  pickupAddress: string;
  pickupCoords: LatLng;
  destinationAddress: string;
  destinationCoords: LatLng;
  distanceToPickupKm: number;
  tripDistanceKm: number;
  estimatedEarningsRwf: number;
  serviceType: 'BIKE' | 'ECONOMY';
  customerName: string;
  customerRating: number;
};

export type TripStatus =
  | 'ACCEPTED'
  | 'EN_ROUTE_TO_PICKUP'
  | 'ARRIVED_AT_PICKUP'
  | 'TRIP_IN_PROGRESS'
  | 'COMPLETED';

export type EarningsPeriod = 'today' | 'week' | 'month' | 'all';

export type EarningsSummary = {
  gross: number;
  commission: number;
  bonus: number;
  net: number;
  trips: number;
};

export type ChatMessage = {
  id: string;
  from: 'driver' | 'customer';
  text: string;
  time: string;
};

export type MainTabParamList = {
  HomeTab: undefined;
  TripsTab: undefined;
  EarningsTab: undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  PhoneNumber: undefined;
  OtpVerification: { phone: string };
  DocumentUpload: undefined;
  PendingApproval: undefined;
  MainTabs: undefined;
  IncomingRequest: { request: TripRequest };
  ActiveTrip: { request: TripRequest };
  Chat: { customerName: string };
  Notifications: undefined;
};
