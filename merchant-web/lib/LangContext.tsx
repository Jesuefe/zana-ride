'use client';
import { createContext, useContext, useState, ReactNode } from 'react';
import { Lang, getStoredLang, setStoredLang } from './lang';

type LangContextType={lang:Lang;setLang:(lang:Lang)=>void;t:(key:string)=>string};
const LangContext=createContext<LangContextType>({lang:'en',setLang:()=>{},t:key=>key});
export function LangProvider({children}:{children:ReactNode}){
 const [lang,setLangState]=useState<Lang>(()=>getStoredLang());
 const setLang=(next:Lang)=>{setLangState(next);setStoredLang(next);window.dispatchEvent(new CustomEvent('zana-language-change',{detail:next}));};
 const t=(key:string)=>require('./lang').UI[key]?.[lang]??key;
 return <LangContext.Provider value={{lang,setLang,t}}>{children}</LangContext.Provider>;
}
export function useLang(){return useContext(LangContext);}
