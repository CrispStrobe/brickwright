# Kosmos CP1 implementation progress

Updated: 2026-11-25. Feature branch in all four repositories:
`feat/kosmos-cp1-20261124`. The accepted plan is
[KOSMOS-CP1-PLAN.md](KOSMOS-CP1-PLAN.md); the current UI, persistence, event and
browser contract is [CP1-EDITOR-CONTRACT.md](CP1-EDITOR-CONTRACT.md).

**Status: the continuation adds qualified semantic debugging, truthful source
views and CP5 circuits, controls and lessons. Focused verification and the current
Lite production build pass. All six scoped Chromium gates pass at Lite
`8498ebdd322b515aa97b6c3930ef77270e54a52e`; an existing global pin-chain gate is
not green.** This is a feature-branch candidate,
not a production deployment. November 24 results below are historical evidence,
not substitutes for checks of the current continuation.

## Current upstream identity

| Repository | Exact adopted commit | Continuation |
| --- | --- | --- |
| bw-board | `1fa4734c18c7e037ff220e508ad33da5273d999f` | Qualified CP1 observer, bounded command steps, teaching breakpoints, events and external-ROM acceptance |
| bw-circuit-ui | `dd1c007c4c5f2333f2acc905530703144f043ebf` | Live switch controls and correct CP1 fit/hit bounds |
| sb3-creator | `fdadba6743839763fcb8bb2fad64063937e16a7e` | CP5 example, electrical and monitor observations, four CP1 examples |

Lite's browser-qualified code checkpoint is
`8498ebdd322b515aa97b6c3930ef77270e54a52e`. The subsequent documentation-only
checkpoint is recorded by this file's Git history; it does not change the code
that was built and exercised in Chromium.
`vendor-pins.json` is the package identity authority; package specifications,
lockfile, integrated GUI, source notices and derived mirrors follow those pins.
Behavior remains in its owning package.

The sb3 adoption deliberately continues the already-selected CP1 feature lineage.
Its sync uses `--allow-stale` because this feature checkout does not contain every
unrelated default-branch change; no unrelated default-branch merge is included in
this milestone. That flag bypasses the ancestry freshness guard and can also
permit downstream vendor differences in a sync check. It is therefore not
proof of byte identity: separate vendor-identity tests, exact pin checks,
source/gallery sync and mirror checks establish the adopted contents.

## Implemented behavior

### Machine, circuit and original monitor

The original implementation remains the foundation: an independently authored
NMOS 8049 core with all 230 documented opcode encodings, banking, stack, flags,
timer/interrupts, MOVX, disassembly and validated snapshots; a separate 8155 RAM,
simple-I/O and externally clocked timer model; and CP1/CP3 wiring. The nominal
6 MHz crystal yields 400,000 machine cycles per second. CP1 exposes 128 teaching
cells, or 256 with CP3.

The complete CP1 system component has 38 GPIO contacts plus supply and ground.
All 40 contacts have geometry checks in eight rotation/mirror combinations.
The CP1 fit/hit footprint now matches its 300 × 400 drawing rather than the
48 × 48 fallback that clipped it in the browser.
Circuit inputs, output drives, resistors and LEDs use the normal electrical
solver. The machine and circuit retain one clock owner across attach, pause,
reset and target replacement. Freely rewired internal 8049/8155 construction
remains separate work.

The panel accepts a local 2048-byte monitor ROM and observes six raw segment
displays and 30 physical keys sharing 20 contacts. Keys have independent owners
and release on cancellation, blur, hiding, pause, replacement and teardown.
A live React 16 regression exposed a mismatched synthetic key-down/native key-up
owner. Both now use the same physical code, including `nativeEvent.code`, so a
released keyboard key cannot keep a contact held after pointer cancellation.
Original **RUN / STP / STEP** contacts execute through the firmware. **Run CPU /
Pause CPU / CPU step** control the emulator. Circuit-owned inputs hide manual
panel overrides. There is no second CPU, teaching-language VM or firmware fetch.

