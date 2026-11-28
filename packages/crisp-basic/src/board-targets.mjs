// SPDX-License-Identifier: BSD-3-Clause
// Standalone logical targets derived from bw-board's canonical pad inventory.
// No solver, CPU emulator, board firmware, or physical I/O is loaded here.
import catalog from './board-target-catalog.mjs';
import {SimulationHost, SimulationError} from './simulation-host.mjs';
import {prepareCliSimulation} from './cli-simulation.mjs';

const freeze = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
    }
    return value;
};
export const BOARD_TARGET_PROVENANCE = freeze({...catalog.provenance});

const extraAliases = {
    mcu: ['8051', 'stc8051', 'stc-8051'],
    stc15_mcu: ['stc15', 'stc15f2k60s2'],
    arduino_uno: ['uno'],
    arduino_nano: ['nano'],
    arduino_mega: ['mega'],
    pi_pico: ['pico', 'rp2040', 'raspberry-pi-pico'],
    microbit: ['micro:bit'],
    microbit_breakout: ['micro:bit-breakout'],
    calliopemini: ['calliope', 'calliope-mini'],
    circuit_playground_express: ['cpx'],
    esp8266: ['8266', 'esp-8266'],
    stm32f030: ['stm32', 'stm32-f030']
};
const targets = freeze(catalog.profiles.map(profile => ({
    ...profile,
    id: profile.kind,
    aliases: [...new Set([profile.kind.replaceAll('_', '-'), ...(extraAliases[profile.kind] || [])])]
        .filter(alias => alias !== profile.kind),
    // Voltage is reference metadata from the electrical model. The logical
    // host below neither produces voltage nor models the CPU or peripherals.
    execution: 'host-driven-logical-simulation',
    hardware: false,
    nativeInterpreter: false,
    circuitPhysics: false,
    provenance: BOARD_TARGET_PROVENANCE
})));
const byName = new Map();
const terminalMaps = new Map();
for (const target of targets) {
    for (const name of [target.id, ...target.aliases]) {
        if (byName.has(name)) throw new Error('Duplicate board target alias: ' + name);
        byName.set(name, target);
    }
    terminalMaps.set(target.id, new Map(target.pins.map(({pin, terminal}) => [terminal.toLowerCase(), pin])));
}

/** The exact supported model inventory; returned records and arrays are frozen. */
export function listBoardTargets() { return targets; }

/** Resolve an explicit target name. Broad aliases select the documented model,
 * not every chip or board in that family (for example STM32F030 and classic Nano). */
export function resolveBoardTarget(name) {
    if (typeof name !== 'string') throw new TypeError('Board target must be a name');
    const target = byName.get(name.trim().toLowerCase());
    if (!target) throw new TypeError('Unknown board target ' + JSON.stringify(name) +
        '; choose ' + targets.map(entry => entry.id).join(', '));
    return target;
}

function targetPin(target, value) {
    const pin = typeof value === 'string' ? terminalMaps.get(target.id).get(value.toLowerCase()) : value;
    if (!Number.isSafeInteger(pin) || !target.pins.some(entry => entry.pin === pin)) {
        throw new SimulationError('invalid-pin', 'Unknown ' + target.id + ' logical pin or terminal: ' + String(value));
    }
    return pin;
}

class TargetSimulationHost extends SimulationHost {
    #target;
    #targetCapabilities;
    constructor(target, options) {
        super(options);
        this.#target = target;
        const activePins = new Set(super.capabilities.pins);
        this.#targetCapabilities = Object.freeze({
            ...super.capabilities,
            target,
            nativeInterpreter: false,
            pinMap: Object.freeze(target.pins.filter(entry => activePins.has(entry.pin)))
        });
    }
    get capabilities() { return this.#targetCapabilities; }
    pinMode(pin, mode) { return super.pinMode(targetPin(this.#target, pin), mode); }
    digitalWrite(pin, value) { return super.digitalWrite(targetPin(this.#target, pin), value); }
    digitalToggle(pin) { return super.digitalToggle(targetPin(this.#target, pin)); }
    digitalRead(pin) { return super.digitalRead(targetPin(this.#target, pin)); }
    setInput(pin, value) { return super.setInput(targetPin(this.#target, pin), value); }
    scheduleInput(pin, value, atMs) { return super.scheduleInput(targetPin(this.#target, pin), value, atMs); }
}

const HOST_KEYS = ['pins', 'maxTimeMs', 'maxTraceEvents', 'maxScheduledInputs'];

/** Validate a profile-constrained logical fixture before starting an interpreter.
 * Omitted schemaVersion defaults to 1; a supplied version must be exactly 1.
 * Terminal strings must be complete canonical names, ignoring case only.
 * pins may restrict the target's admitted set, but can never expand it.
 * A returned factory creates isolated state for every run.
 */
export function prepareTargetSimulation(name, fixture = {}) {
    const target = resolveBoardTarget(name);
    if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) {
        throw new TypeError('simulation fixture must be an object');
    }
    const value = {schemaVersion: 1, ...fixture};
    if (Object.hasOwn(fixture, 'pins')) {
        if (!Array.isArray(fixture.pins)) throw new TypeError('simulation fixture pins must be an array');
        value.pins = fixture.pins.map(pin => targetPin(target, pin));
    } else {
        value.pins = target.pins.map(({pin}) => pin);
    }
    if (Object.hasOwn(fixture, 'inputs')) {
        if (!Array.isArray(fixture.inputs)) throw new TypeError('simulation fixture inputs must be an array');
        value.inputs = fixture.inputs.map(input => {
            if (!input || typeof input !== 'object' || Array.isArray(input)) {
                throw new TypeError('simulation input must be an object');
            }
            return {...input, ...(Object.hasOwn(input, 'pin') ? {pin: targetPin(target, input.pin)} : {})};
        });
    }
    // Reuse the generic fixture's strict field, level, time, duplicate-pin and
    // resource validation. Do not discard unknown fields while normalizing.
    const prepared = prepareCliSimulation(value);
    const options = Object.fromEntries(HOST_KEYS.filter(key => Object.hasOwn(value, key))
        .map(key => [key, key === 'pins' ? Object.freeze([...value.pins]) : value[key]]));
    const inputs = Object.freeze((value.inputs || []).map(input => Object.freeze({...input})));
    const createHost = () => {
        const host = new TargetSimulationHost(target, options);
        try {
            for (const input of inputs) host.scheduleInput(input.pin, input.value, input.atMs);
            return host;
        } catch (error) {
            host.dispose();
            throw error;
        }
    };
    const probe = createHost();
    const capabilities = probe.capabilities;
    probe.dispose();
    return Object.freeze({target, capabilities, maxRequests: prepared.maxRequests, createHost});
}

/** Convenience API for one run. Use prepareTargetSimulation for fresh-run factories. */
export function createTargetSimulationHost(name, fixture = {}) {
    return prepareTargetSimulation(name, fixture).createHost();
}
