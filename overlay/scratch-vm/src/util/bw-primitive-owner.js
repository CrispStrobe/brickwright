// Private synchronous primitive execution loan. Only the engine's current
// cached operation supplies this context; it never survives an awaited result.
// Private call/failure state never dispatches mutable prototype hooks after
// guest callbacks. These closures expose neither maps nor their context rows.
const callApply=Reflect.apply,callFreeze=Object.freeze;
const callWeakGet=WeakMap.prototype.get,callWeakSet=WeakMap.prototype.set;
const callWeakHas=WeakMap.prototype.has,callWeakDelete=WeakMap.prototype.delete;
const callGet=(map,key)=>callApply(callWeakGet,map,[key]);
const callSet=(map,key,value)=>callApply(callWeakSet,map,[key,value]);
const callHas=(map,key)=>callApply(callWeakHas,map,[key]);
const callDelete=(map,key)=>callApply(callWeakDelete,map,[key]);
const active = new WeakMap();
const activeCalls = new WeakMap();
const failureCalls = new WeakMap();
const cachedOwner = require('./bw-cached-primitive-owner');
const conditionWaits = require('./bw-source-condition-waits');
const sceneClockNumber = require('./bw-scene-clock-number');
// The frame-delta Number owner is Arcade-only and lives in the lazy Arcade
// chunk; that chunk installs it before any arcade_frameDeltaTime block can
// run. Until then no owner exists, exactly as before installation.
let frameDeltaNumber=Object.freeze({
    beforeInputs(){},
    finish(){},
    after(record,result){if(record.operation.opcode==='arcade_frameDeltaTime')throw Error('Frame delta Number: original result owner missing');return result;}
});
let frameDeltaInstalled=false;
function installFrameDeltaNumber(owner){
    // Set once by the actual module load; later callers cannot replace it.
    if(frameDeltaInstalled)throw Error('Frame delta Number: owner already installed');
    if(!owner||typeof owner.after!=='function'||typeof owner.finish!=='function'||typeof owner.beforeInputs!=='function')throw Error('Frame delta Number: invalid owner installation');
    frameDeltaNumber=owner;frameDeltaInstalled=true;
}
// The engine loan and Number-input adapter share this explicit role table.
// A loan alone does not authorize interpretation of arbitrary input sockets.
const roles=Object.freeze(Object.fromEntries(Object.entries({
    control_wait_until:[],
    arcade_createCallable:[],arcade_objectField:[],procedures_call:[],arcade_callFunction:[],
    arcade_spriteProperty:[],arcade_sceneMillis:[],arcade_frameDeltaTime:[],arcade_highScore:[],arcade_gameOver:[],arcade_legacyGameOver:[],
    arcade_setSpriteImage:[],arcade_blitImage:[],arcade_drawImage:[],arcade_drawImageCircle:[],
    arcade_setImagePixel:[],arcade_mutateImage:[],arcade_createImageSprite:[],arcade_spawnImageProjectile:[],arcade_spawnImageSprite:[],
    arcade_setSpriteProperty:[],arcade_setSpritePosition:[],
    arcade_imageProperty:[],arcade_imagePixel:[],arcade_scrollImage:[],
    arcade_tilesOfType:[],arcade_randomTileOfType:[],arcade_placeOnRandomTile:[],
    arcade_throwValue:['VALUE'],arcade_createOwnedImageSprite:['KIND'],
    arcade_returnValue:['VALUE'],arcade_functionArgument:['VALUE'],
    arcade_setLocal:['VALUE'],arcade_setCaptured:['VALUE'],
    arcade_setObjectField:['VALUE'],arcade_inspectValue:['VALUE','LIMIT'],
    arcade_sourceValueBinary:['LEFT','RIGHT'],arcade_sourceValueUnary:['VALUE'],
    arrays_create1D:[],arrays_create2D:[],arrays_createEmpty:[],
    arrays_createZeros:[],arrays_createRange:[],arrays_delete:[],
    arrays_get:[],arrays_get2D:[],arrays_getMulti:[],
    arrays_set:[],arrays_set2D:[],arrays_setMulti:[],
    arrays_push:[],arrays_pop:[],arrays_insert:[],
    arrays_remove:[],arrays_length:[],arrays_shape:[],
    arrays_contains:[],arrays_indexOf:[],arrays_slice:[],
    arrays_getRow:[],arrays_getColumn:[],arrays_map:[],
    arrays_filter:[],arrays_reduce:[],arrays_sort:[],
    arrays_reverse:[],arrays_sum:[],arrays_mean:[],
    arrays_min:[],arrays_max:[],arrays_transpose:[],
    arrays_flatten:[],arrays_reshape:[],arrays_toJSON:[],
    arrays_toString:[],arrays_listAll:[],arrays_namedReference:[],
    arrays_createReference:[],arrays_parseLegacyValue:[],arrays_jsonValue:[],
    arrays_referenceTruthy:[],arrays_referenceItem:[],arrays_referenceRandom:[],
    arrays_referenceLength:[],arrays_referenceSlice:[],arrays_referenceConcat:[],
    arrays_referenceTake:[],arrays_showTable:[],arrays_hideTable:[],
    arrays_setTableTitle:[],arrays_setTableStyle:[],arrays_markCell:[],
    arrays_unmarkCell:[],arrays_clearMarks:[],arrays_isMarked:[],
    arrays_markedCount:[],
    arrays_referenceValues:['VALUE'],arrays_mutateReference:['VALUE'],
    arrays_referenceRemove:['VALUE'],arrays_referenceIndexOf:['VALUE'],
    arrays_valueBinary:['LEFT','RIGHT'],arrays_valueUnary:['VALUE'],
    arrays_valueCompare:['LEFT','RIGHT'],arrays_valueTruthy:['VALUE']
}).map(([opcode,inputs])=>[opcode,Object.freeze(inputs)])));
const handles=opcode=>Object.hasOwn(roles,opcode);
const permitsNumberInput=(opcode,name)=>handles(opcode)&&roles[opcode].includes(name);

