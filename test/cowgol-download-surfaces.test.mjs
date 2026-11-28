// SPDX-License-Identifier: BSD-3-Clause
// Exercise the actual editor methods and real checked reader/generator. The
// compiler boundary is controlled here; service/machine CI executes artifacts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
import readCowgol from '../overlay/scratch-gui/src/lib/sb3-creator-cowgol-reader.js';
import * as compiler from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-compile.js';

const importer = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
const extract = (start, end) => {
    const first = importer.indexOf(start), last = importer.indexOf(end, first);
    assert.ok(first >= 0 && last > first, `actual editor boundaries: ${start}`);
    return importer.slice(first, last);
};
const methods = extract('    convertedSource (', '    // source → pseudocode') +
    extract('    codeDevice () {', '    // Publish the device') +
    extract('    stopCodeRun ()', '    disposeCodeRun ()') +
    extract('    async downloadViaCowgolOnDevice (', '    async compile ({')
        .replace("await import('../../lib/bw-lang/cowgol-compile.js')", 'await loadCompiler()');
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};
const source = 'GLOBAL total = 7\nWHEN flag clicked:\n  change total by 5\n  say total\n';
const cowgolSource = 'var total: int32 := 7; total := total + 5; bw_print_number(total);';
const projectFor = (text, device) => {
    const creator = new SB3Creator();
    creator.parse(`DEVICE ${device}\n${text}`);
    return creator.project;
};

function fixture ({device = 'arduino-uno', lang = 'pseudocode', text = source,
    hold = null, allowed = true, failure = null, actualDevice = false} = {}) {
    const entered = deferred(), release = deferred();
    const pause = async phase => { if (phase === hold) { entered.resolve(); await release.promise; } };
    const builds = [], downloads = [], events = [];
    let stage = {};
    const project = projectFor('WHEN flag clicked:\n  say "old loaded project"\n', device);
    const vm = {runtime: {stc: project.stc, getTargetForStage: () => stage},
        toJSON: () => JSON.stringify(project),
        loadProject: () => assert.fail('artifact export must not replace the loaded project'),
        greenFlag: () => assert.fail('artifact export must not start Blocks')};
    const bytes = Uint8Array.from([17, 23, 42, 255]);
    const loadCompiler = async () => {
        await pause('compiler-module');
        return {...compiler, compileCowgol: async (code, target, options) => {
            builds.push({code, target, options});
            await pause('network');
            if (failure) throw new Error(failure);
            return {bytes, filename: compiler.COWGOL_COMPILE_TARGETS[target].filename,
                toolchain: compiler.COWGOL_COMPILE_TARGETS[target].toolchain};
        }};
    };
    const Editor = new Function('loadCompiler', 'downloadBlob', 'remoteToolchainsAllowed',
        'cowgolTargetForDevice', 'cowgolCanonicalDevice', 'DOS_LANG', 'window', 'localStorage', 'CustomEvent',
        `return class {${methods}}`)(loadCompiler,
        async (name, blob) => downloads.push({name, type: blob.type, bytes: new Uint8Array(await blob.arrayBuffer())}),
        () => allowed, compiler.cowgolTargetForDevice, compiler.cowgolCanonicalDevice,
        {cowgol: {load: async () => { await pause('reader-module'); return {default: readCowgol}; }}},
        {dispatchEvent: event => events.push(event)}, {setItem () {}},
        class { constructor (type, {detail}) { this.type = type; this.detail = detail; } });
    const editor = new Editor();
    Object.assign(editor, {
        state: {lang, buffers: {pseudocode: `DEVICE ${device}\n${source}`, [lang]: text}, busy: false, running: false}, props: {vm},
        ...(actualDevice ? {} : {codeDevice: () => device}),
        activeCode () { return this.state.buffers[this.state.lang] || ''; },
        setState (change) { const update = typeof change === 'function' ? change(this.state) : change; if (update) Object.assign(this.state, update); },
        lib: async () => { await pause('builder-module'); return {default: SB3Creator}; },
        L: {cowgolCompiling: 'compiling', cowgolStale: 'stale',
            cowgolNativeTargetUnavailable: 'native compiler target unavailable',
            stError: message => `error: ${message}`}
    });
    return {editor, vm, builds, downloads, events, bytes, entered, release,
        setDevice: value => { device = value; },
        replaceStage: () => { stage = {}; },
        editBlocks: () => { project.targets[0].name = 'changed'; }};
}

