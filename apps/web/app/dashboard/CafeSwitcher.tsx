'use client';

import { useRouter } from 'next/navigation';

const PLAN: Record<string, string> = { classic: 'Classic plan', signature: 'Signature plan', bespoke: 'Bespoke plan' };

export function CafeSwitcher({ cafes, current, tier }: { cafes: { id: string; name: string }[]; current: string; tier: string }) {
  const router = useRouter();
  const name = cafes.find((c) => c.id === current)?.name ?? '';
  return (
    <div className="rounded-lg border border-line bg-white">
      {cafes.length < 2 ? (
        <div className="px-3 py-2">
          <div className="truncate text-[13.5px] font-medium text-ink">{name}</div>
          <div className="text-[12px] text-ink-faint">{PLAN[tier] ?? ''}</div>
        </div>
      ) : (
        <label className="block px-3 py-2">
          <span className="sr-only">Cafe</span>
          <select
            className="w-full truncate bg-transparent text-[13.5px] font-medium text-ink outline-none"
            value={current}
            onChange={(e) => {
              if (e.target.value === 'new') { window.location.href = '/onboarding?new=1'; return; }
              document.cookie = `bw_cafe=${e.target.value}; path=/; samesite=lax`;
              router.refresh();
            }}
          >
            {cafes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="new">+ Add another cafe</option>
          </select>
          <span className="block text-[12px] text-ink-faint">{PLAN[tier] ?? ''}</span>
        </label>
      )}
      {cafes.length < 2 && (
        <a href="/onboarding?new=1" className="block border-t border-line px-3 py-1.5 text-[12.5px] text-ink-muted hover:text-ink">
          + Add another cafe
        </a>
      )}
    </div>
  );
}
