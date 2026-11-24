# Kosmos CP1 implementation progress

Date: 2026-11-24. Feature branch in all four repositories: `feat/kosmos-cp1-20261124`.
The accepted plan is [KOSMOS-CP1-PLAN.md](KOSMOS-CP1-PLAN.md).

**Status: substantial first implementation saved remotely; production compilation
passed, while browser qualification remains open.** This is a feature-branch candidate, not a production
deployment. The sections below distinguish implemented behavior, measured evidence,
and the later work still required by the plan.

## Remote checkpoints and package identity

| Repository | Commit | Checkpoint |
| --- | --- | --- |
| brickwright-lite | `b660a46c3151433e60619bd1e6f93d4b1870aec7` | Accepted plan and independent implementation constraint |
| brickwright-lite | `65cf01247a7024ecac430ccf20040fd57bf8cd86` | Canonical lane claim merged into feature branch |
| brickwright-lite | `ac8efe551afb8aefd5da8a506e3ac6c9441c3820` | Panel, editor, project persistence, examples and eight lessons |
| brickwright-lite | `ea32e12828dd505908b2e6e9eee212d2036fe9d9` | Integration fixes, exact upstream pins, package notices, derived mirrors and verification gates |
| bw-board | `227cd54a2a87a6e17281158a962d199c58561534` | Original 8049 core, disassembler and instruction tests |
| bw-board | `50a6786cd7d13048ef98047084e2fb3822533a0c` | 8155, CP1/CP3, circuit adapter, debugger and system connector |
| bw-board | `85fcc3a2785130c3317cbce3e4f0457a4e8e180d` | Real circuit sampling, clock continuity and ten firmware-oracle scenarios |
| sb3-creator | `e6b8a91258f2a1773dc0faa60b68bfcab83a8188` | Original assembler and teaching programs |
| sb3-creator | `480efb1e8cfb346dccaecdf8ada1c972b9ab90a5` | Gallery registration and LED/button circuits |
| sb3-creator | `90af57f811c52de5c1f033f2fef51690275a4fc4` | Firmware-verified steady first-display example |
| sb3-creator | `73f949086e2f074c2c045d76ef37c9ee4a43d271` | Explicit monitor initialization and safe program-loading order in all six introductions |
| bw-circuit-ui | `5627ad9d484613d5d022a20ca43efbcc2bed1872` | Placeable CP1/CP3 connector, extraction, ROM picker and geometry tests |

The subsequent documentation checkpoint is identified by this file's own Git
history. Lite's `vendor-pins.json` records the exact adopted upstream revisions;
root package specifications, lockfile, integrated GUI specifications and package
source notices derive from those pins. Behavior remains in its owning package.

## What is implemented

### Emulator and hardware

- Independently authored JavaScript NMOS MCS-48/8049 CPU from original Intel
  documentation: all 230 documented opcode encodings, explicit reserved-opcode
  behavior, register and memory banking, RAM stack, arithmetic flags, timer,
  prescaler, external/timer interrupts, T1 counter, port latches, MOVX, expander
  hooks, disassembly and validated snapshots.
- Separate Intel 8155 RAM, simple I/O and externally clocked timer model. The CP1
  machine owns chip selection and wiring; each selected chip sees the bus write.
- CP1 firmware execution at the nominal 6 MHz crystal rate, with 400,000 machine
  cycles per second; 128 teaching-program cells, or 256 with CP3.
- Actual keyboard contacts and multiplexed display observations, including the
  fixed decimal separator. CPU state is labeled as 8049 state, not guessed CP1
  accumulator/PC values.
- CP3 RAM and additional ports, documented reset distinctions, atomic media and
  program loading, detached snapshots, CPU instruction stepping and breakpoints.
- One shared engine and circuit clock. Attaching an already-running BoardImpl,
  pausing, resetting and replacing a target preserve electrical time continuity.
- A complete CP1 system connector with 38 GPIO contacts plus supply and ground.
  Circuit inputs are sampled from wired nodes; output drives and switch/LED
  behavior use the normal electrical solver. Unwired pins do not become grounded
  merely because the generic board API returns a missing-node sentinel.

### Circuits and panel

