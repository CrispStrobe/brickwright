# Python runtime probe

This directory evaluates three pinned runtime distributions in disposable workers.
It is a diagnostic harness, not a Brickwright runtime implementation or a security
boundary. It was executed only after the initial plan was published at
`a29ac18c9e4a8789b6d58f8d5be4b5f034667627`. The reviewed application source baseline
is `14de1c42bd2e2ea84086a2162d1eff1fdbbac20d`.

See the [evaluation report](../../../docs/CODE-RUNTIME-EVALUATION-2026-11-27.md)
for decisions and scope. Separate bounded probes cover [reader semantics](conversion/),
[pwasm on a Python host](pwasm/), and [Linux pygame packaging](pygame/).

## Reproduce

The recorded Node environment was Node 24.22.3 on Linux x64. The package lock pins
the runtime packages and probe-only browser tooling, with npm integrity hashes.
Install from this directory:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node probe.mjs --plan-commit=a29ac18c9e4a8789b6d58f8d5be4b5f034667627 --output=results-node-rerun.json
mkdir -p tmp
TMPDIR="$PWD/tmp" node browser-probe.mjs --plan-commit=a29ac18c9e4a8789b6d58f8d5be4b5f034667627 --output=results-browser-rerun.json
```

The browser runner defaults to the Linux serverless Chromium package. To use an
installed compatible Chromium executable, pass `--browser=/absolute/path/to/chrome`.
That changes the environment and must be reported separately. A machine with a
normal writable temporary directory does not need the `TMPDIR` override.
`--engines=skulpt,micropython,pyodide` selects the engines (the default is all three).
Run the Node and browser probes sequentially to avoid competing timing workloads.
For the affected-route-only browser rerun recorded here, add
`--mode=isolated-input --output=results-browser-input-rerun.json`. These rerun
names preserve the committed observations.

The plan argument records a previously verified publication SHA; the scripts
check its format, not remote publication. They make no remote writes. Browser
assets are served from installed files on a transient localhost HTTP port.

| Engine | Exact npm package | Version |
| --- | --- | --- |
| Skulpt | `skulpt` | `1.2.0` |
| MicroPython | `@micropython/micropython-webassembly-pyscript` | `1.29.0-6` |
| Pyodide | `pyodide` | `314.0.8` |
| Probe browser | `@sparticuz/chromium` | `158.0.0` |
| Probe driver | `playwright-core` | `1.62.1` |

MicroPython here is the released PyScript distribution. This probe does not test
the later JSPI preview build. The browser dependency belongs only to this probe.
It must not be added to Brickwright's application dependency graph.

## What is measured

`probe.mjs` runs Node `worker_threads`; `browser-probe.mjs` runs actual browser
module workers through `browser-page.mjs`. Both use `engine-worker.mjs` and
`fixtures.json`. Each runtime has three fresh worker startups and five repetitions
of each small warm workload. Raw results retain every sample and failure.

- Startup timing uses already-installed local assets. Browser assets come from
  localhost, and OS/browser/module caches may be warm. This is neither a cold
  network download measurement nor application-ready latency.
- Node asset sizes sum the specified files, record SHA-256, and independently
  compress each using gzip level 9 and Node's default Brotli settings. They exclude
  optional packages, application integration, HTTP headers and service-worker
  behavior. They are not observed production transfer sizes.
- Node memory fields are diagnostic counters. RSS is process-wide, so these fields
  must not become a per-engine browser peak-memory ranking. Browser memory is not
  measured.
- Core arithmetic, large integers, classes/comprehensions, selected syntax and
  standard-library examples, traceback text, input and mock host callbacks are
  separate diagnostics. No aggregate pass percentage measures Python compatibility.
  The error fixture checks type/marker strings; it does not qualify editor
  source-line mapping or a complete diagnostic UI.
- `async_bridge` uses runtime-specific top-level await and JavaScript Promise
  bridging. The Skulpt adapter intentionally has no `delay` binding. This case is
  an API diagnostic, not ordinary Python-script conformance.
- The bridge exposes only deterministic mock arithmetic/sensor functions, delayed
  results and an explicit asynchronous input request. No Brickwright VM,
  simulator, hardware or generated application program is exercised.

The limits are 30 seconds for startup, 5 seconds per fixture, a 1 MiB output budget,
and 200 milliseconds before requesting Stop on an infinite loop. The output cap
exists to bound the harness; a large-output enforcement test remains pending.
The live-input reply is deliberately delayed 40 milliseconds, so its timing is not
a zero-delay runtime throughput measurement.

## Input and Stop distinctions

Buffered input supplies a line before execution. Live synchronous input uses a
shared-memory mailbox where supported. Skulpt also has a Promise-backed ordinary
`input()` route through messages. MicroPython and Pyodide additionally exercise
`await probehost.ask(...)`, an explicit host API that changes the program contract.
It does not establish transparent `input()` support without shared memory.

The browser standard run omits cross-origin isolation and shared memory. The
separate isolated-input run serves `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`. Actual page and worker capabilities
are recorded. The serverless Chromium defaults include flags that relax web
security or force-enable SharedArrayBuffer; the runner explicitly removes those
flags. It retains the process-level `--no-sandbox` launch option required by this
container, so this is not a security-hardening validation.

The released MicroPython port exposes an Emscripten filesystem stdin callback,
but its built-in `input()` readline path is distinct. In this build, the initial
buffered and live `input()` probes timed out without calling our stdin callback.
The byte-returning callback matches the official loader contract; this observation
is consistent with the v1.29.0 port's `mp_hal_stdin_rx_chr()` macro returning zero.
The harness records `sys.stdin.readline()` and explicit asynchronous `ask()` as
separate observations; both passed in Node and the browser. Do not generalize the
built-in failure to all input APIs:

- [Official loader callback contract](https://github.com/micropython/micropython/blob/v1.29.0/ports/webassembly/api.js)
- [Official port input macro](https://github.com/micropython/micropython/blob/v1.29.0/ports/webassembly/mphalport.h)
- [Official async/host API documentation](https://github.com/micropython/micropython/blob/v1.29.0/ports/webassembly/README.md)

For Stop, the parent continues a 10 ms heartbeat while a worker spins. Node records
elapsed time until the `worker.terminate()` Promise resolves. Browser
`Worker.terminate()` returns void: its recorded call duration is **not** confirmed
termination-completion latency. The browser also observes a 200 ms quiet window,
then runs `print(42)` in a fresh worker. Stop discards interpreter state. Graceful
runtime interruption and in-place interpreter recovery remain untested.

## Artifacts and interpretation

- `results-node.json`: corrected final Node measurements, stable fixture IDs,
  category-level observations, awaited termination, source and asset hashes.
- `results-browser.json`: original real server Chromium observations, launch
  flags, isolation capabilities, localhost requests and raw samples. Its standard
  run supplies the browser timing and semantic results. Its initial isolated-input
  run records the shared-view decoding adapter failure described below.
- `results-browser-input-corrected.json`: isolated-input-only successor after
  copying reply bytes before decoding. Skulpt and Pyodide pass; MicroPython's
  distinct built-in `input()` path still reaches the 5 second deadline without
  invoking the stdin callback. No page errors occur in the successor run.
- `results-node-initial.json`: retained first run, including the original
  MicroPython `input()` failures. Its fixture IDs accidentally include run suffixes,
  it has an aggregate diagnostic count, and its Stop timing predates the explicit
  awaited-termination fix. Use final results for timing and categorical summaries.

The initial Node artifact also predates successful browser setup and therefore says
a browser was unavailable at that point. The browser artifacts supersede that
coverage note. The ordinary Playwright CDN download returned HTTP 403; one alternate
npm-packaged Chromium distribution launched successfully. This says nothing about
end-user browser installation or production asset delivery.

### Source revision of the browser input correction

Both `results-node.json` and `results-browser.json` record this SHA-256 for
`engine-worker.mjs`:

```text
8cf9834f9f21620eb736f3711f1b66f9387bd097ce261d081fc678b03f523570
```

The browser rejected `TextDecoder.decode()` when passed a view backed by a
SharedArrayBuffer; Node accepted it. The final worker copies the completed reply
to an ordinary array buffer. This is one expression change inside `sharedInput()`:

```diff
- return new TextDecoder().decode(new Uint8Array(inputBuffer, 8, length));
+ // Browser TextDecoder rejects shared views; copy the completed reply first.
+ return new TextDecoder().decode(new Uint8Array(inputBuffer, 8, length).slice());
```

The final worker and `results-browser-input-corrected.json` record SHA-256:

```text
313f9aebc668f4c039fdb7d5c88227c34e4d339a58f4afdff8cc323fcf37d04c
```

The browser driver also gained a `--mode` selector to rerun only the affected
route. Each raw result records its own driver, worker, fixture and lockfile hashes.
Node and the standard browser timing samples were not rerun after this correction;
their source hashes deliberately remain those of the earlier worker. The standard
browser mode has no SharedArrayBuffer and does not enter the changed branch.

### Recorded browser observations

These medians are from three fresh workers in Chromium 158.0.8127.0 on a Linux
server, using localhost assets. They are not mobile or production load budgets.

| Observation | Skulpt | MicroPython | Pyodide |
| --- | ---: | ---: | ---: |
| Median runtime initialization (ms) | 42.6 | 31.4 | 2418.3 |
| Median worker start to ready (ms) | 50.1 | 37.6 | 2427.1 |
| Selected asset bytes, uncompressed | 966,760 | 559,673 | 13,530,536 |
| Selected asset gzip bytes | 233,587 | 231,352 | 6,390,645 |
| Arithmetic, large integer, class/list fixtures | Pass | Pass | Pass |
| JSON fixture | Not implemented | Pass | Pass |
| f-string fixture | Pass | Pass | Pass |
| dataclass fixture | Internal TypeError | Module absent | Pass |
| Built-in buffered `input()` | Pass | Deadline | Pass |
| Message-only live input | Ordinary `input()` passes | Explicit async `ask()` passes | Explicit async `ask()` passes |
| Isolated shared input after copy correction | Pass | Deadline | Pass |
| Mock arithmetic/sensor bridge | Pass | Pass | Pass |
| Hard Stop and fresh worker restart | Pass | Pass | Pass |

Asset sizes come from the Node file/compression measurements, not browser transfer
timing. The named fixtures are small diagnostics; the table is not a general
compatibility percentage or an overall speed ranking. In particular, MicroPython
and Skulpt have similar gzip totals in these selected distributions despite their
different uncompressed sizes. Browser hard-stop calls returned immediately, but
that API exposes no completion acknowledgement; no numeric browser termination
latency is asserted.

Remaining qualification includes Windows/macOS/Linux WebViews, Android/iOS,
Safari/Firefox, actual mobile memory/thermal limits, production CSP and application
headers, real slow networks, offline cache/update behavior, cancellation while
waiting for input, stale responses, repeated-run state reset, output-limit behavior,
generated program semantics and actual simulator/game integration. Runtime startup
and mock callbacks do not satisfy those gates.

Keep only the scripts, fixtures, package manifests/lock, README and raw JSON results
under version control. Do not commit `node_modules`, npm caches, extracted browser
binaries or temporary browser profiles.

## Production console session probe

`session-browser-probe.mjs` exercises the actual consumer
`code-execution-session.js` and `code-execution-workers.js` through a static
localhost harness with real Skulpt. It does not load the React application.
The existing pinned probe package/lock supplies Playwright, Chromium and Skulpt;
no application runtime dependencies are added.

From this probe directory, after the existing `npm ci --ignore-scripts` setup:

```sh
mkdir -p tmp
TMPDIR="$PWD/tmp" node session-browser-probe.mjs --output=session-browser-rerun.json
```

An isolated dependency directory can be selected with
`--runtime-probe-dir=/absolute/path/to/probe-dependencies`; `--app-root` selects
the repository whose production sources are tested. Otherwise the source root
is three directories above the script. `--browser` can select an existing
Chromium executable. This is a Node/Linux probe, not an application build.

The recorded `session-browser-results.json` passes 19/19 cases with zero page
errors on Chromium 158.0.8127.0, Skulpt 1.2.0 and Node 24.22.3. It includes source
hashes and raw output/input/cleanup observations. Both languages cover normal and
error completion, streaming, input waiting beyond the execution budget, Stop
during input and busy loops, output caps and fresh restart. JS also covers
explicit awaited completion and synchronous prompt/random replay. A host case
confirms lazy-source disposal creates no worker. The page has no cross-origin
isolation or SharedArrayBuffer; only the container's `--no-sandbox` argument is
supplied to Chromium. Browser termination has no completion acknowledgement.

Synchronous JS prompt replay caches answers and `Math.random()` only; it does
not roll back global, time, network or persistent side effects. Prefer explicit
`await input(...)`. Generated detached tasks, the legacy simulator route,
React UI, production CSP, offline delivery, other browsers/native WebViews and
mobile/device behavior remain separate gates. The earlier runtime-comparison
results are retained; this probe closes only the named console-worker checks.

### Owned-task and input-watchdog continuation

`session-task-browser-results.json` records the later scoped `codeRun` candidate:
**38/38 cases pass, zero page errors**. The original 19-case receipt above is
retained with its original source hashes. The new receipt includes the production
module and probe hashes, canonical generator source hash, exact generator commit,
and the actual generated source used in each of three generator/worker cases.

After installing this directory's existing probe dependencies, select a checkout
of the canonical generator implementing `owned-console-v1`:

```sh
mkdir -p tmp
TMPDIR="$PWD/tmp" node session-browser-probe.mjs \
  --generator-root=/absolute/path/to/sb3-creator \
  --output=session-task-browser-rerun.json
