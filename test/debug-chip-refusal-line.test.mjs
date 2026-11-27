// The debugger's chip-refusal line: the first consumer of the collector.
//
// The chips on the 8086 board have always recorded what they will not do. Until
// 2026-09-05 nothing outside each chip read any of it, so a driver programming
// memory-to-memory left a precise record in a field no consumer ever asked for.
// I8086Machine.chipRefusals() collected them; this is the first thing that
// SHOWS them, which is the half that makes the collector worth having. An
// announcement with no reader is the same silence it replaced.
//
// WHAT IS GATED HERE, and why each is not the others:
//
//   1. A real 8086 program — not a poked field — reaches the panel's model. The
//      test assembles `out 08h, al` and runs it, because "the chip records it"
//      and "a program that does the thing records it" are different claims and
//      only the second is what a learner will hit.
//   2. A clean machine produces NO line. Without this, a model that returned a
//      constant row would pass (1), and the row asserted there would be evidence
//      of nothing.
//   3. The model reads ONLY chipRefusals(). Asserted by construction — a fake
//      machine that exposes the collector and NOTHING ELSE still produces the
//      line — and by source, so the panel cannot grow a shortcut into
//      machine.chips later and keep passing.
//   4. The row shape comes from the imported contract, never a retyped list.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {I8086Machine, PCXT8086, BREADBOARD8086}
    from 'bw-board/i8086-machine.js';
import {assembleRaw} from 'bw-board/i8086-asm.js';
import {createI8086DosBench} from '../overlay/scratch-gui/src/lib/bw-debug/i8086-dos-bench.js';
import {chipRefusalLines, chipRefusalLine, formatAnchor, formatCount}
    from '../overlay/scratch-gui/src/lib/bw-debug/chip-refusal-lines.js';
import {ROW_FIELDS} from 'bw-board/chip-ledger.js';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Source with comments removed.
 *
 * NOT AN OPTIMISATION — the first version of the gate below failed on its own
 * documentation. The runner carries a comment saying "reaching into
 * adapter.machine.chips would work today and would quietly stop being the whole
 * story", which is exactly the sentence that should be there, and a rule
 * matching the plain text of the thing it forbids goes red on the explanation of
 * why it is forbidden. That is lego-be's twenty-second species — a rule that
 * matches its own output — reached from the other end, and the only fix that
 * does not punish writing the comment is to read code as code.
 */
const code = (text) => text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

/** Run a short program in the vendored machine and return it. */
function ran (source, config = PCXT8086) {
    const m = new I8086Machine(config);
    m.mem.set(assembleRaw(`${source}\n hlt\n`, 0), 0x0600);
    Object.assign(m.cpu, {cs: 0, ip: 0x0600, ss: 0, sp: 0x7000, ds: 0, es: 0, halted: false});
    let steps = 0;
    while (steps < 100_000 && !m.cpu.halted) { m.step(); steps++; }
    assert.ok(m.cpu.halted, `the program did not reach its HLT in ${steps} steps`);
    return m;
}

test('a program that asks the 8237 for a block copy produces exactly one line', () => {
    // Command register bit 0 is memory-to-memory. This is what a DMA block-copy
    // driver writes, and the 8237 stores it and behaves as though it were clear
    // — indistinguishable, from the program's side, from a chip that honoured it
    // and had nothing to do.
    const m = ran(' mov al, 01h\n out 08h, al');
    const lines = chipRefusalLines(m.chipRefusals());
    assert.equal(lines.length, 1, `expected one line, got ${JSON.stringify(lines)}`);
    const [line] = lines;
    assert.equal(line.part, 'dma1');
    assert.match(line.text, /^dma1: /, 'the line leads with the part, so a reader knows who refused');
    assert.match(line.text, /moves nothing and the temporary register reads back zero/,
        'the line carries the SYMPTOM — what the program gets instead — not only the feature. '
        + 'A line naming the gap without naming the effect tells a learner what they are looking '
        + 'at and nothing about what it did to their code.');
    // WAS /at 08h/. The row now carries `space`, so the end-to-end line says
    // the stronger true thing. Tightened rather than loosened: an assertion
    // that still passed on "at 08h" would no longer be testing what the line
    // now claims.
    assert.match(line.text, /port 08h/,
        'the line carries the address the program touched. A symptom sentence cannot be clicked; '
        + 'the debugger points at the instruction with this.');
    assert.doesNotMatch(line.text, /refusals/,
        'one occurrence must not print a count — "1 refusals" is noise that makes a real count '
        + 'harder to notice');
});

