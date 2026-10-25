// Isolated component/helper test harness. This does not replace a Next.js build or live API tests.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
export const ts=require(process.env.TYPESCRIPT_PATH || require.resolve('typescript',{paths:[path.join(root,'apps/web')]}));
export const read=name=>fs.readFileSync(path.join(root,name),'utf8');
export const jsx=(type,props)=>typeof type==='function'?type(props||{}):({type,props:props||{}});
export const runtime={jsx,jsxs:jsx,Fragment:'fragment'};
export function load(name,imports={}) {
  const compiled=ts.transpileModule(read(name),{fileName:name,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
  const errors=compiled.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error);
  if(errors.length)throw new Error(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')).join('\n'));
  const module={exports:{}};
  new Function('module','exports','require',compiled.outputText)(module,module.exports,id=>{
    if(id==='react/jsx-runtime')return runtime;
    if(!(id in imports))throw new Error('Unexpected test dependency: '+id);
    return imports[id];
  });
  return module.exports;
}
export const styleNames=prefix=>new Proxy({},{get:(_target,key)=>`${prefix}${String(key)}`});
export const presentation=load('apps/web/lib/customer/card-presentation.ts');
export const surface=load('apps/web/components/cards/LoyaltyCardSurface.tsx',{
  '@/lib/customer/card-presentation':presentation,
  './LoyaltyCardSurface.module.css':{__esModule:true,default:styleNames('lc_')},
});
export function nodes(tree,predicate=()=>true){
  if(tree===undefined||tree===null||typeof tree==='boolean')return[];
  if(Array.isArray(tree))return tree.flatMap(t=>nodes(t,predicate));
  if(typeof tree!=='object')return[];
  return [...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];
}
export function plainText(tree){
  if(tree==null||typeof tree==='boolean')return'';
  if(Array.isArray(tree))return tree.map(plainText).join('');
  return typeof tree==='object'?plainText(tree.props?.children):String(tree);
}
const escapes={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const escape=value=>String(value).replace(/[&<>"']/g,c=>escapes[c]);
const kebab=value=>value.startsWith('--')?value:value.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
export function html(tree){
  if(tree==null||typeof tree==='boolean')return'';
  if(Array.isArray(tree))return tree.map(html).join('');
  if(typeof tree!=='object')return escape(tree);
  if(tree.type==='fragment')return html(tree.props.children);
  const attrs=Object.entries(tree.props).filter(([key,value])=>!['children','key','ref'].includes(key)&&!key.startsWith('on')&&value!==undefined&&value!==null&&value!==false).map(([key,value])=>{
    const name=key==='className'?'class':key==='htmlFor'?'for':key==='strokeWidth'?'stroke-width':key==='strokeLinecap'?'stroke-linecap':key==='strokeLinejoin'?'stroke-linejoin':key;
    if(key==='style')return ` style="${escape(Object.entries(value).map(([k,v])=>`${kebab(k)}:${v}`).join(';'))}"`;
    return ` ${name}="${escape(value)}"`;
  }).join('');
  const voids=['img','input','br','hr','meta','link'];
  return `<${tree.type}${attrs}>${voids.includes(tree.type)?'':html(tree.props.children)+`</${tree.type}>`}`;
}
