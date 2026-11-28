import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cowgolDosConfig} from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-dos.js';
import {normalizeMachineConfig, validateMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/machine-config.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';
import {createI80386DosBench} from '../overlay/scratch-gui/src/lib/bw-debug/i80386-dos-bench.js';

const config = () => cowgolDosConfig({variant: '80386'});
const read = path => readFileSync(new URL(`../overlay/scratch-gui/src/${path}`, import.meta.url), 'utf8');
const section = (source, start, end) => {
    const begin = source.indexOf(start), stop = source.indexOf(end, begin + start.length);
    assert.ok(begin >= 0 && stop > begin, start);
    return source.slice(begin, stop);
};
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};

test('only an explicit fixed 386 DOS-service config can omit the AT BIOS', () => {
    assert.equal(validateMachineConfig(normalizeMachineConfig(config())).ok, true);
    for (const mutation of [
        value => { delete value.machineConfig; },
        value => { value.machineConfig = 'freedos-vga'; },
        value => { value.machine = 'i8086'; },
        value => { value.cpu.variant = '80286'; },
        value => { value.executionMode = 'auto'; },
        value => { value.executionMode = 'wired'; value.circuit = {ref: 'owned'}; },
        value => { value.slots = {disk: {url: 'local-media:disk'}}; },
        value => { value.slots.bios = {url: 'local-media:bios'}; },
        value => { value.slots.com = {url: 'local-media:other'}; },
        value => { value.bios = {kind: 'custom'}; },
        value => { value.nativeBlocks = true; }
    ]) {
        const value = config(); mutation(value);
        assert.equal(validateMachineConfig(normalizeMachineConfig(value)).ok, false, JSON.stringify(value));
    }
    const com = config(); com.slots = {com: {url: 'local-media:program.com'}};
    assert.equal(validateMachineConfig(normalizeMachineConfig(com)).ok, true);
});

test('386 activation preserves its own target, exact executable, arguments and ASCII file mounts', async () => {
    const cfg = config();
    cfg.provenance.program = {args: 'one two'};
    cfg.provenance.dosMount = {'INPUT.TXT': {url: 'local-media:input'}};
    const bytes = Uint8Array.of(0x4d, 0x5a), input = Uint8Array.of(65);
    const fetched = [];
    const out = await runMachineConfig(cfg, {fetcher: ref => {
        fetched.push(ref.url);
        return {bytes: ref.url === 'local-media:input' ? input : bytes};
    }, dispatch () {}});
    assert.deepEqual(fetched, ['local-media:cowgol.exe', 'local-media:input']);
    assert.equal(out.detail.kind, 'i80386');
    assert.equal(out.detail.profile, 'dos');
    assert.equal(out.detail.machinePreset, 'dos-service');
    assert.equal(out.detail.dosVariant, '80386');
    assert.equal(out.detail.x86Variant, '80386');
    assert.equal(out.detail.nativeBlocks, false);
    assert.equal(out.detail.dosArgs, 'one two');
    assert.deepEqual(out.detail.bytes, bytes);
    assert.deepEqual(out.detail.dosFiles, new Map([['INPUT.TXT', input]]));
    assert.equal(out.detail.i80386Media, undefined);
});

test('386 media ownership waits for attachment, propagates failure and settles cancellation', async () => {
    for (const outcome of ['resolve', 'reject', 'cancel']) {
        const entered = deferred(), signal = new AbortController();
        let detail, settled = false;
        const pending = runMachineConfig(config(), {awaitBoot: true, signal: signal.signal,
            fetcher: () => ({bytes: Uint8Array.of(0x4d, 0x5a)}),
            dispatch: value => { detail = value; entered.resolve(); }});
        pending.then(() => { settled = true; }, () => { settled = true; });
        await entered.promise;
        assert.equal(settled, false);
        assert.ok(detail.bootCompletion);
        if (outcome === 'resolve') {
            detail.bootCompletion.resolve();
            assert.equal((await pending).mode, 'functional');
        } else if (outcome === 'reject') {
            detail.bootCompletion.reject(new Error('386 attach failed'));
            await assert.rejects(pending, /386 attach failed/);
        } else {
            signal.abort();
            assert.equal((await pending).mode, 'cancelled');
        }
        assert.equal(detail.launchControl.released, true);
        assert.equal(detail.bootCompletion, undefined);
    }
});

test('386 bench rejects foreign modes and cancelled work before loading the machine', async () => {
    const base = {bytes: Uint8Array.of(0xf4), format: 'com'};
    for (const override of [{bytes: new Uint8Array()}, {bytes: [0xf4]}, {format: 'disk'},
        {variant: '80286'}, {nativeBlocks: true}, {chips: []}, {config: {}}]) {
        await assert.rejects(createI80386DosBench({...base, ...override}), /386 DOS/);
    }
    const controller = new AbortController(); controller.abort();
    await assert.rejects(createI80386DosBench({...base, executionSignal: controller.signal}), /cancelled/);
});

// Execute the runner's actual DOS branch. Only lazy package imports and the
// external machine constructor are replaced; CPU execution has a separate
// mandatory exact-board witness in scripts/verify-cowgol-dos.mjs.
const source = read('lib/bw-debug/debug-runner.js');
const attachDos = section(source, '    async function attachI8086(requestedVariant) {',
    '    /**\n     * THE FULLY-FREE 386.')
    .replace(/import\(\/\* webpackChunkName: "bw-debug-i8086" \*\/ 'bw-board\/debug-session.js'\)/,
        "loadDependency('session')")
    .replace(/import\(\/\* webpackChunkName: "bw-debug-i80386-dos" \*\/ '.\/i80386-dos-bench.js'\)/,
        "loadDependency('386')")
    .replace(/import\(\/\* webpackChunkName: "bw-debug-i8086" \*\/ '.\/i8086-dos-bench.js'\)/,
        "loadDependency('8086')");
