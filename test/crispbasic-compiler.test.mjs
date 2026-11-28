// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {prepareCompiledBasic, basicCompilerTarget, compiledBasicTarget,
    assertCompiledBasicRoute, requestCompiledBasicBuild}
    from '../overlay/scratch-gui/src/lib/crispbasic-compiler.js';
import {codeDocumentEditorClass, codeEditorMethod} from './helpers/code-document-editor.mjs';
import {createCodeDocument} from '../overlay/scratch-gui/src/lib/code-source-document.js';

const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
const methods = ['async compileCrispBasic () {', 'activeCode () {', 'crispBasicDiagnostic (error, filename) {']
    .map(signature => codeEditorMethod(source, signature)).join('\n');
const c = '/* CrispBASIC C99 target: arduino-uno */\nint main(void) { return 0; }\n';

function fixture(compile) {
    const Editor = codeDocumentEditorClass(source, methods, {prepareCompiledBasic: compile});
    const editor = new Editor();
    const basic = '10 PRINT "untouched"\n';
    editor.props = {vm: {runtime: {}}};
    editor.L = {basicC99Compiling: 'compiling', basicC99Ready: 'ready', basicC99Pico: 'SDK required'};
    editor.state = {lang: 'basic', basicProfile: 'bbc', basicEngine: 'crispbasic', basicFilename: 'lesson.bas',
        basicGenerationFailed: false, basicResetting: false, running: false, busy: false,
        basicLineNumbers: false, libraryTarget: null, authoredSources: {}, driverMode: 'shim', asyncMode: false, eventsMode: false,
        buffers: {basic}, codeDocument: createCodeDocument({lang: 'basic', code: basic,
            target: 'arduino-uno', generationOptions: {basicProfile: 'bbc', basicLineNumbers: false}})};
    editor.setState = update => {
        const patch = typeof update === 'function' ? update(editor.state) : update;
        if (patch) Object.assign(editor.state, patch);
    };
    editor.highlights = [];
    editor.setHighlightedLine = line => editor.highlights.push(line);
    return editor;
}

test('Compile BASIC passes the exact editor text to C99 and retains the authored BASIC document', async () => {
    let request;
    const editor = fixture(async options => { request = options; return {c, target: 'arduino-uno'}; });
    const before = editor.state.codeDocument;
    await editor.compileCrispBasic();
    assert.deepEqual(request, {source: before.code, device: 'arduino-uno', filename: 'lesson.bas'});
    assert.equal(editor.state.lang, 'c', editor.state.status);
    assert.equal(editor.state.codeDocument.lang, 'basic');
    assert.equal(editor.state.codeDocument.code, before.code);
    assert.equal(editor.state.buffers.basic, before.code);
    assert.equal(editor.state.buffers.c, c);
    assert.equal(editor.state.codeDocument.projections.c.sourceRevision, before.revision);
    assert.equal(editor.state.busy, false);
});

test('source diagnostics keep the BASIC document and highlight the physical source line', async () => {
    const editor = fixture(async () => { throw Object.assign(new Error('EVAL requires run-time parsing'), {line: 4, column: 7}); });
    const before = editor.state.codeDocument;
    await editor.compileCrispBasic();
    assert.equal(editor.state.codeDocument, before);
    assert.equal(editor.state.lang, 'basic');
    assert.deepEqual(editor.highlights, [4]);
    assert.match(editor.state.status, /lesson\.bas:4:7:.*EVAL/);
    assert.equal(editor.state.buffers.c, undefined);
});

test('an asynchronous compiler load cannot overwrite an edited or replaced document', async () => {
    let resolve;
    const pending = new Promise(done => { resolve = done; });
    const editor = fixture(() => pending);
    const work = editor.compileCrispBasic();
    editor.state.buffers = {basic: 'PRINT "new source"'};
    const newer = editor.state.buffers;
    resolve({c, target: 'arduino-uno'});
    await work;
    assert.equal(editor.state.buffers, newer);
    assert.equal(editor.state.lang, 'basic');
    assert.equal(editor.state.busy, false);
});

