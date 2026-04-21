import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StampCard from "@/components/StampCard";
import Marquee from "@/components/Marquee";
import Reveal from "@/components/Reveal";
import PhoneMockup from "@/components/PhoneMockup";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Header />

      {/* ============ HERO ============ */}
      <section className="relative">
        {/* Decorative background blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 h-[460px] w-[460px] rounded-full bg-ember/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-10%] top-40 h-[380px] w-[380px] rounded-full bg-paper-deep blur-3xl opacity-60"
        />

        <div className="container-pad relative grid grid-cols-1 items-center gap-14 pb-20 pt-14 md:grid-cols-[1.15fr_1fr] md:pb-28 md:pt-20">
          {/* Left: copy */}
          <div>
            <div className="stagger-child">
              <span className="eyebrow">Digital loyalty for cafés</span>
            </div>

            <h1 className="stagger-child mt-6 text-hero text-ink">
              Turn every cup
              <br />
              into a{" "}
              <span className="display-serif text-ember">reason</span>
              <br />
              to come back.
            </h1>

            <p className="stagger-child mt-7 max-w-md text-[17px] leading-[1.65] text-ink-soft">
              Brewistan is a stamp card built for independent coffee
              shops — five minutes to set up, zero hardware, and a ritual
              your regulars will actually look forward to.
            </p>

            <div className="stagger-child mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link href="/signup" className="btn-primary">
                Start free
                <span className="btn-arrow" aria-hidden>
                  →
                </span>
              </Link>
              <Link href="/signin" className="btn-ghost px-2 py-2">
                I already have an account
              </Link>
            </div>

            <div className="stagger-child mt-10 flex items-center gap-5 text-[13px] text-ink-muted">
              <div className="flex -space-x-2">
                {["#B8532C", "#D97748", "#8E3D1C", "#F3C48A"].map((c, i) => (
                  <span
                    key={i}
                    className="inline-block h-7 w-7 rounded-full border-2 border-paper-card"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <span>
                Joined by{" "}
                <span className="font-medium text-ink">200+ cafés</span>{" "}
                pouring slowly.
              </span>
            </div>
          </div>

          {/* Right: stamp card illustration */}
          <div className="stagger-child flex justify-center md:justify-end">
            <PhoneMockup>
<StampCard />
</PhoneMockup>
          </div>
        </div>
      </section>

      {/* ============ MARQUEE ============ */}
      <Marquee />

      {/* ============ FEATURES ============ */}
      <section id="features" className="container-pad py-24 md:py-32">
        <Reveal>
          <div className="max-w-2xl">
            <span className="eyebrow">What you get</span>
            <h2 className="mt-5 text-display text-ink">
              Built for the way{" "}
              <span className="display-serif text-ember">cafés</span>{" "}
              actually work.
            </h2>
            <p className="mt-5 max-w-lg text-[16px] leading-[1.65] text-ink-soft">
              No plastic cards. No app installs for your customers. No
              barista training sessions. Just the mechanics that bring
              people back.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          <Reveal delay={1}>
            <Feature
              icon={<IconClock />}
              title="Five-minute setup"
              body="Add your café, design a reward, done. No hardware, no contracts, no onboarding calls."
            />
          </Reveal>
          <Reveal delay={2}>
            <Feature
              icon={<IconPhone />}
              title="Works on any phone"
              body="Customers scan a rotating QR from the counter. No app installs. No NFC. No friction."
            />
          </Reveal>
          <Reveal delay={3}>
            <Feature
              icon={<IconCup />}
              title="Built for coffee"
              body="Stamp cards, birthday rewards, head-start stamps — the rituals that build regulars."
            />
          </Reveal>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section
        id="how-it-works"
        className="relative border-y border-line bg-paper-card/50"
      >
        <div className="container-pad py-24 md:py-32">
          <Reveal>
            <div className="grid grid-cols-1 items-end gap-8 md:grid-cols-[1fr_auto]">
              <div className="max-w-xl">
                <span className="eyebrow">How it works</span>
                <h2 className="mt-5 text-display text-ink">
                  Three steps, one{" "}
                  <span className="display-serif text-ember">
                    morning
                  </span>
                  .
                </h2>
              </div>
              <p className="max-w-sm text-[15px] leading-[1.6] text-ink-soft">
                Most café owners are live by the time they finish their
                second cortado.
              </p>
            </div>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            <Reveal delay={1}>
              <Step
                n="01"
                title="Create your café"
                body="Sign up in under a minute. Add your logo, city, and opening hours. We spin up your account instantly."
              />
            </Reveal>
            <Reveal delay={2}>
              <Step
                n="02"
                title="Design your reward"
                body="Pick how many stamps earn a free drink. Customize the text. Preview it before it goes live."
              />
            </Reveal>
            <Reveal delay={3}>
              <Step
                n="03"
                title="Share your QR"
                body="Display a rotating QR at the counter. Customers scan — stamps land on their card. That's it."
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ QUOTE ============ */}
      <section className="container-pad py-24 md:py-32">
        <Reveal>
          <figure className="mx-auto max-w-3xl text-center">
            <div
              aria-hidden
              className="display-serif mx-auto mb-6 text-[72px] leading-none text-ember"
            >
              &ldquo;
            </div>
            <blockquote className="display-serif text-[32px] leading-[1.3] text-ink md:text-[40px]">
              We dropped plastic punch cards the week we switched. Our
              regulars come back twice as often — and we finally know who
              they are.
            </blockquote>
            <figcaption className="mt-8 text-[14px] text-ink-muted">
              <span className="font-medium text-ink">Dilan A.</span>{" "}
              · owner, Mazîn Coffee, Erbil
            </figcaption>
          </figure>
        </Reveal>
      </section>

      {/* ============ CTA ============ */}
      <section className="container-pad pb-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-line bg-ink p-10 text-paper md:p-16">
            {/* Warm gradient wash */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-ember/40 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -left-16 h-72 w-72 rounded-full bg-ember-soft/20 blur-3xl"
            />

            <div className="relative grid grid-cols-1 items-center gap-10 md:grid-cols-[1.2fr_1fr]">
              <div>
                <span className="text-eyebrow uppercase text-ember-glow">
                  Ready when you are
                </span>
                <h2 className="mt-5 text-display">
                  Start building regulars
                  <br />
                  <span className="display-serif text-ember-glow">
                    tomorrow morning.
                  </span>
                </h2>
                <p className="mt-5 max-w-md text-[16px] leading-[1.6] text-paper/80">
                  Free while you try it. Upgrade when you&rsquo;re ready.
                  No card required.
                </p>
              </div>
              <div className="flex flex-col gap-3 md:items-end">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-ember px-7 py-3.5 text-[14px] font-medium text-paper transition-all duration-200 ease-enter hover:-translate-y-[1px] hover:bg-ember-soft hover:shadow-lift active:translate-y-0 active:scale-[0.98]"
                >
                  Create your café
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  href="/signin"
                  className="text-[13px] text-paper/70 underline decoration-paper/30 underline-offset-4 transition-colors hover:decoration-paper"
                >
                  Sign in instead
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}

/* ====================== Subcomponents ====================== */

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card-hoverable group h-full">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-paper-tint text-ember transition-colors duration-200 group-hover:bg-ember group-hover:text-paper">
        {icon}
      </div>
      <h3 className="text-[18px] font-semibold tracking-tight text-ink">
        {title}
      </h3>
      <p className="mt-2 text-[15px] leading-[1.6] text-ink-soft">{body}</p>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="group relative pt-10">
      <span className="display-serif absolute left-0 top-0 text-[56px] leading-none text-ember/40 transition-colors duration-300 group-hover:text-ember">
        {n}
      </span>
      <h3 className="text-[20px] font-semibold tracking-tight text-ink">
        {title}
      </h3>
      <p className="mt-3 text-[15px] leading-[1.65] text-ink-soft">{body}</p>
    </div>
  );
}

/* ====================== Icons ====================== */

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7 v5 l3 2" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="3" width="10" height="18" rx="2.5" />
      <path d="M11 18 h2" />
    </svg>
  );
}
function IconCup() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 9 h12 v7 a4 4 0 0 1 -4 4 h-4 a4 4 0 0 1 -4 -4 z" />
      <path d="M17 11 h2 a2.5 2.5 0 0 1 0 5 h-2" />
      <path d="M8 5 c 1 1.5 -1 2.5 0 4" />
      <path d="M11 4 c 1 1.5 -1 2.5 0 4" />
    </svg>
  );
}
