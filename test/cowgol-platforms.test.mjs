import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileCowgol, cowgolRiscvDetail, cowgolEaterDetail} from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-compile.js';

const source = 'include "cowgol.coh"; include "brickwright.coh"; bw_print_number(42);';
const encode = bytes => Buffer.from(bytes).toString('base64');

// A real ELF32 layout, with one executable PT_LOAD and zero-filled workspace.
function artifact () {
    const bytes = new Uint8Array(88);
    const elf = new DataView(bytes.buffer);
    bytes.set([0x7f, 0x45, 0x4c, 0x46, 1, 1, 1]);
    elf.setUint16(16, 2, true);
    elf.setUint16(18, 243, true);
    elf.setUint32(20, 1, true);
    elf.setUint32(24, 0x1000, true);
    elf.setUint32(28, 52, true);
    elf.setUint16(40, 52, true);
    elf.setUint16(42, 32, true);
    elf.setUint16(44, 1, true);
    [1, 84, 0x1000, 0x1000, 4, 8, 5, 4].forEach((value, i) => elf.setUint32(52 + i * 4, value, true));
    bytes.set([0x73, 0, 0, 0], 84);
    return {bytes, reply: {
        success: true, language: 'cowgol', target: 'riscv32', toolchain: 'cowgol-riscv32',
        format: 'elf', artifact_kind: 'executable', bytes: bytes.length, base64: encode(bytes),
        entry: 0x1000, image: {entry: 0x1000, segments: [{addr: 0x1000, bytes: encode([0x73, 0, 0, 0, 0, 0, 0, 0])}]}
    }};
}
const fetcher = reply => async () => ({ok: true, status: 200, json: async () => reply});

const eaterConfig = {
    clockHz: 1_000_000,
    regions: [{kind: 'ram', start: 0x0000, end: 0x3fff}, {kind: 'rom', start: 0x8000, end: 0xffff}],
    chips: [{kind: 'via', name: 'via1', at: 0x6000}, {kind: 'acia', name: 'acia1', at: 0x5000}]
};

function eaterArtifact () {
    const bytes = new Uint8Array(0x8000).fill(0xea);
    bytes[0] = 0x78; // SEI startup, not an Intel HEX text file.
    bytes[0x10] = 0xdb; // STP exit.
    bytes[0x20] = 0x40; // Shared RTI handler.
    const rom = new DataView(bytes.buffer);
    rom.setUint16(0x7ffa, 0x8020, true);
    rom.setUint16(0x7ffc, 0x8000, true);
    rom.setUint16(0x7ffe, 0x8020, true);
    return {bytes, reply: {
        success: true, language: 'cowgol', target: 'eater6502', toolchain: 'cowgol-eater6502',
        format: 'bin', artifact_kind: 'executable', bytes: bytes.length, base64: encode(bytes),
        mcu: 'w65c02', origin: 0x8000, entry: 0x8000, memory_end: 0x300,
        memory_layout: {lomem: 0x300, eater_workspace_end: 0x2f0, eater_zp_end: 0x80,
            eater_code_end: 0x8110, eater_data_load: 0x8100, eater_data_size: 0x10,
            eater_reset: 0x8000, eater_irq: 0x8020, eater_halt: 0x8010}
    }};
}

test('native Cowgol Eater6502 requests the complete ROM and supplies its fixed machine map', async () => {
    const {reply, bytes} = eaterArtifact();
    let request;
    const out = await compileCowgol(source, 'eater6502', {fetcher: async (url, options) => {
        request = JSON.parse(options.body);
        return {ok: true, status: 200, json: async () => reply};
    }});
    assert.deepEqual(request, {language: 'cowgol', code: source, target: 'eater6502', format: 'bin'});
    assert.deepEqual(out.bytes, bytes);
    assert.equal(out.filename, 'program.bin');
    assert.deepEqual(cowgolEaterDetail(out.bytes), {
        rom: out.bytes, image: null, listing: null, target: 'eater6502',
        slotId: 'rom', profile: 'eater', format: 'bin', machineConfig6502: eaterConfig
    });
});

