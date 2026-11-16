import {parseMakeCodeTs} from './ts-import.js';
import {analyseCallableBindings} from './callable-bindings.js';
import {physicalUpdateSourceSnapshot} from './physical-update-source-snapshot.js';
let active=null;
const consumers=new WeakMap();
const metadata=new Set(['originalBody','paramTypes','returnType','parameterDefaults','typeParameters','assertedType','sourceCallableDeclarations','sourceReferenceDeclarations','calls']);
const operations=new Set(['fillRect','drawRect','drawLine']);
const forbidden=new Set(['this','globalThis','global','window','self','eval','Function','Reflect','Object','Proxy','arguments','require','module','exports']);
const call=n=>n?.type==='Call'&&!n.isNew&&!n.constructorCall&&!n.optional&&!n.typeArguments?.length&&Array.isArray(n.args)&&!n.args.some(a=>a?.type==='Spread');
const validRow=row=>{
 if(!Array.isArray(row)||row.length!==6||!operations.has(row[0])||!row.slice(1).every(Number.isInteger)||row[5]<0||row[5]>15)return false;
 const [,a,b,c,d]=row;
 return row[0]==='drawLine'?a>=0&&a<160&&c>=0&&c<160&&b>=0&&b<120&&d>=0&&d<120:a>=0&&b>=0&&c>=0&&d>=0&&a+c<=160&&b+d<=120;
};
function inspect(program){
 const snapshot=physicalUpdateSourceSnapshot(program);if(!snapshot)return null;
 const nodes=[],parents=new WeakMap(),seen=new WeakSet();let valid=true;
 const visit=(n,p=null)=>{if(!n||typeof n!=='object')return;if(seen.has(n)){valid=false;return;}seen.add(n);parents.set(n,p);if(!Array.isArray(n))nodes.push(n);for(const key of Object.keys(n))if(!metadata.has(key))visit(n[key],n);};visit(program);if(!valid)return null;
 const bindings=analyseCallableBindings(program),lookup=(n,name)=>{for(let p=n;p;p=parents.get(p)){for(let s=bindings.scopes.get(p);s;s=s.parent)if(s.names.has(name))return s.names.get(name);}return bindings.global.names.get(name)||null;};
 for(const n of nodes){
  if(['Unknown','Class','Object','Index'].includes(n.type)||n.opaque||n.type==='Call'&&(n.isNew||n.constructorCall)||n.type==='Identifier'&&(forbidden.has(n.name)||n.name==='screen')||n.type==='Member'&&['constructor','prototype','__proto__','screen','currentScene','eventContext'].includes(n.name)||n.type==='Namespace'&&n.name==='scene'||n.type==='Template'&&n.value?.includes('${'))return null;
  const target=n.type==='Assignment'?n.left:n.type==='Update'||n.type==='Unary'&&n.op==='delete'?n.argument:null;
  if(target?.type==='Member'&&operations.has(target.name))return null;
  if(n.type==='Identifier'&&n.name==='scene'){
   const m=parents.get(n),c=parents.get(m);
   if(lookup(n,'scene')||m?.type!=='Member'||m.object!==n||m.optional||!['createRenderable','setBackgroundColor'].includes(m.name)||!call(c)||c.callee!==m)return null;
  }
 }
 const packets=new WeakMap(),signatures=[];let count=0;
 for(const n of nodes){
  if(!call(n)||n.callee?.type!=='Member'||n.callee.name!=='createRenderable'||n.callee.object?.type!=='Identifier'||n.callee.object.name!=='scene')continue;
  const parent=parents.get(n),fn=n.args[1],scope=bindings.scopes.get(fn);
  if(parent?.type!=='ExpressionStatement'||parent.expr!==n||n.args.length!==2||n.args[0]?.type!=='Number'||Number(n.args[0].value)!==0||fn?.type!=='FunctionExpression'||fn.selfName||fn.params?.length!==2||new Set(fn.params).size!==2||['async','isAsync','generator','isGenerator'].some(k=>fn[k])||fn.restParam||fn.parameterDefaults?.length||fn.optionalParams?.length||Object.values(fn.paramTypes||{}).some(t=>t?.text||t?.isArray)||fn.body.length>32)return null;
  const target=scope?.names.get(fn.params[0]);if(target?.kind!=='parameter'||target.node!==fn||target.written)return null;
  const packet=[];
  for(const statement of fn.body){const c=statement?.type==='ExpressionStatement'&&statement.expr,m=c?.callee;
   if(!call(c)||m?.type!=='Member'||m.optional||m.object?.type!=='Identifier'||bindings.references.get(m.object)!==target||!operations.has(m.name)||c.args.length!==5||!c.args.every(a=>a?.type==='Number'))return null;
   const row=[m.name,...c.args.map(a=>Number(a.value))];if(!validRow(row))return null;packet.push(row);
  }
  for(const row of packet)Object.freeze(row);Object.freeze(packet);packets.set(n,packet);signatures.push(JSON.stringify(packet));count++;
 }
 return count&&snapshot.current()?{packets,snapshot,signatures}:null;
}
function prepare(files){
 try{
  const keys=Reflect.ownKeys(files),rows=keys.map(k=>[k,Object.getOwnPropertyDescriptor(files,k)]),values=Object.create(null);
  for(const [k,d]of rows){if(typeof k!=='string'||!d||!Object.hasOwn(d,'value')||typeof d.value!=='string')return null;values[k]=d.value;}
  if(!Object.values(values).some(s=>s.includes('createRenderable')))return null;
  const config=JSON.parse(values['pxt.json']||'null');if(config&&(!Array.isArray(config.files)||config.testFiles!==undefined&&!Array.isArray(config.testFiles)||config.dependencies?.device!=='*'||Object.keys(config.dependencies).some(k=>k!=='device')||Object.keys(config.fileDependencies||{}).length))return null;
  const names=new Set([...(config?.files||['main.ts']),...(config?.testFiles||[]),...Object.keys(values).filter(k=>k.endsWith('.ts'))]),sources=[];
  for(const name of names){if(typeof name!=='string')return null;if(!/\.(?:ts|py|asm|c|cpp|h|js)$/.test(name))continue;if(name.endsWith('.py')&&['tsprj','blocksprj'].includes(config?.preferredEditor))continue;if(!Object.hasOwn(values,name)||!name.endsWith('.ts')||/\.(?:g|d)\.ts$/.test(name))return null;sources.push(values[name]);}
  const source=inspect(parseMakeCodeTs(sources.join('\n'),{retainCallableMetadata:true,parameterDefaults:true}));if(!source)return null;
  return {signatures:source.signatures,current:()=>{const now=Reflect.ownKeys(files);return now.length===keys.length&&now.every((k,i)=>k===keys[i])&&rows.every(([k,b])=>{const d=Object.getOwnPropertyDescriptor(files,k);return d&&Object.hasOwn(d,'value')&&d.value===b.value&&d.enumerable===b.enumerable&&d.configurable===b.configurable&&d.writable===b.writable;});}};
 }catch{return null;}
}
export function withLiteralRenderableSource(files,run){const previous=active;active=prepare(files);try{return run();}finally{active=previous;}}
export function bindLiteralRenderableConsumer(translator,program){if(active?.current()){const proof=inspect(program);if(proof&&JSON.stringify(proof.signatures)===JSON.stringify(active.signatures))consumers.set(translator,{scope:active,proof});}}
export function literalRenderablePacket(translator,node){const fact=consumers.get(translator),packet=fact?.proof.packets.get(node);return packet&&active?.current()&&fact.scope===active&&fact.proof.snapshot.current()?packet:null;}
