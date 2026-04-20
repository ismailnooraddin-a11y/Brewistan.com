import Link from "next/link";

export default function Header({ authed = false }: { authed?: boolean }) {
  return (
    <header className="border-b border-line bg-paper/80 backdrop-blur">
      <div className="container-pad flex h-16 items-center justify-between">
        <Link
          href={authed ? "/dashboard" : "/"}
          className="flex items-center gap-2"
        >
          <LogoMark />
          <span className="text-[17px] font-semibold tracking-tight text-ink">
            Brewistan
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          {authed ? (
            <form action="/auth/signout" method="post">
              <button className="btn-secondary" type="submit">
                Sign out
              </button>
            </form>
          ) : (
            <>
              <Link
                href="/signin"
                className="hidden rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex"
              >
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary">
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
    >
      <rect width="26" height="26" rx="7" fill="#1C1917" />
      <path
        d="M8 9h8a3 3 0 0 1 0 6h-1v1a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V9Zm7 2v3h1a1 1 0 1 0 0-2h-1Z"
        fill="#FAFAF9"
      />
    </svg>
  );
}