```

That generator checkout needs its own locked dependencies for source imports.
Omitting `--generator-root` runs only the production session/worker cases; it does
not establish generator integration. A supplied old generator is rejected rather
than silently testing hand-written replacement output. This explicit external
source probe does not adopt or modify Brickwright's pinned generator.

The new cases cover registered concurrent/nested completion, ignored rejection,
task-scoped input/sleeps, Stop, orphan input, invalid continued owned work while
input is pending, active sibling execution budgets, missing responsiveness
replies, completed-scope use, output limits and restart. The actual generated
programs cover concurrent flags and an awaited procedure, input longer than the
execution budget, and Stop during a wait. The scoped API does not discover
arbitrary native timers/promises or infer joins: `spawn` registers concurrent
work and returns `undefined`; sequential work uses awaited local functions.

The 139 focused source/worker controls are reproducible from the repository root:

```sh
node --test test/code-execution-session.test.mjs \
  test/code-javascript-tasks.test.mjs \
  test/code-runtime-source-ownership.test.mjs \
  test/code-tab-empty-target-after-failed-conversion.test.mjs \
  test/code-conversion-editor-ownership.test.mjs \
  test/code-tab-run-via-blocks.test.mjs \
  test/spike-code-caller-ownership.test.mjs
```

These controls and the static browser harness do not qualify the rendered React
application, production CSP, Scratch game semantics, other browsers or native
platforms. At that checkpoint, the generator option remained opt-in upstream
and was not selected by the Code tab or vendored dependency pin. The later
rendered-editor integration below adds the explicit generation choice while
retaining the shipping pin until upstream qualification.

### Boolean-value successor and default factory under CSP

The [complete worker receipt](../../../docs/CODE-CONSOLE-VALUES-WORKER-RECEIPT-2026-11-27.md) preserves a **39/39 passing**
successor to the task receipt, with zero page errors. It executes supplier
`cbdf1791`, including a fourth canonical program
whose comparison reporter occupies an ordinary `say` value socket. The receipt
stores the actual SB3 graph and its transformation from the readable source seed;
the required output is `true`, while the former emitter produced `undefined`.
Production consumer sources are unchanged. Reproduce without replacing earlier
receipts:

```sh
TMPDIR="$PWD/tmp" node session-browser-probe.mjs \
  --generator-root=/absolute/path/to/sb3-creator \
  --output=session-console-values-browser-rerun.json
