import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Admin' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin_user');
  if (!isAdmin) notFound();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') redirect('/admin/mfa');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-line bg-white px-4 py-3 sm:px-8">
        <span className="font-display text-lg font-semibold tracking-tight">Brewistan Admin</span>
        <nav aria-label="Administration" className="flex flex-wrap gap-1 text-sm">
          <Link href="/admin" className="rounded-md px-3 py-1.5 text-[13.5px] text-ink-soft hover:bg-cream-deep hover:text-ink">Review queue</Link>
          <Link href="/admin/cafes" className="rounded-md px-3 py-1.5 text-[13.5px] text-ink-soft hover:bg-cream-deep hover:text-ink">Cafes</Link>
          <Link href="/admin/payments" className="rounded-md px-3 py-1.5 text-[13.5px] text-ink-soft hover:bg-cream-deep hover:text-ink">Payments</Link>
          <Link href="/admin/ownership" className="rounded-md px-3 py-1.5 text-[13.5px] text-ink-soft hover:bg-cream-deep hover:text-ink">Transfers</Link>
          <Link href="/admin/operations" className="rounded-md px-3 py-1.5 text-[13.5px] text-ink-soft hover:bg-cream-deep hover:text-ink">Operations</Link>
        </nav>
        <form action="/logout" method="post" className="ms-auto">
          <button className="text-sm text-ink-muted hover:text-ink">Sign out</button>
        </form>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
