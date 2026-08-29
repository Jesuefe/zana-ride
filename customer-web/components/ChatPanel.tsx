'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Send, MessageCircle, Loader2 } from 'lucide-react';
import { sendMessage, getMessages, ChatMessage } from '../lib/api/chat';
import { getStoredLang, Lang } from '../lib/lang';
import { getToken } from '../lib/api/client';

// Decode just the sub from the JWT so we know which messages are "mine"
// without an extra API call.
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

export default function ChatPanel({
  context,
  contextId,
  onClose,
}: {
  context: 'trip' | 'delivery';
  contextId: string;
  onClose: () => void;
}) {
  const lang = getStoredLang() as Lang;
  const myId = getUserIdFromToken();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () =>
      getMessages(context, contextId, lang)
        .then(setMessages)
        .catch(() => {});
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [context, contextId, lang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try {
      await sendMessage(context, contextId, text, lang);
      const updated = await getMessages(context, contextId, lang);
      setMessages(updated);
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <div className="w-9 h-9 rounded-full bg-zana-primary-light flex items-center justify-center">
          <MessageCircle size={16} className="text-zana-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            {context === 'trip' ? 'Chat with driver' : 'Chat with courier'}
          </p>
          <p className="text-[10px] text-zana-muted">Messages auto-translate · History clears after ride</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <X size={15} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle size={32} className="text-gray-200 mb-2" />
            <p className="text-sm text-zana-muted">No messages yet. Say hello!</p>
          </div>
        )}
        {messages.map(m => {
          const isMine = m.senderId === myId;
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isMine && (
                  <span className="text-[10px] text-zana-muted px-1">{m.senderName}</span>
                )}
                <div className={`px-3 py-2 rounded-2xl text-sm ${
                  isMine
                    ? 'bg-zana-primary text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
                <span className="text-[9px] text-zana-muted px-1">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={lang === 'rw' ? 'Andika ubutumwa…' : lang === 'fr' ? 'Écrivez un message…' : 'Type a message…'}
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-full bg-zana-primary text-white flex items-center justify-center disabled:opacity-40"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
