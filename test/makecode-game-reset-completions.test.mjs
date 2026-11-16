import test from 'node:test';
import assert from 'node:assert/strict';
import {runProgram,quitStrandedVMs} from './helpers/bw-vm.mjs';
import {importGuiDependency} from './helpers/bw-integrated.mjs';
test('pending native movement and scale finishes cannot render an old Sprite after actual restart',async()=>{
 try{
  const run=await runProgram('DEVICE ARCADE\nSPRITE Game:\nWHEN flag clicked:\n  arcade set score player 1 to (0)',{frames:0,countExtensionCalls:false});const dispatch=(await importGuiDependency('scratch-vm/src/dispatch/central-dispatch.js')).default,native=dispatch.services[run.vm.extensionManager._loadedExtensions.get('arcade')]._inst;
  for(const operation of ['scale core','scale property','position','position property']){
   const image=native.createImage({WIDTH:2,HEIGHT:2}),id=native.createImageSprite({IMAGE:image,KIND:'Player'});native.setTilemap({DATA:JSON.stringify({columns:1,rows:1,tileSize:8,indices:[0],walls:[0],images:[{width:1,height:1,pixels:[0]}]})});
   // Delay only completion of the real native generator, after its actual
   // initial turn. The VM restart and the native finish are never replaced.
   let release;const gate=new Promise(resolve=>{release=resolve}),originalRun=native._runTerrainGenerator;
   native._runTerrainGenerator=function(generator){return Promise.resolve(originalRun.call(this,generator)).then(()=>gate)};
   let pending;try{
    if(operation==='scale core')pending=native.setSpriteScaleCore({ID:id,SX:2,SY:2,ANCHOR:0});
    if(operation==='scale property')pending=native.setSpriteProperty({ID:id,PROPERTY:'sx',VALUE:2});
    if(operation==='position')pending=native.setSpritePosition({ID:id,X:4,Y:4});
    if(operation==='position property')pending=native.setSpriteProperty({ID:id,PROPERTY:'x',VALUE:4});
   }finally{native._runTerrainGenerator=originalRun}
   assert.ok(pending?.then,operation);native.resetGame({});const fresh=native.createImageSprite({IMAGE:native.createImage({WIDTH:2,HEIGHT:2}),KIND:'Player'}),sprite=native._spriteValues.get(fresh),before={x:sprite.x,y:sprite.y,sx:sprite.sx,sy:sprite.sy};
   const position=native._positionSprite,seen=[];native._positionSprite=function(value){seen.push(value);return position.call(this,value)};
   try{release();await pending;await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(seen,[],operation);assert.deepEqual({x:sprite.x,y:sprite.y,sx:sprite.sx,sy:sprite.sy},before,operation)}finally{native._positionSprite=position}
  }
  assert.deepEqual(run.errors,[]);
 }finally{quitStrandedVMs()}
});
test('pending positioned and projectile factories cannot place a previous program creation',async()=>{
 try{
  const run=await runProgram('DEVICE ARCADE\nSPRITE Game:\nWHEN flag clicked:\n  arcade set score player 1 to (0)',{frames:0,countExtensionCalls:false});const dispatch=(await importGuiDependency('scratch-vm/src/dispatch/central-dispatch.js')).default,native=dispatch.services[run.vm.extensionManager._loadedExtensions.get('arcade')]._inst;
  for(const operation of ['spawnSprite','spawnProjectile']){
   let release;const gate=new Promise(resolve=>{release=resolve}),create=native.createSprite;let old;
   // Hold only the return of an actual creation, without substituting it.
   native.createSprite=function(...args){old=create.apply(this,args);return gate.then(()=>old)};
   let pending;try{pending=native[operation]({KIND:'Player',WIDTH:2,HEIGHT:2,X:4,Y:4,VX:20,VY:0})}finally{native.createSprite=create}
   native.resetGame({});const position=native.setSpritePosition,seen=[];native.setSpritePosition=function(...args){seen.push(args);return position.apply(this,args)};
   try{release();assert.equal(await pending,'');assert.deepEqual(seen,[],operation);assert.equal(native._spriteValues.has(old),false)}finally{native.setSpritePosition=position}
  }
  assert.deepEqual(run.errors,[]);
 }finally{quitStrandedVMs()}
});
