'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Campaign {
  stamps_required: number;
  reward_label: { en?: string; ar?: string; ckb?: string };
  reward_expiry_days: number;
  cooldown_minutes: number;
  max_banked_rewards: number;
}

export function CampaignForm({ cafeId, campaign }: { cafeId: string; campaign: Campaign }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().rpc('update_campaign', {
      p_cafe: cafeId,
      p_stamps_required: Number(f.get('stamps')),
      p_reward_label: { en: f.get('label_en'), ar: f.get('label_ar'), ckb: f.get('label_ckb') },
      p_reward_expiry_days: Number(f.get('expiry')),
      p_cooldown_minutes: Number(f.get('cooldown')),
      p_max_banked_rewards: Number(f.get('banked')),
    });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Saved as a new version.' });
    if (!error) router.refresh();
  }

  return (
    <form onSubmit={save} className="card space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="stamps">Stamps for one reward (puzzle pieces)</label>
          <input id="stamps" name="stamps" type="number" min={3} max={20} className="input" defaultValue={campaign.stamps_required} required />
        </div>
        <div>
          <label className="label" htmlFor="expiry">Reward expires after (days)</label>
          <input id="expiry" name="expiry" type="number" min={30} max={365} className="input" defaultValue={campaign.reward_expiry_days} required />
        </div>
        <div>
          <label className="label" htmlFor="cooldown">Minimum time between stamps (minutes)</label>
          <input id="cooldown" name="cooldown" type="number" min={30} max={1440} className="input" defaultValue={campaign.cooldown_minutes} required />
        </div>
        <div>
          <label className="label" htmlFor="banked">Unclaimed rewards a customer can hold</label>
          <input id="banked" name="banked" type="number" min={1} max={5} className="input" defaultValue={campaign.max_banked_rewards} required />
        </div>
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="label">Reward name</legend>
        <input aria-label="Reward name in English" name="label_en" className="input" defaultValue={campaign.reward_label.en ?? 'Free Coffee'} required maxLength={40} />
        <input aria-label="Reward name in Arabic" name="label_ar" dir="rtl" className="input" defaultValue={campaign.reward_label.ar ?? ''} maxLength={40} placeholder="العربية" />
        <input aria-label="Reward name in Sorani" name="label_ckb" dir="rtl" className="input" defaultValue={campaign.reward_label.ckb ?? ''} maxLength={40} placeholder="کوردی" />
      </fieldset>
      {msg && <p className={`text-sm ${msg.ok ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save new version'}</button>
    </form>
  );
}
