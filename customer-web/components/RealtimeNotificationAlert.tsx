'use client';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../lib/api/client';

let audioContext: AudioContext | null = null;
function alertSound() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    audioContext ||= new AC();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const now = audioContext.currentTime;
    [0, 0.18, 0.36].forEach((offset, i) => {
      const osc = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 1 ? 1500 : 1900;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.55, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.13);
      osc.connect(gain).connect(audioContext!.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.14);
    });
  } catch {}
}
function vibrate() {
  try { if (navigator.vibrate) navigator.vibrate([80, 70, 80, 70, 180]); } catch {}
}
export default function RealtimeNotificationAlert() {
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const socket = io(process.env.NEXT_PUBLIC_API_URL ?? 'https://zana.ajumalink.com', {
      auth: { token }, transports: ['websocket'],
    });
    const notify = () => { alertSound(); vibrate(); };
    socket.on('delivery:status', notify);
    socket.on('chat:message', notify);
    socket.on('scheduled:approaching', notify);
    socket.on('scheduled:expired', notify);
    return () => { socket.disconnect(); };
  }, []);
  return null;
}
