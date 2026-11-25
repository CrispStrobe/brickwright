import {parseCp1Program} from './cp1-program.js';

export const CP1_PROJECT_FORMAT = 'brickwright.cp1-project';
export const CP1_PROJECT_VERSION = 1;
export const CP1_WORKSPACE_FORMAT = 'brickwright.cp1-workspace';
export const CP1_DEFAULT_CLOCK_HZ = 6000000;
const MAX_SOURCE = 256 * 1024;
const MAX_JSON = 512 * 1024;
const byte = value => Number.isInteger(value) && value >= 0 && value <= 255;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const keysAllowed = (value, keys) => Object.keys(value).every(key => keys.includes(key));

/**
 * A portable CP1 document contains configuration and teaching-program cells.
 * It references a ROM by digest; the actual ROM stays in the user's local
 * import/session. Held keys and CPU/RAM resume snapshots belong to a separate
 * debugger save state, never this normal project format.
 */
export function validateCp1Project (input) {
    const errors = [];
    const reject = (path, message) => errors.push({path, message});
    if (!plain(input)) return {ok: false, project: null, errors: [{path: '', message: 'A CP1 project must be an object.'}]};
    if (!keysAllowed(input, ['format', 'version', 'target', 'configuration', 'rom', 'source', 'words'])) {
        reject('', 'Unknown project fields are not accepted; use a debugger snapshot for live state.');
    }
    if (input.format !== CP1_PROJECT_FORMAT) reject('format', `Expected ${CP1_PROJECT_FORMAT}.`);
    if (input.version !== CP1_PROJECT_VERSION) reject('version', `Unsupported CP1 project version ${String(input.version)}.`);
    if (input.target !== 'kosmos-cp1') reject('target', 'The target must be kosmos-cp1.');
    let configuration = null;
    if (!plain(input.configuration)) reject('configuration', 'Configuration must be an object.');
    else {
        if (!keysAllowed(input.configuration, ['expansion', 'clockHz'])) reject('configuration', 'Unknown CP1 configuration field.');
        if (typeof input.configuration.expansion !== 'boolean') reject('configuration.expansion', 'CP3 expansion must be a boolean.');
        if (!Number.isInteger(input.configuration.clockHz) || input.configuration.clockHz < 100000 || input.configuration.clockHz > 12000000) {
            reject('configuration.clockHz', 'Clock must be an integer from 100000 to 12000000 Hz.');
        }
        configuration = {expansion: input.configuration.expansion, clockHz: input.configuration.clockHz};
    }
    let rom = null;
    if (input.rom !== null) {
        if (!plain(input.rom)) reject('rom', 'ROM must be null or a local ROM reference.');
        else {
            if (!keysAllowed(input.rom, ['sha256', 'byteLength', 'name'])) reject('rom', 'Only a ROM reference is allowed, never embedded ROM bytes or a remote URL.');
            if (typeof input.rom.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(input.rom.sha256)) reject('rom.sha256', 'ROM reference needs a SHA-256 digest.');
            if (input.rom.byteLength !== 2048) reject('rom.byteLength', 'A CP1 8049 monitor ROM must have 2048 bytes.');
            if (input.rom.name !== undefined && (typeof input.rom.name !== 'string' || input.rom.name.length > 256 || /[\u0000-\u001f]/.test(input.rom.name))) {
                reject('rom.name', 'ROM name must contain at most 256 printable characters.');
            }
            if (typeof input.rom.sha256 === 'string') rom = {
                sha256: input.rom.sha256.toLowerCase(), byteLength: input.rom.byteLength,
                ...(input.rom.name === undefined ? {} : {name: input.rom.name})
            };
        }
    }
    if (typeof input.source !== 'string' || input.source.length > MAX_SOURCE) reject('source', `Source must be text of at most ${MAX_SOURCE} characters.`);
    const capacity = configuration && configuration.expansion === true ? 256 : 128;
    const words = [];
    const addresses = new Set();
    if (!Array.isArray(input.words) || input.words.length > capacity) reject('words', `Words must be an array of at most ${capacity} cells.`);
    else input.words.forEach((word, index) => {
        const path = `words[${index}]`;
        if (!plain(word) || !keysAllowed(word, ['address', 'opcode', 'operand'])) {
            reject(path, 'Each cell contains only address, opcode and operand.');
            return;
        }
        if (!Number.isInteger(word.address) || word.address < 0 || word.address >= capacity) reject(`${path}.address`, `Address must be from 0 to ${capacity - 1}.`);
        else if (addresses.has(word.address)) reject(`${path}.address`, `Cell ${word.address} occurs twice.`);
        else addresses.add(word.address);
        if (!byte(word.opcode)) reject(`${path}.opcode`, 'Opcode must be one byte.');
        if (!byte(word.operand)) reject(`${path}.operand`, 'Operand must be one byte.');
        words.push({address: word.address, opcode: word.opcode, operand: word.operand});
    });
    words.sort((a, b) => a.address - b.address);
    // Source is optional for a hand-entered cell image. When it is present it
    // must describe the saved cells exactly, so reopening cannot pick between
    // two contradictory versions of the same program.
    if (!errors.length && input.source.trim()) {
        const parsed = parseCp1Program(input.source, {expansion: configuration.expansion});
        if (!parsed.ok) {
            for (const problem of parsed.diagnostics) reject(`source:${problem.line}:${problem.column}`, problem.message);
        } else {
            const encoded = parsed.words.map(({address, opcode, operand}) => ({address, opcode, operand}));
            if (JSON.stringify(encoded) !== JSON.stringify(words)) reject('words', 'Saved cells do not match the source program.');
        }
    }
    if (errors.length) return {ok: false, project: null, errors};
    return {ok: true, errors, project: {
        format: CP1_PROJECT_FORMAT, version: CP1_PROJECT_VERSION, target: 'kosmos-cp1',
        configuration, rom, source: input.source, words
    }};
}

