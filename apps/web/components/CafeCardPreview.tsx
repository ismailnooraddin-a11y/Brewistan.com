// The Signature / Bespoke card as customers see it in the app: the cafe's own
// colour (never blended with the accent), a metallic hairline edge, the logo in
// a thin ring, coffee-cup stamps pressed into the card and a progress line.
// Keep this in step with apps/mobile/lib/widgets/loyalty_card.dart.

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
}

function Cup({ color, on }: { color: string; on: boolean }) {
  const a = on ? 1 : 0.16;
  return (
    <svg viewBox="0 0 40 40" className="h-[62%] w-[62%]" aria-hidden="true">
      <path d="M10 12 h18 v14 a6 6 0 0 1 -6 6 h-6 a6 6 0 0 1 -6 -6 Z" fill={color} fillOpacity={a} />
      <path d="M28 15 a4.5 5 0 0 1 0 9" stroke={color} strokeOpacity={a} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M9 34 h20" stroke={color} strokeOpacity={a * 0.7} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CafeCardPreview({
  name, bg, fg, logoUrl, filled = 5, total = 8, goal = 'Free coffee',
}: {
  name: string; bg: string; fg: string; logoUrl: string | null; filled?: number; total?: number; goal?: string;
}) {
  const light = isLight(bg);
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const left = total - filled;
  return (
    <div
      role="img"
      aria-label={`${name} loyalty card, ${filled} of ${total} stamps`}
      className="relative flex w-full max-w-[380px] flex-col overflow-hidden rounded-[20px] px-[22px] pb-[18px] pt-[22px]"
      style={{
        aspectRatio: '1.586',
        color: fg,
        border: '1px solid transparent',
        background: `linear-gradient(${bg}, ${bg}) padding-box, linear-gradient(135deg, color-mix(in srgb, ${fg} 55%, transparent), color-mix(in srgb, ${fg} 12%, transparent) 40%, color-mix(in srgb, ${fg} 40%, transparent) 70%, color-mix(in srgb, ${fg} 10%, transparent)) border-box`,
        boxShadow: light
          ? '0 22px 44px -22px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.08)'
          : '0 22px 44px -20px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.14)',
      }}
    >
      {/* Same-colour depth only: a whisper of light from the top, a soft shade at the bottom. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: light
            ? 'radial-gradient(120% 80% at 30% -10%, rgba(255,255,255,0.55), transparent 60%), radial-gradient(90% 70% at 100% 110%, rgba(0,0,0,0.06), transparent 65%)'
            : 'radial-gradient(120% 80% at 30% -10%, rgba(255,255,255,0.07), transparent 60%), radial-gradient(90% 70% at 100% 110%, rgba(0,0,0,0.22), transparent 65%)',
        }}
      />
      {/* Inner frame. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[9px] rounded-[13px]"
        style={{ border: `1px solid color-mix(in srgb, ${fg} 13%, transparent)` }}
      />

      <div className="relative z-[1] flex items-center gap-[11px]">
        <div
          className="grid h-[34px] w-[34px] shrink-0 place-items-center overflow-hidden rounded-full p-[3px]"
          style={{ border: `1px solid color-mix(in srgb, ${fg} 50%, transparent)` }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full rounded-full object-contain" />
          ) : (
            <span className="font-card text-base">{initial}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 truncate font-card text-[19px] leading-tight">{name}</div>
        <div className="shrink-0 text-[9px] uppercase tracking-[0.18em] opacity-60">Loyalty</div>
      </div>

      <div className="relative z-[1] my-auto grid grid-cols-4 gap-x-3 gap-y-2.5 px-1 pb-2.5 pt-3.5">
        {Array.from({ length: total }).map((_, i) => {
          const on = i < filled;
          return (
            <div
              key={i}
              className="grid aspect-square w-full max-w-[44px] place-items-center justify-self-center rounded-full"
              style={{
                background: light ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.20)',
                boxShadow: on
                  ? `inset 0 1.5px 3px rgba(0,0,0,${light ? 0.16 : 0.35}), 0 0 0 1px color-mix(in srgb, ${fg} 35%, transparent)`
                  : light
                    ? 'inset 0 1.5px 3px rgba(0,0,0,0.16), 0 1px 0 rgba(255,255,255,0.7)'
                    : 'inset 0 1.5px 3px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <Cup color={fg} on={on} />
            </div>
          );
        })}
      </div>

      <div
        className="relative z-[1] flex items-baseline justify-between gap-2.5 pt-2.5"
        style={{ borderTop: `1px solid color-mix(in srgb, ${fg} 14%, transparent)` }}
      >
        <span className="text-[13px] font-semibold tabular-nums tracking-wide">{filled} / {total}</span>
        <span className="text-right text-[11.5px] opacity-75">{left === 0 ? `Reward ready · ${goal}` : `${left} more · ${goal}`}</span>
      </div>
    </div>
  );
}
