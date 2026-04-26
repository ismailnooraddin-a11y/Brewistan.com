'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coffee } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { signUpSchema } from '@/lib/schemas';

type PendingCafe = {
  cafe_name?: string;
  slug?: string;
  contact_email?: string;
  contact_phone?: string;
  city?: string;
  address?: string;
};

/**
 * Renders on the dashboard when:
 *   • The user is signed in
 *   • They don't yet own a café
 *   • Their auth user_metadata still has `pending_cafe` from signup
 *
 * Calls `create_cafe` automatically (or via a confirm button if metadata is stale).
 * Solves the cross-device email confirmation dead-end where sessionStorage was lost.
 */
export function PendingCafeFinisher({ pending }: { pending: PendingCafe }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [form, setForm] = useState({
    cafe_name: pending.cafe_name ?? '',
    slug: pending.slug ?? '',
    contact_email: pending.contact_email ?? '',
    contact_phone: pending.contact_phone ?? '',
    city: pending.city ?? 'Erbil',
    address: pending.address ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setBusy(true);
    setError(null);

    // Validate using the same shape signUpSchema validates (subset).
    const trimmed = {
      cafe_name: form.cafe_name.trim(),
      slug: form.slug.trim().toLowerCase(),
      contact_email: form.contact_email.trim().toLowerCase(),
      contact_phone: form.contact_phone.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
    };
    if (!trimmed.cafe_name || !trimmed.slug || !trimmed.contact_phone || !trimmed.address) {
      setError('Please fill in all required fields.');
      setBusy(false);
      return;
    }
    if (!signUpSchema.shape.slug.safeParse(trimmed.slug).success) {
      setError('Slug must be lowercase letters, numbers, and hyphens (3–40 characters).');
      setBusy(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc('create_cafe', {
      p_cafe_name: trimmed.cafe_name,
      p_slug: trimmed.slug,
      p_contact_email: trimmed.contact_email,
      p_contact_phone: trimmed.contact_phone,
      p_city: trimmed.city,
      p_address: trimmed.address,
    });

    if (rpcError) {
      setError(`Café setup failed: ${rpcError.message}`);
      setBusy(false);
      return;
    }

    // Clear the metadata so we don't show this again.
    await supabase.auth.updateUser({ data: { pending_cafe: null } });

    router.refresh();
    router.push('/dashboard');
  }

  return (
    <div className="panel" style={{ marginTop: 14, borderColor: 'var(--gold-soft)', background: 'linear-gradient(135deg, #fdf4e3 0%, #fffdf8 70%)' }}>
      <div className="icon-box" style={{ background: 'rgba(200, 155, 69, 0.18)' }}><Coffee /></div>
      <h3>Finish setting up your café</h3>
      <p className="hint">
        We saved your café details from signup. Confirm them below to finish creating your café.
      </p>

      <div className="form-grid" style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="pf-name">Café name</label>
          <input id="pf-name" value={form.cafe_name} onChange={(e) => setForm({ ...form, cafe_name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="pf-slug">URL slug</label>
          <input id="pf-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="pf-phone">Café phone</label>
          <input id="pf-phone" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="pf-city">City</label>
          <input id="pf-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div className="field full">
          <label htmlFor="pf-addr">Address</label>
          <input id="pf-addr" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>

        {error && <div className="field full"><span className="error" style={{ color: '#a33a3a' }}>{error}</span></div>}

        <div className="full" style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={finish} disabled={busy}>
            {busy ? 'Creating café…' : 'Create my café'}
          </button>
        </div>
      </div>
    </div>
  );
}
