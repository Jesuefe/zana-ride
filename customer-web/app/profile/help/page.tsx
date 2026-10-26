'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, Mail, Send, CheckCircle2, Ticket, X, Headphones } from 'lucide-react';
import { useLang } from '../../../lib/LangContext';
import { api, ApiError } from '../../../lib/api/client';

type LiveSupportMessage = { id: string; sender: 'customer' | 'staff' | 'note'; text: string; createdAt: string };
type LiveSupportChat = { id: string; status: string; messages?: LiveSupportMessage[] };

type SupportTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  resolution?: string | null;
  createdAt: string;
};

const faqs = [
  { q: 'How do I cancel a ride?', a: 'Tap "Cancel Ride" on the tracking screen before your driver arrives.' },
  { q: 'How do I top up my wallet?', a: 'Go to Wallet → Top Up, enter an amount and your MTN/Airtel number.' },
  { q: 'What is a Zana location code?', a: 'A short code (e.g. ZANA-8XK29) that represents your exact GPS location. Share it when you can\'t explain your address.' },
  { q: 'How do I track my delivery?', a: 'Go to Orders → Deliveries to see real-time status of all your packages.' },
  { q: 'How does the fare work?', a: 'Fares are calculated by distance and time. You see the estimate before booking.' },
];

const categories = [
  { value: 'GENERAL', label: 'General question' },
  { value: 'RIDE', label: 'Ride' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'ORDER', label: 'Food or order' },
  { value: 'PAYMENT', label: 'Payment or wallet' },
  { value: 'DRIVER', label: 'Driver' },
  { value: 'MERCHANT', label: 'Merchant' },
  { value: 'SAFETY', label: 'Safety concern' },
  { value: 'ACCOUNT', label: 'My account' },
];

const statusLabels: Record<string, string> = {
  OPEN: 'Open', IN_PROGRESS: 'In progress', WAITING_CUSTOMER: 'Waiting for you',
  ESCALATED: 'Escalated', RESOLVED: 'Resolved', CLOSED: 'Closed',
};

