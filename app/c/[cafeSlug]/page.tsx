import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { getCafeBySlug, getActiveCampaign, getCurrentProfile } from '@/lib/queries';
import { LoyaltyCard } from '@/components/customer/LoyaltyCard';
import { CustomerStampButton } from '@/components/customer/CustomerStampButton';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params }: { params: Promise<{ cafeSlug: string }> }) {
  const { cafeSlug } = await params;
  const cafe = await getCafeBySlug(cafeSlug);
  return {
    title: cafe ? `${cafe.cafe_name} on Brewistan` : 'Brewistan',
    description: cafe ? `Collect loyalty stamps at ${cafe.cafe_name}.` : undefined,
  };
}

export default async function CafeScanPage({ params }: { params: Promise<{ cafeSlug: string }> }) {
  const { cafeSlug } = await params;
  const cafe = await getCafeBySlug(cafeSlug);
  if (!cafe) notFound();

  const campaign = await getActiveCampaign(cafe.id);
  const profile = await getCurrentProfile();

  // If signed in, try to fetch their card for this campaign
  let card: { stamps_count: number; rewards_earned: number } | null = null;
  if (profile && campaign) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('loyalty_cards')
      .select('stamps_count, rewards_earned')
      .eq('customer_id', profile.id)
      .eq('campaign_id', campaign.id)
      .maybeSingle();
    card = data;
  }

  return (
    <main className="wallet-wrap fade-in">
      <div className="wallet-head">
        <div>
          <div className="eyebrow">Welcome to</div>
          <h1>{cafe.cafe_name}</h1>
          <p className="hint">{cafe.city} · {cafe.address}</p>
        </div>
        <Link href="/" className="pill">Brewistan</Link>
      </div>

      {!campaign ? (
        <div className="empty" style={{ marginTop: 24 }}>
          <h3>No active loyalty campaign</h3>
          <p>This café hasn't launched a loyalty program yet. Check back soon.</p>
        </div>
      ) : (
        <>
          <LoyaltyCard
            cafeName={cafe.cafe_name}
            primary={cafe.card_primary}
            secondary={cafe.card_secondary}
            watermarkOn={cafe.watermark_on}
            stamps={card?.stamps_count ?? 0}
            stampsRequired={campaign.stamps_required}
            rewardText={campaign.reward_text}
            rewardsEarned={card?.rewards_earned ?? 0}
            size="lg"
          />

          {!profile ? (
            <div className="panel" style={{ marginTop: 14 }}>
              <h3>Start collecting stamps</h3>
              <p>Sign up in 20 seconds to collect your first stamp.</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <Link className="btn" href={`/get-started?redirectTo=${encodeURIComponent(`/c/${cafeSlug}`)}`}>
                  Sign up <ArrowRight size={14} />
                </Link>
                <Link className="btn btn-secondary" href={`/get-started?redirectTo=${encodeURIComponent(`/c/${cafeSlug}`)}`}>
                  I have an account
                </Link>
              </div>
            </div>
          ) : profile.role === 'customer' ? (
            <CustomerStampButton cafeSlug={cafeSlug} cafeName={cafe.cafe_name} />
          ) : (
            <div className="panel" style={{ marginTop: 14 }}>
              <h3>You're signed in as staff</h3>
              <p>Staff accounts can't collect stamps. Ask a customer to sign up on their own device.</p>
              <Link href="/dashboard" className="btn btn-secondary" style={{ marginTop: 12 }}>
                Go to dashboard
              </Link>
            </div>
          )}

          {profile?.role === 'customer' && (
            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <Link href="/wallet" className="pill">View all my cards →</Link>
            </div>
          )}
        </>
      )}
    </main>
  );
}
