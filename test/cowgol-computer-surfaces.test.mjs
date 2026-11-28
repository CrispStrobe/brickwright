// These tests exercise the actual editor and machine activation boundary.
// Guest execution under CP/M 2.2 is a separate machine qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as compiler from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-compile.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';
import {validateMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/machine-config.js';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';

const authored = 'include "cowgol.coh"; var values: uint8[] := {2, 3, 5}; print("CP/M");';
const bytes = Uint8Array.of(0xc9);
const importer = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
const extract = (start, end) => {
    const from = importer.indexOf(start), to = importer.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return importer.slice(from, to);
};
const methods = extract('    async runViaCowgolOnDevice (', '    async runBlocksOnRiscv ()') +
    extract('    async compileCowgolSource (', '    async compile ({')
        .replace("await import('../../lib/bw-lang/cowgol-compile.js')", 'await loadCompiler()');
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};

function fixture ({hold = null, images = true, toolchains = true, device = 'z80', lang = 'cowgol',
    failure = null, replyChange = {}} = {}) {
    const built = [], mounted = [], dispatched = [], imports = [];
    const entered = deferred(), release = deferred();
    const pause = async phase => { if (hold === phase) { entered.resolve(); await release.promise; } };
    const creator = new SB3Creator();
    creator.parse('DEVICE Z80\nGLOBAL total = 2\nWHEN flag clicked:\n  change total by 3\n  say total\n');
    const project = creator.project;
    let stage = {};
    const fetcher = async (_url, options) => {
        const input = JSON.parse(options.body);
        built.push(input);
        await pause('network');
        return {ok: true, status: 200, json: async () => ({success: true,
            language: 'cowgol', target: input.target,
            format: 'bin', artifact_kind: 'executable',
            toolchain: input.target === 'z80-cpm' ? 'cowgol-cpmz' : 'cowgol-cpm',
            base64: Buffer.from(bytes).toString('base64'), bytes: bytes.length, origin: 0x100,
            ...replyChange})};
    };
    const loadCompiler = async () => {
        await pause('compiler-module');
        return {...compiler, compileCowgol: (code, target, options) => compiler.compileCowgol(code, target, {...options, fetcher})};
    };
    const machine = (config, options) => runMachineConfig(config, {
        ...options,
        awaitBoot: true,
        fetcher: async ref => {
            mounted.push(ref);
            await pause('media');
            return options.fetcher(ref);
        },
        dispatch: detail => {
            dispatched.push(detail);
            queueMicrotask(() => failure ? detail.bootCompletion.reject(new Error(failure)) : detail.bootCompletion.resolve());
        }
    });
    const Editor = new Function('loadCompiler', 'runMachineConfig', 'remoteMachineImagesAllowed',
        'remoteToolchainsAllowed', 'cowgolTargetForDevice', 'cowgolCanonicalDevice', `return class {${methods}}`)(
        loadCompiler, machine, () => images, () => toolchains, compiler.cowgolTargetForDevice, compiler.cowgolCanonicalDevice);
    const editor = new Editor();
    Object.assign(editor, {
        state: {lang, buffers: {[lang]: authored}, busy: false, running: false},
        L: {cowgolCompiling: 'compiling', cowgolStale: 'stale',
            cowgolCpmImagesUnavailable: 'images unavailable', cowgolCpmTargetRequired: 'CP/M target required',
            cowgolNativeTargetUnavailable: 'native compiler target unavailable',
            stError: message => `error: ${message}`},
        activeCode () { return this.state.buffers[this.state.lang]; },
        codeDevice: () => device,
        setState (change) { Object.assign(this.state, typeof change === 'function' ? change(this.state) : change); },
        props: {vm: {toJSON: () => JSON.stringify(project), runtime: {
            getTargetForStage: () => stage, stc: project.stc
        }}},
        lib: async () => ({default: SB3Creator}),
        compile: async options => { imports.push(options); await pause('import'); return true; }
    });
    return {editor, built, mounted, dispatched, imports, entered, release,
        setDevice: value => { device = value; },
        setImages: value => { images = value; },
        replaceStage: () => { stage = {}; },
        editBlocks: () => { project.targets[0].name = 'changed'; },
        editDevice: () => { project.stc.clock = 1_000_000; }};
}

test('CP/M 2.2 configs mount one program and explicitly retain the Z80 CPU', () => {
    for (const target of ['z80-cpm', 'i8080-cpm']) for (const display of [false, true]) {
        const config = compiler.cowgolCpmSystemConfig({target, display});
        assert.deepEqual(validateMachineConfig(config), {ok: true, errors: []});
        assert.equal(config.machine, 'z80');
        assert.deepEqual(config.cpu, {variant: 'z80'});
        assert.deepEqual(config.slots, {cpmsys: {url: 'local-media:cowgol.com'}});
        assert.deepEqual(config.bootOrder, ['cpmsys']);
        assert.equal(config.provenance.program.name, 'COWGOL.COM');
        assert.equal(config.provenance.cpmLaunch, 'COWGOL.COM');
        assert.equal(config.provenance.compilerTarget, target);
        assert.equal(config.machineConfig, display ? 'CPM64K_TMS9918' : undefined);
        assert.equal(config.widgets.length, display ? 1 : 0);
    }
    for (const options of [{target: 'dos'}, {target: 'constructor'}, {display: 'yes'}]) {
        assert.throws(() => compiler.cowgolCpmSystemConfig(options), /CP\/M program/);
    }
});

