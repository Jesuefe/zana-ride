'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { api } from '../lib/api/client';
import { Room, RoomEvent, Track, createLocalTracks, ConnectionState } from 'livekit-client';
import { io, Socket } from 'socket.io-client';
import { getToken } from '../lib/api/client';

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
  const callIdRef = useRef<string | null>(null);
  const [callState, setCallState] = useState<CallState>('ringing');
  const [muted, setMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [audioBlocked, setAudioBlocked] = useState(false);
  const recoveryTimerRef = useRef<any>(null);
  const endedRef = useRef(false);
  const timerRef = useRef<any>(null);
  const stopRingRef = useRef<(() => void) | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const localMediaReadyRef = useRef(false);
  const remoteAudioReadyRef = useRef(false);
  const mediaConnectedRef = useRef(false);
  const remotePeerMediaReadyRef = useRef(false);

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
      // Create the call — this both mints our own token and rings the other
      // party over the socket. The old code skipped this step entirely and
      // called an endpoint that never existed, so the other side was never
      // actually notified a call was coming.
      const created = await api.post<{
        callId: string; token: string; roomName: string; wsUrl: string;
      }>('/calls', { context, contextId });

      const { token, wsUrl, callId, roomName } = created;
      callIdRef.current = callId;

      // Listen for the other side accepting or declining before we commit
      // to joining the LiveKit room — joining early just to sit alone in an
      // empty room wastes a connection and looks connected when it is not.
      const authToken = getToken();
      if (authToken) {
        const socket = io(process.env.NEXT_PUBLIC_API_URL ?? 'https://zana.ajumalink.com', {
          auth: { token: authToken },
          transports: ['websocket'],
        });
        socketRef.current = socket;
        socket.on('call:declined', (d: any) => {
          if (d.callId === callId) { setCallState('ended'); setTimeout(onClose, 1500); }
        });
        socket.on('call:missed', (d: any) => {
          if (d.callId === callId) { setCallState('ended'); setError('No answer'); setTimeout(onClose, 1500); }
        });
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        // Keep connection alive even if other party hasn't joined
        disconnectOnPageLeave: false,
      });
      roomRef.current = room;

      const markMediaReady = () => {
        if (mediaConnectedRef.current || !localMediaReadyRef.current || !remoteAudioReadyRef.current || !remotePeerMediaReadyRef.current) return;
        mediaConnectedRef.current = true;
        setCallState('connected');
        if (!timerRef.current) timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        api.post(`/calls/${callId}/connected`).catch(() => {});
        console.log('[CALL] TWO-WAY AUDIO CONFIRMED — five gates passed');
      };

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
        document.querySelectorAll('audio').forEach(() => {});
        try {
          const audioTracks = room.remoteParticipants;
          audioTracks.forEach((participant) => {
            participant.trackPublications.forEach((publication) => {
              if (publication.kind === Track.Kind.Audio && publication.track) {
                const el = publication.track.attach() as HTMLAudioElement;
                el.autoplay = true;
                el.muted = false;
                el.volume = 1;
                el.setAttribute('playsinline', '');
                if (!document.body.contains(el)) document.body.appendChild(el);
                void el.play().then(() => setAudioBlocked(false)).catch(() => {});
                played = true;
              }
            });
          });
        } catch {}
        return played;
      };

      const startRecoveryWindow = () => {
        clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = setTimeout(() => {
          if (!mediaConnectedRef.current) {
            setError('Call could not restore audio connection');
            handleEnd();
          }
        }, 12_000);
      };

      const restoreMedia = async () => {
        if (endedRef.current) return;
        setCallState('connecting');
        localMediaReadyRef.current = false;
        remoteAudioReadyRef.current = false;
        remotePeerMediaReadyRef.current = false;
        mediaConnectedRef.current = false;
        try {
          const publication = await room.localParticipant.setMicrophoneEnabled(true);
          localMediaReadyRef.current = !!publication?.track && room.localParticipant.isMicrophoneEnabled;
          await tryPlayRemoteAudio();
          await publishMediaReady();
          markMediaReady();
        } catch (err) {
          console.warn('[CALL] Media restore attempt failed:', err);
        }
        startRecoveryWindow();
      };

      room.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('[CALL] Remote participant connected:', participant.identity);
        if (localMediaReadyRef.current) void publishMediaReady();
      });

      room.on(RoomEvent.DataReceived, (payload, participant) => {
        try {
          const message = JSON.parse(new TextDecoder().decode(payload));
          if (message?.type === 'ZANA_MEDIA_READY' && participant) {
            remotePeerMediaReadyRef.current = true;
            console.log('[CALL] Remote peer confirmed microphone publication:', participant.identity);
            markMediaReady();
          }
        } catch {}
      });

      room.on(RoomEvent.Reconnecting, () => {
        console.log('[CALL] Reconnecting...');
        setCallState('connecting');
        startRecoveryWindow();
      });

      room.on(RoomEvent.Reconnected, async () => {
        console.log('[CALL] Reconnected — restoring media');
        await restoreMedia();
      });

      room.on(RoomEvent.ConnectionStateChanged, (connectionState: ConnectionState) => {
        console.log('[CALL] LiveKit connection state:', connectionState);
        if (connectionState === ConnectionState.Connected && localMediaReadyRef.current) {
          void publishMediaReady();
        }
      });

      room.on(RoomEvent.TrackSubscribed, async (track, _publication, participant) => {
        if (track.kind !== Track.Kind.Audio) return;
        console.log('[CALL] Remote audio subscribed from:', participant.identity);
        const el = track.attach() as HTMLAudioElement;
        el.autoplay = true;
        el.muted = false;
        el.volume = 1;
        el.setAttribute('playsinline', '');
        document.body.appendChild(el);
        try {
          await el.play();
          remoteAudioReadyRef.current = true;
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

      room.on(RoomEvent.ParticipantDisconnected, () => {
        // Only end if we were connected (other party left)
        setCallState(prev => {
          if (prev === 'connected') {
            handleEnd();
          }
          return prev;
        });
      });

      room.on(RoomEvent.Disconnected, () => {
        if (!endedRef.current) handleEnd();
      });

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
      const micPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (!micPublication?.track || !room.localParticipant.isMicrophoneEnabled) {
        throw new Error('Microphone was not published');
      }
      localMediaReadyRef.current = true;
      await publishMediaReady();
      markMediaReady();
      console.log('[CALL] Microphone published and verified');

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
    if (endedRef.current) return;
    endedRef.current = true;
    clearTimeout(recoveryTimerRef.current);
    stopRingRef.current?.();
    clearInterval(timerRef.current);
    roomRef.current?.disconnect();
    socketRef.current?.disconnect();
    socketRef.current = null;
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
          {audioBlocked && (
            <div className="flex flex-col items-center gap-2">
              <button onClick={async () => {
                const played = await (async () => {
                  let ok = false;
                  roomRef.current?.remoteParticipants.forEach((participant) => {
                    participant.trackPublications.forEach((publication) => {
                      if (publication.kind === Track.Kind.Audio && publication.track) {
                        const el = publication.track.attach() as HTMLAudioElement;
                        el.muted = false; el.volume = 1;
                        if (!document.body.contains(el)) document.body.appendChild(el);
                        void el.play().then(() => setAudioBlocked(false)).catch(() => {});
                        ok = true;
                      }
                    });
                  });
                  return ok;
                })();
                if (played) {
                  setError('');
                  remoteAudioReadyRef.current = true;
                  if (localMediaReadyRef.current && remotePeerMediaReadyRef.current && !mediaConnectedRef.current) {
                    mediaConnectedRef.current = true;
                    setCallState('connected');
                    if (!timerRef.current) timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
                    if (callIdRef.current) api.post(`/calls/${callIdRef.current}/connected`).catch(() => {});
                  }
                }
              }}
                className="px-4 py-3 rounded-full bg-white text-gray-900 text-xs font-bold">
                Enable audio
              </button>
            </div>
          )}

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
