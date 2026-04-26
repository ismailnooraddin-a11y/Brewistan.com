'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { campaignSchema } from '@/lib/schemas';
import type { Database, CampaignStatus } from '@/lib/database.types';
import { formatDate } from '@/lib/utils';

type Campaign = Database['public']['Tables']['campaigns']['Row'];

export function CampaignsManager({ cafeId, initialCampaigns }: { cafeId: string; initialCampaigns: Campaign[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    stamps_required: 8,
    reward_text: 'Free drink on your next visit',
    status: 'draft' as CampaignStatus,
  });

  const visible = showDeleted ? campaigns : campaigns.filter((c) => !c.deleted_at);

  async function create() {
    setSaving(true);
    setError(null);
    const parsed = campaignSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      setSaving(false);
      return;
    }
    const { data, error: err } = await supabase
      .from('campaigns')
      .insert({ ...parsed.data, cafe_id: cafeId })
      .select('*')
      .single();
    if (err) {
      setError(err.code === '23505'
        ? 'You already have an active campaign. Pause it before activating a new one.'
        : err.message,
      );
      setSaving(false);
      return;
    }
    setCampaigns([data, ...campaigns]);
    setOpen(false);
    setForm({ name: '', stamps_required: 8, reward_text: 'Free drink on your next visit', status: 'draft' });
    setSaving(false);
    router.refresh();
  }

  async function setStatus(id: string, status: CampaignStatus) {
    const { error: err } = await supabase.from('campaigns').update({ status }).eq('id', id);
    if (err) {
      alert(err.code === '23505'
        ? 'Another campaign is already active. Pause it first.'
        : err.message,
      );
      return;
    }
    setCampaigns(campaigns.map((c) => (c.id === id ? { ...c, status } : c)));
    router.refresh();
  }

  // Soft delete: never wipes loyalty card history.
  async function softDelete(id: string) {
    if (!confirm('Archive this campaign? Customer cards will be preserved. You can restore it later.')) return;
    const { error: err } = await supabase
      .from('campaigns')
      .update({ deleted_at: new Date().toISOString(), status: 'archived' })
      .eq('id', id);
    if (err) { alert(err.message); return; }
    setCampaigns(campaigns.map((c) => (c.id === id ? { ...c, deleted_at: new Date().toISOString(), status: 'archived' } : c)));
    router.refresh();
  }

  async function restore(id: string) {
    const { error: err } = await supabase
      .from('campaigns')
      .update({ deleted_at: null, status: 'paused' })
      .eq('id', id);
    if (err) { alert(err.message); return; }
    setCampaigns(campaigns.map((c) => (c.id === id ? { ...c, deleted_at: null, status: 'paused' } : c)));
    router.refresh();
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <label style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} style={{ accentColor: 'var(--olive)' }} />
          Show archived campaigns
        </label>
        <button className="btn" onClick={() => setOpen(!open)}>
          <Plus size={14} /> New campaign
        </button>
      </div>

      {open && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <h3>Create a campaign</h3>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="c-name">Campaign name</label>
              <input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Summer drinks" />
            </div>
            <div className="field">
              <label htmlFor="c-stamps">Stamps required</label>
              <input id="c-stamps" type="number" min={3} max={50} value={form.stamps_required}
                onChange={(e) => setForm({ ...form, stamps_required: Number(e.target.value) })} />
            </div>
            <div className="field full">
              <label htmlFor="c-reward">Reward</label>
              <input id="c-reward" value={form.reward_text}
                onChange={(e) => setForm({ ...form, reward_text: e.target.value })}
                placeholder="Free drink on your next visit" />
            </div>
            <div className="field">
              <label htmlFor="c-status">Status</label>
              <select id="c-status" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as CampaignStatus })}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>
            {error && <div className="field full"><span className="error" style={{ color: '#a33a3a' }}>{error}</span></div>}
            <div className="full" style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={create} disabled={saving}>
                {saving ? 'Creating…' : 'Create'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty">
          <h3>No campaigns yet</h3>
          <p>Create your first stamp plan to start collecting loyalty cards from customers.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Stamps</th>
              <th>Reward</th>
              <th>Status</th>
              <th>Created</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const isArchived = !!c.deleted_at;
              return (
                <tr key={c.id} style={isArchived ? { opacity: 0.55 } : undefined}>
                  <td style={{ fontWeight: 500 }}>{c.name}{isArchived && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--muted)' }}>(archived)</span>}</td>
                  <td>{c.stamps_required}</td>
                  <td>{c.reward_text}</td>
                  <td>
                    {isArchived ? (
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>archived</span>
                    ) : (
                      <select
                        value={c.status}
                        onChange={(e) => setStatus(c.id, e.target.value as CampaignStatus)}
                        style={{ border: 0, background: 'transparent', font: 'inherit', cursor: 'pointer' }}
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="archived">Archived</option>
                      </select>
                    )}
                  </td>
                  <td>{formatDate(c.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {isArchived ? (
                      <button className="btn btn-ghost" onClick={() => restore(c.id)} aria-label={`Restore ${c.name}`} title="Restore">
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      <button className="btn btn-ghost" onClick={() => softDelete(c.id)} aria-label={`Archive ${c.name}`} title="Archive">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
