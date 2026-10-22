"use client";
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarNav, type NavGroup } from './SidebarNav';

/** Below 1024px the sidebar becomes a drawer opened from the header. */
export function MobileNav({ groups, header, extra }: { groups: NavGroup[]; header: React.ReactNode; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="mobile-nav"
        className="grid h-9 w-9 place-items-center rounded-md text-ink-soft hover:bg-cream-deep" aria-label="Open navigation">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/25 motion-safe:animate-[fade_160ms_ease-out]" />
          <div id="mobile-nav"
            className="absolute inset-y-0 start-0 flex w-[272px] max-w-[85vw] flex-col overflow-y-auto border-e border-line bg-white px-3 pb-6 pt-4 shadow-pop">
            <div className="mb-4 flex items-center justify-between px-1">{header}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation"
                className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-cream-deep">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            {extra && <div className="mb-5">{extra}</div>}
            <SidebarNav groups={groups} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
