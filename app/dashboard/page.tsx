import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, QrCode } from 'lucide-react';
import { getCurrentProfile, getCurrentUser, getOwnedCafe, getCafeStats, getActiveCampaign } from '@/lib/queries';
import { PendingCafeFinisher } from '@/components/dashboard/PendingCafeFinisher';

export default async function DashboardOverview() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/get-started');

  const cafe = await getOwnedCafe();

  if (!cafe) {
    // Cross-device email confirmation recovery: if signup stashed café details
    // in user_metadata, render the finisher form pre-filled.
    const user = await getCurrentUser();
    const pending = (user?.user_metadata as { pending_cafe?: Record<string, string> } | null)?.pending_cafe;

    return (
      <>
        <div className="dash-head">
          <div>
            <div className="eyebrow">Welcome</div>
            <h1>Finish setting up your café</h1>
            <p className="hint">You&rsquo;re signed in but haven&rsquo;t created your café yet.</p>
          </div>
        </div>

        {pending ? (
          <PendingCafeFinisher pending={pending} />
        ) : (
          <div className="empty">
            <h3>No café found on your account</h3>
            <p>This can happen if your email confirmation completed on a different device. Create your café below to continue.</p>
            <Link href="/get-started" className="btn" style={{ marginTop: 14 }}>
              Complete setup <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </>
    );
  }

  const [stats, campaign] = await Promise.all([
    getCafeStats(cafe.id),
    getActiveCampaign(cafe.id),
  ]);

  const qrUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/c/${cafe.slug}`;

  return (
    <>
      <div className="dash-head">
        <div>
          <div className="eyebrow">Café dashboard</div>
          <h1>{cafe.cafe_name}</h1>
          <p className="hint">Signed in as {profile.full_name} · {profile.email}</p>
        </div>
        <Link href="/dashboard/stamp-requests" className="btn">
          View stamp requests <ArrowRight size={14} />
        </Link>
      </div>

      <div className="dash-grid-4">
        <div className="stat">
          <div className="stat-label">Customer cards</div>
          <div className="stat-value">{stats.customers}</div>
          <div className="stat-foot">Total loyalty cards issued.</div>
        </div>
        <div className="stat">
          <div className="stat-label">Pending requests</div>
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-foot">Awaiting barista approval.</div>
        </div>
        <div className="stat">
          <div className="stat-label">Active campaign</div>
          <div className="stat-value">{stats.activeCampaigns}</div>
          <div className="stat-foot">
            {campaign ? `${campaign.name} — ${campaign.stamps_required} stamps` : 'No campaign yet.'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Your café URL</div>
          <div className="stat-value" style={{ fontSize: 16, marginTop: 14 }}>/c/{cafe.slug}</div>
          <div className="stat-foot">Share this link or QR with customers.</div>
        </div>
      </div>

      <div className="dash-grid" style={{ marginTop: 20 }}>
        <div className="panel">
          <div className="icon-box"><QrCode /></div>
          <h3>Your QR code</h3>
          <p>Print this and place it at the counter. Customers scan → request stamp → you approve.</p>
          <div style={{ marginTop: 14 }}>
            <code style={{
              display: 'inline-block',
              padding: '8px 12px',
              background: 'rgba(20,37,29,0.05)',
              borderRadius: 10,
              fontSize: 12,
              wordBreak: 'break-all',
            }}>{qrUrl}</code>
          </div>
          <Link href="/dashboard/brand" className="btn btn-secondary" style={{ marginTop: 14 }}>
            Generate printable QR <ArrowRight size={14} />
          </Link>
        </div>

        <div className="panel">
          <div className="icon-box"><ArrowRight /></div>
          <h3>Next steps</h3>
          <p>Finish the essentials to launch your loyalty program.</p>
          <ul style={{ padding: 0, listStyle: 'none', marginTop: 14 }}>
            <li style={{ padding: '10px 0', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Design your card</span>
              <Link href="/dashboard/brand" style={{ color: 'var(--olive)' }}>Open →</Link>
            </li>
            <li style={{ padding: '10px 0', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Create first campaign</span>
              <Link href="/dashboard/campaigns" style={{ color: 'var(--olive)' }}>Open →</Link>
            </li>
            <li style={{ padding: '10px 0', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Add staff</span>
              <Link href="/dashboard/staff" style={{ color: 'var(--olive)' }}>Open →</Link>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
