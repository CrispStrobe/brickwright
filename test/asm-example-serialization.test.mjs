// Exercise the actual UI method without importing JSX or executing a guest.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scopeAfter} from './helpers/js-scope.mjs';
import {codeDocumentEditorClass} from './helpers/code-document-editor.mjs';
import {createCodeDocument, addCodeProjection, selectCodeDocumentLanguage} from '../overlay/scratch-gui/src/lib/code-source-document.js';

const source = readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
const body = scopeAfter(source, 'async loadAsmExample (id) {');
const once = (text, anchor, replacement) => {
    assert.equal(text.split(anchor).length - 1, 1, `unique mutation anchor: ${anchor}`);
    return text.replace(anchor, replacement);
};
const setup = ({method = body, busy = false, current = 'owned source', confirm = async () => true, locale = 'en'} = {}) => {
    let prompts = 0;
    const Editor = codeDocumentEditorClass(source, `async load (id) ${method}`, {
        confirmAsync: async () => { prompts++; return confirm(); }, pickLocale: value => value
    });
    const component = Object.assign(new Editor(), {
        props: {locale}, state: {busy, lang: 'asm', buffers: {asm: current, pseudocode: 'prior projection'},
            asmMode: 'old', status: 'old', driverMode: 'shim', asyncMode: false,
            eventsMode: false, jsExecution: 'classic', basicProfile: 'bbc', basicLineNumbers: true},
        L: {asmExampleReplace: 'replace?', asmExampleLoaded: label => `loaded ${label}`},
        _asmExamples: () => [{id: 'pins', source: 'exact example', label: 'Pins', labelDe: 'Anschluesse'}],
        setState (patch) { Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch); }
    });
    let document = createCodeDocument({lang: 'asm', code: current, target: 'pico',
        generationOptions: component.codeGenerationOptions()});
    document = addCodeProjection(document, {lang: 'pseudocode', code: 'prior projection',
        sourceRevision: document.revision, options: component.genOpts('pseudocode')});
    Object.assign(component.state, component.codeDocumentState(selectCodeDocumentLanguage(document, 'asm')));
    return {component, prompts: () => prompts};
};
// Explicit examples now replace the authored program. An old Pseudo view must
// not be advertised as a translation of unrelated newly selected assembly.
const ownsExample = component => {
    assert.equal(component.state.buffers.asm, 'exact example', 'accepted request must reserve newer editor buffers');
    assert.equal(component.state.codeDocument.version, 1);
    assert.equal(component.state.codeDocument.lang, 'asm');
    assert.equal(component.state.codeDocument.code, 'exact example');
    assert.equal(component.state.codeDocument.selectedLang, 'asm');
    assert.equal(component.state.codeDocument.target, 'pico', 'accepted example must preserve the selected target');
    assert.deepEqual(component.state.codeDocument.projections, {});
    assert.equal(component.state.buffers.pseudocode, '', 'old program projection must be cleared');
};
const busyEntry = async method => {
    const {component, prompts} = setup({method, busy: true});
    const buffers = component.state.buffers;
    await component.load('pins');
    assert.equal(prompts(), 1, 'accepted replacement still asks confirmation');
    assert.notEqual(component.state.buffers, buffers, 'accepted request must replace the captured buffer object');
    ownsExample(component);
    assert.equal(component.state.busy, true);
    assert.equal(component.state.status, 'loaded Pins');
};
const confirmationRace = async method => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const {component, prompts} = setup({method, confirm: () => pending});
    const loading = component.load('pins');
    assert.equal(prompts(), 1);
    component.state.busy = true;
    release(true);
    await loading;
    assert.equal(component.state.buffers.asm, 'exact example', 'confirmed request must own the newer editor buffer');
    ownsExample(component);
    assert.equal(component.state.busy, true);
    assert.equal(component.state.status, 'loaded Pins');
};

test('accepted method request reserves newer editor source during compilation', () => busyEntry(body));
test('compilation starting during confirmation preserves the accepted newer editor request', () => confirmationRace(body));
test('idle ASM example loading replaces the authored program and preserves target and localized status', async () => {
    for (const locale of ['en', 'de']) {
        for (const current of ['', 'owned source']) {
            const {component, prompts} = setup({current, locale});
            await component.load('pins');
            assert.equal(prompts(), current ? 1 : 0);
            ownsExample(component);
            assert.equal(component.state.asmMode, 'source');
            assert.equal(component.state.status, `loaded ${locale === 'de' ? 'Anschluesse' : 'Pins'}`);
        }
    }
});
test('declined ASM replacement and unknown examples preserve all state', async () => {
    for (const id of ['pins', '', 'unknown']) {
        const {component, prompts} = setup({confirm: async () => false});
        const before = structuredClone(component.state);
        await component.load(id);
        assert.deepEqual(component.state, before);
        assert.equal(prompts(), id === 'pins' ? 1 : 0);
    }
});
test('ASM examples become available again after compilation finishes', async () => {
    const {component} = setup({busy: true, current: ''});
    await component.load('pins');
    assert.equal(component.state.buffers.asm, 'exact example');
    component.state.busy = false;
    await component.load('pins');
    assert.equal(component.state.buffers.asm, 'exact example');
});
test('dropping accepted buffer publication fails the ownership control', async () => {
    await assert.rejects(() => busyEntry(once(body,
        "this.authoredCodeState('asm', source, this.currentDevice())",
        "this.authoredCodeState('asm', this.state.buffers.asm, this.currentDevice())")),
        /accepted request must reserve/);
});
test('in-place buffer mutation fails captured editor ownership', async () => {
    await assert.rejects(() => busyEntry(once(body,
        "this.authoredCodeState('asm', source, this.currentDevice())),",
        "this.authoredCodeState('asm', source, this.currentDevice())),\n" +
        "buffers: Object.assign(this.state.buffers, this.authoredCodeState('asm', source, this.currentDevice()).buffers),")),
        /accepted request must replace the captured buffer object/);
});
test('losing the selected target or retaining an old program projection fails the ownership control', async () => {
    await assert.rejects(() => busyEntry(once(body,
        "this.authoredCodeState('asm', source, this.currentDevice())",
        "this.authoredCodeState('asm', source)")), /accepted example must preserve the selected target/);
    await assert.rejects(() => busyEntry(once(body,
        "this.authoredCodeState('asm', source, this.currentDevice())),",
        "this.authoredCodeState('asm', source, this.currentDevice())),\n" +
        "buffers: {...this.state.buffers, asm: source},")), /old program projection must be cleared/);
});
test('the ASM picker busy expression disables pending work, with omission negative', () => {
    const picker = source.slice(source.indexOf("data-testid={menu ? 'bw-asm-examples-menu' : 'bw-asm-examples'}"));
    // The <select> opening tag ends at its value attribute.
    const opening = picker.slice(0, picker.indexOf('value="">') + 'value="">'.length);
    const disabled = text => {
        const expression = text.match(/disabled=\{([^}]+)\}/);
        assert.ok(expression, 'ASM picker must have a disabled expression');
        return new Function(`return (${expression[1]});`);
    };
    const evaluate = disabled(opening);
    assert.equal(evaluate.call({state: {busy: true}}), true);
    assert.equal(evaluate.call({state: {busy: false}}), false);
    assert.throws(() => disabled(once(opening, 'disabled={this.state.busy}', '')), /must have a disabled expression/);
});
