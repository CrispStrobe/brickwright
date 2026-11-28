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
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator.js';
import {validateCrispBasicPseudocode, crispBasicModeError, CRISPBASIC_PSEUDOCODE_MARKER} from '../overlay/scratch-gui/src/lib/sb3-creator-crispbasic-mode.js';

const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
function extract(start, end) {
    const first = source.indexOf(start), last = source.indexOf(end, first);
    assert.ok(first >= 0 && last > first, `Actual editor method boundary: ${start}`);
    return source.slice(first, last);
}
const methods = extract('    async deriveBuffer (src, from, to) {', '    /**\n     * Is the RCX extension loaded?') +
    extract('    async compile ({strict = false, pseudocode = null} = {}) {', '    // Read the running project into all languages at once.') +
    extract('    setActiveCode (text) {', '    // Lazily import the compiler through the registering door') +
    extract('    basicGenerationPlaceholder (text) {', '    // Fetch examples/index.json once');
const readerImport = '(await import(/* webpackChunkName: "sb3-creator-basic" */ \'../../lib/sb3-creator-basic.js\')).default';
assert.equal(methods.split(readerImport).length - 1, 2, 'both real BASIC-reader consumers are exercised');
const Editor = new Function('readBasic', 'TWO_WAY', 'DOS_LANG', 'conversionFailure', 'LANG_LABEL',
    'validateCrispBasicPseudocode', 'crispBasicModeError',
    `return class {${methods.replaceAll(readerImport, 'readBasic')}}`)(
    basicToPseudocode, new Set(['basic', 'pseudocode']), {}, conversionFailure, {basic: 'BBC BASIC'},
    validateCrispBasicPseudocode, crispBasicModeError);

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
    'PROCdigitalToggle(13)\n',
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
    const {editor, effects} = fixture('REM === Cannot show as BASIC ===\nREM wait until is unsupported\n');
    editor.state.basicGenerationFailed = true;
    editor.state.basicWarnings = ['wait until needs a polling interval; generation refused'];
    const buffers = editor.state.buffers;
    await editor.compile();
    const result = await editor.deriveBuffer(editor.activeCode(), 'basic', 'python');
    assert.deepEqual(effects, []);
    assert.equal(editor.state.buffers, buffers);
    assert.equal(editor.state.conversionReport.preserved, false);
    assert.match(result.error, /polling interval/);
});

