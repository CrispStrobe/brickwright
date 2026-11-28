// Only emitted registration primitives may issue experimental event cells.
const registeredCaptureOpcodes=new Set([
    'arcade_registerSpriteCreated',
    'arcade_registerWallHandler',
    'arcade_registerLegacyWallHandler',
    'arcade_registerTileHandler',
    'arcade_registerTilemapEvent',
    'arcade_registerUpdateHandler',
    'arcade_registerIntervalHandler',
    'arcade_registerButtonHandler',
    'arcade_registerPlayerButtonHandler',
    'arcade_registerMultiplayerButtonHandler',
    'arcade_registerControlEvent',
    'arcade_registerMultiplayerConnection',
    'arcade_registerDestroyedHandler',
    'arcade_registerOverlapHandler',
    'arcade_registerLifeZeroHandler',
    'arcade_registerCountdownHandler',
    'arcade_registerScenePushHandler',
    'arcade_registerScenePopHandler',
    'arcade_registerScoreHandler',
    'arcade_registerParallelHandler',
    'arcade_registerForeverHandler',
]);
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
module.exports=failureFreeze({__proto__:null,rejectConditionWait,create,createStructuredPreview,createStructuredEngine,consume,failed,capture,stale,diagnostic,reported,arrayCoordinatorReady,rejectArrayOperation,attachArrayCoordinator});
const primitiveOwner = require('./bw-primitive-owner');
const cachedPrimitiveOwner = require('./bw-cached-primitive-owner');
const consumeArrayFailureLease=require('./bw-array-operations').consumeFailureLease;
const engineActivations=require('./bw-engine-activations');

// Neither an Error property nor a serialized value can grant exceptional
// completion. Only the current primitive may issue a signal for this runtime.
const owners = new WeakMap();
const coordinatorControls = new WeakMap();
const signals = new WeakMap();
const publishedSignals = new WeakSet();
const failedThreads = new WeakMap();
const promiseLeases = new WeakMap();
const callerLeases = new WeakMap();
const managedSignals = new WeakMap();
// Identity is private to this coordinator, never a public completion flag.
const computationMarker=failureFreeze({__proto__:null});

function failureStack(thread) {
    const saved=[];for(let i=0;i<thread.stack.length;i++)saved[i]=thread.stack[i];
    return failureFreeze(saved);
}
function create(runtime, readValue, consumePhysicalUpdate = null) {
    return claimRuntime(runtime,readValue,consumePhysicalUpdate,false);
}
// Explicit experimental inspection seam. The extension constructor still calls
// create(), never this entry. Previewing a continuation cannot consume a throw,
// bypass retirement or enable parser support; there is no sequencer commit yet.
function createStructuredPreview(runtime, readValue, consumePhysicalUpdate = null) {
    return claimRuntime(runtime,readValue,consumePhysicalUpdate,true);
}
// Disabled executable-boundary seam. The extension continues to use create;
// preview remains terminal. No parser/control registration selects this seam.
function createStructuredEngine(runtime, readValue, consumePhysicalUpdate = null) {
    return claimRuntime(runtime,readValue,consumePhysicalUpdate,'engine');
}
function claimRuntime(runtime, readValue, consumePhysicalUpdate, structuredPreview) {
    if (!runtime || typeof runtime.on !== 'function' || !Array.isArray(runtime.targets)) {
        return Object.freeze({raise() {throw new Error('Arcade Throw requires a bound runtime');},
            rejectConstraint() {throw new Error('Arcade constraint rejection requires a bound runtime');},
            rejectArrayOperation() {throw new Error('Array operation rejection requires a bound runtime');},
            arrayReady:()=>false,
            failure: () => null, captureCaller:()=>null,releaseCaller() {}, rethrow() {}, dispose() {}});
    }
    if (!failureHas(owners,runtime)) createCoordinator(runtime);
    return failureGet(coordinatorControls,runtime).claim(readValue,consumePhysicalUpdate,structuredPreview);
}

