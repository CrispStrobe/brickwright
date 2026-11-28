import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {codeDocumentEditorClass} from './helpers/code-document-editor.mjs';
const source=fs.readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx',import.meta.url),'utf8');
const method=name=>{const match=source.match(new RegExp('^    (?:async )?'+name+' \\([^\\n]*\\) \\{[\\s\\S]*?^    \\}','m'));assert.ok(match,name+' actual method');return match[0];};
const later=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function fixture() {
 const readers=[],effects=[],requests=[],waits=new Map();let stage={},answer='share';
 class Reader{constructor(){this.result=new Uint8Array([1]).buffer;readers.push(this);}readAsArrayBuffer(file){this.file=file;}}
 const names=['currentMakeCodeRequest','openArtefactFile','openMakeCodeShare','applyMakeCodeImport','componentWillUnmount','setMaximizedChrome','disposeCodeRun'];
 const labels=new Function(source.match(/^const LANG_LABEL = .*;$/m)[0]+'\nreturn LANG_LABEL;')();
 // Evaluate only these OWN source methods over authored IO/UI stubs. No JSX,
 // React, DOM, SDK, Scratch VM, browser or translated guest is executed.
 const Editor=codeDocumentEditorClass(source,names.map(method).join('\n'),{
  FileReader:Reader,promptAsync:async()=>answer,window:{removeEventListener:()=>{}},LANG_LABEL:labels});
 const receiver=Object.assign(new Editor(),{state:{lang:'pseudocode',buffers:{pseudocode:'before'},uploads:[],status:'before',
  driverMode:'shim',asyncMode:false,eventsMode:false,jsExecution:'classic',basicProfile:'bbc',basicLineNumbers:true},
  props:{vm:{runtime:{getTargetForStage:()=>stage}}},
  L:{mcReading:name=>'reading '+name,mcFailed:(name,error)=>'failed '+name+': '+error,mcNoSource:name=>'missing '+name,mcSharePrompt:'share?',mcShareLoading:'loading',mcArcade:(_label,name)=>'loaded '+name,toBlocks:'To blocks'},
  setState:update=>{const patch=typeof update==='function'?update(receiver.state):update;if(patch){receiver.state={...receiver.state,...patch};effects.push(patch);}},
  publishGameControls:value=>effects.push({controls:value}),loadArcadeBoards:()=>effects.push({boards:true}),
  makeCodeImportModule:async()=>({importArtefact:async(_bytes,opts)=>{requests.push(opts);return waits.get(opts.name).promise;},importShareLink:async(input,opts)=>{requests.push(opts);return waits.get(input).promise;}})});
 const result=name=>({kind:'makecode',lang:'pseudocode',code:'code '+name,files:{'main.ts':'authored '+name},project:{name,target:'arcade'},unsupported:[],warnings:[],costumes:[{sprite:'Game',name,svg:'<svg>'+name+'</svg>',mode:'replace'}],dependencyInputs:{marker:name}});
 return {receiver,readers,effects,requests,waits,result,setStage:value=>{stage=value;},setAnswer:value=>{answer=value;}};
}

test('current file import publishes real buffers/artwork/provenance and requests preparation',async()=>{
 const f=fixture();f.waits.set('a',later());f.receiver.openArtefactFile({name:'a'});const pending=f.readers[0].onload();await Promise.resolve();f.waits.get('a').resolve(f.result('a'));await pending;
 assert.equal(f.requests[0].prepareDependencies,true);assert.equal(f.receiver.state.buffers.pseudocode,'code a');assert.equal(f.receiver.state.uploads[0].svg,'<svg>a</svg>');assert.deepEqual(f.receiver._makeCodeProject.dependencyInputs,{marker:'a'});assert.equal(f.receiver.state.status,'loaded a');
});

for(const oldFailure of [false,true])test('late file '+(oldFailure?'failure':'success')+' cannot overwrite a newer successful import',async()=>{
 const f=fixture();for(const name of ['a','b'])f.waits.set(name,later());
 f.receiver.openArtefactFile({name:'a'});const old=f.readers[0].onload();await Promise.resolve();
 f.receiver.openArtefactFile({name:'b'});const current=f.readers[1].onload();await Promise.resolve();f.waits.get('b').resolve(f.result('b'));await current;
 const before=structuredClone(f.receiver.state),effects=f.effects.length;
 if(oldFailure)f.waits.get('a').reject(Error('old refusal'));else f.waits.get('a').resolve(f.result('a'));await old;
 assert.deepEqual(f.receiver.state,before);assert.equal(f.effects.length,effects);assert.equal(f.receiver._makeCodeProject.dependencyInputs.marker,'b');
 f.readers[0].onerror();assert.deepEqual(f.receiver.state,before);
});

for(const change of ['invalidated','stage','unmount','disposed'])test('pending file completion refuses '+change,async()=>{
 const f=fixture();f.waits.set('a',later());f.receiver.openArtefactFile({name:'a'});const pending=f.readers[0].onload();await Promise.resolve();
 if(change==='invalidated')f.receiver._makeCodeRequest=null;
 if(change==='stage')f.setStage({});
 if(change==='unmount'){f.receiver.componentWillUnmount();assert.equal(f.receiver._makeCodeRequest,null);}
 if(change==='disposed')f.receiver._unmounted=true;
 const before=structuredClone(f.receiver.state),effects=f.effects.length;f.waits.get('a').resolve(f.result('a'));await pending;
 assert.deepEqual(f.receiver.state,before);assert.equal(f.effects.length,effects);f.readers[0].onerror();assert.deepEqual(f.receiver.state,before);
});

