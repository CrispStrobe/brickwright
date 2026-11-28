/**
 * The wiring between the MakeCode importer and the Code tab.
 *
 * bw-makecode is tested to death against real files, but every one of
 * those tests would still pass if the Open button never called it. This
 * file gates the seams that only exist in the JSX — and each assertion
 * here is a failure mode that shows up in a browser and nowhere else:
 *
 *   - a hex read as TEXT instead of bytes (silently corrupts .uf2/.png)
 *   - costumes handed over under field names `compile()` does not read
 *     (the artwork vanishes and the code still loads, so nothing errors)
 *   - a lazy import split into three chunks instead of one
 *   - a German string missing, which throws only when the locale is de
 *
 * Source-shape assertions, in the idiom of circuit-tab-index.test.mjs:
 * this is not a rendering test, it is a "the two ends still agree" test.
 */

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

import {IMPORT_ACCEPT} from '../overlay/scratch-gui/src/lib/bw-makecode/accept.js';
import {balancedFrom, balancedAfter, scopeAfter} from './helpers/js-scope.mjs';
import {codeDocumentEditorClass, codeDocumentLabels} from './helpers/code-document-editor.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const IMPORTER = resolve(here, '../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx');
const source = readFileSync(IMPORTER, 'utf8');

test('the Open button offers the artefact extensions and routes them', () => {
    assert.match(source, /accept=\{`\$\{CODE_ACCEPT\},\$\{IMPORT_ACCEPT\}`\}/,
        'the file input must offer .hex/.uf2/.elf/.png as well as the source extensions');
    assert.match(source, /if \(isImportableArtefact\(file\.name\)\) \{\s*\n\s*this\.openArtefactFile\(file\);/,
        'and route those to the artefact importer rather than reading them as text');
    // accept.js is imported statically for exactly this: reading one
    // constant must not pull the decoders into the main bundle.
    assert.match(source, /import \{IMPORT_ACCEPT, isImportableArtefact\} from '\.\.\/\.\.\/lib\/bw-makecode\/accept\.js'/);
    assert.doesNotMatch(source, /^import .*bw-makecode\/index\.js/m,
        'the importer proper must only ever be loaded on demand');
});

test('an artefact is read as bytes, not as text', () => {
    // A .uf2 or .png read through readAsText is mangled beyond recovery
    // by the encoder, and the failure looks like "no source embedded".
    const method = scopeAfter(source, 'openArtefactFile (file) {');
    assert.match(method, /readAsArrayBuffer\(file\)/);
    assert.match(method, /new Uint8Array\(reader\.result\)/);
});

test('file and share imports use one lazy gateway and all exporters share its chunk', () => {
    const chunks = [...source.matchAll(/webpackChunkName: "([^"]+)" \*\/ '\.\.\/\.\.\/lib\/bw-makecode\/(index|export-arcade)\.js'/g)]
        .map(m => m[1]);
    const gateway = scopeAfter(source, 'makeCodeImportModule () {');
    const lazy = /import\(\s*\/\* webpackChunkName: "bw-makecode" \*\/ '\.\.\/\.\.\/lib\/bw-makecode\/(?:index|export-arcade)\.js'\)/g;
    assert.equal([...gateway.matchAll(lazy)].length, 1, 'one actual lazy gateway');
    for (const signature of ['openArtefactFile (file) {', 'async openMakeCodeShare () {']) {
        const body = scopeAfter(source, signature);
        assert.equal([...body.matchAll(/await this\.makeCodeImportModule\(\)/g)].length, 1, signature);
        const share = signature.startsWith('async openMakeCodeShare');
        assert.equal([...body.matchAll(lazy)].length, share ? 1 : 0,
            'only the self-contained share receiver has one direct lazy fallback');
        if (share) assert.match(body,
            /this\.makeCodeImportModule\s*\?\s*await this\.makeCodeImportModule\(\)\s*:\s*await import\(/,
            'the normal component uses its gateway; only an absent gateway selects the bare-receiver fallback');
    }
    for (const signature of ['async exportMakeCode () {', 'async makeCodeSubject () {',
        'async boardSubjects (source) {', 'async exportBoardsMakeCode (source) {',
        'async arcadeFromStage () {', 'async exportArcade () {']) {
        assert.equal([...scopeAfter(source, signature).matchAll(lazy)].length, 1, signature);
    }
    assert.equal(chunks.length, 8, 'one gateway, one share-only fallback and six export/subject loaders');
    assert.deepEqual([...new Set(chunks)], ['bw-makecode'], 'all paths use one chunk');
    assert.doesNotMatch(source, /^import .*bw-makecode\/(?:index|export-arcade)\.js/m,
        'the shared gateway must remain lazy');
});

test('MakeCode\'s compiler is loaded on demand, in its own chunk, by the ▶, emulate and ⤓ actions and the Arcade board list only', () => {
    // pxt-runtime.js is small, but what it drives (the compiler worker and the
    // target bundle, several MB) must not ride on the importer's chunk.
    assert.doesNotMatch(source, /^import .*bw-makecode\/pxt-runtime\.js/m);
    const chunks = [...source.matchAll(/webpackChunkName: "([^"]+)" \*\/ '\.\.\/\.\.\/lib\/bw-makecode\/pxt-runtime\.js'/g)]
        .map(m => m[1]);
    // Seven, deliberately. The Arcade board picker's list (loadArcadeBoards)
    // rides the same chunk — it reads pxt-arcade's served hardware list through
    // pxt-runtime.js, so the importer's own chunk stays compiler-free — and so
    // does the micro:bit V2 emulator build (runOnEmulatedMicrobit). Two more
    // since a project can hold several boards: compiling every board for the
    // side-by-side simulators, and for the per-board firmware download.
    assert.equal(chunks.length, 7, 'run in the simulator, run on the emulated micro:bit V2, build the firmware, ' +
        'run this project as Arcade, list the Arcade boards, ' +
        'and the two multi-board actions (run every board, build every board\'s firmware)');
    assert.deepEqual([...new Set(chunks)], ['bw-makecode-pxt']);
    for (const [method, testid] of [['runInMakeCode ()', 'bw-makecode-run'], ['downloadMakeCodeFirmware ()', 'bw-makecode-firmware'],
        ['runAsArcade ()', 'bw-makecode-arcade-run']]) {
        assert.ok(scopeAfter(source, `async ${method} {`).includes('compileMakeCode('), `${method} does not compile`);
        assert.match(source, new RegExp(`data-testid="${testid}"`), `no ${testid} button`);
    }
    assert.ok(scopeAfter(source, 'async runOnEmulatedMicrobit () {').includes('compileMakeCodeForEmulator('),
        'runOnEmulatedMicrobit () does not compile for the emulator');
    assert.match(source, /data-testid="bw-makecode-emulate"/, 'no bw-makecode-emulate button');
    assert.ok(scopeAfter(source, 'async loadArcadeBoards () {').includes('arcadeBoards('), 'loadArcadeBoards does not read the served board list');
});

test('an Arcade download builds for the board the picker chose, and refuses "no board" by name', () => {
    // The picker exists for an Arcade project and is the source of hwVariant:
    // a download that ignored it would build the board-less default, which has
    // no firmware base (NO_BASE_HEX) — or, worse, build for the wrong board.
    assert.match(source, /data-testid="bw-makecode-arcade-board"/, 'no Arcade board picker');
    const method = scopeAfter(source, 'async downloadMakeCodeFirmware () {');
    assert.match(method, /hwVariant: board \? board\.variant : ''/, 'the chosen board is not what the compile is told');
    assert.match(method, /if \(!board\) \{ this\.setState\(\{status: this\.L\.mcBoardNone\}\); return; \}/,
        'an Arcade download with no board chosen must be refused in words, before compiling');
    assert.match(method, /firmwareFile\(/, 'a .uf2 must be decoded from pxt\'s base64, not written as text');
});

test('costumes are handed over under the names compile() reads', () => {
    // The contract: applyMakeCodeImport fills `uploads`, and compile()
    // consumes it. Rename a field on one side and the artwork silently
    // stops arriving — the project still loads, so nothing throws.
    const apply = scopeAfter(source, 'applyMakeCodeImport (res, label) {');
    const uploads = apply.slice(apply.indexOf('uploads:'), apply.indexOf('output: null'));
    for (const field of ['sprite:', 'filename:', 'svg:', 'mode:']) {
        assert.ok(uploads.includes(field), `uploads entries must carry ${field}`);
    }
    const signature = 'async compile ({strict = false, pseudocode = null, scratchExample = false} = {}) {';
    const method = balancedFrom(source, source.indexOf(signature) + signature.length - 1, '{', '}');
    assert.match(method, /const uploads = this\.state\.uploads/);
    const compile = scopeAfter(method, 'uploads.forEach');
    assert.match(compile, /u\.sprite/);
    assert.match(compile, /u\.svg/);
    assert.match(compile, /u\.mode === 'add'/);
});

test('the share and export buttons exist, and are bound', () => {
    for (const [testid, handler] of [
        ['bw-makecode-share', 'openMakeCodeShare'],
        ['bw-makecode-export', 'exportMakeCode']
    ]) {
        assert.ok(source.includes(`data-testid="${testid}"`), `${testid} button`);
        assert.match(source, new RegExp(`onClick=\\{this\\.${handler}\\}`), `${testid} onClick`);
        assert.match(source, new RegExp(`this\\.${handler} = this\\.${handler}\\.bind\\(this\\)`),
            `${handler} must be bound, or "this" is undefined when it fires`);
    }
});

test('the micro:bit tab appears for an imported .py, which has no DEVICE line', () => {
    // Hiding it would hide the Run-on-simulator button for the one
    // imported program that needs no translation at all.
    assert.match(source,
        /\['microbit', 'calliopemini'\]\.includes\(codeDevice\) \|\|\s*\(!codeDevice && \(this\.state\.buffers\.micropython \|\| ''\)\.trim\(\)\)/,
        'and it reads that buffer defensively — see the buffer-shape test below');
    assert.match(source, /importedPython: res\.kind === 'micropython'/);
});

test('a status message gets every argument its template names', () => {
    // `mcArcade` grew a `button` parameter and the call site did not, so
    // the status line said "Press undefined to build" — through a green
    // build, because no unit test reads that text. The browser gate
    // printed it; this keeps it printed-once.
    const template = /mcArcade: \((.*?)\) =>/.exec(source);
    assert.ok(template, 'the English template');
    const parameters = template[1].split(',').length;
    // Paren-matched: a `);` inside a string argument would end the old lazy capture early and
    // the depth-zero argument count below would then be taken over a truncated argument list.
    const call = balancedAfter(source, 'this.L.mcArcade', '(', ')');
    // Arguments, counted at depth zero so `(res.sprites || []).length`
    // is one argument and not two.
    let depth = 0;
    let args = 1;
    for (const c of call.slice(1, -1)) {
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth--;
        else if (c === ',' && depth === 0) args++;
    }
    assert.equal(args, parameters, 'the call passes as many arguments as the message takes');
    assert.match(call, /this\.L\.toBlocks/, 'and the button label comes from the button');
});

test('every buffer set carries every language', () => {
    // A `buffers:` literal that spells out the set and omits one leaves
    // that key undefined, and the next render to read it dies. That is
    // not hypothetical: `loadExample` dropped `micropython`, and the
    // moment the micro:bit tab started reading it to decide whether to
    // show itself, loading any example crashed the pane. The unit tests
    // saw nothing; a browser gate caught it.
    // Source replacement now goes through the shared document adapter. Execute
    // that boundary for each language instead of counting deleted literals.
    assert.match(scopeAfter(source, 'codeDocumentState (document)'),
        /restoreCodeDocumentState\(document, Object\.keys\(LANG_LABEL\)\)/);
    const Editor = codeDocumentEditorClass(source, '');
    const editor = Object.assign(new Editor(), {state: {}});
    const languages = Object.keys(codeDocumentLabels).sort();
    for (const lang of languages) {
        const code = `authored ${lang} source`;
        const state = editor.authoredCodeState(lang, code);
        assert.deepEqual(Object.keys(state.buffers).sort(), languages, `${lang}: all registered buffers exist`);
        assert.equal(state.codeDocument.lang, lang);
        assert.equal(state.codeDocument.code, code);
        for (const key of languages) assert.equal(state.buffers[key], key === lang ? code : '', `${lang}: ${key}`);
    }
});

test('every MakeCode string exists in both languages', () => {
    const table = key => {
        const start = source.indexOf(`    ${key}: {`);
        assert.ok(start > 0, `${key} locale table`);
        const end = source.indexOf('\n    },', start);
        return source.slice(start, end);
    };
    const en = table('en');
    const de = table('de');
    const keys = [...en.matchAll(/^\s{8}(mc[A-Za-z]+):/gm)].map(m => m[1]);
    assert.ok(keys.length >= 12, `expected the MakeCode strings, found ${keys.length}`);
    for (const key of keys) {
        assert.ok(new RegExp(`^\\s{8}${key}:`, 'm').test(de), `${key} is missing its German`);
    }
});

test('the extensions offered and the extensions handled are the same list', () => {
    // IMPORT_ACCEPT is what the file dialog shows; isImportableArtefact is
    // what decides where a dropped file goes. A file offered but not
    // routed lands in the text path and reports "unknown file type".
    assert.equal(IMPORT_ACCEPT, '.hex,.uf2,.elf,.png,.mkcd,.pxt');
    const accept = readFileSync(
        resolve(here, '../overlay/scratch-gui/src/lib/bw-makecode/accept.js'), 'utf8');
    for (const ext of IMPORT_ACCEPT.split(',')) {
        assert.ok(accept.includes(ext.slice(1)), `${ext} must appear in the routing test too`);
    }
});
