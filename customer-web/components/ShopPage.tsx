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
    if (existing && existing.merchantId !== merchantId) {
      setCart([{ product, quantity: 1, merchantId }]);
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

        {merchants.map(m => (
          <div key={m.id} className="mb-6">
            {/* Merchant header */}
            <div className="flex items-center gap-3 mb-3 bg-white rounded-2xl px-4 py-3 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-zana-primary-light flex items-center justify-center shrink-0">
                <Store size={20} className="text-zana-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{m.businessName}</p>
                {m.branch && <p className="text-xs text-gray-400">{m.branch}</p>}
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <MapPin size={9} /> {m.distanceText} away
                  </span>
                  <span className="text-[11px] font-semibold text-zana-primary">
                    Delivery: {m.deliveryFee.toLocaleString()} RWF
                  </span>
                </div>
              </div>
            </div>

            {/* Products */}
            <div className="space-y-2 pl-1">
              {m.products.map(p => (
                <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                      <Package size={24} className="text-gray-300" />
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
                    {getQty(p.id) > 0 ? (
                      <>
                        <button onClick={() => removeFromCart(p.id)}
                          className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                          <Minus size={13} />
                        </button>
                        <span className="text-sm font-bold w-4 text-center">{getQty(p.id)}</span>
                        <button onClick={() => addToCart(p, m.id)}
                          className="w-7 h-7 rounded-full bg-zana-primary text-white flex items-center justify-center">
                          <Plus size={13} />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => addToCart(p, m.id)}
                        className="w-8 h-8 rounded-full bg-zana-primary-light flex items-center justify-center">
                        <Plus size={16} className="text-zana-primary" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cart sheet */}
      {showCart && cart.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          <div className="relative w-full bg-white rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h2 className="font-black text-lg text-gray-900 mb-1">Your Order</h2>
            {merchantForCart && (
              <p className="text-xs text-gray-400 mb-4">{merchantForCart.businessName}</p>
            )}

            {/* Items */}
            <div className="space-y-2 mb-4">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{item.product.name}</span>
                    <span className="text-xs text-gray-400">× {item.quantity}</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {(item.product.price * item.quantity).toLocaleString()} RWF
                  </span>
                </div>
              ))}
            </div>

            {/* Fee breakdown */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{cartTotal.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between text-sm">
                <div>
                  <span className="text-gray-600">Delivery fee</span>
                  {merchantForCart && (
                    <p className="text-[10px] text-gray-400">{merchantForCart.distanceText} from you</p>
                  )}
                </div>
                <span className="font-semibold">{deliveryFee.toLocaleString()} RWF</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="font-black text-gray-900">Total</span>
                <span className="font-black text-zana-primary text-lg">{grandTotal.toLocaleString()} RWF</span>
              </div>
            </div>

            {/* Delivery address */}
            <div className="flex items-center gap-2 bg-zana-primary-light rounded-xl px-3 py-2.5 mb-4">
              <MapPin size={14} className="text-zana-primary shrink-0" />
              <p className="text-xs text-gray-700">Delivered to your current location</p>
            </div>

            {/* Payment — online only */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">Payment — online only</p>
              <div className="grid grid-cols-2 gap-2">
                {([['WALLET', 'Zana Wallet'], ['MOBILE_MONEY', 'Mobile Money']] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setPaymentMethod(id)}
                    className={`py-3 rounded-xl border-2 text-xs font-bold transition-colors ${
                      paymentMethod === id
                        ? 'border-zana-primary bg-zana-primary text-white'
                        : 'border-gray-100 text-gray-600 bg-white'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
              {paymentMethod === 'WALLET' && walletBalance !== null && (
                <p className={`text-[11px] mt-1.5 font-semibold ${walletShort ? 'text-red-500' : 'text-gray-500'}`}>
                  Wallet balance: {walletBalance.toLocaleString()} RWF
                  {walletShort ? ` · ${(grandTotal - walletBalance).toLocaleString()} RWF short` : ''}
                </p>
              )}
              <p className="text-[10px] text-gray-400 mt-1.5">
                Cash not accepted. Payment processed before delivery.
              </p>

              {/* Security compliance notice */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mt-3">
                <span className="text-amber-500 text-sm shrink-0">🛡️</span>
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  All goods are inspected by the rider before pickup to meet Zana security compliance.
                </p>
              </div>
            </div>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <button onClick={handleOrder} disabled={ordering || walletShort}
              className="w-full bg-zana-primary text-white font-black py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2 text-base">
              {ordering
                ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Placing order...</>
                : `Pay & Order · ${grandTotal.toLocaleString()} RWF`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
