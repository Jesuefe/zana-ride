'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../../../../components/AdminShell';
import AdminProfilePhoto from '../../../../components/AdminProfilePhoto';
import { getAiSettings, saveAiSettings, testAiConnection } from '../../../../lib/api/admin';
import { CheckCircle2, Eye, EyeOff, RefreshCw, Save, ShieldCheck, Sparkles, Trash2, Wifi } from 'lucide-react';

type Settings = {
  enabled: boolean;
  provider: string;
  model: string;
  configured: boolean;
  apiKeyHint?: string | null;
  features: Record<string, boolean>;
  updatedAt?: string | null;
};

const FEATURES = [
  ['customerChat', 'Customer Chat', 'Zana AI conversations in the customer app.'],
  ['rideBooking', 'Ride Booking', 'Allow AI to prepare ride requests.'],
  ['foodOrdering', 'Food Ordering', 'Allow AI to understand and prepare food orders.'],
  ['marketShopping', 'Market Shopping', 'Allow AI to build market baskets from recipes or shopping lists.'],
  ['deliveryBooking', 'Delivery Booking', 'Allow AI to prepare delivery requests.'],
  ['placeDiscovery', 'Place Discovery', 'Allow AI to find suitable places and experiences.'],
] as const;

export default function AiSettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    enabled: false, provider: 'gemini', model: 'gemini-3.8-flash', configured: false,
    features: Object.fromEntries(FEATURES.map(([key]) => [key, true])),
  });
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAiSettings()
      .then((data) => setSettings(s => ({ ...s, ...data, features: { ...s.features, ...(data.features || {}) } })))
      .catch((e: any) => setError(e?.message ?? 'Could not load AI settings.'));
  }, []);

  const toggle = (key: string) => setSettings(s => ({ ...s, features: { ...s.features, [key]: !s.features[key] } }));

  const save = async () => {
    setSaving(true); setMessage(null); setError(null);
    try {
      const next = await saveAiSettings({
        enabled: settings.enabled,
        model: settings.model,
        apiKey: apiKey.trim() || undefined,
        features: settings.features,
      });
      setSettings(s => ({ ...s, ...next }));
      setApiKey('');
      setMessage('Zana AI settings saved securely.');
    } catch (e: any) {
      setError(e?.message ?? 'Could not save AI settings.');
    } finally { setSaving(false); }
  };

  const clearKey = async () => {
    if (!settings.configured) return;
    setSaving(true); setMessage(null); setError(null);
    try {
      const next = await saveAiSettings({ enabled: false, model: settings.model, clearApiKey: true, features: settings.features });
      setSettings(s => ({ ...s, ...next }));
      setMessage('Gemini API key removed. Zana AI is disabled.');
    } catch (e: any) {
      setError(e?.message ?? 'Could not remove the API key.');
    } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true); setMessage(null); setError(null);
    try {
      const result = await testAiConnection();
      setMessage(`Connection successful — ${result.model} responded: ${result.response}`);
    } catch (e: any) {
      setError(e?.message ?? 'Gemini connection test failed.');
    } finally { setTesting(false); }
  };

  return (
    <AdminShell>
      <div className="max-w-4xl">
        <AdminProfilePhoto />
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-zana-primary/10 flex items-center justify-center text-zana-primary"><Sparkles size={22} /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Zana AI Settings</h1>
              <p className="text-sm text-gray-500 mt-1">Connect Gemini once here. Customers never receive the provider key.</p>
            </div>
          </div>
        </div>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900">Gemini provider</h2>
              <p className="text-xs text-gray-500 mt-1">The backend keeps the secret encrypted and only uses it server-side.</p>
            </div>
            <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${settings.configured && settings.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {settings.configured && settings.enabled ? 'Active' : settings.configured ? 'Configured' : 'Not configured'}
            </div>
          </div>

          <div className="p-5 space-y-5">
            <label className="flex items-center justify-between gap-4 p-3 rounded-xl bg-gray-50">
              <div>
                <div className="text-sm font-semibold text-gray-900">Enable Zana AI</div>
                <div className="text-xs text-gray-500">Turn the customer AI assistant on or off globally.</div>
              </div>
              <button onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
                className={`relative w-11 h-6 rounded-full transition ${settings.enabled ? 'bg-zana-primary' : 'bg-gray-300'}`} aria-label="Enable Zana AI">
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${settings.enabled ? 'left-6' : 'left-1'}`} />
              </button>
            </label>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Gemini model</label>
              <select value={settings.model} onChange={e => setSettings(s => ({ ...s, model: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white">
                <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
                <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
                <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite</option>
              </select>
              <p className="text-[11px] text-gray-400 mt-1.5">The backend accepts a Gemini model ID so you can change models without a deployment.</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Gemini API key</label>
              <div className="relative">
                <input value={apiKey} onChange={e => setApiKey(e.target.value)} type={showKey ? 'text' : 'password'}
                  placeholder={settings.apiKeyHint ? `Saved: ${settings.apiKeyHint} — leave blank to keep it` : 'Paste your Gemini API key'}
                  autoComplete="new-password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm font-mono" />
                <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-2.5 text-gray-400">
                  {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-600 mb-2">Zana AI capabilities</div>
              <div className="grid md:grid-cols-2 gap-3">
                {FEATURES.map(([key, label, description]) => (
                  <label key={key} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl p-3">
                    <div><div className="text-sm font-semibold text-gray-800">{label}</div><div className="text-[11px] text-gray-500">{description}</div></div>
                    <button type="button" onClick={() => toggle(key)}
                      className={`relative w-10 h-5 rounded-full shrink-0 ${settings.features[key] ? 'bg-zana-primary' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition ${settings.features[key] ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </label>
                ))}
              </div>
            </div>

            {(message || error) && (
              <div className={`rounded-lg p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {error || message}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 bg-zana-primary text-white font-semibold px-4 py-2.5 rounded-lg disabled:opacity-50">
                <Save size={16} /> {saving ? 'Saving…' : 'Save settings'}
              </button>
              <button onClick={test} disabled={testing || !settings.configured}
                className="flex items-center gap-2 border border-gray-200 text-gray-700 font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40">
                {testing ? <RefreshCw size={16} className="animate-spin" /> : <Wifi size={16} />}
                {testing ? 'Testing…' : 'Test Gemini'}
              </button>
              <button onClick={clearKey} disabled={saving || !settings.configured}
                className="flex items-center gap-2 border border-red-200 text-red-600 font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40">
                <Trash2 size={16} /> Remove key
              </button>
            </div>

            <div className="pt-3 border-t border-gray-100 grid md:grid-cols-3 gap-3 text-xs text-gray-500">
              <div className="flex gap-2"><ShieldCheck size={15} className="text-zana-primary shrink-0" /> AES-256-GCM encrypted at rest.</div>
              <div className="flex gap-2"><EyeOff size={15} className="text-zana-primary shrink-0" /> The full key is never returned to the browser.</div>
              <div className="flex gap-2"><CheckCircle2 size={15} className="text-zana-primary shrink-0" /> Test the connection before launch.</div>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
