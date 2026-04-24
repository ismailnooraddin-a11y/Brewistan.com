import { redirect } from 'next/navigation';
import { getOwnedCafe } from '@/lib/queries';
import { SettingsForm } from '@/components/dashboard/SettingsForm';

export default async function SettingsPage() {
  const cafe = await getOwnedCafe();
  if (!cafe) redirect('/dashboard');

  return (
    <>
      <div className="dash-head">
        <div>
          <div className="eyebrow">Settings</div>
          <h1>Café account</h1>
          <p className="hint">Update café information and contact details.</p>
        </div>
      </div>
      <SettingsForm cafe={cafe} />
    </>
  );
}
