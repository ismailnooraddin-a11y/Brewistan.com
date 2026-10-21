"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavIcon =
  | 'overview' | 'rewards' | 'design' | 'campaigns'
  | 'branches' | 'staff' | 'customers' | 'scans'
  | 'billing' | 'verification' | 'account';

export interface NavGroup {
  title?: string;
  items: { href: string; label: string; icon: NavIcon }[];
}

// Small line icons in the spirit of SF Symbols.
const PATHS: Record<NavIcon, string> = {
  overview: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z',
  rewards: 'M20 12v8H4v-8m16 0H4m16 0h1V8H3v4h1m8-4v12m0-12H8.5a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8Zm0 0h3.5a2.5 2.5 0 1 0 0-5C13 3 12 8 12 8Z',
  design: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 3h18M7 15h4',
  campaigns: 'M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9',
  branches: 'M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  staff: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1m20 0v-1a4 4 0 0 0-3-3.9M15 3.1a4 4 0 0 1 0 7.8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  customers: 'M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1m12-14a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  scans: 'M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3m0 8v3a1 1 0 0 1-1 1h-3m-8 0H5a1 1 0 0 1-1-1v-3m3-4h10',
  billing: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 3h18',
  verification: 'M12 3 5 6v5c0 4.4 3 8.4 7 9.5 4-1.1 7-5.1 7-9.5V6l-7-3Zm-3 9 2 2 4-4',
  account: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
};

function Icon({ name }: { name: NavIcon }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] shrink-0" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:overflow-visible lg:pb-6">
      {groups.map((group, gi) => (
        <div key={gi} className="flex gap-1 lg:mt-5 lg:block lg:first:mt-0">
          {group.title && (
            <div className="hidden px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-ink-muted lg:block">{group.title}</div>
          )}
          {group.items.map(({ href, label, icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                className={`flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2 text-[14px] transition-colors lg:mb-0.5 ${
                  active ? 'bg-gold/10 font-medium text-gold' : 'text-ink-soft hover:bg-ink/[0.05] hover:text-ink'}`}>
                <Icon name={icon} />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
