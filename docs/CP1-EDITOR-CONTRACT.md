# Kosmos CP1 editor and front-panel contract

The CP1 panel displays one machine owned by the debugger. It does not create a
second CPU, execute teaching-language opcodes, synthesize a display from the
source, or fetch a monitor ROM. Source assembly comes from the independently
authored `sb3-creator/src/utils/cp1Program.js`, synced to `lib/cp1-program.js`.

## Component boundary

`components/tw-pseudocode/cp1-panel.jsx` accepts these props:

| Prop | Meaning |
| --- | --- |
| `snapshot` | Detached engine observation. The host owns its refresh rate. |
| `machine` | Optional read-only fallback: `snapshot()`, or `getDisplay()` and `readCell()`. The panel polls reads only. |
| `running`, `expansion`, `clockHz` | Current host execution/configuration state. Default clock is 6 MHz; expansion determines 128 or 256 cells. |
| `source`, `onSourceChange(text)` | Controlled source text. Changes are reported immediately, including incomplete syntax. |
| `romReference` | Optional `{sha256, byteLength: 2048, name?}` metadata; never ROM bytes. |
| `onKey(key, down)`, `onReleaseKeys()` | Logical matrix contacts and complete release. Digits are strings `0`–`9`; function names are uppercase. |
| `onRun()`, `onPause()`, `onStep()`, `onReset?()` | Host CPU controls. `onStep` advances one 8049 instruction, separate from keypad STEP. |
| `onStepCommand()`, `onToggleBreakpoint(address)` | Qualified CP1 command stepping and program-cell breakpoints over the same runner. Refusals propagate to the panel. |
| `onLoad(assembly, {source, clear: true})` | Atomically load a successful assembly. `assembly.words` contains `{address, opcode, operand, line, column}` entries. |
| `onWriteCell?(address, {opcode, operand})` | Optional paused RAM editing. Both cell bytes may be 0–255. |
| `onPortInput?(name, value)` | External input byte for P1, or P3 when expanded. |
| `onImportRom?({bytes, name, reference})` | Explicit local file import, 2048 bytes. If absent, the panel dispatches the existing media-load event. |
| `onSaveProject?(project)` | Optional host export. If absent, uses the existing app download helper. |
| `locale`, `colorMode` | English/German interface copy and light/dark styling. |

The fallback ROM event is `bw-machine-media-load` with detail
`{kind: 'cp1', slotId: 'rom', bytes, name}`. It occurs only after the user chooses
a local file. No default firmware image is packaged or downloaded.

`cp1-host.jsx` supplies the panel's workspace and callbacks. Its draft updater
keeps the latest source through asynchronous operations and preserves an edit in
memory if browser storage refuses a write. ROM/configuration requests are queued;
failed loaders reject back to the panel instead of producing a success message.
Configuration changes retain the machine's circuit `partId`, while only
expansion/clock settings enter the portable schema. When the runner reports
`cp1InputMode() === 'circuit'`, the host omits manual port controls: physical
switch wiring and the circuit sampler are the input authority.

Expected snapshot fields are `display`, `ports`, `cells`, `cpu`, `expansion` and
optional ROM metadata. `display.digits` contains six active-high segment masks,
physical left to right, bits a/b/c/d/e/f/g/dp. The fixed separator arrives as the
third digit's dp bit. The panel renders those bits directly, including blank or
nonnumeric monitor patterns. CPU PC/A/PSW/cycle values are labeled as 8049 state.
They are not presented as the CP1 teaching-program PC or accumulator.

### Qualified teaching-program state

The optional `snapshot.cp1` is produced by the engine observer. Both `available`
and `profileQualified` must be true before the panel displays the teaching PC,
the complete accumulator pair, comparison condition or command controls. The
2716 profile is admitted by the complete ROM SHA-1
`ff4befcf82a664950186d3af1843fdef70d2209f`. An unknown or mask-B ROM retains raw
8049 controls without guessed teaching state. The profile and bounded execution
contract are documented upstream in `docs/CP1-SEMANTIC-DEBUG.md`.