test('full-source actions activate real CP/M 2.2 console and Controller contracts with exact compiled bytes', async () => {
    for (const target of ['z80-cpm', 'i8080-cpm']) for (const surface of ['cpm-system', 'cpm-vdp']) {
        const f = fixture();
        await f.editor.compileCowgolSource(target, true, {surface});
        assert.deepEqual(f.built, [{language: 'cowgol', code: authored, target, format: 'bin'}]);
        assert.deepEqual(f.mounted.map(ref => ref.url), ['local-media:cowgol.com']);
        assert.equal(f.dispatched.length, 1, f.editor.state.status);
        const detail = f.dispatched[0];
        assert.equal(detail.kind, 'z80');
        assert.equal(detail.slotId, 'cpmsys');
        assert.equal(detail.profile, 'cpm-system');
        assert.equal(detail.name, 'COWGOL.COM');
        assert.equal(detail.cpmLaunch, 'COWGOL');
        assert.deepEqual(detail.bytes, bytes);
        assert.equal(detail.machineView, surface === 'cpm-vdp' ? 'controller' : 'debugger');
        assert.equal(detail.machinePreset, surface === 'cpm-vdp' ? 'CPM64K_TMS9918' : null);
        if (surface === 'cpm-vdp') assert.deepEqual(detail.widgets, [{name: 'TMS9918A',
            type: 'simplevga', source: 'video', layout: null, config: {width: 256, height: 192}}]);
        assert.equal(detail.bootCompletion, undefined, 'settled completion is removed from retained media');
        assert.equal(f.imports.length, 0, 'full Cowgol remains outside the checked reader');
        assert.equal(f.editor.state.busy, false);
    }
});

test('checked native Blocks select either CP/M compiler on both real computer surfaces', async () => {
    for (const target of ['z80-cpm', 'i8080-cpm']) for (const surface of ['cpm-system', 'cpm-vdp']) {
        const f = fixture({lang: 'pseudocode'});
        await f.editor.runViaCowgolOnDevice({surface, compilerTarget: target});
        assert.deepEqual(f.imports, [{strict: true, targetDevice: 'z80', cowgolTarget: target}]);
        assert.equal(f.built.length, 1, f.editor.state.status);
        assert.equal(f.built[0].target, target);
        assert.match(f.built[0].code, /bw_checked_add/);
        assert.notEqual(f.built[0].code, authored);
        assert.equal(f.dispatched.length, 1, f.editor.state.status);
        assert.equal(f.dispatched[0].kind, 'z80');
        assert.equal(f.dispatched[0].profile, 'cpm-system');
        assert.equal(f.dispatched[0].machineView, surface === 'cpm-vdp' ? 'controller' : 'debugger');
        assert.equal(f.dispatched[0].machinePreset, surface === 'cpm-vdp' ? 'CPM64K_TMS9918' : null);
        assert.deepEqual(f.dispatched[0].bytes, bytes);
    }
});

test('CP/M computer actions refuse disabled images and incompatible targets before build or import', async () => {
    for (const target of ['z80-cpm', 'i8080-cpm']) for (const surface of ['cpm-system', 'cpm-vdp']) {
        const denied = fixture({images: false});
        await denied.editor.compileCowgolSource(target, true, {surface});
        await denied.editor.runViaCowgolOnDevice({surface, compilerTarget: target});
        assert.equal(denied.built.length, 0);
        assert.equal(denied.imports.length, 0);
        assert.equal(denied.dispatched.length, 0);
        assert.match(denied.editor.state.status, /images unavailable/);
        const wrong = fixture();
        await wrong.editor.compileCowgolSource('dos', true, {surface});
        assert.equal(wrong.built.length, 0);
        assert.match(wrong.editor.state.status, /CP\/M target required/);
    }
    const disabled = fixture({toolchains: false});
    await disabled.editor.runViaCowgolOnDevice({surface: 'cpm-system', compilerTarget: 'i8080-cpm'});
    assert.equal(disabled.imports.length, 0);
    const wrong = fixture({device: 'riscv32'});
    await wrong.editor.runViaCowgolOnDevice({surface: 'cpm-vdp', compilerTarget: 'i8080-cpm'});
    assert.equal(wrong.imports.length, 0);
    assert.equal(wrong.built.length, 0);
    assert.match(wrong.editor.state.status, /native compiler target unavailable/);
    const wrongSurface = fixture();
    await wrongSurface.editor.runViaCowgolOnDevice({surface: 'dos-display', compilerTarget: 'i8080-cpm'});
    assert.equal(wrongSurface.imports.length, 0);
    assert.equal(wrongSurface.built.length, 0);
    assert.equal(wrongSurface.dispatched.length, 0);
});

