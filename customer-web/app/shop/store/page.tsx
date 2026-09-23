'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Plus, Minus, MapPin, Loader2, Store, Package, Search } from 'lucide-react';
import { fetchMarketplaceWithLocation, placeOrder, MarketplaceMerchant, MarketplaceProduct, CartItem } from '../../../lib/api/marketplace';
import { getStoredPickup } from '../../../lib/location';
import OrderRecipient, { OrderRecipient as OrderRecipientValue } from '../../../components/OrderRecipient';

function StoreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const merchantId = searchParams.get('id');
  const category = (searchParams.get('category') ?? 'GOODS') as 'FOOD' | 'GIFTS' | 'GOODS';
  const pickup = getStoredPickup();

  const [merchant, setMerchant] = useState<MarketplaceMerchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'MOBILE_MONEY'>('WALLET');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [recipient, setRecipient] = useState<OrderRecipientValue>({ forSomeoneElse: false, name: '', phone: '', address: pickup.address ?? 'Current location', lat: pickup.lat, lng: pickup.lng, note: '' });

  useEffect(() => {
    import('../../../lib/api/trips').then(({ fetchWallet }) => {
      fetchWallet().then((w: any) => setWalletBalance(w.balance)).catch(() => {});
    });
  }, []);

  // No dedicated single-merchant endpoint exists yet — the list endpoint
  // already returns everything needed per merchant (including their full
  // product list), so re-fetching the category list and picking out the
  // one merchant is the simplest correct option available right now,
  // without adding a new backend endpoint for a single-page frontend
  // change. A real cost worth naming honestly: this fetches every store
  // in the category just to show one. Fine at today's scale; worth a
  // dedicated endpoint if the merchant count grows enough to matter.
  useEffect(() => {
    if (!merchantId) { setLoading(false); return; }
    fetchMarketplaceWithLocation(category, pickup.lat, pickup.lng)
      .then(list => setMerchant(list.find(m => m.id === merchantId) ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [merchantId]);

  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const deliveryFee = merchant?.deliveryFee ?? 0;
  const walletShort =
    paymentMethod === 'WALLET' && walletBalance !== null && walletBalance < (cartTotal + deliveryFee);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const grandTotal = cartTotal + deliveryFee;

  const addToCart = (product: MarketplaceProduct) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id);
      if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, merchantId: merchant!.id }];
    });
  };

  const removeFromCart = (productId: string) =>
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0));

  // Grouped by each product's own category field — the data already
  // supported this, it just was never actually rendered this way before.
  const groupedProducts = useMemo(() => {
    if (!merchant) return [];
    const filtered = search.trim()
      ? merchant.products.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()))
      : merchant.products;
    const groups = new Map<string, MarketplaceProduct[]>();
    for (const p of filtered) {
      const key = p.category || 'Other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    return Array.from(groups.entries());
  }, [merchant, search]);

  const handleOrder = async () => {
    if (!cart.length || !merchant) return;
    if (recipient.forSomeoneElse && (!recipient.name.trim() || !recipient.phone.trim() || !recipient.address.trim())) {
      setError('Add the recipient name, phone number and delivery address.');
      setShowCart(true);
      return;
    }
    setOrdering(true);
    setError('');
    try {
      const order = await placeOrder({
        merchantId: merchant.id,
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        dropoffLat: recipient.lat,
        dropoffLng: recipient.lng,
        dropoffAddress: recipient.address || 'Current location',
        paymentMethod,
        deliveryFee,
        receiverName: recipient.forSomeoneElse ? recipient.name.trim() : undefined,
        receiverPhone: recipient.forSomeoneElse ? recipient.phone.trim() : undefined,
        note: recipient.note.trim() || undefined,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-zana-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <Store size={40} className="text-gray-200 mb-3" />
        <p className="text-sm text-gray-500">This store isn't available right now.</p>
        <button onClick={() => router.back()} className="mt-4 text-sm font-bold text-zana-primary">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      {/* Store header */}
      <div className="bg-white rounded-b-3xl overflow-hidden shadow-sm mb-3">
        <div className="relative">
          {(merchant as any).coverUrl ? (
            <img src={(merchant as any).coverUrl} alt="" className="w-full h-32 object-cover" />
          ) : (
            <div className="w-full h-28 bg-zana-primary-light flex items-center justify-center">
              <Store size={28} className="text-zana-primary/40" />
            </div>
          )}
          <button
            onClick={() => router.back()}
            className="absolute top-10 left-4 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center"
          >
            <ArrowLeft size={16} />
          </button>
          {cartCount > 0 && (
            <button
              onClick={() => setShowCart(true)}
              className="absolute top-10 right-4 flex items-center gap-2 bg-zana-primary text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow"
            >
              <ShoppingCart size={14} />
              {cartCount} · {cartTotal.toLocaleString()} RWF
            </button>
          )}
        </div>

        <div className="p-4">
          <p className="font-black text-xl text-gray-900">{merchant.businessName}</p>
          {merchant.branch && <p className="text-sm text-gray-400">{merchant.branch}</p>}
          <div className="flex items-center gap-2.5 mt-2 text-[11px] flex-wrap">
            <span className="flex items-center gap-1 text-gray-500">
              <MapPin size={10} /> {merchant.distanceText}
            </span>
            <span className="text-gray-300">·</span>
            <span className="font-bold text-zana-primary">
              Delivery from {merchant.deliveryFee.toLocaleString()} RWF
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${merchant.businessName}`}
            className="flex-1 text-sm outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Products, grouped by category */}
      <div className="px-4 space-y-5">
        {groupedProducts.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-10">
            {search ? 'No items match your search.' : 'Nothing listed here yet.'}
          </p>
        )}

        {groupedProducts.map(([categoryName, products]) => (
          <div key={categoryName}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{categoryName}</p>
            <div className="space-y-2">
              {products.map(p => {
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
                            onClick={() => addToCart(p)}
                            className="w-8 h-8 rounded-full bg-zana-primary flex items-center justify-center"
                          >
                            <Plus size={14} className="text-white" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => addToCart(p)}
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
        ))}
      </div>

      {/* Cart */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setShowCart(false)}>
          <div className="w-full bg-white rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            <div className="flex items-center justify-between mb-4">
              <div><p className="font-black text-lg text-gray-900">Your basket</p><p className="text-xs text-gray-400">{merchant.businessName}</p></div>
              <button type="button" onClick={() => setShowCart(false)} className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 text-lg">×</button>
            </div>

            <OrderRecipient value={recipient} onChange={setRecipient} defaultAddress={pickup.address ?? "Current location"} defaultLat={pickup.lat} defaultLng={pickup.lng} />

            <div className="space-y-1.5 my-4">

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

export default function StorePage() {
  return (
    <Suspense fallback={null}>
      <StoreContent />
    </Suspense>
  );
}
