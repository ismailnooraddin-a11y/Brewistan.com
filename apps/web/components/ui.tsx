import type { ReactNode } from 'react';

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight sm:text-[34px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card">
      <div className="text-[13px] font-medium text-ink-muted">{label}</div>
      <div className="mt-1.5 font-display text-[32px] font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-muted">{hint}</div>}
    </div>
  );
}

const TONES = {
  neutral: 'bg-ink/5 text-ink-soft',
  good: 'bg-good/10 text-good',
  warn: 'bg-warn/10 text-warn',
  bad: 'bg-bad/10 text-bad',
  gold: 'bg-gold-soft text-gold-deep',
} as const;

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export function Notice({ tone = 'neutral', title, children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad'; title?: string; children?: ReactNode }) {
  const styles = {
    neutral: 'border-ink/[0.08] bg-white',
    good: 'border-good/30 bg-good/5',
    warn: 'border-warn/30 bg-warn/5',
    bad: 'border-bad/30 bg-bad/5',
  }[tone];
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} aria-atomic="true" className={`rounded-2xl border p-4 text-sm ${styles}`}>
      {title && <div className="mb-1 font-medium">{title}</div>}
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[20px] bg-white p-10 text-center shadow-soft ring-1 ring-black/[0.04]">
      <div className="font-display text-lg font-semibold">{title}</div>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{children}</div>}
    </div>
  );
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
