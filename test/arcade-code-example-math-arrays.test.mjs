// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import test from 'node:test';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
import examples from '../overlay/scratch-gui/src/lib/sb3-creator-examples.js';
import games from '../overlay/scratch-gui/src/lib/sb3-creator-game-examples.js';
import vectorArt from '../overlay/scratch-gui/src/lib/sb3-creator-vector-art.js';
import {hasRuntime} from '../scripts/lib/pxt-node.mjs';
import {projectJsonToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {runPxtArcade} from './helpers/pxt-arcade-runtime.mjs';

SB3Creator.registerVectorArt(vectorArt);
const convert = source => {
    const creator = new SB3Creator();
    creator.parse(source);
    assert.deepEqual(creator.warnings, []);
    return projectJsonToArcade(JSON.stringify(creator.project), {
        costumeSvg: (target, costume) => creator.assets.get(costume.assetId)?.data || null,
        soundData: (target, sound) => creator.assets.get(sound.assetId)?.data || null
    });
};

test('shipped math and array lessons emit their native operations', () => {
    for (const id of ['planetemaths', 'arrays']) assert.deepEqual(convert(examples[id]).unsupported, [], id);
    const bingo = convert(games.triple_bingo);
    assert.deepEqual(bingo.unsupported, []);
    assert.match(bingo.ts, /__bwNamedArraySetCell\(/);
    assert.match(bingo.ts, /__bwNamedArrayGetCell\(/);
});

test('Tidegate Rush and Triple Bingo reach their existing named tones', () => {
    for (const [id, expected] of [['lockstep_lagoon', [260]], ['triple_bingo', [660, 990]]]) {
        const output = convert(games[id]);
        assert.deepEqual(output.unsupported, [], id);
        const tones = [...output.ts.matchAll(/music\.playTone\((\d+),/g)].map(([, hz]) => Number(hz));
        for (const frequency of expected) {
            assert.ok(tones.some(hz => Math.abs(hz - frequency) <= 1), `${id} lost its authored ${frequency} Hz tone`);
        }
    }
});

test('PXT runs factorial, digit sums, divisibility, ranges and two-dimensional arrays', {
    skip: !hasRuntime('arcade') && 'Pinned Arcade compiler required',
    timeout: 300000
}, async () => {
    const result = convert(`GLOBAL fact
GLOBAL digits
GLOBAL piValue
GLOBAL divisible
GLOBAL starts
GLOBAL biggest
GLOBAL cell
GLOBAL ready
STAGE:
  WHEN flag clicked:
    set fact to factorial of 5
    set digits to sum of digits of 1234
    set piValue to pi
    IF 12 is multiple of 3 THEN:
      set divisible to 1
    new array "series" = range 1 to 5
    set starts to sum of array "series"
    set biggest to largest of array "series"
    new 2D array "grid" = [[1,2],[3,4]]
    set item row 1 col 2 of array "grid" to 9
    set cell to item row 1 col 2 of array "grid"
    set ready to 1`);
    assert.deepEqual(result.unsupported, []);
    const sample = await runPxtArcade(result.files, {
        waitForGlobals: {ready: 1, fact: 120, digits: 10, divisible: 1, starts: 15, biggest: 5, cell: 9},
        inspectDisplay: true, waitForDisplay: true
    });
    assert.ok(Math.abs(sample.piValue - Math.PI) < 1e-9);
});
