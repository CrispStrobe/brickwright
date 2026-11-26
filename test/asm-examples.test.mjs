/**
 * The ASM tab's starter programs, and the one thing that makes them worth
 * shipping: they assemble.
 *
 * An empty assembly editor is a wall for anyone who has not written 8051
 * or 6502 before, which is why these exist (ROADMAP 3.3). But an example
 * that does not build is worse than no example — the reader cannot tell
 * whether they mistyped it or it was always wrong, and the tab's own
 * ▶ Assemble & Run is the thing that tells them.
 *
 * So the gate posts every one to the SAME hosted assembler the button
 * uses. That needs the network, so it skips when there is none rather
 * than reporting a pass it did not earn — and the structural checks below
 * it always run.
 *
 * ONE TAB, TWO ASSEMBLERS, so this file covers ONE OF THEM. The 8086's
 * examples are assembled in the browser (`lib/bw-asm/assemble-route.js`
 * argues for why), and posting them here is exactly the mistake the routing
 * exists to prevent — the hosted service answers "unknown assemble target
 * 'i8086'", which is the correct answer to a question nobody should ask it.
 * The split below is taken from `asmRouteFor`, the same function the ▶
 * button uses, rather than from a list repeated here: a second copy of the
 * routing rule is a second thing that can disagree with the button.
 * `test/i8086-asm-examples.test.mjs` covers the local half, and covers it
 * harder — it assembles AND RUNS every one, with no network to excuse it.
 */

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {REPO} from './helpers/bw-integrated.mjs';
import {
    asmExamplesFor, ALL_ASM_EXAMPLES, LOCAL_ASM_EXAMPLES
} from '../overlay/scratch-gui/src/lib/bw-asm/examples.js';
import {asmRouteFor} from '../overlay/scratch-gui/src/lib/bw-asm/assemble-route.js';

/** The examples this file is responsible for: the hosted half. */
const HOSTED_EXAMPLES = ALL_ASM_EXAMPLES.filter(e => asmRouteFor(e.target) === 'hosted');

const ASSEMBLER = 'https://stc-compiler.vercel.app/assemble';

/** Is the hosted assembler reachable? Decided once. */
const online = await (async () => {
    try {
        const res = await fetch(ASSEMBLER, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({asm: '    .area CODE (ABS)\n    nop\n', target: 'stc12c5a60s2'}),
            signal: AbortSignal.timeout(30000)
        });
        return (await res.json()).success === true;
    } catch (e) {
        return false;
    }
})();
const NET = online ? false : 'the hosted assembler is not reachable';

test('every device that can assemble has starter programs', () => {
    // The families /assemble supports. A device offering the ▶ button and
    // no examples is the wall this work exists to remove.
    for (const device of ['stc12c5a60s2', 'stc89c52rc', 'eater6502', 'z80', 'i8086', '8088']) {
        assert.ok(asmExamplesFor(device).length > 0, `${device} has no examples`);
    }
    // And a device with no assemble path must not be offered any.
    assert.deepEqual(asmExamplesFor('microbit'), []);
    assert.deepEqual(asmExamplesFor(''), []);
});

test('each example is complete enough to be a program', () => {
    for (const ex of ALL_ASM_EXAMPLES) {
        assert.match(ex.id, /^[a-z][a-z0-9-]*$/, `${ex.id} is not a usable id`);
        assert.ok(ex.label && ex.labelDe, `${ex.id} is missing a locale label`);
        assert.ok(ex.source.includes('\n'), `${ex.id} is a one-liner`);
        // A comment at the top: these are read before they are run, and an
        // unexplained wall of mnemonics is the same wall in a new shape. The
        // comment marker is the assembler's own — ';' for the 8051/6502/Z80/8086
        // set, '#' for RISC-V.
        assert.match(ex.source.trimStart()[0], /[;#]/, `${ex.id} opens without a comment`);
    }
});

test('the ids are unique within a device family', () => {
    for (const device of ['stc12c5a60s2', 'eater6502', 'z80', 'i8086']) {
        const ids = asmExamplesFor(device).map(e => e.id);
        assert.equal(new Set(ids).size, ids.length, `${device} has a duplicate id`);
    }
});

test('the two halves partition the examples, and neither is empty', () => {
    // A local set that quietly became empty would make this file's split
    // vacuous and i8086-asm-examples.test.mjs pass by having nothing to do.
    assert.ok(LOCAL_ASM_EXAMPLES.length > 0, 'no examples take the local route');
    assert.ok(HOSTED_EXAMPLES.length > 0, 'no examples take the hosted route');
    assert.equal(HOSTED_EXAMPLES.length + LOCAL_ASM_EXAMPLES.length, ALL_ASM_EXAMPLES.length,
        'an example belongs to exactly one route, and one of them was counted twice or not at all');
    for (const ex of LOCAL_ASM_EXAMPLES) {
        assert.equal(asmRouteFor(ex.target), 'local',
            `${ex.id} is listed as local but the ▶ button would post it to the hosted assembler`);
    }
});

for (const ex of HOSTED_EXAMPLES) {
    test(`${ex.target}/${ex.id} assembles`, {skip: NET}, async () => {
        const res = await fetch(ASSEMBLER, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({asm: ex.source, target: ex.target}),
            signal: AbortSignal.timeout(60000)
        });
        const out = await res.json();
        assert.equal(out.success, true,
            `${ex.id}: ${JSON.stringify(out.errors || out.error || out).slice(0, 300)}`);
        assert.ok(out.bytes > 0, `${ex.id} assembled to nothing`);
        if (ex.target === 'eater6502' && ex.id === 'blink') {
            const rom = Buffer.from(out.base64, 'base64');
            assert.equal(rom.readUInt16LE(rom.length - 4), 0x8000, 'Blink starts at its reset routine');
        }
    });
}

test('the tab offers them, and does not eat what you typed', () => {
    const src = readFileSync(
        join(REPO, 'overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx'),
        'utf8');
    assert.match(src, /'bw-asm-examples-menu' : 'bw-asm-examples'/, 'no example picker in the ASM tab');
    assert.match(src, /loadAsmExample/);
    // Replacing a non-empty buffer without asking is how someone loses
    // twenty minutes of assembly to a mis-click. The answer is awaited (task E6): in the
    // desktop/iOS app `window.confirm` returns a Promise, which is always truthy.
    assert.match(src, /if \(current && !\(await confirmAsync\(this\.L\.asmExampleReplace\)\)\) return;/);
    for (const key of ['asmExampleLabel', 'asmExamplePick', 'asmExampleReplace', 'asmExampleLoaded']) {
        assert.equal(src.split(`${key}:`).length - 1, 2, `${key} is not in both locales`);
    }
});
