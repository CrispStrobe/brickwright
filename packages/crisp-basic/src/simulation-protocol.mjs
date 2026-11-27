// Original code, BSD-3-Clause. Private, bounded worker protocol. Keep scalar
// operation/error numbers synchronized with wasm/crisp-host.h and crispbasic.c.
export const SIMULATION_ABI = 1;
export const DEFAULT_SIMULATION_REQUESTS = 4096;
export const MAX_SIMULATION_REQUESTS = 1000000;
export const SIMULATION_MODES = Object.freeze(['input', 'output', 'input-pullup']);
export const SIMULATION_ERROR_CODES = Object.freeze([
    'invalid-pin', 'invalid-mode', 'invalid-level', 'invalid-time',
    'pin-not-output', 'floating-input', 'disposed', 'unavailable', 'invalid-operation'
]);
export const SIMULATION_LIMIT_CODES = Object.freeze([
    'request-limit', 'trace-limit', 'input-limit', 'time-limit', 'solver-limit'
]);

const integer = (value, maximum = 0x7fffffff) => Number.isSafeInteger(value) && value >= 0 && value <= maximum;
export const validRunId = value => Number.isSafeInteger(value) && value > 0;
const keysAre = (value, keys) => value && typeof value === 'object' &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export function validSimulationArguments(operation, args) {
    if (!Array.isArray(args) || args.length !== 2 || !keysAre(args, ['0', '1']) ||
        !integer(args[0]) || !integer(args[1])) return false;
    const [first, second] = args;
    switch (operation) {
    case 1: return first <= 65535 && second <= 2;
    case 2: return first <= 65535 && second <= 1;
    case 3: return first <= 65535 && second === 0;
    case 4: return second === 0;
    case 5: return first === 0 && second === 0;
    default: return false;
    }
}

export function validSimulationRequest(record, runId, requestId) {
    return keysAre(record, ['version', 'type', 'runId', 'requestId', 'operation', 'args']) &&
        record.version === 1 && record.type === 'simulation-request' &&
        validRunId(record.runId) && record.runId === runId &&
        validRunId(record.requestId) && record.requestId === requestId &&
        validSimulationArguments(record.operation, record.args);
}

export function validSimulationValue(operation, value) {
    if (operation === 3) return value === 0 || value === 1;
    if (operation === 5) return integer(value);
    return [1, 2, 4].includes(operation) && value === 0;
}

export function validSimulationReply(record, runId, requestId, operation) {
    const common = ['version', 'type', 'runId', 'requestId', 'ok'];
    if (!record || record.version !== 1 || record.type !== 'simulation-reply' ||
        record.runId !== runId || record.requestId !== requestId) return false;
    if (record.ok === true) {
        return keysAre(record, [...common, 'value']) && validSimulationValue(operation, record.value);
    }
    return record.ok === false && keysAre(record, [...common, 'error']) &&
        keysAre(record.error, ['code']) && SIMULATION_ERROR_CODES.includes(record.error.code);
}

export function simulationErrorNumber(code) {
    const index = SIMULATION_ERROR_CODES.indexOf(code);
    if (index < 0) throw new Error('Unknown simulation reply error');
    return -(index + 1);
}
