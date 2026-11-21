import { Capacitor, registerPlugin } from '@capacitor/core';
import { API_BASE_URL, getToken } from './api/client';

type DriverBackgroundLocationPlugin = {
  startTracking(options: { apiUrl: string; token: string; sessionId: string }): Promise<void>;
  stopTracking(): Promise<void>;
};

const NativeLocation = registerPlugin<DriverBackgroundLocationPlugin>('DriverBackgroundLocation');

export async function startDriverBackgroundLocation(sessionId?: string | null) {
  if (!Capacitor.isNativePlatform()) return;
  const token = getToken();
  if (!token || !sessionId) throw new Error('Missing driver session for background location.');
  await NativeLocation.startTracking({ apiUrl: API_BASE_URL, token, sessionId });
}

export async function stopDriverBackgroundLocation() {
  if (!Capacitor.isNativePlatform()) return;
  await NativeLocation.stopTracking();
}
