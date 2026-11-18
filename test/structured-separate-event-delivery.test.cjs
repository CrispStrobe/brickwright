// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// New separate callback delivery consumers. Reuse fixture definitions only;
// the previous common-event controls are not registered or rerun.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const text=fs.readFileSync(path.join(__dirname,'structured-event-registration.test.cjs'),'utf8');
let setup=text.slice(0,text.indexOf("for(const kind of ['update','interval'])"));
setup=setup.replace("'setCaptured'].map(method)","'setCaptured','registerSpriteCreated','registerWallHandler','registerTileHandler','registerTilemapEvent','_terrainCallbackSteps','_tilemapEventSteps','_finishSpriteCreation','_pumpCreationWaits'].map(method)");
setup=setup.replace('decode:x=>x}}','decode:x=>x,reference:(_runtime,kind,id)=>({kind,id})}}');
const mod={exports:{}};new Function('require','module','__dirname','process',setup+'\nmodule.exports={make,Thread};')(require,mod,__dirname,process);
const {make,Thread}=mod.exports;
const prepare=(kind,owner='engine')=>{
 const s=make(owner),{v,extension}=s;
 const sprite={id:'sprite',_creationKind:0},data={tag:'authored tilemap'},image={tag:'authored tile'};
 Object.assign(extension,{_createdHandlers:[],_wallHandlers:[],_tileHandlers:[],_tilemapHandlers:[],_creationWaits:new Set(),
  _tileLocations:new Map(),_nextTileLocationId:0,_state:()=>({sprites:{sprite}}),_spriteValues:new Map([['sprite',sprite]]),
  _image:()=>image,_tilemapReference:()=>data});
 const names={creation:'registerSpriteCreated',wall:'registerWallHandler',tile:'registerTileHandler',tilemap:'registerTilemapEvent'};
 const hats={creation:'arcade_whenRegisteredCreated',wall:'arcade_whenRegisteredWall',tile:'arcade_whenRegisteredTile',tilemap:'arcade_whenRegisteredTilemapEvent'};
 const opcode='arcade_'+names[kind];
 v.operation('register',opcode,{TOKEN:'callback',CAPTURES:'error',KIND:0,EVENT:'Loaded',IMAGE:'image'},extension[names[kind]].bind(extension),{},'try');
 v.blocks.register.next='write';
 v.operation('hat',hats[kind],{TOKEN:'callback'},extension.whenRegisteredWall.bind(extension),{TOKEN:{block:'token'}});v.blocks.hat.next='read';
 v.runtime.allScriptsByOpcodeDo=(opcode,visit)=>{if(opcode===hats[kind])visit({blockId:'hat'},v.thread.target);};
 const registrations=()=>extension[{creation:'_createdHandlers',wall:'_wallHandlers',tile:'_tileHandlers',tilemap:'_tilemapHandlers'}[kind]];
 const deliver=()=>{
  if(kind==='creation')return extension._finishSpriteCreation('sprite',v.util);
  if(kind==='tilemap')return extension._tilemapEventSteps('Loaded',data,v.util).next();
  return extension._terrainCallbackSteps(registrations(),hats[kind],sprite,2,3,v.util).next();
 };
 const stepChild=thread=>{v.sequencer.activeThread=thread;v.sequencer.stepThread(thread);};
 return {...s,kind,registrations,deliver,stepChild};
};
for(const kind of ['creation','wall','tile','tilemap'])test(`${kind} separate delivery reads escaped catch cells across real frame advancement`,()=>{
 const s=prepare(kind);s.v.step();assert.deepEqual(s.events,['finally']);assert.deepEqual(s.reads,[]);
 s.deliver();s.deliver();assert.deepEqual(s.reads,[31,31,31,31]);assert.deepEqual(s.v.errors,[]);
});
test('queued creation pump binds a new sentinel before scheduled callback execution',async()=>{
 const s=prepare('creation');s.v.step();const pending=s.extension._finishSpriteCreation('sprite',null);pending.catch(()=>{});
 const thread=s.v.runtime.threads.at(-1);assert.equal(thread.stackFrames.length,2);assert.deepEqual(s.reads,[]);
 s.stepChild(thread);s.extension._pumpCreationWaits();assert.equal(await pending,'sprite');assert.deepEqual(s.reads,[31,31]);
});
for(const kind of ['creation','wall','tilemap'])test(`${kind} copied map refuses before authored callback work`,async()=>{
 const s=prepare(kind);s.v.step();s.registrations()[0].captures=new Map(s.registrations()[0].captures);
 if(kind==='creation'){
  const pending=s.extension._finishSpriteCreation('sprite',null);pending.catch(()=>{});
  assert.equal(s.extension._creationWaits.size,0,'refused creation must leave its original queue before settlement');
  await assert.rejects(pending,/issued registration map/);
 }
 else assert.throws(()=>s.deliver(),/issued registration map/);
 assert.deepEqual(s.reads,[]);
});
test('Stop before a queued creation callback cannot revive its sentinel capture',async()=>{
 const s=prepare('creation');s.v.step();const pending=s.extension._finishSpriteCreation('sprite',null);pending.catch(()=>{});
 const thread=s.v.runtime.threads.at(-1);s.v.runtime.emit('PROJECT_STOP_ALL');s.v.runtime.emit('PROJECT_START');
 assert.throws(()=>s.stepChild(thread),/Captured catch/);assert.deepEqual(s.reads,[]);
 // The scheduler owns this cancelled wait; retain its unresolved state here.
});
for(const kind of ['creation','wall','tilemap'])test(`${kind} default owner preserves ordinary emitted local captures`,()=>{
 const s=prepare(kind,'default');s.v.thread.stack[0]=null;s.v.thread.stackFrames[0].waitingReporter='ordinary';s.v.thread.pushStack('register');
 s.v.step();s.deliver();assert.deepEqual(s.reads,[31,31]);assert.deepEqual(s.events,[]);assert.deepEqual(s.v.errors,[]);
});

test('unadmitted callback opcode still refuses the experimental capture map',()=>{
 const s=prepare('wall');s.v.operation('register','arcade_registerExternal',{TOKEN:'callback',CAPTURES:'error'},s.extension._terrainRegistration.bind(s.extension),{},'try');
 assert.throws(()=>s.v.step(),/actual registration primitive/);assert.equal(s.registrations().length,0);
});
