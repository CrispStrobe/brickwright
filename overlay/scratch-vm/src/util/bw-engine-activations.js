// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// Engine execution identity, not handler-entry or exception-consumption
// authority. Only the actual execute wrapper issues an entry; frame mutators
// and run cancellation invalidate it even when pooled object identity survives.
const runtimes=new WeakMap(),entries=new WeakMap(),threads=new WeakMap(),frames=new WeakMap();
const frameLeases=new WeakMap(),frameLives=new WeakMap(),handlerEntries=new WeakMap();
const handlerTransfers=new WeakMap(),handlerAcks=new WeakMap(),handlerByFrame=new WeakMap();
const invalidateRecord=record=>{
    if(!record||!record.live)return;
    record.live=false;record.state.records.delete(record);
    frames.get(record.frame)?.delete(record);
    if(threads.get(record.thread)===record)threads.delete(record.thread);
};
const invalidateThread=thread=>invalidateRecord(threads.get(thread));
const invalidateFrame=frame=>{
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
    if(Object.keys(record.fields).length!==3||Object.keys(record.args).length!==3||
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
        if(Object.keys(block.fields).length!==names.length||Object.keys(args).length!==names.length||
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
            getBlock:container.getBlock,getBranch:container.getBranch,selectors,branches,hasCatch,hasFinally,catchName:args.CATCH_NAME};
        if(!current(execution))return null;
        const previous=handlerByFrame.get(frame);handlerByFrame.set(frame,record);
        if(!handlerCurrent(record,runtime,thread)){
            if(previous)handlerByFrame.set(frame,previous);else handlerByFrame.delete(frame);return null;
        }
        const entryToken=Object.freeze(Object.create(null));handlerEntries.set(entryToken,record);return entryToken;
    },
    inspectHandlerEntry(entry,runtime,thread){
        const record=handlerEntries.get(entry);if(!handlerCurrent(record,runtime,thread))return null;
        // Read-only view; copying it cannot register a handler or acknowledge a transfer.
        return Object.freeze({root:record.root,frame:record.frame,hasCatch:record.hasCatch,hasFinally:record.hasFinally,
            catchName:record.catchName,tryBranch:record.branches[0].id,catchBranch:record.branches[1].id,
            finallyBranch:record.branches[2].id,transferAcknowledged:false});
    },
    prepareHandlerTransfer(origin,entry,value){
        const execution=entries.get(origin),handler=handlerEntries.get(entry);
        // This first physical dependency is deliberately same-thread/catch-only.
        // A managed edge or a pending finally cannot be bypassed by this route.
        if(!current(execution)||!handlerCurrent(handler,execution.runtime,execution.thread)||
            handler.phase!=='try'||!handler.hasCatch||handler.hasFinally||handler.branches[1].id===null||
            value!==null&&!['undefined','boolean','number','string'].includes(typeof value))return null;
        const thread=execution.thread,stack=thread.stack,stackFrames=thread.stackFrames;
        if(stack.length!==stackFrames.length||!Array.isArray(stack)||!Array.isArray(stackFrames))return null;
        // Selecting an outer entry may not skip an inner registered boundary,
        // even if that inner catch has already run. Explicit unwind is pending.
        if(stackFrames.slice(handler.prefix.length).some(frame=>{
            const inner=handlerByFrame.get(frame);return inner&&handlerCurrent(inner,execution.runtime,thread);
        }))return null;
        const request=Object.freeze(Object.create(null));
        handlerTransfers.set(request,{execution,handler,value,stack,stackFrames,
            originStack:[...stack],originFrames:[...stackFrames]});
        return request;
    },
    commitHandlerTransfer(request,sequencer,thread,origin){
        const transfer=handlerTransfers.get(request);
        if(!transfer)return null;
        handlerTransfers.delete(request); // even refused offers cannot be retried
        const {execution,handler,value}=transfer;
        if(execution.token!==origin||execution.sequencer!==sequencer||execution.thread!==thread||
            !current(execution)||!handlerCurrent(handler,sequencer.runtime,thread)||handler.phase!=='try'||
            thread.stack!==transfer.stack||thread.stackFrames!==transfer.stackFrames||
            thread.stack.length!==transfer.originStack.length||thread.stackFrames.length!==transfer.originFrames.length||
            thread.stackFrames.slice(handler.prefix.length).some(frame=>{const inner=handlerByFrame.get(frame);
                return inner&&handlerCurrent(inner,sequencer.runtime,thread);})||
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
        nextStack.push(handler.branches[1].id);nextFrames.push(bodyFrame);
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
        for(const frame of removed)invalidateFrame(frame);
        invalidateThread(thread);handler.phase='catch';handler.cells=cells;
        const ack=Object.freeze(Object.create(null));
        handlerAcks.set(ack,{handler,thread,sequencer,stack:nextStack,frames:nextFrames,bodyFrame,cells});
        return ack;
    },
    takeHandlerAck(ack,sequencer,thread){
        const record=handlerAcks.get(ack);if(!record)return false;
        handlerAcks.delete(ack);
        return record.sequencer===sequencer&&record.thread===thread&&
            handlerCurrent(record.handler,sequencer.runtime,thread)&&record.handler.phase==='catch'&&
            thread.stack===record.stack&&thread.stackFrames===record.frames&&
            thread.stack.length===record.handler.prefix.length+1&&thread.stackFrames.length===thread.stack.length&&
            thread.peekStack()===record.handler.branches[1].id&&thread.peekStackFrame()===record.bodyFrame&&
            record.handler.cells===record.cells&&thread.status===thread.constructor.STATUS_RUNNING&&
            thread.justReported===null&&record.bodyFrame.justReported===null&&record.bodyFrame.reported===null&&
            record.bodyFrame.waitingReporter===null&&record.bodyFrame.params===null&&record.bodyFrame.reporting===''&&
            record.handler.frame.justReported===null&&record.handler.frame.reported===null&&
            record.handler.frame.waitingReporter===null&&record.handler.frame.reporting==='';
    },
    invalidateThread,
    invalidateFrame
});
