import {tokenize} from './ts-import.js';
import {analyseCallableBindings} from './callable-bindings.js';
const path=node=>node?.type==='Identifier'?node.name:node?.type==='Member'&&!node.optional?`${path(node.object)}.${node.name}`:null;
const base=node=>node?.type==='Member'?base(node.object):node;
const gameCalls=new Set(['onUpdate','onUpdateInterval','onPaint','onShade','forever','addScenePushHandler','addScenePopHandler','removeScenePushHandler','removeScenePopHandler','runtime','splash','showLongText','ask','askForString','askForNumber','over','gameOver','pushScene','popScene']);
const controlCalls=new Set(['onEvent','raiseEvent','waitForEvent','allocateNotifyEvent','runInParallel','pause','millis','micros','programHash']);
const reflection=new Set(['globalThis','global','window','self','eval','Function','Reflect','Object','Proxy','arguments','constructor','prototype','__proto__','caller','callee','name','toString','toSource']);
function originalSourceSafe(files,roots){
 roots=new Set([...roots,'game','control','controller','scene']);
 try{
  const config=JSON.parse(files['pxt.json']||'null'),names=config?.files??['main.ts'],tests=config?.testFiles??[];
  if(!Array.isArray(names)||!Array.isArray(tests)||![...names,...tests].every(name=>typeof name==='string'))return false;
  if(config&&(config.dependencies?.device!=='*'||Object.keys(config.dependencies).some(name=>name!=='device')))return false;
  for(const name of new Set([...names,...tests])){
   if(!/\.(?:ts|py|asm|c|cpp|h|js)$/.test(name))continue;
   const file=Object.getOwnPropertyDescriptor(files,name);if(!file||!Object.hasOwn(file,'value')||typeof file.value!=='string'||config?.fileDependencies&&Object.hasOwn(config.fileDependencies,name))return false;
   if(/\.py$/.test(name)&&['tsprj','blocksprj'].includes(config?.preferredEditor))continue;
   if(!/\.ts$/.test(name)||/\.d\.ts$/.test(name)||/\/\/\s*%|\/\*\s*%/.test(file.value))return false;
   const tokens=tokenize(file.value);
   for(let i=0;i<tokens.length;i++){
    const t=tokens[i],before=tokens[i-1];
    if(t.unknownBefore||t.invalidLiteral||t.type==='template'&&t.value.includes('${'))return false;
    if(['ident','string'].includes(t.type)&&reflection.has(t.value))return false;
    if(t.value==='['&&(['ident','number','string','template'].includes(before?.type)||[')',']','}','.'].includes(before?.value)))return false;
    if(t.type!=='ident'||!roots.has(t.value))continue;
    let end=i,top=t.value;while(tokens[end+1]?.value==='.'&&tokens[end+2]?.type==='ident'){top+='.'+tokens[end+2].value;end+=2;}
    if(t.value==='game'&&!gameCalls.has(top.slice(5))||t.value==='control'&&!controlCalls.has(top.slice(8)))return false;
    if(before?.value==='.'||['new','function','class','namespace','delete'].includes(before?.value)||tokens[end+1]?.value!=='(')return false;
   }
  }
  return true;
 }catch{return false;}
}
// Function.name and the local self binding are observable. Only an existing
// direct SDK registration whose body never observes that binding may use the
// anonymous callback route. Unproved functions stay opaque and diagnosed;
// their body must never resolve its self name to an unrelated outer binding.
export function normalizeUnusedNamedCallbacks(program,files,registrationSpec,unsupported=[]){
 const rows=[],visit=node=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(visit);return;}
  if(node.type==='Call')for(const [index,arg]of (node.args||[]).entries())if(arg?.type==='FunctionExpression'&&arg.selfName)rows.push({node:arg,call:node,index});
  if(node.type==='FunctionExpression'&&node.selfName&&!rows.some(row=>row.node===node))rows.push({node,call:null,index:null});
  for(const value of Object.values(node))if(value&&typeof value==='object')visit(value);
 };visit(program);
 if(!rows.length)return program;
 const lexical=analyseCallableBindings(program),roots=new Set(),refused=new Map();
 for(const {node,call,index}of rows){
  const name=path(call?.callee),root=base(call?.callee),spec=registrationSpec(name,call)||(name==='controller.anyButton.onEvent'?{handlerIndex:1,arity:2,maxParams:0}:null);
  const arities=spec?.arities||[spec?.arity];
  if(!call||call.isNew||call.constructorCall||call.optional||call.typeArguments?.length||root?.type!=='Identifier'||lexical.references.get(root)||!spec||index!==spec.handlerIndex||!arities.includes(call.args.length)||node.params.includes(node.selfName)||node.params.length>(spec.maxParams??0)||node.selfNameDefaults?.length||node.optionalParams?.length)
   refused.set(node,'Named function expression requires an unused local name in a supported direct SDK callback');
  else roots.add(root.name);
  const pending=[node.body,node.selfNameDefaults];while(pending.length){const item=pending.pop();if(!item||typeof item!=='object')continue;if(item.type==='Identifier'&&item.name===node.selfName)refused.set(node,'Named function expression self reference or escape is unsupported');for(const value of Object.values(item))if(value&&typeof value==='object')pending.push(value);}
 }
 if(!originalSourceSafe(files,roots))for(const {node}of rows)if(!refused.has(node))refused.set(node,'Named callback requires all configured sources to preserve SDK bindings without aliases, writers or reflection');
 unsupported.push(...new Set(refused.values()));
 const selected=new Set(rows.map(row=>row.node));
 const rewrite=node=>{
  if(!node||typeof node!=='object')return node;if(Array.isArray(node))return node.map(rewrite);
  if(refused.has(node))return {type:'Unknown',token:'unsupported named function expression'};
  const out={};for(const [key,value]of Object.entries(node)){if(selected.has(node)&&['selfName','selfNameDefaults'].includes(key))continue;out[key]=rewrite(value);}return out;
 };
 return rewrite(program);
}
