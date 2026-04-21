"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "./Logo";

export default function Header({ authed = false }: { authed?: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ease-enter ${
        scrolled
          ? "bg-paper/85 backdrop-blur-md border-b border-line"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div
        className={`container-pad flex items-center justify-between transition-all duration-300 ease-enter ${
          scrolled ? "h-14" : "h-20"
        }`}
      >
        <Link
          href={authed ? "/dashboard" : "/"}
          className="group inline-flex items-center gap-2.5 text-ink"
        >
          <Logo className="h-7 w-7 transition-transform duration-300 ease-enter group-hover:rotate-[-6deg]" />
          <span className="text-[17px] font-semibold tracking-tight">
            Brewistan
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {authed ? (
            <form action="/auth/signout" method="post">
              <button type="submit" className="btn-secondary !py-2 !px-4 !text-[13px]">
                Sign out
              </button>
            </form>
          ) : (
            <>
              <Link
                href="/signin"
                className="hidden sm:inline-flex link-underline px-3 py-2 text-[14px]"
              >
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary !py-2 !px-4 !text-[13px]">
                Start free
                <span className="btn-arrow" aria-hidden>→</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
