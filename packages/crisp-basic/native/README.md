# CrispBASIC native host

This is the first working backend: a headless, single-process BBCSDL interpreter
for **Linux x64**. It consumes a prepared BASIC source file, writes the original
VDU output bytes, and reports completion separately from program output. It is
the actual pinned interpreter, with a small host patch recorded in
`patch-upstream.mjs`.

## Build

Install GCC, NASM, Git and Node.js, then run from the package root:

```sh
node scripts/build-native.mjs
```

`CC` and `NASM` may specify alternative executable paths. The build fetches the
exact upstream commit into `.build/BBCSDL` and obtains each source directly from
the pinned git object. It checks every source's SHA-256 against
`upstream.lock.json` before patching a separate copy under `.build/native`.
Uncommitted changes in the upstream checkout cannot enter the build.
`CRISP_BASIC_UPSTREAM` can name an existing local BBCSDL git checkout containing
the pinned commit. The build output is `.build/crispbasic-native` with the
upstream licence and toolchain metadata alongside it. Generated files are not
committed. This pins the source inputs; binaries can differ between toolchains.

## Process protocol, version 1

```text
crispbasic-native numbered-program.bas
```

| Channel | Content |
| --- | --- |
| Argument 1 | Latin-1 source file with increasing line numbers in `1..65279` |
| Standard input | Runtime `INPUT`, `GET` and `INKEY` input only |
| Standard output | Raw VDU bytes, including ordinary printed text |
| Standard error | Host diagnostics, such as incorrect command-line usage |
| File descriptor 3 | One JSON object per line; input requests and final result |

Example success event:

```json
{"type":"result","version":1,"status":"completed","exitCode":0}
```

Example unhandled BASIC error:

```json
{"type":"result","version":1,"status":"error","exitCode":1,"error":{"code":18,"message":"Division by zero","basicLine":30}}
```

Before blocking line/key input, the host emits
`{"type":"input","version":1,"method":"line"}` or `method:"key"`.
It does not echo supplied input. Line endings may be LF or CRLF. Runtime EOF
raises BASIC error 254 (`End of input`) and can be handled with `ON ERROR`.
`INKEY` returns `-1` on timeout or a closed input stream; unsupported negative key-state queries return 0,
matching the upstream console backend. Inputs are bounded to 255 bytes per line.

The host emits exactly one result for orderly completion. `END`, falling off
the program, and an error handler which finishes with `END` return completed
with code 0. `QUIT n` returns completed with `n & 255` as both the protocol and
process exit code. Unhandled BASIC or loader errors return status `error` and
process code 1. A crash or external termination can end without a result; the
parent session must distinguish that from successful completion. Error text
is JSON-escaped Latin-1 and the source map is applied by the JS session.

## Source and language behavior

The JS frontend supplies numbering for structured, unnumbered source. The
native loader accepts compact numbered lines (`10PRINT ...`) and empty numbered
lines as well. It uses upstream `lexan` to tokenize and rejects any record over
255 bytes including its three-byte header and terminating CR. The original
text line may be up to 4096 bytes; keyword tokenization can make its internal
record considerably shorter. Total source input is limited to 4 MiB.

Tabs used as source whitespace become spaces before tokenization. Tabs inside
quoted strings or comments are preserved. NUL/control bytes and non-ASCII
source bytes outside strings/comments are rejected. The public JS loader also
validates its Latin-1 and control-byte contract before launching the process.
Use quoted non-ASCII `DATA` fields and a separator before `REM` (for example,
`THEN REM`); the current batch loader's validation does not recognize every
upstream unquoted-literal form.

`ON ERROR` runs inside the interpreter. A callback captures only an unhandled
error, so ordinary program output never needs to be scraped for error messages.
The batch decision is retained independently of the upstream prompt flag,
because an error handler changes that flag. There is no startup banner or REPL.

## Current limits

This is a **trusted local execution backend**, not a security sandbox. It retains
upstream native `SYS`, `CALL`, memory access, assembly and file/OS facilities.
The interpreter process has the user's OS permissions. The parent manages
timeouts, cancellation and output limits by terminating the process; those
limits are not a security boundary against deliberately hostile native calls.

Graphics commands can emit VDU bytes, but this host does not render graphics.
It tracks ordinary text cursor motion for `POS`/`VPOS`; graphics readback,
display geometry and advanced terminal state are not implemented. SOUND and
ENVELOPE raise an explicit unsupported-feature error instead of being silent
upstream console no-ops. The input implementation is a stream without an
interactive terminal line editor or function-key emulation.

No debugger, physical GPIO, mobile/desktop packaging, or WASM build is delivered
by this host. Their interfaces and implementations will be developed in later
milestones. Interpreter globals remain isolated by using one process per run.
