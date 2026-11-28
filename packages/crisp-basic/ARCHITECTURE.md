# CrispBASIC architecture and next milestones

## Decision: preserve a common language, separate the hosts

CrispBASIC will use BBC BASIC-compatible source across app, embedded, and
small-device targets. BBCSDL is the initial full-language implementation;
PicoBB is the intended first embedded implementation. A future compiler will
serve targets whose memory cannot support an interpreter. This is a roadmap,
not evidence that those targets already run CrispBASIC.

The native process was the first executable vertical slice. It proves
source preparation, genuine upstream execution, byte-oriented output,
runtime diagnostics and controlled lifetime without coupling the project to
Brickwright's React/Scratch UI. A second implementation now compiles the same
core into a restricted C/WASM host and runs it in browser or Node workers.

## Why a separate native process first

The pinned `basic()` entry point is blocking and uses process-global state.
`xeq()` recurses during procedure/function execution, while the error path
uses `setjmp`/`longjmp`. Treating it as a reentrant library, or returning out of
it to pause and then pretending it can resume, would lose interpreter state.
One child process per native run supplies a lifetime boundary. The WASM backend
uses a fresh worker/module per run and Asyncify to preserve the entire C stack
through asynchronous input, waits and simulation replies; it does not pretend
that unwinding the recursive executor is a resumable pause.

The upstream WASM makefile builds the complete SDL application, including SDL
libraries, threads, assets and platform-specific headers. A headless library
requires host-layer work. The native adapter identifies those seams. The new
WASM host replaces the SDL/console OS layer and removes its exposed host tables.
Both integrations keep source modifications explicit and exact-match checked.

