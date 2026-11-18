// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// Engine execution identity, not handler-entry or exception-consumption
// authority. Only the actual execute wrapper issues an entry; frame mutators
// and run cancellation invalidate it even when pooled object identity survives.
const runtimes=new WeakMap(),entries=new WeakMap(),threads=new WeakMap(),frames=new WeakMap();
const frameLeases=new WeakMap(),frameLives=new WeakMap();
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
    invalidateThread,
    invalidateFrame
});
