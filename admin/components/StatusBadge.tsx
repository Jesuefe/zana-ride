const STYLES: Record<string, string> = {
  APPROVED: 'bg-[#EAF3DE] text-[#3B6D11]',
  ACTIVE: 'bg-[#EAF3DE] text-[#3B6D11]',
  COMPLETED: 'bg-[#EAF3DE] text-[#3B6D11]',
  ONLINE: 'bg-[#EAF3DE] text-[#3B6D11]',
  RESOLVED: 'bg-[#EAF3DE] text-[#3B6D11]',

  PENDING: 'bg-[#FAEEDA] text-[#854F0B]',
  WAITING_CUSTOMER: 'bg-[#FAEEDA] text-[#854F0B]',
  BUSY: 'bg-[#FAEEDA] text-[#854F0B]',
  IN_PROGRESS: 'bg-[#E6F1FB] text-[#0C447C]',
  OPEN: 'bg-[#FCEBEB] text-[#791F1F]',

  SUSPENDED: 'bg-[#FCEBEB] text-[#791F1F]',
  BANNED: 'bg-[#2C2C2A] text-white',
  REJECTED: 'bg-[#FCEBEB] text-[#791F1F]',
  CANCELLED: 'bg-[#FCEBEB] text-[#791F1F]',
  NO_DRIVER_FOUND: 'bg-[#FCEBEB] text-[#791F1F]',

  OFFLINE: 'bg-gray-100 text-gray-600',

  HIGH: 'bg-[#FCEBEB] text-[#791F1F]',
  MEDIUM: 'bg-[#FAEEDA] text-[#854F0B]',
  LOW: 'bg-gray-100 text-gray-600',
};

function label(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {label(status)}
    </span>
  );
}
