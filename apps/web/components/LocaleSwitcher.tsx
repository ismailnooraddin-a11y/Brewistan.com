'use client';

import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from '@/lib/i18n';

export function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  return (
    <select
      aria-label="Language"
      className="h-8 rounded-md border border-line bg-white px-2 text-[13px] text-ink-soft outline-none hover:border-[#d6dad5] focus:border-gold"
      value={current}
      onChange={(e) => {
        document.cookie = `${LOCALE_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>{LOCALE_NAMES[l]}</option>
      ))}
    </select>
  );
}
