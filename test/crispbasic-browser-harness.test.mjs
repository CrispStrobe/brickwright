// SPDX-License-Identifier: BSD-3-Clause
// Qualify the generated browser shell itself: the shared Node editor fixture
// adds document methods and can therefore conceal a missing browser dependency.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as documentApi from '../overlay/scratch-gui/src/lib/code-source-document.js';
import * as profileApi from '../overlay/scratch-gui/src/lib/bw-matrix/code-languages.js';
import {createCrispBasicEditorHarness} from '../scripts/lib/crispbasic-editor-harness.mjs';

const editorSource = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx',
    import.meta.url), 'utf8');
const generated = createCrispBasicEditorHarness(editorSource);

function shell (source = generated) {
    // Rendering and actual workers remain covered by verify-crispbasic-browser.
    // Only React's synchronous state boundary is supplied here; the constructor,
    // editing methods, document model and profile lookup are production code.
    const bindings = {React: {Component: class {
        constructor (props) { this.props = props; }
        setState (update) {
            const patch = typeof update === 'function' ? update(this.state) : update;
            if (patch) Object.assign(this.state, patch);
        }
    }}};
    const namespaces = new Map([
        ['/test-gui/lib/code-source-document.js', documentApi],
        ['/test-gui/lib/bw-matrix/code-languages.js', profileApi]
    ]);
    const render = source.indexOf('    render() {');
    assert.ok(render > 0, 'generated shell must retain its actual class and constructor');
    const constructor = source.slice(0, render).replace(
        /^import\s+([\s\S]*?)\s+from\s+(['"])([^'"]+)\2;\s*/gm,
        (_declaration, names, _quote, specifier) => {
            const namespace = namespaces.get(specifier);
            if (namespace) {
                assert.match(names.trim(), /^\{[\s\S]*\}$/);
                for (const name of names.trim().slice(1, -1).split(',').map(value => value.trim()).filter(Boolean)) {
                    assert.ok(Object.hasOwn(namespace, name), `unknown production export ${name}`);
                    bindings[name] = namespace[name];
                }
            } else {
                assert.ok(['react', 'react-dom/client', '/adapter.js', '/terminal.js'].includes(specifier),
                    `unhandled browser module ${specifier}`);
            }
            return '';
        }).replace('export default class', 'class');
    // Bind only names the generated browser module actually imports. Supplying
    // every document export unconditionally would hide the original regression.
    const Editor = new Function(...Object.keys(bindings),
        constructor + '\n}\nreturn CrispBasicEditorHarness;')(...Object.values(bindings));
    return new Editor({source: 'PRINT "before"\n'});
}

test('the browser shell edits BASIC through the actual authored document', () => {
    const editor = shell();
    editor.setActiveCode('PRINT "after"\n');
    assert.equal(editor.activeCode(), 'PRINT "after"\n');
    assert.equal(editor.state.codeDocument.lang, 'basic');
    assert.equal(editor.state.codeDocument.code, editor.activeCode());
    assert.equal(editor.state.codeDocument.revision, 2);
    editor.setActiveCode('PRINT "again"\n');
    assert.equal(editor.state.codeDocument.revision, 3);
    assert.equal(editor.state.codeDocument.code, editor.activeCode());
});

test('browser edits retain the target and independent drafts while invalidating stale projections', () => {
    const editor = shell();
    const original = documentApi.createCodeDocument({
        lang: 'basic', code: editor.activeCode(), target: 'arduino-nano'
    });
    editor.state.codeDocument = documentApi.selectCodeDocumentLanguage(
        documentApi.addCodeProjection(original, {
            lang: 'python', code: 'print("stale")', sourceRevision: original.revision
        }), 'basic');
    editor.state.buffers.python = 'print("stale")';
    editor.state.buffers.asm = 'NOP';
    editor.state.buffers.nqc = 'task main() {}';
    editor.setActiveCode('PRINT "new revision"\n');
    assert.equal(editor.state.codeDocument.target, 'arduino-nano');
    assert.deepEqual(editor.state.codeDocument.projections, {});
    assert.equal(editor.state.buffers.python, '');
    assert.equal(editor.state.buffers.asm, 'NOP');
    assert.equal(editor.state.buffers.nqc, 'task main() {}');
});

test('the browser-shell regression control detects the missing document import', () => {
    const withoutImport = generated.replace(
        /import \{createCodeDocument,[\s\S]*?from '\/test-gui\/lib\/code-source-document\.js';\n/, '');
    assert.notEqual(withoutImport, generated, 'mutation must remove the generated import');
    const editor = shell(withoutImport);
    assert.throws(() => editor.setActiveCode('PRINT "unreachable"\n'), /editCodeDocument is not defined/);
    assert.equal(editor.activeCode(), 'PRINT "before"\n');
});

test('the browser-shell regression control detects a missing production adapter', () => {
    const withoutSnapshot = generated.replace(
        /    codeDocumentSnapshot \(state = this\.state\) \{[\s\S]*?\n    \}\n/, '');
    assert.notEqual(withoutSnapshot, generated, 'mutation must remove the actual snapshot method');
    const editor = shell(withoutSnapshot);
    assert.throws(() => editor.setActiveCode('PRINT "unreachable"\n'), /codeDocumentSnapshot is not a function/);
    assert.equal(editor.activeCode(), 'PRINT "before"\n');
});
