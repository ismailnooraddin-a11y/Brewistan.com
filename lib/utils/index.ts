export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function readableContrast(hex: string) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? '#14251d' : '#ffffff';
}

/**
 * Validates a redirect target to prevent open-redirect attacks.
 * Only allows same-origin relative paths (must start with "/" but not "//").
 * Rejects protocol-relative URLs, absolute URLs, javascript: schemes, etc.
 *
 * @param target - The candidate redirect path (typically from a query param)
 * @param fallback - Where to send the user if the target is invalid
 * @returns A safe relative path beginning with "/"
 */
export function safeRedirect(
  target: string | null | undefined,
  fallback: string = '/dashboard',
): string {
  if (!target || typeof target !== 'string') return fallback;
  // Must start with a single slash followed by a non-slash character.
  // Rejects "//evil.com", "https://evil.com", "javascript:...", "", "x", etc.
  if (!/^\/[^/\\]/.test(target)) return fallback;
  // Reject any encoded protocol smuggling (rare but cheap to check).
  if (/[\u0000-\u001f\u007f-\u009f]/.test(target)) return fallback;
  // Cap length to avoid header-bomb edge cases.
  if (target.length > 512) return fallback;
  return target;
}
