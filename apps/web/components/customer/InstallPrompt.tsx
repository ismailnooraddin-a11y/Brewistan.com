'use client';
import { useEffect, useState } from 'react';

// "Add to Home Screen" guide. iPhone has no install button, so we explain it;
// Android Chrome offers a real install prompt, shown as a button.
type BeforeInstall = Event & { prompt: () => Promise<void> };
const KEY = 'bw.install.dismissedAt';
const TEXT = {
  en: { title: 'Install Brewistan', ios: 'Tap Share, then “Add to Home Screen” for one-tap access.', android: 'Add it to your home screen for one-tap access.', go: 'Install' },
  ar: { title: 'ثبّت Brewistan', ios: 'اضغط مشاركة ثم «إضافة إلى الشاشة الرئيسية» للوصول بلمسة.', android: 'أضفه إلى الشاشة الرئيسية للوصول بلمسة.', go: 'تثبيت' },
  ckb: { title: 'Brewistan دابمەزرێنە', ios: 'هاوبەشکردن دابگرە، پاشان «زیادکردن بۆ شاشەی سەرەکی».', android: 'زیادی بکە بۆ شاشەی سەرەکی.', go: 'دامەزراندن' },
};

export function InstallPrompt() {
  const [mode, setMode] = useState<'ios' | 'android' | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstall | null>(null);
  const [lang, setLang] = useState<'en' | 'ar' | 'ckb'>('en');

  useEffect(() => {
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) return;
    try {
      if (Date.now() - Number(localStorage.getItem(KEY) ?? 0) < 14 * 86_400_000) return;
      const l = localStorage.getItem('bw.lang');
      if (l === 'ar' || l === 'ckb') setLang(l);
    } catch { /* ignore */ }
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIOS) timer = setTimeout(() => setMode('ios'), 4000);
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstall); timer = setTimeout(() => setMode('android'), 2000); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); if (timer) clearTimeout(timer); };
  }, []);

  if (!mode) return null;
  const T = TEXT[lang];
  const close = () => { setMode(null); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } };
  return (
    <div role="dialog" aria-live="polite"
      className="fixed inset-x-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-[#f7f3ec] p-3.5 text-[#151311] shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
      style={{ bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-[10px]" />
      <div className="min-w-0 flex-1 text-[13.5px] leading-snug">
        <div className="font-semibold">{T.title}</div>
        <div className="text-[#4d463e]">{mode === 'ios' ? T.ios : T.android}</div>
      </div>
      {mode === 'android' && deferred && (
        <button className="h-9 shrink-0 rounded-lg bg-[#151311] px-3.5 text-[13px] font-semibold text-[#f7f3ec]"
          onClick={async () => { close(); await deferred.prompt(); }}>{T.go}</button>
      )}
      <button aria-label="Close" onClick={close} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xl text-[#6f665c]">×</button>
    </div>
  );
}
