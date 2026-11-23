'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://zana.ajumalink.com/api/v1';
type Tab = 'Overview' | 'Deliveries' | 'Wallet' | 'Developers';

function money(value: number) { return new Intl.NumberFormat('en-RW').format(value || 0); }
function date(value: string) { return new Date(value).toLocaleString('en-RW', { dateStyle: 'medium', timeStyle: 'short' }); }

export default function BusinessDashboard() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [tab, setTab] = useState<Tab>('Overview');
  const [overview, setOverview] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newKey, setNewKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const request = useCallback(async (path: string, method = 'GET') => {
    const response = await fetch(`${API}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      sessionStorage.removeItem('zana_business_token');
      router.replace('/business');
      throw new Error('Your session expired. Please sign in again.');
    }
    if (!response.ok) throw new Error(data.message || 'Unable to load business data.');
    return data;
  }, [token, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setRefreshing(true); setError('');
    try {
      const [summary, jobs, walletData, ledger] = await Promise.all([
        request('/food-partners/portal/overview'),
        request('/food-partners/portal/deliveries?limit=100'),
        request('/food-partners/portal/wallet'),
        request('/food-partners/portal/wallet/transactions'),
      ]);
      setOverview(summary); setDeliveries(jobs); setWallet(walletData); setTransactions(ledger);
    } catch (e: any) { setError(e?.message || 'Could not refresh the dashboard.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, request]);

  useEffect(() => {
    const saved = sessionStorage.getItem('zana_business_token');
    if (!saved) { router.replace('/business'); return; }
    setToken(saved);
  }, [router]);

  useEffect(() => { if (token) load(); }, [token, load]);

  async function rotateKey() {
    if (!window.confirm('Rotate your API key? Your old key will stop working immediately.')) return;
    try {
      const data = await request('/food-partners/portal/rotate-key', 'POST');
      setNewKey(data.apiKey || ''); setCopied(false);
    } catch (e: any) { setError(e?.message || 'Could not rotate API key.'); }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setError('Clipboard access was blocked. Please copy the key manually.'); }
  }

  function logout() {
    sessionStorage.removeItem('zana_business_token');
    router.replace('/business');
  }

  const partner = overview?.partner;
  const statuses = overview?.statusCounts || {};
  const nav: Tab[] = ['Overview', 'Deliveries', 'Wallet', 'Developers'];

  if (loading) return <main className="biz-dashboard-loading"><div className="biz-loader" /><p>Opening your business dashboard…</p></main>;

  return (
    <main className="biz-dashboard">
      <aside className="biz-sidebar">
        <a href="/business" className="biz-logo"><span className="biz-logo-mark">z</span> zana<span>.</span></a>
        <p className="biz-side-label">BUSINESS WORKSPACE</p>
        <nav>{nav.map(item=><button key={item} className={tab===item?'selected':''} onClick={()=>{setTab(item);setNewKey('');}}><i>{item==='Overview'?'▦':item==='Deliveries'?'↗':item==='Wallet'?'₣':'⌘'}</i>{item}</button>)}</nav>
        <div className="biz-sidebar-bottom"><div className="biz-side-help"><strong>Need a hand?</strong><small>Our team can help with integration and delivery operations.</small><a href="mailto:support@zanaride.rw">Contact support ↗</a></div><button className="biz-logout" onClick={logout}>↪ Sign out</button></div>
      </aside>
      <section className="biz-dash-main">
        <header className="biz-dash-header"><div><span>BUSINESS PORTAL</span><h1>{tab}</h1></div><div className="biz-dash-user"><div className="biz-avatar">{(partner?.name || 'B').slice(0,1).toUpperCase()}</div><span><strong>{partner?.name || 'Your business'}</strong><small>{partner?.contactEmail}</small></span><button onClick={load} disabled={refreshing} title="Refresh dashboard">↻</button></div></header>
        {error && <div className="biz-dash-error">{error}<button onClick={()=>setError('')}>×</button></div>}
        {partner?.status !== 'ACTIVE' && <div className="biz-review-banner"><strong>Business account under review</strong><p>Your application is in Zana's partner review queue. You can explore the dashboard, but delivery API access and API key generation will unlock after activation.</p><span>APPLICATION STATUS: {partner?.status || 'PENDING'}</span></div>}

        {tab==='Overview' && <div className="biz-dash-content">
          <div className="biz-welcome"><div><p className="biz-eyebrow">YOUR DELIVERY NETWORK</p><h2>Good to have you<br />on board.</h2><p>Monitor deliveries, keep your prepaid balance ready and connect your ordering system.</p></div><div className="biz-welcome-mark">z<span>.</span></div></div>
          <div className="biz-stat-grid"><article><small>AVAILABLE BALANCE</small><strong>{money(wallet?.balance)} <i>RWF</i></strong><span>Prepaid business wallet</span></article><article><small>TOTAL DELIVERIES</small><strong>{money(overview?.totalDeliveries)}</strong><span>All requests sent to Zana</span></article><article><small>DELIVERY SPEND</small><strong>{money(overview?.totalSpent)} <i>RWF</i></strong><span>Lifetime delivery fees</span></article><article><small>ACCOUNT STATUS</small><strong className="biz-stat-status">{partner?.status || 'PENDING'}</strong><span>Partner account verification</span></article></div>
          <div className="biz-overview-grid"><section className="biz-panel"><div className="biz-panel-head"><div><h3>Delivery activity</h3><p>Current status breakdown</p></div><button onClick={()=>setTab('Deliveries')}>View all ↗</button></div><div className="biz-status-list">{[['REQUESTED','Waiting for rider'],['ASSIGNED','Rider assigned'],['PICKED_UP','Picked up'],['DELIVERED','Delivered'],['CANCELLED','Cancelled']].map(([key,label])=><div key={key}><span><i className={'status-dot '+key.toLowerCase()} />{label}</span><b>{statuses[key] || 0}</b></div>)}</div></section><section className="biz-panel"><div className="biz-panel-head"><div><h3>Latest wallet activity</h3><p>Recent prepaid movements</p></div><button onClick={()=>setTab('Wallet')}>Wallet ↗</button></div>{(overview?.recentTransactions || []).length===0?<p className="biz-empty">Your wallet transactions will appear here.</p>:overview.recentTransactions.map((t:any,i:number)=><div className="biz-mini-transaction" key={i}><span><strong>{t.description || 'Wallet movement'}</strong><small>{date(t.createdAt)}</small></span><b className={t.amount<0?'negative':'positive'}>{t.amount<0?'−':'+'}{money(Math.abs(t.amount))} RWF</b></div>)}</section></div>
          <section className="biz-panel"><div className="biz-panel-head"><div><h3>Recent deliveries</h3><p>Most recent jobs created by your account</p></div><button onClick={()=>setTab('Deliveries')}>See deliveries ↗</button></div><DeliveryTable rows={(overview?.recentDeliveries || [])} /></section>
        </div>}

        {tab==='Deliveries' && <div className="biz-dash-content"><div className="biz-page-intro"><div><h2>Your deliveries</h2><p>Track every delivery request created through your business integration.</p></div><button onClick={load} className="biz-outline-button">↻ Refresh</button></div><section className="biz-panel"><DeliveryTable rows={deliveries} full /></section></div>}

        {tab==='Wallet' && <div className="biz-dash-content"><div className="biz-page-intro"><div><h2>Prepaid wallet</h2><p>Delivery fees are deducted automatically when a delivery is accepted by the API.</p></div><a className="biz-button biz-button-dark" href="mailto:support@zanaride.rw?subject=Zana%20Business%20Wallet%20Top-up">Request top-up ↗</a></div><div className="biz-wallet-card"><small>AVAILABLE BUSINESS BALANCE</small><strong>{money(wallet?.balance)} <i>RWF</i></strong><p>Keep your balance funded to avoid delivery requests failing due to insufficient funds.</p></div><section className="biz-panel"><div className="biz-panel-head"><div><h3>Wallet ledger</h3><p>Last 100 wallet transactions</p></div></div>{transactions.length===0?<p className="biz-empty">No wallet activity yet. Your first top-up will appear here.</p>:<div className="biz-ledger">{transactions.map((t:any,i:number)=><div key={i}><span><strong>{t.description || 'Wallet movement'}</strong><small>{t.reference || '—'} · {date(t.createdAt)}</small></span><b className={t.amount<0?'negative':'positive'}>{t.amount<0?'−':'+'}{money(Math.abs(t.amount))} RWF</b><small>Balance after: {money(t.balanceAfter)} RWF</small></div>)}</div>}</section></div>}

        {tab==='Developers' && <div className="biz-dash-content"><div className="biz-page-intro"><div><h2>Developer centre</h2><p>Connect your ordering platform to Zana's delivery network.</p></div><span className="biz-dev-badge">API v1 · REST · JSON</span></div>
          <section className="biz-panel biz-credentials"><div><h3>API credentials</h3><p>Your private API key is shown only once when generated. Store it in your backend's secret manager, never in browser or mobile app code.</p></div><div className="biz-key-row"><span>{newKey || partner?.apiKeyPrefix ? (newKey || partner.apiKeyPrefix+'••••••••••••') : 'No active key has been issued'}</span>{newKey && <button onClick={()=>copy(newKey)}>{copied?'Copied ✓':'Copy key'}</button>}</div><button className="biz-outline-button" disabled={partner?.status!=='ACTIVE'} onClick={rotateKey}>{newKey?'Rotate again':'Generate / rotate API key'} ↗</button>{partner?.status!=='ACTIVE' && <small>API key generation is available after Zana activates your account.</small>}</section>
          <section className="biz-panel"><div className="biz-panel-head"><div><h3>API reference</h3><p>Base URL: https://zana.ajumalink.com/api/v1</p></div></div><div className="biz-api-reference">{[['POST','/food-partners/quote','Calculate a delivery fee using pickup and drop-off coordinates.'],['POST','/food-partners/deliveries','Create a delivery and debit the prepaid wallet.'],['GET','/food-partners/deliveries/:id','Retrieve delivery status and tracking details.'],['POST','/food-partners/deliveries/:id/cancel','Cancel an unassigned request and refund its fee.'],['GET','/food-partners/wallet','Read the current prepaid wallet balance.'],['GET','/food-partners/wallet/transactions','Read the latest 100 wallet ledger entries.']].map(([method,path,description])=><div key={path}><b>{method}</b><code>{path}</code><small>{description}</small></div>)}</div></section>
          <section className="biz-panel"><div className="biz-panel-head"><div><h3>Example: create a delivery</h3><p>Call this from your server after the customer completes checkout.</p></div></div><pre className="biz-dash-code"><code>{`const response = await fetch(
  "https://zana.ajumalink.com/api/v1/food-partners/deliveries",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Zana-API-Key": process.env.ZANA_API_KEY
    },
    body: JSON.stringify({
      partnerOrderRef: "ORDER-100045",
      pickupAddress: "Restaurant, Kigali",
      pickupLat: -1.9441,
      pickupLng: 30.0619,
      dropoffAddress: "Customer, Kigali",
      dropoffLat: -1.9536,
      dropoffLng: 30.0606,
      receiverPhone: "+2507XXXXXXXX"
    })
  }
);
const delivery = await response.json();`}</code></pre><button className="biz-outline-button" onClick={()=>copy('const response = await fetch("https://zana.ajumalink.com/api/v1/food-partners/deliveries", { method: "POST", headers: { "Content-Type": "application/json", "X-Zana-API-Key": process.env.ZANA_API_KEY }, body: JSON.stringify({ partnerOrderRef: "ORDER-100045", pickupAddress: "Restaurant, Kigali", pickupLat: -1.9441, pickupLng: 30.0619, dropoffAddress: "Customer, Kigali", dropoffLat: -1.9536, dropoffLng: 30.0606, receiverPhone: "+2507XXXXXXXX" }) });')}>Copy example</button></section>
          <section className="biz-panel"><h3>Integration rules</h3><ul className="biz-doc-list"><li>Keep your API key on your server. Do not expose it in public JavaScript or mobile builds.</li><li>Use your own unique <code>partnerOrderRef</code> for every order. Retries with the same reference do not create duplicate deliveries or wallet deductions.</li><li>Zana recalculates the delivery fee using its own pricing rules. Amounts are integer RWF.</li><li>Insufficient prepaid balance blocks delivery creation. Check your wallet before busy periods.</li><li>Poll the delivery endpoint to synchronize status in your own order interface. Outbound webhooks are not enabled in this release.</li><li>Cancellation refunds are available only while the job is still REQUESTED and no rider has been assigned.</li></ul></section>
        </div>}
        <footer className="biz-dash-footer"><span>© {new Date().getFullYear()} Zana Ride · Business platform</span><a href="mailto:support@zanaride.rw">Business support</a><a href="/business">Public business page</a></footer>
      </section>
    </main>
  );
}

function DeliveryTable({ rows, full = false }: { rows: any[]; full?: boolean }) {
  if (!rows.length) return <p className="biz-empty">No deliveries yet. Once your integration creates a job, it will appear here.</p>;
  return <div className="biz-table-wrap"><table className="biz-table"><thead><tr><th>ORDER REF</th><th>TRACKING</th><th>STATUS</th><th>FEE</th><th>CREATED</th>{full&&<th>PICKUP / DROP-OFF</th>}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.partnerOrderRef || '—'}</strong></td><td>{row.trackingCode || '—'}</td><td><span className={'biz-status-pill '+String(row.status).toLowerCase()}>{row.status}</span></td><td>{money(row.fee)} RWF</td><td>{date(row.createdAt)}</td>{full&&<td><small>{row.pickupAddress}<br />↓<br />{row.dropoffAddress}</small></td>}</tr>)}</tbody></table></div>;
}
