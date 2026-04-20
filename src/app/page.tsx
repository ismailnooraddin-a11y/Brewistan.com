import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper">
      <Header />

      <section className="container-pad pb-24 pt-20 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-5 text-[13px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Loyalty, without the plastic
          </p>
          <h1 className="text-[44px] font-semibold leading-[1.05] tracking-tight text-ink sm:text-hero">
            Turn every cup into a
            <br />
            reason to come back.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-[1.6] text-ink-soft">
            Brewistan is a digital stamp card built for independent cafés. Five
            minutes to set up, zero hardware, delightful for your customers.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn-primary">
              Start free
            </Link>
            <Link href="/signin" className="btn-secondary">
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      <section className="container-pad pb-24">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Feature
            title="Five-minute setup"
            body="Add your café, design a reward, done. No hardware, no contracts, no training."
          />
          <Feature
            title="Works on any phone"
            body="Customers scan a QR code from the counter. No app installs, no NFC chips, no friction."
          />
          <Feature
            title="Built for coffee"
            body="Stamp cards, birthday rewards, head-start stamps — the mechanics that actually bring customers back."
          />
        </div>
      </section>

      <section className="container-pad pb-28">
        <div className="mx-auto max-w-4xl rounded-2xl border border-line bg-white p-10 shadow-card">
          <h2 className="text-h2 text-ink">How it works</h2>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <Step n="1" title="Create your café">
              Sign up in under a minute. Add your logo, city, and opening hours.
            </Step>
            <Step n="2" title="Design your reward">
              Pick how many stamps it takes to earn a free drink. Customize the
              reward text.
            </Step>
            <Step n="3" title="Share your QR">
              Display a rotating QR at the counter. Customers scan, stamps
              appear. It&rsquo;s that simple.
            </Step>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-7 shadow-card">
      <h3 className="text-[17px] font-semibold tracking-tight text-ink">
        {title}
      </h3>
      <p className="mt-2 text-[15px] leading-[1.55] text-ink-soft">{body}</p>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full border border-line text-[13px] font-medium text-ink-soft">
        {n}
      </div>
      <h4 className="mb-1.5 text-[16px] font-semibold tracking-tight text-ink">
        {title}
      </h4>
      <p className="text-[14px] leading-[1.55] text-ink-soft">{children}</p>
    </div>
  );
}
