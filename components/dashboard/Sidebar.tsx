'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell, Building2, Coffee, LayoutDashboard, LogOut, Palette, Settings, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type LinkItem = { label: string; href: string; Icon: LucideIcon };

const LINKS: LinkItem[] = [
  { label: 'Overview',       href: '/dashboard',                 Icon: LayoutDashboard },
  { label: 'Stamp requests', href: '/dashboard/stamp-requests',  Icon: Bell },
  { label: 'Brand & card',   href: '/dashboard/brand',           Icon: Palette },
  { label: 'Campaigns',      href: '/dashboard/campaigns',       Icon: Coffee },
  { label: 'Staff & roles',  href: '/dashboard/staff',           Icon: Users },
  { label: 'Branches',       href: '/dashboard/branches',        Icon: Building2 },
  { label: 'Settings',       href: '/dashboard/settings',        Icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="side-brand">Brewistan</div>
      {LINKS.map(({ label, href, Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
        return (
          <Link key={href} href={href} className={`side-link ${active ? 'active' : ''}`}>
            <Icon />
            {label}
          </Link>
        );
      })}
      <div className="side-foot">
        <form action="/auth/signout" method="post">
          <button type="submit" className="side-link" style={{ background: 'transparent', border: 0, width: '100%', cursor: 'pointer' }}>
            <LogOut />
            Sign out
          </button>
        </form>
        <small>Owner access</small>
      </div>
    </aside>
  );
}
