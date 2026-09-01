'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, AlertTriangle, Phone, MapPin, User, Clock, LogOut, RefreshCw } from 'lucide-react';
import { api, getToken, clearToken, setToken } from '../../lib/api/client';

type SafetyReport = {
  id: string;
  tripId?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  driverName?: string;
  driverPhone?: string;
  pickupAddress?: string;
  destinationAddress?: string;
  reportedAt: string;
  status: 'OPEN' | 'REVIEWING' | 'RESOLVED';
  lat?: number;
  lng?: number;
};

type ActiveTrip = {
  id: string;
  customerName: string;
  driverName: string;
  pickupAddress: string;
  destinationAddress: string;
  status: string;
  estimatedFare: number;
  requestedAt: string;
};

export default function SafetyDashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [logging, setLogging] = useState(false);
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    const token = getToken();
    if (token) setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [authed]);

  const loadData = async () => {
    setLoading(true);
    try {
      const trips = await api.get<any[]>('/admin/trips?status=active&limit=50');
      setActiveTrips(trips.map((t: any) => ({
        id: t.id,
        customerName: `${t.customer?.firstName ?? ''} ${t.customer?.lastName ?? ''}`.trim(),
        driverName: `${t.driver?.user?.firstName ?? ''} ${t.driver?.user?.lastName ?? ''}`.trim(),
        pickupAddress: t.pickupAddress,
        destinationAddress: t.destinationAddress,
        status: t.status,
        estimatedFare: t.estimatedFare,
        requestedAt: t.requestedAt,
      })));
      setLastRefresh(new Date());
    } catch {
      // token may have expired
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLogging(true);
    setLoginError('');
    try {
      const res = await api.post<{ token: string; user: any }>('/auth/login', {
        identifier: email,
        password,
      });
      if (res.user.role !== 'ADMIN') {
        setLoginError('Only admin accounts can access the safety dashboard.');
        return;
      }
      setToken(res.token);
      setAuthed(true);
    } catch {
      setLoginError('Invalid email or password.');
    } finally {
      setLogging(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setAuthed(false);
  };

  const statusColor = (s: string) => {
    if (s.includes('PROGRESS')) return 'bg-green-100 text-green-700';
    if (s.includes('ARRIVED')) return 'bg-blue-100 text-blue-700';
    if (s.includes('ASSIGNED')) return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-600';
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-lg">Zana Safety</p>
              <p className="text-xs text-gray-400">Emergency Response Dashboard</p>
            </div>
          </div>
          <div className="bg-gray-800 rounded-2xl p-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1.5">Admin Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="admin@zana.rw"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="••••••••"
                />
              </div>
            </div>
            {loginError && <p className="text-xs text-red-400 mt-3">{loginError}</p>}
            <button
              onClick={handleLogin}
              disabled={logging}
              className="w-full mt-5 bg-red-600 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-40"
            >
              {logging ? 'Signing in…' : 'Access Safety Dashboard'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">Zana Safety Dashboard</p>
            <p className="text-[10px] text-gray-400">
              {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Loading…'}
              {loading && ' · Refreshing…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
            <RefreshCw size={14} className={loading ? 'animate-spin text-green-400' : 'text-gray-400'} />
          </button>
          <button onClick={handleLogout} className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
            <LogOut size={14} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 p-4">
        <div className="bg-gray-900 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{activeTrips.length}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Active rides</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">
            {activeTrips.filter(t => t.status === 'DRIVER_ASSIGNED' || t.status === 'DRIVER_EN_ROUTE').length}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">En route</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">
            {activeTrips.filter(t => t.status === 'RIDE_IN_PROGRESS').length}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">In progress</p>
        </div>
      </div>

      {/* Live trips */}
      <div className="px-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Live Trips</p>
        <div className="space-y-2">
          {activeTrips.length === 0 && (
            <div className="text-center py-10">
              <Shield size={32} className="text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No active trips right now</p>
            </div>
          )}
          {activeTrips.map(t => (
            <div key={t.id} className="bg-gray-900 rounded-xl p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <User size={12} className="text-gray-500" />
                    <span className="text-sm font-semibold">{t.customerName || 'Customer'}</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-sm text-gray-300">{t.driverName || 'Driver'}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5 font-mono">{t.id.slice(0, 8)}…</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor(t.status)}`}>
                  {t.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5">
                  <MapPin size={10} className="text-zana-primary mt-0.5 shrink-0" />
                  <p className="text-[11px] text-gray-400 truncate">{t.pickupAddress}</p>
                </div>
                <div className="flex items-start gap-1.5">
                  <MapPin size={10} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-gray-400 truncate">{t.destinationAddress}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-gray-600 flex items-center gap-1">
                  <Clock size={9} /> {new Date(t.requestedAt).toLocaleTimeString()}
                </span>
                <span className="text-xs font-semibold text-zana-primary">{t.estimatedFare.toLocaleString()} RWF</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-8" />

      {/* Emergency contact */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-3">
        <a
          href="tel:112"
          className="flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-3 rounded-xl text-sm"
        >
          <Phone size={16} /> Emergency Line — 112
        </a>
      </div>
    </div>
  );
}
