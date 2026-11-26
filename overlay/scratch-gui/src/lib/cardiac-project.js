// SPDX-License-Identifier: BSD-3-Clause
// A draft is allowed to be unfinished. Its last loaded image is independent
// of that draft; neither live memory nor a running clock is a portable project.
export const CARDIAC_WORKSPACE_KEY = 'bw-cardiac-workspace';
export const CARDIAC_WORKSPACE_FORMAT = 'brickwright.cardiac-workspace';
export const CARDIAC_PROFILE = 'brickwright-cardiac-v1';
export const CARDIAC_MAX_SOURCE = 128 * 1024;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const address = value => Number.isInteger(value) && value >= 0 && value < 100;
const word = value => Number.isInteger(value) && value >= -999 && value <= 999;

export function validateCardiacWorkspace (input) {
    const errors = [];
    const reject = (path, message) => errors.push({path, message});
    if (!plain(input)) return {ok: false, project: null, errors: [{path: '', message: 'A CARDIAC workspace must be an object.'}]};
    const allowed = ['format', 'version', 'profile', 'source', 'inputDeck', 'inputMode', 'loadedProgram', 'active'];
    for (const key of Object.keys(input)) if (!allowed.includes(key)) reject(key, 'Unknown workspace field.');
    if (input.format !== CARDIAC_WORKSPACE_FORMAT) reject('format', `Expected ${CARDIAC_WORKSPACE_FORMAT}.`);
    if (input.version !== 1) reject('version', 'Unsupported CARDIAC workspace version.');
    if (input.profile !== CARDIAC_PROFILE) reject('profile', 'Unsupported CARDIAC execution profile.');
    if (typeof input.source !== 'string' || input.source.length > CARDIAC_MAX_SOURCE) reject('source', 'Source must be text of at most 128 KB.');
    if (typeof input.inputDeck !== 'string' || input.inputDeck.length > 32768) reject('inputDeck', 'Input deck must be text of at most 32 KB.');
    if (!['manual', 'circuit'].includes(input.inputMode)) reject('inputMode', 'Choose manual cards or the circuit adapter.');
    if (input.active !== undefined && typeof input.active !== 'boolean') reject('active', 'Active mode must be a boolean.');
    let loadedProgram = null;
    if (input.loadedProgram !== null) {
        const program = input.loadedProgram;
        if (!plain(program) || !Array.isArray(program.words) || program.words.length > 100 || !address(program.entry) ||
            Object.keys(program).some(key => !['words', 'entry'].includes(key))) {
            reject('loadedProgram', 'A program needs an entry from 00 to 99 and at most 100 addressed words.');
        } else {
            const seen = new Set();
            const words = [];
            Array.from(program.words).forEach((cell, index) => {
                if (!plain(cell) || Object.keys(cell).some(key => !['address', 'value'].includes(key)) ||
                    !address(cell.address) || !word(cell.value) || seen.has(cell.address) ||
                    (cell.address === 0 && cell.value !== 1)) {
                    reject(`loadedProgram.words[${index}]`, 'Use a unique address and a signed three-digit word; cell 00 is fixed at 001.');
                } else {
                    seen.add(cell.address);
                    words.push({address: cell.address, value: Object.is(cell.value, -0) ? 0 : cell.value});
                }
            });
            loadedProgram = {entry: program.entry, words: words.sort((a, b) => a.address - b.address)};
        }
    }
    if (errors.length) return {ok: false, project: null, errors};
    return {ok: true, errors: [], project: {
        format: CARDIAC_WORKSPACE_FORMAT, version: 1, profile: CARDIAC_PROFILE,
        source: input.source, inputDeck: input.inputDeck, inputMode: input.inputMode, loadedProgram, active: input.active === true
    }};
}

export function createCardiacWorkspace (source = '', inputDeck = '') {
    return {format: CARDIAC_WORKSPACE_FORMAT, version: 1, profile: CARDIAC_PROFILE,
        source, inputDeck, inputMode: 'manual', loadedProgram: null, active: true};
}

export function serializeCardiacWorkspace (workspace) {
    const result = validateCardiacWorkspace(workspace);
    if (!result.ok) throw new Error(result.errors.map(error => `${error.path}: ${error.message}`).join('\n'));
    return `${JSON.stringify(result.project, null, 2)}\n`;
}

export function deserializeCardiacWorkspace (text) {
    if (typeof text !== 'string' || text.length > 256 * 1024) throw new Error('A CARDIAC workspace must be at most 256 KB.');
    const result = validateCardiacWorkspace(JSON.parse(text));
    if (!result.ok) throw new Error(result.errors.map(error => `${error.path}: ${error.message}`).join('\n'));
    return result.project;
}

/** An inactive draft must never select its machine when another project opens. */
export function readCardiacWorkspaceActive (storage) {
    try {
        const result = validateCardiacWorkspace(JSON.parse(storage.getItem(CARDIAC_WORKSPACE_KEY)));
        return result.ok && result.project.active;
    } catch (error) { return false; }
}

export function setCardiacWorkspaceActive (storage, active) {
    try {
        const result = validateCardiacWorkspace(JSON.parse(storage.getItem(CARDIAC_WORKSPACE_KEY)));
        if (result.ok) storage.setItem(CARDIAC_WORKSPACE_KEY, JSON.stringify({...result.project, active: !!active}));
    } catch (error) { /* The mounted host reports unavailable draft storage. */ }
}