test('Eater6502 refuses foreign identity, incomplete ROMs and invalid machine metadata', async () => {
    const mutations = [
        out => { out.language = 'c'; },
        out => { out.toolchain = 'cc65'; },
        out => { out.target = 'z80-cpm'; },
        out => { out.format = 'elf'; },
        out => { out.artifact_kind = 'source'; },
        out => { out.origin = 0xc000; },
        out => { delete out.origin; },
        out => { out.entry = 0x8001; },
        out => { delete out.entry; },
        out => { out.mcu = '6502'; },
        out => { delete out.mcu; },
        out => { out.bytes--; out.base64 = encode(Buffer.from(out.base64, 'base64').subarray(0, -1)); },
        out => { out.bytes++; out.base64 = encode(Buffer.concat([Buffer.from(out.base64, 'base64'), Buffer.from([0])])); }
    ];
    for (const mutate of mutations) {
        const {reply} = eaterArtifact();
        mutate(reply);
        await assert.rejects(compileCowgol(source, 'eater6502', {fetcher: fetcher(reply)}), /invalid/i);
    }
});

test('Eater6502 validates all vectors and actual RTI/STP instructions before handoff', async () => {
    const mutations = [
        rom => rom.setUint16(0x7ffc, 0x8001, true),
        rom => rom.setUint16(0x7ffa, 0x8021, true),
        rom => rom.setUint16(0x7ffe, 0x8021, true),
        rom => { rom.setUint16(0x7ffa, 0x7fff, true); rom.setUint16(0x7ffe, 0x7fff, true); },
        rom => { rom.setUint16(0x7ffa, 0xfffa, true); rom.setUint16(0x7ffe, 0xfffa, true); },
        rom => rom.setUint8(0x20, 0xea),
        rom => rom.setUint8(0x10, 0xea)
    ];
    for (const mutate of mutations) {
        const {bytes, reply} = eaterArtifact();
        mutate(new DataView(bytes.buffer));
        reply.base64 = encode(bytes);
        await assert.rejects(compileCowgol(source, 'eater6502', {fetcher: fetcher(reply)}), /invalid/i);
    }
});

test('Eater6502 refuses absent, unsafe or internally inconsistent relocation/workspace layouts', async () => {
    const mutations = [
        out => { delete out.memory_layout; },
        out => { delete out.memory_end; },
        out => { out.memory_end = 0x301; },
        out => { out.memory_layout.lomem = out.memory_end = 0x3ff9; },
        out => { out.memory_layout.eater_workspace_end = 0x1ff; },
        out => { out.memory_layout.eater_workspace_end = 0x301; },
        out => { out.memory_layout.eater_zp_end = -1; },
        out => { out.memory_layout.eater_zp_end = 0x101; },
        out => { out.memory_layout.eater_code_end = 0xfffb; },
        out => { out.memory_layout.eater_data_load = 0x8000; },
        out => { out.memory_layout.eater_data_load = 0x8120; },
        out => { out.memory_layout.eater_data_size++; },
        out => { out.memory_layout.eater_reset = 0x8001; },
        out => { out.memory_layout.eater_halt = 0x8000; },
        out => { out.memory_layout.eater_halt = out.memory_layout.eater_data_load; },
        out => { out.memory_layout.eater_irq = 0x8000; },
        out => { out.memory_layout.eater_irq = out.memory_layout.eater_data_load; }
    ];
    for (const key of Object.keys(eaterArtifact().reply.memory_layout)) {
        mutations.push(out => { delete out.memory_layout[key]; });
        mutations.push(out => { out.memory_layout[key] = String(out.memory_layout[key]); });
    }
    for (const mutate of mutations) {
        const {reply} = eaterArtifact();
        mutate(reply);
        await assert.rejects(compileCowgol(source, 'eater6502', {fetcher: fetcher(reply)}), /invalid/i);
    }
});

test('full Cowgol RISC-V requests an ELF and boots exactly the validated download bytes', async () => {
    const {reply, bytes} = artifact();
    let request;
    const out = await compileCowgol(source, 'riscv32', {fetcher: async (url, options) => {
        request = JSON.parse(options.body);
        return {ok: true, status: 200, json: async () => reply};
    }});
    assert.deepEqual(request, {language: 'cowgol', code: source, target: 'riscv32', format: 'elf'});
    assert.deepEqual(out.bytes, bytes);
    assert.equal(out.filename, 'program.elf');
    assert.deepEqual(out.image, {entry: 0x1000, segments: [{addr: 0x1000, bytes: new Uint8Array([0x73, 0, 0, 0, 0, 0, 0, 0])}]});
    assert.deepEqual(cowgolRiscvDetail(out.image), {
        rom: null, image: out.image, listing: null, target: 'riscv32', slotId: 'riscv', profile: 'riscv', format: 'riscv'
    });
});

