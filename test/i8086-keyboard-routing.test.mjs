// The host half of the keyboard: browser key -> set-1 scancode -> runner.keyIn.
//
// The machine has had the hardware since the support-chip lane wired the 8255
// to the PIC, and the debug target has exposed keyIn() since bw-board 6c0b9f1.
// This is the piece that makes a person able to type: the map, the make/break
// discipline, and the capability gate that decides whether a keyboard is
// offered at all.
//
// These source checks protect the keyboard map, make/break handling, and
// the handoff into Controller. verify-i8086-browser.mjs exercises the same
// handoff with physical key events in the rendered application.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const vdp = readFileSync(resolve(repo,
    'node_modules/bw-circuit-ui/src/components/VdpScreen.jsx'), 'utf8');
const runner = readFileSync(resolve(repo,
    'overlay/scratch-gui/src/lib/bw-debug/debug-runner.js'), 'utf8');
const panel = readFileSync(resolve(repo,
    'overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx'), 'utf8');
const gui = readFileSync(resolve(repo,
    'overlay/scratch-gui/src/components/gui/gui.jsx'), 'utf8');

/** Pull the scancode table out of the source and evaluate it. */
function scancodeMap() {
    const m = /const BROWSER_TO_SCANCODE = \{([\s\S]*?)\n\};/.exec(vdp);
    assert.ok(m, 'the scancode table is gone or renamed — this gate reads nothing');
    return Function(`return {${m[1]}}`)();
}

test('the map uses physical code with React 16 native-event fallback, not e.key', () => {
    // e.key is the CHARACTER after modifiers, so a map keyed on it sends the
    // code for '1' when someone types '!' — the same key, a different scancode
    // in the map's eyes. Set 1 is positional and so is e.code.
    assert.equal((vdp.match(/BROWSER_TO_SCANCODE\[e\.code \?\? e\.nativeEvent\?\.code\]/g) || []).length, 2,
        'keydown and keyup must use the physical code even when React 16 omits the synthetic code');
    assert.doesNotMatch(vdp, /BROWSER_TO_SCANCODE\[e\.key\]/,
        'e.key would mis-send shifted keys');
    const map = scancodeMap();
    // Spot values from the real set-1 table, chosen across the whole range.
    for (const [code, sc] of [['KeyA', 0x1e], ['KeyZ', 0x2c], ['Digit1', 0x02],
        ['Enter', 0x1c], ['Space', 0x39], ['Escape', 0x01], ['ShiftLeft', 0x2a],
        ['F1', 0x3b], ['ArrowUp', 0x48]]) {
        assert.equal(map[code], sc, `${code} is ${sc.toString(16)}h in set 1`);
    }
    for (const [code, sc] of Object.entries(map)) {
        assert.ok(sc >= 0x01 && sc <= 0x7f,
            `${code} = ${sc}: a MAKE code must fit in seven bits, because bit 7 IS the break flag`);
    }
});

test('release sends the break code, and blur releases everything still down', () => {
    // A machine learns a key came up ONLY from its break code. Send makes and
    // no breaks and every modifier sticks down forever inside the emulated
    // machine, and every later keystroke arrives modified.
    assert.match(vdp, /sendScancodeFn\(sc \| 0x80\)/,
        'keyup must send make|0x80');
    assert.match(vdp, /for \(const sc of heldCodesRef\.current\) sendScancodeFn\(sc \| 0x80\)/,
        'blur must send a break for everything still held — clicking away mid-keypress '
        + 'otherwise leaves Shift down inside the machine with no way to learn otherwise');
});

test('the keyboard is offered ONLY when the machine can take a key', () => {
    // The capability gate. A board with no PPI (nowhere to latch) or no PIC
    // (no wire to raise IRQ1) declares keys: [], and a user who types into it
    // would see nothing happen — indistinguishable from a program ignoring
    // input. Same stance as runner.video for serial-only machines.
    assert.match(runner, /caps\.keys[\s\S]{0,40}includes\('scancode'\)/,
        'debug-runner must gate runner.keyIn on the declared capability');
    assert.match(runner, /delete runner\.keyIn/,
        'and must REMOVE it otherwise, not leave a stale one from a previous machine');
    assert.match(panel, /keyInFn: spectrum[^\n]+\n\s+: typeof runner\.keyIn === 'function' \? sc => runner\.keyIn\(sc\) : null/,
        'the Controller screen receives a scancode handler only for a capable runner');
    assert.match(panel, /if \(kbd && typeof runner\.keyIn === 'function'[\s\S]*?bwSteerMachineKeyboard\(\{keyInFn: sc => runner\.keyIn\(sc\), widget: kbd\}\)/,
        'the Controller keyboard is attached only for a capable runner');
    assert.match(gui, /keyIn: typeof p\.keyInFn === 'function' \? p\.keyInFn : null/,
        'Controller retains the absence of keyboard input when mounting the screen');
});

test('scancodes take precedence over the Spectrum matrix', () => {
    // A machine offering real scancodes must not have its keys routed through
    // a ZX matrix: that would translate a PC key to a Spectrum name and back,
    // losing every key with no Spectrum equivalent.
    assert.match(vdp, /const useUlaKeys = !useScancodes &&/,
        'the matrix path must yield to the scancode path');
});
