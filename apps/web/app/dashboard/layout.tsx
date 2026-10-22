import { SidebarNav, CurrentPageLabel, type NavGroup } from '@/components/SidebarNav';
import { MobileNav } from '@/components/MobileNav';
import { AccountMenu } from '@/components/AccountMenu';
import { Wordmark } from '@/components/Wordmark';
import { getT, requireOwnerContext } from '@/lib/server-context';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { CafeSwitcher } from './CafeSwitcher';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { cafe, cafes } = await requireOwnerContext();
  const { locale, t } = await getT();

  const groups: NavGroup[] = [
    { title: t('nav.group.main'), items: [{ href: '/dashboard', label: t('nav.overview'), icon: 'overview' }] },
    {
      title: t('nav.group.marketing'),
      items: [
        { href: '/dashboard/campaign', label: t('nav.campaign'), icon: 'rewards' },
        { href: '/dashboard/branding', label: t('nav.branding'), icon: 'design' },
        { href: '/dashboard/push', label: t('nav.push'), icon: 'campaigns' },
      ],
    },
    {
      title: t('nav.group.cafe'),
      items: [
        { href: '/dashboard/branches', label: t('nav.branches'), icon: 'branches' },
        { href: '/dashboard/staff', label: t('nav.staff'), icon: 'staff' },
        { href: '/dashboard/customers', label: t('nav.customers'), icon: 'customers' },
        { href: '/dashboard/activity', label: t('nav.activity'), icon: 'scans' },
      ],
    },
    {
      title: t('nav.group.account'),
      items: [
        { href: '/dashboard/billing', label: t('nav.billing'), icon: 'billing' },
        // Verification is only needed until the cafe is approved.
        ...(cafe.status === 'active' ? [] : [{ href: '/dashboard/verification', label: t('nav.verification'), icon: 'verification' as const }]),
        { href: '/dashboard/account', label: t('nav.account'), icon: 'account' },
      ],
    },
  ];
  const switcher = <CafeSwitcher cafes={cafes.map((c) => ({ id: c.id, name: c.name }))} current={cafe.id} tier={cafe.tier} />;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <a className="skip-link" href="#main-content">Skip to content</a>

      <aside className="hidden border-e border-line bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="px-4 pb-4 pt-5">
          <Wordmark />
          <div className="mt-5">{switcher}</div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-6 [scrollbar-width:thin]">
          <SidebarNav groups={groups} />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-cream px-4 sm:px-6 lg:px-10">
          <MobileNav groups={groups} header={<Wordmark />} extra={switcher} />
          <div className="min-w-0 flex-1"><CurrentPageLabel groups={groups} /></div>
          <span className="hidden max-w-[220px] truncate text-[13.5px] text-ink-muted md:inline">{cafe.name}</span>
          <LocaleSwitcher current={locale} />
          <AccountMenu name={cafe.name} signOutLabel={t('nav.signout')} />
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
