import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COWGOL_DOS_VARIANTS, cowgolDosConfig, cowgolDosVariantForDevice} from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-dos.js';
import * as compiler from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-compile.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';
import {validateMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/machine-config.js';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';

test('DOS CPU and display choices survive the actual media activation boundary', async () => {
    const bytes = Uint8Array.of(0x4d, 0x5a);
    for (const variant of COWGOL_DOS_VARIANTS) for (const display of [false, true]) {
        const config = cowgolDosConfig({variant, display});
        assert.deepEqual(validateMachineConfig(config), {ok: true, errors: []});
        assert.equal(config.machine, `i${variant}`);
        assert.deepEqual(config.cpu, {variant});
        assert.deepEqual(config.provenance, {language: 'cowgol', compilerTarget: 'dos'});
        const {detail} = await runMachineConfig(config, {fetcher: async ref => {
            assert.equal(ref.url, 'local-media:cowgol.exe');
            return {bytes};
        }, dispatch () {}});
        assert.equal(detail.kind, 'i8086');
        assert.equal(detail.slotId, 'exe');
        assert.equal(detail.profile, 'dos');
        assert.equal(detail.x86Variant, variant);
        assert.equal(detail.dosVariant, variant);
        assert.deepEqual(detail.bytes, bytes);
        assert.equal(detail.widgets.length, display ? 1 : 0);
        if (display) assert.deepEqual(detail.widgets[0], {name: 'DOS text display', type: 'simplevga',
            source: 'video', config: {width: 720, height: 400}, layout: null});
    }
});

test('a DOS machine choice is explicit and cannot turn the separate 386 AT into an 8086 alias', () => {
    assert.equal(cowgolDosConfig().cpu.variant, '8086');
    for (const variant of ['80386', 'i8086', '8088', 'constructor', '', null, 8086]) {
        assert.throws(() => cowgolDosConfig({variant}), /8086, 80186 or 80286/);
    }
    for (const display of ['yes', 0, null]) assert.throws(() => cowgolDosConfig({display}), /Boolean display/);
    for (const variant of COWGOL_DOS_VARIANTS) {
        assert.equal(cowgolDosVariantForDevice(`i${variant}`), variant);
        assert.equal(cowgolDosVariantForDevice(variant), variant);
    }
    for (const device of ['i80386', 'arduino-uno', 'constructor', null]) assert.equal(cowgolDosVariantForDevice(device), null);
    assert.equal(compiler.cowgolTargetForDevice('i80386'), null);
    const config = cowgolDosConfig({display: true});
    config.widgets[0].config.width = 1;
    assert.equal(cowgolDosConfig({display: true}).widgets[0].config.width, 720);
});

const importer = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
function extract (source, start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return source.slice(from, to);
}
const methods = extract(importer, '    async runViaCowgolOnDevice (', '    async runBlocksOnRiscv ()') +
    extract(importer, '    async compileCowgolSource (', '    async compile ({')
        .replace("await import('../../lib/bw-lang/cowgol-compile.js')", 'await loadCompiler()');
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};

