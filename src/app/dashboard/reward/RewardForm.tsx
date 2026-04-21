"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

const PRESETS = [
  { stamps: 6, label: "6 stamps", hint: "Fast rewards" },
  { stamps: 8, label: "8 stamps", hint: "Most popular" },
  { stamps: 10, label: "10 stamps", hint: "High value" },
  { stamps: 12, label: "12 stamps", hint: "Premium" },
];

const SUGGESTIONS = [
  "Free coffee",
  "Free cappuccino",
  "Free drink of your choice",
  "Free pastry",
  "Buy one get one free",
];

type Props = {
  cafeId: string;
  cafeName: string;
  initialStamps: number;
  initialRewardText: string;
  initialActive: boolean;
  alreadyConfigured: boolean;
};

export default function RewardForm({
  cafeId,
  cafeName,
  initialStamps,
  initialRewardText,
  initialActive,
  alreadyConfigured,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [stamps, setStamps] = useState<number>(initialStamps);
  const [rewardText, setRewardText] = useState<string>(initialRewardText);
  const [active, setActive] = useState<boolean>(initialActive);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { error: upsertError } = await supabase
      .from("rewards")
      .update({
        stamps_required: stamps,
        reward_text: rewardText.trim() || "Free coffee",
        is_active: active,
        configured_at: new Date().toISOString(),
      })
      .eq("cafe_id", cafeId);

    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setSavedAt(Date.now());
    startTransition(() => router.refresh());
  }

  const cleanStamps = Math.max(3, Math.min(20, stamps));

  return (
    <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
      {/* === Left: form === */}
      <form onSubmit={handleSave} className="card animate-fade-up space-y-8">
        {/* Stamps required */}
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-ink">
              How many stamps?
            </h2>
            <span className="text-[13px] text-ink-muted">
              Between 3 and 20
            </span>
          </div>
          <p className="mt-1 text-[14px] text-ink-soft">
            How many purchases before the customer earns their reward.
          </p>

          {/* Presets */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESETS.map((p) => {
              const selected = cleanStamps === p.stamps;
              return (
                <button
                  key={p.stamps}
                  type="button"
                  onClick={() => setStamps(p.stamps)}
                  className={`group relative rounded-xl border p-4 text-left transition-all duration-200 ease-enter ${
                    selected
                      ? "border-ember bg-ember/5 shadow-soft"
                      : "border-line bg-paper-card hover:border-line-strong hover:-translate-y-[1px]"
                  }`}
                >
                  <span
                    className={`block text-[15px] font-semibold tracking-tight ${
                      selected ? "text-ember" : "text-ink"
                    }`}
                  >
                    {p.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-ink-muted">
                    {p.hint}
                  </span>
                  {selected && (
                    <span className="absolute right-3 top-3 inline-flex h-4 w-4 items-center justify-center rounded-full bg-ember text-paper">
                      <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12 l4 4 l10 -10" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Slider */}
          <div className="mt-6">
            <label className="field-label flex items-center justify-between">
              <span>Or pick a custom number</span>
              <span className="font-mono text-[13px] text-ember">
                {cleanStamps} stamps
              </span>
            </label>
            <input
              type="range"
              min={3}
              max={20}
              value={cleanStamps}
              onChange={(e) => setStamps(parseInt(e.target.value, 10))}
              className="mt-1 w-full accent-ember"
            />
          </div>
        </section>

        <hr className="border-line" />

        {/* Reward text */}
        <section>
          <h2 className="text-[17px] font-semibold text-ink">
            What do they earn?
          </h2>
          <p className="mt-1 text-[14px] text-ink-soft">
            Keep it short — this shows on the customer&rsquo;s card.
          </p>

          <div className="mt-4">
            <label htmlFor="rewardText" className="field-label">
              Reward text
            </label>
            <input
              id="rewardText"
              type="text"
              maxLength={40}
              value={rewardText}
              onChange={(e) => setRewardText(e.target.value)}
              className="field-input"
              placeholder="Free coffee"
            />
            <p className="mt-1.5 text-right text-[11px] text-ink-muted">
              {rewardText.length} / 40
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRewardText(s)}
                className="rounded-full border border-line bg-paper-card px-3 py-1 text-[12px] text-ink-soft transition-all duration-150 hover:-translate-y-[1px] hover:border-ember hover:text-ember"
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        <hr className="border-line" />

        {/* Active toggle */}
        <section>
          <label className="flex items-start gap-4 cursor-pointer">
            <span className="relative mt-0.5 inline-flex">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="peer sr-only"
              />
              <span className="h-6 w-11 rounded-full bg-line transition-colors duration-200 peer-checked:bg-ember" />
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] peer-checked:translate-x-5" />
            </span>
            <span>
              <span className="block text-[15px] font-medium text-ink">
                Active
              </span>
              <span className="mt-0.5 block text-[13px] text-ink-soft">
                Turn off if you want to pause the program without losing
                your settings.
              </span>
            </span>
          </label>
        </section>

        {error && (
          <div className="animate-fade-in rounded-xl border border-ember/30 bg-ember/5 px-4 py-3 text-[13px] text-ember-deep">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="text-[13px] text-ink-muted">
            {savedAt ? (
              <span className="inline-flex items-center gap-1.5 text-ember">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12 l4 4 l10 -10" />
                </svg>
                Saved
              </span>
            ) : alreadyConfigured ? (
              "Already configured — editing"
            ) : (
              "Unsaved changes"
            )}
          </div>
          <button
            type="submit"
            disabled={saving || isPending}
            className="btn-primary"
          >
            {saving ? (
              <>
                <Spinner /> Saving…
              </>
            ) : (
              <>
                Save reward
                <span className="btn-arrow" aria-hidden>→</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* === Right: live preview === */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-4 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
          Live preview
        </p>
        <RewardPreview
          cafeName={cafeName}
          stamps={cleanStamps}
          rewardText={rewardText.trim() || "Free coffee"}
          active={active}
        />
      </aside>
    </div>
  );
}

/* ====================== Preview ====================== */

function RewardPreview({
  cafeName,
  stamps,
  rewardText,
  active,
}: {
  cafeName: string;
  stamps: number;
  rewardText: string;
  active: boolean;
}) {
  // Show a little more than half filled, for visual energy
  const filled = Math.max(1, Math.floor(stamps * 0.6));
  const slots = Array.from({ length: stamps });

  // Responsive grid — keep dots reasonable sized for any count
  const cols = stamps <= 6 ? 3 : stamps <= 10 ? 4 : stamps <= 15 ? 5 : 5;

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        aria-hidden
        className="absolute inset-0 translate-x-2 translate-y-2 rounded-3xl border border-line bg-paper-tint"
      />
      <div className="relative rounded-3xl border border-line bg-paper-card p-6 shadow-lift">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              Loyalty card
            </p>
            <p className="mt-1 display-serif text-[22px] leading-none text-ink">
              {cafeName}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-200 ${
              active
                ? "border-ember/30 bg-ember/10 text-ember"
                : "border-line bg-paper-tint text-ink-muted"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                active ? "bg-ember animate-pulse" : "bg-ink-faint"
              }`}
            />
            {active ? "Active" : "Paused"}
          </span>
        </div>

        <div className="my-5 h-px bg-line" />

        <p className="mb-3 text-[12px] text-ink-muted">
          Buy {stamps}, get {rewardText.toLowerCase()}
        </p>

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {slots.map((_, i) => {
            const isFilled = i < filled;
            return (
              <div
                key={`${stamps}-${i}`}
                className={`flex aspect-square items-center justify-center rounded-full border text-[11px] transition-all duration-300 ease-enter ${
                  isFilled
                    ? "border-ember bg-ember text-paper"
                    : "border-dashed border-line-strong text-ink-faint"
                }`}
                style={{ transitionDelay: `${i * 25}ms` }}
              >
                {isFilled ? (
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12 l4 4 l10 -10" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between rounded-xl bg-paper-tint px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              Reward
            </p>
            <p className="mt-0.5 text-[14px] font-medium text-ink">
              {rewardText}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              Progress
            </p>
            <p className="mt-0.5 text-[14px] font-medium text-ember">
              {filled} / {stamps}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12 a10 10 0 0 0 -10 -10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
