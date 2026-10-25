/** Presentation only. Never authorizes a stamp, a reward, or a subscription change. */
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/** The wallet RPC uses camelCase; older cached profiles may use snake_case. */
export function cardCustomerName(profile: unknown): string {
  const p = record(profile);
  const first = text(p.firstName) || text(p.first_name);
  const last = text(p.lastName) || text(p.last_name);
  return [first, last].filter(Boolean).join(' ');
}

/** This is the last stamp at THIS cafe, never an inferred visit date. */
export function cardLastStampAt(card: unknown): string | null {
  const c = record(card);
  const value = text(c.lastStampAt) || text(c.last_stamp_at);
  return value && Number.isFinite(Date.parse(value)) ? value : null;
}

export type CardLocale = 'en' | 'ar' | 'ckb';
export function cardLocale(value: string = 'en'): CardLocale {
  return value.startsWith('ar') ? 'ar' : /^(ckb|ku)/.test(value) ? 'ckb' : 'en';
}
const COPY = {
  en: { stamps: 'Stamps', lastStamp: 'Last stamp', noStamps: 'No stamps yet', ready: 'Reward ready' },
  ar: { stamps: '\u0627\u0644\u0623\u062e\u062a\u0627\u0645', lastStamp: '\u0622\u062e\u0631 \u062e\u062a\u0645', noStamps: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u062e\u062a\u0627\u0645 \u0628\u0639\u062f', ready: '\u0627\u0644\u0645\u0643\u0627\u0641\u0623\u0629 \u062c\u0627\u0647\u0632\u0629' },
  ckb: { stamps: '\u0645\u06c6\u0631\u06d5\u06a9\u0627\u0646', lastStamp: '\u062f\u0648\u0627 \u0645\u06c6\u0631', noStamps: '\u0647\u06ce\u0634\u062a\u0627 \u0645\u06c6\u0631 \u0646\u06cc\u06cc\u06d5', ready: '\u062e\u06d5\u06b5\u0627\u062a\u06d5\u06a9\u06d5 \u0626\u0627\u0645\u0627\u062f\u06d5\u06cc\u06d5' },
} as const;
export function cardCopy(locale: string = 'en') { return COPY[cardLocale(locale)]; }
export function cardStampDate(value: string | null | undefined, locale = 'en', timeZone?: string): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  const lang = cardLocale(locale);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', ...(timeZone ? { timeZone } : {}) };
  try { return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar-IQ' : 'ckb-IQ', options).format(new Date(value)); }
  catch { return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); }
}
export function stampLayout(total: number, filled: number) {
  const count = Number.isFinite(total) ? Math.min(20, Math.max(1, Math.round(total))) : 8;
  const stamped = Number.isFinite(filled) ? Math.min(count, Math.max(0, Math.floor(filled))) : 0;
  // 12 stamps become 6 + 6, not the old unbalanced 10 + 2.
  const columns = count <= 10 ? count : Math.ceil(count / 2);
  return { count, stamped, columns };
}
export function cardFooter(footer: string | undefined, goal: string, remaining: number): string {
  const label = footer ?? (remaining ? `${remaining} to go` : COPY.en.ready);
  const duplicate = `\u00b7 ${goal}`;
  return label.endsWith(duplicate) ? label.slice(0, -duplicate.length).trim() : label;
}

export const TEA_ROOM_SCENE = '/card-scenes/nanas-tea-v1.webp';
export type SceneChoice = 'none' | 'tea_room' | 'custom';
export function selectedScene(brand: unknown): SceneChoice {
  const b = record(brand);
  return b.scene === 'tea_room' || b.scene === 'custom' ? b.scene : 'none';
}
export function validScenePath(cafeId: string, path: unknown): path is string {
  if (!/^[0-9a-f-]{36}$/i.test(cafeId) || typeof path !== 'string') return false;
  if (!path.startsWith(`${cafeId}/`)) return false;
  return /^scene-[a-z0-9-]{1,80}\.(webp|png|jpe?g)$/i.test(path.slice(cafeId.length + 1));
}

/** Entitlement comes from the cafe's protected database tier, never a URL/preview flag.
 * Only the packaged preset or tenant-scoped Storage files are accepted, not arbitrary URLs.
 */
export function cardSceneUrl(cafeId: string, tier: string, brand: unknown, supabaseUrl = ''): string | null {
  if (tier !== 'bespoke') return null;
  const b = record(brand);
  if (selectedScene(b) === 'tea_room') return TEA_ROOM_SCENE;
  if (selectedScene(b) !== 'custom' || !validScenePath(cafeId, b.scene_path)) return null;
  try {
    const base = new URL(supabaseUrl);
    if (base.protocol !== 'https:' || base.username || base.password) return null;
    return `${base.origin}/storage/v1/object/public/branding/${b.scene_path}`;
  } catch { return null; }
}
