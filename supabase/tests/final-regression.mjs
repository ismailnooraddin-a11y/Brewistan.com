// Dependency-backed integration regressions. Execute via npm ci && npm test in this directory.
import assert from 'node:assert/strict';
export async function finalRegression(db,ids){
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];const uuid=()=>crypto.randomUUID();
 const as=async(id,aal='aal1')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(id?{sub:id,session_id:id,role:'authenticated',aal}:{role:'service_role'})]);};
 await as(null);
 const user=uuid();await db.query("insert into auth.users(id,phone,phone_confirmed_at) values($1,'9647706666601',now())",[user]);
 assert.equal((await one('select public.session_allowed($1,$1) ok',[user])).ok,true);
 const register=async(key)=> (await one("select public.register_session_device($1,$1,$2,'android',null,null,'test',now()+interval '30 days') r",[user,key])).r;
 const d=await register('x'.repeat(43));assert.equal((await register('x'.repeat(43))).deviceId,d.deviceId);
 await assert.rejects(register('y'.repeat(43)),/device_session_mismatch/);
 await db.query('update public.devices set revoked_at=now() where id=$1',[d.deviceId]);
 assert.equal((await one('select public.session_allowed($1,$1) ok',[user])).ok,false);
 await assert.rejects(register('y'.repeat(43)),/session_revoked/);
 await as(user);await db.exec('set role authenticated');
 assert.equal((await db.query('select * from public.profiles')).rows.length,0,'revoked sessions cannot bypass Edge through REST');
 console.log('final: live-session RLS, device-key binding and revocation');
 await as(ids.owner);
 assert.equal((await one('select public.touch_web_session() ok')).ok,true);
 await as(null);await db.query("update public.web_sessions set last_seen_at=now()-interval '3 hours' where session_id=$1",[ids.owner]);
 assert.equal((await one('select public.session_allowed($1,$1) ok',[ids.owner])).ok,false);
 // Test fixtures can explicitly restore time; clients have no UPDATE policy on this table.
 await db.query('update public.web_sessions set last_seen_at=now() where session_id=$1',[ids.owner]);
 await as(ids.owner);
 const quote=(await one('select public.create_payment_quote($1,1) q',[ids.cafe])).q;
 await assert.rejects(db.query("select public.submit_payment_report($1,'fib',$2,'test-reference')",[quote.id,quote.required_iqd-1]),/payment_must_match_quote/);
 const report=(await one("select public.submit_payment_report($1,'fib',$2,'test-reference') id",[quote.id,quote.required_iqd])).id;
 assert.equal((await one("select public.submit_payment_report($1,'fib',$2,'test-reference') id",[quote.id,quote.required_iqd])).id,report);
 await as(null);await db.query('update public.pricing set monthly_iqd=monthly_iqd+1000 where tier=$1',[quote.tier]);
 await as(ids.admin,'aal2');await db.query('select public.admin_review_payment($1,true)',[report]);
 const until=(await one('select current_period_end from public.subscriptions where cafe_id=$1',[ids.cafe])).current_period_end;
 await db.query('select public.admin_review_payment($1,true)',[report]);
 assert.equal(String((await one('select current_period_end from public.subscriptions where cafe_id=$1',[ids.cafe])).current_period_end),String(until));
 console.log('final: immutable price quotes, amount checks and idempotent approval');
 await as(ids.owner);
 const response=(await one("select public.staff_manage_atomic($1,'invite','9647706666602',$2,null) r",[ids.cafe,ids.branch])).r;
 assert.ok(response.membershipId);
 const repeat=(await one("select public.staff_manage_atomic($1,'invite','9647706666602',$2,null) r",[ids.cafe,ids.branch])).r;
 assert.equal(repeat.duplicate,true);
 await as(null);
 assert.equal((await one("select count(*)::int n from public.audit_log where entity_id=$1 and action='staff_invite'",[response.membershipId])).n,1);
 const notices=(await one('select public.claim_notice_jobs(10) jobs')).jobs;assert.ok(notices.length>=2);
 assert.equal((await one('select public.ack_notice_job($1,$2,true) ok',[notices[0].id,uuid()])).ok,false);
 assert.equal((await one('select public.ack_notice_job($1,$2,true) ok',[notices[0].id,notices[0].claimToken])).ok,true);
 console.log('final: transactional staff changes, durable outbox and claim-token checks');
 const recipient=uuid();await db.query("insert into auth.users(id,phone,phone_confirmed_at) values($1,'9647706666603',now())",[recipient]);
 await as(ids.owner);const transfer=(await one("select public.request_ownership_transfer($1,'9647706666603') id",[ids.cafe])).id;
 await as(ids.admin,'aal2');await assert.rejects(db.query("select public.complete_ownership_transfer($1,'verified both parties')",[transfer]),/transfer_not_eligible/);
 await as(recipient);await db.query('select public.respond_ownership_transfer($1,true)',[transfer]);
 await as(ids.admin,'aal2');await db.query("select public.complete_ownership_transfer($1,'verified both parties')",[transfer]);
 assert.equal((await one('select owner_id from public.cafes where id=$1',[ids.cafe])).owner_id,recipient);
 await as(ids.owner);assert.equal((await one('select public.is_cafe_owner($1) ok',[ids.cafe])).ok,false);
 await as(recipient);assert.equal((await one('select public.is_cafe_owner($1) ok',[ids.cafe])).ok,true);
 console.log('final: three-party ownership transfer and old-owner access removal');
 await as(null);
 // Over the default REST cap: a JSON keyset page must cover every card and the global total.
 const manyUser=uuid(),manyOwner=uuid();
 await db.query("insert into auth.users(id,phone,phone_confirmed_at) values($1,'9647706666604',now()),($2,'9647706666605',now())",[manyUser,manyOwner]);
 await db.query("insert into public.cafes(name,owner_id) select 'Page fixture '||i,$1 from generate_series(1,1005)i",[manyOwner]);
 await db.query('insert into public.user_cafe_progress(user_id,cafe_id,completed_puzzles) select $1,id,1 from public.cafes where owner_id=$2',[manyUser,manyOwner]);
 let after=null;const found=new Set();let total=0;
 do {const page=(await one('select public.wallet_page($1,$2,50) p',[manyUser,after])).p;total=page.profile.completedTotal;
  for(const card of page.cards){assert.equal(found.has(card.cafe_id),false);found.add(card.cafe_id);}after=page.nextCursor;
 }while(after);
 assert.equal(found.size,1005);assert.equal(Number(total),1005);
 console.log('final: 1005-card pagination and uncapped trophy totals');
 // Card design ids are defined in the apps; the database only checks the id format.
 await as(null);
 await db.query("update public.cafes set brand='{\"template\":\"future_design_2\"}'::jsonb where id=$1",[ids.cafe]);
 await assert.rejects(db.query("update public.cafes set brand='{\"template\":\"Bad Id!\"}'::jsonb where id=$1",[ids.cafe]),/invalid_brand/);
 await db.query("update public.cafes set brand='{}'::jsonb where id=$1",[ids.cafe]);
 console.log('final: card design ids accepted by format, malformed ids rejected');

 // Signature cafes may now set their own card colours, and any paid tier may
 // choose a stamp style; previously the database silently stripped these for
 // Signature cafes, keeping only the template.
 await as(null);
 await db.query("update public.cafes set tier='signature' where id=$1",[ids.cafe]);
 // An earlier test transferred this cafe to a new owner; look it up rather than assume ids.owner.
 const currentOwner=(await one('select owner_id from public.cafes where id=$1',[ids.cafe])).owner_id;
 await as(currentOwner);
 await db.exec('set role authenticated');
 await db.query(`update public.cafes set brand='{"template":"emerald","primary":"#123c33","accent":"#e5d3a1","stamp":"bean"}'::jsonb where id=$1`,[ids.cafe]);
 const saved=(await one('select brand from public.cafes where id=$1',[ids.cafe])).brand;
 assert.equal(saved.primary,'#123c33');
 assert.equal(saved.accent,'#e5d3a1');
 assert.equal(saved.stamp,'bean');
 // A well-formed id for a style the apps don't know yet is accepted (apps fall back to the default).
 await db.query(`update public.cafes set brand='{"stamp":"polka_dot"}'::jsonb where id=$1`,[ids.cafe]);
 await assert.rejects(db.query(`update public.cafes set brand='{"stamp":"Not Valid!"}'::jsonb where id=$1`,[ids.cafe]),/invalid_stamp_style/);
 await db.exec('reset role');
 await as(null);
 await db.query("update public.cafes set tier='classic', brand='{}'::jsonb where id=$1",[ids.cafe]);
 console.log('final: signature cafes can set colours and a stamp style; invalid stamp styles are rejected');

 // Campaign limits per plan: Classic 0, Signature 1, Bespoke 5 per month.
 await as(null);
 const nextMonth="date_trunc('month', now() at time zone 'Asia/Baghdad') at time zone 'Asia/Baghdad' + interval '1 month' + interval '2 days'";
 await db.query("update public.cafes set tier='classic' where id=$1",[ids.cafe]);
 assert.equal((await one(`select public.push_quota_problem($1, ${nextMonth}) p`,[ids.cafe])).p,'plan_no_campaigns');
 await db.query("update public.cafes set tier='signature' where id=$1",[ids.cafe]);
 assert.equal((await one(`select public.push_quota_problem($1, ${nextMonth}) p`,[ids.cafe])).p,null);
 const pushOwner=(await one('select owner_id from public.cafes where id=$1',[ids.cafe])).owner_id;
 await db.query(`insert into public.push_campaigns (cafe_id, title, body, scheduled_at, status, created_by)
   values ($1, '{"en":"Hi"}', '{"en":"Body"}', ${nextMonth}, 'approved', $2)`,[ids.cafe,pushOwner]);
 assert.equal((await one(`select public.push_quota_problem($1, ${nextMonth}) p`,[ids.cafe])).p,'monthly_limit');
 await db.query("update public.cafes set tier='bespoke' where id=$1",[ids.cafe]);
 assert.equal((await one(`select public.push_quota_problem($1, ${nextMonth}) p`,[ids.cafe])).p,null);
 await db.query("update public.cafes set tier='classic' where id=$1",[ids.cafe]);
 console.log('final: campaign limits per plan (classic 0, signature 1, bespoke 5 per month)');

 // Scan risk report: a quiet barista is green; night stamps and two-branch hops raise the level.
 const riskBarista=crypto.randomUUID(), riskCustomer=crypto.randomUUID();
 await db.query(`insert into public.memberships (cafe_id, phone, role, invited_by) values ($1, '9647709999001', 'barista', $2)`,[ids.cafe,pushOwner]);
 await db.query('insert into auth.users (id, phone, phone_confirmed_at) values ($1, $2, now())',[riskBarista,'9647709999001']);
 await db.query('insert into auth.users (id, phone, phone_confirmed_at) values ($1, $2, now())',[riskCustomer,'9647709999002']);
 await db.query("update public.memberships set status='active', user_id=$2 where cafe_id=$1 and phone='9647709999001'",[ids.cafe,riskBarista]);
 await as(pushOwner);await db.exec('set role authenticated');
 let riskReport=(await db.query('select * from public.owner_risk_report($1)',[ids.cafe])).rows;
 const quiet=riskReport.find(r=>r.staff_id===riskBarista);
 assert.ok(quiet,'active barista appears in the report');
 assert.equal(quiet.level,'green');
 await db.exec('reset role');await as(null);
 const branch2=(await one("insert into public.branches (cafe_id, name) values ($1,'Second branch') returning id",[ids.cafe])).id;
 const night="date_trunc('day', now() at time zone 'Asia/Baghdad') at time zone 'Asia/Baghdad' - interval '1 day' + interval '3 hours'";
 await db.query(`insert into public.stamp_events (id, user_id, cafe_id, branch_id, staff_id, scanned_at, status)
   values ($1,$2,$3,$4,$5, ${night}, 'accepted'), ($6,$2,$3,$7,$5, ${night} + interval '10 minutes', 'accepted')`,
   [crypto.randomUUID(),riskCustomer,ids.cafe,ids.branch,riskBarista,crypto.randomUUID(),branch2]);
 await as(pushOwner);await db.exec('set role authenticated');
 riskReport=(await db.query('select * from public.owner_risk_report($1)',[ids.cafe])).rows;
 const flagged=riskReport.find(r=>r.staff_id===riskBarista);
 assert.equal(flagged.level,'yellow');
 const texts=flagged.reasons.map(r=>r.text).join(' | ');
 assert.match(texts,/between 1:00 and 6:00/);
 assert.match(texts,/two branches within 30 minutes/);
 await db.exec('reset role');await as(null);
 console.log('final: scan risk report flags night stamps and two-branch hops, quiet baristas stay green');
}