```

`session-csp-browser-probe.mjs` separately exercises the **default production
Blob-worker factory**, with real HTTP CSP and an external module harness. It
observes Worker construction/termination and URL creation/revocation through
call-through wrappers; it does not inject `createWorker`, replace the transport,
rewrite production sources or bypass browser policy. The new
`session-csp-browser-results.json` passes **16/16** cases and **2/2** enforced
denial profiles, with zero page errors:

| Policy | Observed behavior |
| --- | --- |
| No CSP | JavaScript and Skulpt complete normally. |
| Blob workers and dynamic compilation permitted | Owned completion, long input, Stop, output limits, cleanup and fresh state pass. |
| `worker-src 'none'` | Both languages fail explicitly with no learner effects; document events and HTTP reports confirm enforcement. |
| Dynamic compilation denied | Both languages fail with CSP/EvalError diagnostics; worker-side HTTP reports identify blocked evaluation. |
| Permitted document after denial | Both languages recover in the same browser/context after navigation. |

Every constructed worker is terminated once and every Blob URL is revoked once.
Late input is rejected; a 120 ms quiet window observes no post-settlement worker
messages. Expected policy violations are recorded as console errors and reports,
separately from unexpected page errors. Worker-src denial currently produces a
generic `Worker error` session diagnostic in Chromium; detailed policy attribution
comes from the observed violation evidence.

```sh
TMPDIR="$PWD/tmp" node session-csp-browser-probe.mjs \
  --output=session-csp-browser-rerun.json
