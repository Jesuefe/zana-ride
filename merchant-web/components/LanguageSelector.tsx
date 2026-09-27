'use client';
import {useState} from 'react';
import {Globe,Check,ChevronDown} from 'lucide-react';
import {Lang,LANG_LABELS} from '../lib/lang';
import {useLang} from '../lib/LangContext';
export default function LanguageSelector(){const {lang,setLang}=useLang();const [open,setOpen]=useState(false);return <div className="relative"><button onClick={()=>setOpen(v=>!v)} className="flex items-center gap-2 text-sm text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-800"><Globe size={14}/>{LANG_LABELS[lang]}<ChevronDown size={13}/></button>{open&&<div className="absolute left-0 bottom-full mb-1 w-40 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">{(['en','fr','rw'] as Lang[]).map(l=><button key={l} onClick={()=>{setLang(l);setOpen(false)}} className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 text-left">{LANG_LABELS[l]}{lang===l&&<Check size={14} className="text-zana-primary"/>}</button>)}</div>}</div>}
