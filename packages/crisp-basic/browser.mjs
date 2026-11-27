// Browser-safe entry: the native process adapter is deliberately not imported.
export {WasmSession, createWasmSession} from './src/wasm-session.mjs';
export {WASM_BACKEND, WASM_CAPABILITIES} from './src/wasm-capabilities.mjs';
export {prepareSource, SourceError} from './src/source.mjs';
export {createSimulationHost, SimulationHost, SimulationError, SIMULATION_CAPABILITIES} from './src/simulation-host.mjs';
