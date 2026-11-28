/**
 * The C tab now has two compilers, and this is what stops that from becoming
 * two bugs — the same job `test/asm-assemble-route.test.mjs` does for the ASM
 * tab, and modelled on it deliberately.
 *
 * The shape is not quite the same, and the difference matters. For assembly
 * the two routes are "in this browser" and "at stc-compiler", and either could
 * in principle serve the 8086. For C there is no choice at all: the hosted
 * service has no 8086 back end (ROADMAP §3.8.2b, door 1 — `ia16-elf-gcc` is
 * not deployed), so the local route is not an optimisation, it is the only
 * road. That makes the "no fallback" rule stronger here than for the 8051:
 * falling back would replace a message naming the learner's construct with
 * `unknown compile target 'i8086'`.
 *
 * THREE THINGS ARE ASSERTED:
 *   1. ONE function decides — `cRouteFor`, and the component calls it rather
 *      than testing the device id itself.
 *   2. NEITHER ROUTE LEAKS. An 8086 C program is never posted (the network is
 *      replaced by a spy that throws for the whole build), and a device with
 *      no local C route is refused BY NAME instead of being handed to a
 *      compiler that emits 8086.
 *   3. THE RESULT SAYS WHICH ROUTE RAN, and carries the slot and profile that
 *      tell the bench a .COM from a ROM.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile as readFileAsync} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {REPO} from './helpers/bw-integrated.mjs';
import {
    requestCBuild, cRouteFor, asmTargetForDevice, LOCAL_C_TARGETS, AsmRouteError
} from '../overlay/scratch-gui/src/lib/bw-asm/assemble-route.js';

// ---- the real compiler, reached the way Node can reach it -----------------
// The BROWSER calls `compile()`, which resolves the WASM against
// document.baseURI; Node has no document, so the toolchain is loaded here and
// injected through the `compileC` seam `compileC8086` already exposes. That is
// the ONLY seam this file uses: the assembler is the production one, and the
// component is separately asserted to inject neither.
const L = new URL('../overlay/scratch-gui/src/lib/', import.meta.url);
const distUrl = new URL('smallerc-wasm/dist/', L);
const require = createRequire(import.meta.url);
const EXPORTS = {smlrpp: 'createSmlrpp', smlrc: 'createSmlrc'};

async function importFactory (name) {
    const url = new URL(`${name}.js`, distUrl);
    const source = await readFileAsync(url, 'utf8');
    const filename = fileURLToPath(url);
    const module = {exports: {}};
    Function('module', 'exports', 'require', '__filename', '__dirname',
        source.replace(new RegExp(`export default ${EXPORTS[name]};\\s*$`), ''))(
        module, module.exports, require, filename, dirname(filename));
    return module.exports;
}

let cached = null;
async function toolchain () {
    if (!cached) {
        const {HEADERS} = await import(new URL('headers.js', distUrl).href);
        cached = {
            factories: await Promise.all(['smlrpp', 'smlrc'].map(importFactory)),
            headers: HEADERS,
            resolve: name => pathToFileURL(fileURLToPath(new URL(name, distUrl))).href
        };
    }
    return cached;
}

async function nodeCompileC (code, options) {
    const {compileWithToolchain} = await import(new URL('smallerc-wasm/compiler.js', L).href);
    return compileWithToolchain(code, options, await toolchain());
}

/** A network that cannot be used without being noticed. */
async function withNoNetwork (fn) {
    const real = globalThis.fetch;
    let escaped = false;
    globalThis.fetch = (...args) => {
        escaped = true;
        throw new Error(`a C program escaped to the network: ${args[0]}`);
    };
    try { return {value: await fn(), escaped}; } finally { globalThis.fetch = real; }
}

test('the 8086 family routes its C to the LOCAL compiler', () => {
    for (const device of ['i8086', '8086', 'i8088', '8088', 'I8086']) {
        assert.equal(asmTargetForDevice(device), 'i8086');
        assert.equal(cRouteFor(device), 'local',
            `${device} would have been posted to a compiler with no 8086 back end`);
    }
    assert.deepEqual([...LOCAL_C_TARGETS], ['i8086'],
        'a new local C target must arrive with the test that proves it builds');
});

test('every other device keeps the C route it already had', () => {
    // stc12c5a60s2 is the one that matters: its C is posted to /compile and
    // `sdcc-wasm/intercept.js` answers that POST locally. That arrangement is
    // untouched, and 'hosted' is the honest word for it — the CALLER still
    // makes a request.
    for (const device of ['stc12c5a60s2', 'stc89c52rc', 'atmega328p', 'arduino-uno',
        'pico', 'stm32f030', 'eater6502', '6502', 'z80', 'attiny85', '']) {
        assert.equal(cRouteFor(device), 'hosted',
            `${device} was diverted to SmallerC, which compiles for the 8086`);
    }
});

test('a device with no local C route is refused BY NAME, not quietly posted', async () => {
    await assert.rejects(
        () => requestCBuild({source: 'int main(void){return 0;}', device: 'stc12c5a60s2'}),
        (e) => {
            assert.ok(e instanceof AsmRouteError, 'the refusal must carry its route');
            assert.equal(e.route, 'hosted');
            assert.match(e.message, /stc12c5a60s2 has no local C route/,
                'the message must name the device, not merely say no');
            return true;
        });
});

