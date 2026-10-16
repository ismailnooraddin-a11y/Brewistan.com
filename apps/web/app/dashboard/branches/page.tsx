import { getT, requireOwnerContext } from '@/lib/server-context';
import { PageHeader } from '@/components/ui';
import { BranchManager } from './BranchManager';

export default async function BranchesPage() {
  const { supabase, cafe } = await requireOwnerContext();
  const { t } = await getT();
  const { data: branches } = await supabase.from('branches').select('id, name, address, active').eq('cafe_id', cafe.id).order('created_at');
  return (
    <>
      <PageHeader title={t('branches.title')} description="Customer progress is shared across all branches of this cafe." />
      <BranchManager cafeId={cafe.id} branches={branches ?? []} />
    </>
  );
}
