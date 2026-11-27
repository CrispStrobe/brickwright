# CrispBASIC

CrispBASIC is a BBC BASIC-compatible runtime project, incubated in Brickwright
on `feature/crispbasic`. It is intended to become an independent repository.

**CrispBASIC runs real BASIC through the pinned BBCSDL C interpreter in native
processes and restricted WebAssembly workers.** Both use the original tokenizer
and executor, source maps, raw VDU output, structured errors and bounded session
lifetimes. The WASM host runs in browsers and Node without SDL or host filesystem
access. The Brickwright Code tab now adapts this runtime, with interactive input,
Stop/Reset, mapped diagnostics and the existing partial VDU renderer. Version
`0.1.0-dev.5` connects the opt-in BASIC simulation bridge to the active Brickwright
Circuit board through a GUI-owned adapter. Digital pin operations use the pinned
electrical solver, and integer-millisecond delays advance its clock cooperatively.
Full graphics, source debugging and physical-board targets remain subsequent work.

## Try it

### Native CLI

Requirements: Linux x86-64, Node 22 or newer, Git, GCC and NASM. On Debian/Ubuntu
the native build tools are available as `build-essential` and `nasm`.

```sh
cd packages/crisp-basic
npm run build:native
node bin/crispbasic.mjs examples/hello.bas
node bin/crispbasic.mjs examples/structured.bas --json
npm test
npm run test:native
```

No npm dependencies or root Brickwright installation are needed for the native
CLI, either build, or the standalone Node engine tests. The separate
Brickwright integration checks use the root generator/VDU dependencies. The builder
fetches the exact upstream commit and verifies SHA-256 for every input file.
Generated sources, objects, the native executable and build metadata stay in
`.build/`. Use `CC` or `NASM` to select an installed compiler/assembler. An
existing BBCSDL checkout can be supplied through `CRISP_BASIC_UPSTREAM`; the
builder reads the locked Git objects, not its working-tree edits.

### Restricted WASM

