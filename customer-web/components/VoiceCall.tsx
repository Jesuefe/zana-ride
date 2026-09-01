'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { api } from '../lib/api/client';
import {
  Room,
  RoomEvent,
  LocalTrackPublication,
  RemoteParticipant,
  Track,
  createLocalTracks,
  ConnectionState,
} from 'livekit-client';

type CallState = 'idle' | 'connecting' | 'connected' | 'ended';

type Props = {
  context: 'trip' | 'delivery';
  contextId: string;
  participantLabel: string; // "Eric" or "Driver" shown on call screen
  onClose: () => void;
};

export default function VoiceCall({ context, contextId, participantLabel, onClose }: Props) {
  const roomRef = useRef<Room | null>(null);
  const [callState, setCallState] = useState<CallState>('connecting');
  const [muted, setMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const timerRef = useRef<any>(null);

  const startCall = useCallback(async () => {
    try {
      // Get token from backend
      const { token, wsUrl } = await api.post<{ token: string; wsUrl: string; roomId: string }>(
        '/calls/token',
        { context, contextId }
      );

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, () => {
        setCallState('connected');
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        handleEnd();
      });

      room.on(RoomEvent.Disconnected, () => {
        handleEnd();
      });

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (state === ConnectionState.Connected) {
          setCallState('connected');
          timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        }
      });

      await room.connect(wsUrl, token);

      // Publish audio only — no video
      const tracks = await createLocalTracks({ audio: true, video: false });
      for (const track of tracks) {
        await room.localParticipant.publishTrack(track);
      }

      setCallState('connected');

    } catch (err: any) {
      setError(err?.message ?? 'Could not connect call');
      setCallState('ended');
    }
  }, [context, contextId]);

  useEffect(() => {
    startCall();
    return () => {
      clearInterval(timerRef.current);
      roomRef.current?.disconnect();
    };
  }, []);

  const handleEnd = () => {
    clearInterval(timerRef.current);
    roomRef.current?.disconnect();
    setCallState('ended');
    setTimeout(onClose, 1000);
  };

  const toggleMute = async () => {
    if (!roomRef.current) return;
    const enabled = !muted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(!enabled);
    setMuted(enabled);
  };

  const toggleSpeaker = () => {
    setSpeakerOff(s => !s);
    // On mobile browsers, speaker switching isn't directly controllable
    // but we track state for UI consistency
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-zana-primary-dark flex flex-col items-center justify-between py-16 px-6">
      {/* Caller info */}
      <div className="flex flex-col items-center gap-4 mt-8">
        <div className="w-24 h-24 rounded-full bg-white/15 flex items-center justify-center">
          <Phone size={40} className="text-white" />
        </div>
        <p className="text-white text-2xl font-bold">{participantLabel}</p>
        <p className="text-white/60 text-sm">
          {callState === 'connecting' && 'Connecting...'}
          {callState === 'connected' && formatDuration(duration)}
          {callState === 'ended' && (error || 'Call ended')}
        </p>
        {callState === 'connecting' && (
          <Loader2 size={20} className="text-white/60 animate-spin mt-2" />
        )}
        {error && <p className="text-red-300 text-xs text-center mt-2">{error}</p>}
      </div>

      {/* Controls */}
      {callState !== 'ended' && (
        <div className="flex items-center gap-8">
          {/* Mute */}
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              muted ? 'bg-white/30' : 'bg-white/15'
            }`}
          >
            {muted ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
          </button>

          {/* End call */}
          <button
            onClick={handleEnd}
            className="w-18 h-18 rounded-full bg-red-500 flex items-center justify-center"
            style={{ width: 72, height: 72 }}
          >
            <PhoneOff size={28} className="text-white" />
          </button>

          {/* Speaker */}
          <button
            onClick={toggleSpeaker}
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              speakerOff ? 'bg-white/30' : 'bg-white/15'
            }`}
          >
            {speakerOff ? <VolumeX size={22} className="text-white" /> : <Volume2 size={22} className="text-white" />}
          </button>
        </div>
      )}

      {callState === 'ended' && (
        <button onClick={onClose} className="text-white/60 text-sm underline">
          Close
        </button>
      )}
    </div>
  );
}
