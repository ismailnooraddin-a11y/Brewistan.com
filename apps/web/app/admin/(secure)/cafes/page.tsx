import { Pagination } from '@/components/Pagination';
import { pageNumber, PAGE_SIZE } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Badge, formatDate } from '@/components/ui';
import { CafeAdminActions } from './CafeAdminActions';

export default async function AdminCafes({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const page=pageNumber((await searchParams).page); const from=(page-1)*PAGE_SIZE;
  const supabase = await createClient();
  const { data: cafes,error: primaryError } = await supabase.from('cafes').select('id, name, status, tier, created_at, approved_at').order('created_at', { ascending: false }).order('id').range(from,from+PAGE_SIZE);
  if(primaryError)throw new Error('Records could not be loaded.');
  const { data: subs,error: relatedError } = cafes?.length ? await supabase.from('subscriptions').select('cafe_id, status, trial_ends_at, current_period_end').in('cafe_id',(cafes??[]).map(c=>c.id)) : {data:[],error:null};
  if(relatedError)throw new Error('Related records could not be loaded.');
  return (
    <>
      <PageHeader title="Cafes" />
      <div className="card overflow-x-auto">
        <table className="table min-w-[760px]">
          <thead><tr><th>Cafe</th><th>Status</th><th>Plan</th><th>Billing</th><th>Approved</th><th /></tr></thead>
          <tbody>
            {(cafes ?? []).slice(0,PAGE_SIZE).map((c) => {
              const s = subs?.find((x) => x.cafe_id === c.id);
              return (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td><Badge tone={c.status === 'active' ? 'good' : c.status === 'pending' ? 'warn' : 'bad'}>{c.status}</Badge></td>
                  <td className="capitalize">{c.tier}</td>
                  <td className="text-xs">{s?.status}{s?.current_period_end ? ` until ${formatDate(s.current_period_end)}` : s?.trial_ends_at ? ` until ${formatDate(s.trial_ends_at)}` : ''}</td>
                  <td>{formatDate(c.approved_at)}</td>
                  <td><CafeAdminActions cafeId={c.id} status={c.status} tier={c.tier} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination path="/admin/cafes" page={page} hasMore={(cafes?.length??0)>PAGE_SIZE} />
    </>
  );
}