`Step CP1 command` drives the existing machine through monitor instructions;
there is no second interpreter or clock. It runs until an observed command
completion, a terminal condition or its instruction budget. A paused command
can be resumed after budget exhaustion. At the idle monitor, use the original
STEP key while the CPU runs, or set a listing breakpoint at the starting cell,
use Run CPU and enter `0, 0, 0, PC, RUN`. A cell breakpoint stops before the
teaching command; resuming permits that occurrence and can stop on loop reentry.

The source listing is a current draft. A highlighted source line requires exact
opcode/operand agreement with live RAM and, while running, the captured command.
Unknown or invalidated observation state receives no current-source highlight.
The memory table likewise withholds a source-line number when the draft differs.
The accumulator displays both bytes (for example `17.231`), and comparison is
the current monitor condition, not a retained verdict of the last comparison.
A cleared historical error is not presented as a current monitor error.

Breakpoints are session controls. They are not serialized as portable project
state. ROM replacement pauses the shared session, cancels any pending step and
queued observations, releases keys, resets the target and publishes paused state.

## Key lifetime

`lib/cp1-panel-input.js` declares 30 physical buttons and 20 logical contacts.
The two sets of digit buttons share contacts. Pointer, keyboard and assistive
click owners are tracked independently. A contact opens only when its final
owner releases it. Keyboard ownership uses `event.code`, then
`event.nativeEvent.code` for React 16, with `event.key` as a legacy fallback.
Synthetic key-down and native window key-up therefore release the same owner.
Repeat keydown does not create another owner. Pointer up,
pointer cancel, lost capture, leaving the panel, window blur, hidden documents,
pause, machine replacement and unmount all release the appropriate inputs.

Keyboard shortcuts operate while the panel has focus and ignore source/input
fields and browser modifier shortcuts. Digits map directly; Enter maps RUN,
Escape STP, Backspace/Delete CLR, and F1–F10 the function row. Enter/Space on a
focused keypad button operates that button; ordinary controls keep native
activation. The keypad's physical function names remain CAS, CLR, PC, ACC, CAL,
STEP, STP, RUN, OUT and INP.

## Persistent data

`lib/cp1-project.js` separates a complete program export from editing state.

`brickwright.cp1-project`, version 1, stores `target: kosmos-cp1`, explicit
`configuration`, a nullable ROM digest reference, `source`, and sparse `words`
containing only address/opcode/operand. Source and words must agree when source
is present. A source-free manual RAM image may contain arbitrary bytes. Base
addresses are 0–127; CP3 addresses are 0–255. JSON, source, names and collections
are bounded. Extra fields, duplicate addresses, unsupported versions and embedded
ROM content are rejected.

`brickwright.cp1-workspace`, version 1, stores only configuration, ROM reference
and source. Its validator preserves incomplete or invalid source so ordinary
saving cannot discard a line being edited. It does not create a runnable word
image. Normal projects and workspaces accept no held keys, live CPU state,
debugger resume snapshots, ROM bytes, URLs or prototype fields. Session save
states belong to the engine's independent debugger contract.

## Learning and verification

`lesson-waves/cp1-8.json` contains ten original English/German lessons. Most
checkpoints use manual completion for conceptual reasoning and observations;
opening a panel, loading cells or clicking an input is not claimed to prove a
correct display or output waveform. Timing copy separates requested delay from
measured period and permits an explicit unavailable measurement when no suitable
trace exists. ROM-dependent behavior requires a user-provided compatible image.

The command-debugging lesson has one automatic checkpoint. `bw-cp1-command`
must report an actually completed cell-0 `AKO 42` with accumulator `00.042`.
The shared runner relays qualified `cp1.command`, `cp1.halt` and `cp1.error`
engine events as `bw-cp1-command`, `bw-cp1-halt` and `bw-cp1-error`. Its bounded
batch keeps the latest event of each kind/cell until UI publication; it is not a
complete execution trace. Reset, program edits and ROM/target replacement clear
pending observations. Manual completion remains available without a qualified ROM.
The CP5 lesson requires observed switch, RAM and LED states and does not complete
automatically merely because its source or circuit was loaded.

