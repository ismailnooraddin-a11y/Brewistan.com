"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export function SidebarNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
    {items.map(({ href, label }) => {
      const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
      return <Link key={href} href={href} aria-current={active ? 'page' : undefined}
        className={`min-h-11 whitespace-nowrap rounded-lg px-3 py-3 text-sm ${active ? 'bg-cream font-semibold text-ink' : 'text-cream/80 hover:bg-white/10 hover:text-cream'}`}>
        {label}</Link>;
    })}
  </nav>;
}