### Qualified semantic debugging and truthful UI

- Semantic features require the exact 2716 ROM SHA-1
  `ff4befcf82a664950186d3af1843fdef70d2209f`. Unknown ROMs and mask ROM B retain raw
  CPU execution/debugging without guessed teaching registers or source state.
- A declarative observer reports the teaching PC, the full two-byte accumulator,
  the qualified comparison flag, command boundaries and execution state. The
  comparison value is the current firmware flag, not a permanent record of the
  last comparison. Observation does not advance a separate clock.
- **Step CP1 command** runs real firmware to a command completion, terminal observation or
  explicit instruction budget. Budget exhaustion reports its reason and work
  used; another step can resume an in-progress command. Monitor-idle stepping
  refuses promptly and explains the original keypad STEP or breakpoint/RUN path.
- Teaching-cell breakpoints stop before commands, resume past the stopped
  boundary once, and trigger again on a later loop visit. Breakpoints are
  ephemeral debugger state, not persisted project content.
- Source highlighting requires the current source word to equal live RAM and,
  while executing, the captured command word. Missing command attribution,
  edited source and self-modified memory do not produce a guessed source line.
  The memory table also withholds stale source-line associations. A retained
  historical error event is not displayed as a current error after recovery.
- Frozen `cp1.command`, `cp1.halt` and `cp1.error` events expose qualified
  observations. Lite relays `bw-cp1-command`, `bw-cp1-halt` and `bw-cp1-error` for
  lessons. Publication coalesces the latest event per kind/cell in a bounded
  batch; it is not a complete replay trace. A generic return to the monitor after
  original keypad STEP/STP is observable as a halt but does not invent a completed
  command when the observer cannot distinguish those paths.
- Replacing a ROM pauses the session, cancels pending steps, clears queued lesson
  observations, releases keys, resets the same target and publishes its new
  paused state. Program edits, reset and target replacement also invalidate
  pending observations as appropriate.

### Programs, CP5, projects and lessons

The original assembler supports decimal cells, mnemonics, labels, ORG/EQU,
DATA/DB, bounded expressions, diagnostics, source maps and listing export.
There are now **four original examples**: `cp1-first-display`,
`cp1-switch-input`, `cp1-blink` and `cp1-cp5-binary`.

CP5 uses eight live switch inputs and eight current-limited LED outputs through
the normal circuit engine. The binary example has 35 parts and 67 wires, including
the existing Darlington-driver component. Its proof covers each individual bit,
mixed patterns and both endpoints. Original bilingual introductions explain
initialization, source loading, physical controls and expected behavior.
This is a simplified CP5-style 5 V teaching circuit, not a reproduction of the
original panel's complete power and transistor stage.

There are **ten original bilingual CP1 lessons**, still stored in the legacy
filename `lesson-waves/cp1-8.json`. One command checkpoint observes a completed
cell-0 AKO 42 with accumulator 00.042; manual confirmation remains available.
CP5 loading alone does not satisfy a lesson's execution checkpoint. The detector
checks real CP1 presence and event reachability while retaining unrelated
hardware/program diagnostics.

Portable CP1 projects and ordinary `.sb3` projects preserve source, incomplete
drafts, configuration and ROM identity. They exclude ROM bytes, held contacts,
automatic execution resumption and debugger breakpoints. Queued imports preserve
current source and circuit identity; storage refusal leaves the draft in memory.

## Current verification: November 25 continuation

These are measured scopes, not full repository, production-browser or physical
hardware qualification.

