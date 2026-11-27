# Validation records

## Circuit board adapter milestone

Version `0.1.0-dev.5`, recorded on 2026-11-27 on `feature/crispbasic`.
The implementation is in
[`18ac9b8eae55`](https://github.com/CrispStrobe/brickwright/commit/18ac9b8eae55812fa6cfe9e11135a81170c45d83).
The GUI-owned adapter and Code tab connection are specified in
[BOARD-SIMULATION.md](BOARD-SIMULATION.md). The prior bridge-only milestone is
retained below as historical evidence.

**Both jobs in the [qualification run](https://github.com/CrispStrobe/brickwright/actions/runs/46072459728)
completed successfully: 484 tests passed, with zero failures, cancellations or
skips.** Local qualification separately reported 403 passing tests that overlap
the CI suites. Browser execution is CI evidence, not local browser evidence.

### Implemented boundary

The Code tab explicitly enables the connection with **Connect Circuit**. The
run acquires the actual canvas board, maps one supported GPIO controller, drives
and senses the pinned electrical solver and advances it through checked,
cooperative `advanceToLive` batches. Run time is relative to the existing board
clock; controls and electrical history are not reset. Output reads sense the
electrical solution, including contention, rather than the logical latch.

The GUI handoff and solver clock lease have separate ownership identities.
Cancellation, completion, stale acknowledgements, board replacement, external
pin takeover and exceptional cleanup are tested. Debugger/Pico startup
reservations and retained-debugger mutation guards prevent competing execution.
The existing CAD handoff now uses an owner identity and does not modify a board
whose clock request was rejected or never acknowledged.

The solver pin remains `cc18f3c8d84d68e008450e65ddf838b8ec03c7f7`. No interpreter
C source, build input, upstream pin, toolchain pin or binary ABI changed. The
JavaScript parent additionally recognizes adapter `solver-limit` as an
uncatchable `simulation-limit` outcome.

### CI results and build provenance

The run completed on 2026-11-27 at 21:54:59 UTC against implementation commit
`18ac9b8eae55812fa6cfe9e11135a81170c45d83`:

| Suite | Passed |
| --- | ---: |
| Source preparation, reference host and bridge protocol/lifecycle | 100 |
| Native runtime and CLI | 41 |
| Actual WASM execution, restricted-host policy and simulation bridge | 147 |
| Native/WASM corpus with fixed expected bytes | 10 |
| Real Chromium engine workers | 18 |
| GUI adapter, editor, assets, board host/session and generated-source integration | 126 |
| Shared board ownership and existing CAD bridge/cancellation | 30 |
| Real Chromium editor-control, renderer and Circuit integration | 12 |
| **CI total** | **484** |

The native job reports 141 passes and the WASM job 343. Every suite has zero
failures, cancellations and skips; the standalone native example also completed
with exit code zero. All four new Chromium Circuit cases passed on the first
qualification run; no CI-specific implementation correction was required.

CI rebuilt both interpreter backends from the pinned BBCSDL source. The WASM
job used Node 22.23.5, npm 10.9.9, Emscripten 3.1.64 and Chromium headless shell
151.0.7922.34; Playwright is lock-pinned to 1.62.1. The rebuilt WASM is 215771
bytes, SHA-256
`cc73c82adb438276eba4edbbea6519f2d6e2191dbafb2f2b7a79ef55c397e3ba`.
The generated JavaScript module is 43705 bytes, SHA-256
`f13f7b99726c4b7455362b2b6d9446f296bc927a3caead31a7dd1b01f8506655`.
Both files match the locally qualified modules byte for byte. The downloaded
CI artifact `15234165869` was verified against GitHub's archive SHA-256
`4077e594a6b041469d32ad5b13e7583cca9256416efdfbc6288711fa43111642`.
Packaging and its check command passed for all 20 manifest-listed assets.

### Local results and provenance

| Suite | Passed |
| --- | ---: |
| Source preparation, reference host and bridge protocol/lifecycle | 100 |
| Actual WASM execution, restricted-host policy and simulation bridge | 147 |
| GUI adapter, editor, assets, board host/session and generated-source integration | 126 |
| Shared board ownership and existing CAD bridge/cancellation | 30 |
| **Local total** | **403** |

The 126 GUI/integration tests comprise 14 asset checks, 15 runner checks, 34
editor/VDU checks, 18 actual-solver host checks, 29 circuit-session/ownership
checks and 16 actual-WASM integration cases. The separate consumer group
contains 25 CAD cancellation cases, one CAD bridge case and four existing
one-board/run cases. These totals count each reported test once; the same
tests overlap the corresponding CI suites; they are not additional distinct
tests.

The actual-WASM circuit cases run BASIC through the production GUI runner and
the pinned solver. They verify an Uno LED carrying approximately 13 mA through
a 220-ohm resistor, external-button sensing, an exact 25 ms delay, repeat-run
clock origin and preserved controls, partial delay cancellation, parent-owned
time and solver budgets, reentrant Stop-all during a pin write, and foreign-pin
takeover during blocked BASIC input. Host tests separately cover Pico's 3.3 V
drive on a 5 V bench and electrical output contention.

This sparse workspace used Node 24.22.3. Emscripten, NASM and the actual local
Chromium binary were unavailable. The browser attempt failed at its launch
prerequisite; no local compilation, native execution or browser pass is claimed.
Local WASM execution used the successful prior
[CI artifact from `5be2b6971fc8`](https://github.com/CrispStrobe/brickwright/actions/runs/46063340172),
verified against GitHub's archive SHA-256
`7f86c28edd35030db496cddfd946e66421f1efadb5d8841c5702a119e25db7ab`.
Packaging authenticated all current C/build inputs, upstream locks, generated
JavaScript/WASM hashes, imports and notices. The unchanged WASM binary is
215771 bytes, SHA-256
`cc73c82adb438276eba4edbbea6519f2d6e2191dbafb2f2b7a79ef55c397e3ba`.
All 20 browser payload assets and their manifest pass the staging check.

The browser additions mount the real editor controls and the production
Circuit tab clock-owner callback with the actual solver and WASM worker. Four
new cases exercise connection/LED/button/time, Stop and reuse, absent-board
refusal followed by plain BASIC, and replacement-board isolation. Whole editor
JSX, the extracted harness/owner callback and the browser dependency graph pass
esbuild checks. This remains focused integration qualification, not a complete
production GUI bundle build, full VDU implementation, general electrical-model
validation, other-browser qualification or physical-board test.

Review found and fixed reentrant cancellation, swallowed cleanup failures,
stale-owner release, asynchronous startup races and foreign GPIO takeover
leaving unrelated BASIC outputs driven. A pre-existing one-board source
assertion was updated to allow the debugger's existing optional immediate pause
between `session.start()` and its clock-origin assignment; its executable clock
regression also passes. Changed overlay/package source mirrors match and
`git diff --check` passes.

### Reproduction

From the repository root, after preparing the documented dependencies and
building/staging the WASM artifact:

```sh
npm --prefix packages/crisp-basic test
npm --prefix packages/crisp-basic run test:wasm
npm --prefix packages/crisp-basic run test:brickwright
node --test test/circuit-cad-cancellation.test.mjs \
  test/circuit-cad-bridge.test.mjs test/b8-one-board-per-run.test.mjs
npm run package:crispbasic:check
npm --prefix packages/crisp-basic run test:browser
node scripts/verify-crispbasic-browser.mjs
```

The dedicated workflow additionally rebuilds both interpreter backends and
runs the native and fixed-output parity suites. The authored
[circuit blink example](examples/circuit-blink.bas) is intended for the Code tab
with **Connect Circuit** enabled and an actual supported Uno/Nano circuit.

## Bounded BASIC simulation bridge milestone

Version `0.1.0-dev.4`, recorded on 2026-11-27 on `feature/crispbasic`.
The implementation is in
[`3357efb0bb27`](https://github.com/CrispStrobe/brickwright/commit/3357efb0bb2742852a75a4b8a1d2448a88d69c75),
with the EVAL source-provenance follow-up in
[`de1f11cda40b`](https://github.com/CrispStrobe/brickwright/commit/de1f11cda40b9f742e10ba2185dae3b639b766ed).
**Both jobs in the follow-up's [qualification run](https://github.com/CrispStrobe/brickwright/actions/runs/46062100678)
completed successfully: 388 tests passed, with zero failures or skips.**
The opt-in bridge and adapter contract are described in
[SIMULATION.md](SIMULATION.md). The Circuit canvas, board solver and physical
hardware are outside this milestone.

### Environment and build provenance

| Component | Qualification environment |
| --- | --- |
| CI host | GitHub Actions Ubuntu 24.04, Linux x86-64 |
| CI Node | 22.23.5 |
| Local Node | 24.22.3, Linux x86-64 |
| Emscripten | 3.1.64 (`a1fe3902bf73a3802eae0357d273d0e37ea79898`) |
| Playwright | 1.62.1 |
| Chromium headless shell | 151.0.7922.34 |
| BBCSDL | `6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f` |

CI rebuilt both real interpreter backends. The final WASM binary is **215771
bytes**, with SHA-256
`cc73c82adb438276eba4edbbea6519f2d6e2191dbafb2f2b7a79ef55c397e3ba`.
Its build record verifies nine local build inputs, six pinned upstream inputs,
24 allowed imports and five toolchain notice files. The additional host import
is the dedicated asynchronous scalar simulation hook; no file, process,
network, native-call or arbitrary JavaScript capability was added. Packaging
and its check command passed for 20 manifest-listed payload assets plus
`manifest.json`, including both simulation JavaScript modules.

This workspace began with about 353 MiB of free disk and used a sparse
checkout. Emscripten and NASM were unavailable locally, so **no local compilation
is claimed**. The final CI artifact was downloaded, checked against its archive
digest, and authenticated through the packaging checks against the current
local build inputs, locks, generated-module/WASM hashes, imports and notices.
The real WASM suites then passed locally under Node 24.22.3. The standalone
`examples/run-simulation.mjs` printed `Before: 1` and `After: 0 at 25 ms`, with
the expected eight-event final trace and a disposed host.

### Results

| Suite | Tests reported | Result |
| --- | ---: | --- |
| Source preparation | 13 | Passed |
| Deterministic simulation-host contract | 13 | Passed |
| Bounded bridge protocol and JavaScript worker lifecycle | 73 | Passed |
| Native runtime and CLI | 41 | Passed |
| Existing WASM runtime and restricted-host policy | 120 | Passed |
| Real C/WASM simulation library, lifecycle and EVAL provenance | 27 | Passed |
| Native/WASM corpus with fixed expected bytes | 10 | Passed |
| Real Chromium engine workers, including five simulation cases | 18 | Passed |
| GUI adapter, editor controls and asset packaging | 56 | Passed |
| Generated source and GUI adapter through the staged WASM runtime | 9 | Passed |
| Real Chromium editor-control and renderer integration | 8 | Passed |
| **CI total** | **388** | **Zero failures or skips** |

The CI commands report combined groups of 99, 41, 147, 10, 18, 65 and 8 tests,
respectively. Local source/host/protocol/packaging checks reported 113 passes;
local real-WASM execution/policy/simulation checks reported another 147 passes.
These **260 local checks overlap the CI total** and are not additional distinct
tests. All local runs had zero failures or skips.

The 73 protocol tests use the production JavaScript worker with an explicitly
synthetic module for ABI/message tests; they do not establish C-stack behavior.
The separate real-WASM and Chromium tests establish stack preservation across
recursive calls, delayed simulation replies, `ON ERROR LOCAL`, nested EVAL and
error/exit unwinding. They also cover exact expected pin/time traces, strict
scalar arguments and results, one pending request, IDs and ownership, fresh
hosts across runs, cancellation/reset/disposal, stalled replies, stale replies,
parent-owned request/trace/input/time limits, and retained SYS/memory/file/EVAL
restrictions. Millisecond reads consume the request budget even without adding
trace records. Resource failures never become catchable BASIC replies.

Review corrected sparse argument-array validation, duplicate terminal records
after malformed replies, and unprintable host exceptions that could otherwise
escape cleanup. Regression cases pass. All changed upstream patches were also
applied against exact SHA-256-verified pinned inputs; JavaScript syntax and
`git diff --check` passed.

The initial bridge's [382-test run](https://github.com/CrispStrobe/brickwright/actions/runs/46060839892)
passed before additional real-artifact probes found missing authored locations
inside EVAL. Two targeted regression tests reproduced that defect against the
initial binary. The follow-up retains a scoped authored origin across temporary
expression tokens and restores it before forwarding errors, `END` or `QUIT`.
Five new WASM tests and one new Chromium test pass against the rebuilt artifact,
covering nested/local-error recovery, multiple replies, authored function-body
locations, recursive evaluation and exit forwarding. Normal simulation-disabled
EVAL keeps its existing environment behavior.

This is focused runtime, packaging and editor-shell qualification. It is not a
production GUI bundle build, complete VDU compatibility claim, board-solver
qualification, physical-device test, or full-repository test-suite result.
Other browser engines and native desktop/mobile shells remain unqualified.

### Reproduction

From the repository root, the checks requiring no compiled backend are:

```sh
node --test test/crispbasic-assets.test.mjs \
  packages/crisp-basic/tests/source.test.mjs \
  packages/crisp-basic/tests/simulation-host.test.mjs \
  packages/crisp-basic/tests/simulation-bridge.test.mjs
```

With the pinned Emscripten SDK, GCC/NASM and the documented root/package
JavaScript dependencies prepared, reproduce the CI suites:

```sh
npm --prefix packages/crisp-basic run build:native
npm run build:crispbasic
npm run package:crispbasic:check
npm --prefix packages/crisp-basic test
npm --prefix packages/crisp-basic run test:native
npm --prefix packages/crisp-basic run test:wasm
npm --prefix packages/crisp-basic run test:parity
npm --prefix packages/crisp-basic run test:browser
npm --prefix packages/crisp-basic run test:brickwright
node scripts/verify-crispbasic-browser.mjs
node packages/crisp-basic/examples/run-simulation.mjs
```

Install Playwright Chromium first or use the documented browser executable
and module overrides. [README.md](README.md), [wasm/README.md](wasm/README.md)
and [BRICKWRIGHT.md](BRICKWRIGHT.md) describe dependency and deployment setup.

## Brickwright integration milestone

Local validation recorded on 2026-11-27 for version `0.1.0-dev.3`, on
`feature/crispbasic`. Usage, architecture and the scope of the integration are
documented in [BRICKWRIGHT.md](BRICKWRIGHT.md). The earlier engine milestone is
preserved below as a separate historical record.

### Environment

| Component | Tested version |
| --- | --- |
| Host | Linux x86-64 |
| Node | 24.22.3 |
| GCC | 14.2.0 (Debian 14.2.0-19) |
| NASM | 2.16.01 |
| Emscripten | 3.1.64 (`a1fe3902bf73a3802eae0357d273d0e37ea79898`) |
| Playwright | 1.62.1 |
| Chromium headless shell | 151.0.7922.34 |
| React / React DOM | 18.3.1, from the root lockfile |
| esbuild | 0.25.12 |
| BBCSDL | `6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f` |

The unchanged native builder and the WASM builder both completed against the
pinned upstream source. The WASM file is 210,635 bytes and has SHA-256
`1c1322a8ac209f925a35be6b8c722ac63736ae627c750d2fcfe042b3a9c5b6e5`,
identical to the earlier engine milestone. The build record additionally
captures the generated JavaScript digest and nine local build inputs. It
continues to verify six upstream inputs, 23 allowed imports and five toolchain
notice files. Packaging and its check command passed for all 18 staged assets.

### Results

| Suite | Tests reported | Result |
| --- | ---: | --- |
| Source preparation | 13 | Passed |
| Deterministic simulation-host contract | 13 | Passed |
| Native runtime and CLI | 41 | Passed |
| WASM runtime and restricted-host policy | 120 | Passed |
| Native/WASM corpus with fixed expected bytes | 10 | Passed |
| Real Chromium engine workers | 13 | Passed |
| GUI adapter, editor controls and asset packaging | 56 | Passed |
| Generated source and GUI adapter through the real staged WASM runtime | 9 | Passed |
| Real Chromium editor-control and renderer integration | 8 | Passed |
| **Focused total** | **283** | **Zero failures or skips** |

The 56 GUI/packaging tests comprise 14 adapter, 28 editor/renderer and 14 asset
checks. They cover cancellation during lazy import, stale events, reset
reentrancy, final output committed after React batching, conversion warnings,
source ownership and Z80 numbering refusal before ROM loading. The Node
integration suite executes the real generator's output against fixed expected
bytes, including graphics, recursive input, error positions, output limits and
unsupported-operation boundaries.

The eight browser integration cases load the actual C/WASM runtime and mount
the real editor lifecycle methods and control JSX with the real `VduTerminal`
inside a small React shell. They verify deferred asset loading below a URL
prefix, a rendered MOVE/DRAW line and an identical second run, recursive line
input, Latin-1 key input and EOF handling, responsive Stop during a tight loop,
Reset and reuse, filename/physical-line diagnostics, actionable missing-engine
feedback, and worker cleanup on unmount. These are actual worker/DOM/canvas
checks, not a production GUI bundle or an end-to-end test of every Code tab
feature. The original 13 engine browser cases also passed independently.

An additional 41 existing editor ownership/device tests and 46 related
localization, mirror and workflow tests passed. `scripts/check-mirrors.mjs`,
full importer/renderer JSX transformation, and `git diff --check` passed.

A broader, separately attempted repository gate-wiring audit
(`node --test test/gate-coverage.test.mjs`) reported 13 passes and one failure:
37 unrelated existing CAD, circuit-artwork, costume, gallery and robot browser
scripts are not wired into the gate locations that audit expects. The new
`verify-crispbasic-browser.mjs` is wired into `crispbasic.yml` and is absent from
that failure list. Those unrelated gates were not changed. This record does
not claim a clean run of the full repository test suite.

### Reproduction

From `packages/crisp-basic`, with the native toolchain and Emscripten 3.1.64
available:

```sh
npm ci --ignore-scripts
npm run build:native
npm run build:wasm
npm run test:all
npx playwright install chromium
npm run test:browser
```

Then, from the repository root:

```sh
npm ci --ignore-scripts
npm run package:crispbasic
npm run package:crispbasic:check
npm --prefix packages/crisp-basic run test:brickwright
node scripts/verify-crispbasic-browser.mjs
node scripts/check-mirrors.mjs
```

`test:brickwright` reports 65 tests: the 56 GUI/asset tests and nine real-runtime
integration cases. The local browser runs used `CRISP_BASIC_CHROMIUM` to select
the recorded Chromium build and `TMPDIR` to select a writable temporary
directory. The workflow installs its own Playwright Chromium, uses Node 22 on
Ubuntu 24.04, and remains a separate qualification.

### CI and remaining boundaries

The earlier engine run
[46047287661](https://github.com/CrispStrobe/brickwright/actions/runs/46047287661)
completed successfully. The first published integration run
[46052067221](https://github.com/CrispStrobe/brickwright/actions/runs/46052067221)
was still queued when this record was written. Check the current branch's
Actions run before claiming CI success for this milestone. The dedicated
workflow includes all focused runtime and integration gates and uploads its
generated runtime/build record for inspection.

Chromium is the only qualified browser engine. Full production GUI bundling,
complete VDU screen/graphics semantics, graphics queries, virtual files, source
debugging, a BASIC-to-circuit bridge, circuit physics and physical boards are
outside this qualification. The deterministic host contract is executable and
tested, but deliberately advertises `basicBridge: false`, `hardware: false`
and `circuitPhysics: false`. No interpreter restriction was relaxed to add it.

## Restricted WASM milestone baseline

Local validation recorded on 2026-11-27 for version `0.1.0-dev.2`.
These are local results. GitHub Actions is configured independently and its
live run must be checked before claiming CI success.

### Environment

| Component | Tested version |
| --- | --- |
| Host | Linux x86-64 |
| Node | 24.22.3 |
| GCC | 14.2.0 |
| NASM | 2.16.03 |
| Emscripten | 3.1.64 (`a1fe3902bf73a3802eae0357d273d0e37ea79898`) |
| Playwright | 1.62.1 |
| Chromium headless shell | 156.0.8078.79 |
| BBCSDL | `6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f` |

The workflow uses Node 22 on Ubuntu 24.04. That CI environment is a separate
qualification from the local Node 24 results recorded here.

### Results

| Suite | Tests reported | Result |
| --- | ---: | --- |
| Source preparation | 13 | Passed |
| Native runtime and CLI | 41 | Passed |
| WASM runtime and restricted-host policy | 120 | Passed |
| Native/WASM corpus with fixed expected bytes | 10 | Passed |
| Real Chromium workers | 13 | Passed |
| **Package total** | **197** | **Zero failures or skips** |

The WASM count includes grouped policy subtests. Its runtime cases exercise
interactive input through recursive functions inside procedures, `ON ERROR
LOCAL` after suspension, GET/INKEY and CRLF handling, WAIT/TIME, output limits,
hard deadlines, cancellation, repeat-instance isolation, concurrent sessions,
observer failures and malformed worker messages.

Policy checks verify actual BASIC errors for host calls, file operations,
address access, pointer retargeting, system variables, host events, sound and
screen queries. Regression checks cover constructed EVAL token bytes, while
ordinary EVAL, Latin-1 literals, arrays, structures, functions and formatting
retain their expected behavior. Ordinary restriction errors remain catchable
with ON ERROR; parent-owned deadlines and termination do not depend on it.

Browser tests use real module workers over HTTP without cross-origin isolation.
They verify page responsiveness during tight BASIC loops and verify that workers
are gone after completion, cancellation, reset and disposal. They also test
delayed recursive input, output bytes, error mapping and simultaneous sessions.

The ten parity cases compare each backend with a fixed expected byte sequence,
then compare the two results. They exercise the same BBCSDL implementation and
are not evidence from an independent language implementation.

Thirty-five repository workflow checks also passed:

```sh
node --test test/ci-workflow-inputs.test.mjs \
  test/workflow-concurrency-isolation.test.mjs \
  test/workflow-step-refs.test.mjs
```

### Reproduction

From `packages/crisp-basic`, with both toolchains available:

```sh
npm run build:native
npm run build:wasm
npm run test:all
npm ci --ignore-scripts
npx playwright install chromium
npm run test:browser
node examples/run-wasm.mjs
```

The local browser run used the documented `CRISP_BASIC_PLAYWRIGHT` and
`CRISP_BASIC_CHROMIUM` overrides to select installed tools. The standalone WASM
example printed the anchored structured-program result successfully.

The final locally tested WASM artifact was 210,635 bytes, with SHA-256
`1c1322a8ac209f925a35be6b8c722ac63736ae627c750d2fcfe042b3a9c5b6e5`.
The builder recorded six verified upstream inputs, 23 allowed runtime imports,
and five preserved toolchain notice files. These measurements describe this
build; another qualified toolchain/host may produce different binary bytes.

### Boundaries

The browser engine is qualified here in Chromium only. Brickwright adapters,
other browser engines, graphics rendering/queries, virtual files, source
debugging, GPIO and physical-board execution are not implemented or validated
by these results. WASM/worker isolation restricts the host boundary; it does not
prove the upstream C interpreter free of faults within its own linear memory.
