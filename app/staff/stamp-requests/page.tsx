import { redirect } from 'next/navigation';
import { getStaffMembership, getOwnedCafe, getPendingRequests } from '@/lib/queries';
import { StampRequestsLive } from '@/components/dashboard/StampRequestsLive';

export const metadata = { title: 'Pending stamps · Staff' };
export const dynamic = 'force-dynamic';

export default async function StaffStampRequestsPage() {
  const membership = await getStaffMembership();
  const owned = await getOwnedCafe();

  const cafeRaw = membership?.cafe;
  const cafeMini = Array.isArray(cafeRaw) ? cafeRaw[0] : cafeRaw;
  const cafeId = cafeMini?.id ?? owned?.id ?? null;

  if (!cafeId) {
    redirect('/wallet');
  }

  const initialRequests = (await getPendingRequests(cafeId)) as never[];

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow">Live queue</div>
        <h1 style={{ fontSize: 26, marginTop: 4 }}>Pending stamps</h1>
        <p className="hint">Approve or reject each request as the customer orders.</p>
      </div>
      <StampRequestsLive cafeId={cafeId} initialRequests={initialRequests} />
    </>
  );
}
