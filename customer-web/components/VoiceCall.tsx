'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PhoneOff, Mic, MicOff, Loader2 } from 'lucide-react';
import { api } from '../lib/api/client';
import {
  Room, RoomEvent, Track, ConnectionState,
  type RemoteParticipant, type RemoteTrackPublication,
} from 'livekit-client';

// ── Call states ──────────────────────────────────────────────────────────────
type CallState = 'connecting' | 'ringing' | 'connected' | 'reconnecting' | 'ended' | 'failed';

type Props = {
  // For outgoing calls
  rideId?: string;
  // For incoming calls (driver receiving)
  incomingCallId?: string;
  roomName?: string;
  wsUrl?: string;
  token?: string;
  participantLabel: string;
  onClose: () => void;
};

export default function VoiceCall({
  rideId,
  incomingCallId,
  roomName: incomingRoom,
  wsUrl: incomingWsUrl,
  token: incomingToken,
  participantLabel,
  onClose,
}: Props) {
  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const heartbeatRef = useRef<any>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(incomingCallId ?? null);

  const [state, setState] = useState<CallState>(incomingCallId ? 'connected' : 'connecting');
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (ringtoneRef.current) { ringtoneRef.current.pause(); ringtoneRef.current = null; }
    clearInterval(heartbeatRef.current);
    clearInterval(timerRef.current);
    audioElementsRef.current.forEach(el => { el.pause(); el.srcObject = null; el.remove(); });
    audioElementsRef.current = [];
    roomRef.current?.disconnect();
    roomRef.current = null;
  }, []);

  // ── End call ───────────────────────────────────────────────────────────────
  const handleEnd = useCallback(async (reason?: string) => {
    if (callIdRef.current) {
      await api.post(`/calls/${callIdRef.current}/end`).catch(() => {});
    }
    cleanup();
    setState('ended');
    setTimeout(onClose, 800);
  }, [cleanup, onClose]);

  // ── Connect to LiveKit room ────────────────────────────────────────────────
  const connectToRoom = useCallback(async (wsUrl: string, token: string, callId: string) => {
    console.log('[CALL] Creating LiveKit room');
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      disconnectOnPageLeave: false,
    });
    roomRef.current = room;

    // ── Event handlers ──────────────────────────────────────────────────────

    room.on(RoomEvent.Connected, () => {
      console.log('[CALL] LiveKit connected');
    });

    room.on(RoomEvent.Reconnecting, () => {
      console.log('[CALL] Reconnecting...');
      setState('reconnecting');
    });

    room.on(RoomEvent.Reconnected, () => {
      console.log('[CALL] Reconnected');
      setState('connected');
    });

    room.on(RoomEvent.Disconnected, () => {
      console.log('[CALL] Disconnected');
      if (state !== 'ended') handleEnd();
    });

    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('[CALL] Remote participant connected:', participant.identity);
      // Start timer immediately on participant connect — don't wait for audio track
      if (ringtoneRef.current) { ringtoneRef.current.pause(); ringtoneRef.current = null; }
      setState('connected');
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      api.post(`/calls/${callId}/connected`).catch(() => {});
    });

    room.on(RoomEvent.ParticipantDisconnected, () => {
      console.log('[CALL] Remote participant left');
      handleEnd();
    });

    room.on(RoomEvent.TrackSubscribed, (track, _pub, _participant) => {
      if (track.kind === Track.Kind.Audio) {
        console.log('[CALL] Remote audio subscribed — attaching');
        const el = track.attach() as HTMLAudioElement;
        el.autoplay = true;
        el.setAttribute('playsinline', '');
        document.body.appendChild(el);
        audioElementsRef.current.push(el);
        // Timer already started on ParticipantConnected
        console.log('[CALL] Audio attached and playing');
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        console.log('[CALL] Remote audio unsubscribed');
        track.detach().forEach(el => el.remove());
      }
    });

    // ── Connect ─────────────────────────────────────────────────────────────
    console.log('[CALL] Connecting to LiveKit...');
    await room.connect(wsUrl, token);
    console.log('[CALL] LiveKit connected — enabling microphone');

    // Request mic permission and publish
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      console.log('[CALL] Microphone enabled and published');
    } catch (err: any) {
      console.error('[CALL] Microphone error:', err);
      if (err?.message?.includes('Permission')) {
        setError('Microphone permission denied');
      }
    }

    // Heartbeat every 10s to prevent ghost calls
    heartbeatRef.current = setInterval(() => {
      api.post(`/calls/${callId}/heartbeat`).catch(() => {});
    }, 10_000);

  }, [handleEnd, state]);

  // ── Main effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        if (incomingCallId && incomingRoom && incomingWsUrl && incomingToken) {
          // Incoming call — already accepted, just connect to LiveKit
          callIdRef.current = incomingCallId;
          setState('connected');
          await connectToRoom(incomingWsUrl, incomingToken, incomingCallId);
        } else if (rideId) {
          // Outgoing call — create via API
          setState('connecting');
          const res = await api.post<{
            callId: string; roomName: string; wsUrl: string; token: string;
          }>('/calls', { rideId });

          if (cancelled) return;

          callIdRef.current = res.callId;
          setState('ringing');
          // Start ringtone
          if (!ringtoneRef.current) {
            const rt = new Audio('/ringtone.mp3');
            rt.loop = true; rt.volume = 1.0;
            rt.play().catch(() => {});
            ringtoneRef.current = rt;
          }
          await connectToRoom(res.wsUrl, res.token, res.callId);
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error('[CALL] Init error:', err);
        setError(err?.message ?? 'Could not start call');
        setState('failed');
      }
    };

    init();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  const toggleMute = async () => {
    if (!roomRef.current) return;
    const newMuted = !muted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(!newMuted);
    setMuted(newMuted);
    console.log(`[CALL] Microphone ${newMuted ? 'muted' : 'unmuted'}`);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const stateLabels: Record<CallState, string> = {
    connecting: 'Connecting...',
    ringing: `Calling ${participantLabel}...`,
    connected: fmt(duration),
    reconnecting: 'Reconnecting...',
    ended: 'Call ended',
    failed: error || 'Unable to connect',
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between py-16 px-8"
      style={{ background: 'linear-gradient(160deg, #005C4B 0%, #002D24 100%)' }}>

      {/* Avatar + name + state */}
      <div className="flex flex-col items-center gap-5 mt-10">
        <div className="relative flex items-center justify-center">
          {(state === 'ringing' || state === 'connecting') && (
            <>
              <div className="absolute w-36 h-36 rounded-full bg-white/10 animate-ping" />
              <div className="absolute w-48 h-48 rounded-full bg-white/5 animate-ping" style={{ animationDelay: '0.6s' }} />
            </>
          )}
          <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center z-10 border-2 border-white/30">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="white">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        </div>

        <p className="text-white text-2xl font-black tracking-tight">{participantLabel}</p>

        <div className="flex items-center gap-2 min-h-6">
          {(state === 'connecting' || state === 'reconnecting') && (
            <Loader2 size={14} className="text-white/60 animate-spin" />
          )}
          <p className={`text-sm tracking-wide font-mono ${
            state === 'connected' ? 'text-green-300' :
            state === 'failed' ? 'text-red-300' :
            state === 'reconnecting' ? 'text-amber-300' : 'text-white/60'
          }`}>
            {stateLabels[state]}
          </p>
        </div>

        {state === 'connected' && (
          <div className="bg-green-500/20 border border-green-500/30 rounded-full px-4 py-1">
            <p className="text-green-300 text-xs font-semibold">Zana Free Call · Connected</p>
          </div>
        )}

        {state === 'failed' && (
          <button onClick={() => { cleanup(); onClose(); }}
            className="mt-2 bg-white/10 text-white text-sm px-6 py-2 rounded-full">
            Try again
          </button>
        )}
      </div>

      {/* Controls */}
      {state !== 'ended' && state !== 'failed' && (
        <div className="flex items-end justify-center gap-16 w-full">
          {/* Mute */}
          <div className="flex flex-col items-center gap-2">
            <button onClick={toggleMute}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                muted ? 'bg-white scale-105' : 'bg-white/15 border border-white/20'
              }`}>
              {muted
                ? <MicOff size={22} className="text-gray-900" />
                : <Mic size={22} className="text-white" />}
            </button>
            <p className="text-white/50 text-xs">{muted ? 'Unmute' : 'Mute'}</p>
          </div>

          {/* End call */}
          <div className="flex flex-col items-center gap-2">
            <button onClick={() => handleEnd()}
              className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-2xl transition-colors">
              <PhoneOff size={28} className="text-white" />
            </button>
            <p className="text-white/50 text-xs">End call</p>
          </div>

          {/* Speaker placeholder */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-white/15 border border-white/20 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14M3 9v6h4l5 5V4L7 9H3z"/>
              </svg>
            </div>
            <p className="text-white/50 text-xs">Speaker</p>
          </div>
        </div>
      )}
    </div>
  );
}
