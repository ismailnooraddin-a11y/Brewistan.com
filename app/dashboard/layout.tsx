import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { getCurrentProfile, getOwnedCafe } from '@/lib/queries';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/get-started');

  // Customers go to their wallet.
  if (profile.role === 'customer') {
    redirect('/wallet');
  }

  // Staff (baristas + branch managers) get their own dedicated screen.
  // Owners (cafe_owner, admin) stay here.
  if (profile.role === 'barista' || profile.role === 'branch_manager') {
    // If they happen to also own a café, prefer the dashboard.
    const owned = await getOwnedCafe();
    if (!owned) redirect('/staff');
  }

  return (
    <div className="dashboard">
      <Sidebar />
      <main className="dash-main">{children}</main>
    </div>
  );
}