function fixture ({hold = null, lang = 'cowgol', toolchains = true, replyChange = {}} = {}) {
    const code = 'include "cowgol.coh"; var data: uint8[] := {1, 2}; print("DOS");';
    const bytes = Uint8Array.of(0x4d, 0x5a);
    const built = [], dispatched = [], imports = [];
    const entered = deferred(), release = deferred();
    const pause = async phase => { if (hold === phase) { entered.resolve(); await release.promise; } };
    const creator = new SB3Creator();
    creator.parse('DEVICE I8086\nGLOBAL total = 2\nWHEN flag clicked:\n  change total by 3\n  say total\n');
    const project = creator.project;
    let stage = {};
    let device = 'i8086';
    const loadCompiler = async () => {
        await pause('compiler-module');
        return {...compiler, cowgolDosConfig, cowgolDosVariantForDevice, COWGOL_DOS_VARIANTS,
            compileCowgol: (source, target, options) => compiler.compileCowgol(source, target, {...options,
                fetcher: async (_url, request) => {
                    built.push(JSON.parse(request.body));
                    await pause('network');
                    return {ok: true, status: 200, json: async () => ({success: true, language: 'cowgol',
                        target: 'dos', toolchain: 'cowgol-msdos', format: 'bin', artifact_kind: 'executable',
                        bytes: bytes.length, base64: Buffer.from(bytes).toString('base64'), ...replyChange})};
                }})};
    };
    const activate = (config, options) => runMachineConfig(config, {...options, awaitBoot: true,
        fetcher: async ref => { await pause('media'); return options.fetcher(ref); },
        dispatch: detail => { dispatched.push(detail); queueMicrotask(() => detail.bootCompletion.resolve()); }});
    const Editor = new Function('loadCompiler', 'runMachineConfig', 'remoteToolchainsAllowed',
        'remoteMachineImagesAllowed', 'cowgolTargetForDevice', 'cowgolCanonicalDevice', 'cowgolDosVariantForDevice',
        'COWGOL_DOS_VARIANTS', `return class {${methods}}`)(loadCompiler, activate, () => toolchains,
        () => false, compiler.cowgolTargetForDevice, compiler.cowgolCanonicalDevice, cowgolDosVariantForDevice, COWGOL_DOS_VARIANTS);
    const editor = new Editor();
    Object.assign(editor, {
        state: {lang, buffers: {[lang]: code}, busy: false, running: false},
        L: {cowgolCompiling: 'compiling', cowgolStale: 'stale', cowgolCpmTargetRequired: 'CP/M target required',
            cowgolDosTargetRequired: 'DOS target required', stError: message => `error: ${message}`},
        activeCode () { return this.state.buffers[this.state.lang]; },
        codeDevice: () => device,
        setState (change) { Object.assign(this.state, typeof change === 'function' ? change(this.state) : change); },
        props: {vm: {toJSON: () => JSON.stringify(project), runtime: {getTargetForStage: () => stage, stc: project.stc}}},
        lib: async () => ({default: SB3Creator}),
        compile: async options => { imports.push(options); await pause('import'); return true; }
    });
    return {editor, code, bytes, built, dispatched, imports, entered, release,
        changeDevice: () => { device = 'z80'; }, changeStage: () => { stage = {}; },
        editBlocks: () => { project.targets[0].name = 'edited'; },
        editMetadata: () => { project.stc.clock = 1_000_000; }};
}

test('full Cowgol uses the selected real DOS CPU and exact bytes on console and Controller', async () => {
    for (const variant of COWGOL_DOS_VARIANTS) for (const surface of ['bench', 'dos-display']) {
        const f = fixture();
        await f.editor.compileCowgolSource('dos', true, {surface, variant});
        assert.deepEqual(f.built, [{language: 'cowgol', code: f.code, target: 'dos', format: 'bin'}]);
        assert.equal(f.imports.length, 0);
        assert.equal(f.dispatched.length, 1, f.editor.state.status);
        assert.equal(f.dispatched[0].dosVariant, variant);
        assert.deepEqual(f.dispatched[0].bytes, f.bytes);
        assert.equal(f.dispatched[0].widgets.length, surface === 'dos-display' ? 1 : 0);
        assert.ok(f.dispatched[0].launchControl, 'DOS activation must retain source ownership');
        assert.equal(f.dispatched[0].bootCompletion, undefined, 'completion must be settled');
        assert.equal(f.editor.state.busy, false);
    }
});

test('checked I8086 source runs on an explicitly selected DOS variant without an invented DEVICE alias', async () => {
    for (const variant of COWGOL_DOS_VARIANTS) {
        const f = fixture({lang: 'pseudocode'});
        await f.editor.runViaCowgolOnDevice({surface: 'dos-display', variant});
        assert.deepEqual(f.imports, [{strict: true, targetDevice: 'i8086', cowgolTarget: 'dos'}]);
        assert.equal(f.built.length, 1, f.editor.state.status);
        assert.match(f.built[0].code, /bw_checked_add/);
        assert.equal(f.dispatched[0].dosVariant, variant);
    }
});

test('unsupported DOS CPU choices and foreign artifacts cannot reach the machine', async () => {
    for (const variant of ['80386', '8088', 'constructor', '']) {
        const f = fixture();
        await f.editor.compileCowgolSource('dos', true, {variant});
        assert.equal(f.built.length, 0, `invalid variant ${variant} must fail before compilation`);
        assert.equal(f.dispatched.length, 0);
        const checked = fixture({lang: 'pseudocode'});
        await checked.editor.runViaCowgolOnDevice({surface: 'dos-display', variant});
        assert.equal(checked.imports.length, 0, `invalid variant ${variant} must not replace the project`);
    }
    const wrong = fixture({replyChange: {toolchain: 'cowgol-cpmz'}});
    await wrong.editor.compileCowgolSource('dos', true, {surface: 'dos-display', variant: '80286'});
    assert.equal(wrong.dispatched.length, 0);
    assert.match(wrong.editor.state.status, /invalid artifact/);
    const denied = fixture({toolchains: false, lang: 'pseudocode'});
    await denied.editor.runViaCowgolOnDevice({surface: 'dos-display', variant: '80286'});
    assert.equal(denied.imports.length, 0);
});

