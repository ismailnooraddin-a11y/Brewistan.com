import { handler, HttpError, json, readJson, requireUuid } from '../_shared/http.ts';
import { requireAdmin, userClient } from '../_shared/supabase.ts';
interface Body { cafeId: string; decision: 'approve'|'reject'|'suspend'|'reactivate'; reason?: string }
Deno.serve(handler(async (req) => {
 const { token } = await requireAdmin(req); const b = await readJson<Body>(req);
 if (!['approve','reject','suspend','reactivate'].includes(b.decision)) throw new HttpError(400,'invalid_decision');
 const { data, error } = await userClient(token).rpc('admin_review_atomic', {
  p_cafe: requireUuid(b.cafeId,'cafe'), p_decision:b.decision, p_reason:typeof b.reason==='string'?b.reason.trim():'',
 });
 if (error) { if (['22023','42501'].includes(error.code)) throw new HttpError(error.code==='42501'?403:409,error.message); throw error; }
 return json(data);
}));
