import Link from 'next/link';
import { getT, requireOwnerContext } from '@/lib/server-context';
import { PageHeader, StatTile, StatGroup, Notice, Badge, formatDate } from '@/components/ui';
import { StatusBanner } from '@/components/StatusBanner';
import { DailyChart } from '@/components/DailyChart';

interface Overview {
  stamps_today: number;
  stamps_30d: number;
  redemptions_30d: number;
  active_customers_30d: number;
  new_customers_30d: number;
  total_customers: number;
  flagged_7d: number;
  quarantined: number;
  alerts_7d: number;
  daily: { day: string; stamps: number; redemptions: number }[];
}

export default async function OverviewPage() {
  const { supabase, cafe } = await requireOwnerContext();
  const { t } = await getT();
  const { data, error: overviewError } = await supabase.rpc('owner_overview', { p_cafe: cafe.id });
  if (overviewError || !data) throw new Error('Overview could not be loaded. Please retry; figures are not zero.');
  const o = (data ?? {}) as Overview;
  const { data: sub, error: subError } = await supabase.from('subscriptions').select('status, trial_ends_at, current_period_end').eq('cafe_id', cafe.id).single();
  if (subError) throw new Error('Subscription status is unavailable. Please retry.');

  const statusTone = cafe.status === 'active' ? 'good' : cafe.status === 'pending' ? 'warn' : 'bad';

  return (
    <>
      <PageHeader
        title={t('overview.title')}
        description="Your cafe’s loyalty performance at a glance. Times are Baghdad time."
        action={<Badge tone={statusTone}>{t(`status.${cafe.status}` as 'status.active')}</Badge>}
      />
      <div className="space-y-6">
        <StatusBanner cafe={cafe} />
        {sub?.status === 'trial' && sub.trial_ends_at && (
          <Notice tone="neutral" title="Free trial">Your trial ends on {formatDate(sub.trial_ends_at)}. <Link className="font-medium text-gold hover:underline" href="/dashboard/billing">Choose a plan</Link></Notice>
        )}
        {sub?.status === 'pending_payment' && (
          <Notice tone="warn" title="Payment needed">This cafe is not eligible for another free trial. <Link className="font-medium text-gold hover:underline" href="/dashboard/billing">Go to billing</Link></Notice>
        )}
        {(o.alerts_7d > 0 || o.quarantined > 0 || o.flagged_7d > 0) && (
          <Notice tone="warn" title="Needs your review">
            {o.alerts_7d} alerts this week, {o.flagged_7d} stamps by new baristas, {o.quarantined} quarantined offline scans.{' '}
            <Link className="font-medium text-gold hover:underline" href="/dashboard/activity">Review scan history</Link>
          </Notice>
        )}
        <StatGroup columns={3}>
          <StatTile label={t('overview.stampsToday')} value={o.stamps_today ?? 0} />
          <StatTile label={t('overview.stamps30')} value={o.stamps_30d ?? 0} />
          <StatTile label={t('overview.redemptions30')} value={o.redemptions_30d ?? 0} />
          <StatTile label={t('overview.active30')} value={o.active_customers_30d ?? 0} hint={`${o.total_customers ?? 0} customers in total`} />
          <StatTile label={t('overview.newCustomers')} value={o.new_customers_30d ?? 0} />
          <StatTile label={t('overview.alerts')} value={o.alerts_7d ?? 0} />
        </StatGroup>
        {o.daily && <DailyChart data={o.daily} title={t('overview.chartTitle')} />}
      </div>
    </>
  );
}
