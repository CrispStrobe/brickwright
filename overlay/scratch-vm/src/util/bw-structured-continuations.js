// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const createCompletions = require('./bw-structured-completions');

// Disabled-runtime preview seam. The trusted coordinator supplies current
// thread/frame and private managed-caller observations. A preview plan is NOT
// an exception-consumption signal and must not suppress terminal retirement.
// This module never steps a thread, executes a body or mutates a VM stack.
module.exports = function createStructuredContinuations (current, parentOf) {
    if (typeof current !== 'function' || typeof parentOf !== 'function') {
        throw new Error('Structured continuations require private ownership observations');
    }
    const completions = createCompletions(), bindings = new WeakMap(), byThread = new WeakMap();
    const plans = new WeakMap();
    const active = new Set();
    let running = false, epoch = 0;
    const live = binding => Boolean(binding && running && active.has(binding) &&
        binding.epoch === epoch && completions.current(binding.invocation) &&
        current(binding.thread,binding.frame));
    const bindingOf = invocation => {
        const binding = bindings.get(invocation);
        if (!live(binding)) throw new Error('Structured continuation requires its current actual frame');
        return binding;
    };
    const cancel = binding => {
        if (!active.has(binding)) return;
        completions.cancelInvocation(binding.invocation);
        active.delete(binding);byThread.get(binding.thread)?.delete(binding.frame);
        binding.boundaries.length=0;binding.suspension=null;binding.revision++;
    };
    const stop = () => {
        for (const binding of active) cancel(binding);
        completions.stop();running=false;epoch++;
    };
    const valid = plan => running && plan.epoch === epoch &&
        current(plan.origin.thread,plan.origin.frame,true) && plan.path.every(point => {
        if(!current(point.thread,point.frame))return false;
        if(!point.next)return true;
        const next=parentOf(point.thread,point.frame);
        return next?.thread===point.next.thread && next.frame===point.next.frame;
    }) && plan.observed.every(item =>
        live(item.binding) && item.binding.revision === item.revision &&
        item.binding.boundaries.length === item.depth) &&
        plan.binding.boundaries.at(-1) === plan.boundary;
    return Object.freeze({
        start () {stop();completions.start();running=true;},
        stop,
        current (invocation) {return live(bindings.get(invocation));},
        retire (thread) {
            const frames=byThread.get(thread);
            if(frames)for(const binding of frames.values())cancel(binding);
        },
        begin (thread, frame) {
            if (!running || !current(thread,frame)) throw new Error('Structured entry requires its actual current frame');
            let frames=byThread.get(thread);if(!frames){frames=new Map();byThread.set(thread,frames);}
            if (frames.has(frame)) throw new Error('Structured actual frame already has an invocation');
            const invocation=completions.beginInvocation();
            const binding={invocation,thread,frame,epoch,revision:0,boundaries:[],suspension:null};
            bindings.set(invocation,binding);frames.set(frame,binding);active.add(binding);
            return invocation;
        },
        enter (invocation, catchEntry=null, finallyEntry=null) {
            const binding=bindingOf(invocation);
            const frame=completions.enterTry(invocation,catchEntry,finallyEntry);
            binding.boundaries.push({frame,phase:'try',catchEntry,finallyEntry});binding.revision++;
            return frame;
        },
        complete (invocation, frame, kind, value=undefined) {
            const binding=bindingOf(invocation), boundary=binding.boundaries.at(-1);
            if (!boundary || boundary.frame !== frame) throw new Error('Structured completion requires its innermost handler');
            // This bridge seam only forwards normal/return/throw. Lexical jump
            // targets stay in the detached foundation until compiler binding.
            if (!['normal','return','throw'].includes(kind)) throw new Error('Structured bridge jump targets are not bound');
            const record=completions.completion(invocation,kind,value);
            const result=completions.finish(invocation,frame,record);
            binding.revision++;
            if(result.kind==='complete')binding.boundaries.pop();else boundary.phase=result.kind;
            return result;
        },
        describe (invocation, record) {bindingOf(invocation);return completions.describe(invocation,record);},
        suspend (invocation) {
            const binding=bindingOf(invocation), lease=completions.suspend(invocation);
            binding.suspension=lease;binding.revision++;return lease;
        },
        resume (invocation, lease) {
            const binding=bindings.get(invocation);
            if(!live(binding) || binding.suspension!==lease || !completions.resume(invocation,lease))return false;
            binding.suspension=null;binding.revision++;return true;
        },
        close (invocation) {const binding=bindings.get(invocation);if(live(binding))cancel(binding);},
        offerOwnedThrow (thread, frame, signal, value) {
            // Called only AFTER the exception coordinator validates its actual
            // primitive and stores its privately issued signal, BEFORE retirement.
            if (!running || !current(thread,frame,true)) return null;
            const seen=new WeakMap(),observed=[],path=[];
            let cursor={thread,frame};
            for(let remaining=64;cursor&&remaining>0;remaining--){
                let visited=seen.get(cursor.thread);if(!visited){visited=new Set();seen.set(cursor.thread,visited);}
                if(visited.has(cursor.frame) || !current(cursor.thread,cursor.frame))return null;
                visited.add(cursor.frame);
                const point={thread:cursor.thread,frame:cursor.frame,next:null};path.push(point);
                const binding=byThread.get(cursor.thread)?.get(cursor.frame);
                if(binding){
                    if(!live(binding))return null;
                    observed.push({binding,revision:binding.revision,depth:binding.boundaries.length});
                    // An inner running finalizer may not be skipped: completing
                    // it can replace this throw. No plan until that lowering exists.
                    const boundary=binding.boundaries.at(-1);
                    if(boundary){
                        if(boundary.phase==='finally')return null;
                        const kind=boundary.phase==='try'&&boundary.catchEntry!==null?'catch':
                            boundary.finallyEntry!==null?'finally':null;
                        if(!kind)return null; // needs explicit unwind through this boundary
                        const plan=Object.freeze(Object.create(null));
                        const record={epoch,signal,value,binding,boundary,kind,observed,path,origin:{thread,frame}};
                        if(!valid(record))return null;
                        plans.set(plan,record);return plan;
                    }
                }
                // Only the coordinator's actual managed-call edge is used.
                // Merely sharing a target, event token or public caller tag is insufficient.
                cursor=parentOf(cursor.thread,cursor.frame);point.next=cursor;
            }
            return null;
        },
        inspectPlan (plan, signal) {
            const record=plans.get(plan);
            if(!record || record.signal!==signal || !valid(record))return null;
            return Object.freeze({invocation:record.binding.invocation,frame:record.boundary.frame,
                kind:record.kind,body:record.kind==='catch'?record.boundary.catchEntry:record.boundary.finallyEntry,
                value:record.value});
        },
        takePlan (plan, signal) {
            // One-use preview data only. The caller still needs a separately
            // qualified physical continuation commit; this does not consume an
            // engine exception, complete a frame, or authorize skipping retirement.
            const record=plans.get(plan);
            if(!record || record.signal!==signal || !valid(record))return null;
            plans.delete(plan);
            return Object.freeze({invocation:record.binding.invocation,frame:record.boundary.frame,
                kind:record.kind,body:record.kind==='catch'?record.boundary.catchEntry:record.boundary.finallyEntry,
                value:record.value});
        }
    });
};
