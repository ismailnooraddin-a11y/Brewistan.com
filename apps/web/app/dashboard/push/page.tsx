import { Pagination } from '@/components/Pagination';
import { pageNumber, PAGE_SIZE } from '@/lib/pagination';
import { getT, requireOwnerContext } from '@/lib/server-context';
import { PageHeader, Notice } from '@/components/ui';
import { PushComposer } from './PushComposer';

export default async function PushPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const page=pageNumber((await searchParams).page); const from=(page-1)*PAGE_SIZE;
  const { supabase, cafe } = await requireOwnerContext();
  const { t } = await getT();
  const { data: campaigns,error: campaignsError } = await supabase.from('push_campaigns')
    .select('id, title, body, scheduled_at, status, audience_count, delivered_count')
    .eq('cafe_id', cafe.id).order('scheduled_at', { ascending: false }).order('id').range(from,from+PAGE_SIZE);

  if(campaignsError)throw new Error('Campaign history could not be loaded.');
  return (
    <>
      <PageHeader
        title={t('push.title')}
        description="Up to two campaigns per week, sent between 09:00 and 21:00 Baghdad time. Each customer gets at most one of your messages per day. Approving a campaign needs a code sent to your WhatsApp."
      />
      {cafe.status !== 'active'
        ? <Notice tone="warn">Notifications are available once your cafe is approved.</Notice>
        : <PushComposer cafeId={cafe.id} campaigns={(campaigns ?? []).slice(0,PAGE_SIZE)} />}
      <Pagination path="/dashboard/push" page={page} hasMore={(campaigns?.length??0)>PAGE_SIZE} />
    </>
  );
}
