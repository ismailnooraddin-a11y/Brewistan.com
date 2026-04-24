import { createClient } from '@/lib/supabase/server';

export async function getCurrentProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return profile;
}

export async function getOwnedCafe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('cafes').select('*').eq('owner_id', user.id).limit(1).maybeSingle();
  return data;
}

export async function getCafeBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('cafes')
    .select('*')
    .eq('slug', slug.toLowerCase())
    .eq('is_active', true)
    .maybeSingle();
  return data;
}

export async function getActiveCampaign(cafeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('campaigns')
    .select('*')
    .eq('cafe_id', cafeId)
    .eq('status', 'active')
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getCustomerCards(customerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('loyalty_cards')
    .select(`
      id, stamps_count, rewards_earned, updated_at,
      cafe:cafes ( id, slug, cafe_name, logo_url, card_primary, card_secondary, card_text, card_opacity, watermark_on ),
      campaign:campaigns ( id, name, stamps_required, reward_text, status )
    `)
    .eq('customer_id', customerId)
    .order('updated_at', { ascending: false });
  return data ?? [];
}

export async function getPendingRequests(cafeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('stamp_requests')
    .select(`
      id, requested_at, expires_at, customer_id,
      customer:profiles ( full_name ),
      card:loyalty_cards ( stamps_count, campaign:campaigns ( stamps_required, reward_text ) )
    `)
    .eq('cafe_id', cafeId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });
  return data ?? [];
}

export async function getCafeStats(cafeId: string) {
  const supabase = await createClient();
  const [customers, pending, campaigns] = await Promise.all([
    supabase.from('loyalty_cards').select('customer_id', { count: 'exact', head: true }).eq('cafe_id', cafeId),
    supabase.from('stamp_requests').select('id', { count: 'exact', head: true }).eq('cafe_id', cafeId).eq('status', 'pending'),
    supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('cafe_id', cafeId).eq('status', 'active'),
  ]);
  return {
    customers: customers.count ?? 0,
    pending: pending.count ?? 0,
    activeCampaigns: campaigns.count ?? 0,
  };
}