| Check | Current result |
| --- | --- |
| Board focused CPU, 8155, machine, circuit and debugger suite | 100 passed, including 17 semantic-debug tests |
| Original acceptance programs on the external, identified 2716 ROM | 11 scenarios passed; full accumulator load/store, comparisons and branches, nonzero start, CP3 jump, delay budget/resume, overflow, invalid command and loop breakpoint reentry |
| CP5 circuit with original synthetic 8049 stimulus | 14 input patterns passed through switch → CP1 P1 → firmware → 8155 P2 → driver/resistor/LED |
| CP5 circuit with the identified historical monitor | 13 input patterns passed, observing ports, cell 32, display segments and LED/resistor currents |
| Circuit UI focused regressions and production build | 49 live-control regressions and 40 geometry regressions passed (overlapping suites); builds passed |
| sb3 CP1 and topology regressions | 476 tests passed |
| Lite combined CP1, pins, vendor identity, lesson catalog and workflow tests | 78 passed, no skips; full 89-lesson catalog covered |
| Lite package provenance, engine census, SPIKE import and i8086 presets | 33 passed |
| Lite project bundle and one-board regressions | 36 passed |
| Exact existing SPIKE artifact regression | 1 passed |
| Actual component/host SSR and callback checks | 17 checks passed on each of React 18.3.1 and GUI React 16.14.0 |
| Installed package bytes at root and integrated GUI | Each installation matches 13,690 Board files and 1,425 Circuit UI files at the exact pins; single-engine resolution passed in both |
| Canonical source/gallery sync and derived mirrors | Passed, including regenerated Arcade inventory pin |
| Current Lite production Webpack build | Passed, exit 0, with Webpack 5.96.1 in approximately 61.6 seconds after the browser-discovered keyboard and fit fixes |
| Global pin-move-chain gate | Not green: current 38 passed / 5 failed; clean historical Lite `50b32fa7405dcc5f30637b23f1a6be69c0ee12de` reproduced all five failures and had 36 passed / 7 failed; both runs had 43 tests and no skips |
| Hosted CP1/CP5 browser workflow | All six gates passed at `8498ebdd`: connector, panel on React 18 and 16, shared runner/project restore on both, and CP5 on GUI React 16; separate hosted source suite 55/55 and SSR 17/17 per runtime |

The remaining global pin-chain failures concern epoch-gated historical x86
reader roles assuming older live Circuit UI/sb3 pins. The sealed reader bytes
match their original profile and are unchanged. The stable current scan adds no
new occurrence keys compared with the baseline; this is not new CP1 source-hash
drift. Preserve the failure record: focused passes do not mean every repository
gate is green.

The actual runner tests retain physical switch/LED solver observations, one-clock
continuity, paused time, reset, source/RAM editing, input ownership, atomic
rejection and traps against compilation or fallback firmware. Continuation
regressions cover semantic source attribution, event delivery and hot ROM
replacement during a pending step. SSR uses actual JSX/React with controlled
effects and event fixtures; it does not establish browser interaction or layout.

The 11-scenario Board receipt is upstream `docs/CP1-SEMANTIC-OBSERVATION.json`;
the CP5 receipt is sb3 `reference/cp1-cp5-observations.json`. These record original
programs and machine observations, with source identities, not firmware bytes.
The CP5 historical receipt retains the Circuit UI `5d5ad585` identity at which it
was measured. The later `dd1c007c` change affects CP1 hit/fit bounds; that receipt
is not restamped as a new electrical measurement.
No physical-hardware claim follows from simulated voltage/current measurements.

### Reproducible focused commands

Use sibling checkouts at the exact pins above and the repository's normal pinned
dependency/integrate procedure. From `bw-board`:

```sh
node --test test/mcs48.test.mjs test/mcs48-disasm.test.mjs test/i8155.test.mjs test/cp1-machine.test.mjs test/cp1-debug.test.mjs test/cp1-semantics.test.mjs test/cp1-circuit.test.mjs
node scripts/check-cp1-semantic-rom.mjs /path/to/monitor.bin report.json
```

The optional second command requires the user's matching ROM. It fetches and
bundles nothing. See upstream `docs/CP1-SEMANTIC-DEBUG.md` for API and budget
semantics. From `sb3-creator`:

```sh
node --test test/cp1-program.test.mjs
node scripts/verify-cp1-cp5.mjs --board ../bw-board --circuit-ui ../bw-circuit-ui
node scripts/verify-cp1-cp5-monitor.mjs --board ../bw-board --circuit-ui ../bw-circuit-ui --rom /path/to/monitor.bin
```

