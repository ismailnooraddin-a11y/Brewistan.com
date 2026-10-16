'use client';

import { asciiDigits } from '@/lib/validation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Labels {
  phone: string;
  send: string;
  code: string;
  verify: string;
  change: string;
}

/** Accepts 07XX XXX XXXX, 7XX..., or +964 7XX... and returns +9647XXXXXXXXX. */
function toE164(input: string): string {
  let digits = asciiDigits(input).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '964' + digits.slice(1);
  if (digits.length === 10 && digits.startsWith('7')) digits = '964' + digits;
  return '+' + digits;
}

export function LoginForm({ labels }: { labels: Labels }) {
  const supabase = createClient();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const e164 = toE164(phone);
    if (!/^\+\d{11,15}$/.test(e164)) {
      setError('Enter a valid phone number.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: e164, options: { channel: 'sms' } });
      if (error) setError(error.message); else setStep('code');
    } catch { setError('Unable to connect. Please try again.'); }
    finally { setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: asciiDigits(code).trim(), type: 'sms' });
      if (error) { setError(error.message); return; }
      window.location.href = '/';
    } catch { setError('Unable to connect. Please try again.'); }
    finally { setBusy(false); }
  }

  if (step === 'phone') {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <div>
          <label className="label" htmlFor="phone">{labels.phone}</label>
          <input
            id="phone"
            className="input"
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0770 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? '…' : labels.send}</button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <div>
        <label className="label" htmlFor="code">{labels.code}</label>
        <input
          id="code"
          className="input text-center text-lg tracking-[0.5em]"
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(asciiDigits(e.target.value).replace(/\D/g, ''))}
          required
          autoFocus
        />
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <button className="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? '…' : labels.verify}</button>
      <button type="button" disabled={busy} className="w-full text-sm text-ink-muted underline" onClick={() => { setStep('phone'); setCode(''); }}>
        {labels.change}
      </button>
    </form>
  );
}