Run the focused source suites with:

```sh
node --test --import ./scripts/lib/register-gui-scope.mjs test/cp1-project.test.mjs test/cp1-panel-input.test.mjs test/cp1-lessons.test.mjs
```

These tests cover data boundaries, real key-ownership callbacks, raw segment
preservation, read-only snapshot access, lesson locality and honest observation
metadata. The upstream assembler suite additionally checks exact example bytes,
range/duplicate diagnostics, sparse listings and source-map round trips. Full
React/browser and circuit proofs are separate integration gates and must not be
inferred from passing parser or helper tests.

The additional component gate uses an explicitly supplied test dependency
registry and the independently authored engine checkout:

```sh
node scripts/verify-cp1-components.mjs --deps ../bw-circuit-ui/node_modules --board ../bw-board
node scripts/verify-cp1-components.mjs --deps packages/scratch-gui/node_modules --compiler-deps ../bw-circuit-ui/node_modules --board packages/scratch-gui/node_modules/bw-board
node scripts/verify-cp1-panel-browser.mjs --deps ../bw-circuit-ui/node_modules --board ../bw-board
node scripts/verify-cp1-runner-browser.mjs --deps ../bw-circuit-ui/node_modules --board ../bw-board --circuit ../bw-circuit-ui
node scripts/verify-cp1-runner-browser.mjs --deps packages/scratch-gui/node_modules --compiler-deps ../bw-circuit-ui/node_modules --board ../bw-board --circuit ../bw-circuit-ui
node scripts/verify-cp1-cp5-browser.mjs --deps packages/scratch-gui/node_modules --compiler-deps ../bw-circuit-ui/node_modules --board ../bw-board --circuit ../bw-circuit-ui --example overlay/scratch-gui/examples/cp1-cp5-binary/circuit.json
```

The optional `--compiler-deps` flag selects the Vite/Oxc/Playwright registry and
defaults to `--deps`. React and its renderer always come from `--deps`. Browser
scripts use Playwright's installed Chromium by default; `--executable` selects an
explicit existing browser. The runner's `--compile-only` flag only checks the
fixture production bundle and must not be reported as a browser pass.

On 2026-11-25, both SSR commands passed the same 17 checks: first with React
18.3.1, then with the GUI's actual React 16.14.0 and installed pinned `bw-board`.
Vite/Oxc compiled the JSX in both runs. The checks cover
actual JSX/SSR rendering, raw masks, key lifetimes, load/ROM refusal feedback,
real RAM writes, source preservation, storage refusal recovery, queued CP3/ROM
operations, circuit input ownership, full teaching-accumulator rendering,
stale-source refusal and semantic callback/error propagation. Event surfaces and effect scheduling are
controlled test doubles, PropTypes uses a validator-only stub, and CSS uses the
actual stylesheet's class names. This is a component/callback proof, not a full
application or visual browser pass. React 16.14.0 compatibility is exercised by
the second command within these stated boundaries.

