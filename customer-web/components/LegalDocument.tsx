'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ShieldCheck, FileText } from 'lucide-react';

type Section={title:string; paragraphs?:string[]; bullets?:string[]};
export default function LegalDocument({title,updated,kind,sections}:{title:string;updated:string;kind:'privacy'|'terms';sections:Section[]}){
  return <main className="min-h-screen bg-[#F7F9F8] text-gray-900">
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur-xl">
      <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-zana-primary"><ArrowLeft size={17}/> Back</Link>
        <Link href="/" className="flex items-center gap-2"><Image src="/zana-mark.png" alt="Zana" width={30} height={30} className="rounded-lg"/><span className="font-black tracking-tight">zana</span></Link>
      </div>
    </header>
    <article className="max-w-3xl mx-auto px-5 py-9 sm:py-14">
      <div className="rounded-[28px] bg-[#063B33] text-white p-7 sm:p-10 mb-7 relative overflow-hidden">
        <div className="absolute -right-12 -bottom-28 w-64 h-64 rounded-full border border-white/10"/><div className="relative">
          <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center mb-5">{kind==='privacy'?<ShieldCheck size={22}/>:<FileText size={22}/>}</div>
          <p className="text-[11px] uppercase tracking-[.22em] text-[#FFC244] font-bold mb-2">ZANA · CUSTOMER INFORMATION</p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{title}</h1>
          <p className="text-sm text-white/60 mt-3">Last updated {updated}</p>
        </div>
      </div>
      <div className="rounded-3xl bg-white border border-gray-100 shadow-sm px-6 sm:px-10 py-8 sm:py-10">
        <p className="text-sm leading-7 text-gray-600 mb-8">{kind==='privacy'?'This policy explains what information Zana collects, why it is used, who it may be shared with, and the choices available to you.':'These terms explain the rules that apply when you create an account and use Zana rides, deliveries, food and shopping services.'}</p>
        <nav className="rounded-2xl bg-gray-50 p-5 mb-9"><p className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-3">On this page</p><div className="grid sm:grid-cols-2 gap-x-5 gap-y-2">{sections.map((s,i)=><a key={s.title} href={`#section-${i}`} className="text-xs text-zana-primary hover:underline">{String(i+1).padStart(2,'0')} · {s.title}</a>)}</div></nav>
        <div className="space-y-9">{sections.map((s,i)=><section id={`section-${i}`} key={s.title} className="scroll-mt-24">
          <h2 className="text-lg font-extrabold tracking-tight text-gray-900 mb-3">{s.title}</h2>
          {s.paragraphs?.map((p,j)=><p key={j} className="text-sm leading-7 text-gray-600 mb-3">{p}</p>)}
          {s.bullets&&<ul className="space-y-2.5 mt-3">{s.bullets.map((b,j)=><li key={j} className="flex gap-3 text-sm leading-6 text-gray-600"><span className="w-1.5 h-1.5 rounded-full bg-zana-primary mt-2.5 shrink-0"/>{b}</li>)}</ul>}
        </section>)}</div>
        <div className="border-t border-gray-100 mt-10 pt-7 flex flex-col sm:flex-row justify-between gap-3 text-xs text-gray-500"><span>Zana · Kigali, Rwanda</span><a href="mailto:hello@zanaride.rw" className="font-semibold text-zana-primary">hello@zanaride.rw</a></div>
      </div>
      <div className="flex justify-center gap-5 py-8 text-xs font-semibold text-gray-500"><Link href="/terms" className="hover:text-zana-primary">Terms of Service</Link><Link href="/privacy" className="hover:text-zana-primary">Privacy Policy</Link><Link href="/login" className="hover:text-zana-primary">Sign in</Link></div>
    </article>
  </main>;
}