```

The same `--app-root`, `--runtime-probe-dir` and `--browser` selectors are
available. Source, probe, harness, lockfile and configuration hashes are recorded.
The Tauri configuration is only inspected; the no-CSP profile is not native-host
execution. These explicit localhost policies do not qualify deployed headers,
the rendered React application, app protocols, offline delivery, other browsers
or native/mobile WebViews. No dependency or application policy changes are made.

### Authored documents and the actual Code tab

The next application checkpoint, `71d6854cb3c4411072deeaee448281d2fc9d13c1`,
adds durable authored source/target/runtime, revision-bound projections, an
explicit **Console program** generation choice and source-located conversion
refusals. Its real-editor harness is
[`scripts/verify-owned-console-code-tab.mjs`](../../verify-owned-console-code-tab.mjs).
It uses visible Code controls, actual File Save/Open and the production workers;
it does not replace the VM, worker implementation or editor state.

The [full rendered receipt](../../../docs/OWNED-CONSOLE-CODE-TAB-RECEIPT-2026-11-27.md)
records **12/12 passed** against that checkpoint with official experimental
supplier `4994e2c7`. It retains all screenshots,
authored/generated programs, the two SB3 archives, complete result data and an
emitted-asset manifest. The [integration report](../../../docs/CODE-DOCUMENT-INTEGRATION-2026-11-27.md)
records the 214 focused controls, additional local fixtures and remaining
supplier/pin/gallery landing blockers.

The manifest is written by `scripts/write-owned-console-qualification-manifest.mjs`
with explicit `--supplier` and `--expect-supplier` arguments. It binds a separate
official-sync worktree to its source checkpoint, complete sync patch, canonical
supplier rewrites/mirrors and emitted build. The harness accepts that file using
`--qualification-manifest`. All 53 observed same-origin script responses match
the emitted inventory. Dynamic Blob responses are recorded separately, with
real worker creation/closure checks; they are not built HTTP assets.

New manifest creation and replay use an explicit Git executable: pass
`--git-executable /absolute/path/to/git` to both scripts, or set
`BW_GUI_GIT_EXECUTABLE` for both commands. The producer records the canonical
executable path, SHA-256 and Git version; replay requires the same tool identity
and still checks the complete dirty candidate patch. Inherited `GIT_*` variables
cannot redirect those reads. Historical manifests and receipts above are
retained as originally recorded; regenerate a manifest for a new qualification
with the current harness. See [the executable-authority repair](../../../docs/OWNED-CONSOLE-GIT-AUTHORITY-2026-11-27.md).

This receipt is explicitly `experimental-candidate-bundle` with
`shippingEvidence: false`. It leaves the feature branch's supplier pin unchanged
and does not replace upstream or deployed/native/platform qualification.

After normal supplier adoption, `--source-mode committed-pin` plus an explicit
`--expect-consumer` lets the same producer bind a clean committed-pin local
build. This mode requires the exact committed supplier, no tracked patch, and
complete source/mirror revalidation before browser launch. It still records
`shippingEvidence: false` and does not emit the official hosted GUI manifest.
See [the committed-pin qualification contract](../../../docs/OWNED-CONSOLE-COMMITTED-PIN-QUALIFICATION.md).
