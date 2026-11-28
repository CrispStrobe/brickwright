// Compile-on-DOS primitive: run a real DOS program in the browser DOS bench and
// read back the file it wrote — the mechanism a "Pascal via ACK" / "GW-BASIC"
// code-tab route stands on. Runs against the REAL bench + INT 21h file I/O (no
// stubs), so it proves the capability, not a mock of it. No pin bump: the pinned
// bw-board already loads MZ .EXE/.COM and serves INT 21h file calls.

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildSmallC} from '../overlay/scratch-gui/src/lib/bw-debug/small-c-dos.js';
import {
    runDosProgram, compileAndRunOnDos
} from '../overlay/scratch-gui/src/lib/bw-debug/dos-compile.js';
import {
    DOS_TOOLCHAINS, HOSTED_TOOLCHAINS, runDosToolchain
} from '../overlay/scratch-gui/src/lib/bw-debug/dos-toolchain-routes.js';

// The libre DOS-native BASIC interpreter this repo ships (media-lab project
// `ubasic-dos`, BSD-3-Clause uBASIC built with ia16-elf-gcc).
const UBASIC_EXE = new Uint8Array(readFileSync(
    fileURLToPath(new URL('../overlay/scratch-gui/static/roms/ubasic.exe', import.meta.url))));

// The libre DOS-native Lisp this repo ships (media-lab project `fe-dos`,
// MIT fe (rxi) built with ia16-elf-gcc).
const FE_EXE = new Uint8Array(readFileSync(
    fileURLToPath(new URL('../overlay/scratch-gui/static/roms/fe.exe', import.meta.url))));
// The libre DOS-native Tcl this repo ships (media-lab project `tcl-dos`,
// MIT partcl (zserge) built with ia16-elf-gcc).
const TCL_EXE = new Uint8Array(readFileSync(
    fileURLToPath(new URL('../overlay/scratch-gui/static/roms/tcl.exe', import.meta.url))));
// The libre DOS-native Forth this repo ships (media-lab project `forth-dos`,
// MIT zForth (zevv) built with ia16-elf-gcc).
const FORTH_EXE = new Uint8Array(readFileSync(
    fileURLToPath(new URL('../overlay/scratch-gui/static/roms/forth.exe', import.meta.url))));

// A 40-byte real .COM: INT 21h create OUT.TXT, write "HI", close, exit(0).
const FILE_WRITER = new Uint8Array([
    0xBA, 0x1E, 0x01,             // mov dx, OUT.TXT
    0x31, 0xC9,                   // xor cx, cx
    0xB4, 0x3C, 0xCD, 0x21,       // mov ah,3Ch; int 21h  (create)
    0x89, 0xC3,                   // mov bx, ax           (handle)
    0xBA, 0x26, 0x01,             // mov dx, "HI"
    0xB9, 0x02, 0x00,             // mov cx, 2
    0xB4, 0x40, 0xCD, 0x21,       // mov ah,40h; int 21h  (write)
    0xB4, 0x3E, 0xCD, 0x21,       // mov ah,3Eh; int 21h  (close)
    0xB8, 0x00, 0x4C, 0xCD, 0x21, // mov ax,4C00h; int 21h (exit 0)
    0x4F, 0x55, 0x54, 0x2E, 0x54, 0x58, 0x54, 0x00, // "OUT.TXT",0
    0x48, 0x49                    // "HI"
]);

test('runDosProgram runs a program and reads back the file it wrote', async () => {
    const {files, terminated, exitCode, exhausted, steps} = await runDosProgram({
        bytes: FILE_WRITER, format: 'com', maxSteps: 200000
    });
    assert.ok(terminated && !exhausted, `program terminated (steps=${steps})`);
    assert.equal(exitCode, 0);
    const out = files.get('OUT.TXT');
    assert.ok(out instanceof Uint8Array, 'the program-created file is on the mounted disk');
    assert.equal(new TextDecoder().decode(out), 'HI');
});

test('runDosProgram yields so an interrupted guest cannot keep the browser busy', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 0);
    await assert.rejects(runDosProgram({
        bytes: Uint8Array.of(0xeb, 0xfe), format: 'com',
        yieldEvery: 100, signal: controller.signal
    }), {name: 'AbortError'});
});

