'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/browser';
import { LoyaltyCard } from '@/components/customer/LoyaltyCard';
import { brandSchema } from '@/lib/schemas';
import type { Database } from '@/lib/database.types';

type Cafe = Database['public']['Tables']['cafes']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];

const PRESETS: Array<{ name: string; primary: string; secondary: string }> = [
  { name: 'Olive',   primary: '#254435', secondary: '#5f8063' },
  { name: 'Gold',    primary: '#a87632', secondary: '#d3b36a' },
  { name: 'Rose',    primary: '#8c5b68', secondary: '#d0879b' },
  { name: 'Ink',     primary: '#1a2a22', secondary: '#3a5244' },
  { name: 'Espresso',primary: '#3d2818', secondary: '#6f4b2d' },
  { name: 'Sage',    primary: '#6b8068', secondary: '#a5b59a' },
];

export function BrandEditor({ cafe, campaign, qrUrl }: { cafe: Cafe; campaign: Campaign | null; qrUrl: string }) {
  const supabase = createClient();
  const router = useRouter();

  const [form, setForm] = useState({
    cafe_name: cafe.cafe_name,
    card_primary: cafe.card_primary,
    card_secondary: cafe.card_secondary,
    card_text: cafe.card_text,
    card_opacity: Number(cafe.card_opacity),
    watermark_on: cafe.watermark_on,
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(qrUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#14251d', light: '#fffdf8' },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
  }, [qrUrl]);

  const demoStamps = campaign ? Math.floor(campaign.stamps_required / 3) : 3;
  const demoRequired = campaign?.stamps_required ?? 8;
  const demoReward = campaign?.reward_text ?? 'Free drink on your next visit';

  const preview = useMemo(() => ({
    ...form,
  }), [form]);

  async function save() {
    setSaving(true);
    setMessage(null);
    const parsed = brandSchema.safeParse(form);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0].message);
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from('cafes')
      .update(parsed.data)
      .eq('id', cafe.id);
    if (error) {
      setMessage(`Save failed: ${error.message}`);
      setSaving(false);
      return;
    }
    setMessage('Saved.');
    setSaving(false);
    router.refresh();
  }

  async function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${cafe.slug}-qr.png`;
    a.click();
  }

  return (
    <div className="dash-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 22 }}>
      <div className="panel">
        <h3>Card appearance</h3>
        <p>Choose a preset or pick custom colors.</p>

        <div className="color-row" style={{ marginTop: 18 }}>
          {PRESETS.map((p) => {
            const active = form.card_primary === p.primary && form.card_secondary === p.secondary;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => setForm({ ...form, card_primary: p.primary, card_secondary: p.secondary })}
                className="color-swatch"
                aria-label={`Apply ${p.name} theme`}
                style={{
                  background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})`,
                  boxShadow: active ? '0 0 0 3px var(--olive)' : 'none',
                }}
              />
            );
          })}
        </div>

        <div className="form-grid" style={{ marginTop: 18 }}>
          <div className="field">
            <label htmlFor="primary">Primary color</label>
            <input id="primary" type="color" value={form.card_primary}
              onChange={(e) => setForm({ ...form, card_primary: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="secondary">Secondary color</label>
            <input id="secondary" type="color" value={form.card_secondary}
              onChange={(e) => setForm({ ...form, card_secondary: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="text">Text color</label>
            <input id="text" type="color" value={form.card_text}
              onChange={(e) => setForm({ ...form, card_text: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="opacity">Card opacity ({form.card_opacity.toFixed(2)})</label>
            <input id="opacity" type="range" className="range" min={0.5} max={1} step={0.05}
              value={form.card_opacity}
              onChange={(e) => setForm({ ...form, card_opacity: Number(e.target.value) })} />
          </div>
          <div className="field full">
            <label>
              <input type="checkbox" checked={form.watermark_on}
                onChange={(e) => setForm({ ...form, watermark_on: e.target.checked })}
                style={{ marginRight: 8, accentColor: 'var(--olive)' }} />
              Show café name as watermark on card
            </label>
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save card design'}
          </button>
          {message && <span className="hint">{message}</span>}
        </div>
      </div>

      <div>
        <div className="panel" style={{ marginBottom: 14 }}>
          <h3>Live preview</h3>
          <p>This is exactly what customers will see in their wallet.</p>
          <div style={{ marginTop: 16, opacity: preview.card_opacity }}>
            <LoyaltyCard
              cafeName={form.cafe_name}
              primary={form.card_primary}
              secondary={form.card_secondary}
              watermarkOn={form.watermark_on}
              stamps={demoStamps}
              stampsRequired={demoRequired}
              rewardText={demoReward}
              size="lg"
            />
          </div>
        </div>

        <div className="panel">
          <h3>Your café QR</h3>
          <p>Print and place this at the counter.</p>
          <div style={{ marginTop: 14, display: 'flex', gap: 16, alignItems: 'center' }}>
            {qrDataUrl ? (
              <div className="qr-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt={`QR code linking to ${qrUrl}`} width={160} height={160} />
              </div>
            ) : (
              <div className="qr-frame" style={{ width: 200, height: 200 }} />
            )}
            <div>
              <code style={{
                display: 'block',
                padding: '8px 12px',
                background: 'rgba(20,37,29,0.05)',
                borderRadius: 10,
                fontSize: 11.5,
                wordBreak: 'break-all',
                marginBottom: 10,
              }}>{qrUrl}</code>
              <button className="btn btn-secondary" onClick={downloadQr} disabled={!qrDataUrl}>
                Download PNG
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
