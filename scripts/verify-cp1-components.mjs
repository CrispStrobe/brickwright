#!/usr/bin/env node
/**
 * CP1 component proof with an explicit dependency registry.
 * Example: node scripts/verify-cp1-components.mjs --deps ../bw-circuit-ui/node_modules --board ../bw-board
 * Optional --compiler-deps supplies Vite/Oxc from another explicit registry;
 * React and its server renderer always come from --deps.
 * Uses the real React server renderer and original 8049/8155 machine. Lifecycle
 * surfaces are controlled callback doubles; this is not a browser/visual pass.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const option=(flag,fallback)=>{const index=process.argv.indexOf(flag);return index<0?fallback:process.argv[index+1];};
const depsArgument=option('--deps');
const boardArgument=option('--board');
if(!depsArgument||!boardArgument)throw Error('Pass explicit --deps <node_modules> and --board <bw-board checkout> paths.');
const deps=path.resolve(root,depsArgument);
const compilerDeps=path.resolve(root,option('--compiler-deps',depsArgument));
const board=path.resolve(root,boardArgument);
const requireDeps=createRequire(path.join(deps,'__cp1_components__.cjs'));
const requireCompiler=createRequire(path.join(compilerDeps,'__cp1_compiler__.cjs'));
const React=requireDeps('react');
const {renderToStaticMarkup}=requireDeps('react-dom/server');
const {transformWithOxc}=await import(pathToFileURL(requireCompiler.resolve('vite')).href);
const {Cp1Machine}=await import(pathToFileURL(path.join(board,'src/cp1-machine.js')).href);
const url=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const panelPath=path.join(root,'overlay/scratch-gui/src/components/tw-pseudocode/cp1-panel.jsx');
const hostPath=path.join(root,'overlay/scratch-gui/src/components/tw-pseudocode/cp1-host.jsx');
const css=await readFile(panelPath.replace('.jsx','.css'),'utf8');
const styles=Object.fromEntries([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map(match=>[match[1],match[1]]));
const stylesUrl=url(`export default ${JSON.stringify(styles)};`);
const typesUrl=url('const v=()=>null;v.isRequired=v;export default new Proxy({}, {get:()=>v});');
const reactUrl=pathToFileURL(requireDeps.resolve('react')).href;
async function compile(filename,overrides={}){
 const source=await readFile(filename,'utf8');
 const transformed=await transformWithOxc(source,filename,{jsx:{runtime:'classic'}});
 const code=transformed.code.replace(/(from\s+|import\s*)(['"])([^'"]+)\2/g,(whole,prefix,quote,specifier)=>{
  let resolved=overrides[specifier];
  if(!resolved){if(specifier==='react')resolved=reactUrl;else if(specifier==='prop-types')resolved=typesUrl;
   else if(specifier.endsWith('.css'))resolved=stylesUrl;
   else if(specifier.startsWith('.'))resolved=pathToFileURL(path.resolve(path.dirname(filename),specifier)).href;
   else throw Error(`Unresolved proof import ${specifier}`);}
  return `${prefix}${quote}${resolved}${quote}`;
 });
 return import(url(code));
}
const {default:Cp1Panel}=await compile(panelPath);
const source='VALUE EQU 42\nORG 0\nstart: AKO VALUE\ndisplay: ANZ\nSPU display\n';
const rom=new Uint8Array(2048);
// Independently authored synthetic firmware: configure display output, then loop.
rom.set([0x23,0xaf,0x3a,0xb8,0,0x23,0x0f,0x90,0xb8,1,0x23,0x79,0x90,0xb8,3,0x23,0x37,0x90,0x04,0x12]);
const machine=new Cp1Machine({rom});machine.advanceCycles(100);
class Surface{
 constructor(){this.listeners=new Map();this.frames=new Map();this.frameId=0;}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 dispatchEvent(event){for(const fn of [...this.listeners.get(event.type)||[]])fn(event);return true;}
 requestAnimationFrame(fn){this.frames.set(++this.frameId,fn);return this.frameId;}
 cancelAnimationFrame(id){this.frames.delete(id);}
 setTimeout(fn,ms){return setTimeout(fn,ms);}
 clearTimeout(id){clearTimeout(id);}
}
const hostWindow=new Surface(),hostDocument=new Surface();hostDocument.hidden=false;
const storage=new Map();let refuseStorage=false;
const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(refuseStorage)throw Error('test quota exceeded');storage.set(key,String(value));}};
const originalGlobals=new Map();
function globalValue(name,value){originalGlobals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});}
globalValue('window',hostWindow);globalValue('document',hostDocument);globalValue('localStorage',localStorage);globalValue('crypto',webcrypto);
globalValue('FileReader',class{readAsArrayBuffer(file){this.result=file.bytes.buffer.slice(file.bytes.byteOffset,file.bytes.byteOffset+file.bytes.byteLength);queueMicrotask(()=>this.onload());}readAsText(file){this.result=file.text;queueMicrotask(()=>this.onload());}});
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log(`PASS ${name}`);};
function panel(extra={}){
 const instance=new Cp1Panel({source,snapshot:machine.snapshot(),expansion:false,running:false,
  onKey:(key,down)=>machine.setKey(key,down),onReleaseKeys:()=>machine.releaseKeys(),...extra});
 instance.setState=update=>{const value=typeof update==='function'?update(instance.state,instance.props):update;instance.state={...instance.state,...value};};
 instance.forceUpdate=()=>{};instance.componentDidMount();return instance;
}
const keyEvent=(key,code,target={closest:()=>null})=>({key,code,target,preventDefault(){this.prevented=true;}});
const pointer=(id)=>({pointerId:id,button:0,currentTarget:{focus(){},setPointerCapture(){}},preventDefault(){}});
try{
 await check('JSX compiles and real React SSR renders six raw masks and thirty keys',()=>{
  const html=renderToStaticMarkup(React.createElement(Cp1Panel,{snapshot:machine.snapshot(),source,onKey(){},onLoad(){},onStep(){},onRun(){}}));
  assert.equal((html.match(/data-cp1-physical-key=/g)||[]).length,30);
  assert.equal((html.match(/data-cp1-digit=/g)||[]).length,6);
  assert.match(html,/data-cp1-digit="2" data-segments="249"/);
  assert.match(html,/CPU step advances one 8049 instruction/);
  const german=renderToStaticMarkup(React.createElement(Cp1Panel,{snapshot:machine.snapshot(),source,locale:'de',colorMode:'dark'}));
  assert.match(german,/CPU-Schritt/);assert.match(german,/data-color-mode="dark"/);
 });
 await check('actual component handlers hold duplicate keys until the last physical owner releases',()=>{
  const p=panel();p._pressPointer(pointer(1),'4');p._pressPointer(pointer(2),'4');p._onKeyDown(keyEvent('4','Digit4'));
  assert.deepEqual(machine.pressedKeys,['4']);p._keys.release('pointer:1');p._onKeyUp(keyEvent('4','Digit4'));
  assert.deepEqual(machine.pressedKeys,['4']);p._keys.release('pointer:2');assert.deepEqual(machine.pressedKeys,[]);p.componentWillUnmount();
 });
 await check('focus loss, visibility change, disabled input and unmount release engine contacts',()=>{
  const p=panel();p._onKeyDown(keyEvent('Enter','Enter'));hostWindow.dispatchEvent({type:'blur'});assert.deepEqual(machine.pressedKeys,[]);
  p._onKeyDown(keyEvent('1','Digit1'));hostDocument.hidden=true;hostDocument.dispatchEvent({type:'visibilitychange'});assert.deepEqual(machine.pressedKeys,[]);hostDocument.hidden=false;
  p._onKeyDown(keyEvent('2','Digit2'));const previous=p.props;p.props={...p.props,onKey:undefined};p.componentDidUpdate(previous);assert.deepEqual(p._keys.heldKeys(),[]);assert.deepEqual(machine.pressedKeys,[]);
  p.props=previous;p._pressPointer(pointer(3),'3');p.componentWillUnmount();assert.deepEqual(machine.pressedKeys,[]);
 });
 await check('typing and ordinary button activation do not press monitor RUN',()=>{
  const p=panel();const typing=keyEvent('4','Digit4',{closest:selector=>selector.startsWith('input')?{}:null});p._onKeyDown(typing);
  const nativeButton=keyEvent('Enter','Enter',{closest:selector=>selector==='button'?{}:null});p._onKeyDown(nativeButton);
  assert.deepEqual(machine.pressedKeys,[]);assert.equal(nativeButton.prevented,undefined);
  p._onKeyDown(keyEvent('Enter','Enter',{closest:selector=>selector==='[data-cp1-key]'?{dataset:{cp1Key:'ACC'}}:null}));
  assert.deepEqual(machine.pressedKeys,['ACC']);p.componentWillUnmount();
 });
 await check('snapshot refresh and SSR never advance the emulated CPU',()=>{
  const before=machine.cycles;const p=panel({machine,snapshot:null});const frame=[...hostWindow.frames.values()][0];frame(100);
  renderToStaticMarkup(p.render());assert.equal(machine.cycles,before);p.componentWillUnmount();
 });
 await check('load succeeds only after real RAM accepts a complete assembly',async()=>{
  let calls=0;const p=panel({onLoad:assembly=>{calls++;machine.loadProgram(Array.from({length:assembly.bytes.length/2},(_,i)=>({opcode:assembly.bytes[2*i],operand:assembly.bytes[2*i+1]})),{clear:true});}});
  await p._load();assert.equal(calls,1);assert.deepEqual(machine.readCell(0),{opcode:4,operand:42});assert.deepEqual(machine.readCell(2),{opcode:9,operand:1});assert.match(p.state.notice,/Loaded 3/);
  p._setSource('AKO 256');await p._load();assert.equal(calls,1);assert.ok(p.state.errors.length);assert.equal(p.state.notice,'');
  p._setSource(source);p.props={...p.props,onLoad:()=>{throw Error('loader refusal');}};await p._load();assert.match(p.state.errors[0].message,/loader refusal/);assert.equal(p.state.notice,'');p.componentWillUnmount();
 });
 await check('normal project export excludes live keys and source typing is reported immediately',async()=>{
  let saved,edited;const p=panel({onSaveProject:value=>{saved=value;},onSourceChange:value=>{edited=value;}});
  p._onKeyDown(keyEvent('1','Digit1'));await p._saveProject();assert.equal(saved.words[2].opcode,9);assert.equal(Object.hasOwn(saved,'heldKeys'),false);
  p._setSource('incomplete: AKO ');assert.equal(edited,'incomplete: AKO ');p.componentWillUnmount();
 });
 await check('local ROM picker validates size and propagates failed import without success feedback',async()=>{
  let count=0;const p=panel({onImportRom:image=>{count++;assert.equal(image.bytes.length,2048);assert.match(image.reference.sha256,/^[a-f0-9]{64}$/);}});
  await p._importRom({size:3,name:'bad.bin',bytes:new Uint8Array(3)});assert.equal(count,0);assert.ok(p.state.errors.length);
  await p._importRom({size:2048,name:'synthetic.bin',bytes:rom});assert.equal(count,1);assert.match(p.state.notice,/synthetic.bin/);
  p.props={...p.props,onImportRom:()=>{throw Error('ROM refusal');}};await p._importRom({size:2048,name:'rejected.bin',bytes:rom});assert.match(p.state.errors[0].message,/ROM refusal/);assert.equal(p.state.notice,'');p.componentWillUnmount();
 });
 // Capture actual host-created panel callbacks under React's server hook
 // dispatcher. Effects are driven explicitly against controlled event surfaces.
 const effects=[];globalValue('__cp1ProofEffects',effects);globalValue('__cp1ProofPanelProps',null);
 const reactEffectsUrl=url(`import React from ${JSON.stringify(reactUrl)};export default React;export const useState=React.useState,useRef=React.useRef,useCallback=React.useCallback;export const useEffect=(fn,deps)=>{globalThis.__cp1ProofEffects.push(fn);return React.useEffect(fn,deps);};`);
 const panelProbe=url(`import React from ${JSON.stringify(reactUrl)};export default props=>{globalThis.__cp1ProofPanelProps=props;return React.createElement('div',{'data-host-panel-probe':true});};`);
 const {default:Cp1Host}=await compile(hostPath,{'react':reactEffectsUrl,'./cp1-panel.jsx':panelProbe});
 const cleanups=[];let configureResolve;const configurations=[];let imported=0;
 const hostRunner={cp1Snapshot:()=>machine.snapshot(),cp1ReleaseKeys:()=>machine.releaseKeys(),cp1LoadProgram:()=>{throw Error('real callback rejection');}};
 renderToStaticMarkup(React.createElement(Cp1Host,{runner:hostRunner,running:false,locale:'en',configuration:{partId:'cp1-fixture',expansion:false,clockHz:6000000},onRun(){},onConfigure:next=>{configurations.push(next);return new Promise(resolve=>{configureResolve=resolve;});},onImportRom:()=>{imported++;}}));
 for(const effect of effects.splice(0)){const cleanup=effect();if(cleanup)cleanups.push(cleanup);}
 const host=globalThis.__cp1ProofPanelProps;
 await check('host persists unfinished source and does not turn loader failure into success',async()=>{
  host.onSourceChange('again: AKO unfinished +');assert.equal(JSON.parse(storage.get('bw-cp1-workspace')).source,'again: AKO unfinished +');
  await assert.rejects(()=>host.onLoad({ok:true}),/real callback rejection/);
 });
 await check('host preserves latest edits and circuit partId across asynchronous ROM configuration',async()=>{
  const reference={sha256:'a'.repeat(64),byteLength:2048,name:'synthetic.bin'};
  const loading=host.onImportRom({bytes:rom,name:'synthetic.bin',reference});await Promise.resolve();await Promise.resolve();
  assert.equal(imported,0);assert.equal(configurations.at(-1).partId,'cp1-fixture');host.onSourceChange('newest: AKO unfinished +');configureResolve();await loading;
  const saved=JSON.parse(storage.get('bw-cp1-workspace'));assert.equal(saved.source,'newest: AKO unfinished +');assert.deepEqual(saved.rom,reference);assert.equal(imported,1);
 });
 await check('storage refusal retains the current draft in memory until a later save succeeds',async()=>{
  refuseStorage=true;host.onSourceChange('kept despite quota: AKO ');refuseStorage=false;
  const loading=host.onImportRom({bytes:rom,name:'again.bin',reference:{sha256:'b'.repeat(64),byteLength:2048}});await Promise.resolve();await Promise.resolve();configureResolve();await loading;
  assert.equal(JSON.parse(storage.get('bw-cp1-workspace')).source,'kept despite quota: AKO ');
 });
 await check('source-load events reconfigure CP3 while preserving edits made during the asynchronous change',async()=>{
  hostWindow.dispatchEvent({type:'bw-cp1-source-load',detail:{source:'ORG 255\nDATA 1',expansion:true}});await Promise.resolve();await Promise.resolve();
  assert.equal(configurations.at(-1).expansion,true);assert.equal(configurations.at(-1).partId,'cp1-fixture');host.onSourceChange('ORG 255\nDATA 2 ; latest');configureResolve();
  for(let i=0;i<6;i++)await Promise.resolve();
  const saved=JSON.parse(storage.get('bw-cp1-workspace'));assert.equal(saved.configuration.expansion,true);assert.equal(saved.source,'ORG 255\nDATA 2 ; latest');
 });
 for(const cleanup of cleanups.reverse())cleanup();
 await check('circuit input mode omits manual port overrides',()=>{
  renderToStaticMarkup(React.createElement(Cp1Host,{runner:{...hostRunner,cp1InputMode:()=> 'circuit'},running:false,
   configuration:{expansion:false,clockHz:6000000},onRun(){},onConfigure(){},onImportRom(){}}));
  assert.equal(globalThis.__cp1ProofPanelProps.onPortInput,undefined);
 });
 console.log(JSON.stringify({passed:checks,react:React.version,jsx:'Vite transformWithOxc',engine:'original Cp1Machine with synthetic ROM',scope:'SSR and controlled callbacks; browser launch is a separate gate',propTypes:'validator-only stub',css:'actual stylesheet class map; no visual claim'}));
} finally{
 for(const [name,descriptor]of originalGlobals){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
}
