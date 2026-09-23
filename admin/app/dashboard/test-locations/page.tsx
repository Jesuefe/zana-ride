'use client';
import { useState, useEffect } from 'react';
import AdminShell from '../../../components/AdminShell';
import {
  getDrivers, getDriverTestLocations, setDriverTestLocation,
  scatterAllDriverTestLocations, clearAllDriverTestLocations,
  getUsers, getCustomerTestLocations, setCustomerTestLocation,
  scatterAllCustomerTestLocations, clearAllCustomerTestLocations,
  clearAllTestLocations,
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
  const [mode, setMode] = useState<'driver' | 'customer'>('driver');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [overridden, setOverridden] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const load = () => {
    if (mode === 'driver') {
      getDrivers().then(setAccounts).catch(() => {});
      getDriverTestLocations().then(setOverridden).catch(() => {});
    } else {
      getUsers({ role: 'CUSTOMER' }).then(setAccounts).catch(() => {});
      getCustomerTestLocations().then(setOverridden).catch(() => {});
    }
  };
  useEffect(() => { setSelected(null); setSearch(''); load(); }, [mode]);

  const displayName = (a: any) => mode === 'driver'
    ? `${a.user?.firstName ?? ''} ${a.user?.lastName ?? ''}`.trim()
    : `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();
  const displayPhone = (a: any) => mode === 'driver' ? a.user?.phone : a.phone;
  const displayId = (a: any) => a.id; // Driver.id for drivers, User.id for customers

  const filtered = search.trim()
    ? accounts.filter((a: any) => {
        const q = search.toLowerCase();
        return displayName(a).toLowerCase().includes(q) || displayPhone(a)?.includes(q) || (mode === 'driver' && a.plate?.toLowerCase().includes(q));
      })
    : [];

  const save = async () => {
    if (!selected || !lat || !lng) return;
    setSaving(true);
    try {
      if (mode === 'driver') await setDriverTestLocation(selected.id, parseFloat(lat), parseFloat(lng));
      else await setCustomerTestLocation(selected.id, parseFloat(lat), parseFloat(lng));
      setNotice(`Saved for ${displayName(selected) || 'account'}.`);
      setSelected(null); setLat(''); setLng(''); setSearch('');
      load();
    } catch (e: any) {
      setNotice(e?.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const clearOne = async (id: string) => {
    if (mode === 'driver') await setDriverTestLocation(id, null, null).catch(() => {});
    else await setCustomerTestLocation(id, null, null).catch(() => {});
    load();
  };

  // ---- Dangerous operations ----
  const [dangerCenter, setDangerCenter] = useState(PRESETS[0]);
  const [dangerRadius, setDangerRadius] = useState('500');
  const [confirmText, setConfirmText] = useState('');
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerNotice, setDangerNotice] = useState('');

  const runScatter = async () => {
    if (confirmText !== 'SCATTER') return;
    setDangerBusy(true);
    try {
      const res: any = mode === 'driver'
        ? await scatterAllDriverTestLocations(dangerCenter.lat, dangerCenter.lng, parseFloat(dangerRadius) || 500)
        : await scatterAllCustomerTestLocations(dangerCenter.lat, dangerCenter.lng, parseFloat(dangerRadius) || 500);
      setDangerNotice(`Cleared all existing overrides, then scattered ${res.scattered} ${mode}${res.scattered === 1 ? '' : 's'} within ${res.radiusMeters}m of ${dangerCenter.label}.`);
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
      const res: any = mode === 'driver' ? await clearAllDriverTestLocations() : await clearAllCustomerTestLocations();
      setDangerNotice(`Cleared overrides on ${res.cleared} ${mode}(s).`);
      setConfirmText('');
      load();
    } catch (e: any) {
      setDangerNotice(e?.message ?? 'Failed to clear.');
    } finally {
      setDangerBusy(false);
    }
  };

  // "Destroy the session" — clears both drivers and customers at once,
  // separate from the per-mode confirmation above since this is the
  // "we're done testing, reset everything" action.
  const [destroyConfirm, setDestroyConfirm] = useState('');
  const [destroying, setDestroying] = useState(false);
  const destroySession = async () => {
    if (destroyConfirm !== 'DESTROY') return;
    setDestroying(true);
    try {
      const res: any = await clearAllTestLocations();
      setDangerNotice(`Session destroyed — cleared ${res.driversCleared} driver(s) and ${res.customersCleared} customer(s).`);
      setDestroyConfirm('');
      load();
    } catch (e: any) {
      setDangerNotice(e?.message ?? 'Failed to destroy session.');
    } finally {
      setDestroying(false);
    }
  };

  return (
    <AdminShell>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Test Locations</h1>
        <p className="text-sm text-gray-500 mb-4">
          Overrides an account's reported GPS with fixed test coordinates — the account uses its
          real phone and app normally, ride matching just sees the configured position instead of
          the real one. Off by default for every account.
        </p>

        <div className="flex gap-2 mb-5">
          <button onClick={() => setMode('driver')}
            className={`text-sm font-semibold px-4 py-1.5 rounded-full ${mode === 'driver' ? 'bg-zana-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            Drivers
          </button>
          <button onClick={() => setMode('customer')}
            className={`text-sm font-semibold px-4 py-1.5 rounded-full ${mode === 'customer' ? 'bg-zana-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            Customers
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4 mb-6">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null); }}
              placeholder={mode === 'driver' ? 'Search driver by name, phone, or plate' : 'Search customer by name or phone'}
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zana-primary/30"
            />
          </div>

          {filtered.length > 0 && !selected && (
            <div className="border border-gray-100 rounded-lg divide-y max-h-48 overflow-y-auto">
              {filtered.slice(0, 8).map((a: any) => (
                <button key={displayId(a)} onClick={() => setSelected(a)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                  <span className="font-medium text-gray-900">{displayName(a)}</span>
                  <span className="text-gray-400 ml-2">{displayPhone(a)}{mode === 'driver' ? ` · ${a.plate}` : ''}</span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="border border-zana-primary/30 bg-zana-primary/5 rounded-lg p-3 text-sm">
              <span className="font-semibold text-gray-900">{displayName(selected)}</span>
              <span className="text-gray-500 ml-2">{displayPhone(selected)}</span>

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
            <p className="text-sm text-gray-400 p-4">No {mode}s have a test location set.</p>
          )}
          {overridden.map((a: any) => (
            <div key={displayId(a)} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-zana-primary" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{displayName(a)}</p>
                  <p className="text-xs text-gray-400">{a.testOverrideLat?.toFixed(4)}, {a.testOverrideLng?.toFixed(4)}</p>
                </div>
              </div>
              <button onClick={() => clearOne(displayId(a))} className="text-gray-400 hover:text-red-500">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Dangerous operations — clearly separated, red-flagged, and
            gated behind a typed confirmation, since these affect every
            account of the current type at once rather than one at a
            time like everything above. */}
        <div className="border-2 border-red-200 bg-red-50 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-red-600" />
            <p className="text-sm font-bold text-red-700">Dangerous operation — affects every {mode}</p>
          </div>
          <p className="text-xs text-red-700/80 mb-4">
            Clears every existing test location for {mode}s first, then places all of them within
            the chosen radius of one center point — a fresh, known cluster for a test about to
            start, not an addition to whatever was already set.
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
            Type <span className="font-mono font-bold">SCATTER</span> to scatter all {mode}s, or <span className="font-mono font-bold">CLEAR</span> to clear all, then press the matching button.
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
              {dangerBusy ? 'Working…' : `Clear all ${mode}s`}
            </button>
          </div>

          {dangerNotice && <p className="text-xs text-red-700 mt-3">{dangerNotice}</p>}
        </div>

        {/* Destroy session — separate from the per-mode danger box
            above, since this clears BOTH drivers and customers in one
            action, for wrapping up a live test entirely. */}
        <div className="border-2 border-gray-800 bg-gray-900 rounded-xl p-5">
          <p className="text-sm font-bold text-white mb-1">Destroy test session</p>
          <p className="text-xs text-gray-400 mb-3">
            Clears every driver AND customer test location at once — use this once a live test has
            wrapped up, so nothing lingers into normal operation afterward.
          </p>
          <input value={destroyConfirm} onChange={e => setDestroyConfirm(e.target.value)}
            placeholder="Type DESTROY to confirm"
            className="w-full border border-gray-700 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm mb-3 placeholder:text-gray-500" />
          <button onClick={destroySession} disabled={destroying || destroyConfirm !== 'DESTROY'}
            className="w-full bg-white text-gray-900 font-semibold py-2 rounded-lg text-sm disabled:opacity-40">
            {destroying ? 'Working…' : 'Destroy session — clear everything'}
          </button>
        </div>
      </div>
    </AdminShell>
  );
}
