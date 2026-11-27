// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CODE_DOCUMENT_MAX_BYTES,
    createCodeDocument,
    readCodeDocument,
    validateCodeDocumentRecord,
    editCodeDocument,
    selectCodeDocumentLanguage,
    addCodeProjection,
    restoreCodeDocumentState,
    serializeCodeDocument,
    codeDocumentConversionRefusal
} from '../overlay/scratch-gui/src/lib/code-source-document.js';

const source = 'DEVICE PICO\nWHEN flag clicked:\n  say "authored"';
const ownedJs = '// owned-console-v1: registered async flag tasks, awaited input and finite waits.\n' +
    'codeRun.spawn(async codeRun => { console.log(await codeRun.input("Name?")); });';

test('legacy source migrates in the editor while archive validation keeps exact legacy data', () => {
    const legacy = {lang: 'pseudocode', code: source};
    assert.equal(validateCodeDocumentRecord(legacy), legacy);
    assert.equal(JSON.stringify(legacy), JSON.stringify({lang: 'pseudocode', code: source}));
    const migrated = readCodeDocument(legacy);
    assert.equal(migrated.lang, 'pseudocode');
    assert.equal(migrated.code, source);
    assert.equal(migrated.target, 'pico');
    assert.equal(migrated.revision, 1);
    assert.equal(migrated.selectedLang, 'pseudocode');
    assert.deepEqual(migrated.projections, {});
});

test('a selected generated view survives save/reopen without replacing its authored source', () => {
    const options = {driver: 'shim', async: true, events: false, execution: 'owned-console-v1'};
    const initial = createCodeDocument({lang: 'pseudocode', code: source, generationOptions: options});
    const derived = addCodeProjection(initial, {lang: 'javascript', code: ownedJs,
        sourceRevision: initial.revision, options, diagnostics: {warnings: [], exact: true}});
    const restored = restoreCodeDocumentState(JSON.parse(serializeCodeDocument(derived)));
    assert.equal(restored.lang, 'javascript');
    assert.equal(restored.buffers.javascript, ownedJs);
    assert.equal(restored.buffers.pseudocode, source);
    assert.equal(restored.codeDocument.lang, 'pseudocode');
    assert.equal(restored.codeDocument.code, source);
    assert.equal(restored.codeTarget, 'pico');
    assert.equal(restored.codeRuntime, 'javascript');
    assert.deepEqual(restored.codeDocument.generationOptions, options);
    assert.deepEqual(restored.codeDocument.projections.javascript.diagnostics, {warnings: [], exact: true});
    const back = restoreCodeDocumentState(selectCodeDocumentLanguage(restored.codeDocument, 'pseudocode'));
    assert.equal(back.lang, 'pseudocode');
    assert.equal(back.buffers.pseudocode, source, 'returning to authored text does not reverse-read async JS');
    assert.equal(initial.selectedLang, 'pseudocode', 'view creation did not mutate the preceding source');
});

test('editing Python keeps the selected device after the pseudocode projection disappears', () => {
    const initial = createCodeDocument({lang: 'pseudocode', code: source});
    const projected = addCodeProjection(initial, {lang: 'python', code: 'print("authored")', sourceRevision: 1});
    const edited = editCodeDocument(projected, {lang: 'python', code: 'print("visible edit")'});
    const reopened = restoreCodeDocumentState(JSON.parse(serializeCodeDocument(edited)));
    assert.equal(reopened.lang, 'python');
    assert.equal(reopened.buffers.python, 'print("visible edit")');
    assert.equal(reopened.buffers.pseudocode, '');
    assert.equal(reopened.codeTarget, 'pico', 'routing no longer depends on an emptied language buffer');
    assert.equal(reopened.codeRuntime, 'skulpt');
    assert.equal(edited.revision, 2);
    assert.deepEqual(edited.projections, {});
});

