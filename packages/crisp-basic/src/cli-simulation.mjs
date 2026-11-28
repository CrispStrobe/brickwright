// Declarative fixtures for the portable CLI. They describe logical input
// stimuli, never JavaScript hooks, physical boards or electrical networks.
import {createSimulationHost} from './simulation-host.mjs';
import {DEFAULT_SIMULATION_REQUESTS, MAX_SIMULATION_REQUESTS} from './simulation-protocol.mjs';

const HOST_KEYS = ['pins', 'maxTimeMs', 'maxTraceEvents', 'maxScheduledInputs'];
const FIELDS = new Set(['schemaVersion', 'inputs', 'maxRequests', ...HOST_KEYS]);
const INPUT_FIELDS = new Set(['pin', 'value', 'atMs']);

function record(value, fields, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${name} must be an object`);
    }
    for (const key of Object.keys(value)) {
        if (!fields.has(key)) throw new TypeError(`Unknown ${name} field: ${key}`);
    }
}

/** Validate everything before an interpreter starts. The same host validators
 * enforce pin, value, time, queue and resource limits in fixtures and runtime. */
export function prepareCliSimulation(value) {
    record(value, FIELDS, 'simulation fixture');
    if (value.schemaVersion !== 1) throw new TypeError('simulation fixture schemaVersion must be 1');
    const maxRequests = value.maxRequests === undefined ? DEFAULT_SIMULATION_REQUESTS : value.maxRequests;
    if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests > MAX_SIMULATION_REQUESTS) {
        throw new RangeError(`simulation fixture maxRequests must be an integer from 1 to ${MAX_SIMULATION_REQUESTS}`);
    }
    const hostOptions = Object.fromEntries(HOST_KEYS.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
    if (Array.isArray(hostOptions.pins)) hostOptions.pins = Object.freeze([...hostOptions.pins]);
    const inputs = value.inputs === undefined ? [] : value.inputs;
    if (!Array.isArray(inputs)) throw new TypeError('simulation fixture inputs must be an array');
    const stimuli = inputs.map((input, index) => {
        record(input, INPUT_FIELDS, `simulation input ${index + 1}`);
        if (!['pin', 'value', 'atMs'].every(key => Object.hasOwn(input, key))) {
            throw new TypeError(`simulation input ${index + 1} needs pin, value and atMs`);
        }
        return Object.freeze({pin: input.pin, value: input.value, atMs: input.atMs});
    });
    const createHost = () => {
        const host = createSimulationHost(hostOptions);
        try {
            for (const input of stimuli) host.scheduleInput(input.pin, input.value, input.atMs);
            return host;
        } catch (error) {
            host.dispose();
            throw error;
        }
    };
    const probe = createHost();
    const capabilities = probe.capabilities;
    probe.dispose();
    return Object.freeze({maxRequests, capabilities, createHost});
}