test('compiler adapter maps only exact supported targets and preserves compiler diagnostics', async () => {
    assert.equal(basicCompilerTarget(null), 'native');
    assert.equal(basicCompilerTarget('pico'), 'pico');
    assert.equal(basicCompilerTarget('arduino-uno'), 'arduino-uno');
    assert.throws(() => basicCompilerTarget('arduino-mega'), /no C99 platform adapter/);
    let received;
    const result = await prepareCompiledBasic({source: 'PRINT "ok"', device: 'pico', filename: 'board.bas',
        baseURL: 'https://example.invalid/prefix/compiler/',
        loadCompiler: async url => {
            assert.equal(url, 'https://example.invalid/prefix/compiler/src/compiler/index.mjs');
            return {compileSource(text, options) { received = {text, options}; return {c: 'int main(void) { return 0; }'}; }};
        }});
    assert.deepEqual(received, {text: 'PRINT "ok"', options: {filename: 'board.bas', target: 'pico'}});
    assert.equal(compiledBasicTarget(result.c), 'pico');
    assert.equal(result.evidence.build, 'not-run');
    const failure = Object.assign(new Error('EVAL unsupported'), {line: 3});
    await assert.rejects(prepareCompiledBasic({source: 'EVAL', baseURL: 'https://example.invalid/',
        loadCompiler: async () => ({compileSource() { throw failure; }})}), error => error === failure);
});

test('Pico SDK output and wrong Uno targets are refused before the hosted route', () => {
    assert.throws(() => assertCompiledBasicRoute('/* CrispBASIC C99 target: pico */\n', 'rp2040'), /requires the Pico SDK/);
    assert.throws(() => assertCompiledBasicRoute(c, 'atmega2560'), /atmega328p C route/);
    assert.throws(() => assertCompiledBasicRoute(c, 'atmega328p', 'arduino'), /atmega328p C route/);
    assert.doesNotThrow(() => assertCompiledBasicRoute(c, 'atmega328p', 'c'));
    assert.doesNotThrow(() => assertCompiledBasicRoute('void setup() {}', 'arduino-uno', 'arduino'));
});

test('Uno uses the existing C compiler seam with binary64 requirements and unchanged firmware handoff shape', async () => {
    let args;
    const hex = ':020000000000FE\n:00000001FF\n';
    const built = await requestCompiledBasicBuild({source: c, device: 'arduino-uno', compile: async (...values) => {
        args = values; return {base64: btoa(hex), f_cpu: 16000000};
    }});
    assert.deepEqual(args.slice(0, 4), [c, 'atmega328p', 'hex', 'c']);
    assert.deepEqual(args[4].options, ['-mdouble=64', '-mlong-double=64', '-Wl,-u,vfprintf', '-lprintf_flt', '-lm']);
    assert.equal(built.kind, 'avr8js');
    assert.equal(built.clockHz, 16000000);
    assert.equal(built.hex, hex);
    assert.equal(built.evidence.simulator, 'not-run');
    await assert.rejects(requestCompiledBasicBuild({source: c, device: 'arduino-uno', compile: async () => ({base64: btoa('bad')})}), /complete Intel HEX/);
});

test('checked-in editor and compiler adapter mirrors remain exact', () => {
    for (const name of ['src/components/tw-pseudocode/pseudocode-importer.jsx', 'src/lib/crispbasic-compiler.js',
        'src/lib/bw-matrix/code-languages.js']) {
        const canonical = readFileSync(new URL(`../overlay/scratch-gui/${name}`, import.meta.url));
        const mirror = readFileSync(new URL(`../packages/scratch-gui/${name}`, import.meta.url));
        assert.deepEqual(mirror, canonical, name);
    }
    assert.match(source, /data-testid=\{menu \? 'bw-basic-compile-menu' : 'bw-basic-compile'\}/);
});
