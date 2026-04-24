import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOwnedCafe } from '@/lib/queries';
import { CampaignsManager } from '@/components/dashboard/CampaignsManager';

export default async function CampaignsPage() {
  const cafe = await getOwnedCafe();
  if (!cafe) redirect('/dashboard');

  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('cafe_id', cafe.id)
    .order('created_at', { ascending: false });

  return (
    <>
      <div className="dash-head">
        <div>
          <div className="eyebrow">Campaigns</div>
          <h1>Stamp plans &amp; rewards</h1>
          <p className="hint">Only one campaign can be active per café at a time.</p>
        </div>
      </div>
      <CampaignsManager cafeId={cafe.id} initialCampaigns={campaigns ?? []} />
    </>
  );
}
