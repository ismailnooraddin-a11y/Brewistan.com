import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MfaForm } from './MfaForm';

export const metadata = { title: 'Admin verification' };

export default async function MfaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin_user');
  if (!isAdmin) notFound();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2') redirect('/admin');
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === 'verified');

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-xl font-semibold">Admin verification</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {verified ? 'Enter the code from your authenticator app.' : 'Set up an authenticator app. Admin access always needs it.'}
        </p>
        <MfaForm factorId={verified?.id ?? null} />
      </div>
    </main>
  );
}