From `bw-circuit-ui`:

```sh
npm run verify:cp1
npm run build
```

From `brickwright-lite`:

```sh
SB3_CREATOR_DIR=../sb3-creator node --test --import ./scripts/lib/register-gui-scope.mjs test/cp1-*.test.mjs test/pinned-packages.test.mjs test/sb3-creator-vendor-identity.test.mjs test/lesson-defect-detector.test.mjs test/workflow-trigger-coverage.test.mjs
node --test --import ./scripts/lib/register-gui-scope.mjs test/project-bundle-*.test.mjs test/b8-one-board-per-run.test.mjs
node scripts/verify-cp1-components.mjs --deps ../bw-circuit-ui/node_modules --board ../bw-board
node scripts/verify-cp1-components.mjs --deps packages/scratch-gui/node_modules --compiler-deps ../bw-circuit-ui/node_modules --board packages/scratch-gui/node_modules/bw-board
node scripts/pin-packages.mjs --verify-installed --source bw-board=../bw-board --source bw-circuit-ui=../bw-circuit-ui --installed-root node_modules --installed-root packages/scratch-gui/node_modules
node scripts/package-upstream-notices.mjs --check
node scripts/sync-sb3creator.mjs --dir ../sb3-creator --check --allow-stale
node scripts/sync-examples.mjs --dir ../sb3-creator --check
node scripts/check-mirrors.mjs
```

The identity test is required alongside the deliberate `--allow-stale` checks.
Use an existing writable `TMPDIR` if needed. These commands cover focused
reproduction; the table also records separately run broader regression groups.
Browser gate commands and dependency arguments are maintained in
[CP1-EDITOR-CONTRACT.md](CP1-EDITOR-CONTRACT.md).

## Operating and stepping workflow

1. Open a CP1 gallery example, or place a CP1 system and use Build Machine.
   Import your compatible 2048-byte monitor ROM. Run the CPU until the monitor
   finishes initialization before loading teaching RAM.
2. Pause the CPU, edit/inspect the source and choose **Load cells**. Do not reset
   after loading: startup firmware may overwrite program RAM.
3. For semantic stepping with the qualified ROM, set a teaching-cell breakpoint
   at the desired starting cell, usually 000. Resume **Run CPU**, then enter
   `0, 0, 0, PC, RUN` on the original keypad. The breakpoint pauses before cell 0.
4. Use **Step CP1 command** to complete one teaching command through the monitor firmware.
   Inspect both accumulator bytes, the teaching PC, comparison and live memory.
   A budget stop reports its limit; another step resumes the pending command.
   Continuing a loop can revisit and stop at the same breakpoint.
5. At monitor idle, host **Step CP1 command** does not start a teaching program. Use the
   original keypad **STEP** while the CPU runs, or the breakpoint/RUN workflow.
   Unknown ROMs expose raw **CPU step** without a semantic interpretation.
6. The first-display example loops ANZ to keep `A00.042` visible. Original **STP**
   stops the teaching program; **Pause CPU** freezes simulated time. HLT returns
   to the monitor's position display and does not itself pause the emulator.
7. For `cp1-cp5-binary`, open **Instruments → Switches**. Closed means input 0;
   open means input 1 through the pull-up. Open only S1, S3, S6 and S8 for
   hexadecimal A5 / decimal 165, then inspect P1 input, P2 latch, cell 32 and LEDs.
   Pausing the CPU holds its output while switches can still change the input.
8. Save `.sb3` or export a CP1 project; reimport the ROM when needed. Saved
   projects retain its identity and incomplete source, but do not resume execution.

Machine and external-ROM tests establish the semantic workflow; scoped browser
gates establish the synthetic-firmware component/runner journeys. Full application
browser execution, including known-ROM semantic controls, remains unqualified.

## Hosted browser status and limits

