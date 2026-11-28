# Full SDL offline web bundles

The `sdl` web profile packages the pinned BBCSDL WebAssembly host, the BASIC
program, licence notices and explicit resources in one HTML document. It keeps
BBCSDL's SDL display, graphics, audio, keyboard input, virtual filesystem and
WebAssembly SYS wrappers. The program is interpreted by BBCSDL; this is distinct
from the independent C99 compiler.

The document needs a local HTTP server with cross-origin isolation headers,
because BBCSDL's SDL host uses shared-memory worker threads. It does not fetch
runtime, program or resource sidecars. Once loaded, it can execute with browser
network access disabled. The separate `headless` web profile supports `file:`
URLs with its documented, restricted host capabilities.

## Build and run

Install the version pinned in `wasm/toolchain.lock.json`, Emscripten 3.1.64, then:

```sh
EMCC=/path/to/emsdk/upstream/emscripten/emcc npm run build:sdl:web
crispbasic bundle demo.bas --profile sdl --target web --output demo.html
crispbasic serve demo.html
```

Open the printed loopback URL and press **Start**. The user gesture enables audio
under browser autoplay rules. Click the canvas for keyboard input. **Stop**
terminates the interpreter workers and pauses audio. **Restart** reloads the
document and creates a fresh runtime. The canvas remains visible after `END`.

Ordinary execution has no imposed duration or output budget. **Capture output
bytes** is unchecked by default. Optional capture retains raw VDU bytes for
comparison or download and stops with a diagnostic if its 16 MiB capture buffer
fills. A program can be restarted with capture disabled for unbounded execution.

The server binds to loopback and sends:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

Serving the page elsewhere requires equivalent headers and a secure browser
context. Opening this profile through `file:` produces an actionable server
diagnostic instead of attempting to start unsupported shared-memory workers.

## Reproducible runtime pack

`scripts/build-sdl-web.mjs` reads BBCSDL commit
`6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f`. Every selected source and header must have
a matching SHA-256 in `sdl/upstream.lock.json`. The script copies the selected
files to its build directory, applies the small transport patches and compiles
them without modifying the upstream checkout. No proprietary compiler source is
used.

The build uses Emscripten's pinned SDL2, SDL2_ttf, SDL2_net and their dependencies.
It retains their notices, BBCSDL's notice, bundled image/audio source notices,
and the Emscripten/libc notices. The build receipt records the compiler, flags,
upstream hashes, local build-input hashes, runtime hashes and capabilities.

`-fno-delete-null-pointer-checks` preserves BBCSDL's wasm32 address-offset aliasing
model. Without this flag LLVM can replace overlapping string moves with copies
that corrupt values. This flag is shared with the restricted WASM build.

The default runtime pack is `.build/sdl-web`. Set
`CRISP_BASIC_SDL_WEB_OUTPUT` when building to choose another directory, or pass
`--runtime-pack` when bundling. `CRISP_BASIC_UPSTREAM` can name an existing BBCSDL
Git checkout; the same commit and file-hash checks still apply. The Emscripten
module itself supplies the pthread worker entry point through an embedded Blob
URL. Its generated dummy `.worker.js` file is not a runtime dependency.

Every runtime file is hash-checked before packaging. The bundler validates Latin-1
source through the shared source preparation code, limits prepared source to
4 MiB and total embedded input bytes to 128 MiB, preserves the source map, and
requires the BBCSDL notice. It writes output atomically and refuses to overwrite
source, assets, the receipt or runtime inputs, including symlink aliases.

## Application resources

```sh
crispbasic bundle demo.bas --target web --profile sdl \
  --asset ./data/input.bin=data/input.bin \
  --asset ./fonts/example.ttf=fonts/example.ttf \
  --output demo.html
```

Each asset is copied byte-for-byte into the document and created at the named
relative path in the runtime's virtual root before BASIC starts. `/program.bas`
is the prepared program; `/lib` is available for explicitly supplied libraries.
BBCSDL's `@dir$` identifies the program directory. Its library path is `/lib/`.
Native host filesystem paths are not available to a web program.

Paths must be relative POSIX paths without empty, `.` or `..` components,
backslashes or NUL. Duplicate names and file/directory collisions are refused.
`program.bas`, and the `dev`, `proc`, `tmp` and `usr` roots are reserved for the
program and runtime. Symlinks in a runtime pack cannot escape that pack.

