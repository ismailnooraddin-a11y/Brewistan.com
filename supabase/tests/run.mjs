// Runs every migration against an in-memory Postgres (PGlite) with stubbed
// Supabase auth/storage schemas, then exercises the stamp and redemption rules.
// Usage: cd supabase/tests && npm install && npm test
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');
const db = new PGlite();

const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, phone text, email text, phone_confirmed_at timestamptz);
create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),not_after timestamptz);
create function auth.fixture_session() returns trigger language plpgsql security definer as $$
 begin insert into auth.sessions(id,user_id) values(new.id,new.id);return new;end $$;
create trigger fixture_session after insert on auth.users for each row execute function auth.fixture_session();
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub', '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
`;

const asUser = async (id, aal = 'aal1') =>
  db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: id, session_id:id, role: 'authenticated', aal })]);
const asService = async () => db.query(`select set_config('request.jwt.claims', '', false)`);

const uuid = () => crypto.randomUUID();
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

await db.exec(STUBS);
for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(migrationsDir, f), 'utf8'));
  console.log('applied', f);
}
await db.exec(`grant usage on schema public, auth, storage to authenticated; grant select on storage.objects to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant usage, select on all sequences in schema public to authenticated;`);

// Users
const owner = uuid(), barista = uuid(), customer = uuid(), admin = uuid();
for (const [id, phone] of [[owner, '+964 770 000 0001'], [customer, '9647700000003'], [admin, '9647700000009']]) {
  await db.query('insert into auth.users (id, phone, phone_confirmed_at) values ($1, $2, now())', [id, phone]);
}
assert.equal((await one('select phone from public.profiles where id = $1', [owner])).phone, '9647700000001');
await db.query(`update public.profiles set first_name='Ahmed', last_name='Mahmood' where id=$1`, [customer]);

// Owner creates a cafe (RLS + triggers)
await asUser(owner);
await db.exec('set role authenticated');
const cafe = await one(`insert into public.cafes (name, owner_id, status, tier) values ('Noir Erbil', $1, 'active', 'bespoke') returning *`, [owner]);
assert.equal(cafe.status, 'pending', 'owner cannot self-approve');
assert.equal(cafe.tier, 'classic', 'owner cannot pick a paid tier');
const branch = await one(`insert into public.branches (cafe_id, name) values ($1, 'Dream City') returning *`, [cafe.id]);
await db.query(`update public.cafes set status='active' where id=$1`, [cafe.id]);
assert.equal((await one('select status from public.cafes where id=$1', [cafe.id])).status, 'pending', 'guard blocks status change');
const sub = await one('select status from public.subscriptions where cafe_id=$1', [cafe.id]);
assert.equal(sub.status, 'trial');
await db.exec('reset role');

// Admin approves (service role path), barista invited before signing up
await asService();
await db.query(`update public.cafes set status='active', approved_at=now() where id=$1`, [cafe.id]);
assert.ok((await one('select trial_ends_at from public.subscriptions where cafe_id=$1', [cafe.id])).trial_ends_at, 'trial starts at approval');
await db.query(`insert into public.memberships (cafe_id, phone, role, invited_by) values ($1, '9647700000002', 'barista', $2)`, [cafe.id, owner]);
await db.query('insert into auth.users (id, phone, phone_confirmed_at) values ($1, $2, now())', [barista, '9647700000002']);
const m = await one('select * from public.memberships where user_id=$1', [barista]);
assert.equal(m.status, 'active', 'invite activates on first sign-in');
await db.query(`update public.memberships set activated_at = now() - interval '3 days', confirmed_at = now() where id=$1`, [m.id]);

// Explicit evidence-backed fixture history for scans taken before this fixture's creation.
await db.query("insert into public.subscription_entitlements(cafe_id,starts_at,ends_at,source) values($1,now()-interval '7 days',now()+interval '14 days','test_evidence')",[cafe.id]);
// Stamps: 8 stamps two hours apart complete a puzzle
const base = Date.now() - 40 * 3600 * 1000;
const stamp = (i, offline = false, staff = barista, user = customer, eventId = uuid()) =>
  one(`select public.process_stamp($1,$2,$3,$4,$5,null,$6,$7) as r`,
    [eventId, user, cafe.id, branch.id, staff, new Date(base + i * 2.5 * 3600 * 1000).toISOString(), offline]).then((x) => x.r);

let last;
for (let i = 0; i < 8; i++) last = await stamp(i);
assert.equal(last.status, 'accepted');
assert.equal(last.puzzle_completed, true);
assert.ok(last.reward_id);

// Idempotency
const ev = uuid();
const a = await stamp(9, false, barista, customer, ev);
const b = await stamp(9, false, barista, customer, ev);
assert.equal(a.status, 'accepted');
assert.equal(b.duplicate, true);

// Cooldown (same time window) online -> rejected, offline -> voided
assert.equal((await stamp(9.2)).reason, 'cooldown');
assert.equal((await stamp(9.3, true)).status, 'voided');

// Self scan and staff account
assert.equal((await stamp(12, false, barista, barista)).reason, 'self_scan');
assert.equal((await stamp(12, false, barista, owner)).reason, 'staff_account');

// Redemption: online accepted, then offline duplicate of the same reward
const red1 = (await one(`select public.process_redemption($1,$2,$3,$4,$5,$6,now(),false) as r`,
  [uuid(), last.reward_id, customer, cafe.id, branch.id, barista])).r;
assert.equal(red1.status, 'accepted');
const red2 = (await one(`select public.process_redemption($1,$2,$3,$4,$5,$6,now(),true) as r`,
  [uuid(), last.reward_id, customer, cafe.id, branch.id, barista])).r;
assert.equal(red2.status, 'duplicate');

// Revoked barista: offline scan synced after revocation -> quarantined
await db.query(`update public.memberships set status='revoked', revoked_at=now() where id=$1`, [m.id]);
assert.equal((await stamp(14, true)).status, 'quarantined');
assert.equal((await stamp(16.5, false)).status, 'rejected', 'online scan after revocation');

// Owner dashboard RPCs and RLS
await asUser(owner);
await db.exec('set role authenticated');
const customers = (await db.query('select * from public.owner_customers($1)', [cafe.id])).rows;
assert.equal(customers.length, 1);
assert.equal(customers[0].display_name, 'Ahmed M.');
const overview = (await one('select public.owner_overview($1) as o', [cafe.id])).o;
assert.equal(overview.daily.length, 30);
const staff = (await db.query(`select * from public.owner_staff_report($1, now() - interval '30 days')`, [cafe.id])).rows;
assert.equal(staff.length, 2);
await db.query(`select public.update_campaign($1, 10, '{"en":"Free Latte"}'::jsonb, 180, 120, 2)`, [cafe.id]);
assert.equal((await one('select count(*)::int c from public.campaigns where cafe_id=$1 and active', [cafe.id])).c, 1);
const activity = (await one('select public.owner_activity($1) a', [cafe.id])).a;
assert.equal((await db.query('select * from public.redemptions')).rows.length, 0, 'raw customer identities are not owner-readable');
const redemptionId = activity.redemptions.find(r => r.status === 'accepted').id;
await db.query(`select public.void_redemption($1, 'Barista pressed redeem by mistake')`, [redemptionId]);

// Push window guard: 03:00 Baghdad is rejected
await assert.rejects(db.query(`insert into public.push_campaigns (cafe_id, created_by, title, body, scheduled_at)
  values ($1, $2, '{"en":"Hi"}', '{"en":"New menu"}', (date_trunc('day', now() at time zone 'Asia/Baghdad') + interval '1 day 3 hours') at time zone 'Asia/Baghdad')`, [cafe.id, owner]), /send_window/);
await db.query(`insert into public.push_campaigns (cafe_id, created_by, title, body, scheduled_at)
  values ($1, $2, '{"en":"Hi"}', '{"en":"New menu"}', (date_trunc('day', now() at time zone 'Asia/Baghdad') + interval '1 day 12 hours') at time zone 'Asia/Baghdad')`, [cafe.id, owner]);

// Customer sees only their own data; cannot call service-only functions
await asUser(customer);
assert.equal((await db.query('select * from public.cafes')).rows.length, 0, 'customers cannot read cafe records');
assert.equal((await db.query('select * from public.user_cafe_progress')).rows.length, 1);
await assert.rejects(db.query(`select public.process_stamp($1,$2,$3,$4,$5,null,now(),false)`, [uuid(), customer, cafe.id, branch.id, barista]));
await assert.rejects(db.query('select * from public.owner_customers($1)', [cafe.id]), /not_owner/);

// Admin without MFA is not an admin
await db.exec('reset role');
await asService();
await db.query('insert into public.admins (user_id) values ($1)', [admin]);
await asUser(admin, 'aal1');
assert.equal((await one('select public.is_admin() a')).a, false);
await asUser(admin, 'aal2');
assert.equal((await one('select public.is_admin() a')).a, true);

const { auditRegression } = await import('./audit-regression.mjs');
await auditRegression(db, {owner,barista,customer,admin,cafe:cafe.id,branch:branch.id,membership:m.id});
const { finalRegression }=await import('./final-regression.mjs');
await finalRegression(db,{owner,barista,customer,admin,cafe:cafe.id,branch:branch.id});
console.log('All database checks passed.');
await db.close();
