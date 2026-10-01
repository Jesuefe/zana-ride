'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, X, Check, Loader2 } from 'lucide-react';

export default function InAppCamera({
  onCapture,
  onClose,
}: {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const stop = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const start = async () => {
    stop(); setStarting(true); setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera is not available on this device.');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch (e: any) {
      setError(e?.name === 'NotAllowedError' ? 'Zana needs camera access to take this photo.' : 'Could not open the camera. Try again.');
    } finally { setStarting(false); }
  };

  useEffect(() => { start(); return stop; }, [facing]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const max = 1024;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPreview(canvas.toDataURL('image/jpeg', 0.82));
    stop();
  };

  if (preview) return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="px-5 pt-5 text-white font-black">Zana Camera</div>
      <div className="flex-1 p-4 flex items-center justify-center min-h-0">
        <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain rounded-2xl" />
      </div>
      <div className="p-5 flex items-center justify-between bg-black">
        <button onClick={() => { setPreview(null); start(); }} className="w-14 h-14 rounded-full bg-white/15 text-white flex items-center justify-center" aria-label="Retake"><RotateCcw size={23}/></button>
        <button onClick={() => { onCapture(preview); onClose(); }} className="h-14 px-7 rounded-full bg-[#00A082] text-white font-black flex items-center gap-2"><Check size={20}/>Use photo</button>
        <button onClick={onClose} className="w-14 h-14 rounded-full bg-white/15 text-white flex items-center justify-center" aria-label="Close"><X size={23}/></button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between text-white"><div><p className="font-black">Zana Camera</p><p className="text-xs text-white/60">Take a clear photo of the package</p></div><button onClick={onClose} aria-label="Close"><X size={24}/></button></div>
      <div className="relative flex-1 min-h-0 overflow-hidden bg-black flex items-center justify-center">
        <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
        {starting && <div className="absolute inset-0 flex items-center justify-center text-white"><Loader2 className="animate-spin" size={30}/></div>}
        {error && <div className="absolute inset-x-5 bottom-6 bg-white rounded-2xl p-4"><p className="text-sm font-semibold text-gray-900">{error}</p><button onClick={start} className="mt-3 w-full bg-[#00A082] text-white rounded-xl py-3 font-bold">Try again</button></div>}
      </div>
      <div className="px-6 py-6 bg-black flex items-center justify-between">
        <button onClick={() => setFacing(f => f === 'environment' ? 'user' : 'environment')} className="w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center" aria-label="Switch camera"><RotateCcw size={21}/></button>
        <button onClick={capture} disabled={starting || !!error} className="w-20 h-20 rounded-full border-4 border-white bg-[#00A082] flex items-center justify-center disabled:opacity-40" aria-label="Take photo"><Camera size={30} className="text-white"/></button>
        <div className="w-12" />
      </div>
    </div>
  );
}
