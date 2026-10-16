/** A signed browser-session envelope; not a substitute for backend JWT expiry/RLS. */
export const IDLE_MS = 2 * 60 * 60 * 1000;
export const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
const START_GRACE_MS = 5 * 60 * 1000;
export interface AuthContext { userId: string; sessionId: string; authenticatedAt: number }
interface Envelope { v: 1; u: string; s: string; start: number; seen: number }
const te = new TextEncoder();
function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) throw new Error('invalid_encoding');
  return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(text.length/4)*4,'=')), x=>x.charCodeAt(0));
}
async function key(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error('WEB_SESSION_SECRET must have at least 32 characters');
  return crypto.subtle.importKey('raw', te.encode(secret), {name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
/** Call only after auth.getUser() has validated this session with Supabase Auth. */
export function contextFromVerifiedSession(accessToken: string, userId: string): AuthContext | null {
  try {
    const claims = JSON.parse(new TextDecoder().decode(decode(accessToken.split('.')[1])));
    if (claims.sub !== userId || typeof claims.session_id !== 'string' || !claims.session_id) return null;
    const methods = new Set(['otp','password','oauth','magiclink','sso/saml']);
    const times = (Array.isArray(claims.amr) ? claims.amr : [])
      .filter((x: {method?:string;timestamp?:number}) => methods.has(x.method ?? '') && Number.isFinite(x.timestamp) && Number(x.timestamp)>0)
      .map((x:{timestamp:number}) => x.timestamp * 1000);
    if (!times.length) return null;
    // MFA/token refresh must not restart the twelve-hour primary-authentication clock.
    return {userId,sessionId:claims.session_id,authenticatedAt:Math.min(...times)};
  } catch { return null; }
}
export async function advanceSession(cookie: string | undefined, context: AuthContext, secret: string, now = Date.now()): Promise<string | null> {
  const signingKey = await key(secret);
  const {userId,sessionId,authenticatedAt} = context;
  if (!userId || !sessionId || !Number.isFinite(authenticatedAt) || authenticatedAt > now+30_000 || now-authenticatedAt >= ABSOLUTE_MS) return null;
  let previous: Envelope | null = null;
  if (cookie && cookie.length < 2048) {
    try {
      const parts = cookie.split('.');
      if (parts.length === 2 && await crypto.subtle.verify('HMAC',signingKey,decode(parts[1]),te.encode(parts[0]))) {
        const p = JSON.parse(new TextDecoder().decode(decode(parts[0]))) as Envelope;
        if (p.v===1 && p.u===userId && p.s===sessionId && p.start===authenticatedAt && Number.isFinite(p.seen) && p.seen>=p.start && p.seen<=now+30_000) previous=p;
      }
    } catch { /* malformed, stale or account-switched cookie */ }
  }
  // Removing an idle cookie cannot extend an established session.
  if (!previous && now-authenticatedAt > START_GRACE_MS) return null;
  if (previous && now-previous.seen >= IDLE_MS) return null;
  const value: Envelope = {v:1,u:userId,s:sessionId,start:authenticatedAt,seen:now};
  const body = encode(te.encode(JSON.stringify(value)));
  const signature = await crypto.subtle.sign('HMAC', signingKey, te.encode(body));
  return `${body}.${encode(new Uint8Array(signature))}`;
}
