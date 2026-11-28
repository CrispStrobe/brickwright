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

## bw-board GPIO profile catalog

The generated `src/board-target-catalog.mjs` contains the canonical GPIO profile
data from `CrispStrobe/bw-board`, commit
`cda715c16d4b733ceb73f7720a236b5ea9e3f21d`, source `src/portable-gpio.js`.
The catalog records that source's exact Git blob identity and is verified by
`scripts/sync-board-targets.mjs`. The standalone runtime does not include the
upstream electrical solver. The upstream MIT notice is reproduced unmodified:

```text
MIT License

Copyright (c) 2026 CrispStrobe

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
