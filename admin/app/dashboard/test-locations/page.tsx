'use client';
import { useState, useEffect } from 'react';
import AdminShell from '../../../components/AdminShell';
import {
  getDrivers, getDriverTestLocations, setDriverTestLocation,
  scatterAllDriverTestLocations, clearAllDriverTestLocations,
} from '../../../lib/api/admin';
import { MapPin, X, Search, AlertTriangle } from 'lucide-react';

// A handful of real, spread-out Kigali points for quick-select during
// live testing — approximate centers of well-known areas, not exact
// addresses.
const PRESETS = [
  { label: 'Kimironko', lat: -1.9346, lng: 30.1073 },
  { label: 'Kacyiru', lat: -1.9438, lng: 30.0912 },
  { label: 'Nyamirambo', lat: -1.9767, lng: 30.0444 },
  { label: 'Remera', lat: -1.9578, lng: 30.1127 },
  { label: 'Kicukiro', lat: -1.9878, lng: 30.1044 },
  { label: 'City Centre (CBD)', lat: -1.9500, lng: 30.0588 },
];

export default function TestLocationsPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [overridden, setOverridden] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const load = () => {
    getDrivers().then(setDrivers).catch(() => {});
    getDriverTestLocations().then(setOverridden).catch(() => {});
  };
  useEffect(load, []);

  const filtered = search.trim()
    ? drivers.filter((d: any) => {
        const q = search.toLowerCase();
        const name = `${d.user?.firstName ?? ''} ${d.user?.lastName ?? ''}`.toLowerCase();
        return name.includes(q) || d.user?.phone?.includes(q) || d.plate?.toLowerCase().includes(q);
      })
    : [];

  const save = async () => {
    if (!selected || !lat || !lng) return;
    setSaving(true);
    try {
      await setDriverTestLocation(selected.id, parseFloat(lat), parseFloat(lng));
      setNotice(`Saved for ${selected.user?.firstName ?? 'driver'}.`);
      setSelected(null); setLat(''); setLng(''); setSearch('');
      load();
    } catch (e: any) {
      setNotice(e?.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const clear = async (driverId: string) => {
    await setDriverTestLocation(driverId, null, null).catch(() => {});
    load();
  };

  // ---- Dangerous operations — affects every driver account at once ----
  const [dangerCenter, setDangerCenter] = useState(PRESETS[0]);
  const [dangerRadius, setDangerRadius] = useState('500');
  const [confirmText, setConfirmText] = useState('');
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerNotice, setDangerNotice] = useState('');

  const runScatter = async () => {
    if (confirmText !== 'SCATTER') return;
    setDangerBusy(true);
    try {
      const res: any = await scatterAllDriverTestLocations(dangerCenter.lat, dangerCenter.lng, parseFloat(dangerRadius) || 500);
      setDangerNotice(`Cleared all existing overrides, then scattered ${res.scattered} drivers within ${res.radiusMeters}m of ${dangerCenter.label}.`);
      setConfirmText('');
      load();
    } catch (e: any) {
      setDangerNotice(e?.message ?? 'Failed to scatter.');
    } finally {
      setDangerBusy(false);
    }
  };

  const runClearAll = async () => {
    if (confirmText !== 'CLEAR') return;
    setDangerBusy(true);
    try {
      const res: any = await clearAllDriverTestLocations();
      setDangerNotice(`Cleared overrides on ${res.cleared} driver(s).`);
      setConfirmText('');
      load();
    } catch (e: any) {
      setDangerNotice(e?.message ?? 'Failed to clear.');
    } finally {
      setDangerBusy(false);
    }
  };

  return (
    <AdminShell>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Test Locations</h1>
        <p className="text-sm text-gray-500 mb-5">
          Overrides a driver's reported GPS with fixed test coordinates — the driver uses their
          real phone and app normally, ride matching just sees the configured position instead of
          their actual one. Off by default for every driver.
        </p>

        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4 mb-6">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null); }}
              placeholder="Search driver by name, phone, or plate"
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
          </div>

          {filtered.length > 0 && !selected && (
            <div className="border border-gray-100 rounded-lg divide-y max-h-48 overflow-y-auto">
              {filtered.slice(0, 8).map((d: any) => (
                <button key={d.id} onClick={() => setSelected(d)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                  <span className="font-medium text-gray-900">{d.user?.firstName} {d.user?.lastName}</span>
                  <span className="text-gray-400 ml-2">{d.user?.phone} · {d.plate}</span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="border border-zana-primary/30 bg-zana-primary/5 rounded-lg p-3 text-sm">
              <span className="font-semibold text-gray-900">{selected.user?.firstName} {selected.user?.lastName}</span>
              <span className="text-gray-500 ml-2">{selected.plate}</span>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {PRESETS.map(p => (
                  <button key={p.label} onClick={() => { setLat(String(p.lat)); setLng(String(p.lng)); }}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-zana-primary">
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mt-3">
                <input value={lat} onChange={e => setLat(e.target.value)} placeholder="Latitude"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input value={lng} onChange={e => setLng(e.target.value)} placeholder="Longitude"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>

              <button onClick={save} disabled={saving || !lat || !lng}
                className="w-full mt-3 bg-zana-primary text-white font-semibold py-2 rounded-lg text-sm disabled:opacity-40">
                {saving ? 'Saving…' : 'Set test location'}
              </button>
            </div>
          )}

          {notice && <p className="text-xs text-gray-500">{notice}</p>}
        </div>

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Currently overridden</p>
        <div className="bg-white rounded-xl shadow-sm divide-y mb-8">
          {overridden.length === 0 && (
            <p className="text-sm text-gray-400 p-4">No drivers have a test location set.</p>
          )}
          {overridden.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-zana-primary" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{d.user?.firstName} {d.user?.lastName}</p>
                  <p className="text-xs text-gray-400">{d.testOverrideLat?.toFixed(4)}, {d.testOverrideLng?.toFixed(4)}</p>
                </div>
              </div>
              <button onClick={() => clear(d.id)} className="text-gray-400 hover:text-red-500">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Dangerous operations — clearly separated, red-flagged, and
            gated behind a typed confirmation, since both actions below
            affect every driver account at once rather than one at a
            time like everything above. */}
        <div className="border-2 border-red-200 bg-red-50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-red-600" />
            <p className="text-sm font-bold text-red-700">Dangerous operation — affects every driver</p>
          </div>
          <p className="text-xs text-red-700/80 mb-4">
            Clears every existing test location first, then places all drivers within the chosen
            radius of one center point — a fresh, known cluster for a test about to start, not an
            addition to whatever was already set.
          </p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => setDangerCenter(p)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${dangerCenter.label === p.label ? 'bg-red-600 text-white border-red-600' : 'border-red-300 text-red-700'}`}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mb-3">
            <input value={dangerRadius} onChange={e => setDangerRadius(e.target.value)}
              placeholder="Radius (meters)"
              className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white" />
          </div>

          <p className="text-xs text-red-700 mb-1.5">
            Type <span className="font-mono font-bold">SCATTER</span> to scatter all, or <span className="font-mono font-bold">CLEAR</span> to clear all, then press the matching button.
          </p>
          <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
            placeholder="Type SCATTER or CLEAR"
            className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm bg-white mb-3" />

          <div className="flex gap-2">
            <button onClick={runScatter} disabled={dangerBusy || confirmText !== 'SCATTER'}
              className="flex-1 bg-red-600 text-white font-semibold py-2 rounded-lg text-sm disabled:opacity-40">
              {dangerBusy ? 'Working…' : `Scatter all within ${dangerRadius || 500}m`}
            </button>
            <button onClick={runClearAll} disabled={dangerBusy || confirmText !== 'CLEAR'}
              className="flex-1 bg-white border border-red-300 text-red-700 font-semibold py-2 rounded-lg text-sm disabled:opacity-40">
              {dangerBusy ? 'Working…' : 'Clear all overrides'}
            </button>
          </div>

          {dangerNotice && <p className="text-xs text-red-700 mt-3">{dangerNotice}</p>}
        </div>
      </div>
    </AdminShell>
  );
}
