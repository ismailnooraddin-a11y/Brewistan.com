import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.49.4';
import { normalizePhone } from './validation.ts';
export { normalizePhone };
import { HttpError } from './http.ts';

/** Server key: the legacy service_role key while Supabase still provides it, otherwise the new secret key. */
function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
    const key = keys.default ?? Object.values(keys)[0];
    if (key) return key;
  } catch { /* fall through to the explicit error */ }
  throw new Error('No Supabase server key is available to this function');
}

export const admin: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  serverKey(),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function jwtClaims(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')));
  } catch {
    return {};
  }
}

export interface AuthContext {
  user: User;
  token: string;
  aal: string;
  sessionId: string;
}

export async function requireUser(req: Request): Promise<AuthContext> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'unauthorized');
  const { data, error } = await admin.auth.getUser(token);
  if (error && (!error.status || error.status >= 500)) throw new HttpError(503, 'auth_unavailable');
  if (error || !data.user) throw new HttpError(401, 'unauthorized');
  if (!data.user.phone_confirmed_at) throw new HttpError(403, 'phone_verification_required');
  const claims = jwtClaims(token);
  const sessionId = typeof claims.session_id === 'string' ? claims.session_id : '';
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new HttpError(401, 'session_required');
  const { data: allowed, error: sessionError } = await admin.rpc('session_allowed', { p_user: data.user.id, p_session: sessionId });
  if (sessionError) throw new HttpError(503, 'auth_unavailable');
  if (!allowed) throw new HttpError(401, 'session_revoked');
  const aal = String(claims.aal ?? 'aal1');
  return { user: data.user, token, aal, sessionId };
}

export async function requireAdmin(req: Request): Promise<AuthContext> {
  const ctx = await requireUser(req);
  if (ctx.aal !== 'aal2') throw new HttpError(403, 'mfa_required');
  const { data, error } = await admin.from('admins').select('user_id').eq('user_id', ctx.user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(403, 'not_admin');
  return ctx;
}

export async function requireOwner(userId: string, cafeId: string): Promise<void> {
  const { data, error } = await admin
    .from('memberships')
    .select('id')
    .eq('cafe_id', cafeId)
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(403, 'not_owner');
}

export async function audit(entry: {
  cafe_id?: string | null;
  actor_id?: string | null;
  action: string;
  entity?: string;
  entity_id?: string;
  reason?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await admin.from('audit_log').insert(entry);
    if (error) console.error('audit_insert_failed');
  } catch { console.error('audit_insert_failed'); }
  // Best-effort only. Critical mutation+audit pairs should move into one SQL RPC.
}


export function displayName(first?: string | null, last?: string | null): string {
  const f = (first ?? '').trim() || 'Guest';
  const l = (last ?? '').trim();
  return l ? `${f} ${l[0].toUpperCase()}.` : f;
}

export async function ownerPhone(cafeId: string): Promise<{ phone: string | null; name: string; locale: string }> {
  const { data: cafe } = await admin.from('cafes').select('name, owner_id').eq('id', cafeId).single();
  const { data: profile } = await admin.from('profiles').select('phone, locale').eq('id', cafe!.owner_id).single();
  return { phone: profile?.phone ?? null, name: cafe!.name, locale: profile?.locale ?? 'en' };
}

/** Use the verified caller JWT for transactional RPCs, preserving database MFA/RLS checks. */
export function userClient(token: string): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