[Run 45559592991](https://github.com/CrispStrobe/brickwright/actions/runs/45559592991)
**passed all six gates** on Lite `8498ebdd322b515aa97b6c3930ef77270e54a52e`.
The execution used Node 22.23.5, Playwright 1.61.1, Chromium 149.0.7827.55,
React 18.3.1 and the actual installed GUI React 16.14.0. The durable
[browser qualification receipt](receipts/cp1-browser-qualification.json)
records exact inputs, each gate, prior failures, artifact identity and limits.

| Chromium gate | Passed scope |
| --- | --- |
| Standalone CP1 connector | Eight orientations, 40 contacts, Build Machine base/CP3 configuration and ROM import validation |
| CP1 panel, React 18 and React 16 | Actual panel interaction, key release, source/RAM and import/configuration journeys; desktop and German dark 390-pixel layout |
| Shared runner, React 18 and React 16 | Real CircuitDesigner, Cp1Host, runner, board/adapter and clock; physical input through firmware to LED; pause/step/reset and ordinary project save/restore helpers |
| CP5, GUI React 16 | Eight live switches; 12 walking/mixed/endpoint patterns and 14 measured observations including paused keyboard input/resume; actual trainer containment after Fit and all controls reachable through the real inner scroll |

Artifact `14996873996` contains `inputs.json`, six per-gate `result.json` files
and screenshots. Its downloaded ZIP was verified against SHA-256
`82da06383c6454861510b072749633d3a312bfe1be14172af3116b0aa275227d`.
Screenshot inspection confirms the complete CP1 drawing fits at desktop and
390-pixel widths, all eight switch controls are reachable, the German dark
panel wraps its actions, and project restore preserves the incomplete draft
with CPU/keypad disabled until a ROM is supplied. At 390 pixels the circuit is
an overview; the generic voltage legend remains partly clipped at the canvas
edge. That minor limitation is retained in the receipt.

These are actual component and runner interactions around a minimal VM fixture,
using original synthetic firmware. The bundle and production `loadProjectFile`
helpers are real, but the surrounding buttons and VM delegate are fixtures.
The standalone connector uses Circuit UI's locked Board `85fcc3a2`; the integrated
runner uses Lite's exact adopted Board `1fa4734c`. The artifact records this
distinction. This does not qualify the complete production Scratch VM/menu flow,
historical-ROM semantic stepping in a browser, or physical hardware.

Three earlier hosted runs remain recorded as failures, not superseded passes:

| Run / Lite code | Finding resolved in the passing run |
| --- | --- |
| [45552587031](https://github.com/CrispStrobe/brickwright/actions/runs/45552587031) / `50b32fa7` | Connector passed; panel stopped before launch because the CommonJS Playwright import did not expose a named `chromium` export |
| [45555731912](https://github.com/CrispStrobe/brickwright/actions/runs/45555731912) / `ccac35d8` | React update synchronization, exact PropTypes alias and the production restore completion route needed fixture corrections |
| [45557001274](https://github.com/CrispStrobe/brickwright/actions/runs/45557001274) / `b9033ae6` | Connector and CP5 interaction passed; further asynchronous assertions needed correction, and browser/visual review exposed the real React 16 key-ownership and CP1 fit-footprint bugs |

Local launch remained blocked: November 24 Chromium failed its process-singleton
socket with `Operation not permitted`, and automatic approval review rejected
escalation. On November 25 the launcher was available but its binary was absent;
the standard Playwright download returned HTTP 403 through the workspace proxy.
No sandbox or download-policy bypass was attempted. Hosted execution supplied
the passing Chromium evidence; no local browser pass is claimed.

## Historical baseline: November 24

These checkpoints preserve the initial implementation lineage, not current pins:
Lite plan `b660a46c3151433e60619bd1e6f93d4b1870aec7`, lane claim
`65cf01247a7024ecac430ccf20040fd57bf8cd86`, panel/editor/projects
`ac8efe551afb8aefd5da8a506e3ac6c9441c3820`, and integration
`ea32e12828dd505908b2e6e9eee212d2036fe9d9`; Board
`85fcc3a2785130c3317cbce3e4f0457a4e8e180d`; sb3
`73f949086e2f074c2c045d76ef37c9ee4a43d271`; Circuit UI
`5627ad9d484613d5d022a20ca43efbcc2bed1872`.

| Historical check | November 24 result |
| --- | --- |
| Board focused suite / external reference comparison | 87 tests / 10 firmware-oracle scenarios passed |
| sb3 assembler/examples / Circuit UI focused regressions | 11 / 89 tests passed |
| Circuit UI contact geometry and build | 8 orientations × 40 contacts and production build passed |
| Lite CP1 / pin and vendor identity / SPIKE and census | 31 / 10 / 12 passed; combined command 53 passed |
| Project bundle and one-board | 36 passed |
| React SSR | 13 checks on each React 18.3.1 and React 16.14.0 passed |
| Lessons and detector | Eight CP1 lessons, 16 checkpoints clean; 21 detector tests covering 87 total lessons passed |
| Package provenance | Each root/GUI installation matched 13,684 Board and 1,422 Circuit UI files |
| Notices, mirrors, integrate and Lite production build | Passed; browser interaction did not pass |

The ten external-oracle cases used the named 2716 ROM and original programs for
display, input, arithmetic errors, branching, timed output and CP3. Blink matched
14 output transitions; sample loop intervals were 225.785, 225.610 and 225.995 ms
for a 200 ms delay operand plus firmware/program overhead. Instruction-start
versus completed-instruction callback timing caused a constant 5 microsecond
offset in that comparison. These are instruction-level, machine-cycle-accounted
observations, not oscillator-edge timing claims. The tests also established that
HLT after ANZ restores a position display, prompting the example's ANZ loop.

## Independent authorship and media boundary

CPU, hardware and editor/content writers began in independent contexts. They
used original Intel/Kosmos documentation and observable factual requirements,
without GPL source, translated algorithms, pseudocode or implementation structure.
The historical reference emulator was an external oracle only. The continuation
semantic writer received factual runtime observations and tested original
programs on the independent machine; it did not read GPL code or annotated ROM
source. No historical ROM or GPL emulator is bundled, fetched by the application
or made a runtime dependency. Known hashes identify media and grant no rights.

Sources and limitations are recorded in Board `docs/MCS48-IMPLEMENTATION.md`,
`docs/CP1-HARDWARE.md`, `docs/CP1-SEMANTIC-DEBUG.md` and local
[CP1-CLEAN-AUTHORSHIP.md](CP1-CLEAN-AUTHORSHIP.md).

## Remaining plan work

- Qualify the full production application and known-ROM semantic browser
  workflow, including production menus/VM restore and semantic controls. The
  six scoped synthetic-firmware Chromium gates are complete.
- CP2 physical recorder and analog threshold qualification. The independent
  monitor already saves and loads CAS/CAL through the digital cassette path.
- Complete the CP4 eight-channel module and qualify its original input and
  contact filters. The bilingual [relay signals example](../overlay/scratch-gui/examples/cp1-cp4-relay-signals/intro.md)
  exercises two channels on the shared CP1 circuit. The independent monitor
  drove both simulated contacts at startup, then ran the entry/exit sequence
  twice with no retrigger while the request stayed closed. The switched
  branches drew about 3.25 mA from a separate simulated battery.
  The [CP4 manual](https://www.retrozone.ch/docs/cp1/CP4-Relais-Modul.pdf)
  documents the eight-channel hardware and its original filtering.
- Freely rewired internal 8049/8155 schematic construction.
- Independently obtained mask-ROM-B qualification and additional firmware cases.
- Generic 8155 strobed-port modes and exact internal timer-register encoding;
  current simple-I/O and normalized timer limitations remain documented.
- Event replay, finer bus-phase timing, electrical calibration, analog key
  bounce/ghost paths, overvoltage display behavior and physical-hardware comparison.

Each source, firmware, component and Chromium result establishes its measured
scope. The remaining production-browser and hardware work stays explicit.
