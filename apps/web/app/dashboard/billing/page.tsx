import { Pagination } from '@/components/Pagination';
import { pageNumber, PAGE_SIZE } from '@/lib/pagination';
import { getT, requireOwnerContext } from '@/lib/server-context';
import { PageHeader, Badge, formatDate, formatIqd } from '@/components/ui';
import { PaymentForm } from './PaymentForm';

const TIER_INFO = {
  classic: { name: 'Classic', features: 'Standard card layout with your cafe name, basic reward rules.' },
  signature: { name: 'Signature', features: 'Your logo, premium dark templates, better visibility in the app.' },
  bespoke: { name: 'Bespoke', features: 'Fully custom card designed by our team, white-glove setup.' },
} as const;

export default async function BillingPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const page=pageNumber((await searchParams).page); const from=(page-1)*PAGE_SIZE;
  const { supabase, cafe } = await requireOwnerContext();
  const { t } = await getT();
  const [{ data: sub,error: subError }, { data: pricing,error: priceError }, { data: reports,error: reportError }] = await Promise.all([
    supabase.from('subscriptions').select('*').eq('cafe_id', cafe.id).single(),
    supabase.from('pricing').select('tier, monthly_iqd'),
    supabase.from('payment_reports').select('*').eq('cafe_id', cafe.id).order('created_at', { ascending: false }).order('id').range(from,from+PAGE_SIZE),
  ]);
  if(subError||priceError||reportError)throw new Error('Billing data could not be loaded.');
  const price = (tier: string) => pricing?.find((p) => p.tier === tier)?.monthly_iqd ?? 0;

  return (
    <>
      <PageHeader title={t('billing.title')} description="Plans are billed monthly in Iraqi dinar. Pay by Zain Cash or FIB, then report the payment below; we confirm it within one working day." />
      <div className="space-y-6">
        <div className="card flex flex-wrap items-center gap-4">
          <div>
            <div className="label">Current plan</div>
            <div className="font-display text-2xl">{TIER_INFO[cafe.tier].name}</div>
          </div>
          <Badge tone={sub?.status === 'active' || sub?.status === 'trial' ? 'good' : 'warn'}>{sub?.status?.replace('_', ' ')}</Badge>
          <div className="text-sm text-ink-muted">
            {sub?.status === 'trial' && sub.trial_ends_at && <>Trial ends {formatDate(sub.trial_ends_at)}</>}
            {sub?.current_period_end && <>Paid until {formatDate(sub.current_period_end)}</>}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(TIER_INFO) as (keyof typeof TIER_INFO)[]).map((tier) => (
            <div key={tier} className={`card ${tier === cafe.tier ? 'border-gold' : ''}`}>
              <div className="font-display text-xl">{TIER_INFO[tier].name}</div>
              <div className="mt-1 text-sm tabular-nums">{formatIqd(price(tier))} / month</div>
              <p className="mt-3 text-sm text-ink-muted">{TIER_INFO[tier].features}</p>
            </div>
          ))}
        </div>
        <PaymentForm
          cafeId={cafe.id}
          zainCash={process.env.NEXT_PUBLIC_ZAIN_CASH_NUMBER ?? ''}
          fib={process.env.NEXT_PUBLIC_FIB_ACCOUNT ?? ''}
          monthly={price(cafe.tier)}
          support={process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? ''}
        />
        <div className="card overflow-x-auto">
          <h2 className="mb-3 text-lg">Payment history</h2>
          <table className="table">
            <thead><tr><th>Date</th><th>Method</th><th>Amount</th><th>Reference</th><th>Status</th></tr></thead>
            <tbody>
              {(reports ?? []).slice(0,PAGE_SIZE).map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.created_at)}</td>
                  <td>{r.method === 'zain_cash' ? 'Zain Cash' : r.method === 'fib' ? 'FIB' : 'Bank transfer'}</td>
                  <td className="tabular-nums">{formatIqd(r.amount_iqd)} · {r.months} mo</td>
                  <td className="font-mono text-xs">{r.reference}</td>
                  <td><Badge tone={r.status === 'confirmed' ? 'good' : r.status === 'rejected' ? 'bad' : 'warn'}>{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination path="/dashboard/billing" page={page} hasMore={(reports?.length??0)>PAGE_SIZE} />
    </>
  );
}
