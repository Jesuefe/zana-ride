'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, Mail, Send, CheckCircle2, Ticket } from 'lucide-react';
import { useLang } from '../../../lib/LangContext';
import { api, ApiError } from '../../../lib/api/client';

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

  const loadTickets = async () => {
    try { setTickets(await api.get<SupportTicket[]>('/support/tickets/mine')); } catch { /* User may be signed out; they can still use email support. */ }
  };
  useEffect(() => { void loadTickets(); }, []);

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
    <div className="p-4 pb-8">
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
        <a href="mailto:support@zana.rw" className="mb-2 flex items-center gap-2 text-sm font-semibold text-zana-primary"><Mail size={15} /> support@zana.rw</a>
        <a href="https://wa.me/250700000000" className="flex items-center gap-2 text-sm font-semibold text-zana-primary"><MessageCircle size={15} /> {t('WhatsApp Support')}</a>
      </div>
    </div>
  );
}
