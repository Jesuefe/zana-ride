'use client';

import { useEffect, useState } from 'react';
import { ZanaMark } from '../components/ZanaLogo';
import Link from 'next/link';
import { Package, Truck, Wallet, ShoppingBag, Plus, TrendingUp } from 'lucide-react';
import Topbar from '../components/Topbar';
import { fetchMyMerchant, fetchDeliveries, fetchWallet, fetchMyOrders, ApiMerchant, ApiDelivery } from '../lib/api/merchant';
import { ApiError, api } from '../lib/api/client';
import { useRouter } from 'next/navigation';

export default function OverviewPage() {
  const router = useRouter();
  const [brandingBusy, setBrandingBusy] = useState<'logo' | 'cover' | null>(null);
  const [brandingNote, setBrandingNote] = useState('');
  const [merchant, setMerchant] = useState<ApiMerchant | null>(null);
  const [deliveries, setDeliveries] = useState<ApiDelivery[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingLocation, setSettingLocation] = useState(false);

  const handleSetLocation = async () => {
    if (!navigator.geolocation) { setError && setError('Geolocation not available'); return; }
    setSettingLocation(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { api } = await import('../lib/api/client');
        await api.patch('/merchant/location', { lat: pos.coords.latitude, lng: pos.coords.longitude });
        // location saved - banner will disappear on next load
      } catch (e: any) { console.error('Failed to update location', e); }
      finally { setSettingLocation(false); }
    }, () => { setSettingLocation(false); console.error('Could not get location'); });
  };

  useEffect(() => {
    // Agents share this app but have their own dashboard.
    api.get<any>('/users/me')
      .then(u => { if (u?.role === 'AGENT') router.replace('/agent'); })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    (async () => {
      try {
        const [m, d, w, o] = await Promise.all([
          fetchMyMerchant(),
          fetchDeliveries(),
          fetchWallet(),
          fetchMyOrders().catch(() => []),
        ]);
        setMerchant(m);
        setDeliveries(d);
        setWalletBalance(w.balance);
        setOrders(o);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pendingOrders = orders.filter(o => o.status === 'PENDING').length;
  const activeDeliveries = deliveries.filter(d => ['REQUESTED','COURIER_ASSIGNED','PICKED_UP'].includes(d.status)).length;

  // Storefront imagery. Compressed client-side because merchants photograph
  // shopfronts on phones and those files are enormous.
  const uploadBranding = (kind: 'logo' | 'cover') => (file?: File) => {
    if (!file) return;
    setBrandingBusy(kind);
    setBrandingNote('');

    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = async () => {
        const max = kind === 'logo' ? 400 : 1200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);

        try {
          await api.patch('/merchant/branding',
            kind === 'logo' ? { logoBase64: base64 } : { coverBase64: base64 });
          setBrandingNote(kind === 'logo' ? 'Logo updated' : 'Storefront photo updated');
          fetchMyMerchant().then(setMerchant).catch(() => {});
        } catch {
          setBrandingNote('Upload failed. Try a smaller image.');
        } finally {
          setBrandingBusy(null);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <Topbar title={merchant?.businessName ?? 'Dashboard'} subtitle={undefined} />

      {/* Zana logo + greeting */}
      <div className="flex items-center gap-2 mb-6">
        <ZanaMark size={40} />
        <div>
          <p className="text-xs text-gray-500">Welcome back</p>
          <p className="font-bold text-gray-900">{merchant?.businessName ?? '—'}</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* Storefront branding — what customers see on the shop card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
          Your shop card
        </p>

        <div className="flex gap-3">
          <label className="flex-1 cursor-pointer">
            <div className="border-2 border-dashed border-gray-200 rounded-xl h-24 flex flex-col items-center justify-center gap-1 overflow-hidden">
              {(merchant as any)?.logoUrl ? (
                <img src={(merchant as any).logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Plus size={16} className="text-gray-400" />
                  <span className="text-[10px] font-bold text-gray-500">Logo</span>
                </>
              )}
            </div>
            <input type="file" accept="image/*" className="hidden"
              onChange={e => uploadBranding('logo')(e.target.files?.[0])} />
          </label>

          <label className="flex-[2] cursor-pointer">
            <div className="border-2 border-dashed border-gray-200 rounded-xl h-24 flex flex-col items-center justify-center gap-1 overflow-hidden">
              {(merchant as any)?.coverUrl ? (
                <img src={(merchant as any).coverUrl} alt="Storefront" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Plus size={16} className="text-gray-400" />
                  <span className="text-[10px] font-bold text-gray-500">Storefront photo</span>
                </>
              )}
            </div>
            <input type="file" accept="image/*" className="hidden"
              onChange={e => uploadBranding('cover')(e.target.files?.[0])} />
          </label>
        </div>

        {brandingBusy && (
          <p className="text-[11px] text-zana-primary font-semibold mt-2">
            Uploading {brandingBusy === 'logo' ? 'logo' : 'storefront photo'}…
          </p>
        )}
        {brandingNote && !brandingBusy && (
          <p className="text-[11px] text-gray-500 mt-2">{brandingNote}</p>
        )}
        <p className="text-[10px] text-gray-400 mt-2">
          Shops with a photo get noticeably more orders.
        </p>
      </div>

      {/* Order history */}
      <button
        onClick={() => router.push('/history')}
        className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3.5 shadow-sm mb-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zana-primary-light flex items-center justify-center">
            <TrendingUp size={16} className="text-zana-primary" />
          </div>
          <span className="text-sm font-bold text-gray-900">Order history &amp; revenue</span>
        </div>
        <span className="text-xs font-bold text-zana-primary">View</span>
      </button>



      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-zana-primary-light rounded-xl p-4">
          <Wallet size={18} className="text-zana-primary mb-2" />
          <p className="text-2xl font-bold text-gray-900">{walletBalance?.toLocaleString() ?? '—'}</p>
          <p className="text-xs text-gray-500">RWF balance</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <ShoppingBag size={18} className="text-amber-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{pendingOrders}</p>
          <p className="text-xs text-gray-500">Pending orders</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <Truck size={18} className="text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{activeDeliveries}</p>
          <p className="text-xs text-gray-500">Active deliveries</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <TrendingUp size={18} className="text-green-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{deliveries.length}</p>
          <p className="text-xs text-gray-500">Total deliveries</p>
        </div>
      </div>

      {/* Set business location */}
        {!(merchant as any)?.businessLat && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">Set your business location</p>
              <p className="text-xs text-amber-600 mt-0.5">This lets us calculate delivery fees for your customers accurately.</p>
              <button onClick={handleSetLocation} disabled={settingLocation}
                className="mt-2 bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50">
                {settingLocation ? 'Locating...' : 'Use my current location'}
              </button>
            </div>
          </div>
        )}
        {/* Quick actions */}
      <h2 className="font-semibold text-gray-900 mb-3">Quick Actions</h2>
      <div className="space-y-2">
        <Link href="/new-delivery" className="flex items-center gap-3 bg-zana-primary text-white rounded-xl px-4 py-3.5">
          <Truck size={18} />
          <div className="flex-1">
            <p className="font-semibold text-sm">Send a Package</p>
            <p className="text-xs text-white/70">Request a Zana courier</p>
          </div>
          <Plus size={16} />
        </Link>
        <Link href="/products" className="flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 shadow-sm">
          <Package size={18} className="text-zana-primary" />
          <div className="flex-1">
            <p className="font-semibold text-sm text-gray-900">My Products</p>
            <p className="text-xs text-gray-500">Manage your listings</p>
          </div>
        </Link>
        <Link href="/orders" className="flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 shadow-sm">
          <ShoppingBag size={18} className="text-amber-500" />
          <div className="flex-1">
            <p className="font-semibold text-sm text-gray-900">Orders</p>
            <p className="text-xs text-gray-500">{pendingOrders > 0 ? `${pendingOrders} pending` : 'View all orders'}</p>
          </div>
          {pendingOrders > 0 && (
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{pendingOrders}</span>
          )}
        </Link>
      </div>

      {/* Merchant status */}
      {(merchant as any)?.status === 'PENDING' && (
        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800">Account pending approval</p>
          <p className="text-xs text-amber-600 mt-1">Your merchant account is under review. Products you add will only appear publicly after admin approval.</p>
        </div>
      )}
    </div>
  );
}
