import { Pagination } from '@/components/Pagination';
import { pageNumber } from '@/lib/pagination';
import { getT, requireOwnerContext } from '@/lib/server-context';
import { PageHeader, Badge, EmptyState, formatDate } from '@/components/ui';
import { VoidButton } from './VoidButton';

const REASONS: Record<string, string> = {
  cooldown: 'Scanned again within the cooldown',
  reward_cap: 'Customer already holds the maximum rewards',
  self_scan: 'Barista scanned their own code',
  staff_account: 'Code belongs to a staff member',
  not_staff: 'Scanner is not staff at this cafe',
  staff_revoked_before_sync: 'Barista was removed before this offline scan synced',
  staff_not_valid_at_scan: 'Barista was not active at scan time',
  cafe_inactive: 'Cafe was not active',
  branch_mismatch: 'Wrong branch',
  reward_redeemed: 'Reward was already used',
  reward_expired: 'Reward had expired',
  no_reward: 'No reward available',
  subscription_inactive: 'New earning is paused until the subscription is renewed',
  offline_cap: 'Offline redemption allowance reached',
  voucher_required: 'A signed reward code is required',
  invalid_staff_snapshot: 'Offline staff authorization was invalid or expired',
};

const ACTIONS: Record<string, string> = {
  cooldown_alert: 'Repeated cooldown rejections by one barista',
  duplicate_redemption: 'Offline redemption of a reward that was already used',
  staff_invited: 'Barista invited',
  staff_removed: 'Barista removed',
  staff_confirmed: 'Barista confirmed',
  campaign_updated: 'Reward rules changed',
  push_approved: 'Notification approved',
  redemption_voided: 'Redemption voided',
  cafe_approve: 'Cafe approved',
  cafe_reject: 'Cafe not approved',
  cafe_created: 'Cafe registered',
  payment_confirmed: 'Payment confirmed',
  admin_viewed_personal_data: 'Brewistan support viewed verification files',
};

export default async function ActivityPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const { supabase, cafe } = await requireOwnerContext();
  const { t } = await getT();

  type Redemption = { id: string; redeemed_at: string; offline: boolean; status: string; reason: string | null; staff_name: string; void_reason: string | null; branch_id: string | null };
  type Issue = { id: string; scanned_at: string; status: string; reason: string | null; flagged: boolean; offline: boolean; staff_name: string };
  const page=pageNumber((await searchParams).page);
  const {data:activity,error}=await supabase.rpc('owner_activity_page',{p_cafe:cafe.id,p_page:page});
  if(error)throw new Error('Activity could not be loaded. Please retry.');
  const redemptions:Redemption[]=activity?.redemptions??[];
  const issues:Issue[]=activity?.issues??[];
  const audit:{id:number;action:string;reason:string|null;created_at:string}[]=activity?.audit??[];

  return (
    <>
      <PageHeader title={t('activity.title')} description="Redemptions, rejected or flagged scans, and account changes. Each page shows up to 50 entries per section, newest first." />
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg">Redemptions</h2>
          {!redemptions?.length ? <EmptyState title="No redemptions yet" /> : (
            <div className="card overflow-x-auto">
              <table className="table min-w-[640px]">
                <thead><tr><th>Time</th><th>Barista</th><th>Mode</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {redemptions.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.redeemed_at, true)}</td>
                      <td>{r.staff_name}</td>
                      <td>{r.offline ? <Badge tone="warn">offline</Badge> : <Badge>online</Badge>}</td>
                      <td>
                        <Badge tone={r.status === 'accepted' ? 'good' : r.status === 'voided' ? 'neutral' : 'bad'}>{r.status}</Badge>
                        {(r.reason || r.void_reason) && <div className="mt-1 text-xs text-ink-muted">{r.void_reason ?? REASONS[r.reason!] ?? r.reason}</div>}
                      </td>
                      <td className="text-right rtl:text-left">{r.status === 'accepted' && <VoidButton redemptionId={r.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg">Scans that need attention</h2>
          {!issues?.length ? <EmptyState title="Nothing to review" /> : (
            <div className="card overflow-x-auto">
              <table className="table min-w-[640px]">
                <thead><tr><th>Time</th><th>Barista</th><th>Result</th><th>Why</th></tr></thead>
                <tbody>
                  {issues.map((s) => (
                    <tr key={s.id}>
                      <td>{formatDate(s.scanned_at, true)}{s.offline && <span className="text-xs text-ink-muted"> · offline</span>}</td>
                      <td>{s.staff_name}</td>
                      <td><Badge tone={s.status === 'accepted' ? 'warn' : s.status === 'quarantined' ? 'bad' : 'neutral'}>{s.status === 'accepted' ? 'flagged' : s.status}</Badge></td>
                      <td className="text-ink-muted">{s.status === 'accepted' ? 'Stamp by a barista you have not confirmed yet' : REASONS[s.reason ?? ''] ?? s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg">Account log</h2>
          <div className="card">
            <ul className="divide-y divide-ink/5 text-sm">
              {(audit ?? []).map((a) => (
                <li key={a.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:justify-between">
                  <span>{ACTIONS[a.action] ?? a.action}{a.reason && <span className="text-ink-muted"> · {a.reason}</span>}</span>
                  <span className="text-xs text-ink-muted">{formatDate(a.created_at, true)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
      <Pagination path="/dashboard/activity" page={page} hasMore={activity?.hasMore===true} />
    </>
  );
}
