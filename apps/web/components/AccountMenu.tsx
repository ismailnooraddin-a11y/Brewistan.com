"use client";
import { useEffect, useRef, useState } from 'react';

export function AccountMenu({ name, signOutLabel }: { name: string; signOutLabel: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}
        className="grid h-8 w-8 place-items-center rounded-full bg-cream-deep text-[13px] font-medium text-ink-soft ring-1 ring-line hover:bg-line"
        aria-label="Account">
        {initial}
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-10 z-30 w-52 rounded-lg border border-line bg-white p-1 shadow-pop">
          <div className="truncate px-3 py-2 text-[12px] text-ink-faint">{name}</div>
          <form action="/logout" method="post">
            <button role="menuitem" className="flex h-9 w-full items-center rounded-md px-3 text-start text-[13.5px] text-ink hover:bg-cream-deep">
              {signOutLabel}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
