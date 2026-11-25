import {createEmptyProgram, validateProgram} from './model.js';

export const LOGIKUS_STORAGE_KEY = 'bw-logikus-workspace';
export const LOGIKUS_WORKSPACE_FORMAT = 'brickwright.logikus';
export const LOGIKUS_WORKSPACE_VERSION = 1;
export const LOGIKUS_WORKSPACE_MAX_BYTES = 128 * 1024;

// The open host remains authoritative when browser storage is unavailable.
// undefined means no live host override; null means this project has no lab.
let liveWorkspace;
let projectGeneration = 0;
export const getLiveWorkspace = () => liveWorkspace == null ? liveWorkspace : validateWorkspace(liveWorkspace);
export const setLiveWorkspace = input => {
    liveWorkspace = input == null ? input : validateWorkspace(input);
};
export const getWorkspaceGeneration = () => projectGeneration;
export const setWorkspaceGeneration = generation => { projectGeneration = generation; };

const fields = ['format', 'version', 'program', 'switches', 'presetId', 'controller'];
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/** Persist the wiring and stable switch positions; a held Test button is never project content. */
export function validateWorkspace (input) {
    if (!plain(input)) throw new TypeError('Logikus workspace must be an object.');
    if (Object.keys(input).some(key => !fields.includes(key))) {
        throw new TypeError('Unknown Logikus workspace field; held buttons and live results are not saved.');
    }
    if (input.format !== LOGIKUS_WORKSPACE_FORMAT) {
        throw new TypeError(`Logikus workspace format must be ${LOGIKUS_WORKSPACE_FORMAT}.`);
    }
    if (input.version !== LOGIKUS_WORKSPACE_VERSION) throw new TypeError('Unsupported Logikus workspace version.');
    if (!Array.isArray(input.switches) || input.switches.length !== 10 ||
        Array.from(input.switches).some(value => value !== 0 && value !== 1)) {
        throw new TypeError('Logikus switches must contain exactly ten values of 0 or 1.');
    }
    if (input.presetId !== null && (typeof input.presetId !== 'string' || input.presetId.length > 128 ||
        !input.presetId.length || /[\u0000-\u001f\u007f]/.test(input.presetId))) {
        throw new TypeError('Logikus presetId must be null or a nonempty name of at most 128 printable characters.');
    }
    if (typeof input.controller !== 'boolean') throw new TypeError('Logikus controller must be a boolean.');
    const workspace = {
        format: LOGIKUS_WORKSPACE_FORMAT,
        version: LOGIKUS_WORKSPACE_VERSION,
        program: validateProgram(input.program),
        switches: input.switches.slice(),
        presetId: input.presetId,
        controller: input.controller
    };
    if (new TextEncoder().encode(JSON.stringify(workspace)).byteLength > LOGIKUS_WORKSPACE_MAX_BYTES) {
        throw new RangeError(`Logikus workspace exceeds ${LOGIKUS_WORKSPACE_MAX_BYTES} bytes.`);
    }
    return workspace;
}

/** Construct a detached workspace from editor data; transient fields are deliberately omitted. */
export function createWorkspace ({program = createEmptyProgram(), switches = Array(10).fill(0),
    presetId = null, controller = false} = {}) {
    return validateWorkspace({format: LOGIKUS_WORKSPACE_FORMAT, version: LOGIKUS_WORKSPACE_VERSION,
        program, switches, presetId, controller});
}
