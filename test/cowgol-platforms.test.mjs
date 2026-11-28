import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileCowgol, cowgolRiscvDetail} from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-compile.js';

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

function editorFixture (compile, method = nativeMethod) {
    const events = [];
    const window = {dispatchEvent: event => events.push(event)};
    const storage = {setItem () {}};
    const Event = class { constructor (type, options) { this.type = type; this.detail = options.detail; } };
    const Editor = new Function('loadCowgol', 'window', 'localStorage', 'CustomEvent', 'runMachineConfig',
        'remoteToolchainsAllowed', 'requestRiscvCBuild', `return class {${method}}`)(
        async () => ({compileCowgol: compile, cowgolRiscvDetail}), window, storage, Event,
        () => assert.fail('RISC-V must not enter the DOS loader'), () => true, compile);
    let stage = {};
    let project = {targets: [], stc: {device: 'RISCV32', pins: []}};
    const editor = new Editor();
    Object.assign(editor, {
        state: {lang: 'cowgol', buffers: {cowgol: source}},
        activeCode: () => editor.state.buffers.cowgol,
        codeDevice: () => 'riscv32',
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

test('selected RISC-V has native and Blocks actions, downloads and keyboard routing', () => {
    assert.match(importer, /cowgol: \(\) => target === 'riscv32' \? this\.compileCowgolSource\('riscv32', true\)/);
    for (const marker of ['bw-cowgol-riscv-run', 'bw-blocks-riscv-run', 'cowgolDownloadRiscv']) assert.ok(importer.includes(marker), marker);
});
