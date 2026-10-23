/** Public website routing. Deliberately independent of authentication and Next.js. */
export type SiteEntry = 'marketing' | 'customer' | 'owner' | 'admin';
export interface SiteHosts {
  customerHosts?: string;
  ownerHosts?: string;
  adminHost?: string;
}

export function normaliseHost(value: string): string {
  // Incoming Host is used, not the client-controlled X-Forwarded-Host header.
  return value.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

function matches(host: string, list: string): boolean {
  return list.split(',').some(value => normaliseHost(value) === host);
}

export function siteEntry(hostValue: string, settings: SiteHosts = {}): SiteEntry {
  const host = normaliseHost(hostValue);
  if (settings.adminHost && host === normaliseHost(settings.adminHost)) return 'admin';
  if (matches(host, settings.customerHosts ?? 'app.brewistan.com')) return 'customer';
  if (matches(host, settings.ownerHosts ?? 'dashboard.brewistan.com')) return 'owner';
  // Public domains, localhost and generated Vercel previews show the marketing site.
  return 'marketing';
}

export function isIndexableMarketingHost(host: string): boolean {
  return ['brewistan.com', 'www.brewistan.com'].includes(normaliseHost(host));
}

/** Fixed destinations only: never accept a URL or arbitrary return path from a query. */
export function afterOwnerLogin(isAdmin: boolean, cafeSignup: boolean): '/' | '/dashboard' | '/onboarding' {
  return isAdmin ? '/' : cafeSignup ? '/onboarding' : '/dashboard';
}

export const marketingCsp = [
  "default-src 'self'", "script-src 'self'", "style-src 'self'",
  "img-src 'self' data:", "font-src 'self'", "connect-src 'none'",
  "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'",
  "form-action 'none'",
].join('; ');

export function isMarketingAssetPath(pathname: string): boolean {
  return [
    '/website/index.html', '/website/site.css', '/website/site.js',
    '/website/favicon.svg', '/website/social-card.png',
  ].includes(pathname);
}