- Original CP1 connector artwork with shared contact geometry, base/CP3 palette
  choices, lazy artwork loading, extraction and explicit configuration transfer.
- All 40 contacts match the rendered part in eight rotation/mirror combinations.
  Fixes also remove a phantom center snap target and align shared art-face
  terminal transforms with the SVG transform order.
- Local 2048-byte monitor-ROM import; no automatic firmware download.
- Six raw segment displays, 30 physical keys sharing 20 contacts, independent
  pointer/keyboard owners, and complete release on cancellation, blur, hiding,
  pause, target replacement and teardown.
- Source editor, decimal RAM cells, port observations, CP3 configuration and
  separate **Run CPU / Pause CPU / CPU step** controls. The original keypad
  **RUN / STP / STEP** contacts still operate through the monitor firmware.
- The panel observes the engine; it has no second CPU or teaching-language VM.
  When a real circuit supplies input pins, manual panel overrides are hidden.

### Programs, projects and lessons

- Original CP1 assembler/parser with decimal cells, mnemonics, labels, ORG/EQU,
  DATA/DB, bounded expressions, address/port checks, duplicate diagnostics,
  source maps and reparsable listing export.
- Three original examples: `cp1-first-display`, `cp1-switch-input` and
  `cp1-blink`, with editable circuits and English/German introductions.
- Eight original bilingual lessons: first display; keypad and CPU/CP1 steps;
  memory/source; switch reading; output timing; labels/diagnostics; CP3
  capacity/ports; and saving/evidence.
- Portable CP1 project export and an optional CP1 section in normal `.sb3`
  projects. Draft persistence preserves incomplete source and ROM identity.
  It excludes ROM bytes, held keys and automatic execution resumption.
- Queued asynchronous configuration/ROM operations preserve current source,
  circuit identity and visible error feedback. Storage refusal retains the
  current draft in memory.
- The lesson detector recognizes valid declared CP1 source and named built-in
  keypad actions only when a CP1 system is actually loaded. It still reports
  missing external buttons/switches, invalid source and unrelated absent programs;
  its severity rules, event reachability checks and exception set are unchanged.

## Verification completed

These are focused measurements for this feature, not a full repository or
physical-hardware qualification claim.

| Check | Result |
| --- | --- |
| bw-board CPU, 8155, CP1, circuit/debugger and target registry suite | 87 passed; no failures or skips |
| External firmware-oracle scenarios | 10 passed for the identified 2716 ROM |
| sb3-creator CP1 assembler/examples | 11 passed |
| Circuit UI focused CP1, extraction, palette, simulation, serialization, rotation, seating and snap regressions | 89 passed |
| Circuit UI actual React SSR/contact geometry | 8 orientations × 40 contacts passed |
| Circuit UI production Vite build | Passed |
| Lite CP1 project, input, lessons, archive and actual runner tests | 31 passed |
| Lite pin metadata and sb3 byte-identity checks | 10 passed; 21 canonical vendor files identical after declared rewrites |
| Lite existing SPIKE round-trip and regenerated engine-census checks | 12 passed at the final supplier pins |
| Lite existing project-bundle and one-board regression suite | 36 passed; no failures or skips |
| Lite actual React SSR and controlled component/host callbacks | The same 13 checks passed on React 18.3.1 and the GUI's installed React 16.14.0 |
| Example sync and canonical sb3 source sync | Passed |
| Eight-lesson defect scan | 16 checkpoints; no blocking or review findings |
| Lesson detector regression and full-catalog blocking gate | 21 tests passed; all 87 lessons covered, including eight new CP1 positive/negative checks |
| Root and GUI installed package provenance | Each installation's 13,684 engine files and 1,422 Circuit UI files match pinned Git/npm-pack bytes; single engine resolution within each installation |
| Package source notices | Nine files across source, integrated GUI and production output match the adopted pins and upstream license bytes |
| Tracked source mirrors and pin literals | Passed; canonical source/example checks also passed separately |
| Lite integrate step, including existing native broker asset/proof checks | Passed |
| Lite production Webpack build | Passed after the documented dependency and overlay setup |

