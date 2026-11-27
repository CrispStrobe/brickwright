// Inputs owned by CrispBASIC that determine the restricted WASM artifact.
// The builder and embedding applications share this freshness contract.
export const WASM_LOCAL_INPUTS = Object.freeze([
    'scripts/build-wasm.mjs',
    'upstream.lock.json',
    'wasm/build-inputs.mjs',
    'wasm/toolchain.lock.json',
    'wasm/patch-upstream.mjs',
    'native/patch-upstream.mjs',
    'wasm/crisp-host.h',
    'wasm/crispbasic.c',
    'wasm/emscripten-host.c'
]);

export const WASM_UPSTREAM_INPUTS = Object.freeze([
    'bin/wasm/BBC.h', 'src/bbmain.c', 'src/bbexec.c',
    'src/bbeval.c', 'src/bbdata_wasm32.c', 'licence.txt'
]);
