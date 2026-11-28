# Validation records

## Explicit portable generator boundary

The owning producer is qualified at
[`sb3-creator@0b2224b75baa6492fcc77118a54780174b116f42`](https://github.com/CrispStrobe/sb3-creator/commit/0b2224b75baa6492fcc77118a54780174b116f42)
on `feature/crispbasic-generator`. Its
[hosted qualification run, 46104135534](https://github.com/CrispStrobe/sb3-creator/actions/runs/46104135534),
passed all **299 tests**, with zero failures or skips. The suite includes 39
portable-generation tests, 23 reader/CLI tests, and 237 existing generation,
source-map and trace checks. The exact adopted revision appears in
`vendor-pins.json`, both compiler mirrors and the generated authoring inventory.

This producer branch starts at the previous consumer pin. Its only gallery
reconciliation preserves Brickwright's existing `busch-microtronic-wired-io`
entry and three files, byte-for-byte identical to their already-published
producer source from `312fa6b0feb72fd18fef8a6b865f708642acad9f`. No consumer
gallery entry is deleted or changed. The official pin sync, subsequent sync
check and mirrored-fact check pass. All 21 mapped producer files match the
adopted source after the sync's documented import rewrites. The SPIKE artifact
test passes at the new exact pin.

### Consumer hosted qualification

The integration implementation is
[`73370eb148c8`](https://github.com/CrispStrobe/brickwright/commit/73370eb148c8833b20e464e5576f1e33b206c386)
on `feature/crispbasic`. **All three jobs in
[run 46104769080](https://github.com/CrispStrobe/brickwright/actions/runs/46104769080)
passed: 544 tests, zero failures, cancellations or skips.** The run completed on
2026-11-28 at 04:58:52 CET. Both interpreter backends were rebuilt from the
unchanged pinned source. The runtime package remains `0.1.0-dev.5`; only the
owning generator's existing dependency pin advances in this milestone.

| Suite | Passed |
| --- | ---: |
| Source preparation, reference host and bridge protocol/lifecycle | 100 |
| Native runtime and CLI | 41 |
| Actual WASM execution, restricted-host policy and simulation bridge | 147 |
| Native/WASM comparisons against fixed expected results | 10 |
| Real Chromium engine workers | 18 |
| GUI adapter, assets, editor, board host/session, generated source and conversion | 176 |
| Shared board ownership and existing CAD bridge/cancellation | 30 |
| Focused Chromium editor, renderer and Circuit integration | 12 |
| Complete production GUI in Chromium | 10 |
| **CrispBASIC CI total** | **544** |

The separate
[BASIC oracle run, 46104769121](https://github.com/CrispStrobe/brickwright/actions/runs/46104769121),
also passed all nine fixtures, comparing the emulated BBC BASIC engine with
BBCSDL and Matrix Brandy. Those fixtures and the producer's 299 tests are
separate from the 544-test consumer total.

The complete CAD/FPGA-enabled production build used Node 24.22.3 and webpack
5.96.1 and finished in 126556 ms. Its three existing warnings concern a
Microtronic CSS recommendation and bundle/entrypoint sizes. The asset gate
authenticated all 20 runtime payload assets, three entry scripts and 562 lazy
JavaScript chunks for build `73370eb`. The runtime jobs used Node 22.23.5,
Emscripten 3.1.64 and lock-pinned Playwright 1.62.1 / Chromium 151.0.7922.34.

The two additional production scenarios passed through the actual CodeMirror
editor and Code/Circuit controls. The portable program first pauses for INPUT,
then advances the owned electrical solver by exactly 25000000 ns, observes the
expected LED-current range and pauses again without advancing the clock. Its
completed run releases pin and clock ownership. **To blocks** then reports the
portable-call refusal while preserving the editor source and serialized project.
The toggle scenario retains the legacy hardware comment by default, refuses
portable generation, and keeps Run disabled even after a newline edit to the
error banner; conversion preserves the project and no interpreter is loaded.
All eight earlier production scenarios also passed.

The production job downloaded and verified its same-run WASM artifact
`15246234590` against archive SHA-256
`8c3182c5c7646a95caf7fbb9c9a90077de65c72f02bb9a5476b1093dd1a6870a`.
The [production evidence archive](https://github.com/CrispStrobe/brickwright/actions/runs/46104769080/artifacts/15247127299)
contains the browser report, screenshots, build/asset identities and logs.
GitHub records artifact `15247127299` as 624598 bytes, archive SHA-256
`7cc38c7e90dba4d4b46800827f45b22bddf46f45dfe3c105b74f6d42ad9b8bcb`.
Artifacts retain the workflow's seven-day lifetime; this source record and
reproduction commands remain in the repository.

### Local checks before consumer CI

The final pinned compiler passed the complete 176-test Brickwright integration
suite, including 11 conversion/editor/CLI guards and 13 new actual-WASM
generator cases. Ten separate producer-identity, mirror-sync and SPIKE tests
also passed. The local interpreter is the authenticated, unchanged WASM from
run 46078751114 recorded below; its recipe matches the current runtime inputs.
The 27 existing editor-ownership tests also passed. The complete production
GUI built locally, and its asset check passed for all 20 runtime assets,
three entry scripts and 562 lazy chunks. No local native rebuild or local
Chromium execution is claimed; browser qualification is the hosted evidence above.

The generator cases verify logical polarity and raw electrical writes,
single-evaluation numeric and Boolean normalization, saved pin metadata and
numeric scalar state, structured and numbered timing, half-up millisecond
rounding, timer reset, and block-mapped refusal before an invalid delay advances
time. They also verify the independent bridge opt-in and the reverse refusal.
The editor guards retain refusal after whitespace edits to a generated error
banner or reopening it from a file; removing the banner permits authored BASIC.
The actual pinned Uno/solver fixture reaches exactly 25000000 ns and the
expected LED current. A separate clamp fixture demonstrates output latch `1`
with solved read `0`; toggle generation refuses with no executable source.

This qualifies the reverse path as an explicit refusal, not a portable-library
round trip. Other browsers, physical hardware, broader Scratch semantics and
an output-latch/toggle extension remain separate work. The historical production
result below records the earlier eight-scenario milestone.

## Production GUI qualification

This milestone adds a complete production webpack build and a Chromium gate
to the dedicated CrispBASIC workflow. The interpreter package remains at
`0.1.0-dev.5`: no runtime API, C source, ABI, upstream pin or toolchain pin is
changed. The English and German BASIC help now describe the existing digital
Circuit bridge rather than saying all GPIO is unavailable.

The production job consumes the exact WASM artifact built by the same workflow
run, prepares the normal vendored/overlaid GUI with its committed lockfile and
builds with CAD and FPGA enabled. It authenticates every emitted CrispBASIC
asset against the build recipe and records the production entry/chunk hashes.
The separate browser gate serves only the emitted build and uses real editor
and Circuit controls. Reproduction is in [BRICKWRIGHT.md](BRICKWRIGHT.md#complete-production-gui-gate).

### Corrected qualification run

The snapshot/ownership correction is
[`4696ea34514f`](https://github.com/CrispStrobe/brickwright/commit/4696ea34514f5c8f7259d482e942312d0237df34).
**All three jobs in its [qualification run, 46078751114](https://github.com/CrispStrobe/brickwright/actions/runs/46078751114),
completed successfully: 518 tests passed, with zero failures, cancellations or
skips.** The run finished on 2026-11-27 at 22:55:07 UTC. This includes the complete
production webpack bundle and all eight full-app Chromium scenarios, including
the formerly failing circuit-file replacement case.

| Suite | Passed |
| --- | ---: |
| Source preparation, reference host and bridge protocol/lifecycle | 100 |
| Native runtime and CLI | 41 |
| Actual WASM execution, restricted-host policy and simulation bridge | 147 |
| Native/WASM comparisons against fixed expected results | 10 |
| Real Chromium engine workers | 18 |
| GUI adapter, assets, editor, board host/session, model guards and generated source | 152 |
| Shared board ownership and existing CAD bridge/cancellation | 30 |
| Focused Chromium editor, renderer and Circuit integration | 12 |
| Complete production GUI in Chromium | 8 |
| **CI total** | **518** |

The runtime jobs used Node 22.23.5, npm 10.9.9 and Emscripten 3.1.64. Chromium
151.0.7922.34 is installed from lock-pinned Playwright 1.62.1. The current-run
WASM artifact `15236138049` was downloaded and authenticated against GitHub's
archive SHA-256
`713a78f4f41663b32945908fa853d9f651a27b8ab2e6b75286a9c716c8cc84cb`.
Its 215771-byte WASM and 43705-byte generated JavaScript match the prior
milestone's hashes below and the locally tested bytes exactly. The packaging
recipe also authenticates the current source/build inputs and all 20 payload
files plus their manifest.

The production job used Node 24.22.3, npm 11.19.1 and webpack 5.96.1. The complete
CAD/FPGA-enabled build finished in 125249 ms. The asset gate authenticated all
20 CrispBASIC payload assets and recorded three entry scripts and 562 lazy
JavaScript chunks for build identity `4696ea3`. The three webpack warnings
concern an existing Microtronic CSS recommendation and asset/entrypoint sizes;
they do not report a CrispBASIC asset-integrity or loader failure.

The [production evidence archive](https://github.com/CrispStrobe/brickwright/actions/runs/46078751114/artifacts/15236255878)
was downloaded and authenticated: 368431 bytes, artifact `15236255878`, SHA-256
`cfdc711d7f44548c244ba432dbf0ee5ffc40a94fba87d2ca614a2e2a8bc1350f`.
It contains the browser result JSON, asset hashes, build identity, manifest,
environment, logs and screenshots. `result.json` reports the exact implementation
commit, eight expected/eight passed scenarios, no failures and no uncaught page
errors. These Actions artifacts have seven-day retention; source, reproduction
commands and this qualification record remain in the repository.

### Production browser coverage

The Chromium gate drives the complete emitted application through its actual
CodeMirror editor, native file choosers and Code/Circuit controls:

1. Generate BBC BASIC from blocks, verify exact output, and load the interpreter
   only on Run beneath a non-root hosting prefix.
2. Import authored `.bas` source, retain physical diagnostic lines, and preserve
   Latin-1 data and recursive input suspension.
3. Render fixed VDU pixels consistently on identical repeated runs.
4. Stop a tight loop, reset the editor and run again without stale workers.
5. Import a supported Circuit, exercise GPIO/pull-up/time semantics, and release
   pin/clock ownership on completion and repeated runs.
6. Stop and replace a circuit file while BASIC waits for input, verifying old
   and replacement pins, worker termination, no late output and subsequent reuse.
7. Refuse a missing supported board, then run ordinary BASIC successfully.
8. Report an intentionally missing runtime with the build instruction and no
   alternate-engine fallback.

The real electrical observation records 13.01447490740977 mA through the Uno's
220-ohm LED fixture after exactly 25000000 ns. It confirms that the displayed
board and runtime board are identical. The replacement evidence records D13
actively driven high, an input prompt and both ownership layers still live
immediately before import. After import, both the old board and the replacement
have only input-mode pins and no external-clock lease. The fresh run starts
`FNmillis` at zero. The assertion that caught the initial bug was not relaxed.

This qualifies CrispBASIC in the complete Chromium web GUI at a 1600 × 1000
desktop viewport, served beneath `/workbench/`. Service workers are explicitly
blocked for fresh-network evidence. The replacement case alone uses the existing
dedicated-Circuit-tab preference to prevent tab navigation from cancelling the
run before file import; the other connected case retains the default layout.
Offline/cache upgrades, deployed-host headers, other browsers, desktop/mobile
shells and every optional engine are separate qualifications. The report retains
16 unsuccessful probes for the optional LabWired WASM payload; the missing-runtime
case also deliberately refuses CrispBASIC's entry module. Zero uncaught page
errors does not mean zero failed network requests. Full VDU and physical-board
behavior remain outside this milestone.

### Initial production run and discovered defect

The gate implementation is
[`e3156f125a1d`](https://github.com/CrispStrobe/brickwright/commit/e3156f125a1dc820a730ca004f37a3263f71d1e6).
Its first [CI run, 46076485235](https://github.com/CrispStrobe/brickwright/actions/runs/46076485235),
passed all 487 existing/focused tests, the complete webpack build and the
emitted-asset check. The build used Node 24.22.3 and webpack 5.96.1, emitted
three entry scripts and 562 lazy JavaScript chunks, and authenticated all 20
CrispBASIC payload assets. Seven of eight production Chromium scenarios passed.
The circuit-file replacement scenario correctly failed because the replacement
board inherited an active BASIC GPIO drive.

The pinned Circuit model saves undo history and copies the old solver snapshot
before React publishes its edit/replacement notifications. Cleaning up the old
board from those later notifications cannot remove a drive already copied into
the new board. The correction guards the captured model's `_saveHistory`,
`_syncNetlist` and `syncWithExternalNets` boundaries and finishes BASIC cleanup
before allowing the snapshot. Read-only snapshots/exports and authoritative
foreign GPIO writes retain their behavior. Reentrant edits are refused while
cleanup is pending; failed cleanup keeps subsequent edit attempts blocked, and
a new session cannot stack its methods over a pending/failed older guard.

Six regressions exercise the actual pinned Circuit and Board implementations:
both rebuild paths, history/undo/redo, read-only state, foreign GPIO ownership,
and repeated cleanup-failure refusal. Against the published gate-only revision,
four of these tests fail; all six pass with the correction. Seventeen additional
guard tests cover descriptors, partial setup, stale callbacks, constructor and
cleanup reentrancy, failure retention and successive owners. The production
assertion remains unchanged; its failure diagnostics now retain exact pin modes.

### Local verification

Local qualification uses Node 24.22.3 and minimal exact-revision solver/model
dependencies. Source/bridge tests report 100 passes, actual-WASM runtime/policy/
simulation tests 147, packaging/production asset checks 17, workflow policies 39,
runner/board-host tests 33 and the new guard/model tests 23. These overlap CI suites.
The local WASM execution uses the authenticated artifact from run 46076485235;
its interpreter and glue hashes match the prior milestone's binaries below.
The new packaging tests use explicitly
synthetic artifacts to test the checker. This workspace has insufficient free
disk for the full GUI dependencies or local Chromium. The existing session suite
passes 28 cases locally; its retained-debugger case requires the omitted debugger
dependency closure. The actual-WASM GUI integration also requires omitted generator
helpers and JSZip, so it did not execute locally. Both complete suites passed in
the successful CI run above. No local native rebuild or Chromium pass is claimed.

The previous record's final documentation-only follow-up
[46073544837](https://github.com/CrispStrobe/brickwright/actions/runs/46073544837)
has been checked and completed successfully.

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
