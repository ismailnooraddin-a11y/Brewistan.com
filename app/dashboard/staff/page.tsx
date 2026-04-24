import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOwnedCafe } from '@/lib/queries';
import { StaffManager } from '@/components/dashboard/StaffManager';

export default async function StaffPage() {
  const cafe = await getOwnedCafe();
  if (!cafe) redirect('/dashboard');

  const supabase = await createClient();
  const { data: staff } = await supabase
    .from('staff')
    .select(`
      id, role, is_active, branch_id, created_at,
      profile:profiles ( id, full_name, email, phone ),
      branch:branches ( id, name )
    `)
    .eq('cafe_id', cafe.id)
    .order('created_at', { ascending: false });

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('cafe_id', cafe.id)
    .eq('is_active', true);

  // Supabase infers one-to-many joins as arrays; normalise to the single rows we expect.
  const normalised = (staff ?? []).map((s: any) => ({
    ...s,
    profile: Array.isArray(s.profile) ? s.profile[0] ?? null : s.profile,
    branch: Array.isArray(s.branch) ? s.branch[0] ?? null : s.branch,
  }));

  return (
    <>
      <div className="dash-head">
        <div>
          <div className="eyebrow">Staff &amp; roles</div>
          <h1>Your team</h1>
          <p className="hint">Invite baristas and branch managers by email. They'll sign up and gain access automatically.</p>
        </div>
      </div>
      <StaffManager cafeId={cafe.id} initialStaff={normalised} branches={branches ?? []} />
    </>
  );
}
