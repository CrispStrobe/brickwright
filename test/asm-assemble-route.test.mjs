/**
 * The ▶ button now has two assemblers, and this is what stops that from
 * becoming two bugs.
 *
 * `lib/bw-asm/assemble-route.js` argues for the inconsistency; the argument
 * is only worth anything if the three rules it claims are actually true:
 *
 *   1. ONE function decides. Asserted by driving the same `asmRouteFor` the
 *      component calls, and by reading the component to check it calls it —
 *      a route decided in two places is a route that can disagree with
 *      itself.
 *   2. NEITHER ROUTE LEAKS. An 8086 program must never be posted (ca65 does
 *      not have an 8086 back end; the hosted service answers "unknown
 *      assemble target 'i8086'", which is the right answer to a question
 *      nobody should ask it), and a 6502/Z80/8051 program must never reach
 *      the 8086 assembler, which would read its syntax as nonsense and blame
 *      the user's line numbers.
 *   3. THE RESULT SAYS WHICH ROUTE RAN.
 *
 * THE LOCAL PATH IS THE PRODUCTION ONE, not a copy. `requestAssembly`
 * defaults `assembleLocal` to `assembleLocal8086` and this file overrides
 * only the NETWORK. That is deliberate: the repo's named recurring defect is
 * "a test that supplied a precondition production code never supplies", and
 * a gate that injected its own assembler would prove that its own assembler
 * works.
 */

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {REPO} from './helpers/bw-integrated.mjs';
import {
    requestAssembly, asmRouteFor, asmTargetForDevice, LOCAL_ASM_TARGETS, HOSTED_ASSEMBLER,
    assembleLocal8086, AsmRouteError, ASM_DIALECTS
} from '../overlay/scratch-gui/src/lib/bw-asm/assemble-route.js';

/** A network that cannot be used without being noticed. */
const forbiddenFetch = () => {
    throw new Error('a program escaped to the hosted assembler');
};

const HELLO_8086 = `; smallest thing that proves the local route ran
.MODEL SMALL
.STACK 100h
.DATA
    msg DB "hi$"
.CODE
main PROC
    MOV AX, @DATA
    MOV DS, AX
    MOV AH, 09h
    LEA DX, msg
    INT 21h
    MOV AH, 4Ch
    INT 21h
main ENDP
END main
`;

test('the 8086 family — all four spellings — routes to the local assembler', () => {
    for (const device of ['i8086', '8086', 'i8088', '8088', 'I8086', '8088']) {
        assert.equal(asmTargetForDevice(device), 'i8086',
            `${device} did not resolve to the 8086 target`);
        assert.equal(asmRouteFor(device), 'local',
            `${device} would have been posted to an assembler with no 8086 back end`);
    }
});

test('every other device keeps the hosted route it already had', () => {
    for (const [device, target] of [
        ['eater6502', 'eater6502'], ['6502', 'eater6502'],
        // `w65c02` passes through as itself, which is the behaviour the ▶
        // button already had and is not a bug: the hosted service lists
        // w65c02 among its own targets, so it assembles. Pinned here so a
        // future tidy-up of this table cannot change it by accident.
        ['w65c02', 'w65c02'],
        ['z80', 'z80'], ['zx48', 'z80'], ['zx128', 'z80'],
        ['stc12c5a60s2', 'stc12c5a60s2'], ['atmega328p', 'atmega328p'],
        ['', 'stc12c5a60s2']
    ]) {
        assert.equal(asmTargetForDevice(device), target, `${device} mapped to the wrong target`);
        assert.equal(asmRouteFor(device), 'hosted',
            `${device} was diverted to the in-browser 8086 assembler, which does not speak its syntax`);
    }
    // An unknown device must go HOSTED, not local: the hosted service knows
    // about devices this file has never heard of, and the 8086 assembler
    // would read their source as garbage rather than refusing it.
    assert.equal(asmRouteFor('some-future-chip'), 'hosted');
    assert.deepEqual([...LOCAL_ASM_TARGETS], ['i8086', 'riscv32']);
});

