// Stable function identities are published before dependency evaluation. No
// failure routing call is made until all three cyclic modules finish loading.
const failureApply=Reflect.apply,failureFreeze=Object.freeze;
const failureDescriptor=Object.getOwnPropertyDescriptor,failureOwn=Object.hasOwn;
const failureError=Error,failureErrorInstance=Function.prototype[Symbol.hasInstance];
const nativeWeakGet=WeakMap.prototype.get,nativeWeakSet=WeakMap.prototype.set;
const nativeWeakHas=WeakMap.prototype.has,nativeWeakDelete=WeakMap.prototype.delete;
const nativeSetAdd=WeakSet.prototype.add,nativeSetHas=WeakSet.prototype.has;
const failureGet=(map,key)=>failureApply(nativeWeakGet,map,[key]);
const failureSet=(map,key,value)=>failureApply(nativeWeakSet,map,[key,value]);
const failureHas=(map,key)=>failureApply(nativeWeakHas,map,[key]);
const failureDelete=(map,key)=>failureApply(nativeWeakDelete,map,[key]);
const signalAdd=(set,key)=>failureApply(nativeSetAdd,set,[key]);
const signalHas=(set,key)=>failureApply(nativeSetHas,set,[key]);
module.exports=failureFreeze({__proto__:null,rejectConditionWait,create,consume,failed,capture,stale,diagnostic,reported,arrayCoordinatorReady,rejectArrayOperation,attachArrayCoordinator});
const primitiveOwner = require('./bw-primitive-owner');
const cachedPrimitiveOwner = require('./bw-cached-primitive-owner');
const consumeArrayFailureLease=require('./bw-array-operations').consumeFailureLease;

// Neither an Error property nor a serialized value can grant exceptional
// completion. Only the current primitive may issue a signal for this runtime.
const owners = new WeakMap();
const coordinatorControls = new WeakMap();
const signals = new WeakMap();
const publishedSignals = new WeakSet();
const failedThreads = new WeakMap();
const promiseLeases = new WeakMap();
const callerLeases = new WeakMap();
// Identity is private to this coordinator, never a public completion flag.
const computationMarker=failureFreeze({__proto__:null});

function failureStack(thread) {
    const saved=[];for(let i=0;i<thread.stack.length;i++)saved[i]=thread.stack[i];
    return failureFreeze(saved);
}
function create(runtime, readValue, consumePhysicalUpdate = null) {
    if (!runtime || typeof runtime.on !== 'function' || !Array.isArray(runtime.targets)) {
        return Object.freeze({raise() {throw new Error('Arcade Throw requires a bound runtime');},
            rejectConstraint() {throw new Error('Arcade constraint rejection requires a bound runtime');},
            rejectArrayOperation() {throw new Error('Array operation rejection requires a bound runtime');},
            arrayReady:()=>false,
            failure: () => null, captureCaller:()=>null,releaseCaller() {}, rethrow() {}, dispose() {}});
    }
    if (!failureHas(owners,runtime)) createCoordinator(runtime);
    return failureGet(coordinatorControls,runtime).claim(readValue,consumePhysicalUpdate);
}

