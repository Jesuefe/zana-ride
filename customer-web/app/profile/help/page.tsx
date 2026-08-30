'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, Mail, Phone } from 'lucide-react';

const faqs = [
  { q: 'How do I cancel a ride?', a: 'Tap "Cancel Ride" on the tracking screen before your driver arrives.' },
  { q: 'How do I top up my wallet?', a: 'Go to Wallet → Top Up, enter an amount and your MTN/Airtel number.' },
  { q: 'What is a Zana location code?', a: 'A short code (e.g. ZANA-8XK29) that represents your exact GPS location. Share it when you can\'t explain your address.' },
  { q: 'How do I track my delivery?', a: 'Go to Orders → Deliveries to see real-time status of all your packages.' },
  { q: 'How does the fare work?', a: 'Fares are calculated by distance and time. You see the estimate before booking.' },
];

export default function HelpPage() {
  const router = useRouter();
  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><ArrowLeft size={16} /></button>
        <h1 className="text-lg font-bold text-gray-900">Help & Support</h1>
      </div>
      <div className="space-y-3 mb-5">
        {faqs.map((faq, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
            <p className="font-semibold text-sm text-gray-900 mb-1">{faq.q}</p>
            <p className="text-sm text-gray-500">{faq.a}</p>
          </div>
        ))}
      </div>
      <div className="bg-zana-primary-light rounded-2xl p-5">
        <p className="font-semibold text-gray-900 mb-3">Still need help?</p>
        <a href="mailto:support@zana.rw" className="flex items-center gap-2 text-sm text-zana-primary font-semibold mb-2"><Mail size={15} /> support@zana.rw</a>
        <a href="https://wa.me/250700000000" className="flex items-center gap-2 text-sm text-zana-primary font-semibold"><MessageCircle size={15} /> WhatsApp Support</a>
      </div>
    </div>
  );
}