test('explicit no-device state is durable even if older source still contains a DEVICE line', () => {
    const document = createCodeDocument({lang: 'pseudocode', code: source, target: null});
    assert.equal(readCodeDocument(JSON.parse(serializeCodeDocument(document))).target, null);
    const edited = editCodeDocument(document, {lang: 'python', code: 'print(42)', target: null});
    assert.equal(edited.target, null);
    const changed = editCodeDocument(document, {lang: 'pseudocode', code: 'DEVICE NANO\n'});
    assert.equal(changed.target, 'nano');
    assert.equal(editCodeDocument(changed, {lang: 'pseudocode', code: 'say "no device"'}).target, null);
});

test('edit/revert rejects a delayed projection from the earlier identical source', () => {
    const original = createCodeDocument({lang: 'pseudocode', code: source});
    const changed = editCodeDocument(original, {lang: 'pseudocode', code: `${source}\n  say "new"`});
    const reverted = editCodeDocument(changed, {lang: 'pseudocode', code: source});
    assert.equal(reverted.code, original.code);
    assert.equal(reverted.revision, 3);
    assert.equal(addCodeProjection(reverted, {lang: 'python', code: 'stale', sourceRevision: 1}), reverted);
    assert.deepEqual(reverted.projections, {});
});

test('opening an empty target language preserves the source and selected target on reopen', () => {
    const original = createCodeDocument({lang: 'pseudocode', code: source});
    const selected = selectCodeDocumentLanguage(original, 'python');
    const reopened = restoreCodeDocumentState(JSON.parse(serializeCodeDocument(selected)));
    assert.equal(reopened.lang, 'python');
    assert.equal(reopened.buffers.python, '');
    assert.equal(reopened.buffers.pseudocode, source);
    assert.equal(reopened.codeDocument.code, source);
    assert.equal(reopened.codeTarget, 'pico');
});

test('replacement buffers contain only the new document, including a valid empty source', () => {
    const empty = createCodeDocument({lang: 'python', code: '', target: 'pico', runtime: 'skulpt'});
    const reopened = restoreCodeDocumentState(JSON.parse(serializeCodeDocument(empty)));
    assert.equal(reopened.lang, 'python');
    assert.equal(reopened.codeTarget, 'pico');
    assert.equal(reopened.codeRuntime, 'skulpt');
    assert.ok(Object.values(reopened.buffers).every(code => code === ''));
    assert.equal(reopened.buffers.asm, '');
    assert.equal(reopened.buffers.javascript, '');
});

test('owned-JS provenance survives editing away its generated marker and saving again', () => {
    const original = createCodeDocument({lang: 'pseudocode', code: 'WHEN flag clicked:\n  say "hi"'});
    const generated = addCodeProjection(original, {lang: 'javascript', code: ownedJs, sourceRevision: 1});
    assert.match(codeDocumentConversionRefusal(generated, 'javascript', ownedJs), /cannot be converted/);
    assert.equal(codeDocumentConversionRefusal(generated, 'pseudocode', original.code), null);
    const withoutMarker = 'codeRun.spawn(async task => console.log(await task.input("Changed?")));';
    const edited = editCodeDocument(generated, {lang: 'javascript', code: withoutMarker, execution: null});
    const reopened = readCodeDocument(JSON.parse(serializeCodeDocument(edited)));
    assert.equal(reopened.lang, 'javascript');
    assert.equal(reopened.execution, 'owned-console-v1');
    assert.equal(reopened.code, withoutMarker);
    assert.match(codeDocumentConversionRefusal(reopened, 'javascript', reopened.code), /cannot be converted/);
    assert.equal(codeDocumentConversionRefusal(createCodeDocument({lang: 'javascript', code: 'console.log(1)'}),
        'javascript', 'console.log(1)'), null);
});

test('opening owned generated JS directly recognizes its declared contract', () => {
    const legacy = {lang: 'javascript', code: ownedJs};
    assert.equal(readCodeDocument(legacy).execution, 'owned-console-v1');
    assert.match(codeDocumentConversionRefusal(null, 'javascript', ownedJs), /cannot be converted/);
    assert.equal(codeDocumentConversionRefusal(null, 'javascript', 'console.log("owned-console-v1")'), null);
});

