// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
// Reuse graph adapters only. No previous boundary/branch/return controls run.
const source=fs.readFileSync(path.join(__dirname,'structured-branch-finally.test.cjs'),'utf8');
const mod={exports:{}};
new Function('require','module','__dirname','process',source.slice(0,source.indexOf("test('actual sequencer normal"))+'\nmodule.exports={fixture,layout,trace,Thread,engine};')(require,mod,__dirname,process);
const {fixture,layout,trace,Thread,engine}=mod.exports;
const native=new Map();
const loadNative=name=>{
    if(native.has(name))return native.get(name);
    const file=name==='control'?'control.js':name==='../util/cast'?'cast.js':name==='../util/color'?'color.js':null;
    assert.ok(file,'Unexpected native dependency '+name);const m={exports:{}};
    new Function('require','module',fs.readFileSync(path.join(path.dirname(process.argv[2]),file),'utf8'))(loadNative,m);
    native.set(name,m.exports);return m.exports;
};
const Control=loadNative('control');
const makeJump=(kind='break',mode='engine')=>{
    const v=fixture(mode),events=[];layout(v,{body:'jump'});
    trace(v,'catch',events);trace(v,'finally',events);trace(v,'afterTry',events);v.blocks.try.next='afterTry';
    const text=fs.readFileSync(path.join(__dirname,'../overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js'),'utf8');
    const method=text.slice(text.indexOf('    structuredJump(args,util) {'),text.indexOf('    structuredTry(args,util) {'));
    const extension={},exceptionOwners=new WeakMap([[extension,v.owner]]);
    const jump=new Function('exceptionOwners','return ({'+method+'}).structuredJump;')(exceptionOwners).bind(extension);
    v.operation('jump','arcade_structuredJump',{KIND:kind},jump,{},'try');
    const control=new Control(v.runtime);
    const loop=(id,body,times=2,parent=null,next=null,opcode='control_repeat')=>{
        const implementation=(args,util)=>{
            const frame=util.thread.peekStackFrame();if(frame.executionContext===null)frame.executionContext={};
            util.stackFrame=frame.executionContext;util.startBranch=(n,isLoop)=>util.sequencer.stepToBranch(util.thread,n,isLoop);
            return control.getPrimitives()[opcode].call(control,args,util);
        };
        const args=opcode==='control_repeat'?{TIMES:times}:opcode==='control_forever'?{}:{CONDITION:opcode==='control_while'};
        v.operation(id,opcode,args,implementation,{SUBSTACK:{block:body,shadow:null}},parent);v.blocks[id].next=next;
        if(v.blocks[body])v.blocks[body].parent=id;
        // Native opcode registration is one implementation, as in production.
        for(const op of Object.values(v.container._cache._executeCached).flatMap(cache=>cache._ops))if(op.opcode===opcode)op._blockFunction=implementation;
    };
    loop('loop','try',2,null,'afterLoop');trace(v,'afterLoop',events,null,null);
    v.thread.reuseStackForNextBlock('loop');
    return {v,events,loop,jump,run:()=>{for(let n=0;n<8&&v.thread.status!==Thread.STATUS_DONE;n++)v.step();}};
};
test('actual native repeat break runs its local finally before loop successor',()=>{
    const {v,events,run}=makeJump();run();assert.deepEqual(events,['finally','afterLoop']);assert.deepEqual(v.errors,[]);assert.equal(v.thread.status,Thread.STATUS_DONE);
});
test('actual native repeat continue preserves counter and skips the remaining body each iteration',()=>{
    const {v,events,run}=makeJump('continue');run();assert.deepEqual(events,['finally','finally','afterLoop']);assert.deepEqual(v.errors,[]);assert.equal(v.thread.status,Thread.STATUS_DONE);
});
test('jump without actual native loop branch issuance refuses a public isLoop flag',()=>{
    const {v,events}=makeJump();v.thread.reuseStackForNextBlock('try');v.thread.stackFrames[0].isLoop=true;
    assert.throws(()=>v.step(),/owned lexical loop/);assert.deepEqual(events,[]);
});
test('copied KIND arguments cannot bypass actual cached jump ownership',()=>{
    const {v,jump}=makeJump();assert.throws(()=>jump({KIND:'break'},v.util),/actual cached|owned entry/);
});
test('disabled default owner cannot issue an experimental jump destination',()=>{
    const {v}=makeJump('break','default');v.blocks.loop.inputs.SUBSTACK.block='jump';v.blocks.jump.parent='loop';assert.throws(()=>v.step(),/actual owned entry/);
});
const innerHandler=(v,events)=>{
    v.blocks.try.inputs.SUBSTACK.block='inner';
    v.operation('inner','arcade_structuredTry',{HAS_CATCH:'0',HAS_FINALLY:'1',CATCH_NAME:''},v.container._cache._executeCached.try._ops[0]._blockFunction,
        {SUBSTACK:{block:'jump',shadow:null},SUBSTACK2:{block:null,shadow:null},SUBSTACK3:{block:'innerFinally',shadow:null}},'try');
    v.blocks.jump.parent='inner';trace(v,'innerFinally',events,null,'inner');
};
test('owned jump relays through nested lexical finalizers inside out',()=>{
    const {v,events,run}=makeJump();innerHandler(v,events);run();assert.deepEqual(events,['innerFinally','finally','afterLoop']);assert.deepEqual(v.errors,[]);
});
test('break chooses the nearest actual native loop without escaping its outer iteration',()=>{
    const {v,events,run,loop}=makeJump();loop('innerLoop','try',2,'loop','afterInner');v.blocks.loop.inputs.SUBSTACK.block='innerLoop';trace(v,'afterInner',events,null,'innerLoop');
    run();assert.deepEqual(events,['finally','afterInner','finally','afterInner','afterLoop']);assert.equal(v.thread.status,Thread.STATUS_DONE);assert.deepEqual(v.errors,[]);
});
test('continue from a running finalizer replaces its saved break and retains native counters',()=>{
    const {v,events,run,jump}=makeJump();innerHandler(v,events);
    v.operation('innerFinally','arcade_structuredJump',{KIND:'continue'},jump,{},'inner');
    run();assert.deepEqual(events,['finally','finally','afterLoop']);assert.deepEqual(v.errors,[]);
});
test('owned finalizer throw replaces a pending jump and retains its original terminal signal',()=>{
    const {v,events,run}=makeJump();v.blocks.try.inputs.SUBSTACK3.block='throw';run();
    assert.deepEqual(events,[]);assert.equal(v.errors.length,1);assert.equal(v.errors[0].message,'Arcade uncaught thrown value: 19');assert.equal(v.owner.failure(v.thread),v.errors[0]);
});
test('actual returnValue from a finalizer replaces the pending jump before procedure settlement',()=>{
    const {v,events,run}=makeJump();innerHandler(v,events);
    const text=fs.readFileSync(path.join(__dirname,'../overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js'),'utf8');
    const method=text.slice(text.indexOf('    returnValue(args, util) {'),text.indexOf('    declareSourceCallable(args,util) {'));
    const extension={},exceptionOwners=new WeakMap([[extension,v.owner]]),managedReturnHosts=new WeakMap([[extension,{value:args=>args.VALUE}]]);
    const actual=new Function('exceptionOwners','managedReturnHosts','return ({'+method+'}).returnValue;')(exceptionOwners,managedReturnHosts).bind(extension);
    v.operation('innerFinally','arcade_returnValue',{VALUE:101},actual,{},'inner');run();
    assert.deepEqual(events,['finally']);assert.equal(v.thread.bwReturnValue,101);assert.deepEqual(v.errors,[]);
});
test('Promise finalizer completes before an owned break resumes the native loop successor',async()=>{
    const {v,events,run}=makeJump();let resolve;trace(v,'finally',events,null,'try',()=>new Promise(yes=>{resolve=yes;}));
    v.step();assert.deepEqual(events,['finally']);assert.equal(v.thread.status,Thread.STATUS_PROMISE_WAIT);
    resolve();await Promise.resolve();await Promise.resolve();run();assert.deepEqual(events,['finally','afterLoop']);assert.deepEqual(v.errors,[]);
});
test('Stop/restart during asynchronous jump finalization runs no old successor',async()=>{
    const {v,events}=makeJump();let resolve;trace(v,'finally',events,null,'try',()=>new Promise(yes=>{resolve=yes;}));
    v.step();v.runtime.emit('PROJECT_STOP_ALL');v.runtime.emit('PROJECT_START');resolve();await Promise.resolve();await Promise.resolve();
    assert.deepEqual(events,['finally']);assert.deepEqual(v.errors,[]);assert.equal(v.thread.status,Thread.STATUS_PROMISE_WAIT);
});
test('reset and public isLoop restoration cannot revive the destination frame lease',()=>{
    const {v,events,run}=makeJump();trace(v,'finally',events,null,'try',()=>{const frame=v.thread.stackFrames[0];frame.reset();frame.isLoop=true;});
    assert.throws(run,/ownership|completion/);assert.deepEqual(events,['finally']);
});
test('changed loop source metadata during finally refuses the saved destination',()=>{
    const {v,events,run}=makeJump();trace(v,'finally',events,null,'try',()=>{v.blocks.loop.fields.TIMES.value=8;});
    assert.throws(run,/ownership|completion/);assert.deepEqual(events,['finally']);
});
test('source ancestry outside the actual loop body cannot borrow its dynamic destination',()=>{
    const {v,events,run,jump}=makeJump();v.blocks.foreign={id:'foreign',parent:null};
    v.operation('jump','arcade_structuredJump',{KIND:'break'},(args,util)=>{v.blocks.jump.parent='foreign';return jump(args,util);},{},'try');
    assert.throws(run,/outside its lexical loop/);assert.deepEqual(events,[]);
});
test('a nested procedure parameter frame prevents dynamic caller loop capture',()=>{
    const {v,events,run}=makeJump();const original=v.container.getBranch;
    v.container.getBranch=(id,n)=>{const result=original(id,n);if(id==='try'&&v.thread.peekStack()==='try')v.thread.peekStackFrame().params={argument:1};return result;};
    assert.throws(run,/owned lexical loop/);assert.deepEqual(events,[]);
});
test('resetting the jump origin during destination metadata observation cannot enter finally',()=>{
    const {v,events,run}=makeJump();let changed=false;
    v.container.observeBranch=id=>{if(!changed&&id==='loop'&&v.thread.peekStack()==='jump'){changed=true;v.thread.peekStackFrame().reset();}};
    assert.throws(run,/ownership|entry/);assert.equal(changed,true);assert.deepEqual(events,[]);
});
test('Stop/restart during destination admission absorbs the old jump without a new failure',()=>{
    const {v,events,run}=makeJump();let changed=false;
    v.container.observeBranch=id=>{if(!changed&&id==='loop'&&v.thread.peekStack()==='jump'){changed=true;v.runtime.emit('PROJECT_STOP_ALL');v.runtime.emit('PROJECT_START');}};
    run();assert.equal(changed,true);assert.deepEqual(events,[]);assert.deepEqual(v.errors,[]);
});
test('changed loop hook producer admits only complete old shapes and rejects partial new hooks',()=>{
    const hooks=require('../scripts/lib/engine-activation-hooks.cjs');
    for(const [name,patch,strip]of [['thread',hooks.patchThreadActivations,hooks.stripThreadActivations],['sequencer',hooks.patchSequencerActivations,hooks.stripSequencerActivations]]){
        const raw=fs.readFileSync(path.join(path.dirname(process.argv[2]),name+'.js'),'utf8'),patched=patch(raw);
        assert.equal(strip(patched),raw);assert.equal(patch(patched),patched);
        const prior=require(path.join(path.dirname(process.argv[2]),'previous-hooks.cjs'));
        const old=(name==='thread'?prior.patchThreadActivations:prior.patchSequencerActivations)(raw);
        assert.equal(strip(old),raw);assert.equal(patch(old),patched);
    }
    const raw=fs.readFileSync(process.argv[4],'utf8'),patched=hooks.patchSequencerActivations(raw);
    assert.throws(()=>hooks.patchSequencerActivations(patched.replace('        bwEngineActivations.commitLoopBranch(bwLoopPreparation, this, thread);','')));
});

