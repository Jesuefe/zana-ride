'use client';
import { useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import { api } from '../../../lib/api/client';
import { Bell, Send } from 'lucide-react';

const AUDIENCES = ['All customers', 'All drivers', 'All merchants', 'Specific user'] as const;
const CHANNELS = ['Push', 'SMS', 'Email'] as const;

export default function NotificationsPage() {
  const [audience, setAudience] = useState<typeof AUDIENCES[number]>('All customers');
  const [channel, setChannel] = useState<typeof CHANNELS[number]>('Push');
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    setSending(true);
    setResult(null);
    try {
      // This endpoint doesn't exist on the backend yet — sending a
      // real push/SMS/email needs actual provider integration first
      // (Firebase for push, the existing SMS provider, and whichever
      // email service gets picked). The compose UI is ready now so
      // wiring it up later is purely a backend addition.
      await api.post('/admin/notifications', { audience, channel, targetId, title, message });
      setResult({ ok: true, text: 'Sent.' });
      setTitle(''); setMessage('');
    } catch {
      setResult({ ok: false, text: 'Not connected yet — the backend doesn\'t send notifications yet. This form is ready for when it does.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminShell>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Notifications</h1>
        <p className="text-sm text-gray-500 mb-5">Send a push, SMS, or email to Zana users.</p>

        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1.5">Audience</label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map(a => (
                <button key={a} onClick={() => setAudience(a)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${audience === a ? 'bg-zana-primary text-white border-zana-primary' : 'border-gray-200 text-gray-600'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {audience === 'Specific user' && (
            <input value={targetId} onChange={e => setTargetId(e.target.value)}
              placeholder="User ID or phone number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" />
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1.5">Channel</label>
            <div className="flex gap-2">
              {CHANNELS.map(c => (
                <button key={c} onClick={() => setChannel(c)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${channel === c ? 'bg-zana-primary text-white border-zana-primary' : 'border-gray-200 text-gray-600'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {channel !== 'SMS' && (
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" />
          )}

          <textarea value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Message"
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" />

          {result && (
            <p className={`text-xs ${result.ok ? 'text-green-600' : 'text-amber-700'}`}>{result.text}</p>
          )}

          <button onClick={send} disabled={sending || !message.trim()}
            className="w-full bg-zana-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2">
            <Send size={15} /> {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </AdminShell>
  );
}