test('Small-C rejects empty source and incomplete toolchains before launching DOS', async () => {
    await assert.rejects(buildSmallC(FILE_WRITER, new Map(), ' '), /Enter Small-C source/);
    await assert.rejects(buildSmallC(FILE_WRITER, new Map(), 'int main() {}'), /missing ASM[.]EXE/);
});

test('compileAndRunOnDos mounts sources, runs the compiler, extracts its output', async () => {
    // The file-writer stands in for a compiler: sources are mounted for it, and
    // it "produces" OUT.TXT — exactly the shape a real ACK/GW-BASIC run takes.
    const r = await compileAndRunOnDos({
        compiler: FILE_WRITER, compilerFormat: 'com',
        sources: {'SOURCE.PAS': 'begin writeln(42) end.'},
        outputName: 'OUT.TXT', run: false, maxSteps: 200000
    });
    assert.equal(r.stage, 'compile');
    assert.ok(r.compile.terminated);
    assert.ok(r.output instanceof Uint8Array, 'the produced file is extracted');
    assert.equal(new TextDecoder().decode(r.output), 'HI');
    // the source was on the disk the compiler saw (mounting works)
    assert.ok(r.files.get('SOURCE.PAS'), 'the source was mounted for the compiler');
});

test('routes split DOS-native (uBASIC verified, GW-BASIC not) from hosted (ACK)', () => {
    // uBASIC is a shipped, VERIFIED DOS-native BASIC .EXE (proven end-to-end below).
    const ub = DOS_TOOLCHAINS['ubasic'];
    assert.ok(ub && ub.kind === 'dos-native');
    assert.equal(ub.verified, true);
    assert.equal(ub.language, 'basic');
    assert.equal(ub.compilerFormat, 'exe');
    assert.equal(ub.variant, '80186');       // ia16-elf-gcc emits 186 opcodes
    assert.equal(ub.outputName, null);       // an interpreter: output is on screen
    assert.equal(ub.run, false);
    // GW-BASIC is a DOS .EXE too → the DOS bench (dos-compile) — but still
    // unverified, because there is no built libre GWBASIC.EXE.
    const gw = DOS_TOOLCHAINS['gwbasic'];
    assert.ok(gw && gw.kind === 'dos-native');
    assert.equal(gw.verified, false);
    assert.ok(gw.compiler && gw.sourceName);
    // ACK is a HOST cross-compiler → a hosted endpoint, NOT the DOS bench.
    const ack = HOSTED_TOOLCHAINS['pascal-ack'];
    assert.ok(ack && ack.kind === 'hosted');
    assert.equal(ack.verified, false);
    // and it is deliberately NOT a DOS route.
    assert.equal(DOS_TOOLCHAINS['pascal-ack'], undefined);
});

test('the libre uBASIC .EXE runs `10 print 6*7` on the real DOS bench and prints 42', async () => {
    // Mount the user's BASIC as PROG.BAS and run the interpreter on the REAL
    // bench (createDos8086 loadExe + INT 21h open/read). No stub, no network.
    const files = new Map([['PROG.BAS', new TextEncoder().encode('10 print 6*7\n')]]);
    const r = await runDosProgram({
        bytes: UBASIC_EXE, format: 'exe', variant: '80186', files, maxSteps: 12_000_000
    });
    assert.ok(r.terminated && !r.exhausted, `interpreter terminated (steps=${r.steps})`);
    assert.equal(r.exitCode, 0);
    assert.match(r.screen, /\b42\b/, `screen was ${JSON.stringify(r.screen)}`);
});