// Arrays and Arcade share failure lineage, not extension capabilities. The core
// is installed before PROJECT_START by an admitted extension construction.
function createCoordinator(runtime) {
    let active = false, disposed = false, generation = 0;
    let failures = new WeakMap(), edges = new WeakMap();
    let readValue = null, consumePhysicalUpdate = null, arcadeClaim = null;
    const attachments = new WeakMap();
    let attachmentCount = 0, invocation = null;
    let structuredBridge = null, structuredEngine = false;
    const throwRoutes = new WeakMap();
    const stagedThrows = new WeakMap(), managedTransfers = new WeakMap(),managedEdgeKey=failureFreeze({});
    let structuredObservations = new WeakMap();
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
    const cancel = () => {structuredBridge?.stop();active = false;generation++;};
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
                finally {structuredBridge?.retire(current);runtime.sequencer.retireThread(current);}
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
    // Freeze every existing edge before any finalizer or cleanup can replace it.
    // A later hop may consume only the retained suffix, never discover a new link.
    const captureRoute = thread => {
        const route=[];
        for(let current=thread;failureHas(edges,current);){
            const edge=failureGet(edges,current);
            if(edge.generation!==generation||!edge.caller||!edge.frameLease||
                !engineActivations.validFrame(edge.frameLease,runtime,edge.caller,edge.structuredFrame)||
                !engineActivations.valid(edge.activation,runtime.sequencer,edge.caller))return null;
            route.push(failureFreeze({thread:current,edge}));current=edge.caller;
        }
        return failureFreeze(route);
    };
    const routeCurrent = route => {
        const epoch=generation;
        const valid=!!route&&route.every(point=>
            failureGet(edges,point.thread)===point.edge&&point.edge.generation===generation&&
            engineActivations.validFrame(point.edge.frameLease,runtime,point.edge.caller,point.edge.structuredFrame)&&
            engineActivations.valid(point.edge.activation,runtime.sequencer,point.edge.caller));
        return valid&&epoch===generation&&active&&!disposed&&invocationCurrent();
    };
    const stageEscape = (thread,signal,origin=null,completionToken=null) => {
        const route=failureGet(throwRoutes,signal);
        if(!route?.length||route[0].thread!==thread||!routeCurrent(route))return false;
        failureSet(stagedThrows,signal,{thread,signal,origin,completionToken,route,generation,escape:true});
        return true;
    };
    const owner = Object.freeze({
        failure,
        consumeStaged(thread,signal) {
            const staged=failureGet(stagedThrows,signal);
            if(!staged||staged.thread!==thread)return false;
            failureDelete(stagedThrows,signal);
            // Stop/restart tombstones absorb the old signal without retiring a
            // possibly reused thread in a new run. They grant no transfer.
            if(staged.generation!==generation||!active||disposed)return true;
            let accepted=false;
            try {
                if(staged.escape){
                    const {route}=staged,edge=route[0].edge;
                    const receipt=routeCurrent(route)&&engineActivations.commitManagedEscape(
                        staged.origin,staged.completionToken,runtime.sequencer,thread,signal);
                    if(receipt&&engineActivations.takeManagedEscape(receipt,runtime.sequencer,thread)){
                        edge.cleanup(signal);
                        if(routeCurrent(route)&&generation===staged.generation&&active&&!disposed){
                            const remaining=failureFreeze(route.slice(1));
                            failureSet(throwRoutes,signal,remaining);
                            failureSet(managedTransfers,thread,failureFreeze({owner,runtime,thread,
                                caller:edge.caller,activation:edge.activation,signal,generation,route:remaining,relay:true}));
                            failureDelete(edges,thread);runtime.sequencer.retireThread(thread);accepted=true;
                        }
                    }
                }else{
                    const originCurrent=engineActivations.valid(staged.origin,runtime.sequencer,thread);
                    const ack=originCurrent&&engineActivations.commitHandlerTransfer(
                        staged.request,runtime.sequencer,thread,staged.origin);
                    accepted=!!ack&&engineActivations.takeHandlerAck(ack,runtime.sequencer,thread);
                }
            }catch { /* The original owned signal is the only terminal fallback. */ }
            if(accepted)return true;
            // Metadata and managed cleanup are callouts. A run invalidated
            // during them must not publish an old failure into the new run.
            if(staged.generation!==generation||!active||disposed)return true;
            try {retireLineage(thread,signal,true);}catch(error){if(error!==signal)throw error;}
            return true;
        },
        takeManagedTransfer(thread,caller) {
            const record=failureGet(managedTransfers,thread);
            if(!record||record.caller!==caller)return null;
            failureDelete(managedTransfers,thread);
            // An actual pending call receives a distinct private settlement,
            // never a normal value or an ordinary rejection diagnostic.
            const transport=new Error('Arcade managed handler transfer');
            failureSet(managedSignals,transport,record);return transport;
        },
        consumeManaged(thread,transport) {
            const record=failureGet(managedSignals,transport);
            if(!record||record.owner!==owner||record.caller!==thread)return false;
            failureDelete(managedSignals,transport);
            if(disposed||!active||record.generation!==generation)return true;
            try{
                if(record.relay&&routeCurrent(record.route)&&engineActivations.valid(record.activation,runtime.sequencer,thread)){
                    const value=failureGet(signals,record.signal).value;
                    const request=engineActivations.prepareOwnedThrow(record.activation,value,record.signal);
                    if(request){
                        const ack=engineActivations.commitHandlerTransfer(request,runtime.sequencer,thread,record.activation);
                        if(ack&&engineActivations.takeHandlerAck(ack,runtime.sequencer,thread))return true;
                    }else if(stageEscape(thread,record.signal,record.activation)){
                        owner.consumeStaged(thread,record.signal);return true;
                    }
                }
            }catch { /* Retain the exact original owned Error on any refusal. */ }
            if(disposed||!active||record.generation!==generation)return true;
            try {retireLineage(thread,record.signal,true);}catch(error){if(error!==record.signal)throw error;}
            return true;
        },
        captureStructuredLocals(args,util){
            if(!structuredEngine)return null;
            if(!live(util?.thread)||primitiveOwner.current(util,args)?.opcode!=='arcade_createCallable')throw Error('Catch capture requires its actual create primitive');
            cachedPrimitiveOwner(runtime,util,args,'arcade_createCallable',[]);
            return engineActivations.captureCatchProvider(engineActivations.capture(runtime.sequencer,util.thread));
        },
        captureStructuredRegistration(args,util,captures){
            if(!structuredEngine)return captures;
            const opcode=primitiveOwner.current(util,args)?.opcode;
            if(!live(util?.thread)||!registeredCaptureOpcodes.has(opcode))throw Error('Event capture requires its actual registration primitive');
            cachedPrimitiveOwner(runtime,util,args,opcode,[]);
            const origin=engineActivations.capture(runtime.sequencer,util.thread);
            const provider=engineActivations.captureCatchProvider(origin),map=new Map(captures);
            if(!provider)throw Error('Event capture requires its registration execution');
            for(const name of String(args.CAPTURES||'').split(/\s+/).filter(Boolean)){
                const inherited=util.thread.bwArcadeCaptures?.get(name);
                const cell=provider.cell(name)||(provider.read(inherited)?inherited:null);if(cell)map.set(name,cell);
            }
            const token=String(args.TOKEN);
            cachedPrimitiveOwner(runtime,util,args,opcode,[]);
            return engineActivations.registerCatchMap(origin,map,token);
        },
        bindStructuredRegistration(registration,thread){
            if(!structuredEngine)return;
            return engineActivations.bindRegisteredCatch(runtime,thread,registration.captures,registration.token);
        },
        captureStructuredInvocation(args,util,provider,map,opcode='arcade_callCallable'){
            if(!structuredEngine||!provider)return null;
            // The service command supplies its own real cached argument object; a
            // host reference or copied args cannot issue this child witness.
            if(!['arcade_callCallable','arcade_runCallableDispatch'].includes(opcode)||
                !live(util?.thread)||primitiveOwner.current(util,args)?.opcode!==opcode)throw Error('Captured catch invocation requires its actual callable primitive');
            cachedPrimitiveOwner(runtime,util,args,opcode,[]);
            return provider.invocation(map,engineActivations.capture(runtime.sequencer,util.thread));
        },
        readStructuredCaptured(args,util,cell){
            if(!structuredEngine)return null;
            if(primitiveOwner.current(util,args)?.opcode!=='arcade_getCaptured')throw Error('Captured catch read requires its actual primitive');
            cachedPrimitiveOwner(runtime,util,args,'arcade_getCaptured',['NAME']);
            return engineActivations.readCapturedCatch(runtime,util.thread,cell,args.NAME);
        },
        writeStructuredCaptured(args,util,cell,value){
            if(!structuredEngine)return false;
            if(primitiveOwner.current(util,args)?.opcode!=='arcade_setCaptured')throw Error('Captured catch write requires its actual primitive');
            cachedPrimitiveOwner(runtime,util,args,'arcade_setCaptured',['NAME']);
            return engineActivations.writeCapturedCatch(runtime,util.thread,cell,value,args.NAME);
        },
        readStructuredLocal(args,util) {
            if(!structuredEngine||!live(util?.thread)||util.runtime!==runtime)return null;
            if(primitiveOwner.current(util,args)?.opcode!=='arcade_getLocal')return null;
            cachedPrimitiveOwner(runtime,util,args,'arcade_getLocal',['NAME']);
            return engineActivations.readCatchCell(runtime,util.thread,args.NAME);
        },
        writeStructuredLocal(args,util,value) {
            if(!structuredEngine||!live(util?.thread)||util.runtime!==runtime)return false;
            if(primitiveOwner.current(util,args)?.opcode!=='arcade_setLocal')return false;
            cachedPrimitiveOwner(runtime,util,args,'arcade_setLocal',['NAME']);
            return engineActivations.writeCatchCell(runtime,util.thread,args.NAME,value);
        },
        jumpStructured(args,util) {
            if(!structuredEngine)return false;
            if(!live(util?.thread)||util.runtime!==runtime||primitiveOwner.current(util,args)?.opcode!=='arcade_structuredJump')
                throw Error('Structured jump requires its actual cached primitive');
            const entry=engineActivations.capture(runtime.sequencer,util.thread);
            cachedPrimitiveOwner(runtime,util,args,'arcade_structuredJump',['KIND']);
            return engineActivations.beginOwnedJump(entry,args.KIND);
        },
        returnStructured(args,util,depth,read,settle) {
            if(!structuredEngine)return false;
            if(!live(util?.thread)||util.runtime!==runtime||primitiveOwner.current(util,args)?.opcode!=='arcade_returnValue')
                throw Error('Structured return requires its actual cached primitive');
            const entry=engineActivations.capture(runtime.sequencer,util.thread);
            cachedPrimitiveOwner(runtime,util,args,'arcade_returnValue',[]);
            return engineActivations.beginOwnedReturn(entry,depth,read,settle);
        },
        beginStructuredInvocation(thread) {
            if(!structuredBridge || !live(thread) || runtime.sequencer.activeThread!==thread)return null;
            return structuredBridge.begin(thread,thread.peekStackFrame());
        },
        enterStructuredHandler(invocation,catchEntry,finallyEntry) {
            if(!structuredBridge)return null;
            return structuredBridge.enter(invocation,catchEntry,finallyEntry);
        },
        bindStructuredHandlerEntry(args,util) {
            if(!structuredBridge)return null; // default owner remains disabled
            const block=primitiveOwner.current(util,args);
            if(!block||block.opcode!=='arcade_structuredTry'||!live(util?.thread)||util.runtime!==runtime)return null;
            if(cachedPrimitiveOwner(runtime,util,args,'arcade_structuredTry',['HAS_CATCH','HAS_FINALLY','CATCH_NAME'])!==block)return null;
            const activation=engineActivations.capture(runtime.sequencer,util.thread);
            const frameLease=activation&&engineActivations.captureFrame(activation);
            return frameLease?engineActivations.bindHandlerEntry(activation,frameLease,args):null;
        },
        startStructuredHandler(args,util) {
            if(!structuredEngine)return false;
            const entry=owner.bindStructuredHandlerEntry(args,util),epoch=generation,thread=util.thread;
            if(!entry)return false;
            return engineActivations.beginHandlerBranch(entry,runtime.sequencer,thread,(completion,completionToken)=>{
                if(disposed||!active||generation!==epoch)return;
                const original=failureGet(signals,completion.signal);
                if(completion.kind!=='throw'||original?.runtime!==runtime||original.generation!==generation)
                    throw new Error('Structured finalizer requires its original owned completion');
                if(stageEscape(thread,completion.signal,null,completionToken)){
                    owner.consumeStaged(thread,completion.signal);return;
                }
                try{retireLineage(thread,completion.signal,true);}catch(error){if(error!==completion.signal)throw error;}
            });
        },
        suspendStructuredInvocation(invocation) {
            return structuredBridge?.current(invocation)?structuredBridge.suspend(invocation):null;
        },
        resumeStructuredInvocation(invocation,lease) {return !!structuredBridge?.resume(invocation,lease);},
        closeStructuredInvocation(invocation) {structuredBridge?.close(invocation);},
        // Object construction and SDK class procedures may resume a caller
        // after an earlier managed call; only their actual cached primitive
        // invocation can retain that caller.
        captureCaller(args,util,opcode='arcade_createObject') {
            if (!arcadeClaim || !live(util?.thread) || !['arcade_createObject','arcade_callFunction','arcade_callCallable','arcade_runCallableDispatch'].includes(opcode)) return null;
            if (!cachedPrimitiveOwner(runtime,util,args,opcode,[])) return null;
            const lease=Object.freeze({});
            const activation=engineActivations.capture(runtime.sequencer,util.thread);
            const frameLease=activation&&engineActivations.captureFrame(activation);
            setCurrent(callerLeases,lease,{owner,thread:util.thread,frame:util.thread.peekStackFrame(),generation,frameLease});
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
        rethrow(error) {if (owned(error)||failureGet(managedSignals,error)?.owner===owner) throw error;},
        linkManagedCall(child,args,util,cleanup) {
            if(structuredEngine){
                const retained=failureGet(callerLeases,args.bwExceptionCaller);
                if(!retained){
                    if(primitiveOwner.current(util,args)?.opcode!=='arcade_callFunction'||
                        !cachedPrimitiveOwner(runtime,util,args,'arcade_callFunction',[]))
                        throw new Error('Managed transfer edge requires its actual cached call');
                }
            }
            const unlink=owner.link(child,util.thread,cleanup,args.bwExceptionCaller,managedEdgeKey);
            if(args.bwStructuredCatchInvocation&&!engineActivations.bindCatchInvocation(args.bwStructuredCatchInvocation,child,util.thread,args.bwCallableCaptures)){
                unlink();throw Error('Captured catch invocation witness is stale or foreign');
            }
            return unlink;
        },
        link(child, caller, cleanup = () => {}, lease = null, admission = null) {
            if(structuredEngine&&admission!==managedEdgeKey)throw new Error('Managed transfer edge requires its private call admission');
            const record=lease && failureGet(callerLeases,lease);
            const retained=record?.owner===owner && record.thread===caller && record.generation===generation &&
                caller.stackFrames.includes(record.frame) && (!record.frameLease ||
                    engineActivations.validFrame(record.frameLease,runtime,caller,record.frame));
            // A supplied stale lease is not an ordinary direct caller. It may
            // not downgrade to the active-thread fallback after a pooled frame
            // is reused. Transfer consumers will require a non-null frameLease.
            if(lease && !retained)throw new Error('Arcade exception edge requires its current retained caller lease');
            if (!live(child) || !live(caller) || child === caller || (!retained && runtime.sequencer.activeThread !== caller) ||
                child.target !== caller.target || typeof cleanup !== 'function' || failureHas(edges,child)) {
                throw new Error('Arcade exception edge requires an actual managed call');
            }
            for (let parent = caller; parent; parent = failureGet(edges,parent)?.caller) {
                if (parent === child) throw new Error('Cyclic Arcade exception edge');
            }
            const frame=retained?record.frame:caller.peekStackFrame();
            const activation=engineActivations.capture(runtime.sequencer,caller);
            const frameLease=retained?record.frameLease:activation&&engineActivations.captureFrame(activation);
            const edge = failureFreeze({caller, cleanup, generation,
                ...(structuredBridge?{structuredFrame:frame,frameLease,activation}:{})});
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
            // Retain the admitted run before the managed primitive-value reader.
            // Stop inside that reader can mint only an old-run cancellation.
            const readGeneration=generation;
            // Read while the actual primitive's Number-input loan is live.
            const value = readValue(args, util);
            if (value!==null && !['undefined','boolean','number','string'].includes(typeof value)) {
                throw new Error('Arcade Throw currently requires a primitive thrown value');
            }
            const signal = new Error('Arcade uncaught thrown value: ' + String(value));
            const record = Object.freeze({owner, runtime, generation:readGeneration, value, target: thread.target,
                block: block.id, stack: Object.freeze([...thread.stack])});
            if(structuredEngine&&(readGeneration!==generation||!active||disposed||!invocationCurrent())){
                // This private tombstone carries no handler or call authority.
                // The actual execute/Promise consumer absorbs it before stale
                // origin checks, without mutating a reused thread in a new run.
                failureSet(signals,signal,record);
                failureSet(stagedThrows,signal,{thread,generation:readGeneration});throw signal;
            }
            setCurrent(signals,signal, record);
            if(structuredEngine){
                // Capture while the real cached primitive loan is still live;
                // only the actual execute/Promise consumer may commit it later.
                try {
                    failureSet(throwRoutes,signal,captureRoute(thread));
                    if(cachedPrimitiveOwner(runtime,util,args,'arcade_throwValue',[])===block){
                        const origin=engineActivations.capture(runtime.sequencer,thread);
                        const request=origin&&engineActivations.prepareOwnedThrow(origin,value,signal);
                        if(request){
                            failureSet(stagedThrows,signal,{thread,origin,request,generation});throw signal;
                        }
                        if(origin&&stageEscape(thread,signal,origin))throw signal;
                    }
                }catch(error){if(error===signal)throw signal;}
            }
            if(structuredBridge){
                try{
                    const plan=structuredBridge.offerOwnedThrow(thread,thread.peekStackFrame(),signal,value);
                    const candidate=plan&&structuredBridge.takePlan(plan,signal);
                    if(candidate)failureSet(structuredObservations,signal,failureFreeze({
                        kind:candidate.kind,previewOnly:true,retirementSuppressed:false}));
                }catch(error){
                    // Preview failure must not replace or suppress the original
                    // owned uncaught signal. No external Error is adopted.
                    failureSet(structuredObservations,signal,failureFreeze({
                        previewOnly:true,previewFailed:true,retirementSuppressed:false}));
                }
            }
            // A plan is not a physical continuation commit. Until that engine
            // consumer exists, even opt-in preview retains the uncaught route.
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
        claim(valueReader, physicalUpdate, preview = false) {
            if (disposed || arcadeClaim) throw new Error('Arcade exception runtime already has an owner');
            const token = failureFreeze({});
            arcadeClaim = token;readValue = valueReader;consumePhysicalUpdate = physicalUpdate;
            structuredEngine=preview==='engine';
            engineActivations.enableLexicalLoops(runtime,structuredEngine);
            if(preview){
                structuredBridge=require('./bw-structured-continuations')(
                    (thread,frame,top=false)=>live(thread)&&thread.stackFrames.includes(frame)&&
                        (!top||thread.peekStackFrame()===frame),
                    (thread,frame)=>{
                        const index=thread.stackFrames.lastIndexOf(frame);
                        if(index>0)return {thread,frame:thread.stackFrames[index-1]};
                        const edge=failureGet(edges,thread);return edge?.generation===generation&&edge.caller&&edge.structuredFrame&&
                            (!structuredEngine||edge.frameLease&&engineActivations.validFrame(edge.frameLease,runtime,edge.caller,edge.structuredFrame))?
                            {thread:edge.caller,frame:edge.structuredFrame}:null;});
                if(active)structuredBridge.start();
            }
            const claimFailures = failures, claimStructuredObservations = structuredObservations;
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
                takeManagedTransfer(...args) {return current()?invoke('takeManagedTransfer',args):null;},
                captureStructuredLocals(...args){return current()?invoke('captureStructuredLocals',args):null;},
                captureStructuredRegistration(...args){return current()?invoke('captureStructuredRegistration',args):args[2];},
                bindStructuredRegistration(...args){if(current())return invoke('bindStructuredRegistration',args);},
                captureStructuredInvocation(...args){return current()?invoke('captureStructuredInvocation',args):null;},
                readStructuredCaptured(...args){return current()?invoke('readStructuredCaptured',args):null;},
                writeStructuredCaptured(...args){return current()&&invoke('writeStructuredCaptured',args);},
                readStructuredLocal(...args) {return current()?invoke('readStructuredLocal',args):null;},
                writeStructuredLocal(...args) {return current()&&invoke('writeStructuredLocal',args);},
                rethrow: owner.rethrow,
                beginStructuredInvocation(thread) {return current()?invoke('beginStructuredInvocation',[thread]):null;},
                enterStructuredHandler(...args) {return invoke('enterStructuredHandler',args);},
                bindStructuredHandlerEntry(...args) {return current()?invoke('bindStructuredHandlerEntry',args):null;},
                jumpStructured(...args) {return current()&&invoke('jumpStructured',args);},
                returnStructured(...args) {return current()&&invoke('returnStructured',args);},
                startStructuredHandler(...args) {return current()&&invoke('startStructuredHandler',args);},
                suspendStructuredInvocation(...args) {return current()?invoke('suspendStructuredInvocation',args):null;},
                resumeStructuredInvocation(...args) {return current()&&invoke('resumeStructuredInvocation',args);},
                closeStructuredInvocation(...args) {if(current())invoke('closeStructuredInvocation',args);},
                structuredObservation: signal=>failureGet(claimStructuredObservations,signal)||null,
                captureCaller(...args) {if (!current()) return null;return invoke('captureCaller',args);},
                releaseCaller(lease) {if (current()) owner.releaseCaller(lease);},
                capture(thread) {return current() ? invoke('capture',[thread]) : null;},
                current(lease) {return current() && owner.current(lease);},
                link(...args) {return invoke('link',args);},
                linkManagedCall(...args) {return invoke('linkManagedCall',args);},
                linkPhysicalUpdate(...args) {return invoke('linkPhysicalUpdate',args);},
                raise(...args) {return invoke('raise',args);},
                arrayReady() {return current() && owner.arrayReady();},
                rejectArrayOperation(...args) {return invoke('rejectArrayOperation',args);},
                rejectPrimitiveFault(...args) {return invoke('rejectPrimitiveFault',args);},
                rejectConditionWait(...args) {return invoke('rejectConditionWait',args);},
                rejectConstraint(...args) {return invoke('rejectConstraint',args);},
                dispose() {
                    if (!current()) return;
                    cancel();engineActivations.enableLexicalLoops(runtime,false);structuredBridge=null;structuredEngine=false;arcadeClaim = null;readValue = null;consumePhysicalUpdate = null;
                    failures = new WeakMap();edges = new WeakMap();structuredObservations = new WeakMap();
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
    listen('PROJECT_START', () => {generation++;if (!disposed) {active = true;structuredBridge?.start();}});
    listen('PROJECT_STOP_ALL', cancel);
    listen('PROJECT_LOADED', cancel);
    listen('RUNTIME_DISPOSED', owner.dispose);
    return owner;
}

// Engine hooks consume only privately issued signals for this exact thread.
// A stale signal is still recognized so it cannot enter Scratch's ordinary
// rejection path and resume an old thread after Stop/Start.
function consume(runtime, thread, error) {
    const managed=failureGet(managedSignals,error);
    if(managed?.runtime===runtime&&managed.owner.consumeManaged(thread,error))return true;
    if(failureGet(signals,error)?.runtime===runtime&&failureGet(owners,runtime)?.consumeStaged(thread,error))return true;
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
