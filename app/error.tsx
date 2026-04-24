'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <main className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
      <div className="eyebrow">Something went wrong</div>
      <h1 className="h-display" style={{ marginTop: 12 }}>We hit a snag</h1>
      <p className="lead" style={{ margin: '12px auto 24px' }}>
        An unexpected error occurred. Try again, or head home.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn" onClick={() => reset()}>Try again</button>
        <Link className="btn btn-secondary" href="/">Back to home</Link>
      </div>
    </main>
  );
}
