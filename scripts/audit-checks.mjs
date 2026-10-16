// Runtime tests of the actual dependency-free TS modules. This is NOT a Next/Deno/Flutter build.
// npm ci --prefix apps/web; node --test scripts/audit-checks.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const ts=require(process.env.TYPESCRIPT_PATH || require.resolve('typescript',{paths:[path.join(root,'apps/web')]}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'brewistan-tests-'));
process.on('exit',()=>fs.rmSync(temp,{recursive:true,force:true}));
globalThis.Deno={env:{get:key=>process.env[key],set:(key,value)=>{process.env[key]=value;}}};
function allFiles(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?['.git','node_modules','.next','build'].includes(x.name)?[]:allFiles(path.join(dir,x.name)):[path.join(dir,x.name)]); }
const files=allFiles(root).filter(p=>/\.(tsx?|mjs)$/.test(p));
for(const rel of ['supabase/functions/_shared/http.ts','supabase/functions/_shared/crypto.ts','supabase/functions/_shared/validation.ts','apps/web/lib/validation.ts','apps/web/lib/session-policy.ts']) {
 const out=path.join(temp,rel.replace(/\.ts$/,'.mjs'));fs.mkdirSync(path.dirname(out),{recursive:true});
 const code=ts.transpileModule(fs.readFileSync(path.join(root,rel),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(from\s+['"][^'"]+)\.ts(['"])/g,'$1.mjs$2');
 fs.writeFileSync(out,code);
}
const load=rel=>import(pathToFileURL(path.join(temp,rel.replace(/\.ts$/,'.mjs'))));
const http=await load('supabase/functions/_shared/http.ts');
const q=await load('supabase/functions/_shared/crypto.ts');
const v=await load('apps/web/lib/validation.ts');
const phone=await load('supabase/functions/_shared/validation.ts');
const sessions=await load('apps/web/lib/session-policy.ts');
const seed=Buffer.from('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60','hex');
process.env.PLATFORM_SIGNING_SEED=q.b64url.encode(seed);
const te=new TextEncoder();
const now=1800000000000;
async function customerQr({at=now,certExpiry=now/1000+3600,voucher='0',window=Math.floor(at/30000)}={}) {
 const keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 const k=q.b64url.encode(new Uint8Array(await crypto.subtle.exportKey('raw',keys.publicKey)));
 const cert=await q.signToken({t:'dc',u:'customer-1',d:'device-1',k,e:certExpiry});
 const body=`BW1~${cert}~${window}~${voucher}`;
 return body+'~'+q.b64url.encode(new Uint8Array(await crypto.subtle.sign('Ed25519',keys.privateKey,te.encode(body))));
}
test('all TypeScript/TSX sources parse, without claiming semantic compilation',()=>{
 let checked=0;
 for(const file of files.filter(f=>/\.tsx?$/.test(f))) {
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  assert.equal(source.parseDiagnostics.length,0,`${path.relative(root,file)}: ${source.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; ')}`);checked++;
 }
 console.log(`Syntax-only check: ${checked} TS/TSX files; compiler ${ts.version}`);
});
test('relative TS imports resolve to existing project files',()=>{
 for(const file of files.filter(f=>/\.tsx?$/.test(f))) {
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  for(const node of source.statements) {
   if(!ts.isImportDeclaration(node)||!node.moduleSpecifier.text?.startsWith('.'))continue;
   const target=path.resolve(path.dirname(file),node.moduleSpecifier.text);
   assert.ok([target,target+'.ts',target+'.tsx',target+'.js',path.join(target,'index.ts'),path.join(target,'index.tsx')].some(p=>fs.existsSync(p)),`${file}: ${target}`);
  }
 }
});
test('Ed25519 seed derives the RFC 8032 known public key',async()=>{
 assert.equal(Buffer.from(await q.platformPublicKey()).toString('hex'),'d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
});
test('Ed25519 verifies RFC 8032 empty-message signature and rejects tampering',async()=>{
 const sig=Buffer.from('e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b','hex');
 assert.equal(await q.verifyEd25519(sig,new Uint8Array(),await q.platformPublicKey()),true);
 sig[0]^=1;assert.equal(await q.verifyEd25519(sig,new Uint8Array(),await q.platformPublicKey()),false);
});
test('signed platform tokens round-trip and reject malformed/tampered/oversized input',async()=>{
 const token=await q.signToken({t:'dc',u:'u'});assert.deepEqual(await q.verifyToken(token),{t:'dc',u:'u'});
 for(const invalid of ['','a.b.c',token+'x','!.'+token,'x'.repeat(16001)])assert.equal(await q.verifyToken(invalid),null);
});
test('base64url binary round-trip; malformed input rejected',()=>{
 const data=Uint8Array.from({length:256},(_,i)=>i);assert.deepEqual(q.b64url.decode(q.b64url.encode(data)),data);
 for(const s of ['a','%%%','a=','ab+/'])assert.throws(()=>q.b64url.decode(s));
});
test('valid customer QR verifies with no voucher',async()=>{assert.equal((await q.verifyCustomerQr(await customerQr(),now)).cert.u,'customer-1');});
test('adjacent QR windows accepted, old and future windows rejected',async()=>{
 const w=now/30000;
 for(const delta of [-1,1])await q.verifyCustomerQr(await customerQr({window:w+delta}),now);
 for(const delta of [-2,2])await assert.rejects(()=>customerQr({window:w+delta}).then(qr=>q.verifyCustomerQr(qr,now)),/qr_expired/);
});
test('certificate expiry is exclusive at the exact second',async()=>{await assert.rejects(()=>customerQr({certExpiry:now/1000}).then(qr=>q.verifyCustomerQr(qr,now)),/cert_expired/);});
test('QR signature and format reject tampering and over-limit data',async()=>{
 const qr=await customerQr();await assert.rejects(()=>q.verifyCustomerQr(qr.replace('BW1~','BW1~x'),now));
 await assert.rejects(()=>q.verifyCustomerQr('x'.repeat(8193),now));await assert.rejects(()=>q.verifyCustomerQr(qr,NaN));
});
test('voucher accepted only for matching customer, correct tag, and future expiry',async()=>{
 for(const [u,t,e,expected] of [['customer-1','rv',now/1000+100,true],['other','rv',now/1000+100,false],['customer-1','dc',now/1000+100,false],['customer-1','rv',now/1000,false]]) {
  const voucher=await q.signToken({t,u,r:'reward-1',c:'cafe-1',e});const result=await q.verifyCustomerQr(await customerQr({voucher}),now);
  assert.equal(result.voucher?.r==='reward-1',expected);
 }
});
test('OTP digit generation validates lengths and produces fixed-length digits',()=>{for(const n of [1,6,32])assert.match(q.randomDigits(n),new RegExp(`^\\d{${n}}$`));for(const n of [0,33,NaN,1.5])assert.throws(()=>q.randomDigits(n));});
test('SHA-256 known vector',async()=>{assert.equal(await q.sha256Hex('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');});
test('CORS allows both dashboards and native clients; rejects other origins',()=>{
 process.env.ALLOWED_ORIGINS='https://owner.test, https://admin.test';
 for(const origin of ['https://owner.test','https://admin.test'])assert.equal(http.corsHeaders(new Request('https://edge.test',{headers:{origin}}))['Access-Control-Allow-Origin'],origin);
 assert.equal(http.corsHeaders(new Request('https://edge.test'))['Access-Control-Allow-Origin'],undefined);
 assert.throws(()=>http.corsHeaders(new Request('https://edge.test',{headers:{origin:'https://evil.test'}})),/origin_not_allowed/);
});
test('HTTP wrapper supports POST/preflight and never mutates on GET',async()=>{
 let mutations=0;const h=http.handler(async()=>{mutations++;return http.json({ok:true});});
 assert.equal((await h(new Request('https://edge.test'))).status,405);assert.equal(mutations,0);
 assert.equal((await h(new Request('https://edge.test',{method:'OPTIONS'}))).status,204);assert.equal(mutations,0);
 const response=await h(new Request('https://edge.test',{method:'POST'}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(mutations,1);
});
test('JSON accepts objects, rejects invalid, null, arrays and wrong media types',async()=>{
 const req=(body,headers={'content-type':'application/json'})=>new Request('https://edge.test',{method:'POST',headers,body});
 assert.deepEqual(await http.readJson(req('{"id":1}')),{id:1});
 for(const body of ['null','[]','not-json',''])await assert.rejects(()=>http.readJson(req(body)),/invalid_json/);
 await assert.rejects(()=>http.readJson(req('{}',{'content-type':'text/plain'})),/json_required/);
});
test('body limits enforced with and without Content-Length',async()=>{
 await assert.rejects(()=>http.readJson(new Request('https://edge.test',{method:'POST',headers:{'content-type':'application/json','content-length':'2000001'},body:'{}'})),/body_too_large/);
 await assert.rejects(()=>http.readJson(new Request('https://edge.test',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(2000001)})),/body_too_large/);
});
test('UUID validation normalizes valid IDs and rejects ambiguous values',()=>{
 assert.equal(http.requireUuid('ABCD0000-0000-0000-0000-000000000000','id'),'abcd0000-0000-0000-0000-000000000000');
 for(const x of [null,12,{},'bad'])assert.throws(()=>http.requireUuid(x,'id'));
 assert.equal(http.optionalUuid('', 'id'),null);
});
test('Arabic and Persian digits normalize in web and server',()=>{
 const input='\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669 \u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9';
 assert.equal(v.asciiDigits(input),'0123456789 0123456789');assert.equal(phone.asciiDigits(input),'0123456789 0123456789');
 assert.equal(phone.normalizePhone('+964 750 123 4567'),'9647501234567');
});
test('Baghdad schedule converts 09:00 and 20:59; rejects rollover dates/window/past',()=>{
 assert.equal(v.baghdadToIso('2099-01-01T09:00'),'2099-01-01T06:00:00.000Z');assert.equal(v.baghdadToIso('2099-01-01T20:59'),'2099-01-01T17:59:00.000Z');
 for(const s of ['2099-02-30T12:00','2099-01-01T08:59','2099-01-01T21:00','2020-01-01T12:00','bad'])assert.throws(()=>v.baghdadToIso(s));
});
test('contrast ratio handles canonical black/white and invalid hex',()=>{assert.equal(v.contrastRatio('#000000','#ffffff'),21);assert.equal(v.contrastRatio('#ABCDEF','#ABCDEF'),1);assert.ok(Number.isNaN(v.contrastRatio('red','#ffffff')));});
const secret='test-secret-'.repeat(5), ctx={userId:'u',sessionId:'session-1',authenticatedAt:now};
test('signed session envelope can be refreshed within bounds',async()=>{
 const first=await sessions.advanceSession(undefined,ctx,secret,now);assert.ok(first);
 assert.ok(await sessions.advanceSession(first,ctx,secret,now+30_000));
});
test('cookie removal, tampering, and cross-account replay cannot restart an older session',async()=>{
 const first=await sessions.advanceSession(undefined,ctx,secret,now);const later=now+600_000;
 assert.equal(await sessions.advanceSession(undefined,ctx,secret,later),null);
 assert.equal(await sessions.advanceSession(first+'x',ctx,secret,later),null);
 assert.equal(await sessions.advanceSession(first,{...ctx,userId:'other'},secret,later),null);
});
test('absolute and idle expiry are exclusive; future timestamps and weak secrets rejected',async()=>{
 const first=await sessions.advanceSession(undefined,ctx,secret,now);
 assert.equal(await sessions.advanceSession(first,ctx,secret,now+sessions.IDLE_MS),null);
 assert.equal(await sessions.advanceSession(first,ctx,secret,now+sessions.ABSOLUTE_MS),null);
 assert.equal(await sessions.advanceSession(undefined,{...ctx,authenticatedAt:now+60_000},secret,now),null);
 await assert.rejects(()=>sessions.advanceSession(undefined,ctx,'short',now));
});
test('verified auth context uses primary AMR, not refresh/MFA/iat',()=>{
 const token=claims=>'header.'+q.b64url.encode(te.encode(JSON.stringify(claims)))+'.signature';
 const claims={sub:'u',session_id:'s',iat:999,amr:[{method:'otp',timestamp:100},{method:'totp',timestamp:900},{method:'token_refresh',timestamp:950}]};
 assert.equal(sessions.contextFromVerifiedSession(token(claims),'u').authenticatedAt,100000);
 assert.equal(sessions.contextFromVerifiedSession(token({...claims,sub:'other'}),'u'),null);
 assert.equal(sessions.contextFromVerifiedSession(token({...claims,amr:[{method:'token_refresh',timestamp:950}]}),'u'),null);
});
test('manifest pins match lockfile resolved artifacts',()=>{
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'apps/web/package.json'))),lock=JSON.parse(fs.readFileSync(path.join(root,'apps/web/package-lock.json')));
 for(const group of ['dependencies','devDependencies'])for(const [name,version]of Object.entries(pkg[group])){assert.equal(version,lock.packages['node_modules/'+name].version);assert.equal(lock.packages[''][group][name],version);}
});

test('legacy queue requests fail as a whole so old clients cannot delete individual scans',()=>{
 assert.throws(()=>phone.requireCurrentQueueFormat([{eventId:'old',qr:'code'}]),{status:426,code:'client_upgrade_required'});
 assert.doesNotThrow(()=>phone.requireCurrentQueueFormat([{staffId:'u',scannerDeviceId:'d',snapshot:'signed'}]));
});
