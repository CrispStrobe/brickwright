// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
import examples from '../overlay/scratch-gui/src/lib/sb3-creator-examples.js';
import {hasRuntime} from '../scripts/lib/pxt-node.mjs';
import {projectJsonToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';

const convert = source => {
    const creator = new SB3Creator();
    creator.parse(source);
    assert.deepEqual(creator.warnings, []);
    return projectJsonToArcade(JSON.stringify(creator.project));
};

test('the Complete Game exports its question and text comparison', () => {
    const output = convert(examples.game);
    assert.deepEqual(output.unsupported, []);
    assert.match(output.ts, /let __bwScratchAnswer = ""/);
    assert.match(output.ts, /__bwScratchAnswer = game\.askForString\(/);
    assert.match(output.ts, /\(__bwScratchAnswer as any\) == "yes"/);
});

test('Arcade delivers real typed input back to the waiting Scratch script', {
    skip: !hasRuntime('arcade') && 'Pinned Arcade compiler required',
    timeout: 300000
}, async () => {
    const output = convert(`GLOBAL stage
GLOBAL reply
STAGE:
  WHEN flag clicked:
    set stage to 1
    ask "Name?" and wait
    set reply to answer
    set stage to 2`);
    assert.deepEqual(output.unsupported, []);
    const result = await runPxtArcade(output.files, {
        buttonActions: {afterGlobals: {stage: 1}, steps: [
            {delay: 150, text: 'Ada'},
            {key: 'Enter', waitForGlobals: {stage: 2, reply: 'Ada'}}
        ]}, inspectDisplay: true, waitForDisplay: true
    });
    assert.equal(result.reply, 'Ada');
});
