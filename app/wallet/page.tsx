import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentProfile, getCustomerCards, getCustomerActiveRedemptions } from '@/lib/queries';
import { LoyaltyCard } from '@/components/customer/LoyaltyCard';
import { RedeemRewardButton } from '@/components/customer/RedeemRewardButton';
import type { Database } from '@/lib/database.types';

export const metadata = { title: 'My wallet' };
export const dynamic = 'force-dynamic';

type CafeMini = Pick<
  Database['public']['Tables']['cafes']['Row'],
  'id' | 'slug' | 'cafe_name' | 'logo_url' | 'card_primary' | 'card_secondary'
  | 'card_text' | 'card_opacity' | 'watermark_on'
>;
type CampaignMini = Pick<
  Database['public']['Tables']['campaigns']['Row'],
  'id' | 'name' | 'stamps_required' | 'reward_text' | 'status' | 'deleted_at'
>;

type CardRow = {
  id: string;
  stamps_count: number;
  rewards_earned: number;
  updated_at: string;
  cafe: CafeMini | CafeMini[] | null;
  campaign: CampaignMini | CampaignMini[] | null;
};

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function WalletPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/get-started?redirectTo=/wallet');

  const [rawCards, redemptions] = await Promise.all([
    getCustomerCards(profile.id),
    getCustomerActiveRedemptions(),
  ]);

  const cards = rawCards as unknown as CardRow[];
  const firstName = profile.full_name?.split(' ')[0] ?? 'there';

  return (
    <main className="wallet-wrap fade-in">
      <div className="wallet-head">
        <div>
          <div className="eyebrow">Hello, {firstName}</div>
          <h1>My wallet</h1>
          <p className="hint">
            {cards.length} active {cards.length === 1 ? 'card' : 'cards'}
            {redemptions.length > 0 && (
              <> · {redemptions.length} reward{redemptions.length > 1 ? 's' : ''} ready to redeem</>
            )}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="pill" type="submit">Sign out</button>
        </form>
      </div>

      {redemptions.length > 0 && (
        <div className="panel" style={{ marginTop: 18, borderColor: '#e0c98a', background: 'linear-gradient(135deg, #fdf4e3 0%, #fffdf8 60%)' }}>
          <div className="eyebrow" style={{ color: '#8a6422' }}>Rewards waiting</div>
          <h3 style={{ marginTop: 6 }}>You have {redemptions.length} unredeemed reward{redemptions.length > 1 ? 's' : ''}</h3>
          <p>Tap a reward to redeem at the counter. Show the code to your barista.</p>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {redemptions.map((r: Database['public']['Tables']['reward_redemptions']['Row']) => (
              <RedeemRewardButton key={r.id} redemption={r} />
            ))}
          </div>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="empty">
          <h3>No cards yet</h3>
          <p>Scan a Brewistan QR code at your favourite café to start collecting stamps.</p>
        </div>
      ) : (
        <div>
          {cards.map((c) => {
            const cafe = pickOne(c.cafe);
            const campaign = pickOne(c.campaign);
            if (!cafe || !campaign) return null;
            // Skip cards whose campaign was soft-deleted by the café owner.
            if (campaign.deleted_at) return null;

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
                  logoUrl={cafe.logo_url}
                  cardText={cafe.card_text}
                  cardOpacity={cafe.card_opacity}
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
