'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { branchSchema } from '@/lib/schemas';
import type { Database } from '@/lib/database.types';
import { formatDate } from '@/lib/utils';

type Branch = Database['public']['Tables']['branches']['Row'];

export function BranchesManager({ cafeId, initialBranches }: { cafeId: string; initialBranches: Branch[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    setError(null);
    const parsed = branchSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      setLoading(false);
      return;
    }
    const { data, error: err } = await supabase
      .from('branches')
      .insert({
        cafe_id: cafeId,
        name: parsed.data.name,
        address: parsed.data.address,
        phone: parsed.data.phone || null,
      })
      .select('*')
      .single();
    if (err) {
      setError(err.code === '23505' ? 'A branch with that name already exists.' : err.message);
      setLoading(false);
      return;
    }
    setBranches([...branches, data]);
    setForm({ name: '', address: '', phone: '' });
    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm('Delete this branch? Staff assigned to it will become unassigned.')) return;
    const { error: err } = await supabase.from('branches').delete().eq('id', id);
    if (err) { alert(err.message); return; }
    setBranches(branches.filter((b) => b.id !== id));
    router.refresh();
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn" onClick={() => setOpen(!open)}>
          <Plus size={14} /> Add branch
        </button>
      </div>

      {open && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <h3>Add a branch</h3>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="b-name">Branch name</label>
              <input id="b-name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Downtown" />
            </div>
            <div className="field">
              <label htmlFor="b-phone">Phone (optional)</label>
              <input id="b-phone" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+964 750 000 0000" />
            </div>
            <div className="field full">
              <label htmlFor="b-address">Address</label>
              <input id="b-address" value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Street, area, city" />
            </div>
            {error && <div className="field full"><span style={{ color: '#a33a3a', fontSize: 12 }}>{error}</span></div>}
            <div className="full" style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={create} disabled={loading}>
                {loading ? 'Saving…' : 'Save branch'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {branches.length === 0 ? (
        <div className="empty">
          <h3>No branches</h3>
          <p>Add at least one branch to assign staff to a specific location.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>Phone</th>
              <th>Created</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id}>
                <td style={{ fontWeight: 500 }}>{b.name}</td>
                <td>{b.address}</td>
                <td>{b.phone ?? '—'}</td>
                <td>{formatDate(b.created_at)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost" onClick={() => remove(b.id)}
                    aria-label={`Delete ${b.name}`}>
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
