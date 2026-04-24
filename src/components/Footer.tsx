import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="relative border-t border-line bg-paper-tint/40">
      <div className="container-pad py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Logo className="h-7 w-7" />
              <span className="text-[17px] font-semibold tracking-tight text-ink">
                Brewistan
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-[14px] leading-[1.6] text-ink-soft">
              Loyalty, <span className="display-serif text-ink">poured slowly</span>.
              Made for independent cafés, one cup at a time.
            </p>
          </div>

          <FooterCol
            title="Product"
            links={[
              { label: "How it works", href: "/#how-it-works" },
              { label: "Features", href: "/#features" },
              { label: "Pricing", href: "/#pricing" },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { label: "About", href: "#" },
              { label: "Contact", href: "mailto:hello@brewistan.com" },
              { label: "Careers", href: "#" },
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              { label: "Privacy", href: "#" },
              { label: "Terms", href: "#" },
            ]}
          />
        </div>

        <div className="mt-12 hr-ornament">
          <span className="text-[11px] uppercase tracking-[0.18em]">est. 2026</span>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-3 text-[13px] text-ink-muted sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Brewistan. All rights reserved.</p>
          <p className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-ember animate-pulse" />
            Brewed in the Kurdistan Region
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="mb-4 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
        {title}
      </p>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-[14px] text-ink-soft transition-colors hover:text-ember"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