The actual runner tests include a physical switch → CP1 Port 1 → original
synthetic 8049 firmware → 8155 Port 2 → resistor/LED path, with solver voltage
and current observations. They also cover an existing board at 100 ms, input
ownership, paused time, reset continuity, key release, malformed/absent ROMs,
a raw binary ROM beginning with 0x3A, atomic program rejection, and traps proving
that CP1 neither invokes block compilation nor fetches fallback firmware.

The final combined Lite CP1/pin/vendor/SPIKE/census command passed 53 tests with
no failures or skips. The separate project-bundle/one-board regression command
passed 36. New Node tests participate in the normal upstream and Lite test
commands; the separately documented browser gates are not automatic CI steps.

The component proof runs actual JSX through React 18.3.1 and the installed GUI's
React 16.14.0, using Vite/Oxc to compile the JSX. Effects,
event surfaces and CSS-module names are controlled test fixtures; it is not a
browser interaction or visual proof. Browser fixture compilation passed.

### Reproducible focused commands

From `bw-board`:

```sh
node --test test/mcs48*.test.mjs test/i8155.test.mjs test/cp1*.test.mjs test/target-kinds-leaf.test.mjs
node scripts/check-cp1-oracle.mjs /path/to/monitor.bin /path/to/reference.cjs report.json
```

The optional oracle command requires external inputs and does not fetch or
package them. See upstream `docs/CP1-ORACLE.md` and its committed observation.

From `sb3-creator`:

```sh
node --test test/cp1-program.test.mjs
```

From `bw-circuit-ui`:

```sh
npm run verify:cp1
npm run build
npm run verify:cp1:browser
```

The browser command is a remaining gate; it is not included in the passed results.

From `brickwright-lite`, with sibling upstream checkouts at the recorded pins:

```sh
SB3_CREATOR_DIR=../sb3-creator node --test --import ./scripts/lib/register-gui-scope.mjs test/cp1-project.test.mjs test/cp1-panel-input.test.mjs test/cp1-lessons.test.mjs test/cp1-bundle.test.mjs test/cp1-runner.test.mjs test/pinned-packages.test.mjs test/sb3-creator-vendor-identity.test.mjs
node --test --import ./scripts/lib/register-gui-scope.mjs test/project-bundle-*.test.mjs test/b8-one-board-per-run.test.mjs
node scripts/verify-cp1-components.mjs --deps ../bw-circuit-ui/node_modules --board ../bw-board
node scripts/verify-cp1-components.mjs --deps packages/scratch-gui/node_modules --compiler-deps ../bw-circuit-ui/node_modules --board packages/scratch-gui/node_modules/bw-board
node scripts/pin-packages.mjs --verify-installed --source bw-board=../bw-board --source bw-circuit-ui=../bw-circuit-ui
node scripts/package-upstream-notices.mjs --check
node scripts/sync-sb3creator.mjs --dir ../sb3-creator --check
node scripts/sync-examples.mjs --dir ../sb3-creator --check
node scripts/check-mirrors.mjs
node --test --import ./scripts/lib/register-gui-scope.mjs test/lesson-defect-detector.test.mjs test/cp1-lesson-defects.test.mjs
```

Use an existing writable `TMPDIR` when the host has no default temporary directory.
For the separate browser gate and its dependency arguments, see
[CP1-EDITOR-CONTRACT.md](CP1-EDITOR-CONTRACT.md).

## Firmware oracle observations

The research/oracle side supplied external 2716 firmware, SHA-1
`ff4befcf82a664950186d3af1843fdef70d2209f`, to both machines. Ten newly authored
scenarios compare registers, RAM cells and port behavior: steady 42/73 display,
low/high input, arithmetic overflow/underflow, equality branch, timed output,
CP3 ports and a jump to expanded cell 128. All passed. Steady 42 and F006 error
also have explicit segment expectations.

After boot and physical `0, 0, 0, PC, RUN` contacts, the seven-cell blink produced
the same fourteen Port 2 transitions and intervals. Intervals included 225.785,
225.610 and 225.995 ms. A 200 ms delay operand is not a promise of a 200 ms
complete program-loop interval.

Our callbacks report instruction-start boundaries; the reference reports
completed-instruction boundaries. For that blink, absolute edge timestamps
differ by a constant 5 microseconds. The implementation claims instruction-level
execution with machine-cycle accounting, not oscillator-edge bus timing.

