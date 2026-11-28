# Executable and offline web bundles

`crispbasic bundle` embeds the original program and the BBCSDL interpreter. It
does not compile BASIC statements or introduce a second BASIC implementation.
Output comparisons therefore establish **packaging parity**, separately from
the independent implementation evidence required for `crispbasic compile`.

## Default full SDL profile

`bundle` defaults to the upstream graphical SDL host. It embeds the interpreter
and source in a Linux application, or all JavaScript/WASM/source/resources in
one offline HTML document:

```sh
npm run build:sdl:native
node bin/crispbasic.mjs bundle prog.bas -o prog
./prog

EMCC=/path/to/emcc npm run build:sdl:web
node bin/crispbasic.mjs bundle prog.bas --target web -o prog.html
node bin/crispbasic.mjs serve prog.html
```

Use `--runtime-pack DIR` for a verified target pack and repeat
`--asset FILE=PATH` to embed resources relative to the program directory.
Native applications require ordinary system libraries and drivers; their
embedded runtime extracts into a private directory that permits execution.
The threaded browser host requires loopback HTTP with isolation headers, supplied
by `serve`; no Internet access is required after building. It retains upstream
browser platform limits, including no native assembler or unrestricted native
OS calls. The absent optional upstream Box2D module is reported explicitly.

[SDL-BUNDLING.md](SDL-BUNDLING.md) and [SDL-WEB.md](SDL-WEB.md) describe full-host
builds, resource resolution, direct-source comparison, graphics/audio evidence
and platform limits. The following sections describe the explicit `headless`
profile, which remains useful for raw console and `file:` execution.

## Explicit headless native executable

Build the native interpreter once, then create a program executable:

```sh
npm run build:native
node bin/crispbasic.mjs bundle examples/hello.bas --profile headless -o hello
./hello
./hello --bundle-info
```

The output is one ELF executable containing the interpreter, prepared Latin-1
BASIC source, source-line map, capability manifest, and software notices. It
needs neither Node.js nor a separate `.bas` file when run. It loads its payload
from `/proc/self/exe` directly into memory; it does not extract source into a
temporary directory. Renaming or moving the executable does not affect loading.
Normal Linux system shared libraries are still required; this is not a fully
static Linux distribution or a container. Relative files opened by the BASIC
program continue to use the process working directory, just as source execution
does. External application data and BASIC libraries are not automatically found
or bundled.

`INPUT`, `GET`, and `INKEY` use standard input. Standard output remains the
original VDU byte stream, including CR/LF and nonprinting bytes. An unhandled
BASIC error goes to standard error and returns exit status 1. `QUIT n` returns
`n & 255`. `--bundle-info` prints the embedded manifest and retained notices
without running the program.

### Linux CPU targets

Each target needs its own interpreter binary. Cross builds require the selected
GCC and its target system libraries, as described in [CPU-EMULATION.md](CPU-EMULATION.md).

```sh
CRISP_BASIC_TARGET=linux-arm64 CC=aarch64-linux-gnu-gcc npm run build:native
node bin/crispbasic.mjs bundle prog.bas --profile headless --target linux-arm64 -o prog-arm64

CRISP_BASIC_TARGET=linux-armv7 CC=arm-linux-gnueabihf-gcc npm run build:native
node bin/crispbasic.mjs bundle prog.bas --profile headless --target linux-armv7 -o prog-armv7
```

The bundler checks ELF class, machine identity, and the ARMv7 hard-float flag.
It rejects an interpreter without bundle ABI v1, an already bundled executable,
and a binary that disagrees with its adjacent build receipt. `--runtime PATH`
selects an explicit built interpreter; it cannot silently select another CPU.

## Explicit headless offline HTML page

```sh
npm run build:wasm
node bin/crispbasic.mjs bundle prog.bas --profile headless --target web -o prog.html
```

