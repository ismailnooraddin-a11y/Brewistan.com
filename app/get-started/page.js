import Link from 'next/link';
import AuthHub from './AuthHub';

export default function GetStartedPage() {
  return (
    <main className="siteWrap authPageBg">
      <header className="siteHeader shell">
        <Link href="/" className="brandLockup">
          <div className="brandBadge">B</div>
          <div>
            <p className="microLabel">Web loyalty platform</p>
            <strong>Brewistan</strong>
          </div>
        </Link>
        <nav className="navLinks">
          <Link href="/">Home</Link>
          <a href="#forms">Forms</a>
        </nav>
      </header>

      <section className="authHero shell" id="forms">
        <div className="authLead">
          <p className="microLabel accent">Get started</p>
          <h1>Choose the right entry point and start with a clean, practical setup flow.</h1>
          <p>
            This page is designed for real use: café owners can create their business account, staff can sign in, and customers can join from mobile with email, phone, or Google.
          </p>
          <div className="miniChecklist">
            <span>Email, phone, or Google access</span>
            <span>Café name, address, and phone fields</span>
            <span>Clean desktop and mobile layout</span>
          </div>
        </div>
        <AuthHub />
      </section>
    </main>
  );
}
