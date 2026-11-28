// SPDX-License-Identifier: BSD-3-Clause
// Real pinned reader plus actual editor methods. VM writes are observed at
// their boundary; complete rendered UI qualification is a separate gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import basicToPseudocode from '../overlay/scratch-gui/src/lib/sb3-creator-basic.js';
import {conversionFailure} from '../overlay/scratch-gui/src/lib/bw-conversion-error.js';
import {codeDocumentEditorClass, codeDocumentLabels} from './helpers/code-document-editor.mjs';

const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
function extract(start, end) {
    const first = source.indexOf(start), last = source.indexOf(end, first);
    assert.ok(first >= 0 && last > first, `Actual editor method boundary: ${start}`);
    return source.slice(first, last);
}
const methods = extract('    async deriveBuffer (src, from, to) {', '    /**\n     * Is the RCX extension loaded?') +
    extract('    async compile ({strict = false, pseudocode = null, scratchExample = false} = {}) {', '    // Read the running project into all languages at once.') +
    extract('    setActiveCode (text) {', '    // Lazily import the compiler through the registering door') +
    extract('    basicGenerationPlaceholder (text) {', '    // Fetch examples/index.json once');
const readerImport = '(await import(/* webpackChunkName: "sb3-creator-basic" */ \'../../lib/sb3-creator-basic.js\')).default';
assert.equal(methods.split(readerImport).length - 1, 2, 'both real BASIC-reader consumers are exercised');
const Editor = codeDocumentEditorClass(source, methods.replaceAll(readerImport, 'readBasic'),
    {readBasic: basicToPseudocode, DOS_LANG: {}, conversionFailure, LANG_LABEL: {...codeDocumentLabels, basic: 'BBC BASIC'}});

function fixture(text) {
    const effects = [];
    const editor = new Editor();
    Object.assign(editor, {
        state: {lang: 'basic', basicProfile: 'bbc', basicEngine: 'crispbasic', basicLineNumbers: false,
            basicPortableLibrary: false, basicGenerationFailed: false, basicWarnings: [],
            buffers: {basic: text, pseudocode: 'existing blocks source'}, uploads: []},
        props: {vm: {runtime: {getTargetForStage: () => ({id: 'retained-stage'})},
            loadProject() { effects.push('loadProject'); }}},
        L: {stCompiling: 'Compiling', stError: message => `Conversion refused: ${message}`},
        setState(update) { const patch = typeof update === 'function' ? update(this.state) : update;
            if (patch) Object.assign(this.state, patch); },
        activeCode() { return this.state.buffers[this.state.lang]; },
        invalidateArcadeReport() {},
        async runCrispBasic() { effects.push('runCrispBasic'); },
        canLiftAsm() { return false; },
        async lib() { return {default: class {
            constructor() { this.project = {targets: []}; }
            parse() { effects.push('parse'); }
            generateBASIC(project, options) { effects.push(options); return {ok: true, basic: 'PRINT 1', warnings: []}; }
        }}; }
    });
    return {editor, effects};
}

for (const text of [
    '100 REM original\n\n300 PROCdigitalWrite(13,1)\n',
    'PRINT FNdigitalRead(2)\n',
    'PROCdelay(25)\nPRINT FNmillis\n',
    'DEF PROCpinMode(p,m$)\nENDPROC\n',
    'PROCtone(13,440)\n'
]) {
    test(`To blocks refuses portable source without changing the editor or VM: ${text.trim().split('\n').at(-1)}`, async () => {
        const {editor, effects} = fixture(text), originalBuffers = editor.state.buffers;
        await editor.compile();
        assert.deepEqual(effects, [], 'refusal happens before parsing or replacing blocks');
        assert.equal(editor.state.buffers, originalBuffers);
        assert.equal(editor.state.buffers.basic, text);
        assert.equal(editor.state.busy, false);
        assert.equal(editor.state.conversionReport.preserved, false);
        assert.match(editor.state.status, /To blocks/);
        assert.match(editor.state.status, /Line \d+/);
    });
}

test('derived languages cannot bypass portable To blocks refusal', async () => {
    const {editor, effects} = fixture('PRINT FNmillis\n');
    const result = await editor.deriveBuffer(editor.activeCode(), 'basic', 'pseudocode');
    assert.match(result.error, /To blocks.*FNmillis/);
    assert.equal(result.code, undefined);
    assert.deepEqual(effects, []);
});

test('generation-error comments cannot replace blocks or derive another language', async () => {
    const {editor, effects} = fixture('REM === Cannot show as BASIC ===\nREM toggle is unsupported\n');
    editor.state.basicGenerationFailed = true;
    editor.state.basicWarnings = ['toggle needs an output latch; generation refused'];
    const buffers = editor.state.buffers;
    await editor.compile();
    const result = await editor.deriveBuffer(editor.activeCode(), 'basic', 'python');
    assert.deepEqual(effects, []);
    assert.equal(editor.state.buffers, buffers);
    assert.equal(editor.state.conversionReport.preserved, false);
    assert.match(result.error, /output latch/);
});

