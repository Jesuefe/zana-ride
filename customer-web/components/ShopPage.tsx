'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Plus, Minus, MapPin, Loader2, Store, Package } from 'lucide-react';
import { fetchMarketplaceWithLocation, placeOrder, MarketplaceMerchant, MarketplaceProduct, CartItem } from '../lib/api/marketplace';
import { getStoredPickup } from '../lib/location';

type Props = {
  category: 'FOOD' | 'GIFTS' | 'GOODS';
  title: string;
  emptyMessage: string;
};

export default function ShopPage({ category, title, emptyMessage }: Props) {
  const router = useRouter();
  const pickup = getStoredPickup();

  const [merchants, setMerchants] = useState<MarketplaceMerchant[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'MOBILE_MONEY'>('WALLET');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);
  const [openMerchant, setOpenMerchant] = useState<MarketplaceMerchant | null>(null);
  const [switchPrompt, setSwitchPrompt] = useState<{ product: MarketplaceProduct; merchantId: string } | null>(null);

  useEffect(() => {
    import('../lib/api/trips').then(({ fetchWallet }) => {
      fetchWallet().then((w: any) => setWalletBalance(w.balance)).catch(() => {});
    });
  }, []);

  useEffect(() => {
    fetchMarketplaceWithLocation(category, pickup.lat, pickup.lng)
      .then(setMerchants)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const merchantForCart = merchants.find(m => m.id === cart[0]?.merchantId);
  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const deliveryFee = merchantForCart?.deliveryFee ?? 0;
  const walletShort =
    paymentMethod === 'WALLET' && walletBalance !== null && walletBalance < (cartTotal + deliveryFee);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const grandTotal = cartTotal + deliveryFee;

  const addToCart = (product: MarketplaceProduct, merchantId: string) => {
    const existing = cart[0];
    // Each merchant prepares and is collected separately, so a cart can only
    // ever hold one merchant's items. Ask before discarding the other one.
    if (existing && existing.merchantId !== merchantId) {
      setSwitchPrompt({ product, merchantId });
      return;
    }
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id);
      if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, merchantId }];
    });
  };

  const removeFromCart = (productId: string) =>
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0));

  const getQty = (productId: string) => cart.find(i => i.product.id === productId)?.quantity ?? 0;

  const handleOrder = async () => {
    if (!cart.length || !merchantForCart) return;
    setOrdering(true);
    setError('');
    try {
      const order = await placeOrder({
        merchantId: cart[0].merchantId,
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        dropoffLat: pickup.lat,
        dropoffLng: pickup.lng,
        dropoffAddress: 'Current location',
        paymentMethod,
        deliveryFee,
      });
      router.push(`/orders?highlight=${order.id}`);
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('INSUFFICIENT_WALLET_BALANCE')) {
        const parts = msg.split(':');
        const bal = Number(parts[1] ?? 0);
        const need = Number(parts[2] ?? 0);
        setError(
          `Not enough in your wallet. Balance ${bal.toLocaleString()} RWF, order costs ${need.toLocaleString()} RWF. Top up or pay with Mobile Money.`
        );
      } else if (msg.includes('MOMO_CHARGE_FAILED')) {
        setError('Could not reach Mobile Money. Check the number and try again.');
      } else {
        setError(msg || 'Could not place order.');
      }
    } finally { setOrdering(false); }
  };

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 px-4 pt-10 pb-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
        </div>
        {cartCount > 0 && (
          <button onClick={() => setShowCart(true)}
            className="flex items-center gap-2 bg-zana-primary text-white px-3 py-1.5 rounded-full text-xs font-semibold">
            <ShoppingCart size={14} />
            {cartCount} · {cartTotal.toLocaleString()} RWF
          </button>
        )}
      </div>

      <div className="p-4">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-zana-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && merchants.length === 0 && (
          <div className="text-center py-16">
            <Store size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">{emptyMessage}</p>
            <p className="text-xs text-gray-400 mt-1">Check back soon.</p>
          </div>
        )}

        {/* ── Browse: one card per merchant ───────────────────────── */}
        {!openMerchant && merchants.map(m => (
          <button
            key={m.id}
            onClick={() => setOpenMerchant(m)}
            className="w-full bg-white rounded-2xl overflow-hidden shadow-sm mb-3 text-left active:scale-[0.99] transition-transform"
          >
            {/* Storefront banner */}
            {(m as any).coverUrl ? (
              <img src={(m as any).coverUrl} alt="" className="w-full h-28 object-cover" />
            ) : (
              <div className="w-full h-24 bg-zana-primary-light flex items-center justify-center">
                <Store size={26} className="text-zana-primary/40" />
              </div>
            )}

            <div className="p-4">
              <div className="flex items-start gap-3">
                {(m as any).logoUrl ? (
                  <img
                    src={(m as any).logoUrl}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover shrink-0 -mt-9 border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm -mt-9 border-2 border-white flex items-center justify-center shrink-0">
                    <Store size={18} className="text-zana-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 line-clamp-1">{m.businessName}</p>
                  {m.branch && <p className="text-xs text-gray-400 line-clamp-1">{m.branch}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2.5 mt-3 text-[11px] flex-wrap">
                <span className="flex items-center gap-1 text-gray-500">
                  <MapPin size={10} /> {m.distanceText}
                </span>
                <span className="text-gray-300">·</span>
                <span className="font-bold text-zana-primary">
                  {m.deliveryFee.toLocaleString()} RWF delivery
                </span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-500">
                  {m.products.length} item{m.products.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </button>
        ))}

        {/* ── Inside one merchant ──────────────────────────────────── */}
        {openMerchant && (
          <div>
            <button
              onClick={() => setOpenMerchant(null)}
              className="flex items-center gap-1.5 text-sm font-bold text-zana-primary mb-3"
            >
              <ArrowLeft size={15} /> All shops
            </button>

            <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-4">
              {(openMerchant as any).coverUrl ? (
                <img src={(openMerchant as any).coverUrl} alt="" className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-24 bg-zana-primary-light flex items-center justify-center">
                  <Store size={28} className="text-zana-primary/40" />
                </div>
              )}
              <div className="p-4">
                <p className="font-black text-lg text-gray-900">{openMerchant.businessName}</p>
                {openMerchant.branch && (
                  <p className="text-xs text-gray-400">{openMerchant.branch}</p>
                )}
                <div className="flex items-center gap-2.5 mt-2 text-[11px]">
                  <span className="flex items-center gap-1 text-gray-500">
                    <MapPin size={10} /> {openMerchant.distanceText}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="font-bold text-zana-primary">
                    {openMerchant.deliveryFee.toLocaleString()} RWF delivery
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {openMerchant.products.length === 0 && (
                <p className="text-center text-sm text-gray-500 py-10">
                  Nothing listed here yet.
                </p>
              )}

              {openMerchant.products.map(p => {
                const inCart = cart.find(i => i.product.id === p.id);
                return (
                  <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                        <Package size={22} className="text-gray-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">{p.name}</p>
                      {p.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{p.description}</p>
                      )}
                      <p className="text-sm font-bold text-zana-primary mt-1">
                        {p.price.toLocaleString()} RWF
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {inCart ? (
                        <>
                          <button
                            onClick={() => removeFromCart(p.id)}
                            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                          >
                            <Minus size={14} className="text-gray-700" />
                          </button>
                          <span className="w-5 text-center font-bold text-sm">{inCart.quantity}</span>
                          <button
                            onClick={() => addToCart(p, openMerchant.id)}
                            className="w-8 h-8 rounded-full bg-zana-primary flex items-center justify-center"
                          >
                            <Plus size={14} className="text-white" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => addToCart(p, openMerchant.id)}
                          className="w-9 h-9 rounded-full bg-zana-primary flex items-center justify-center"
                        >
                          <Plus size={16} className="text-white" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Switching merchants clears the cart ─────────────────────── */}
      {switchPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6">
            <p className="font-black text-lg text-gray-900 mb-2">Start a new order?</p>
            <p className="text-sm text-gray-500 mb-5">
              Your basket has items from {merchantForCart?.businessName ?? 'another shop'}.
              Each shop is prepared and collected separately, so Zana can only
              carry one shop per order.
            </p>
            <button
              onClick={() => {
                setCart([{ product: switchPrompt.product, quantity: 1, merchantId: switchPrompt.merchantId }]);
                setSwitchPrompt(null);
              }}
              className="w-full bg-zana-primary text-white font-black py-3.5 rounded-2xl"
            >
              Start new order
            </button>
            <button
              onClick={() => setSwitchPrompt(null)}
              className="w-full text-sm text-gray-400 py-2.5 mt-1"
            >
              Keep my current basket
            </button>
          </div>
        </div>
      )}

      {/* ── Cart ─────────────────────────────────────────────────────── */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setShowCart(false)}>
          <div className="w-full bg-white rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            <p className="font-black text-lg text-gray-900">Your basket</p>
            {merchantForCart && (
              <p className="text-xs text-gray-400 mb-4">{merchantForCart.businessName}</p>
            )}

            <div className="space-y-1.5 mb-4">
              {cart.map(i => (
                <div key={i.product.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{i.product.name} ×{i.quantity}</span>
                  <span className="font-semibold">
                    {(i.product.price * i.quantity).toLocaleString()} RWF
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                <span className="text-gray-600">Delivery</span>
                <span className="font-semibold">{deliveryFee.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="font-black text-gray-900">Total</span>
                <span className="font-black text-zana-primary text-lg">
                  {grandTotal.toLocaleString()} RWF
                </span>
              </div>
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Payment</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {([['WALLET', 'Zana Wallet'], ['MOBILE_MONEY', 'Mobile Money']] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPaymentMethod(id)}
                  className={`py-3 rounded-xl border-2 text-xs font-bold ${
                    paymentMethod === id
                      ? 'border-zana-primary bg-zana-primary text-white'
                      : 'border-gray-100 text-gray-600 bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {paymentMethod === 'WALLET' && walletBalance !== null && (
              <p className={`text-[11px] font-semibold ${walletShort ? 'text-red-500' : 'text-gray-500'}`}>
                Wallet balance: {walletBalance.toLocaleString()} RWF
                {walletShort ? ` · ${(grandTotal - walletBalance).toLocaleString()} RWF short` : ''}
              </p>
            )}

            <p className="text-[10px] text-gray-400 mt-1.5">
              Cash not accepted. Payment is processed before delivery.
            </p>

            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mt-3">
              <span className="text-amber-500 text-sm shrink-0">🛡️</span>
              <p className="text-[10px] text-amber-800 leading-relaxed">
                All goods are inspected by the rider before pickup to meet Zana
                security compliance.
              </p>
            </div>

            {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

            <button
              onClick={handleOrder}
              disabled={ordering || walletShort || cart.length === 0}
              className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl mt-4 disabled:opacity-40 flex items-center justify-center gap-2 text-base"
            >
              {ordering
                ? <Loader2 size={16} className="animate-spin" />
                : `Pay & Order · ${grandTotal.toLocaleString()} RWF`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
