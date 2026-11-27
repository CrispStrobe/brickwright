# Brickwright integration

The Code tab's **BBC BASIC** profile now offers **CrispBASIC (browser)** and
**BBC BASIC Z80 (retro)** as separate engines. CrispBASIC is the default. The
6502 and 8086 BASIC routes retain their existing runners.

## Build and use

From the repository root, with Emscripten 3.1.64 available:

```sh
# Prepare the ordinary Brickwright GUI checkout/dependencies as documented in
# the repository BUILD.md. Vendor before staging the optional runtime.
npm run build:crispbasic
npm run package:crispbasic:check
npm run integrate
npm run build:gui
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

The generated source comes from the existing
`generateBASIC(project, {profile: 'bbc', lineNumbers: false})` implementation.
The adapter executes the current text directly; it does not round-trip it
through the subset reader first. The **To blocks** operation retains
`basicToPseudocode`'s conversion warnings. Generator warnings, including
commented hardware stubs, remain visible, and a generation-refusal placeholder
cannot run until the user edits it.

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

## Circuit simulation contract

`@crispstrobe/crispbasic/simulation` exposes the dependency-free deterministic
reference host described in [SIMULATION.md](SIMULATION.md). It defines logical
pin modes, reads/writes, explicitly scheduled input stimuli, integer-millisecond
time, bounded traces and reset/disposal semantics.

It advertises `basicBridge: false`, `hardware: false`, and
`circuitPhysics: false`. BASIC programs do not yet drive the Circuit canvas or
physical pins. The proposed ordinary `PROCpinMode`, `PROCdigitalWrite`,
`FNdigitalRead`, `PROCdelay` and `FNmillis` library still needs a bounded
request/reply bridge and an adapter to the actual board solver. The existing
restricted SYS/file/raw-memory policy is unchanged.

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
it is not a complete production GUI build, circuit qualification or validation
of browsers other than Chromium.
