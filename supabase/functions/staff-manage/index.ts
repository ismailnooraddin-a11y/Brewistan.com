import { handler, HttpError, json, optionalUuid, readJson, requireUuid } from '../_shared/http.ts';
import { normalizePhone, requireUser, userClient } from '../_shared/supabase.ts';
interface Body { action: 'invite'|'remove'|'confirm'; cafeId: string; phone?: string; branchId?: string|null; membershipId?: string }
Deno.serve(handler(async (req) => {
 const { token } = await requireUser(req);
 const b = await readJson<Body>(req);
 if (!['invite','remove','confirm'].includes(b.action)) throw new HttpError(400,'invalid_action');
 const { data, error } = await userClient(token).rpc('staff_manage_atomic', {
  p_cafe: requireUuid(b.cafeId,'cafe'), p_action: b.action,
  p_phone: b.action==='invite' ? normalizePhone(b.phone) : null,
  p_branch: optionalUuid(b.branchId,'branch'),
  p_member: b.action==='invite' ? null : requireUuid(b.membershipId,'membership'),
 });
 if (error) {
  if (['22023','42501','23505'].includes(error.code)) throw new HttpError(error.code==='42501'?403:409, error.message);
  throw error;
 }
 return json(data);
}));
