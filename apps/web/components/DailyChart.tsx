'use client';

import { useState } from 'react';

interface Point {
  day: string;
  stamps: number;
  redemptions: number;
}

// Single-series bar chart (stamps per day). Redemptions appear in the tooltip and table.
export function DailyChart({ data, title }: { data: Point[]; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.stamps));
  const niceMax = Math.ceil(max / 5) * 5 || 5;
  const label = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const active = hover !== null ? data[hover] : null;

  return (
    <figure className="card">
      <figcaption className="mb-4 flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs tabular-nums text-ink-muted" aria-live="polite">
          {active ? `${label(active.day)} · ${active.stamps} stamps · ${active.redemptions} redeemed` : `Peak ${max}`}
        </span>
      </figcaption>
      <div className="relative h-48" dir="ltr">
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-ink/5" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -top-2 left-0 bg-white pr-1 text-[10px] tabular-nums text-ink-muted">{Math.round(niceMax * f)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px] pl-6">
          {data.map((d, i) => (
            <button
              key={d.day}
              type="button"
              className="group relative flex h-full flex-1 items-end focus:outline-none"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${label(d.day)}: ${d.stamps} stamps, ${d.redemptions} redeemed`}
            >
              <span
                className={`block w-full rounded-t-[4px] transition-colors ${hover === i ? 'bg-gold-deep' : 'bg-gold'}`}
                style={{ height: `${(d.stamps / niceMax) * 100}%`, minHeight: d.stamps ? 2 : 0 }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-6 text-[10px] text-ink-muted" dir="ltr">
        <span>{data[0] && label(data[0].day)}</span>
        <span>{data[data.length - 1] && label(data[data.length - 1].day)}</span>
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-xs text-ink-muted">Show as table</summary>
        <table className="table mt-2">
          <thead><tr><th>Day</th><th>Stamps</th><th>Redeemed</th></tr></thead>
          <tbody>
            {[...data].reverse().map((d) => (
              <tr key={d.day}><td>{label(d.day)}</td><td className="tabular-nums">{d.stamps}</td><td className="tabular-nums">{d.redemptions}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
