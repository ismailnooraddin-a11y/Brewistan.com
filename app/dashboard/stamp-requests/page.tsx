import { redirect } from 'next/navigation';
import { getOwnedCafe, getPendingRequests } from '@/lib/queries';
import { StampRequestsLive } from '@/components/dashboard/StampRequestsLive';

export const dynamic = 'force-dynamic';

export default async function StampRequestsPage() {
  const cafe = await getOwnedCafe();
  if (!cafe) redirect('/dashboard');

  const initial = await getPendingRequests(cafe.id);

  // Normalise Supabase array-joins to single-object expected by the component
  const normalised = initial.map((r: any) => ({
    ...r,
    customer: Array.isArray(r.customer) ? r.customer[0] ?? null : r.customer,
    card: Array.isArray(r.card)
      ? (r.card[0]
          ? {
              ...r.card[0],
              campaign: Array.isArray(r.card[0].campaign) ? r.card[0].campaign[0] ?? null : r.card[0].campaign,
            }
          : null)
      : (r.card
          ? {
              ...r.card,
              campaign: Array.isArray(r.card.campaign) ? r.card.campaign[0] ?? null : r.card.campaign,
            }
          : null),
  }));

  return (
    <>
      <div className="dash-head">
        <div>
          <div className="eyebrow">Live approvals</div>
          <h1>Stamp requests</h1>
          <p className="hint">Customers appear here when they tap <em>Request stamp</em>. Approve or reject — it's instant.</p>
        </div>
      </div>
      <StampRequestsLive cafeId={cafe.id} initialRequests={normalised} />
    </>
  );
}
