// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors

// One authored source, with disposable generated views. This record travels in
// the existing bw-code-autosave / project-bundle code section. lang/code remain
// the authored text so older readers recover that source, not a derived view.
export const CODE_DOCUMENT_VERSION = 1;
export const CODE_DOCUMENT_MAX_BYTES = 512 * 1024;
export const OWNED_CONSOLE_EXECUTION = 'owned-console-v1';
export const CODE_DOCUMENT_LANGUAGES = Object.freeze([
    'pseudocode', 'python', 'javascript', 'c', 'basic', 'asm', 'micropython',
    'nqc', 'fe', 'tcl', 'forth', 'cowgol'
]);

const languages = new Set(CODE_DOCUMENT_LANGUAGES);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(`Code document: ${message}`); };
const requireLanguage = lang => {
    if (!languages.has(lang)) fail(`unsupported language ${String(lang)}.`);
};
const defaultRuntime = lang => lang === 'javascript' ? 'javascript' :
    (lang === 'python' || lang === 'micropython' ? 'skulpt' : null);
const ownedMarker = source => /^\s*\/\/ owned-console-v1:/m.test(source);
const requireContract = (execution, lang) => {
    if (execution !== null && (execution !== OWNED_CONSOLE_EXECUTION || lang !== 'javascript')) {
        fail('unsupported source execution contract.');
    }
};
const requireJson = (value, depth = 0) => {
    if (depth > 32) fail('metadata is nested too deeply.');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (Array.isArray(value)) {
        value.forEach(item => requireJson(item, depth + 1));
        return;
    }
    if (isRecord(value) && (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null)) {
        Object.values(value).forEach(item => requireJson(item, depth + 1));
        return;
    }
    fail('metadata must contain JSON values.');
};
const copy = value => JSON.parse(JSON.stringify(value));
const requireOptions = options => {
    if (!isRecord(options)) fail('generation options must be an object.');
    requireJson(options);
};
const requireRuntime = runtime => {
    if (runtime !== null && (typeof runtime !== 'string' || !runtime || runtime.length > 128)) {
        fail('runtime must be a short identifier or null.');
    }
};
const normalizeTarget = target => {
    if (target === null) return null;
    if (typeof target !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,127}$/i.test(target)) {
        fail('target must be a device identifier or null.');
    }
    return target.toLowerCase();
};
const checkedJson = record => {
    let text;
    try { text = JSON.stringify(record); } catch (error) { fail('cannot serialize this record.'); }
    if (typeof text !== 'string') fail('record must be an object.');
    if (new TextEncoder().encode(text).byteLength > CODE_DOCUMENT_MAX_BYTES) {
        fail(`exceeds ${CODE_DOCUMENT_MAX_BYTES} bytes; source was not saved.`);
    }
    return text;
};

export const codeTargetFromSource = (lang, source) => {
    if (lang !== 'pseudocode' || typeof source !== 'string') return null;
    const match = /^DEVICE\s+([\w-]+)/im.exec(source);
    return match ? match[1].toLowerCase() : null;
};

// Editing must retain the current text even when it outgrows the persistence
// budget. Only a read/save boundary applies that budget; schema errors still
// refuse before an in-memory document changes.
const validateCodeDocumentShape = record => {
    if (!isRecord(record) || typeof record.lang !== 'string' || typeof record.code !== 'string') {
        fail('must contain string lang and code.');
    }
    // Legacy bundles intentionally retain their exact old shape. Migration is
    // an editor operation, not a project-archive decoding side effect.
    if (!own(record, 'version')) return record;
    if (record.version !== CODE_DOCUMENT_VERSION) {
        fail(`unsupported version ${String(record.version)}; the current project is preserved.`);
    }
    requireLanguage(record.lang);
    requireLanguage(record.selectedLang);
    if (!Number.isSafeInteger(record.revision) || record.revision < 1) fail('invalid source revision.');
    if (normalizeTarget(record.target) !== record.target) fail('target must be normalized.');
    requireRuntime(record.runtime);
    requireOptions(record.generationOptions);
    requireContract(record.execution, record.lang);
    if (!isRecord(record.projections)) fail('projections must be an object.');
    for (const [lang, projection] of Object.entries(record.projections)) {
        requireLanguage(lang);
        if (lang === record.lang) fail('a projection cannot replace authored source.');
        if (!isRecord(projection) || typeof projection.code !== 'string' ||
            projection.sourceRevision !== record.revision) fail('projection does not belong to this source revision.');
        requireOptions(projection.options);
        requireJson(projection.diagnostics);
        requireContract(projection.execution, lang);
    }
    return record;
};

/** Validate a persisted record without rewriting legacy bytes or metadata. */
export const validateCodeDocumentRecord = record => {
    validateCodeDocumentShape(record);
    checkedJson(record);
    return record;
};