test('runDosToolchain("ubasic", …) runs the shipped interpreter and returns its output', async () => {
    // The EXACT production path: route lookup → fetch → compileAndRunOnDos on the
    // real bench. The fetcher returns the shipped static/roms/ubasic.exe bytes.
    const program = [
        '10 GOSUB 100',
        '20 for i = 1 to 3',
        '30 print i',
        '40 next i',
        '50 print 6*7',
        '60 if 6*7 = 42 then print "ok"',
        '70 end',
        '100 PRINT "UPPERCASE STRING"',
        '110 return', ''
    ].join('\n');
    const r = await runDosToolchain('ubasic', program, {
        fetchToolchain: async () => ({compiler: UBASIC_EXE}),
        maxSteps: 20_000_000
    });
    // An interpreter route has no output FILE: its work is the run itself, whose
    // screen is on the compile stage.
    assert.equal(r.stage, 'compile');
    assert.ok(r.compile.terminated, 'the interpreter terminated');
    assert.equal(r.compile.exitCode, 0);
    for (const want of ['UPPERCASE STRING', '1', '2', '3', '42', 'ok']) {
        assert.ok(r.compile.screen.includes(want), `expected ${want} in ${JSON.stringify(r.compile.screen)}`);
    }
    // The user's program was mounted where the interpreter reads it.
    assert.ok(r.files.get('PROG.BAS'), 'PROG.BAS was mounted for the interpreter');
});

test('the DOS-native fe (Lisp) route is verified and shaped like uBASIC', () => {
    const fe = DOS_TOOLCHAINS['fe'];
    assert.ok(fe && fe.kind === 'dos-native');
    assert.equal(fe.verified, true);
    assert.equal(fe.language, 'fe');
    assert.equal(fe.compilerFormat, 'exe');
    assert.equal(fe.variant, '80186');       // ia16-elf-gcc emits 186 opcodes
    assert.equal(fe.sourceName, 'PROG.FE');
    assert.equal(fe.outputName, null);       // an interpreter: output is on screen
    assert.equal(fe.run, false);
});

test('runDosToolchain("fe", …) runs the shipped fe Lisp on the real DOS bench', async () => {
    // The EXACT production path: route lookup → fetch → compileAndRunOnDos on the
    // real bench; the fetcher returns the shipped static/roms/fe.exe bytes.
    const program = [
        '(print "fe on the bench")',
        '(print (* 6 7))',
        '(= fact (fn (n) (if (<= n 1) 1 (* n (fact (- n 1))))))',
        '(print (fact 5))', ''
    ].join('\n');
    const r = await runDosToolchain('fe', program, {
        fetchToolchain: async () => ({compiler: FE_EXE}),
        maxSteps: 60_000_000
    });
    assert.equal(r.stage, 'compile');
    assert.ok(r.compile.terminated, 'the interpreter terminated');
    assert.equal(r.compile.exitCode, 0);
    for (const want of ['fe on the bench', '42', '120']) {
        assert.ok(r.compile.screen.includes(want), `expected ${want} in ${JSON.stringify(r.compile.screen)}`);
    }
    // The user's program was mounted where the interpreter reads it.
    assert.ok(r.files.get('PROG.FE'), 'PROG.FE was mounted for the interpreter');
});

test('the DOS-native Forth (zForth) route is verified and shaped like fe', () => {
    const forth = DOS_TOOLCHAINS['forth'];
    assert.ok(forth && forth.kind === 'dos-native');
    assert.equal(forth.verified, true);
    assert.equal(forth.language, 'forth');
    assert.equal(forth.compilerFormat, 'exe');
    assert.equal(forth.variant, '80186');
    assert.equal(forth.sourceName, 'PROG.FTH');
    assert.equal(forth.outputName, null);
    assert.equal(forth.run, false);
});

test('runDosToolchain("forth", …) runs the shipped zForth on the real DOS bench', async () => {
    // The EXACT production path; the fetcher returns the shipped static/roms/forth.exe.
    // The canonical shape generateForth emits: var globals, body inside : main.
    const program = [
        '( --- variables --- )',
        'var n',
        '( --- program --- )',
        ': main',
        '  7 n !',
        '  n @ n @ * . cr',
        '  n @ 3 > if ." big" cr else ." small" cr fi',
        ';',
        'main', ''
    ].join('\n');
    const r = await runDosToolchain('forth', program, {
        fetchToolchain: async () => ({compiler: FORTH_EXE}),
        maxSteps: 200_000_000   // soft-float bootstrap runs before the user program
    });
    assert.equal(r.stage, 'compile');
    assert.ok(r.compile.terminated, 'the interpreter terminated');
    assert.equal(r.compile.exitCode, 0);
    for (const want of ['49', 'big']) {
        assert.ok(r.compile.screen.includes(want), `expected ${want} in ${JSON.stringify(r.compile.screen)}`);
    }
    assert.ok(r.files.get('PROG.FTH'), 'PROG.FTH was mounted for the interpreter');
});

