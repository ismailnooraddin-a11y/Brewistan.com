import { SidebarNav, type NavGroup } from '@/components/SidebarNav';
import { getT, requireOwnerContext } from '@/lib/server-context';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { CafeSwitcher } from './CafeSwitcher';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { cafe, cafes } = await requireOwnerContext();
  const { locale, t } = await getT();

  const groups: NavGroup[] = [
    { items: [{ href: '/dashboard', label: t('nav.overview'), icon: 'overview' }] },
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

  return (
    <div className="min-h-screen lg:flex">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="border-b border-black/[0.06] bg-white/70 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-e">
        <div className="flex items-center justify-between gap-4 px-5 pb-4 pt-5 lg:block">
          <div className="font-display text-[22px] font-semibold tracking-tight">Brewistan</div>
          <div className="min-w-0 lg:mt-4">
            <CafeSwitcher cafes={cafes.map((c) => ({ id: c.id, name: c.name }))} current={cafe.id} />
          </div>
        </div>
        <SidebarNav groups={groups} />
        <div className="hidden px-5 py-6 lg:mt-auto lg:block">
          <form action="/logout" method="post">
            <button className="text-sm text-ink-muted hover:text-ink">{t('nav.signout')}</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-end gap-3 border-b border-black/[0.06] bg-cream/75 px-4 py-3 backdrop-blur-xl sm:px-8">
          <span className="truncate text-sm font-medium text-ink-soft">{cafe.name}</span>
          <LocaleSwitcher current={locale} />
          <form action="/logout" method="post" className="lg:hidden">
            <button className="btn-ghost min-h-9 px-4 py-1.5 text-sm">{t('nav.signout')}</button>
          </form>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto min-w-0 max-w-6xl px-4 py-10 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
