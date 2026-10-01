'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ShoppingCart, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { executeZanaMarketDraft, sendZanaAiMessage, type ZanaAiAction } from '../../lib/api/zana-ai';

type Message = { id: number; role: 'user' | 'model'; text: string };

const money = (value: number) => `${Math.round(value).toLocaleString()} RWF`;

export default function ZanaAiPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'model', text: 'Hi, I’m Zana AI. Tell me what you need — a ride, food, market shopping, a delivery, or somewhere to go.' },
  ]);
  const [input, setInput] = useState('');
  const [action, setAction] = useState<ZanaAiAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 },
    );
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, action]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { id: Date.now(), role: 'user' as const, text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const result = await sendZanaAiMessage({
        message: text,
        history: next.slice(-12).map(m => ({ role: m.role, text: m.text })),
        location: coords,
      });
      setMessages(current => [...current, { id: Date.now() + 1, role: 'model', text: result.text }]);
      setAction(result.action);
    } catch (error: any) {
      setMessages(current => [...current, { id: Date.now() + 1, role: 'model', text: error?.message ?? 'Zana AI is unavailable right now.' }]);
    } finally {
      setLoading(false);
    }
  }

  async function orderNow() {
    if (!action?.draftId || action.missing?.length) return;
    setExecuting(true);
    try {
      const result = await executeZanaMarketDraft(action.draftId, 'WALLET');
      setAction(null);
      setMessages(current => [...current, { id: Date.now(), role: 'model', text: `Order confirmed at ${result.marketName}. Tracking code: ${result.trackingCode}.` }]);
      router.push(`/orders?orderId=${encodeURIComponent(result.orderId)}`);
    } catch (error: any) {
      setMessages(current => [...current, { id: Date.now(), role: 'model', text: error?.message ?? 'I could not place the order. Check your wallet and try again.' }]);
    } finally {
      setExecuting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white pb-28">
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center"><X size={18} /></button>
          <div className="w-10 h-10 rounded-2xl bg-[#E8F7F3] flex items-center justify-center"><Sparkles size={19} className="text-[#00A082]" /></div>
          <div><h1 className="font-black text-gray-900">Zana AI</h1><p className="text-[11px] text-gray-500">Tell Zana what you need</p></div>
        </div>
      </header>

      <section className="max-w-2xl mx-auto px-4 pt-5 space-y-3">
        {messages.map(message => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[86%] rounded-3xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-[#00A082] text-white rounded-br-md' : 'bg-gray-50 text-gray-800 rounded-bl-md border border-gray-100'}`}>
              {message.text}
            </div>
          </div>
        ))}

        {loading && <div className="bg-gray-50 border border-gray-100 rounded-3xl rounded-bl-md px-4 py-3 w-fit text-sm text-gray-400">Zana is checking...</div>}

        {action?.type === 'MARKET_DRAFT' && (
          <div className="rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="p-4 bg-[#F6FBF9] border-b border-[#E2F2ED] flex items-center gap-2">
              <ShoppingCart size={17} className="text-[#00A082]" />
              <div><p className="font-black text-gray-900">Shopping basket ready</p><p className="text-xs text-gray-500">{action.marketName}</p></div>
            </div>
            <div className="p-4 space-y-2">
              {action.items?.map(item => (
                <div key={item.productId} className="flex justify-between gap-3 text-sm"><span>{item.productName} × {item.quantity}</span><span className="font-bold">{money(item.unitPrice * item.quantity)}</span></div>
              ))}
              {action.missing?.length ? (
                <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
                  Missing here: {action.missing.join(', ')}. Another market would add another delivery fee.
                </div>
              ) : (
                <>
                  <div className="border-t border-gray-100 my-3" />
                  <div className="flex justify-between text-sm text-gray-500"><span>Shopping</span><span>{money(action.subtotal ?? 0)}</span></div>
                  <div className="flex justify-between text-sm text-gray-500"><span>Delivery</span><span>{money(action.deliveryFee ?? 0)}</span></div>
                  <div className="flex justify-between mt-2 text-base font-black"><span>Total</span><span>{money(action.total ?? 0)}</span></div>
                  <button onClick={orderNow} disabled={executing} className="w-full mt-4 rounded-2xl bg-[#00A082] text-white py-4 font-black flex items-center justify-center gap-2 disabled:opacity-60">
                    <Check size={18} />{executing ? 'Placing order...' : `ORDER NOW · ${money(action.total ?? 0)}`}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </section>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 p-3">
        <form onSubmit={send} className="max-w-2xl mx-auto flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Tell Zana what you need..." className="flex-1 bg-gray-50 border border-gray-200 rounded-3xl px-4 py-3 outline-none text-sm" />
          <button type="submit" disabled={!input.trim() || loading} className="w-12 h-12 rounded-full bg-[#00A082] text-white flex items-center justify-center disabled:opacity-40"><ArrowUp size={19} /></button>
        </form>
      </div>
    </main>
  );
}
