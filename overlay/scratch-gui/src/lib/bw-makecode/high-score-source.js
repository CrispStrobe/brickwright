import {tokenize} from './ts-import.js';
import {inspectGeneratedHelperBindings,GENERATED_HELPER_PROFILES} from './generated-helper-recognition.js';
const info=new Set(['score','hasScore','highScore','setScore','changeScoreBy','life','hasLife','setLife','changeLifeBy','onLifeZero','onScore','startCountdown','stopCountdown','onCountdownEnd','showScore','showLife','showCountdown']);
const settings=new Set(['readNumber','readString','readNumberArray','readBuffer','writeNumber','writeString','writeNumberArray','writeBuffer','exists','list','remove','clear']);
export function highScoreConfiguredSourceSafe(files){
 try{
  const values=Object.create(null);for(const name of Reflect.ownKeys(files)){const d=Object.getOwnPropertyDescriptor(files,name);if(typeof name!=='string'||!d||!Object.hasOwn(d,'value')||typeof d.value!=='string')return false;values[name]=d.value;}
  const config=JSON.parse(values['pxt.json']||'null');
  if(config&&(!Array.isArray(config.files)||!config.files.every(n=>typeof n==='string')||config.testFiles!==undefined&&(!Array.isArray(config.testFiles)||!config.testFiles.every(n=>typeof n==='string'))||config.dependencies?.device!=='*'||Object.keys(config.dependencies).some(n=>n!=='device')))return false;
  for(const name of new Set([...(config?.files||['main.ts']),...(config?.testFiles||[])])){
   if(!/\.(?:ts|py|asm|c|cpp|h)$/.test(name))continue;
   if(!Object.hasOwn(values,name)||config?.fileDependencies&&Object.hasOwn(config.fileDependencies,name))return false;
   if(/\.py$/.test(name)&&['tsprj','blocksprj'].includes(config?.preferredEditor))continue;
   if(!/\.ts$/.test(name)||/\.(?:g|d)\.ts$/.test(name)||/\/\/\s*%|\/\*\s*%/.test(values[name]))return false;
   const tokens=tokenize(values[name]);
   for(let i=0;i<tokens.length;i++){
    const t=tokens[i],before=tokens[i-1];
    if(t.unknownBefore||t.invalidLiteral||t.type==='template'&&t.value.includes('${'))return false;
    if(t.type==='ident'&&['globalThis','global','window','self','eval','Function','Reflect','Object','Proxy','arguments','constructor','prototype','__proto__'].includes(t.value))return false;
    if(t.value==='['&&(['ident','number','string','template'].includes(before?.type)||[')',']','}','.'].includes(before?.value)))return false;
    if(t.type!=='ident'||!['info','settings','blockSettings'].includes(t.value))continue;
    let end=i,parts=[t.value];while(tokens[end+1]?.value==='.'&&tokens[end+2]?.type==='ident'){parts.push(tokens[end+2].value);end+=2;}
    const method=parts.at(-1),valid=t.value==='info'?(parts.length===2||parts.length===3&&/^player[1-4]$/.test(parts[1]))&&info.has(method):parts.length===2&&settings.has(method);
    if(before?.value==='.'||tokens[end+1]?.value!=='('||!valid)return false;
   }
  }
  return true;
 }catch{return false;}
}
export const highScoreIntrinsic=node=>node?.type==='Call'&&node.bwInfoHighScoreIntrinsic===true&&!node.isNew&&!node.constructorCall&&!node.optional&&!node.typeArguments?.length&&node.args?.length===0&&node.callee?.type==='Member'&&!node.callee.optional&&node.callee.name==='highScore'&&node.callee.object?.type==='Identifier'&&node.callee.object.name==='info';
export function markHighScoreCalls(program,sourceSafe){
 if(!sourceSafe)return program;
 const proof=inspectGeneratedHelperBindings(program,GENERATED_HELPER_PROFILES.ordinary);if(!proof.isCurrent())return program;
 const selected=proof.nodes.filter(node=>node.type==='Call'&&!node.isNew&&!node.constructorCall&&!node.optional&&!node.typeArguments?.length&&node.args?.length===0&&node.callee?.type==='Member'&&!node.callee.optional&&node.callee.name==='highScore'&&node.callee.object?.type==='Identifier'&&node.callee.object.name==='info'&&proof.unbound(node.callee.object));
 for(const node of selected)node.bwInfoHighScoreIntrinsic=true;
 return program;
}