test('default native repeat still runs its ordinary body and terminates without experimental authority',()=>{
    const {v,events,run}=makeJump('break','default');trace(v,'body',events,null,'loop');v.blocks.loop.inputs.SUBSTACK.block='body';
    run();assert.deepEqual(events,['body','body','afterLoop']);assert.equal(v.thread.status,Thread.STATUS_DONE);assert.deepEqual(v.errors,[]);
});
test('real sequential loop body reuse keeps only the admitted iteration until branch completion',()=>{
    const {v,events,run}=makeJump();trace(v,'before',events,'try','loop');v.blocks.loop.inputs.SUBSTACK.block='before';v.blocks.try.parent='before';
    run();assert.deepEqual(events,['before','finally','afterLoop']);assert.deepEqual(v.errors,[]);
});
test('reissued body frames cannot regain a native loop target from public stack identity',()=>{
    const {v,events,run,jump}=makeJump();
    v.operation('jump','arcade_structuredJump',{KIND:'break'},(args,util)=>{
        const block=util.thread.stack[1];while(util.thread.stackFrames.length>1)util.thread.popStack();util.thread.pushStack(block);util.thread.pushStack('jump');
        return jump(args,util);
    },{},'try');
    assert.throws(run,/entry|lexical loop/);assert.deepEqual(events,[]);
});

