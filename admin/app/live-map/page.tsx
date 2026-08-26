'use client';

import { useState } from 'react';
import { Bike, Car, AlertTriangle } from 'lucide-react';
import Topbar from '../../components/Topbar';
import { drivers } from '../../lib/mockData';

// Illustrative marker positions across a stylized Kigali layout.
// Swap this view for a real Google Maps JS / Mapbox embed once the
// Maps JavaScript API key is wired up on the backend.
const markerPositions: Record<string, { x: number; y: number }> = {
  'drv-001': { x: 30, y: 40 },
  'drv-002': { x: 55, y: 25 },
  'drv-003': { x: 70, y: 60 },
  'drv-004': { x: 42, y: 65 },
  'drv-005': { x: 20, y: 70 },
  'drv-006': { x: 62, y: 45 },
};

const zoneFilters = ['All', 'Bike', 'Car', 'Comfort'];

export default function LiveMapPage() {
  const [filter, setFilter] = useState('All');

  const visibleDrivers = drivers.filter((d) => {
    if (filter === 'All') return true;
    if (filter === 'Bike') return d.serviceType === 'BIKE';
    if (filter === 'Car') return d.serviceType === 'ECONOMY';
    return d.serviceType === 'COMFORT';
  });

  return (
    <>
      <Topbar title="Live Operations Map" subtitle="Real-time driver and trip visibility" />
      <div className="p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1.5">
            {zoneFilters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  filter === f
                    ? 'bg-zana-primary-dark text-white border-zana-primary-dark'
                    : 'bg-white text-gray-700 border-zana-border hover:bg-gray-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 text-xs text-zana-muted">
            <Legend color="bg-zana-success" label="Online" />
            <Legend color="bg-zana-secondary" label="Busy" />
            <Legend color="bg-gray-300" label="Offline" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-[#E1F5EE] border border-zana-border rounded-xl relative h-[520px] overflow-hidden">
            <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0 30 L100 45" stroke="#0F6E56" strokeWidth="0.4" />
              <path d="M0 60 L100 55" stroke="#0F6E56" strokeWidth="0.4" />
              <path d="M25 0 L35 100" stroke="#0F6E56" strokeWidth="0.4" />
              <path d="M65 0 L60 100" stroke="#0F6E56" strokeWidth="0.4" />
            </svg>
            {visibleDrivers.map((d) => {
              const pos = markerPositions[d.id];
              if (!pos) return null;
              const color =
                d.onlineStatus === 'ONLINE' ? 'bg-zana-success' : d.onlineStatus === 'BUSY' ? 'bg-zana-secondary' : 'bg-gray-300';
              const Icon = d.serviceType === 'BIKE' ? Bike : Car;
              return (
                <div
                  key={d.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white shadow-md cursor-pointer`}>
                    <Icon size={14} />
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-9 left-1/2 -translate-x-1/2 bg-white text-xs rounded-lg shadow-lg px-2.5 py-1.5 whitespace-nowrap border border-zana-border z-10">
                    <div className="font-medium text-gray-900">{d.name}</div>
                    <div className="text-zana-muted">{d.vehicle}</div>
                  </div>
                </div>
              );
            })}
            <div className="absolute bottom-3 right-3 bg-white/90 text-[11px] text-zana-muted px-2.5 py-1 rounded-md">
              Illustrative layout — connect Maps JS API for live tiles
            </div>
          </div>

          <div className="bg-zana-surface border border-zana-border rounded-xl p-5">
            <h2 className="font-semibold text-gray-900 mb-3">On the map</h2>
            <div className="space-y-3">
              {visibleDrivers.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="text-gray-900">{d.name}</div>
                    <div className="text-xs text-zana-muted">{d.serviceType === 'BIKE' ? 'Zana Moto' : d.serviceType === 'ECONOMY' ? 'Zana Car' : 'Zana Comfort'}</div>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${d.onlineStatus === 'ONLINE' ? 'bg-zana-success' : d.onlineStatus === 'BUSY' ? 'bg-zana-secondary' : 'bg-gray-300'}`} />
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-zana-border flex items-start gap-2 text-xs text-zana-muted">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Positions are simulated for this demo. Live tracking connects once the backend's driver-location websocket channel is wired in.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </div>
  );
}