test('zForth runs the loops + custom block generateForth emits (REPEAT, REPEAT UNTIL, : word)', async () => {
    // The exact canonical shape generateForth writes for a custom block, a
    // counted REPEAT (a `_r` counter down to 0) and a pre-test REPEAT UNTIL.
    const program = [
        '( --- variables --- )',
        'var k',
        'var _r0',
        '( --- program --- )',
        ': banner',
        '  ." hi" cr',
        ';',
        ': main',
        '  banner',
        '  0 k !',
        '  ( repeat )',
        '  3 _r0 !',
        '  begin',
        '    _r0 @ 0 > if',
        '      1 k +!',
        '      k @ . cr',
        '    fi',
        '    -1 _r0 +!',
        '    _r0 @ 0 <=',
        '  until',
        '  0 k !',
        '  ( repeat-until )',
        '  begin',
        '    k @ 3 > if',
        '      1',
        '    else',
        '      k @ . cr',
        '      1 k +!',
        '      0',
        '    fi',
        '  until',
        '  ." done" cr',
        ';',
        'main', ''
    ].join('\n');
    const r = await runDosToolchain('forth', program, {
        fetchToolchain: async () => ({compiler: FORTH_EXE}),
        maxSteps: 200_000_000
    });
    assert.equal(r.stage, 'compile');
    assert.equal(r.compile.exitCode, 0);
    const screen = r.compile.screen;
    // the custom block, the REPEAT 3 (1 2 3), the REPEAT UNTIL k>3 (0 1 2 3), done.
    for (const want of ['hi', '1 ', '2 ', '3 ', '0 ', 'done']) {
        assert.ok(screen.includes(want), `expected ${JSON.stringify(want)} in ${JSON.stringify(screen)}`);
    }
    // the counted loop ran exactly three body prints, not forever.
    assert.ok(!screen.includes('4 '), `REPEAT 3 should not reach 4: ${JSON.stringify(screen)}`);
});

test('a Forth user syscall reaches the host on the real bench (the device-bridge extension point)', async () => {
    // zForth's `sys` is the VM's host-call primitive: `<id> sys` invokes the
    // front-end's zf_host_sys. `quit` is `128 sys` (ZF_SYSCALL_USER + 0), which
    // the DOS front-end implements as exit. So a *generated word* can reach a
    // host handler — the mechanism a "drive the board" GPIO syscall would use
    // (see docs/CODE-TAB-LANGUAGE-DEVICE-BRIDGE.md). Proof: the line after
    // `quit` never runs, so the user syscall fired and short-circuited.
    const program = [
        ': main',
        '  ." before-syscall" cr',
        '  quit',
        '  ." after-syscall" cr',   // unreachable: the user syscall exited
        ';',
        'main', ''
    ].join('\n');
    const r = await runDosToolchain('forth', program, {
        fetchToolchain: async () => ({compiler: FORTH_EXE}),
        maxSteps: 200_000_000
    });
    assert.equal(r.stage, 'compile');
    assert.ok(r.compile.screen.includes('before-syscall'), r.compile.screen);
    assert.ok(!r.compile.screen.includes('after-syscall'),
        `the user syscall should have short-circuited: ${JSON.stringify(r.compile.screen)}`);
});

