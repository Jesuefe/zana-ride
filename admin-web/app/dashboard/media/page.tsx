'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Image as ImageIcon, Link2, Search } from 'lucide-react';
import AdminShell from '../../../components/AdminShell';
import { getMediaLibrary } from '../../../lib/api/admin';

type Media = { id:string; url:string; type:string; title:string; owner:string; createdAt:string };

export default function MediaPage() {
  const [items, setItems] = useState<Media[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { getMediaLibrary().then(setItems).catch(() => {}).finally(() => setLoading(false)); }, []);

  const types = useMemo(() => ['all', ...Array.from(new Set(items.map(i => i.type)))], [items]);
  const visible = items.filter(i => (filter === 'all' || i.type === filter) && (!query || [i.title, i.owner, i.type].join(' ').toLowerCase().includes(query.toLowerCase())));

  const copyUrl = async (item: Media) => {
    await navigator.clipboard.writeText(item.url);
    setCopied(item.id);
    setTimeout(() => setCopied(''), 1600);
  };

  const copyImage = async (item: Media) => {
    try {
      const res = await fetch(item.url);
      const blob = await res.blob();
      if ('ClipboardItem' in window && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
      } else {
        await navigator.clipboard.writeText(item.url);
      }
    } catch {
      await navigator.clipboard.writeText(item.url);
    }
    setCopied(item.id);
    setTimeout(() => setCopied(''), 1600);
  };

  return (
    <AdminShell>
      <div>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
            <p className="text-sm text-gray-500 mt-1">Find uploaded Zana images, copy the image or URL, and reuse them in products.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <ImageIcon size={14} /> {items.length} images
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 mb-4 shadow-sm flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-3 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search image name or owner…" className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none" />
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white">
            {types.map(t => <option key={t} value={t}>{t === 'all' ? 'All images' : t.replaceAll('-', ' ')}</option>)}
          </select>
        </div>

        {loading ? <div className="bg-white rounded-xl p-10 text-center text-sm text-gray-500">Loading media…</div> :
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {visible.map(item => (
            <div key={item.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
              <div className="aspect-square bg-gray-100"><img src={item.url} alt={item.title} className="w-full h-full object-cover" /></div>
              <div className="p-3">
                <p className="font-semibold text-xs text-gray-900 truncate">{item.title}</p>
                <p className="text-[10px] text-gray-500 truncate mt-0.5">{item.owner}</p>
                <p className="text-[9px] text-gray-400 uppercase mt-1">{item.type}</p>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <button onClick={() => copyImage(item)} className="flex items-center justify-center gap-1 border border-gray-200 rounded-lg py-2 text-[10px] font-semibold">{copied === item.id ? <Check size={12} /> : <Copy size={12} />} {copied === item.id ? 'Copied' : 'Copy image'}</button>
                  <button onClick={() => copyUrl(item)} className="flex items-center justify-center gap-1 bg-zana-primary text-white rounded-lg py-2 text-[10px] font-semibold"><Link2 size={12} /> URL</button>
                </div>
              </div>
            </div>
          ))}
        </div>}
        {!loading && visible.length === 0 && <div className="bg-white rounded-xl p-10 text-center text-sm text-gray-500">No images found.</div>}
      </div>
    </AdminShell>
  );
}
