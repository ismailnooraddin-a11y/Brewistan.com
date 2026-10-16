'use client';

import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from '@/lib/i18n';

export function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  return (
    <select
      aria-label="Language"
      className="rounded-lg border border-ink/15 bg-white px-2 py-1.5 text-sm"
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