test('the RISC-V console routes to the LOCAL RV32IM assembler', () => {
    for (const device of ['riscv32', 'riscv', 'RISCV32', 'rv32ima']) {
        assert.equal(asmTargetForDevice(device), 'riscv32',
            `${device} did not resolve to the riscv32 target`);
        assert.equal(asmRouteFor(device), 'local',
            `${device} would have been posted to an assembler with no RISC-V back end`);
    }
});

test('the local RISC-V route assembles source to a loadable {entry, segments} image', async () => {
    const out = await requestAssembly({
        source: '_start:\n  li a7, 93\n  li a0, 0\n  ecall\n', device: 'riscv32'});
    assert.equal(out.route, 'local');
    assert.equal(out.target, 'riscv32');
    assert.equal(out.format, 'riscv');
    assert.ok(out.image && Array.isArray(out.image.segments) && out.image.segments.length > 0,
        'the local RISC-V route produced no image');
    assert.equal(typeof out.entry, 'number', 'the image carries an entry PC');
});

test('an 8086 program is assembled without the network being touched', async () => {
    const out = await requestAssembly({source: HELLO_8086, device: 'i8086'},
        {hostedFetch: forbiddenFetch});
    assert.equal(out.route, 'local', 'the result must name the route it took');
    assert.equal(out.target, 'i8086');
    assert.ok(out.bytes.length > 0, 'the local route produced no image');
    // .MODEL SMALL cannot be a .COM: `MOV AX, @DATA` needs a relocation, and
    // the delivery has to say so or the bench loads an .EXE header as code.
    assert.equal(out.format, 'exe');
    assert.equal(out.slotId, 'exe');
    assert.equal(out.profile, 'dos',
        'a DOS executable must be labelled one — loaded as a ROM at F0000 it executes nothing');
    assert.equal(out.bytes[0], 0x4d);
    assert.equal(out.bytes[1], 0x5a);
});

test('a refusal from the local assembler is a SOURCE refusal, and names the line', async () => {
    await assert.rejects(
        () => requestAssembly({source: 'MOV AX, NOPE_NOT_A_SYMBOL\nEND\n', device: 'i8086'},
            {hostedFetch: forbiddenFetch}),
        (e) => {
            assert.equal(e.reason, 'source',
                'a program the assembler read and rejected is not a transport failure — ' +
                'conflating them sends people hunting for a syntax error in a working program');
            assert.equal(e.route, 'local');
            assert.match(e.message, /8086 asm/);
            return true;
        });
});

test('a 6502 program reaches the hosted service and nothing else', async () => {
    let posted = null;
    const out = await requestAssembly({source: '  lda #$00\n', device: 'eater6502'}, {
        assembleLocal: () => { throw new Error('the 8086 assembler was handed 6502 source'); },
        hostedFetch: async (url, init) => {
            posted = {url, body: JSON.parse(init.body)};
            return {ok: true, json: async () => ({success: true, base64: 'AAE='})};
        }
    });
    assert.equal(posted.url, HOSTED_ASSEMBLER);
    assert.deepEqual(posted.body, {asm: '  lda #$00\n', target: 'eater6502'});
    assert.equal(out.route, 'hosted');
    assert.equal(out.slotId, 'rom', 'a hosted build is a ROM image, as it always was');
    assert.equal(out.profile, null);
    assert.deepEqual([...out.bytes], [0, 1]);
});

test('a hosted syntax error and a hosted outage are told apart', async () => {
    await assert.rejects(
        () => requestAssembly({source: 'x', device: 'z80'}, {
            hostedFetch: async () => ({ok: true, json: async () => (
                {success: false, errors: [{line: 3, message: 'bad opcode'}]})})
        }),
        (e) => {
            assert.equal(e.reason, 'source');
            assert.match(e.message, /L3: bad opcode/);
            return true;
        });
    await assert.rejects(
        () => requestAssembly({source: 'x', device: 'z80'}, {
            hostedFetch: async () => { throw new Error('offline'); }
        }),
        (e) => {
            assert.equal(e.reason, 'transport',
                'an unreachable assembler is not the user\'s program being wrong');
            return true;
        });
});

