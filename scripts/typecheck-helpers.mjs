// Strict semantic checking of dependency-free helpers, not Next.js or the Edge runtime.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const ts=require(process.env.TYPESCRIPT_PATH||require.resolve('typescript',{paths:[path.join(root,'apps/web')]}));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'brewistan-types-'));
const declarations=path.join(temporary,'deno-env.d.ts');
const sources=[
 'supabase/functions/_shared/http.ts', 'supabase/functions/_shared/crypto.ts',
 'supabase/functions/_shared/validation.ts', 'supabase/functions/_shared/worker.ts',
 'supabase/functions/_shared/device-proof.ts', 'apps/web/lib/validation.ts',
 'apps/web/lib/session-policy.ts', 'apps/web/lib/pagination.ts',
];
try {
 fs.writeFileSync(declarations,'declare const Deno: { env: { get(name: string): string | undefined } };\n');
 const program=ts.createProgram([...sources.map(f=>path.join(root,f)),declarations],{
  noEmit:true,strict:true,allowImportingTsExtensions:true,target:ts.ScriptTarget.ES2022,
  module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  lib:['lib.es2022.d.ts','lib.dom.d.ts'],
 });
 const diagnostics=ts.getPreEmitDiagnostics(program);
 if(diagnostics.length){
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{
   getCurrentDirectory:()=>root,getCanonicalFileName:f=>f,getNewLine:()=> '\n',
  }));process.exitCode=1;
 }else console.log(`${sources.length} dependency-free modules passed strict semantic type-checking (TypeScript ${ts.version}).\n${sources.join('\n')}\nA Deno.env declaration was supplied; this is not a full Edge or Next.js build.`);
} finally { fs.rmSync(temporary,{recursive:true,force:true}); }
