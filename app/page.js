const cardData = [
  {
    cafe: 'Luna Cafe',
    model: '8 stamp plan',
    progress: '3 / 8',
    perk: '25% off on drink 3',
    dots: 8,
    filled: 3,
    theme: 'sage',
  },
  {
    cafe: 'Daily Bean',
    model: '10 stamp plan',
    progress: '5 / 10',
    perk: '25% off on drink 5',
    dots: 10,
    filled: 5,
    theme: 'sand',
  },
  {
    cafe: 'Corner Cup',
    model: '12 stamp plan',
    progress: '6 / 12',
    perk: '25% off on drink 6',
    dots: 12,
    filled: 6,
    theme: 'rose',
  },
];

const steps = [
  {
    number: '01',
    title: 'Create your café account',
    text: 'Owner signs up, adds café details, uploads a logo, and chooses the first loyalty plan.',
    meta: 'Estimated setup: 6–8 minutes',
  },
  {
    number: '02',
    title: 'Generate and place the QR',
    text: 'Brewistan creates one café QR to place near the cashier so customers can join in seconds.',
    meta: 'Estimated setup: under 2 minutes',
  },
  {
    number: '03',
    title: 'Customers scan and request a stamp',
    text: 'The customer opens the mobile page, signs in if needed, and taps to request a stamp.',
    meta: 'Customer action: 10–20 seconds',
  },
  {
    number: '04',
    title: 'Barista approves from phone',
    text: 'Staff sees the pending request on their mobile view and approves the correct customer instantly.',
    meta: 'Barista action: 3–5 seconds',
  },
];

const dailyFlow = [
  'Customer scans the QR near the cashier.',
  'If new, they create an account. If returning, they continue directly.',
  'A stamp request appears in the staff view.',
  'Barista approves the request from phone.',
  'The customer card updates immediately with the new progress.',
];

function StampRow({ dots, filled }) {
  return (
    <div className="stampRow" aria-hidden="true">
      {Array.from({ length: dots }).map((_, index) => (
        <span
          key={index}
          className={`stampDot ${index < filled ? 'filled' : ''}`}
        />
      ))}
    </div>
  );
}

function LoyaltyCard({ cafe, model, progress, perk, dots, filled, theme }) {
  return (
    <article className={`loyaltyCard ${theme}`}>
      <div className="cardTop">
        <div>
          <p className="cardLabel">Custom brand preview</p>
          <h3>{cafe}</h3>
        </div>
        <span className="cardBadge">{model}</span>
      </div>
      <div className="cardLogo">Logo</div>
      <StampRow dots={dots} filled={filled} />
      <div className="cardBottom">
        <div>
          <p className="miniLabel">Progress</p>
          <strong>{progress}</strong>
        </div>
        <div>
          <p className="miniLabel">Perk</p>
          <strong>{perk}</strong>
        </div>
      </div>
    </article>
  );
}

function ActionCard({ title, body, button, variant = 'light' }) {
  return (
    <article className={`actionCard ${variant}`}>
      <h3>{title}</h3>
      <p>{body}</p>
      <a href="#contact" className={variant === 'dark' ? 'primaryBtn' : 'secondaryBtn'}>{button}</a>
    </article>
  );
}

