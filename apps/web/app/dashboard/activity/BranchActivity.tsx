import { SectionHeader, Badge, formatDate } from '@/components/ui';

export interface BranchSummaryRow { branch_id: string; branch_name: string; active: boolean; stamps: number; redemptions: number; customers: number }
export interface RecentStampRow { id: string; scanned_at: string; branch_name: string; staff_name: string; customer_ref: string; offline: boolean; flagged: boolean }

/** One card per café for customers; per-branch numbers for the owner. */
export function BranchActivity({ summary, recent }: { summary: BranchSummaryRow[]; recent: RecentStampRow[] }) {
  return (
    <>
      <section>
        <SectionHeader title="By branch" description="Last 30 days. Customers share one card across all branches; every stamp records where it was given." />
        <div className="card overflow-x-auto p-0 sm:p-0">
          <div className="px-5 py-1 sm:px-6">
            <table className="table">
              <thead><tr><th>Branch</th><th className="text-end">Stamps</th><th className="text-end">Rewards redeemed</th><th className="text-end">Customers</th></tr></thead>
              <tbody>
                {summary.map((b) => (
                  <tr key={b.branch_id}>
                    <td className="font-medium">{b.branch_name}{!b.active && <span className="ms-2"><Badge>Closed</Badge></span>}</td>
                    <td className="text-end tabular-nums">{b.stamps}</td>
                    <td className="text-end tabular-nums">{b.redemptions}</td>
                    <td className="text-end tabular-nums">{b.customers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section>
        <SectionHeader title="Recent stamps" description="The latest 50, newest first." />
        {recent.length === 0 ? (
          <div className="card text-sm text-ink-muted">No stamps yet.</div>
        ) : (
          <div className="card overflow-x-auto p-0 sm:p-0">
            <div className="px-5 py-1 sm:px-6">
              <table className="table">
                <thead><tr><th>Time</th><th>Branch</th><th>Barista</th><th>Customer</th><th className="text-end">Note</th></tr></thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap">{formatDate(s.scanned_at, true)}</td>
                      <td>{s.branch_name}</td>
                      <td>{s.staff_name}</td>
                      <td className="font-mono text-[12.5px] text-ink-muted">{s.customer_ref}</td>
                      <td className="text-end">{s.flagged ? <Badge tone="warn">Flagged</Badge> : s.offline ? <Badge>Offline</Badge> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
