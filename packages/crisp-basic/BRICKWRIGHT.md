# Brickwright integration

The Code tab's **BBC BASIC** profile now offers **CrispBASIC (browser)** and
**BBC BASIC Z80 (retro)** as separate engines. CrispBASIC is the default. The
6502 and 8086 BASIC routes retain their existing runners.

## Build and use

From the repository root, with Emscripten 3.1.64 available:

```sh
# Prepare the pinned GUI sources before staging the optional runtime.
npm ci --ignore-scripts --no-audit --no-fund
npm run vendor
npm run build:crispbasic
npm run package:crispbasic:check
npm run integrate
npm --prefix packages/scratch-gui ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund
node scripts/apply-vm-overlay.mjs
node scripts/apply-paint-overlay.mjs
node scripts/apply-render-overlay.mjs
NODE_ENV=production NODE_OPTIONS=--max-old-space-size=2560 \
  BW_ENABLE_CAD=1 BW_ENABLE_FPGA=1 npm run build:gui
```

`build:crispbasic` builds the pinned C interpreter and stages its browser
runtime under `packages/scratch-gui/static/crispbasic/`. `package:crispbasic`
re-stages an existing valid build without compiling it. The integration script
re-stages a previously built engine after vendor/overlay preparation. Existing
GUI builds without this optional payload remain possible; choosing Run then
reports the missing engine with the build command. It does not silently choose
a different interpreter.

In the Code tab, select **BAS → BBC BASIC → CrispBASIC (browser)**. Generate
source from blocks, open a `.bas` file, or edit the BASIC buffer, then choose
**Run BASIC**. BBC generation starts with unnumbered source. The line-number
option and explicitly numbered programs remain supported. The Z80 engine requires
numbered source in increasing order. Unnumbered or mixed source is refused before
loading its ROM, with the offending editor line and instructions to regenerate
numbered BASIC or select CrispBASIC. Switching engines never silently rewrites
the edited program.

By default, generated source comes from the existing
`generateBASIC(project, {profile: 'bbc', lineNumbers: false})` implementation.
The adapter executes the current text directly; it does not round-trip it
through the subset reader first. The **To blocks** operation retains
`basicToPseudocode`'s conversion warnings. Generator warnings, including
commented hardware stubs, remain visible. A generation-refusal placeholder
cannot run, return to blocks or derive another language while its generation-error
banner remains. Whitespace edits preserve the refusal; removing or replacing the
banner admits an explicit authored correction.

For portable digital/time programs, explicitly select **Generate portable
Circuit calls**, then **From blocks**. This requests the pinned producer's
`mode: 'crispbasic'`; it does not enable circuit access or rewrite edited source.
Select **Connect Circuit** separately to run the generated calls against a
supported board in the current circuit. Timing uses integer simulated
milliseconds; toggle and unsupported operations refuse. Live portable calls
currently refuse **To blocks**, naming their source lines and preserving the
existing project. Ordinary supported BASIC retains its existing conversion path.
[GENERATOR.md](GENERATOR.md) documents maps, numeric conversion and the reverse
boundary.

**Stop** terminates an active run, including a tight loop or blocked input.
**Reset** also clears the output/VDU state after cleanup. `INPUT` displays a
line-entry form; `GET` and related key requests accept one Latin-1 character
(empty means Enter). **End input** closes that run's input stream. The GUI uses
a 60-second wall-time deadline, including time waiting for user input, and the
engine's 1 MiB cumulative input/output bounds. The standalone session API still
allows applications to choose their own bounded execution options.

## Architecture and asset boundary

The GUI-owned `crispbasic-runner.js` adapts the package's `createWasmSession`.
The interpreter package imports neither React nor `bw-board`. Only the GUI
adapter imports the existing pinned `VduDecoder` to produce the text transcript
without mistaking graphics parameters for characters. The unchanged raw byte
stream is mapped exactly to Latin-1 code points for `VduTerminal`.

