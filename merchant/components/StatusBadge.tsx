const STYLES: Record<string, string> = {
  DELIVERED: 'bg-[#EAF3DE] text-[#3B6D11]',
  PICKED_UP: 'bg-[#E6F1FB] text-[#0C447C]',
  COURIER_ASSIGNED: 'bg-[#E6F1FB] text-[#0C447C]',
  REQUESTED: 'bg-[#FAEEDA] text-[#854F0B]',
  CANCELLED: 'bg-[#FCEBEB] text-[#791F1F]',
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
