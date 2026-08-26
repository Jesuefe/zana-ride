import { LucideIcon } from 'lucide-react';

type Props = {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  accent?: 'primary' | 'secondary' | 'neutral';
};

export default function StatCard({ label, value, icon: Icon, trend, trendUp, accent = 'neutral' }: Props) {
  const iconBg =
    accent === 'primary' ? 'bg-zana-primary-light text-zana-primary-dark' :
    accent === 'secondary' ? 'bg-[#FBF1DD] text-zana-secondary-dark' :
    'bg-gray-100 text-gray-600';

  return (
    <div className="bg-zana-surface border border-zana-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zana-muted">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      {trend && (
        <div className={`text-xs mt-1.5 font-medium ${trendUp ? 'text-zana-success' : 'text-zana-error'}`}>
          {trend}
        </div>
      )}
    </div>
  );
}
