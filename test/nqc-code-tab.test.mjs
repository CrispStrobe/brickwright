// The NQC tab in the Code tab: registration checks on the component's source
// and source-edit checks through its actual document adapter.
//
// This component is 4,400 lines of React that this suite cannot mount, so the
// registration assertions here read the file. The document check executes the
// actual source methods. Together they catch the class of mistake that made
// this feature worth writing carefully: a tab that is registered in one of
// the six places it has to be registered and forgotten in the others, which
// produces a tab that looks fine and loses your work when you switch away.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {codeDocumentEditorClass, codeDocumentLabels, codeEditorMethod} from './helpers/code-document-editor.mjs';
import {scopeAfter} from './helpers/js-scope.mjs';

const root = join(import.meta.dirname, '..');
const importer = readFileSync(
    join(root, 'overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8');
const languages = readFileSync(
    join(root, 'overlay/scratch-gui/src/lib/codemirror-languages.js'), 'utf8');

test('nqc is registered everywhere a tab has to be, not just in the tab row', () => {
    // Each registration is a separate requirement. A missing source buffer
    // used to lose NQC text when the editor cleared generated views.
    assert.match(importer, /nqc:\s*\{ext: 'nqc'/, 'CODE_FILES needs an entry or save/open breaks');
    assert.match(importer, /micropython: 'micro:bit', nqc: 'NQC'/, 'LANG_LABEL needs a name');
    // The shared document adapter replaces the old inline buffer resets.
    // It must provide every registered buffer and retain edited NQC as author.
    assert.match(scopeAfter(importer, 'codeDocumentState (document)'),
        /restoreCodeDocumentState\(document, Object\.keys\(LANG_LABEL\)\)/);
    const Editor = codeDocumentEditorClass(importer, codeEditorMethod(importer, 'setActiveCode (text) {'));
    const editor = Object.assign(new Editor(), {
        state: {}, invalidateArcadeReport () {},
        setState (update) { Object.assign(this.state, typeof update === 'function' ? update(this.state) : update); }
    });
    editor.state = editor.authoredCodeState('nqc', 'task main() {}');
    const edited = 'task main() { OnFwd(OUT_A); }';
    editor.setActiveCode(edited);
    assert.deepEqual(Object.keys(editor.state.buffers).sort(), Object.keys(codeDocumentLabels).sort());
    assert.equal(editor.state.codeDocument.lang, 'nqc');
    assert.equal(editor.state.codeDocument.code, edited);
    for (const [lang, code] of Object.entries(editor.state.buffers)) {
        assert.equal(code, lang === 'nqc' ? edited : '', `${lang} buffer after NQC edit`);
    }
    assert.doesNotMatch(importer, /buffers: \{pseudocode: ''/,
        'a hand-written buffer list is back: a tab missing from it is silently emptied when another tab is edited');
});

test('the tab is offered when the RCX extension is loaded, and not otherwise', () => {
    // The RCX has no DEVICE line — it is reached through an extension — so
    // the usual `currentDevice() === 'x'` test does not apply.
    assert.match(importer, /this\.rcxLoaded\(\) \|\| \(this\.state\.buffers\.nqc \|\| ''\)\.trim\(\)/);
    assert.match(importer, /rcxLoaded \(\) \{/);
    // And it must not throw during render on a host with no extension manager.
    assert.match(importer.slice(importer.indexOf('rcxLoaded () {')), /catch \(e\) \{\s*return false;/);
});

test('NQC is one-way but editable, which the old rule could not express', () => {
    // The regression this prevents: adding nqc to TWO_WAY to make the editor
    // writable, which would also offer a "to blocks" button for a front end
    // that does not exist.
    assert.doesNotMatch(importer, /TWO_WAY = new Set\(\[[^\]]*'nqc'/,
        'nqc must NOT be in TWO_WAY — there is no NQC-to-blocks front end');
    assert.match(importer, /const EDITABLE_ONE_WAY = \(lang, asmMode\) =>\s*\n\s*lang === 'nqc'/);
    // Every readOnly site must consult the new predicate, or one editor
    // instance stays read-only and the tab is typeable only sometimes.
    const readOnlySites = importer.match(/readOnly=\{!TWO_WAY\.has\(this\.state\.lang\) && !EDITABLE_ONE_WAY\(/g) || [];
    assert.equal(readOnlySites.length, 3, 'all three editor instances must use the same rule');
    assert.doesNotMatch(importer, /readOnly=\{!TWO_WAY\.has\(this\.state\.lang\) && !\(this\.state\.lang === 'asm'/,
        'a readOnly site still uses the old asm-only rule');
});

test('both actions exist and neither throws the compiled bytes away', () => {
    assert.match(importer, /async compileNqcToFile \(\)/);
    assert.match(importer, /async sendNqcToBrick \(\)/);
    // The one that matters: compiled successfully, no tower — the file is
    // saved rather than the work being lost, which is the same choice the
    // extension makes for the same reason.
    const send = importer.slice(importer.indexOf('async sendNqcToBrick ()'));
    const body = send.slice(0, send.indexOf('\n    }'));
    assert.match(body, /if \(typeof send !== 'function'\) \{[\s\S]*?this\.saveBlob\(/,
        'a host with no tower must still get its .rcx');
    assert.match(body, /programSlot: 0/);
});

test('the compiler is the local one, and its absence is named', () => {
    const compile = importer.slice(importer.indexOf('async _compileNqc ()'));
    const body = compile.slice(0, compile.indexOf('\n    }'));
    assert.match(body, /runtime\.nqcCompile/);
    assert.match(body, /this\.L\.nqcNoCompiler/, 'a build without the compiler must say so');
    assert.doesNotMatch(body, /Scratch\.fetch|compilerUrl|https?:/,
        'the editor must not grow its own hosted fallback; the extension already has one');
});

/**
 * The value of one string-table key, sliced at a real delimiter rather than
 * at a character count.
 *
 * A fixed window — `.slice(0, 900)` — is what this file used first, and
 * scripts/audit-gate-shapes.mjs was right to refuse it: it stops checking
 * anything the moment the entry above grows past the window, and it does so
 * silently. The next key at the same indentation is an actual boundary.
 */
const tableValue = (source, key, occurrence = 0) => {
    let at = -1;
    for (let i = 0; i <= occurrence; i++) at = source.indexOf(`${key}:`, at + 1);
    assert.ok(at !== -1, `no ${key} at occurrence ${occurrence}`);
    const rest = source.slice(at);
    const end = rest.search(/\n {8}[A-Za-z_$][\w$]*:/);
    assert.ok(end > 0, `${key} has no following key to delimit it`);
    return rest.slice(0, end);
};

test('the units that are silently wrong are in the help text, in both languages', () => {
    // Power is 0-7 and not a percentage; Wait() is centiseconds. Both are
    // wrong-by-default for anyone arriving from any other LEGO toolchain, and
    // neither produces an error — just a robot that behaves oddly.
    const en = tableValue(importer, 'nqcNote', 0);
    assert.match(en, /0-7, NOT a percentage/);
    assert.match(en, /CENTISECONDS/);
    assert.match(en, /firmware/i, 'the difference between "broken" and "not set up yet"');

    const de = tableValue(importer, 'nqcNote', 1);
    assert.match(de, /KEIN/);
    assert.match(de, /Prozentwert/);
    assert.match(de, /HUNDERTSTELSEKUNDEN/);
    assert.match(de, /Firmware/);
    assert.notEqual(en, de, 'the German note must not be the English one copied');
});

test('nqc highlights as C in both the immediate and the deferred loader', () => {
    // Missing it from the deferred half gives a tab that highlights on first
    // paint and goes plain when the real grammar loads.
    // Sliced at the switch statements themselves, not at a character count:
    // the two functions are adjacent, so a window sized to today's file would
    // start reading the wrong one as soon as either grows.
    const between = (from, to) => {
        const a = languages.indexOf(from);
        assert.ok(a !== -1, `no ${from}`);
        const b = to ? languages.indexOf(to) : languages.length;
        assert.ok(b > a, `${to} does not follow ${from}`);
        return languages.slice(a, b);
    };
    const immediate = between('export const immediateCodeMirrorLanguage',
        'export const loadDeferredCodeMirrorLanguage');
    assert.match(immediate, /case 'nqc':/);
    const deferred = between('export const loadDeferredCodeMirrorLanguage', null);
    assert.match(deferred, /case 'c':\s*\n\s*case 'nqc':/);
    // And the deferred half must not merely mention nqc somewhere: falling to
    // `default` would give a tab that highlights on first paint and goes
    // plain when the real grammar arrives.
    assert.doesNotMatch(deferred, /default:\s*\n\s*return[^\n]*nqc/);
});
