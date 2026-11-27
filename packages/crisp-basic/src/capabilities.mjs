// Capabilities describe the implemented backend, not the eventual language profiles.
export const VERSION = '0.1.0-dev.4';
export const BACKEND = 'bbcsdl-native';

function freeze(value) {
    for (const child of Object.values(value)) {
        if (child && typeof child === 'object') freeze(child);
    }
    return Object.freeze(value);
}

export const NATIVE_CAPABILITIES = freeze({
    schemaVersion: 1,
    backend: BACKEND,
    platforms: ['linux-x64'],
    language: 'BBC BASIC (BBCSDL core)',
    profile: 'native-console',
    execution: {run: true, input: true, cancellation: true, timeout: true, outputLimit: true},
    output: {text: true, rawVdu: true, graphics: false, sound: false},
    debug: {pause: false, step: false, breakpoints: false, variables: false, callStack: false},
    hardware: false,
    simulation: {available: false, enabled: false, basicBridge: false},
    sandboxed: false
});
