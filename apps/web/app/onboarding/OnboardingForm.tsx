'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function OnboardingForm({ firstName, lastName }: { firstName: string; lastName: string; userId: string }) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [requestId] = useState(() => {
    // Preserve the idempotency key if the network returns an unknown outcome
    // and the user reloads the form before a confirmed redirect.
    try {
      const key = sessionStorage.getItem('bw.onboarding.request');
      if (key && /^[0-9a-f-]{36}$/i.test(key)) return key;
      const next = crypto.randomUUID();
      sessionStorage.setItem('bw.onboarding.request', next);
      return next;
    } catch { return crypto.randomUUID(); }
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const instagram = String(f.get('instagram') ?? '').trim();
    if (instagram && !/^https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?$/.test(instagram)) {
      setError('Enter your Instagram profile link, for example https://instagram.com/yourcafe');
      return;
    }
    setBusy(true);
    try {
      // One atomic, idempotent RPC: no orphan cafe if branch creation fails.
      const { data: cafeId, error: setupErr } = await supabase.rpc('create_cafe_with_branch', {
        p_request_id: requestId,
        p_first: String(f.get('first_name')).trim(),
        p_last: String(f.get('last_name')).trim(),
        p_name: String(f.get('name')).trim(),
        p_instagram: instagram,
        p_registration: String(f.get('registration') ?? '').trim(),
        p_branch: String(f.get('branch')).trim(),
        p_address: String(f.get('address') ?? '').trim() || null,
      });
      if (setupErr || !cafeId) throw setupErr ?? new Error('Cafe setup failed.');

      try { sessionStorage.removeItem('bw.onboarding.request'); } catch { /* ephemeral storage unavailable */ }
      document.cookie = `bw_cafe=${cafeId}; path=/; samesite=lax`;
      window.location.href = '/dashboard/verification';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="first_name">Your first name</label>
          <input id="first_name" name="first_name" className="input" defaultValue={firstName} required maxLength={40} />
        </div>
        <div>
          <label className="label" htmlFor="last_name">Your last name</label>
          <input id="last_name" name="last_name" className="input" defaultValue={lastName} required maxLength={40} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="name">Cafe name</label>
        <input id="name" name="name" className="input" required minLength={2} maxLength={80} />
      </div>
      <div>
        <label className="label" htmlFor="instagram">Instagram profile</label>
        <input id="instagram" name="instagram" className="input" dir="ltr" placeholder="https://instagram.com/yourcafe" required />
      </div>
      <div>
        <label className="label" htmlFor="registration">Business registration number</label>
        <input id="registration" name="registration" className="input" dir="ltr" maxLength={60} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="branch">First branch name</label>
          <input id="branch" name="branch" className="input" placeholder="Dream City" required maxLength={80} />
        </div>
        <div>
          <label className="label" htmlFor="address">Branch address</label>
          <input id="address" name="address" className="input" maxLength={200} />
        </div>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Continue to verification'}</button>
    </form>
  );
}
