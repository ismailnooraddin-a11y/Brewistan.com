import { Pagination } from '@/components/Pagination';
import { pageNumber, PAGE_SIZE } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Badge, EmptyState, formatDate, formatIqd } from '@/components/ui';
import { PaymentActions } from './PaymentActions';

export default async function AdminPayments({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const page=pageNumber((await searchParams).page); const from=(page-1)*PAGE_SIZE;
  const supabase = await createClient();
  const { data: reports,error: primaryError } = await supabase.from('payment_reports').select('*').order('created_at', { ascending: false }).order('id').range(from,from+PAGE_SIZE);
  if(primaryError)throw new Error('Records could not be loaded.');
  const { data: cafes,error: relatedError } = reports?.length ? await supabase.from('cafes').select('id, name').in('id',(reports??[]).map(r=>r.cafe_id)) : {data:[],error:null};
  if(relatedError)throw new Error('Related records could not be loaded.');
  const name = (id: string) => cafes?.find((c) => c.id === id)?.name ?? id;

  return (
    <>
      <PageHeader title="Payments" description="Check each reference in the Zain Cash or FIB merchant account before confirming." />
      {!reports?.length ? <EmptyState title="No payment reports" /> : (
        <div className="card overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead><tr><th>Date</th><th>Cafe</th><th>Method</th><th>Amount</th><th>Reference</th><th>Status</th><th /></tr></thead>
            <tbody>
              {reports.slice(0,PAGE_SIZE).map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.created_at, true)}</td>
                  <td>{name(r.cafe_id)}</td>
                  <td>{r.method}</td>
                  <td className="tabular-nums">{formatIqd(r.amount_iqd)} · {r.months} mo</td>
                  <td className="font-mono text-xs">{r.reference}</td>
                  <td><Badge tone={r.status === 'confirmed' ? 'good' : r.status === 'rejected' ? 'bad' : 'warn'}>{r.status}</Badge></td>
                  <td>{r.status === 'pending' && <PaymentActions reportId={r.id} legacy={!r.quote_id} amount={r.amount_iqd} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination path="/admin/payments" page={page} hasMore={(reports?.length??0)>PAGE_SIZE} />
    </>
  );
}
