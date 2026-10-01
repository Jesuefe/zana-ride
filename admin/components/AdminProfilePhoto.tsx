'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { getMyProfile, updateMyPhoto } from '../lib/api/admin';

export default function AdminProfilePhoto() {
  const [profile, setProfile] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { getMyProfile().then(setProfile).catch(() => undefined); }, []);
  const choose = async (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    setBusy(true); setMessage('');
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
      });
      const img = new Image(); img.src = data;
      await new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); });
      const canvas = document.createElement('canvas'); const max = 512;
      const scale = Math.min(1, max / Math.max(img.width || max, img.height || max));
      canvas.width = Math.max(1, Math.round((img.width || max) * scale)); canvas.height = Math.max(1, Math.round((img.height || max) * scale));
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL('image/jpeg', 0.86);
      const updated = await updateMyPhoto(compressed); setProfile(updated); setMessage('Profile photo updated.');
    } catch (e: any) { setMessage(e?.message || 'Could not update photo.'); }
    finally { setBusy(false); }
  };
  const initials = (String(profile?.firstName?.[0] ?? '') + String(profile?.lastName?.[0] ?? '')).toUpperCase() || 'A';
  return <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-5">
    <div className="p-5 border-b border-gray-100"><h2 className="font-bold text-gray-900">Admin profile</h2><p className="text-xs text-gray-500 mt-1">Your photo appears in the Admin sidebar.</p></div>
    <div className="p-5 flex items-center gap-4">
      {profile?.photoUrl ? <img src={profile.photoUrl} alt="Admin profile" className="w-20 h-20 rounded-full object-cover border-2 border-gray-100" /> : <div className="w-20 h-20 rounded-full bg-zana-primary/10 text-zana-primary flex items-center justify-center text-xl font-bold">{initials}</div>}
      <div><input ref={input} type="file" accept="image/*" className="hidden" onChange={e => choose(e.target.files?.[0])} />
        <button onClick={() => input.current?.click()} disabled={busy} className="flex items-center gap-2 bg-zana-primary text-white font-semibold px-4 py-2.5 rounded-lg disabled:opacity-50"><Camera size={16} />{busy ? <><Loader2 size={15} className="animate-spin" /> Uploading…</> : 'Change photo'}</button>
        {message && <p className="text-xs text-gray-500 mt-2">{message}</p>}
      </div>
    </div>
  </section>;
}
