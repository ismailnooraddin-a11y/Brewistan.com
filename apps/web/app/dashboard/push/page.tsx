import Link from 'next/link';
import { Pagination } from '@/components/Pagination';
import { pageNumber, PAGE_SIZE } from '@/lib/pagination';
import { getT, requireOwnerContext } from '@/lib/server-context';
import { PageHeader, Notice } from '@/components/ui';
import { PushComposer } from './PushComposer';

const MONTHLY_LIMIT: Record<string, number> = { classic: 0, signature: 1, bespoke: 5 };

/** Start and end of the current calendar month in Baghdad time (UTC+3), as ISO strings. */
function baghdadMonth(): { start: string; end: string } {
  const now = new Date(Date.now() + 3 * 3600_000);
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 3 * 3600_000;
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 3 * 3600_000;
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

export default async function PushPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageNumber((await searchParams).page); const from = (page - 1) * PAGE_SIZE;
  const { supabase, cafe } = await requireOwnerContext();
  const { t } = await getT();
  const limit = MONTHLY_LIMIT[cafe.tier] ?? 0;

  if (limit === 0) {
    return (
      <>
        <PageHeader title={t('nav.push')} description="Send a message to every customer who has your card." />
        <div className="card mx-auto max-w-xl text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gold/10 text-gold" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
            </svg>
          </div>
          <h2 className="mt-5 text-2xl font-semibold">Campaigns are a Signature feature</h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-ink-muted">
            Bring customers back with a message straight to their phone. Signature includes 1 campaign a month,
            Bespoke up to 5.
          </p>
          <Link href="/dashboard/billing" className="btn-primary mt-6">See plans</Link>
        </div>
      </>
    );
  }

  const month = baghdadMonth();
  const [{ data: campaigns, error: campaignsError }, { count: usedThisMonth }] = await Promise.all([
    supabase.from('push_campaigns')
      .select('id, title, body, scheduled_at, status, audience_count, delivered_count')
      .eq('cafe_id', cafe.id).order('scheduled_at', { ascending: false }).order('id').range(from, from + PAGE_SIZE),
    supabase.from('push_campaigns').select('id', { count: 'exact', head: true })
      .eq('cafe_id', cafe.id).in('status', ['approved', 'sending', 'sent'])
      .gte('scheduled_at', month.start).lt('scheduled_at', month.end),
  ]);
  if (campaignsError) throw new Error('Campaign history could not be loaded.');
  const used = usedThisMonth ?? 0;
  const left = Math.max(0, limit - used);

  return (
    <>
      <PageHeader
        title={t('nav.push')}
        description="Sent between 09:00 and 21:00 Baghdad time. Each customer gets at most one of your messages a day. Approving a campaign needs a code sent to your WhatsApp."
      />
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium text-ink-muted">This month</div>
          <div className="mt-1 font-display text-[28px] font-semibold tracking-tight tabular-nums">
            {left} <span className="text-lg font-medium text-ink-muted">of {limit} left</span>
          </div>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: limit }).map((_, i) => (
            <span key={i} className={`h-2.5 w-8 rounded-full ${i < used ? 'bg-ink/15' : 'bg-gold'}`} />
          ))}
        </div>
      </div>
      {cafe.status !== 'active'
        ? <Notice tone="warn">Campaigns are available once your cafe is approved.</Notice>
        : <PushComposer cafeId={cafe.id} campaigns={(campaigns ?? []).slice(0, PAGE_SIZE)} />}
      <Pagination path="/dashboard/push" page={page} hasMore={(campaigns?.length ?? 0) > PAGE_SIZE} />
    </>
  );
}