test('a Forth program drives GPIO: `pin!` OUTs are observable via onPortAccess (the GUI widget bridge)', async () => {
    // The DOS Forth's prelude defines `pin! ( pin value -- )` as an 8086 OUT to
    // 0x378+pin (dosmain.c). The 8086 bench fires onPortAccess on every OUT, and
    // the Code-tab run path threads that callback down to light an 8-pin GPIO
    // strip widget. Here we assert the plumbing end-to-end: a generated-shape
    // Forth program's pin writes reach the observer with the right pin/value.
    const program = [
        ': main',
        '  3 1 pin!',   // set pin 3 high
        '  5 0 pin!',   // set pin 5 low
        '  7 1 pin!',   // set pin 7 high
        '  2 42 pin!',  // set pin 2 to 42 (a non-boolean value)
        '  ." pins-set" cr',
        ';',
        'main', ''
    ].join('\n');
    const outs = [];
    const r = await runDosToolchain('forth', program, {
        fetchToolchain: async () => ({compiler: FORTH_EXE}),
        maxSteps: 200_000_000,
        onPortAccess: ev => { if (ev.dir === 'out' && ev.port >= 0x378 && ev.port <= 0x37f) outs.push({pin: ev.port - 0x378, value: ev.value}); }
    });
    assert.equal(r.stage, 'compile');
    assert.ok(r.compile.screen.includes('pins-set'), r.compile.screen);
    for (const want of [{pin: 3, value: 1}, {pin: 5, value: 0}, {pin: 7, value: 1}, {pin: 2, value: 42}]) {
        assert.ok(outs.some(o => o.pin === want.pin && o.value === want.value),
            `expected pin ${want.pin} driven to ${want.value}, got ${JSON.stringify(outs)}`);
    }
});

test('the DOS-native Tcl (partcl) route is verified and shaped like fe', () => {
    const tcl = DOS_TOOLCHAINS['tcl'];
    assert.ok(tcl && tcl.kind === 'dos-native');
    assert.equal(tcl.verified, true);
    assert.equal(tcl.language, 'tcl');
    assert.equal(tcl.compilerFormat, 'exe');
    assert.equal(tcl.variant, '80186');
    assert.equal(tcl.sourceName, 'PROG.TCL');
    assert.equal(tcl.outputName, null);
    assert.equal(tcl.run, false);
});

test('runDosToolchain("tcl", …) runs the shipped partcl Tcl on the real DOS bench', async () => {
    // The EXACT production path; the fetcher returns the shipped static/roms/tcl.exe.
    // The proven media-lab demo: a banner, 6*7, and a recursive factorial proc.
    const program = [
        'puts "partcl on DOS (8086)"',
        'set x 6',
        'puts [* $x 7]',
        'proc fact {n} { if {<= $n 1} {return 1} {return [* $n [fact [- $n 1]]]} }',
        'puts [fact 5]',
        'puts [fact 6]', ''
    ].join('\n');
    const r = await runDosToolchain('tcl', program, {
        fetchToolchain: async () => ({compiler: TCL_EXE}),
        maxSteps: 60_000_000
    });
    assert.equal(r.stage, 'compile');
    assert.ok(r.compile.terminated, 'the interpreter terminated');
    assert.equal(r.compile.exitCode, 0);
    for (const want of ['partcl on DOS (8086)', '42', '120', '720']) {
        assert.ok(r.compile.screen.includes(want), `expected ${want} in ${JSON.stringify(r.compile.screen)}`);
    }
    assert.ok(r.files.get('PROG.TCL'), 'PROG.TCL was mounted for the interpreter');
});

test('runDosToolchain runs a DOS-native route through the bench (fetch composition)', async () => {
    let seen = null;
    // Throw after the fetch so the test does not depend on a valid GWBASIC.EXE;
    // it proves the route lookup + fetch composition for a DOS-native route.
    await assert.rejects(() => runDosToolchain('gwbasic', '10 PRINT 42', {
        fetchToolchain: async route => { seen = route; throw new Error('stop-after-fetch'); }
    }), /stop-after-fetch/);
    assert.equal(seen.id, 'gwbasic');
    assert.equal(seen.sourceName, 'PROG.BAS');
});

test('runDosToolchain refuses a hosted route, an unknown route, or a missing fetcher', async () => {
    // A hosted toolchain (ACK) does not run on the bench — say so, don't fetch.
    await assert.rejects(
        () => runDosToolchain('pascal-ack', 'begin end.', {fetchToolchain: async () => ({compiler: FILE_WRITER})}),
        /HOSTED toolchain/);
    await assert.rejects(
        () => runDosToolchain('nope', 'x', {fetchToolchain: async () => ({compiler: FILE_WRITER})}),
        /unknown DOS toolchain/);
    await assert.rejects(() => runDosToolchain('gwbasic', 'x', {}), /needs a fetchToolchain/);
});
