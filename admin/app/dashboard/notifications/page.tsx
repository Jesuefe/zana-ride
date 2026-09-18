'use client';
import { useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import { api } from '../../../lib/api/client';
import { Bell, Send, Mail } from 'lucide-react';

const AUDIENCES = ['All customers', 'All drivers', 'All merchants', 'Specific user'] as const;
const CHANNELS = ['Push', 'SMS', 'Email'] as const;

export default function NotificationsPage() {
  const [tab, setTab] = useState<'audience' | 'email'>('audience');

  // Audience-based (existing) — sends to registered Zana users.
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
      const res: any = await api.post('/admin/notifications', { audience, channel, targetId, title, message });
      setResult({ ok: res.failed === 0, text: `Sent to ${res.sent} of ${res.recipientCount}${res.failed ? ` (${res.failed} failed — Push isn't wired up yet)` : ''}.` });
      setTitle(''); setMessage('');
    } catch (e: any) {
      setResult({ ok: false, text: e?.message ?? 'Failed to send.' });
    } finally {
      setSending(false);
    }
  };

  // Previously the only way to email anyone was through the audience
  // system above, which requires a registered Zana user — no way to
  // just type an arbitrary address (a partner, a press contact, a
  // foreign applicant before they're in the system at all).
  const [toEmail, setToEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{ ok: boolean; text: string } | null>(null);

  const sendEmail = async () => {
    setSendingEmail(true);
    setEmailResult(null);
    try {
      const res: any = await api.post('/admin/email/send', { to: toEmail, subject: emailSubject, message: emailMessage });
      setEmailResult({ ok: res.sent, text: res.sent ? `Sent to ${toEmail}.` : 'Failed to send — check the address and try again.' });
      if (res.sent) { setToEmail(''); setEmailSubject(''); setEmailMessage(''); }
    } catch (e: any) {
      setEmailResult({ ok: false, text: e?.message ?? 'Failed to send.' });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <AdminShell>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Notifications</h1>
        <p className="text-sm text-gray-500 mb-5">Send a push, SMS, or email to Zana users — or an email to anyone.</p>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('audience')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${tab === 'audience' ? 'bg-zana-primary text-white border-zana-primary' : 'border-gray-200 text-gray-600'}`}>
            <Bell size={13} /> To Zana Users
          </button>
          <button onClick={() => setTab('email')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${tab === 'email' ? 'bg-zana-primary text-white border-zana-primary' : 'border-gray-200 text-gray-600'}`}>
            <Mail size={13} /> To Any Email
          </button>
        </div>

        {tab === 'audience' && (
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
              {channel === 'Push' && <p className="text-[11px] text-amber-600 mt-1">Push isn't wired up yet — Firebase setup is still pending.</p>}
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
        )}

        {tab === 'email' && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <input value={toEmail} onChange={e => setToEmail(e.target.value)}
              placeholder="Recipient email address" type="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" />
            <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
              placeholder="Subject"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" />
            <textarea value={emailMessage} onChange={e => setEmailMessage(e.target.value)}
              placeholder="Message"
              rows={6}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30" />
            <p className="text-[11px] text-gray-400">Sent as a branded Zana Ride letterhead email — no need to add your own formatting or sign-off.</p>

            {emailResult && (
              <p className={`text-xs ${emailResult.ok ? 'text-green-600' : 'text-amber-700'}`}>{emailResult.text}</p>
            )}

            <button onClick={sendEmail} disabled={sendingEmail || !toEmail.trim() || !emailSubject.trim() || !emailMessage.trim()}
              className="w-full bg-zana-primary text-white font-semibold py-2.5 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2">
              <Mail size={15} /> {sendingEmail ? 'Sending…' : 'Send Email'}
            </button>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
