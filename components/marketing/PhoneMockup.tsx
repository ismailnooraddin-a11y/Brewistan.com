const CARDS = [
  { name: 'Luna Café',   theme: 'theme-olive', plan: '8 stamp plan',  stamps: 3, total: 8,  perk: '25% off drink 8',  logo: 'L' },
  { name: 'Daily Bean',  theme: 'theme-gold',  plan: '10 stamp plan', stamps: 5, total: 10, perk: 'Free drink 10',    logo: 'D' },
  { name: 'Corner Cup',  theme: 'theme-rose',  plan: '12 stamp plan', stamps: 6, total: 12, perk: 'Pastry + drink',   logo: 'C' },
] as const;

export function PhoneMockup() {
  return (
    <div className="phone" aria-hidden="true">
      <div className="screen">
        <div className="screen-head">
          <div>
            <small>My Wallet</small>
            <h3>Loyalty Cards</h3>
          </div>
          <small>3 active</small>
        </div>
        {CARDS.map((c) => (
          <div key={c.name} className={`loyalty-card ${c.theme}`} data-watermark={c.name}>
            <div className="loyalty-card-top">
              <div>
                <div className="loyalty-card-sub">Brewistan card</div>
                <h4>{c.name}</h4>
              </div>
              <div className="logo-circle">{c.logo}</div>
            </div>
            <div className="dots" role="progressbar" aria-valuenow={c.stamps} aria-valuemin={0} aria-valuemax={c.total}>
              {Array.from({ length: c.total }).map((_, i) => (
                <span key={i} className={`dot ${i < c.stamps ? 'on' : ''}`} />
              ))}
            </div>
            <div className="loyalty-card-meta">
              <span>{c.stamps} / {c.total}</span>
              <span>{c.plan}</span>
            </div>
            <div className="loyalty-card-meta" style={{ marginTop: 4 }}>
              <span>Reward</span>
              <span>{c.perk}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