export const createCodeDocument = ({lang = 'pseudocode', code = '', target,
    runtime = defaultRuntime(lang), generationOptions = {}, execution = null} = {}) => {
    requireLanguage(lang);
    if (typeof code !== 'string') fail('source must be text.');
    requireOptions(generationOptions);
    const document = {
        version: CODE_DOCUMENT_VERSION,
        lang,
        code,
        revision: 1,
        selectedLang: lang,
        target: target === undefined ? codeTargetFromSource(lang, code) : normalizeTarget(target),
        runtime,
        generationOptions: copy(generationOptions),
        execution: lang === 'javascript' && ownedMarker(code) ? OWNED_CONSOLE_EXECUTION : execution,
        projections: {}
    };
    return validateCodeDocumentShape(document);
};

/** Accept a parsed local/bundle record, migrating the old {lang, code} shape. */
export const readCodeDocument = record => {
    validateCodeDocumentRecord(record);
    return own(record, 'version') ? copy(record) : createCodeDocument({lang: record.lang, code: record.code});
};

const sourceExecution = (document, lang, code) => {
    if (lang !== 'javascript') return null;
    if (ownedMarker(code)) return OWNED_CONSOLE_EXECUTION;
    return document.lang === lang ? document.execution : document.projections[lang]?.execution || null;
};

/** An edit is a new authored revision, even when edit/revert restores old text. */
export const editCodeDocument = (document, {lang, code, target, runtime, execution,
    generationOptions = document.generationOptions}) => {
    validateCodeDocumentShape(document);
    requireLanguage(lang);
    if (typeof code !== 'string') fail('source must be text.');
    requireOptions(generationOptions);
    if (document.revision === Number.MAX_SAFE_INTEGER) fail('source revision limit reached.');
    const inheritedExecution = sourceExecution(document, lang, code);
    return validateCodeDocumentShape({
        ...document,
        lang,
        code,
        revision: document.revision + 1,
        selectedLang: lang,
        target: target !== undefined ? normalizeTarget(target) :
            (lang === 'pseudocode' ? codeTargetFromSource(lang, code) : document.target),
        runtime: runtime !== undefined ? runtime :
            (lang === document.selectedLang ? document.runtime : defaultRuntime(lang)),
        generationOptions: copy(generationOptions),
        // An edit cannot erase the contract merely by deleting its header.
        // Opening a different source creates a new document instead.
        execution: inheritedExecution || execution || null,
        projections: {}
    });
};

export const selectCodeDocumentLanguage = (document, lang, {runtime} = {}) => {
    validateCodeDocumentShape(document);
    requireLanguage(lang);
    return validateCodeDocumentShape({
        ...document,
        selectedLang: lang,
        runtime: runtime !== undefined ? runtime :
            (lang === document.selectedLang ? document.runtime : defaultRuntime(lang))
    });
};

/** A stale conversion is a no-op; it must never become a new authored revision. */
export const addCodeProjection = (document, {lang, code, sourceRevision,
    options = document.generationOptions, diagnostics = null, execution = null, runtime}) => {
    validateCodeDocumentShape(document);
    if (sourceRevision !== document.revision) return document;
    requireLanguage(lang);
    if (lang === document.lang) fail('cannot generate over authored source.');
    requireOptions(options);
    requireJson(diagnostics);
    return validateCodeDocumentShape({
        ...document,
        selectedLang: lang,
        runtime: runtime !== undefined ? runtime : defaultRuntime(lang),
        projections: {...document.projections, [lang]: {
            code,
            sourceRevision,
            options: copy(options),
            diagnostics: copy(diagnostics),
            execution: lang === 'javascript' && ownedMarker(code) ? OWNED_CONSOLE_EXECUTION : execution
        }}
    });
};

/**
 * Build fresh buffers from an in-memory document or an already admitted saved
 * record. Call readCodeDocument at external read boundaries before restoring.
 */
export const restoreCodeDocumentState = (document, languageList = CODE_DOCUMENT_LANGUAGES) => {
    validateCodeDocumentShape(document);
    const restored = own(document, 'version') ? copy(document) :
        createCodeDocument({lang: document.lang, code: document.code});
    const buffers = Object.fromEntries(languageList.map(lang => [lang, '']));
    for (const [lang, projection] of Object.entries(restored.projections)) buffers[lang] = projection.code;
    buffers[restored.lang] = restored.code;
    return {lang: restored.selectedLang, buffers, codeDocument: restored,
        codeTarget: restored.target, codeRuntime: restored.runtime};
};

export const serializeCodeDocument = document => {
    validateCodeDocumentRecord(document);
    return checkedJson(document);
};

/** Owned async JS is executable source; the existing reverse reader cannot admit it. */
export const codeDocumentConversionRefusal = (document, fromLang, text) => {
    if (fromLang !== 'javascript') return null;
    const execution = document ? sourceExecution(document, fromLang, text) :
        (ownedMarker(text) ? OWNED_CONSOLE_EXECUTION : null);
    return execution === OWNED_CONSOLE_EXECUTION ?
        'Owned asynchronous JavaScript cannot be converted back to blocks or another language. ' +
        'Return to the preserved source tab, or keep editing and running JavaScript.' : null;
};
