'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Clock, Upload, FileText } from 'lucide-react';
import { api } from '../../lib/api/client';

type Doc = {
  label: string;
  fileUrl: string | null;
  verified: boolean;
  status: 'MISSING' | 'PENDING' | 'VERIFIED';
};

const STATUS = {
  VERIFIED: { label: 'Verified', cls: 'bg-green-50 text-green-700', icon: Check },
  PENDING: { label: 'Under review', cls: 'bg-amber-50 text-amber-700', icon: Clock },
  MISSING: { label: 'Not uploaded', cls: 'bg-gray-100 text-gray-500', icon: Upload },
};

export default function Documents() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = useRef<string | null>(null);

  const load = () =>
    api.get<{ documents: Doc[] }>('/driver/documents')
      .then(r => setDocs(r?.documents ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const pick = (label: string) => {
    pending.current = label;
    fileRef.current?.click();
  };

  const onFile = async (file?: File) => {
    const label = pending.current;
    if (!file || !label) return;

    setUploading(label);
    setNote('');
    try {
      // Photographs of documents are large; downscale before sending since
      // riders are often on a weak connection.
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const img = new window.Image();
          img.onload = () => {
            const max = 1400;
            const s = Math.min(1, max / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * s);
            c.height = Math.round(img.height * s);
            c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL('image/jpeg', 0.82));
          };
          img.onerror = reject;
          img.src = r.result as string;
        };
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      await api.post('/driver/documents', { label, imageBase64: base64 });
      setNote(`${label} uploaded. Zana will review it.`);
      load();
    } catch {
      setNote('That upload failed. Try again on a better connection.');
    } finally {
      setUploading(null);
      pending.current = null;
    }
  };

  const outstanding = docs.filter(d => d.status === 'MISSING').length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => onFile(e.target.files?.[0])}
      />

      <div className="bg-white px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center">
          <ArrowLeft size={18} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-xl font-black text-gray-900">Your documents</h1>
          <p className="text-xs text-gray-500">
            {outstanding > 0
              ? `${outstanding} still needed before you can be approved`
              : 'All documents received'}
          </p>
        </div>
      </div>

      {note && (
        <div className="mx-4 mt-4 bg-zana-primary-light rounded-xl px-4 py-3">
          <p className="text-xs text-gray-700">{note}</p>
        </div>
      )}

      <div className="px-4 pt-4 space-y-2">
        {loading && <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>}

        {docs.map(d => {
          const s = STATUS[d.status];
          const Icon = s.icon;
          return (
            <div key={d.label} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <FileText size={16} className="text-gray-300" />
                  <p className="font-bold text-sm text-gray-900">{d.label}</p>
                </div>
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${s.cls}`}>
                  <Icon size={10} /> {s.label}
                </span>
              </div>

              {d.fileUrl && (
                <a href={d.fileUrl} target="_blank" rel="noreferrer">
                  <img
                    src={d.fileUrl}
                    alt={d.label}
                    className="w-full h-32 object-cover rounded-xl border border-gray-100 mb-3"
                  />
                </a>
              )}

              <button
                onClick={() => pick(d.label)}
                disabled={uploading === d.label}
                className={`w-full py-3 rounded-xl text-sm font-bold ${
                  d.status === 'MISSING'
                    ? 'bg-zana-primary text-white'
                    : 'border-2 border-gray-100 text-gray-600'
                } disabled:opacity-50`}
              >
                {uploading === d.label
                  ? 'Uploading…'
                  : d.status === 'MISSING'
                    ? 'Upload'
                    : 'Replace'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="px-4 pt-5">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Documents are used to verify you before approval and are visible only
          to Zana staff. Replacing a document means it must be reviewed again.
        </p>
      </div>
    </div>
  );
}