test('editing a generation-error buffer preserves refusal until its banner is removed', async () => {
    const placeholder = 'REM === Cannot show as BASIC ===\nREM wait until is unsupported\n';
    const {editor, effects} = fixture(placeholder);
    editor.state.basicGenerationFailed = true;
    editor.state.basicWarnings = ['wait until needs a polling interval; generation refused'];
    editor.setActiveCode(`${placeholder}\n`);
    assert.equal(editor.state.basicGenerationFailed, true, 'a newline does not turn an error buffer into authored code');
    assert.deepEqual(editor.state.basicWarnings, ['wait until needs a polling interval; generation refused']);
    const buffers = editor.state.buffers;
    await editor.runBasic();
    await editor.compile();
    const result = await editor.deriveBuffer(editor.activeCode(), 'basic', 'pseudocode');
    assert.deepEqual(effects, [], 'no run, parse or VM replacement follows a whitespace edit');
    assert.equal(editor.state.buffers, buffers);
    assert.equal(editor.state.buffers.basic, `${placeholder}\n`);
    assert.equal(editor.state.conversionReport.preserved, false);
    assert.match(result.error, /polling interval/);

    editor.setActiveCode('REM wait until was replaced by explicit timed polling\nPRINT 7\nEND\n');
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

const portablePseudo = `DEVICE ARDUINO-UNO
PIN led = D13 OUTPUT ACTIVE LOW
PIN button = D2 INPUT ACTIVE LOW
GLOBAL count
WHEN flag clicked:
  set count to 0
  REPEAT UNTIL read button:
    toggle led
    change count by 1
    wait 0.001 seconds
  print count
  print timer`;

function generatePortable(source, lineNumbers = false) {
    const creator = new SB3Creator();
    creator.parse(source);
    assert.deepEqual(creator.warnings, []);
    const result = creator.generateBASIC(undefined, {profile: 'bbc', mode: 'crispbasic', lineNumbers});
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.basic;
}

test('explicit portable editor conversion preserves a durable requirement and can regenerate BASIC after reopening', async () => {
    for (const numbered of [false, true]) {
        const original = generatePortable(portablePseudo, numbered);
        const {editor, effects} = fixture(original);
        editor.state.basicPortableLibrary = true;
        const read = await editor.deriveBuffer(original, 'basic', 'pseudocode');
        assert.equal(read.error, undefined);
        assert.equal(validateCrispBasicPseudocode(read.code), true);
        assert.equal(read.code.split(CRISPBASIC_PSEUDOCODE_MARKER).length - 1, 1);
        assert.deepEqual(effects, [], 'reading portable source does not pass it through the blocks parser');
        // A persisted marker is an explicit request for its runtime even when
        // the new editor has not retained the previous checkbox state.
        editor.state.basicPortableLibrary = false;
        editor.lib = async () => ({default: SB3Creator});
        const regenerated = await editor.deriveBuffer(read.code, 'pseudocode', 'basic');
        assert.equal(regenerated.error, undefined);
        assert.equal(regenerated.basicGenerationFailed, false);
        assert.equal(regenerated.basicPortableLibrary, true);
        assert.match(regenerated.code, /PROCdigitalToggle/);
        assert.match(regenerated.code, /PROCdelay/);
        assert.equal(basicToPseudocode(regenerated.code, {mode: 'crispbasic'}).ok, true);
    }
});

test('portable editor mode refuses cross-language conversion before a compiler or destination write', async () => {
    const original = generatePortable(portablePseudo);
    const marked = basicToPseudocode(original, {mode: 'crispbasic'}).pseudocode;
    for (const target of ['python', 'javascript', 'c', 'micropython', 'forth']) {
        for (const [from, text] of [['basic', original], ['pseudocode', marked]]) {
            const {editor, effects} = fixture(text);
            editor.state.basicPortableLibrary = true;
            const buffers = editor.state.buffers;
            const result = await editor.deriveBuffer(text, from, target);
            assert.equal(result.code, undefined);
            assert.match(result.error, /requires CrispBASIC mode/);
            assert.equal(editor.state.buffers, buffers);
            assert.deepEqual(effects, []);
        }
    }
    for (const [profile, engine] of [['bbc', 'z80'], ['ms', 'crispbasic'], ['i8086', 'crispbasic']]) {
        const {editor, effects} = fixture(marked);
        Object.assign(editor.state, {basicProfile: profile, basicEngine: engine, basicPortableLibrary: true});
        const result = await editor.deriveBuffer(marked, 'pseudocode', 'basic');
        assert.match(result.error, /requires CrispBASIC mode/);
        assert.deepEqual(effects, []);
    }
});

test('saved portable pseudocode cannot replace blocks, including the explicit pseudocode compile path', async () => {
    const marked = basicToPseudocode(generatePortable(portablePseudo), {mode: 'crispbasic'}).pseudocode;
    for (const explicit of [false, true]) {
        const {editor, effects} = fixture(marked);
        editor.state.lang = explicit ? 'basic' : 'pseudocode';
        editor.state.buffers.pseudocode = marked;
        const buffers = editor.state.buffers;
        await editor.compile(explicit ? {pseudocode: marked} : {});
        assert.equal(editor.state.buffers, buffers);
        assert.deepEqual(effects, []);
        assert.equal(editor.state.conversionReport.preserved, false);
        assert.match(editor.state.status, /To blocks.*not qualified/);
        assert.equal(editor.state.busy, false);
    }
});

test('portable marker detection agrees with parser whitespace and UTF-8 BOM admission', async () => {
    for (const prefix of ['\ufeff', '\u00a0', '\v', '\f']) {
        const marked = `${prefix}${CRISPBASIC_PSEUDOCODE_MARKER}\nWHEN flag clicked:\n  print 1`;
        const {editor, effects} = fixture(marked);
        editor.state.lang = 'pseudocode';
        editor.state.buffers.pseudocode = marked;
        const result = await editor.deriveBuffer(marked, 'pseudocode', 'python');
        assert.match(result.error, /requires CrispBASIC mode/);
        await editor.compile();
        assert.deepEqual(effects, []);
        assert.match(editor.state.status, /To blocks.*not qualified/);
    }
});

test('future, duplicate and malformed portable markers refuse before editor parsing', async () => {
    for (const directive of ['# @crispbasic-portable 2', '# @crispbasic-portable',
        `${CRISPBASIC_PSEUDOCODE_MARKER}\n${CRISPBASIC_PSEUDOCODE_MARKER}`]) {
        const marked = `${directive}\nWHEN flag clicked:\n  print 1`;
        const {editor, effects} = fixture(marked);
        editor.state.lang = 'pseudocode';
        editor.state.buffers.pseudocode = marked;
        for (const target of ['pseudocode', 'basic', 'python']) {
            const result = await editor.deriveBuffer(marked, 'pseudocode', target);
            assert.match(result.error, /Unsupported or duplicate CrispBASIC/);
            assert.equal(result.code, undefined);
        }
        await editor.compile();
        assert.deepEqual(effects, []);
        assert.equal(editor.state.buffers.pseudocode, marked);
        assert.match(editor.state.status, /Unsupported or duplicate CrispBASIC/);
    }
});

test('Brickwright CLI refuses portable BASIC and saved error banners without overwriting its output', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crispbasic-cli-'));
    try {
        const input = join(dir, 'portable.bas'), output = join(dir, 'existing.bw');
        for (const [source, diagnostic] of [
            ['PROCdelay(25)\n', /To blocks.*PROCdelay/],
            ['PROCdigitalToggle(13)\n', /To blocks.*PROCdigitalToggle/],
            ['REM === Cannot show as BASIC ===\nREM CrispBASIC: wait until requires a polling interval\n\n', /generation was refused/]
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
