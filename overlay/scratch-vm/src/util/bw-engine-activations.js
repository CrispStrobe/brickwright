// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// Engine execution identity, not handler-entry or exception-consumption
// authority. Only the actual execute wrapper issues an entry; frame mutators
// and run cancellation invalidate it even when pooled object identity survives.
const runtimes=new WeakMap(),entries=new WeakMap(),threads=new WeakMap(),frames=new WeakMap();
const frameLeases=new WeakMap(),frameLives=new WeakMap(),handlerEntries=new WeakMap();
const loopRuntimes=new WeakSet(),loopPreparations=new WeakMap(),loopByFrame=new WeakMap(),loopBodyOwners=new WeakMap();
const branchOwners=new WeakMap(),completedThrows=new WeakMap(),branchCancellations=new WeakSet();
const catchBindings=new WeakMap(),catchTokens=new WeakMap(),catchInvocations=new WeakMap(),threadCaptures=new WeakMap();
const managedEscapes=new WeakMap(),registeredCatchMaps=new WeakMap();
const handlerTransfers=new WeakMap(),handlerAcks=new WeakMap(),handlerByFrame=new WeakMap(),handlerSettlements=new WeakMap();
const invalidateRecord=record=>{
    if(!record||!record.live)return;
    record.live=false;record.state.records.delete(record);
    frames.get(record.frame)?.delete(record);
    if(threads.get(record.thread)===record)threads.delete(record.thread);
};
const invalidateThread=thread=>invalidateRecord(threads.get(thread));
const invalidateFrame=frame=>{
    const iteration=loopBodyOwners.get(frame);if(iteration&&!iteration.reusing)iteration.live=false;
    const branch=branchOwners.get(frame);
    if(branch&&!branch.reusing){branch.live=false;}
    const records=frames.get(frame);if(records)for(const record of records)invalidateRecord(record);
    const lifetime=frameLives.get(frame);if(lifetime){lifetime.live=false;lifetime.state.lifetimes.delete(lifetime);frameLives.delete(frame);}
};
const observeRuntime=runtime=>{
    let state=runtimes.get(runtime);if(state)return state;
    state={active:true,disposed:false,generation:0,current:null,records:new Set(),lifetimes:new Set()};
    const invalidate=()=>{
        state.generation++;for(const record of state.records)invalidateRecord(record);
        for(const lifetime of state.lifetimes){lifetime.live=false;if(frameLives.get(lifetime.frame)===lifetime)frameLives.delete(lifetime.frame);}
        state.lifetimes.clear();state.current=null;
    };
    const stop=()=>{invalidate();state.active=false;};
    const start=()=>{invalidate();if(!state.disposed)state.active=true;};
    const dispose=()=>{stop();state.disposed=true;for(const [event,handler]of listeners)runtime.off(event,handler);};
    const listeners=[['PROJECT_START',start],['PROJECT_STOP_ALL',stop],['PROJECT_LOADED',stop],['RUNTIME_DISPOSED',dispose]];
    for(const [event,handler]of listeners)runtime.on(event,handler);
    runtimes.set(runtime,state);return state;
};
const current=record=>Boolean(record&&record.live&&record.state.active&&!record.state.disposed&&
    record.state.generation===record.generation&&threads.get(record.thread)===record&&
    record.runtime.sequencer===record.sequencer&&record.runtime.threads.includes(record.thread)&&
    !record.thread.isKilled&&record.thread.status!==record.thread.constructor.STATUS_DONE&&
    record.runtime.targets.includes(record.target)&&record.thread.target===record.target&&
    record.target.blocks===record.container&&record.thread.blockContainer===record.container&&
    record.thread.peekStack()===record.root&&record.thread.peekStackFrame()===record.frame);
