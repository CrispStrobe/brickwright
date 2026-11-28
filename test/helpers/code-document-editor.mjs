// SPDX-License-Identifier: BSD-3-Clause
// Source-method fixtures use the production document implementation and the
// importer's actual adapter methods. Only their external VM/transport edges
// belong to the individual fixture; no replacement document model lives here.
import * as documentApi from '../../overlay/scratch-gui/src/lib/code-source-document.js';
import {balancedFrom} from './js-scope.mjs';
import {basicProfileFor, basicProfilesFor, hiddenCodeDrafts, standaloneBasicDrafts}
    from '../../overlay/scratch-gui/src/lib/bw-matrix/code-languages.js';
import {remoteMachineImagesAllowed} from '../../overlay/scratch-gui/src/lib/distribution-policy.js';
import {blinkFamily, blinkSource, blinkStarter} from '../../overlay/scratch-gui/src/lib/bw-asm/blink-machines.js';

// Machine-mode hooks the importer calls around retargeting (CP1, CARDIAC,
// maximized chrome). Fixtures that observe them define their own; otherwise
// they are neutral here, as they are for an editor with no machine attached.
const machineHookDefaults = {
    'leaveCp1': 'leaveCp1 () {}',
    'leaveCardiac': 'leaveCardiac () {}',
    'detachCardiac': 'detachCardiac () {}',
    'setMaximizedChrome': 'setMaximizedChrome () {}',
    // No machine filter attached: every Code language stays available.
    'allowsCodeLanguage': 'allowsCodeLanguage () { return true; }',
    'closePicoBasicHardware': 'closePicoBasicHardware () {}',
    // No owned Code console attached.
    'disposeCodeRun': 'disposeCodeRun () {}',
    // No CrispBASIC session attached.
    'disposeCrispBasic': 'async disposeCrispBasic () {}'
};

const importerUrl = new URL('../../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx',
    import.meta.url);
const adapterSignatures = [
    'codeRuntimeFor (lang, target) {',
    'currentDevice () {',
    'codeGenerationOptions (state = this.state) {',
    'codeDocumentSnapshot (state = this.state) {',
    'codeDocumentState (document) {',
    'authoredCodeState (lang, code, target = undefined) {',
    'retargetCodeState (source, selectedLang = this.state.lang) {',
    'codeProjectionState (state, document, buffers, lang, code) {',
    'codeDocumentWithBuffers (buffers, sourceLang, selectedLang = this.state.lang, diagnostics = null,\n        authoredDocument = null) {',
    'genOpts (lang = this.state.lang) {',
    // Drafts that live beside the authored document (retro workbench lane):
    // independent ASM/NQC/standalone BASIC buffers and machine-hidden drafts.
    'withRetainedDrafts (next, state, lang = state.lang, target = this.codeDevice()) {',
    'restoreStandaloneBasic (state, document) {',
    'restoreCodeBuffer (state, saved) {',
    'codeDevice () {',
    'selectedBasicProfile () {',
    'standaloneBasicProfile (lang = this.state.lang) {',
    // BASIC generation options and the generation-error banner (CrispBASIC lane).
    'basicGenerationOptions (state = this.state) {',
    'basicGenerationPlaceholder (text) {'
];

export const codeDocumentLabels = Object.fromEntries(documentApi.CODE_DOCUMENT_LANGUAGES.map(lang => [lang, lang]));

export const codeEditorMethod = (source, signature) => {
    const at = source.indexOf(signature);
    if (at < 0) throw new Error(`Actual Code method is missing: ${signature}`);
    const body = at + signature.lastIndexOf('{');
    return source.slice(at, body) + balancedFrom(source, body, '{', '}', signature);
};

export const codeDocumentEditorClass = (source, methods, bindings = {}) => {
    // The importer's own two-way language set, read from the source under test.
    const twoWay = source.match(/^const TWO_WAY = (new Set\(\[[^\]]*\]\));$/m);
    // The importer's own conversion-warning classifier, read from the source.
    const classifier = source.indexOf('const classifyConversionWarnings = warnings => {');
    const classifyConversionWarnings = classifier < 0 ? undefined : new Function(`return ${
        source.slice(source.indexOf('warnings =>', classifier), source.indexOf('\n};\n', classifier) + 2)};`)();
    const environment = {...documentApi, LANG_LABEL: codeDocumentLabels, basicProfileFor, basicProfilesFor,
        ...(classifyConversionWarnings ? {classifyConversionWarnings} : {}),
        hiddenCodeDrafts, standaloneBasicDrafts, remoteMachineImagesAllowed, blinkFamily, blinkSource, blinkStarter,
        TWO_WAY: twoWay ? new Function(`return ${twoWay[1]};`)() : new Set(), ...bindings};
    const adapters = adapterSignatures.map(signature => codeEditorMethod(source, signature)).join('\n');
    // A Function-compiled fixture has no importer module location. Resolve only
    // relative dynamic-import specifiers to the actual production modules;
    // the methods, readers and asset helpers themselves are left unchanged.
    const hooks = Object.entries(machineHookDefaults)
        .filter(([name]) => !new RegExp(`(^|\\n)\\s*${name}\\s*\\(`).test(methods)).map(([, method]) => method).join('\n');
    const body = `${adapters}\n${hooks}\n${methods}`.replace(
        /\bimport\((\s*(?:\/\*[\s\S]*?\*\/\s*)?)(['"])(\.\.?\/[^'"]+)\2(\s*)\)/g,
        (_match, comment, _quote, path, after) => `import(${comment}${JSON.stringify(new URL(path, importerUrl).href)}${after})`
    );
    return new Function(...Object.keys(environment), `return class {${body}}`)(...Object.values(environment));
};