test('RISC-V refuses foreign executables, malformed ELF tables, unsafe memory and non-code entry points', async () => {
    const mutations = [
        elf => elf.setUint8(4, 2), // ELF64
        elf => elf.setUint8(5, 2), // big endian
        elf => elf.setUint16(16, 1, true), // relocatable
        elf => elf.setUint16(18, 3, true), // x86
        elf => elf.setUint16(42, 16, true),
        elf => elf.setUint16(44, 33, true),
        elf => elf.setUint32(28, 80, true),
        elf => elf.setUint32(60, 0, true),
        elf => elf.setUint32(64, 0, true),
        elf => elf.setUint32(72, 0x400000, true),
        elf => elf.setUint32(68, 100, true),
        elf => elf.setUint32(72, 2, true),
        elf => elf.setUint32(76, 6, true),
        elf => elf.setUint32(80, 3, true),
        elf => elf.setUint32(24, 0x1001, true),
        elf => elf.setUint32(24, 0x1004, true) // entry in BSS
    ];
    for (const mutate of mutations) {
        const {bytes, reply} = artifact();
        mutate(new DataView(bytes.buffer));
        reply.base64 = encode(bytes);
        await assert.rejects(compileCowgol(source, 'riscv32', {fetcher: fetcher(reply)}), /invalid RISC-V/);
    }
});

test('the service cannot substitute another boot image or target for the downloadable RISC-V ELF', async () => {
    const mutations = [
        out => { out.language = 'c'; },
        out => { out.toolchain = 'riscv32-gcc'; },
        out => { out.target = 'z80-cpm'; },
        out => { out.format = 'bin'; },
        out => { out.artifact_kind = 'source'; },
        out => { out.entry = 0x1004; },
        out => { out.image.entry = 0x1004; },
        out => { out.image.segments[0].addr = 0x2000; },
        out => { out.image.segments[0].bytes = encode([0x13, 0, 0, 0, 0, 0, 0, 0]); },
        out => { out.image.segments[0].bytes = encode([0x73, 0, 0, 0]); },
        out => { out.image.segments.push(out.image.segments[0]); },
        out => { delete out.image; }
    ];
    for (const mutate of mutations) {
        const {reply} = artifact();
        mutate(reply);
        await assert.rejects(compileCowgol(source, 'riscv32', {fetcher: fetcher(reply)}), /invalid/);
    }
});

const importer = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
function extract (start, end) {
    const a = importer.indexOf(start), b = importer.indexOf(end, a);
    assert.ok(a >= 0 && b > a);
    return importer.slice(a, b);
}
const nativeMethod = extract('    async compileCowgolSource (', '    async compile ({')
    .replace("await import('../../lib/bw-lang/cowgol-compile.js')", 'await loadCowgol()');
const blocksMethod = extract('    async runBlocksOnRiscv ()', '    async compileCowgolSource (');
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    return {promise, resolve, reject};
};