// Entry metadata is still not a physical transfer. It is minted only from a
// real current control operation and a live same-frame lifetime, never from a
// preview body object or a copied branch ID. No current product registers this
// experimental control opcode; default execution cannot create an entry.
const branchValue=input=>{
    if(input==null)return {valid:true,id:null};
    if(typeof input!=='object')return {valid:false};
    const block=Object.getOwnPropertyDescriptor(input,'block'),shadow=Object.getOwnPropertyDescriptor(input,'shadow');
    if(!block||!Object.hasOwn(block,'value')||shadow&&!Object.hasOwn(shadow,'value')||shadow?.value!=null)return {valid:false};
    return {valid:block.value===null||typeof block.value==='string',id:block.value};
};
const handlerCurrent=(record,runtime,thread)=>{
    if(!record||record.runtime!==runtime||record.thread!==thread||handlerByFrame.get(record.frame)!==record)return false;
    const lifetime=frameLeases.get(record.frameLease),container=record.container;
    if(!lifetime||!lifetime.live||lifetime.state!==record.state||!record.state.active||record.state.disposed||
        lifetime.generation!==record.state.generation||frameLives.get(record.frame)!==lifetime||
        !runtime.threads.includes(thread)||thread.isKilled||thread.status===thread.constructor.STATUS_DONE||
        thread.target!==record.target||!runtime.targets.includes(record.target)||thread.blockContainer!==container||
        record.target.blocks!==container||!thread.stackFrames.includes(record.frame)||
        record.prefix.some((point,index)=>thread.stack[index]!==point.block||thread.stackFrames[index]!==point.frame))return false;
    if(container.getBlock!==record.getBlock||container.getBranch!==record.getBranch||
        container.getBlock(record.root)!==record.block||record.block.opcode!=='arcade_structuredTry'||
        record.block.fields!==record.fields||record.block.inputs!==record.inputs||record.block.mutation!==record.mutation||
        container._cache?._executeCached?.[record.root]?._ops!==record.operations||
        record.operations.length!==1||record.operations[0]!==record.operation||record.operation._argValues!==record.args||
        record.operation._blockFunction!==record.implementation||runtime.getOpcodeFunction('arcade_structuredTry')!==record.implementation||
        record.operation.fields!==record.fields||record.operation.mutation!==record.mutation)return false;
    if(Object.keys(record.fields).length!==3||Object.keys(record.args).length!==record.argumentNames.length||
        record.argumentNames.some(name=>!Object.hasOwn(record.args,name))||
        record.argumentNames.includes('mutation')&&
            (!Object.hasOwn(Object.getOwnPropertyDescriptor(record.args,'mutation')||{},'value')||
                Object.getOwnPropertyDescriptor(record.args,'mutation').value!==record.mutation)||
        Object.keys(record.inputs).length!==record.inputNames.length||record.inputNames.some(name=>!Object.hasOwn(record.inputs,name)))return false;
    for(const field of record.selectors){
        const actual=record.fields[field.name],descriptor=actual&&Object.getOwnPropertyDescriptor(actual,'value');
        const argument=Object.getOwnPropertyDescriptor(record.args,field.name);
        if(actual!==field.field||!descriptor||!Object.hasOwn(descriptor,'value')||descriptor.value!==field.value||
            !argument||!Object.hasOwn(argument,'value')||argument.value!==field.value)return false;
    }
    const branchesCurrent=record.branches.every((branch,index)=>{
        const value=branchValue(record.inputs[branch.name]);
        return value.valid&&record.inputs[branch.name]===branch.input&&value.id===branch.id&&
            container.getBranch(record.root,index+1)===branch.id&&
            (branch.id===null||container.getBlock(branch.id)===branch.block&&branch.block.parent===record.root);
    });
    // Actual metadata services can invalidate the run while being observed.
    // Never return the earlier lifetime observation after such a callout.
    return branchesCurrent&&lifetime.live&&record.state.active&&!record.state.disposed&&
        lifetime.generation===record.state.generation&&frameLives.get(record.frame)===lifetime&&
        handlerByFrame.get(record.frame)===record&&record.prefix.every((point,index)=>
            thread.stack[index]===point.block&&thread.stackFrames[index]===point.frame);
};
// Lexical lookup uses the actual owning stack prefix and run lifetime. It
// never returns the private cell map or borrows procedure params.
const catchCell=(runtime,thread,name,strict=false)=>{
    for(let index=thread?.stackFrames?.length-1;index>=0;index--){
        const handler=handlerByFrame.get(thread.stackFrames[index]);
        if(handler&&handler.phase==='catch'&&handler.catchName===name){
            if(handlerCurrent(handler,runtime,thread))return handler;
            if(strict)throw Error('Catch capture lexical owner changed');return null;
        }
    }
    return null;
};
// Captured catch cells have a run lifetime separate from the physical branch.
// Only an observed lexical exit detaches them; frame reset never grants exit.
const detachCatch=handler=>{
    const binding=catchBindings.get(handler);
    if(binding&&handler.phase==='catch')binding.detached=true;
};
const detachFrames=frames=>{for(const frame of frames){const handler=handlerByFrame.get(frame);if(handler)detachCatch(handler);}};
const bindingCurrent=binding=>{
    const {handler,state,generation}=binding,{runtime,target,container}=handler;
    return state.active&&!state.disposed&&state.generation===generation&&runtime.targets.includes(target)&&
        target.blocks===container&&(binding.detached||handlerCurrent(handler,runtime,handler.thread)&&
        handler.phase==='catch'&&handler.cells===binding.cells)&&state.active&&!state.disposed&&state.generation===generation;
};
const mapGet=Function.call.bind(Map.prototype.get),mapEntries=Function.call.bind(Map.prototype.entries);
const mapSize=Function.call.bind(Object.getOwnPropertyDescriptor(Map.prototype,'size').get);
const sealMap=map=>[...mapEntries(map)];
const sameMap=(map,entries)=>mapSize(map)===entries.length&&entries.every(([name,cell])=>mapGet(map,name)===cell);
const capturedMapCurrent=(runtime,thread)=>{
    const record=threadCaptures.get(thread),lifetime=record?.lifetime;
    return record&&record.runtime===runtime&&record.map===thread.bwArcadeCaptures&&sameMap(record.map,record.entries)&&lifetime.live&&
        frameLives.get(record.frame)===lifetime&&lifetime.state.active&&!lifetime.state.disposed&&
        lifetime.state.generation===lifetime.generation&&runtime.threads.includes(thread)&&!thread.isKilled&&
        thread.status!==thread.constructor.STATUS_DONE&&thread.stackFrames.includes(record.frame)&&
        thread.target===record.target&&thread.blockContainer===record.container&&record.target.blocks===record.container;
};
const capturedBinding=(runtime,thread,cell,name=null)=>{
    const binding=catchTokens.get(cell?.values);if(!binding)return null;
    if(cell.key!=='value'||!capturedMapCurrent(runtime,thread)||!bindingCurrent(binding))
        throw Error('Captured catch cell outlived its owned invocation or run');
    const entries=threadCaptures.get(thread).entries;
    if(!entries.some(([key,actual])=>actual===cell&&(name===null||name===key))||!capturedMapCurrent(runtime,thread))
        throw Error('Captured catch token is not in its actual invocation map');
    return binding;
};
const installationCurrent=(record,sequencer,thread,status)=>{
    return record.sequencer===sequencer&&record.thread===thread&&
            handlerCurrent(record.handler,sequencer.runtime,thread)&&record.handler.phase===record.phase&&
            thread.stack===record.stack&&thread.stackFrames===record.frames&&
            thread.stack.length===record.handler.prefix.length+1&&thread.stackFrames.length===thread.stack.length&&
            thread.peekStack()===record.branchId&&thread.peekStackFrame()===record.bodyFrame&&
            record.handler.cells===record.cells&&thread.status===status&&
            thread.justReported===null&&record.bodyFrame.justReported===null&&record.bodyFrame.reported===null&&
            record.bodyFrame.waitingReporter===null&&record.bodyFrame.params===null&&record.bodyFrame.reporting===''&&
            record.handler.frame.justReported===null&&record.handler.frame.reported===null&&
            record.handler.frame.waitingReporter===null&&record.handler.frame.reporting==='';
};
const normalCompletion=Object.freeze({kind:'normal'});
const branchCurrent=branch=>!!branch&&branch.live&&branchOwners.get(branch.frame)===branch&&
    handlerCurrent(branch.handler,branch.handler.runtime,branch.handler.thread)&&
    branch.handler.phase===branch.phase&&branch.handler.thread.stackFrames[branch.depth]===branch.frame&&
    branch.handler.thread.stack[branch.depth]===branch.blockId&&
    branch.handler.container.getNextBlock===branch.getNextBlock&&
    (branch.blockId===null||branch.handler.container.getBlock(branch.blockId)===branch.block);
const trackBranch=(handler,frame,id)=>{
    if(!handler.sink)return;
    const branch={handler,frame,blockId:id,block:handler.branches[handler.phase==='try'?0:handler.phase==='catch'?1:2].block,
        depth:handler.prefix.length,phase:handler.phase,getNextBlock:handler.container.getNextBlock,live:true,reusing:false};
    branchOwners.set(frame,branch);handler.branch=branch;
};
const installBranch=(handler,phase,pending)=>{
    const {runtime,thread}=handler;
    if(!handlerCurrent(handler,runtime,thread))return false;
    const id=handler.branches[phase==='try'?0:phase==='catch'?1:2].id;
    const frame=new handler.frame.constructor(handler.frame.warpMode);
    const stack=handler.prefix.map(point=>point.block),frames=handler.prefix.map(point=>point.frame);
    stack.push(id);frames.push(frame);
    if(!handlerCurrent(handler,runtime,thread))return false;
    const removed=thread.stackFrames.slice(handler.prefix.length),running=thread.constructor.STATUS_RUNNING;
    for(const key of ['stack','stackFrames','status','justReported']){
        const descriptor=Object.getOwnPropertyDescriptor(thread,key);
        if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.writable)return false;
    }
    if(!handlerCurrent(handler,runtime,thread))return false;
    Object.defineProperties(thread,{stack:{value:stack},stackFrames:{value:frames},status:{value:running},justReported:{value:null}});
    detachCatch(handler);detachFrames(removed);
    for(const old of removed)invalidateFrame(old);
    invalidateThread(thread);handler.phase=phase;handler.pending=pending;
    if(phase!=='catch')handler.cells=Object.create(null);
    trackBranch(handler,frame,id);return true;
};
const throwPhase=handler=>handler.phase==='try'&&handler.hasCatch?'catch':
    handler.phase!=='finally'&&handler.hasFinally?'finally':null;