function owned(record) {
    const {runtime,thread,container,operation,args,util,block,root,blockFunction}=record;
    return runtime.sequencer.activeThread===thread && runtime.isActiveThread(thread) && !thread.isKilled &&
        runtime.targets.includes(thread.target) && thread.blockContainer===container && thread.target.blocks===container &&
        util.thread===thread && util.runtime===runtime && thread.peekStack()===root &&
        container.getBlock(operation.id)===block && handles(block.opcode) &&
        operation.opcode===block.opcode && operation._argValues===args &&
        operation._blockFunction===blockFunction && runtime.getOpcodeFunction(operation.opcode)===blockFunction &&
        container._cache?._executeCached?.[root]?._ops.includes(operation);
}
function invoke(runtime,thread,container,operation,args,util,primitive) {
    if(callHas(active,runtime))throw new Error('Primitive execution ownership cannot be reentered');
    const record={runtime,thread,container,operation,args,util,opcode:operation.opcode,blockId:operation.id,target:thread.target,root:thread.peekStack(),block:container.getBlock(operation.id),blockFunction:operation._blockFunction};
    if(!record.block || typeof primitive!=='function' || !owned(record))throw new Error('Primitive execution requires the actual cached caller');
    callSet(active,runtime,record);
    try {const result=primitive();return conditionWaits.after(record,sceneClockNumber.after(record,frameDeltaNumber.after(record,result)));}finally{try{sceneClockNumber.finish(record);}finally{try{frameDeltaNumber.finish(record);}finally{callDelete(active,runtime);}}}
}
// Only a genuine synchronous nested VM thread may suspend an existing loan.
// No callback, copied utility or retained argument snapshot can borrow it.
function stepNested(util,args,child) {
    const runtime=util?.runtime,record=runtime&&callGet(active,runtime),sequencer=runtime?.sequencer;
    if(!record||record.util!==util||record.args!==args||!owned(record))throw new Error('Nested primitive step requires the actual current caller');
    if(!child||child===record.thread||!runtime.threads.includes(child)||!runtime.isActiveThread(child)||child.isKilled||
        child.status===child.constructor.STATUS_DONE||!runtime.targets.includes(child.target)||
        child.blockContainer!==child.target.blocks||!child.blockContainer.getBlock(child.peekStack())||
        typeof sequencer.stepThread!=='function')throw new Error('Nested primitive step requires a distinct live VM child');
    const previousThread=util.thread,previousSequencer=util.sequencer,previousActive=sequencer.activeThread;
    callDelete(active,runtime);
    try {sequencer.activeThread=child;return sequencer.stepThread(child);}
    finally {util.thread=previousThread;util.sequencer=previousSequencer;sequencer.activeThread=previousActive;callSet(active,runtime,record);}
}
// A source turn that steps another VM thread from inside an owned primitive (moving a Sprite runs its overlap
// callbacks synchronously within setPosition/setProperty) suspends that primitive's loan for the child only.
function stepChild(runtime,child,step) {
    const record=runtime&&callGet(active,runtime);
    if(!record||!child||child===record.thread||!runtime.threads.includes(child))return step();
    callDelete(active,runtime);
    try {return step();}
    finally {callSet(active,runtime,record);}
}
function current(util,args) {
    const record=util?.runtime && callGet(active,util.runtime);
    return record && record.util===util && record.args===args && owned(record) ? record.block : null;
}
// Rejection-only witness for an invoker which already passed strong ownership.
// Current metadata/cache/registration may subsequently become the reason to
// reject. This witness never authorizes effects or Number interpretation.
function captureActiveCall(util,args) {
    const record=util?.runtime&&callGet(active,util.runtime);
    if(!record||record.util!==util||record.args!==args||!owned(record))return null;
    try {if(cachedOwner(record.runtime,util,args,record.block.opcode,[])!==record.block)return null;}catch{return null;}
    const token=callFreeze({});
    callSet(activeCalls,token,{record,runtime:record.runtime,thread:record.thread,target:record.thread.target,
        container:record.container,root:record.root,args,util});
    return token;
}
// Rejection-only recovery for a trusted current Array boundary. The public
// token is opaque: no actual engine args, util or block context escapes.
function captureFailureCall(runtime,opcode) {
    if(opcode!=='arrays_valueBinary'&&opcode!=='arrays_createReference')return null;
    const record=runtime&&callGet(active,runtime);
    // active is published only AFTER invoke validated the original cached
    // caller. Later source/cache edits may themselves require rejection.
    if(!record||record.opcode!==opcode)return null;
    const token=callFreeze({});
    callSet(activeCalls,token,{record,runtime,thread:record.thread,target:record.target,
        container:record.container,root:record.root,args:record.args,util:record.util});
    if(!isActiveCall(token,record.util,record.args))return null;
    callSet(failureCalls,token,{runtime,opcode,blockId:record.blockId});
    return token;
}
function isFailureActive(token,runtime,opcode,blockId) {
    const mark=callGet(failureCalls,token),saved=callGet(activeCalls,token);
    return !!mark&&!!saved&&mark.runtime===runtime&&mark.opcode===opcode&&
        (blockId===undefined||mark.blockId===blockId)&&
        saved.runtime===runtime&&saved.record.opcode===opcode&&
        isActiveCall(token,saved.util,saved.args);
}
function dispatchArrayFailure(token,error,lease) {
    const mark=callGet(failureCalls,token),saved=callGet(activeCalls,token);
    if(!mark||!saved||!isFailureActive(token,mark.runtime,mark.opcode,mark.blockId))throw error;
    // Internal forwarding only. Public callers still cannot manufacture the
    // Array service's private one-use lease, and never receive this context.
    return arrayFailureDispatcher(mark.runtime,saved.args,saved.util,error,lease,mark.blockId);
}
function isActiveCall(token,util,args) {
    const saved=callGet(activeCalls,token);
    if(!saved||saved.util!==util||saved.args!==args)return false;
    const {runtime,thread,target,container,root,record}=saved;
    return callGet(active,runtime)===record&&runtime.sequencer.activeThread===thread&&
        runtime.isActiveThread(thread)&&runtime.threads.includes(thread)&&!thread.isKilled&&
        thread.status!==thread.constructor.STATUS_DONE&&runtime.targets.includes(target)&&
        thread.target===target&&thread.blockContainer===container&&target.blocks===container&&
        thread.peekStack()===root&&util.runtime===runtime&&util.thread===thread;
}
function beforeInputs(runtime,thread,container,blockCached) {
    const ready=conditionWaits.beforeInputs(runtime,thread,container,blockCached);
    sceneClockNumber.beforeInputs(runtime,thread,container,blockCached,ready);
    frameDeltaNumber.beforeInputs(runtime,thread,container,blockCached,ready);return ready;
}
module.exports=Object.freeze({__proto__:null,installFrameDeltaNumber,beforeInputs,invoke,current,stepNested,stepChild,handles,permitsNumberInput,captureActiveCall,captureFailureCall,isFailureActive,dispatchArrayFailure,isActiveCall});

// Exceptions publishes one stable frozen function object at module entry;
// no late Module._load call receives a private current-call context.
const arrayFailureDispatcher=require('./bw-arcade-exceptions').rejectArrayOperation;