test('saved view metadata is copied, not held by reference to conversion options or diagnostics', () => {
    const options = {driver: 'shim', nested: {mode: 'original'}};
    const report = {warnings: [{message: 'original'}]};
    const initial = createCodeDocument({code: 'say "a"', generationOptions: options});
    const projected = addCodeProjection(initial, {lang: 'python', code: 'print("a")',
        sourceRevision: 1, options, diagnostics: report});
    options.nested.mode = 'changed';
    report.warnings[0].message = 'changed';
    assert.equal(initial.generationOptions.nested.mode, 'original');
    assert.equal(projected.projections.python.options.nested.mode, 'original');
    assert.equal(projected.projections.python.diagnostics.warnings[0].message, 'original');
});

test('future versions and invalid projection identities refuse instead of becoming empty editors', () => {
    const original = createCodeDocument({code: source});
    assert.throws(() => readCodeDocument({...original, version: 2}), /unsupported version/);
    assert.throws(() => readCodeDocument({...original, revision: 0}), /source revision/);
    assert.throws(() => readCodeDocument({...original, selectedLang: 'unknown'}), /unsupported language/);
    assert.throws(() => readCodeDocument({...original, projections: {python: {
        code: 'print(1)', sourceRevision: 99, options: {}, diagnostics: null, execution: null
    }}}), /source revision/);
    assert.throws(() => readCodeDocument({...original, projections: {pseudocode: {
        code: 'replacement', sourceRevision: 1, options: {}, diagnostics: null, execution: null
    }}}), /cannot replace authored/);
    assert.equal(original.code, source);
});

test('projection growth keeps author and generated view visible while persistence refuses the whole envelope', () => {
    const sourceText = '€'.repeat(90000);
    const original = createCodeDocument({lang: 'pseudocode', code: sourceText});
    assert.ok(new TextEncoder().encode(serializeCodeDocument(original)).byteLength < CODE_DOCUMENT_MAX_BYTES);
    const generatedText = '£'.repeat(150000);
    const generated = addCodeProjection(original, {lang: 'python', code: generatedText, sourceRevision: 1});
    const visible = restoreCodeDocumentState(generated);
    assert.equal(visible.buffers.pseudocode, sourceText);
    assert.equal(visible.buffers.python, generatedText);
    assert.equal(visible.lang, 'python');
    assert.throws(() => serializeCodeDocument(generated), /exceeds.*bytes.*source was not saved/);
    assert.throws(() => validateCodeDocumentRecord(generated), /exceeds.*bytes/);
    assert.throws(() => readCodeDocument(generated), /exceeds.*bytes/);
    assert.equal(original.code, sourceText);
    assert.deepEqual(original.projections, {});
});

test('typing past the storage quota retains every source character and later edits remain usable', () => {
    const original = createCodeDocument({lang: 'python', code: 'print(1)', target: 'pico'});
    const oversizedText = `print("${'€'.repeat(180000)}")`;
    const edited = editCodeDocument(original, {lang: 'python', code: oversizedText});
    assert.equal(edited.code, oversizedText);
    assert.equal(edited.target, 'pico');
    assert.equal(restoreCodeDocumentState(edited).buffers.python, oversizedText);
    assert.throws(() => serializeCodeDocument(edited), /exceeds.*bytes.*source was not saved/);
    const selected = selectCodeDocumentLanguage(edited, 'javascript');
    assert.equal(restoreCodeDocumentState(selected).buffers.python, oversizedText);
    const larger = editCodeDocument(edited, {lang: 'python', code: `${oversizedText}\nprint(2)`});
    assert.equal(larger.code, `${oversizedText}\nprint(2)`);
    const repaired = editCodeDocument(larger, {lang: 'python', code: 'print("small again")'});
    assert.equal(readCodeDocument(JSON.parse(serializeCodeDocument(repaired))).code, 'print("small again")');
    assert.equal(createCodeDocument({lang: 'python', code: oversizedText}).code, oversizedText,
        'opening a large authored text file also keeps its content in memory');
});
