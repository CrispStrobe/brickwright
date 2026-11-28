// SPDX-License-Identifier: BSD-3-Clause
// Real editor methods and conversion engine, with controlled asynchronous
// module/network/VM edges. Guest execution is qualified by compiler-service CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
import readCowgol from '../overlay/scratch-gui/src/lib/sb3-creator-cowgol-reader.js';
import * as compiler from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-compile.js';
import {cell, isNativeNull} from '../overlay/scratch-gui/src/lib/bw-matrix/capabilities.js';
import * as assetLibrary from '../overlay/scratch-gui/src/lib/bw-asset-library.js';

const encode = value => Buffer.from(value).toString('base64');
const requestSource = 'include "brickwright.coh"; bw_print_number(42);';
const fetcher = reply => async () => ({ok: true, status: 200, json: async () => reply});
function record (address, data, type = 0) {
    const bytes = [data.length, address >> 8, address & 255, type, ...data];
    bytes.push((-bytes.reduce((sum, byte) => sum + byte, 0)) & 255);
    return `:${bytes.map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
function avrArtifact (size = 128, target = 'atmega328p') {
    const chip168 = target === 'atmega168p';
    const heapEnd = chip168 ? 0x184 : 0x304;
    const flash = new Uint8Array(size);
    flash.set([0x0c, 0x94, 0x34, 0]); // JMP after the complete 104-byte vector table.
    const lines = [];
    for (let offset = 0; offset < size; offset += 16) lines.push(record(offset, [...flash.subarray(offset, offset + 16)]));
    lines.push(record(0, [], 1));
    const bytes = new TextEncoder().encode(`${lines.join('\n')}\n`);
    return {flash, bytes, reply: {
        success: true, language: 'cowgol', target, toolchain: `cowgol-${target}`,
        ...(target === 'arduino-nano' ? {board: target, bootloader_reserve: 2048} :
            chip168 ? {board: target, bootloader_reserve: 0} : {}),
        format: 'hex', artifact_kind: 'executable', mcu: chip168 ? 'atmega168p' : 'atmega328p', origin: 0, entry: 0,
        f_cpu: 16_000_000, uart_baud: 9600, bytes: bytes.length, base64: encode(bytes), memory_end: heapEnd,
        memory_layout: {flash_end: size, flash_limit: chip168 ? 0x4000 : target === 'arduino-nano' ? 0x7800 : 0x7e00,
            data_start: 0x100, data_end: 0x102, bss_end: heapEnd, heap_start: 0x104,
            heap_end: heapEnd, stack_start: chip168 ? 0x300 : 0x700,
            stack_reserve: 512, ram_end: chip168 ? 0x500 : 0x900, halted_addr: 0x102, status_addr: 0x103,
            ...(chip168 ? {mcu: 'atmega168p', flash_size: 0x4000, heap_size: 128} : {})}
    }};
}
const replaceHex = (reply, text) => {
    const bytes = new TextEncoder().encode(text);
    reply.base64 = encode(bytes); reply.bytes = bytes.length;
};

test('native device routing advertises only explicitly qualified machine profiles', () => {
    for (const [device, target] of Object.entries({
        z80: 'z80-cpm', i8086: 'dos', i80386: 'dos', riscv32: 'riscv32', eater6502: 'eater6502',
        'arduino-uno': 'atmega328p', atmega328p: 'atmega328p', 'arduino-nano': 'arduino-nano', atmega168p: 'atmega168p'
    })) {
        assert.equal(compiler.cowgolTargetForDevice(device), target);
        assert.equal(compiler.cowgolTargetForDevice(device.toUpperCase()), target);
    }
    for (const device of ['arduino-mega', 'atmega168', 'atmega2560', 'attiny85', 'pico', 'i80486', 'constructor', '__proto__', '', null]) {
        assert.equal(compiler.cowgolTargetForDevice(device), null, String(device));
    }
});

test('explicit native compiler choices stay within the selected machine contract', () => {
    for (const device of ['z80', 'Z80']) {
        assert.equal(compiler.cowgolTargetForDevice(device), 'z80-cpm');
        assert.equal(compiler.cowgolTargetForDevice(device, 'z80-cpm'), 'z80-cpm');
        assert.equal(compiler.cowgolTargetForDevice(device, 'i8080-cpm'), 'i8080-cpm');
    }
    assert.equal(compiler.cowgolTargetForDevice('UNO', 'atmega328p'), 'atmega328p');
    assert.equal(compiler.cowgolTargetForDevice('i80386', 'dos'), 'dos');
    for (const target of [null, '', false, 'constructor', '__proto__', 'I8080-CPM', 'dos', 'riscv32', 'cowgol-cgen']) {
        assert.equal(compiler.cowgolTargetForDevice('z80', target), null, String(target));
    }
    for (const device of ['i8086', 'i80386', 'riscv32', 'eater6502', 'arduino-uno', 'arduino-nano', 'atmega168p', 'pico', 'constructor', null]) {
        assert.equal(compiler.cowgolTargetForDevice(device, 'i8080-cpm'), null, String(device));
    }
});

test('CP/M program bench configs preserve the compiler target and the Z80 CPU', () => {
    assert.equal(compiler.cowgolCpmConfig().provenance.compilerTarget, 'z80-cpm');
    assert.deepEqual(compiler.cowgolCpmConfig(), compiler.cowgolCpmConfig({target: 'z80-cpm'}));
    for (const target of ['z80-cpm', 'i8080-cpm']) {
        const config = compiler.cowgolCpmConfig({target});
        assert.equal(config.provenance.compilerTarget, target);
        assert.equal(config.machine, 'z80');
        assert.deepEqual(config.cpu, {variant: 'z80'});
    }
    for (const target of [null, '', false, 'constructor', '__proto__', 'I8080-CPM', 'dos', 'riscv32', 'cowgol-cgen']) {
        assert.throws(() => compiler.cowgolCpmConfig({target}),
            {message: 'The CP/M program bench needs a Z80 or 8080 CP/M program.'}, String(target));
    }
});

test('the capability matrix records the qualified AVR profiles without widening the family', () => {
    for (const device of ['arduino-uno', 'atmega328p', 'arduino-nano', 'atmega168p']) {
        const capability = cell('cowgol', device);
        assert.equal(isNativeNull(capability.native), false, device);
        assert.equal(capability.native.artefact, 'hex', device);
        assert.equal(capability.native.status, 'open', device);
        assert.equal(capability.native.sim, false, 'a pending deployment is not a shipped machine route');
    }
    for (const device of ['arduino-mega', 'attiny85']) {
        assert.equal(isNativeNull(cell('cowgol', device).native), true, device);
    }
    assert.equal(cell('cowgol', 'atmega2560'), null, 'an unregistered device has no capability cell');
});

test('AVR compilation requests HEX and hands the identical validated text to the fixed firmware loader', async () => {
    const {reply, bytes} = avrArtifact();
    let sent;
    const controller = new AbortController();
    const out = await compiler.compileCowgol(requestSource, 'atmega328p', {signal: controller.signal,
        fetcher: async (_url, options) => {
            sent = options;
            return {ok: true, status: 200, json: async () => reply};
        }});
    assert.deepEqual(JSON.parse(sent.body), {language: 'cowgol', code: requestSource, target: 'atmega328p', format: 'hex'});
    assert.equal(sent.signal, controller.signal);
    assert.deepEqual(out.bytes, bytes);
    assert.equal(out.filename, 'program.hex');
    assert.deepEqual(compiler.cowgolAvrDetail(out.bytes), {
        format: 'firmware', target: 'atmega328p', kind: 'avr8js',
        firmware: {name: 'program.hex', bytes: null, text: new TextDecoder().decode(bytes),
            fCpu: 16_000_000, device: 'atmega328p'}, rom: null, image: null, listing: null
    });
    for (const target of ['atmega2560', 'constructor', '__proto__']) {
        await assert.rejects(compiler.compileCowgol(requestSource, target, {
            fetcher: () => assert.fail('an unqualified target contacted the compiler')
        }), /Unsupported/);
    }
});

test('AVR rejects foreign compiler identity, wrong chip/clock/serial metadata and malformed envelopes', async () => {
    const changes = {
        toolchain: 'avr-gcc', target: 'arduino-uno', language: 'c', format: 'bin',
        artifact_kind: 'source', mcu: 'atmega168p', origin: 2, entry: 2, f_cpu: 8_000_000,
        uart_baud: 19200, bytes: 1, memory_end: 0x305, base64: 'not base64!'
    };
    for (const [key, value] of Object.entries(changes)) {
        const {reply} = avrArtifact();
        reply[key] = value;
        await assert.rejects(compiler.compileCowgol(requestSource, 'atmega328p', {fetcher: fetcher(reply)}), /invalid/i, key);
    }
    for (const key of ['mcu', 'entry', 'origin', 'f_cpu', 'uart_baud', 'memory_end', 'memory_layout']) {
        const {reply} = avrArtifact();
        delete reply[key];
        await assert.rejects(compiler.compileCowgol(requestSource, 'atmega328p', {fetcher: fetcher(reply)}), /invalid/i, key);
    }
});

test('AVR validates HEX checksums, lengths, contiguous addressed flash, EOF and the reset JMP', async () => {
    const {flash} = avrArtifact();
    const data = record(0, [...flash]), eof = record(0, [], 1);
    const changedReset = values => { const bytes = [...flash]; bytes.splice(0, values.length, ...values); return record(0, bytes); };
    for (const text of [
        `${data.slice(0, -2)}00\n${eof}\n`, // checksum
        `:0F${data.slice(3)}\n${eof}\n`, // byte count
        `${data}\n`, // no EOF
        `${data}\n${eof}\n${eof}\n`, // duplicate EOF
        `${data}\n${eof}\n${record(16, [0, 0])}\n`, // data after EOF
        `${record(2, [...flash])}\n${eof}\n`, // missing beginning
        `${record(0, [...flash.subarray(0, 8)])}\n${record(9, [...flash.subarray(8)])}\n${eof}\n`, // hole
        `${record(0, [...flash.subarray(0, 8)])}\n${record(7, [...flash.subarray(8)])}\n${eof}\n`, // overlap
        `${record(0, [])}\n${data}\n${eof}\n`, // empty data
        `${data}\n${record(1, [], 1)}\n`, // nonzero EOF address
        `${data}\n${record(0, [0], 1)}\n`, // nonempty EOF
        `${record(0, [0, 0], 4)}\n${data}\n${eof}\n`, // unqualified extended address
        `${changedReset([0, 0])}\n${eof}\n`, // reset is not JMP
        `${changedReset([0x0c, 0x94, 0, 0])}\n${eof}\n`, // reset branches to first vector
        `${changedReset([0x0c, 0x94, 0x33, 0])}\n${eof}\n`, // reset inside the final vector
        `${changedReset([0x0c, 0x94, 0x3f, 0])}\n${eof}\n`, // reset into ROM initializers for .data
        `${changedReset([0x0c, 0x94, 0x40, 0])}\n${eof}\n`, // reset past loaded flash
        `${data}\n\n${eof}\n`, `${data}\n${eof}\n🌱`
    ]) {
        const {reply} = avrArtifact();
        replaceHex(reply, text);
        await assert.rejects(compiler.compileCowgol(requestSource, 'atmega328p', {fetcher: fetcher(reply)}), /invalid/i, text);
    }
    const {reply} = avrArtifact();
    replaceHex(reply, `${record(0, [...flash.subarray(0, 4)])}\r\n${record(4, [...flash.subarray(4)])}\r\n${eof}\r\n`);
    await compiler.compileCowgol(requestSource, 'atmega328p', {fetcher: fetcher(reply)});
});

test('AVR enforces the bootloader flash boundary and statically reserved SRAM heap/stack', async () => {
    const full = avrArtifact(0x7e00);
    await compiler.compileCowgol(requestSource, 'atmega328p', {fetcher: fetcher(full.reply)});
    const oversized = avrArtifact(0x7e02);
    await assert.rejects(compiler.compileCowgol(requestSource, 'atmega328p', {fetcher: fetcher(oversized.reply)}), /invalid/i);
    const changes = {
        flash_end: 15, flash_limit: 0x8000, data_start: 0, data_end: 0x99, bss_end: 0x701,
        heap_start: 0x100, heap_end: 0x305, stack_start: 0x701, stack_reserve: 511,
        ram_end: 0x901, halted_addr: 0x104, status_addr: 0x102
    };
    for (const [key, value] of Object.entries(changes)) {
        const {reply} = avrArtifact();
        reply.memory_layout[key] = value;
        if (key === 'bss_end') reply.memory_end = value;
        await assert.rejects(compiler.compileCowgol(requestSource, 'atmega328p', {fetcher: fetcher(reply)}), /invalid/i, key);
    }
    for (const key of Object.keys(avrArtifact().reply.memory_layout)) {
        for (const mode of ['missing', 'string']) {
            const {reply} = avrArtifact();
            if (mode === 'missing') delete reply.memory_layout[key];
            else reply.memory_layout[key] = String(reply.memory_layout[key]);
            await assert.rejects(compiler.compileCowgol(requestSource, 'atmega328p', {fetcher: fetcher(reply)}), /invalid/i, `${key} ${mode}`);
        }
    }
});

test('AVR rejects an otherwise valid odd-length flash image, matching service validation', async () => {
    const {reply} = avrArtifact(129);
    await assert.rejects(compiler.compileCowgol(requestSource, 'atmega328p', {fetcher: fetcher(reply)}), /invalid/i);
});

test('Nano requires its own compiler identity, 2 KiB reservation and fixed MCU handoff', async () => {
    const target = 'arduino-nano';
    const {reply, bytes} = avrArtifact(0x7800, target);
    const out = await compiler.compileCowgol(requestSource, target, {fetcher: fetcher(reply)});
    assert.deepEqual(out.bytes, bytes);
    assert.equal(out.filename, 'nano.hex');
    assert.deepEqual(compiler.cowgolAvrDetail(out.bytes, {target}), {
        format: 'firmware', target, kind: 'avr8js',
        firmware: {name: 'nano.hex', bytes: null, text: new TextDecoder().decode(bytes),
            fCpu: 16_000_000, device: 'atmega328p'}, rom: null, image: null, listing: null
    });
    for (const changes of [{board: 'arduino-uno'}, {board: undefined}, {bootloader_reserve: 512},
        {bootloader_reserve: undefined}, {toolchain: 'cowgol-atmega328p'}, {target: 'atmega328p'}]) {
        await assert.rejects(compiler.compileCowgol(requestSource, target, {
            fetcher: fetcher({...reply, ...changes})
        }), /invalid/i);
    }
    const oversized = avrArtifact(0x7802, target);
    await assert.rejects(compiler.compileCowgol(requestSource, target, {fetcher: fetcher(oversized.reply)}), /invalid/i);
    const wrongLimit = avrArtifact(128, target).reply;
    wrongLimit.memory_layout.flash_limit = 0x7e00;
    await assert.rejects(compiler.compileCowgol(requestSource, target, {fetcher: fetcher(wrongLimit)}), /invalid/i);
    assert.throws(() => compiler.cowgolAvrDetail(bytes, {target: 'atmega2560'}), /Unqualified/);
});

test('AVR exit markers must be in zero-initialized SRAM rather than initialized .data', async () => {
    for (const [name, address] of [['halted_addr', 0x100], ['status_addr', 0x101]]) {
        const {reply} = avrArtifact();
        reply.memory_layout[name] = address;
        await assert.rejects(compiler.compileCowgol(requestSource, 'atmega328p', {fetcher: fetcher(reply)}), /invalid/i, name);
    }
});

const importer = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
const extract = (start, end) => {
    const first = importer.indexOf(start), last = importer.indexOf(end, first);
    assert.ok(first >= 0 && last > first, `actual editor boundaries: ${start}`);
    return importer.slice(first, last);
};
const methods = extract('    convertedSource (', '    // source → pseudocode') +
    extract('    codeDevice () {', '    // Publish the device') +
    extract('    stopCodeRun ()', '    disposeCodeRun ()') +
    extract('    async runViaCowgolOnDevice (', '    async runBlocksOnRiscv ()') +
    extract('    async compileCowgolSource (', '    // Read the running project into all languages at once.')
        .replace("await import('../../lib/bw-lang/cowgol-compile.js')", 'await loadCompiler()')
        .replace("await import('../../lib/bw-machines/run-machine.js')", 'await loadMachine()');
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};
const pseudocode = 'GLOBAL total = 2\nWHEN flag clicked:\n  change total by 3\n  say total\n';
const parseProject = (source, device) => {
    const creator = new SB3Creator();
    creator.parse(`${device ? `DEVICE ${device}\n` : ''}${source}`);
    return creator.project;
};

function editorFixture ({device = 'arduino-uno', lang = 'pseudocode', source = pseudocode,
    projectSource = pseudocode, hold = null, output = null, allowed = true, actualDevice = false} = {}) {
    const events = [], builds = [], loads = [], machineRuns = [], downloads = [];
    const entered = deferred(), release = deferred();
    const pause = async phase => { if (phase === hold) { entered.resolve(); await release.promise; } };
    let project = parseProject(projectSource, device);
    let stc = project.stc;
    delete project.stc; // The real VM serializer retains this separately on runtime.
    const makeStage = () => ({id: 'stage', isStage: true, createComment (id, _block, text) {
        const target = project.targets.find(t => t.isStage);
        target.comments ||= {}; target.comments[id] = {text};
    }});
    let stage = makeStage();
    const window = {dispatchEvent: event => events.push(event)};
    const Event = class { constructor (type, options) { this.type = type; this.detail = options.detail; } };
    const build = async (code, target, options) => {
        builds.push({code, target, options});
        await pause('network');
        if (output) return output;
        if (['atmega328p', 'arduino-nano', 'atmega168p'].includes(target)) return {...avrArtifact(128, target), toolchain: `cowgol-${target}`};
        return {bytes: new Uint8Array([0x4d, 0x5a, 0]), toolchain: `cowgol-${target}`,
            image: {entry: 0x1000, segments: [{addr: 0x1000, bytes: new Uint8Array([0x73, 0, 0, 0])}]}};
    };
    const loadCompiler = async () => { await pause('compiler-module'); return {...compiler, compileCowgol: build}; };
    const loadMachine = async () => { await pause('machine-module'); return {runCpmCom: async (config, bytes) => machineRuns.push({config, bytes})}; };
    const Editor = new Function('loadCompiler', 'loadMachine', 'window', 'localStorage', 'CustomEvent',
        'runMachineConfig', 'downloadBlob', 'remoteToolchainsAllowed', 'cowgolTargetForDevice', 'cowgolCanonicalDevice',
        'TWO_WAY', 'DOS_LANG', 'codeArtworkMatches', 'captureCodeArtwork', 'classifyConversionWarnings',
        'conversionFailure', 'LANG_LABEL', 'hiddenCodeDrafts', `return class {${methods}}`)(
        loadCompiler, loadMachine, window, {setItem () {}}, Event,
        async (config, options) => machineRuns.push({config, bytes: (await options.fetcher()).bytes}),
        async (name, blob) => downloads.push({name, bytes: new Uint8Array(await blob.arrayBuffer())}),
        () => allowed, compiler.cowgolTargetForDevice, compiler.cowgolCanonicalDevice, new Set(['cowgol', 'pseudocode']),
        {cowgol: {load: async () => ({default: readCowgol})}}, () => false, () => null,
        () => ({changed: [], unsupported: []}), error => ({message: error.message, issues: []}), {}, () => ({}));
    const editor = new Editor();
    const vm = {
        toJSON: () => JSON.stringify(project),
        runtime: {getTargetForStage: () => stage, targets: [stage], stc},
        setStc (value) { this.runtime.stc = value; }, setEditingTarget () {},
        async loadProject (bytes) {
            loads.push(bytes);
            const zip = await JSZip.loadAsync(bytes);
            project = JSON.parse(await zip.file('project.json').async('string'));
            delete project.stc;
            stage = makeStage(); vm.runtime.targets = [stage];
        }
    };
    Object.assign(editor, {
        props: {vm}, state: {lang, buffers: {pseudocode: `DEVICE ${device}\n${pseudocode}`, [lang]: source}, uploads: [], busy: false, running: false},
        ...(actualDevice ? {} : {codeDevice: () => device}),
        activeCode () { return this.state.buffers[this.state.lang] || ''; },
        setState (update) { const patch = typeof update === 'function' ? update(this.state) : update; if (patch) Object.assign(this.state, patch); },
        lib: async () => { await pause('builder-module'); return {default: SB3Creator}; },
        genOpts: () => ({}), selectedBasicProfile: () => null, canLiftAsm: () => false,
        publishAppliedDevice () {},
        L: {cowgolCompiling: 'compiling', cowgolStale: 'stale', stCompiling: 'importing', stLoaded: 'loaded',
            cowgolNativeTargetUnavailable: 'native compiler target unavailable',
            stError: message => `error: ${message}`, stWarn: message => message}
    });
    return {editor, vm, window, events, builds, loads, machineRuns, downloads, entered, release,
        setDevice: value => { device = value; },
        replaceStage: () => { stage = makeStage(); vm.runtime.targets = [stage]; },
        editBlocks: () => { Object.values(project.targets[0].blocks).find(block => block.topLevel).next = null; },
        currentProject: () => ({...JSON.parse(vm.toJSON()), stc: vm.runtime.stc})};
}

test('the actual native Blocks method sends real checked Cowgol to every qualified compiler/loader', async () => {
    for (const device of ['z80', 'i8086', 'i80386', 'riscv32', 'eater6502', 'arduino-uno', 'atmega328p', 'arduino-nano', 'atmega168p']) {
        const f = editorFixture({device});
        const target = compiler.cowgolTargetForDevice(device);
        const generated = new SB3Creator().generateCowgol(f.currentProject(), {target});
        assert.equal(generated.ok, true, generated.reasons?.join('; '));
        await f.editor.compileCowgolSource(target, true, {fromBlocks: true});
        assert.equal(f.builds.length, 1, f.editor.state.status);
        assert.equal(f.builds[0].target, target);
        assert.equal(f.builds[0].code, generated.cowgol);
        assert.match(f.builds[0].code, /bw_checked_add/);
        assert.notEqual(f.builds[0].code, f.editor.activeCode());
        if (device === 'z80' || device === 'i8086' || device === 'i80386') {
            assert.equal(f.machineRuns.length, 1, device);
            assert.equal(f.machineRuns[0].config.machine, device);
        } else {
            assert.equal(f.events.filter(event => event.type === 'bw-asm-rom-ready').length, 1, device);
            assert.equal(f.window.__bwPendingMedia.detail.target, target);
        }
        assert.equal(f.editor.state.busy, false);
        assert.equal(f.editor._cowgolCompile, null);
    }
});

test('explicit 8080 selection imports checked source through the actual editor and keeps the Z80 machine', async () => {
    for (const lang of ['pseudocode', 'cowgol']) {
        const source = lang === 'pseudocode' ? `DEVICE Z80\n${pseudocode}` :
            '# @bw-declaration "DEVICE Z80"\nvar total: int32 := 2; total := total + 3; bw_print_number(total);';
        const f = editorFixture({device: 'z80', lang, source, actualDevice: true});
        await f.editor.runViaCowgolOnDevice({compilerTarget: 'i8080-cpm'});
        assert.equal(f.loads.length, 1, f.editor.state.status);
        assert.equal(f.builds.length, 1, f.editor.state.status);
        assert.equal(f.builds[0].target, 'i8080-cpm');
        const expected = new SB3Creator().generateCowgol(f.currentProject(), {target: 'i8080-cpm'});
        assert.equal(expected.ok, true, expected.reasons?.join('; '));
        assert.equal(f.builds[0].code, expected.cowgol);
        assert.match(f.builds[0].code, /bw_checked_add/);
        assert.equal(f.currentProject().stc.device, 'z80');
        assert.equal(f.machineRuns.length, 1, f.editor.state.status);
        assert.equal(f.machineRuns[0].config.machine, 'z80');
        assert.deepEqual(f.machineRuns[0].config.cpu, {variant: 'z80'});
        assert.equal(f.machineRuns[0].config.provenance.compilerTarget, 'i8080-cpm');
    }
});

test('invalid explicit compiler selections refuse before the actual project import', async () => {
    for (const [device, compilerTarget] of [['z80', 'dos'], ['i8086', 'i8080-cpm'], ['z80', null], ['z80', 'constructor']]) {
        const f = editorFixture({device});
        const before = JSON.stringify(f.currentProject());
        await f.editor.runViaCowgolOnDevice({compilerTarget});
        assert.equal(f.loads.length, 0);
        assert.equal(f.builds.length, 0);
        assert.equal(f.machineRuns.length, 0);
        assert.equal(f.events.length, 0);
        assert.equal(JSON.stringify(f.currentProject()), before);
        assert.match(f.editor.state.status, /native compiler target unavailable/);
    }
});

test('checked DEVICE I80386 imports through the actual editor and reaches its native DOS loader', async () => {
    const source = `DEVICE I80386\n${pseudocode}`;
    const f = editorFixture({device: 'i80386', lang: 'pseudocode', source, actualDevice: true});
    await f.editor.runViaCowgolOnDevice();
    assert.equal(f.loads.length, 1, f.editor.state.status);
    assert.equal(f.builds.length, 1, f.editor.state.status);
    assert.equal(f.builds[0].target, 'dos');
    assert.match(f.builds[0].code, /DEVICE I80386/);
    assert.match(f.builds[0].code, /bw_checked_add/);
    assert.equal(f.machineRuns.length, 1, f.editor.state.status);
    assert.equal(f.machineRuns[0].config.machine, 'i80386');
    assert.equal(f.machineRuns[0].config.machineConfig, 'dos-service');
    assert.equal(f.editor.state.buffers.c, '', 'an unavailable device C view must not break the Cowgol import');
    assert.equal(f.currentProject().stc.device, 'i80386');
});

test('From blocks keeps the I80386 Cowgol and pseudocode views when ordinary C is unavailable', async () => {
    const method = extract('    async fromBlocks () {', '    /** Imperative API: highlight a source line');
    const Editor = new Function('loadAssets', 'standaloneBasicDrafts', 'dosLangBuffersFor', 'captureCodeArtwork',
        'hiddenCodeDrafts', 'conversionFailure', `return class {${method.replace(
            "await import('../../lib/bw-asset-library.js')", 'await loadAssets()')}}`)(
        async () => assetLibrary, () => ({}), async (project, lang) => {
            assert.equal(lang, 'cowgol');
            const generated = new SB3Creator().generateCowgol(project);
            assert.equal(generated.ok, true, generated.reasons?.join('; '));
            return {cowgol: generated.cowgol};
        }, () => null, () => ({}), error => ({message: error.message, issues: []}));
    const editor = new Editor();
    const project = parseProject(pseudocode, 'i80386');
    const before = JSON.stringify(project);
    Object.assign(editor, {
        state: {lang: 'cowgol', buffers: {cowgol: 'previous draft'}},
        props: {vm: {toJSON: () => JSON.stringify(project), runtime: {stc: project.stc, targets: []}}},
        lib: async () => ({default: SB3Creator}), selectedBasicProfile: () => null, genOpts: () => ({}),
        codeDevice: () => 'i80386', L: {stReading: 'reading', stError: message => `error: ${message}`},
        setState (change) { Object.assign(this.state, typeof change === 'function' ? change(this.state) : change); }
    });
    await editor.fromBlocks();
    assert.equal(editor.state.busy, false);
    assert.equal(editor.state.conversionReport.preserved, true, editor.state.status);
    assert.match(editor.state.buffers.pseudocode, /DEVICE I80386/i);
    assert.match(editor.state.buffers.cowgol, /DEVICE I80386/);
    assert.match(editor.state.buffers.cowgol, /bw_print_number/);
    assert.equal(editor.state.buffers.c, '');
    assert.ok(editor.state.conversionReport.unsupported.some(message => /no device C backend/.test(message)));
    assert.equal(JSON.stringify(project), before);
});

test('authored AVR source bypasses the subset and delivers exact firmware through the editor', async () => {
    const source = 'var data: uint8[] := {1, 2, 3, 4};';
    const {bytes} = avrArtifact();
    const f = editorFixture({lang: 'cowgol', source, output: {bytes, toolchain: 'cowgol-atmega328p'}});
    await f.editor.compileCowgolSource('atmega328p', true);
    assert.equal(f.builds[0].code, source);
    const event = f.events.find(item => item.type === 'bw-asm-rom-ready');
    assert.deepEqual(event.detail, compiler.cowgolAvrDetail(bytes));
    assert.equal(f.window.__bwPendingMedia.detail, event.detail);
    assert.equal(f.loads.length, 0);
});

test('native Blocks runtime refusal never calls the compiler or replaces/starts a project', async () => {
    for (const [device, source] of [
        ['z80', 'WHEN flag clicked:\n  wait 1 seconds\n'],
        ['eater6502', 'WHEN flag clicked:\n  clear\n'],
        ['arduino-uno', 'GLOBAL duration = 1\nWHEN flag clicked:\n  wait duration seconds\n']
    ]) {
        const f = editorFixture({device, projectSource: source});
        await f.editor.compileCowgolSource(compiler.cowgolTargetForDevice(device), true, {fromBlocks: true});
        assert.equal(f.builds.length, 0, device);
        assert.equal(f.loads.length, 0);
        assert.equal(f.events.length, 0);
        assert.equal(f.machineRuns.length, 0);
        assert.match(f.editor.state.status, /^error:/);
        assert.equal(f.editor.state.busy, false);
    }
});

test('Uno, classic Nano and both bare AVR chip editor routes emit native timed digital sequences', async () => {
    for (const device of ['arduino-uno', 'arduino-nano', 'atmega328p', 'atmega168p']) {
        const source = `DEVICE ${device.toUpperCase()}\nPIN lamp = D13 OUTPUT\n` +
            'WHEN flag clicked:\n  turn on lamp\n  wait 0.001 seconds\n  turn off lamp\n';
        const f = editorFixture({device, lang: 'pseudocode', source});
        await f.editor.runViaCowgolOnDevice();
        assert.equal(f.loads.length, 1, f.editor.state.status);
        assert.equal(f.builds.length, 1, f.editor.state.status);
        assert.match(f.builds[0].code, /bw_digital_write\(13, 1\);\s+bw_delay\(1\);\s+bw_digital_write\(13, 0\);/);
        const target = compiler.cowgolTargetForDevice(device);
        assert.equal(f.builds[0].target, target);
        const media = f.events.filter(event => event.type === 'bw-asm-rom-ready');
        assert.equal(media.length, 1);
        assert.deepEqual(media[0].detail, compiler.cowgolAvrDetail(avrArtifact().bytes, {target}));
    }
});

const revocations = {
    'source edit': f => { f.editor.state.buffers = {...f.editor.state.buffers, [f.editor.state.lang]: 'new source'}; },
    'source edit and revert': f => { const source = f.editor.activeCode(); f.editor.state.buffers = {...f.editor.state.buffers, [f.editor.state.lang]: 'changed'}; f.editor.state.buffers = {...f.editor.state.buffers, [f.editor.state.lang]: source}; },
    'language switch': f => { f.editor.state.lang = 'cowgol'; },
    'machine selection': f => f.setDevice('riscv32'),
    'device metadata': f => { f.vm.runtime.stc.clock = 8_000_000; },
    'Blocks edit': f => f.editBlocks(),
    'project replacement': f => f.replaceStage(),
    abort: f => f.editor._cowgolCompile.abort(),
    'request replacement': f => { f.editor._cowgolCompile = new AbortController(); f.editor.state.status = 'new owner'; },
    unmount: f => { f.editor._unmounted = true; }
};
for (const hold of ['compiler-module', 'builder-module', 'network']) {
    test(`native Blocks request revokes stale work during ${hold}`, async () => {
        for (const [reason, revoke] of Object.entries(revocations)) {
            const f = editorFixture({hold});
            const pending = f.editor.compileCowgolSource('atmega328p', true, {fromBlocks: true});
            await f.entered.promise;
            revoke(f); f.release.resolve(); await pending;
            assert.equal(f.events.length, 0, reason);
            assert.equal(f.machineRuns.length, 0, reason);
            assert.equal(f.downloads.length, 0, reason);
            assert.equal(f.builds.length, hold === 'network' ? 1 : 0, reason);
            if (reason === 'request replacement') {
                assert.equal(f.editor.state.status, 'new owner');
                assert.equal(f.editor.state.busy, true, 'old completion cannot clear a newer request');
            } else if (reason !== 'unmount') assert.equal(f.editor.state.busy, false, reason);
        }
    });
}

test('a CP/M Blocks edit during the delayed machine loader revokes handoff', async () => {
    const f = editorFixture({device: 'z80', hold: 'machine-module'});
    const pending = f.editor.compileCowgolSource('z80-cpm', true, {fromBlocks: true});
    await f.entered.promise;
    f.editBlocks(); f.release.resolve(); await pending;
    assert.equal(f.builds.length, 1);
    assert.equal(f.machineRuns.length, 0);
});

test('pseudocode and Cowgol native actions preflight real profiles before applying Blocks', async () => {
    for (const lang of ['pseudocode', 'cowgol']) {
        const source = lang === 'pseudocode' ? 'WHEN flag clicked:\n  wait 1 seconds\n' : 'bw_delay(1000);';
        const f = editorFixture({device: 'z80', lang, source});
        const before = f.vm.toJSON(), stage = f.vm.runtime.getTargetForStage();
        await f.editor.runViaCowgolOnDevice();
        assert.match(f.editor.state.status, /delay|timing|wait|clock/i);
        assert.equal(f.loads.length, 0);
        assert.equal(f.builds.length, 0);
        assert.equal(f.vm.toJSON(), before);
        assert.equal(f.vm.runtime.getTargetForStage(), stage);
        assert.equal(f.editor.state.busy, false);
        assert.equal(f.editor.state.conversionReport.preserved, false);
    }
});

test('native actions preserve the selected device and use the successfully imported program', async () => {
    for (const lang of ['pseudocode', 'cowgol']) {
        const source = lang === 'pseudocode' ? pseudocode : 'var total: int32 := 2; total := total + 3; bw_print_number(total);';
        const f = editorFixture({lang, source});
        await f.editor.runViaCowgolOnDevice();
        assert.equal(f.loads.length, 1, f.editor.state.status);
        assert.equal(f.builds.length, 1, f.editor.state.status);
        assert.equal(f.vm.runtime.stc.device, 'arduino-uno');
        assert.equal(f.builds[0].target, 'atmega328p');
        assert.equal(f.editor.activeCode(), source);
        assert.match(f.builds[0].code, /bw_checked_add/);
        assert.equal(f.events.filter(event => event.type === 'bw-asm-rom-ready').length, 1);
        assert.equal(f.editor.state.busy, false);
    }
});

test('actual Uno and Nano DEVICE aliases survive strict import and canonical device metadata publication', async () => {
    for (const [alias, device, target] of [['UNO', 'arduino-uno', 'atmega328p'], ['NANO', 'arduino-nano', 'arduino-nano']]) {
        for (const lang of ['pseudocode', 'cowgol']) {
            const source = lang === 'pseudocode' ? `DEVICE ${alias}\n${pseudocode}` :
                `# @bw-declaration "DEVICE ${device.toUpperCase()}"\nbw_print_number(42);`;
            const f = editorFixture({device: alias, lang, source, actualDevice: true});
            assert.equal(f.editor.currentDevice(), alias.toLowerCase());
            assert.equal(f.editor.codeDevice(), alias.toLowerCase());
            await f.editor.runViaCowgolOnDevice();
            assert.equal(f.loads.length, 1, `${alias}/${lang}: ${f.editor.state.status}`);
            assert.equal(f.builds.length, 1, `${alias}/${lang}: ${f.editor.state.status}`);
            assert.equal(f.builds[0].target, target);
            assert.equal(f.vm.runtime.stc.device, device);
            assert.equal(f.editor.activeCode(), source);
            assert.equal(f.events.filter(event => event.type === 'bw-asm-rom-ready').length, 1);
        }
    }
});

