// SPDX-License-Identifier: BSD-3-Clause
// Small project boundary. The full CAD validator is loaded with the CAD SDK.
export const CAD_PROJECT_PATH = 'brickwright/cad.json';
export const CAD_STORAGE_KEY = 'bw-cad-document';
export const CAD_PROJECT_LIMIT = 16 * 1024 * 1024;
let liveText;
let projectGeneration = 0;
export const getCadProjectGeneration = () => projectGeneration;
export const setCadProjectGeneration = value => { projectGeneration = value; };

/** Keep the current document available to SB3 saves even if autosave storage is full. */
export const setLiveCadText = text => { liveText = text; if (text === undefined) projectGeneration++; };
export const getLiveCadText = () => liveText;
export const readCadText = () => {
    if (liveText !== undefined) return liveText;
    try { return globalThis.localStorage?.getItem(CAD_STORAGE_KEY) || null; }
    catch { return null; }
};

/** Preserve future CAD versions without downgrading them in an editor-off build. */
export const inspectCadText = text => {
    if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > CAD_PROJECT_LIMIT) {
        throw new Error('CAD project exceeds 16 MiB');
    }
    const doc = JSON.parse(text);
    if (!doc || doc.format !== 'brickwright-cad' || !Number.isInteger(doc.version) || doc.version < 1 ||
        doc.units !== 'mm' || typeof doc.id !== 'string' || typeof doc.title !== 'string' ||
        !doc.nodes || typeof doc.nodes !== 'object' || Array.isArray(doc.nodes) || !Array.isArray(doc.roots)) {
        throw new Error('Invalid CAD project');
    }
    return text;
};
