import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileCowgol, cowgolCpmConfig, cowgolDosConfig} from '../overlay/scratch-gui/src/lib/bw-lang/cowgol-compile.js';
import {runMachineConfig} from '../overlay/scratch-gui/src/lib/bw-machines/run-machine.js';
import {DEVICES, cell} from '../overlay/scratch-gui/src/lib/bw-matrix/capabilities.js';
import {codeLanguageAvailable} from '../overlay/scratch-gui/src/lib/bw-matrix/code-languages.js';
import {createCodeDocument, serializeCodeDocument, restoreCodeDocumentState} from '../overlay/scratch-gui/src/lib/code-source-document.js';

const source = 'include "cowgol.coh"; print("Hello"); print_nl();';
const importer = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
const reply = (changes = {}) => ({ok: true, status: 200, json: async () => ({
    success: true, language: 'cowgol', target: 'z80-cpm', toolchain: 'cowgol-cpmz', format: 'bin',
    artifact_kind: 'executable', base64: 'yQ==', bytes: 1, origin: 0x100, ...changes
})});

test('Cowgol source survives save/reopen independently of its selected machine', () => {
    const authored = createCodeDocument({lang: 'cowgol', code: source, target: 'arduino-uno'});
    const restored = restoreCodeDocumentState(JSON.parse(serializeCodeDocument(authored)));
    assert.equal(restored.lang, 'cowgol');
    assert.equal(restored.buffers.cowgol, source);
    assert.equal(restored.codeTarget, 'arduino-uno');
});

test('Cowgol is exposed for every established lowered machine route', () => {
    for (const device of DEVICES) {
        if (device.programmable === false) continue;
        const capability = cell('cowgol', device.id);
        assert.ok(capability, device.id);
        const runnable = capability.lowered.some(route => route.sim || route.silicon);
        assert.equal(codeLanguageAvailable('cowgol', device.id), runnable, device.id);
        assert.equal(capability.native.sim, false, 'lowering is not a native Cowgol port');
    }
    assert.equal(codeLanguageAvailable('cowgol', null), true);
    assert.equal(codeLanguageAvailable('cowgol', 'spike'), true);
    assert.equal(codeLanguageAvailable('cowgol', 'i80386'), false);
});

test('CP/M compile posts full Cowgol source without routing through the subset reader', async () => {
    let request;
    const controller = new AbortController();
    const result = await compileCowgol(source, 'z80-cpm', {signal: controller.signal,
        fetcher: async (url, options) => { request = {url, options}; return reply(); }});
    assert.deepEqual(JSON.parse(request.options.body), {language: 'cowgol', code: source, target: 'z80-cpm', format: 'bin'});
    assert.equal(request.options.signal, controller.signal);
    assert.deepEqual(result.bytes, new Uint8Array([0xc9]));
    assert.equal(result.filename, 'program.com');
});

test('native artifacts validate compiler identity, exact bytes, origin and DOS signature', async () => {
    for (const mutation of [{toolchain: 'sdcc'}, {toolchain: 'cowgol-cgen'}, {target: 'dos'}, {language: 'c'}, {base64: '!!!!'}, {bytes: 5}, {origin: 0}, {base64: '', bytes: 0}]) {
        await assert.rejects(compileCowgol(source, 'z80-cpm', {fetcher: async () => reply(mutation)}), /invalid artifact/);
    }
    const dos = await compileCowgol(source, 'dos', {fetcher: async () => reply({toolchain: 'cowgol-msdos', target: 'dos', base64: 'TVoAAA==', bytes: 4})});
    assert.equal(dos.filename, 'program.exe');
    await assert.rejects(compileCowgol(source, 'dos', {fetcher: async () => reply()}), /invalid artifact/);
    const c = await compileCowgol(source, 'cowgol-cgen', {fetcher: async () => reply({
        toolchain: 'cowgol-cgen', target: 'cowgol-cgen', format: 'c', artifact_kind: 'source',
        base64: btoa('int main(void) { return 0; }'), bytes: 'int main(void) { return 0; }'.length
    })});
    assert.equal(c.filename, 'program.c');
});

test('CP/M, DOS and compiled C require explicit matching artifact formats and kinds', async () => {
    for (const [target, fields] of [
        ['z80-cpm', {}],
        ['i8080-cpm', {toolchain: 'cowgol-cpm', target: 'i8080-cpm'}],
        ['dos', {toolchain: 'cowgol-msdos', target: 'dos', base64: 'TVoAAA==', bytes: 4}],
        ['cowgol-cgen', {toolchain: 'cowgol-cgen', target: 'cowgol-cgen', format: 'c', artifact_kind: 'source'}]
    ]) {
        for (const mutation of [{format: undefined}, {format: 'elf'}, {artifact_kind: undefined},
            {artifact_kind: target === 'cowgol-cgen' ? 'executable' : 'source'}]) {
            await assert.rejects(compileCowgol(source, target, {
                fetcher: async () => reply({...fields, ...mutation})
            }), /invalid artifact/, `${target}: ${JSON.stringify(mutation)}`);
        }
    }
});

