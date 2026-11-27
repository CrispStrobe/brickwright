# Code runtime and game export evaluation — 2026-11-27

Status: bounded evaluation. New runtime adapters, converter repairs, a pygame
transpiler, and production platform support remain follow-on work.

The [plan](CODE-RUNTIME-AND-GAME-EXPORT.md), `PLAN.md` and `ROADMAP.md` were
published first in
[`a29ac18c9e4a8789b6d58f8d5be4b5f034667627`](https://github.com/CrispStrobe/brickwright/commit/a29ac18c9e4a8789b6d58f8d5be4b5f034667627).
All runtime measurements below followed that publication. Application source was
reviewed at `14de1c42bd2e2ea84086a2162d1eff1fdbbac20d`; the evaluation does not
change the app's runtime, dependency pins, generated mirrors or release workflow.
Reproducible probes and observations live in
[`scripts/probes/code-runtime`](../scripts/probes/code-runtime/).

## Recommendation

Keep the execution service independent of the Python implementation. Pursue
Pyodide for an explicit CPython mode, direct MicroPython/WASM for an explicit
lightweight MicroPython mode, and retain Skulpt as the current migration baseline
until application and device qualification passes. Do not silently substitute
one dialect for another. Keep pwasm as a reference or optional Python-hosted tool.

Fix source ownership, conversion diagnostics, target selection and Stop/input
before changing the default engine. A more compatible interpreter cannot repair
an earlier incorrect conversion or make the existing no-op sprite shim execute
a game. The game export path should reuse the current edited SB3 graph, resources
and source profiles, then add a validated Python backend and pygame compatibility
runtime. The Linux packaging probe establishes a practical downstream packaging
route once that exporter exists.

## Runtime evidence

### Environment and scope

The same pinned assets and fixtures were exercised in Node 24.22.3 worker threads
and real headless **Chromium 158.0.8127.0** on Linux x86_64, on an Intel Xeon
Platinum 8573C host. The browser was served files from localhost. The normal run
had `crossOriginIsolated=false` and no `SharedArrayBuffer`; a separate input run
used COOP/COEP headers and observed both isolation and shared-memory availability.

The normal Playwright browser download returned HTTP 403. The probe instead used
the pinned npm `@sparticuz/chromium` 158.0.0 distribution. Its web-security and
force-enable-SAB flags were removed; the full remaining launch arguments are in
the result record. This server headless configuration uses `--no-sandbox` and is
not a production app/browser security qualification.

The measurements below are **fresh worker/runtime initialization from installed
local assets**, with possible warm browser/OS caches. They are not cold internet
downloads, app startup measurements or iPad predictions. Startup has three
samples per engine; warm tiny workloads have five repetitions. Fixtures are
diagnostic examples, not a percentage estimate of general Python compatibility.

### Footprint and readiness

| Engine | Exact tested package | Selected raw asset bytes | Independently gzip-compressed bytes | Browser engine initialization median | Browser worker-to-ready median |
| --- | --- | ---: | ---: | ---: | ---: |
| Skulpt | `skulpt@1.2.0` | 966,760 | 233,587 | 42.6 ms | 50.1 ms |
| Direct MicroPython | `@micropython/micropython-webassembly-pyscript@1.29.0-6` | 559,673 | 231,352 | 31.4 ms | 37.6 ms |
| Pyodide | `pyodide@314.0.8` | 13,530,536 | 6,390,645 | 2,418.3 ms | 2,427.1 ms |

Skulpt counts its runtime and stdlib JS; MicroPython counts its loader and WASM;
Pyodide counts its loader, generated JS, WASM, stdlib archive and package lock.
Optional packages, app integration, request headers and any additional deployment
assets are excluded. gzip figures are file compression measurements, not observed
internet transfer sizes. Per-asset hashes and sizes are recorded in the Node data.

MicroPython's raw files are smaller, but this build's compressed footprint is
almost the same as Skulpt's. A smaller raw WASM download is not sufficient reason
to replace the existing runner. Pyodide offers more Python compatibility at a
substantial initialization/payload cost; it should be optional and loaded lazily.

Node initialization medians were 47.175 / 18.659 / 2,040.079 ms for
Skulpt / MicroPython / Pyodide. They are recorded separately from browser results.
Node's process-wide RSS counters are diagnostic only; browser peak memory was
not measured and no memory-efficiency ranking is claimed.

### Selected language and API results

The normal browser and corrected Node observations agree on these outcomes:

| Diagnostic | Skulpt | MicroPython | Pyodide |
| --- | --- | --- | --- |
| Arithmetic, large integer, class/list fixtures | Expected output | Expected output | Expected output |
| Selected f-string | Expected output | Expected output | Expected output |
| `json.loads` | `NotImplementedError` | Expected output | Expected output |
| `dataclasses` example | Adapter-visible error | Missing module | Expected output |
| Deliberate `ValueError` | Expected diagnostic | Expected diagnostic | Expected diagnostic |
| Registered arithmetic/sensor mock | Expected output/call count | Expected output/call count | Expected output/call count |
| Top-level awaited delay fixture | Rejected by this integration | Expected delayed output | Expected delayed output |

The mock sensor returns a fixed value; no robot, circuit, Scratch VM or hardware
was driven. The awaited-delay fixture combines a top-level-await entry point and
the probe's host binding; Skulpt's probe adapter has no matching delay binding.
Its failure is an integration/API finding, not a claim about every possible
asynchronous Skulpt program. Real generated examples and device bridges remain
open gates.

Tiny browser workload medians further caution against a universal speed ranking:

| Warm workload, five observations | Skulpt | MicroPython | Pyodide |
| --- | ---: | ---: | ---: |
| Sum integers in a 10,000-iteration Python loop | 6.4 ms | 11.9 ms | 1.9 ms |
| 1,000 calls to the registered JS arithmetic callback | 1.6 ms | 1.8 ms | 5.6 ms |

These small, instrumented workloads are useful diagnostics of compute versus
bridge overhead. They do not predict game frame rates or hardware-loop latency.

### Input and Stop are adapter responsibilities

In the non-isolated browser, Skulpt's ordinary `input()` worked through a delayed
message reply. Direct MicroPython and Pyodide both completed an explicit
`await probehost.ask(...)` prompt/reply API without shared memory. That proves a
portable architectural route in this browser, while changing the user-facing API;
it is not transparent support for synchronous Python `input()`.

This MicroPython build's built-in `input()` hit the five-second fixture timeout
without reaching the configured stdin callback. With the same callback,
`sys.stdin.readline()` succeeded, as did the explicit async prompt. The released
[WebAssembly port header](https://github.com/micropython/micropython/blob/v1.29.0/ports/webassembly/mphalport.h#L30)
defines `mp_hal_stdin_rx_chr()` as zero, while
[api.js](https://github.com/micropython/micropython/blob/v1.29.0/ports/webassembly/api.js#L31-L48)
registers the stdin callback for Emscripten. Treat the built-in input path as an
integration blocker for this candidate, not a statement that MicroPython cannot
receive input.

After the browser input adapter correction described below, live synchronous
`input()` through the isolated shared-memory mailbox passed in Skulpt and
Pyodide. MicroPython still reached the deadline on its distinct built-in input
path. The successor had no page errors. Transparent live synchronous input
without shared memory was not implemented for Pyodide in this
probe. JSPI is available in the test browser but was not used by these adapters;
older-browser portability still requires actual qualification.

All three engines were placed in infinite loops, hard-stopped and then replaced
with a fresh worker that ran successfully. Browser parent heartbeats continued,
and no late messages were observed in the 200 ms post-Stop window. Browser
`Worker.terminate()` returns void, so its near-zero call duration is **not** a
measured physical termination-completion latency. The Node API can be awaited:
the observed awaited termination times were 2.443 / 3.726 / 7.691 ms for
Skulpt / MicroPython / Pyodide. These are single host observations, not maximum
Stop guarantees. Graceful interruption and production input cancellation remain
unqualified.

### Evidence lineage

The initial Node observation is retained because review found two reporting
issues: generated run IDs obscured stable fixture IDs, and Stop timing did not
yet await actual Node termination. The corrected Node report keeps stable IDs,
groups diagnostics by category and awaits the termination promise.

The first browser record retains the successful normal/no-SAB run and a failed
isolated-input path. That failure exposed a probe portability bug: Chromium's
`TextDecoder` rejected a view backed by `SharedArrayBuffer`, whereas Node accepted
it. The correction copies the reply bytes into a normal array before decoding.
Only the affected isolated-input route is rerun, with separate source hashes and
results; the successful normal-run measurements above remain their original
observations. A probe correction is not an application or runtime-engine repair.

Published raw evidence:

- [Corrected Node measurements](../scripts/probes/code-runtime/results-node.json).
- [Original browser measurements](../scripts/probes/code-runtime/results-browser.json),
  including successful standard mode and the first isolated-input failure.
- [Isolated-input successor](../scripts/probes/code-runtime/results-browser-input-corrected.json).
- [Initial Node observation](../scripts/probes/code-runtime/results-node-initial.json),
  retained with its original reporting defects and superseded coverage notes.

The [probe README](../scripts/probes/code-runtime/README.md#source-revision-of-the-browser-input-correction)
records both worker hashes and the exact one-expression correction. The final
worker differs from the Node/standard-browser measured worker only in that
shared-memory decoding branch; those historical result hashes are preserved.

## pwasm: concrete host findings

The separate [host probe](../scripts/probes/code-runtime/pwasm/) runs **pwasm
0.2a0 inside CPython 3.12.14 on Linux x86_64**, with its custom bundled
MicroPython guest. It does not run in a browser and is not a like-for-like startup
comparison with the JS/WASM engines. The wheel is pinned by SHA-256 in the probe
requirements; the guest is 286,631 bytes with hash
`6f7b35aa342738ddfc47b3a34381afb62be3f640ead7f0e112020a2873baf84f`.

| Probe | Observed result |
| --- | --- |
| Arithmetic, large integer, classes/lists, JSON and a 10,000-iteration loop | Expected output |
| The selected f-string fixture | `SyntaxError` in this bundled guest |
| `dataclasses` fixture | `ImportError` in this bundled guest |
| Registered `host.call('add', 20, 22)` | Returned 42, exactly one host callback |
| Unregistered host callback | Guest exception with named missing function |
| `import os` | Guest `ImportError` |
| Infinite loop, 200 ms deadline | `Timeout` after 200.802 ms |
| Infinite loop, 200,000 fuel budget | `OutOfFuel` |
| Fresh guest after a hard limit | Executed successfully |
| 150 ms host callback with a 10 ms guest deadline | Completed and returned 42 after 154.443 ms |

These are single observations per fixture, not guarantees of worst-case latency.
The last result demonstrates the host preemption boundary: a guest deadline is
not a deadline on arbitrary host work. Bounded callbacks and an outer process or
worker termination boundary remain necessary. The successful unknown-function
and OS-import refusals are useful capability observations, not a security audit.

The initial three instance creations measured 30.378, 12.418 and 13.137 ms; guest
code compilation/cache effects continue during execution. Do not present those
numbers as browser startup or compare them to a fully ready CPython browser
runtime. No memory-stress, adversarial-security, browser or mobile qualification
was performed for pwasm.

The architecture conclusion is unchanged: pwasm itself needs Python to host
WASM. Using the entire package in Brickwright's browser layer would first need an
outer Python engine, followed by pwasm and its guest. Its useful ideas are named
host functions, explicit limits and instance disposal. Direct MicroPython/WASM
or Pyodide is the appropriate first browser comparison.

## Conversion findings remain independent of the interpreter

The [reader probe](../scripts/probes/code-runtime/conversion/) executes the actual
current reader's Tokenizer, Parser and Translator and the actual Scratch runtime
helpers. It verifies the Git blob and SHA-256 identities before loading source.
Only module declarations are removed to load the classes in isolation; method
bodies are unchanged. Original fixture sources and raw results are committed.

Eight small Python programs were executed in native CPython. All produced their
expected stdout. Their reader output had no warnings in all eight cases:

| Input within the reader's event-function convention | CPython stdout | Emitted pseudocode observation |
| --- | --- | --- |
| `x = 7 // 2` | `3` | Uses ordinary `/` |
| `x = -7 // 2` | `-4` | Uses ordinary `/` |
| `x = 3`, then `x *= 2` on a separate line | `6` | Changes x by 2 |
| `x = 8`, then `x /= 2` | `4.0` | Changes x by 2 |
| `x = 8`, then `x %= 3` | `2` | Changes x by 3 |
| Loop ending with `break` at 3 | `3` | Drops `break`, leaving an empty conditional |
| Loop skipping 1 with `continue` | `2`, then `3` | Drops `continue`, leaving an empty conditional |
| Control: `x = 3`, then `x += 2` | `5` | Expected `change x by 2` |

This is evidence of changed reader output without diagnostics. The pseudocode
was **not** executed in Creator or ScratchVM, so inferred downstream arithmetic
and loop consequences must not be reported as measured VM output. The probe
does not test the Code tab wrapper or board-specific routing. Shared semantic
repairs still belong upstream in `sb3-creator`, followed by exact-pin adoption.

An independent portability smoke rerun reproduced all eight complete fixture
rows without changing the original result. The published harness reads the
checkout source instead of introducing another vendored reader/helper copy.

## Python + pygame and standalone packaging

### A concrete Linux packaging result

The [pygame probe](../scripts/probes/code-runtime/pygame/) uses an original,
hand-authored fixture with a generated PNG, scripted sprite movement, rectangle
collisions, scoring and state restart. It is not generated by Brickwright and
does not demonstrate Scratch/Arcade semantic equivalence.

| Item | Observation |
| --- | --- |
| Host | Linux x86_64, glibc 2.41 |
| Runtime | CPython 3.12.14, pygame-ce 2.5.8, SDL 2.32.10 |
| Packager | PyInstaller 6.22.3, one-directory bundle |
| Video/audio | SDL dummy drivers |
| Fixture | 96 × 64 surface, original 8 × 8 PNG, 24 frames, two collision/score events, one restart |
| Source/package result | Complete state trace and all 24 rendered frame hashes match |
| Runtime independence | Frozen executable, empty `PATH`, pygame and every Python search path inside the bundle; loaded libpython verified inside the bundle via `/proc/self/maps` |
| Bundle size | 54,072,511 regular-file bytes, approximately 51.568 MiB; symlink targets are not double-counted |
| Executable alone | 1,572,896 bytes; dependencies/assets also required |
| Final observed build | 7.644 seconds, one observation rather than a performance benchmark |

State/frame trace SHA-256:
`5a9c20f7602c81c8c5eeeeed8fad3717ad13e6d470e9c8b71c7081e3ab05083e`.
The [published record](../scripts/probes/code-runtime/pygame/results-record.json)
contains all 24 frame/state entries, exact dependency versions, asset/source
hashes, bundle inventory hash and validation outcomes. Local path prefixes and
build logs are omitted from that public record; the runner preserves them in its
local results directory for diagnosis.

The host Python installation was not removed. The checks establish that this
execution loads its Python and pygame from the bundle, while continuing to use
the native OS loader and libraries. It was not tested in a clean distro image
or on an older glibc floor. Dummy SDL validates deterministic rendered buffers,
not visible interactive windows, real controls, audio or device lifecycle.
Binary hashes describe the observed build; reproducible binary builds, signing,
installers and a complete distribution-license inventory remain pending.

### What still has to be built

The current Python generator emits a no-op Scratch stage shim, unknown reporters
can become `None`, unknown commands can become comments, and flag handlers run
sequentially. See the
[reviewed generator](https://github.com/CrispStrobe/brickwright/blob/14de1c42bd2e2ea84086a2162d1eff1fdbbac20d/overlay/scratch-gui/src/lib/sb3-creator.js#L10943-L11092).
A playable exporter needs a new validated backend and a game compatibility
runtime implementing the admitted sprite, event, scheduler, input, collision,
tilemap, asset and sound behavior.

Use the current edited SB3 graph and current resources. Original MakeCode files
remain a provenance/oracle input and must not override later learner edits.
Preserve separate Scratch and Arcade semantic profiles, including coercion,
identity/aliasing, event ordering and frame scheduling. Existing import success
does not establish complete game equivalence; the original
[Arcade conversion journey](ARCADE-CONVERSION-JOURNEY.md) and
[frame scheduler contract](ARCADE-FRAME-SCHEDULER.md) already make those boundaries
explicit. Reuse their original-runtime comparisons for the Python backend.

The next export milestone is one admitted Scratch game and one admitted Arcade
game through import/edit/save/reopen/export/independent execution, with an opcode
coverage report and deterministic state/event/frame comparisons. Reject missing
operations and assets before reporting export success. Then expand the profile.

### Target-specific feasibility

| Target | Current conclusion | Evidence still needed |
| --- | --- | --- |
| Editable Python project | Feasible with CPython + pygame and a new compatibility runtime | Actual generated game, assets, source maps and semantic parity |
| Linux standalone | Packaging mechanism demonstrated for the authored fixture | Real exported game, clean target distro, chosen ABI floor, GUI/audio/input and distribution inventory |
| Windows/macOS standalone | Supported packaging route in upstream PyInstaller | Per-OS/architecture builds, clean-machine tests and platform distribution requirements |
| Browser game | pygbag is a plausible pygame-ce/WASM route; Pyodide has an experimental SDL alternative | Async frame loop, canvas, assets, audio activation, offline runtime packaging and browser parity |
| Mobile browser/PWA | Candidate extension of the web route | Actual device memory/input/audio/background-resume qualification |
| Native Android/iOS | Separate engineering project | Native SDL/Python dependency builds, lifecycle, signing and distribution qualification |

PyInstaller bundles Python and dependencies but is not a cross-compiler; its
[official manual](https://pyinstaller.org/en/v6.22.3/) requires target-specific
builds. Exporting source from every Brickwright platform and locally building
every native package on every platform are separate capabilities.

[pygbag](https://github.com/pygame-web/pygbag) requires a browser-cooperative async
loop. Its usual CDN runtime needs explicit offline packaging before claiming a
self-contained web export. Pyodide 314.0.8 lists pygame-ce 2.5.7, but its
[SDL support](https://pyodide.org/en/stable/usage/sdl.html) is experimental and
requires canvas setup, an opt-in flag and yielding to the browser. None of those
graphics routes was exercised by the console-worker or native packaging probes.

pygame-ce is LGPL-2.1-or-later. The repository's existing permissive dependency
policy needs an explicit decision before bundling it into a shipped product.
This probe adds no pygame dependency to the application. PyInstaller's exception
does not remove the licenses of bundled runtime libraries or imported game assets.

## Remaining release gates

### Repository CI observation

The automatic [vendor-freshness run for the initial plan commit](https://github.com/CrispStrobe/brickwright/actions/runs/45948682460)
failed in its examples-gallery step: `index.json` was stale, and
`busch-microtronic-wired-io/{circuit.json,intro.de.md,intro.md}` were reported as
orphans. The sb3-creator identity/transpiler and runtime-extension gallery checks
passed. The planning diff changes only `PLAN.md`, `ROADMAP.md` and this track's
new documentation; the example files, sync script and vendor pins are unchanged
from its parent. This is existing examples-gallery drift, not a successful
repository-wide CI result, and this lane does not repair or waive that gate.

### Production acceptance

The bounded evaluation supports choosing implementation work; it is not the
application release qualification. These gates remain open:

- Versioned authored-source ownership, target persistence and exact run requests.
- Exact-or-refused conversion with source spans, including the demonstrated cases.
- Actual generated examples and actual stage/circuit/robot bridge parity.
- Input cancellation, user-state isolation, repeated-run recovery and output-cap
  enforcement in the production execution service.
- Application CSP/native asset loading, offline behavior, real network cold/cache
  behavior, peak memory and minimum supported OS/browser/WebView versions.
- Windows, macOS/WKWebView, Linux/WebKitGTK, Firefox, Safari, Android and the oldest
  supported iPad; a server Chromium observation cannot qualify those cells.
- A real pygame export backend and source-profile differential corpus, followed
  by clean-machine packages and separate web/mobile qualification.

Proceed with R1/R2 in the [ordered plan](CODE-RUNTIME-AND-GAME-EXPORT.md#7-ordered-delivery-and-acceptance).
Use the same capability model for executability, convertibility and exportability,
while keeping their answers distinct. G0/G1 can reuse the conversion-model work;
G3 packaging follows a verified playable export.