function editorFixture (compile, method = nativeMethod, device = 'riscv32') {
    const events = [];
    const window = {dispatchEvent: event => events.push(event)};
    const storage = {setItem () {}};
    const Event = class { constructor (type, options) { this.type = type; this.detail = options.detail; } };
    const Editor = new Function('loadCowgol', 'window', 'localStorage', 'CustomEvent', 'runMachineConfig',
        'remoteToolchainsAllowed', 'requestRiscvCBuild', `return class {${method}}`)(
        async () => ({compileCowgol: compile, cowgolRiscvDetail, cowgolEaterDetail}), window, storage, Event,
        () => assert.fail('A native ROM/ELF must not enter the DOS loader'), () => true, compile);
    let stage = {};
    let project = {targets: [], stc: {device: device.toUpperCase(), pins: []}};
    const editor = new Editor();
    Object.assign(editor, {
        state: {lang: 'cowgol', buffers: {cowgol: source}},
        activeCode: () => editor.state.buffers.cowgol,
        codeDevice: () => device,
        setState (patch) { Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch); },
        props: {vm: {toJSON: () => JSON.stringify(project), runtime: {
            getTargetForStage: () => stage, stc: project.stc
        }}},
        L: {cowgolCompiling: 'compiling', cowgolStale: 'stale', runCRiscvBuilding: 'building',
            runCRiscvBuilt: () => 'built', stError: message => message},
        lib: async () => ({default: class {
            generateRiscvC (received) {
                assert.deepEqual(received, project);
                return {ok: true, c: 'real generated source'};
            }
        }})
    });
    return {editor, window, events, changeStage: () => { stage = {}; }, changeProject: () => { project.changed = true; }};
}

test('the actual Cowgol editor hands RISC-V images to the console loader', async () => {
    const image = {entry: 0x1000, segments: [{addr: 0x1000, bytes: new Uint8Array([0x73, 0, 0, 0])}]};
    const fixture = editorFixture(async (code, target) => {
        assert.equal(code, source); assert.equal(target, 'riscv32');
        return {image, bytes: new Uint8Array(88), toolchain: 'cowgol-riscv32'};
    });
    await fixture.editor.compileCowgolSource('riscv32', true);
    const loaded = fixture.events.filter(event => event.type === 'bw-asm-rom-ready');
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].detail.image, image);
    assert.equal(fixture.window.__bwPendingMedia.detail, loaded[0].detail);
    assert.equal(fixture.editor.state.busy, false);
});

test('the actual Cowgol editor delivers the exact Eater ROM and canonical map to its loader', async () => {
    const {bytes} = eaterArtifact();
    const f = editorFixture(async (code, target) => {
        assert.equal(code, source); assert.equal(target, 'eater6502');
        return {bytes, toolchain: 'cowgol-eater6502'};
    }, nativeMethod, 'eater6502');
    await f.editor.compileCowgolSource('eater6502', true);
    const loaded = f.events.filter(event => event.type === 'bw-asm-rom-ready');
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].detail.rom, bytes);
    assert.deepEqual(loaded[0].detail.machineConfig6502, eaterConfig);
    assert.equal(loaded[0].detail.profile, 'eater');
    assert.equal(f.window.__bwPendingMedia.detail, loaded[0].detail);
    assert.equal(f.editor.state.busy, false);
});

test('native Eater results cannot launch after an edit, retarget, project change, cancellation or replacement', async () => {
    const mutations = [
        f => { f.editor.state.buffers = {...f.editor.state.buffers}; },
        f => { f.editor.state.lang = 'python'; },
        f => { f.editor.codeDevice = () => 'riscv32'; },
        f => f.changeStage(),
        f => f.editor._cowgolCompile.abort(),
        f => { f.editor._cowgolCompile = new AbortController(); },
        f => { f.editor._unmounted = true; }
    ];
    for (const mutate of mutations) {
        const pending = deferred(), started = deferred();
        const f = editorFixture(async () => { started.resolve(); return pending.promise; }, nativeMethod, 'eater6502');
        const running = f.editor.compileCowgolSource('eater6502', true);
        await started.promise;
        mutate(f);
        pending.resolve({bytes: eaterArtifact().bytes, toolchain: 'cowgol-eater6502'});
        await running;
        assert.equal(f.events.length, 0);
        assert.equal(f.window.__bwPendingMedia, undefined);
    }
});

test('native RISC-V results cannot launch after an edit, retarget, project change, cancellation or replacement', async () => {
    const mutations = [
        f => { f.editor.state.buffers = {...f.editor.state.buffers}; },
        f => { f.editor.state.lang = 'python'; },
        f => { f.editor.codeDevice = () => 'pico'; },
        f => f.changeStage(),
        f => f.editor._cowgolCompile.abort(),
        f => { f.editor._cowgolCompile = new AbortController(); },
        f => { f.editor._unmounted = true; }
    ];
    for (const mutate of mutations) {
        const pending = deferred(), started = deferred();
        const f = editorFixture(async () => { started.resolve(); return pending.promise; });
        const running = f.editor.compileCowgolSource('riscv32', true);
        await started.promise;
        mutate(f);
        pending.resolve({image: {}, bytes: new Uint8Array(88), toolchain: 'cowgol-riscv32'});
        await running;
        assert.equal(f.events.length, 0);
        assert.equal(f.window.__bwPendingMedia, undefined);
    }
});

