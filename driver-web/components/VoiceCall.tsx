'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { api } from '../lib/api/client';
import {
  Room,
  RoomEvent,
  Track,
  createLocalTracks,
  ConnectionState,
} from 'livekit-client';

type CallState = 'ringing' | 'connecting' | 'connected' | 'ended';

type Props = {
  context: 'trip' | 'delivery';
  contextId: string;
  participantLabel: string;
  onClose: () => void;
};

// Simple ringtone using Web Audio API
function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<any>(null);

  const playRing = useCallback(() => {
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      const ctx = ctxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      osc.frequency.setValueAtTime(620, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.2);
    } catch {}
  }, []);

  useEffect(() => {
    if (!active) {
      clearInterval(intervalRef.current);
      return;
    }
    playRing();
    intervalRef.current = setInterval(playRing, 2500);
    return () => {
      clearInterval(intervalRef.current);
      ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, [active, playRing]);
}

export default function VoiceCall({ context, contextId, participantLabel, onClose }: Props) {
  const roomRef = useRef<Room | null>(null);
  const [callState, setCallState] = useState<CallState>('ringing');
  const [muted, setMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const timerRef = useRef<any>(null);

  // Ring until connected or ended
  useRingtone(callState === 'ringing');

  const startCall = useCallback(async () => {
    setCallState('connecting');
    try {
      const { token, wsUrl } = await api.post<{ token: string; wsUrl: string; roomId: string }>(
        '/calls/token',
        { context, contextId }
      );

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, () => {
        setCallState('connected');
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      });

      room.on(RoomEvent.ParticipantDisconnected, handleEnd);
      room.on(RoomEvent.Disconnected, handleEnd);

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (state === ConnectionState.Connected) {
          setCallState('connected');
          if (!timerRef.current) timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        }
      });

      await room.connect(wsUrl, token);
      const tracks = await createLocalTracks({ audio: true, video: false });
      for (const track of tracks) await room.localParticipant.publishTrack(track);
      setCallState('connected');

    } catch (err: any) {
      setError(err?.message ?? 'Could not connect call');
      setCallState('ended');
      setTimeout(onClose, 2000);
    }
  }, [context, contextId]);

  // Start ringing immediately, connect after 2s (simulates outgoing call UX)
  useEffect(() => {
    const t = setTimeout(startCall, 2000);
    return () => {
      clearTimeout(t);
      clearInterval(timerRef.current);
      roomRef.current?.disconnect();
    };
  }, []);

  const handleEnd = () => {
    clearInterval(timerRef.current);
    roomRef.current?.disconnect();
    setCallState('ended');
    setTimeout(onClose, 800);
  };

  const toggleMute = async () => {
    if (!roomRef.current) return;
    await roomRef.current.localParticipant.setMicrophoneEnabled(muted);
    setMuted(m => !m);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const stateLabel = {
    ringing: 'Calling...',
    connecting: 'Connecting...',
    connected: fmt(duration),
    ended: error || 'Call ended',
  }[callState];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between py-16 px-6"
      style={{ background: 'linear-gradient(160deg, #00A082 0%, #004D3E 100%)' }}>

      {/* Pulsing avatar */}
      <div className="flex flex-col items-center gap-4 mt-8">
        <div className="relative">
          {callState === 'ringing' && (
            <>
              <div className="absolute inset-0 rounded-full bg-white/10 animate-ping" style={{ transform: 'scale(1.4)' }} />
              <div className="absolute inset-0 rounded-full bg-white/10 animate-ping" style={{ transform: 'scale(1.8)', animationDelay: '0.3s' }} />
            </>
          )}
          <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center relative z-10">
            <div className="w-20 h-20 rounded-full bg-white/30 flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M20 10.999h2C22 5.869 18.127 2 12.99 2v2C17.052 4 20 6.943 20 10.999z" fill="white"/>
                <path d="M13 8c2.103 0 3 .897 3 3h2c0-3.225-1.775-5-5-5v2zm3.422 5.443a1.001 1.001 0 0 0-1.391.043l-2.393 2.461c-.576-.11-1.734-.471-2.926-1.66-1.192-1.193-1.553-2.354-1.66-2.926l2.459-2.394a1 1 0 0 0 .043-1.391L6.859 3.513a1 1 0 0 0-1.391-.087l-2.17 1.861a1 1 0 0 0-.29.649c-.015.25-.301 6.172 4.291 10.766C11.305 20.707 16.323 21 17.705 21c.202 0 .326-.006.359-.008a.992.992 0 0 0 .648-.291l1.86-2.171a1 1 0 0 0-.086-1.391l-4.064-3.696z" fill="white"/>
              </svg>
            </div>
          </div>
        </div>

        <p className="text-white text-2xl font-bold mt-2">{participantLabel}</p>
        <div className="flex items-center gap-2">
          {callState === 'connecting' && <Loader2 size={14} className="text-white/60 animate-spin" />}
          <p className="text-white/70 text-sm">{stateLabel}</p>
        </div>
        {error && <p className="text-red-300 text-xs text-center">{error}</p>}
      </div>

      {/* Controls */}
      {callState !== 'ended' && (
        <div className="flex items-end justify-center gap-10">
          {/* Mute */}
          <div className="flex flex-col items-center gap-2">
            <button onClick={toggleMute}
              className={`w-16 h-16 rounded-full flex items-center justify-center ${muted ? 'bg-white' : 'bg-white/20'}`}>
              {muted
                ? <MicOff size={24} className="text-zana-primary" />
                : <Mic size={24} className="text-white" />}
            </button>
            <p className="text-white/60 text-xs">{muted ? 'Unmute' : 'Mute'}</p>
          </div>

          {/* End call */}
          <div className="flex flex-col items-center gap-2">
            <button onClick={handleEnd}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
              <PhoneOff size={32} className="text-white" />
            </button>
            <p className="text-white/60 text-xs">End</p>
          </div>

          {/* Speaker */}
          <div className="flex flex-col items-center gap-2">
            <button onClick={() => setSpeakerOff(s => !s)}
              className={`w-16 h-16 rounded-full flex items-center justify-center ${speakerOff ? 'bg-white' : 'bg-white/20'}`}>
              {speakerOff
                ? <VolumeX size={24} className="text-zana-primary" />
                : <Volume2 size={24} className="text-white" />}
            </button>
            <p className="text-white/60 text-xs">{speakerOff ? 'Speaker off' : 'Speaker'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
