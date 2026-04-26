import { redirect } from 'next/navigation';
import { History } from 'lucide-react';
import { getOwnedCafe } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatTime } from '@/lib/utils';
import type { Database } from '@/lib/database.types';

export const metadata = { title: 'Audit log' };
export const dynamic = 'force-dynamic';

type AuditRow = Database['public']['Tables']['audit_log']['Row'] & {
  actor: { full_name: string | null } | { full_name: string | null }[] | null;
};

const ACTION_LABELS: Record<string, { label: string; tone: 'good' | 'bad' | 'info' | 'warn' }> = {
  'cafe.created':                 { label: 'Café created',          tone: 'good' },
  'stamp.approved':               { label: 'Stamp approved',        tone: 'good' },
  'stamp.rejected':               { label: 'Stamp rejected',        tone: 'bad'  },
  'reward.redeemed':              { label: 'Reward redeemed',       tone: 'good' },
  'staff.invited':                { label: 'Staff invited',         tone: 'info' },
  'staff.invitation.accepted':    { label: 'Staff joined',          tone: 'good' },
  'campaign.soft_deleted':        { label: 'Campaign archived',     tone: 'warn' },
};

const TONE_STYLE: Record<'good' | 'bad' | 'info' | 'warn', { bg: string; fg: string }> = {
  good: { bg: '#e8f0e9', fg: '#2c5f3a' },
  bad:  { bg: '#fdf0f0', fg: '#8c2f2f' },
  info: { bg: '#eef3fb', fg: '#1c3f6e' },
  warn: { bg: '#fff8ee', fg: '#a05a00' },
};

function actorName(actor: AuditRow['actor']): string {
  if (!actor) return 'System';
  const a = Array.isArray(actor) ? actor[0] : actor;
  return a?.full_name ?? 'Unknown';
}

function summarizeMetadata(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof m.name === 'string') parts.push(m.name);
  if (typeof m.email === 'string') parts.push(m.email);
  if (typeof m.role === 'string') parts.push(`role=${m.role}`);
  if (m.reward_issued === true) parts.push('reward unlocked');
  return parts.length ? parts.join(' · ') : null;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const cafe = await getOwnedCafe();
  if (!cafe) redirect('/dashboard');

  const sp = await searchParams;
  const filter = sp.action;

  const supabase = await createClient();
  let q = supabase
    .from('audit_log')
    .select('id, actor_id, cafe_id, action, target_type, target_id, metadata, created_at, actor:profiles(full_name)')
    .eq('cafe_id', cafe.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (filter) q = q.eq('action', filter);

  const { data: rows } = await q;
  const events = (rows ?? []) as unknown as AuditRow[];

  const knownActions = Object.keys(ACTION_LABELS);

  return (
    <>
      <div className="dash-head">
        <div>
          <div className="eyebrow">Operational history</div>
          <h1>Audit log</h1>
          <p className="hint">Most recent {events.length} events for {cafe.cafe_name}.</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          Filter by action
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <a href="/dashboard/audit" className={`pill ${!filter ? 'active' : ''}`} style={!filter ? { background: 'var(--olive)', color: '#fffdf8', borderColor: 'var(--olive)' } : undefined}>
            All
          </a>
          {knownActions.map((a) => {
            const meta = ACTION_LABELS[a];
            const active = filter === a;
            return (
              <a
                key={a}
                href={`/dashboard/audit?action=${encodeURIComponent(a)}`}
                className="pill"
                style={active ? { background: 'var(--olive)', color: '#fffdf8', borderColor: 'var(--olive)' } : undefined}
              >
                {meta.label}
              </a>
            );
          })}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="empty">
          <History size={20} style={{ opacity: 0.4 }} />
          <h3>No events yet</h3>
          <p>{filter ? 'Try clearing the filter.' : 'Operational events will appear here as your staff and customers use Brewistan.'}</p>
        </div>
      ) : (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const meta = ACTION_LABELS[e.action];
                const tone = meta?.tone ?? 'info';
                const style = TONE_STYLE[tone];
                const summary = summarizeMetadata(e.metadata);
                return (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--muted)' }}>
                      {formatDate(e.created_at)}<br />
                      <span style={{ fontSize: 11 }}>{formatTime(e.created_at)}</span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11.5,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: style.bg,
                        color: style.fg,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}>
                        {meta?.label ?? e.action}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{actorName(e.actor)}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {e.target_type ?? '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {summary ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