const revoke = {
    source: f => { f.editor.state.buffers = {cowgol: 'changed'}; },
    language: f => { f.editor.state.lang = 'python'; },
    device: f => f.changeDevice(), project: f => f.changeStage(), Blocks: f => f.editBlocks(),
    metadata: f => f.editMetadata(), Stop: f => f.editor._cowgolCompile.abort(),
    unmount: f => { f.editor._unmounted = true; }
};
for (const phase of ['compiler-module', 'network', 'media']) {
    test(`pending DOS launch cannot start after revocation during ${phase}`, async () => {
        for (const [reason, change] of Object.entries(revoke)) {
            const f = fixture({hold: phase});
            const pending = f.editor.compileCowgolSource('dos', true, {surface: 'dos-display', variant: '80286'});
            await f.entered.promise;
            change(f);
            f.release.resolve();
            await pending;
            assert.equal(f.dispatched.length, 0, reason);
            if (reason !== 'unmount') assert.equal(f.editor.state.busy, false, reason);
        }
    });
}

test('the actual DOS runner exposes live ASCII input for compiled-program displays', () => {
    const source = readFileSync(new URL('../overlay/scratch-gui/src/lib/bw-debug/debug-runner.js', import.meta.url), 'utf8');
    const section = source.slice(source.indexOf('// TYPING INTO A DOS PROGRAM.'));
    const code = extract(section, '            runner.sendSerial =', '            runner.dosScreenText =');
    for (const assembly of [false, true]) {
        const received = [];
        const runner = {};
        new Function('runner', 'bench', 'bootMedia', code)(runner, {sendKeys: text => received.push(text)}, {i8086Assembly: assembly});
        assert.equal(runner.i8086MediaIo.dosKeyboard, true);
        assert.equal(runner.i8086MediaIo.gpio, assembly ? 'A' : undefined);
        runner.sendSerial(75);
        runner.sendSerial('hello\r');
        assert.deepEqual(received, ['K', 'hello\r']);
    }
});

test('the actual panel mirrors DOS video and steers its ASCII queue for each CPU choice', async () => {
    const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx', import.meta.url), 'utf8');
    const method = extract(source, '    async _bootFromMedia (e) {', '    /**\n     * ASM tab assembled');
    for (const variant of COWGOL_DOS_VARIANTS) {
        const keys = [];
        let mirrored;
        const window = {bwMirrorMachineVideo: options => { mirrored = options; }};
        const Panel = new Function('window', `return class {${method}}`)(window);
        const panel = new Panel();
        const runner = {i8086MediaIo: {serial: true, terminalName: 'DOS Console', dosKeyboard: true},
            start: async () => undefined, state: () => ({phase: 'ready'}), video: () => 'frame',
            sendSerial: byte => { keys.push(byte); }};
        Object.assign(panel, {state: {kind: 'i8086'}, props: {vm: {runtime: {}}},
            _teardownRunner () {}, _installPcController () {}, _showPcController () {}, _mountGuestTerminal () {},
            setState (change, done) { Object.assign(this.state, change); done?.(); },
            runner () { this._runnerPromise = Promise.resolve(runner); return this._runnerPromise; }});
        const {detail} = await runMachineConfig(cowgolDosConfig({variant, display: true}), {
            fetcher: async () => ({bytes: Uint8Array.of(0x4d, 0x5a)}), dispatch () {}});
        assert.equal(await panel._bootFromMedia({detail}), true);
        assert.equal(panel._bootMedia.dosVariant, variant);
        assert.equal(mirrored.widget.name, 'DOS text display');
        assert.equal(mirrored.videoFn(), 'frame');
        assert.equal(mirrored.keyInFn, null, 'a DOS service program must not receive hardware scancodes');
        mirrored.serialInFn(75);
        assert.deepEqual(keys, [75]);
    }
});
