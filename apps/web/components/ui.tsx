import type { ReactNode } from 'react';

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-[1.2] text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** Section title inside a page. */
export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** A single KPI. Place several inside <StatGroup> for one quiet panel. */
export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="bg-white p-4 sm:p-5">
      <div className="text-[12.5px] font-medium text-ink-muted sm:text-[13px]">{label}</div>
      <div className="mt-2 text-[24px] sm:text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink tabular-nums">{value}</div>
      {hint && <div className="mt-2 text-[12px] text-ink-faint">{hint}</div>}
    </div>
  );
}

/** Joins KPI tiles into one bordered panel with hairline dividers. */
export function StatGroup({ children, columns = 3 }: { children: ReactNode; columns?: 2 | 3 | 4 }) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }[columns];
  return (
    <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line ${cols}`}>{children}</div>
  );
}

const TONES = {
  neutral: 'bg-cream-deep text-ink-soft',
  good: 'bg-good/[0.09] text-good',
  warn: 'bg-warn/[0.09] text-warn',
  bad: 'bg-bad/[0.08] text-bad',
  gold: 'bg-gold-soft text-gold-deep',
} as const;

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex h-6 items-center rounded-sm px-2 text-[12px] font-medium ${TONES[tone]}`}>{children}</span>;
}

export function Notice({ tone = 'neutral', title, children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad'; title?: string; children?: ReactNode }) {
  const bar = { neutral: 'bg-ink-faint', good: 'bg-good', warn: 'bg-warn', bad: 'bg-bad' }[tone];
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} aria-atomic="true"
      className="relative overflow-hidden rounded-xl border border-line bg-white py-3.5 pe-4 ps-5 text-[14px] text-ink-soft">
      <span aria-hidden="true" className={`absolute inset-y-0 start-0 w-[3px] ${bar}`} />
      {title && <div className="mb-0.5 font-medium text-ink">{title}</div>}
      {children}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-6 py-10 text-center">
      <div className="text-[15px] font-semibold text-ink">{title}</div>
      {children && <div className="mx-auto mt-1.5 max-w-md text-[13.5px] text-ink-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Placeholder block for loading states. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Baghdad',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value));
}

export function formatIqd(value: number): string {
  return `${new Intl.NumberFormat('en-US').format(value)} IQD`;
}
