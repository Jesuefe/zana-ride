'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Phone, AlertTriangle } from 'lucide-react';

export default function SafetyPage() {
  const router = useRouter();
  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><ArrowLeft size={16} /></button>
        <h1 className="text-lg font-bold text-gray-900">Safety</h1>
      </div>
      <div className="space-y-3">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3"><Shield size={20} className="text-zana-primary" /><h2 className="font-semibold text-gray-900">Emergency Contact</h2></div>
          <p className="text-sm text-gray-500 mb-4">Share your trip details with trusted contacts for added safety.</p>
          <a href="tel:112" className="flex items-center gap-2 bg-red-50 text-red-600 font-semibold px-4 py-3 rounded-xl text-sm">
            <Phone size={16} /> Call Emergency (112)
          </a>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3"><AlertTriangle size={20} className="text-amber-500" /><h2 className="font-semibold text-gray-900">SOS Feature</h2></div>
          <p className="text-sm text-gray-500">During any active ride, shake your phone or tap the SOS button to report a safety concern. Our team will be alerted immediately.</p>
        </div>
      </div>
    </div>
  );
}
