'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import type { UserRole } from '@/lib/database.types';
import { formatDate } from '@/lib/utils';

type StaffRow = {
  id: string;
  role: UserRole;
  is_active: boolean;
  branch_id: string | null;
  created_at: string;
  profile: { id: string; full_name: string; email: string | null; phone: string | null } | null;
  branch: { id: string; name: string } | null;
};

type Branch = { id: string; name: string };

export function StaffManager({
  cafeId, initialStaff, branches,
}: { cafeId: string; initialStaff: StaffRow[]; branches: Branch[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [staff, setStaff] = useState<StaffRow[]>(initialStaff);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    role: 'barista' as Extract<UserRole, 'barista' | 'branch_manager'>,
    branch_id: '',
  });

  async function addStaff() {
    setLoading(true);
    setError(null);
    const email = form.email.trim().toLowerCase();
    if (!email) {
      setError('Email is required.');
      setLoading(false);
      return;
    }

    // Look up an existing profile by email (user must have signed up first)
    const { data: profile, error: lookupErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .eq('email', email)
      .maybeSingle();

    if (lookupErr) {
      setError(lookupErr.message);
      setLoading(false);
      return;
    }
    if (!profile) {
      setError('No account found with that email. Ask them to sign up at /get-started first, then try again.');
      setLoading(false);
      return;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('staff')
      .insert({
        cafe_id: cafeId,
        profile_id: profile.id,
        role: form.role,
        branch_id: form.branch_id || null,
      })
      .select(`
        id, role, is_active, branch_id, created_at,
        profile:profiles ( id, full_name, email, phone ),
        branch:branches ( id, name )
      `)
      .single();

    if (insertErr) {
      setError(insertErr.code === '23505'
        ? 'This person is already on your team.'
        : insertErr.message,
      );
      setLoading(false);
      return;
    }

    // Supabase returns joined relations as arrays; normalise
    const raw = inserted as any;
    const normalised: StaffRow = {
      ...raw,
      profile: Array.isArray(raw.profile) ? raw.profile[0] ?? null : raw.profile,
      branch: Array.isArray(raw.branch) ? raw.branch[0] ?? null : raw.branch,
    };

    setStaff([normalised, ...staff]);
    setForm({ email: '', role: 'barista', branch_id: '' });
    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm('Remove this staff member? They will lose access immediately.')) return;
    const { error: err } = await supabase.from('staff').delete().eq('id', id);
    if (err) { alert(err.message); return; }
    setStaff(staff.filter((s) => s.id !== id));
    router.refresh();
  }

  async function toggleActive(id: string, next: boolean) {
    const { error: err } = await supabase.from('staff').update({ is_active: next }).eq('id', id);
    if (err) { alert(err.message); return; }
    setStaff(staff.map((s) => (s.id === id ? { ...s, is_active: next } : s)));
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn" onClick={() => setOpen(!open)}>
          <Plus size={14} /> Add staff member
        </button>
      </div>

      {open && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <h3>Add a team member</h3>
          <p className="hint">The person must first sign up at /get-started. You can then grant them staff access below.</p>
          <div className="form-grid" style={{ marginTop: 14 }}>
            <div className="field">
              <label htmlFor="s-email">Email</label>
              <input id="s-email" type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="barista@cafe.com" />
            </div>
            <div className="field">
              <label htmlFor="s-role">Role</label>
              <select id="s-role" value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}>
                <option value="barista">Barista</option>
                <option value="branch_manager">Branch manager</option>
              </select>
            </div>
            <div className="field full">
              <label htmlFor="s-branch">Branch (optional)</label>
              <select id="s-branch" value={form.branch_id}
                onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                <option value="">All branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            {error && <div className="field full"><span style={{ color: '#a33a3a', fontSize: 12 }}>{error}</span></div>}
            <div className="full" style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={addStaff} disabled={loading}>
                {loading ? 'Adding…' : 'Grant access'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {staff.length === 0 ? (
        <div className="empty">
          <h3>No staff added yet</h3>
          <p>Add baristas so they can approve customer stamp requests from their phones.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Added</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500 }}>{s.profile?.full_name ?? '—'}</td>
                <td>{s.profile?.email ?? '—'}</td>
                <td>
                  <span className={`role-tag ${s.role === 'branch_manager' ? 'gold' : ''}`}>
                    {s.role.replace('_', ' ')}
                  </span>
                </td>
                <td>{s.branch?.name ?? 'All branches'}</td>
                <td>
                  <button
                    onClick={() => toggleActive(s.id, !s.is_active)}
                    className={`role-tag ${s.is_active ? '' : 'muted'}`}
                    style={{ border: 0, cursor: 'pointer' }}
                  >
                    {s.is_active ? 'active' : 'disabled'}
                  </button>
                </td>
                <td>{formatDate(s.created_at)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost" onClick={() => remove(s.id)}
                    aria-label={`Remove ${s.profile?.full_name}`}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
