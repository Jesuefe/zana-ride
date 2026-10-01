'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Send, MessageCircle, Loader2 } from 'lucide-react';
import { getStoredLang, Lang } from '../lib/lang';
import { getToken } from '../lib/api/client';
import { getDeliveryMessages, sendDeliveryMessage, ChatMessage } from '../lib/api/chat';

function getUserIdFromToken(): string | null {
  try {
    const token = getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export default function DeliveryChatPanel({ deliveryId, onClose, participantLabel = 'Zana courier' }: { deliveryId: string; onClose: () => void; participantLabel?: string }) {
  const lang = getStoredLang() as Lang;
  const myId = getUserIdFromToken();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = () => getDeliveryMessages(deliveryId, lang).then(setMessages).catch(() => {});
  useEffect(() => {
    load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [deliveryId, lang]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try { await sendDeliveryMessage(deliveryId, text, lang); await load(); }
    catch { setInput(text); }
    finally { setSending(false); }
  };

  const copy = {
    en: { title: `Chat with ${participantLabel}`, sub: 'Zana chat · auto-translated', empty: `No messages yet. Send a message to ${participantLabel}.`, placeholder: 'Type a message…' },
    rw: { title: `Ganira na ${participantLabel}`, sub: 'Ubutumwa bwa Zana · buhindurwa mu rurimi', empty: `Nta butumwa burahari. Ohereza ubutumwa kuri ${participantLabel}.`, placeholder: 'Andika ubutumwa…' },
    fr: { title: `Chat avec ${participantLabel}`, sub: 'Chat Zana · traduction automatique', empty: `Aucun message. Envoyez un message à ${participantLabel}.`, placeholder: 'Écrivez un message…' },
  }[lang];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <div className="w-10 h-10 rounded-full bg-zana-primary-light flex items-center justify-center"><MessageCircle size={18} className="text-zana-primary" /></div>
        <div className="flex-1"><p className="font-black text-gray-900">{copy.title}</p><p className="text-[10px] text-gray-400">{copy.sub}</p></div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && <div className="h-full flex items-center justify-center text-center text-sm text-gray-400 px-8">{copy.empty}</div>}
        {messages.map(m => {
          const mine = m.senderId === myId;
          return <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[78%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              {!mine && <span className="text-[10px] text-gray-400 px-1 mb-0.5">{m.senderName}</span>}
              <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${mine ? 'bg-zana-primary text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'}`}>{m.content}</div>
              <span className="text-[9px] text-gray-400 px-1 mt-0.5">{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            </div>
          </div>;
        })}
        <div ref={bottomRef} />
      </div>
      <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()} placeholder={copy.placeholder} className="flex-1 bg-gray-100 rounded-full px-4 py-3 text-sm outline-none" />
        <button onClick={send} disabled={!input.trim()||sending} className="w-11 h-11 rounded-full bg-zana-primary text-white flex items-center justify-center disabled:opacity-40">{sending?<Loader2 size={17} className="animate-spin"/>:<Send size={17}/>}</button>
      </div>
    </div>
  );
}
