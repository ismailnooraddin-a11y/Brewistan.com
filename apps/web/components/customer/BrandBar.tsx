'use client';
import Link from 'next/link';
import { LANGS, LANG_NAMES, type Lang } from '@/lib/customer/strings';
import { useCustomerText } from './CustomerProvider';

export function BrandBar({ right }: { right?: React.ReactNode }) {
  const { lang, setLang } = useCustomerText();
  return (
    <header className="flex h-12 items-center justify-between gap-3">
      <Link href="/cards" className="flex items-center gap-2.5" aria-label="Brewistan">
        <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full border border-[#c8a96a]/60 font-card text-[15px] text-[#c8a96a]">B</span>
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Brewistan</span>
      </Link>
      <div className="flex items-center gap-2">
        {right}
        <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value as Lang)}
          className="h-9 rounded-lg border border-white/10 bg-transparent px-2 text-[13px] text-[#a39a8e] outline-none focus:border-[#c8a96a]">
          {LANGS.map((l) => <option key={l} value={l} className="bg-[#1b1916] text-[#f3eee6]">{LANG_NAMES[l]}</option>)}
        </select>
      </div>
    </header>
  );
}