test('the checked CP/M compiler choice is captured before an asynchronous import', async () => {
    const f = fixture({hold: 'import', lang: 'pseudocode'});
    const options = {surface: 'cpm-system', compilerTarget: 'i8080-cpm'};
    const pending = f.editor.runViaCowgolOnDevice(options);
    await f.entered.promise;
    assert.equal(f.editor._cowgolBlocksImport.compilerTarget, 'i8080-cpm');
    options.compilerTarget = 'z80-cpm';
    f.release.resolve();
    await pending;
    assert.equal(f.built.length, 1, f.editor.state.status);
    assert.equal(f.built[0].target, 'i8080-cpm');
    assert.equal(f.dispatched.length, 1);
    assert.equal(f.editor._cowgolBlocksImport, null);

    const replaced = fixture({hold: 'import', lang: 'pseudocode'});
    const stale = replaced.editor.runViaCowgolOnDevice({surface: 'cpm-system', compilerTarget: 'i8080-cpm'});
    await replaced.entered.promise;
    const newOwner = {compilerTarget: 'z80-cpm'};
    replaced.editor._cowgolBlocksImport = newOwner;
    replaced.release.resolve();
    await stale;
    assert.equal(replaced.built.length, 0);
    assert.equal(replaced.dispatched.length, 0);
    assert.equal(replaced.editor._cowgolBlocksImport, newOwner);
});

test('a checked 8080 CP/M request rejects another compiler target or toolchain before activation', async () => {
    for (const replyChange of [{target: 'z80-cpm'}, {toolchain: 'cowgol-cpmz'}]) {
        const f = fixture({lang: 'pseudocode', replyChange});
        await f.editor.runViaCowgolOnDevice({surface: 'cpm-vdp', compilerTarget: 'i8080-cpm'});
        assert.equal(f.built.length, 1);
        assert.equal(f.built[0].target, 'i8080-cpm');
        assert.equal(f.dispatched.length, 0);
        assert.match(f.editor.state.status, /invalid artifact/);
        assert.equal(f.editor.state.busy, false);
    }
});

const revoke = {
    edit: f => { f.editor.state.buffers = {cowgol: 'changed'}; },
    'edit and revert': f => { f.editor.state.buffers = {cowgol: authored}; },
    language: f => { f.editor.state.lang = 'python'; },
    machine: f => f.setDevice('riscv32'),
    project: f => f.replaceStage(),
    Blocks: f => f.editBlocks(),
    'device metadata': f => f.editDevice(),
    cancellation: f => f.editor._cowgolCompile.abort(),
    unmount: f => { f.editor._unmounted = true; },
    replacement: f => { f.editor._cowgolCompile = new AbortController(); f.editor.state.status = 'new owner'; }
};
for (const phase of ['compiler-module', 'network', 'media']) {
    test(`CP/M computer ownership is rechecked during ${phase}`, async () => {
        for (const [reason, change] of Object.entries(revoke)) {
            const f = fixture({hold: phase});
            const pending = f.editor.compileCowgolSource('z80-cpm', true, {surface: 'cpm-vdp'});
            await f.entered.promise;
            change(f);
            f.release.resolve();
            await pending;
            assert.equal(f.dispatched.length, 0, reason);
            if (reason === 'replacement') assert.equal(f.editor.state.status, 'new owner');
        }
    });
}

test('image policy revocation during activation and stopped checked import cannot boot later', async () => {
    const f = fixture({hold: 'media'});
    const pending = f.editor.compileCowgolSource('z80-cpm', true, {surface: 'cpm-system'});
    await f.entered.promise;
    f.setImages(false);
    f.release.resolve();
    await pending;
    assert.equal(f.dispatched.length, 0);
    const checked = fixture({hold: 'import', lang: 'pseudocode'});
    const importing = checked.editor.runViaCowgolOnDevice({surface: 'cpm-system'});
    await checked.entered.promise;
    checked.editor._cowgolBlocksImport = null;
    checked.release.resolve();
    await importing;
    assert.equal(checked.built.length, 0);
});

test('invalid compiler artifacts and failed CP/M attachment remain visible failures', async () => {
    const invalid = fixture({replyChange: {toolchain: 'cowgol-msdos'}});
    await invalid.editor.compileCowgolSource('z80-cpm', true, {surface: 'cpm-system'});
    assert.equal(invalid.dispatched.length, 0);
    assert.match(invalid.editor.state.status, /invalid artifact/);
    const failed = fixture({failure: 'CP/M BIOS did not load'});
    await failed.editor.compileCowgolSource('z80-cpm', true, {surface: 'cpm-vdp'});
    assert.match(failed.editor.state.status, /CP\/M BIOS did not load/);
    assert.equal(failed.editor.state.busy, false);
});
