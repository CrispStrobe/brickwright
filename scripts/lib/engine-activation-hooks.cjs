// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// Exact selected engine anchors. A partial/duplicated hook is a refusal. This
// producer edits the real engine consumers; no provider imports or test hooks.
const prefix="const bwEngineActivations = require('../util/bw-engine-activations');\n";
const once=(source,before,after)=>{
    if(source.split(before).length!==2)throw new Error('Engine activation anchor missing or ambiguous: '+before);
    return source.replace(before,after);
};
const strip=(source,edits)=>{
    if(!source.includes('bwEngineActivations'))return source;
    if(!source.startsWith(prefix))throw new Error('Engine activation import missing or misplaced');
    let original=source.slice(prefix.length);
    for(const [before,after]of [...edits].reverse())original=once(original,after,before);
    const expected=prefix+edits.reduce((text,[before,after])=>once(text,before,after),original);
    if(expected!==source)throw new Error('Engine activation hooks differ');
    return original;
};
const patch=(source,edits)=>prefix+edits.reduce((text,[before,after])=>once(text,before,after),strip(source,edits));

const threadEdits=[
    ['    reset () {','    reset () {\n        bwEngineActivations.invalidateFrame(this);'],
    ['    pushStack (blockId) {','    pushStack (blockId) {\n        bwEngineActivations.invalidateThread(this);'],
    ['    reuseStackForNextBlock (blockId) {','    reuseStackForNextBlock (blockId) {\n        bwEngineActivations.invalidateThread(this);'],
    ['    popStack () {','    popStack () {\n        bwEngineActivations.invalidateThread(this);']
];
const executeEdits=[
    ['    const nested = executing;','    const nested = executing;\n    const bwEngineActivationEntry = bwEngineActivations.enter(sequencer, thread);'],
    ['    } finally {\n        executing = nested;','    } finally {\n        bwEngineActivations.leave(bwEngineActivationEntry);\n        executing = nested;'],
    ['    primitiveReportedValue.then(resolvedValue => {',
        '    const bwEngineActivationLease = bwEngineActivations.capture(sequencer, thread);\n    primitiveReportedValue.then(resolvedValue => {\n        if (bwEngineActivationLease !== null && !bwEngineActivations.valid(bwEngineActivationLease, sequencer, thread)) return;'],
    ['    }, rejectionReason => {',
        '    }, rejectionReason => {\n        if (bwArcadeExceptions.consume(sequencer.runtime, thread, rejectionReason)) return;\n        if (bwEngineActivationLease !== null && !bwEngineActivations.valid(bwEngineActivationLease, sequencer, thread)) return;']
];
// Admit only the complete exact previous producer shape when updating an
// existing installed overlay. Partial hooks still refuse in both versions.
const previousExecuteEdits=executeEdits.map(([before,after])=>[before,
    after.replace('        if (bwArcadeExceptions.consume(sequencer.runtime, thread, rejectionReason)) return;\n','')]);
const stripExecute=source=>{
    try{return strip(source,executeEdits);}catch(error){
        try{return strip(source,previousExecuteEdits);}catch{throw error;}
    }
};
module.exports=Object.freeze({
    stripThreadActivations:source=>strip(source,threadEdits),
    stripExecuteActivations:stripExecute,
    patchThreadActivations:source=>patch(source,threadEdits),
    patchExecuteActivations:source=>prefix+executeEdits.reduce((text,[before,after])=>once(text,before,after),stripExecute(source))
});
