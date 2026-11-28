import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {deriveCircuitsProbe,observeDirectCircuitKeys} from '../scripts/verify-i80386-freedos-circuits-direct.mjs';

test('direct Circuit probe is an exact accepted-browser derivative with a real VDP key route',()=>{
 const {generated,generatedSha256}=deriveCircuitsProbe();
 assert.equal(createHash('sha256').update(generated).digest('hex'),generatedSha256);
 assert.match(generated,/page\.locator\('\[data-vdp-screen\]:visible'\)/);
 assert.match(generated,/getByRole\('button',\{name:'Debugger',exact:true\}\)/);
 assert.match(generated,/debuggerView\.click\(\)/);
 assert.match(generated,/debuggerView\.getAttribute\('aria-pressed'\)/);
 assert.match(generated,/vdpCanvas\.click\(\)/);
 assert.match(generated,/vdp\.evaluate\(el=>document\.activeElement===el\)/);
 assert.match(generated,/const circuitTextObserver=Function\('canvas'/);
 assert.doesNotMatch(generated,/const circuitTextObserver=`canvas =>/,'string arrow cannot be passed to locator.evaluate');
 assert.match(generated,/vdpCanvas\.evaluate\(circuitTextObserver\)/);
 assert.match(generated,/actual Circuit VDP pixels show guest shell response/);
 assert.match(generated,/keyObserverStart,keyboardDiagnostics/);
 assert.match(generated,/Object\.defineProperty\(target,'keyIn'/);
 assert.match(generated,/keyboardDiagnostics\?\.targetCalls\?\.map\(event=>event\.scancode\),expectedCircuitScans/);
 assert.match(generated,/!keyboardDiagnostics\.observerError&&!keyboardDiagnostics\.restoreError/);
 assert.match(generated,/keyboardDiagnostics\.dom\.every\(event=>event\.trusted&&event\.onFocusedElement\)/);
 assert.match(generated,/Circuit guest output survives Code return/);
 assert.match(generated,/const controllerView=page\.getByRole\('button',\{name:'Controller',exact:true\}\)/);
 assert.match(generated,/await controllerView\.click\(\)/);
 assert.match(generated,/controllerView\.getAttribute\('aria-pressed'\)/);
 assert.match(generated,/Code tab stays selected after view switch/);
 assert.match(generated,/await canvas\.waitFor\(\{state:'visible'\}\);\n        await canvas\.click\(\)/);
 assert.doesNotMatch(generated,/window\.__benchTarget\.keyIn\(/,'no diagnostic input injection');
 assert.doesNotMatch(generated,/\.click\(\{force:true\}\)|\.focus\(\)/,'no bypass of physical click or browser focus');
 const stage=readFileSync(new URL('../overlay/scratch-gui/src/components/stage-header/stage-header.jsx',import.meta.url),'utf8');
 const buttons=readFileSync(new URL('../packages/scratch-gui/src/components/toggle-buttons/toggle-buttons.jsx',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx',import.meta.url),'utf8');
 assert.match(stage,/handleClick: \(\) => \{ setCircuitView\(\{fullWidth: true, dock: 'right'\}\); setView\('solo'\); \}/);
 assert.match(stage,/title: intl\.formatMessage\(messages\.debuggerFull\)/);
 assert.match(stage,/handleClick: \(\) => \{ setCircuitView\(\{fullWidth: true, dock: 'controller'\}\); setView\('controller'\); \}/);
 assert.match(stage,/title: intl\.formatMessage\(messages\.controllerPanel\)/);
 assert.match(stage,/controllerPanel: \{\s*defaultMessage: 'Controller'/);
 assert.match(buttons,/aria-label=\{button\.title\}/);
 assert.match(buttons,/aria-pressed=\{button\.isSelected\}/);
 assert.match(panel,/onMouseDown=\{this\.state\.runner\.mouseIn \? this\._mouseDown : undefined\}/);
 assert.match(panel,/querySelector\('\[data-vdp-screen\]'\)\?\.focus\(\)/);
 const directory=mkdtempSync(join(process.env.BW_TEST_TMPDIR || tmpdir(),'freedos-circuits-source-'));
 try{
  const generatedPath=join(directory,'probe.mjs');writeFileSync(generatedPath,generated);
  const parsed=spawnSync(process.execPath,['--check',generatedPath],{encoding:'utf8',timeout:5000});
  assert.equal(parsed.status,0,parsed.stderr);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('Circuit key observer forwards actual target calls and restores on success and throw',()=>{
 const listeners=new Map();
 const element={
  addEventListener:(name,fn)=>listeners.set(name,fn),
  removeEventListener:(name,fn)=>{assert.equal(listeners.get(name),fn);listeners.delete(name);}
 };
 const error=new Error('guest input refusal');
 const calls=[];
 const original=function(sc){calls.push([this,sc]);if(sc===99)throw error;return sc===30;};
 const target={keyIn:original};
 const observer=observeDirectCircuitKeys(target,element);
 const down={code:'KeyA',key:'a',isTrusted:true,target:element};
 listeners.get('keydown')(down);
 assert.equal(target.keyIn(30),true);
 assert.equal(target.keyIn(31),false);
 const foreign={name:'other receiver'};
 assert.equal(target.keyIn.call(foreign,30),true);
 assert.throws(()=>target.keyIn(99),caught=>caught===error);
 listeners.get('keyup')({...down});
 const snapshot=observer.snapshot();
 assert.equal(snapshot.targetKeyInAvailable,true);
 assert.deepEqual(snapshot.dom.map(event=>[event.type,event.code,event.trusted,event.onFocusedElement]),
  [['keydown','KeyA',true,true],['keyup','KeyA',true,true]]);
 assert.deepEqual(snapshot.targetCalls.map(call=>[call.scancode,call.receiverIsTarget,call.returnType,call.accepted,call.refused,call.threw]),
  [[30,true,'boolean',true,false,undefined],[31,true,'boolean',false,true,undefined],
   [30,false,'boolean',true,false,undefined],[99,true,undefined,undefined,undefined,true]]);
 assert.deepEqual(calls,[[target,30],[target,31],[foreign,30],[target,99]]);
 observer.restore();
 assert.equal(target.keyIn,original);
 assert.equal(listeners.size,0);
 const absent=observeDirectCircuitKeys({},element);
 assert.equal(absent.snapshot().targetKeyInAvailable,false);
 absent.restore();
 assert.equal(listeners.size,0);
});

test('Circuit key observer restores inherited and own keyIn property shapes',()=>{
 const element={addEventListener(){},removeEventListener(){}};
 const inherited=function(sc){return [this,sc];};
 const prototype={keyIn:inherited};
 const target=Object.create(prototype);
 assert.equal(Object.hasOwn(target,'keyIn'),false);
 const observer=observeDirectCircuitKeys(target,element);
 assert.equal(Object.hasOwn(target,'keyIn'),true);
 assert.deepEqual(target.keyIn(30),[target,30]);
 observer.restore();
 assert.equal(Object.hasOwn(target,'keyIn'),false);
 assert.equal(target.keyIn,inherited);
 const own=Object.create(prototype);
 const ownMethod=function(sc){return sc;};
 const descriptor={value:ownMethod,writable:false,configurable:true,enumerable:false};
 Object.defineProperty(own,'keyIn',descriptor);
 const ownObserver=observeDirectCircuitKeys(own,element);
 assert.equal(own.keyIn(31),31);
 ownObserver.restore();
 assert.deepEqual(Object.getOwnPropertyDescriptor(own,'keyIn'),descriptor);
});

test('Circuit diagnostic distinguishes React callback props from bubbled physical handling',()=>{
 const elementListeners=new Map(),documentListeners=new Map();
 const document={addEventListener:(name,fn)=>documentListeners.set(name,fn),
  removeEventListener:(name,fn)=>{assert.equal(documentListeners.get(name),fn);documentListeners.delete(name);}};
 const element={ownerDocument:document,
  addEventListener:(name,fn)=>elementListeners.set(name,fn),
  removeEventListener:(name,fn)=>{assert.equal(elementListeners.get(name),fn);elementListeners.delete(name);}};
 const sendScancodeFn=()=>{},videoFn=()=>{};
 const panel={_scancodeFn:sendScancodeFn,_videoFn:videoFn,
  state:{runner:{keyIn(){}}}};
 element.__reactInternalInstance$owned={memoizedProps:{onKeyDown(){},onKeyUp(){}},
  return:{memoizedProps:{videoFn,sendScancodeFn},
   return:{stateNode:panel,memoizedProps:{},return:null}}};
 const observer=observeDirectCircuitKeys({keyIn(){return true;}},element);
 const key={code:'KeyE',key:'e',isTrusted:true,target:element,defaultPrevented:false};
 elementListeners.get('keydown')(key);
 key.defaultPrevented=true;
 documentListeners.get('keydown')(key);
 assert.deepEqual(observer.snapshot().reactRoute,{fiberFound:true,hostKeyDown:'function',
  hostKeyUp:'function',scancodePropType:'function',videoPropType:'function',
  panelFound:true,panelRunnerKeyIn:'function',panelScancodeFnMatches:true,
  panelVideoFnMatches:true});
 assert.deepEqual(observer.snapshot().dom[0],{type:'keydown',code:'KeyE',key:'e',
  trusted:true,onFocusedElement:true,documentBubbled:true,defaultPreventedAfterBubble:true});
 observer.restore();
 assert.equal(elementListeners.size,0);
 assert.equal(documentListeners.size,0);
});

test('materialized browser observer instruments the real VDP element and target',()=>{
 const {generated}=deriveCircuitsProbe();
 const declaration=generated.match(/^\s*const installKeyObserver=Function\('element'.*\);$/m)?.[0];
 assert.ok(declaration,'one browser-side observer installer');
 const events=new Map();
 const element={addEventListener:(name,fn)=>events.set(name,fn),
  removeEventListener:(name,fn)=>{assert.equal(events.get(name),fn);events.delete(name);}};
 const target={keyIn(sc){return sc===30;}};
 const window={__benchTarget:target};
 const install=runInNewContext(`${declaration}\ninstallKeyObserver`,{window});
 assert.equal(install(element).targetKeyInAvailable,true);
 assert.equal(typeof window.__circuitKeyObserver.restore,'function');
 events.get('keydown')({type:'keydown',code:'KeyA',key:'a',isTrusted:true,target:element});
 assert.equal(target.keyIn(30),true);
 assert.deepEqual([...window.__circuitKeyObserver.snapshot().targetCalls].map(call=>call.scancode),[30]);
 window.__circuitKeyObserver.restore();
 assert.equal(events.size,0);
});

test('callable Circuit pixel observer decodes canvas bytes and rejects mismatched frames',()=>{
 const {generated}=deriveCircuitsProbe();
 const declaration=generated.match(/^\s*const circuitTextObserver=Function\('canvas',.*\);$/m)?.[0];
 assert.ok(declaration,'one self-contained callable canvas observer');
 const source=readFileSync(new URL('../scripts/lib/i80386-vga-text.mjs',import.meta.url),'utf8');
 const decoderSource=source.slice(source.indexOf('export function decodeTextPixels')).replace(/^export /,'');
 const decodeTextPixels=runInNewContext(`${decoderSource}\ndecodeTextPixels`);
 const rows=Array.from({length:16},(_,i)=>i===0?0x81:i===1?0x42:0);
 const observer=runInNewContext(`${declaration}\ncircuitTextObserver`,{
  decodeTextPixels,fixedTextGlyphs:()=>[['X',rows]]});
 assert.equal(typeof observer,'function','Playwright must receive a function, not its source string');
 const rgba=new Uint8ClampedArray(720*400*4);
 for(let i=3;i<rgba.length;i+=4)rgba[i]=255;
 for(let y=0;y<16;y++)for(let x=0;x<8;x++)if(rows[y]&(1<<x)){
  const offset=(y*720+x)*4;rgba[offset]=rgba[offset+1]=rgba[offset+2]=255;
 }
 let observedExtent=null;
 const canvas={width:720,height:400,getContext:kind=>{
  assert.equal(kind,'2d');return {getImageData:(x,y,width,height)=>{
   observedExtent=[x,y,width,height];return {data:rgba};
  }};
 }};
 assert.equal(observer(canvas)[0],'X','actual rendered glyph pixels reach the decoder');
 assert.deepEqual(observedExtent,[0,0,720,400]);
 rgba[0]=rgba[1]=rgba[2]=0;
 assert.equal(observer(canvas)[0],'?','changed rendered pixels fail the glyph observation');
 rgba[0]=rgba[1]=rgba[2]=255;
 assert.throws(()=>observer({...canvas,width:719}),/expected complete fixed-font/);
});

test('production build version derives from exact PR head, not ambient merge commit',()=>{
 const overlay=readFileSync(new URL('../overlay/scratch-gui/webpack.config.js',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../.github/workflows/i80386-freedos-circuits-direct-actual.yml',import.meta.url),'utf8');
 const source=overlay.match(/const buildVersion = \(\) => \{[\s\S]*?\n\};/)?.[0];
 assert.ok(source,'actual webpack buildVersion source');
 const head='a99cca704877f57a85ff4628f10b94ecdb1ad933';
 const merge='b32b8a7000000000000000000000000000000000';
 const version=env=>runInNewContext(`${source}\nbuildVersion()`,{
  process:{env},require:()=>{throw Error('unexpected Git fallback');}
 });
 assert.equal(version({GITHUB_SHA:head,VERCEL_GIT_COMMIT_SHA:merge}),head.slice(0,7));
 assert.equal(version({GITHUB_SHA:merge}),merge.slice(0,7));
 assert.notEqual(head.slice(0,7),merge.slice(0,7));
 assert.match(workflow,/GITHUB_SHA="\$BW_EXPECTED_HEAD" NODE_ENV=production/);
 assert.match(workflow,/assert\.equal\(manifest\.commit,process\.env\.BW_EXPECTED_HEAD\.slice\(0,7\)/);
 assert.match(workflow,/cmp overlay\/scratch-gui\/webpack\.config\.js packages\/scratch-gui\/webpack\.config\.js/);
 const pin='659431ce46a7b6d4ae472182b069ec301aee0df3';
 const selectedPins=source=>[
  source.match(/repository: CrispStrobe\/bw-circuit-ui\n\s*ref: ([0-9a-f]{40})/)?.[1],
  source.match(/test "\$\(git -C circuit-ui rev-parse HEAD\)" = ([0-9a-f]{40})/)?.[1],
  source.match(/assert\.equal\(pins\['bw-circuit-ui'\],'([0-9a-f]{40})'\)/)?.[1]
 ];
 assert.deepEqual(selectedPins(workflow),[pin,pin,pin],
  'checkout, tracked-head readback, and admission each pin current CUI');
 assert.equal((workflow.match(new RegExp(pin,'g')) || []).length,3,'checkout, readback and admission share whole current CUI');
 assert.match(workflow,/brickwright-lite\.i80386-freedos-circuits-admission\.v2/);
 assert.match(workflow,/freedos-circuits-direct-v2-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
 for(const drift of [workflow.replace('ref: '+pin,'ref: '+'0'.repeat(40)),
                     workflow.replace('= '+pin,'= '+'0'.repeat(40)),
                     workflow.replace("pins['bw-circuit-ui'],'"+pin+"'","pins['bw-circuit-ui'],'"+'0'.repeat(40)+"'")]){
  assert.notEqual(drift,workflow);
  assert.notDeepEqual(selectedPins(drift),[pin,pin,pin],
   'one wrong pin in any authority role must fail');
 }
});