test('the breadboard bench refuses through its 8255, based at port 0', () => {
    // BREADBOARD8086 IS NOT THE ASM BENCH, and this test's original name said it
    // was — the mistake that cost two CI runs, left here corrected rather than
    // quietly renamed. This config is what a ROM loaded through the Machine
    // Loader's file input gets; the ASM tab gets the DOS bench, pinned above.
    // Its 8255 is based at 0, so the control register is port 03h — the same
    // number the DOS bench reports for a chip at 60h, which is the offset-versus-
    // port confusion raised upstream. The 8237 the test above uses lives on PCXT8086, the
    // config the BIOS and Machine Loader routes build.
    //
    // The first version of that browser gate wrote the memory-to-memory command
    // to port 08h and waited forty seconds for a line that could never appear:
    // the port decoded to nothing, nothing refused anything, and the timeout read
    // as a broken panel rather than as a program aimed at absent hardware. This
    // assertion is here so the next config change fails in a two-second node run
    // instead of a forty-second browser one.
    const chips = Object.keys(new I8086Machine(BREADBOARD8086).chips);
    assert.deepEqual(chips.sort(), ['ppi1', 'uart1'],
        `the ASM bench's chips changed to ${chips.join(', ')} — the browser gate's program targets `
        + "ppi1's control port and must be retargeted with them");
    // ppi1 is at port 0, so its control port is 3. A0h selects mode 1 on group A:
    // what a driver writes wanting the strobed handshake, which the 8255 accepts
    // and runs as mode 0.
    const lines = chipRefusalLines(ran(' mov al, 0A0h\n out 03h, al', BREADBOARD8086).chipRefusals());
    assert.equal(lines.length, 1, `expected one line, got ${JSON.stringify(lines)}`);
    assert.equal(lines[0].part, 'ppi1');
    assert.match(lines[0].text, /waits on a bit that never moves/,
        'the symptom must say what the PROGRAM sees — a status bit that never moves — not merely '
        + 'that a mode is unmodelled');
    // 03h HERE IS CORRECT AND STAYS CORRECT: this board bases its 8255 at 0, so
    // the control register IS port 03h. The DOS bench's 63h and this 03h are the
    // same register on two boards, which is what bw-board 2e7143af7 made
    // expressible — before it, both said 03h and only this one was honest.
    assert.match(lines[0].text, /port 03h/,
        'the control port the mode word arrived on, and now SAID to be a port');
    // And the clean program the browser gate runs first must stay clean here too.
    assert.deepEqual(chipRefusalLines(ran(' mov al, 00h\n mov bl, al', BREADBOARD8086).chipRefusals()), [],
        "the browser gate's absent case produces a line on this bench, so its first assertion "
        + 'would be proving nothing');
});

