'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import Topbar from '../../components/Topbar';
import { pricingConfig, zones as initialZones } from '../../lib/mockData';

export default function PricingPage() {
  const [pricing, setPricing] = useState(pricingConfig);
  const [zones, setZones] = useState(initialZones);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const updatePricing = (index: number, field: string, value: number) => {
    setPricing((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const toggleZoneDelivery = (id: string) => {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, deliveryEnabled: !z.deliveryEnabled } : z)));
  };

  const updateSurge = (id: string, value: number) => {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, surge: value } : z)));
  };

  const handleSave = () => {
    setSavedAt(new Date().toLocaleTimeString());
  };

  return (
    <>
      <Topbar title="Pricing & Zones" subtitle="Fare configuration and zone-based surge" />
      <div className="p-8 space-y-6">
        <div className="bg-zana-surface border border-zana-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Fare configuration</h2>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 bg-zana-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-zana-primary-dark transition-colors"
            >
              <Save size={14} /> Save changes
            </button>
          </div>
          {savedAt && <p className="text-xs text-zana-success mb-3">Saved at {savedAt}</p>}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zana-muted border-b border-zana-border">
                <th className="py-2 font-medium">Service</th>
                <th className="py-2 font-medium">Base fare</th>
                <th className="py-2 font-medium">Min fare</th>
                <th className="py-2 font-medium">Price / km</th>
                <th className="py-2 font-medium">Price / min</th>
                <th className="py-2 font-medium">Booking fee</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((p, i) => (
                <tr key={p.service} className="border-b border-zana-border last:border-0">
                  <td className="py-3 font-medium text-gray-900">{p.service}</td>
                  {(['baseFare', 'minFare', 'perKm', 'perMin', 'bookingFee'] as const).map((field) => (
                    <td key={field} className="py-3 pr-4">
                      <input
                        type="number"
                        value={p[field]}
                        onChange={(e) => updatePricing(i, field, Number(e.target.value))}
                        className="w-24 px-2 py-1.5 border border-zana-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-zana-surface border border-zana-border rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Zone management</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zana-muted border-b border-zana-border">
                <th className="py-2 font-medium">Zone</th>
                <th className="py-2 font-medium">Surge multiplier</th>
                <th className="py-2 font-medium">Delivery available</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-b border-zana-border last:border-0">
                  <td className="py-3 font-medium text-gray-900">{z.name}</td>
                  <td className="py-3">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="2"
                      value={z.surge}
                      onChange={(e) => updateSurge(z.id, Number(e.target.value))}
                      className="w-20 px-2 py-1.5 border border-zana-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
                    />
                    <span className="text-xs text-zana-muted ml-1">×</span>
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => toggleZoneDelivery(z.id)}
                      className={`relative w-10 h-5.5 rounded-full transition-colors ${z.deliveryEnabled ? 'bg-zana-primary' : 'bg-gray-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${
                          z.deliveryEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
