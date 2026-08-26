import { create } from 'zustand';
import { DriverOnlineStatus, TripRequest, TripStatus } from '../types';

type DriverState = {
  onlineStatus: DriverOnlineStatus;
  activeTrip: TripRequest | null;
  tripStatus: TripStatus | null;
  todayEarnings: number;
  todayTrips: number;

  setOnlineStatus: (status: DriverOnlineStatus) => void;
  setActiveTrip: (trip: TripRequest | null) => void;
  setTripStatus: (status: TripStatus | null) => void;
  completeTrip: (earnedRwf: number) => void;
};

export const useDriverStore = create<DriverState>((set) => ({
  onlineStatus: 'OFFLINE',
  activeTrip: null,
  tripStatus: null,
  todayEarnings: 18500,
  todayTrips: 7,

  setOnlineStatus: (status) => set({ onlineStatus: status }),
  setActiveTrip: (trip) => set({ activeTrip: trip }),
  setTripStatus: (status) => set({ tripStatus: status }),
  completeTrip: (earnedRwf) =>
    set((s) => ({
      todayEarnings: s.todayEarnings + earnedRwf,
      todayTrips: s.todayTrips + 1,
      activeTrip: null,
      tripStatus: null,
    })),
}));