test('the tab decides the route through this module, and in one place', () => {
    const src = readFileSync(
        join(REPO, 'overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx'),
        'utf8');
    // The button, the route, and the delivery.
    assert.match(src, /data-testid="bw-asm-assemble"/, 'the ▶ button is gone');
    assert.match(src, /from '\.\.\/\.\.\/lib\/bw-asm\/assemble-route\.js'/,
        'the tab no longer routes through assemble-route.js');
    assert.match(src, /out = await requestAssembly\(\{source, device, dialect: machine \? 'auto' : this\.state\.asmDialect\}\);/,
        'the ▶ handler must call requestAssembly with NO injected assembler — ' +
        'an override here is a second local path that no gate runs');
    assert.equal(src.split('stc-compiler.vercel.app/assemble').length - 1, 0,
        'the tab still posts to /assemble directly, so the routing can be bypassed');
    // The route reaches the user.
    assert.match(src, /asmRouteFor\(device\)/);
    assert.match(src, /routeName/, 'the status line must name which assembler ran');
    for (const key of ['asmRouteLocal', 'asmRouteHosted', 'asmSourceError', 'asmTransportError',
        'asmCredit', 'asmCreditTitle']) {
        assert.equal(src.split(`${key}:`).length - 1, 2, `${key} is not in both locales`);
    }
    // The device the examples are for and the device the button assembles
    // for must be ONE answer.
    assert.equal(src.split('_asmDevice ()').length - 1, 1, '_asmDevice is defined more than once');
    assert.match(src, /asmExamplesFor\(this\._asmDevice\(\)\)/);
    assert.match(src, /const device = machine\?\.device \|\| this\._asmDevice\(\);/);
});

test('an assembled 8086 image is delivered as a DOS executable, not as a ROM', () => {
    const importer = readFileSync(
        join(REPO, 'overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx'),
        'utf8');
    const panel = readFileSync(
        join(REPO, 'overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx'), 'utf8');
    const runner = readFileSync(
        join(REPO, 'overlay/scratch-gui/src/lib/bw-debug/debug-runner.js'), 'utf8');
    // Producer: the tab puts the slot and profile on the event.
    assert.match(importer, /slotId: out\.slotId, profile: out\.profile/,
        'the ASM tab drops the slot/profile, so the runner cannot tell a .COM from a ROM');
    // Consumer: the panel forwards them instead of hardcoding 'rom'.
    assert.match(panel, /slotId: slotId \|\| 'rom'/,
        'debug-panel still hardcodes the ROM slot, which is where the .COM would be lost');
    assert.match(panel, /target === 'i8086' \? 'i8086'/,
        'an 8086 image would be booted on the 6502 bench');
    assert.match(panel, /i8086: 'i8086'/,
        'the device→engine map has no 8086, so the panel would run the image as 8051 opcodes');
    // Consumer: the runner builds the DOS bench rather than refusing.
    assert.match(runner, /createI8086DosBench/,
        'debug-runner still refuses DOS executables, so nothing the ASM tab builds can run');
});

test('the engine picker can express every kind the panel can select', async () => {
    // A <select> whose value matches no option renders the FIRST option.
    // debug-panel selects 'i8086' from two maps; bw-board's getTargetKinds()
    // does not list it (the factory grew the target and the menu did not),
    // so without the merge the panel would run an 8086 image while its own
    // picker read "Simulated (STC12 / 8051)".
    //
    // This is not a regex check on the merge. It reads the panel's ACTUAL
    // selection tables, calls bw-board's ACTUAL list, and runs the SAME
    // merge function the panel calls.
    const {getTargetKinds} = await import(
        '../node_modules/bw-board/src/target-kinds.js');
    const {mergeTargetKinds} = await import(
        '../overlay/scratch-gui/src/lib/bw-debug/target-kinds.js');
    const src = readFileSync(
        join(REPO, 'overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx'), 'utf8');

    const selectable = new Set();
    for (const name of ['DEVICE_TO_KIND', 'CORE_TO_KIND']) {
        const at = src.indexOf(`const ${name} = {`);
        assert.notEqual(at, -1, `${name} is gone — this gate no longer reads what the panel selects`);
        const body = src.slice(at, src.indexOf('};', at));
        for (const m of body.matchAll(/:\s*'([a-z0-9_-]+)'/gi)) selectable.add(m[1]);
    }
    assert.ok(selectable.has('i8086'),
        'the panel cannot select the 8086 at all, so nothing reaches the 8086 engine');
    assert.ok(selectable.size >= 8, `only ${selectable.size} kinds parsed — the tables moved`);

    const offered = new Set(mergeTargetKinds(getTargetKinds()).map(k => k.kind));
    for (const kind of selectable) {
        assert.ok(offered.has(kind),
            `the panel can select '${kind}' and the picker has no option for it, so the ` +
            'picker would show a different engine than the one that is running');
    }
    // And the merge must not be doing it twice, now or after bw-board grows
    // its own entry.
    const twice = mergeTargetKinds(mergeTargetKinds(getTargetKinds()));
    assert.equal(twice.filter(k => k.kind === 'i8086').length, 1,
        'mergeTargetKinds is not idempotent, so the upstream fix would duplicate the entry');
});

