import { redirect } from 'next/navigation';
import { Gift } from 'lucide-react';
import { getOwnedCafe } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatTime, timeAgo } from '@/lib/utils';
import type { Database } from '@/lib/database.types';

export const metadata = { title: 'Redemptions' };
export const dynamic = 'force-dynamic';

type Redemption = Database['public']['Tables']['reward_redemptions']['Row'];

export default async function RedemptionsPage() {
  const cafe = await getOwnedCafe();
  if (!cafe) redirect('/dashboard');

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('reward_redemptions')
    .select('*')
    .eq('cafe_id', cafe.id)
    .order('earned_at', { ascending: false })
    .limit(100);

  const all = (rows ?? []) as Redemption[];
  const active = all.filter((r) => r.status === 'available');
  const recent = all.filter((r) => r.status !== 'available').slice(0, 50);

  return (
    <>
      <div className="dash-head">
        <div>
          <div className="eyebrow">Loyalty rewards</div>
          <h1>Redemptions</h1>
          <p className="hint">Customers earn rewards automatically when they reach the stamp goal. Staff confirm them at the counter.</p>
        </div>
      </div>

      <div className="dash-grid-4">
        <div className="stat">
          <div className="stat-label">Available now</div>
          <div className="stat-value">{active.length}</div>
          <div className="stat-foot">Customers waiting to redeem.</div>
        </div>
        <div className="stat">
          <div className="stat-label">Last 100 issued</div>
          <div className="stat-value">{all.length}</div>
          <div className="stat-foot">Total reward records.</div>
        </div>
        <div className="stat">
          <div className="stat-label">Redeemed</div>
          <div className="stat-value">{all.filter((r) => r.status === 'redeemed').length}</div>
          <div className="stat-foot">Successfully claimed.</div>
        </div>
        <div className="stat">
          <div className="stat-label">Expired</div>
          <div className="stat-value">{all.filter((r) => r.status === 'expired').length}</div>
          <div className="stat-foot">Never claimed before deadline.</div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 22 }}>
        <h3>Awaiting redemption</h3>
        <p className="hint">When a customer shows your barista their reward code, staff confirms it on the Staff screen.</p>
        {active.length === 0 ? (
          <div className="empty" style={{ marginTop: 14 }}>
            <Gift size={20} style={{ opacity: 0.4 }} />
            <h3>Nothing to redeem right now</h3>
            <p>This is a good thing — every reward earned has been collected.</p>
          </div>
        ) : (
          <table className="table" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Reward</th>
                <th>Earned</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {active.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '0.08em', fontWeight: 600 }}>
                    {r.redemption_code}
                  </td>
                  <td>{r.reward_text}</td>
                  <td>{timeAgo(r.earned_at)}</td>
                  <td>{r.expires_at ? formatDate(r.expires_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h3>Recent activity</h3>
        {recent.length === 0 ? (
          <p className="hint">No redemption history yet.</p>
        ) : (
          <table className="table" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Reward</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '0.08em', fontWeight: 500, fontSize: 12 }}>
                    {r.redemption_code}
                  </td>
                  <td>{r.reward_text}</td>
                  <td>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize',
                      background: r.status === 'redeemed' ? '#e8f0e9' : r.status === 'expired' ? '#fdf0f0' : '#f0ebe4',
                      color: r.status === 'redeemed' ? '#2c5f3a' : r.status === 'expired' ? '#8c2f2f' : '#7a7268',
                    }}>{r.status}</span>
                  </td>
                  <td>
                    {r.redeemed_at
                      ? `${formatDate(r.redeemed_at)} ${formatTime(r.redeemed_at)}`
                      : formatDate(r.earned_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
