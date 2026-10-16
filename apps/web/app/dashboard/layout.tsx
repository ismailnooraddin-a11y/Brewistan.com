import { SidebarNav } from '@/components/SidebarNav';
import { getT, requireOwnerContext } from '@/lib/server-context';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { CafeSwitcher } from './CafeSwitcher';
import type { MessageKey } from '@/lib/i18n';

const NAV: { href: string; key: MessageKey }[] = [
  { href: '/dashboard', key: 'nav.overview' },
  { href: '/dashboard/campaign', key: 'nav.campaign' },
  { href: '/dashboard/branches', key: 'nav.branches' },
  { href: '/dashboard/staff', key: 'nav.staff' },
  { href: '/dashboard/customers', key: 'nav.customers' },
  { href: '/dashboard/activity', key: 'nav.activity' },
  { href: '/dashboard/push', key: 'nav.push' },
  { href: '/dashboard/branding', key: 'nav.branding' },
  { href: '/dashboard/billing', key: 'nav.billing' },
  { href: '/dashboard/verification', key: 'nav.verification' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { cafe, cafes } = await requireOwnerContext();
  const { locale, t } = await getT();

  return (
    <div className="min-h-screen lg:flex">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="lg:flex lg:flex-col lg:overflow-y-auto border-b border-ink/10 bg-ink text-cream lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0">
        <div className="flex items-center justify-between px-5 py-5 lg:block">
          <div className="font-display text-2xl">Brewistan</div>
          <div className="lg:mt-4">
            <CafeSwitcher cafes={cafes.map((c) => ({ id: c.id, name: c.name }))} current={cafe.id} />
          </div>
        </div>
        <SidebarNav items={[...NAV.map((item) => ({ href: item.href, label: t(item.key) })),{href:'/dashboard/account',label:'Account & ownership'}]} />
        <div className="hidden px-5 py-6 lg:mt-auto lg:block lg:w-64">
          <form action="/logout" method="post">
            <button className="text-sm text-cream/60 hover:text-cream">{t('nav.signout')}</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-end gap-3 border-b border-ink/10 bg-white/60 px-4 py-3 sm:px-8">
          <span className="truncate text-sm text-ink-muted">{cafe.name}</span>
          <LocaleSwitcher current={locale} />
          <form action="/logout" method="post" className="lg:hidden">
            <button className="btn-ghost px-3 py-1.5">{t('nav.signout')}</button>
          </form>
        </header>
        <main id="main-content" tabIndex={-1} className="min-w-0 mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
