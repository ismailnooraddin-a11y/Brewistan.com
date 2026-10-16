'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function OnboardingForm({ firstName, lastName, userId }: { firstName: string; lastName: string; userId: string }) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
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
      const { error: pErr } = await supabase.from('profiles').update({
        first_name: String(f.get('first_name')).trim(),
        last_name: String(f.get('last_name')).trim(),
      }).eq('id', userId);
      if (pErr) throw pErr;

      const { data: cafe, error: cErr } = await supabase.from('cafes').insert({
        owner_id: userId,
        name: String(f.get('name')).trim(),
        instagram_url: instagram || null,
        business_registration_no: String(f.get('registration') ?? '').trim() || null,
      }).select('id').single();
      if (cErr) throw cErr;

      const { error: bErr } = await supabase.from('branches').insert({
        cafe_id: cafe.id,
        name: String(f.get('branch')).trim(),
        address: String(f.get('address') ?? '').trim() || null,
      });
      if (bErr) throw bErr;

      document.cookie = `bw_cafe=${cafe.id}; path=/; samesite=lax`;
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