test('checked editor exports compile the active draft for each qualified machine without loading or running it', async () => {
    for (const device of ['z80', 'i8086', 'i80386', 'riscv32', 'eater6502', 'arduino-uno', 'atmega328p', 'arduino-nano', 'atmega168p']) {
        const f = fixture({device});
        const before = f.vm.toJSON(), stc = f.vm.runtime.stc, buffers = f.editor.state.buffers;
        const target = compiler.cowgolTargetForDevice(device);
        const expected = new SB3Creator().generateCowgol(projectFor(source, device), {target});
        assert.equal(expected.ok, true, expected.reasons?.join('; '));
        await f.editor.downloadViaCowgolOnDevice();
        assert.equal(f.builds.length, 1, f.editor.state.status);
        assert.equal(f.builds[0].target, target);
        assert.equal(f.builds[0].code, expected.cowgol);
        assert.match(f.builds[0].code, /bw_checked_add/);
        assert.doesNotMatch(f.builds[0].code, /old loaded project/);
        assert.deepEqual(f.downloads, [{name: compiler.COWGOL_COMPILE_TARGETS[target].filename,
            type: 'application/octet-stream', bytes: f.bytes}]);
        assert.equal(f.vm.toJSON(), before, device);
        assert.equal(f.vm.runtime.stc, stc, device);
        assert.equal(f.editor.state.buffers, buffers, device);
        assert.equal(f.events.length, 0, device);
        assert.equal(f.editor.state.busy, false, device);
    }
});

test('explicit 8080 downloads compile checked pseudocode and Cowgol without changing the project', async () => {
    for (const lang of ['pseudocode', 'cowgol']) {
        const text = lang === 'pseudocode' ? `DEVICE Z80\n${source}` :
            `# @bw-declaration "DEVICE Z80"\n${cowgolSource}`;
        const f = fixture({device: 'z80', lang, text, actualDevice: true});
        const before = f.vm.toJSON(), stc = f.vm.runtime.stc, buffers = f.editor.state.buffers;
        const expected = new SB3Creator().generateCowgol(projectFor(source, 'z80'), {target: 'i8080-cpm'});
        assert.equal(expected.ok, true, expected.reasons?.join('; '));
        await f.editor.downloadViaCowgolOnDevice({compilerTarget: 'i8080-cpm'});
        assert.equal(f.builds.length, 1, f.editor.state.status);
        assert.equal(f.builds[0].target, 'i8080-cpm');
        assert.equal(f.builds[0].code, expected.cowgol);
        assert.deepEqual(f.downloads, [{name: 'program.com', type: 'application/octet-stream', bytes: f.bytes}]);
        assert.equal(f.vm.toJSON(), before);
        assert.equal(f.vm.runtime.stc, stc);
        assert.equal(f.editor.state.buffers, buffers);
        assert.equal(f.events.length, 0);
        assert.equal(f.editor.state.busy, false);
    }
});

test('invalid explicit checked download targets do not fall back or contact a compiler', async () => {
    for (const [device, compilerTarget] of [['z80', 'dos'], ['i8086', 'i8080-cpm'], ['z80', null]]) {
        const f = fixture({device}), before = f.vm.toJSON(), buffers = f.editor.state.buffers;
        await f.editor.downloadViaCowgolOnDevice({compilerTarget});
        assert.equal(f.builds.length, 0);
        assert.equal(f.downloads.length, 0);
        assert.equal(f.events.length, 0);
        assert.equal(f.vm.toJSON(), before);
        assert.equal(f.editor.state.buffers, buffers);
        assert.match(f.editor.state.status, /native compiler target unavailable/);
    }
});

test('checked 8080 downloads retain the chosen target and revoke a stopped pending response', async () => {
    const f = fixture({device: 'z80', hold: 'reader-module', lang: 'cowgol', text: cowgolSource});
    const options = {compilerTarget: 'i8080-cpm'};
    const pending = f.editor.downloadViaCowgolOnDevice(options);
    await f.entered.promise;
    options.compilerTarget = 'z80-cpm';
    f.release.resolve();
    await pending;
    assert.equal(f.builds.length, 1, f.editor.state.status);
    assert.equal(f.builds[0].target, 'i8080-cpm');
    assert.equal(f.downloads.length, 1);

    const stopped = fixture({device: 'z80', hold: 'network', lang: 'cowgol', text: cowgolSource});
    const before = stopped.vm.toJSON();
    const stale = stopped.editor.downloadViaCowgolOnDevice({compilerTarget: 'i8080-cpm'});
    await stopped.entered.promise;
    assert.equal(stopped.builds[0].target, 'i8080-cpm');
    stopped.editor.stopCodeRun();
    stopped.release.resolve();
    await stale;
    assert.equal(stopped.downloads.length, 0);
    assert.equal(stopped.events.length, 0);
    assert.equal(stopped.vm.toJSON(), before);
});