export default function HomePage() {
  return (
    <main className="pageShell">
      <header className="topbar">
        <div className="brandWrap">
          <div className="brandMark">B</div>
          <div>
            <p className="eyebrow">Web Loyalty Platform</p>
            <h1 className="brandName">Brewistan</h1>
          </div>
        </div>
        <nav className="topnav">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#for-cafes">For cafés</a>
          <a href="#auth">Get started</a>
        </nav>
      </header>

      <section className="heroSection">
        <div className="heroText">
          <p className="eyebrow">Built for modern cafés in Iraq</p>
          <h2>
            Turn every coffee run into a reason to come back.
          </h2>
          <p className="heroCopy">
            Brewistan gives cafés a polished loyalty website that customers use on mobile and teams manage from desktop or phone. No app download, no paper cards, and no messy process at the counter.
          </p>
          <div className="heroActions">
            <a href="#auth" className="primaryBtn">Create café account</a>
            <a href="#how-it-works" className="secondaryBtn">See how it works</a>
          </div>
          <div className="statsGrid">
            <div className="statBox">
              <span>6–8 min</span>
              <p>Estimated café setup time</p>
            </div>
            <div className="statBox">
              <span>10–20 sec</span>
              <p>Typical customer scan flow</p>
            </div>
            <div className="statBox">
              <span>3–5 sec</span>
              <p>Barista approval time</p>
            </div>
          </div>
        </div>

        <div className="heroVisual" id="cards">
          <div className="ambientGlow ambientGlowOne" />
          <div className="ambientGlow ambientGlowTwo" />
          <div className="phoneFrame">
            <div className="phoneNotch" />
            <div className="phoneScreen">
              <div className="phoneHeader">
                <div>
                  <p className="screenLabel">Customer mobile view</p>
                  <h3>My Brewistan Cards</h3>
                </div>
                <span className="livePill">Live style preview</span>
              </div>
              <div className="phoneCardsTrack">
                {cardData.map((card) => (
                  <LoyaltyCard key={card.cafe} {...card} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="featureSection" id="features">
        <div className="sectionIntro">
          <p className="eyebrow">Why it sells better</p>
          <h2>Cleaner onboarding, faster counter flow, and branding your customers actually notice.</h2>
          <p className="sectionCopy">
            The current concept needed stronger conversion points. This improved version adds clear paths for café signup, customer access, and explains the daily workflow in plain language.
          </p>
        </div>

        <div className="featureGrid">
          <article className="featureCard">
            <h3>Create a café in minutes</h3>
            <p>
              Owners can set up branding, choose an 8, 10, or 12-stamp model, and get the café QR ready quickly.
            </p>
          </article>
          <article className="featureCard">
            <h3>Better counter experience</h3>
            <p>
              Customers scan the café QR themselves, then the barista approves the request from a simple staff phone view.
            </p>
          </article>
          <article className="featureCard">
            <h3>Cards that match each café</h3>
            <p>
              Different layouts, colors, logos, and reward setups make each partner café feel branded instead of generic.
            </p>
          </article>
        </div>
      </section>

      <section className="authSection" id="auth">
        <div className="sectionIntro narrowIntro">
          <p className="eyebrow">Get started</p>
          <h2>Clear entry points for both cafés and customers.</h2>
        </div>
        <div className="actionGrid">
          <ActionCard
            title="Create café account"
            body="Register your café, upload your logo, choose your stamp plan, and generate the cashier QR. Best for owners starting with Brewistan."
            button="Start setup"
            variant="dark"
          />
          <ActionCard
            title="Café sign in"
            body="Already running Brewistan? Owners, managers, and baristas sign in here to manage requests, campaigns, and daily activity."
            button="Open dashboard"
          />
          <ActionCard
            title="Customer sign in"
            body="Customers can sign in with phone, email, or Google to see all cards, rewards, and history from one mobile account."
            button="Open customer view"
          />
        </div>
      </section>

      <section className="processSection" id="how-it-works">
        <div className="sectionIntro narrowIntro">
          <p className="eyebrow">How it works</p>
          <h2>Simple enough for a busy café, professional enough for a real brand.</h2>
        </div>
        <div className="timelineGrid">
          {steps.map((step) => (
            <div className="timelineItem" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              <small>{step.meta}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="forCafesSection" id="for-cafes">
        <div className="splitGrid">
          <div className="infoPanel">
            <p className="eyebrow">Daily café flow</p>
            <h2>What the team does every day.</h2>
            <ul className="flowList">
              {dailyFlow.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="infoPanel softPanel">
            <p className="eyebrow">Setup summary</p>
            <h2>What a new café needs to do.</h2>
            <div className="summaryRows">
              <div className="summaryRow"><span>Account creation</span><strong>1–2 min</strong></div>
              <div className="summaryRow"><span>Café details + logo</span><strong>2–3 min</strong></div>
              <div className="summaryRow"><span>Choose stamp model</span><strong>1 min</strong></div>
              <div className="summaryRow"><span>Generate QR + go live</span><strong>1–2 min</strong></div>
            </div>
            <p className="summaryNote">Estimated total time: about 6–8 minutes for a first café launch.</p>
          </div>
        </div>
      </section>

      <section className="contactSection" id="contact">
        <div className="contactCard">
          <p className="eyebrow">Ready to launch</p>
          <h2>Bring loyalty to the counter without adding friction.</h2>
          <p>
            Brewistan helps cafés look more premium, collect repeat visits, and keep the customer flow fast at the cashier.
          </p>
          <div className="heroActions centerActions">
            <a href="#auth" className="primaryBtn">Create café account</a>
            <a href="#features" className="secondaryBtn">View benefits</a>
          </div>
        </div>
      </section>
    </main>
  );
}
