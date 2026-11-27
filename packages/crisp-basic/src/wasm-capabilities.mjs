// This profile describes the restricted host that is actually linked to WASM.
// WebAssembly confines memory to the instance; it does not make the upstream
// C interpreter immune to faults inside that memory.
export const WASM_BACKEND = 'bbcsdl-wasm';

function freeze(value) {
    for (const child of Object.values(value)) {
        if (child && typeof child === 'object') freeze(child);
    }
    return Object.freeze(value);
}

export const WASM_CAPABILITIES = freeze({
    schemaVersion: 1,
    backend: WASM_BACKEND,
    platforms: ['browser-worker', 'node-worker'],
    language: 'BBC BASIC (BBCSDL core)',
    profile: 'restricted-headless',
    execution: {run: true, input: true, cancellation: true, timeout: true, outputLimit: true},
    output: {text: true, rawVdu: true, graphics: false, sound: false},
    debug: {pause: false, step: false, breakpoints: false, variables: false, callStack: false},
    hardware: false,
    simulation: {available: true, enabled: false, basicBridge: false,
        contractVersion: 1, maxRequests: 4096},
    sandboxed: true,
    isolation: 'webassembly-worker',
    host: {
        filesystem: false, virtualFiles: false, nativeCalls: false,
        osCommands: false, assembler: false, rawAddresses: false,
        monotonicTime: true, wallClockTime: false
    }
});
