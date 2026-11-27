// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
import {hasRuntime} from '../scripts/lib/pxt-node.mjs';
import {ARCADE_PALETTE, pixelsToSvg} from '../overlay/scratch-gui/src/lib/bw-makecode/pixel-image.js';
import {scratchArcadeHueTable} from '../overlay/scratch-gui/src/lib/bw-makecode/scratch-arcade-effects.js';
import {projectJsonToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';

const TABLE = scratchArcadeHueTable(ARCADE_PALETTE, 32);
const artwork = pixelsToSvg({width: 8, height: 8, pixels: new Uint8Array(64).fill(2)}, {pixelScale: 3});
const convert = () => {
    const creator = new SB3Creator();
    creator.parse(`GLOBAL ready
SPRITE Actor:
  WHEN flag clicked:
    go to x: 0 y: 0
    set color effect to 70
    change color effect by 30
    set ghost effect to 25
    change ghost effect by 25
    set ready to 1
  WHEN space key pressed:
    clear graphic effects`);
    assert.deepEqual(creator.warnings, []);
    creator.applyCustomSVG('Actor', artwork);
    return projectJsonToArcade(JSON.stringify(creator.project), {
        costumeSvg: (target, costume) => creator.assets.get(costume.assetId)?.data || null
    });
};

test('color conversion keeps the initial palette and leaves transparent pixels transparent', () => {
    assert.deepEqual(TABLE[0], ARCADE_PALETTE.map((_, index) => index));
    assert.ok(TABLE.every(row => row[0] === 0));
    assert.notEqual(TABLE[16][2], 2);
});

test('color and ghost changes use native Arcade images and clear together', () => {
    const result = convert();
    assert.deepEqual(result.unsupported, []);
    assert.match(result.ts, /_scratchSetEffect\(ActorSprite, "_bwScratchHue", 30, true/);
    assert.match(result.ts, /_scratchSetEffect\(ActorSprite, "_bwScratchGhost", 25, true/);
    assert.match(result.ts, /_scratchClearEffects\(ActorSprite,/);
    assert.ok(result.warnings.some(warning => warning.includes('dithered transparency')));
});

test('native Arcade renders the shifted hue with half its pixels transparent', {
    skip: !hasRuntime('arcade') && 'Pinned Arcade compiler required',
    timeout: 300000
}, async () => {
    const result = await runPxtArcade(convert().files, {
        waitForGlobals: {ready: 1}, inspectDisplay: true, waitForDisplay: true
    });
    const sample = [];
    for (let y = 56; y < 64; y++) for (let x = 76; x < 84; x++) sample.push(result.$display.screen[y * 160 + x]);
    assert.equal(sample.filter(pixel => pixel === result.$display.palette[TABLE[16][2]]).length, 32);
});
