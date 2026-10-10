'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Pill, ShieldCheck, FileText, Truck, Search } from 'lucide-react';

const categories = [
  { title: 'Everyday essentials', detail: 'Basic first-aid and personal-care supplies', icon: ShieldCheck },
  { title: 'Medicines', detail: 'Browse products supplied by a licensed pharmacy', icon: Pill },
  { title: 'Prescription orders', detail: 'Prescription verification by the dispensing pharmacist', icon: FileText },
];

export default function PharmacyPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white px-4 pt-12 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} aria-label="Go back" className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
            <ArrowLeft size={19} />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zana-primary">Zana Health</p>
            <h1 className="text-2xl font-black text-gray-900">Pharmacy</h1>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-600 leading-relaxed">
          Find pharmacy essentials and arrange delivery from a participating pharmacy in Kigali.
        </p>
      </header>

      <section className="px-4 pt-5">
        <div className="rounded-3xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #00A082 0%, #007A63 100%)' }}>
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
            <Pill size={25} />
          </div>
          <h2 className="text-xl font-black leading-tight">Your health essentials, delivered</h2>
          <p className="text-sm text-white/80 mt-2 leading-relaxed">
            Pharmacy orders will be fulfilled by verified pharmacy partners, with prescription checks where required.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-bold">
            <Truck size={14} /> Delivery through Zana
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {categories.map(({ title, detail, icon: Icon }) => (
            <div key={title} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4">
              <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center" style={{ background: '#E8F7F2', color: '#00A082' }}>
                <Icon size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{title}</h3>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">Pharmacy partner setup in progress</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            Live medicine listings and checkout will appear once the pharmacy catalogue and licensed partners are connected. Do not use this page to request urgent or emergency care.
          </p>
        </div>

        <button onClick={() => router.push('/shop')} className="mt-5 w-full rounded-2xl bg-white border border-gray-200 px-4 py-3.5 flex items-center justify-center gap-2 text-sm font-bold text-gray-700">
          <Search size={16} /> Browse available shops
        </button>
      </section>
    </main>
  );
}