test('the DOS bench the ASM tab boots has chips, and its 8255 is at 60h', async () => {
    // THE ASSERTION THAT WOULD HAVE SAVED TWO CI RUNS. The browser gate drives
    // the Code tab, which always sends profile 'dos', so the bench it gets is
    // this one. I twice wrote a program aimed at a port this bench does not
    // decode — the 8237 at 08h, then the 8255 control register at 03h — read
    // the resulting silence as "this bench has no chips", and found a header
    // comment saying exactly that. The comment describes the bench's ORIGINAL
    // shape; the caller merges declared chips now and the base config carries
    // three. A source comment agreeing with a mis-aimed probe is the shape this
    // repo catalogues, and I reached it by reading where probing was quicker.
    //
    // So the bench's chip set and its 8255's BASE are pinned here, in node, at
    // two seconds, rather than discovered from a forty-second browser timeout.
    const bench = await createI8086DosBench({
        bytes: assembleRaw(' mov al, 0A0h\n out 63h, al\nhere:\n jmp here\n', 0x100),
        format: 'com'});
    const m = bench.machine || bench.target?.machine;
    assert.ok(m, 'the DOS bench exposes no machine, so nothing below can be read');
    assert.deepEqual(Object.keys(m.chips).sort(), ['pit1', 'ppi1', 'spk'],
        `the DOS bench's chips changed to ${Object.keys(m.chips).join(', ')} — the browser gate's `
        + 'program targets ppi1 and must be retargeted with them');

    let steps = 0;
    while (steps < 50_000 && !m.cpu.halted && !m.chipRefusals().length) { m.step(); steps++; }
    const lines = chipRefusalLines(m.chipRefusals());
    assert.equal(lines.length, 1, `expected one line, got ${JSON.stringify(lines)}`);
    assert.equal(lines[0].part, 'ppi1');
    assert.match(lines[0].text, /waits on a bit that never moves/);
    // 03h AND NOT 63h, and the difference is the finding. The 8255 records the
    // control register's OFFSET WITHIN THE CHIP (3), not the ISA port it was
    // reached through (63h here, 03h only on a breadboard based at zero). The
    // row calls that space 'port'. So the same chip on two boards reports the
    // same number for two different things — raised with lego-be as an upstream
    // item. Pinned to what the row ACTUALLY says, so this gate tracks the
    // shipped contract rather than what the wording suggests.
    // TWO ASSERTIONS, ANSWERING DIFFERENT QUESTIONS, and neither substitutes for
    // the other. A faithful renderer showing a wrong number passes the first; a
    // correct number badly rendered passes the second.
    //
    // FIRST: the renderer is faithful to the ledger, whatever the ledger says.
    // True before bw-board 2e7143af7 and after it, so it cannot go stale — which
    // the number below can, and did.
    const [row] = m.chipRefusals();
    const hex = (n) => `${n.toString(16).toUpperCase().padStart(2, '0')}h`;
    assert.match(lines[0].text, new RegExp(`port ${hex(row.at)}`),
        `the panel drew an address the collector did not report: row.at=${hex(row.at)}, `
        + `line=${JSON.stringify(lines[0].text)}`);

    // SECOND: the ledger currently says the right thing FOR THIS BOARD. This
    // number is the vendored contract's and MOVES WHEN THE PIN MOVES — it read
    // 03h until bw-board 2e7143af7, which made `at` the bus port rather than the
    // register offset, so a chip based at 60h now reports 63h and the same chip
    // on a breadboard based at 0 still reports 03h. Two different true things
    // where before both said 03h and only one board was honest.
    //
    // THE MARKER THAT USED TO BE HERE DID ITS JOB, and is replaced rather than
    // removed. It read "if this ever reads 63h the upstream fix landed and the
    // browser gate's assertion moves with it" — and when lego-be measured the
    // rebased pin, that sentence came back verbatim as the failure message
    // instead of "expected /port 03h/ to match". The reason written INTO the
    // assertion told the story; the assertion alone would have told a puzzle.
    assert.match(lines[0].text, /port 63h/,
        'the DOS bench bases its 8255 at 60h, so its control register is port 63h. If this reads '
        + '03h the vendored bw-board pin predates 2e7143af7 and this gate is ahead of it; if it '
        + 'reads something else again, the contract moved and both this and the browser gate '
        + 'follow it.');
});

test('a machine that has refused nothing produces no line at all', () => {
    // The other direction of species 1. A constant row would satisfy the test
    // above; this is what makes that row evidence of the program that caused it.
    const m = new I8086Machine(PCXT8086);
    assert.deepEqual(chipRefusalLines(m.chipRefusals()), [],
        'a fresh bench is reporting refusals, so the line above is not caused by the program '
        + 'that appears to cause it');
    // And after a program that touches nothing unmodelled.
    assert.deepEqual(chipRefusalLines(ran(' mov al, 00h').chipRefusals()), [],
        'a program that asks for nothing unmodelled produced a refusal line');
});

test('the model reads the collector and nothing else — proved by construction', () => {
    // A machine with the collector and NO chips at all. If the model reached
    // into machine.chips for any part of the line, this throws or returns
    // nothing; it returns the line, so the collector is the only input.
    const collectorOnly = {
        chipRefusals: () => [{part: 'dma1', kind: 'chip', feature: 'memory-to-memory transfer',
            symptom: 'a block copy moves nothing', count: 1, at: 0x08, ats: [0x08], atsMore: false}]
    };
    const lines = chipRefusalLines(collectorOnly.chipRefusals());
    assert.equal(lines.length, 1);
    assert.match(lines[0].text, /dma1: a block copy moves nothing — at 08h/);
});

