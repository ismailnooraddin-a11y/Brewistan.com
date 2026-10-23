'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LANGS, translate, type Lang, type StringKey } from '@/lib/customer/strings';
import { InstallPrompt } from './InstallPrompt';

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
}
const CustomerContext = createContext<Ctx | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('bw.lang') as Lang | null;
    if (saved && LANGS.includes(saved)) return saved;
  } catch { /* storage blocked */ }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  if (nav.startsWith('ckb') || nav.startsWith('ku')) return 'ckb';
  if (nav.startsWith('ar')) return 'ar';
  return 'en';
}

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  useEffect(() => { setLangState(initialLang()); }, []);
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* the app works without it */ });
    }
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('bw.lang', l); } catch { /* ignore */ }
  }, []);
  const value = useMemo<Ctx>(() => ({ lang, setLang, t: (k, v) => translate(lang, k, v) }), [lang, setLang]);
  return (
    <CustomerContext.Provider value={value}>
      <div dir={lang === 'en' ? 'ltr' : 'rtl'} lang={lang} className="min-h-[100dvh]">
        {children}
        <InstallPrompt />
      </div>
    </CustomerContext.Provider>
  );
}

export function useCustomerText(): Ctx {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomerText must be used inside CustomerProvider');
  return ctx;
}
