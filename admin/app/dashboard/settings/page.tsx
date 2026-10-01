'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import AdminProfilePhoto from '../../../components/AdminProfilePhoto';
import { api } from '../../../lib/api/client';
import { CheckCircle2, CreditCard, Eye, EyeOff, RefreshCw, Save, ShieldCheck, Wifi } from 'lucide-react';

type Settings = {
  enabled: boolean;
  environment: 'sandbox' | 'production';
  baseUrl: string;
  rail: 'mtn_momo' | 'airtel_money';
  minWithdrawal: number;
  configured: boolean;
  apiKeyHint?: string | null;
  webhookConfigured?: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    enabled: false,
    environment: 'sandbox',
    baseUrl: 'https://api.eversend.co/v1',
    rail: 'mtn_momo',
    minWithdrawal: 1000,
    configured: false,
  });
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Settings>('/admin/settings/payments/eversend')
      .then(setSettings)
      .catch((e: any) => setError(e?.message ?? 'Could not load payment settings.'));
  }, []);

  const save = async () => {
    setSaving(true); setMessage(null); setError(null);
    try {
      const next = await api.patch<Settings & { saved: boolean }>('/admin/settings/payments/eversend', {
        enabled: settings.enabled,
        environment: settings.environment,
        apiKey: apiKey.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
        baseUrl: settings.baseUrl,
        rail: settings.rail,
        minWithdrawal: settings.minWithdrawal,
      });
      setSettings(next);
      setApiKey('');
      setWebhookSecret('');
      setMessage('Eversend settings saved securely.');
    } catch (e: any) {
      setError(e?.message ?? 'Could not save settings.');
    } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true); setMessage(null); setError(null);
    try {
      const res: any = await api.post('/admin/settings/payments/eversend/test');
      setMessage('Connection successful — Eversend is reachable.');
    } catch (e: any) {
      setError(e?.message ?? 'Eversend connection test failed.');
    } finally { setTesting(false); }
  };

  return (
    <AdminShell>
      <div className="max-w-3xl">
        <AdminProfilePhoto />
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure Zana's external payment rail without editing the server environment.</p>
        </div>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zana-primary/10 flex items-center justify-center text-zana-primary"><CreditCard size={20} /></div>
              <div>
                <h2 className="font-bold text-gray-900">Eversend</h2>
                <p className="text-xs text-gray-500">Collections and payouts for Zana</p>
              </div>
            </div>
            <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${settings.configured ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {settings.configured ? 'Configured' : 'Not configured'}
            </div>
          </div>

          <div className="p-5 space-y-5">
            <label className="flex items-center justify-between gap-4 p-3 rounded-xl bg-gray-50">
              <div>
                <div className="text-sm font-semibold text-gray-900">Enable Eversend</div>
                <div className="text-xs text-gray-500">Use Eversend for digital collections and payouts.</div>
              </div>
              <button onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
                className={`relative w-11 h-6 rounded-full transition ${settings.enabled ? 'bg-zana-primary' : 'bg-gray-300'}`} aria-label="Enable Eversend">
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${settings.enabled ? 'left-6' : 'left-1'}`} />
              </button>
            </label>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Environment</label>
                <select value={settings.environment} onChange={e => setSettings(s => ({ ...s, environment: e.target.value as Settings['environment'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white">
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Rwanda payout rail</label>
                <select value={settings.rail} onChange={e => setSettings(s => ({ ...s, rail: e.target.value as Settings['rail'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white">
                  <option value="mtn_momo">MTN MoMo</option>
                  <option value="airtel_money">Airtel Money</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Eversend API key</label>
              <div className="relative">
                <input value={apiKey} onChange={e => setApiKey(e.target.value)} type={showKey ? 'text' : 'password'}
                  placeholder={settings.apiKeyHint ? `Saved: ${settings.apiKeyHint} — leave blank to keep it` : 'sk_test_… or sk_live_…'}
                  autoComplete="new-password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm font-mono" />
                <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-2.5 text-gray-400">
                  {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Webhook secret <span className="font-normal text-gray-400">(optional for now)</span></label>
              <div className="relative">
                <input value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} type={showWebhook ? 'text' : 'password'}
                  placeholder={settings.webhookConfigured ? 'Saved — leave blank to keep it' : 'Webhook signing secret'}
                  autoComplete="new-password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm font-mono" />
                <button type="button" onClick={() => setShowWebhook(v => !v)} className="absolute right-3 top-2.5 text-gray-400">
                  {showWebhook ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">API base URL</label>
                <input value={settings.baseUrl} onChange={e => setSettings(s => ({ ...s, baseUrl: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Minimum withdrawal (RWF)</label>
                <input type="number" min={1000} step={100} value={settings.minWithdrawal}
                  onChange={e => setSettings(s => ({ ...s, minWithdrawal: Math.max(1000, Number(e.target.value) || 1000) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
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
                {testing ? 'Testing…' : 'Test connection'}
              </button>
            </div>

            <div className="pt-3 border-t border-gray-100 grid md:grid-cols-3 gap-3 text-xs text-gray-500">
              <div className="flex gap-2"><ShieldCheck size={15} className="text-zana-primary shrink-0" /> Credentials are encrypted at rest.</div>
              <div className="flex gap-2"><EyeOff size={15} className="text-zana-primary shrink-0" /> Full secrets are never returned to the browser.</div>
              <div className="flex gap-2"><CheckCircle2 size={15} className="text-zana-primary shrink-0" /> Sandbox first, then production.</div>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