test('the panel reaches refusals only through debugChipRefusals', () => {
    // Source, not behaviour, because the failure this catches is a FUTURE edit:
    // someone adding `runner.machine.chips.dma1.unmodelled` to the panel for one
    // more field would work, would pass every behavioural test above, and would
    // silently stop being the whole story on the next chip the board gains.
    const panel = code(readFileSync(join(repo,
        'overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx'), 'utf8'));
    assert.match(panel, /debugChipRefusals\(\)/,
        'the panel does not call debugChipRefusals at all, so this gate is checking nothing');
    // The stripper must strip. If it silently returned the text unchanged this
    // gate would be back to failing on comments, and if it stripped too much it
    // would pass on real code — so both directions are pinned on a fixture.
    assert.equal(code('a(); // .chips. here\nb();').includes('.chips.'), false);
    assert.equal(code('/* unmodelled */ keep();').includes('unmodelled'), false);
    assert.equal(code("const u = 'https://x/y'; // c").includes('https://x/y'), true,
        'the stripper ate a URL, so it is removing code and this gate proves nothing');
    for (const forbidden of ['chipRefusals()', '.chips.', 'unmodelled', 'lastRefusal', 'modeWarning']) {
        assert.ok(!panel.includes(forbidden),
            `debug-panel.jsx names '${forbidden}'. The panel must reach refusals only through the `
            + 'runner handle, so a chip added later arrives with no panel edit — and a panel that '
            + 'knows a chip field is a panel that has to be edited when the next chip differs.');
    }
    // And the runner's own path is the collector, not the chip map.
    const runner = code(readFileSync(join(repo,
        'overlay/scratch-gui/src/lib/bw-debug/debug-runner.js'), 'utf8'));
    assert.match(runner, /adapter\.machine\?\.chipRefusals/,
        'the runner no longer captures the collector by name');
    const bench = runner.slice(runner.indexOf('function wireMachineBench('), runner.indexOf('async function attachEater6502('));
    assert.ok(bench.length > 100);
    assert.ok(!/adapter\.machine\.chips\b/.test(bench),
        'the runner reaches into machine.chips for refusals; the collector is the only supported path');
    // EVERY BENCH MUST HAND ITS COLLECTOR OVER, and one of them cannot do it
    // through the adapter. The DOS bench — which is what the Code tab boots, so
    // it is the bench most programs actually run on — passes `adapter: {}` on
    // purpose, so a runner that looks only at adapter.machine reports "no
    // collector" for it. It did, for a day, while that bench had three chips and
    // a working ledger. The wiring is asserted here because it is invisible from
    // the model's side and cost a CI run to find.
    assert.match(runner, /chipRefusals: \(\) => bench\.machine\.chipRefusals\(\)/,
        'the DOS bench no longer hands its collector to wireMachineBench, so every refusal a '
        + 'program produces on the Code tab is invisible to the panel');
    assert.match(runner, /typeof result\.chipRefusals === 'function' \? result\.chipRefusals/,
        'wireMachineBench no longer prefers an explicitly passed collector, so the DOS bench '
        + 'has no way to supply one');
});

test('the row shape is the imported contract, not a list retyped here', () => {
    // ROW_FIELDS is bw-board's single machine-readable copy of the shape its
    // CHIP-REFUSALS.md explains. lite restated it once, in a gate, and the fix
    // upstream was to export it — a doc is the right place to EXPLAIN a contract
    // and the wrong place to be its only machine-readable copy. So the assertion
    // is that the collector's row matches the CONTRACT, with no third list.
    assert.ok(Array.isArray(ROW_FIELDS) && ROW_FIELDS.length > 0,
        'ROW_FIELDS is not an array, so every check below is vacuous');
    const m = ran(' mov al, 01h\n out 08h, al');
    const [row] = m.chipRefusals();
    assert.deepEqual(Object.keys(row).sort(), [...ROW_FIELDS].sort(),
        'the collector row and the imported contract disagree. One of them moved without the '
        + 'other, which is the drift ROW_FIELDS exists to make impossible.');
    assert.equal(row.at, row.ats[0],
        '`at` is derived as the FIRST address, not a second claim, so the two cannot disagree');
});