test('editing a generation-error buffer preserves refusal until its banner is removed', async () => {
    const placeholder = 'REM === Cannot show as BASIC ===\nREM toggle is unsupported\n';
    const {editor, effects} = fixture(placeholder);
    editor.state.basicGenerationFailed = true;
    editor.state.basicWarnings = ['toggle needs an output latch; generation refused'];
    editor.setActiveCode(`${placeholder}\n`);
    assert.equal(editor.state.basicGenerationFailed, true, 'a newline does not turn an error buffer into authored code');
    assert.deepEqual(editor.state.basicWarnings, ['toggle needs an output latch; generation refused']);
    const buffers = editor.state.buffers;
    await editor.runBasic();
    await editor.compile();
    const result = await editor.deriveBuffer(editor.activeCode(), 'basic', 'pseudocode');
    assert.deepEqual(effects, [], 'no run, parse or VM replacement follows a whitespace edit');
    assert.equal(editor.state.buffers, buffers);
    assert.equal(editor.state.buffers.basic, `${placeholder}\n`);
    assert.equal(editor.state.conversionReport.preserved, false);
    assert.match(result.error, /output latch/);

    editor.setActiveCode('REM toggle was replaced by explicit writes\nPRINT 7\nEND\n');
    assert.equal(editor.state.basicGenerationFailed, false, 'replacing the banner admits authored correction');
    assert.deepEqual(editor.state.basicWarnings, []);
    await editor.runBasic();
    assert.deepEqual(effects, ['runCrispBasic']);
});

test('reopened or reformatted generation-error banners refuse even without retained UI state', async () => {
    for (const placeholder of [
        '\n  REM === Cannot show as BASIC ===\nREM reason\n',
        '100 REM===Cannot show as BASIC===\r\n110 REM reason\r\n'
    ]) {
        const {editor, effects} = fixture(placeholder);
        assert.equal(editor.state.basicGenerationFailed, false);
        await editor.runBasic();
        await editor.compile();
        const result = await editor.deriveBuffer(placeholder, 'basic', 'python');
        assert.deepEqual(effects, []);
        assert.equal(editor.state.buffers.basic, placeholder);
        assert.match(result.error, /generation-error banner/);
        assert.equal(editor.state.conversionReport.preserved, false);
    }
});

test('portable generation is explicit and cannot leak into retro profiles', async () => {
    for (const options of [
        {basicProfile: 'bbc', basicEngine: 'crispbasic', basicPortableLibrary: false},
        {basicProfile: 'bbc', basicEngine: 'crispbasic', basicPortableLibrary: true},
        {basicProfile: 'bbc', basicEngine: 'z80', basicPortableLibrary: true},
        {basicProfile: 'ms', basicEngine: 'crispbasic', basicPortableLibrary: true},
        {basicProfile: 'i8086', basicEngine: 'crispbasic', basicPortableLibrary: true}
    ]) {
        const {editor, effects} = fixture('');
        Object.assign(editor.state, options);
        await editor.deriveBuffer('WHEN flag clicked:\n  print 1', 'pseudocode', 'basic');
        const passed = effects.at(-1);
        assert.equal(passed.profile, options.basicProfile === 'i8086' ? 'ms' : options.basicProfile);
        assert.equal(passed.lineNumbers, false);
        assert.equal(passed.mode, options.basicProfile === 'bbc' && options.basicEngine === 'crispbasic' &&
            options.basicPortableLibrary ? 'crispbasic' : undefined);
    }
});

test('Brickwright CLI refuses portable BASIC and saved error banners without overwriting its output', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crispbasic-cli-'));
    try {
        const input = join(dir, 'portable.bas'), output = join(dir, 'existing.bw');
        for (const [source, diagnostic] of [
            ['PROCdelay(25)\n', /To blocks.*PROCdelay/],
            ['REM === Cannot show as BASIC ===\nREM CrispBASIC: toggle requires an output latch\n\n', /generation was refused/]
        ]) {
            writeFileSync(input, source);
            writeFileSync(output, 'KEEP EXISTING PROJECT\n');
            const result = spawnSync(process.execPath, [fileURLToPath(new URL('../bin/bwlite.mjs', import.meta.url)),
                'convert', input, '--to', 'pseudocode', '--out', output], {encoding: 'utf8'});
            assert.equal(result.status, 2, result.stderr);
            assert.match(result.stderr, diagnostic);
            assert.equal(result.stdout, '');
            assert.equal(readFileSync(output, 'utf8'), 'KEEP EXISTING PROJECT\n');
        }
    } finally { rmSync(dir, {recursive: true, force: true}); }
});
