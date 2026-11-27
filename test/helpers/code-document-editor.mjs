// SPDX-License-Identifier: BSD-3-Clause
// Source-method fixtures use the production document implementation and the
// importer's actual adapter methods. Only their external VM/transport edges
// belong to the individual fixture; no replacement document model lives here.
import * as documentApi from '../../overlay/scratch-gui/src/lib/code-source-document.js';
import {balancedFrom} from './js-scope.mjs';

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
    'genOpts (lang = this.state.lang) {'
];

export const codeDocumentLabels = Object.fromEntries(documentApi.CODE_DOCUMENT_LANGUAGES.map(lang => [lang, lang]));

export const codeEditorMethod = (source, signature) => {
    const at = source.indexOf(signature);
    if (at < 0) throw new Error(`Actual Code method is missing: ${signature}`);
    const body = at + signature.lastIndexOf('{');
    return source.slice(at, body) + balancedFrom(source, body, '{', '}', signature);
};

export const codeDocumentEditorClass = (source, methods, bindings = {}) => {
    const environment = {...documentApi, LANG_LABEL: codeDocumentLabels, ...bindings};
    const adapters = adapterSignatures.map(signature => codeEditorMethod(source, signature)).join('\n');
    // A Function-compiled fixture has no importer module location. Resolve only
    // relative dynamic-import specifiers to the actual production modules;
    // the methods, readers and asset helpers themselves are left unchanged.
    const body = `${adapters}\n${methods}`.replace(
        /\bimport\((\s*(?:\/\*[\s\S]*?\*\/\s*)?)(['"])(\.\.?\/[^'"]+)\2(\s*)\)/g,
        (_match, comment, _quote, path, after) => `import(${comment}${JSON.stringify(new URL(path, importerUrl).href)}${after})`
    );
    return new Function(...Object.keys(environment), `return class {${body}}`)(...Object.values(environment));
};
