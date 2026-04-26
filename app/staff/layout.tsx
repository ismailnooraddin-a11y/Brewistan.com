import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Coffee, ScanLine, Gift, LogOut } from 'lucide-react';
import { getCurrentProfile, getStaffMembership } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/get-started?redirectTo=/staff');

  // Customers shouldn't be here.
  if (profile.role === 'customer') redirect('/wallet');

  // Owners normally use /dashboard, but allow them to view /staff too.
  const membership = await getStaffMembership();

  // If non-owner with no staff membership, they were probably invited but
  // never accepted — bounce to wallet.
  if (!membership && profile.role !== 'cafe_owner' && profile.role !== 'admin') {
    redirect('/wallet');
  }

  const cafeRaw = membership?.cafe;
  const cafe = Array.isArray(cafeRaw) ? cafeRaw[0] : cafeRaw;
  const cafeName = cafe?.cafe_name ?? 'Brewistan';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--olive)',
          color: '#fffdf8',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Coffee size={18} />
          <div>
            <div style={{ fontSize: 11, opacity: 0.65, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Staff · {profile.role.replace('_', ' ')}</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{cafeName}</div>
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button
            className="pill"
            type="submit"
            style={{ color: '#fffdf8', borderColor: 'rgba(255,253,248,0.3)', background: 'transparent' }}
            aria-label="Sign out"
          >
            <LogOut size={13} />
          </button>
        </form>
      </header>

      <nav
        style={{
          display: 'flex',
          background: 'var(--panel)',
          borderBottom: '1px solid var(--line)',
          position: 'sticky',
          top: 60,
          zIndex: 9,
        }}
      >
        <Link
          href="/staff/stamp-requests"
          style={{
            flex: 1,
            padding: '14px 18px',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--ink)',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <ScanLine size={15} /> Stamps
        </Link>
        <Link
          href="/staff/redemptions"
          style={{
            flex: 1,
            padding: '14px 18px',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--ink)',
            fontSize: 14,
            fontWeight: 500,
            borderLeft: '1px solid var(--line)',
          }}
        >
          <Gift size={15} /> Rewards
        </Link>
      </nav>

      <main style={{ padding: '20px 16px 60px', maxWidth: 720, margin: '0 auto' }}>
        {children}
      </main>
    </div>
  );
}