Install [Emscripten](https://emscripten.org/docs/getting_started/downloads.html)
3.1.64, the validated version, and make `emcc` available, or set `EMCC` to its
executable path. Node 22+ and Git are also required. GCC and NASM are only needed
when building the native backend for comparison.

```sh
cd packages/crisp-basic
npm run build:wasm
node examples/run-wasm.mjs
npm run test:wasm
```

The build produces `.build/wasm/crispbasic.mjs`, `crispbasic.wasm`, the upstream
license and a `build.json` recording verified source hashes, compiler settings,
WASM imports and the binary digest. It uses the pinned upstream WASM header and
data layout; the x86-64 header/data are never substituted. No SDL, filesystem,
native symbol resolver, inline assembler or dynamic JavaScript evaluator is
linked. Unexpected WASM imports fail the build. See [wasm/README.md](wasm/README.md)
for the C host boundary and deployment layout.

### Brickwright Code tab

From the repository root, `npm run build:crispbasic` builds and packages the
engine for the GUI. Select **BAS → BBC BASIC → CrispBASIC (browser)**; the
separate Z80 engine remains available for retrocomputing. See
[BRICKWRIGHT.md](BRICKWRIGHT.md) for build order, controls, asset integrity,
focused integration tests and the exact rendering/circuit boundaries.

The [simulation API](SIMULATION.md) connects ordinary BASIC procedures and
functions to logical pins and integer-millisecond time. In the Code tab, enable
**Connect Circuit** to use the active supported circuit board. The
[board adapter contract](BOARD-SIMULATION.md) specifies pin numbers, electrical
reads, clock ownership and cancellation. Physical hardware is not connected.

### Test suites

| Command | Prerequisites and coverage |
| --- | --- |
| `npm test` | Source preparation, deterministic simulation contract and bridge protocol/lifecycle tests; no compiled backend needed |
| `npm run test:native` | Native build; execution, CLI and process cleanup |
| `npm run test:wasm` | WASM build; execution, host restrictions, simulation library and worker lifecycle |
| `npm run test:parity` | Both builds; the same corpus checked against fixed expected bytes |
| `npm run test:all` | All of the above |
| `npm run test:browser` | WASM build, Playwright and Chromium; real browser workers |
| `npm run test:brickwright` | WASM build and root dependencies; actual generator, GUI adapter, controls and packaging |

Missing required binaries are failures, never passing skips. To install only
the package's browser test dependencies and run the browser suite:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run test:browser
```

On Linux, `npx playwright install --with-deps chromium` also installs browser
system dependencies. `CRISP_BASIC_PLAYWRIGHT` can select an existing Playwright
module and `CRISP_BASIC_CHROMIUM` an existing browser executable. No root
Brickwright GUI dependency installation is needed. The dedicated
[workflow](../../.github/workflows/crispbasic.yml) tests both backends, parity,
and real Chromium workers on Ubuntu with Node 22 and the pinned SDK installer.
The recorded local results and their limits are in [VALIDATION.md](VALIDATION.md).

## A first program

```basic
total% = 0
FOR i% = 1 TO 10
    total% += i%
NEXT

IF total% = 55 THEN
    PRINT "Hello, CrispBASIC!"
ENDIF
END
```

Both numbered and unnumbered programs are accepted. Unnumbered physical lines
receive internal numbers, and diagnostics map those numbers back to the
original file and editor line. The wrapper does not translate the dialect or
rewrite keywords. BBCSDL itself tokenizes and executes the program, including
structured loops, procedures, functions, arrays and strings.

This first host accepts ASCII program syntax with Latin-1 text in quoted
strings and `REM` comments. Separate `REM` from preceding keywords (for example,
`THEN REM`) and quote non-ASCII `DATA` fields; the batch loader does not yet
recognize every upstream unquoted-literal form. The CLI reads UTF-8 text files
and refuses characters that cannot be represented, rather than silently
truncating them. Do not mix numbered and unnumbered statements. Explicit line
numbers must increase and lie in `1..65279`. Source preparation allows up to
4096 bytes per numbered source line; the interpreter separately checks the
255-byte tokenized record limit. The native loader bounds total prepared
source at 4 MiB. Unicode source beyond Latin-1 is a future capability.

## CLI

```sh
node bin/crispbasic.mjs examples/hello.bas
node bin/crispbasic.mjs my-program.bas --input answers.txt
node bin/crispbasic.mjs my-program.bas --timeout 1000 --max-output 65536 --json
```

Without `--input`, runtime input comes from standard input. Source loading and
input are separate streams, so a program can use `INPUT`, `GET` and `INKEY`
without accidentally consuming its own source. `--timeout` includes time spent
waiting for input. End of input is an explicit BASIC error.

Ordinary output is the raw VDU byte stream. JSON mode emits a single object
with `status`, `text`, `outputBase64`, backend identity, error information,
process exit information and duration. `text` is an exact Latin-1 decoding of
the bytes, including CR/LF and VDU control bytes; it is not a graphics renderer.

| Outcome | CLI exit |
| --- | --- |
| Normal completion | 0 |
| Explicit BASIC `QUIT n` | `n` modulo 256 |
| BASIC error, invalid source, or host failure | 1 |
| Deadline reached | 124 |
| Output limit reached | 125 |
| Cancelled / Ctrl-C | 130 |
| Closed downstream output pipe | 141 |

## Native session API

```js
import {createNativeSession} from './index.mjs';

const session = createNativeSession({
    timeoutMs: 5000,
    maxOutputBytes: 1024 * 1024,
    onEvent(event) {
        if (event.type === 'output') {
            // Uint8Array: feed a terminal or VDU decoder without UTF-8 conversion.
            process.stdout.write(event.bytes);
        }
    }
});

try {
    const result = await session.run('PRINT "Hello"\nEND\n', {
        filename: 'hello.bas'
    });
    console.log(result.status);
} finally {
    await session.dispose();
}
```

`run()` returns a result for execution outcomes: `completed`, `error`,
`cancelled`, `timeout`, `output-limit`, or `host-error`. Unhandled BASIC errors
carry `code`, `message`, `basicLine`, original `line`, and `filename`. An `ON
ERROR` handler stays inside the interpreter; a handled error need not become
a failed run. Error-like text printed by a program is ordinary output and
cannot masquerade as a completion record.

Invalid source rejects with `SourceError`, which has `code`, `filename`,
`line`, and `column`. Invalid options, concurrent `run()` calls on the same
session, and calls after disposal also reject. Different sessions use separate
native processes and can run concurrently. After a result the session is
`idle` and can be used again; each run has fresh interpreter memory.

For fixed input, pass `input: 'Ada\n'` or a `Uint8Array`. For interactive input,
pass `interactive: true`, call `session.writeInput('Ada\n')`, and eventually
`session.endInput()`. Input events announce line/key reads. The cumulative
input limit is 1 MiB per run. `writeInput` returns the stream's backpressure
boolean; it also accepts input before the child has started. Output events
and the final result contain the same bounded bytes.

Pass an `AbortSignal` to `run()`, or use `session.cancel()`. `await
session.reset()` cancels and waits for an active run; the next run starts
fresh. `await session.dispose()` also closes the session permanently. Limits
default to 5 seconds and 1 MiB of output. The parent terminates the native
process group on cancellation or a limit, including a blocked input call.

## WASM session API

```js
// Browser-safe entry: also works in Node.
import {createWasmSession} from './browser.mjs';

const session = createWasmSession({
    timeoutMs: 5000,
    maxOutputBytes: 1024 * 1024,
    onEvent(event) {
        if (event.type === 'output') {
            // Uint8Array, ready for a terminal or later VDU adapter.
            consumeBytes(event.bytes);
        }
        if (event.type === 'input') {
            // Obtain an answer asynchronously, then call writeInput().
        }
    }
});
try {
    const result = await session.run('PRINT "Hello from WASM"\nEND\n', {
        filename: 'hello.bas'
    });
    console.log(result.status, result.text);
} finally {
    await session.dispose();
}
```

The package exports `./browser` and `./wasm`; Node's main entry also exports
`createWasmSession`. Browser applications should import `./browser`, which does
not import the native process adapter. Serve browser assets over HTTP(S), with
`.mjs` as JavaScript and `.wasm` as `application/wasm`. The default module URL is
relative to this package's `.build/wasm/` directory. An embedding app can supply
`moduleURL` and `workerURL` for its own trusted asset layout. The WASM file must
remain beside the generated module. This build needs neither SharedArrayBuffer
nor cross-origin isolation headers.

`run`, `writeInput`, `endInput`, `cancel`, `reset` and `dispose` follow the native
API above, with the same execution statuses, source diagnostics and byte events.
Use `interactive: true` for asynchronous input. `writeInput()` copies bytes into
a bounded message queue and returns `true`; it does not expose stream
backpressure. The 1 MiB cumulative input cap, 4 MiB prepared-source cap, deadline
and output budget also apply to this backend. Time spent loading the module,
waiting for input or waiting for a simulation reply counts toward the deadline.

Every run owns a new worker and WASM instance. Asyncify preserves the C stack
across `INPUT`, `GET`, timed `INKEY` and `WAIT`, including recursive functions,
procedures and `ON ERROR LOCAL`. The parent terminates the worker on timeout,
cancellation or callback failure, even if BASIC is stuck in a tight loop. Run,
reset and dispose wait for worker termination before resolving. Separate
sessions can execute concurrently, and repeated runs share no BASIC variables.

### Opt-in BASIC simulation

Omitting `simulation` leaves the bridge disabled. `simulation: {}` creates a
fresh deterministic reference host for every run and installs the ordinary
`PROCpinMode`, `PROCdigitalWrite`, `FNdigitalRead`, `PROCdelay` and `FNmillis`
library in a separate interpreter library area:

```js
import {createWasmSession} from './browser.mjs';

const session = createWasmSession({simulation: {maxRequests: 128}});
try {
    const result = await session.run(`
PROCpinMode(0, "output")
PROCdigitalWrite(0, 1)
PROCdelay(25)
PRINT STR$(FNmillis)
END
`, {filename: 'pins.bas'});
    console.log(result.status, result.text); // completed, "25\r\n"
} finally {
    await session.dispose();
}
```

The C/WASM artifact must be rebuilt for this API: the worker checks
`crisp_simulation_abi() === 1` before enabling it. Older artifacts produce an
actionable host error. The native backend has no simulation bridge and explicitly
rejects a `simulation` option instead of silently ignoring it.

`simulation.createHost({signal, runId})` may synchronously return a custom fresh
host; its operation methods may return values or Promises. Each host belongs to
one run, receives cancellation through `signal`, and must provide bounded,
synchronous `dispose()`. Factories, disposal and synchronous method work must
return promptly so the parent event loop remains responsive. Deferred adapter
work must check cancellation/disposal before changing state. The session ignores
late replies and terminates its worker; it cannot undo an adapter's external
side effects. [SIMULATION.md](SIMULATION.md) defines the full ownership and
cancellation contract.

The default request budget is 4096, configurable from 1 to 1000000, including
`FNmillis` requests that do not create trace records. Request, trace, scheduled
input, simulated-time and adapter solver-work budget failures produce the parent-owned
`simulation-limit` outcome. Ordinary domain failures are catchable BASIC errors
`201..209`; unhandled bridge errors also carry `error.simulationCode`. User source
numbers and public library overrides retain their normal meanings. `TIME` and
`WAIT` continue to use the existing monotonic clock, independently of simulated
milliseconds.

## Current capabilities and boundaries

`session.capabilities` is an immutable description of the implemented backend.

| Area | Native | Restricted WASM |
| --- | --- | --- |
| Language engine | Pinned BBCSDL tokenizer and executor | Same pinned core, correct WASM32 ABI |
| Host | Linux x86-64 process | Browser module worker or Node worker thread |
| Execution | Fixed/interactive input, cancellation, deadline, output bound | Same, with Asyncify input/wait suspension |
| Diagnostics | Separate control channel; original editor-line mapping | Separate worker records; same source mapping |
| Output | Raw VDU bytes and Latin-1 text | Same |
| Graphics | No renderer or graphics-query emulation | Same; drawing commands emit raw VDU |
| Logical-pin simulation library | No bridge | Opt-in per-run host, bounded request/reply and deterministic reference implementation |
| Sound / physical GPIO | Not implemented | Not implemented; explicit unsupported-operation errors |
| Source debugger | Not implemented | Not implemented |
| Host files, native calls, raw memory | Retained for trusted local programs | Denied; virtual files also unavailable |
| Time | Host time | Monotonic `TIME`/`TIME=` and `WAIT`; no `TIME$` or event timers |
| App integration / physical boards | Planned | Code tab/VDU integration and opt-in Circuit board-solver connection; physical boards planned |

**The native backend is for trusted local programs.** It retains upstream
native memory, `SYS`/`CALL`, filesystem and OS facilities. A temporary working
directory, process isolation, and execution limits are useful lifecycle
controls; they do not create a security sandbox. It is not exposed as a web
service or wired into the learner-facing application.

**The restricted WASM profile exposes a deliberately smaller host contract.**
It rejects named and numeric `SYS`, `CALL`, `USR`, `OSCLI`/star commands, inline
assembly, file operations, memory indirection, pointer reassignment/queries,
address-of, indirect `FN`/`PROC`, memory-bound setters and `@system` variables
except numeric formatting `@%`. These checks run inside the actual evaluator
and executor, including expressions evaluated through `EVAL`. Raw internal
token bytes cannot be injected through `EVAL`. `ON ERROR` may catch ordinary
unsupported-operation errors; it cannot catch or defeat parent-owned limits.

WASM has a fixed 64 MiB linear-memory budget, including a 16 MiB BASIC arena
plus reserved interpreter space, C stack and Asyncify storage. No filesystem,
network, process or arbitrary-JavaScript capability is imported. The
`sandboxed: true` capability denotes this WebAssembly/worker host boundary;
it is not a claim that the upstream C interpreter is immune to faults inside
its own memory. Traps become host errors and the instance is discarded. Asset
URLs are trusted embedding-application configuration, not BASIC program input.

## How the pieces fit

- `src/source.mjs` normalizes source and records original line identity.
- `src/native-session.mjs` owns process lifetime, I/O, limits and result mapping.
- `src/wasm-session.mjs` and `src/wasm-worker.mjs` own WASM worker lifetime and I/O.
- `src/simulation-host.mjs` implements the deterministic logical-pin contract;
  `src/simulation-protocol.mjs` validates the bounded per-run worker channel.
- `native/crispbasic.c` loads source through the upstream tokenizer and supplies
  the batch host's raw VDU and input hooks.
- `native/patch-upstream.mjs` makes small, exact-match changes to generated
  upstream copies: headless entry, raw I/O, completion and error callbacks.
- `wasm/crisp-host.h` defines the restricted C embedding boundary;
  `wasm/crispbasic.c` replaces the OS/SDL host, and `wasm/emscripten-host.c`
  supplies the JavaScript byte/input/time/error and simulation-request hooks.
- `wasm/patch-upstream.mjs` applies exact-match runtime restrictions and retains
  the upstream WASM data layout without SDL tables or exposed function pointers.
- `upstream.lock.json` records the upstream revision and every input digest.
- `tests/` checks anchored expected results, native/WASM parity and failure paths
  against the real interpreter. Both backends share a core, so parity is not an
  independent language-implementation oracle.

The protocol uses stdin for input bytes, stdout for VDU bytes, stderr for host
diagnostics, and descriptor 3 for versioned JSON records. The host reports
completion only after the interpreter finishes, and the parent validates both
that record and the actual exit status. See [ARCHITECTURE.md](ARCHITECTURE.md)
for the path from this backend to the proposed common runtime.

## Provenance and naming

The pinned interpreter is Richard Russell's BBCSDL revision
[`6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f`](https://github.com/rtrussell/BBCSDL/tree/6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f),
the same revision used by Brickwright's existing external reference build.
**CrispBASIC** is the project's own name; BBC BASIC references describe language
compatibility and upstream provenance. No endorsement is implied.

Original wrapper code follows [BSD-3-Clause](LICENSE). BBCSDL retains its
original zlib notice, and generated modified files are marked. Read
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) before redistributing a build.

## Moving into its own repository

Keep core implementation, fixtures, notices and build logic inside this
directory. It does not import Scratch, React, `bw-board`, or root build tools.
When the separate repository is wanted, this subtree can be extracted with
its history; the small host CI workflow then needs its working-directory and
path filters adjusted. Until then, all work stays on the feature branch.
