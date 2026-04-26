import Link from 'next/link';
import { ArrowRight, Palette, QrCode, ShieldCheck, Sparkles, UserCheck, Zap } from 'lucide-react';
import { MarketingNav } from '@/components/marketing/MarketingNav';

export default function Home() {
  return (
    <main>
      <MarketingNav />

      <section className="container hero">
        <div className="hero-copy fade-in">
          <div className="eyebrow">Built for cafés in Iraq</div>
          <h1 className="h-display">
            A loyalty wallet<br />your customers <em>actually</em> use.
          </h1>
          <p className="lead">
            Brewistan replaces paper punch cards with a branded digital wallet.
            Customers scan one QR at the counter, collect stamps, and return for rewards —
            no app install, no fuss.
          </p>
          <div className="actions">
            <Link className="btn" href="/get-started">
              Open your café <ArrowRight size={14} strokeWidth={2.25} />
            </Link>
            <a className="btn btn-secondary" href="#flow">See how it works</a>
          </div>
          <div className="feature-row">
            <div className="mini">
              <strong>5 min setup</strong>
              <span>Account, branding, first campaign — done.</span>
            </div>
            <div className="mini">
              <strong>Your brand</strong>
              <span>Logo, colors, and a watermark card design.</span>
            </div>
            <div className="mini">
              <strong>Flexible plans</strong>
              <span>8, 10, 12 or custom stamp campaigns.</span>
            </div>
            <div className="mini">
              <strong>Staff approval</strong>
              <span>Barista approves stamps from their phone.</span>
            </div>
          </div>
        </div>
        <div className="phone-wrap">
          <img
            src="/images/hero-phone.png"
            alt="Brewistan loyalty card on a phone"
            className="w-[320px] md:w-[380px] lg:w-[420px] rounded-[40px] shadow-2xl"
          />
        </div>
      </section>

      <section id="features" className="container section">
        <div className="section-head">
          <div className="eyebrow">What you get</div>
          <h2>Everything a modern café needs — nothing it doesn't.</h2>
          <p>A focused toolkit designed around the cashier counter. No bloated features, no hardware.</p>
        </div>
        <div className="grid-3">
          <div className="panel">
            <div className="icon-box"><Palette /></div>
            <h3>Branded cards</h3>
            <p>Every café gets a card designed around their identity. Choose primary and accent colors, upload a logo, and a watermark makes the café name feel engraved.</p>
          </div>
          <div className="panel">
            <div className="icon-box"><QrCode /></div>
            <h3>Single QR, zero friction</h3>
            <p>One QR code lives on the counter. Customers scan, sign up once, and their card follows them on any phone — no app install needed.</p>
          </div>
          <div className="panel">
            <div className="icon-box"><ShieldCheck /></div>
            <h3>Fraud-proof approval</h3>
            <p>Customers request stamps; staff approve. Requests expire after 15 minutes. Nobody stamps themselves.</p>
          </div>
          <div className="panel">
            <div className="icon-box"><UserCheck /></div>
            <h3>Staff roles</h3>
            <p>Baristas, branch managers, and owners each see what they need. Permissions stay tidy as your team grows.</p>
          </div>
          <div className="panel">
            <div className="icon-box"><Sparkles /></div>
            <h3>Reward automation</h3>
            <p>When a customer hits the stamp goal, the reward unlocks automatically and the card resets for the next cycle.</p>
          </div>
          <div className="panel">
            <div className="icon-box"><Zap /></div>
            <h3>Realtime dashboard</h3>
            <p>Pending stamp requests appear live on the barista screen. No refresh, no lag.</p>
          </div>
        </div>
      </section>

      <section id="flow" className="container section">
        <div className="section-head">
          <div className="eyebrow">Daily flow</div>
          <h2>Designed for real counters, not software demos.</h2>
          <p>Three steps, under ten seconds from order to stamp. Works on any phone, any network.</p>
        </div>
        <div className="grid-3">
          <div className="panel">
            <div className="role-tag gold">Step 01</div>
            <h3>Customer scans</h3>
            <p>The QR opens Brewistan on mobile. Returning customers see their wallet instantly. New customers sign up in 20 seconds.</p>
          </div>
          <div className="panel">
            <div className="role-tag gold">Step 02</div>
            <h3>Customer requests stamp</h3>
            <p>After ordering, they tap <em>Request stamp</em>. The request appears on the barista's screen immediately.</p>
          </div>
          <div className="panel">
            <div className="role-tag gold">Step 03</div>
            <h3>Barista approves</h3>
            <p>Barista confirms the order and taps approve. Stamp lands on the card; reward unlocks when the goal is met.</p>
          </div>
        </div>
      </section>

      <footer className="container footer">
        <div>© {new Date().getFullYear()} Brewistan. Premium loyalty for cafés.</div>
        <div>Made for Erbil · Iraq</div>
      </footer>
    </main>
  );
}