const cancelOldBranch=branch=>{
    const handler=branch.handler,thread=handler.thread;
    // Only the still-retained old stack may be cancelled. A reset/reissued frame
    // or a new current execution is never adopted as that old branch.
    if(branch.live&&thread.stackFrames[branch.depth]===branch.frame&&thread.stack[branch.depth]===branch.blockId&&
        handlerByFrame.get(handler.frame)===handler&&handler.prefix.every((point,index)=>thread.stack[index]===point.block&&thread.stackFrames[index]===point.frame)&&
        !current(threads.get(thread))){
        thread.status=thread.constructor.STATUS_DONE;branchCancellations.add(thread);
    }
    return true;
};
const refuseBranch=(branch,message)=>{
    const handler=branch.handler,lifetime=frameLeases.get(handler.frameLease);
    if(!handler.state.active||handler.state.disposed||lifetime?.generation!==handler.state.generation)return cancelOldBranch(branch);
    const pending=handler.pending?.kind==='throw'?handler.pending:handler.failureFallback;
    if(pending?.kind==='throw'&&handler.sink){handler.sink(pending,null);return true;}
    throw new Error(message);
};
// A return retains its real procedure prefix and frame lifetime, not public
// params or a serialized destination. Finalizers may replace this completion.
const returnCurrent=completion=>{
    const {execution,destination,lifetime,prefix}=completion,{thread,state}=execution;
    return completion.live&&lifetime.live&&frameLives.get(destination)===lifetime&&
        state.active&&!state.disposed&&state.generation===execution.generation&&
        execution.runtime.sequencer===execution.sequencer&&execution.runtime.threads.includes(thread)&&
        !thread.isKilled&&thread.status!==thread.constructor.STATUS_DONE&&
        execution.runtime.targets.includes(execution.target)&&thread.target===execution.target&&
        execution.target.blocks===execution.container&&thread.blockContainer===execution.container&&
        destination.params===completion.params&&destination.waitingReporter===completion.waitingReporter&&
        prefix.every((point,index)=>thread.stack[index]===point.block&&thread.stackFrames[index]===point.frame);
};
const relayReturn=(completion,start,originCurrent)=>{
    const owned=()=>originCurrent()&&returnCurrent(completion);
    if(!owned())return false;
    const {thread,runtime}=completion.execution;
    for(let index=start;index>=completion.depth;index--){
        const handler=handlerByFrame.get(thread.stackFrames[index]);
        if(!handler)continue;
        if(!handlerCurrent(handler,runtime,thread)||!owned())return false;
        if(handler.phase!=='finally'&&handler.hasFinally)
            return installBranch(handler,'finally',completion);
    }
    if(!owned())return false;
    // Close exited controls before ordinary procedure settlement can reuse a
    // frame. A second completion cannot publish the retained value again.
    for(let index=thread.stackFrames.length-1;index>=completion.depth;index--){
        const handler=handlerByFrame.get(thread.stackFrames[index]);
        if(handler){detachCatch(handler);handler.phase='closed';handlerByFrame.delete(handler.frame);
            if(handler.branch){handler.branch.live=false;branchOwners.delete(handler.branch.frame);}}
    }
    completion.live=false;completion.settle(completion.value);return true;
};
// Native lexical destinations are issued only at actual Sequencer branch
// entry under a current native loop execution/cache. Public isLoop, a body ID
// or an arbitrary parent pointer cannot issue a destination.
const snapshotData=object=>{
    if(!object||typeof object!=='object')return null;
    const descriptors=Object.getOwnPropertyDescriptors(object);
    if(Reflect.ownKeys(descriptors).some(key=>typeof key!=='string'||!Object.hasOwn(descriptors[key],'value')))return null;
    return Object.freeze(Reflect.ownKeys(descriptors).map(key=>Object.freeze({key,value:descriptors[key].value})));
};
const sameData=(object,snapshot)=>!!snapshot&&Reflect.ownKeys(object).length===snapshot.length&&snapshot.every(({key,value})=>{
    const descriptor=Object.getOwnPropertyDescriptor(object,key);return descriptor&&Object.hasOwn(descriptor,'value')&&descriptor.value===value;
});
const loopMetadata=loop=>{
    const {container,block,operation}=loop;
    return container.getBlock===loop.getBlock&&container.getBranch===loop.getBranch&&container.getNextBlock===loop.getNextBlock&&container.getInputs===loop.getInputs&&
        container.getBlock(loop.root)===block&&block.opcode===loop.opcode&&block.fields===loop.fields&&block.inputs===loop.inputs&&block.mutation===loop.mutation&&
        sameData(block.fields,loop.fieldMap)&&loop.fieldData.every(({field,data})=>sameData(field,data))&&
        sameData(block.inputs,loop.inputMap)&&loop.inputData.every(({input,data})=>sameData(input,data))&&
        container._cache?._executeCached?.[loop.root]?._ops===loop.operations&&loop.operations.length===loop.operationList.length&&
        loop.operationList.every((op,index)=>loop.operations[index]===op)&&operation._argValues===loop.args&&sameData(loop.args,loop.argData)&&
        operation.fields===loop.fields&&operation.inputs===container.getInputs(block)&&operation.mutation===loop.mutation&&operation._blockFunction===loop.implementation&&
        loop.runtime.getOpcodeFunction(loop.opcode)===loop.implementation&&container.getBranch(loop.root,1)===loop.body&&
        (loop.body===null||container.getBlock(loop.body)===loop.bodyBlock&&loop.bodyBlock.parent===loop.root);
};
const loopCurrent=loop=>{
    if(!loop)return false;
    const {state,thread,lifetime,iteration}=loop;
    const lifetimeCurrent=()=>iteration?.live&&loopBodyOwners.get(iteration.frame)===iteration&&
        thread.stackFrames[loop.depth+1]===iteration.frame&&thread.stack[loop.depth+1]===iteration.blockId&&
        loopByFrame.get(loop.frame)===loop&&lifetime.live&&frameLives.get(loop.frame)===lifetime&&
        state.active&&!state.disposed&&state.generation===loop.generation&&loopRuntimes.has(loop.runtime)&&
        loop.runtime.sequencer===loop.sequencer&&loop.runtime.threads.includes(thread)&&!thread.isKilled&&thread.status!==thread.constructor.STATUS_DONE&&
        loop.runtime.targets.includes(loop.target)&&thread.target===loop.target&&loop.target.blocks===loop.container&&thread.blockContainer===loop.container&&
        loop.frame.isLoop===true&&loop.frame.params===loop.params&&loop.frame.waitingReporter===loop.waitingReporter&&
        loop.frame.executionContext===loop.context&&(loop.context===null||sameData(loop.context,loop.contextData))&&
        loop.prefix.every((point,index)=>thread.stack[index]===point.block&&thread.stackFrames[index]===point.frame);
    return lifetimeCurrent()&&loopMetadata(loop)&&lifetimeCurrent();
};
const cancelLoopBody=iteration=>{
    const loop=iteration?.loop;if(!loop)return true;
    const {thread}=loop;
    if(iteration.live&&loopByFrame.get(loop.frame)===loop&&
        thread.stackFrames[loop.depth+1]===iteration.frame&&thread.stack[loop.depth+1]===iteration.blockId&&
        loop.prefix.every((point,index)=>thread.stack[index]===point.block&&thread.stackFrames[index]===point.frame)&&
        !current(threads.get(thread))){thread.status=thread.constructor.STATUS_DONE;branchCancellations.add(thread);}
    return true;
};
const relayJump=(completion,start,originCurrent)=>{
    const {loop}=completion,{thread,runtime}=loop;
    const owned=()=>completion.live&&originCurrent()&&completion.lexicalCurrent()&&loopCurrent(loop)&&originCurrent()&&
        completion.live&&loop.iteration.live&&loop.lifetime.live&&loop.state.active&&loop.state.generation===loop.generation;
    if(!owned())return false;
    for(let index=start;index>loop.depth;index--){
        const handler=handlerByFrame.get(thread.stackFrames[index]);if(!handler)continue;
        if(!handlerCurrent(handler,runtime,thread)||!owned())return false;
        if(handler.phase!=='finally'&&handler.hasFinally)return installBranch(handler,'finally',completion);
    }
    if(!owned())return false;
    for(let index=thread.stackFrames.length-1;index>loop.depth;index--){
        const handler=handlerByFrame.get(thread.stackFrames[index]);
        if(handler){detachCatch(handler);handler.phase='closed';handlerByFrame.delete(handler.frame);
            if(handler.branch){handler.branch.live=false;branchOwners.delete(handler.branch.frame);}}
    }
    // Native mutators revoke discarded branch/activation lifetimes. Continue
    // leaves the loop's own executionContext/counter intact for its next turn.
    completion.live=false;loopByFrame.delete(loop.frame);
    while(thread.stackFrames.length>loop.depth+1)thread.popStack();
    if(completion.kind==='break')thread.goToNextBlock();
    else thread.pushStack(null);
    return true;
};
const finishBranch=branch=>{
    const handler=branch.handler,{thread,runtime}=handler;
    if(!branchCurrent(branch)||thread.peekStackFrame()!==branch.frame)return false;
    if(handler.phase!=='finally'&&handler.hasFinally)return installBranch(handler,'finally',normalCompletion);
    const completion=handler.phase==='finally'?handler.pending||normalCompletion:normalCompletion;
    if(completion.kind==='break'||completion.kind==='continue')return relayJump(completion,handler.prefix.length-2,
        ()=>branchCurrent(branch)&&branch.live&&thread.peekStackFrame()===branch.frame);
    if(completion.kind==='return')return relayReturn(completion,handler.prefix.length-2,
        ()=>branchCurrent(branch)&&branch.live&&thread.peekStackFrame()===branch.frame);
    if(completion.kind==='throw'){
        // Completing a finalizer restores its saved throw before any normal
        // successor or outer catch can execute. Each inner boundary is visited.
        for(let index=handler.prefix.length-2;index>=0;index--){
            const outer=handlerByFrame.get(handler.prefix[index].frame);
            if(!outer)continue;
            if(!handlerCurrent(outer,runtime,thread))return false;
            const phase=throwPhase(outer);if(!phase)continue;
            if(!installBranch(outer,phase,phase==='finally'?completion:normalCompletion))return false;
            if(phase==='catch'&&outer.catchName)outer.cells[outer.catchName]=completion.value;
            return true;
        }
        const completionToken=Object.freeze(Object.create(null));completedThrows.set(completionToken,{branch,completion});
        try{handler.sink(completion,completionToken);}finally{completedThrows.delete(completionToken);}
        return true;
    }
    // Retain the owning frame until normal successor selection has passed the
    // outer branch's own goToNextBlock hook. Its params obey ordinary reuse.
    const removed=thread.stackFrames.slice(handler.prefix.length);
    if(!handlerCurrent(handler,runtime,thread))return false;
    thread.stack=handler.prefix.map(point=>point.block);thread.stackFrames=handler.prefix.map(point=>point.frame);
    for(const frame of removed)invalidateFrame(frame);
    detachCatch(handler);handler.phase='closed';handlerByFrame.delete(handler.frame);invalidateThread(thread);
    thread.goToNextBlock();return true;
};
module.exports=Object.freeze({
    enter(sequencer,thread){
        const runtime=sequencer?.runtime,target=thread?.target;
        // Do not change unsupported/ordinary execution behavior by throwing at
        // entry. A missing actual engine ownership fact simply issues no ticket.
        if(!runtime||runtime.sequencer!==sequencer||sequencer.activeThread!==thread||
            !runtime.threads?.includes(thread)||!runtime.targets?.includes(target)||
            thread.isKilled||thread.status===thread.constructor.STATUS_DONE||
            thread.blockContainer!==target.blocks||!thread.peekStack()||!thread.peekStackFrame()||
            typeof runtime.on!=='function'||typeof runtime.off!=='function')return null;
        const state=observeRuntime(runtime);if(!state.active||state.disposed)return null;
        invalidateThread(thread);
        const token=Object.freeze(Object.create(null));
        const record={token,runtime,sequencer,thread,target,container:target.blocks,root:thread.peekStack(),
            frame:thread.peekStackFrame(),state,generation:state.generation,live:true,inScope:true,previous:state.current};
        let ownedFrames=frames.get(record.frame);if(!ownedFrames){ownedFrames=new Set();frames.set(record.frame,ownedFrames);}
        ownedFrames.add(record);state.records.add(record);entries.set(token,record);threads.set(thread,record);state.current=record;
        return token;
    },
    leave(token){
        const record=entries.get(token);if(!record)return;
        record.inScope=false;if(record.state.current===record)record.state.current=record.previous;
    },
    capture(sequencer,thread){
        const record=runtimes.get(sequencer?.runtime)?.current;
        return record&&record.inScope&&record.sequencer===sequencer&&record.thread===thread&&
            sequencer.activeThread===thread&&current(record)?record.token:null;
    },
    valid(token,sequencer,thread){const record=entries.get(token);return !!record&&
        record.sequencer===sequencer&&record.thread===thread&&current(record);},
    captureFrame(entry){
        const record=entries.get(entry);
        if(!current(record)||!record.inScope||record.state.current!==record||
            record.sequencer.activeThread!==record.thread)return null;
        let lifetime=frameLives.get(record.frame);
        if(lifetime&&(lifetime.thread!==record.thread||lifetime.runtime!==record.runtime||
            lifetime.generation!==record.generation||!lifetime.live))return null;
        if(!lifetime){
            const token=Object.freeze(Object.create(null));
            lifetime={token,state:record.state,runtime:record.runtime,thread:record.thread,
                frame:record.frame,target:record.target,container:record.container,generation:record.generation,live:true};
            frameLives.set(record.frame,lifetime);frameLeases.set(token,lifetime);record.state.lifetimes.add(lifetime);
        }
        return lifetime.token;
    },
    validFrame(lease,runtime,thread,frame){
        const lifetime=frameLeases.get(lease);
        return !!lifetime&&lifetime.live&&lifetime.runtime===runtime&&lifetime.thread===thread&&
            lifetime.frame===frame&&frameLives.get(frame)===lifetime&&lifetime.state.active&&!lifetime.state.disposed&&
            lifetime.generation===lifetime.state.generation&&runtime.threads.includes(thread)&&!thread.isKilled&&
            thread.status!==thread.constructor.STATUS_DONE&&thread.target===lifetime.target&&
            runtime.targets.includes(lifetime.target)&&thread.blockContainer===lifetime.container&&
            lifetime.target.blocks===lifetime.container&&thread.stackFrames.includes(frame);
    },
    bindHandlerEntry(entry,frameLease,args){
        const execution=entries.get(entry),lifetime=frameLeases.get(frameLease);
        if(!current(execution)||!execution.inScope||execution.state.current!==execution||
            execution.sequencer.activeThread!==execution.thread||!lifetime||!lifetime.live||
            lifetime.frame!==execution.frame||lifetime.thread!==execution.thread||lifetime.state!==execution.state||
            lifetime.generation!==execution.generation||frameLives.get(execution.frame)!==lifetime)return null;
        const {runtime,thread,frame,target,container,root,state}=execution;
        const block=container.getBlock(root),operations=container._cache?._executeCached?.[root]?._ops;
        const operation=operations?.length===1?operations[0]:null;
        if(!block||block.opcode!=='arcade_structuredTry'||!operation||operation.id!==root||
            operation.opcode!==block.opcode||operation._argValues!==args||typeof operation._blockFunction!=='function'||
            runtime.getOpcodeFunction(block.opcode)!==operation._blockFunction||operation.fields!==block.fields||
            operation.mutation!==block.mutation||block.mutation||!block.fields||!block.inputs)return null;
        const names=['HAS_CATCH','HAS_FINALLY','CATCH_NAME'],selectors=[];
        // Real execute caches include an engine-owned mutation argument in
        // addition to literal fields. It must be the canonical mutation value;
        // extra arguments and accessor substitutions still refuse admission.
        const argumentNames=names.slice();
        if(Object.hasOwn(args,'mutation')){
            const descriptor=Object.getOwnPropertyDescriptor(args,'mutation');
            if(!Object.hasOwn(descriptor,'value')||descriptor.value!==operation.mutation)return null;
            argumentNames.push('mutation');
        }
        if(Object.keys(block.fields).length!==names.length||Object.keys(args).length!==argumentNames.length||
            argumentNames.some(name=>!Object.hasOwn(args,name))||
            Object.keys(block.inputs).some(name=>!['SUBSTACK','SUBSTACK2','SUBSTACK3'].includes(name)))return null;
        for(const name of names){
            const field=block.fields[name],descriptor=field&&Object.getOwnPropertyDescriptor(field,'value');
            const argument=Object.getOwnPropertyDescriptor(args,name);
            if(!descriptor||!Object.hasOwn(descriptor,'value')||!argument||!Object.hasOwn(argument,'value')||
                argument.value!==descriptor.value)return null;
            selectors.push({name,field,value:descriptor.value});
        }
        const hasCatch=args.HAS_CATCH==='1',hasFinally=args.HAS_FINALLY==='1';
        if(!['0','1'].includes(args.HAS_CATCH)||!['0','1'].includes(args.HAS_FINALLY)||!hasCatch&&!hasFinally||
            typeof args.CATCH_NAME!=='string'||args.CATCH_NAME!==''&&!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(args.CATCH_NAME)||
            !hasCatch&&args.CATCH_NAME!=='')return null;
        const branches=['SUBSTACK','SUBSTACK2','SUBSTACK3'].map(name=>{
            const input=block.inputs[name],value=branchValue(input),id=value.id;
            return {name,input,id,valid:value.valid,block:id==null?null:container.getBlock(id)};
        });
        if(branches.some(branch=>!branch.valid||branch.id!==null&&(typeof branch.id!=='string'||!branch.block))||
            !hasCatch&&branches[1].id!==null||!hasFinally&&branches[2].id!==null)return null;
        const record={runtime,thread,frame,target,container,root,state,frameLease,block,operations,operation,args,
            prefix:thread.stack.map((block,index)=>({block,frame:thread.stackFrames[index]})),phase:'try',cells:Object.create(null),
            fields:block.fields,inputs:block.inputs,inputNames:Object.keys(block.inputs),mutation:block.mutation,implementation:operation._blockFunction,
            getBlock:container.getBlock,getBranch:container.getBranch,selectors,argumentNames,branches,hasCatch,hasFinally,catchName:args.CATCH_NAME};
        if(!current(execution))return null;
        const previous=handlerByFrame.get(frame);handlerByFrame.set(frame,record);
        if(!handlerCurrent(record,runtime,thread)){
            if(previous)handlerByFrame.set(frame,previous);else handlerByFrame.delete(frame);return null;
        }
        const entryToken=Object.freeze(Object.create(null));record.token=entryToken;handlerEntries.set(entryToken,record);return entryToken;
    },
    inspectHandlerEntry(entry,runtime,thread){
        const record=handlerEntries.get(entry);if(!handlerCurrent(record,runtime,thread))return null;
        // Read-only view; copying it cannot register a handler or acknowledge a transfer.
        return Object.freeze({root:record.root,frame:record.frame,hasCatch:record.hasCatch,hasFinally:record.hasFinally,
            catchName:record.catchName,tryBranch:record.branches[0].id,catchBranch:record.branches[1].id,
            finallyBranch:record.branches[2].id,transferAcknowledged:false});
    },
    takeBranchCancellation(thread){
        if(!branchCancellations.has(thread))return false;
        branchCancellations.delete(thread);return true;
    },
    takeCompletedThrow(token,sequencer,thread,signal){
        const record=completedThrows.get(token);if(!record)return false;
        completedThrows.delete(token);
        return record.branch.handler.runtime===sequencer.runtime&&record.branch.handler.thread===thread&&
            record.completion.signal===signal&&branchCurrent(record.branch)&&thread.peekStackFrame()===record.branch.frame;
    },
    enableLexicalLoops(runtime,enabled){if(enabled)loopRuntimes.add(runtime);else loopRuntimes.delete(runtime);},
    prepareLoopBranch(sequencer,thread,branchNum,isLoop){
        if(!loopRuntimes.has(sequencer.runtime)||isLoop!==true||branchNum!==1)return null;
        const execution=runtimes.get(sequencer.runtime)?.current;
        if(!current(execution)||!execution.inScope||execution.state.current!==execution||execution.thread!==thread||execution.sequencer!==sequencer)return null;
        const {runtime,target,container,frame,root,state,generation}=execution;
        const block=container.getBlock(root),operations=container._cache?._executeCached?.[root]?._ops;
        if(!block||!['control_repeat','control_forever','control_repeat_until','control_while'].includes(block.opcode)||!Array.isArray(operations))return null;
        loopByFrame.delete(frame);
        const commands=operations.filter(op=>op.id===root&&op.opcode===block.opcode),operation=commands.length===1?commands[0]:null;
        if(!operation||operation!==operations[operations.length-1]||typeof operation._blockFunction!=='function'||
            runtime.getOpcodeFunction(block.opcode)!==operation._blockFunction||operation.fields!==block.fields||operation.mutation!==block.mutation||block.mutation!=null)return null;
        const fieldMap=snapshotData(block.fields),inputMap=snapshotData(block.inputs),argData=snapshotData(operation._argValues);
        const fieldData=fieldMap?.map(({value:field})=>({field,data:snapshotData(field)})),inputData=inputMap?.map(({value:input})=>({input,data:snapshotData(input)}));
        if(!fieldMap||!inputMap||!argData||fieldData.some(x=>!x.data)||inputData.some(x=>!x.data))return null;
        const body=container.getBranch(root,1),bodyBlock=body===null?null:container.getBlock(body);
        if(body!==null&&(!bodyBlock||bodyBlock.parent!==root)||!current(execution))return null;
        const frameLease=module.exports.captureFrame(execution.token),lifetime=frameLeases.get(frameLease);if(!lifetime)return null;
        const loop={runtime,target,container,frame,root,state,generation,sequencer,thread,lifetime,depth:thread.stackFrames.length-1,
            prefix:Object.freeze(thread.stack.map((block,index)=>Object.freeze({block,frame:thread.stackFrames[index]}))),
            params:frame.params,waitingReporter:frame.waitingReporter,context:frame.executionContext,contextData:snapshotData(frame.executionContext),block,opcode:block.opcode,fields:block.fields,inputs:block.inputs,mutation:block.mutation,
            operation,operations,operationList:operations.slice(),args:operation._argValues,implementation:operation._blockFunction,
            fieldMap,inputMap,argData,fieldData,inputData,body,bodyBlock,getBlock:container.getBlock,getBranch:container.getBranch,getNextBlock:container.getNextBlock,getInputs:container.getInputs};
        const token=Object.freeze(Object.create(null));loopPreparations.set(token,loop);return token;
    },
    commitLoopBranch(token,sequencer,thread){
        const loop=loopPreparations.get(token);if(!loop)return;
        loopPreparations.delete(token);
        if(loop.sequencer!==sequencer||loop.thread!==thread||thread.stackFrames.length!==loop.depth+2||thread.peekStack()!==loop.body||
            thread.peekStackFrame()===loop.frame)return;
        const iteration={loop,frame:thread.peekStackFrame(),blockId:loop.body,block:loop.bodyBlock,live:true,reusing:false};
        loop.iteration=iteration;loopBodyOwners.set(iteration.frame,iteration);loopByFrame.set(loop.frame,loop);
        if(!loopCurrent(loop)){iteration.live=false;loopByFrame.delete(loop.frame);}
    },
    beginOwnedJump(entry,kind){
        const execution=entries.get(entry);
        if(!current(execution)||!execution.inScope||execution.state.current!==execution||execution.sequencer.activeThread!==execution.thread){
            if(execution&&(!execution.state.active||execution.state.generation!==execution.generation)){
                const branch=branchOwners.get(execution.frame);if(branch)cancelOldBranch(branch);return true;
            }
            throw Error('Structured jump requires its current engine entry');
        }
        if(!['break','continue'].includes(kind))throw Error('Unknown structured jump kind');
        const {thread,container}=execution;
        let loop=null;
        const refuse=message=>{
            if(!execution.state.active||execution.state.generation!==execution.generation){
                const branch=branchOwners.get(execution.frame);if(branch)cancelOldBranch(branch);
                else if(loop)cancelLoopBody(loop.iteration);return true;
            }
            throw Error(message);
        };
        for(let index=thread.stackFrames.length-2;index>=0;index--){
            const frame=thread.stackFrames[index];
            if(loopByFrame.has(frame)){loop=loopByFrame.get(frame);break;}
            if(frame.params!==null||frame.waitingReporter!==null)break;
        }
        if(!loop||!loopCurrent(loop))return refuse('Structured jump requires its owned lexical loop destination');
        // Actual block ancestry must reach this loop, not merely a copied body
        // ID or a dynamic caller frame. Snapshot each observed link for relay.
        const ancestry=[];let id=execution.root;
        for(let n=0;n<128&&id!==loop.root;n++){
            const block=container.getBlock(id);if(!block||ancestry.some(point=>point.id===id))break;
            ancestry.push({id,block,parent:block.parent});id=block.parent;
        }
        if(id!==loop.root||!ancestry.some(point=>point.id===loop.body))return refuse('Structured jump is outside its lexical loop body');
        const lexicalCurrent=()=>ancestry.every(point=>container.getBlock(point.id)===point.block&&point.block.parent===point.parent);
        const completion={kind,loop,live:true,lexicalCurrent};
        const origin=()=>current(execution)&&lexicalCurrent();
        if(!relayJump(completion,thread.stackFrames.length-1,origin)){
            return refuse('Structured jump ownership changed');
        }
        return true;
    },
    beginOwnedReturn(entry,depth,read,settle){
        const execution=entries.get(entry);
        if(!current(execution)||!execution.inScope||execution.state.current!==execution||
            execution.sequencer.activeThread!==execution.thread){
            // Cache observation may synchronously Stop/restart the run. That
            // old invocation must never fall back to ordinary publication.
            if(execution&&(!execution.state.active||execution.state.generation!==execution.generation)){
                const branch=branchOwners.get(execution.frame);if(branch)cancelOldBranch(branch);return true;
            }
            throw Error('Structured return requires its current engine entry');
        }
        const {thread,state,runtime,target,container,generation}=execution;
        if(!Number.isInteger(depth)||depth<0||depth>=thread.stackFrames.length)return false;
        if(!thread.stackFrames.slice(depth).some(frame=>handlerByFrame.has(frame)))return false;
        const destination=thread.stackFrames[depth];
        let lifetime=frameLives.get(destination);
        if(lifetime&&(!lifetime.live||lifetime.thread!==thread||lifetime.generation!==generation))
            throw Error('Structured return destination lifetime changed');
        if(!lifetime){
            const token=Object.freeze(Object.create(null));
            lifetime={token,state,runtime,thread,frame:destination,target,container,generation,live:true};
            frameLives.set(destination,lifetime);frameLeases.set(token,lifetime);state.lifetimes.add(lifetime);
        }
        const completion={kind:'return',execution,destination,lifetime,depth,live:true,settle,
            params:destination.params,waitingReporter:destination.waitingReporter,
            prefix:Object.freeze(thread.stack.slice(0,depth+1).map((block,index)=>Object.freeze({block,frame:thread.stackFrames[index]})))};
        const originBranch=branchOwners.get(thread.peekStackFrame());
        completion.value=read();
        if(!returnCurrent(completion)||!relayReturn(completion,thread.stackFrames.length-1,()=>current(execution))){
            if(!state.active||state.generation!==generation){if(originBranch)cancelOldBranch(originBranch);return true;}
            throw Error('Structured return ownership changed');
        }
        return true;
    },
    beginHandlerBranch(entry,sequencer,thread,sink){
        const handler=handlerEntries.get(entry);
        if(typeof sink!=='function'||!handlerCurrent(handler,sequencer.runtime,thread)||
            thread.peekStackFrame()!==handler.frame||handler.phase!=='try'||handler.sink||
            typeof handler.container.getNextBlock!=='function')return false;
        handler.sink=sink;return installBranch(handler,'try',normalCompletion);
    },
    advanceLoopBody(thread,nextBlockId,reuse){
        const iteration=loopBodyOwners.get(thread.peekStackFrame());if(!iteration)return false;
        const {loop}=iteration;
        const refuse=message=>{
            if(!loop.state.active||loop.state.disposed||loop.state.generation!==loop.generation)return cancelLoopBody(iteration);
            throw Error(message);
        };
        if(loopByFrame.get(loop.frame)!==loop)return false;
        const current=()=>loopCurrent(loop)&&iteration.live&&thread.peekStack()===iteration.blockId&&
            (iteration.blockId===null||loop.container.getBlock(iteration.blockId)===iteration.block);
        if(!current()||loop.container.getNextBlock(iteration.blockId)!==nextBlockId||!current())
            return refuse('Lexical loop body ownership changed');
        const block=nextBlockId===null?null:loop.container.getBlock(nextBlockId);
        if(nextBlockId!==null&&!block||!current())return refuse('Lexical loop successor ownership changed');
        iteration.reusing=true;try{reuse();}finally{iteration.reusing=false;}
        iteration.blockId=nextBlockId;iteration.block=block;
        if(!current())return refuse('Lexical loop body reuse changed ownership');
        return true;
    },
    advanceStructuredBranch(thread,nextBlockId,reuse){
        const branch=branchOwners.get(thread.peekStackFrame());if(!branch)return false;
        const handler=branch.handler;
        if(!branchCurrent(branch)){
            if(handler.thread!==thread||!thread.stackFrames.includes(handler.frame)||handlerByFrame.get(handler.frame)!==handler){branchOwners.delete(branch.frame);return false;}
            if(!handler.state.active||handler.state.generation!==frameLeases.get(handler.frameLease)?.generation)return cancelOldBranch(branch);
            return refuseBranch(branch,'Structured branch ownership changed before completion');
        }
        if(handler.container.getNextBlock(branch.blockId)!==nextBlockId||!branchCurrent(branch))
            return refuseBranch(branch,'Structured branch successor changed before completion');
        if(nextBlockId===null){if(!finishBranch(branch))return refuseBranch(branch,'Structured branch completion refused');return true;}
        const block=handler.container.getBlock(nextBlockId);if(!block)return refuseBranch(branch,'Structured branch successor missing');
        branch.reusing=true;
        try{reuse();}finally{branch.reusing=false;}
        branch.blockId=nextBlockId;branch.block=block;
        if(!branchCurrent(branch)){
            if(!handler.state.active||handler.state.generation!==frameLeases.get(handler.frameLease)?.generation)return cancelOldBranch(branch);
            return refuseBranch(branch,'Structured branch reuse changed ownership');
        }
        return true;
    },
    finishEmptyBranch(sequencer,thread){
        const branch=branchOwners.get(thread.peekStackFrame());
        if(!branch||branch.blockId!==null)return false;
        if(branch.handler.runtime!==sequencer.runtime||!branchCurrent(branch))return refuseBranch(branch,'Empty structured branch ownership changed');
        if(!finishBranch(branch))return refuseBranch(branch,'Empty structured branch completion refused');return true;
    },
    finishPromiseBranch(sequencer,thread,blockCached){
        const branch=branchOwners.get(thread.peekStackFrame());if(!branch)return false;
        if(branch.handler.runtime!==sequencer.runtime||blockCached.id!==branch.blockId||!branchCurrent(branch))
            return refuseBranch(branch,'Structured Promise branch ownership changed');
        thread.goToNextBlock();return true;
    },
    prepareOwnedThrow(origin,value,signal=null){
        const execution=entries.get(origin);if(!current(execution))return null;
        // The first registered boundary is decisive. An inner finally, catch
        // phase or unsupported empty branch may not be skipped for an outer try.
        const unwind=[];
        for(let index=execution.thread.stackFrames.length-1;index>=0;index--){
            const frame=execution.thread.stackFrames[index],handler=handlerByFrame.get(frame);
            if(!handler)continue;
            if(!handlerCurrent(handler,execution.runtime,execution.thread))return null;
            if(throwPhase(handler))return module.exports.prepareHandlerTransfer(origin,handler.token,value,signal,unwind);
            unwind.push(handler);
        }
        return null;
    },
    commitManagedEscape(origin,completionToken,sequencer,thread,signal){
        // Only a current selected execute activation or the one-use completed
        // finalizer token can unwind a procedure. No actionable boundary may
        // be skipped, including a local catch or a not-yet-run finalizer.
        const execution=entries.get(origin);
        if(completionToken){
            if(!module.exports.takeCompletedThrow(completionToken,sequencer,thread,signal))return null;
        }else if(!current(execution)||execution.sequencer!==sequencer||execution.thread!==thread)return null;
        const state=runtimes.get(sequencer.runtime),generation=state?.generation;
        for(const frame of thread.stackFrames){
            const handler=handlerByFrame.get(frame);
            if(handler&&(!handlerCurrent(handler,sequencer.runtime,thread)||throwPhase(handler)))return null;
        }
        if(!state?.active||state.disposed||state.generation!==generation)return null;
        const receipt=Object.freeze(Object.create(null));
        managedEscapes.set(receipt,{sequencer,thread,state,generation,stack:thread.stack,frames:thread.stackFrames,
            blocks:[...thread.stack],points:[...thread.stackFrames]});
        // Ownership is closed before retirement. Actual call settlement, rather
        // than a normal reporter value, delivers the signal to the next caller.
        for(const frame of thread.stackFrames){
            const handler=handlerByFrame.get(frame);
            if(handler){detachCatch(handler);handler.phase='closed';handlerByFrame.delete(frame);
                if(handler.branch){handler.branch.live=false;branchOwners.delete(handler.branch.frame);}}
        }
        invalidateThread(thread);return receipt;
    },
    takeManagedEscape(receipt,sequencer,thread){
        const record=managedEscapes.get(receipt);if(!record)return false;
        managedEscapes.delete(receipt);
        return record.sequencer===sequencer&&record.thread===thread&&record.state.active&&!record.state.disposed&&
            record.state.generation===record.generation&&thread.stack===record.stack&&thread.stackFrames===record.frames&&
            thread.stack.length===record.blocks.length&&thread.stackFrames.length===record.points.length&&
            record.blocks.every((block,index)=>thread.stack[index]===block&&thread.stackFrames[index]===record.points[index]);
    },
    prepareManagedThrow(origin,destinationOrigin,value,signal=null){
        const source=entries.get(origin),destination=entries.get(destinationOrigin);
        if(!current(source)||!current(destination)||source.runtime!==destination.runtime||
            source.thread===destination.thread||source.target!==destination.target||
            source.thread.stackFrames.some(frame=>handlerByFrame.has(frame)))return null;
        // A managed edge is admitted separately by the coordinator. This
        // physical helper cannot skip any boundary on the throwing thread.
        return module.exports.prepareOwnedThrow(destinationOrigin,value,signal);
    },
    captureCatchProvider(origin){
        const execution=entries.get(origin);if(!current(execution))return null;
        const {runtime,thread,state,target,container,generation}=execution;
        const selected=new Set();
        const valid=()=>current(execution)&&[...selected].every(bindingCurrent);
        return Object.freeze({
            current:valid,
            cell(name){
                if(!valid())throw Error('Catch capture requires its original create activation');
                const handler=catchCell(runtime,thread,name,true);if(!handler)return null;
                let binding=catchBindings.get(handler);
                if(!binding||binding.cells!==handler.cells){
                    binding={handler,state,generation,cells:handler.cells,name,detached:false};
                    binding.token=Object.freeze({value:undefined});catchTokens.set(binding.token,binding);catchBindings.set(handler,binding);
                }
                selected.add(binding);
                if(!valid()||!bindingCurrent(binding))throw Error('Catch capture changed during binding observation');
                return Object.freeze({values:binding.token,key:'value'});
            },
            read(cell){
                const binding=catchTokens.get(cell?.values);if(!binding)return null;
                if(!valid()||cell.key!=='value'||!bindingCurrent(binding))throw Error('Catch capture value reader expired');
                // Active same-thread catch tokens need no invocation map; an
                // inherited token must come from this actual callable thread.
                if(!binding.detached&&binding.handler.thread===thread&&catchCell(runtime,thread,binding.name)===binding.handler)
                    return Object.freeze({value:binding.cells[binding.name]});
                const inherited=capturedBinding(runtime,thread,cell);return Object.freeze({value:inherited.cells[inherited.name]});
            },
            invocation(map,callerOrigin){
                const caller=entries.get(callerOrigin);
                if(!caller||!current(caller)||caller.runtime!==runtime||caller.target!==target||
                    !state.active||state.generation!==generation)throw Error('Captured catch invocation requires its current caller');
                const cells=[...map.values()].filter(cell=>catchTokens.has(cell?.values));
                if(cells.some(cell=>cell.key!=='value'||!bindingCurrent(catchTokens.get(cell.values))))throw Error('Captured catch invocation contains expired cells');
                const token=Object.freeze(Object.create(null));catchInvocations.set(token,{map,entries:sealMap(map),caller,runtime,target,container,state,generation});return token;
            }
        });
    },
    registerCatchMap(origin,map,token){
        const execution=entries.get(origin);if(!current(execution))throw Error('Event capture requires its current registration activation');
        const cells=[...map.values()].filter(cell=>catchTokens.has(cell?.values));
        if(!cells.length)return map;
        if(cells.some(cell=>cell.key!=='value'||!bindingCurrent(catchTokens.get(cell.values))))throw Error('Event capture contains expired catch cells');
        const record={runtime:execution.runtime,target:execution.target,container:execution.container,
            state:execution.state,generation:execution.generation,token,map,entries:sealMap(map)};
        if(!current(execution))throw Error('Event capture changed during registration');
        registeredCatchMaps.set(map,record);return map;
    },
    bindRegisteredCatch(runtime,thread,map,token){
        const record=registeredCatchMaps.get(map);
        if(!record){
            if([...map.values()].some(cell=>catchTokens.has(cell?.values)))throw Error('Event capture requires its issued registration map');
            return;
        }
        if(record.runtime!==runtime||record.token!==token||!sameMap(map,record.entries)||
            !record.state.active||record.state.disposed||record.state.generation!==record.generation||
            !runtime.targets.includes(record.target)||!runtime.threads.includes(thread)||thread.isKilled||
            thread.status===thread.constructor.STATUS_DONE||thread.target!==record.target||
            thread.blockContainer!==record.container||record.target.blocks!==record.container||
            thread.bwArcadeCaptures!==map||thread.bwArcadeEvent?.TOKEN!==token||
            thread.stackFrames.length!==1||thread.stack.length!==1||
            record.entries.some(([,cell])=>catchTokens.has(cell?.values)&&!bindingCurrent(catchTokens.get(cell.values))))
            throw Error('Event capture registration or run changed');
        const frame=thread.stackFrames[0],body=thread.peekStack();
        if(!frame||frameLives.get(frame)?.live||!body)throw Error('Event capture requires a fresh callback frame');
        const lifetime={state:record.state,runtime,thread,frame,target:record.target,container:record.container,
            generation:record.generation,live:true};
        frameLives.set(frame,lifetime);record.state.lifetimes.add(lifetime);
        threadCaptures.set(thread,{runtime,target:record.target,container:record.container,frame,lifetime,map,entries:record.entries});
        // The real Thread API keeps the registration's cells on an inert
        // sentinel while native advancement replaces callback body frames.
        thread.stack[0]=null;thread.pushStack(body);
    },
    bindCatchInvocation(token,thread,caller,map){
        const record=catchInvocations.get(token);if(!record)return false;catchInvocations.delete(token);
        if(record.map!==map||!sameMap(map,record.entries)||record.caller.thread!==caller||!current(record.caller)||record.runtime.threads.includes(thread)!==true||
            thread.target!==record.target||thread.blockContainer!==record.container||!record.state.active||record.state.generation!==record.generation)return false;
        const frame=thread.stackFrames[0];if(!frame||thread.stackFrames.length!==1||frameLives.get(frame)?.live)return false;
        const lifetime={state:record.state,runtime:record.runtime,thread,frame,target:record.target,container:record.container,generation:record.generation,live:true};
        frameLives.set(frame,lifetime);record.state.lifetimes.add(lifetime);
        threadCaptures.set(thread,{runtime:record.runtime,target:record.target,container:record.container,frame,lifetime,map,entries:record.entries});return true;
    },
    readCapturedCatch(runtime,thread,cell,name){
        const binding=capturedBinding(runtime,thread,cell,name);return binding?Object.freeze({value:binding.cells[binding.name]}):null;
    },
    writeCapturedCatch(runtime,thread,cell,value,name){
        const binding=capturedBinding(runtime,thread,cell,name);if(!binding)return false;
        binding.cells[binding.name]=value;return true;
    },
    readCatchCell(runtime,thread,name){
        const handler=catchCell(runtime,thread,name);
        return handler?Object.freeze({value:handler.cells[name]}):null;
    },
    writeCatchCell(runtime,thread,name,value){
        const handler=catchCell(runtime,thread,name);
        if(!handler)return false;
        handler.cells[name]=value;return true;
    },
    prepareHandlerTransfer(origin,entry,value,signal=null,unwind=[]){
        const execution=entries.get(origin),handler=handlerEntries.get(entry);
        // This first physical dependency is deliberately same-thread/catch-only.
        // A managed edge or a pending finally cannot be bypassed by this route.
        if(!current(execution)||!handlerCurrent(handler,execution.runtime,execution.thread)||
            !throwPhase(handler)||(!handler.sink&&(handler.phase!=='try'||handler.hasFinally||handler.branches[1].id===null))||
            value!==null&&!['undefined','boolean','number','string'].includes(typeof value))return null;
        const thread=execution.thread,stack=thread.stack,stackFrames=thread.stackFrames;
        if(stack.length!==stackFrames.length||!Array.isArray(stack)||!Array.isArray(stackFrames))return null;
        // Selecting an outer entry may not skip an inner registered boundary,
        // even if that inner catch has already run. Explicit unwind is pending.
        if(stackFrames.slice(handler.prefix.length).some(frame=>{
            const inner=handlerByFrame.get(frame);return inner&&(!unwind.includes(inner)||throwPhase(inner)!==null)&&handlerCurrent(inner,execution.runtime,thread);
        }))return null;
        const request=Object.freeze(Object.create(null));
        handlerTransfers.set(request,{execution,handler,value,signal,phase:throwPhase(handler),originalPhase:handler.phase,unwind,stack,stackFrames,
            originStack:[...stack],originFrames:[...stackFrames]});
        return request;
    },
    commitHandlerTransfer(request,sequencer,thread,origin){
        const transfer=handlerTransfers.get(request);
        if(!transfer)return null;
        handlerTransfers.delete(request); // even refused offers cannot be retried
        const {execution,handler,value,phase}=transfer;
        if(execution.token!==origin||execution.sequencer!==sequencer||execution.thread!==thread||
            !current(execution)||!handlerCurrent(handler,sequencer.runtime,thread)||handler.phase!==transfer.originalPhase||throwPhase(handler)!==phase||
            thread.stack!==transfer.stack||thread.stackFrames!==transfer.stackFrames||
            thread.stack.length!==transfer.originStack.length||thread.stackFrames.length!==transfer.originFrames.length||
            thread.stackFrames.slice(handler.prefix.length).some(frame=>{const inner=handlerByFrame.get(frame);
                return inner&&(!transfer.unwind.includes(inner)||throwPhase(inner)!==null)&&handlerCurrent(inner,sequencer.runtime,thread);})||
            transfer.originStack.some((block,index)=>thread.stack[index]!==block||thread.stackFrames[index]!==transfer.originFrames[index]))return null;
        // No guest callbacks or Thread pool hooks are run during installation.
        // Prepare every value before replacing writable own engine fields. Old
        // frames become unreachable and are invalidated, never returned to a
        // possibly reentrant free-list hook. The owning control frame survives.
        const data=(object,name)=>{const descriptor=Object.getOwnPropertyDescriptor(object,name);
            return descriptor&&Object.hasOwn(descriptor,'value')&&descriptor.writable;};
        if(!['stack','stackFrames','status','justReported'].every(name=>data(thread,name)))return null;
        const Frame=handler.frame.constructor,bodyFrame=new Frame(handler.frame.warpMode);
        if(!['params','justReported','reported','waitingReporter','executionContext','reporting'].every(name=>data(bodyFrame,name)))return null;
        const nextStack=handler.prefix.map(point=>point.block),nextFrames=handler.prefix.map(point=>point.frame);
        const branchId=handler.branches[phase==='catch'?1:2].id;
        nextStack.push(branchId);nextFrames.push(bodyFrame);
        const cells=Object.create(null);if(handler.catchName)cells[handler.catchName]=value;
        const removed=thread.stackFrames.slice(handler.prefix.length);
        const running=thread.constructor.STATUS_RUNNING;
        // Constructor and metadata reads happen before a final run-generation
        // check; a Stop emitted during preparation must not install old work.
        if(!handlerCurrent(handler,sequencer.runtime,thread)||!current(execution)||
            !['stack','stackFrames','status','justReported'].every(name=>data(thread,name))||
            !['justReported','reported','waitingReporter','reporting'].every(name=>data(handler.frame,name))||
            transfer.originStack.some((block,index)=>thread.stack[index]!==block||thread.stackFrames[index]!==transfer.originFrames[index]))return null;
        // Native defineProperties on preflighted data slots performs no user
        // callout. No acknowledgement exists until the whole state is installed.
        Object.defineProperties(thread,{stack:{value:nextStack},stackFrames:{value:nextFrames},
            status:{value:running},justReported:{value:null}});
        Object.defineProperties(handler.frame,{justReported:{value:null},reported:{value:null},
            waitingReporter:{value:null},reporting:{value:''}});
        detachCatch(handler);detachFrames(removed);
        for(const frame of removed)invalidateFrame(frame);
        invalidateThread(thread);handler.phase=phase;handler.cells=phase==='catch'?cells:Object.create(null);
        handler.failureFallback=Object.freeze({kind:'throw',signal:transfer.signal,value});
        handler.pending=phase==='finally'?handler.failureFallback:normalCompletion;
        trackBranch(handler,bodyFrame,branchId);
        const ack=Object.freeze(Object.create(null));
        handlerAcks.set(ack,{handler,thread,sequencer,stack:nextStack,frames:nextFrames,bodyFrame,cells:handler.cells,phase,branchId});
        return ack;
    },
    takeHandlerAck(ack,sequencer,thread){
        const record=handlerAcks.get(ack);if(!record)return false;
        handlerAcks.delete(ack);
        return installationCurrent(record,sequencer,thread,thread.constructor.STATUS_RUNNING);
    },
    parkHandlerAck(ack,sequencer,thread){
        const record=handlerAcks.get(ack);if(!record)return null;
        handlerAcks.delete(ack);
        if(!installationCurrent(record,sequencer,thread,thread.constructor.STATUS_RUNNING))return null;
        // A managed destination must not run before its actual pending call
        // settles. The receipt is consumed before this private parked lease.
        Object.defineProperty(thread,'status',{value:thread.constructor.STATUS_PROMISE_WAIT});
        const token=Object.freeze(Object.create(null));handlerSettlements.set(token,record);return token;
    },
    validHandlerSettlement(token,sequencer,thread){
        const record=handlerSettlements.get(token);
        return !!record&&installationCurrent(record,sequencer,thread,thread.constructor.STATUS_PROMISE_WAIT);
    },
    takeHandlerSettlement(token,sequencer,thread){
        const record=handlerSettlements.get(token);if(!record)return false;
        handlerSettlements.delete(token);
        if(!installationCurrent(record,sequencer,thread,thread.constructor.STATUS_PROMISE_WAIT))return false;
        Object.defineProperty(thread,'status',{value:thread.constructor.STATUS_RUNNING});return true;
    },
    invalidateThread,
    invalidateFrame
});
