'use client';

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { PhoneOff, Mic, MicOff, Loader2 } from 'lucide-react';
import { api } from '../lib/api/client';
import { useLang } from '../lib/LangContext';
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
  // Refs alone don't trigger a re-render in the parent when this
  // internal state changes — this callback is what lets the trip
  // page's own speaker button actually reflect on/unavailable
  // correctly, not just fire the toggle blind.
  onSpeakerStateChange?: (state: { speakerOn: boolean; speakerSupported: boolean }) => void;
};

// Lets the trip page render its own speaker button on the same row as
// Chat/Call, rather than requiring the driver to be looking at this
// full-screen call overlay just to reach it.
export type VoiceCallHandle = {
  toggleSpeaker: () => void;
  speakerOn: boolean;
  speakerSupported: boolean;
};

const VoiceCall = forwardRef<VoiceCallHandle, Props>(function VoiceCall({
  rideId,
  incomingCallId,
  roomName: incomingRoom,
  wsUrl: incomingWsUrl,
  token: incomingToken,
  participantLabel,
  onClose,
  onSpeakerStateChange,
}: Props, ref) {
  const { dt } = useLang();
  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const heartbeatRef = useRef<any>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(incomingCallId ?? null);
  // A ref, not the state variable, because the RoomEvent.Disconnected
  // handler below is registered once inside connectToRoom (called from
  // an effect with an empty dependency array) and would otherwise always
  // see whatever `state` was at that first render — never the real,
  // current value — causing handleEnd to double-fire on every
  // deliberate end (disconnect() triggers this same event back).
  const endedRef = useRef(false);

  const [state, setState] = useState<CallState>('connecting');
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [speakerSupported, setSpeakerSupported] = useState(true);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [audioBlocked, setAudioBlocked] = useState(false);
  const recoveryTimerRef = useRef<any>(null);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (ringtoneRef.current) { ringtoneRef.current.pause(); ringtoneRef.current = null; }
    clearInterval(heartbeatRef.current);
    clearInterval(timerRef.current);
    clearTimeout(recoveryTimerRef.current);
    audioElementsRef.current.forEach(el => { el.pause(); el.srcObject = null; el.remove(); });
    audioElementsRef.current = [];
    roomRef.current?.disconnect();
    roomRef.current = null;
  }, []);

  // ── End call ───────────────────────────────────────────────────────────────
  const handleEnd = useCallback(async (reason?: string) => {
    if (endedRef.current) return; // already ending/ended — don't double-fire
    endedRef.current = true;
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
      startRecoveryWindow();
    });

    room.on(RoomEvent.Reconnected, async () => {
      console.log('[CALL] Reconnected — restoring media');
      await restoreMedia();
    });

    room.on(RoomEvent.ConnectionStateChanged, (connectionState) => {
      console.log('[CALL] LiveKit connection state:', connectionState);
      if (connectionState === ConnectionState.Connected && localMediaReady) void publishMediaReady();
    });

    room.on(RoomEvent.DataReceived, (payload, participant) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message?.type === 'ZANA_MEDIA_READY' && participant) {
          remotePeerMediaReady = true;
          console.log('[CALL] Remote peer confirmed microphone publication:', participant.identity);
          markMediaReady();
        }
      } catch {}
    });

    room.on(RoomEvent.Disconnected, () => {
      console.log('[CALL] Disconnected');
      if (!endedRef.current) handleEnd();
    });

    // Extracted so it can run from two different triggers: the normal
    // "someone just joined" event (which is all the caller side ever
    // needs, since the receiver always joins after them), and an
    // explicit check right after connecting for whoever joins second —
    // LiveKit's ParticipantConnected event only fires for participants
    // who join AFTER you, never for someone already in the room when
    // you arrive, which is exactly the receiver's situation every time.
    // Five-layer media gate: transport, local mic, remote participant, remote audio playback,
    // and explicit peer confirmation that its own microphone is published.
    let localMediaReady = false;
    let remoteAudioReady = false;
    let remotePeerMediaReady = false;
    let mediaMarkedConnected = false;

    const publishMediaReady = async () => {
      if (!room.localParticipant.isMicrophoneEnabled) return;
      try {
        const payload = new TextEncoder().encode(JSON.stringify({ type: 'ZANA_MEDIA_READY', callId }));
        await room.localParticipant.publishData(payload, { reliable: true });
      } catch (err) {
        console.warn('[CALL] Media-ready handshake send failed:', err);
      }
    };

    const tryPlayRemoteAudio = async () => {
      let played = false;
      for (const el of audioElementsRef.current) {
        try {
          el.muted = false;
          el.volume = 1;
          await el.play();
          played = true;
        } catch {}
      }
      if (played) {
        remoteAudioReady = true;
        setAudioBlocked(false);
      }
      return played;
    };

    const markMediaReady = () => {
      if (mediaMarkedConnected || !localMediaReady || !remoteAudioReady || !remotePeerMediaReady) return;
      mediaMarkedConnected = true;
      if (ringtoneRef.current) { ringtoneRef.current.pause(); ringtoneRef.current = null; }
      setState('connected');
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      api.post(`/calls/${callId}/connected`).catch(() => {});
      console.log('[CALL] TWO-WAY AUDIO CONFIRMED — five gates passed');
    };

    const startRecoveryWindow = () => {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = setTimeout(() => {
        if (!mediaMarkedConnected) {
          setError('Call could not restore audio connection');
          handleEnd('MEDIA_RECOVERY_TIMEOUT');
        }
      }, 12_000);
    };

    const restoreMedia = async () => {
      if (endedRef.current) return;
      setState('reconnecting');
      localMediaReady = false;
      remoteAudioReady = false;
      remotePeerMediaReady = false;
      mediaMarkedConnected = false;
      try {
        const publication = await room.localParticipant.setMicrophoneEnabled(true);
        localMediaReady = !!publication?.track && room.localParticipant.isMicrophoneEnabled;
        await tryPlayRemoteAudio();
        await publishMediaReady();
        markMediaReady();
      } catch (err) {
        console.warn('[CALL] Media restore attempt failed:', err);
      }
      startRecoveryWindow();
    };

    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('[CALL] Remote participant connected:', participant.identity);
      // Do not declare the call connected from signaling alone.
      // We require both local microphone publication and remote audio subscription.
    });

    room.on(RoomEvent.ParticipantDisconnected, () => {
      console.log('[CALL] Remote participant left');
      handleEnd();
    });

    room.on(RoomEvent.TrackSubscribed, async (track, _pub, participant) => {
      if (track.kind !== Track.Kind.Audio) return;
      console.log('[CALL] Remote audio subscribed from:', participant.identity);
      const el = track.attach() as HTMLAudioElement;
      el.autoplay = true;
      el.muted = false;
      el.volume = 1;
      el.setAttribute('playsinline', '');
      document.body.appendChild(el);
      audioElementsRef.current.push(el);
      try {
        await el.play();
        remoteAudioReady = true;
        setAudioBlocked(false);
        markMediaReady();
        console.log('[CALL] Remote audio playback confirmed');
      } catch (err) {
        console.error('[CALL] Remote audio playback blocked:', err);
        setAudioBlocked(true);
        setError('Audio is blocked — tap Enable audio');
      }
    });

    room.on(RoomEvent.TrackSubscriptionFailed, (sid) => {
      console.error('[CALL] Remote audio subscription failed:', sid);
      setError('Remote audio connection failed');
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

    // Handles the case ParticipantConnected structurally cannot: the
    // other side got here first and is already in the room right now.
    if (room.remoteParticipants.size > 0) {
      console.log('[CALL] Remote participant already present:', room.remoteParticipants.size);
    }

    // Request mic permission and publish
    try {
      const micPublication = await room.localParticipant.setMicrophoneEnabled(true);
      if (!micPublication?.track || !room.localParticipant.isMicrophoneEnabled) {
        throw new Error('Microphone was not published');
      }
      localMediaReady = true;
      await publishMediaReady();
      markMediaReady();
      console.log('[CALL] Microphone enabled and published:', micPublication.track.sid ?? 'ok');
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

  }, [handleEnd]);

  // ── Main effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        if (incomingCallId && incomingRoom && incomingWsUrl && incomingToken) {
          // Incoming call — already accepted, connect to LiveKit. Stays
          // in the normal "connecting" state and only actually shows
          // Connected once RoomEvent.ParticipantConnected genuinely
          // fires — same real signal the caller side waits for, so the
          // receiver doesn't show a "Connected" badge and a running
          // timer before the caller has even joined the room.
          callIdRef.current = incomingCallId;
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

  // Was previously a pure visual placeholder — tapping it did nothing at
  // all. setSinkId (the underlying browser API this needs) has real,
  // long-standing platform limits worth being upfront about: no support
  // at all on iOS Safari/WKWebView, and inconsistent support even on
  // Android WebViews. This does the real thing where the platform
  // genuinely allows it, and tells the driver plainly when it can't,
  // rather than silently doing nothing and looking broken either way.
  const toggleSpeaker = async () => {
    if (!roomRef.current) return;
    const testEl = document.createElement('audio');
    if (typeof (testEl as any).setSinkId !== 'function') {
      setSpeakerSupported(false);
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter(d => d.kind === 'audiooutput');
      const wantSpeaker = !speakerOn;
      const target = wantSpeaker
        ? outputs.find(d => /speaker/i.test(d.label))
        : outputs.find(d => /ear|receiver|default/i.test(d.label)) ?? outputs[0];
      if (!target) { setSpeakerSupported(false); return; }
      await roomRef.current.switchActiveDevice('audiooutput', target.deviceId);
      setSpeakerOn(wantSpeaker);
    } catch (e) {
      console.error('[CALL] Speaker switch failed:', e);
      setSpeakerSupported(false);
    }
  };

  useImperativeHandle(ref, () => ({
    toggleSpeaker,
    speakerOn,
    speakerSupported,
  }), [speakerOn, speakerSupported]);

  useEffect(() => {
    onSpeakerStateChange?.({ speakerOn, speakerSupported });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakerOn, speakerSupported]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const stateLabels: Record<CallState, string> = {
    connecting: dt('Connecting...'),
    ringing: `${dt('Calling')} ${participantLabel}...`,
    connected: fmt(duration),
    reconnecting: dt('Reconnecting...'),
    ended: dt('Call ended'),
    failed: error || dt('Unable to connect'),
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
            <p className="text-green-300 text-xs font-semibold">{dt('Zana Free Call · Connected')}</p>
          </div>
        )}

        {state === 'failed' && (
          <button onClick={() => { cleanup(); onClose(); }}
            className="mt-2 bg-white/10 text-white text-sm px-6 py-2 rounded-full">{dt("Try again")}</button>
        )}
      </div>

      {/* Controls */}
      {state !== 'ended' && state !== 'failed' && (
        <div className="flex items-end justify-center gap-16 w-full">
          {audioBlocked && (
            <div className="flex flex-col items-center gap-2">
              <button onClick={async () => {
                const played = await tryPlayRemoteAudio();
                if (played) {
                  setAudioBlocked(false);
                  setError('');
                  markMediaReady();
                }
              }}
                className="px-4 py-3 rounded-full bg-white text-gray-900 text-xs font-bold">
                {dt('Enable audio')}
              </button>
            </div>
          )}

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
            <p className="text-white/50 text-xs">{muted ? dt('Unmute') : dt('Mute')}</p>
          </div>

          {/* End call */}
          <div className="flex flex-col items-center gap-2">
            <button onClick={() => handleEnd()}
              className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-2xl transition-colors">
              <PhoneOff size={28} className="text-white" />
            </button>
            <p className="text-white/50 text-xs">{dt('End call')}</p>
          </div>

          {/* Speaker */}
          <div className="flex flex-col items-center gap-2">
            <button onClick={toggleSpeaker} disabled={!speakerSupported}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all disabled:opacity-40 ${
                speakerOn ? 'bg-white scale-105' : 'bg-white/15 border border-white/20'
              }`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill={speakerOn ? '#111' : 'white'}>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14M3 9v6h4l5 5V4L7 9H3z"/>
              </svg>
            </button>
            <p className="text-white/50 text-xs">{!speakerSupported ? dt('Unavailable') : speakerOn ? dt('Speaker on') : dt('Speaker')}</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default VoiceCall;
