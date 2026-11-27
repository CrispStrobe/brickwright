// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
import {projectJsonToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {hasRuntime} from '../scripts/lib/pxt-node.mjs';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';

const source = `GLOBAL front
GLOBAL back
GLOBAL seenX
GLOBAL seenY
GLOBAL ready
STAGE:
  WHEN flag clicked:
    set seenX to mouse x
    set ready to 1

SPRITE Back:
  SHAPE rect 100 100
  WHEN sprite clicked:
    change back by 1

SPRITE Front:
  SHAPE rect 80 80
  WHEN sprite clicked:
    change front by 1
    set seenX to mouse x
    set seenY to mouse y
    hide`;

const convert = browserPointer => {
    const creator = new SB3Creator();
    creator.parse(source);
    assert.deepEqual(creator.warnings, []);
    return projectJsonToArcade(JSON.stringify(creator.project), {browserPointer});
};

test('browser pointer support is explicit and keeps portable exports honest', () => {
    const portable = convert(false);
    assert.ok(portable.unsupported.some(reason => reason.startsWith('mouse x:')));
    assert.equal(JSON.parse(portable.files['pxt.json']).dependencies['browser-events'], undefined);
    const browser = convert(true);
    assert.deepEqual(browser.unsupported, []);
    assert.equal(JSON.parse(browser.files['pxt.json']).dependencies['browser-events'], '*');
    assert.match(browser.ts, /browserEvents\.MouseLeft\.onEvent/);
    assert.match(browser.ts, /sprite\.image\.getPixel/);
    assert.ok(browser.warnings.some(warning => warning.includes('browser simulator')));
});

test('real Arcade mouse input selects the top visible sprite and supplies Scratch coordinates', {
    skip: !hasRuntime('arcade') && 'Pinned Arcade compiler required',
    timeout: 300000
}, async () => {
    const output = convert(true);
    const sample = await runPxtArcade(output.files, {
        buttonActions: {afterGlobals: {ready: 1}, steps: [
            {displayClick: {x: 82.5, y: 59.5}, waitForGlobals: {front: 1, back: 0, seenX: 6, seenY: 3}},
            {displayClick: {x: 82.5, y: 59.5}, waitForGlobals: {front: 1, back: 1, seenX: 6, seenY: 3}}
        ]},
        inspectDisplay: true,
        waitForDisplay: true
    });
    assert.equal(sample.$display.screen.length, 160 * 120);
});
