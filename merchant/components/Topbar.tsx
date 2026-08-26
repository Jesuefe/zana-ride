import { Bell } from 'lucide-react';

export default function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between px-8 py-5 border-b border-zana-border bg-zana-surface">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-zana-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <button className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
          <Bell size={16} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-zana-primary-light flex items-center justify-center text-sm font-semibold text-zana-primary-dark">
            OA
          </div>
          <div className="text-sm">
            <div className="font-medium text-gray-900">Ops Admin</div>
            <div className="text-xs text-zana-muted">Super Admin</div>
          </div>
        </div>
      </div>
    </div>
  );
}
