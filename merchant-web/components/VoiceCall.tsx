'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { api } from '../lib/api/client';
import { Room, RoomEvent, createLocalTracks, ConnectionState } from 'livekit-client';

type CallState = 'ringing' | 'connecting' | 'connected' | 'ended';

type Props = {
  context: 'trip' | 'delivery';
  contextId: string;
  participantLabel: string;
  onClose: () => void;
};

// Ringtone using Web Audio — plays a phone ring pattern
function startRingtone(): () => void {
  let stopped = false;
  let ctx: AudioContext | null = null;

  const ring = () => {
    if (stopped) return;
    try {
      ctx = new AudioContext();
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.connect(gain);
        gain.connect(ctx!.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx!.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.4, ctx!.currentTime + start + 0.01);
        gain.gain.setValueAtTime(0.4, ctx!.currentTime + start + dur - 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx!.currentTime + start + dur);
        osc.start(ctx!.currentTime + start);
        osc.stop(ctx!.currentTime + start + dur);
      };
      // Classic double-ring pattern: 0.4s on, 0.2s off, 0.4s on, 2s off
      playTone(480, 0, 0.4);
      playTone(440, 0, 0.4);
      playTone(480, 0.6, 0.4);
      playTone(440, 0.6, 0.4);
      // Schedule next ring cycle
      setTimeout(() => {
        ctx?.close();
        ctx = null;
        if (!stopped) ring();
      }, 3000);
    } catch {}
  };

  // Start after a short delay to allow page to settle
  const t = setTimeout(ring, 300);
  return () => {
    stopped = true;
    clearTimeout(t);
    ctx?.close();
  };
}

export default function VoiceCall({ context, contextId, participantLabel, onClose }: Props) {
  const roomRef = useRef<Room | null>(null);
  const [callState, setCallState] = useState<CallState>('ringing');
  const [muted, setMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const timerRef = useRef<any>(null);
  const stopRingRef = useRef<(() => void) | null>(null);

  // Start ringing immediately
  useEffect(() => {
    stopRingRef.current = startRingtone();
    return () => stopRingRef.current?.();
  }, []);

  const startCall = useCallback(async () => {
    // Stop ring when connecting
    stopRingRef.current?.();
    stopRingRef.current = null;
    setCallState('connecting');

    try {
      const { token, wsUrl } = await api.post<{ token: string; wsUrl: string; roomId: string }>(
        '/calls/token',
        { context, contextId }
      );

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        // Keep connection alive even if other party hasn't joined
        disconnectOnPageLeave: false,
      });
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, () => {
        setCallState('connected');
        if (!timerRef.current) timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        // Only end if we were connected (other party left)
        setCallState(prev => {
          if (prev === 'connected') {
            handleEnd();
          }
          return prev;
        });
      });

      room.on(RoomEvent.Disconnected, () => handleEnd());

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (state === ConnectionState.Connected) {
          // We're in the room — stay connected even if no one else is there yet
          setCallState(prev => prev === 'connecting' ? 'ringing' : prev);
        }
      });

      await room.connect(wsUrl, token);

      // Publish audio — this is what the other party hears
      const tracks = await createLocalTracks({ audio: true, video: false });
      for (const track of tracks) {
        await room.localParticipant.publishTrack(track);
      }

      // Stay in "ringing" state until other party joins
      setCallState('ringing');

    } catch (err: any) {
      setError(err?.message ?? 'Could not connect call');
      setCallState('ended');
      setTimeout(onClose, 2000);
    }
  }, [context, contextId]);

  // Auto-connect after 1 second
  useEffect(() => {
    const t = setTimeout(startCall, 1000);
    return () => {
      clearTimeout(t);
      clearInterval(timerRef.current);
      roomRef.current?.disconnect();
    };
  }, []);

  const handleEnd = useCallback(() => {
    stopRingRef.current?.();
    clearInterval(timerRef.current);
    roomRef.current?.disconnect();
    setCallState('ended');
    setTimeout(onClose, 800);
  }, [onClose]);

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

      <div className="flex flex-col items-center gap-4 mt-8">
        <div className="relative flex items-center justify-center">
          {(callState === 'ringing') && (
            <>
              <div className="absolute w-36 h-36 rounded-full bg-white/10 animate-ping" />
              <div className="absolute w-48 h-48 rounded-full bg-white/5 animate-ping" style={{ animationDelay: '0.4s' }} />
            </>
          )}
          <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center z-10">
            <div className="w-20 h-20 rounded-full bg-white/30 flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </div>
          </div>
        </div>

        <p className="text-white text-2xl font-bold mt-2">{participantLabel}</p>
        <div className="flex items-center gap-2">
          {callState === 'connecting' && <Loader2 size={14} className="text-white/60 animate-spin" />}
          <p className="text-white/70 text-sm">{stateLabel}</p>
        </div>
        {callState === 'ringing' && roomRef.current && (
          <p className="text-white/40 text-xs">Waiting for {participantLabel} to answer...</p>
        )}
        {error && <p className="text-red-300 text-xs text-center mt-1">{error}</p>}
      </div>

      {callState !== 'ended' && (
        <div className="flex items-end justify-center gap-10">
          <div className="flex flex-col items-center gap-2">
            <button onClick={toggleMute}
              className={`w-16 h-16 rounded-full flex items-center justify-center ${muted ? 'bg-white' : 'bg-white/20'}`}>
              {muted ? <MicOff size={24} className="text-zana-primary" /> : <Mic size={24} className="text-white" />}
            </button>
            <p className="text-white/60 text-xs">{muted ? 'Unmute' : 'Mute'}</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button onClick={handleEnd}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
              <PhoneOff size={32} className="text-white" />
            </button>
            <p className="text-white/60 text-xs">End</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button onClick={() => setSpeakerOff(s => !s)}
              className={`w-16 h-16 rounded-full flex items-center justify-center ${speakerOff ? 'bg-white' : 'bg-white/20'}`}>
              {speakerOff ? <VolumeX size={24} className="text-zana-primary" /> : <Volume2 size={24} className="text-white" />}
            </button>
            <p className="text-white/60 text-xs">{speakerOff ? 'Speaker off' : 'Speaker'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
