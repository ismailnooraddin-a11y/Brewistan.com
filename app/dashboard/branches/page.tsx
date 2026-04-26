import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOwnedCafe } from '@/lib/queries';
import { BranchesManager } from '@/components/dashboard/BranchesManager';

export default async function BranchesPage() {
  const cafe = await getOwnedCafe();
  if (!cafe) redirect('/dashboard');

  const supabase = await createClient();
  const { data: branches } = await supabase
    .from('branches')
    .select('*')
    .eq('cafe_id', cafe.id)
    .order('created_at', { ascending: true });

  return (
    <>
      <div className="dash-head">
        <div>
          <div className="eyebrow">Branches</div>
          <h1>Café locations</h1>
          <p className="hint">Track activity per branch. The first branch was created automatically when you signed up.</p>
        </div>
      </div>
      <BranchesManager cafeId={cafe.id} initialBranches={branches ?? []} />
    </>
  );
}