test('checked Cowgol export uses its reader while full-source download preserves all Cowgol constructs', async () => {
    const f = fixture({lang: 'cowgol', text: cowgolSource});
    const before = f.vm.toJSON();
    await f.editor.downloadViaCowgolOnDevice();
    assert.equal(f.builds.length, 1, f.editor.state.status);
    assert.match(f.builds[0].code, /bw_checked_add/);
    assert.notEqual(f.builds[0].code, cowgolSource);
    assert.equal(f.downloads.length, 1);
    assert.equal(f.vm.toJSON(), before);
    const fullSource = 'var data: uint8[] := {1, 2, 3};';
    const full = fixture({lang: 'cowgol', text: fullSource});
    await full.editor.compileCowgolSource('atmega328p');
    assert.equal(full.builds[0].code, fullSource);
    assert.equal(full.downloads.length, 1);
});

test('actual DEVICE headers resolve only the documented Uno and classic Nano aliases for checked downloads', async () => {
    for (const [alias, target] of [['NANO', 'arduino-nano'], ['nano', 'arduino-nano'], ['UNO', 'atmega328p'], ['uno', 'atmega328p']]) {
        for (const lang of ['pseudocode', 'cowgol']) {
            const text = lang === 'pseudocode' ? `DEVICE ${alias}\n${source}` : cowgolSource;
            const f = fixture({device: alias, lang, text, actualDevice: true});
            assert.equal(f.editor.currentDevice(), alias.toLowerCase());
            assert.equal(f.editor.codeDevice(), alias.toLowerCase());
            const before = f.vm.toJSON(), buffers = f.editor.state.buffers;
            await f.editor.downloadViaCowgolOnDevice();
            assert.equal(f.builds.length, 1, `${alias}/${lang}: ${f.editor.state.status}`);
            assert.equal(f.builds[0].target, target);
            assert.equal(f.downloads[0].name, target === 'arduino-nano' ? 'nano.hex' : 'program.hex');
            assert.equal(f.vm.toJSON(), before);
            assert.equal(f.editor.state.buffers, buffers);
        }
    }
    const conflict = fixture({device: 'arduino-nano', text: `DEVICE UNO\n${source}`, actualDevice: true});
    conflict.editor.state.libraryTarget = 'arduino-nano';
    assert.equal(conflict.editor.currentDevice(), 'uno');
    assert.equal(conflict.editor.codeDevice(), 'arduino-nano');
    await conflict.editor.downloadViaCowgolOnDevice();
    assert.match(conflict.editor.state.status, /different machine/);
    assert.equal(conflict.builds.length, 0);
    assert.equal(conflict.downloads.length, 0);
    for (const alias of ['nano-every', 'nano33', 'uno-r4', 'mega', 'atmega168', 'i80486']) {
        const f = fixture({text: `DEVICE ${alias}\n${source}`, actualDevice: true});
        assert.equal(f.editor.codeDevice(), alias);
        await f.editor.downloadViaCowgolOnDevice();
        assert.equal(f.builds.length, 0, alias);
    }
});

test('checked downloads refuse lossy parsing, conflicting declarations and unqualified native operations before HTTP', async () => {
    for (const options of [
        {text: `DEVICE PICO\n${source}`},
        {text: 'WHEN flag clicked:\n  this is not a valid command\n'},
        {device: 'z80', text: 'WHEN flag clicked:\n  wait 1 seconds\n'},
        {text: 'CLOCK 8000000\nWHEN flag clicked:\n  say 42\n'},
        {lang: 'cowgol', text: 'var data: uint8[] := {1, 2, 3};'},
        {lang: 'cowgol', text: '# @bw-declaration "DEVICE PICO"\nbw_print_number(42);'}
    ]) {
        const f = fixture(options), before = f.vm.toJSON(), buffers = f.editor.state.buffers;
        await f.editor.downloadViaCowgolOnDevice();
        assert.match(f.editor.state.status, /^error:/, JSON.stringify(options));
        assert.equal(f.builds.length, 0, JSON.stringify(options));
        assert.equal(f.downloads.length, 0);
        assert.equal(f.vm.toJSON(), before);
        assert.equal(f.editor.state.buffers, buffers);
        assert.equal(f.editor.state.busy, false);
    }
});

