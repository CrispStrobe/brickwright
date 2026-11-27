# Restricted headless WASM host

This backend links only the pinned BBCSDL `bbmain.c`, `bbexec.c`, `bbeval.c`,
the WASM data definitions and CrispBASIC's host/bridge. The console and SDL hosts
are not linked. The actual `bin/wasm/BBC.h` describes the upstream WASM32 data
layout; compile-time checks verify its pointer, variant and string sizes.

## Build and artifacts

```sh
# Emscripten 3.1.64 must be installed and activated.
npm run build:wasm
node examples/run-wasm.mjs
npm run test:wasm
```

`EMCC` can select a compiler path, and `CRISP_BASIC_UPSTREAM` can select an
existing BBCSDL Git checkout. The builder reads and hashes the immutable Git
objects, never uncommitted working-tree changes. Every source is locked in
`upstream.lock.json`. Patches are exact-match transformations of generated copies
under `.build/wasm/`, visibly marked with the original copyright notices intact.

The compiler version, all flags, source hashes, complete WASM import list and
WASM binary digest are recorded in `.build/wasm/build.json`. The Emscripten version
and toolchain notices are locked in `wasm/toolchain.lock.json`; notices are
hash-checked and copied to `.build/wasm/licenses/` for redistribution alongside
the module. The build rejects
unexpected imports. Emscripten's longjmp invocation wrappers, bounded memory
helpers and stack-overflow handler are allowed along with the explicit CrispBASIC
hooks. File, network and arbitrary JavaScript execution imports are not allowed.

The validated build uses Emscripten 3.1.64, Asyncify, a 2 MiB C stack, 1 MiB
Asyncify stack storage, and fixed 64 MiB linear memory. BASIC receives a 16 MiB
arena plus 70,400 bytes reserved for the string accumulator and host layout.
There is no memory growth, function-table growth, filesystem or dynamic JS
evaluation. An SDK upgrade must pass the build's import check and all runtime,
policy, parity and browser suites.

## C interface

[`crisp-host.h`](crisp-host.h) is the embedding contract. It provides:

- Raw byte output and line/key input notifications.
- Byte input with explicit EOF and blocking or timed waits.
- Monotonic milliseconds and asynchronous sleep.
- Structured unhandled BASIC errors and intentional `QUIT` status.

`crisp_run(source, length)` receives prepared Latin-1 numbered source directly in
memory. It neither opens a source file nor accepts a path. A module instance may
run once; the owner discards it after the result. The C host validates source
size, line numbers, control bytes and token-record sizes before execution.

The bridge uses Emscripten
[`EM_ASYNC_JS` and Asyncify](https://emscripten.org/docs/porting/asyncify.html)
for input and wait suspension. The session invokes `crisp_run` through an async
`ccall`, preserving recursive interpreter and error-handler state. Parent-owned
worker termination bounds execution even when the core never returns to a hook.

This milestone deliberately denies files, including virtual files. Future
virtual-file or hardware adapters must extend the explicit host contract and
capabilities; they must not revive the upstream console OS layer.

## Browser deployment

Keep these package assets accessible under a stable URL layout:

```text
browser.mjs
src/source.mjs
src/wasm-capabilities.mjs
src/wasm-session.mjs
src/wasm-worker.mjs
.build/wasm/crispbasic.mjs
.build/wasm/crispbasic.wasm
```

Import `browser.mjs` or the package's `./browser` export. The Node main entry
also exports the native process backend, so it is not the browser entry.
An application that relocates generated files may pass `moduleURL` and
`workerURL` to `createWasmSession`; keep `crispbasic.wasm` beside its generated
module. Those URLs select trusted application assets and must not be controlled
by a BASIC program. Serve `.mjs` as JavaScript and `.wasm` as `application/wasm`.
The browser test runner serves this exact layout over loopback HTTP.

No SharedArrayBuffer, pthreads, SDL assets or cross-origin isolation headers are
required. The session uses a module worker and the runtime uses WebAssembly;
those features and any applicable content-security policy must permit the
application's own worker/module/WASM assets. Chromium is exercised by CI; other
browser engines and desktop/mobile shells have not yet been qualified.

## Limits and profile semantics

The default deadline is 5 seconds and default output cap is 1 MiB. Interactive
input counts toward the deadline; total input is capped at 1 MiB and prepared
source at 4 MiB. Limits belong to the parent, independently of BASIC `ON ERROR`.
The input queue is message-based, so `writeInput()` returns `true` after a bounded
copy rather than a stream backpressure flag. A new run has fresh memory and time
origin, even on a reused session object.

Normal arrays, structures, procedures, functions, strings and numeric formatting
remain part of the language. Binary exponentiation remains supported. Raw
addresses and internal function pointers are unavailable, including through
dynamic `EVAL`; injected raw internal tokens are rejected before its tokenizer.
`TIME`/`TIME=` and `WAIT` use monotonic centiseconds; `TIME$` and `ON TIME` are
unavailable. Graphics statements can emit VDU bytes, but screen queries, sound,
mouse input, host events and hardware operations return unsupported errors.

The worker's WASM memory boundary isolates the embedding host. It does not
guarantee that all possible BASIC programs are free of upstream interpreter
faults inside that memory. WASM traps are reported as host errors; module memory
is discarded. Native/WASM differential tests use fixed expected byte anchors,
but the shared interpreter is not an independent semantic oracle.
