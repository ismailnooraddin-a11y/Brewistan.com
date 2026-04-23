const cardData = [
  {
    cafe: 'Aurelian Roast',
    model: '8 Stamp Model',
    progress: '3 / 8',
    perk: '25% off on 3rd drink',
    dots: 8,
    filled: 3,
  },
  {
    cafe: 'North Ember Café',
    model: '10 Stamp Model',
    progress: '5 / 10',
    perk: '25% off on 5th drink',
    dots: 10,
    filled: 5,
  },
  {
    cafe: 'Velvet Cup House',
    model: '12 Stamp Model',
    progress: '6 / 12',
    perk: '25% off on 6th drink',
    dots: 12,
    filled: 6,
  },
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

function LoyaltyCard({ cafe, model, progress, perk, dots, filled }) {
  return (
    <article className="loyaltyCard">
      <div className="cardTop">
        <div>
          <p className="cardLabel">Brewistan Partner Café</p>
          <h3>{cafe}</h3>
        </div>
        <span className="cardBadge">{model}</span>
      </div>
      <StampRow dots={dots} filled={filled} />
      <div className="cardBottom">
        <div>
          <p className="miniLabel">Progress</p>
          <strong>{progress}</strong>
        </div>
        <div>
          <p className="miniLabel">Reward</p>
          <strong>{perk}</strong>
        </div>
      </div>
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
          <a href="#how-it-works">How it Works</a>
          <a href="#cards">Card Models</a>
        </nav>
      </header>

      <section className="heroSection">
        <div className="heroText">
          <p className="eyebrow">Elegant. Bright. Built for cafés.</p>
          <h2>
            A premium loyalty experience for coffee brands, designed for mobile customers and café teams.
          </h2>
          <p className="heroCopy">
            Brewistan helps cafés launch refined stamp-based rewards without an app download. Customers use a mobile web experience, while cafés manage campaigns from a polished desktop dashboard.
          </p>
          <div className="heroActions">
            <a href="#cards" className="primaryBtn">View Card Models</a>
            <a href="#features" className="secondaryBtn">Explore Features</a>
          </div>
          <div className="statsGrid">
            <div className="statBox">
              <span>8 / 10 / 12</span>
              <p>Flexible stamp models</p>
            </div>
            <div className="statBox">
              <span>Mobile First</span>
              <p>Customer-facing web journey</p>
            </div>
            <div className="statBox">
              <span>Desktop Ready</span>
              <p>Café backend for staff and owners</p>
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
                  <p className="screenLabel">My Loyalty Cards</p>
                  <h3>Brewistan Wallet</h3>
                </div>
                <span className="livePill">Live Preview</span>
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
          <p className="eyebrow">Why Brewistan works</p>
          <h2>Designed to feel premium without wasting space or attention.</h2>
        </div>

        <div className="featureGrid">
          <article className="featureCard">
            <h3>Bright, elegant visual language</h3>
            <p>
              A refined ivory canvas, deep olive accents, and muted gold highlights create a premium café-tech feeling without harsh brightness.
            </p>
          </article>
          <article className="featureCard">
            <h3>Customer mobile experience</h3>
            <p>
              Customers scan a QR near the cashier, sign in on phone, and instantly view their loyalty cards, stamps, and reward progress.
            </p>
          </article>
          <article className="featureCard">
            <h3>Café desktop management</h3>
            <p>
              Owners and staff manage campaigns, approvals, and insights from a clean backend layout that is also usable on smaller devices.
            </p>
          </article>
        </div>
      </section>

      <section className="processSection" id="how-it-works">
        <div className="sectionIntro narrowIntro">
          <p className="eyebrow">How it works</p>
          <h2>Simple for the customer. Controlled for the café.</h2>
        </div>
        <div className="timelineGrid">
          <div className="timelineItem">
            <span>01</span>
            <h3>Customer scans café QR</h3>
            <p>The QR lives near the cashier and opens Brewistan on the customer’s phone.</p>
          </div>
          <div className="timelineItem">
            <span>02</span>
            <h3>Sign in or create account</h3>
            <p>Customers use phone, email, or Google and can always recover their card later.</p>
          </div>
          <div className="timelineItem">
            <span>03</span>
            <h3>Barista approves the stamp</h3>
            <p>Staff confirm the request from their own device, keeping the process controlled and secure.</p>
          </div>
          <div className="timelineItem">
            <span>04</span>
            <h3>Reward progress updates</h3>
            <p>The customer sees their active cards and reward milestones in one clean mobile view.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