Sources: the pinned upstream [console host](https://github.com/rtrussell/BBCSDL/blob/6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f/src/bbccon.c),
[main/error handler](https://github.com/rtrussell/BBCSDL/blob/6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f/src/bbmain.c),
[executor](https://github.com/rtrussell/BBCSDL/blob/6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f/src/bbexec.c),
and [WASM makefile](https://github.com/rtrussell/BBCSDL/blob/6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f/bin/wasm/makefile).

## Native protocol, version 1

| Channel | Meaning |
| --- | --- |
| Program argument | Path to Latin-1, line-numbered source prepared by the wrapper |
| stdin | Runtime input bytes only |
| stdout | Original VDU output bytes |
| stderr | Bounded host diagnostics |
| fd 3 | Newline-delimited JSON control records |

An input notification has `type: "input"`, `version: 1`, and `method: "line"`
or `"key"`. A terminal record has `type: "result"`, `version: 1`, `status:
"completed"` or `"error"`, and `exitCode`. An error also has `error: {code,
message, basicLine}`. The wrapper maps `basicLine` back to the original
physical source line. `QUIT n` is completed execution with its requested
process exit status modulo 256.

The wrapper imposes bounds on output, diagnostics and control-record size,
validates the control format, and requires the actual exit status to agree
with the terminal record. A missing/malformed record or a native crash is a
host error. Timeout, cancellation and output-limit outcomes are owned by the
parent and do not depend on an interpreter callback getting CPU time.

No protocol record is parsed from program output. This is both simpler and
more reliable than detecting `RUN`, `QUIT`, or error phrases in a REPL
transcript. The native host invokes error reporting only after BBCSDL has
applied its own `ON ERROR` semantics.

## Restricted C/WASM implementation

The WASM build uses the actual pinned `bin/wasm/BBC.h` and the core data layout
derived from `bbdata_wasm32.c`. It never substitutes the native extern-global
header or the x86-64 NASM layout. Compile-time checks verify 32-bit pointers,
16-byte WASM variants and 8-byte string descriptors. No console, SDL, assembler
or native OS host is linked.

`wasm/crisp-host.h` exposes byte output, line/key input events, asynchronous byte
reads, monotonic time, sleep, structured errors/exit status and an opt-in scalar
simulation-request hook. Source arrives
as bounded bytes in linear memory, never as a host path. The BASIC arena is
16 MiB plus reserved interpreter space within fixed 64 MiB WASM memory. Virtual
files are explicitly unavailable in this first restricted profile.

Restrictions are enforced in the evaluator/executor, so named and numeric SYS,
CALL/USR, indirect function calls, pointer writes/queries, raw memory operations,
host events and system variables cannot bypass a superficial source filter.
EVAL validates its untokenized text before invoking the original lexer; this
prevents constructed strings from smuggling the interpreter's fast-variable
and function tokens across the boundary. Files, OSCLI, assembly, unsupported
graphics queries, mouse and sound also have rejecting host implementations.

The JavaScript parent owns deadlines, cancellation, input/output limits and
worker termination. Asyncify handles stack-preserving input/WAIT suspension
inside the worker, including recursive FN/PROC frames and ON ERROR LOCAL.
Ordinary unsupported-operation errors remain catchable by BASIC; parent limits
are not. A fresh instance per run avoids reentrancy and global-state leaks.

The build uses Emscripten 3.1.64 with filesystem and dynamic JavaScript evaluation
disabled. It checks the resulting import list and records the complete build
inputs/settings/imports and binary hash. The imports are the explicit host
hooks and Emscripten memory, stack and longjmp support. Neither host files nor
network/process primitives are exposed to BASIC. The isolation boundary does
not prove that upstream C is free of faults inside its own linear memory.

Validation includes the same fixed-output corpus in native and WASM, runtime
restriction probes, input/error suspension and repeated/concurrent sessions.
Real Chromium tests verify responsive pages, tight-loop termination and worker
cleanup without cross-origin isolation. Capabilities describe the actual host.
The Brickwright Code tab now connects generated or edited BBC BASIC to this
engine through a GUI-owned adapter and the existing partial VDU renderer. See
[BRICKWRIGHT.md](BRICKWRIGHT.md) for packaging, lifecycle and qualification scope.
Other browser engines and native desktop/mobile shells remain unqualified.

## Bounded BASIC-to-simulation bridge

WASM sessions can explicitly enable `simulation: {}` for a fresh deterministic
reference host on each run, or provide a synchronous
`simulation.createHost({signal, runId})` factory for a custom host. The native
backend rejects simulation configuration, and default WASM sessions keep the
bridge disabled. The standalone
reference host still advertises `basicBridge: false`; the configured session
describes its separate enabled bridge capability. The complete API and error
mapping are in [SIMULATION.md](SIMULATION.md).

The ordinary `PROCpinMode`, `PROCdigitalWrite`, `FNdigitalRead`, `PROCdelay` and
`FNmillis` definitions live in a separate bounded `libase` buffer. They neither
consume nor renumber user source lines, and normal user `DEF` overrides remain
possible. One private FN evaluator hook parses and validates the operation's
complete argument list, then enters an `EM_ASYNC_JS` suspension. A new
`crisp_simulation_abi()` export prevents enabling the feature with an old module.
Domain errors use the authored call site; unexpected hidden-library errors have
no editor line.

The versioned worker channel carries run/request IDs, fixed scalar arguments,
five allowlisted operations and typed replies. Both ends validate the complete
record, and only one request may be outstanding. The parent enforces a cumulative
request budget (default 4096, maximum 1000000) in addition to deadline and I/O
limits. Host trace, stimulus and time budgets also terminate the run as
`simulation-limit`; BASIC cannot catch these limits. Ordinary domain failures
map to catchable `ERR201..209`, with a stable `simulationCode` on an unhandled
bridge error. No VDU control encoding or SYS/raw-memory capability is added.

Each fresh host belongs to exactly one run; weak ownership tracking rejects
reuse across runs or sessions. The parent aborts the host's signal before its
synchronous disposal and discards late replies. Operation methods may return
Promises, but factories, disposal and synchronous method work must keep the
parent event loop responsive. Adapters must check the signal/disposed state
before deferred side effects: terminating the worker cannot undo arbitrary
external adapter changes. The reference host itself rejects mutations after
disposal. `TIME` and `WAIT` retain their existing monotonic-clock semantics.

The package includes protocol/lifecycle tests and real-runtime fixtures for
recursive suspension, errors, source identity and fixed pin/time traces.
[VALIDATION.md](VALIDATION.md) records which checks actually ran for the current
revision and distinguishes implementation from qualification.

## Next implementation sequence

### 1. Brickwright adapters: implemented slice and remaining work

The Code tab now uses the existing
`generateBASIC(..., {profile: 'bbc', lineNumbers: false})` output as source and
keeps `basicToPseudocode`'s subset warnings. A GUI-owned adapter feeds raw VDU
bytes to the existing decoder/renderer, provides input and Stop/Reset, and
preserves the Z80 runner as an explicit retro engine. Fixed output and canvas
checks cover basic MOVE/DRAW, not full graphics compatibility or queries.

The bounded BASIC-to-simulation bridge now has a GUI-owned board-solver adapter
and an explicit **Connect Circuit** option. It maps supported logical pin IDs
to the active canvas board, senses its electrical solution and advances its
existing clock only through cooperative `PROCdelay` batches. The run's elapsed
clock starts at zero without resetting circuit component state. Token-protected
GUI handoff and the solver's external-clock lease prevent competing ownership;
run invalidation releases the captured host before the designer resumes.
The captured model also revokes BASIC before saving undo history or rebuilding
the solver, so a transferred snapshot cannot inherit its temporary GPIO drive.
Pending or failed cleanup blocks those mutation boundaries and new BASIC
sessions on that model; read-only snapshots and exports retain their behavior.
Request, trace, time and cumulative solver-work ceilings remain parent-owned.
See [BOARD-SIMULATION.md](BOARD-SIMULATION.md) for the exact supported boards,
pin maps, timing semantics and qualification limits.

Production qualification builds the complete webpack GUI with its normal
vendored sources, lockfile, overlays and CAD/FPGA flags. Chromium then drives
the emitted workbench's actual editor and Circuit controls, including live
file replacement, while a separate gate authenticates the runtime asset bytes.
See [VALIDATION.md](VALIDATION.md) for the tested revision and observed results.

The owning `sb3-creator` producer now has an explicit `mode: 'crispbasic'`,
integrated through the exact pin and both generated mirrors. The Code tab's
**Generate portable Circuit calls** choice selects it independently of the
runtime's **Connect Circuit** option. Existing default/retro output remains
unchanged. Digital writes normalize to `0` or `1`; delays convert seconds to
integer simulated milliseconds; timer reset moves a program-owned offset.
Unsupported operations refuse generation with diagnostics and no executable
partial source. The reverse **To blocks** boundary is qualified as a clear
refusal for live portable calls, before project mutation; ordinary supported
BASIC still converts. Existing hardware comments remain comments, including
colon-separated text within `REM`. See [GENERATOR.md](GENERATOR.md).

A solved electrical read is not an output latch. Toggle is deliberately
refused rather than implemented by blindly inverting `FNdigitalRead`. The next
generator extension is a meaning-preserving reverse representation, or an
explicit latch model with corresponding producer, runtime and solver tests.
Extend board and peripheral capabilities only with corresponding solver tests.
No physical-pin connection is claimed.

The GUI renderer currently implements only part of the VDU semantics. It is
not a correctness oracle for the full graphics language. CrispBASIC's engine
should not import the React component or `bw-board`.

### 2. Source debugger

Use the executor's statement boundary and source-position hooks for breakpoints
and stepping. The WASM input suspension is proven, but debugger stops still
need an explicit protocol, source-position hooks and scope/lifetime tests.
Add local/global variables and call frames only once those semantics have real
tests. CPU-level inspection belongs to optional target adapters.

The common contract should support run, pause, continue, step, breakpoints,
inspection, cancellation and reset, with capability negotiation. The current
package implements its working run/input/cancel/reset subset; calling an
unsupported debugger operation must never silently run.

### 3. Portable physical-computing library

The first five ordinary BASIC procedures/functions and their deterministic
simulation bridge are implemented. Their pin modes, integer-millisecond units,
range errors and unavailable features are explicit. The board-solver adapter is
implemented; the next portable-host step is the corresponding library on a
PicoBB target. Compare
observable pin/timing traces using independent target evidence. Do not treat the
JavaScript reference host as evidence of physical-device equivalence.

Do not reserve new language keywords or silently emit placeholder hardware
operations. The existing non-6502 BASIC generator uses commented hardware
stubs; those do not already implement this library.

### 4. Embedded profiles and a small-device compiler

Proposed profiles are Full, Embedded and Minimal. They share syntax while
advertising validated feature/resource differences. Usable memory, SDK
overhead, strings, arrays, recursion and timing need measurement on each
target. Future ESP32/STM32/micro:bit ports remain unvalidated until firmware
and physical or sufficiently faithful emulated tests exist.

For the smallest AVR/8051/STM8 devices, implement an explicit compilable
subset and reject unsupported features with source diagnostics. Do not
promise that full BBC BASIC fits a tiny target. Differential testing needs
fixed expected anchors and independent implementations/physical results;
running this same BBCSDL core twice is not independent evidence.

## Repository and dependency boundaries

The extraction unit is `packages/crisp-basic/`. Runtime, build inputs, tests,
examples, license notices and this roadmap live together. The root workflow
sets up the SDK/build tools and invokes package commands. The portable generator
adoption changes only the existing `sb3-creator` pin; the board, Circuit and
interpreter pins retain their identities. The existing external BBCSDL
reference build keeps its role. The npm development dependencies are locked Playwright and esbuild for browser
qualification and JSX transformation; runtime code has no npm dependencies.
Brickwright integration tests also use the repository's existing pinned
generator/VDU dependencies.

Any future copied or modified upstream source must retain its notice, have
an immutable source reference, and be visibly identified as modified. Keep
Matrix Brandy as an external test oracle rather than linking it into this
permissively licensed runtime. Audit additional SDK/library dependencies as
they are actually introduced.
