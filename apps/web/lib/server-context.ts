import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { isLocale, LOCALE_COOKIE, translate, type Locale, type MessageKey } from './i18n';

export const CAFE_COOKIE = 'bw_cafe';

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : 'en';
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: (key: MessageKey) => translate(locale, key) };
}

export interface OwnerCafe {
  slug: string;
  id: string;
  name: string;
  status: 'pending' | 'active' | 'rejected' | 'suspended' | 'closed';
  tier: 'classic' | 'signature' | 'bespoke';
  verification_code: string;
  verification_photo_path: string | null;
  instagram_url: string | null;
  rejection_reason: string | null;
  logo_path: string | null;
  brand: Record<string, string>;
}

/** The signed-in owner and the cafe they are currently managing. Redirects when missing. */
export async function requireOwnerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const list:OwnerCafe[]=[];let after:string|null=null;let pages=0;
  while(true){
    let query=supabase.from('cafes').select('id,name,slug,status,tier,verification_code,verification_photo_path,instagram_url,rejection_reason,logo_path,brand')
      .eq('owner_id',user.id).order('id').limit(500);
    if(after)query=query.gt('id',after);
    const {data,error}=await query;
    if(error)throw new Error('Your cafes could not be loaded. Please retry.');
    const rows=(data??[]) as OwnerCafe[];list.push(...rows);
    if(rows.length<500)break;
    after=rows[rows.length-1].id;
    if(++pages>200)throw new Error('Cafe list is unusually large; contact support. No partial selection was used.');
  }
  if(!list.length)redirect('/onboarding');

  const selected = (await cookies()).get(CAFE_COOKIE)?.value;
  const cafe = list.find((c) => c.id === selected) ?? list[0];
  return { supabase, user, cafe, cafes: list };
}