The built-in bitmap font remains available. Additional fonts, tokenized BASIC
libraries and data are explicit assets; the bundler does not guess dependencies
or redistribute an unverified font collection. Supply the applicable resource
licences with the application. Files created by BASIC live in the browser's
virtual filesystem. BBCSDL's browser-local persistence facilities retain their
upstream behavior; storage permissions and lifetime remain browser-controlled.

The Node API uses the same implementation as the CLI:

```js
import {bundleSDLWeb} from './src/bundle-sdl-web.mjs';

const result = await bundleSDLWeb(source, {
    filename: 'demo.bas',
    output: 'demo.html',
    runtimePack: '.build/sdl-web',
    title: 'My BASIC program',
    assets: [{source: './data/input.bin', path: 'data/input.bin'}],
    overwrite: false
});
console.log(result.path);
```

## Platform boundaries

This is the full **WebAssembly** SDL host, with its real upstream platform
differences. It does not claim native operating-system parity:

- Upstream WebAssembly rejects machine-code inline assembly, `CALL` and `USR`.
- `SYS` resolves the upstream WebAssembly wrapper table. It cannot load a native
  shared object or call arbitrary native addresses.
- The optional `Box2D231.o` object is absent from the pinned source tree. Its
  name/address entry is removed together, so `SYS "B2D_GetProcAddress"` reports
  the ordinary unknown-SYS error. It is not replaced by a successful no-op.
- Files, networking, clipboard, audio activation and storage follow the browser
  host's capabilities and permission rules.

These capabilities and limitations are embedded in the page metadata and visible
in its runtime information panel. Native SDL bundles provide the native host
route; see [SDL-BUNDLING.md](SDL-BUNDLING.md).

## Browser API and byte evidence

The generated page exposes `window.crispbasicSDL`:

```js
const result = await crispbasicSDL.run({input: 'Ada\n', capture: true});
// result: {status, exitCode, output: Uint8Array, captured, error}
const generatedFile = crispbasicSDL.readFile('/result.bin');
```

`run()` can start once per page load. Calling it again returns the existing
completion promise. `writeInput(text)` waits for the initialized keyboard queue
and feeds Latin-1 input, translating line endings to the carriage returns BASIC
expects. Input is limited to 1 MiB per call. `stop()` ends an active run. The
`status`, `exitCode`, `output`, `captured`, `errors` and `metadata` getters expose
execution and diagnostic information. Source-loader and initialization failures
resolve the completion promise with a failure status and diagnostic, even though
Emscripten keeps its browser runtime alive.

When capture is enabled, `output` is the exact VDU byte sequence, including NUL,
control bytes and bytes above 127. The preview is a human-readable rendering;
**Download output.bin** preserves the original bytes. Capture does not replace
the SDL display or suppress its event queue. Without capture, ordinary output
continues to the canvas and the byte array remains empty.

## Validation

```sh
TMPDIR="$PWD/.build/tmp" node --test tests/bundle-sdl-web.test.mjs
TMPDIR="$PWD/.build/tmp" npm run test:bundle:sdl-web
```

The browser script is `scripts/test-sdl-web-browser.mjs`. It uses Playwright and
Chromium. `CRISP_BASIC_PLAYWRIGHT` can name a module or absolute module entry path;
`CRISP_BASIC_CHROMIUM` selects a browser executable, and
`CRISP_BASIC_SDL_WEB_PACK` selects the runtime pack.

The browser corpus runs the full host with separate JS, WASM, source and asset
URLs as its reference. It then runs the generated single page with networking
disabled and requires byte-identical captured output and matching exit status.
Fixtures exercise EVAL, raw memory, structured code, graphics point readback,
SYS, keyboard input, binary assets and generated files, actual nonzero PCM audio,
arbitrary VDU bytes, explicit Box2D and assembler errors, stop behavior, default
unbounded execution and source-loader failure. The bundle page must make exactly
one HTTP request: its own document.

These are packaging parity checks against the same BBCSDL implementation. They
do not establish independent compiler correctness or exhaustive support for
every BBC BASIC program. The C99 compiler's separate native and binary64
differential suites compare its independently implemented semantics with BBCSDL.
