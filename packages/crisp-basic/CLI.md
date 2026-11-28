# CrispBASIC on native hosts and portable Node workers

Running a source file selects either of the two existing interpreter backends.
Both execute the same BBC BASIC-compatible source through the pinned BBCSDL
core. Backend selection is explicit; a failed native launch never silently
changes to a runtime with different host capabilities.

| Backend | Build and execution target | Host behavior |
| --- | --- | --- |
| `native` (default) | Linux x64, ARM64 or ARMv7 hard-float; GCC/binutils, plus NASM on x64 | A fresh process per run, optionally through an explicit CPU emulator; raw VDU output, trusted local OS/file/native-call access |
| `wasm` | Node.js 22+ with WebAssembly and module workers | A fresh worker/module per run, raw VDU output, restricted host, optional logical-pin simulation |

Linux ARM64 uses the existing pinned upstream ARM64 assembler and data layout;
it does not emulate x86 instructions. This covers a Linux ARM64 process on an
ARM64 computer, including a suitably configured Raspberry Pi. The ARMv7 port
uses the distinct upstream ARM32 layout for a 32-bit hard-float Linux userspace.
`--native-executable PATH`, `--native-runner PATH` and repeated
`--native-runner-arg=VALUE` select a cross-built executable and QEMU CPU runner.
See [CPU-EMULATION.md](CPU-EMULATION.md) for builds, sysroots and exact scope.
Bare-metal
microcontrollers and retro CPU emulators need separate target runtimes.
The WASM runner needs its built `.mjs` and `.wasm` assets but no native BASIC
executable. Its logical-pin fixture is independent of the GUI Circuit solver.

## Bundle and compile commands

The existing interpreter command remains `crispbasic [options] program.bas`.
Two explicit subcommands produce artifacts:

```sh
crispbasic bundle program.bas --target linux-x64 -o program
crispbasic bundle program.bas --target web -o program.html
crispbasic serve program.html
crispbasic bundle program.bas --profile headless --target web -o console.html
crispbasic compile program.bas -o program
crispbasic compile program.bas --emit-c -o program.c
crispbasic compile program.bas --target arduino-uno -o program.hex
crispbasic compile program.bas --target pico --pico-sdk /path/to/pico-sdk -o program.uf2
```

`bundle` defaults to the full SDL host. Build it with `npm run build:sdl:native`
or `npm run build:sdl:web`; `--runtime-pack DIR` selects a matching verified
pack. Repeated `--asset FILE=PATH` arguments embed application resources.
The web output includes all JavaScript, WASM and resources in one HTML file.
`serve` binds loopback only and provides the isolation headers needed by its
threaded runtime; no Internet access is required after building. Use `--port 0`
to select an available port, and Ctrl-C to stop the server.

Explicit `--profile headless` uses `build:native` / `build:wasm` and the old
`--runtime`, `--module`, `--wasm` asset selectors. Its restricted web page also
works directly from `file:`. See [BUNDLING.md](BUNDLING.md),
[SDL-BUNDLING.md](SDL-BUNDLING.md) and [SDL-WEB.md](SDL-WEB.md) for the exact
platform boundaries and output evidence.

`compile` writes a self-contained C99 translation unit and invokes the target
C toolchain unless `--emit-c` is given. `--cc` selects GCC/AVR GCC by executable
path, without a shell. `--json` returns artifact hashes, target information and
validation status; a successful build is labelled `build-only` until a separate
simulation or hardware test has actually run. Unsupported BASIC is rejected
before output is written. See [COMPILER.md](COMPILER.md) and
[COMPILING-BOARDS.md](COMPILING-BOARDS.md) for the subset, numeric profiles and
board toolchain requirements.

## Run and inspect

From the repository root:

```sh
npm run build:native
node bin/crispbasic.mjs examples/structured.bas --json

npm run build:wasm
node bin/crispbasic.mjs --backend wasm examples/structured.bas --json
node bin/crispbasic.mjs --backend wasm --capabilities
node bin/crispbasic.mjs --backend native --capabilities
```

The capability query prints one JSON record without reading BASIC source or
launching an interpreter. It describes the selected implementation, including
host access and simulation support; it does not assert that build artifacts
are installed. `--capabilities` takes no source file or `--input` option.

Both backends accept `--input FILE`, `--timeout MS`, `--max-output BYTES`,
`--json`, `--help` and `--version`. Without `--input`, runtime input comes from
stdin and EOF is forwarded to the interpreter. The source file has a separate
channel. Noninteractive native input is available before the child starts, so
an immediate `INKEY(0)` can observe the supplied bytes deterministically.

Text mode writes original VDU bytes. JSON mode emits exactly one execution
result with `status`, `backend`, `text`, `outputBase64`, diagnostics and any
mapped source error. The Latin-1 `text` view preserves VDU byte values and is
not a graphics renderer. Capability discovery and fixture validation do not
need a built engine; execution fails clearly when a required artifact is absent.

