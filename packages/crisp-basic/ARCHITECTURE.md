# CrispBASIC architecture and next milestones

## Decision: preserve a common language, separate the hosts

CrispBASIC will use BBC BASIC-compatible source across app, embedded, and
small-device targets. BBCSDL is the initial full-language implementation;
PicoBB is the intended first embedded implementation. A future compiler will
serve targets whose memory cannot support an interpreter. This is a roadmap,
not evidence that those targets already run CrispBASIC.

The current native process is the first executable vertical slice. It proves
source preparation, genuine upstream execution, byte-oriented output,
runtime diagnostics and controlled lifetime without coupling the project to
Brickwright's React/Scratch UI. It is not yet the requested C/WASM library.

## Why a separate native process first

The pinned `basic()` entry point is blocking and uses process-global state.
`xeq()` recurses during procedure/function execution, while the error path
uses `setjmp`/`longjmp`. Treating it as a reentrant library, or returning out of
it to pause and then pretending it can resume, would lose interpreter state.
One child process per run supplies an honest lifetime boundary now.

The upstream WASM makefile builds the complete SDL application, including SDL
libraries, threads, assets and platform-specific headers. A headless library
requires host-layer work. The first native adapter identifies those seams and
keeps its source modifications small and reviewable.

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

## Next implementation sequence

### 1. Restricted headless host and WASM

Extract the remaining console host dependencies behind a C host interface.
Make memory, virtual files, input, time, raw VDU and supported host calls
explicit. Restrict native symbol resolution and address-space access for the
in-app profile. Build with the correct WASM headers and data layout; do not
substitute 32-bit definitions into the native x86-64 build.

Run the same source/expected-output corpus in native and WASM. Add browser
worker lifecycle tests, bounded execution, input suspension/resumption, and
repeat-instance isolation before integrating the app. Declare supported
capabilities from the actual backend, not the selected target's label.

### 2. Source debugger

Use the executor's statement boundary and source-position hooks for budgets,
breakpoints and stepping. Preserve the interpreter stack while paused, using
a dedicated thread or a proven WASM suspension mechanism. Add local/global
variables and call frames only once their scope/lifetime semantics have real
tests. CPU-level inspection belongs to optional target adapters.

The common contract should support run, pause, continue, step, breakpoints,
inspection, cancellation and reset, with capability negotiation. The current
package intentionally implements only its working run/input/cancel/reset
subset; calling an unsupported debugger operation must never silently run.

### 3. Brickwright adapters: text, blocks, graphics and circuits

Use the existing `generateBASIC(..., {profile: 'bbc', lineNumbers: false})`
output as source. Keep `basicToPseudocode`'s subset warnings. Feed raw VDU bytes
to the existing decoder through a thin adapter; qualify graphics primitives
and queries before claiming full graphics compatibility. Preserve the
existing Z80 runner for retrocomputing.

The GUI renderer currently implements only part of the VDU semantics. It is
not a correctness oracle for the full graphics language. CrispBASIC's engine
should not import the React component or `bw-board`.

### 4. Portable physical-computing library

Define ordinary BASIC procedures/functions, starting with `PROCpinMode`,
`PROCdigitalWrite`, `FNdigitalRead`, `PROCdelay`, and `FNmillis`. Make units,
pin modes, range errors, deterministic simulation time, and unavailable
features explicit. Implement a deterministic simulated host first and
compare the same observable pin/timing traces on a PicoBB target.

Do not reserve new language keywords or silently emit placeholder hardware
operations. The existing non-6502 BASIC generator uses commented hardware
stubs; those do not already implement this library.

### 5. Embedded profiles and a small-device compiler

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
only invokes package commands. No current pin of another Brickwright package
is moved, and the existing external BBCSDL reference build keeps its role.

Any future copied or modified upstream source must retain its notice, have
an immutable source reference, and be visibly identified as modified. Keep
Matrix Brandy as an external test oracle rather than linking it into this
permissively licensed runtime. Audit additional SDK/library dependencies as
they are actually introduced.
