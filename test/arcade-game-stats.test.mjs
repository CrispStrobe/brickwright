import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {createArcadeDiscreteTimers} from './helpers/arcade-discrete-timers.mjs';
const require=createRequire(import.meta.url),createStats=require('../overlay/scratch-vm/src/extensions/crispstrobe/arcade/game-stats.js'),
    createFrames=require('../overlay/scratch-vm/src/extensions/crispstrobe/arcade/scene-frame-contexts.js'),
    createPoll=require('../overlay/scratch-vm/src/extensions/crispstrobe/arcade/poll-events.js');
test('diagnostics publishes the previous sample, with strict frame and runtime thresholds',()=>{
    const output=[],stats=createStats(text=>output.push(text)),owner={};stats.begin(owner);stats.setEnabled(true);
    for(let frame=1;frame<=30;frame++){stats.draw(owner,frame);stats.finish(owner,0);}
    assert.equal(output.at(-1),' sprites:30');stats.draw(owner,31);assert.equal(output.at(-1),' sprites:31');
    stats.finish(owner,0);stats.draw(owner,32);assert.equal(output.at(-1),'fps:Infinity sprites:32');
    stats.reset();stats.begin(owner);stats.setEnabled(true);stats.finish(owner,1000);stats.draw(owner,2);
    assert.equal(output.at(-1),' sprites:2');stats.finish(owner,1);stats.draw(owner,2);
    assert.equal(output.at(-1),'fps:2.0 sprites:2');
});
test('false retains published text; scene worker restart resets only its counters; fresh run clears',()=>{
    const output=[],stats=createStats(text=>output.push(text)),parent={},child={};stats.begin(parent);stats.setEnabled(true);
    stats.draw(parent,3);stats.setEnabled(false);stats.draw(parent,9);assert.equal(stats.text,' sprites:3');
    stats.begin(child);stats.setEnabled(true);stats.draw(child,2);assert.equal(stats.text,' sprites:2');
    for(let i=0;i<30;i++)stats.finish(parent,10);
    stats.begin(parent);stats.finish(parent,10);stats.draw(parent,1);assert.equal(stats.text,' sprites:1');
    stats.reset();stats.finish(child,1001);stats.draw(child,7);assert.equal(stats.enabled,false);assert.equal(stats.text,'');assert.equal(output.at(-1),'');
});
test('native sampling refuses coercion and invented membership',()=>{
    const stats=createStats(()=>{}),owner={};let invoked=0;const opaque={valueOf(){invoked++;return 0;},toString(){invoked++;return 'true';}};
    for(const flag of [opaque,1,'true',null,undefined])assert.throws(()=>stats.setEnabled(flag),TypeError);
    stats.begin(owner);stats.setEnabled(true);
    for(const runtime of [opaque,-1,NaN,Infinity,'0'])assert.throws(()=>stats.finish(owner,runtime),TypeError);
    for(const count of [opaque,-1,0.5,NaN])assert.throws(()=>stats.draw(owner,count),TypeError);
    assert.equal(invoked,0);
});
test('actual frame host measures delayed completion once and excludes the following sleep',async()=>{
    const clock=createArcadeDiscreteTimers(),polls=createPoll({...clock}),samples=[],starts=[];let release;
    const completion=new Promise(done=>{release=done;});
    const host=createFrames({...clock,polls:()=>polls,runFrame:()=>({completion}),onFrameBegin:owner=>starts.push(owner),
        onFrameEnd:(owner,runtime)=>samples.push({owner,runtime}),onError:error=>{throw error;}});
    const owner={};host.register(owner);await clock.advanceTo(40);assert.deepEqual(samples,[]);
    release();await new Promise(done=>setImmediate(done));assert.deepEqual(starts,[owner]);assert.deepEqual(samples,[{owner,runtime:40}]);
    host.cancel();polls.cancel();await clock.advanceTo(80);assert.equal(samples.length,1);
});
test('cancelled epoch cannot finish into a new run',async()=>{
    const clock=createArcadeDiscreteTimers(),polls=createPoll({...clock}),samples=[];let release;
    const pending=new Promise(done=>{release=done;});const host=createFrames({...clock,polls:()=>polls,runFrame:()=>({completion:pending}),
        onFrameEnd:(owner,runtime)=>samples.push(runtime),onError:error=>{throw error;}});
    host.register({});await clock.advanceTo(10);host.cancel();polls.cancel();release();await new Promise(done=>setImmediate(done));
    assert.deepEqual(samples,[]);assert.equal(clock.pending,0);
});
