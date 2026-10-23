import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const r=new URL('..', import.meta.url).pathname;
const read=p=>readFileSync(join(r,p),'utf8');
test('exact Nana cafe ID is used, not name matching',()=>{
 const s=read('apps/web/lib/customer/nana-scene.ts');
 assert.match(s,/5b89b7ab-46a8-4328-99b1-bebc752b921d/);
 assert.match(s,/return isNanaSceneCafe\(cafeId\) && \(tier === 'bespoke'/);
 assert.match(s,/tier === 'signature' && testOptIn/);
});
test('only card detail mounts a Nana backdrop; card list is unaffected',()=>{
 const card=read('apps/web/components/customer/CardView.tsx');
 const list=read('apps/web/components/customer/CardsHome.tsx');
 assert.match(card,/nana-scene-background/);
 assert.match(card,/Preview scene/);
 assert.doesNotMatch(list,/nana-scene-background/);
});
test('QR is separate from the transformed loyalty card',()=>{
 const s=read('apps/web/components/customer/CardView.tsx');
 assert.match(s,/className=\{sceneActive \? 'nana-scene-card'/);
 assert.match(s,/<section className="cx-surface/);
 assert.match(s,/QRCode.toDataURL/);
});
test('owner logo preview immediately uses a selected file and published URL',()=>{
 const s=read('apps/web/app/dashboard/branding/BrandingForm.tsx');
 assert.match(s,/setPreviewLogoUrl\(temporary\)/);
 assert.match(s,/setPreviewLogoUrl\(data.publicUrl\)/);
 assert.match(s,/logoUrl=\{previewLogoUrl\}/);
 assert.match(s,/URL.revokeObjectURL/);
});
test('the supplied cafe image is bundled',()=>{
 assert.ok(existsSync(join(r,'apps/web/public/scenes/nanas-tea.webp')));
});