for(const opcode of ['control_forever','control_repeat_until','control_while'])test('native '+opcode+' issues an owned break destination only after real branch entry',()=>{
    const {v,events,run,loop}=makeJump();loop('loop','try',2,null,'afterLoop',opcode);
    run();assert.deepEqual(events,['finally','afterLoop']);assert.equal(v.thread.status,Thread.STATUS_DONE);assert.deepEqual(v.errors,[]);
});
test('a reset and reissued body before a new execute scope cannot inherit the old iteration target',()=>{
    const {v,events}=makeJump();let resolve;trace(v,'pause',events,null,'loop',()=>new Promise(yes=>{resolve=yes;}));
    v.blocks.loop.inputs.SUBSTACK.block='pause';v.blocks.jump.parent='pause';
    v.step();assert.deepEqual(events,['pause']);assert.equal(v.thread.status,Thread.STATUS_PROMISE_WAIT);
    v.thread.popStack();v.thread.pushStack('jump');v.thread.status=Thread.STATUS_RUNNING;
    assert.throws(()=>v.step(),/owned lexical loop/);assert.deepEqual(events,['pause']);assert.ok(resolve);
});
test('Stop/restart in ordinary native loop successor observation cancels only the retained old iteration',()=>{
    const {v,events,run}=makeJump();trace(v,'body',events,null,'loop');v.blocks.loop.inputs.SUBSTACK.block='body';
    const original=v.container.getNextBlock;let changed=false;
    v.container.getNextBlock=id=>{if(id==='body'&&!changed){changed=true;v.runtime.emit('PROJECT_STOP_ALL');v.runtime.emit('PROJECT_START');}return original(id);};
    run();assert.equal(changed,true);assert.deepEqual(events,['body']);assert.deepEqual(v.errors,[]);
});

test('replaced native loop counter context cannot settle an older pending jump',()=>{
    const {v,events,run}=makeJump();trace(v,'finally',events,null,'try',()=>{v.thread.stackFrames[0].executionContext={loopCounter:100};});
    assert.throws(run,/ownership|completion/);assert.deepEqual(events,['finally']);
});
