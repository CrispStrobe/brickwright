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
- An opt-in, asynchronous scalar request/reply hook for five simulation operations.

`crisp_run(source, length, simulation_enabled)` receives prepared Latin-1
numbered source directly in memory. The third argument must be `0` or `1`.
Only `1` installs the ordinary BASIC simulation library in a separate bounded
`libase` buffer and enables its private allowlisted FN intrinsic. The source
buffer and authored line numbers are unchanged. The entry point neither opens
a source file nor accepts a path. A module instance may run once; the owner
discards it after the result. The C host validates source size, line numbers,
control bytes and token-record sizes before execution.

The worker checks the exported `crisp_simulation_abi()` marker equals `1` before
enabling simulation. This rejects stale generated modules with an actionable
host error. `crisp_host_simulation_request(operation, argument1, argument2)`
allows only pinMode, digitalWrite, digitalRead, delay and millis. All crossing
values are int32 scalars; modes are enums and domain failures use the fixed
negative codes in `crisp-host.h`. JavaScript validates replies before int32
conversion. The parent handles resource/protocol failures without a BASIC reply.

The bridge uses Emscripten
[`EM_ASYNC_JS` and Asyncify](https://emscripten.org/docs/porting/asyncify.html)
for input, wait and simulation-reply suspension. The session invokes `crisp_run`
through an async `ccall`, preserving recursive interpreter and error-handler state. Parent-owned
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
src/simulation-host.mjs
src/simulation-protocol.mjs
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
input and pending simulation replies count toward the deadline; total input is
capped at 1 MiB and prepared source at 4 MiB. Limits belong to the parent,
independently of BASIC `ON ERROR`.
The input queue is message-based, so `writeInput()` returns `true` after a bounded
copy rather than a stream backpressure flag. A new run has fresh memory and time
origin, even on a reused session object.

Simulation is disabled unless the embedding app supplies the session's
`simulation` options. The default factory creates a fresh reference host per
run. A custom synchronous `createHost({signal, runId})` factory must return a new
object with the five operation methods and synchronous `dispose()`. Operations
may return Promises, but no adapter code may block the parent event loop. The
parent aborts the signal before disposal, rejects host reuse through weak
ownership tracking and ignores late settlements. Deferred adapter work must
check cancellation/disposal before changing state; worker termination cannot
undo its external effects.

The request cap defaults to 4096 and is configurable through 1000000. Request,
trace, stimulus and time-budget failures produce the parent-owned
`simulation-limit` outcome. Ordinary domain failures become catchable BASIC
`ERR201..209`; unhandled bridge errors also carry `simulationCode`. See
[SIMULATION.md](../SIMULATION.md) for exact values and adapter requirements.

Normal arrays, structures, procedures, functions, strings and numeric formatting
remain part of the language. Binary exponentiation remains supported. Raw
addresses and internal function pointers are unavailable, including through
dynamic `EVAL`; injected raw internal tokens are rejected before its tokenizer.
`TIME`/`TIME=` and `WAIT` use monotonic centiseconds; `TIME$` and `ON TIME` are
unavailable. The simulation library's explicit millisecond clock does not alter
those semantics. Graphics statements can emit VDU bytes, but screen queries,
sound, mouse input, host events and physical hardware operations remain
unavailable. There is no native-backend bridge. The GUI's explicit **Connect
Circuit** option uses the separate [board adapter](../BOARD-SIMULATION.md).

The worker's WASM memory boundary isolates the embedding host. It does not
guarantee that all possible BASIC programs are free of upstream interpreter
faults inside that memory. WASM traps are reported as host errors; module memory
is discarded. Native/WASM differential tests use fixed expected byte anchors,
but the shared interpreter is not an independent semantic oracle.

The current revision's executed build and runtime checks are recorded in
[VALIDATION.md](../VALIDATION.md). Real-runtime simulation tests require a rebuilt
module; static/protocol checks do not qualify C-stack preservation by themselves.
