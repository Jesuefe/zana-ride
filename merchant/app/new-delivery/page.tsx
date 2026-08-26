'use client';

import { useState } from 'react';
import { FileText, Box, Package, PackageOpen, TriangleAlert, Send } from 'lucide-react';
import Topbar from '../../components/Topbar';
import WhatsAppPreview from '../../components/WhatsAppPreview';
import { merchant } from '../../lib/mockData';

const packageTypes = [
  { id: 'DOCUMENT', label: 'Document', icon: FileText },
  { id: 'SMALL', label: 'Small', icon: Box },
  { id: 'MEDIUM', label: 'Medium', icon: Package },
  { id: 'LARGE', label: 'Large', icon: PackageOpen },
  { id: 'FRAGILE', label: 'Fragile', icon: TriangleAlert },
] as const;

export default function NewDeliveryPage() {
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [packageType, setPackageType] = useState<(typeof packageTypes)[number]['id']>('SMALL');
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = receiverName.trim() && receiverPhone.trim() && dropoff.trim();

  if (submitted) {
    return (
      <>
        <Topbar title="New Delivery" subtitle={merchant.branch} />
        <div className="p-8 max-w-md">
          <div className="bg-zana-surface border border-zana-border rounded-xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-zana-primary-light flex items-center justify-center mx-auto mb-4">
              <Send size={22} className="text-zana-primary-dark" />
            </div>
            <h2 className="font-semibold text-gray-900 mb-1">Delivery requested</h2>
            <p className="text-sm text-zana-muted mb-5">
              We're finding a nearby courier for {receiverName}. You'll get a WhatsApp update the moment one is assigned.
            </p>
            <WhatsAppPreview
              lines={[
                'Delivery confirmed — Zana Business',
                `Courier assigned for ${receiverName}`,
                `${dropoff}`,
                'Track live status in your dashboard.',
              ]}
            />
            <button
              onClick={() => {
                setSubmitted(false);
                setReceiverName('');
                setReceiverPhone('');
                setDropoff('');
              }}
              className="mt-5 text-sm font-medium text-zana-primary-dark hover:underline"
            >
              Request another delivery
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="New Delivery" subtitle={merchant.branch} />
      <div className="p-8 max-w-md">
        <div className="bg-zana-surface border border-zana-border rounded-xl p-6 space-y-5">
          <div>
            <label className="text-xs font-medium text-zana-muted block mb-1.5">Receiver name</label>
            <input
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Aline Keza"
              className="w-full px-3 py-2 text-sm border border-zana-border rounded-lg focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zana-muted block mb-1.5">Receiver phone</label>
            <input
              value={receiverPhone}
              onChange={(e) => setReceiverPhone(e.target.value)}
              placeholder="+250 788 000 000"
              className="w-full px-3 py-2 text-sm border border-zana-border rounded-lg focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zana-muted block mb-1.5">Drop-off address</label>
            <input
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              placeholder="KG 11 Ave, Kacyiru"
              className="w-full px-3 py-2 text-sm border border-zana-border rounded-lg focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zana-muted block mb-2">Package type</label>
            <div className="grid grid-cols-3 gap-2">
              {packageTypes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPackageType(p.id)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border text-xs font-medium transition-colors ${
                    packageType === p.id
                      ? 'border-zana-primary bg-zana-primary-light text-zana-primary-dark'
                      : 'border-zana-border text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <p.icon size={16} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={!canSubmit}
            onClick={() => setSubmitted(true)}
            className="w-full flex items-center justify-center gap-1.5 bg-zana-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-zana-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={15} /> Request delivery
          </button>
        </div>
      </div>
    </>
  );
}