The adapter imports `static/crispbasic/browser.mjs` on demand as native browser
ESM. It supplies explicit module and worker URLs relative to the document base,
so hosting below a URL prefix works. Webpack does not traverse Node-only
branches, rewrite `import.meta.url`, or bundle the generated Emscripten glue.
The copied asset tree is marked to preserve its exact bytes.

Packaging verifies upstream and local build inputs, the generated JavaScript
and WASM digests, the actual import list, and licence hashes. The deterministic
manifest records every shipped asset. `package:crispbasic:check` rejects missing,
extra, modified and stale files. An invalid build leaves the prior payload
intact. Source, toolchain and runtime notices accompany the shipped binary.
Version `0.1.0-dev.5` has 20 manifest-listed payload assets, plus `manifest.json`;
the added runtime modules are `src/simulation-host.mjs` and
`src/simulation-protocol.mjs`. Rebuild and repackage the C/WASM artifact when
upgrading; the simulation API checks its ABI marker before enabling the bridge.

Each run owns a fresh interpreter worker. Cancellation during either lazy-load
phase revokes the old run's right to create a worker. Run/Reset/Dispose wait for
the active worker's cleanup; stale completions cannot overwrite a later run or
an unmounted editor. Diagnostics preserve the imported filename and physical
editor line. Error highlighting only applies while the executed source remains
the current BASIC buffer.

## Rendering boundary

The existing canvas renders a VDU subset: text, colours, MODE clearing and
basic MOVE/DRAW output. The integration checks fixed output bytes and actual
pixels for these primitives. The terminal now consumes output already present
when it mounts, preserves partial VDU commands across chunks, and resets the
decoder/cursors/canvas for a new run, including identical repeated output.

This remains a partial renderer. Screen modes, cursor behavior, scrolling,
origins, plotting modes, filled shapes and palette semantics are not fully
qualified. Graphics queries such as `POINT` remain unavailable in the
restricted interpreter. Text output is a transcript, not a complete terminal
screen model. No source debugger is supplied by this integration.

## Simulation bridge and Circuit adapter

`@crispstrobe/crispbasic/simulation` exposes the dependency-free deterministic
reference host described in [SIMULATION.md](SIMULATION.md). It defines logical
pin modes, reads/writes, explicitly scheduled input stimuli, integer-millisecond
time, bounded traces and reset/disposal semantics.

The package now implements a bounded BASIC request/reply bridge for WASM
embedders. `createWasmSession({simulation: {}})` creates a fresh reference host
and installs the ordinary `PROCpinMode`, `PROCdigitalWrite`, `FNdigitalRead`,
`PROCdelay` and `FNmillis` library. A synchronous
`simulation.createHost({signal, runId})` factory can supply a custom host;
operations may return Promises while cancellation and request/time/I/O limits
remain parent-owned. The factory, disposer and synchronous operation work must
return promptly. Board adapters must check cancellation/disposal before
deferred changes; ignored late replies do not undo external side effects.

The Code tab's **Connect Circuit** checkbox explicitly enables the GUI-owned
adapter. Open a supported circuit before enabling it. The run acquires that
same canvas board, applies the documented logical pin map and uses the existing
solver for digital drive and electrical sense. `PROCdelay` advances solver time
in cooperative batches; `FNmillis` starts at zero relative to the acquired clock.
Starting BASIC does not reset the circuit's controls or component history.

Stop, Reset, unmount, circuit edits and project replacement release the captured
pin/clock ownership. Competing debugger, firmware and coupled-simulation starts
are refused while BASIC owns the board. The captured Circuit model also revokes
BASIC before saving undo history or copying the old solver into a replacement,
so these snapshots cannot inherit BASIC's temporary GPIO drive. Read-only
snapshots and exports leave the run active. Failed or reentrant cleanup blocks
the mutation until it can safely proceed. No synthetic bench substitutes for an
unavailable or rejected circuit. [BOARD-SIMULATION.md](BOARD-SIMULATION.md)
specifies supported controllers, electrical semantics, limits and a runnable
example. Default generation retains its hardware comments; the explicit
portable mode emits the supported library calls described above.

