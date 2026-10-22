// Per-barista risk for the last 30 days, from public.owner_risk_report.
// Every alert explains itself in plain language; nothing is a black box.

export interface RiskRow {
  membership_id: string;
  staff_id: string;
  display_name: string | null;
  stamps: number;
  level: 'green' | 'yellow' | 'red';
  reasons: { severity: 'yellow' | 'red'; text: string }[];
}

const LEVEL = {
  red: { dot: 'bg-bad', label: 'Needs a look', text: 'text-bad', ring: 'border-bad/25' },
  yellow: { dot: 'bg-warn', label: 'Worth checking', text: 'text-warn', ring: 'border-warn/25' },
  green: { dot: 'bg-good', label: 'All normal', text: 'text-good', ring: 'border-line' },
} as const;

export function RiskPanel({ rows }: { rows: RiskRow[] }) {
  const flagged = rows.filter((r) => r.level !== 'green').length;
  return (
    <section aria-labelledby="risk-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="risk-title" className="text-[17px] font-semibold">Barista check-up</h2>
          <p className="mt-0.5 max-w-3xl text-[13px] text-ink-muted">
            Last 30 days. We look for unusual patterns: too many stamps in an hour, the same few customers again and again,
            night-time stamps, many brand-new customers in one day, one customer at two branches at once, and heavy offline use.
          </p>
        </div>
        <span className="text-sm font-medium text-ink-soft">
          {flagged === 0 ? 'Nothing unusual' : `${flagged} to review`}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="card text-sm text-ink-muted">No active baristas yet.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => {
            const l = LEVEL[r.level];
            return (
              <article key={r.membership_id} className={`rounded-xl border bg-white p-5 ${l.ring}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.display_name || 'Unnamed barista'}</div>
                    <div className="text-[13px] text-ink-muted">{r.stamps} stamps</div>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium ${l.text}`}>
                    <span className={`h-2 w-2 rounded-full ${l.dot}`} aria-hidden="true" />
                    {l.label}
                  </span>
                </div>
                {r.reasons.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-ink/[0.06] pt-3 text-sm">
                    {r.reasons.map((reason, i) => (
                      <li key={i} className="flex gap-2">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${reason.severity === 'red' ? 'bg-bad' : 'bg-warn'}`} aria-hidden="true" />
                        <span>{reason.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
