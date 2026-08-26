import { MessageCircle } from 'lucide-react';

export default function WhatsAppPreview({ lines }: { lines: string[] }) {
  return (
    <div className="bg-[#0B141A] rounded-xl p-4 max-w-xs">
      <div className="flex items-center gap-2 mb-3 text-white">
        <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center">
          <MessageCircle size={14} className="text-[#0B141A]" />
        </div>
        <span className="text-xs font-medium">Zana Business</span>
      </div>
      <div className="bg-[#005C4B] rounded-lg rounded-tl-none p-3 text-white text-xs leading-relaxed">
        {lines.map((line, i) => (
          <p key={i} className={i === 0 ? 'font-semibold mb-1' : ''}>
            {line}
          </p>
        ))}
      </div>
      <p className="text-[10px] text-white/40 mt-2">Sent via WhatsApp Business API</p>
    </div>
  );
}