// ---- the dialect selector (2026-09-05) ----------------------------------------

const NASM_HELLO = `bits 16
org 100h
section .text
start:
    mov dx, msg
    mov ah, 9
    int 21h
    mov ax, 4C00h
    int 21h
msg db 'hi$'
`;

test('requestAssembly threads the dialect to the local assembler and reports the one used', async () => {
    const seen = [];
    const assembleLocal = async (src, opts) => {
        seen.push(opts);
        return {bytes: new Uint8Array([0xc3]), format: 'com', dialect: opts.dialect};
    };
    const out = await requestAssembly({source: 'ret', device: 'i8086', dialect: 'nasm'}, {assembleLocal});
    assert.deepEqual(seen, [{target: 'i8086', dialect: 'nasm'}]);
    assert.equal(out.dialect, 'nasm');
    const auto = await requestAssembly({source: 'ret', device: 'i8086'}, {assembleLocal});
    assert.equal(seen[1].dialect, 'auto', 'no choice means auto, never a silent default to one syntax');
    assert.equal(auto.dialect, 'auto');
});

test('a dialect choice on a one-syntax target is refused by name, not ignored', async () => {
    await assert.rejects(
        requestAssembly({source: 'nop', device: 'z80', dialect: 'nasm'}, {hostedFetch: forbiddenFetch}),
        e => e instanceof AsmRouteError && /NASM dialect applies to the 8086 only; z80 has one syntax/.test(e.message));
    await assert.rejects(assembleLocal8086('ret', {dialect: 'gas'}), /only auto, masm and nasm exist/);
    assert.deepEqual([...ASM_DIALECTS], ['auto', 'masm', 'nasm']);
});

test('the real assembler honours the choice: NASM source assembles as nasm, is refused as masm', async () => {
    const asNasm = await assembleLocal8086(NASM_HELLO, {dialect: 'nasm'});
    assert.equal(asNasm.dialect, 'nasm');
    assert.ok(asNasm.bytes.length > 8);
    const detected = await assembleLocal8086(NASM_HELLO, {dialect: 'auto'});
    assert.equal(detected.dialect, 'nasm', 'auto must detect what nasm wrote');
    await assert.rejects(assembleLocal8086(NASM_HELLO, {dialect: 'masm'}), /bits|section/i);
});

test('the ASM tab offers the selector for the 8086 only, passes the choice, and names the syntax used', () => {
    const src = readFileSync(join(REPO, 'overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8');
    assert.match(src, /data-testid="bw-asm-dialect"/);
    assert.match(src, /asmTargetForDevice\(this\._asmDevice\(\)\) === 'i8086' && \(/, 'the selector is gated by the route function');
    assert.match(src, /requestAssembly\(\{source, device, dialect: machine \? 'auto' : this\.state\.asmDialect\}\)/);
    assert.match(src, /this\.L\.asmDialectUsed\(out\.dialect\)/, 'the status line names the dialect used');
    for (const key of ['asmDialectLabel', 'asmDialectTitle', 'asmDialectNames', 'asmDialectUsed']) {
        assert.equal((src.match(new RegExp(`^\\s+${key}:`, 'gm')) || []).length, 2, `${key} must exist in EN and DE`);
    }
});