test('the anchor renders the set and the count separately, and says when it truncated', () => {
    // `ats` is a set because `count` is a total. The ledger's first version kept
    // one `at` that a later address overwrote, so a feature refused at two ports
    // printed count: 2 beside ONE address — a true count next to a location that
    // quantified over less than the count did. Folding them back together in the
    // renderer would rebuild that defect one layer up.
    const base = {part: 'p', kind: 'chip', feature: 'f', symptom: 's', count: 1,
        at: 0x08, ats: [0x08], atsMore: false};
    assert.equal(formatAnchor(base), 'at 08h');
    assert.equal(formatCount(base), null, 'a single occurrence prints no count');
    assert.equal(formatAnchor({...base, ats: [0x08, 0x0b]}), 'at 08h, 0Bh');
    assert.equal(formatCount({...base, count: 3}), '3 refusals');
    assert.equal(formatAnchor({...base, ats: [0x08, 0x0b], atsMore: true}), 'at 08h, 0Bh and more',
        'AT_CAP truncation must be visible: a capped list that does not say so reads as complete, '
        + 'and a debugger showing eight ports when the program touched thirty is lying by omission');
    // null means "no anchor, render the sentence alone" — never 0. An invented
    // address points the debugger somewhere the program never touched.
    assert.equal(formatAnchor({...base, at: null, ats: []}), null);
    assert.equal(chipRefusalLine({...base, at: null, ats: []}).text, 'p: s');
});

test('a row with nothing sayable is dropped rather than rendered blank', () => {
    // "dma1: " tells a learner something is wrong and refuses to say what, and
    // reads as a rendering bug rather than a missing symptom — so it gets
    // reported to the wrong lane.
    assert.deepEqual(chipRefusalLines([{part: 'dma1', kind: 'chip', feature: null, symptom: null,
        count: 1, at: null, ats: [], atsMore: false}]), []);
    assert.equal(chipRefusalLine({part: '', symptom: 'x'}), null);
});

test('the anchor names the space it is an address in, both kinds', () => {
    // The contract request this file's header raised, answered upstream at
    // bw-board fad7a3d and landed here.
    //
    // "at 08h" was true and weak: an 8237 port and an OPL register both reach
    // this function as a bare integer, so the line could not say which it held
    // without a part-to-space table on this side -- a second list that has to
    // agree with bw-board's chips, which is the shape this file argues against.
    // The chip declares it where the refusal is WRITTEN. The writing end knows;
    // the reading end does not.
    const base = {part: 'p', kind: 'chip', feature: 'f', symptom: 's', count: 1,
        at: 0x08, ats: [0x08], atsMore: false};

    assert.equal(formatAnchor({...base, space: 'port'}), 'port 08h');
    assert.equal(formatAnchor({...base, at: 0xbd, ats: [0xbd], space: 'register'}), 'register BDh',
        'the YM3812 reports the OPL register index, not the ISA port -- its port '
        + 'pair is two wide and joins to nothing, and it is why this field exists');

    // The set and the truncation flag survive the new word.
    assert.equal(formatAnchor({...base, ats: [0x08, 0x0b], space: 'port'}), 'port 08h, 0Bh');
    assert.equal(formatAnchor({...base, ats: [0x08, 0x0b], atsMore: true, space: 'port'}),
        'port 08h, 0Bh and more');

    // NOTHING IS INFERRED. A row from a chip that declares no space, or one
    // this renderer does not know, keeps the weaker word it can prove. That is
    // the same rule as the null anchor: say less rather than guess.
    assert.equal(formatAnchor(base), 'at 08h', 'no space declared: the bare anchor');
    assert.equal(formatAnchor({...base, space: 'somewhere-else'}), 'at 08h',
        'an unknown space is not passed through as a word -- a consumer reading '
        + '"somewhere-else 08h" would trust a label this renderer cannot vouch for');
    assert.equal(formatAnchor({...base, at: null, ats: [], space: 'port'}), null,
        'and a space with no address is still no anchor');
});

test('a full line reads the way a learner would say it', () => {
    const port = chipRefusalLine({part: 'dma1', kind: 'chip',
        feature: 'memory-to-memory transfer',
        symptom: 'a block copy moves nothing and the temporary register reads back zero',
        count: 1, at: 0x08, ats: [0x08], atsMore: false, space: 'port'});
    assert.match(port.text, /port 08h/);
    assert.doesNotMatch(port.text, /\bat 08h/,
        'the stronger word replaces the weaker one rather than joining it');

    const reg = chipRefusalLine({part: 'opl', kind: 'chip',
        feature: 'rhythm mode (BDh bit 5)',
        symptom: 'the five percussion voices are silent and channels 6-8 keep playing',
        count: 1, at: 0xbd, ats: [0xbd], atsMore: false, space: 'register'});
    assert.match(reg.text, /register BDh/);
});
