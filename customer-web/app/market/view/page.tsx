'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Store, Plus, Minus, ShoppingBag } from 'lucide-react';
import { fetchMarket, placeOrder } from '../../../lib/api/marketplace';
import { fetchWallet } from '../../../lib/api/trips';

type Item = { product: any; quantity: number };

function MarketContent() {
  const router = useRouter();
  const params = useSearchParams();
  const marketId = params.get('id') ?? '';

  const [market, setMarket] = useState<any>(null);
  const [cart, setCart] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'MOBILE_MONEY'>('WALLET');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!marketId) { setLoading(false); return; }
    fetchMarket(marketId).then(setMarket).catch(() => {}).finally(() => setLoading(false));
    fetchWallet().then((w: any) => setWalletBalance(w.balance)).catch(() => {});
    navigator.geolocation?.getCurrentPosition(
      p => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 6000 },
    );
  }, [marketId]);

  const qty = (id: string) => cart.find(c => c.product.id === id)?.quantity ?? 0;

  const add = (product: any) =>
    setCart(prev => {
      const found = prev.find(c => c.product.id === product.id);
      if (found) return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { product, quantity: 1 }];
    });

  const remove = (id: string) =>
    setCart(prev =>
      prev.map(c => c.product.id === id ? { ...c, quantity: c.quantity - 1 } : c)
          .filter(c => c.quantity > 0),
    );

  const subtotal = cart.reduce((s, c) => s + c.product.price * c.quantity, 0);
  const estFee = 1000;
  const grandTotal = subtotal + estFee;
  const walletShort = paymentMethod === 'WALLET' && walletBalance !== null && walletBalance < grandTotal;

  const submit = async () => {
    if (!cart.length) return;
    setOrdering(true);
    setError('');
    try {
      const order = await placeOrder({
        marketId,
        items: cart.map(c => ({ productId: c.product.id, quantity: c.quantity })),
        dropoffLat: pos?.lat ?? 0,
        dropoffLng: pos?.lng ?? 0,
        dropoffAddress: 'Current location',
        paymentMethod,
      } as any);
      router.push(`/orders?highlight=${order.id}`);
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('INSUFFICIENT_WALLET_BALANCE')) {
        const p = msg.split(':');
        setError(`Not enough in your wallet. Balance ${Number(p[1] ?? 0).toLocaleString()} RWF, order costs ${Number(p[2] ?? 0).toLocaleString()} RWF.`);
      } else {
        setError(msg || 'Could not place the order.');
      }
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zana-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="relative">
        {market?.coverUrl ? (
          <img src={market.coverUrl} alt="" className="w-full h-40 object-cover" />
        ) : (
          <div className="w-full h-40 bg-zana-primary-light flex items-center justify-center">
            <Store size={36} className="text-zana-primary/40" />
          </div>
        )}
        <button onClick={() => router.back()}
          className="absolute top-12 left-4 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow">
          <ArrowLeft size={18} className="text-gray-800" />
        </button>
      </div>

      <div className="bg-white px-4 py-4">
        <h1 className="text-xl font-black text-gray-900">{market?.name}</h1>
        <p className="text-xs text-gray-500 mt-0.5">{market?.address}</p>
        <div className="flex items-start gap-2 bg-zana-primary-light rounded-xl px-3 py-2.5 mt-3">
          <span className="text-sm shrink-0">🧺</span>
          <p className="text-[11px] text-gray-700 leading-snug">
            A Zana agent buys these items for you at the market, then a rider delivers them.
          </p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-2">
        {(market?.products ?? []).length === 0 && (
          <div className="text-center py-14">
            <ShoppingBag size={32} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Nothing listed here today</p>
          </div>
        )}

        {(market?.products ?? []).map((p: any) => (
          <div key={p.id} className="bg-white rounded-2xl p-3 flex items-center gap-3">
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gray-100 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-gray-900 line-clamp-1">{p.name}</p>
              {p.description && <p className="text-xs text-gray-400 line-clamp-1">{p.description}</p>}
              <p className="text-sm font-black text-zana-primary mt-0.5">{p.price.toLocaleString()} RWF</p>
            </div>

            {qty(p.id) === 0 ? (
              <button onClick={() => add(p)}
                className="w-9 h-9 rounded-full bg-zana-primary flex items-center justify-center shrink-0">
                <Plus size={16} className="text-white" />
              </button>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => remove(p.id)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Minus size={14} className="text-gray-700" />
                </button>
                <span className="w-5 text-center font-bold text-sm">{qty(p.id)}</span>
                <button onClick={() => add(p)} className="w-8 h-8 rounded-full bg-zana-primary flex items-center justify-center">
                  <Plus size={14} className="text-white" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {cart.length > 0 && !checkout && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
          <button onClick={() => setCheckout(true)}
            className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2">
            <ShoppingBag size={16} />
            Review {cart.length} item{cart.length === 1 ? '' : 's'} · {subtotal.toLocaleString()} RWF
          </button>
        </div>
      )}

      {checkout && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setCheckout(false)}>
          <div className="w-full bg-white rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <p className="font-black text-lg text-gray-900 mb-4">Confirm your order</p>

            <div className="space-y-1.5 mb-4">
              {cart.map(c => (
                <div key={c.product.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{c.product.name} ×{c.quantity}</span>
                  <span className="font-semibold">{(c.product.price * c.quantity).toLocaleString()} RWF</span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                <span className="text-gray-600">Delivery (estimate)</span>
                <span className="font-semibold">{estFee.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="font-black text-gray-900">Total</span>
                <span className="font-black text-zana-primary text-lg">{grandTotal.toLocaleString()} RWF</span>
              </div>
              <p className="text-[10px] text-gray-400">
                Final delivery fee is calculated from the market to your location.
              </p>
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Payment</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {([['WALLET', 'Zana Wallet'], ['MOBILE_MONEY', 'Mobile Money']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setPaymentMethod(id)}
                  className={`py-3 rounded-xl border-2 text-xs font-bold ${
                    paymentMethod === id
                      ? 'border-zana-primary bg-zana-primary text-white'
                      : 'border-gray-100 text-gray-600 bg-white'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {paymentMethod === 'WALLET' && walletBalance !== null && (
              <p className={`text-[11px] font-semibold mb-2 ${walletShort ? 'text-red-500' : 'text-gray-500'}`}>
                Wallet balance: {walletBalance.toLocaleString()} RWF
                {walletShort ? ` · ${(grandTotal - walletBalance).toLocaleString()} RWF short` : ''}
              </p>
            )}

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <button onClick={submit} disabled={ordering || walletShort}
              className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl disabled:opacity-40">
              {ordering ? 'Placing order…' : `Pay & Order · ${grandTotal.toLocaleString()} RWF`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense fallback={null}>
      <MarketContent />
    </Suspense>
  );
}