const attach386 = section(source, '    async function attachI80386() {',
    "        setStatus('attaching', bootMedia && bootMedia.name") +
    "        throw new Error('unexpected AT boot');\n    }\n";
const runnerFixture = new Function('deps', `
    const {bootMedia, loadDependency, signal, calls} = deps;
    const i8086ExecutionLifetime = {signal};
    let i8086ExecutionResult = null, session = null;
    const serialLines = [], runner = {};
    const S = key => key, setStatus = (...values) => calls.status.push(values);
    const resolveMediaImage = async media => ({bytes: media.bytes});
    const wireMachineBench = (bench, createSession) => {
        calls.wired.push(bench); session = createSession(bench.target);
    };
    const attachI80386FreedosVgaProfile = () => { calls.freedos++; return 'freedos'; };
    ${attachDos}
    ${attach386}
    return {attach: attachI80386, runner, serialLines};
`);
function runner (hold = null, mutation = null) {
    const signal = new AbortController(), entered = deferred(), release = deferred();
    const calls = {loaded: [], built: [], wired: [], status: [], keys: [], freedos: 0};
    const bootMedia = {slot: 'exe', profile: 'dos', machinePreset: 'dos-service',
        x86Variant: '80386', dosVariant: '80386', bytes: Uint8Array.of(0x4d, 0x5a)};
    mutation?.(bootMedia);
    const loadDependency = async key => {
        calls.loaded.push(key);
        if (hold === key) { entered.resolve(); await release.promise; }
        if (key === 'session') return {createDebugSession: target => ({target})};
        assert.equal(key, '386', '386 must never construct the 8086 CPU');
        return {createI80386DosBench: async options => {
            calls.built.push(options);
            if (hold === 'construction') { entered.resolve(); await release.promise; }
            return {target: {kind: 'i80386'}, machine: {chipRefusals: () => []},
                sendKeys: value => calls.keys.push(value), screenText: () => ['actual text']};
        }};
    };
    return {...runnerFixture({bootMedia, loadDependency, signal: signal.signal, calls}),
        calls, signal, entered, release, bootMedia};
}

test('actual runner chooses the 386 constructor, console and live DOS ASCII queue', async () => {
    const f = runner();
    const session = await f.attach();
    assert.deepEqual(f.calls.loaded, ['session', '386']);
    assert.equal(f.calls.built[0].variant, '80386');
    assert.deepEqual(f.calls.built[0].bytes, f.bootMedia.bytes);
    assert.equal(f.calls.built[0].executionSignal, f.signal.signal);
    assert.equal(session.target.kind, 'i80386');
    assert.equal(f.runner.i8086MediaIo.dosKeyboard, true);
    f.runner.sendSerial(75); f.runner.sendSerial('abc\r');
    assert.deepEqual(f.calls.keys, ['K', 'abc\r']);
    f.calls.built[0].onChar('X'); f.calls.built[0].onChar('\n'); f.calls.built[0].onChar('Y');
    assert.deepEqual(f.serialLines, ['X', 'Y']);
});

test('actual runner refuses mixed 386 DOS/AT/native-block inputs', async () => {
    for (const mutation of [media => { media.slot = 'disk'; }, media => { media.nativeBlocks = true; },
        media => { media.chips = []; }, media => { media.i80386Media = {bios: new Uint8Array()}; },
        media => { media.x86Variant = '80286'; }, media => { delete media.dosVariant; }]) {
        const f = runner(null, mutation);
        await assert.rejects(f.attach(), /fixed real-mode profile/);
        assert.deepEqual(f.calls.loaded, []);
    }
    const full = runner(null, media => { media.machinePreset = 'freedos-vga'; });
    assert.equal(await full.attach(), 'freedos');
    assert.equal(full.calls.freedos, 1);
});

test('disposing a pending 386 attach cannot wire its completed machine', async () => {
    for (const phase of ['386', 'construction']) {
        const f = runner(phase), pending = f.attach();
        await f.entered.promise;
        f.signal.abort(); f.release.resolve();
        await assert.rejects(pending, /disposed/);
        assert.deepEqual(f.calls.wired, []);
    }
});

test('the actual panel keeps the 386 console route free of an invented AT display', async () => {
    const panelMethod = section(read('components/tw-pseudocode/debug-panel.jsx'),
        '    async _bootFromMedia (e) {', '    /**\n     * ASM tab assembled');
    let mirrored = false, terminalPreference;
    const Panel = new Function('window', `return class {${panelMethod}}`)({
        bwMirrorMachineVideo: () => { mirrored = true; }
    });
    const panel = new Panel();
    const target = {i8086MediaIo: {serial: true, terminalName: 'DOS Console', dosKeyboard: true},
        start: async () => {}, state: () => ({phase: 'ready'}), video: () => 'frame', sendSerial () {}};
    Object.assign(panel, {state: {kind: 'i80386'}, props: {vm: {runtime: {}}},
        _teardownRunner () {}, _installPcController () {}, _showPcController () {},
        _mountGuestTerminal (_runner, _state, preferred) { terminalPreference = preferred; },
        setState (patch, done) { Object.assign(this.state, patch); done?.(); },
        runner () { this._runnerPromise = Promise.resolve(target); return this._runnerPromise; }});
    const {detail} = await runMachineConfig(config(), {
        fetcher: () => ({bytes: Uint8Array.of(0x4d, 0x5a)}), dispatch () {}});
    assert.equal(await panel._bootFromMedia({detail}), true);
    assert.equal(mirrored, false);
    assert.equal(terminalPreference, true);
});
