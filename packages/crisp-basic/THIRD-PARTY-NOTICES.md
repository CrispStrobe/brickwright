# Third-party notices

## BBCSDL interpreter

CrispBASIC's native and restricted WASM backends build the BBCSDL interpreter by R. T.
Russell, pinned to commit `6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f` of
<https://github.com/rtrussell/BBCSDL>. The exact compiled inputs and SHA-256
digests are recorded in `upstream.lock.json`.

The upstream interpreter is distributed under the zlib licence. Its complete,
unmodified notice is preserved in `native/BBCSDL-LICENSE.txt` and copied next
to generated binaries as `.build/BBCSDL-LICENSE.txt` and
`.build/wasm/BBCSDL-LICENSE.txt`. The source headers retain
their upstream copyright notices. New CrispBASIC host code uses this package's
licence; it does not replace the upstream interpreter licence.

This is a modified host integration, not an unmodified upstream distribution.
`native/patch-upstream.mjs` and `wasm/patch-upstream.mjs` record patches to the generated source
copies, which are also marked as modified. The patches rename the startup
identity, replace console terminal/input hooks, suppress the upstream console
entry point, and preserve batch execution and structured errors after `ON ERROR`.
The interpreter's parser, expression evaluator, and language statement execution
are used from the pinned implementation. The WASM integration additionally
rejects host calls, raw addresses and system variables at execution/evaluation
boundaries, validates dynamic EVAL text, and removes the SDL-specific data and
function tables. The original WASM header/core data layout and notices remain.

The project is branded **CrispBASIC**. References to BBC BASIC describe language
compatibility and acknowledge the original implementation. The upstream README
states that its permission to use the BBC BASIC name is not transferable to a
derived or forked work. No endorsement by the BBC or upstream author is claimed.

## Emscripten and browser test tooling

The WASM build uses the separately installed Emscripten 3.1.64 toolchain. The
CI installer is pinned to emscripten-core/emsdk commit
`a7c808831a666cc903fedb906c171a718cd97341`. Emscripten's runtime/support code is
distributed under the [MIT and University of Illinois/NCSA licenses](https://github.com/emscripten-core/emscripten/blob/a1fe3902bf73a3802eae0357d273d0e37ea79898/LICENSE).
The toolchain's library components retain their own notices, including musl,
math-library source notices, dlmalloc and compiler-rt. Original notices and
Emscripten's author list are preserved in `wasm/licenses/`, with source references
and SHA-256 hashes in `wasm/toolchain.lock.json`. The builder verifies and copies
them to `.build/wasm/licenses/`. Preserve those notices when redistributing a
compiled module. A different compiler version requires updating and qualifying
the toolchain lock and its notices.

Playwright 1.62.1 is a locked development dependency for the real browser test
harness and is Apache-2.0 licensed. It is not imported or shipped by the runtime
API. A Chromium installation is required only to execute the browser tests.

esbuild 0.25.12 (MIT) is a locked development dependency used to transform the
actual Brickwright JSX renderer and parse the editor during integration tests.
It is not imported or shipped by the runtime API.

## Other build tools and proposed backends

GCC, NASM, Git and Node.js are build/runtime tools obtained separately and are
not vendored into this package. No Matrix Brandy, PicoBB, SDL or Box2D runtime
is linked by either backend. Additional backends need their own pinned dependency
records and notices when implemented.