const requireValid = input => {
    const result = validateCp1Project(input);
    if (!result.ok) {
        const error = new TypeError(result.errors.map(item => `${item.path || 'project'}: ${item.message}`).join('\n'));
        error.diagnostics = result.errors;
        throw error;
    }
    return result.project;
};

/**
 * Editing state is deliberately separate from an assembled export. Incomplete
 * source must survive a normal workspace save, including a line being typed.
 * The same structural/ROM/configuration bounds apply, but source syntax is not
 * interpreted and no word image or running-machine state is accepted.
 */
export function validateCp1Workspace (input) {
    const errors = [];
    if (!plain(input)) return {ok: false, project: null, errors: [{path: '', message: 'A CP1 workspace must be an object.'}]};
    if (!keysAllowed(input, ['format', 'version', 'configuration', 'rom', 'source'])) {
        errors.push({path: '', message: 'Workspace fields may not contain cells, ROM bytes, live CPU state or held keys.'});
    }
    if (input.format !== CP1_WORKSPACE_FORMAT) errors.push({path: 'format', message: `Expected ${CP1_WORKSPACE_FORMAT}.`});
    if (input.version !== CP1_PROJECT_VERSION) errors.push({path: 'version', message: `Unsupported CP1 workspace version ${String(input.version)}.`});
    if (typeof input.source !== 'string' || input.source.length > MAX_SOURCE) {
        errors.push({path: 'source', message: `Source must be text of at most ${MAX_SOURCE} characters.`});
    }
    const shape = validateCp1Project({
        format: CP1_PROJECT_FORMAT, version: CP1_PROJECT_VERSION, target: 'kosmos-cp1',
        configuration: input.configuration, rom: input.rom, source: '', words: []
    });
    errors.push(...shape.errors);
    if (errors.length) return {ok: false, project: null, errors};
    return {ok: true, errors: [], project: {
        format: CP1_WORKSPACE_FORMAT, version: CP1_PROJECT_VERSION,
        configuration: shape.project.configuration, rom: shape.project.rom, source: input.source
    }};
}

/** Build a detached, canonical project from editor data, discarding live UI state. */
export function createCp1Project ({configuration = {}, rom = null, source = '', words} = {}) {
    const config = {
        expansion: configuration.expansion === undefined ? false : configuration.expansion,
        clockHz: configuration.clockHz === undefined ? CP1_DEFAULT_CLOCK_HZ : configuration.clockHz
    };
    let cells = words;
    if (cells === undefined) {
        const parsed = parseCp1Program(source, {expansion: config.expansion});
        if (!parsed.ok) {
            const error = new SyntaxError(parsed.diagnostics.map(item => `Line ${item.line}: ${item.message}`).join('\n'));
            error.diagnostics = parsed.diagnostics;
            throw error;
        }
        cells = parsed.words;
    }
    return requireValid({
        format: CP1_PROJECT_FORMAT, version: CP1_PROJECT_VERSION, target: 'kosmos-cp1',
        configuration: config,
        rom: rom === null ? null : {sha256: rom.sha256, byteLength: rom.byteLength,
            ...(rom.name === undefined ? {} : {name: rom.name})},
        source,
        words: Array.isArray(cells) ? cells.map(({address, opcode, operand}) => ({address, opcode, operand})) : cells
    });
}

export function serializeCp1Project (project) {
    return `${JSON.stringify(requireValid(project), null, 2)}\n`;
}

export function deserializeCp1Project (text) {
    if (typeof text !== 'string' || text.length > MAX_JSON) throw new RangeError(`A CP1 project must be text of at most ${MAX_JSON} characters.`);
    return requireValid(JSON.parse(text));
}

export function cp1ProjectBytes (project) {
    const valid = requireValid(project);
    const bytes = new Uint8Array(valid.configuration.expansion ? 512 : 256);
    for (const cell of valid.words) {
        bytes[cell.address * 2] = cell.opcode;
        bytes[cell.address * 2 + 1] = cell.operand;
    }
    return bytes;
}

/** Digest an explicitly imported local ROM; never download or persist its bytes. */
export async function cp1RomReference (bytes, name = '', cryptoProvider = globalThis.crypto) {
    if (!(bytes instanceof Uint8Array) || bytes.length !== 2048) throw new RangeError('Import a 2048-byte CP1 monitor ROM.');
    if (!cryptoProvider || !cryptoProvider.subtle) throw new Error('SHA-256 is unavailable in this browser.');
    const digest = new Uint8Array(await cryptoProvider.subtle.digest('SHA-256', bytes));
    const sha256 = Array.from(digest, value => value.toString(16).padStart(2, '0')).join('');
    const rom = {sha256, byteLength: bytes.length, ...(name ? {name} : {})};
    // Reuse the document boundary for filename limits and digest validation.
    return createCp1Project({rom}).rom;
}
