'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function MfaForm({ factorId: existing }: { factorId: string | null }) {
  const supabase = createClient();
  const [factorId, setFactorId] = useState<string | null>(existing);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) return;
    supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Brewistan', friendlyName: `Brewistan admin ${Date.now()}` }).then(({ data, error }) => {
      if (error) return setError(error.message);
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    });
  }, [existing, supabase]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) setError(error.message);
    else window.location.href = '/admin';
  }

  return (
    <form onSubmit={verify} className="mt-5 space-y-4">
      {qr && (
        <div className="space-y-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Authenticator QR code" className="mx-auto h-44 w-44" />
          <p className="break-all font-mono text-xs text-ink-muted">{secret}</p>
        </div>
      )}
      <input className="input text-center tracking-[0.4em]" dir="ltr" inputMode="numeric" maxLength={6}
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn-primary w-full" disabled={code.length !== 6 || !factorId}>Verify</button>
    </form>
  );
}
