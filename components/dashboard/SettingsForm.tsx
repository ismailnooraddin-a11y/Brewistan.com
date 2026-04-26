'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { settingsSchema } from '@/lib/schemas';
import type { Database } from '@/lib/database.types';

type Cafe = Database['public']['Tables']['cafes']['Row'];

export function SettingsForm({ cafe }: { cafe: Cafe }) {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState({
    cafe_name: cafe.cafe_name,
    contact_email: cafe.contact_email,
    contact_phone: cafe.contact_phone,
    city: cafe.city,
    address: cafe.address,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    const parsed = settingsSchema.safeParse(form);
    if (!parsed.success) {
      setMessage({ kind: 'error', text: parsed.error.issues[0].message });
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from('cafes')
      .update(parsed.data)
      .eq('id', cafe.id);
    if (error) {
      setMessage({ kind: 'error', text: error.message });
      setSaving(false);
      return;
    }
    setMessage({ kind: 'success', text: 'Settings saved.' });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="panel" style={{ maxWidth: 760 }}>
      <h3>Café information</h3>
      <p>These details appear on receipts, your QR landing page, and support communications.</p>

      {message && (
        <div className={`alert ${message.kind === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginTop: 14 }}>
          {message.text}
        </div>
      )}

      <div className="form-grid" style={{ marginTop: 18 }}>
        <div className="field">
          <label htmlFor="cafe_name">Café name</label>
          <input id="cafe_name" value={form.cafe_name}
            onChange={(e) => setForm({ ...form, cafe_name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="city">City</label>
          <input id="city" value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="contact_email">Contact email</label>
          <input id="contact_email" type="email" value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="contact_phone">Contact phone</label>
          <input id="contact_phone" value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
        </div>
        <div className="field full">
          <label htmlFor="address">Address</label>
          <textarea id="address" value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} />
        </div>
        <div className="full" style={{ paddingTop: 6 }}>
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
        <h3 style={{ color: '#8c2f2f' }}>Danger zone</h3>
        <p style={{ fontSize: 12.5 }}>Deleting your café is permanent. All cards, campaigns, and stamp history will be lost.</p>
        <button className="btn btn-ghost" style={{ color: '#8c2f2f', marginTop: 10 }} disabled>
          Delete café (contact support)
        </button>
      </div>
    </div>
  );
}
