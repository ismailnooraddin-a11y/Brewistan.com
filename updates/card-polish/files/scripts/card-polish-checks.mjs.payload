import test from 'node:test';
import assert from 'node:assert/strict';
import { presentation as p, surface, nodes, plainText, read, ts } from './card-polish-harness.mjs';
const cafe='5b89b7ab-46a8-4328-99b1-bebc752b921d';
const other='6b89b7ab-46a8-4328-99b1-bebc752b921d';
const basic={name:"Nana's Tea",bg:'#151311',fg:'#e8dcc6',logoUrl:null,filled:3,total:8,goal:'Free Coffee',customerName:'Ismail Nooraddin',lastStampAt:'2026-10-23T12:00:00Z'};

test('actual wallet firstName and lastName render the full name without a label',()=>{
  assert.equal(p.cardCustomerName({firstName:'Ismail',lastName:'Nooraddin'}),'Ismail Nooraddin');
  assert.equal(p.cardCustomerName({first_name:'  Ismail ',last_name:' Nooraddin '}),'Ismail Nooraddin');
  assert.equal(p.cardCustomerName(null),'');
  assert.equal(p.cardCustomerName({email:'private@example.com'}),'');
});
test('names are normalized, not fabricated or abbreviated',()=>{
  assert.equal(p.cardCustomerName({firstName:'Mary Ann',lastName:'Al Noor'}),'Mary Ann Al Noor');
  assert.equal(p.cardCustomerName({firstName:4,lastName:null}),'');
});
test('last stamp is read from this card, with safe legacy-field fallback',()=>{
  assert.equal(p.cardLastStampAt({lastStampAt:'2026-10-23T12:00:00Z'}),'2026-10-23T12:00:00Z');
  assert.equal(p.cardLastStampAt({last_stamp_at:'2026-10-22T12:00:00Z'}),'2026-10-22T12:00:00Z');
  for(const value of [null,{}, {lastStampAt:'nonsense'}, {lastVisit:'2026-10-23'}])assert.equal(p.cardLastStampAt(value),null);
});
test('date label includes the year and never invents a visit timestamp',()=>{
  assert.equal(p.cardStampDate('2026-10-23T12:00:00Z','en','UTC'),'23 Oct 2026');
  assert.equal(p.cardStampDate(null),null);
});
test('Classic and Signature ignore scene data even when it is present',()=>{
  for(const tier of ['classic','signature','unknown','BESPOKE',''])assert.equal(p.cardSceneUrl(cafe,tier,{scene:'tea_room'}),null);
});
test('Bespoke without a selected scene is black by default',()=>{
  for(const brand of [null,{}, {scene:'none'}, {scene:'unknown'}, {scene:'https://evil.example'}])assert.equal(p.cardSceneUrl(cafe,'bespoke',brand),null);
});
test('Bespoke preset resolves to the included optimized asset only',()=>{
  assert.equal(p.cardSceneUrl(cafe,'bespoke',{scene:'tea_room'}),'/card-scenes/nanas-tea-v1.webp');
});
test('tenant-scoped custom Storage scenes are accepted',()=>{
  const path=`${cafe}/scene-12345678-abcd.webp`;
  assert.equal(p.cardSceneUrl(cafe,'bespoke',{scene:'custom',scene_path:path},'https://example.supabase.co'),`https://example.supabase.co/storage/v1/object/public/branding/${path}`);
});
test('other cafe paths, traversal, scripts, SVG and remote tracking URLs are rejected',()=>{
  for(const path of [`${other}/scene-1.webp`,`${cafe}/../scene-1.webp`,`${cafe}/scene-1.svg`,'javascript:alert(1)','https://evil.example/scene.webp',`${cafe}/scene-x.webp?redirect=x`,`${cafe}/scene-%2e%2e.webp`])assert.equal(p.cardSceneUrl(cafe,'bespoke',{scene:'custom',scene_path:path},'https://example.supabase.co'),null);
});
test('unsafe or missing Storage origins fall back to black',()=>{
  for(const origin of ['', 'http://example.com','javascript:alert(1)','https://user:pass@example.com'])assert.equal(p.cardSceneUrl(cafe,'bespoke',{scene:'custom',scene_path:`${cafe}/scene-1.webp`},origin),null);
});
test('a downgrade hides an already-configured background immediately on fresh data',()=>{
  const brand={scene:'tea_room'};
  assert.ok(p.cardSceneUrl(cafe,'bespoke',brand));
  assert.equal(p.cardSceneUrl(cafe,'signature',brand),null);
});
test('balanced stamp rows preserve every stamp up to the existing maximum',()=>{
  assert.deepEqual(p.stampLayout(12,3),{count:12,stamped:3,columns:6});
  assert.deepEqual(p.stampLayout(20,20),{count:20,stamped:20,columns:10});
  assert.deepEqual(p.stampLayout(8,0),{count:8,stamped:0,columns:8});
  assert.equal(p.stampLayout(NaN,NaN).count,8);
  assert.equal(p.stampLayout(-4,999).count,1);
});
test('compact and full cards have exactly the same visible card layout',()=>{
  const a=surface.CafeCardPreview({...basic,density:'compact'});
  const b=surface.CafeCardPreview({...basic,density:'full'});
  a.props['data-density']='full';
  assert.equal(JSON.stringify(a),JSON.stringify(b));
});
test('wallet cards contain eight circular vector stamps, never progress lines',()=>{
  const tree=surface.CafeCardPreview({...basic,density:'compact'});
  const stamps=nodes(tree,n=>n.props.className==='lc_stamp');
  assert.equal(stamps.length,8);
  assert.equal(stamps.filter(n=>n.props['data-filled']==='true').length,3);
  assert.equal(nodes(tree,n=>n.type==='svg').length,8);
  assert.doesNotMatch(read('apps/web/components/cards/LoyaltyCardSurface.tsx'),/h-\[5px\]|progressbar/);
});
test('the personal footer uses the full name and the accurate last-stamp label',()=>{
  const tree=surface.CafeCardPreview(basic);
  const text=plainText(tree);
  assert.match(text,/Ismail Nooraddin/); assert.match(text,/Last stamp/);
  assert.doesNotMatch(text,/Customer name:|Last visit/);
  assert.equal(nodes(tree,n=>n.type==='time')[0].props.dateTime,basic.lastStampAt);
});
test('a customer with no activity sees No stamps yet, not a fake date',()=>{
  const tree=surface.CafeCardPreview({...basic,lastStampAt:null,filled:0});
  assert.match(plainText(tree),/No stamps yet/); assert.equal(nodes(tree,n=>n.type==='time').length,0);
});
test('public owner/card previews never contain a hardcoded customer name',()=>{
  const {customerName,lastStampAt,...publicProps}=basic;
  const tree=surface.CafeCardPreview(publicProps);
  assert.equal(nodes(tree,n=>n.props.className==='lc_personal').length,0);
});
test('long customer names remain full text and in bidi-isolated elements',()=>{
  const name='A very long first name and a very long family name';
  const tree=surface.CafeCardPreview({...basic,customerName:name});
  assert.ok(nodes(tree,n=>n.type==='bdi'&&plainText(n)===name).length);
  assert.doesNotMatch(read('apps/web/components/cards/LoyaltyCardSurface.module.css'),/text-overflow:\s*ellipsis/);
});
test('reward footer removes duplicate wording without modifying the reward',()=>{
  assert.equal(p.cardFooter('5 more \u00b7 Free Coffee','Free Coffee',5),'5 more');
  assert.equal(p.cardFooter('Reward ready \u00b7 Free Coffee','Free Coffee',0),'Reward ready');
  assert.equal(p.cardFooter('Custom message','Free Coffee',5),'Custom message');
});
test('Arabic and Sorani copy are available and dates do not crash',()=>{
  for(const lang of ['ar','ckb']){
    assert.notEqual(p.cardCopy(lang).lastStamp,'Last stamp');
    assert.ok(p.cardStampDate(basic.lastStampAt,lang,'UTC'));
  }
});
test('all supported stamp styles stay vectors',()=>{
  for(const stampStyle of ['cup','dot','bean'])assert.equal(nodes(surface.CafeCardPreview({...basic,stampStyle}),n=>n.type==='svg').length,8);
});
test('the installed card-page renderer has no customer-facing scene preview UI',()=>{
  const sf=ts.createSourceFile('CardView.tsx',read('apps/web/components/customer/CardView.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const fn=sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='CardView');
  const ret=fn.body.statements.find(ts.isReturnStatement).expression.getText(sf);
  assert.match(ret,/<CustomerCardPage/);
  assert.doesNotMatch(ret,/Standard card|DESIGN PREVIEW|scenePreview|preview=/i);
  assert.doesNotMatch(read('apps/web/components/customer/CustomerCardPage.tsx'),/Temporary Bespoke|Standard card|searchParams|localStorage/);
});
test('wallet and detail use the same component and account-profile helpers',()=>{
  for(const file of ['apps/web/components/customer/CardsHome.tsx','apps/web/components/customer/CustomerCardPage.tsx']){
    const src=read(file); assert.match(src,/CafeCardPreview/); assert.match(src,/cardCustomerName\(wallet\?\.profile\)/); assert.match(src,/cardLastStampAt/);
  }
});
test('owner colour changes preserve the saved scene and unrelated brand fields',()=>{
  const src=read('apps/web/app/dashboard/branding/BrandingForm.tsx');
  assert.match(src,/select\('brand'\)/); assert.match(src,/\.\.\.cardPolishCurrentCafe\.brand/);
});
test('scene publishing rechecks the database tier, keeps tenant paths and the 1 MB bucket limit',()=>{
  const src=read('apps/web/components/branding/CafeSceneSettings.tsx');
  assert.match(src,/tier !== 'bespoke'/); assert.match(src,/\.eq\('tier', 'bespoke'\)/);
  assert.match(src,/950_000/); assert.match(src,/upsert: false/);
  assert.match(src,/\$\{cafeId\}\/scene-/); assert.match(src,/\.\.\.\(current\.data\.brand/);
});
test('QR remains separate, unwarped and on an opaque white tile',()=>{
  const src=read('apps/web/components/customer/CustomerCardPage.tsx');
  const css=read('apps/web/components/customer/CustomerCardPage.module.css');
  assert.match(src,/src=\{qrImage\}/); assert.match(css,/max-width: 266px/); assert.match(css,/background: #fff/);
  assert.doesNotMatch(css,/rotate\(|perspective\(|scale\(/);
});
test('the package does not change authentication or QR cryptography modules',()=>{
  const src=read('scripts/apply-card-polish.mjs');
  assert.doesNotMatch(src,/plan\.set\(['"]apps\/web\/lib\/customer\/(device|protocol|supabase)/);
});
test('background-only rendering uses the stored cafe setting, never its name',()=>{
  const src=read('apps/web/lib/customer/card-presentation.ts');
  assert.doesNotMatch(src,/name\s*===|5b89b7ab/);
  assert.match(src,/tier !== 'bespoke'/);
});
