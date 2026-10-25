#!/usr/bin/env node
/** Safely integrate the UI update into CURRENT source, preserving QR/auth hooks.
 * Requires the project's existing TypeScript dev dependency (npm ci in apps/web).
 * No network, database writes, production deployment, or credentials are used.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const safePath = name => {
  const resolved = path.resolve(root, name);
  if (!resolved.startsWith(root + path.sep)) throw new Error(`Unsafe package path: ${name}`);
  return resolved;
};
const walkFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const name = path.join(dir, entry.name);
  if (entry.isSymbolicLink()) throw new Error(`Symlink not permitted: ${name}`);
  return entry.isDirectory() ? walkFiles(name) : [name];
});
let ts;
try { ts = require(process.env.TYPESCRIPT_PATH || require.resolve('typescript', { paths: [path.join(root, 'apps/web')] })); }
catch { console.error('TypeScript is required. Run: npm --prefix apps/web ci\nThen run this installer again. No source files were changed.'); process.exit(1); }
const parse = (source, name) => ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const plan = new Map();
const edits = (source, changes) => {
  let last = source.length + 1;
  for (const change of [...changes].sort((a,b) => b.start - a.start)) {
    if (change.end > last) throw new Error('Overlapping source edits; refusing to guess.');
    source = source.slice(0,change.start) + change.text + source.slice(change.end);
    last = change.start;
  }
  return source;
};
function addImport(source, statement) {
  if (source.includes(statement)) return source;
  const sf = parse(source, 'source.tsx');
  let offset = 0;
  for (const s of sf.statements) {
    if (ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression)) offset = s.end;
    else break;
  }
  return source.slice(0,offset) + '\n' + statement + '\n' + source.slice(offset);
}
function visit(node, fn) { fn(node); ts.forEachChild(node, child => visit(child, fn)); }
function namedFunction(sf, name) {
  let result;
  visit(sf, n => { if (ts.isFunctionDeclaration(n) && n.name?.text === name) result = n; });
  if (!result?.body) throw new Error(`${name} has an unfamiliar structure. No source was changed.`);
  return result;
}
function renderedReturn(fn) {
  const returns = fn.body.statements.filter(ts.isReturnStatement);
  if (returns.length !== 1 || !returns[0].expression) throw new Error('Ambiguous page return. Refusing to overwrite current logic.');
  return returns[0].expression;
}
function patchWallet() {
  const name = 'apps/web/components/customer/CardsHome.tsx';
  let source = read(name);
  const sf = parse(source,name);
  const fn = namedFunction(sf,'CardsHome');
  const changes = []; let found = 0;
  visit(fn, n => {
    if (!ts.isJsxSelfClosingElement(n) || n.tagName.getText(sf) !== 'CafeCardPreview') return;
    found++;
    const attrs = n.attributes.properties;
    const nameAttr = attrs.find(p => ts.isJsxAttribute(p) && p.name.getText(sf) === 'name');
    const cafeExpr = nameAttr?.initializer?.expression;
    if (!cafeExpr || !ts.isPropertyAccessExpression(cafeExpr) || cafeExpr.name.text !== 'name') throw new Error('Unrecognized wallet card data source.');
    const cafe = cafeExpr.expression.getText(sf);
    const has = value => attrs.some(p => ts.isJsxAttribute(p) && p.name.getText(sf) === value);
    const newAttrs = [
      !has('customerName') && 'customerName={cardCustomerName(wallet?.profile)}',
      !has('lastStampAt') && `lastStampAt={cardLastStampAt(${cafe})}`,
      !has('locale') && 'locale={lang}',
      !has('stampStyle') && `stampStyle={${cafe}.tier === 'classic' ? 'cup' : ${cafe}.brand?.stamp}`,
    ].filter(Boolean).join(' ');
    if (newAttrs) changes.push({start:n.end-2,end:n.end-2,text:' '+newAttrs+' '});
    const density = attrs.find(p => ts.isJsxAttribute(p) && p.name.getText(sf)==='density');
    if (density?.initializer && density.initializer.getText(sf)!=='"full"') changes.push({start:density.initializer.getStart(sf),end:density.initializer.end,text:'"full"'});
  });
  if (!found) throw new Error('Could not find the wallet card component. No source was changed.');
  source = edits(source,changes);
  source = addImport(source,"import { cardCustomerName, cardLastStampAt } from '@/lib/customer/card-presentation';");
  plan.set(name,Buffer.from(source));
}
function patchCardPage() {
  const name='apps/web/components/customer/CardView.tsx';
  let source=read(name); const sf=parse(source,name); const fn=namedFunction(sf,'CardView');
  const expression=renderedReturn(fn);
  if (expression.getText(sf).includes('<CustomerCardPage ')) { plan.set(name,Buffer.from(source)); return; }
  const bodyText=fn.getText(sf);
  for (const identifier of ['customer','wallet','cafeId','qrImage','qrError','offline']) {
    if (!new RegExp(`\\b${identifier}\\b`).test(bodyText)) throw new Error(`Current CardView uses an unfamiliar ${identifier} variable. No source was changed.`);
  }
  const resolved = /\bresolved\b/.test(bodyText) ? 'resolved' : 'Boolean(wallet || offline)';
  const retry = /\breload\b/.test(bodyText) ? '() => { if (customer.user) void reload(customer.user.id); }' : '() => window.location.reload()';
  const jsx=`(<CustomerCardPage cafeId={cafeId} customer={customer} wallet={wallet}\n      qrImage={qrImage} qrError={qrError} offline={offline} resolved={${resolved}}\n      onRetry={${retry}} />)`;
  source=edits(source,[{start:expression.getStart(sf),end:expression.end,text:jsx}]);
  source=addImport(source,"import { CustomerCardPage } from './CustomerCardPage';");
  plan.set(name,Buffer.from(source));
}
function patchBrandingPage() {
  const name='apps/web/app/dashboard/branding/page.tsx'; let source=read(name);
  if (source.includes('<CafeSceneSettings ')) { plan.set(name,Buffer.from(source)); return; }
  const sf=parse(source,name); const fn=namedFunction(sf,'BrandingPage'); const expression=renderedReturn(fn);
  const jsx=`(<>\n      {${expression.getText(sf)}}\n      <CafeSceneSettings key={'scene-' + cafe.id} cafeId={cafe.id} tier={cafe.tier} brand={cafe.brand ?? {}} />\n    </>)`;
  source=edits(source,[{start:expression.getStart(sf),end:expression.end,text:jsx}]);
  source=addImport(source,"import { CafeSceneSettings } from '@/components/branding/CafeSceneSettings';");
  plan.set(name,Buffer.from(source));
}
function patchBrandingSave() {
  const name='apps/web/app/dashboard/branding/BrandingForm.tsx'; let source=read(name);
  if (source.includes('cardPolishCurrentCafe')) { plan.set(name,Buffer.from(source)); return; }
  const sf=parse(source,name); const fn=namedFunction(sf,'save'); let property;
  visit(fn,n=>{
    if (ts.isPropertyAssignment(n) && n.name.getText(sf)==='brand' && ts.isObjectLiteralExpression(n.initializer)) {
      const keys=n.initializer.properties.map(p=>p.name?.getText(sf));
      if (keys.includes('template') && keys.includes('primary') && keys.includes('accent')) property=n;
    }
  });
  if (!property) throw new Error('Branding save has changed. Refusing to drop current branding fields.');
  let stmt=property;
  while (stmt && !ts.isVariableStatement(stmt)) stmt=stmt.parent;
  if (!stmt) throw new Error('Could not safely integrate background preservation.');
  const preface=`const { data: cardPolishCurrentCafe, error: cardPolishReadError } = await supabase.from('cafes').select('brand').eq('id', cafeId).single();\n      if (cardPolishReadError || !cardPolishCurrentCafe) throw new Error('branding_read_failed');\n      `;
  source=edits(source,[
    {start:stmt.getStart(sf),end:stmt.getStart(sf),text:preface},
    {start:property.initializer.getStart(sf)+1,end:property.initializer.getStart(sf)+1,text:' ...cardPolishCurrentCafe.brand,'},
  ]);
  plan.set(name,Buffer.from(source));
}

try {
  // Validate the delivered files before touching any existing application source.
  const sums=read('updates/card-polish/SHA256SUMS').trim().split('\n');
  for (const line of sums) {
    const match=line.match(/^([a-f0-9]{64})  (.+)$/);
    if (!match) throw new Error('Malformed update manifest.');
    const file=safePath('updates/card-polish/'+match[2]);
    if (sha(fs.readFileSync(file))!==match[1]) throw new Error(`Package integrity failed: ${match[2]}`);
  }
  const payload=path.join(root,'updates/card-polish/files');
  for (const file of walkFiles(payload)) {
    const relative=path.relative(payload,file).split(path.sep).join('/');
    if (!relative.endsWith('.payload')) throw new Error('Unexpected payload file: '+relative);
    const name=relative.slice(0,-'.payload'.length);
    plan.set(name,fs.readFileSync(file));
  }
  // Preserve every line of CardView's QR generation and authentication code.
  patchWallet(); patchCardPage(); patchBrandingPage(); patchBrandingSave();
  plan.set('apps/web/components/CafeCardPreview.tsx',Buffer.from(
    "// One crisp card surface in the wallet, opened card and owner preview.\nexport { CafeCardPreview } from './cards/LoyaltyCardSurface';\nexport type { CardDensity, CafeCardPreviewProps } from './cards/LoyaltyCardSurface';\n"));
  const swName='apps/web/public/sw.js';
  if (fs.existsSync(path.join(root,swName))) {
    let sw=read(swName).replace(/const VERSION\s*=\s*(['"])[^'"]+\1;/,"const VERSION = 'bw-customer-card-polish-20261025-v1';");
    if (!sw.includes("url.pathname.startsWith('/card-scenes/')")) sw=sw.replace("url.pathname.startsWith('/icons/')", "url.pathname.startsWith('/icons/') || url.pathname.startsWith('/card-scenes/')");
    plan.set(swName,Buffer.from(sw));
  }
  for (const [name,bytes] of plan) {
    if (!/\.tsx?$/.test(name)) continue;
    const errors=parse(bytes.toString('utf8'),name).parseDiagnostics;
    if (errors.length) throw new Error('TypeScript syntax error in '+name+': '+errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')).join('; '));
  }
  // Retain existing manifest entries; update only files this installer supplies/edits.
  const manifest=new Map();
  for (const line of read('MANIFEST.sha256').split('\n').filter(Boolean)) {
    const match=line.match(/^([a-f0-9]{64})  (.+)$/); if (!match) throw new Error('Malformed project manifest.');
    safePath(match[2]); manifest.set(match[2],match[1]);
  }
  for (const [name,bytes] of plan) manifest.set(name,sha(bytes));
  for (const file of walkFiles(path.join(root,'updates/card-polish'))) manifest.set(path.relative(root,file).split(path.sep).join('/'),sha(fs.readFileSync(file)));
  manifest.set('scripts/apply-card-polish.mjs',sha(fs.readFileSync(fileURLToPath(import.meta.url))));
  plan.set('MANIFEST.sha256',Buffer.from([...manifest].sort(([a],[b])=>a.localeCompare(b)).map(([name,digest])=>`${digest}  ${name}`).join('\n')+'\n'));

  const changed=[...plan].filter(([name,bytes])=>!fs.existsSync(safePath(name)) || !fs.readFileSync(safePath(name)).equals(bytes));
  if (!changed.length) { console.log('Card polish is already installed. No changes needed.'); process.exit(0); }
  const backup=fs.mkdtempSync(path.join(os.tmpdir(),'brewistan-card-polish-'));
  const originals=new Map();
  for (const [name] of changed) {
    const file=safePath(name); const bytes=fs.existsSync(file)?fs.readFileSync(file):null; originals.set(name,bytes);
    if (bytes) { const target=path.join(backup,name); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,bytes); }
  }
  const applied=[];
  try {
    for (const [name,bytes] of changed) {
      const file=safePath(name); fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.writeFileSync(file+'.card-polish.tmp',bytes); fs.renameSync(file+'.card-polish.tmp',file); applied.push(name);
    }
  } catch (error) {
    for (const name of applied.reverse()) { const old=originals.get(name); if (old) fs.writeFileSync(safePath(name),old); else fs.rmSync(safePath(name),{force:true}); }
    throw error;
  }
  console.log(`Applied card polish to ${changed.length} files.\nBackup: ${backup}\nNo database or production settings were changed.\n\nNext:\n  node scripts/card-polish-checks.mjs\n  python3 scripts/verify-manifest.py\n  npm --prefix apps/web run typecheck\n  npm --prefix apps/web run build\n\nFor Bespoke cafes: Dashboard > Branding > Cafe atmosphere > choose image > Publish background.\nNana's Tea is not automatically upgraded or given a paid feature.`);
} catch (error) {
  console.error('Card polish not applied: '+(error instanceof Error?error.message:String(error)));
  process.exitCode=1;
}
