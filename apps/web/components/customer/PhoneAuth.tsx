'use client';
import { useEffect, useRef, useState } from 'react';
import { customerClient } from '@/lib/customer/supabase';
import { toE164 } from '@/lib/customer/protocol';
import { useCustomerText } from './CustomerProvider';

/** Phone number, then a 6-digit code. No password. */
export function PhoneAuth({ onSignedIn }: { onSignedIn: () => void }) {
  const { t } = useCustomerText();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [raw, setRaw] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);
  useEffect(() => { if (step === 'code') codeRef.current?.focus(); }, [step]);

  function friendly(message: string, status?: number): string {
    if (status === 429 || /rate|too many/i.test(message)) return t('tooMany');
    if (/token|otp|expired|invalid/i.test(message)) return t('wrongCode');
    return t('genericError');
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const e164 = toE164(step === 'phone' ? raw : phone);
    if (!e164) { setError(t('invalidPhone')); return; }
    setBusy(true); setError(null);
    const { error: err } = await customerClient().auth.signInWithOtp({ phone: e164, options: { channel: 'sms' } });
    setBusy(false);
    if (err) { setError(friendly(err.message, err.status)); return; }
    setPhone(e164); setStep('code'); setCode(''); setWait(60);
  }

  async function verify(value = code) {
    if (value.length !== 6 || busy) return;
    setBusy(true); setError(null);
    const { error: err } = await customerClient().auth.verifyOtp({ phone, token: value, type: 'sms' });
    setBusy(false);
    if (err) { setError(friendly(err.message, err.status)); setCode(''); return; }
    onSignedIn();
  }

  if (step === 'phone') {
    return (
      <form onSubmit={send} className="space-y-4" noValidate>
        <div>
          <h2 className="text-[20px] font-semibold">{t('phoneTitle')}</h2>
          <p className="mt-1 text-[14px] cx-muted">{t('phoneHint')}</p>
        </div>
        <label className="block">
          <span className="sr-only">{t('phoneLabel')}</span>
          <div className="flex items-center gap-2" dir="ltr">
            <span className="flex h-12 shrink-0 items-center rounded-xl border border-white/10 bg-[#1b1916] px-3.5 text-[15px] text-[#a39a8e]">+964</span>
            <input className="cx-input" inputMode="tel" autoComplete="tel" placeholder="750 123 4567"
              value={raw} onChange={(e) => setRaw(e.target.value)} />
          </div>
        </label>
        {error && <p role="alert" className="text-[14px] text-[#e8857a]">{error}</p>}
        <button className="cx-btn" disabled={busy || !raw.trim()}>{busy ? '…' : t('sendCode')}</button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[20px] font-semibold">{t('codeTitle')}</h2>
        <p className="mt-1 text-[14px] cx-muted" dir="auto">{t('codeSentTo', { phone })}</p>
      </div>
      <input ref={codeRef} className="cx-input text-center text-[22px] tracking-[0.5em] tabular-nums" dir="ltr"
        inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label={t('codeTitle')}
        value={code} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(v); if (v.length === 6) verify(v); }} />
      {error && <p role="alert" className="text-[14px] text-[#e8857a]">{error}</p>}
      <button className="cx-btn" disabled={busy || code.length !== 6} onClick={() => verify()}>{busy ? '…' : t('verify')}</button>
      <div className="flex items-center justify-between">
        <button type="button" className="cx-link" onClick={() => { setStep('phone'); setError(null); }}>{t('changeNumber')}</button>
        <button type="button" className="cx-link" disabled={wait > 0 || busy} onClick={() => send()}>
          {wait > 0 ? t('resendIn', { s: wait }) : t('resend')}
        </button>
      </div>
    </div>
  );
}