// Arrays and Arcade share failure lineage, not extension capabilities. The core
// is installed before PROJECT_START by an admitted extension construction.
function createCoordinator(runtime) {
    let active = false, disposed = false, generation = 0;
    let failures = new WeakMap(), edges = new WeakMap();
    let readValue = null, consumePhysicalUpdate = null, arcadeClaim = null;
    const attachments = new WeakMap();
    let attachmentCount = 0, invocation = null;
    const invocationCurrent = () => invocation === null ||
        (!disposed && arcadeClaim === invocation.token && generation === invocation.generation);
    const setCurrent = (map,key,value) => {
        if (!invocationCurrent()) throw new Error('Arcade exception owner is disposed');
        return failureSet(map,key,value);
    };
    const live = thread => {
        const observedGeneration = generation;
        const result = active && !disposed && invocationCurrent() && runtime.threads?.includes(thread) && !thread.isKilled &&
            thread.status!==thread.constructor.STATUS_DONE && thread.stack?.length>0 &&
            runtime.targets.includes(thread.target) && thread.blockContainer === thread.target.blocks;
        return result && active && !disposed && generation === observedGeneration && invocationCurrent();
    };
    const failure = thread => failureGet(failures,thread) || null;
    const owned = signal => failureGet(signals,signal)?.runtime === runtime;
    const listeners = new Map();
    const listen = (event, handler) => {listeners.set(event, handler);runtime.on(event, handler);};
    const cancel = () => {active = false;generation++;};
    const retireLineage = (thread,signal,preserveOriginal=false) => {
        // Mark the complete actual lineage before any cleanup can settle
        // a pending operation. A detached event has no implicit parent.
        if (!invocationCurrent()) throw new Error('Arcade exception owner is disposed');
        const retirementFailures = failures, retirementEdges = edges;
        const lineage = [];
        for (let current = thread; current && !failureHas(retirementFailures,current);) {
            failureSet(retirementFailures,current, signal);failureSet(failedThreads,current, {runtime, signal});lineage[lineage.length]=current;
            const edge = failureGet(retirementEdges,current);
            current = edge?.generation === generation ? edge.caller : null;
        }
        try {
            const cleanupErrors = [];
            for (let index=0;index<lineage.length;index++) {
                const current=lineage[index];
                const edge = failureGet(retirementEdges,current);failureDelete(retirementEdges,current);
                try {edge?.cleanup(signal);} catch (error) {cleanupErrors[cleanupErrors.length]=error;}
                finally {runtime.sequencer.retireThread(current);}
            }
            if (cleanupErrors.length) {
                if(preserveOriginal){
                    const record=failureGet(signals,signal);
                    failureSet(signals,signal,failureFreeze({...record,cleanupErrors:failureFreeze(cleanupErrors)}));
                }else signal.cause = new AggregateError(cleanupErrors, 'Arcade invocation cleanup failed');
            }
            runtime.emit('BLOCKS_ERROR', signal);
            signalAdd(publishedSignals,signal);
        } finally {throw signal;}
    };
    const owner = Object.freeze({
        failure,
        // Object construction and SDK class procedures may resume a caller
        // after an earlier managed call; only their actual cached primitive
        // invocation can retain that caller.
        captureCaller(args,util,opcode='arcade_createObject') {
            if (!arcadeClaim || !live(util?.thread) || !['arcade_createObject','arcade_callFunction'].includes(opcode)) return null;
            if (!cachedPrimitiveOwner(runtime,util,args,opcode,[])) return null;
            const lease=Object.freeze({});
            setCurrent(callerLeases,lease,{owner,thread:util.thread,frame:util.thread.peekStackFrame(),generation});
            return lease;
        },
        releaseCaller(lease) {if(lease) failureDelete(callerLeases,lease);},
        capture(thread) {
            if (!live(thread) || runtime.sequencer.activeThread !== thread) return null;
            const observedGeneration = generation;
            const lease=Object.freeze({}), frame=thread.peekStackFrame();
            if (generation !== observedGeneration || !active || disposed || !invocationCurrent()) return null;
            setCurrent(promiseLeases,lease,{owner,runtime,thread,frame,generation});
            return lease;
        },
        current(lease) {
            const record=failureGet(promiseLeases,lease);
            return !!(record && record.owner===owner && record.generation===generation &&
                live(record.thread) && record.thread.stackFrames.includes(record.frame) &&
                record.generation===generation && active && !disposed && invocationCurrent());
        },
        rethrow(error) {if (owned(error)) throw error;},
        link(child, caller, cleanup = () => {}, lease = null) {
            const record=lease && failureGet(callerLeases,lease);
            const retained=record?.owner===owner && record.thread===caller && record.generation===generation &&
                caller.stackFrames.includes(record.frame);
            if (!live(child) || !live(caller) || child === caller || (!retained && runtime.sequencer.activeThread !== caller) ||
                child.target !== caller.target || typeof cleanup !== 'function' || failureHas(edges,child)) {
                throw new Error('Arcade exception edge requires an actual managed call');
            }
            for (let parent = caller; parent; parent = failureGet(edges,parent)?.caller) {
                if (parent === child) throw new Error('Cyclic Arcade exception edge');
            }
            const edge = {caller, cleanup, generation};
            setCurrent(edges,child, edge);
            return () => {if (failureGet(edges,child) === edge) failureDelete(edges,child);};
        },
        linkPhysicalUpdate(child,args,util,cleanup) {
            // This consumer is captured by the actual extension constructor.
            // Neither a missing caller nor public tags can mint a root edge.
            if (!live(child) || util?.thread!==undefined || typeof cleanup!=='function' || failureHas(edges,child) ||
                !arcadeClaim || typeof consumePhysicalUpdate!=='function')
                throw new Error('Arcade physical update requires its private current entry');
            const witness=consumePhysicalUpdate(child,args,util);
            if (!witness || witness.target!==child.target || !live(child))
                throw new Error('Arcade physical update requires its private current entry');
            const edge={caller:null,cleanup,generation};
            setCurrent(edges,child,edge);
            return ()=>{if(failureGet(edges,child)===edge)failureDelete(edges,child);};
        },
        raise(args, util) {
            const thread = util?.thread;
            const block = primitiveOwner.current(util, args);
            if (!arcadeClaim || !live(thread) || util.runtime !== runtime || block?.opcode !== 'arcade_throwValue') {
                throw new Error('Arcade Throw requires its current physical primitive');
            }
            // Read while the actual primitive's Number-input loan is live.
            const value = readValue(args, util);
            if (value!==null && !['undefined','boolean','number','string'].includes(typeof value)) {
                throw new Error('Arcade Throw currently requires a primitive thrown value');
            }
            const signal = new Error('Arcade uncaught thrown value: ' + String(value));
            const record = Object.freeze({owner, runtime, generation, value, target: thread.target,
                block: block.id, stack: Object.freeze([...thread.stack])});
            setCurrent(signals,signal, record);
            retireLineage(thread,signal);
        },
        arrayReady() {return active&&!disposed;},
        rejectArrayOperation(args,util,error,lease,failureBlock) {
            const thread=util?.thread;
            if(failureGet(signals,error)?.runtime===runtime&&failure(thread)===error)throw error;
            if(failureHas(signals,error))throw error;
            const message=failureApply(failureErrorInstance,failureError,[error])&&failureDescriptor(error,'message');
            if(!message||!failureOwn(message,'value')||typeof message.value!=='string')throw Error('Array operation rejection requires its private Error');
            const prior=failure(thread);if(prior)throw prior;
            // A graph/cache/registration change may itself require rejection.
            // The unforgeable lease validates the original still-active call,
            // not the now-invalid source metadata. No other Error is adopted.
            if(!live(thread)||util.runtime!==runtime)throw Error('Array operation rejection requires its private failure lease');
            const witness=consumeArrayFailureLease(runtime,args,util,error,lease,failureBlock,computationMarker);
            if(!witness)throw Error('Array operation rejection requires its private failure lease');
            // Only a consumed private computation lease can return this module's
            // marker. Public Error fields or completion flags cannot select adoption.
            const marker=failureDescriptor(witness,'computationMarker');
            const computation=!!(marker&&failureOwn(marker,'value')&&marker.value===computationMarker);
            const signal=computation?error:new failureError(message.value,{cause:error});
            setCurrent(signals,signal,failureFreeze({owner,runtime,generation,kind:computation?'array-computation':'array-constraint',message:message.value,target:thread.target,block:witness.block,stack:failureStack(thread)}));
            retireLineage(thread,signal,computation);
        },
        rejectPrimitiveFault(args,util,error,lease) {
            const thread=util?.thread;
            if(failureHas(signals,error))throw error;
            const prior=failure(thread);if(prior)throw prior;
            if(!live(thread)||util.runtime!==runtime)throw Error('Primitive fault requires its live actual caller');
            const witness=require('./bw-null-sprite-getter').consume(runtime,args,util,error,lease);
            if(!witness)throw Error('Primitive fault requires its private current receipt');
            // Preserve the actual privately issued Error, never a public
            // Error tag or copied message. Shared lineage cleanup is unchanged.
            setCurrent(signals,error,Object.freeze({owner,runtime,generation,kind:'primitive-fault',message:error.message,
                property:witness.property,target:thread.target,block:witness.block,stack:Object.freeze([...thread.stack])}));
            retireLineage(thread,error);
        },
        rejectConditionWait(thread,error) {
            const witness=require('./bw-source-condition-waits').consumeFailure(runtime,thread,error);
            if(!arcadeClaim || !witness || !live(thread))throw Error('Source condition rejection requires its private current wait');
            const signal=new Error(error.message,{cause:error});
            setCurrent(signals,signal,Object.freeze({owner,runtime,generation,kind:'condition-wait',message:error.message,
                target:thread.target,block:witness.block,stack:Object.freeze([...thread.stack])}));
            retireLineage(thread,signal);
        },
        rejectConstraint(args,util,error) {
            const thread=util?.thread,priorIssued=failureGet(signals,error);
            if(priorIssued?.runtime===runtime&&failure(thread)===error)throw error;
            const block=primitiveOwner.current(util,args);
            if(!live(thread)||util.runtime!==runtime||!['procedures_call','arcade_callFunction','arcade_setLocal','arcade_setCaptured','arcade_sourceValueBinary','arcade_sourceValueUnary'].includes(block?.opcode))
                throw new Error('Arcade constraint rejection requires its actual current primitive');
            cachedPrimitiveOwner(runtime,util,args,block.opcode,[]);
            // Existing issued failures never become a second failure or acquire
            // another runtime's ownership through this entry point.
            if(failureHas(signals,error))throw error;
            const message=error instanceof Error&&Object.getOwnPropertyDescriptor(error,'message');
            if(!message||!Object.prototype.hasOwnProperty.call(message,'value')||typeof message.value!=='string')
                throw new Error('Arcade constraint rejection requires an actual Error diagnostic');
            const prior=failure(thread);if(prior)throw prior;
            const signal=new Error(message.value,{cause:error});
            setCurrent(signals,signal,Object.freeze({owner,runtime,generation,kind:'constraint',message:message.value,
                target:thread.target,block:block.id,stack:Object.freeze([...thread.stack])}));
            retireLineage(thread,signal);
        },
        dispose() {
            if (disposed) return;
            cancel();disposed = true;
            for (const [event, listener] of listeners) runtime.off(event, listener);
            listeners.clear();
            if (failureGet(owners,runtime) === owner) {
                failureDelete(owners,runtime);failureDelete(coordinatorControls,runtime);
            }
            // Keep weak tombstones for promises already registered by this
            // owner. A new project must never revive their continuations.
        }
    });
    const controls = failureFreeze({
        claim(valueReader, physicalUpdate) {
            if (disposed || arcadeClaim) throw new Error('Arcade exception runtime already has an owner');
            const token = failureFreeze({});
            arcadeClaim = token;readValue = valueReader;consumePhysicalUpdate = physicalUpdate;
            const claimFailures = failures;
            const current = () => !disposed && arcadeClaim === token;
            const requireClaim = () => {
                if (!current()) throw new Error('Arcade exception owner is disposed');
            };
            const invoke = (method,args) => {
                requireClaim();
                const previous = invocation;
                invocation = {token,generation};
                try {return failureApply(owner[method],owner,args);}
                finally {invocation = previous;}
            };
            // A retired facet cannot acquire a later claim's capabilities. Read
            // only failure/rethrow observations retain their original tombstones.
            return failureFreeze({
                failure: thread => failureGet(claimFailures,thread) || null,
                rethrow: owner.rethrow,
                captureCaller(...args) {if (!current()) return null;return invoke('captureCaller',args);},
                releaseCaller(lease) {if (current()) owner.releaseCaller(lease);},
                capture(thread) {return current() ? invoke('capture',[thread]) : null;},
                current(lease) {return current() && owner.current(lease);},
                link(...args) {return invoke('link',args);},
                linkPhysicalUpdate(...args) {return invoke('linkPhysicalUpdate',args);},
                raise(...args) {return invoke('raise',args);},
                arrayReady() {return current() && owner.arrayReady();},
                rejectArrayOperation(...args) {return invoke('rejectArrayOperation',args);},
                rejectPrimitiveFault(...args) {return invoke('rejectPrimitiveFault',args);},
                rejectConditionWait(...args) {return invoke('rejectConditionWait',args);},
                rejectConstraint(...args) {return invoke('rejectConstraint',args);},
                dispose() {
                    if (!current()) return;
                    cancel();arcadeClaim = null;readValue = null;consumePhysicalUpdate = null;
                    failures = new WeakMap();edges = new WeakMap();
                    if (attachmentCount === 0) owner.dispose();
                }
            });
        },
        attach(binding) {
            if (disposed) throw new Error('Array exception coordinator is disposed');
            const prior = failureGet(attachments,binding);
            if (prior) return prior;
            let attached = true;
            const release = () => {
                if (!attached) return;
                attached = false;failureDelete(attachments,binding);attachmentCount--;
                if (attachmentCount === 0 && !arcadeClaim) owner.dispose();
            };
            failureSet(attachments,binding,release);attachmentCount++;
            return release;
        }
    });
    failureSet(coordinatorControls,runtime,controls);
    failureSet(owners,runtime, owner);
    listen('PROJECT_START', () => {generation++;if (!disposed) active = true;});
    listen('PROJECT_STOP_ALL', cancel);
    listen('PROJECT_LOADED', cancel);
    listen('RUNTIME_DISPOSED', owner.dispose);
    return owner;
}