test('native actions refuse conflicting devices and revoke edited/reverted imports before load', async () => {
    for (const lang of ['pseudocode', 'cowgol']) {
        const conflict = lang === 'pseudocode' ? `DEVICE PICO\n${pseudocode}` : '# @bw-declaration "DEVICE PICO"\nbw_print_number(42);';
        const wrong = editorFixture({lang, source: conflict});
        await wrong.editor.runViaCowgolOnDevice();
        assert.match(wrong.editor.state.status, /different machine/);
        assert.equal(wrong.loads.length, 0);
        assert.equal(wrong.builds.length, 0);
        const f = editorFixture({lang, source: lang === 'cowgol' ? requestSource : pseudocode, hold: 'builder-module'});
        const pending = f.editor.runViaCowgolOnDevice();
        await f.entered.promise;
        revocations['source edit and revert'](f);
        f.release.resolve(); await pending;
        assert.equal(f.loads.length, 0);
        assert.equal(f.builds.length, 0);
        assert.equal(f.events.length, 0);
    }
});

test('Stop during a pending native import prevents its later compiler launch', async () => {
    const f = editorFixture({hold: 'builder-module'});
    const pending = f.editor.runViaCowgolOnDevice();
    await f.entered.promise;
    f.editor.stopCodeRun();
    f.release.resolve(); await pending;
    assert.equal(f.builds.length, 0);
    assert.equal(f.events.length, 0);
    assert.equal(f.machineRuns.length, 0);
    assert.equal(f.editor._cowgolBlocksImport, null);
});

