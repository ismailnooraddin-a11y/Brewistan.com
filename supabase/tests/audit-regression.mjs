// These database regressions require PGlite (npm ci && npm test in this directory).
// They were authored during the audit but could not be executed in the offline audit environment.
import assert from 'node:assert/strict';
export async function auditRegression(db, ids) {
  const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
  const uuid=()=>crypto.randomUUID();
  const claims=async(value)=>db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(value.sub?{...value,session_id:value.sub}:value)]);
  const service=async()=>{await db.exec('reset role');await claims({role:'service_role'});};
  const owner=async()=>{await db.exec('reset role');await claims({sub:ids.owner,role:'authenticated',aal:'aal1'});};
  await service();
  const cafe=(await one("insert into public.cafes(name,owner_id) values('Audit fixtures',$1) returning id",[ids.owner])).id;
  await db.query("update public.cafes set status='active',approved_at=now() where id=$1",[cafe]);
  await db.query("update public.subscriptions set status='active',current_period_end=now()+interval '14 days' where cafe_id=$1",[cafe]);
  const branch=(await one("insert into public.branches(cafe_id,name) values($1,'A') returning id",[cafe])).id;
  const branch2=(await one("insert into public.branches(cafe_id,name) values($1,'B') returning id",[cafe])).id;
  const member=(await one("insert into public.memberships(cafe_id,branch_id,user_id,phone,role,status,activated_at,confirmed_at) values($1,$2,$3,'9647700000002','barista','active',now()-interval '7 days',now()) returning id",[cafe,branch,ids.barista])).id;
  // Phone authentication must be verified before an invitation becomes authority.
  const unverified=uuid();
  await db.query("insert into public.memberships(cafe_id,phone,role,status) values($1,'9647705555555','barista','invited')",[cafe]);
  await db.query("insert into auth.users(id,phone) values($1,'9647705555555')",[unverified]);
  assert.equal((await one('select phone from public.profiles where id=$1',[unverified])).phone,null);
  assert.equal((await one("select count(*)::int n from public.memberships where user_id=$1",[unverified])).n,0);
  await db.query('update auth.users set phone_confirmed_at=now() where id=$1',[unverified]);
  assert.equal((await one("select status from public.memberships where user_id=$1",[unverified])).status,'active');
  await db.query('update auth.users set phone_confirmed_at=null where id=$1',[unverified]);
  assert.equal((await one('select phone from public.profiles where id=$1',[unverified])).phone,null);
  console.log('audit: verified-phone activation and clearing');
  // A null branch cannot widen an assigned membership. Referential deletion is restrictive.
  assert.equal((await db.query('select * from public.barista_membership($1,$2,null,now())',[cafe,ids.barista])).rows.length,0);
  assert.equal((await db.query('select * from public.barista_membership($1,$2,$3,now())',[cafe,ids.barista,branch2])).rows.length,0);
  await assert.rejects(db.query('delete from public.branches where id=$1',[branch]));
  await assert.rejects(db.query('update public.memberships set branch_id=$1 where id=$2',[ids.branch,member]),/branch_mismatch/);
  console.log('audit: tenant/branch scope and deletion');
  // Null auth claims while using an authenticated database role are not privileged.
  await claims({});await db.exec('set role authenticated');
  assert.equal((await one('select public.is_privileged() as v')).v,false);
  await assert.rejects(db.query('select public.prepare_push_jobs()'));
  await service();
  // Started puzzles preserve their original campaign across a rules update.
  await owner();
  const campaign1=(await one("select public.update_campaign($1,3,'{\"en\":\"Old reward\"}',180,30,5) id",[cafe])).id;
  await service();const customer=uuid();
  await db.query("insert into auth.users(id,phone,phone_confirmed_at) values($1,'9647705555556',now())",[customer]);
  const stamp=async(event,at,branchId=branch)=> (await one('select public.process_stamp($1,$2,$3,$4,$5,null,$6,false) r',[event,customer,cafe,branchId,ids.barista,at])).r;
  const base=Date.now()-4*3600000;const at=i=>new Date(base+i*3600000).toISOString();
  const event=uuid();assert.equal((await stamp(event,at(0))).status,'accepted');
  assert.equal((await stamp(event,at(0))).duplicate,true);
  await assert.rejects(stamp(event,at(0),branch2),/event_conflict/);
  await assert.rejects(db.query('select public.process_redemption($1,null,$2,$3,$4,$5,now(),false)',[event,customer,cafe,branch,ids.barista]),/event_type_conflict/);
  await owner();await one("select public.update_campaign($1,5,'{\"en\":\"New reward\"}',180,30,5) id",[cafe]);
  await service();await stamp(uuid(),at(1));const complete=await stamp(uuid(),at(2));
  assert.equal(complete.puzzle_completed,true);assert.equal(complete.required,3);
  assert.equal((await one('select campaign_id from public.rewards where id=$1',[complete.reward_id])).campaign_id,campaign1);
  assert.equal((await stamp(uuid(),at(3))).required,5);
  console.log('audit: campaign pinning, retry context and cross-type event IDs');
  // Subscription pause blocks new earning, but already-earned rewards remain redeemable.
  await db.query("update public.subscriptions set status='trial',trial_ends_at=now()-interval '1 second' where cafe_id=$1",[cafe]);
  assert.equal((await stamp(uuid(),new Date().toISOString())).reason,'subscription_inactive');
  assert.equal((await one('select public.process_redemption($1,$2,$3,$4,$5,$6,now(),false) r',[uuid(),complete.reward_id,customer,cafe,branch,ids.barista])).r.status,'accepted');
  await db.query("update public.subscriptions set trial_ends_at=now()+interval '14 days' where cafe_id=$1",[cafe]);
  // Device registration retries return the same row; revoked keys cannot silently re-enroll.
  const register=async(key,device=null)=> (await one("select public.register_device($1,$2,'android',$3,'fixture-token','audit',now()+interval '30 days') r",[ids.barista,key,device])).r;
  const registered=await register('a'.repeat(43));assert.equal((await register('a'.repeat(43))).deviceId,registered.deviceId);
  await db.query('update public.devices set revoked_at=now() where id=$1',[registered.deviceId]);
  await assert.rejects(register('a'.repeat(43)),/device_revoked/);
  const scanner=(await register('b'.repeat(43))).deviceId;
  const rewards=[];for(let i=0;i<3;i++)rewards.push((await one("insert into public.rewards(user_id,cafe_id,campaign_id,issued_at,expires_at) values($1,$2,$3,now()-interval '1 day',now()+interval '30 days') returning id",[customer,cafe,campaign1])).id);
  const redeem=async(event,reward)=> (await one('select public.process_redemption_secure($1,$2,$3,$4,$5,$6,now(),true,$7) r',[event,reward,customer,cafe,branch,ids.barista,scanner])).r;
  const first=uuid();assert.equal((await redeem(first,rewards[0])).status,'accepted');assert.equal((await redeem(first,rewards[0])).duplicate,true);
  assert.equal((await redeem(uuid(),rewards[1])).status,'accepted');assert.equal((await redeem(uuid(),rewards[2])).reason,'offline_cap');
  console.log('audit: registration and authoritative daily offline allowance');
  // Expiry cron cannot retroactively invalidate a valid earlier offline exchange.
  const expired=(await one("insert into public.rewards(user_id,cafe_id,campaign_id,status,issued_at,expires_at) values($1,$2,$3,'expired',now()-interval '3 days',now()-interval '1 hour') returning id",[customer,cafe,campaign1])).id;
  assert.equal((await one("select public.process_redemption($1,$2,$3,$4,$5,$6,now()-interval '2 hours',true) r",[uuid(),expired,customer,cafe,branch,ids.barista])).r.status,'accepted');
  // A one-minute reservation is global across login and step-up, not an unlocked read then write.
  const hash='a'.repeat(64);const reservation=(await one("select public.reserve_otp($1,'login',5,2000) r",[hash])).r;assert.ok(reservation.id);
  assert.equal((await one("select public.reserve_otp($1,'step_up',5,2000) r",[hash])).r.error,'otp_wait');
  // Wrong step-up attempts must commit rather than roll back with raised exceptions.
  const campaign=(await one("insert into public.push_campaigns(cafe_id,created_by,title,body,scheduled_at) values($1,$2,'{\"en\":\"Hi\"}','{\"en\":\"Update\"}',(date_trunc('day',now() at time zone 'Asia/Baghdad')+interval '1 day 12 hours') at time zone 'Asia/Baghdad') returning *",[cafe,ids.owner]));
  await one("select public.request_push_challenge($1,$2,'payload','correct') r",[ids.owner,campaign.id]);
  const payload=JSON.stringify({title:campaign.title,body:campaign.body,at:campaign.scheduled_at});
  for(let i=0;i<5;i++)assert.equal((await one("select public.approve_push_campaign($1,$2,$3::jsonb,'payload','wrong') r",[ids.owner,campaign.id,payload])).r.error,'wrong_code');
  assert.equal((await one("select public.approve_push_campaign($1,$2,$3::jsonb,'payload','correct') r",[ids.owner,campaign.id,payload])).r.error,'too_many_attempts');
  console.log('audit: atomic OTP reservation and persisted step-up attempts');
  // Lease ownership is checked before acknowledgement; a stale worker cannot mark a retry done.
  const job=(await one("insert into public.push_jobs(campaign_id,user_id,cafe_id,device_id,status,claim_token,attempts,lease_until) values($1,$2,$3,$4,'processing',$5,1,now()+interval '2 minutes') returning id,claim_token",[campaign.id,customer,cafe,scanner,uuid()]));
  assert.equal((await one("select public.ack_push_job($1,$2,'sent') ok",[job.id,uuid()])).ok,false);
  assert.equal((await one("select public.ack_push_job($1,$2,'failed') ok",[job.id,job.claim_token])).ok,true);
  assert.equal((await one('select status from public.push_jobs where id=$1',[job.id])).status,'pending');
  console.log('audit: notification stale-lease protection');
}