The observations also corrected the first display lesson. HLT immediately after
ANZ returns to the monitor's position display (`P003` for that program); the
shipped example loops over ANZ so `A00.042` remains visible until STP.

The oracle identified a reversed keyboard-column assumption. The independent
hardware writer rechecked the original schematic and its crossed wires before
correcting it. No reference implementation was supplied to that writer.

## Clean-room and media boundary

The CPU, hardware and editor/content writers began in fresh subagent contexts.
They used original Intel/Kosmos documentation and received hardware requirements
or observable test outcomes. They did not receive GPL source, translated
algorithms, derived pseudocode or reference implementation structure.

The GPL emulator and historical ROM remained external oracle inputs. Neither is
a runtime dependency or committed asset. Tests bundled in the repositories use
original synthetic firmware. Known ROM hashes are identification metadata, not
a redistribution permission.

Authorship and technical sources are recorded in upstream
`docs/MCS48-IMPLEMENTATION.md`, `docs/CP1-HARDWARE.md`, and local
[CP1-CLEAN-AUTHORSHIP.md](CP1-CLEAN-AUTHORSHIP.md).

## Trying the feature

1. Check out the feature branch and follow the repository's normal pinned
   dependency/integrate/build procedure.
2. Open `cp1-first-display` in the circuit example gallery, or place the CP1
   component and use Build Machine. The CP1 panel appears for the CP1 debug target.
3. Use **Import monitor ROM** with your compatible 2048-byte image. Run the CPU
   and let the monitor finish initialization before loading teaching-program RAM.
4. Pause the CPU, inspect the source, choose **Load cells**, then resume the CPU
   without resetting it. Startup firmware can overwrite program RAM after reset.
   Enter `0, 0, 0, PC, RUN` on the original keypad to run from teaching cell 0.
5. Compare the display with `A00.042`. Use STP to stop the teaching program;
   **Pause CPU** freezes all simulated time. The two controls serve different purposes.
6. Try the input and LED examples. Save the ordinary `.sb3` project or export a
   CP1 project. Reimport the ROM when needed; project files contain its reference.

This is the intended source-backed workflow. End-to-end execution in the full
Lite browser has not been qualified in this workspace.

## Build and browser status

The complete Lite GUI production build passed using the documented
`--legacy-peer-deps` install path and the normal VM, Paint and Render overlays.
A plain npm install first refused the pre-existing React 16 GUI versus React 18
Circuit UI peer declaration. The compatibility flag is already used by the
repository README and CI; this feature does not change React versions.
Tracked gallery and license assets were materialized before final build checks.
The CP1-specific CSS compatibility warning was corrected; asset/entrypoint size
warnings do not constitute an interaction or performance qualification.

Chromium could not start: the sandbox refused its process-singleton socket with
`Operation not permitted`. Automatic approval review rejected the sanctioned
escalation request because sandbox approval is disabled. No alternate browser
execution route was attempted. Both reusable browser gates remain checked in
and fail explicitly when browser launch is unavailable; no screenshot, visual
pass or full-application interaction pass is claimed.

## Remaining plan work

- Finish live-browser qualification, including project
  restore, keyboard/pointer interactions, input circuits and layout at different
  screen sizes. Preserve actual failure observations.
- Hash-qualified semantic CP1 stepping, breakpoints, source highlighting and
  teaching-register views. The original monitor STEP contact and raw 8049
  instruction stepping already work; a host-level CP1 semantic debugger is later work.
- CP2 cassette pulse transport/CAS/CAL, and dedicated CP4 relay/CP5 teaching surfaces.
- Freely rewired internal 8049/8155 schematic construction. The current part is
  the complete CP1 system with real external I/O.
- More firmware scenarios, independently obtained mask-ROM-B qualification,
  and physical-hardware comparisons. The named 2716 image is the tested variant.
- Generic 8155 strobed-port modes and exact internal timer-register encoding.
  The current simple-I/O and normalized timer model reports its limitations.
- Event replay, finer bus-phase timing, electrical calibration, analog key
  bounce/ghost paths and overvoltage display behavior.

The first slice is intentionally explicit about these boundaries. Passing a
firmware oracle, source test or renderer does not establish the unmeasured
capabilities above.