test('disabled native actions do not import or contact a hosted compiler', async () => {
    for (const opts of [{allowed: false}, {device: 'pico'}, {lang: 'javascript'}]) {
        const f = editorFixture(opts);
        f.editor.compile = () => assert.fail('unavailable action attempted import');
        await f.editor.runViaCowgolOnDevice();
        assert.equal(f.loads.length, 0);
        assert.equal(f.builds.length, 0);
        assert.equal(f.events.length, 0);
    }
});

test('bare ATmega168P enforces 16 KiB flash, 1 KiB SRAM, its smaller heap and exact MCU handoff', async () => {
    const target = 'atmega168p';
    const {reply, bytes} = avrArtifact(0x4000, target);
    const out = await compiler.compileCowgol(requestSource, target, {fetcher: fetcher(reply)});
    assert.deepEqual(out.bytes, bytes);
    assert.equal(out.filename, 'atmega168p.hex');
    assert.deepEqual(compiler.cowgolAvrDetail(out.bytes, {target}), {
        format: 'firmware', target, kind: 'avr8js',
        firmware: {name: 'atmega168p.hex', bytes: null, text: new TextDecoder().decode(bytes),
            fCpu: 16_000_000, device: 'atmega168p'}, rom: null, image: null, listing: null
    });
    for (const changes of [{mcu: 'atmega328p'}, {board: 'arduino-nano'}, {board: undefined},
        {bootloader_reserve: 512}, {bootloader_reserve: undefined},
        {toolchain: 'cowgol-atmega328p'}, {target: 'atmega328p'}]) {
        await assert.rejects(compiler.compileCowgol(requestSource, target, {
            fetcher: fetcher({...reply, ...changes})
        }), /invalid/i);
    }
    await assert.rejects(compiler.compileCowgol(requestSource, target, {
        fetcher: fetcher(avrArtifact(0x4002, target).reply)
    }), /invalid/i);
    for (const [key, value] of Object.entries({
        mcu: 'atmega328p', flash_size: 0x8000, flash_limit: 0x7e00, heap_size: 512,
        ram_end: 0x900, stack_start: 0x700, stack_reserve: 511, heap_end: 0x304, bss_end: 0x301
    })) {
        const changed = structuredClone(reply);
        changed.memory_layout[key] = value;
        if (key === 'bss_end') changed.memory_end = value;
        await assert.rejects(compiler.compileCowgol(requestSource, target, {fetcher: fetcher(changed)}), /invalid/i, key);
    }
    for (const key of Object.keys(reply.memory_layout)) {
        const changed = structuredClone(reply);
        delete changed.memory_layout[key];
        await assert.rejects(compiler.compileCowgol(requestSource, target, {fetcher: fetcher(changed)}), /invalid/i, key);
    }
    // Both ends of the 512-byte stack reservation are fixed by the actual chip.
    const boundary = avrArtifact(128, target).reply;
    boundary.memory_layout.bss_end = boundary.memory_end = 0x300;
    await compiler.compileCowgol(requestSource, target, {fetcher: fetcher(boundary)});
});

test('native editor refuses a portable CrispBASIC project before network or project replacement', async () => {
    const source = '# @crispbasic-portable 1\nWHEN flag clicked:\n  say 42\n';
    const f = editorFixture({device: 'atmega328p', projectSource: source});
    const before = f.vm.toJSON();
    await f.editor.compileCowgolSource('atmega328p', true, {fromBlocks: true});
    assert.equal(f.builds.length, 0);
    assert.equal(f.loads.length, 0);
    assert.equal(f.events.length, 0);
    assert.equal(f.vm.toJSON(), before);
    assert.match(f.editor.state.status, /requires CrispBASIC mode/);
});