The standalone reference host retains `basicBridge: false`, `hardware: false`
and `circuitPhysics: false`; the Circuit host advertises circuit physics, and
the configured WASM session separately advertises the enabled bridge. Physical
hardware, native-backend simulation, analog I/O, PWM and interrupts remain
unavailable through this library. The SYS/file/raw-memory policy, `TIME` and
`WAIT` semantics remain unchanged.

The library lives outside authored source records, preserving numbering and
normal user definitions. Its typed domain errors map to original call sites;
parent resource failures produce `simulation-limit` and cannot be handled away
by BASIC. [SIMULATION.md](SIMULATION.md) specifies the error codes, ownership,
ABI negotiation and resource bounds. [VALIDATION.md](VALIDATION.md) records the
current revision's qualification status, including the focused actual-solver
tests and their limits. No physical-device behavior is established.

## Verification

The focused integration checks require root dependencies for the actual
generator and pinned VDU decoder, plus the package's browser-test dependencies.
They do not require installing all Scratch GUI dependencies:

```sh
# From the repository root, after building WASM:
npm ci --ignore-scripts
npm --prefix packages/crisp-basic ci --ignore-scripts
npm run package:crispbasic
npm --prefix packages/crisp-basic run test:brickwright
node scripts/verify-crispbasic-browser.mjs
```

Install Playwright Chromium first, or use the package's
`CRISP_BASIC_PLAYWRIGHT`/`CRISP_BASIC_CHROMIUM` overrides. The dedicated
`crispbasic.yml` workflow runs these checks after the existing engine, policy,
parity and browser suites, and retains the exact built runtime as a short-lived
Actions artifact.

The Node integration executes actual generated BASIC through the staged
runtime and GUI adapter against fixed expected results. The browser test mounts
the real editor lifecycle methods and control JSX together with the real
`VduTerminal`, using a small React shell around those seams. It checks actual
workers, input, Stop/Reset/unmount, error mapping, lazy loading, a non-root URL
prefix, missing assets and canvas pixels. This is focused integration evidence;
it is not a complete production GUI build, general circuit qualification or
validation of browsers other than Chromium. Connected-run tests also use the
actual pinned solver for fixed LED, switch, clock and cleanup expectations.

### Complete production GUI gate

After the production build above, install the root lockfile's Chromium and run:

```sh
npx playwright install chromium
node scripts/verify-crispbasic-production-assets.mjs
node scripts/verify-crispbasic-production.mjs
```

The dedicated workflow now has a separate `production` job after the `wasm`
job. It downloads that same run's compiled runtime, prepares the ordinary
vendored/overlaid workbench and builds the actual webpack application with
CAD and FPGA enabled. It uses the committed GUI lockfile, including its pinned
FPGA toolchain. Unrelated optional firmware downloads are not required, and
no component or runtime is replaced with a test shell.

The asset gate authenticates `build/static/crispbasic/` against the interpreter
build recipe and source inputs, checking all emitted bytes, including notices.
It also records the production build identity and SHA-256 hashes of the HTML,
entry scripts and lazy JavaScript chunks in
`artifacts/crispbasic-production/assets.json`. The browser gate serves only
the emitted build below a URL prefix and drives the complete editor and Circuit
through their production controls. Test reports, screenshots and logs are
retained with the workflow's production evidence artifact.

The ten scenarios cover generated and imported BASIC, the explicit portable
generation choice, digital/timing execution, reverse refusal without project
mutation, toggle refusal with Run disabled, physical error lines,
Latin-1 input/output, repeated VDU pixels, Stop/Reset/reuse, live Circuit GPIO
and timing, circuit-file replacement during blocked input, and explicit missing
board/runtime failures. Replacement is exercised while the original connection
and input prompt are still live, so an earlier tab-unmount cancellation cannot
stand in for the model's actual file-import boundary. Service workers are
blocked for this fresh-network build check; offline cache upgrades are a
separate qualification.

This gate covers the Chromium web application. Desktop/mobile shells, other
browser engines and the complete VDU language remain separate qualifications.
See [VALIDATION.md](VALIDATION.md) for the observed outcome and precise test
scope; adding a gate is not by itself evidence that it has passed.
