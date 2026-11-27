# CrispBASIC

CrispBASIC is a BBC BASIC-compatible runtime project, incubated in Brickwright
on `feature/crispbasic`. It is intended to become an independent repository.

**This first milestone runs real BASIC through the pinned BBCSDL C interpreter
on Linux x86-64.** It adds a headless batch host, a Node session API, a CLI,
source maps, and execution tests. Browser/WASM, physical boards, graphics
rendering, the portable hardware library, and source debugging are subsequent
milestones, not implemented platform claims.

## Try it

Requirements: Linux x86-64, Node 22 or newer, Git, GCC and NASM. On Debian/Ubuntu
the native build tools are available as `build-essential` and `nasm`.

```sh
cd packages/crisp-basic
npm run build:native
node bin/crispbasic.mjs examples/hello.bas
node bin/crispbasic.mjs examples/structured.bas --json
npm run test:all
```

No npm dependencies or root Brickwright installation are needed. The builder
fetches the exact upstream commit and verifies SHA-256 for every input file.
Generated sources, objects, the native executable and build metadata stay in
`.build/`. Use `CC` or `NASM` to select an installed compiler/assembler. An
existing BBCSDL checkout can be supplied through `CRISP_BASIC_UPSTREAM`; the
builder reads the locked Git objects, not its working-tree edits.

`npm test` runs source preparation tests without a toolchain. `npm run
test:native` requires the built interpreter and runs actual runtime and CLI
tests; an absent binary is a failure, never a passing skip. The dedicated
[workflow](../../.github/workflows/crispbasic.yml) builds and tests the package
on Ubuntu with Node 22.

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

## Session API

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

## Current capabilities and boundaries

`session.capabilities` is an immutable description of the implemented backend.

| Area | This milestone |
| --- | --- |
| Language engine | Pinned BBCSDL C core; original tokenizer and executor |
| Native host | Linux x86-64, one interpreter per process |
| Execution | Batch, fixed/interactive input, cancellation, deadline, output bound |
| Diagnostics | Separate protocol channel; original editor-line mapping |
| Output | Raw VDU bytes and a Latin-1 text view |
| Graphics | Bytes can be handed to a renderer; no renderer or graphics-query emulation |
| Sound | Explicitly unsupported |
| GPIO / portable hardware library | Not implemented |
| Source debugger | Not implemented; stepping, breakpoints and variable inspection are false |
| Browser, desktop/mobile shells | No WASM/app embedding yet |
| PicoBB / other MCU targets / BASIC-to-C | Planned |

**The native backend is for trusted local programs.** It retains upstream
native memory, `SYS`/`CALL`, filesystem and OS facilities. A temporary working
directory, process isolation, and execution limits are useful lifecycle
controls; they do not create a security sandbox. It is not exposed as a web
service or wired into the learner-facing application. The WASM milestone
needs an explicit host boundary before it becomes the in-app default.

## How the pieces fit

- `src/source.mjs` normalizes source and records original line identity.
- `src/native-session.mjs` owns process lifetime, I/O, limits and result mapping.
- `native/crispbasic.c` loads source through the upstream tokenizer and supplies
  the batch host's raw VDU and input hooks.
- `native/patch-upstream.mjs` makes small, exact-match changes to generated
  upstream copies: headless entry, raw I/O, completion and error callbacks.
- `upstream.lock.json` records the upstream revision and every input digest.
- `tests/` checks anchored expected results and failure paths against the real
  interpreter. These tests are not an independent implementation oracle.

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