Open `prog.html` directly in a modern browser. The single file contains the
WASM binary, Emscripten JavaScript factory, worker code, protocol definitions,
program, and notices. It creates module workers from embedded data URLs and passes
the embedded WASM bytes directly to the factory. No server, CDN, service worker,
or network fetch is needed. The page has run, stop, line-input, end-input, and
raw-output-download controls. The visible console is a text view; **Save output
bytes** preserves the complete original byte stream.

The generated page also exposes an automation interface:

```js
const result = await window.crispbasicBundle.run({input: "Ada\nx", interactive: false});
result.output; // Uint8Array, unmodified VDU bytes
result.status;
result.exitCode;
window.crispbasicBundle.metadata;
```

An interactive run accepts `writeInput(stringOrUint8Array)`, `endInput()`, and
`stop()`. Each run creates a fresh worker/interpreter instance. Input is limited
to 1 MiB and output to 16 MiB per run. The page imposes no wall-clock deadline;
Stop terminates a blocked or looping worker. `--module PATH` and `--wasm PATH`
select explicitly supplied trusted runtime assets. An adjacent `build.json`
receipt, when present, must match both assets.

## Headless capability boundary

Explicit headless artifacts retain the existing console/restricted profiles:

| Feature | Native bundle | Web bundle |
| --- | --- | --- |
| BBCSDL language core, procedures/functions, EVAL, structured control flow | Retained | Retained within the restricted host |
| Text and raw VDU output | Yes | Yes |
| Native calls, OS commands, file access, inline assembler | Existing native console facilities | Unavailable in the restricted host |
| Rendered SDL graphics, sound, advanced display/input state | Not provided by the existing native console host | Not provided by the existing restricted host |
| Separate interpreter or Node.js at run time | No | No |
| Separate program file | No | No |

The headless profiles do not provide the full SDL application.
SOUND/ENVELOPE and other documented unsupported features keep the
same explicit errors as direct execution. See [native/README.md](native/README.md)
and [wasm/README.md](wasm/README.md) for the complete host boundaries.

Use the default `sdl` profile for the full upstream graphical host. Its browser
threading requirements are why it uses the isolated local server instead of
the headless page's `file:` route. Manifests distinguish these profiles.

Bundled headless native execution has no session wrapper deadline, output
budget or cancellation API. Its metadata reports all three as unavailable.
The headless page reports its actual Stop/output-limit controls and no deadline;
neither bundle advertises an unavailable simulation bridge.

## Output safety and reproducibility

Without `--output`, `prog.bas` produces `prog` for a native target or `prog.html`
for web, in the source directory. Existing outputs require `--force`. The
source and runtime paths are never valid output destinations. Output is prepared
in a sibling temporary directory and installed atomically. Source validation
uses the same `prepareSource` function as direct execution, retaining physical
source-line diagnostics and explicit BASIC line numbers.

The output includes source/runtime SHA-256 digests and no build timestamp.
Identical source, runtime assets, title, notices, and options produce identical
bytes. Output paths are excluded from the embedded manifest. Runtime receipts
identify the upstream revision when available; an unreceipted custom runtime
is explicitly recorded with `upstreamCommit: null`.

## Evidence

```sh
node --test tests/bundle.test.mjs
node --test tests/bundle-native.test.mjs
node scripts/test-bundle-browser.mjs
npm run test:bundle:sdl-native
npm run test:bundle:sdl-web
```

Native tests run both the source and the bundle and compare raw output bytes
and exit statuses on the shared interpreter corpus. They also cover EVAL,
relocation, execution without PATH/Node, preserved notices, malformed overlay
lengths, and runtime diagnostics. The same tests accept the existing
`CRISP_BASIC_TEST_NATIVE_*` cross-target/QEMU settings.

The browser harness loads the **actual** WASM runtime, builds each corpus case
into a `file:` page, disables browser networking, compares its bytes against
direct source execution and fixed expected anchors, and asserts that no HTTP
request occurred. It additionally checks interactive input, cancellation, and
fresh runs. It requires Playwright Chromium and the built WASM assets; it does
not count mocked assets or skipped tests as runtime evidence.

Only BBCSDL code and its published build files are used for the interpreter
route. No proprietary BASIC compiler source is used or studied.