const revoke = {
    'source edit': f => { f.editor.state.buffers = {[f.editor.state.lang]: 'changed'}; },
    'edit and revert': f => { f.editor.state.buffers = {...f.editor.state.buffers}; },
    language: f => { f.editor.state.lang = 'python'; },
    device: f => f.setDevice('riscv32'),
    metadata: f => { f.vm.runtime.stc.clock = 1_000_000; },
    Blocks: f => f.editBlocks(),
    project: f => f.replaceStage(),
    Stop: f => f.editor.stopCodeRun(),
    replacement: f => { f.editor._cowgolCompile = new AbortController(); f.editor.state.status = 'new owner'; },
    unmount: f => { f.editor._unmounted = true; }
};
for (const hold of ['compiler-module', 'builder-module', 'reader-module', 'network']) {
    test(`checked export rejects stale drafts during ${hold}`, async () => {
        for (const [reason, change] of Object.entries(revoke)) {
            const f = fixture({hold, lang: 'cowgol', text: cowgolSource});
            const pending = f.editor.downloadViaCowgolOnDevice();
            await f.entered.promise;
            change(f); f.release.resolve(); await pending;
            assert.equal(f.downloads.length, 0, reason);
            assert.equal(f.events.length, 0, reason);
            assert.equal(f.builds.length, hold === 'network' ? 1 : 0, reason);
            if (reason === 'replacement') {
                assert.equal(f.editor.state.status, 'new owner');
                assert.equal(f.editor.state.busy, true);
            } else if (reason !== 'unmount') assert.equal(f.editor.state.busy, false, reason);
        }
    });
}

test('unavailable, busy and failed checked exports cannot download an artifact', async () => {
    for (const options of [{allowed: false}, {device: 'pico'}, {lang: 'javascript'}]) {
        const f = fixture(options);
        await f.editor.downloadViaCowgolOnDevice();
        assert.equal(f.builds.length, 0);
        assert.equal(f.downloads.length, 0);
    }
    for (const flag of ['busy', 'running']) {
        const f = fixture(); f.editor.state[flag] = true;
        await f.editor.downloadViaCowgolOnDevice();
        assert.equal(f.builds.length, 0);
        assert.equal(f.downloads.length, 0);
    }
    const f = fixture({failure: 'native build failed'}), before = f.vm.toJSON();
    await f.editor.downloadViaCowgolOnDevice();
    assert.match(f.editor.state.status, /native build failed/);
    assert.equal(f.downloads.length, 0);
    assert.equal(f.vm.toJSON(), before);
    assert.equal(f.editor.state.busy, false);
});

test('Nano full-source action preserves its target through the AVR firmware handoff', async () => {
    const text = 'include "cowgol.coh"; print("Nano");';
    const f = fixture({device: 'arduino-nano', lang: 'cowgol', text});
    await f.editor.compileCowgolSource('arduino-nano', true);
    assert.equal(f.builds.length, 1, f.editor.state.status);
    assert.equal(f.builds[0].code, text);
    assert.equal(f.builds[0].target, 'arduino-nano');
    assert.equal(f.downloads.length, 0);
    const event = f.events.find(item => item.type === 'bw-asm-rom-ready');
    assert.deepEqual(event.detail, compiler.cowgolAvrDetail(f.bytes, {target: 'arduino-nano'}));
    assert.equal(event.detail.firmware.device, 'atmega328p');
    assert.equal(event.detail.firmware.fCpu, 16_000_000);
});

test('keyboard Run selects the native Nano compiler and respects a busy editor', () => {
    const KeyboardEditor = new Function('cowgolTargetForDevice', 'asmTargetForDevice', 'sketchBoardFor',
        `return class {${extract('    codeDevice () {', '    // Publish the device')}
        ${extract('    runActiveCode = event => {', '    componentDidMount ()')}}`)(
        compiler.cowgolTargetForDevice, () => null, () => null);
    const editor = new KeyboardEditor(), calls = [];
    Object.assign(editor, {props: {isVisible: true}, state: {lang: 'cowgol', busy: false, running: false,
        buffers: {pseudocode: 'DEVICE NANO\n', cowgol: cowgolSource}},
        activeCode: () => cowgolSource, allowsCodeLanguage: () => true,
        compileCowgolSource: (...args) => calls.push(args),
        runCowgolAsBlocks: () => assert.fail('Nano native keyboard Run fell back to Blocks')});
    let prevented = 0;
    const event = {detail: {}, preventDefault: () => prevented++};
    assert.equal(editor.currentDevice(), 'nano');
    assert.equal(editor.codeDevice(), 'nano');
    editor.runActiveCode(event);
    assert.deepEqual(calls, [['arduino-nano', true]]);
    assert.equal(event.detail.editor, 'code');
    assert.equal(prevented, 1);
    editor.state.busy = true;
    editor.runActiveCode(event);
    assert.equal(calls.length, 1);
});

