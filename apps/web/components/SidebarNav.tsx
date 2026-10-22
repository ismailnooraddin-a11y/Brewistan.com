"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavIcon =
  | 'overview' | 'rewards' | 'design' | 'campaigns'
  | 'branches' | 'staff' | 'customers' | 'scans'
  | 'billing' | 'verification' | 'account';

export interface NavItem { href: string; label: string; icon: NavIcon }
export interface NavGroup { title: string; items: NavItem[] }

// 18px line icons, one consistent stroke.
const PATHS: Record<NavIcon, string> = {
  overview: 'M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z',
  rewards: 'M20 12v8H4v-8M3 8h18v4H3zM12 8v12M12 8H8.5a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8Zm0 0h3.5a2.5 2.5 0 1 0 0-5C13 3 12 8 12 8Z',
  design: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h4',
  campaigns: 'M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0',
  branches: 'M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  staff: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M22 19v-1a4 4 0 0 0-3-3.9M15 3.1a4 4 0 0 1 0 7.8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  customers: 'M20 20v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  scans: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10',
  billing: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18',
  verification: 'M12 3 5 6v5c0 4.4 3 8.4 7 9.5 4-1.1 7-5.1 7-9.5V6zM9 12l2 2 4-4',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0',
};

export function NavIconGlyph({ name, className = 'h-[18px] w-[18px]' }: { name: NavIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`} fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
}

export function SidebarNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="space-y-5">
      {groups.map((group) => (
        <div key={group.title}>
          <div className="px-2.5 pb-1 text-[11.5px] font-medium text-ink-faint">{group.title}</div>
          <ul className="space-y-px">
            {group.items.map(({ href, label, icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors duration-150 ${
                      active ? 'bg-gold-soft font-medium text-ink' : 'font-[450] text-ink-soft hover:bg-cream-deep hover:text-ink'
                    }`}
                  >
                    <span className={active ? 'text-gold' : 'text-ink-faint group-hover:text-ink-muted'}>
                      <NavIconGlyph name={icon} />
                    </span>
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Group and page label for the header ("Marketing / Card design"). */
export function CurrentPageLabel({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  let best: { group: string; label: string; len: number } | null = null;
  for (const g of groups) {
    for (const item of g.items) {
      if (isActivePath(pathname, item.href) && (!best || item.href.length > best.len)) {
        best = { group: g.title, label: item.label, len: item.href.length };
      }
    }
  }
  if (!best) return null;
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[13.5px]">
      <span className="hidden text-ink-faint sm:inline">{best.group}</span>
      <span className="hidden text-ink-faint/70 sm:inline" aria-hidden="true">/</span>
      <span className="truncate font-medium text-ink">{best.label}</span>
    </div>
  );
}
