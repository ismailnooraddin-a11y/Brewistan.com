import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { getCurrentProfile, getOwnedCafe } from '@/lib/queries';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/get-started');

  // Non-owners shouldn't see the owner dashboard
  if (profile.role === 'customer') {
    redirect('/wallet');
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="dash-main">{children}</main>
    </div>
  );
}