## Named board targets

Use `--list-targets` for the complete JSON catalog and
`--backend wasm --target NAME` to run with the exact admitted logical pins of
a board profile. The requested families accept `8051`, `stc15`, `stm32`,
`pico`/`rp2040`, `nano`, `esp8266`/`8266`, `microbit` and `microbit-breakout`.
This is host-driven logical simulation, with no MCU firmware execution or
physical hardware. The broad names select STM32F030 and the classic AVR Nano.

```sh
node bin/crispbasic.mjs --list-targets
node bin/crispbasic.mjs --backend wasm --target pico --capabilities
node bin/crispbasic.mjs --backend wasm --target nano \
  --simulation examples/board-targets/nano.json examples/board-targets/nano.bas --json
```

With a named target, fixture pins and stimuli may use exact terminal names.
A fixture may restrict the target's pin set but cannot expand it. Capabilities
and JSON run results include the canonical target and active terminal map.
See [BOARD-TARGETS.md](BOARD-TARGETS.md) for all targets, alias boundaries,
API usage and executable examples.

## Deterministic logical-pin fixtures

```sh
node bin/crispbasic.mjs --backend wasm \
  --simulation examples/simulation.json examples/simulation.bas --json
```

The included fixture drives the example's input pin low after 25 simulated
milliseconds. A fixture has this shape:

```json
{
  "schemaVersion": 1,
  "pins": [0, 1],
  "maxRequests": 100,
  "maxTimeMs": 1000,
  "maxTraceEvents": 4096,
  "maxScheduledInputs": 4096,
  "inputs": [
    {"pin": 1, "value": 0, "atMs": 25},
    {"pin": 1, "value": null, "atMs": 50}
  ]
}
```

`schemaVersion` must be `1`. Other fields are optional. Defaults come from
the [simulation host](SIMULATION.md): logical pins `0..7`, 4096 requests,
4096 trace records, 4096 queued inputs and a maximum simulated time of
2147483647 milliseconds. Pin IDs are integers in `0..65535`, with 1–256
distinct IDs. Inputs specify a configured pin, level `0`/`1` or `null` to
release it, and a nonnegative integer timestamp within the configured limit.
Unknown fields, duplicate pin IDs, invalid levels, excess queue entries and
unsupported schema versions are rejected before a worker starts.

All inputs are scheduled, including records at time zero. They take effect
when BASIC calls `PROCdelay`, in chronological order and in listed order for
equal timestamps. Call `PROCdelay(0)` to apply initial time-zero stimuli.
`FNmillis` reads time without advancing it; `TIME` and `WAIT` retain their own
existing runtime clock semantics. The host uses retained digital output
latches and has no voltage, analog, PWM, interrupt or circuit-physics model.

With `--json`, a simulated run includes:

- `simulation.capabilities`: the exact logical pins and resource ceilings;
- `simulation.elapsedMs`: the final completed simulated time;
- `simulation.trace`: bounded records in execution order, retained after
  host disposal even when execution ends with a BASIC error or resource limit.

The trace describes completed operations only. A rejected over-budget request
does not invent an output transition. Each CLI invocation gets a fresh host;
fixtures cannot contain executable hooks or connect to physical equipment.

Use `--backend wasm --simulation FILE --capabilities` to validate a fixture
and inspect its host capabilities without executing BASIC.

## Completion and cancellation

Normal completion returns exit 0; `QUIT n` preserves `n` modulo 256. Source,
BASIC and host errors return 1, deadlines 124, output/simulation resource limits
125, cancellation 130 and a closed output pipe 141. Simulation limits remain
terminal even inside `ON ERROR`. Native and WASM execution both wait for their
owned process/worker to terminate before the CLI finishes.

POSIX SIGINT/SIGTERM cancel an active session. A signal received while the
CLI is reading source also prevents the subsequent run. Platform operating
systems may forcibly terminate a process rather than deliver a POSIX signal;
the JavaScript session API provides explicit `cancel()` independently.

## Qualification

The workflow's native matrix builds and runs the actual interpreter on Linux
x64 and ARM64. Tests check the ELF architecture and receipt hash, structured
language behavior, source diagnostics, input and process lifetime. The WASM
CLI suite requires a real built module and covers output bytes, file/piped
input, restricted operations, diagnostics, timeout/output/request limits,
fixture validation, repeatable traces and POSIX cancellation. Missing engine
artifacts fail qualification. See [VALIDATION.md](VALIDATION.md) for completed
run evidence rather than treating an available build path as a passing port.
The portable CLI matrix downloads the same Ubuntu-built artifact by commit SHA
on Linux ARM64, macOS ARM64 and Windows x64. It runs capability/fixture checks
and real CLI programs there without a native interpreter, compiler, dependency
install or GUI build. The Linux x64 WASM job executes that suite as well.
