'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Clock, Upload, FileText, Bike, CarFront, Plus, X, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api/client';
import { capturePhoto } from '../../lib/photoCapture';
import { useLang } from '../../lib/LangContext';

type Doc = {
  id?: string;
  label: string;
  fileUrl: string | null;
  verified: boolean;
  status: 'MISSING' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  reviewStatus?: string;
  expiresAt?: string | null;
};
type Vehicle = { id: string; vehicleType: 'MOTORCYCLE' | 'CAR'; make?: string | null; model?: string | null; plate: string; documents?: Doc[] };

const STATUS: Record<string, any> = {
  VERIFIED: { label: 'Verified', cls: 'bg-green-50 text-green-700', icon: Check },
  PENDING: { label: 'Under review', cls: 'bg-amber-50 text-amber-700', icon: Clock },
  REJECTED: { label: 'Correction required', cls: 'bg-red-50 text-red-700', icon: X },
  EXPIRED: { label: 'Expired - replace', cls: 'bg-red-50 text-red-700', icon: Clock },
  MISSING: { label: 'Not uploaded', cls: 'bg-gray-100 text-gray-500', icon: Upload },
};

const VEHICLE_PHOTOS: Record<string, string[]> = {
  MOTORCYCLE: ['Vehicle registration', 'Insurance certificate', 'Vehicle photo - front', 'Vehicle photo - rear / plate', 'Vehicle photo - left side', 'Vehicle photo - right side'],
  CAR: ['Vehicle registration', 'Insurance certificate', 'Vehicle photo - front', 'Vehicle photo - rear / plate', 'Vehicle photo - left side', 'Vehicle photo - right side', 'Vehicle photo - interior', 'Vehicle photo - dashboard'],
};
const EXPIRY_DOCUMENTS = ['Driving licence', 'Insurance certificate'];

