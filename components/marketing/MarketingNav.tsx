'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  // Close menu on Escape and on route changes (route changes unmount the component anyway)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', onKey);
      // Lock background scroll while menu is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header className="container nav">
      <Link href="/" className="brand" onClick={() => setOpen(false)}>
        <span className="brand-mark">B</span>
        Brewistan
      </Link>

      {/* Desktop nav — hidden on mobile via CSS */}
      <nav className="navlinks navlinks-desktop">
        <a className="pill" href="#features">Features</a>
        <a className="pill" href="#flow">How it works</a>
        <Link className="pill" href="/get-started?tab=signin">Sign in</Link>
        <Link className="btn" href="/get-started">
          Get started <ArrowRight size={14} strokeWidth={2.25} />
        </Link>
      </nav>

      {/* Mobile hamburger — hidden on desktop via CSS */}
      <button
        type="button"
        className="nav-burger"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile slide-down panel */}
      <div
        id="mobile-nav-panel"
        className={`nav-mobile ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <a className="pill" href="#features" onClick={() => setOpen(false)}>Features</a>
        <a className="pill" href="#flow" onClick={() => setOpen(false)}>How it works</a>
        <Link className="pill" href="/get-started?tab=signin" onClick={() => setOpen(false)}>
          Sign in
        </Link>
        <Link className="btn" href="/get-started" onClick={() => setOpen(false)}>
          Get started <ArrowRight size={14} strokeWidth={2.25} />
        </Link>
      </div>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="nav-mobile-backdrop"
          onClick={() => setOpen(false)}
        />
      )}
    </header>
  );
}
