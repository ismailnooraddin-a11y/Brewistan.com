'use client';
import { useState } from 'react';
import { customerClient } from '@/lib/customer/supabase';
import { useCustomerText } from './CustomerProvider';

type Gender = 'male' | 'female' | 'unspecified';

/** First-time registration: name, gender and an optional email. */
export function ProfileForm({ onDone }: { onDone: () => void }) {
  const { t } = useCustomerText();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!first.trim() || !last.trim()) { setError(t('nameRequired')); return; }
    if (!gender) { setError(t('genderRequired')); return; }
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError(t('invalidEmail')); return; }
    setBusy(true); setError(null);
    const { error: err } = await customerClient().rpc('complete_profile', {
      p_first: first.trim(), p_last: last.trim(), p_gender: gender, p_email: email.trim() || null,
    });
    setBusy(false);
    if (err) { setError(/email/.test(err.message) ? t('invalidEmail') : t('genericError')); return; }
    onDone();
  }

  const options: { value: Gender; label: string }[] = [
    { value: 'male', label: t('male') }, { value: 'female', label: t('female') }, { value: 'unspecified', label: t('preferNot') },
  ];

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <h2 className="text-[20px] font-semibold">{t('profileTitle')}</h2>
        <p className="mt-1 text-[14px] cx-muted">{t('profileBody')}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="cx-label">{t('firstName')}</span>
          <input className="cx-input" autoComplete="given-name" maxLength={40} value={first} onChange={(e) => setFirst(e.target.value)} /></label>
        <label className="block"><span className="cx-label">{t('lastName')}</span>
          <input className="cx-input" autoComplete="family-name" maxLength={40} value={last} onChange={(e) => setLast(e.target.value)} /></label>
      </div>
      <fieldset>
        <legend className="cx-label">{t('gender')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {options.map((o) => (
            <button type="button" key={o.value} aria-pressed={gender === o.value} onClick={() => setGender(o.value)}
              className={`h-11 rounded-xl border px-2 text-[13.5px] font-medium transition-colors duration-150 ${
                gender === o.value ? 'border-[#c8a96a] bg-[#c8a96a]/10 text-[#f3eee6]' : 'border-white/10 text-[#a39a8e] hover:bg-white/[0.04]'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block"><span className="cx-label">{t('emailOptional')}</span>
        <input className="cx-input" type="email" inputMode="email" autoComplete="email" dir="ltr" maxLength={254}
          value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {error && <p role="alert" className="text-[14px] text-[#e8857a]">{error}</p>}
      <button className="cx-btn" disabled={busy}>{busy ? '…' : t('continue')}</button>
    </form>
  );
}
