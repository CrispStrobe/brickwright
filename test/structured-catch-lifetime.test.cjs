// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// New lifetime counterexamples only; prior capture controls are not registered.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const text=fs.readFileSync(path.join(__dirname,'structured-catch-capture.test.cjs'),'utf8');
const selected=text.slice(0,text.indexOf('for(const queued of [false,true])test(')),mod={exports:{}};
new Function('require','module','__dirname','process',selected+'\nmodule.exports={make};')(require,mod,__dirname,process);
const {make}=mod.exports;
for(const change of ['reset-restore','pop-restore','run-ABA'])test(`captured read rejects ${change} with original sentinel fields and identity restored`,()=>{
    const s=make({queued:true});s.v.step();const child=s.v.runtime.threads[1];assert.ok(child);
    const stack=child.stack,frames=child.stackFrames,sentinel=frames[0],props=Object.getOwnPropertyDescriptors(sentinel);
    const blocks=[...stack],points=[...frames],captures=child.bwArcadeCaptures;
    if(change==='reset-restore')sentinel.reset();
    if(change==='pop-restore'){
        while(child.stack.length)child.popStack();
        child.stack.push(...blocks);child.stackFrames.push(...points);
    }
    if(change==='run-ABA'){s.v.runtime.emit('PROJECT_STOP_ALL');s.v.runtime.emit('PROJECT_START');}
    Object.defineProperties(sentinel,props);
    child.status=child.constructor.STATUS_RUNNING;
    assert.equal(child.stack,stack);assert.equal(child.stackFrames,frames);assert.equal(child.stackFrames[0],sentinel);
    assert.deepEqual(Object.getOwnPropertyDescriptors(sentinel),props);assert.equal(child.bwArcadeCaptures,captures);
    assert.deepEqual(child.stack,blocks);assert.deepEqual(child.stackFrames,points);
    s.v.sequencer.activeThread=child;
    assert.throws(()=>s.v.sequencer.stepThread(child),/Captured catch cell/);
    assert.deepEqual(s.reads,[]);assert.deepEqual(s.results,[]);assert.deepEqual(s.v.errors,[]);
});

test('captured read refuses actual reset invalidation before private registration deletion',()=>{
    const s=make({queued:true});s.v.step();const child=s.v.runtime.threads[1],sentinel=child.stackFrames[0];
    const original=Set.prototype.delete;let observed=false;
    // The source calls state.lifetimes.delete after setting live=false and
    // before deleting frameLives. Observe that real callback interval only;
    // no private record is changed or used to manufacture authority.
    Set.prototype.delete=function(value){
        if(!observed&&value?.frame===sentinel&&value?.thread===child){
            observed=true;s.v.sequencer.activeThread=child;
            let failure=null;
            try {s.v.sequencer.stepThread(child);}catch(error){failure=error;}
            if(s.reads.length)console.log(JSON.stringify({counterexample:'reset-invalidation-window',staleReads:s.reads}));
            assert.deepEqual(s.reads,[],'reset must revoke captured reads before registration deletion');
            assert.match(failure?.message||'',/Captured catch cell/);
        }
        return Reflect.apply(original,this,[value]);
    };
    try {sentinel.reset();}finally {Set.prototype.delete=original;}
    assert.equal(observed,true);assert.deepEqual(s.reads,[]);assert.deepEqual(s.results,[]);assert.deepEqual(s.v.errors,[]);
});
