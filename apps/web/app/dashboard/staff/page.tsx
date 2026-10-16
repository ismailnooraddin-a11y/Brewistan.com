import { Pagination } from '@/components/Pagination';
import { pageNumber } from '@/lib/pagination';
import { getT, requireOwnerContext } from '@/lib/server-context';
import { PageHeader } from '@/components/ui';
import { StaffManager } from './StaffManager';

export default async function StaffPage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const page=pageNumber((await searchParams).page);
  const { supabase, cafe } = await requireOwnerContext();
  const { t } = await getT();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const {data,error}=await supabase.rpc('owner_staff_page',{p_cafe:cafe.id,p_since:since,p_page:page});
  if(error) throw new Error('Staff could not be loaded.');
  return (
    <>
      <PageHeader
        title={t('staff.title')}
        description="Baristas receive a WhatsApp invite with the app link. Stamps by a new barista are flagged until you confirm them, or for 24 hours. Figures cover the last 30 days."
      />
      <StaffManager cafeId={cafe.id} staff={data.staff} branches={data.branches} />
      <Pagination path="/dashboard/staff" page={page} hasMore={data.hasMore}/>
    </>
  );
}
