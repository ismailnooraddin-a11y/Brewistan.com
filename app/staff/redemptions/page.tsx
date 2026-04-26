import { redirect } from 'next/navigation';
import { getStaffMembership, getOwnedCafe, getCafePendingRedemptions } from '@/lib/queries';
import { StaffRedemptionsLive } from '@/components/staff/StaffRedemptionsLive';

export const metadata = { title: 'Reward redemptions · Staff' };
export const dynamic = 'force-dynamic';

export default async function StaffRedemptionsPage() {
  const membership = await getStaffMembership();
  const owned = await getOwnedCafe();

  const cafeRaw = membership?.cafe;
  const cafeMini = Array.isArray(cafeRaw) ? cafeRaw[0] : cafeRaw;
  const cafeId = cafeMini?.id ?? owned?.id ?? null;

  if (!cafeId) redirect('/wallet');

  const initial = await getCafePendingRedemptions(cafeId);

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow">Confirm at counter</div>
        <h1 style={{ fontSize: 26, marginTop: 4 }}>Reward redemptions</h1>
        <p className="hint">When a customer shows you their reward code, find them here and tap Confirm.</p>
      </div>
      <StaffRedemptionsLive cafeId={cafeId} initial={initial} />
    </>
  );
}
