'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { api } from '../lib/api/client';
import { Room, RoomEvent, ConnectionState } from 'livekit-client';

type CallState = 'connecting' | 'ringing' | 'connected' | 'ended';

type Props = {
  context: 'trip' | 'delivery';
  contextId: string;
  participantLabel: string;
  onClose: () => void;
};

// Simple ringtone using Web Audio API
function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!active) {
      ctxRef.current?.close();
      clearTimeout(timerRef.current);
      return;
    }

    const ring = () => {
      try {
        const ctx = new AudioContext();
        ctxRef.current = ctx;

        const playTone = (freq: number, t: number, dur: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0, ctx.currentTime + t);
          gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + t + 0.02);
          gain.gain.setValueAtTime(0.35, ctx.currentTime + t + dur - 0.05);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + t + dur);
          osc.start(ctx.currentTime + t);
          osc.stop(ctx.currentTime + t + dur);
        };

        playTone(480, 0, 0.4);
        playTone(440, 0, 0.4);
        playTone(480, 0.6, 0.4);
        playTone(440, 0.6, 0.4);

        timerRef.current = setTimeout(() => {
          ctx.close();
          ring();
        }, 3200);
      } catch {}
    };

    ring();
    return () => {
      ctxRef.current?.close();
      clearTimeout(timerRef.current);
    };
  }, [active]);
}

export default function VoiceCall({ context, contextId, participantLabel, onClose }: Props) {
  const roomRef = useRef<Room | null>(null);
  const [state, setState] = useState<CallState>('connecting');
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const timerRef = useRef<any>(null);

  useRingtone(state === 'ringing');

  const handleEnd = useCallback(() => {
    clearInterval(timerRef.current);
    roomRef.current?.disconnect();
    roomRef.current = null;
    setState('ended');
    setTimeout(onClose, 700);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      try {
        // Get token from backend
        const res = await api.post<{ token: string; wsUrl: string; roomId: string }>(
          '/calls/token',
          { context, contextId }
        );

        if (cancelled) return;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          disconnectOnPageLeave: false,
        });
        roomRef.current = room;

        // When other party joins — call is answered
        room.on(RoomEvent.ParticipantConnected, () => {
          if (cancelled) return;
          setState('connected');
          clearInterval(timerRef.current);
          timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        });

        // Other party left
        room.on(RoomEvent.ParticipantDisconnected, () => {
          if (cancelled) return;
          handleEnd();
        });

        // Disconnected from room
        room.on(RoomEvent.Disconnected, () => {
          if (cancelled) return;
          handleEnd();
        });

        // Connect to LiveKit room
        await room.connect(res.wsUrl, res.token);

        if (cancelled) { room.disconnect(); return; }

        // Enable microphone — livekit-client v2 API
        await room.localParticipant.setMicrophoneEnabled(true);

        // Show ringing — waiting for other party
        setState('ringing');

      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message ?? 'Could not start call');
        setState('ended');
        setTimeout(onClose, 2500);
      }
    };

    connect();

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      roomRef.current?.disconnect();
    };
  }, []);

  const toggleMute = async () => {
    if (!roomRef.current) return;
    const newMuted = !muted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(!newMuted);
    setMuted(newMuted);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const statusText = {
    connecting: 'Connecting...',
    ringing: 'Calling...',
    connected: fmt(duration),
    ended: error || 'Call ended',
  }[state];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between py-16 px-8"
      style={{ background: 'linear-gradient(160deg, #00A082 0%, #004D3E 100%)' }}>

      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-5 mt-8">
        <div className="relative flex items-center justify-center">
          {state === 'ringing' && (
            <>
              <div className="absolute w-36 h-36 rounded-full bg-white/10 animate-ping" />
              <div className="absolute w-48 h-48 rounded-full bg-white/5 animate-ping" style={{ animationDelay: '0.5s' }} />
            </>
          )}
          <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center z-10">
            <div className="w-20 h-20 rounded-full bg-white/30 flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
          </div>
        </div>

        <p className="text-white text-2xl font-black">{participantLabel}</p>

        <div className="flex items-center gap-2">
          {state === 'connecting' && <Loader2 size={14} className="text-white/60 animate-spin" />}
          <p className="text-white/70 text-sm tracking-wide">{statusText}</p>
        </div>

        {state === 'ringing' && (
          <p className="text-white/40 text-xs text-center">
            Waiting for {participantLabel} to answer...
          </p>
        )}

        {state === 'connected' && (
          <div className="bg-white/10 rounded-full px-4 py-1">
            <p className="text-white/80 text-xs">Connected · Zana Free Call</p>
          </div>
        )}

        {error && <p className="text-red-300 text-xs text-center mt-2">{error}</p>}
      </div>

      {/* Controls */}
      {state !== 'ended' && (
        <div className="flex items-end justify-center gap-12">
          <div className="flex flex-col items-center gap-2">
            <button onClick={toggleMute}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                muted ? 'bg-white' : 'bg-white/20'
              }`}>
              {muted
                ? <MicOff size={22} className="text-zana-primary" />
                : <Mic size={22} className="text-white" />}
            </button>
            <p className="text-white/60 text-xs">{muted ? 'Unmute' : 'Mute'}</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button onClick={handleEnd}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-xl">
              <PhoneOff size={28} className="text-white" />
            </button>
            <p className="text-white/60 text-xs">End call</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <Volume2 size={22} className="text-white" />
            </div>
            <p className="text-white/60 text-xs">Speaker</p>
          </div>
        </div>
      )}
    </div>
  );
}
