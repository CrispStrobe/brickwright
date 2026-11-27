// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
import vectorArt from '../overlay/scratch-gui/src/lib/sb3-creator-vector-art.js';
import examples from '../overlay/scratch-gui/src/lib/sb3-creator-examples.js';
import games from '../overlay/scratch-gui/src/lib/sb3-creator-game-examples.js';
import {projectJsonToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';

SB3Creator.registerVectorArt(vectorArt);
const convert = (source, mutate = () => {}) => {
    const creator = new SB3Creator();
    creator.parse(source);
    assert.deepEqual(creator.warnings, []);
    mutate(creator.project);
    return projectJsonToArcade(JSON.stringify(creator.project), {
        costumeSvg: (target, costume) => creator.assets.get(costume.assetId)?.data || null,
        soundData: (target, sound) => creator.assets.get(sound.assetId)?.data || null
    });
};

test('Rift Rally exports two independent d-pads and the three live monitors', () => {
    const result = convert(games.twinwall);
    assert.deepEqual(result.unsupported, []);
    assert.match(result.ts, /keymap\.setPlayerKeys\(1, keymap\.KeyCode\.W, keymap\.KeyCode\.S/);
    assert.match(result.ts, /keymap\.setPlayerKeys\(2, keymap\.KeyCode\.UpArrow, keymap\.KeyCode\.DownArrow/);
    assert.match(result.ts, /controller\.up\.isPressed\(\)[\s\S]+ly \+= 9/);
    assert.match(result.ts, /controller\.down\.isPressed\(\)[\s\S]+ly \+= -9/);
    assert.match(result.ts, /controller\.player2\.up\.isPressed\(\)[\s\S]+ry \+= 9/);
    assert.match(result.ts, /controller\.player2\.down\.isPressed\(\)[\s\S]+ry \+= -9/);
    assert.match(result.ts, /game\.onShade/);
    for (const label of ['score', 'lives', 'bricks']) assert.ok(result.ts.includes(`"${label}: "`));
    assert.equal(new Set(result.ts.match(/__bwMonitorVisible_* = true/g)).size, 3);
    assert.equal(new Set(result.ts.match(/__bwMonitorVisible_* = false/g)).size, 3);
});

test('an ordinary arrow-only program keeps the stock controller mapping', () => {
    const result = convert(`GLOBAL hits
STAGE:
  WHEN left arrow key pressed:
    change hits by 1`);
    assert.deepEqual(result.unsupported, []);
    assert.match(result.ts, /controller\.left\.onEvent/);
    assert.doesNotMatch(result.ts, /keymap\.setPlayerKeys/);
});

test('additional Scratch keys receive different channels from the start key', () => {
    const result = convert(games.triple_bingo);
    const keyGaps = result.unsupported.filter(reason => /pressed \(Arcade/.test(reason));
    assert.deepEqual(keyGaps, []);
    for (const key of ['Space', 'Q', 'B', 'M']) assert.ok(result.ts.includes(`keymap.KeyCode.${key}`));
    const buttonEvents = [...result.ts.matchAll(/(controller\.[\w.]+)\.onEvent\(ControllerButtonEvent\.Pressed/g)]
        .map(([, name]) => name);
    assert.equal(new Set(buttonEvents).size, 4);
});

test('saved monitor visibility uses the variable ID and stale monitor references are reported', () => {
    const source = `GLOBAL count
STAGE:
  WHEN flag clicked:
    show variable count
    change count by 2
  WHEN space key pressed:
    hide variable count`;
    const result = convert(source, project => {
        const stage = project.targets.find(target => target.isStage);
        const id = Object.keys(stage.variables)[0];
        project.monitors = [{id, opcode: 'data_variable', params: {VARIABLE: 'count'}, visible: true}];
    });
    assert.deepEqual(result.unsupported, []);
    assert.match(result.ts, /let __bwMonitorVisible = true/);
    assert.match(result.ts, /screen\.print\(label/);
    const stale = convert(source, project => {
        const stage = project.targets.find(target => target.isStage);
        Object.values(stage.blocks).find(block => block.opcode === 'data_showvariable').fields.VARIABLE[1] = 'absent';
    });
    assert.deepEqual(stale.unsupported, ['data_showvariable: variable monitor has no unambiguous saved owner']);
});

test('Scratch thoughts preserve the text, duration and speaker in the Arcade bubble', () => {
    const result = convert(`SPRITE Reader:
  WHEN flag clicked:
    think "What now?" for 2 seconds
STAGE:
  WHEN flag clicked:
    think "Ready"`);
    assert.deepEqual(result.unsupported, []);
    assert.ok(result.warnings.includes('Scratch thoughts use Arcade text bubbles'));
    assert.match(result.ts, /ReaderSprite\.sayText\("What now\?", 2 \* 1000, true\)/i);
    assert.match(result.ts, /_bwStageSpeech\.sayText\("Ready"\)/);
});

test('the PyBadge example preserves its screen variable under a name that compiles in Arcade', () => {
    const source = readFileSync(new URL('../overlay/scratch-gui/examples/pybadge01-hello/program.bw', import.meta.url), 'utf8');
    const result = convert(source);
    assert.deepEqual(result.unsupported, []);
    assert.match(result.ts, /let screen_\b/);
    assert.match(result.ts, /screen_ = board/);
    assert.doesNotMatch(result.ts, /let screen[ =]/);
});


test('Digital Art changes pen hue while drawing through the native Arcade palette', () => {
    const result = convert(examples.art);
    assert.deepEqual(result.unsupported, []);
    assert.ok(result.warnings.includes('Scratch pen hue is quantized to the Arcade palette.'));
    assert.match(result.ts, /_scratchPenHue\(PenSprite, 4, true, __bwScratchHueTable\)/);
    assert.match(result.ts, /PenSprite\.data\["_pcBase"\] = PenSprite\.data\["_pc"\]/);
    assert.match(result.ts, /function _penLine/);
});

test('shipped size expressions stay numeric in Arcade', () => {
    for (const id of ['rim_reactor', 'trench_signal', 'prism_spire', 'shard_sheriff', 'triple_bingo']) {
        const lines = convert(games[id]).ts.split('\n').filter(line => line.includes('.setScale('));
        assert.ok(lines.length > 0, `${id} must still export its sprite size`);
        assert.ok(lines.every(line => !/"[^"]*%[^"]*"/.test(line)), `${id} exports a percent suffix as text`);
    }
});
