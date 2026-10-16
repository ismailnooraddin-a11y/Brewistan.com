import { Pagination } from '@/components/Pagination';
import { pageNumber,PAGE_SIZE } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState, Badge, formatDate } from '@/components/ui';
import { ReviewCard } from './ReviewCard';

export default async function ReviewQueue({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const page=pageNumber((await searchParams).page),from=(page-1)*PAGE_SIZE;
  const supabase = await createClient();
  const { data: cafes,error } = await supabase.from('cafes')
    .select('id, name, instagram_url, business_registration_no, verification_code, verification_photo_path, status, rejection_reason, created_at, owner_id')
    .in('status', ['pending', 'rejected']).order('created_at').order('id').range(from,from+PAGE_SIZE);
  if(error)throw new Error('Review queue could not be loaded.');

  const pending = (cafes ?? []).slice(0,PAGE_SIZE).filter((c) => c.status === 'pending');
  const rejected = (cafes ?? []).slice(0,PAGE_SIZE).filter((c) => c.status === 'rejected');

  return (
    <>
      <PageHeader title="Review queue" description="Approve within two working days. Opening a verification photo is logged with your reason." />
      {!pending.length ? <EmptyState title="Queue is empty" /> : (
        <div className="space-y-4">
          {pending.map((c) => <ReviewCard key={c.id} cafe={c} />)}
        </div>
      )}
      {rejected.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg">Rejected (can be re-approved)</h2>
          <div className="space-y-4">
            {rejected.map((c) => (
              <div key={c.id}>
                <div className="mb-1 text-xs text-ink-muted"><Badge tone="bad">rejected</Badge> {formatDate(c.created_at)} · {c.rejection_reason}</div>
                <ReviewCard cafe={c} />
              </div>
            ))}
          </div>
        </section>
      )}
      <Pagination path="/admin" page={page} hasMore={(cafes?.length??0)>PAGE_SIZE}/>
    </>
  );
}