test('an 8086 C program is compiled AND assembled without the network being touched',
    {timeout: 120000}, async () => {
        const {value: out, escaped} = await withNoNetwork(() => requestCBuild(
            {source: 'int main(void) { return 7; }\n', device: 'i8086'},
            {compileC: nodeCompileC}));
        assert.equal(escaped, false, 'the local C route made a request');
        assert.equal(out.route, 'local', 'the result must say which route ran');
        assert.equal(out.target, 'i8086');
        // A .COM is a DOS executable and not a ROM. A ROM at F0000 executes
        // nothing, and a machine that executes nothing looks exactly like one
        // that failed to start — the same trap requestAssembly documents.
        assert.equal(out.format, 'com');
        assert.equal(out.slotId, 'com');
        assert.equal(out.profile, 'dos');
        assert.equal(out.org, 0x100);
        assert.ok(out.bytes.length > 0, 'no image came back');
        assert.match(out.asm, /call\s+_main/i,
            'the assembly is handed back so the ASM tab can show what the C became');
    });

test('a C program the compiler refuses is a SOURCE refusal that names the token',
    {timeout: 120000}, async () => {
        await assert.rejects(
            () => requestCBuild({source: 'int main(void) { return nope; }\n', device: 'i8086'},
                {compileC: nodeCompileC}),
            (e) => {
                assert.equal(e.reason, 'source',
                    "a program the compiler read and rejected is the user's, not a broken toolchain");
                assert.equal(e.route, 'local');
                return true;
            });
    });

test('an empty buffer is refused before a WASM stage is started', async () => {
    for (const bad of ['', '   \n\t', null, undefined]) {
        await assert.rejects(() => requestCBuild({source: bad, device: 'i8086'}),
            /there is no C to compile/, `accepted ${JSON.stringify(bad)}`);
    }
});

test('the C tab decides the route through this module, and in one place', async () => {
    const src = await readFileAsync(
        join(REPO, 'overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx'),
        'utf8');
    assert.match(src,
        /<button onClick=\{this\.runCOn8086\} disabled=\{this\.state\.busy\}\s+data-testid=\{menu \? "bw-run-c-8086-menu" : "bw-run-c-8086"\}/,
        'the C toolbar and menu must both expose the same 8086 handler');
    assert.match(src, /requestCBuild, asmRouteFor, cRouteFor/,
        'the tab no longer imports the C route from assemble-route.js');
    assert.match(src, /out = await requestCBuild\(\{source, device\}\);/,
        'the ▶ handler must call requestCBuild with NO injected compiler — an override ' +
        'here is a second local path that no gate runs');
    assert.match(src, /cRouteFor\(this\.currentDevice\(\)\) === 'local'/,
        'the button must be gated by the route function, not by a device id compared in the JSX');
    // The C 8086 path must not have added a hosted POST anywhere. Every
    // hosted /compile in this component goes through ONE helper, and the
    // six callers (flashToBoard, the STM32 SWD path, the Pico UF2 deploy,
    // the AVR boards' ▶ Run sketch, the Z80 bench's ▶ Run C on Z80, and
    // the CP/M library's edited C source --
    // neither has a local route to take) call it by name — so a new hosted
    // route shows up as a seventh caller, and a second URL literal as a second.
    assert.equal(src.split('stc-compiler.vercel.app/compile').length - 1, 1,
        'the hosted /compile URL must appear exactly once, inside hostedCompileC()');
    assert.equal(src.split('await this.hostedCompileC(').length - 1, 6,
        'the hosted compile has a new or missing caller; the 8086 C route must not be one');
    const sketch = src.slice(src.indexOf('async runSketchOnAvr ()'));
    assert.match(sketch.slice(0, sketch.indexOf('\n    /**')), /await this\.hostedCompileC\(/,
        'the fourth caller is expected to be the Arduino sketch route');
    const library = src.slice(src.indexOf('    runLibraryProgram = async () => {'));
    const libraryBody = library.slice(0, library.indexOf('\n    };'));
    assert.match(libraryBody, /program\.compilerTarget !== 'z80-cpm'/,
        'the additional library route must remain restricted to CP/M');
    assert.match(libraryBody, /await this\.hostedCompileC\(source, program\.compilerTarget, 'bin'\)/);
    for (const key of ['runC8086', 'runC8086Title', 'runC8086Building', 'runC8086Built',
        'runC8086Refused', 'runC8086Failed', 'runC8086Empty', 'runC8086Route']) {
        assert.equal(src.split(`${key}:`).length - 1, 2, `${key} is not in both locales`);
    }
    // The status line must name the route and the stage's own words. A
    // refusal that says "compilation failed" throws away the one thing the
    // learner can act on.
    assert.match(src, /this\.L\.runC8086Refused\(routeName, e\.message\)/);
    assert.match(src, /this\.L\.runC8086Failed\(routeName, e\.message\)/);
});

test('the image reaches the bench by the SAME event a hand-written program does', async () => {
    const src = await readFileAsync(
        join(REPO, 'overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx'),
        'utf8');
    const handler = src.slice(src.indexOf('async runCOn8086 ()'));
    const body = handler.slice(0, handler.indexOf('\n    /**'));
    assert.match(body, /slotId: out\.slotId, profile: out\.profile/,
        'the C route drops the slot/profile, so the runner cannot tell a .COM from a ROM');
    assert.match(body, /new CustomEvent\('bw-asm-rom-ready'/,
        'a second delivery path would be a second thing to keep working');
    assert.match(body, /__bwPendingMedia/,
        'the panel may not be mounted yet; the pending-media stash is how the ASM ▶ handles that');
});
