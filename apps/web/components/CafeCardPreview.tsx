/**
 * Brewistan card surfaces. Classic is deliberately as refined as the paid tiers;
 * plan entitlement controls colours, logo and templates, not visual quality.
 * 'compact' is for an easy-to-scan wallet with many cards, 'full' for a card page.
 * QR codes remain outside this preview; a printed/OS Wallet pass has its own layout.
 */
export type CardDensity = 'compact' | 'full';

function isLight(hex: string): boolean {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
}

function Cup({ color, filled }: { color: string; filled: boolean }) {
  return (
    <svg viewBox="0 0 28 28" className="h-[56%] w-[56%]" fill="none" aria-hidden="true">
      <path d="M6.7 7.5h13v10.2a5 5 0 0 1-5 5h-3a5 5 0 0 1-5-5V7.5Z" fill={filled ? color : 'none'} stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M19.8 9h2a3.3 3.3 0 0 1 0 6.6h-2M6.7 24.5h16" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function CafeCardPreview({
  name, bg, fg, logoUrl, filled = 5, total = 8, goal = 'Free coffee', tag = 'Loyalty', footer,
  density = 'full',
}: {
  name: string; bg: string; fg: string; logoUrl: string | null;
  filled?: number; total?: number; goal?: string; tag?: string; footer?: string; density?: CardDensity;
}) {
  const light = isLight(bg);
  const initial = name.trim().charAt(0).toUpperCase() || 'B';
  const count = Math.min(20, Math.max(0, Math.round(total)));
  const stamped = Math.min(count, Math.max(0, Math.round(filled)));
  const left = Math.max(0, total - filled);
  const label = footer ?? (left <= 0 ? `Reward ready · ${goal}` : `${left} more · ${goal}`);
  const edge = `color-mix(in srgb, ${fg} ${light ? 27 : 34}%, transparent)`;

  return (
    <div
      role="img"
      aria-label={`${name}: ${filled} of ${total} stamps. ${label}`}
      className={`relative isolate w-full overflow-hidden ${density === 'compact'
        ? 'rounded-[19px] px-[18px] py-[17px] sm:px-[20px]'
        : 'max-w-[390px] rounded-[22px] px-[21px] pb-[19px] pt-[20px] sm:px-[24px]'}`}
      style={{
        color: fg,
        background: bg,
        border: `1px solid ${edge}`,
        boxShadow: light
          ? '0 12px 30px -18px rgba(0,0,0,.28), 0 2px 5px rgba(0,0,0,.08)'
          : '0 16px 32px -19px rgba(0,0,0,.52), inset 0 1px rgba(255,255,255,.08)',
      }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0"
        style={{ background: light
          ? 'linear-gradient(148deg,rgba(255,255,255,.19),transparent 55%,rgba(0,0,0,.04))'
          : 'linear-gradient(148deg,rgba(255,255,255,.075),transparent 55%,rgba(0,0,0,.15))' }} />
      <div className="relative flex min-w-0 items-center gap-3">
        <div className={`grid shrink-0 place-items-center overflow-hidden rounded-[11px] ${density === 'compact' ? 'h-10 w-10' : 'h-[45px] w-[45px]'}`}
          style={{ border: `1px solid ${edge}`, background: `color-mix(in srgb, ${fg} 7%, transparent)` }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
          ) : <span className="font-card text-[19px] font-medium" aria-hidden="true">{initial}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`truncate font-card font-semibold tracking-[-0.035em] ${density === 'compact' ? 'text-[18px] leading-[1.2]' : 'text-[22px] leading-[1.25]'}`}>{name}</div>
          <div className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.16em] opacity-65">{tag}</div>
        </div>
        <div className="shrink-0 text-end tabular-nums">
          <div className="text-[10px] uppercase tracking-[0.13em] opacity-65">Stamps</div>
          <div className={`font-card font-medium leading-tight ${density === 'compact' ? 'text-[20px]' : 'text-[23px]'}`}>{filled}<span className="mx-0.5 opacity-45">/</span>{total}</div>
        </div>
      </div>

      {density === 'compact' ? (
        <div className="relative mt-[15px] flex h-[5px] gap-[4px]" aria-hidden="true">
          {Array.from({ length: Math.max(1, count) }).map((_, i) => (
            <span key={i} className="min-w-0 flex-1 rounded-full" style={{ background: fg, opacity: i < stamped ? 0.93 : light ? 0.13 : 0.2 }} />
          ))}
        </div>
      ) : (
        <div className="relative mt-5 grid gap-2 pb-1" aria-hidden="true"
          style={{ gridTemplateColumns: `repeat(${Math.min(count || 1, 10)}, minmax(0, 1fr))` }}>
          {Array.from({ length: count }).map((_, i) => (
            <span key={i} className="grid aspect-square w-full max-w-[37px] place-items-center justify-self-center rounded-full"
              style={{ border: `1px solid color-mix(in srgb, ${fg} ${i < stamped ? 52 : 25}%, transparent)`,
                background: `color-mix(in srgb, ${fg} ${i < stamped ? 11 : 4}%, transparent)` }}>
              <Cup color={fg} filled={i < stamped} />
            </span>
          ))}
        </div>
      )}
      <div className={`relative flex min-w-0 items-center justify-between gap-2.5 ${density === 'compact' ? 'mt-[12px]' : 'mt-4 border-t pt-3.5'}`}
        style={density === 'full' ? { borderColor: edge } : undefined}>
        <span className="min-w-0 truncate text-[12px] font-medium opacity-85">{goal}</span>
        <span className="min-w-0 shrink-0 text-end text-[11px] opacity-75">{label}</span>
      </div>
    </div>
  );
}
