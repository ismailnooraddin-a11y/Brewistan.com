// Signed wallet vouchers, keyset pagination, and uncapped global trophy totals.
import { handler, json, readJson, optionalUuid } from '../_shared/http.ts';
import { admin, requireUser } from '../_shared/supabase.ts';
import { signToken } from '../_shared/crypto.ts';
interface Reward { id:string; expires_at:string; reward_label:Record<string,string> }
interface Card { cafe_id:string; name:string; tier:string; brand:Record<string,string>; logo_path:string|null;
 status:string; archived:boolean; stamps_in_current:number; completed_puzzles:number; last_stamp_at:string|null;
 stamps_required:number; reward_label:Record<string,string>; muted:boolean; rewards:Reward[] }
Deno.serve(handler(async(req)=>{
 const {user}=await requireUser(req);
 const body=await readJson<{cursor?:string|null}>(req);
 const {data,error}=await admin.rpc('wallet_page',{p_user:user.id,p_after:optionalUuid(body.cursor,'cursor'),p_limit:50});
 if(error)throw error;
 const cards=await Promise.all((data.cards as Card[]).map(async(c)=>({
  cafeId:c.cafe_id,name:c.name,tier:c.tier,brand:c.brand,
  logoUrl:c.logo_path&&c.tier!=='classic'?admin.storage.from('branding').getPublicUrl(c.logo_path).data.publicUrl:null,
  archived:c.archived||c.status==='closed',stampsInCurrent:c.stamps_in_current,stampsRequired:c.stamps_required,
  rewardLabel:c.reward_label,completedPuzzles:c.completed_puzzles,lastStampAt:c.last_stamp_at,muted:c.muted,
  rewards:await Promise.all(c.rewards.map(async(r)=>({id:r.id,expiresAt:r.expires_at,rewardLabel:r.reward_label,
   voucher:await signToken({t:'rv',r:r.id,u:user.id,c:c.cafe_id,e:Math.floor(Date.parse(r.expires_at)/1000)})}))),
 })));
 const total=Number(data.profile?.completedTotal??0);
 return json({profile:{...data.profile,tier:total>=25?'matte_black':total>=10?'gold':total>=3?'silver':'bronze'},
  cards,nextCursor:data.nextCursor,serverTime:Date.now()});
}));