const panel = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx', import.meta.url), 'utf8');
const runnerSource = readFileSync(new URL('../overlay/scratch-gui/src/lib/bw-debug/debug-runner.js', import.meta.url), 'utf8');
function methodFrom (text, start, end) {
    const a = text.indexOf(start), b = text.indexOf(end, a);
    assert.ok(a >= 0 && b > a, `Actual method boundaries: ${start}`);
    return text.slice(a, b);
}
const asmMethod = methodFrom(panel, '    _onAsmRomReady (e) {', '    componentDidMount () {');
const AsmPanel = new Function(`return class {${asmMethod}}`)();
function deliverAsm (detail) {
    const received = [];
    const receiver = new AsmPanel();
    receiver.state = {runner: null};
    receiver._onMediaLoad = event => { received.push(event.detail); return true; };
    receiver._onAsmRomReady({detail});
    return {receiver, received};
}

test('the real ASM event adapter preserves native Eater hardware and still deduplicates replay', () => {
    const detail = cowgolEaterDetail(eaterArtifact().bytes);
    const {receiver, received} = deliverAsm(detail);
    assert.equal(received.length, 1);
    assert.equal(received[0].bytes, detail.rom);
    assert.equal(received[0].machineConfig6502, detail.machineConfig6502);
    assert.equal(received[0].kind, 'eater6502');
    assert.equal(received[0].slotId, 'rom');
    assert.equal(received[0].profile, 'eater');
    receiver._runnerPromise = {};
    assert.equal(receiver._onAsmRomReady({detail}), false);
    assert.equal(received.length, 1);
});

test('ordinary ASM without a declared Eater map keeps its existing media handoff', () => {
    const rom = new Uint8Array([0xea, 0xdb]);
    const {received} = deliverAsm({rom, target: 'eater6502', slotId: 'rom', profile: 'eater', format: 'bin'});
    assert.deepEqual(received, [{
        slotId: 'rom', bytes: rom, profile: 'eater', i8086Assembly: false, chips: null,
        kind: 'eater6502', name: 'assembled image', asmBlink: undefined, bootCompletion: undefined
    }]);
});

test('the real Eater attach method prioritizes the ROM map over a stale extracted circuit', async () => {
    const {received: [media]} = deliverAsm(cowgolEaterDetail(eaterArtifact().bytes));
    const staleMachine = {clockHz: 2_000_000,
        regions: [{kind: 'ram', start: 0, end: 0x1fff}, {kind: 'rom', start: 0xc000, end: 0xffff}],
        chips: [{kind: 'acia', name: 'oldConsole', at: 0x5000}, {kind: 'via', name: 'oldVia', at: 0x7000}]};
    const resolveImage = methodFrom(runnerSource, '    async function resolveMediaImage(media) {',
        '    /** Shared wiring for the machine benches:');
    const attach = methodFrom(runnerSource, '    async function attachEater6502() {',
        '    // ── Z80 machine bench')
        .replace('await import(/* webpackChunkName: "bw-board" */ \'bw-board\')', 'await loadBoard()')
        .replace("await import('./w65c02-cycle-provider.js')", 'await loadProvider()');
    let attached;
    const providerBoundary = () => {};
    // Keep the actual choice and image-resolution logic; fake only machine
    // construction and UI callbacks, which the real-machine checks cover.
    const run = new Function('bootMedia', 'machineConfig', 'loadBoard', 'loadProvider',
        'S', 'setStatus', 'benchConfig6502', 'designerBoard', 'wireMachineBench', 'isBundledMicrosoftBasic',
        `let board; const runner = {}, session = {}; ${resolveImage}\n${attach}\nreturn attachEater6502();`);
    await run(media, staleMachine, async () => ({
        createDebugTarget: async (kind, options) => { attached = {kind, options}; return {}; },
        createDebugSession: () => {}
    }), async () => ({createW65C02ProviderBoundary: providerBoundary}), key => key, () => {},
    () => assert.fail('The old extracted machine map must not replace the native ROM contract'),
    () => assert.fail('An unrelated designer board must not be selected for the fixed-map ROM'), () => {}, async () => false);
    assert.equal(attached.kind, 'eater6502');
    assert.equal(attached.options.rom, media.bytes);
    assert.deepEqual(attached.options.config, eaterConfig);
    assert.equal(attached.options.providerBoundary, providerBoundary);
});