export default function Documents() {
  const router = useRouter();
  const { dt } = useLang();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, string>>({});
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicleType, setNewVehicleType] = useState<'MOTORCYCLE' | 'CAR'>('MOTORCYCLE');
  const [newVehicleMake, setNewVehicleMake] = useState('');
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newVehicleOwnership, setNewVehicleOwnership] = useState('SELF');
  const [addingVehicle, setAddingVehicle] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [docResponse, existingVehicles] = await Promise.all([
        api.get<{ documents: Doc[] }>('/driver/documents'),
        api.get<Vehicle[]>('/driver/vehicles'),
      ]);
      setDocs(docResponse?.documents ?? []);
      let registered = existingVehicles ?? [];
      // Existing driver accounts predate the separate vehicle registry.
      // Migrate their already-submitted vehicle description and plate into
      // a pending vehicle record the first time they open document review.
      if (registered.length === 0) {
        const driver = await api.get<any>('/driver/me');
        if (driver?.plate) {
          const created = await api.post<Vehicle>('/driver/vehicles', {
            vehicleType: driver.serviceType === 'BIKE' ? 'MOTORCYCLE' : 'CAR',
            plate: driver.plate,
            make: driver.vehicle || null,
          });
          registered = created ? [created] : [];
        }
      }
      setVehicles(registered);
    } catch (e: any) {
      setError(e?.message || 'Could not load your documents. Please try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pick = async (label: string, vehicleId?: string) => {
    const key = vehicleId ? vehicleId + ':' + label : label;
    setUploading(key); setNote(''); setError('');
    try {
      const captured = await capturePhoto();
      if (!captured) { setNote(dt('Upload failed. The document was not uploaded. Please try again.')); return; }
      const base64 = await new Promise<string>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
          const max = 1600;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.86));
        };
        img.onerror = reject;
        img.src = captured.base64;
      });
      const expiryKey = vehicleId ? vehicleId + ':' + label : label;
      const existingDoc = vehicleId
        ? vehicles.find(v => v.id === vehicleId)?.documents?.find(d => d.label === label)
        : docs.find(d => d.label === label);
      const expiresAt = expiryDrafts[expiryKey] || (existingDoc?.expiresAt ? new Date(existingDoc.expiresAt).toISOString().slice(0,10) : undefined);
      if (vehicleId) {
        await api.post('/driver/vehicles/' + vehicleId + '/documents', { label, imageBase64: base64, expiresAt });
      } else {
        await api.post('/driver/documents', { label, imageBase64: base64, expiresAt });
      }
      setNote(label + ' uploaded. Zana will review it.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'That upload failed. Try again on a better connection.');
    } finally { setUploading(null); }
  };

  const personalOutstanding = docs.filter(d => d.status === 'MISSING' || d.status === 'REJECTED' || d.status === 'EXPIRED').length;
  const vehicleOutstanding = vehicles.reduce((count, vehicle) => {
    const required = VEHICLE_PHOTOS[vehicle.vehicleType] || VEHICLE_PHOTOS.CAR;
    return count + required.filter(label => {
      const doc = vehicle.documents?.find(item => item.label === label && item.reviewStatus !== 'SUPERSEDED');
      return !doc || doc.reviewStatus === 'REJECTED' || !!(doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now());
    }).length;
  }, 0);
  const outstanding = personalOutstanding + vehicleOutstanding;
  const addVehicle = async () => {
    if (!newVehiclePlate.trim()) { setError('Enter the vehicle registration plate.'); return; }
    setAddingVehicle(true); setError(''); setNote('');
    try {
      await api.post('/driver/vehicles', {
        vehicleType: newVehicleType, make: newVehicleMake.trim() || null,
        plate: newVehiclePlate.trim().toUpperCase(), ownershipType: newVehicleOwnership,
      });
      setShowAddVehicle(false); setNewVehicleMake(''); setNewVehiclePlate(''); setNewVehicleOwnership('SELF');
      setNote('Vehicle added. Upload its required photographs and documents before it can be approved.');
      await load();
    } catch (e: any) { setError(e?.message || 'Could not add this vehicle.'); }
    finally { setAddingVehicle(false); }
  };

  const renderDoc = (doc: Doc, vehicleId?: string) => {
    const derivedStatus = doc.status || (doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now() ? 'EXPIRED' : doc.reviewStatus === 'REJECTED' ? 'REJECTED' : (doc.verified || doc.reviewStatus === 'VERIFIED') ? 'VERIFIED' : 'PENDING');
    const status = STATUS[derivedStatus] || STATUS.PENDING;
    const Icon = status.icon;
    const key = vehicleId ? vehicleId + ':' + doc.label : doc.label;
    return <div key={key} className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5"><FileText size={16} className="text-gray-300"/><p className="text-sm font-bold text-gray-900">{dt(doc.label)}</p></div>
        <span className={'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ' + status.cls}><Icon size={10}/>{dt(status.label)}</span>
      </div>
      {EXPIRY_DOCUMENTS.includes(doc.label) && <label className="mb-3 block"><span className="mb-1 block text-[10px] font-bold text-gray-500">{dt('Expiry date')}</span><input type="date" min={new Date().toISOString().slice(0,10)} value={expiryDrafts[key] ?? (doc.expiresAt ? new Date(doc.expiresAt).toISOString().slice(0,10) : '')} onChange={e => setExpiryDrafts(all => ({...all,[key]:e.target.value}))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs"/></label>}
      {doc.fileUrl && <a href={doc.fileUrl} target="_blank" rel="noreferrer"><img src={doc.fileUrl} alt={doc.label} className="mb-3 h-32 w-full rounded-xl border border-gray-100 object-cover"/></a>}
      <button onClick={() => pick(doc.label, vehicleId)} disabled={!!uploading} className={'w-full rounded-xl py-3 text-sm font-bold disabled:opacity-50 ' + (doc.status === 'MISSING' || doc.status === 'REJECTED' || doc.status === 'EXPIRED' ? 'bg-zana-primary text-white' : 'border-2 border-gray-100 text-gray-600')}>
        {uploading === key ? dt('Uploading…') : doc.status === 'MISSING' ? dt('Upload') : dt('Replace')}
      </button>
    </div>;
  };

  return <div className="min-h-screen bg-gray-50 pb-24">
    <div className="flex items-center gap-3 bg-white px-4 pb-4 pt-12"><button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-50"><ArrowLeft size={18} className="text-gray-700"/></button><div><h1 className="text-xl font-black text-gray-900">{dt('Driver verification')}</h1><p className="text-xs text-gray-500">{outstanding > 0 ? outstanding + ' items need attention' : 'Complete all required uploads for review'}</p></div></div>
    {note && <div className="mx-4 mt-4 rounded-xl bg-zana-primary-light px-4 py-3"><p className="text-xs text-gray-700">{note}</p></div>}
    {error && <div role="alert" className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}
    {loading ? <p className="py-12 text-center text-sm text-gray-500">{dt('Loading…')}</p> : <div className="space-y-6 px-4 pt-5">
      <section><div className="mb-3 flex items-center gap-2"><ShieldCheck size={17} className="text-zana-primary"/><div><h2 className="text-sm font-black text-gray-900">Personal identity documents</h2><p className="text-[11px] text-gray-500">Upload clear, current documents belonging to you.</p></div></div><div className="space-y-2">{docs.map(d => renderDoc(d))}</div></section>
      <section><div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="text-sm font-black text-gray-900">Vehicle documents & photographs</h2><p className="mt-1 text-[11px] leading-relaxed text-gray-500">Upload the vehicle registration and current insurance certificate, then take clear photographs of every required angle.</p></div><button onClick={() => setShowAddVehicle(v => !v)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zana-border bg-white px-3 py-2 text-[10px] font-bold text-zana-primary"><Plus size={13}/> Add vehicle</button></div>
        {showAddVehicle && <div className="mb-4 space-y-3 rounded-2xl border border-zana-border bg-white p-4"><p className="text-xs font-extrabold text-gray-900">Register another vehicle</p><div className="grid grid-cols-2 gap-2"><select value={newVehicleType} onChange={e => setNewVehicleType(e.target.value as 'MOTORCYCLE'|'CAR')} className="rounded-lg border border-zana-border bg-white px-3 py-2.5 text-xs"><option value="MOTORCYCLE">Motorcycle</option><option value="CAR">Car</option></select><select value={newVehicleOwnership} onChange={e => setNewVehicleOwnership(e.target.value)} className="rounded-lg border border-zana-border bg-white px-3 py-2.5 text-xs"><option value="SELF">My vehicle</option><option value="RENTED">Rented</option><option value="COMPANY">Company vehicle</option><option value="AUTHORIZED">Authorized owner</option></select></div><input value={newVehicleMake} onChange={e => setNewVehicleMake(e.target.value)} placeholder="Make / model / colour" className="w-full rounded-lg border border-zana-border px-3 py-2.5 text-sm"/><input value={newVehiclePlate} onChange={e => setNewVehiclePlate(e.target.value.toUpperCase())} placeholder="Registration plate" className="w-full rounded-lg border border-zana-border px-3 py-2.5 text-sm"/><div className="flex gap-2"><button disabled={addingVehicle} onClick={addVehicle} className="rounded-lg bg-zana-primary px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{addingVehicle ? 'Adding…' : 'Save vehicle'}</button><button onClick={() => setShowAddVehicle(false)} className="rounded-lg border border-zana-border px-4 py-2.5 text-xs font-bold text-gray-600">Cancel</button></div></div>}
        {vehicles.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-center text-xs text-gray-500">Your vehicle record could not be created. Contact Zana support.</div> : vehicles.map(vehicle => {
          const labels = VEHICLE_PHOTOS[vehicle.vehicleType] || VEHICLE_PHOTOS.CAR;
          const current = vehicle.documents || [];
          const byLabel = new Map<string, Doc>();
          current.filter(d => d.reviewStatus !== 'SUPERSEDED').sort((a: any,b: any) => new Date(b.createdAt || 0).getTime()-new Date(a.createdAt || 0).getTime()).forEach((d: any) => { if (!byLabel.has(d.label)) byLabel.set(d.label,d); });
          return <div key={vehicle.id} className="mb-4 rounded-2xl border border-gray-200 bg-gray-100/70 p-3">
            <div className="mb-3 flex items-center gap-2">{vehicle.vehicleType === 'MOTORCYCLE' ? <Bike size={17} className="text-zana-primary"/> : <CarFront size={17} className="text-zana-primary"/>}<div><p className="text-sm font-extrabold text-gray-900">{vehicle.vehicleType === 'MOTORCYCLE' ? 'Motorcycle' : 'Car'} · {vehicle.plate}</p><p className="text-[10px] text-gray-500">{vehicle.make || vehicle.model || 'Vehicle record'}</p></div></div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{labels.map(label => renderDoc(byLabel.get(label) || { label, fileUrl: null, verified: false, status: 'MISSING' }, vehicle.id))}</div>
          </div>;
        })}
      </section>
    </div>}
    <div className="px-4 pt-5"><p className="text-[11px] leading-relaxed text-gray-400">Your documents and vehicle photographs are visible only to authorized Zana reviewers. Replacing a submission creates a new version and requires another review. Submitting documents does not automatically approve or activate your driver account.</p></div>
  </div>;
}