export default function HelpPage() {
  const { t } = useLang();
  const router = useRouter();
  const [category, setCategory] = useState('GENERAL');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [relatedReference, setRelatedReference] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [submitted, setSubmitted] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [liveChat, setLiveChat] = useState<LiveSupportChat | null>(null);
  const [liveMessages, setLiveMessages] = useState<LiveSupportMessage[]>([]);
  const [liveDraft, setLiveDraft] = useState('');
  const [liveChatOpen, setLiveChatOpen] = useState(false);
  const [liveChatLoading, setLiveChatLoading] = useState(false);
  const [liveChatSending, setLiveChatSending] = useState(false);
  const [liveChatError, setLiveChatError] = useState('');

  const loadTickets = async () => {
    try { setTickets(await api.get<SupportTicket[]>('/support/tickets/mine')); } catch { /* User may be signed out; they can still use email support. */ }
  };
  useEffect(() => { void loadTickets(); }, []);

  const refreshLiveMessages = async (chatId: string) => {
    try {
      const rows = await api.get<LiveSupportMessage[]>(`/support/chats/${chatId}/messages`);
      setLiveMessages(rows); setLiveChatError('');
    } catch (e) { setLiveChatError(e instanceof Error ? e.message : t('Could not load your conversation.')); }
  };

  useEffect(() => {
    if (!liveChat?.id || !liveChatOpen) return;
    void refreshLiveMessages(liveChat.id);
    const timer = window.setInterval(() => void refreshLiveMessages(liveChat.id), 3000);
    return () => window.clearInterval(timer);
  }, [liveChat?.id, liveChatOpen]);

  const openLiveChat = async () => {
    setLiveChatOpen(true); setLiveChatLoading(true); setLiveChatError('');
    try {
      const chat = await api.post<LiveSupportChat>('/support/chats');
      setLiveChat(chat); setLiveMessages(chat.messages || []); await refreshLiveMessages(chat.id);
    } catch (e) { setLiveChatError(e instanceof ApiError && e.status === 401 ? t('Please log in to chat with support.') : e instanceof Error ? e.message : t('Could not open live chat. Please try again.')); }
    finally { setLiveChatLoading(false); }
  };

  const sendLiveMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const text = liveDraft.trim();
    if (!text || !liveChat?.id || liveChatSending) return;
    setLiveChatSending(true); setLiveChatError('');
    try { await api.post(`/support/chats/${liveChat.id}/messages`, { text }); setLiveDraft(''); await refreshLiveMessages(liveChat.id); }
    catch (e) { setLiveChatError(e instanceof Error ? e.message : t('Could not send your message.')); }
    finally { setLiveChatSending(false); }
  };

  const submitTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ticket = await api.post<SupportTicket>('/support/tickets', {
        category, subject: subject.trim(), description: description.trim(),
        ...(relatedReference.trim() ? { relatedReference: relatedReference.trim(), relatedType: category === 'RIDE' ? 'RIDE' : category === 'DELIVERY' ? 'DELIVERY' : category === 'ORDER' ? 'ORDER' : category === 'PAYMENT' ? 'PAYMENT' : 'OTHER' } : {}),
      });
      setSubmitted(ticket);
      setSubject(''); setDescription(''); setRelatedReference(''); setCategory('GENERAL');
      await loadTickets();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? t('Please log in to submit a support request.') : e instanceof Error ? e.message : t('Could not submit your request. Please try again.'));
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} aria-label={t('Go back')} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><ArrowLeft size={16} /></button>
        <h1 className="text-lg font-bold text-gray-900">{t('Help & Support')}</h1>
      </div>

      {submitted && <div role="status" className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-900">
        <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={20} /> {t('Support request sent')}</div>
        <p className="mt-2 text-sm">{t('Your reference number is')} <strong>{submitted.ticketNumber}</strong>.</p>
        <p className="mt-1 text-sm">{t('Our team will review your request. You can track its status below.')}</p>
        <button onClick={() => setSubmitted(null)} className="mt-3 text-sm font-semibold underline">{t('Submit another request')}</button>
      </div>}

      <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-gray-900">{t('Report a problem')}</h2>
        <p className="mb-4 text-sm text-gray-500">{t('Tell us what happened and our support team will follow up.')}</p>
        <form onSubmit={submitTicket} className="space-y-3">
          <label className="block text-sm font-medium text-gray-800">{t('What do you need help with?')}
            <select value={category} onChange={e => setCategory(e.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm" required>
              {categories.map(item => <option key={item.value} value={item.value}>{t(item.label)}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-800">{t('Subject')}
            <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={180} required placeholder={t('Briefly describe your issue')} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm" />
          </label>
          <label className="block text-sm font-medium text-gray-800">{t('Details')}
            <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} required rows={4} placeholder={t('Include what happened and how we can help.')} className="mt-1.5 w-full resize-y rounded-xl border border-gray-200 px-3 py-3 text-sm" />
          </label>
          <label className="block text-sm font-medium text-gray-800">{t('Ride, order or payment reference (optional)')}
            <input value={relatedReference} onChange={e => setRelatedReference(e.target.value)} maxLength={160} placeholder={t('Enter a reference number if you have one')} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm" />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-zana-primary px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60">
            <Send size={16} /> {loading ? t('Submitting…') : t('Send to ZANA Support')}
          </button>
          <p className="text-xs text-gray-500">{t('For immediate danger, contact local emergency services. Do not use this form for emergencies.')}</p>
        </form>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900"><Ticket size={18} /> {t('Your support requests')}</h2>
        {tickets.length ? <div className="space-y-2">{tickets.map(ticket => <article key={ticket.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-zana-primary">{ticket.ticketNumber}</p><p className="mt-1 text-sm font-semibold text-gray-900">{ticket.subject}</p></div><span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{t(statusLabels[ticket.status] ?? ticket.status)}</span></div>
          <p className="mt-2 text-xs text-gray-500">{t(ticket.category)} · {new Date(ticket.createdAt).toLocaleDateString()}</p>
          {ticket.resolution && <p className="mt-2 text-sm text-gray-600">{t('Resolution')}: {ticket.resolution}</p>}
        </article>)}</div> : <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">{t('Your submitted requests will appear here.')}</p>}
      </section>

      <section className="mb-5">
        <h2 className="mb-3 text-base font-bold text-gray-900">{t('Frequently asked questions')}</h2>
        <div className="space-y-3">{faqs.map((faq, i) => <div key={i} className="rounded-xl bg-white p-4 shadow-sm"><p className="mb-1 text-sm font-semibold text-gray-900">{t(faq.q)}</p><p className="text-sm text-gray-500">{t(faq.a)}</p></div>)}</div>
      </section>

      <div className="rounded-2xl bg-zana-primary-light p-5">
        <p className="mb-3 font-semibold text-gray-900">{t('Still need help?')}</p>
        <button type="button" onClick={openLiveChat} className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-zana-primary px-4 py-3.5 text-sm font-semibold text-white">
          <MessageCircle size={17} /> {t('Chat with Zana Support')}
        </button>
        <a href="mailto:support@zana.rw" className="mb-2 flex items-center gap-2 text-sm font-semibold text-zana-primary"><Mail size={15} /> support@zana.rw</a>
        <a href="https://wa.me/250700000000" className="flex items-center gap-2 text-sm font-semibold text-zana-primary"><MessageCircle size={15} /> {t('WhatsApp Support')}</a>
      </div>

      {liveChatOpen && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t('Live chat with Zana Support')}>
        <section className="flex h-[82dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-[min(680px,85dvh)] sm:rounded-3xl">
          <header className="flex items-center justify-between bg-zana-primary px-4 py-4 text-white"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"><Headphones size={21}/></div><div><h2 className="font-bold">{t('Zana Support')}</h2><p className="text-xs text-white/80">{t('We are here to help')}</p></div></div><button onClick={()=>setLiveChatOpen(false)} aria-label={t('Close live chat')} className="rounded-full p-2 hover:bg-white/15"><X size={20}/></button></header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4">
            {liveChatLoading && <p className="py-8 text-center text-sm text-gray-500">{t('Connecting you to support…')}</p>}
            {!liveChatLoading && liveMessages.length===0 && <div className="mx-auto mt-10 max-w-xs text-center"><MessageCircle className="mx-auto mb-3 text-zana-primary" size={32}/><p className="font-semibold text-gray-900">{t('How can we help you today?')}</p><p className="mt-1 text-sm text-gray-500">{t('Send a message and our team will reply here.')}</p></div>}
            {liveMessages.filter(m=>m.sender!=='note').map(m=><div key={m.id} className={`flex ${m.sender==='customer'?'justify-end':'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-3 py-2.5 ${m.sender==='customer'?'bg-zana-primary text-white':'border border-gray-200 bg-white text-gray-800'}`}><p className="whitespace-pre-wrap break-words text-sm">{m.text}</p><p className={`mt-1 text-[10px] ${m.sender==='customer'?'text-white/70':'text-gray-400'}`}>{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</p></div></div>)}
            {liveChatError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{liveChatError}</p>}
          </div>
          <form onSubmit={sendLiveMessage} className="flex items-end gap-2 border-t bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]"><textarea value={liveDraft} onChange={e=>setLiveDraft(e.target.value)} rows={2} maxLength={4000} placeholder={t('Type your message…')} className="min-w-0 flex-1 resize-none rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-zana-primary"/><button type="submit" disabled={!liveDraft.trim()||liveChatSending||!liveChat?.id} aria-label={t('Send message')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zana-primary text-white disabled:opacity-40"><Send size={17}/></button></form>
        </section>
      </div>}
    </div>
  );
}
