# CrispBASIC compiler harness repair — 2026-11-28

Base: integration `a8073ac67107d3ffcc15c479fb524c92832f94c9`.
Failure: [WASM job 141105541170](https://github.com/CrispStrobe/brickwright/actions/runs/46185877636/job/141105541170).

The hosted integration suite had two failures. The browser-shell extractor still
matched the former BASIC Run condition, before compiled profiles gained a
separate Compile BASIC action. The UI routing test also treated Arduino Uno as
unsupported, although the integration explicitly added its `bbc-c99` profile.

The extractor now reads the actual Run condition and keeps the new Compile
control. Its shell imports the real compiler adapter and includes the production
compile method, generation options and document projection dependency, so that
control has a working handler. The focused browser server stages the existing
five-file locked compiler package and serves it under the same URL prefix as the
interpreter package. Two additional browser cases exercise successful compilation
with preserved authored BASIC and a physical-line `EVAL` refusal. They also
require the compiler route to avoid loading interpreter assets. Existing browser
cases, timeouts and lifecycle assertions remain unchanged.

The routing regression now checks Uno's compiled profile, exact source dispatch
to Compile, and absence of interpreter or stale 8086 execution. Its unsupported
machine control uses Arduino Mega and still requires no compiler or interpreter
dispatch. The Node shell regression calls the real compiler adapter and vendored
compiler for native and Uno, verifies the retained BASIC/document revision and
derived C, and includes a negative control that removes the actual projection
import.

Local verification:

- `node --test test/crispbasic-ui.test.mjs test/crispbasic-browser-harness.test.mjs test/crispbasic-compiler.test.mjs`: 67 passed, no skips.
- `node --test test/crispbasic-compiler-package.test.mjs`: 3 passed, no skips.
- Production editor JSX and generated shell both parse with pinned esbuild
  0.25.12. The shell retains the same three pre-existing duplicate-method warnings;
  the production component has none.
- The existing staged compiler package verified all five size/SHA-256 entries
  against immutable `550f8396fdb652a1a14e3635681244d2d21e59dc`.
- `node --check scripts/verify-crispbasic-browser.mjs` and `git diff --check` passed.

Local Chromium is blocked at startup by the executor's socket restriction. The
16 focused browser cases, including the two additions, remain pending the exact
composed commit's hosted WASM gate. The shared production gate is repaired in
the separate prerequisite branch and must also pass on the composed head. This
repair changes no application source, supplier/vendor file or compiler lock.
