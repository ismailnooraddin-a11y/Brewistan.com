'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { customerClient } from '@/lib/customer/supabase';

/** Link a verified email to the same Auth identity; never create/merge another user. */
export function AuthEmailSettings({ customer = false, currentEmail }: { customer?: boolean; currentEmail?: string | null }) {
  const [email, setEmail] = useState(currentEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function link() {
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) { setMessage('Enter a valid email address.'); return; }
    setBusy(true); setMessage(null);
    try {
      const client = customer ? customerClient() : createClient();
      const { error } = await client.auth.updateUser({ email: value });
      if (error) throw error;
      setMessage('Check your email and confirm the address. Email sign-in works once Supabase Auth verifies it.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not link email. Try again.');
    } finally { setBusy(false); }
  }
  return (
    <section className={customer ? 'cx-surface mt-6 p-5' : 'card space-y-3'}>
      <div className={customer ? 'text-[15px] font-semibold' : 'text-lg font-semibold'}>Email sign-in</div>
      <p className={`mt-1 text-[13px] ${customer ? 'cx-muted' : 'text-ink-muted'}`}>Link an email to this account so you can sign in using either your phone or verified email. An email typed during registration is not automatically a login method.</p>
      <label className="block mt-3">
        <span className={`block mb-1 text-[12px] ${customer ? 'cx-muted' : 'text-ink-muted'}`}>Email address</span>
        <input type="email" dir="ltr" inputMode="email" autoComplete="email" className={customer ? 'cx-input' : 'input w-full'}
          value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <button disabled={busy || !email.trim()} className={customer ? 'cx-btn mt-3' : 'btn-primary mt-3'} onClick={link}>{busy ? '…' : 'Link / verify email'}</button>
      {message && <p role="status" className={`mt-2 text-[13px] ${customer ? 'cx-muted' : 'text-ink-muted'}`}>{message}</p>}
    </section>
  );
}