// Engine hooks consume only privately issued signals for this exact thread.
// A stale signal is still recognized so it cannot enter Scratch's ordinary
// rejection path and resume an old thread after Stop/Start.
function consume(runtime, thread, error) {
    return Boolean(failureGet(signals,error)?.runtime === runtime && failureGet(failedThreads,thread)?.signal === error);
}
function failed(runtime, thread) {return failureGet(failedThreads,thread)?.runtime === runtime;}
function capture(runtime,thread) {return failureGet(owners,runtime)?.capture(thread) || null;}
function diagnostic(runtime,error) {
    const record=failureGet(signals,error);
    if(record?.runtime===runtime&&record.kind==='array-computation')return failureFreeze({kind:record.kind,message:record.message,block:record.block,target:record.target.id,cleanupFailureCount:record.cleanupErrors?.length||0});
    return record?.runtime===runtime ? ['constraint','array-constraint','condition-wait','primitive-fault'].includes(record.kind) ? Object.freeze({kind:record.kind,message:record.message,block:record.block,target:record.target.id}) : Object.freeze({value:record.value,block:record.block,target:record.target.id}) : null;
}
// A copied message or privately issued but unpublished signal is insufficient.
// This is a read-only publication fact, never an activation or exception loan.
function reported(runtime,error) {
    return failureGet(signals,error)?.runtime===runtime && signalHas(publishedSignals,error);
}
function stale(runtime,thread,lease) {
    if (failed(runtime,thread)) return true;
    if (lease===null) return false; // Ordinary Scratch, no active Arcade owner.
    const record=failureGet(promiseLeases,lease);
    return !record || record.runtime!==runtime || record.thread!==thread || !record.owner.current(lease);
}

function arrayCoordinatorReady(runtime) {return !!failureGet(owners,runtime)?.arrayReady();}
function rejectArrayOperation(runtime,args,util,error,lease,failureBlock) {const owner=failureGet(owners,runtime);if(!owner)throw Error('Array operation rejection requires a shared exception owner');return owner.rejectArrayOperation(args,util,error,lease,failureBlock);}
function rejectConditionWait(runtime,thread,error) {
    const owner=failureGet(owners,runtime);
    if(!owner)throw Error('Source condition rejection requires the current Arcade exception owner');
    return owner.rejectConditionWait(thread,error);
}

// Called only by the admitted native Array binding. The release closure remains
// in that binding's lifecycle and grants no Arcade reader or invocation facet.
function attachArrayCoordinator(runtime,binding) {
    if (!failureHas(owners,runtime)) createCoordinator(runtime);
    return failureGet(coordinatorControls,runtime).attach(binding);
}
