# Validation records

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
