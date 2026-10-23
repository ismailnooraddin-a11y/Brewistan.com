// Regression coverage for the 2026-10-23 repairs. Runs after the existing
// migration suite using the same PGlite fixture and role configuration.
import assert from 'node:assert/strict';

export async function updateRegression(db, { owner, barista, customer, cafe }) {
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const asUser = async (id) => db.query('select set_config($1,$2,false)', [
    'request.jwt.claims', JSON.stringify({ sub: id, session_id: id, role: 'authenticated', aal: 'aal1' }),
  ]);
  const asService = async () => db.query("select set_config('request.jwt.claims','',false)");
  const uuid = () => crypto.randomUUID();

  await db.exec('reset role');
  await asService();
  await db.query("insert into public.blocked_sessions(session_id,user_id,reason) values($1,$1,'test_revoked')", [customer]);
  await asUser(customer);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select public.join_cafe($1)', [cafe]), /session_revoked/);
  await assert.rejects(db.query("select public.complete_profile('C','D','unspecified',null)"), /session_revoked/);
  await assert.rejects(db.query('select public.my_staff_cafes()'), /session_revoked/);
  await db.exec('reset role');
  await asService();
  await db.query('delete from public.blocked_sessions where session_id=$1', [customer]);
  console.log('update: blocked JWT is denied by customer elevated RPCs');

  // The same onboarding UUID must never create more than one cafe or branch.
  const freshOwner = uuid();
  await db.query('insert into auth.users(id,phone,phone_confirmed_at) values($1,$2,now())', [freshOwner, '+9647501234567']);
  await asUser(freshOwner);
  await db.exec('set role authenticated');
  const request = uuid();
  const name = `${'a'.repeat(49)} b`; // first 50 slug chars end in '-'
  const args = [request, 'Sara', 'Noor', name, 'https://instagram.com/testcafe', 'CR123', 'Dream City', null];
  await assert.rejects(db.query('select public.create_cafe_with_branch($1,$2,$3,$4,$5,$6,$7,$8)',
    [request, 'Sara', 'Noor', 'Test Bad Setup', 'https://instagram.com/testcafe', 'CR123', '', null]), /invalid_cafe_details/);
  const first = (await one('select public.create_cafe_with_branch($1,$2,$3,$4,$5,$6,$7,$8) cafe', args)).cafe;
  const retried = (await one('select public.create_cafe_with_branch($1,$2,$3,$4,$5,$6,$7,$8) cafe', args)).cafe;
  assert.equal(first, retried);
  const c = await one('select name,slug,status,tier from public.cafes where id=$1', [first]);
  assert.equal(c.name, name);
  assert.ok(!c.slug.endsWith('-'), 'long name slug must not end in hyphen');
  assert.equal(c.status, 'pending', 'owner cannot bypass approval');
  assert.equal(c.tier, 'classic', 'signup cannot grant a paid package');
  assert.equal((await one('select count(*)::int n from public.branches where cafe_id=$1', [first])).n, 1);
  await db.exec('reset role');
  await asService();
  console.log('update: cafe setup is atomic, idempotent and slug-safe');

  // First-ever offline stamp must use the campaign effective when the scanner
  // recorded it, even if a different campaign became active before sync.
  await db.query("update public.cafes set status='active',approved_at=now() where id=$1", [first]);
  const firstBranch = (await one('select id from public.branches where cafe_id=$1', [first])).id;
  await db.query("insert into public.memberships(cafe_id,user_id,phone,role,status,activated_at,confirmed_at) values($1,$2,$3,'barista','active',now()-interval '3 days',now()-interval '3 days')",
    [first, barista, '9647700000002']);
  await db.query("insert into public.subscription_entitlements(cafe_id,starts_at,ends_at,source) values($1,now()-interval '4 days',now()+interval '14 days','test_evidence')", [first]);
  const historical = (await one('select id from public.campaigns where cafe_id=$1 and active', [first])).id;
  await db.query("update public.campaigns set created_at=now()-interval '2 days',active=false where id=$1", [historical]);
  await db.query("insert into public.campaigns(cafe_id,version,stamps_required,active,created_at) values($1,2,20,true,now()-interval '30 minutes')", [first]);
  // A truly pre-campaign first offline scan must NOT inherit future terms.
  // Staff membership and entitlements predate this scan so this specifically
  // exercises campaign chronology, not an unrelated staff/billing rejection.
  const preCampaign = (await one("select public.process_stamp($1,$2,$3,$4,$5,null,now()-interval '60 hours',true) r",
    [uuid(), customer, first, firstBranch, barista])).r;
  assert.equal(preCampaign.status, 'rejected');
  assert.equal(preCampaign.reason, 'no_campaign');

  const offlineEvent = uuid();
  const recorded = (await one("select public.process_stamp($1,$2,$3,$4,$5,null,now()-interval '90 minutes',true) r",
    [offlineEvent, customer, first, firstBranch, barista])).r;
  assert.equal(recorded.status, 'accepted');
  const stored = await one('select campaign_id from public.stamp_events where id=$1', [offlineEvent]);
  assert.equal(stored.campaign_id, historical);
  assert.equal((await one('select stamps_required::int n from public.campaigns where id=$1', [stored.campaign_id])).n, 8);
  console.log('update: historical first offline stamp never inherits future campaign');
}
