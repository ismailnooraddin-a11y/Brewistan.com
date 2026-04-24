import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentProfile, getCustomerCards } from '@/lib/queries';
import { LoyaltyCard } from '@/components/customer/LoyaltyCard';

export const metadata = { title: 'My wallet' };
export const dynamic = 'force-dynamic';

export default async function WalletPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/get-started?redirectTo=/wallet');

  const cards = await getCustomerCards(profile.id);

  return (
    <main className="wallet-wrap fade-in">
      <div className="wallet-head">
        <div>
          <div className="eyebrow">Hello, {profile.full_name.split(' ')[0]}</div>
          <h1>My wallet</h1>
          <p className="hint">{cards.length} active {cards.length === 1 ? 'card' : 'cards'}</p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="pill" type="submit">Sign out</button>
        </form>
      </div>

      {cards.length === 0 ? (
        <div className="empty">
          <h3>No cards yet</h3>
          <p>Scan a Brewistan QR code at your favourite café to start collecting stamps.</p>
        </div>
      ) : (
        <div>
          {cards.map((c: any) => {
            const cafeRaw = Array.isArray(c.cafe) ? c.cafe[0] : c.cafe;
            const campaignRaw = Array.isArray(c.campaign) ? c.campaign[0] : c.campaign;
            const cafe = cafeRaw as {
              id: string; slug: string; cafe_name: string;
              card_primary: string; card_secondary: string;
              watermark_on: boolean;
            } | null;
            const campaign = campaignRaw as {
              stamps_required: number; reward_text: string; status: string;
            } | null;
            if (!cafe || !campaign) return null;

            return (
              <Link key={c.id} href={`/c/${cafe.slug}`} style={{ display: 'block' }}>
                <LoyaltyCard
                  cafeName={cafe.cafe_name}
                  primary={cafe.card_primary}
                  secondary={cafe.card_secondary}
                  watermarkOn={cafe.watermark_on}
                  stamps={c.stamps_count}
                  stampsRequired={campaign.stamps_required}
                  rewardText={campaign.reward_text}
                  rewardsEarned={c.rewards_earned}
                  size="lg"
                />
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
