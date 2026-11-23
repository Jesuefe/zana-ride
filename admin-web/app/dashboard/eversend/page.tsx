'use client';

import AdminShell from '../../../components/AdminShell';
import EversendPaymentSettings from '../../../components/EversendPaymentSettings';

export default function EversendSetupPage() {
  return (
    <AdminShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#00866f]">Founder controls · Payments</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Eversend integration</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Configure and verify Zana’s Eversend API credentials in one dedicated workspace.
            Credential verification does not activate live payments; Paypack remains active until a separate payment activation release.
          </p>
        </div>
        <EversendPaymentSettings />
      </div>
    </AdminShell>
  );
}
