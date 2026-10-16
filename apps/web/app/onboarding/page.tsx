import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/server-context';
import { OnboardingForm } from './OnboardingForm';

export const metadata = { title: 'Register your cafe' };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { new: addAnother } = await searchParams;

  const { count } = await supabase.from('memberships').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('role', 'owner').eq('status', 'active');
  if ((count ?? 0) > 0 && !addAnother) redirect('/dashboard');

  const { data: profile } = await supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single();
  const { t } = await getT();

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-8">
        <div className="font-display text-3xl">Brewistan</div>
        <h1 className="mt-6 text-2xl font-semibold">{t('onboarding.title')}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Brewistan is for premium cafes. After you register, our team reviews your cafe within two working days.
          Your 14-day free trial starts when you are approved.
        </p>
      </div>
      <Link href="/ownership" className="btn-ghost mb-4">Review ownership transfer invitations</Link>
      <OnboardingForm firstName={profile?.first_name ?? ''} lastName={profile?.last_name ?? ''} userId={user.id} />
    </main>
  );
}
