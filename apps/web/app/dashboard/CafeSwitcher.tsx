'use client';

import { useRouter } from 'next/navigation';

export function CafeSwitcher({ cafes, current }: { cafes: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  if (cafes.length < 2) {
    return (
      <a href="/onboarding?new=1" className="text-[13px] text-gold hover:underline">+ Add another cafe</a>
    );
  }
  return (
    <select
      aria-label="Cafe"
      className="w-full rounded-[10px] border-0 bg-ink/[0.05] px-3 py-2 text-sm font-medium text-ink outline-none focus:ring-4 focus:ring-gold/15"
      value={current}
      onChange={(e) => {
        if (e.target.value === 'new') {
          window.location.href = '/onboarding?new=1';
          return;
        }
        document.cookie = `bw_cafe=${e.target.value}; path=/; samesite=lax`;
        router.refresh();
      }}
    >
      {cafes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      <option value="new">+ Add another cafe</option>
    </select>
  );
}
