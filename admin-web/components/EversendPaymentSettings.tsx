'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api/client';
import { CheckCircle2, CreditCard, Eye, EyeOff, RefreshCw, Save, ShieldCheck, Wifi, Copy, Smartphone } from 'lucide-react';

type EversendSettings = {
  provider: 'EVERSEND';
  enabled: boolean;
  environment: 'sandbox' | 'production';
  baseUrl: string;
  rail: 'mtn_momo' | 'airtel_money';
  minWithdrawal: number;
  configured: boolean;
  apiKeyHint?: string | null;
  clientIdHint?: string | null;
  webhookConfigured?: boolean;
  activeProvider?: string;
};

const WEBHOOK_URL = 'https://zana.ajumalink.com/api/v1/webhooks/eversend';

export default function EversendPaymentSettings() {
  const [settings, setSettings] = useState<EversendSettings>({
    provider: 'EVERSEND',
    enabled: false,
    environment: 'sandbox',
    baseUrl: 'https://api.eversend.co/v1',
    rail: 'mtn_momo',
    minWithdrawal: 1000,
    configured: false,
    webhookConfigured: false,
  });
  const [apiKey, setApiKey] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<EversendSettings>('/admin/settings/payments/eversend')
      .then(setSettings)
      .catch((e: any) => setError(e?.message ?? 'Could not load Eversend settings.'));
  }, []);

  const save = async () => {
    setSaving(true); setMessage(null); setError(null);
    try {
      const next = await api.patch<EversendSettings>('/admin/settings/payments/eversend', {
        enabled: settings.enabled,
        environment: settings.environment,
        baseUrl: settings.baseUrl,
        rail: settings.rail,
        minWithdrawal: settings.minWithdrawal,
        apiKey: apiKey.trim() || undefined,
        clientId: clientId.trim() || undefined,
        clientSecret: clientSecret.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
      });
      setSettings(next);
      setApiKey(''); setClientId(''); setClientSecret(''); setWebhookSecret('');
      setMessage('Eversend settings saved securely.');
    } catch (e: any) {
      setError(e?.message ?? 'Could not save Eversend settings.');
    } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true); setMessage(null); setError(null);
    try {
      const result: any = await api.post('/admin/settings/payments/eversend/test');
      setMessage(`Eversend connection successful (${result.environment}).`);
    } catch (e: any) {
      setError(e?.message ?? 'Eversend connection test failed.');
    } finally { setTesting(false); }
  };

  const copyWebhook = async () => {
    try { await navigator.clipboard.writeText(WEBHOOK_URL); setMessage('Webhook URL copied.'); }
    catch { setError('Could not copy webhook URL.'); }
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zana-primary/10 flex items-center justify-center text-zana-primary"><CreditCard size={20}/></div>
          <div><h2 className="font-bold text-gray-900">Eversend payments</h2><p className="text-xs text-gray-500">Collections, driver and merchant payouts, and payment status updates.</p></div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${settings.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{settings.enabled ? 'Enabled' : 'Disabled'}</span>
      </div>

      <div className="p-5 space-y-5">
        <label className="flex items-center justify-between gap-4 p-3 rounded-xl bg-gray-50">
          <div><div className="text-sm font-semibold text-gray-900">Use Eversend for new transactions</div><div className="text-xs text-gray-500">When enabled, new collections and payouts route through Eversend. Existing Paypack transactions continue to reconcile with Paypack.</div></div>
          <button type="button" onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))} className={`relative w-11 h-6 rounded-full transition ${settings.enabled ? 'bg-zana-primary' : 'bg-gray-300'}`} aria-label="Enable Eversend"><span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${settings.enabled ? 'left-6' : 'left-1'}`}/></button>
        </label>

        <div className="grid md:grid-cols-2 gap-4">
          <label><span className="text-xs font-semibold text-gray-600 block mb-1.5">Environment</span><select value={settings.environment} onChange={e => setSettings(s => ({ ...s, environment: e.target.value as EversendSettings['environment'] }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white"><option value="sandbox">Sandbox / Test</option><option value="production">Production / Live</option></select></label>
          <label><span className="text-xs font-semibold text-gray-600 block mb-1.5">Rwanda mobile-money payout rail</span><select value={settings.rail} onChange={e => setSettings(s => ({ ...s, rail: e.target.value as EversendSettings['rail'] }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white"><option value="mtn_momo">MTN Mobile Money</option><option value="airtel_money">Airtel Money</option></select></label>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Eversend API key <span className="font-normal text-gray-400">(or use Client ID + Client Secret below)</span></label>
          <div className="relative"><input value={apiKey} onChange={e => setApiKey(e.target.value)} type={showApiKey ? 'text' : 'password'} placeholder={settings.apiKeyHint ? `Saved: ${settings.apiKeyHint} — leave blank to keep it` : 'sk_test_… or sk_live_…'} autoComplete="new-password" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm font-mono"/><button type="button" onClick={() => setShowApiKey(v => !v)} className="absolute right-3 top-2.5 text-gray-400">{showApiKey ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label><span className="text-xs font-semibold text-gray-600 block mb-1.5">Client ID</span><input value={clientId} onChange={e => setClientId(e.target.value)} type="password" placeholder={settings.clientIdHint ? `Saved: ${settings.clientIdHint} — leave blank to keep it` : 'Eversend Client ID'} autoComplete="new-password" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono"/></label>
          <label><span className="text-xs font-semibold text-gray-600 block mb-1.5">Client Secret</span><input value={clientSecret} onChange={e => setClientSecret(e.target.value)} type="password" placeholder="Eversend Client Secret" autoComplete="new-password" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono"/></label>
        </div>
        <p className="text-xs text-gray-500 -mt-3">Enter either an API key or both Client ID and Client Secret. Credentials are encrypted on the API server and never sent back to the browser.</p>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Webhook signing secret <span className="font-normal text-gray-400">(required for signed webhooks)</span></label>
          <div className="relative"><input value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} type={showWebhookSecret ? 'text' : 'password'} placeholder={settings.webhookConfigured ? 'Saved — leave blank to keep it' : 'Paste the secret generated by Eversend'} autoComplete="new-password" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm font-mono"/><button type="button" onClick={() => setShowWebhookSecret(v => !v)} className="absolute right-3 top-2.5 text-gray-400">{showWebhookSecret ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500"><span>Webhook URL:</span><code className="break-all">{WEBHOOK_URL}</code><button type="button" onClick={copyWebhook} className="inline-flex items-center gap-1 text-zana-primary font-semibold"><Copy size={13}/> Copy</button></div>
          <p className="text-xs text-gray-500 mt-1">Register this URL in Eversend Settings → Developers, then paste the generated signing secret above.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label><span className="text-xs font-semibold text-gray-600 block mb-1.5">API base URL</span><input value={settings.baseUrl} onChange={e => setSettings(s => ({ ...s, baseUrl: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono"/></label>
          <label><span className="text-xs font-semibold text-gray-600 block mb-1.5">Minimum withdrawal (RWF)</span><input type="number" min={1000} step={100} value={settings.minWithdrawal} onChange={e => setSettings(s => ({ ...s, minWithdrawal: Math.max(1000, Number(e.target.value) || 1000) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm"/></label>
        </div>

        {(message || error) && <div className={`rounded-lg p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{error || message}</div>}

        <div className="flex flex-wrap gap-2">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-zana-primary text-white font-semibold px-4 py-2.5 rounded-lg disabled:opacity-50"><Save size={16}/>{saving ? 'Saving…' : 'Save Eversend settings'}</button>
          <button onClick={test} disabled={testing || !settings.configured} className="flex items-center gap-2 border border-gray-200 text-gray-700 font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40">{testing ? <RefreshCw size={16} className="animate-spin"/> : <Wifi size={16}/>} {testing ? 'Testing…' : 'Test connection'}</button>
        </div>

        <div className="pt-3 border-t border-gray-100 grid md:grid-cols-3 gap-3 text-xs text-gray-500">
          <div className="flex gap-2"><ShieldCheck size={15} className="text-zana-primary shrink-0"/>Credentials are encrypted at rest.</div>
          <div className="flex gap-2"><EyeOff size={15} className="text-zana-primary shrink-0"/>Full secrets are never returned to the browser.</div>
          <div className="flex gap-2"><CheckCircle2 size={15} className="text-zana-primary shrink-0"/>Use sandbox first, then production.</div>
        </div>
      </div>
    </section>
  );
}
