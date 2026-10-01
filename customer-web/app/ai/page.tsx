'use client';

import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ExternalLink, ShoppingCart, Sparkles, X } from 'lucide-react';
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
  const [locationError, setLocationError] = useState<string>('');
  const endRef = useRef<HTMLDivElement>(null);

  async function getCurrentLocation() {
    if (!navigator.geolocation) throw new Error('Location is not supported on this device.');
    return await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        p => {
          const value = { lat: p.coords.latitude, lng: p.coords.longitude };
          setCoords(value);
          setLocationError('');
          resolve(value);
        },
        error => {
          const message = error.code === error.PERMISSION_DENIED
            ? 'Please allow Zana to use your location so I can quote the ride from your current position.'
            : 'I could not get your current location. Please try again.';
          setLocationError(message);
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  }

  useEffect(() => {
    getCurrentLocation().catch(() => undefined);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, action]);

  function formatInline(text: string): ReactNode[] {
    return text.split(/(\\*\\*[^*]+\\*\\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>,
    );
  }

  function renderAiText(text: string) {
    const lines = text.split('\\n');
    const out: ReactNode[] = [];
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line) { out.push(<div key={i} className="h-1" />); return; }
      if (/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(line)) return;
      if (line.includes('|')) {
        const cells = line.replace(/^\\||\\|$/g, '').split('|').map(x => x.trim()).filter(Boolean);
        out.push(<div key={i} className="my-1 rounded-xl bg-white border border-gray-100 px-3 py-2 text-xs">{cells.map((cell, j) => <span key={j}>{j > 0 && <span className="mx-1 text-gray-300">·</span>}{formatInline(cell)}</span>)}</div>);
        return;
      }
      const bullet = line.match(/^[-*]\\s+(.*)$/);
      const heading = line.replace(/^#{1,3}\\s+/, '');
      out.push(<div key={i} className={line.startsWith('#') ? 'font-black text-gray-900 mt-1' : bullet ? 'flex gap-2' : ''}>{bullet && <span>•</span>}{formatInline(bullet ? bullet[1] : heading)}</div>);
    });
    return out;
  }

  async function send(e?: FormEvent, overrideText?: string) {
    e?.preventDefault();
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    const next = [...messages, { id: Date.now(), role: 'user' as const, text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const rideIntent = /\\b(ride|moto|motorcycle|bike|car|taxi|pick me up|take me|go to|drop me)\\b/i.test(text) ||
        /\\b(current location|current position|where i am|from here|pick me up)\\b/i.test(next.map(m => m.text).join(' '));
      let liveCoords = coords;
      if (rideIntent && !liveCoords) {
        liveCoords = await getCurrentLocation();
      }
      const result = await sendZanaAiMessage({
        message: text,
        history: next.slice(-12).map(m => ({ role: m.role, text: m.text })),
        location: liveCoords,
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
              {renderAiText(message.text)}
            </div>
          </div>
        ))}

        {locationError && <div className="rounded-2xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">{locationError}</div>}\n\n        {loading && <div className="bg-gray-50 border border-gray-100 rounded-3xl rounded-bl-md px-4 py-3 w-fit text-sm text-gray-400">Zana is checking...</div>}

        {action?.type === 'RIDE_QUOTE' && (
          <div className="rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="p-4 bg-[#F6FBF9] border-b border-[#E2F2ED]">
              <p className="font-black text-gray-900">{action.serviceType === 'CAR' ? 'Car' : 'Moto'} ride</p>
              <p className="text-xs text-gray-500 mt-1">{action.destinationAddress}</p>
              {action.mapsUrl && (
                <a href={action.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-[#00A082]">
                  <ExternalLink size={13} /> View destination on Maps
                </a>
              )}
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Distance</span><span className="font-bold">{action.distanceKm} km</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Estimated time</span><span className="font-bold">{action.durationMinutes} min</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Estimated fare</span><span className="font-black">{money(action.fare ?? 0)}</span></div>
              <button onClick={() => send(undefined, 'Confirm the ride')} disabled={loading} className="w-full mt-3 rounded-2xl bg-[#00A082] text-white py-4 font-black disabled:opacity-60">CONFIRM RIDE · {money(action.fare ?? 0)}</button>
            </div>
          </div>
        )}

        {action?.type === 'RIDE_BOOKED' && (
          <div className="rounded-3xl border border-gray-100 bg-white shadow-sm p-4">
            <p className="font-black text-gray-900">Ride requested</p>
            <p className="text-sm text-gray-500 mt-1">{action.status === 'DRIVER_ASSIGNED' ? 'A driver has been assigned.' : action.status === 'NO_DRIVER_FOUND' ? 'No driver is available right now.' : 'Searching for a driver.'}</p>
            <p className="text-sm font-black mt-2">{money(action.fare ?? 0)}</p>
          </div>
        )}

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