On 2026-11-24, browser launch was blocked before page load by the execution sandbox:
Chromium's process singleton could not create its socket (`Operation not
permitted`). The sanctioned escalation request was automatically rejected because
the policy disables sandbox approval. That attempt produced no browser pass or screenshots.
The checked-in browser fixture uses an original synthetic 8049 ROM and reports a
failure when browser launch is unavailable; it does not silently skip the gate.

### CP2 cassette

The CP1 host exposes a CP2 deck when the attached Board supports cassette
transport. Use the independent CP2 monitor or the 2716 image. Open a 16-bit PCM
WAV, run the CPU, and press CAL during the leader. For saving, arm the deck and
press CAS. When the complete tape is available, Save WAV exports the recorded
signal. STP stops firmware transfer, and Eject removes the virtual tape.

The deck shares the machine's simulation clock. Pausing the CPU pauses the
tape. Transfer affects the original P1 pins and teaching RAM. A truncated input
can leave complete bytes in RAM before F007. Waveforms, tape position and
recording buffers are transient session data and stay outside saved projects.

The runner browser fixture accepts `--cassette-rom /path/to/cp2-monitor.bin` for
a local WAV import, CAL and F007 recovery check.

The Chromium 149 fixtures with React 18.3.1 and 16.14.0 passed the cassette controls with the
independent CP2 image. It exercised arm/discard, file import, physical CAL,
preservation of completed tape bytes on F007, and ejection on the shared
runner. Complete tape exchange is covered by the Board pin-level checks.

## Hosted browser qualification

The focused `CP1 browser qualification` workflow runs on the CP1 feature branch
and relevant pull-request/main changes. It reads exact engine and Circuit UI
revisions from `vendor-pins.json`, installs the locked test dependencies, actual
GUI React runtime and Playwright Chromium, and runs the connector and panel gates.
Panel and shared-runner journeys run on both React 18 and the GUI's React 16. It preserves
`inputs.json`, per-gate `result.json`, desktop/narrow screenshots and available
failure screenshots in one workflow artifact. The job has read-only repository
permissions and does not deploy or publish the application.

`inputs.json` distinguishes the standalone connector's engine (the Circuit UI
development lock) from the shared runner's engine (the exact Lite-adopted source
alias). It also records the actual Node, Playwright and both React versions. A
connector geometry pass is not reported as a newer engine's semantic-debug pass.

The shared-runner fixture mounts the actual CircuitDesigner and Cp1Host, starts
the actual `createDebugRunner`, and uses the actual project-bundle save helper
and production `loadProjectFile` restore route. The circuit and CPU share the
same board, adapter and simulation clock.
It checks ROM import, a visible circuit-button press through P1/8049/8155/P2 to
the resistor and LED, pause/CPU-step/reset clock behavior, source assembly/RAM,
and downloading/restoring an `.sb3` carrying incomplete source and configuration
without firmware or held keys. A compiler trap rejects any unexpected attempt
to send the CP1 program to the block compiler.

The CP5 gate loads the adopted 35-part, 67-wire teaching workbench and clicks the
eight actual live switch controls. Walking-bit, mixed-byte and endpoint patterns
must agree in P1, P2 and all eight current-limited LED branches. Desktop and
390-pixel screenshots record the actual layout. This gate uses the installed
GUI React runtime. The narrow journey collapses the rails through their actual
buttons before fitting the circuit, then reopens the live controls. A keyboard
toggle while paused must change the contact without advancing either clock;
resuming the CPU must propagate the new byte to the LED branches.

These are real component/connector interactions against adopted sources, with
original synthetic firmware. The surrounding page and minimal VM interface are
test fixtures, PropTypes uses a validator-only stub, and the `.sb3` buttons call
the actual bundle/loader helpers directly. The minimal VM delegate validates the
fixture archive and records the loader call. This scope does not include production GUI
menus, the complete Scratch VM, historical-monitor semantics or physical
hardware. The JSON records that boundary. Assertion failures are fatal, and
later browser gates still collect evidence after an earlier failure. A gate may
be reported as passing only after its own assertions succeed; the whole workflow
must pass before claiming complete qualification of this scope.

The [initial hosted run](https://github.com/CrispStrobe/brickwright-lite/actions/runs/45552587031)
at Lite `50b32fa7405dcc5f30637b23f1a6be69c0ee12de` passed the connector gate in
Chromium 149.0.7827.55, covering all eight orientations, 40 contacts, base/CP3
configuration and synthetic-ROM import. Its desktop screenshot was inspected.
The panel gate failed before launch because importing Playwright's resolved
CommonJS file by URL did not expose a named `chromium` export. The shared fixture
loader now uses the explicitly supplied registry's CommonJS API, with a checked
`chromium.launch` function. The initial run remains recorded as failed; its
connector result does not qualify the panel or shared-runner journeys.

The continuation workspace on 2026-11-25 has a Chromium launcher without its
underlying binary, and the standard Playwright download returns HTTP 403 from
the workspace network proxy. No escalation or alternate download bypass was
used. Hosted execution is the reproducible qualification route for this
environment; the local source/component tests remain separate evidence.

### Subsequent hosted findings

Run [45555731912](https://github.com/CrispStrobe/brickwright-lite/actions/runs/45555731912)
at `ccac35d80d2c03c0faa4adc77b2b5d3284b456ec` passed the connector and reached
real switch/firmware/LED behavior in the shared runner. The remaining fixtures
needed React update synchronization, an exact PropTypes alias, and the production
project loader's completion event. Those fixture defects were corrected.

Run [45557001274](https://github.com/CrispStrobe/brickwright-lite/actions/runs/45557001274)
at `b9033ae6ebea0b5854f9489110373a3bbcc76728` passed the connector and CP5
electrical/control gate: eight switches, twelve patterns and fourteen measured
observations, including paused keyboard control. Its overall status remained
failed. Further assertions needed to wait for queued CP3 configuration and the
runner's scheduled instruction step. It also exposed a real React 16 keyboard
ownership bug, now covered by a regression that failed before the product fix.

Inspection of that run's CP5 screenshots found clipped trainer artwork. The
Circuit UI fit path used a 48 × 48 fallback for the 300 × 400 CP1 part. Upstream
`dd1c007c4c5f2333f2acc905530703144f043ebf` corrects its footprint with rotated/
mirrored bounds and fit regressions. The browser gate now requires containment
of the actual rendered trainer after Fit and proves all eight controls are
reachable through the instruments pane's real inner scroll at 390 pixels.
The old screenshots are retained as evidence of the defect, not a layout pass.

### Passing hosted checkpoint

[Run 45559592991](https://github.com/CrispStrobe/brickwright-lite/actions/runs/45559592991)
completed successfully on Lite `8498ebdd322b515aa97b6c3930ef77270e54a52e` after
these product and fixture fixes. All six gates passed: standalone connector,
panel on React 18 and 16, shared runner/project restore on both versions, and
CP5 on the installed GUI React 16. The hosted source suite passed 55 tests and
the SSR gate passed 17 checks per runtime. This is the complete browser scope
defined above, not the complete production application.

The actual versions were Node 22.23.5, Playwright 1.61.1, Chromium
149.0.7827.55, React 18.3.1 and GUI React 16.14.0. The adopted suppliers were
Board `1fa4734c18c7e037ff220e508ad33da5273d999f`, Circuit UI
`dd1c007c4c5f2333f2acc905530703144f043ebf` and sb3
`fdadba6743839763fcb8bb2fad64063937e16a7e`. The standalone connector retained
its own locked Board `85fcc3a2785130c3317cbce3e4f0457a4e8e180d`; the integrated
runner used the adopted `1fa4734c` source alias.

The [browser qualification receipt](receipts/cp1-browser-qualification.json)
records those identities, each gate, historical failures and visual observations.
Artifact `14996873996` was downloaded and its ZIP verified against SHA-256
`82da06383c6454861510b072749633d3a312bfe1be14172af3116b0aa275227d`.
Final screenshot inspection confirms complete CP1 artwork after Fit at desktop
and 390 pixels, all eight live switches reachable through the actual controls
scroll, and the restored unfinished source with no ROM or execution resumption.
The English desktop and German dark narrow panel screenshots are byte-identical
across the two React versions. At narrow width the circuit is an overview and
the generic voltage legend is partly clipped at the right canvas edge; that
limitation is recorded. Source-listing columns use their own horizontal scroll.

This documentation checkpoint does not change the qualified code. Historical
monitor semantic controls in a browser, production GUI menus/the full Scratch
VM, and physical hardware remain outside this successful fixture qualification.
