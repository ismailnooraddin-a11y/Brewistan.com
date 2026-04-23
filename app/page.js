import Link from 'next/link';

const cards = [
  {
    cafe: 'Bean House',
    plan: '8 stamp plan',
    progress: '3 / 8',
    perk: '25% off on drink 3',
    filled: 3,
    total: 8,
    theme: 'theme-olive',
    initials: 'BH',
  },
  {
    cafe: 'Daily Cup',
    plan: '10 stamp plan',
    progress: '5 / 10',
    perk: '25% off on drink 5',
    filled: 5,
    total: 10,
    theme: 'theme-amber',
    initials: 'DC',
  },
  {
    cafe: 'City Brew',
    plan: '12 stamp plan',
    progress: '6 / 12',
    perk: '25% off on drink 6',
    filled: 6,
    total: 12,
    theme: 'theme-plum',
    initials: 'CB',
  },
];

const setupSteps = [
  {
    title: 'Create your café account',
    text: 'Add café name, address, phone number, choose sign in details, and open your dashboard.',
  },
  {
    title: 'Pick your campaign style',
    text: 'Start with 8, 10, or 12 stamps, then choose if you want the optional 25% reward milestone.',
  },
  {
    title: 'Generate your cashier QR',
    text: 'Place one QR near the cashier so customers can join, sign in, and request a stamp in seconds.',
  },
];

const dailyFlow = [
  'Customer scans the café QR near the cashier.',
  'If new, they sign up. If returning, they open their card directly.',
  'Customer taps request stamp.',
  'Barista approves from the staff phone view.',
  'Card updates instantly with the new progress and unlocked reward.',
];

const features = [
  'Custom card colors',
  'Your café logo',
  'Custom campaigns',
  '5 minutes to set up',
];

function LogoMark({ initials }) {
  return (
    <div className="logoMark" aria-hidden="true">
      <svg viewBox="0 0 48 48" className="logoSvg">
        <circle cx="24" cy="24" r="24" fill="currentColor" opacity="0.14" />
        <circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.42" />
        <path d="M15 27c3.3 4.7 14.7 4.7 18 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.72" />
        <path d="M19 20h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.72" />
      </svg>
      <span>{initials}</span>
    </div>
  );
}

function StampRow({ filled, total }) {
  return (
    <div className="stampRow" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`stampDot ${i < filled ? 'filled' : ''}`} />
      ))}
    </div>
  );
}

function Card({ cafe, plan, progress, perk, filled, total, theme, initials }) {
  return (
    <article className={`loyaltyCard ${theme}`}>
      <div className="cardTop">
        <div>
          <p className="cardMeta">Custom café card</p>
          <h3>{cafe}</h3>
        </div>
        <span className="pill">{plan}</span>
      </div>
      <div className="cardMid">
        <LogoMark initials={initials} />
        <div className="brandText">
          <span>Your colors</span>
          <span>Your style</span>
        </div>
      </div>
      <StampRow filled={filled} total={total} />
      <div className="cardBottom">
        <div>
          <p>Progress</p>
          <strong>{progress}</strong>
        </div>
        <div>
          <p>Reward</p>
          <strong>{perk}</strong>
        </div>
      </div>
    </article>
  );
}

function Header() {
  return (
    <header className="siteHeader shell">
      <Link href="/" className="brandLockup">
        <div className="brandBadge">B</div>
        <div>
          <p className="microLabel">Web loyalty platform</p>
          <strong>Brewistan</strong>
        </div>
      </Link>
      <nav className="navLinks">
        <a href="#features">Features</a>
        <a href="#setup">Setup</a>
        <a href="#daily-use">Daily use</a>
        <Link href="/get-started" className="navCta">Get started</Link>
      </nav>
    </header>
  );
}

export default function Home() {
  return (
    <main className="siteWrap">
      <Header />

      <section className="hero shell">
        <div className="heroCopyBlock">
          <p className="microLabel accent">Built for cafés in Iraq</p>
          <h1>Run a loyalty program that looks premium and works fast at the counter.</h1>
          <p className="lead">
            Brewistan gives cafés a clean web-based loyalty system that customers use on mobile while owners and staff manage everything from a simple dashboard.
          </p>

          <div className="heroActions">
            <Link href="/get-started" className="primaryBtn">Get started</Link>
            <a href="#setup" className="secondaryBtn">See how it works</a>
          </div>

          <div className="featurePills" id="features">
            {features.map((item) => (
              <span key={item} className="featurePill">{item}</span>
            ))}
          </div>

          <div className="heroNotes">
            <div className="noteCard">
              <h3>Why cafés like it</h3>
              <p>One QR near the cashier, branded cards for each café, flexible stamp plans, and a much cleaner process than paper cards.</p>
            </div>
            <div className="noteCard soft">
              <h3>What customers see</h3>
              <p>A mobile card wallet with all joined cafés in one place. No app download needed.</p>
            </div>
          </div>
        </div>

        <div className="heroVisualBlock">
          <div className="backGlow glowA" />
          <div className="backGlow glowB" />
          <div className="phoneFrame">
            <div className="notch" />
            <div className="phoneScreen">
              <div className="screenTop">
                <div>
                  <p className="microLabel">Customer mobile view</p>
                  <h2>My Cards</h2>
                </div>
                <span className="liveChip">Brand preview</span>
              </div>
              <div className="cardsScroller">
                {cards.map((card) => (
                  <Card key={card.cafe} {...card} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="contentSection shell" id="setup">
        <div className="sectionHeading">
          <p className="microLabel accent">How cafés start</p>
          <h2>From account creation to live QR in a few simple steps.</h2>
          <p>
            Setup is quick because the owner only needs to create the café account, choose the campaign style, and place the QR near the cashier.
          </p>
        </div>
        <div className="threeGrid">
          {setupSteps.map((step, i) => (
            <article className="infoCard" key={step.title}>
              <span className="stepNo">0{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="contentSection shell" id="daily-use">
        <div className="dailyWrap">
          <div className="sectionHeading compact">
            <p className="microLabel accent">Daily use</p>
            <h2>Simple at the counter, even when the café is busy.</h2>
            <p>
              Customers do the scan themselves. Staff only approves the request, so the daily flow stays quick and controlled.
            </p>
          </div>
          <div className="dailyPanel">
            {dailyFlow.map((item, i) => (
              <div className="dailyItem" key={item}>
                <span>{i + 1}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="contentSection shell">
        <div className="ctaPanel">
          <div>
            <p className="microLabel accent">Ready to launch</p>
            <h2>Create your café account and start building your branded card.</h2>
            <p>
              Owners can sign up with email, phone, or Google, add café details, and move directly into the setup flow.
            </p>
          </div>
          <div className="ctaButtons">
            <Link href="/get-started" className="primaryBtn">Create café account</Link>
            <Link href="/get-started" className="secondaryBtn">Café sign in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
