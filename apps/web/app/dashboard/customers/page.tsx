import { Pagination } from '@/components/Pagination';
import { pageNumber } from '@/lib/pagination';
import { getT, requireOwnerContext } from '@/lib/server-context';
import { PageHeader, EmptyState, Badge, formatDate } from '@/components/ui';

interface CustomerRow {
  customer_ref: string;
  display_name: string;
  total_stamps: number;
  stamps_in_current: number;
  completed_puzzles: number;
  available_rewards: number;
  last_visit: string | null;
  archived: boolean;
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { supabase, cafe } = await requireOwnerContext();
  const { t } = await getT();
  const { q, page: rawPage } = await searchParams;
  const page = pageNumber(rawPage); const query = (q ?? '').trim().slice(0,100);
  const {data,error} = await supabase.rpc('owner_customers_page',{p_cafe:cafe.id,p_page:page,p_query:query});
  if(error) throw new Error('Customers could not be loaded. Please retry.');
  const rows = (data?.rows ?? []) as CustomerRow[];

  return (
    <>
      <PageHeader
        title={t('customers.title')}
        description="Customers appear by first name and last initial. Phone numbers are never shown, so all messages go through Brewistan notifications."
      />
      <form className="mb-4 max-w-sm">
        <label htmlFor="customer-search" className="label">Search by name or reference</label><input id="customer-search" name="q" defaultValue={query} maxLength={100} className="input" /><button className="btn-ghost mt-2">Search</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title={query ? "No matching customers" : "No customers on this page"}>Customers appear here after their first stamp at any of your branches.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead>
              <tr><th>Customer</th><th>Reference</th><th>Puzzle</th><th>Completed</th><th>Rewards waiting</th><th>Last visit</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.customer_ref}>
                  <td className="font-medium">{r.display_name} {r.archived && <Badge>archived</Badge>}</td>
                  <td className="font-mono text-xs text-ink-muted">{r.customer_ref}</td>
                  <td className="tabular-nums">{r.stamps_in_current} pieces</td>
                  <td className="tabular-nums">{r.completed_puzzles}</td>
                  <td className="tabular-nums">{r.available_rewards}</td>
                  <td>{formatDate(r.last_visit, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-muted">{data.total} matching customers</p>
        </div>
      )}
      <Pagination path="/dashboard/customers" page={page} hasMore={data?.hasMore === true} query={query} />
    </>
  );
}