test('Run via Blocks on RISC-V compiles the accepted project with full GCC and loads its image', async () => {
    const image = {entry: 0x1000, segments: [{addr: 0x1000, bytes: new Uint8Array([0x73, 0, 0, 0])}]};
    const f = editorFixture(async request => {
        assert.deepEqual(request, {source: 'real generated source', route: 'server', hostedTarget: 'riscv32-gcc'});
        return {image};
    }, blocksMethod);
    await f.editor.runBlocksOnRiscv();
    assert.equal(f.events.find(event => event.type === 'bw-asm-rom-ready').detail.image, image);
    assert.equal(f.editor.state.busy, false);
});

test('RISC-V Blocks generation refuses unsupported operations before contacting the compiler', async () => {
    const f = editorFixture(() => assert.fail('a refused program reached the compiler'), blocksMethod);
    f.editor.lib = async () => ({default: class {
        generateRiscvC () { return {ok: false, reasons: ['Timing is unavailable on this console']}; }
    }});
    await f.editor.runBlocksOnRiscv();
    assert.match(f.editor.state.status, /Timing is unavailable/);
    assert.equal(f.events.length, 0);
});

test('editing the loaded Blocks during RISC-V compilation revokes the pending image', async () => {
    const pending = deferred(), started = deferred();
    const f = editorFixture(async () => { started.resolve(); return pending.promise; }, blocksMethod);
    const running = f.editor.runBlocksOnRiscv();
    await started.promise;
    f.changeProject();
    pending.resolve({image: {}});
    await running;
    assert.equal(f.events.length, 0);
    assert.equal(f.editor.state.status, 'stale');
});

test('Blocks edits and hardware changes during the RISC-V module load revoke compilation', async () => {
    for (const change of [f => f.changeProject(), f => { f.editor.props.vm.runtime.stc = {device: 'pico'}; }]) {
        const pending = deferred(), entered = deferred();
        const f = editorFixture(() => assert.fail('a changed project reached the compiler'), blocksMethod);
        const library = await f.editor.lib();
        f.editor.lib = async () => { entered.resolve(); return pending.promise; };
        const running = f.editor.runBlocksOnRiscv();
        await entered.promise;
        change(f);
        pending.resolve(library);
        await running;
        assert.equal(f.events.length, 0);
        assert.equal(f.editor.state.busy, false);
    }
});

test('rejected stale native and Blocks compilations preserve the current editor feedback', async () => {
    for (const method of [nativeMethod, blocksMethod]) {
        const pending = deferred(), entered = deferred();
        const f = editorFixture(async () => { entered.resolve(); return pending.promise; }, method);
        const running = method === nativeMethod ? f.editor.compileCowgolSource('riscv32', true) : f.editor.runBlocksOnRiscv();
        await entered.promise;
        f.editor.state.buffers = {...f.editor.state.buffers, cowgol: 'new source'};
        f.editor.state.status = 'feedback for new source';
        pending.reject(new Error('old compilation failed'));
        await running;
        assert.equal(f.editor.state.status, 'feedback for new source');
        assert.equal(f.events.length, 0);
    }
});

test('selected RISC-V and Eater have native actions, downloads and keyboard routing', () => {
    assert.ok(/cowgol: \(\) => cowgolTarget \?\s+this\.compileCowgolSource\(cowgolTarget, true\)/.test(importer),
        'Keyboard Run must select the native compiler for both new platforms');
    for (const marker of ['bw-cowgol-riscv-run', 'bw-blocks-riscv-run', 'cowgolDownloadRiscv']) assert.ok(importer.includes(marker), marker);
    for (const marker of ['bw-cowgol-eater-run', 'cowgolDownloadEater']) assert.ok(importer.includes(marker), marker);
});
