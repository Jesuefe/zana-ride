'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ShoppingCart, Plus, Minus, MapPin, Loader2, Store, Package, Search, Star, Clock3, Tag } from 'lucide-react';
import { fetchMarketplaceWithLocation, placeOrder, validateOrderPromo, MarketplaceMerchant, MarketplaceProduct, CartItem } from '../../../lib/api/marketplace';
import { getStoredPickup } from '../../../lib/location';
import OrderRecipient, { OrderRecipient as OrderRecipientValue } from '../../../components/OrderRecipient';
import { useLang } from '../../../lib/LangContext';
import ZanaLoading from '../../../components/ZanaLoading';

function StoreContent() {
  const { t } = useLang();
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
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoMessage, setPromoMessage] = useState('');
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [selectedPromotionId, setSelectedPromotionId] = useState<string | null>(null);
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

  const rawCartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const selectedPromotion = merchant?.promotions?.find(p => p.id === selectedPromotionId);
  const promotionValid = !!selectedPromotion && selectedPromotion.items.every(item => cart.some(i => i.product.id === item.product.id && i.quantity === 1));
  const promoSavings = promotionValid && selectedPromotion ? Math.max(0, selectedPromotion.items.reduce((sum, item) => sum + item.product.price, 0) - selectedPromotion.comboPrice) : 0;
  const cartTotal = rawCartTotal - promoSavings;
  const deliveryFee = merchant?.deliveryFee ?? 0;
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const grandTotal = Math.max(0, cartTotal + deliveryFee - promoDiscount);
  const walletShort = paymentMethod === 'WALLET' && walletBalance !== null && walletBalance < grandTotal;
  const applyOrderPromo = async () => {
    if (!merchant || !promoCode.trim()) { setPromoMessage(t('Enter a promo code first.')); return; }
    setValidatingPromo(true); setPromoMessage(''); setPromoDiscount(0);
    try {
      const result = await validateOrderPromo(promoCode.trim(), merchant.id, cartTotal, deliveryFee);
      setPromoDiscount(result.discountAmount);
      setPromoMessage(t('Promo applied. You save {{amount}} RWF.').replace('{{amount}}', result.discountAmount.toLocaleString()));
    } catch (e: any) { setPromoMessage(e?.message || t('This promo code is not valid for this order.')); }
    finally { setValidatingPromo(false); }
  };

  const addToCart = (product: MarketplaceProduct) => {
    setPromoDiscount(0); setPromoMessage('');
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id);
      if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, merchantId: merchant!.id }];
    });
  };

  const addComboToCart = (promotion: NonNullable<MarketplaceMerchant['promotions']>[number]) => {
    setPromoDiscount(0); setPromoMessage('');
    setCart(current => {
      const next = [...current];
      for (const item of promotion.items) {
        const index = next.findIndex(i => i.product.id === item.product.id);
        if (index >= 0) next[index] = { ...next[index], quantity: 1 };
        else next.push({ product: item.product, quantity: 1, merchantId: merchant!.id });
      }
      return next;
    });
    setSelectedPromotionId(promotion.id);
    setShowCart(true);
  };

  const removeFromCart = (productId: string) => {
    setPromoDiscount(0); setPromoMessage('');
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0));
  };

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
      setError(t('Add the recipient name, phone number and delivery address.'));
      setShowCart(true);
      return;
    }
    setOrdering(true);
    setError('');
    try {
      const order = await placeOrder({
        merchantId: merchant.id,
        promotionId: promotionValid ? selectedPromotionId ?? undefined : undefined,
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        dropoffLat: recipient.lat,
        dropoffLng: recipient.lng,
        dropoffAddress: recipient.address || 'Current location',
        paymentMethod,
        promoCode: promoDiscount > 0 ? promoCode.trim() : undefined,
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
        setError(t('Not enough in your wallet. Balance {{balance}} RWF, order costs {{cost}} RWF. Top up or pay with Mobile Money.').replace('{{balance}}', bal.toLocaleString()).replace('{{cost}}', need.toLocaleString()));
      } else if (msg.includes('MOMO_CHARGE_FAILED')) {
        setError(t('Could not reach Mobile Money. Check the number and try again.'));
      } else {
        setError(msg || t('Could not place order.'));
      }
    } finally { setOrdering(false); }
  };

  if (loading) {
    return (
      <ZanaLoading label={t('Loading store')} />
    );
  }

  if (!merchant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <Store size={40} className="text-gray-200 mb-3" />
        <p className="text-sm text-gray-500">{t("This store isn't available right now.")}</p>
        <button onClick={() => router.back()} className="mt-4 text-sm font-bold text-zana-primary">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="zana-page-enter zana-store-page pb-24 min-h-screen bg-gray-50">
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
              className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[448px] z-40 flex items-center justify-center gap-2 bg-zana-primary text-white px-4 py-3.5 rounded-2xl text-sm font-black shadow-lg"
            >
              <ShoppingCart size={16} />
              View cart · {cartCount} {t(cartCount === 1 ? 'item' : 'items')} · {cartTotal.toLocaleString()} RWF
            </button>
          )}
        </div>

        <div className="p-4">
          <p className="font-black text-xl text-gray-900">{merchant.businessName}</p>
          {merchant.branch && <p className="text-sm text-gray-400">{merchant.branch}</p>}
          {category === 'FOOD' && (
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              {typeof merchant.averageRating === 'number' ? (
                <>
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <strong className="text-gray-900">{merchant.averageRating.toFixed(1)}</strong>
                  <span className="text-gray-400">({merchant.reviewCount ?? 0} {t('reviews')})</span>
                </>
              ) : (
                <span className="font-semibold text-gray-400">{t('New restaurant — be the first to review')}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2.5 mt-2 text-[11px] flex-wrap">
            <span className="flex items-center gap-1 text-gray-500">
              <MapPin size={10} /> {merchant.distanceText}
            </span>
            <span className="text-gray-300">·</span>
            <span className="font-bold text-zana-primary">
              {t('Delivery from')} {merchant.deliveryFee.toLocaleString()} RWF
            </span>
          </div>
          <div className="mt-3 rounded-xl bg-zana-primary-light px-3 py-3">
            <p className="text-xs font-extrabold text-zana-primary">{t('Estimated arrival')} · {merchant.etaMinutes ?? (merchant.prepMinutes + merchant.deliveryMinutes)} min</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-600">
              <span className="flex items-center gap-1"><Clock3 size={11} />{t('Preparation')} <strong className="text-gray-900">{merchant.prepMinutes} min</strong></span>
              <span>·</span>
              <span>{t('Delivery')} <strong className="text-gray-900">{merchant.deliveryMinutes} min</strong></span>
            </div>
            {merchant.prepTimeSource === 'RECENT_ORDER_HISTORY' && (
              <p className="mt-1.5 text-[10px] text-gray-500">{t('Preparation estimate based on recent completed orders')} ({merchant.prepSampleCount ?? 0})</p>
            )}
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
            placeholder={`${t('Search')} ${merchant.businessName}`}
            className="flex-1 text-sm outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      {merchant.promotions && merchant.promotions.length > 0 && (
        <section className="px-4 mb-5">
          <div className="mb-3 flex items-center gap-2"><Tag size={17} className="text-zana-primary"/><h2 className="text-base font-black text-gray-900">Combo promotions</h2></div>
          <div className="space-y-3">
            {merchant.promotions.map(p => (
              <div key={p.id} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><p className="font-black text-gray-900">{p.title}</p><p className="mt-1 text-xs text-gray-500">{p.items.map(i=>i.product.name).join(' + ')}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">COMBO DEAL</span></div>
                <div className="mt-3 flex items-center justify-between gap-3"><div><p className="text-lg font-black text-zana-primary">{p.comboPrice.toLocaleString()} RWF</p><p className="text-[10px] text-gray-400">Normal price {p.items.reduce((sum,i)=>sum+i.product.price,0).toLocaleString()} RWF</p></div><button onClick={()=>addComboToCart(p)} className="rounded-xl bg-zana-primary px-4 py-2.5 text-xs font-bold text-white">Add combo</button></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Products, grouped by category */}
      <div className="px-4 space-y-5">
        {groupedProducts.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-10">
            {search ? t('No items match your search.') : t('Nothing listed here yet.')}
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
              <div><p className="font-black text-lg text-gray-900">{t('Your basket')}</p><p className="text-xs text-gray-400">{merchant.businessName}</p></div>
              <button type="button" onClick={() => setShowCart(false)} className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 text-lg">×</button>
            </div>

            <OrderRecipient value={recipient} onChange={setRecipient} defaultAddress={pickup.address ?? t('Current location')} defaultLat={pickup.lat} defaultLng={pickup.lng} />

            <div className="space-y-2 my-4">
              {cart.map(i => (
                <div key={i.product.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{i.product.name}</p>
                    <p className="text-xs text-gray-400">{(i.product.price * i.quantity).toLocaleString()} RWF</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => removeFromCart(i.product.id)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <Minus size={14} />
                    </button>
                    <span className="w-5 text-center text-sm font-bold">{i.quantity}</span>
                    <button type="button" onClick={() => addToCart(i.product)} className="w-8 h-8 rounded-full bg-zana-primary flex items-center justify-center">
                      <Plus size={14} className="text-white" />
                    </button>
                  </div>
                </div>
              ))}
              {promoSavings > 0 && <div className="flex justify-between text-xs font-bold text-emerald-700"><span>Combo promotion savings</span><span>−{promoSavings.toLocaleString()} RWF</span></div>}
              {selectedPromotionId && !promotionValid && <p className="text-[11px] text-amber-700">Add every combo item once to keep this promotion applied.</p>}
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                <span className="text-gray-600">{t("Delivery")}</span>
                <span className="font-semibold">{deliveryFee.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="font-black text-gray-900">{t('Total')}</span>
                <span className="font-black text-zana-primary text-lg">
                  {grandTotal.toLocaleString()} RWF
                </span>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-gray-200 px-3 py-3">
              <label htmlFor="store-promo-code" className="mb-1.5 block text-xs font-bold text-gray-600">{t('Promo code')}</label>
              <div className="flex gap-2"><input id="store-promo-code" value={promoCode} onChange={e => { setPromoCode(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 32)); setPromoDiscount(0); setPromoMessage(''); }} placeholder={t('Enter promo code (optional)')} autoCapitalize="characters" className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-gray-900 outline-none focus:border-zana-primary" /><button type="button" onClick={applyOrderPromo} disabled={validatingPromo || !cart.length || !promoCode.trim()} className="rounded-lg bg-zana-primary px-4 py-2 text-xs font-black text-white disabled:opacity-50">{validatingPromo ? '...' : t('Apply')}</button></div>
              {promoMessage && <p className={`mt-2 text-xs font-semibold ${promoDiscount > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{promoMessage}</p>}
              {promoDiscount > 0 && <p className="mt-2 flex justify-between text-xs"><span className="text-gray-500">{t('Promo discount')}</span><strong className="text-emerald-700">−{promoDiscount.toLocaleString()} RWF</strong></p>}
            </div>

            <p className="text-xs font-bold text-gray-500 uppercase mb-2">{t("Payment")}</p>
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
                {t('Wallet balance:')} {walletBalance.toLocaleString()} RWF
                {walletShort ? ` · ${(grandTotal - walletBalance).toLocaleString()} RWF short` : ''}
              </p>
            )}

            <p className="text-[10px] text-gray-400 mt-1.5">
              {t('Cash not accepted. Payment is processed before delivery.')}
            </p>

            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mt-3">
              <span className="text-amber-500 text-sm shrink-0">🛡️</span>
              <p className="text-[10px] text-amber-800 leading-relaxed">
                {t('All goods are inspected by the rider before pickup to meet Zana security compliance.')}
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
                : `${t('Pay & Order')} · ${grandTotal.toLocaleString()} RWF`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StorePage() {
  return (
    <Suspense fallback={<ZanaLoading label="Loading your ZANA experience" />}>
      <StoreContent />
    </Suspense>
  );
}
