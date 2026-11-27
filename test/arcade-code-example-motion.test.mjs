// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
import {hasRuntime} from '../scripts/lib/pxt-node.mjs';
import {projectJsonToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';

const source = `GLOBAL heading
GLOBAL outX
GLOBAL outY
GLOBAL outSize
GLOBAL glideX
GLOBAL glideY
GLOBAL ready

SPRITE Actor:
  SHAPE rect 90 30
  WHEN flag clicked:
    go to x: 0 y: 0
    point in direction 0
    move 30 steps
    turn right 90 degrees
    move 60 steps
    turn left 135 degrees
    set size to 60
    change size by 15
    set heading to direction
    set outX to round x position
    set outY to round y position
    set outSize to size
    glide 0.12 secs to x: -30 y: 45
    set glideX to round x position
    set glideY to round y position
    set ready to 1`;

const convert = () => {
    const creator = new SB3Creator();
    creator.parse(source);
    assert.deepEqual(creator.warnings, []);
    return projectJsonToArcade(JSON.stringify(creator.project), {
        costumeSvg: (target, costume) => creator.assets.get(costume.assetId)?.data || null
    });
};

test('Scratch heading and percentage size generate native Arcade sprite operations', () => {
    const result = convert();
    assert.deepEqual(result.unsupported, []);
    assert.match(result.ts, /_scratchPoint\(ActorSprite, 0\)/);
    assert.match(result.ts, /Math\.sin\(_scratchDirection\(ActorSprite\)/);
    assert.match(result.ts, /s\.rotationDegrees =/);
    assert.match(result.ts, /control\.millis\(\) - __bwGlideTime/);
    assert.match(result.ts, /ActorSprite\.setScale\(Math\.max\(0.01, 60 \/ 100\)\)/);
});

test('real Arcade sprite motion moves north and east, normalizes heading and scales', {
    skip: !hasRuntime('arcade') && 'Pinned Arcade compiler required',
    timeout: 300000
}, async () => {
    const result = await runPxtArcade(convert().files, {
        waitForGlobals: {ready: 1, heading: -45, outX: 60, outY: 30, outSize: 75, glideX: -30, glideY: 45},
        inspectDisplay: true, waitForDisplay: true
    });
    assert.equal(result.$display.screen.length, 160 * 120);
});
