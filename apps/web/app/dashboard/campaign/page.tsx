import { getT, requireOwnerContext } from '@/lib/server-context';
import { PageHeader, formatDate } from '@/components/ui';
import { CampaignForm } from './CampaignForm';

export default async function CampaignPage() {
  const { supabase, cafe } = await requireOwnerContext();
  const { t } = await getT();
  const { data: campaigns } = await supabase.from('campaigns').select('*').eq('cafe_id', cafe.id).order('version', { ascending: false });
  const active = campaigns?.find((c) => c.active);

  return (
    <>
      <PageHeader
        title={t('campaign.title')}
        description="Changing the rules creates a new version. Stamps already earned keep counting toward the puzzle; new puzzles use the new rules."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {active && <CampaignForm cafeId={cafe.id} campaign={active} />}
        <div className="card">
          <h2 className="mb-3 text-lg">History</h2>
          <ul className="space-y-3 text-sm">
            {(campaigns ?? []).map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span>Version {c.version}{c.active ? ' (current)' : ''}</span>
                <span className="text-ink-muted">Buy {c.stamps_required}, 1 free · {formatDate(c.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
