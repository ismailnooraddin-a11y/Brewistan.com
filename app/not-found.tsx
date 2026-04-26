import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
      <div className="eyebrow">404</div>
      <h1 className="h-display" style={{ marginTop: 12 }}>Page not found</h1>
      <p className="lead" style={{ margin: '12px auto 24px' }}>
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link href="/" className="btn">Back to home</Link>
    </main>
  );
}
