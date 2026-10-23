import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { PublicCafePage } from '@/components/customer/CafeEntry';

/** Public information for a café QR landing page (no login needed). */
export async function getPublicCafePage(cafeSlug: string, branchSlug: string | null): Promise<PublicCafePage | null> {
  if (!/^[a-z0-9-]{2,60}$/.test(cafeSlug) || (branchSlug !== null && !/^[a-z0-9-]{2,60}$/.test(branchSlug))) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc('public_cafe_page', { p_cafe_slug: cafeSlug, p_branch_slug: branchSlug });
  if (error || !data) return null;
  return data as PublicCafePage;
}
