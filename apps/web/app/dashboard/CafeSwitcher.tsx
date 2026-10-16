'use client';

import { useRouter } from 'next/navigation';

export function CafeSwitcher({ cafes, current }: { cafes: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  if (cafes.length < 2) {
    return (
      <a href="/onboarding?new=1" className="text-xs text-gold hover:underline">+ Add another cafe</a>
    );
  }
  return (
    <select
      aria-label="Cafe"
      className="w-full rounded-lg border border-white/20 bg-ink-soft px-2 py-1.5 text-sm text-cream"
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
