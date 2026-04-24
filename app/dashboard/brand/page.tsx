import { redirect } from 'next/navigation';
import { getOwnedCafe, getActiveCampaign } from '@/lib/queries';
import { BrandEditor } from '@/components/dashboard/BrandEditor';

export default async function BrandPage() {
  const cafe = await getOwnedCafe();
  if (!cafe) redirect('/dashboard');

  const campaign = await getActiveCampaign(cafe.id);
  const qrUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/c/${cafe.slug}`;

  return (
    <>
      <div className="dash-head">
        <div>
          <div className="eyebrow">Brand & card</div>
          <h1>Design your loyalty card</h1>
          <p className="hint">Changes update everywhere customers see your card.</p>
        </div>
      </div>
      <BrandEditor cafe={cafe} campaign={campaign} qrUrl={qrUrl} />
    </>
  );
}