test('superseded lazy module load cannot start package preparation',async()=>{
 const f=fixture(),module=later();f.receiver.makeCodeImportModule=()=>module.promise;f.receiver.openArtefactFile({name:'a'});const pending=f.readers[0].onload();f.receiver._makeCodeRequest=null;
 module.resolve({importArtefact:()=>{throw Error('stale package preparation started');}});await pending;assert.equal(f.receiver.state.buffers.pseudocode,'before');
});

test('current file failures and reader errors remain visible',async()=>{
 const f=fixture();f.waits.set('a',later());f.receiver.openArtefactFile({name:'a'});const pending=f.readers[0].onload();await Promise.resolve();f.waits.get('a').reject(Error('current refusal'));await pending;
 assert.equal(f.receiver.state.status,'failed a: current refusal');f.readers[0].onerror();assert.equal(f.receiver.state.status,'failed a: read error');assert.equal(f.receiver.state.buffers.pseudocode,'before');
});

test('share preparation has the same success, stale error and replaced-stage fences',async()=>{
 const f=fixture();f.waits.set('share',later());const pending=f.receiver.openMakeCodeShare();await Promise.resolve();await Promise.resolve();
 f.waits.get('share').resolve(f.result('share'));await pending;assert.equal(f.receiver.state.buffers.pseudocode,'code share');assert.equal(f.requests[0].prepareDependencies,true);
 for(const failure of [false,true]){
  const g=fixture();g.waits.set('share',later());const old=g.receiver.openMakeCodeShare();await Promise.resolve();await Promise.resolve();g.setStage({});const before=structuredClone(g.receiver.state);
  if(failure)g.waits.get('share').reject(Error('stale share refusal'));else g.waits.get('share').resolve(g.result('share'));await old;assert.deepEqual(g.receiver.state,before);
 }
});

test('unmount while share prompt is pending cannot publish loading state',async()=>{
 const prompt=later(),f=fixture();const open=new Function('promptAsync','return ({'+method('openMakeCodeShare')+'}).openMakeCodeShare;')(()=>prompt.promise);
 const pending=open.call(f.receiver);f.receiver.componentWillUnmount();const before=structuredClone(f.receiver.state);prompt.resolve('share');await pending;assert.deepEqual(f.receiver.state,before);
});

// Keep the actual prompt boundary pending while a real competing method or
// stage replacement changes authority. All outcomes must leave it untouched.
for(const change of ['stage','newer file','newer share'])for(const outcome of ['answer','cancel','error'])test('pending share prompt '+outcome+' refuses '+change,async()=>{
 const prompt=later(),f=fixture();
 const open=new Function('promptAsync','return ({'+method('openMakeCodeShare')+'}).openMakeCodeShare;')(()=>prompt.promise);
 const old=open.call(f.receiver);const oldRequest=f.receiver._makeCodeRequest;
 if(change==='stage')f.setStage({});
 if(change==='newer file'){
  f.waits.set('new',later());f.receiver.openArtefactFile({name:'new'});const current=f.readers[0].onload();await Promise.resolve();
  f.waits.get('new').resolve(f.result('new'));await current;
 }
 let newer;
 if(change==='newer share'){
  newer=later();const next=new Function('promptAsync','return ({'+method('openMakeCodeShare')+'}).openMakeCodeShare;')(()=>newer.promise);
  // Even a newer prompt that has not answered owns the new intent.
  newer.pending=next.call(f.receiver);assert.notEqual(f.receiver._makeCodeRequest,oldRequest);
 }
 const before=structuredClone(f.receiver.state),effects=f.effects.length,requests=f.requests.length,authority=f.receiver._makeCodeRequest;
 if(outcome==='error')prompt.reject(Error('old prompt failure'));else prompt.resolve(outcome==='cancel'?null:'old-share');await old;
 assert.deepEqual(f.receiver.state,before);assert.equal(f.effects.length,effects);assert.equal(f.requests.length,requests);assert.equal(f.receiver._makeCodeRequest,authority);
 if(newer){newer.resolve(null);await newer.pending;assert.equal(f.receiver._makeCodeRequest,null);}
});

test('current share prompt cancellation changes no buffers or status',async()=>{
 const prompt=later(),f=fixture();const open=new Function('promptAsync','return ({'+method('openMakeCodeShare')+'}).openMakeCodeShare;')(()=>prompt.promise);
 const before=structuredClone(f.receiver.state);const pending=open.call(f.receiver);assert.ok(f.receiver._makeCodeRequest);prompt.resolve('  ');await pending;
 assert.deepEqual(f.receiver.state,before);assert.equal(f.effects.length,0);assert.equal(f.requests.length,0);assert.equal(f.receiver._makeCodeRequest,null);
});

test('current share prompt rejection remains visible without starting preparation',async()=>{
 const prompt=later(),f=fixture();const open=new Function('promptAsync','return ({'+method('openMakeCodeShare')+'}).openMakeCodeShare;')(()=>prompt.promise);
 const pending=open.call(f.receiver);prompt.reject(Error('current prompt failure'));await pending;
 assert.equal(f.receiver.state.status,'failed share?: current prompt failure');assert.equal(f.receiver.state.buffers.pseudocode,'before');assert.equal(f.requests.length,0);
});
