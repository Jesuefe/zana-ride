'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Plus, Minus, MapPin, Loader2 } from 'lucide-react';
import { fetchMarketplace, MarketplaceMerchant, MarketplaceProduct, createOrder } from '../../lib/api/trips';
import { ApiError } from '../../lib/api/client';
import { getStoredPickup } from '../../lib/location';

type CartItem = { product: MarketplaceProduct; quantity: number; merchantId: string };

export default function FoodPage() {
  const router = useRouter();
  const [merchants, setMerchants] = useState<MarketplaceMerchant[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState('');
  const [showCart, setShowCart] = useState(false);
  const pickup = getStoredPickup();

  useEffect(() => {
    fetchMarketplace('FOOD').then(m => { setMerchants(m); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const addToCart = (product: MarketplaceProduct, merchantId: string) => {
    // One merchant at a time — clear cart if switching merchants.
    const existing = cart[0];
    if (existing && existing.merchantId !== merchantId) {
      if (!confirm('Your cart has items from another restaurant. Start a new cart?')) return;
      setCart([{ product, quantity: 1, merchantId }]);
      return;
    }
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id);
      if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, merchantId }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0));
  };

  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const handleOrder = async () => {
    if (!cart.length) return;
    setOrdering(true);
    setError('');
    try {
      const order = await createOrder({
        merchantId: cart[0].merchantId,
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        dropoffLat: pickup.lat,
        dropoffLng: pickup.lng,
        dropoffAddress: 'Current location',
      });
      router.push(`/orders?highlight=${order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place the order.');
    } finally {
      setOrdering(false);
    }
  };

  const getQty = (productId: string) => cart.find(i => i.product.id === productId)?.quantity ?? 0;

  return (
    <div className="animate-fade-in pb-24">
      <div className="sticky top-0 bg-white z-10 px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Food & Drinks</h1>
          </div>
          {cartCount > 0 && (
            <button onClick={() => setShowCart(true)} className="flex items-center gap-2 bg-zana-primary text-white px-3 py-1.5 rounded-full text-xs font-semibold">
              <ShoppingCart size={14} />
              {cartCount} · {cartTotal.toLocaleString()} RWF
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {loading && <p className="text-center text-zana-muted text-sm py-10">Loading restaurants…</p>}
        {!loading && merchants.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-zana-muted">No food merchants available yet.</p>
            <p className="text-xs text-zana-muted mt-1">Check back soon!</p>
          </div>
        )}
        {merchants.map(m => (
          <div key={m.id} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-zana-primary-light flex items-center justify-center text-lg">🍽️</div>
              <div>
                <p className="font-semibold text-gray-900">{m.businessName}</p>
                {m.branch && <p className="text-xs text-zana-muted">{m.branch}</p>}
              </div>
            </div>
            <div className="space-y-2">
              {m.products.map(p => (
                <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                    : <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-2xl">🍱</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{p.name}</p>
                    {p.description && <p className="text-xs text-zana-muted mt-0.5 line-clamp-2">{p.description}</p>}
                    <p className="text-sm font-bold text-zana-primary mt-1">{p.price.toLocaleString()} RWF</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getQty(p.id) > 0 ? (
                      <>
                        <button onClick={() => removeFromCart(p.id)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><Minus size={13} /></button>
                        <span className="text-sm font-semibold w-4 text-center">{getQty(p.id)}</span>
                        <button onClick={() => addToCart(p, m.id)} className="w-7 h-7 rounded-full bg-zana-primary text-white flex items-center justify-center"><Plus size={13} /></button>
                      </>
                    ) : (
                      <button onClick={() => addToCart(p, m.id)} className="w-8 h-8 rounded-full bg-zana-primary-light text-zana-primary flex items-center justify-center"><Plus size={16} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showCart && cart.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          <div className="relative w-full bg-white rounded-t-2xl p-5 animate-fade-slide-up">
            <h2 className="font-bold text-lg text-gray-900 mb-4">Your Order</h2>
            <div className="space-y-2 mb-4">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">{item.product.name} × {item.quantity}</span>
                  <span className="text-sm font-semibold">{(item.product.price * item.quantity).toLocaleString()} RWF</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-zana-primary">{cartTotal.toLocaleString()} RWF</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-4">
              <MapPin size={14} className="text-zana-primary shrink-0" />
              <p className="text-xs text-gray-700">Delivered to your current location</p>
            </div>
            {error && <p className="text-xs text-zana-error mb-3">{error}</p>}
            <button onClick={handleOrder} disabled={ordering} className="w-full bg-zana-primary text-white font-semibold py-3.5 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              {ordering ? <><Loader2 size={16} className="animate-spin" /> Placing order…</> : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