test('the Code menu exposes checked export and both full-source and checked 8080 CP/M actions', () => {
    for (const id of ['bw-cowgol-native-blocks-download', 'bw-cowgol-nano-run', 'bw-cowgol-nano-download',
        'bw-cowgol-168-run', 'bw-cowgol-168-download',
        'bw-cowgol-8080-cpm-system-run', 'bw-cowgol-8080-cpm-vdp-run',
        'bw-cowgol-blocks-8080-cpm-system-run', 'bw-cowgol-blocks-8080-cpm-vdp-run',
        'bw-cowgol-blocks-8080-download']) assert.ok(importer.includes(id), id);
    assert.match(importer, /compileCowgolSource\('i8080-cpm', true, \{surface: 'cpm-system'\}\)/);
    assert.match(importer, /compileCowgolSource\('i8080-cpm', true, \{surface: 'cpm-vdp'\}\)/);
    assert.match(importer, /runViaCowgolOnDevice\(\{surface: 'cpm-system', compilerTarget: 'i8080-cpm'\}\)/);
    assert.match(importer, /runViaCowgolOnDevice\(\{surface: 'cpm-vdp', compilerTarget: 'i8080-cpm'\}\)/);
    assert.match(importer, /downloadViaCowgolOnDevice\(\{compilerTarget: 'i8080-cpm'\}\)/);
    for (const label of [
        "cowgolRunBlocks8080CpmSystem: '▶ Blocks via Cowgol 8080 in CP/M 2.2 (Z80)'",
        "cowgolRunBlocks8080CpmSystem: '▶ Blöcke mit Cowgol 8080 in CP/M 2.2 (Z80)'",
        "cowgolRunBlocks8080CpmDisplay: '▶ Blocks via Cowgol 8080 on CP/M display (Z80)'",
        "cowgolRunBlocks8080CpmDisplay: '▶ Blöcke mit Cowgol 8080 auf CP/M-Bildschirm (Z80)'",
        "cowgolDownloadBlocks8080Cpm: 'Download Blocks via Cowgol 8080 .COM'",
        "cowgolDownloadBlocks8080Cpm: 'Blöcke mit Cowgol als 8080-.COM herunterladen'"
    ]) assert.ok(importer.includes(label), label);
});

test('ATmega168P original source keeps its device through download and native Run', async () => {
    const text = 'include "cowgol.coh"; print("168P");';
    const f = fixture({device: 'atmega168p', lang: 'cowgol', text});
    await f.editor.compileCowgolSource('atmega168p');
    assert.equal(f.downloads[0].name, 'atmega168p.hex');
    await f.editor.compileCowgolSource('atmega168p', true);
    assert.deepEqual(f.builds.map(build => build.target), ['atmega168p', 'atmega168p']);
    assert.ok(f.builds.every(build => build.code === text));
    const event = f.events.find(item => item.type === 'bw-asm-rom-ready');
    assert.deepEqual(event.detail, compiler.cowgolAvrDetail(f.bytes, {target: 'atmega168p'}));
    assert.equal(event.detail.firmware.device, 'atmega168p');
    assert.equal(event.detail.firmware.fCpu, 16_000_000);
});

test('keyboard Run selects ATmega168P from the exact source declaration', () => {
    const KeyboardEditor = new Function('cowgolTargetForDevice', 'asmTargetForDevice', 'sketchBoardFor',
        'return class {' + extract('    codeDevice () {', '    // Publish the device') +
        extract('    runActiveCode = event => {', '    componentDidMount ()') + '}')(
        compiler.cowgolTargetForDevice, () => null, () => null);
    const editor = new KeyboardEditor(), calls = [];
    Object.assign(editor, {props: {isVisible: true}, state: {lang: 'cowgol', busy: false, running: false,
        buffers: {pseudocode: 'DEVICE ATMEGA168P\n', cowgol: cowgolSource}},
        activeCode: () => cowgolSource, allowsCodeLanguage: () => true,
        compileCowgolSource: (...args) => calls.push(args),
        runCowgolAsBlocks: () => assert.fail('ATmega168P native keyboard Run fell back to Blocks')});
    const event = {detail: {}, preventDefault () {}};
    editor.runActiveCode(event);
    assert.deepEqual(calls, [['atmega168p', true]]);
    assert.equal(event.detail.editor, 'code');
    editor.state.busy = true;
    editor.runActiveCode(event);
    assert.equal(calls.length, 1);
});
