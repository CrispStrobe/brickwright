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
    ['    popStack () {','    popStack () {\n        bwEngineActivations.invalidateThread(this);'],
    ['        this.reuseStackForNextBlock(nextBlockId);',
        '        const bwReuseLoopBody = () => {\n            if (!bwEngineActivations.advanceLoopBody(this, nextBlockId, () => this.reuseStackForNextBlock(nextBlockId))) this.reuseStackForNextBlock(nextBlockId);\n        };\n        if (bwEngineActivations.advanceStructuredBranch(this, nextBlockId, bwReuseLoopBody)) return;\n        bwReuseLoopBody();']
];
const sequencerEdits=[
    ['        const currentBlockId = thread.peekStack();\n        const branchId = thread.target.blocks.getBranch(',
        '        const bwLoopPreparation = bwEngineActivations.prepareLoopBranch(this, thread, branchNum, isLoop);\n        const currentBlockId = thread.peekStack();\n        const branchId = thread.target.blocks.getBranch('],
    ['            thread.pushStack(null);\n        }\n    }\n\n    /**\n     * Step a procedure.',
        '            thread.pushStack(null);\n        }\n        bwEngineActivations.commitLoopBranch(bwLoopPreparation, this, thread);\n    }\n\n    /**\n     * Step a procedure.'],
    ['                thread.goToNextBlock();\n            }\n            // If no next block',
        '                thread.goToNextBlock();\n                if (bwEngineActivations.takeBranchCancellation(thread)) return;\n            }\n            // If no next block'],
    ['                thread.goToNextBlock();\n            }\n        }\n    }',
        '                thread.goToNextBlock();\n                if (bwEngineActivations.takeBranchCancellation(thread)) return;\n            }\n        }\n    }'],
    ['            // A "null block" - empty branch.\n            thread.popStack();',
        '            // A "null block" - empty branch.\n            if (bwEngineActivations.finishEmptyBranch(this, thread)) return;\n            thread.popStack();'],
    ['            while (!thread.peekStack()) {\n                thread.popStack();',
        '            while (!thread.peekStack()) {\n                if (bwEngineActivations.finishEmptyBranch(this, thread)) return;\n                thread.popStack();']
];
const executeEdits=[
    ['    const nested = executing;','    const nested = executing;\n    const bwEngineActivationEntry = bwEngineActivations.enter(sequencer, thread);'],
    ['    } finally {\n        executing = nested;','    } finally {\n        bwEngineActivations.leave(bwEngineActivationEntry);\n        executing = nested;'],
    ['    primitiveReportedValue.then(resolvedValue => {',
        '    const bwEngineActivationLease = bwEngineActivations.capture(sequencer, thread);\n    primitiveReportedValue.then(resolvedValue => {\n        if (bwEngineActivationLease !== null && !bwEngineActivations.valid(bwEngineActivationLease, sequencer, thread)) return;'],
    ['    }, rejectionReason => {',
        '    }, rejectionReason => {\n        if (bwArcadeExceptions.consume(sequencer.runtime, thread, rejectionReason)) return;\n        if (bwEngineActivationLease !== null && !bwEngineActivations.valid(bwEngineActivationLease, sequencer, thread)) return;'],
    ['        handleReport(resolvedValue, sequencer, thread, blockCached, lastOperation);',
        '        handleReport(resolvedValue, sequencer, thread, blockCached, lastOperation);\n        if (lastOperation && bwEngineActivations.finishPromiseBranch(sequencer, thread, blockCached)) return;']
];
// Admit only the complete exact previous producer shape when updating an
// existing installed overlay. Partial hooks still refuse in both versions.
const previousExecuteEdits=executeEdits.filter(([before])=>!before.startsWith('        handleReport(')).map(([before,after])=>[before,
    after.replace('        if (bwArcadeExceptions.consume(sequencer.runtime, thread, rejectionReason)) return;\n','')]);
const stripKnown=(source,versions)=>{
    let first;for(const edits of versions){try{return strip(source,edits);}catch(error){first ||= error;}}
    throw first;
};
const stripExecute=source=>stripKnown(source,[executeEdits,
    executeEdits.filter(([before])=>!before.startsWith('        handleReport(')),previousExecuteEdits]);
const previousThreadEdits=threadEdits.map(([before,after])=>[before,before==='        this.reuseStackForNextBlock(nextBlockId);'?
    '        if (bwEngineActivations.advanceStructuredBranch(this, nextBlockId, () => this.reuseStackForNextBlock(nextBlockId))) return;\n        this.reuseStackForNextBlock(nextBlockId);':after]);
const stripThread=source=>stripKnown(source,[threadEdits,previousThreadEdits,threadEdits.slice(0,4)]);
module.exports=Object.freeze({
    stripThreadActivations:stripThread,
    stripExecuteActivations:stripExecute,
    patchThreadActivations:source=>prefix+threadEdits.reduce((text,[before,after])=>once(text,before,after),stripThread(source)),
    patchExecuteActivations:source=>prefix+executeEdits.reduce((text,[before,after])=>once(text,before,after),stripExecute(source)),
    patchSequencerActivations:source=>prefix+sequencerEdits.reduce((text,[before,after])=>once(text,before,after),stripKnown(source,[sequencerEdits,sequencerEdits.slice(2)])),
    stripSequencerActivations:source=>stripKnown(source,[sequencerEdits,sequencerEdits.slice(2)])
});
