'use client';

import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { api, getToken } from '../lib/api/client';
import VoiceCall from './VoiceCall';

type Incoming = { callId:string; callerName:string; rideId:string; expiresAt?:string };
type CallData = { callId:string; roomName:string; wsUrl:string; token:string };

export default function GlobalCallNotification() {
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [call, setCall] = useState<CallData | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const stopRing = () => {
    try { ringtoneRef.current?.pause(); } catch {}
    ringtoneRef.current = null;
    try { (window as any).__zanaRingtone?.pause(); } catch {}
  };

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const socket = io(process.env.NEXT_PUBLIC_API_URL ?? 'https://zana.ajumalink.com', { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('call:incoming', (data: Incoming) => {
      setIncoming(data);
      try {
        const audio = new Audio('/ringtone.mp3');
        audio.loop = true;
        audio.volume = 1;
        void audio.play().catch(() => {});
        ringtoneRef.current = audio;
        (window as any).__zanaRingtone = audio;
      } catch {}
    });
    socket.on('call:cancelled', () => { stopRing(); setIncoming(null); });
    socket.on('call:ended', () => { stopRing(); setIncoming(null); setCall(null); });
    return () => { stopRing(); socket.disconnect(); socketRef.current = null; };
  }, []);

  const decline = async () => {
    if (!incoming) return;
    const id = incoming.callId;
    stopRing();
    setIncoming(null);
    await api.post(`/calls/${id}/decline`).catch(() => {});
  };

  const accept = async () => {
    if (!incoming) return;
    const id = incoming.callId;
    stopRing();
    try {
      const result = await api.post<CallData>(`/calls/${id}/accept`);
      setIncoming(null);
      setCall(result);
    } catch {
      setIncoming(null);
    }
  };

  if (call) {
    return (
      <VoiceCall
        incomingCallId={call.callId}
        roomName={call.roomName}
        wsUrl={call.wsUrl}
        token={call.token}
        participantLabel={incoming?.callerName ?? 'Zana customer'}
        onClose={() => setCall(null)}
      />
    );
  }

  if (!incoming) return null;

  return (
    <div className="fixed inset-x-3 top-16 z-[100] max-w-[474px] mx-auto">
      <div className="bg-zana-primary-dark text-white rounded-2xl shadow-2xl p-4 border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center animate-pulse">
            <Phone size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm">Incoming call</p>
            <p className="text-xs text-white/70 truncate">{incoming.callerName} is calling</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={decline} className="bg-white/10 border border-white/15 rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2">
            <PhoneOff size={16} /> Decline
          </button>
          <button onClick={accept} className="bg-white text-zana-primary-dark rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2">
            <Phone size={16} /> Answer
          </button>
        </div>
      </div>
    </div>
  );
}
