// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Execute the actual bundled class without constructing unrelated hardware services.
let body;
const source=readFileSync(new URL('../overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js',import.meta.url),'utf8');
const module={exports:{}};
new Function('require','module',source)(name=>name==='../adapter'?text=>{body=text;}:()=>{},module);
const registration='Scratch.extensions.register(new Arcade(Scratch.vm && Scratch.vm.runtime));';
assert.equal(body.split(registration).length,2);
const context={Scratch:{BWExtensionDependencies:{createImageEngine:()=>({}),initializeSpriteData:()=>({}),initializeRotation:()=>({})}},setTimeout};
vm.runInNewContext(body.replace(registration,'globalThis.TestArcade=Arcade;'),context);
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const drain=async iterator=>{let step=iterator.next();while(!step.done){await step.value;step=iterator.next();}return step.value;};
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
function make(){
 const a={id:'a',pxtId:1,kind:0,flags:0},b={id:'b',pxtId:2,kind:0,flags:0},c={id:'c',pxtId:3,kind:0,flags:0};
 const owner={sprites:{a,b,c}},timers=[],calls=[],works=[],ext=Object.create(context.TestArcade.prototype);
 ext._spriteValues=new Map(Object.values(owner.sprites).map(s=>[s.id,s]));ext._state=()=>owner;
 ext._handlerRegistration=args=>({token:args.TOKEN,captures:args.CAPTURES});
 ext._sourceSceneTimers=()=>true;ext._programClockEpoch={setTimeout:fn=>timers.push(fn)};
 ext._registeredCallbackSteps=function*(registrations,opcode,event){calls.push({token:registrations[0].token,opcode,...event});if(ext.wait)yield ext.wait.promise;return !!ext.fault;};
 ext._runTerrainGenerator=iterator=>{const work=drain(iterator);works.push(work);return work;};
 ext.spriteOverlaps=()=>true;
 return{ext,owner,a,b,c,timers,calls,works,tick:async()=>{for(const fn of timers.splice(0))fn();await flush();}};
}
test('receiver slot replaces and binds the actual object, including inactive-scene objects',()=>{
 const v=make();v.ext.registerInstanceOverlapHandler({ID:'a',TOKEN:'old'});v.ext.registerInstanceOverlapHandler({ID:'a',TOKEN:'new'});
 assert.equal(v.a._overlapRegistration.token,'new');assert.equal(v.b._overlapRegistration,undefined);
 v.ext._state=()=>({sprites:{}});v.ext.registerInstanceOverlapHandler({ID:'a',TOKEN:'inactive'});
 assert.equal(v.a._overlapRegistration.token,'inactive');
 v.ext.registerInstanceOverlapHandler({ID:'missing',TOKEN:'bad'});
});
test('default/same-kind and reverse orientation deliver the other sprite exactly once per locked pair',async()=>{
 const v=make();v.ext.registerInstanceOverlapHandler({ID:'b',TOKEN:'hit'});v.ext.wait=deferred();
 const grid={filled:[[v.a,v.b]]};v.ext._physicsOverlapRounds(grid,[],v.owner);
 assert.equal(v.owner.overlapLocks.size,1);v.ext._physicsOverlapRounds(grid,[],v.owner);assert.equal(v.works.length,1);
 await v.tick();assert.deepEqual(v.calls,[{token:'hit',opcode:'arcade_whenRegisteredInstanceOverlap',first:'b',second:'a'}]);
 v.ext.wait.resolve();await Promise.all(v.works);await flush();assert.equal(v.owner.overlapLocks.size,0);
 v.ext._physicsOverlapRounds(grid,[],v.owner);await v.tick();await Promise.all(v.works);assert.equal(v.calls.length,2);
});
test('slot lookup happens at deferred start and only the earlier receiver wins a pair',async()=>{
 const v=make();v.ext.registerInstanceOverlapHandler({ID:'a',TOKEN:'old'});v.ext.registerInstanceOverlapHandler({ID:'b',TOKEN:'second'});
 v.ext._physicsOverlapRounds({filled:[[v.b,v.a]]},[],v.owner);
 v.ext.registerInstanceOverlapHandler({ID:'a',TOKEN:'replacement'});await v.tick();await Promise.all(v.works);
 assert.equal(v.calls.length,1);assert.equal(v.calls[0].token,'replacement');assert.equal(v.calls[0].first,'a');assert.equal(v.calls[0].second,'b');
});
test('ghost/destroyed receivers do not dispatch; stopped/reset programs discard queued callbacks',async()=>{
 for(const flags of [2,4096,512]){const v=make();v.a.flags=flags;v.ext.registerInstanceOverlapHandler({ID:'a',TOKEN:'hit'});v.ext._physicsOverlapRounds({filled:[[v.a,v.b]]},[],v.owner);assert.equal(v.works.length,0);}
 for(const reset of [false,true]){const v=make();v.ext.registerInstanceOverlapHandler({ID:'a',TOKEN:'hit'});v.ext._physicsOverlapRounds({filled:[[v.a,v.b]]},[],v.owner);
  if(reset)v.ext._spriteValues.set('a',{...v.a});else v.ext._terrainStopped=true;
  await v.tick();await Promise.all(v.works);assert.deepEqual(v.calls,[]);}
 const v=make();v.a._destroyed=true;v.ext.registerInstanceOverlapHandler({ID:'a',TOKEN:'hit'});v.ext._physicsOverlapRounds({filled:[[v.a,v.b]]},[],v.owner);assert.equal(v.works.length,0);
});
test('receiver and global handlers share the pair lock and faulted callback keeps it locked',async()=>{
 const v=make();v.ext.registerInstanceOverlapHandler({ID:'a',TOKEN:'instance'});v.ext.fault=true;
 v.ext._physicsOverlapRounds({filled:[[v.a,v.b]]},[{kind:0,otherKind:0,token:'global'}],v.owner);
 await v.tick();await Promise.all(v.works);await flush();assert.equal(v.calls.length,2);assert.equal(v.owner.overlapLocks.size,1);
 v.ext._physicsOverlapRounds({filled:[[v.a,v.b]]},[],v.owner);assert.equal(v.works.length,2);
});
test('a receiver registration admits other/default kinds into the actual physics broadphase',()=>{
 const v=make(),inserted=[];v.owner.physicsEngine={maxVelocity:100,minSingleStep:1};v.c.kind=123;
 v.ext._overlapHandlers=[];v.ext._legacyOverlapRegistrations=()=>[];v.ext._terrainEpoch=1;
 v.ext._physicsMotion=sprite=>({sprite,dx:0,dy:0,xStep:0,yStep:0});v.ext._physicsGrid=()=>({});
 v.ext._physicsInsert=(grid,sprite)=>inserted.push(sprite.id);v.ext._clampSprite=()=>{};v.ext._physicsOverlapRounds=()=>{};
 v.ext.registerInstanceOverlapHandler({ID:'a',TOKEN:'hit'});
 assert.equal(v.ext._advancePhysicsSteps([v.a,v.b,v.c],0.02,null).next().done,true);
 assert.deepEqual(inserted,['a','b','c']);
});