test('failed or unavailable hosted compilers never return runnable artifacts', async () => {
    await assert.rejects(compileCowgol(source, 'z80-cpm', {fetcher: async () => ({
        ok: false, status: 503, json: async () => ({success: false, error: 'Cowgol bundle is not installed'})
    })}), /not installed/);
    await assert.rejects(compileCowgol(source, 'z80-cpm', {fetcher: async () => ({
        ok: false, status: 502, json: async () => { throw new Error('HTML response'); }
    })}), /invalid response.*502/);
    let fetched = false;
    const fetcher = async () => { fetched = true; return reply(); };
    await assert.rejects(compileCowgol(source, 'unknown', {fetcher}), /Unsupported/);
    await assert.rejects(compileCowgol('', 'z80-cpm', {fetcher}), /Write a Cowgol/);
    assert.equal(fetched, false);
});

test('restricted builds refuse hosted compilation before any network access', async () => {
    const previous = process.env.BW_REMOTE_TOOLCHAINS_POLICY;
    process.env.BW_REMOTE_TOOLCHAINS_POLICY = 'deny';
    try {
        await assert.rejects(compileCowgol(source, 'z80-cpm', {fetcher: () => assert.fail('network touched')}), /unavailable in this build/);
    } finally {
        if (previous === undefined) delete process.env.BW_REMOTE_TOOLCHAINS_POLICY;
        else process.env.BW_REMOTE_TOOLCHAINS_POLICY = previous;
    }
});

test('Cowgol native images travel through the existing CP/M and DOS machine loaders', async () => {
    const bytes = new Uint8Array([0xc9]);
    const cpm = cowgolCpmConfig();
    cpm.slots.com = {url: 'local-media:compiled.com'};
    for (const [config, kind, slot] of [[cpm, 'z80', 'com'], [cowgolDosConfig(), 'i8086', 'exe']]) {
        const result = await runMachineConfig(config, {fetcher: () => ({bytes}), dispatch () {}});
        assert.equal(result.detail.kind, kind);
        assert.equal(result.detail.slotId, slot);
        assert.deepEqual(result.detail.bytes, bytes);
    }
});

const method = (start, end) => {
    const from = importer.indexOf(start), to = importer.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    return importer.slice(from, to);
};
const Editor = new Function(`return class {
    ${method('    convertedSource (', '    // source → pseudocode')}
    ${method('    async runCowgolAsBlocks ()', '    async compileCowgolSource (')}
}`)();

test('Cowgol generator refusals remain errors instead of executable empty programs', () => {
    const generate = new Function(`${method('const DOS_LANG = {', '/** The fe/Tcl buffers')}\nreturn DOS_LANG.cowgol.generate;`)();
    const project = {targets: []};
    assert.throws(() => generate({generateCowgol: received => {
        assert.equal(received, project);
        return {ok: false, reasons: ['Concurrent scripts need an event runtime'], warnings: [], preview: '# unsupported'};
    }}, project), /Concurrent scripts need an event runtime/);
    assert.throws(() => generate({generateCowgol: () => ({ok: false})}, project), /generation was refused/);
    const accepted = '# Arithmetic is signed int32; values must remain in range.\nbw_print_number(3);\n';
    assert.equal(generate({generateCowgol: () => ({ok: true, cowgol: accepted,
        warnings: ['Arithmetic must remain in int32 range']})}, project), accepted);
});

test('a refused conversion cannot import partial pseudocode or start the VM', async () => {
    const editor = new Editor();
    assert.throws(() => editor.convertedSource({ok: false, pseudocode: 'say "partial"', reasons: ['Pointers are unsupported']}), /Pointers/);
    assert.equal(editor.convertedSource({ok: true, pseudocode: 'say 42', warnings: []}), 'say 42');
    Object.assign(editor, {state: {lang: 'cowgol'}, activeCode: () => source,
        compile: async () => { throw new Error('unsupported'); }, props: {vm: {greenFlag: () => assert.fail('ran refused source')}}});
    await editor.runCowgolAsBlocks();
});

test('Run as Blocks starts only the successfully applied current Cowgol source', async () => {
    const editor = new Editor();
    let runs = 0;
    Object.assign(editor, {state: {lang: 'cowgol'}, activeCode: () => source,
        compile: async options => { assert.equal(options.strict, true); return true; },
        props: {vm: {greenFlag: () => runs++}}});
    await editor.runCowgolAsBlocks();
    assert.equal(runs, 1);
    editor.compile = async () => { editor.state.lang = 'python'; return true; };
    await editor.runCowgolAsBlocks();
    assert.equal(runs, 1, 'switching language while importing revokes the run');
});

test('the + menu, file extensions, conversion, Run actions and highlighting all know Cowgol', () => {
    assert.match(importer, /BW_OPTIONAL_LANGS = \[\['cowgol'/);
    assert.match(importer, /cowgol:\s+\{ext: 'cow'/);
    assert.match(importer, /TWO_WAY = new Set\(\[[^\n]*'cowgol'/);
    assert.match(importer, /cowgol: \(\) => cowgolTarget \?\s+this\.compileCowgolSource\(cowgolTarget, true\) : this\.runCowgolAsBlocks\(\)/);
    for (const id of ['bw-cowgol-blocks-run', 'bw-cowgol-cpm-run', 'bw-cowgol-dos-run', 'bw-cowgol-riscv-run', 'bw-cowgol-eater-run']) assert.ok(importer.includes(id), id);
    const modes = readFileSync(new URL('../overlay/scratch-gui/src/lib/codemirror-languages.js', import.meta.url), 'utf8');
    assert.match(modes, /case 'cowgol': return cowgolLang\(\)/);
});
