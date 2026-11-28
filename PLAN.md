# Brickwright improvement plan

The [workbench owner roadmap](docs/WORKBENCH-OWNER-ROADMAP.md) tracks the machine, circuit, desktop, and editor requests and their verification.

## Language execution across Simulator and silicon — 2026-11-28

The owner-requested extension covers Python, JavaScript and C across the Code
tab, Simulator and physical boards. Extend the existing
[language/device matrix](docs/LANGUAGE-DEVICE-MATRIX-PLAN.md) and
[code runtime plan](docs/CODE-RUNTIME-AND-GAME-EXPORT.md); preserve the
R0–R4, G0–G4 and J0–J6 tracks and the existing capability registry.

### Current source audit

Baseline: main `b474327531ab9133f27c69fce9c6bd776bce2b50`. These are implemented
routes and their limits, not a new hardware qualification. The host application
has browser and Tauri Windows/macOS/Linux/Android/iOS targets; host packaging
does not establish which languages run on each simulated or physical machine.

| Area | Existing route | Qualification boundary / next gap |
| --- | --- | --- |
| Host Code tab | Blocks/pseudocode, Skulpt Python and browser/WebView JavaScript; owned console workers and task handling | Skulpt is not CPython. Source/target persistence and conversion repairs have an existing integration owner; console execution is not the shared circuit/device bridge |
| Pico / RP2040 | Actual MicroPython firmware in the CPU simulator; Python deployment by serial or `main.py` download; hosted C and a UF2 wrapper | Simulator install/reset already exists. Main's edited-source caller needs the already-claimed repair in PR #1855; physical deploy source selection is a separate gap. The SRAM-origin C wrapper does not prove flash-resident power-cycle boot |
| micro:bit / Calliope and MakeCode targets | MicroPython paths and offline PXT/native compilation, including supported EV3, Circuit Playground Express and Arcade profiles | PXT needs the exact matching base firmware; missing bases are explicit refusals. Qualify each target/artifact/transport combination rather than treating PXT compilation as universal hardware support |
| AVR / Arduino and STC / 8051 | Existing C/C++ and assembly toolchains, CPU simulation and target-specific deployment; optional local SDCC WASM already exists | Python/JS lowering covers declared subsets, not arbitrary interpreter semantics. Compiler location, ABI/runtime and available transport remain per-target facts |
| RISC-V, ESP8266 and retro machines | RV32 C (local shecc subset / hosted full compiler), SDK-free ESP8266 C simulation, and existing assembly/BASIC/Forth/Tcl/Lisp and other target-language routes | A working emulator/compiler does not establish a silicon transport. Preserve useful retro routes without promising full Python/JS interpreters on tiny targets |
| LEGO and specialized labs | Target-specific NQC/NXC, MicroPython/virtual-hub paths, native firmware profiles and specialized machine languages; Verilog is a separate lab | Virtual source execution, real firmware emulation and physical hub deployment have distinct limits and acceptance evidence |

The matrix and older boot notes contain historical states. Reconcile actual
callers and current pins before changing a capability: Pico reset and several
PXT/native paths are already implemented. The existing
[Code/Pico ownership claim](lanes/2026-11-27-code-document-pico-ownership.md)
and [integration PR #1855](https://github.com/CrispStrobe/brickwright/pull/1855)
remain with their owners; their unmerged candidate is not main acceptance.

### Delivery sequence

Every route must name its language/dialect, runtime, board/CPU, artifact,
compiler location, transport and evidence. Distinguish host execution,
language-level simulation, instruction-level firmware simulation, compilation,
and physical deployment. Keep native execution and lowering separate; arbitrary
Python or JavaScript must not silently become another program through blocks/C.

Source correctness and execution ownership remain the first runtime priorities:
complete R1/R2 and J1 through their existing claims, including exact-or-refused
conversion, authored source/target persistence, input, Stop and restart.
LP0/LP1 can establish route and package data independently; runtime adapters
then use the existing R3/R4 and J2 service/bridge boundaries.

1. **LP0 — current route inventory:** reconcile the matrix with actual callers,
   pinned dependencies and firmware/transport paths. Preserve evidence levels
   and generate the visible matrix from the same capability data.
2. **LP1 — runtime and toolchain packages:** record exact artifact identities,
   component licenses, source/build recipes, runtime/output exceptions,
   distribution class and emulator eligibility. Extend the existing SDCC
   download manager and build-output policy. Start with a shared package
   inventory and known-payload exclusion checks; hash-verified installation,
   cache migration and additional compilers are subsequent acceptance slices.
3. **LP2 — Python:** qualify explicit CPython/Pyodide and MicroPython modes
   without silently changing dialect. Prioritize Pico and micro:bit, then
   selected SAMD/CircuitPython and board-specific SPIKE/other 32-bit profiles.
   Use a versioned device API and clock, and qualify Simulator and physical
   execution independently. Bytecode compilation is not native machine code.
4. **LP3 — C:** finish one compile → firmware simulation → physical deployment
   route, including target ABI, linker/startup/runtime and peripheral support.
   Pico is the reference: persistent flash-resident startup/boot2 and power-cycle
   evidence, followed by micro:bit and selected SAMD cells. Expand AVR,
   STC/8051 and RISC-V cell by cell; retain the retro toolchains. Optional GCC,
   Clang/LLVM and SDCC packages compile native MCU code even when the compiler
   itself runs as browser WASM.
5. **LP4 — JavaScript on silicon:** retain browser/WebView JavaScript for host
   execution and evaluate Kaluma on the existing Pico/RP2040 simulator first.
   Measure its language subset, device API and RAM/flash footprint before
   promising other boards. QuickJS/MQuickJS are later candidates for a concrete
   target need; a bytecode-producing tool does not imply standalone native code.
6. **LP5 — portable WASM:** evaluate WAMR or another compatible device runtime
   only for a demonstrated workload and suitable 32-bit target. Browser WASM
   needs supported imports, a memory budget and an on-device interpreter/AOT
   runtime; it is not directly flashable firmware.

For each admitted Pico Python/JS/C route, the acceptance program must read a
changing input, control PWM or a motor, print output, survive project save/reopen,
and stop/restart correctly. Record source/artifact identities and independent
Simulator/physical results; C additionally proves power-cycle startup. Use the
same admitted source and API semantics where the route promises parity.

### Distribution boundary

Code and firmware vendored into BW must remain **non-NC and non-GPL**.
Separately distributed GPL WASM tools may be downloaded explicitly by the user,
with license/source disclosure, verified artifacts, cancellable installation,
offline reuse and removal. They must not enter the shipped bundle or initial
pre-cache. This supersedes the older matrix plan's hosted-only GPL wording.
WASM, Workers and separate origins do not by themselves settle whether
components form separate works.

Check compiler executables, linked runtimes/SDKs/firmware, and user programs
separately; compiler licensing alone does not determine output licensing.
The optional-GPL allowance does not approve NC dependencies. Existing
component-specific LGPL treatment, including the two 386 BIOS images, grants
no blanket approval to new LGPL packages such as pygame-ce. Prefer permissive
new engines and review their complete dependency/firmware graphs.

Preserve exact-artifact vendor-chip and emulator eligibility checks: firmware
allowed on physical silicon can still be unsuitable for Simulator. An MIT core
does not qualify all bundled wireless libraries or a complete firmware image.

LP1a implementation: the [claimed first slice](lanes/2026-11-28-lp1-toolchain-inventory.md)
now shares the existing SDCC origin, cache identity and nine members between the
loader and a selected-package inventory. The output guard rejects its directory
and eight distinctive JS/WASM filenames, while retaining the existing boot-media
and sparse-code checks. Forty-six focused source controls pass; this is not a
complete dependency/license audit or a new compiler/runtime adoption.

LP1b implementation: the [verified-installation/cache slice](lanes/2026-11-28-lp1-verified-installation-cache.md)
pins all nine SDCC members to immutable supplier bytes. Managed downloads,
cached reuse, offline installed-state inspection and browser blob resolution
check SHA-256 and byte length; corrupt entries are repaired individually, and
missing members cannot bypass verification through an origin URL. Service-worker
activation retains the exact optional cache without prefetching or creating it.
Forty-nine focused controls pass, including same-length corruption for every
member and actual worker activation. A live-origin check accepted all nine
members (6,737,737 bytes) and resolved them offline through verified snapshots.
Independent review closed a final-write cancellation gap with a regression test.

LP1 follow-up: complete compiler-component, linked-runtime and generated-output
license evidence. Full browser update/mutation qualification remains hosted:
the local browser executable is unavailable. Explicit development mode and
direct Node staged-toolchain harnesses are outside this managed-installation
guarantee. Applicable hosted gates and upstream identity still control landing;
the inherited integration failures are not waived by these focused results.

Status: **plan recorded; incremental implementation and per-target qualification
follow in claimed slices**. Existing runtime candidates and unrelated blockers
retain their recorded status. LP1's SDCC-backed inventory, known-payload boundary
and verified managed installation do not add an interpreter or accept a new
compiler payload, and do not complete LP1's separate license qualification.

## Code execution and game export (Python and JavaScript) — 2026-11-27

The owner-requested [Code runtime and game export plan](docs/CODE-RUNTIME-AND-GAME-EXPORT.md)
extends milestones 4, 5 and 9 below. Record the plan first, then evaluate the
existing Skulpt runner against direct MicroPython/WASM and Pyodide with identical
fixtures. pwasm is a reference for host capabilities and resource limits; its
Python-hosted WASM engine is not a direct browser Python loader.

Order: source/conversion integrity → owned worker execution with input/Stop →
measured runtime selection → shared simulator bridge. Preserve lazy loading and
measure editor/conversion/startup costs before claiming performance gains.
Supported host platforms and convertible language subsets are separate axes.

The same plan scopes MakeCode Arcade / Scratch / pseudocode → validated semantic
model → Python + pygame source/assets → separately qualified standalone packages.
This requires a game runtime preserving events, scheduling, sprites, collisions
and assets; it is not supplied by installing a Python interpreter. Begin with a
declared playable subset, then per-OS desktop builds. Browser and native mobile
exports, dependency licensing, and original-runtime parity have distinct gates.

The [JavaScript track](docs/CODE-RUNTIME-AND-GAME-EXPORT.md#9-javascript-execution-and-game-export-across-platforms)
uses the engines already present in browsers and Tauri WebViews. First correct
async completion, input and Stop through the shared execution service; then
qualify a playable JS web export against the same source-aware graph, assets,
renderer and simulator contracts. Keep a VM/project web player distinct from an
editable generated-JS project. Follow with complete offline web/PWA artifacts
and per-target Tauri desktop/mobile packages. Module/renderer/device capabilities
and the oldest supported WebViews have separate gates; Electron remains an
optional desktop alternative for a demonstrated need. This chapter is design
and source review, not new platform or packaging acceptance.

The [initial evaluation report](docs/CODE-RUNTIME-EVALUATION-2026-11-27.md)
records the same-engine Node/Chromium probes, a pwasm host check, silent reader
translation changes and a Linux pygame bundle with matching source/package state
and frame hashes. It supports explicit Pyodide/CPython and lightweight MicroPython
modes as follow-on candidates; production integration and device gates remain open.

The [first execution candidate](docs/CODE-RUNTIME-AND-GAME-EXPORT.md#81-first-implementation-candidate-editor-ownership-and-console-sessions)
adds delayed-conversion ownership fences and owned Python/JS console workers
with input, Stop and bounded output. Its 112 focused source controls and 19
Chromium worker cases pass; hosted qualification remains pending, including the
existing separately owned Microtronic gallery drift. This is a bounded R1/R2/J1
slice; generated game lifetimes, target/source persistence and export remain open.

The [owned-console continuation](docs/CODE-RUNTIME-AND-GAME-EXPORT.md#82-owned-javascript-console-tasks-and-input-watchdog-continuation)
adds scoped JavaScript tasks and an input-responsiveness watchdog. Its current
consumer controls pass 139/139; the canonical opt-in generator passes 201/201
after a Boolean-value correction. Real Chromium probes pass 39/39 session/task
cases and 16/16 default-worker CSP cases, including two enforced denial profiles.
These published drafts retain the inherited gallery/HDD and supplier RF landing
blockers. Whole-application/deployed-policy and native qualification, normal
supplier adoption and Code-tab mode selection remain open.

Status: **bounded evaluation recorded; first console candidate awaits qualification;
new runtimes and game export remain planned**.
The [evaluation lane](lanes/2026-11-27-code-runtime-game-export-evaluation.md)
owns documentation/probes only; the [worker ownership lane](lanes/2026-11-27-code-worker-ownership-and-javascript-plan.md)
owns the first consumer implementation. Shared-compiler repairs remain upstream
work under the existing adoption rules.

## Current status — 2026-11-05

The integration has merged, and later browser gates passed after an earlier full
run failed. The dated material below is historical. See the [current circuit/editor
handoff](docs/CIRCUIT-INSTRUMENT-REGRESSION.md#current-circuiteditor-status--2026-11-05) for exact evidence, open work and acceptance boundaries.


Status: active execution plan  
Started: 2026-08-21  
Product promise: **Build circuits. Program machines. See how they work.**

Brickwright is a native, open-source visual computing workbench. It combines
block programming, editable structured code, circuit design and simulation,
debugging, and direct control of supported LEGO hubs. It is not a TurboWarp fork.
It uses upstream Scratch components where they are useful, alongside Brickwright's
own editor, code model, circuit engine, device runtimes, and native shell.

This document turns the product review into an ordered implementation plan.
`ROADMAP.md` remains the detailed engineering backlog; `HISTORY.md` records
completed and rejected work. This file defines outcomes, sequencing and release
gates.

## Current circuit/instrument handoff — 2026-10-29

The [six-item campaign](lanes/2026-10-26-reference-qualified-instrument-campaign.md)
remains open through final consumer qualification and documentation reconciliation.
The accepted v2 study at historical Board `c7bcbe4b` / CUI `da28bb8c` measured
31/31 conforming designs, 4,260 values and 15/15 captures, with one named refusal
among 32 inputs. All four earlier disagreements remain noncomparable; no model
repair was inferred from them. Historical supplier identities never advance.

Scope PR128 and its unmerged negative PR129 establish the injected re-render
mechanism. Combined [Lite PR1536](https://github.com/CrispStrobe/brickwright/pull/1536)
preserves the frozen `93aba754` longer-capture, LM741 and provenance ancestry
previously gathered in the now-closed, unmerged PR1538. Board remains `8785e468`;
the current adoption targets qualified CUI PR131 landing `4b65f154`. Consumer
source landing and deployment remain pending.
Hosted evidence at the earlier `e85dc904` candidate accepts 60 AC values and
three actual supplier mutants, the LM741 settled-window assertion and the
long-capture assertions. Its unit-6 documentation-trigger failure is preserved;
`93aba754` repairs only the TODO documentation pointer and its dedicated record.
Thirty-five focused successor checks and all six hosted unit shards pass. The
corrected unit-6 original accepts the three long captures, four historical seals
and documentation-trigger check; final combined application qualification is
still pending. The frozen source's final fast-tier checkpoint has 17 successful
checks, nine declared skips and no pending checks; only the explicitly excepted
absent-`ci:full` verdict remains red. The final combined UI target has no such
exception.

CUI PR131 has now landed as `4b65f15485abbc039958d8e1a8a29ac3459b75f9`
after its three enabled checks and retained browser evidence were accepted.
PR1538 was closed without merging to consolidate the queue. Its complete
source ancestry is preserved in PR1536, whose main landing remains pending.
Do not reopen the old PR or infer main adoption from its closure.

The operator transferred the remaining integration to this campaign's maintainer.
PR1536 now preserves the frozen Circuit source and adopts this CUI head with
Board unchanged. The packaged native confirmation journey passes at `17bbefca`;
subsequent editor repairs include the measured hidden-stage viewport, Pixel
controls and trigger-owned Escape/Tab dismissal. The source checkpoint
`a0c0a60e` contains those repairs; it is not final consumer or delivery acceptance.

Fast-tier PR checks are the operator's default, without `ci:full` labels. Claim
PR1558 registered alignment of the legacy policy verdict with selected CI
execution at `f5acf3b3`; the bounded repair is published in PR1536 at `0f5dca52`. Every enabled
selected check and actual affected application acceptance must still pass.
Production GUI observations require exact source/configuration/artifact binding;
FPGA flag-on behavior and the unchanged profiling-build byte guard remain owed.
A production entry-byte count is not the profiling-build metric. Preserve the
accepted component results without calling the combined application qualified.

Consumed-study identities stay historical. The live authored regression contract
and current adoption assertions follow the adopted package; neither authorizes
replaying the completed cohort. After qualified combined landing, reconcile the
original PRs, verify actual production delivery and finish these four documents.
No seventh task is opened.

The frozen combined successor is `2e7846f8a901726a296e3a8ef006cff24bc457b5`.
It includes main `19c073bd` and both registered CI follow-through repairs:
selected-tier admission and supported-event numeric-consumer selection. The
manual consumer is skipped because its existing artifact trust admits push/PR
only; successful supported events remain required. The obsolete wiring-message
assertion now executes the real classifier-output forwarding and verifies its
tier bindings. Locally, 39 focused CI controls and 11 gate-shape checks pass,
and three isolated wiring mutants fail. These are source controls, not browser
or delivery acceptance. The reduced FPGA browser journey now switches all three
workspaces and checks visibility, selected controls and exact retained node/HDL
state; its live synthesis path remains byte-identical. Actual hosted acceptance
is still required. The preceding `09a4f407` run set was superseded before any
child started; cancellation followed explicit zero-running-child verification.

Fresh fast [Build40869114327](https://github.com/CrispStrobe/brickwright/actions/runs/40869114327)
and necessary full [Build40869128682](https://github.com/CrispStrobe/brickwright/actions/runs/40869128682)
are pending on that exact source. The earlier manual run `40856189963` was
cancelled before application execution after its unsupported consumer context
was identified; it is not qualification. The prior fast head `d32860b8` had one
real unit-2 wiring-assertion failure. Both originals remain distinct from this
successor; neither failures nor cancelled checks are waived. No main landing or
production deployment is claimed yet.

The [active handoff](docs/CIRCUIT-INSTRUMENT-REGRESSION.md#active-continuation--2026-10-28)
keeps exact actions, evidence boundaries and remaining limits.

## Current imported-circuit and model-accuracy sequence — 2026-10-25

The separately authorized five-item sequence has reached its bounded consumer
acceptance endpoint through [PR1413](https://github.com/CrispStrobe/brickwright/pull/1413),
merged as `b26ae0aedde4e53a254b0bc48c83b156be7cb026`. Its
[campaign record](lanes/2026-10-25-imported-circuit-instrument-campaign.md)
keeps the remaining limits and earlier failures explicit.
Shared model/importer/instrument work belongs only in the operator-owned
`CrispStrobe/bw-board` and `CrispStrobe/bw-circuit-ui` repositories, followed by
qualified Lite package adoption. No third-party original is patched.

1. **Current-consumer baseline: accepted.**
   [Run40172711900](https://github.com/CrispStrobe/brickwright/actions/runs/40172711900)
   qualifies consumer `4c416bcfe1a219faaec371ac638f607628f347a7`, Board
   `761153ff92d521c01107ee7b32922ba7adc10ee2` and CUI
   `91d8434a79d373cef2837c137ab356356f1a3b44`. Independent original-only readers
   accepted 312/312 cases and 87,488 numerical checks. The inputs and bounds
   are unchanged; all 240 waveform CSVs match the preceding baseline exactly.
2. **Imported-circuit evidence: collected with explicit limits.** A frozen
   offline cohort contains 307 graph-distinct small source structures,278 with
   MOS devices:299 OP-only and8 OP/AC inputs. This is not broad teaching-family
   coverage or public redistribution clearance. Unchanged comparison bounds
   give 67 passes,8 partials,4 disagreements and228 not-run cases;339 of 350
   compared values agree. All failures/refusals remain in the denominator.
   An actual installed-CLI cross-check of32 overlapping inputs executes 64
   static commands;19 cases provide 169 passing conservation checks and 81
   descriptive oracle agreements. The reference-method admission remains
   unknown for those comparisons,so do not call them physical accuracy proof.
   Two separate5,000-sample RC watch requests refuse before capture creation;
   their conditional references are not run. They are not acquired waveforms.
   Private payloads remain outside public repositories,workflows and artifacts.
3. **Recurring-cause repairs: accepted and adopted.** Owned CUI PR120
   landed `408c179a9bf5ffc28a4626e9ff5a78fc35cdc671`; Lite PR1397 adopted it
   at `7f9edea2cc648d7139d1f57099d5121361d48a01`. Exact PMOS bulk wiring,
   genuine implicit NMOS bulk-current conservation and authored work preflight
   are covered by causal negatives and actual CLI/browser checks. The one
   affected 307-input native recheck preserved all previous observable results.
   This repairs demonstrated causes without fitting four weakly anchored
   disagreements to an arbitrary reference root.
4. **LM741 assessment and measurement-honesty repair: adopted.**
   Eleven related requests across two authored topologies distinguish endpoint
   voltage from a continuous meter mean. Four valid observations and seven
   named refusals expose no basis for a new physical calibration claim. The
   signal model has no quiescent/bias-current law: a connected supply terminal
   must not be reported as measured zero. Board PR704 repairs that false zero
   while preserving represented finite zero, signs and power-off behavior;
   qualified descendant `836867513c3e7fac420ddaa32c17e1c7b6d3e513` is adopted
   by PR1413. The hosted GUI verified represented-current recovery and
   unavailable supply current. No electrical stamp or device law changed.
5. **Ideal ADC view: adopted within its stated model.**
   CUI PR122 landed `1bc233c9297e03abb9b7eb603e045b4e92b0bb40` after all
   three checks, including 83 actual browser scenarios. Explicit point-sample
   acquisition can opt into a bounded ideal uniform ADC view with reconstructed
   trace/trigger/readout, paired raw/code CSV, clipping and externally expected
   receipt settings. Raw samples, electrical loading and meter means remain
   unchanged. This is an ideal reconstruction model, not a real oscilloscope's
   bandwidth, noise, calibration or complete analogue front end. The
   [joint adoption](lanes/2026-10-25-meter-adc-package-adoption.md) passed
   exact-head qualification: 36 successful checks and six source-declared
   skips. Original-log readback accepted 10 new browser checks, six preserved
   checks and three unit checks, including rearm and failed-source refusal.
   The protected 312-case numerical result remains attached to its original
   run and source; it was not repeated or relabelled as this GUI run.
   Earlier intermittent mode-publication/rearm causes remain open; this
   successful journey establishes acceptance for this run, not a causal fix.

Aperture/audio is already adopted through PR1338; retain and regress its actual
capture, Chromium/WebKit, WAV and lifecycle evidence rather than reimplement it.
The v0.1.27 release owner retains signing/upload/distribution readback. This
sequence ends at this bounded fifth-item acceptance and result reconciliation.
The [scoped follow-ons](ROADMAP.md#scoped-follow-ons-after-consumer-acceptance)
remain unclaimed; select a new priority before starting another lane.

## Current circuit/instrument campaign — 2026-10-15

This is the historically completed sequence; current work is the 2026-10-25
sequence above. Historical receipts retain their original package identities.

The ordered acceptance contract is the upstream
[circuit/instrument campaign](https://github.com/CrispStrobe/bw-circuit-ui/blob/master/docs/CIRCUIT-INSTRUMENT-NEXT.md).
`lanes/` controls current ownership; the older priority tables below are dated
history, not reservations or evidence that their work is still pending.

1. **Upstream LM741 CLI qualification: complete.** Six signed/phase-shifted
   precision captures passed independent waveform, meter and work-receipt audits.
   This is a bounded nominal-model result, not vendor-model or hardware accuracy.
2. **Consumer adoption and existing TestFlight delivery: complete.** PR965
   landed as `5cb83052330b400b48293315260cb4293b4f6bcf`, adopting CUI
   `1db1bb9ee565338672c7acfefec4cf94b27196e1`. Its qualified CLI and built-GUI
   checks do not prove a newer signed or installed release. PR1011's release
   ownership claim is merged, not a delivery receipt. The read-only
   [audit 40048235422](https://github.com/CrispStrobe/brickwright/actions/runs/40048235422)
   independently verified existing v0.1.26 on iOS and macOS in both TestFlight
   groups, with matching bilingual notes and approved reviews. No write or new
   upload was required. The earlier metadata-wait failure remains preserved.
3. **Fixed installed-consumer regression: complete.**
   [Run 40057471489](https://github.com/CrispStrobe/brickwright/actions/runs/40057471489)
   executed all 312 authored parameter cases across 12 topologies: 264 ngspice
   and 48 explicitly nominal analytic comparisons. Independent original readers
   agreed on all cases and 87,488 numerical checks; no failed, refused,
   noncomparable or missing case was removed. The
   [handoff and result](docs/CIRCUIT-INSTRUMENT-REGRESSION.md) record exact
   package identities, original hashes, measured coverage and remaining limits.
4. **Causal triage: complete for this matrix.** No numerical defect was
   demonstrated, so no model patch or tolerance change is justified. This does
   not close unrelated model/oracle work or establish physical-device accuracy.
5. **Bounded scope-display adoption and consumer proof: complete.**
   CUI [PR117](https://github.com/CrispStrobe/bw-circuit-ui/pull/117) passed all
   three checks and 71/71 actual browser scenarios. Lite
   [PR1334](https://github.com/CrispStrobe/brickwright/pull/1334) adopts
   `420f3e15bd0064119416386853bd35713347c252`. The new consumer passed the
   separate [312-case campaign](https://github.com/CrispStrobe/brickwright/actions/runs/40077158320),
   with 87,488 independent numerical checks and all 240 waveform CSVs
   byte-identical to the preceding campaign. The exact built GUI passed actual
   metadata, warning/clear, prefix/wrap and HOLD/resume checks; both raw CSV
   downloads are byte-identical. Its tested tree equals the qualified candidate
   tree. No ADC/analogue-front-end behavior or newer signed binary is claimed.

Status reconciliation: 2026-10-24. All five bounded tasks are complete. The
[handoff](docs/CIRCUIT-INSTRUMENT-REGRESSION.md) records separate release,
CLI and built-browser evidence and scopes possible follow-ups. This sequence
stops here; consult `lanes/` before claiming any further work.

Shared engine, importer and instrument changes land upstream first. Lite adopts
one reviewed full SHA with derived specifications, locks and provenance. A
package update is not proof that an installed or deployed application was tested;
report those evidence boundaries separately.

## Historical priorities — reconciled 2026-09-19

This historical shortlist started from `main` at `1a48f9212`; it is not the
current execution order or ownership table. Completed and rejected work is
recorded in `HISTORY.md`; `LANES.md` is the live ownership authority. In
particular, the former 14-file `bw-board` convergence priority is complete by a
change of architecture: `bw-board` and `bw-circuit-ui` are direct npm
dependencies pinned to exact Git SHAs. They have no tracked Lite source trees to
converge. `sb3-creator` is the sole remaining vendored tree, with its mapped
rewrite and dual-tracked mirrors still judged at its exact pin. The measured
copy-era fork counts remain historical evidence in `HISTORY.md` and
`docs/VENDORING-REGIME.md`, not current work.

Adopt upstream changes in purposeful batches. A pin is a frozen candidate that
Lite has reviewed, not a subscription to every upstream commit. The lane owner
reads the full range, advances the existing authority to one full SHA, regenerates
every pin-derived artefact, and qualifies that exact identity. Do not open a
second package-adoption lane or chase a moving upstream head while a candidate is
under review; see `docs/UPSTREAM-WIP.md`.

| Order | Bounded track | Ownership and acceptance boundary |
|---|---|---|
| 1 | Complete the consolidated circuit package refresh | **Owned by bwcx in `LANES.md`.** It carries the already-selected `bw-circuit-ui` and `bw-board` ranges through package pins/specs/locks, derived evidence, the 80286 capability/census and lesson/corpus consequences, and one hosted Build on a frozen final head. Other lanes must not duplicate that adoption or edit either package boundary. |
| 2 | Consolidate the active FPGA development without widening its delivery claim | **Unknown-state correctness and RAM canvas integration are separately owned in `LANES.md`.** Preserve the compiled HDL surface, tested hosted/local synthesis paths, hierarchy ports, localization, and the current schematic renderer while that lane reconciles the open work and the package refresh crosses beneath it. The deployable build now includes the lazily loaded FPGA code, with the tab default-off until a user enables **Settings ▸ Workspace ▸ FPGA lab**; an off build can still omit the surface. Re-test the integrated surface on the eventual package candidate rather than replacing its implementation or starting another pin move. |
| 3 | Advance the next real-hardware FPGA boundary only from measured facts | The Tang Nano board part and `gate-level` semantics are already present through Lite's shipped package pins; the package refresh adopts later work without establishing that foundation. The read-only USB-identification step is separately owned in `LANES.md`: it can classify descriptors from a granted device, but descriptors alone cannot establish which bridge or board revision is physically present. A flashing lane requires descriptor capture from the real board, independent board-revision evidence, and hardware transport proof. Keep service availability, feature-default policy, and a release claim separate from a successful synthesis/download demonstration. |

The package architecture does not weaken upstream-first ownership. Reusable
engine, renderer, importer, and generator changes land in their owning upstream
first and arrive in Lite through the exact package SHA. Application preferences,
feature gating, and packaging adaptations remain Lite-owned. The flasher is a
separate path-scoped generated artifact: its exact `stc-compiler-flasher` pin
governs only `docs/flash.js` and the two derived mirrors, not the compiler
repository as a whole.

The active-low eligibility decision is closed upstream at `c593574`.
`06-active-low-high`, `32-source-vs-sink`, and `46-port-overcurrent` now stay on
their STC12 architecture instead of advertising targets without the sinking
asymmetry they teach. The separate `56-logical-on-pin-level` lesson carries the
portable cross-family comparison with eleven device benches.

Do not revive P18–P20 without new attribution evidence. Their fixed 76,800-byte
stop gate and rejected measurements remain in `HISTORY.md`. Keep full Technic
simulation, wholesale cycle-core replacement, broad language expansion, and
framework migration in their longer-term plans.

### Flasher delivery simplification (planned, unclaimed)

Replace the generated `flasher.js` copy with a proper build-time ESM dependency.
The current exact-SHA sync and provenance gates are safe, but they compensate for
the fact that `stc-compiler` exposes its reusable browser flasher only as
`docs/flash.js`, not through an installable package API. Do not replace that with
a runtime GitHub/CDN import: flashing must remain available offline and builds
must remain reproducible.

The preferred end state is a small dedicated flasher package rather than making
consumers install the compiler/service repository. Extract the DOM-independent
protocol and transport code, expose protocol-specific entry points so the GUI
bundles only what it uses, and pin the package by full Git SHA through the normal
package/lockfile authority. Migrate and test the upstream browser first, then
Lite. Only after both consumers use the package and preserve the existing flash
sequences may Lite delete `sync-flasher.mjs`, the two generated mirrors, the
path-scoped `stc-compiler-flasher` pin, and their copy-provenance checks. The
detailed phases and acceptance gates are in `ROADMAP.md` §3.6.

### Future machine breadth — Motorola 68000 SBC (planned, unclaimed)

The next retro CPU family, when Milestone 0 and the current vendor-convergence
sequence release capacity, should be a **plain MC68000 serial SBC**. The first
product boundary is deliberately smaller than an Amiga, Macintosh, or Mega
Drive: a 68000 CPU, ROM, RAM, a memory-mapped MC6850 console, and optionally the
existing latch/buffer parts for LEDs and switches. That is enough to teach the
architecture and exercise the machine/debugger contracts without pretending
that a famous computer's custom chipset has been emulated.

The outcome is accepted only when all of these are true:

- the 68000 core is independently vector-tested across every implemented opcode
  family, exception entry/return, interrupt level, privilege transition,
  big-endian byte/word/long access, and odd-address fault; mutations prove the
  gates can fail;
- a composable 24-bit-address machine preserves byte-lane selection for 8-bit
  peripherals and boots a reviewable ROM through the real reset vectors;
- the neutral debug target exposes D0–D7, A0–A7, PC, SR, USP/SSP, memory,
  breakpoints, run/step, capabilities, and checkpoint refusal/support without a
  68000 special case in the shared UI;
- the default scheduler remains instruction-level and wall-budgeted. Exact
  bus-cycle execution is a later opt-in machine mode, never a relabelled
  instruction step;
- the first assembly/ROM path is local and reproducible. A C compiler may later
  be a separately downloaded, content-pinned and cached WASM toolchain—like the
  SDCC delivery shape—so it adds nothing to initial payload and never silently
  falls back after a local failure.

Commercial-system targets are separate future projects with their own complete
producer/consumer boundaries: video, audio, DMA, storage, controllers and ROM
provenance. The CPU/SBC milestone must not claim any of them.

Four concrete upstreams now narrow that plan. The MIT-licensed
[`dirkwhoffmann/Moira`](https://github.com/dirkwhoffmann/Moira) core is the
preferred **runtime spike**, because it already separates the CPU from its host,
supports WebAssembly, exposes precise 68000 memory-access timing, address errors
and disassembly, and does not require importing an Amiga machine. It is not yet
the selected production core: GitHub CI must first build only the core as a
full-SHA/content-hash-pinned downloadable WASM, measure compressed bytes, cold
load, memory, throughput and callback overhead, and prove the neutral target and
checkpoint ABI. The large tester/application tree is outside that licence and
delivery decision.

[`SingleStepTests/680x0`](https://github.com/SingleStepTests/680x0), the split
successor to the archived ProcessorTests monorepo, is the preferred independent
instruction-state and bus-activity oracle. It currently has no repository
licence file, however, so its absence is a hard provenance stop: do not vendor,
cache, redistribute or silently download the vectors until an explicit licence
or maintainer permission covers that use. A pinned loader may be developed
against synthetic fixtures meanwhile. The BSD-3-Clause
[`74hc595/68k-nano`](https://github.com/74hc595/68k-nano) schematic, memory map,
ROM, serial programs and debugger are a strong real-machine reference after the
minimal MC6850 machine boots; first prove only reset and NS16C550 serial output,
then treat CompactFlash, RTC, FAT16 and its intentional decode aliases as named
follow-ons. [`AmiBlitz3`](https://github.com/AmiBlitz/AmiBlitz3) is not an SBC
compiler candidate: its IDE requires AmigaOS and a 68020, its output and runtime
are Amiga-oriented, and bundled components carry separate licences. Reconsider
it only inside a later, dependency-complete Amiga compatibility project.

## How this plan is executed

Work proceeds in the numbered order below. A milestone is complete only when its
acceptance criteria and proportional automated checks pass. Every milestone should
leave the app releasable; large features use an internal flag until their complete
path is usable. Existing user work and local settings must remain readable.

The primary success measure is time to a meaningful result, not feature count:

- A new user can run or interact with something useful in under three minutes.
- Switching representation never silently changes the meaning of a project.
- Simulation and connected hardware explain their current state and failures.
- A project can be saved, reopened, shared, and recovered with no missing pieces.

## Milestone 0 — What we already ship is correct

Status: **open — takes precedence over new breadth (added 2026-08-22)**

This milestone did not exist, and its absence is the plan's main structural fault. Milestones 1–10
all describe things to *add*. Nothing in the plan owns the question *is what we already ship
right*, so that work — which has consumed most of the last week — appears only as scattered
acceptance criteria and as entries in the execution log after the fact.

The evidence that it needs to be first, not folded into the others:

- **Five gates were found that could not fail** (sb3-creator/bw-circuit-ui/bw-board audit,
  `test/GATE-AUDIT-REPORT.md`): assertions reading removed properties, a path typo that made two
  tests report "skipped" forever, a glob that never matched the primary `circuit.json`, and
  `assert.ok(true)` on both branches of an if/else. Every one had been green for weeks.
- **Five gallery examples were green and inert** — `set variable X to Y` assigns a variable *named*
  "variable X" while reads say `X`. `bw check` passed on all of them. Syntax-valid, semantically
  dead.
- **A shipped extension is missing 8 opcodes the emitter emits**, affecting three shipped examples,
  and the gate that would catch it skips in CI by construction. See `ROADMAP.md` §5.1.
- **Lessons were teaching observations their example cannot produce.** The first two put to
  technical review both failed that way (the diode lesson asked for alternating traces from a
  static polarity bench; the capacitor lesson asked for discharge from a charge-only bench).
  The full Wave 1 pass that followed found the same fault in five of its twelve lessons —
  see the ledger below and `docs/LESSON-REVIEW-WAVE-1.md`. Sixty-seven lessons remain unreviewed.

The common shape: **breadth shipped ahead of verification, and the verification that existed could
not fail.** Adding more content on that base multiplies the debt rather than the value.

Scope:

- Every shipped example is proven to *run*, not merely to parse: executed in the real VM, and
  — where it targets a device — its blocks resolved against the extension that device loads.
- Every shipped lesson's checkpoints are proven achievable against the example it names.
- Every gate is mutation-proven: re-introduce the defect it guards, confirm red, restore. A gate
  that cannot be shown to fail is treated as absent.
- Cross-repo gates either run in CI or fail loudly where they cannot. A skip is not a pass.
- No new content wave starts while its predecessor's review debt is open (see the ledger below).

Acceptance criteria:

- The example corpus gate executes every shipped program and every shipped circuit variant, and a
  deliberately broken example makes it red.
  - **Programs: done 2026-08-23.** `test/example-vm-execution.test.mjs` runs all 257
    program-bearing examples in the real Scratch VM with lite's bundled extensions; 114 are
    circuit-only placeholders and are asserted to BE placeholders, 143 carry the execution burden,
    117 execute clean. Eight mutations proven red and restored, including this milestone's own
    `set variable X to Y` re-introduced into `05-counter`. Findings and the coverage the gate does
    NOT have: `docs/EXAMPLE-CORPUS-FINDINGS.md`.
  - **Circuit variants: still open.** `test/schematic-*.test.mjs` renders all 1,034 and checks
    mechanical legibility; nothing asserts a variant is electrically what the simulator solves
    (§6).
- Every declared field in the corpus is one something reads, and every declared classification
  agrees with the files it classifies. **Done 2026-08-23** — see "The corpus-defect sweep" below.
- Extension conformance runs in CI for every device family the gallery targets, with no
  environment in which it silently skips.
- The verification-debt ledger below has no open wave older than the newest shipped wave.
- Every entry in the dead-module exclusion list is either tracked as a roadmap item or removed
  (`ROADMAP.md` §4).

**How this milestone gets executed:** see `docs/VERIFICATION-AUTOMATION.md`.
The short version, measured rather than assumed: 244 of 275 examples already
carry machine-readable `assert` blocks, `test/assert-physics.test.mjs` already
parses them. Re-measured 2026-08-23 against bw-board caeac2b: **359 tests, 317
pass, 0 fail, 42 skipped** as "unknown kind" — the 115 figure predates several
rounds of parser extension, and the two failures it used to carry were the
stale-sibling-pin ones described above. Those 42 are claims already written down
and never verified, in 21 distinct kinds, and the remaining ones are the
expensive kinds: rendered display text (`text_line_0: OLED DEMO`), audio state
(`audio_context: running`), and terminal I/O transcripts. Extending
that parser, plus a declared-pins-equal-wired-pins invariant, verifies far more
of the corpus than reading it example by example — and the reading pass is
demonstrably unreliable where it matters, since the 6502 terminal's
repeated-key bug survived a careful read and a clean `bw check` and died the
moment the program was executed. Build detectors, batch-fix what they flag,
read only the residue.

### The corpus-defect sweep (2026-08-23)

All 274 enrolled examples and all 2,098 circuit files were swept for the four defect
classes the recent finds belong to, plus a fifth the sweep turned up. Every fix is
UPSTREAM in `sb3-creator`, on `fix/milestone0-corpus`; lite picks them up on the next
vendor-forward. Per-class counts, **including the zeros**, because a zero that is not
reported reads as a class nobody looked at:

| Class | Swept | Found | Gate | Mutation-proved |
| --- | --- | --- | --- | --- |
| A. A declared field nothing reads | 2,098 circuit files, 53 (kind, key) pairs | **9 keys over 5 part kinds, in 12 examples** | `test/circuit-params-are-read.test.mjs` (two tiers) | yes, both tiers |
| B. A pin mode contradicted by its verbs | 272 programs, 120 declaring PINs | **0 mode/verb contradictions** — but 2 programs whose named purpose the pin could not serve | the compiler already warns, and `gallery.test.mjs` fails on an undeclared warning | (existing gate) |
| C. A `kind:` contradicting the files present | 274 index entries | **1** | `test/example-kind-matches-content.test.mjs` | yes, both directions |
| D. An assignment that parses to something other than what reads it back | 272 programs | **2** (3 phantom variable names, 2 dangling reads) | `test/program-reads-what-it-writes.test.mjs` | yes, all three shapes |
| E. Arithmetic that means one thing in the VM and another on the device | 272 programs, 122 emitting device C | **5** | `test/vm-and-c-agree-on-arithmetic.test.mjs` | yes, both shapes |
| F. Index metadata contradicting the files on disk | 274 entries, all 26 fields they use | **44** (36 phantom thumbnails, 8 stale refusals) | `test/index-metadata-matches-disk.test.mjs` | yes, three shapes |
| G. An EXPECTED.md quantity that no longer matches the engine | 274 EXPECTED.md, 49 prose current claims, 7 frequency+period pairs | **4** (1 bench that could not do its lesson, 2 values in the wrong field, 1 self-contradiction) | `test/expected-quantities-hold.test.mjs` | yes, three shapes |
| H. An example whose gate coverage changed when its metadata did | 274 entries against 16 metadata-filtered gates | **1** (the shared 33-inductive-no-flyback mistake) | `test/example-gate-enrolment.test.mjs` | yes, four shapes incl. the exact mistake |

**The denominators, stated, because a sweep without one cannot be told apart from a sweep
that only looked where it expected to find something.** Class A covers 53 of the 53
(kind, key) param pairs the corpus declares — exhaustive over params — and its tier-1
extraction was widened after `genPower` was briefly mis-reported dead: the reader set had
only searched each sibling's `src/`, and that field is read from `scripts/`. Circuit JSONs
also carry **35 structural key paths** beyond `params` (wires, holeWires, seats, leadMaps);
every one was checked by hand against the widened reader set and all 35 are read. Class F
covers 7 of the index's 26 fields against the world and NAMES the other 19 with the gate
that holds each, so a 27th field fails until somebody decides which it is.

Class E was not in the brief. It was found while sweeping for the others and it is the
same shape: Brickwright `/` is real division and the C emitter's `/` truncates, so five
examples were **correct under VM execution and dead on hardware** — which is precisely
the gap the VM-execution gate cannot see, because in the VM they work.

What the sweep repaired, with the evidence:

- **Class A.** `ldr.minOhms/maxOhms` -> `rLight/rDark` (pc48, pc60, pc72, pc73, pc74):
  five benches simulated a 100R-1M LDR while their own documents did the arithmetic for
  the 1k-100k part they declared. This MOVED behaviour — pc60 and pc72 switch their lamp
  a quarter-turn earlier now, pc73 later. `ntc.minOhms/maxOhms` -> `rHot/rCold` (pc55) and
  `opamp.voutLow/voutHigh` -> `railLow/railHigh` (pc40, pc48, pc54) were right by accident:
  the declared values happen to equal the engine defaults, and all four benches solve
  identically before and after. `ntc.ohms` (76-multimeter), `74hc595.outputs`
  (08-led-chaser-595) and `matrix8x8.polarity` (blinkenrocket-pendant) were dropped.
- **Class B.** No program applies a verb its pin mode forbids — the 19 Arduino fade
  programs stayed fixed. But `02-dimmer` and `10-motor-speed` drove an OUTPUT pin with
  `set <pin> to <reading> bitand 1`, bit 0 of the ADC. For a static pot that bit is a
  CONSTANT, so the duty cycle could only ever be 0% or 100%: measured 0 at ADC
  0/102/256/512 and 100 at 513/767/1023, nothing between. Their intros promise "fully off
  to fully bright" and "speeds up and slows down smoothly". Rewritten as software PWM in
  24-pwm-fade's shape; both still retarget to all seven declared devices.
- **Class C.** `33-inductive-no-flyback` declared `kind:"circuit"` while shipping a program
  that parses to the same six blocks as `01-blink`, and was the only kind:"circuit" entry
  carrying `devices`, `benches`, `tier` and `authored`. It is now `kind:"program"` with the
  ten devices its retarget dry-run offers and the ten benches to match, like its arch-tier
  neighbours 32-source-vs-sink (10) and 46-port-overcurrent (9, one ledgered refusal).
  Newly in scope once the kind changed, and run: `retarget-gallery` (devices must equal the
  dry-run), `gen-device-benches` (batch/seat/index), and the flat-partition manifest.
- **Class D.** `20-shift-register-binary` wrote the bit operators in PREFIX form, so the
  parser read three VARIABLE NAMES ("bitand val 128", "bitand", "val 1 255") and the
  emitted C was `if ((bitand_val_128 > 0))`. The 595 latched 0x00 for every counter value
  and all eight LEDs stayed dark for the whole 64-second cycle; driven under gcc, as
  shipped it matched its own EXPECTED.md table for 1 of 10 probe values, fixed for 10 of
  10. `arduino-07-row-column-scanning` wrote `set x to ...`, which is Scratch's
  `motion_setx`: it moved the sprite while `print x` read a variable nothing wrote.
- **Class E.** `arduino-01-read-analog-voltage` and `arduino-sk-p03-love-o-meter` emitted
  `* (5 / 1023)` = `* 0`; `avr02-dimmer` emitted `(adc / 1023) * 100` = 0% duty below full
  scale; `arduino-02-tone-pitch-follower` computed `1380 / 600` as 2, not 2.3.
  `arduino-05-switch-case` was the worst — broken in BOTH targets: 0 in C, and in the VM a
  fraction (0.2988 at reading 102) matching none of its four `range = N` branches, so it
  printed nothing at all.

- **Class F.** 36 entries declared a `thumbnail`; not one file exists, none ever did, and
  nothing reads the field. `gallery.test.mjs` has asserted "every index entry points to
  files that exist" the whole time and walked past all 36, because it iterates
  `entry.files` and `thumbnail` sits beside it. 8 `refusals` named a device the catalog
  OFFERS — 46-port-overcurrent told the reader arduino-uno "has more digital outputs than
  its convention offers" while offering it and shipping it a bench, and 07-buzzer-siren
  refused its own authored chip, for which retarget is the identity. All eight were
  measured against `retargetPseudocode`; all eight dry-runs succeed.
- **Class G.** `23-voltage-regulator` could not regulate: its zener is declared
  `kind: "diode"` with `vf: 5.1`, and a forward diode does not clamp in reverse, so no
  current took the zener branch and both resistors carried the same 8.642 mA. Declared as
  a `zener` with `vz: 5.1` the bench measures 11.739 / 6.513 / 5.226 mA against the
  document's own hand-derived 11.82 / 6.60 / 5.22 — the prose was right about all three
  and the circuit was wrong. `39-zener-clamp` and `pc18-zener-clamp` put the breakdown
  voltage in `vf`, the forward-drop field, and were right only by the 5.1 V default;
  measured identical before and after. `arduino-01-blink` claimed "1 Hz (period = 2 s)",
  contradicting itself and its program, which waits 1 s twice for 0.5 Hz.
- **Class H.** The gate for our own shared mistake. `test/fixtures/example-enrolment.json`
  records which of 16 metadata-filtered gates enrol each of the 274 examples, recomputed
  every run and diffed. Flipping 33-inductive-no-flyback's kind now reports
  `+[retarget-amplification, retarget-gallery]` BEFORE retarget-gallery fails on it, which
  is the ordering that was missing.

Two documents were describing a program that no longer exists, found by the same sweeps:

- `blinkenrocket-pendant` says a "smiley face" scrolls under two buttons. The program was
  rewritten on 2026-08-16 to beat two HEART frames, with the buttons slowing the beat, and
  the documents were never updated. Both intros and EXPECTED.md now show the frames read
  back out of the program itself, in both languages.
- `blinkenrocket-pendant`'s polarity checkpoint told the learner to edit the matrix's part
  number from 788AS to 788BS. Nothing reads that field (class A); `colActiveHigh` and
  `rowActiveHigh` are the controls, and the text now names them.

Found and NOT fixed, because the fix is not in this repo:

- **`battery_aa` ignores `params.volts` and `params.rInternal`.** bw-board registers it as
  a fixed 1.5 V / 0.3 ohm Thevenin (`src/devices/named-parts.js`). `75-battery-tester`
  declares 1.45 V and measures **1.4778 V for every value from 1.45 down to 0.5**, so its
  EXPECTED.md instruction "edit the volts parameter to 1.3 -> GOOD, 1.1 -> WEAK, 0.9 ->
  DEAD" cannot be carried out: the verdict is permanently FULL. Recorded as the single
  ENGINE entry in that gate's KNOWN_INERT. Swapping the part to kind `battery`, which does
  read both, was measured to restore the lesson exactly (1.45 / 1.30 / 1.10 / 0.90 V read
  back) — but that changes the drawn part and the loading behaviour, so it is a design call
  for the owner, not a repair.
- **The `cNum` truncation is silent.** The C emitter puts every numeric literal through
  `Math.trunc` and lowers `/` to C's integer `/`, with no warning either way. Class E
  exists because of that silence. The corpus is now clean and gated, but the next program
  someone writes will hit it: the emitter should warn when it truncates a fractional
  literal, and when it emits a quotient that is then scaled.

What the sweep did NOT establish, said plainly:

- **`assert-physics` skips every `current` assertion** — "current readback not yet wired" —
  so no current claim in the corpus has ever been checked by it, which is how
  41-pot-as-dimmer shipped 2.3 mA against a bench delivering 0.188. Class G's gate now
  derives current from Ohm's law across the series resistor and checks the PROSE claims;
  wiring the assert-block kind itself is still open, though the corpus currently contains
  no `current` assertion for it to check.
- **24 of 49 prose current claims cannot be compared at all**: an MCU bench's current
  depends on firmware state and an oscillator's on the sampling instant, and one solve
  speaks for neither. Closing that needs the execution harness, not another reader.
- The tier-2 probe answers "does perturbing this key move a bench", and 22 (kind, key)
  pairs have no bench in the corpus that responds — an op-amp that never saturates says
  nothing about `railHigh`, and no bench spins the `dc_motor` or drives I2C at the
  `ssd1306`'s address. Each is listed with its reason in the gate's KNOWN_INERT. They are
  coverage holes in the CORPUS, not defects, and closing one means building a bench that
  exercises it.
- The blinkenrocket polarity claim ("every LED glows dimly") is still unverified. Proving
  it needs the ATtiny88 program running against the matrix model, which the circuit-only
  harness does not do.

**A stale sibling pin, which is why `main` was red.** `test/fixtures/siblings.json` pinned
bw-board at `50c3bf7`, and `40db90f` ("a loaded pot wiper routes to MNA") landed after it.
Without that commit `41-pot-as-dimmer`'s wiper reads the UNLOADED 2.5000 V and its node
violates KCL by 2.17 mA — the two failures the suite had on a clean `origin/main`
(6406 tests, 6312 pass, 2 fail, 92 skipped, Node 22, siblings at the pinned revisions).
The example's own EXPECTED.md already said the engine had been fixed "until 2026-08-23";
the document was updated and the pin was not. sb3-creator's pins are now the full 40-hex
`caeac2b…` / `b5761ad…`, at which the bench measures 2.0301 V at the wiper and 1.9887 V at
the anode — exactly the hand-derived numbers the document carries.

**Verdict.** sb3-creator CI on `fix/milestone0-corpus`, run
[32668122092](https://github.com/CrispStrobe/sb3-creator/actions/runs/32668122092), success
in 3m35s: **6469 tests, 6374 pass, 0 fail, 0 cancelled, 95 skipped**. Local, all 97 test
files run one at a time against the pinned siblings: **6469 tests, 6377 pass, 0 fail, 0
cancelled, 92 skipped**. Same test count, same zero failures; the three-skip difference is
the local box having tools CI does not (and vice versa).

Where CI and this box have differed, the difference has been the box every time, and it is
worth writing down because each one briefly looked like a finding: nine failures that were
`[Errno 28] No space left on device` out of `python3 -m py_compile` and passed 697/0 on
retry; a `gallery-e2e` timeout at 900 s with eight files sharing four cores at load average
18-26, which CI does not reproduce; and a four-minute file mistaken for a hang, bisected to
an innocent commit. A contended, full-disk box does not produce failures that mean anything
about the code, and it takes a second run to tell which kind you are looking at.

The one time CI reported something local did not, they had not disagreed: the enrolment
gate had been run BEFORE the edit that broke it and never re-run, so the local result was
stale rather than wrong. CI ran the tree as pushed. That is the value of CI actually
rendering a verdict again.

**Two of this lane's own conclusions were wrong, and are corrected here rather than
quietly dropped**, because both are instrument failures worth knowing about:

- *"Advancing the pin hangs gallery-e2e."* It does not. That file legitimately takes about
  four minutes against the newer engine (242 s measured by the integrating session), and it
  was judged a hang from 55–70 s probes on a box running at load average 25–30 with four
  cores. The bisect that "found" `fea58ed` was really finding the point where the file grew
  past whatever budget each probe happened to allow. sb3-creator's per-file
  `--test-timeout` is now 900 s for exactly this reason. A timeout is not a hang, and a
  contended box cannot tell you which one you have.
- *"33-inductive-no-flyback should be `kind:"full"`."* It should be `kind:"program"` with
  the ten benches its arch-tier neighbours carry, which is what landed. The reasoning that
  reached "full" was driven by a gate going red (retarget-gallery demanded ten devices where
  the entry declared one) and treated the red as a classification argument instead of as
  the finding it was — the `devices` list had been wrong all along and unchecked, because
  a kind:"circuit" entry is outside that gate.

  **The generalisable trap, from the same incident:** `scripts/gen-device-benches.mjs batch`
  skips any entry with `devices.length < 2` and reads that list from index.json — so the
  list that was wrong is the same list the generator consults, and it reports "generated 0"
  as a successful no-op. **Changing an example's `kind` changes which gates apply to it, and
  metadata that was merely unchecked becomes load-bearing.** Any kind flip must name the
  gates that newly apply and be run against them.

### The open defects the seven waves left behind

Compiled and worked 2026-08-24 — **`docs/WAVE-OPEN-DEFECTS.md`**, one table of
every defect the seven lesson reviews left open, sorted by lessons affected and
carrying the repo that owns each fix. It exists because the reviews repaired
lessons and recorded causes: 38 defective lessons were fixed in copy, and 34
distinct causes were written down in seven places and worked on in none.

**Ten are now closed.** Nine by repair and one — the `dc_motor` winding — by
re-measurement, which is a weaker claim and is labelled as one: it stopped
reproducing between the Wave 1 vendor and today, and this pass only found that
out. Together they cover 39 of the 89 lesson-slots the table counts, and D1 alone is 28 of
them. An eleventh, the shift register's stuck data line, was repaired upstream
at the EXAMPLE level while this pass ran, so no lesson is blocked by it; the
compiler defect underneath survives and is counted as open.

The largest of them was on nobody's list. **28 checkpoints across four waves
observe `circuit-ready`**, which fires once when the example loads, so every one
of them ticked itself before the learner measured anything — the progress bar
filled in on load and nothing it recorded had happened. Wave 1 saw it and filed
it as "a structural note that belongs to the whole catalog"; each later wave read
past it. It is twice the next-largest defect and it was never counted, because
every wave counted defects in ITS lessons. `guided-lessons.jsx` now separates
ARMING observables from completing ones: the bench being up is reported and the
manual button stays the only thing that completes the step.

Two shapes are worth carrying forward from the rest:

- **A one-line fix in the wrong number of places is not a fix.** The four
  faceplates that opened with dead controls needed `"mode": "play"` in the
  example (sb3-creator), `mode` in `ControllerPanel.toJSON`/`fromJSON`
  (bw-board, which dropped it), and `setMode` in `gui.jsx`'s `PROJECT_LOADED`
  restore (lite, which never called it). Fixing only the example would have been
  undone by the first save.
- **The solver was right and the readout was wrong, three times.** The ammeter
  reporting 43.0 mA on a collector carrying 5.83 mA, the flat 0 on a closed
  button, and the blank `char_lcd_i2c` were all extraction or dispatch faults
  sitting on top of a solve that had the right answer. That is the same shape as
  Wave 6's whole finding — a good engine behind instruments that report pictures
  rather than numbers — and it is where the remaining 24 mostly live.

#### The four still open, and what blocks each

Updated 2026-08-29: **thirteen rows closed in one campaign** — D18, D20, D21,
D23, D24 and D31 (the instrument family, bw-board + bw-circuit-ui), D26, D27,
D32 and D36 (sb3-creator), and D25, D28 and D29 (the debugger wave, across
emu8051-stc, bw-board and lite). Their rows are struck through below with what
actually happened, which in six cases is not what the row predicted.

**Updated 2026-08-31: two more closed, and the count in this heading changed
with them.** D2 (the hosted compiler, in two halves needing opposite answers)
and D38 (AVR `bw_now()` called and not defined) both closed that day, so the
heading above read "five" for four days while four rows were open. It now reads
four: **D12, D13, D22, D30** — and three of those four (D13, D22, D30) are
labelled rather than broken.

**Note on scope, added 2026-09-04.** This table is the WAVE 6 ledger and is
closed to new rows; defects found after it was compiled live in
`docs/WAVE-OPEN-DEFECTS.md`, which has since grown a second half with its own
identifiers (D-SMOKE1, D-EMU-BP1/2/3, D-CORPUS1, D-FIRSTLOAD1, D-METHOD1). Do
not read a short table here as a small number of open defects overall — read
both.

Two of the debugger three are worth reading as corrections rather than as
closures. **D29's row was false and said so about itself** — it carried the
note "the claim is second-hand… verify before acting", the verification was
done, and the export it called missing had been in the pinned binary all
along. **D25's row named the wrong engine.** Neither is a tick; both are rows
that sent someone at the wrong thing, and the replacement text says what was
actually there.

Ordered by lessons affected, as in the table. Every row here is a decision
someone has to make, not work someone has to find.

| # | Lessons | Owner | What blocks it |
| --- | --- | --- | --- |
| ~~D2 hosted compiler~~ | 12 | lite | **CLOSED 2026-08-31, IN TWO HALVES, and the halves needed opposite answers.** *First half — the 8051 family* (routing `61a86f994`+`6899019aa`+`d26d1415b`; upstream repair `00fefb4`+`47c5041`; vendor `5bf1cea15`; browser gate `491d2dcb6`): a four-stage browser toolchain, not a smaller hosted call — cc1 writes preprocessed C, SDCC c1mode emits ASM/ADB, sdas emits REL/LST/SYM, and sdld links IHX/CDB against a provenance-pinned small-model runtime. Five supported 8051 targets route locally by default; unsupported families retain an explicit hosted route, while a supported-target local failure is never hidden by a network fallback. The first production attempt exposed two deeper defects rather than being waved through: Emscripten's 64 KiB default stack corrupted SDCC's recursive AST walk, and source-line extraction dropped instruction-less `case 0` labels needed by every scheduler task. The accepted build takes an 8 MiB checked stack, 43/44 generated 8051 examples compile (the remaining program also fails native SDCC), and generated programs yield complete symbols. The production gate blocks every external compiler POST and drives example 05 through build, run and pause, checking scheduler position, linked `count`, an exact one-cycle step and a write watchpoint transition. *Second half — everything else* (this push): avr-gcc and arm-none-eabi-gcc are not going to run in a browser, so those lesson benches take **D7's answer** and SHIP their image, with provenance. See the section below. |
| ~~D4 fixed scope record~~ | 4 | bw-circuit-ui | **CLOSED 2026-08-25** (`29f6da6`). This row was right that it was additive and that nothing blocked it but the work; it was wrong about the owner and about `addScopeChannel`. Both numbers are DEFAULTS there, not hard-coded — every read inside the engine uses `ch.intervalNs`/`ch.depth` — so no timebase argument had to be added, only passed. Measured on 43-rc-timing: 100 kHz → 0.082 s reaching 0.987 V, 1 kHz → 8.192 s reaching 4.999 V, the charged tail the old record could never hold. The control is labelled by record LENGTH, not rate, because "does my event fit" is the question. All four lessons restored: signals-rc-response → v5, signals-complex-impedance → v3, signals-aliasing-fft → v3, machines-clocks → v3. |
| ~~D3 Bode sweep has no numbers~~ | 4 | bw-circuit-ui | **CLOSED 2026-08-25** (`2c66851`). This row was right that the data was already in `runBode`'s result and that what was missing was a UI decision. It went: keep the rows in panel state, label the frequency axis, a twelve-row table (thinned, always keeping the two points the axis names), and a CSV button carrying every point at FULL precision — display rounding would have made a residual analysis measure the formatter. dB labels went to one decimal because whole decibels rendered −3.010 and −3.5 as the same string. `signals-cutoff-phase` → v3 and `signals-model-measurement` → v4; the other two lessons D3 is counted against were never worded around it, so there was nothing in them to restore. |
| ~~D7 empty machine ROMs~~ | 3 | sb3-creator | **CLOSED 2026-08-25** (sb3-creator `0a20e24`, `c3f25c1`, `fb1ae3a`, `2cb91f0`, `93838a2`; lite vendors them) by a THIRD option this row did not list. It offered "an assembler, or a checked-in binary and a provenance note"; for images this small the better answer is to ship **the source AND its assembler** — `scripts/build-machine-roms.mjs` builds all three, and `--check` refuses a hand-edited `.bin`, so the binary is reproducible and reviewable rather than trusted. **The third bench was the wrong bench, and finding out was the work.** Both Z80 examples said "There is no DEVICE Z80 program axis in the transpiler yet" — false since the Z80 core landed. But that axis is narrow: `z80Hw()` knows only `OUT0-7`/`IN0-7`, a 74HC374 latch and a 74HC244 buffer at port 0. `z80-bench`'s only I/O is an MC6850 ACIA, so it correctly stays program-less (its comment now says so for the true reason); **`z80-pd-bench`** has the latch, the buffer and `led0..led7`, so it got the program. Measured: `eater6502-blink` walks one bit at 99,940 cycles/lamp (799.5 ms), `eater6502-vdp-hello` puts HELLO on the TMS9918 at row 11 col 13, `z80-pd-bench` walks at **736,147 cycles/lamp (99.847 ms)** — the hand-computed T-state arithmetic and the core agree exactly. The first Z80 program in the corpus also exposed that `cToPseudocode` never learned the Z80 (it read back as `DEVICE STC12C5A60S2`); that is fixed, and the gate that holds it asserts FAITHFULNESS, because the degraded read-back was itself a fixed point and the corpus convergence check stayed green through it. **What is NOT closed here is D37**: `machines-interrupts-performance` needs an interrupt source, and neither Z80 bench wires one — a ROM cannot supply that. |
| ~~D8 `pc52` is an RLC used as an RL~~ | 3 | sb3-creator | **CLOSED 2026-08-25** (`4512354`) by this row's first option — a split, `pc89-rl-step`. The second option was tried first and measured: changing `pc52`'s capacitor to 0.1 µF gives `signals-resonance` its peak (+3.871 dB at 5032.9 Hz) and destroys the RL window (ratio 0.193 at one time constant). The two defects on that bench want opposite capacitors, and the old RL sentinel would have stayed GREEN through the change, so the regression would have been silent. That conflict is now a pinned `OPEN DEFECT:` test. Only `signals-rl-response` moved; `electricity-inductor` and `signals-resonance` use `pc52` as an RLC correctly. |
| ~~D37 no bench can interrupt~~ | 1 | sb3-creator | **CLOSED 2026-08-25** (sb3-creator `8ea99e0`, lite this push), opened and closed the same day — it came out of D7, and measuring corrected it TWICE. The first draft said the CPUs' interrupt pins were unconnected: they are not, all seven CPU benches tie `/IRQ` and `/NMI` to VCC, held inactive, which is correct idle wiring. The second draft said a ROM could not fix it and the emitter needed a Z80 ISR axis: also wrong, because **`M6502Machine` polls every chip's `irqAsserted`**, so the simulator never needed the wire. What was missing was a PROGRAM. `eater6502-bench` — whose `program.bw` was the one-line stub `DEVICE EATER6502` — now ships one, and the lesson moved to it from `z80-bench`. Built to be CONTRASTED: the foreground counts on port A in a 9-cycle INC/JMP loop while the VIA's free-running T1 interrupts every 4097 cycles and its handler counts on port B. Measured on the machine extracted from its own circuit.json: **ISR period 4094/4097/4100, mean 4097; foreground 452.84 passes per interrupt against 455.22 uninterrupted.** The mean is the VIA's own (latch + 2); the SPREAD is the lesson's subject, because the 6502 finishes the instruction in hand before vectoring, so latency is a distribution; and the deficit is what the interrupt costs (entry 7 + INC 6 + LDA 4 + RTI 6 = 23 cycles, measured 21.4). Four mutations bite. |
| ~~D9 sweep cost~~ | 2 | bw-circuit-ui | **CLOSED upstream and already vendored; re-audited 2026-08-30.** `sweep-session.js` runs one point per macrotask when no worker factory is injected, reports an exact point denominator, and Stop cancels the computation between points. `SweepPanel` no longer wraps one synchronous sweep in a cosmetic timeout. The default Bode method now uses analytical AC; the deliberately slower scope-measured mode retains the chunked path. Upstream `134cad0`, present in Lite's vendored tree. |
| ~~D10 `pc50` corner~~ | 2 | sb3-creator | **CLOSED 2026-08-25** (`776a96e`), by the rescale this row predicted: 10 kΩ/100 µF → 10 kΩ/100 nF, corner 0.159 Hz → 159.155 Hz, a point a decade below from 629 s of simulated time to 0.63 s. The caution in this row was right and was paid rather than skipped — EXPECTED.md is rewritten with the measured table and the reason, `circuit-flat.json` carries the change too, and `signals-bode-sweep` and `signals-model-measurement` are restored to content version 3. The evidence that only the frequency axis moved: the two points Wave 6 measured at 1 Hz and 10 Hz read the same magnitudes to the millibel at 1 kHz and 10 kHz, and the gate asserts that equality rather than the new numbers alone. |
| ~~D11 one-shot RC step~~ | 2 | sb3-creator | **CLOSED 2026-08-25** (`ac83352`) — but with a DISCHARGE switch, not the charge switch this row proposed. A charge switch open at rest would make `43-rc-timing` read 0 V in its first DC operating point, and this is the bench that demonstrates the engine reading the supply there (D23, open, sentinel and lesson hint both). Hiding a defect from its own gate is not a fix. Every pinned number is unchanged to four decimals; the repeat drains to the 0.4545 V divider floor and the second rise obeys V(t)=Vf+(V0−Vf)e^(−t/RC), which is the form the lesson's python variant already asked for. `measurement-rc-cursors` → v3, `signals-rc-response` → v4. |
| D12 generated ASM listing boundary | 1 | lite + sb3-creator | **PARTIALLY CLOSED 2026-08-31:** the STC/8051 `languages-protocols` listing is linked locally from the bundled SDCC `.rst`, source-mapped, read-only, and production-gated with hosted compiler POSTs blocked. Editable ASM assembly and the 6502 `machines-source-asm` listing remain explicitly hosted, so one lesson remains rather than falsely striking the row. |
| D13 directional `resistance()` | 2 | bw-board | **Not a bug.** `testNodeB` is the reference and ground symbols are switched out on purpose (`mna.js:354`). What is open is whether the API should refuse an ambiguous probe order rather than answering; the lessons teach the rule instead. |
| ~~D18 LM358 halts short of its gain~~ | 1 | bw-board | **CLOSED 2026-08-29** (bw-board `999eb66`+`187694f`). This row was right that the fix needed the corpus pass and wrong about what the fix was: not a bigger threshold or more iterations, but halting on the INPUT error instead of the op-amp's own output step — a secant, converging in two rounds. The corpus pass was run and is the reassuring part: 232 benches, exactly ONE moves (`76-multimeter`'s LM358 stage), 2635 claims, 0 verdict changes. Measured after the lite vendor: gain **46.4545455545** at load 25/50/75/90/95 %, and the 100 % row unchanged at 3.4966 V / 35.6651 because ×46.45 of 98.04 mV asks for 4.5544 V and the part's top swing is `vcc − 1.5`. `measurement-range-error` → v3, EN and DE. |
| ~~D20 no op-amp output limit, D21 meter has no input impedance~~ | 1 each | bw-board, bw-circuit-ui | **BOTH CLOSED 2026-08-29** (bw-board `18555e7`+`5abf9ea`, bw-circuit-ui `3f1d194`), and they came in the same wave as D18's oracle pass, which is what this row said they needed. D20 went through bw-board's MNA gate properly: `spec-updates/opamp-output-limit.md` plus hand-computed oracles in the same commit, `rout` plus a 40 mA default `iShort`. Measured after the lite vendor: the follower holds 2.499975 V down to 62.5 Ω (39.9996 mA) and is a 40 mA source below it — 1.0000 / 0.4000 / 0.0400 V into 25 / 10 / 1 Ω. D21 was **two** defects: the probe drew no current, and (unrecorded) leaving its terminals in the nets while filtering it out of `parts` made the validator reject the whole netlist, so wiring the probe emptied the board and the meter read a fabricated 0 V. `model/meter-load.js` stamps a voltage-mode meter as a 10 MΩ resistor carrying its own id; oracle 50/21 V on a 1 M/1 M divider, measured 2.3809512 against 2.3809524. `signals-loading` → v3, both regimes restored. |
| D22 bit-exact potentiometer | 1 | bw-board | Still open, and the design this row asked for is now **filed and deliberately not implemented**: bw-board `3e58fd7`, `spec-updates/seeded-measurement-noise.md`, counter-based rather than time-based so a gate that quotes a reading stays exact. It waits for a consumer — shipping an unused noise model would be the producer-must-assert-consumer bug this fleet keeps finding. |
| ~~D23 first solve is a DC operating point~~ | 1 | bw-board / bw-circuit-ui | **CLOSED 2026-08-29** (bw-board `f87adcc`), and NOT the way this row proposed. "Advance before the first read" would have papered over it in one consumer; the walker now honours the capacitor's stored state in the first solve, including the unfiled decoupling-cap-pins-rail-to-0 case. Measured after the lite vendor: a freshly loaded `43-rc-timing` reads **0.0000 V** at `c1.a` and agrees with `getCapVoltage`, and 0.5/1/2/3 τ are unchanged to four decimals. `signals-rc-response` → v6. |
| ~~D24 no FFT~~ | 1 | bw-circuit-ui + bw-board | **CLOSED 2026-08-29**, and this row's two-piece diagnosis was exactly right — bw-circuit-ui `7696656` (`model/fft.js` + the panel's spectrum view) and bw-board `9441e4f`+`2169d9b` (`addScopeChannel({capture: 'sample'})`, whose sample instants are SOLVE points: 1.2e-11 V of barrier error against 618 mV holding and 128 mV interpolating). The envelope stays the default *because* this row was right that it is the correct structure for drawing, so the spectrum is a second tap and a transform over an envelope is refused by name. Measured after the lite vendor on `49-function-generator-sine` at the tap's default 10 kHz × 8192: Nyquist 5000 Hz, bins 1.220703125 Hz, the 1 kHz sine on bin 819 interpolating to 999.9466 Hz at 2.499976 V peak, THD 0.0000 % over four harmonics. `signals-aliasing-fft` → v4. |
| ~~D25 no cycle-level step~~ | 1 | emu8051-stc, then bw-board + lite | **CLOSED 2026-08-29** (emu8051-stc `ecabd29`+`cf3c7c0`, bw-board `70c75d6`, lite this push). This row was right that a cycle step is new capability and not just a button, and **wrong about which engine**. It named the 6502; `W65C02.step()` fetches an opcode and runs `_exec` to completion, returning the instruction's cycle count, and `Z80Machine.step()`, avr8js and rp2040js are all that shape. None of the four has sub-instruction state, so a cycle button there could only relabel the instruction step — the D5 lie, shipped deliberately. emu8051 is the exception and the only one: its `tick()` advances a single oscillator clock and returns false while the instruction in flight finishes. `STEP_CYCLE` was appended to the C enum (never renumbered — the ints are a wire protocol) and completes in `dbg_tick` ABOVE the instruction-boundary return, which is the whole feature. Measured on `MOV DPTR,#1234h ; NOP ; NOP`: **3 cycle steps against 2 instruction steps** to reach PC 4, because this core executes on the first clock of an instruction and idles out the rest — so the second cycle step advances a clock in which nothing architectural changes, and that idle clock is exactly what an instruction step cannot stop on. The contrast is the gate; the first draft of the test asserted a standing-still PC and stayed green under mutation because the program ended in `SJMP $`. The other four refuse `cycle` by name with the architectural reason and point at `regs().cycles`. `machines-buses` keeps its sentinel, re-worded from OPEN DEFECT to ADJUDICATED: the 6502 must go on refusing, and the refusal must go on explaining. |
| ~~D26 prefix/infix bitop holes~~ | 1 | sb3-creator | **ISOLATED AND MOSTLY CLOSED 2026-08-29** (sb3-creator `32b1e1a`), and the answer was neither of this row's two readings. The referee's OWN truth test was inverted — `num("true")` is 0 — and the referee is the instrument every measurement in this row was taken through, so both "the comparison" and "complementary holes" were descriptions of its shadow. Underneath it, four backends answered `IF <bare value>` four different ways. One `boolishTruthTest` now serves all four, and the prefix spelling is REFUSED by name (a reference to a variable nothing writes) rather than read as zero: *"`bitand val 128` reads as a VARIABLE NAME… the bit operators are infix in this dialect"*. 0 false positives over 280 programs. Re-measured after the lite vendor: three prefix forms refused with the warning, three infix forms firing INCLUDING the bare one that was the second hole, and `not` correct in both directions in condition position. **Still open, different shape, upstream:** `not <cond>` in VALUE position is a phantom variable and `cToPseudocode` EMITS that shape — a dialect decision, pinned as an OPEN DEFECT test in sb3-creator. |
| ~~D27 `ttl-clock-module`'s dead step button~~ | 1 | sb3-creator | **CLOSED 2026-08-29** (sb3-creator `56bd1ce`) by exactly what this row scoped: a wire plus a flip-flop. `ff1` is a D flip-flop with D tied to its own Q̄ — a divide-by-two — clocked from the button and driving a second LED through `r4`. Measured after the lite vendor: Q at rest 0.0000 V, then 4.4643 / 0.0000 / 4.4643 / 0.0000 across four presses, and unchanged on RELEASE, which is what distinguishes stored state from a light following a switch. The 555 half is asserted untouched. `machines-clocks` → v4, both halves restored; `EXPECTED.md`'s claim is now the measured one. |
| ~~D28 no call stack~~ | 1 | lite | **CLOSED 2026-08-29** (lite this push), and the row's own aside turned out to be the design. It said the revised exercise — reconstruct the stack from where Step Out lands — is arguably better; that is now what the pane TEACHES. On the C target there is no call stack to display, because the program is not a stack machine: `generateC` lowers each WHEN block to a state machine over a millisecond tick, so "inside the pulse procedure" is a value in a `<task>_state` variable, and the 8051 stack underneath holds SDCC's return addresses mixed with saved registers and spilled locals with no frame pointer to separate them. So `deriveFrames` returns `callStack: null` — not `[]`, which would read as "no frames right now" and claim frames exist — with the reason in words above the data, and shows the position that DOES exist: each task's state, its deadline, the symbol table ADDRESS that state lives at (which no target exposes; only `runner.symbols()` has it) and the block it belongs to. For 6502 and Z80 a real return-address stack is walked, still labelled CANDIDATES because nothing on those machines marks a return address apart from a pushed register. Writing that walk found a bug of exactly the kind the pane exists to prevent: masking the 6502's `S + 1` to eight bits turned the reset value 0xFF into base 0x0100 and reported the whole stack page as sixteen call frames. The empty-stack test caught it. The program's variables are reported as `variables`, never as `locals` — calling a global a local is the same lie in a smaller place. `debug-call-stack` → v3, EN and DE. |
| ~~D29 watchpoints gated off~~ | 1 | emu8051-stc + bw-board + lite | **CLOSED 2026-08-29** (emu8051-stc `3c31e48`+`cf3c7c0`, bw-board `70c75d6`, lite this push), and **the caution in this row was right: the claim was false.** It was verified before acting, as instructed. Lite's pinned binary exported `_emu_dbg_set_bp_write` all along — the claim came from a comment inside `emu8051-debug.js` that said the opposite, and this row, a test comment and the `debug-watches` hint were all written around a sentence nobody had instantiated. It was never a pin bump. **Two real defects sat underneath.** (1) The halt could not say what it caught: `struct dbg_halt_reason` carried cause, pc, bp_id and t_ns, reached JS only as a pointer whose layout must not be assumed, and `bp_id` was therefore recovered by matching the halted PC — which works for code and yield breakpoints, both set AT an address, and cannot work for a watchpoint, whose subject is an address rather than a PC. Nine scalar exports now carry the reason across, the breakpoint is NAMED, and a write watchpoint reports `cause: 'watchpoint'` with space, address, value and **prev**, because a transition is the evidence and a new value with no before is half a measurement. (2) Lite never wired the consumer: `DebugStatus` renders its watchpoint field only when handed `onAddWatchpoint`, `CircuitDesigner` passes `debugState.addWatchpoint`, and `circuit-tab.jsx` never set it — producer-must-assert-consumer, from the consumer's side. Two further bugs were found by testing the path: `dbg_reset` did not re-seed the watch shadows, so an SFR watchpoint surviving a Restart fired on the reset's own rewrite of P0..P3 (a stop with a real address on it that no instruction caused), and `emu_dbg_set_bp_write` accepted any `space`, arming a watchpoint that could never fire. The honest limit is documented in three places rather than left to be discovered: this is a CHANGE detector sampled at instruction boundaries, so a store of the value already there is invisible. `debug-watches` → v3, EN and DE. |
| ~~D38 AVR `bw_now()` is called and not defined~~ | 1 | sb3-creator + lite | **CLOSED 2026-08-31** (sb3-creator `9e7f2f0` repair + `5d6d83c` native census; Lite `4d4c66f9b` image + `068c5bafc` production proof). The repair is at the producer: every non-6502 cooperative scheduler explicitly requests the clock helper before helper emission. Removing that one promotion makes both AVR generator contracts red and makes all five original reproducers fail native linking by name. The sequential real avr-gcc census maps the tracked corpus to five MCUs and links **80/80** in firmware/debug mode. Lite pins the complete upstream SHA, ships the fourteenth image with avr-gcc provenance, keeps an empty refusal ratchet, and restores `debug-timing-bugs` v3. The watched production build drove that exact bench with every cross-origin request blocked: prebuilt provenance visible, `bw_task0 state 1` visible at SRAM `0x100`, program time **333.334→483.335 ms** across run/pause, then a same-pin source edit missed the image, attempted exactly one blocked hosted POST, and showed the honest edited-program boundary. **20/20, zero page errors.** |
| D30 `microbitplus` no-ops | 1 | lite | **Deliberate and documented.** The blocks lower to MicroPython for the simulator; the VM methods are intentional no-ops. What is open is only the missing `showStatusButton`, and declaring one for an extension with no transport would be a lie. |
| ~~D31 one global V/div~~ | 1 | bw-circuit-ui | **CLOSED 2026-08-29** (bw-circuit-ui `7696656`, `model/scope-scale.js`): per-channel V/div and centre, each channel carrying its own scale. Small, additive and unblocked, exactly as this row said. |
| ~~D32 no filter to time~~ | 1 | sb3-creator | **CLOSED 2026-08-29** (sb3-creator `1d2606b`). This row's caution was right and was paid: the lesson moved with the bench, to v3. The filter is four VARIABLES, not a list — list ops lower to `0 /* item */` on the device, so a list filter would have been a no-op on real silicon and a worse lesson than none. Measured after the lite vendor: settling = window × loop period = 4 × 20 ms = **80 ms**, group delay = (N−1)/2 = 1.5 samples = **30 ms**, staircase **24 / 49 / 74 / 100 %** one quarter per pass. One caveat found by measuring: the staircase reads 24/50/75/100 unless the calibration sweep reaches BOTH rails (511/1022 is exactly 50 %; 511/1023 truncates to 49), so the gate now clips a larger sine instead of scaling a smaller one. |

Three of those — D13, D22, D30 — are labelled because they are not what they
look like: one is a documented design decision, one has its design filed and is
waiting for a consumer, and one is deliberate. Recording them as "open defects"
without that label would send someone to fix something that is not broken.
(D26 used to be the second of these three, for the honest reason that it had
never been isolated to a component. It has been now — see its struck-through
row — and the isolation is why it moved off this list rather than a repair
being found for what the row described.)

What is still open is in that table with what blocks it. D2 was the largest row
and is now closed on both halves: no lesson bench in the corpus needs the
network to start. The rows still open account for 4 lesson-slots, and no single
one affects more than two lessons.

### D2's second half: prebuilt lesson images (2026-08-31)

**What the row's own numbers got wrong, first.** It said "all ten Wave 5 lessons
declare `environment: "simulation"`" in a position that reads as though that
field picks out the affected set. Measured at tip, **68 of 70 lessons declare
it** — the two that do not are `optional-hardware`. A field almost every lesson
sets cannot select anything. The set that actually could not start offline is
the one whose bench needs a compiler: **41 lessons name an example with an MCU
program, 25 of those on a non-8051 part**, and those 25 sit on 22 distinct
examples. Wave 5's own ten split **five 8051 / four AVR / one RP2040**, which is
the shape the row should have carried.

**What was shipped.** Of the 22 non-8051 examples, four are eater6502 machine
benches that already ship ROMs (D7), four are micro:bit/SPIKE benches whose
runtimes are bundled simulators with no `/compile` route at all, and **14 need a
hosted compiler**. All fourteen now ship their compiled image under
`overlay/scratch-gui/static/lesson-images/` — 160,640 bytes of payload plus an 8,915-byte
manifest, the largest single file 23.4 KB, one per (example, target, format)
and a manifest carrying the
program's SHA-256, the compiler version from `/health`, the build date and the
lessons each image serves. D38's formerly refused fourteenth image is linked,
executed under the real AVR adapter, and production-proven offline.

**Why a first-class lookup and not a pre-seeded localStorage LRU**, since the
compile cache was the other candidate. The LRU holds six entries, evicts on
quota and swallows the quota error — correct for a cache, wrong for an asset
whose entire promise is that it is still there; it is empty on a first visit, so
seeding it needs startup code that writes every image anyway; its keys embed the
full C, so seeding pays for the source twice; and a cache entry carries no
provenance, so the panel could not say why it skipped the network. The LRU keeps
doing its own job (a user's own repeat compiles). This is a separate, read-only
lookup, asked BEFORE the LRU and before any network, and skipped entirely for
the five 8051 targets — shipping an image for a build the app can do itself
would be a second source of truth, and the stale one would win.

**`generateC({debug: true})` is not byte-stable, which the mechanism had to
survive.** Every parse mints fresh random block ids and writes them into the
`@bw yield` markers: three differing lines on `73-voltmeter`, seven on
`nano03-two-tasks`, line count identical, nothing else moving. Those ids sit in
a C comment, and the compiler proves it — the same program parsed twice and
compiled twice returned **byte-identical images** both times (2472 and 1992
bytes), while only the echoed `block` field in the symbol table differed. So the
key is the C with that one token blanked, compared character for character after
a `(target, format, length)` index — no `crypto.subtle`, which does not exist
outside a secure context. The echoed ids are DELETED from the shipped symbol
tables: both debug targets index `${task}/${state}` and never read them, and an
id belonging to a parse nobody will repeat is worse absent-than-wrong.

**The honest residue.** A program the learner has EDITED on an AVR or ARM bench
is a program nobody has compiled. It changes real code, misses the lookup, and
falls through to the hosted service — which refuses honestly with no network.
No prebuilt image ever stands in for it, and the browser gate proves that half
too: after one changed number the run goes to `error`, the blocked POST is
recorded, and the prebuilt sentence disappears rather than staying on screen
describing firmware that is no longer running. (Measured while writing that
gate, because reading the code had suggested otherwise: an edit that keeps the
same PIN SIGNATURE also rebuilds. `stop()` leaves `session` in place and the
panel only tears the runner down on a pin change, which looked like it would
resume the old image; it does not.)

**And the refusal says something.** It used to be the browser's own "Failed to
fetch" — six words naming neither what was attempted nor why the same bench had
started without a connection a minute earlier. It now says what was tried, that
avr-gcc and arm-none-eabi-gcc cannot run in a browser so they are not in the
page, that lesson benches on this family DO ship their program prebuilt, that an
edited program is not one of them because nobody has compiled it, and the three
things that would work. Branched on the family: an 8051 target only reaches that
line when its in-page router is not answering, and telling that user to switch
to an 8051 device would be nonsense.

**A defect the evidence found.** `runner.variables()` read a fixed two bytes for
every symbol, so anything narrower had its neighbour spliced into the high byte
and was reported as fact. It surfaced not from a failing test but from LOOKING
at the browser proof's screenshot: `bw_calm`, a one-byte flag, rendered as 2561
in one run and −11775 in the next. Measured on the shipped image, the byte holds
0 and the two-byte read gives 59136. Fixed here (D39), with 2 kept as the
fallback so an 8051 table that omits `size` is unchanged, and the signed reading
applied only at the emitter's own 16-bit width — nothing in the symbol table
declares a sign, and reading a one-byte counter as signed would turn 255 into −1
on exactly the variables the fix exists to stop guessing about. The argument for
a gate that leaves a picture behind is this row.

**Evidence.** `test/shipped-lesson-images.test.mjs` — 17 assertions,
mutation-proven on both families (add a script to `nano03-two-tasks` and three
go red, to `pico02-pot-print` and two do). It re-derives every manifest claim
from the corpus, and it ATTACHES each image to a real bw-board with `fetch` cut
to the shipped directory and RUNS it: the AVR blinks its LED across 428k
instructions, the Pico prints its ADC count. The browser half is
`scripts/verify-offline-lesson-image.mjs`, which loads `debug-task-scheduling`'s
own bench in Chromium with **every** cross-origin request aborted.

**Added 2026-08-25 by the post-repair re-check** (`docs/POST-REPAIR-RECHECK.md`):

| defect | lessons | owner | what blocks it |
| --- | --- | --- | --- |
| ~~D35 quasi pins armed at zero~~ | 0 | sb3-creator | **CLOSED** (`553a639`). The Pocket Calculator repair fixed the board-class half of a two-family defect; the arming loop it added passed `false` as the pull's rail, and a quasi pin idles HIGH. 43 → 22 → 1 of 67 wired controls dead. |
| ~~D36 `arduino-02-digital-input-pullup` declares the wrong polarity~~ | 0 | sb3-creator | **CLOSED 2026-08-29** (sb3-creator `934f594`), with the which-side-was-wrong verdict this row asked for: the DECLARATION was wrong, and `cToPseudocode` already agreed (*"INPUT_PULLUP is a button wired to ground: pressed reads 0. That is ACTIVE LOW"*). `PIN btn = D2 INPUT ACTIVE LOW`, and the program's own read inverted to `(1 - read btn)` so the sketch still prints the RAW pin, which is the inverted logic the example is about. **`EXPECTED_DEAD` is now EMPTY**: 67 wired controls dead → 43 → 22 → 1 → 0. It also took the counterfactual low-rail number from 22 to 21, because `input-pullup` carries its own rail in `pin-model.js` and ignores the argument — which corrected the claim that the 22 were "the 8051 side specifically". They were 21 plus this one. |

That pass also leaves one gap named rather than closed: **`declared-pins-wired`
asks whether a declared pad is WIRED, and nothing asks whether it is wired with
the polarity its declaration claims.** The new gate deliberately asks the weaker
question (does the pin CHANGE when its control is operated), because a
polarity gate written around one convention condemns the other — `26-debounce`
inverts in the program, `05-counter` lets the driver do it, and both are
correct. D36 is the single case where the two questions give different answers,
which is exactly why it is worth a row instead of a ratchet entry alone.

### Verification-debt ledger

Waves 1–7 are all recorded in the execution log as engineering/content drafts **complete**;
the technical reviews of waves 1–6 are closed and wave 7 is open. Stated plainly, so it
cannot read as finished work.

Milestone 0 gates the other ten milestones, so this table is the gate's readout. It records
what was MEASURED, against which revision, and what is still open — not what was drafted.

**Lessons.** Every closed review names the lite sha it was measured against; a review is only
as current as that sha, and several findings expired within hours of being written.

| Wave | Lessons | Draft | Technical review | Measured against | Translation | Field test |
| --- | --- | --- | --- | --- | --- | --- |
| 1 Electricity you can see | 12 | done | **full, 2026-08-23**; open defects closed 2026-08-24 — 5 of 12 defective; 5 fixed, **0 open** (the ammeter fixed at the source, the motor expired on re-measurement) | `3c6948f5d`, re-measured `7ce24a619`, re-derived `1311898d5` | open | open |
| 2 Measure rather than guess | 10 | done | **full, 2026-08-23**; 1 closed 2026-08-24, 1 more 2026-08-25 — 5 of 10 defective; 6 revised (two now at v3, four at v2), **2 open** engine defects, 2 fixed upstream | `3e87340f5`, re-measured `7ce24a619`, re-derived `1311898d5` | open | open |
| 3 One idea, several languages | 12 | done | **full, 2026-08-23** — 1 of 12 defective; 1 revised to v2 | `a3f30be6b` | open | open |
| 4 Interactive systems | 8 | done | **full, 2026-08-23**; 4 of 5 closed 2026-08-24 — 7 of 8 defective; 10 revised (three to v3), **1 open** app defect (the micro:bit no-ops, deliberate) | `2e294ceaf`, re-measured `d7325a272` then `7ce24a619`, re-derived `1311898d5` | open | open |
| 5 Debug with evidence | 10 | done | **full, 2026-08-23; debugger defects closed 2026-08-31** — 3 of 10 defective; 3 revised to v2, **0 open** | `a3f30be6b`, offline compiler proof `491d2dcb6` | open | open |
| 6 Signals and systems | 10 | done | **full, 2026-08-23**; 1 closed 2026-08-24, 5 more 2026-08-25 — 9 of 10 defective; 10 revised (one at v5, two at v4, four at v3, three at v2 — counted from the file), **5 open** instrument/engine defects | `1d10902cb`, re-derived `1311898d5` | open | open |
| 7 Computers from wires upward | 10 | done | **full, 2026-08-23**; re-measured 2026-08-24, 1 closed 2026-08-25 — 8 of 10 defective; 9 revised (three now at v3, five at v2), **6 open**, of which the shift register's is now compiler-only (its example was repaired upstream) | `1d10902cb`, re-measured `91a95ba42`, re-derived `1311898d5` | open | open |

**"Re-derived" is a weaker claim than "measured against", and the difference matters.**
A review measured against a sha means a human worked every checkpoint on that tree.
Re-derived means the numbers that tree's review PINNED were re-run on a later one and
still hold — it inherits the review's judgement and only refreshes its arithmetic. The
2026-08-25 entries are of the second kind: the whole lite suite at `b8afbc5e3` (`eed6fcc73`
plus a LANES row, so no test input differs) came back
993 pass / 0 fail / 1 skip, so every pinned wave quantity survived three bw-board vendors
(`b5c02b1` source-and-transistor honesty, `a301937` buzzer KCL, `88e96681`) that all landed
AFTER the shas those waves were measured against. Nothing in a wave doc was re-judged by
that run, and it is not evidence about any quantity a wave did not pin.

**Examples.** Milestone 0's scope covers the corpus as well as the lessons, and the ledger
never tracked it. Measured against sb3-creator `fix/milestone0-corpus`, with siblings pinned
at bw-board `dcaf05fb` and bw-circuit-ui `0a3ec00e`:

| Surface | Population | Swept for | State |
| --- | --- | --- | --- |
| Example programs | 272 `program.bw` | classes B, D, E, and the kind/content contract | **done** — 8 defects fixed, all gated |
| Circuit params | 2,098 circuit files, 53 (kind, key) pairs | class A, both tiers | **done** — 9 keys fixed; 22 pairs no bench exercises, each listed with its reason |
| Circuit structure | 35 structural key paths | class A by hand against the widened reader set | **done** — all 35 read; no gate, checked once |
| Index metadata | 274 entries, 26 fields | class F | **done** — 44 defects fixed; 7 fields gated, 19 named with the gate that holds each |
| EXPECTED.md prose | 274 files, 49 current claims, 7 freq/period pairs | class G | **partial** — 4 defects fixed; **24 of 49 current claims cannot be compared** (MCU and oscillating benches) |
| EXPECTED.md assert blocks | 359 assertions | assert-physics | **partial** — 317 pass, **42 skipped** as unknown kinds (display text, audio state, terminal transcripts) |
| Gate coverage per example | 274 examples × 16 metadata-filtered gates | class H | **done** — recorded in `test/fixtures/example-enrolment.json`, diffed every run |
| Circuit variants | 1,034 rendered | electrical faithfulness | **OPEN** — `schematic-*` checks mechanical legibility only; nothing asserts a variant is what the simulator solves |

**What the corpus sweep contributed to this table (2026-08-23).** The sweep above reviewed
the EXAMPLES, not the lessons, but four lesson waves name examples it changed, and one of
those changes is a defect in an open wave:

- **Wave 7 (`machines-gates-registers`) taught shift registers against a bench that could
  not shift.** Its example is `20-shift-register-binary`, which latched 0x00 into the 595
  for every counter value; every LED was dark for the whole 64-second count. The lesson's
  own checkpoint asks the learner to predict the data line on each clock edge and then
  compare it against the pin traces — a comparison that could only ever show a flat line.
  The example is fixed; the lesson still needs its full technical review, and this is the
  first confirmed defect found inside Wave 7 rather than scanned for.
- **Wave 3 (`languages-pins-peripherals`) asks for a "reported voltage"** from
  `arduino-01-read-analog-voltage`, which printed 0 on the device target for every input
  and the right answer in the VM. The example now reports MILLIVOLTS, because the device
  target has no floating point; the checkpoint's wording still holds but its unit changed,
  and Wave 3's review is recorded closed, so this is a re-check it did not get.
- **Wave 3 (`languages-protocols`) / Wave 2 (`measurement-2`) / Wave 6 (`signals-6`)** name
  `08-led-chaser-595`, `76-multimeter` and `pc54-opamp-follower`. Only inert declarations
  were removed from those three and all three were MEASURED to solve identically before and
  after, so no checkpoint of theirs is affected.

"Scanned" and "reviewed" are different claims and the table keeps them apart.
**Scanned** means all 79 lessons and all 180 checkpoints went through the Tier-3
detector (`docs/LESSON-ACHIEVABILITY-SWEEP.md`), which decides one question
mechanically: can this checkpoint's observation ever happen on the example it
names? **Reviewed** means a human worked through every checkpoint against a
solved bench, which is what Wave 1 got and what found the other four classes of
defect the detector cannot see.

**27 of 79 lessons have had no full technical review**, though all 79 are now machine-scanned for
the one defect class that detector understands. Treat this table as the plan's real critical path:
a lesson that teaches an observation its bench cannot produce is worse than a missing lesson,
because a learner blames themselves.

### Wave 2, and what the instrument wave turned up

Reviewed 2026-08-23 — `docs/LESSON-REVIEW-WAVE-2.md`. **10 lessons, 30 checkpoints, 5 defective,
6 revised to content version 2, 4 defects open and none of them in a lesson.** The Tier-3 detector
reported nothing on this wave, which is the expected result: none of the five is a demand for a
missing capability, so all five were found by measuring.

Two of the open defects are the same discovery from different angles — **the simulator cannot show
a reading to a learner** — and a third of that family was fixed upstream while the review ran:

- `73-voltmeter`'s OLED did not render at `3e87340f5`: the `devices` extension declared 37 opcodes
  and not one oled verb, and an undefined opcode is silent. **Resolved** by `802fc1050` (eleven
  OLED/TFT opcodes) plus `6f8d11c5c` (the `setDeviceControl` dispatcher). Re-measured by executing
  the dispatcher on the lesson's own bench — all three verbs accepted, device state changed — and
  the lesson copy is restored to its three-way comparison.
- `74-ammeter`'s LCD still does not render, for a reason far narrower than first reported. Of the
  four display models this corpus uses, `char_lcd_i2c` is the ONLY one with no `control()` handler
  — `char_lcd`, `hd44780` and `ssd1306` all have one — and `char_lcd_i2c` is exactly the kind that
  bench seats. All three verbs return false with the display unchanged.
- `76-multimeter`'s current amplifier delivers a gain of 31–39 against a documented ×46.45, and
  the realised figure depends on the input. bw-board's LM358 is a damped integrator that halts once
  its per-round output step drops below 1 mV, leaving up to 0.667 mV of input error unamplified — a
  third of a 2 mV shunt signal. The example's own EXPECTED.md is self-inconsistent as a result: it
  documents ×46.5 and records a display of `067` for a current measuring 99.96 mA.

A fourth, found while re-checking my own continuity verdict: `board.resistance(a, b)` is
**directional by design**. The solver makes `testNodeB` the reference and then switches ground
symbols out of that solve deliberately, so a dangling ground cannot fake a shunt path — so on
22-series-parallel the whole network reads 2191.6 Ω probed one way and 333 MΩ, an open circuit,
probed the other. It corrected a verdict I had already written down. My first draft called it a
simulator fault in learner-facing copy; that was wrong, and the hint now explains the reference
rule instead.

**One process finding, which cost three sessions an hour and belongs in the working rules.** The
`setDeviceControl` defect was true when reported and resolved by `6f8d11c5c` — not false. Two of us
re-measured on a tree that had moved, got a different answer, and reached for "my instrument was
broken" before checking whether the subject had changed. The instrument story was even plausible:
that same commit introduced a literal NUL byte into `board.js`, which makes GNU grep silently treat
it as binary and search nothing. But the timestamps had the answer all along. A measurement without
a sha attached is a rumour by the time it reaches a second person.

The fourth is a bench, not an engine: `43-rc-timing` has no controls at all, so the charging step
its cursor lesson measures happens once and cannot be repeated — power-off freezes the capacitor
rather than discharging it, and power-on resumes from where it stopped.

The two lessons that needed no engine change were straightforwardly wrong and are fixed:
`measurement-resistance` told the learner to apply 1/R = 1/R1 + 1/R2 to a pair of parallel
resistors that does not exist on its bench (every branch carries an LED; the whole network reads
2192 Ω rail to rail and the two branch tops are the same node), and `measurement-scope-timebase`
asked for cycle counts in 1/10/100 ms windows when the scope offers 4.096/20.48/81.92 ms.

### Wave 3, the healthiest wave, and the dependency it exposed

Reviewed 2026-08-23 — `docs/LESSON-REVIEW-WAVE-3.md`. **12 lessons, 24 checkpoints, 62 declared
language variants, 1 defective, 1 revised to v2.** Sixty-one of the sixty-two variants were
GENERATED from each lesson's own example through lite's own compiler (asserted byte-identical to
the overlay copy) — every program parses, produces blocks, and emits Python, JavaScript and C, with
nothing empty and nothing throwing. For a wave whose premise is "the same idea in several
languages", that is worth recording as a positive result.

The exception: `languages-protocols` is the only lesson declaring `asm`, and there is no ASM
emitter. The Code tab's ASM view is real but both its modes go over the network — the listing comes
from `POST stc-compiler.vercel.app/compile`, the source mode from `/assemble` — while the lesson
declares `environment: simulation`. Fixed as a disclosure: its asm variant now says so, EN and DE.

**Following that dependency upstream is what found Wave 5's defect 0**, which is larger than
anything else in either wave and is recorded there: the debugger takes the same route, for every
device family, so all ten Wave 5 lessons need a network connection before their first checkpoint —
and all ten also declare `simulation`. An in-bundle SDCC WASM exists behind a `localStorage`
opt-in, off by default and discoverable from no lesson. I found the small instance first and only
then looked upstream; the general lesson is to trace a dependency to its origin rather than stop at
the first component that answers the question.

### Wave 5, where the subject under test is the debugger

Reviewed 2026-08-23 — `docs/LESSON-REVIEW-WAVE-5.md`. **10 lessons, 20 checkpoints, 3 defective,
3 revised to v2, 3 defects open — all three in the debugger UI, none in a lesson or a bench.** All
ten benches exist and carry the parts their lessons need; the Tier-3 detector reported nothing.

This is the first wave whose observable is not a circuit, so the method changed with it: the
checkpoints ask what the DEBUGGER can show, and the gate checks the debug surface against what the
code produces and renders rather than against what the feature is called.

- **The task list displays one of the four fields its lesson asks for.** All three debug targets
  build `{ task: <name>, state, until? }`; `DebugStatus.jsx` renders `{task.name}`, which nothing
  emits, so the name column is undefined on every target. `until` — the wait deadline — is produced
  by every target and consumed by the runner's `stillWaiting()`, and never rendered. `task.label`
  is rendered and emitted by nobody.
- **There is no call stack.** `Step Out` is a real control; a frames-or-locals view exists nowhere
  in the debug UI. The lesson hedged in its prediction step ("if those frames exist") but its
  action step said "inspect frames and locals".
- **The watch surface is gated off on the target its lesson uses.** Write watchpoints are
  feature-detected on `_emu_dbg_set_bp_write`, which `emu8051-debug.js` documents the pinned lite
  build as lacking, and the panel shows the field only when the capability is advertised. The
  working surface is per-block hover values while paused.

`debug-conditional-breakpoints` deserves the opposite note: it is the best-matched lesson reviewed
so far. Its hint names `counter = 5` and `bw-debug/condition.js` parses exactly that grammar and
refuses arithmetic with a reason; its instruction to "deliberately test a misspelled variable"
lands exactly, because `countr = 5` parses and then evaluates false for ever.

### Wave 4, where the subject under test is the interactive surface

Reviewed 2026-08-23 — `docs/LESSON-REVIEW-WAVE-4.md`. **8 lessons, 16 checkpoints, 7 defective,
7 revised (one to content version 3, six to 2), 5 defects open and 1 fixed upstream mid-review —
none of them in a lesson.** The
Tier-3 detector reported 0 blocking and 0 to review on all eight, which is the right answer to the
question it asks and no answer at all to this wave's, so all seven were found by measuring.

Wave 4's checkpoints ask whether a learner can operate a control and see a display, so the gate
(`test/lesson-panel-claims-wave4.test.mjs`) drives the real `ControllerPanel` restored from each
example's own `controller.json` the way `pseudocode-importer.jsx` restores it, wired to the real
scratch-vm by the real `bindPanelToVariables`. The faceplate loop itself is sound and measured —
`mb05-faceplate-matrix` reproduces its EXPECTED.md to the digit, and `retro-console`'s D-pad,
buttons and trail all drive the program — which is what makes the seven defects specific rather
than a verdict on the surface as a whole.

Five things are open, in the order they cost a learner most:

- **No simulated micro:bit sensor can be varied from the app.** The bundled simulator models each
  one with its range, default and unit (`RangeSensor("temperature", -5, 50, 21, "°C")`,
  `RangeSensor("lightLevel", 0, 255, 127)`) and accepts `{kind:'set_value', id, value}`. The string
  `set_value` appears nowhere in lite: `MicrobitSimPane` posts only `flash`, `serial_input`, `stop`
  and `reset` and renders no sensor control. **Fix:** a slider row in that pane, which is lite-owned.
  It would make `interactive-sensor-capability` deliver the contract the simulator already declares.
- **`microbitplus` blocks are no-ops in the Scratch VM and it declares no `showStatusButton`.** The
  no-ops are deliberate and documented (the blocks lower to MicroPython for the simulator); the
  missing status button is why `interactive-extension-discovery` could not point at a connection
  indicator. **Fix:** either declare one, or keep the lesson's revised wording.
- **The widget inspector edits no functional config.** Its only `onConfig` calls are `color`,
  `fontSize`, `src` and `text` — the two decoration widgets. A button's `toggle`, a slider's
  `min`/`max`/`step`, a gauge's `min`/`max`/`label` and a matrix's `rows`/`cols` are reachable only
  by hand-editing `controller.json`. The toggle behaviour is implemented and correct, just
  unreachable, which is what broke `interactive-input-controls`. **Fix:** a per-type config section
  in `WidgetInspector` (`controller-panel-view.jsx`, lite-owned).
- **A widget cannot be re-bound from the app.** `bindToVariable`, `bindToPart` and `bindToPin` are
  called from nowhere in the GUI; the only binding call is `bindToProgram` inside `_addWidget`.
  `WidgetCard` even takes an unused `onBindPart` prop. So removing and re-adding a widget silently
  converts a variable binding into a program binding and only reloading the example restores it.
- **Four faceplate examples ship no `"mode": "play"`**, including `retro-console` and
  `lego-hub-face`, the benches for four Wave 4 lessons. The importer only calls `setMode` when the
  file says so and `ControllerPanel` defaults to `edit`, where every input control is disabled.
  **Blocked on:** one line per example, upstream in `sb3-creator`. Displays are unaffected.

**Closed mid-review, and worth keeping as evidence the ratchets work:** `arduino-03-calibration`
drove no LED — `set pwm led to outputValue` created a variable named `pwm led`, zero PWM writes
under every stimulus. It escaped `test/example-execution.test.mjs`'s `KNOWN_BROKEN` list because it
also drives a D13 status LED and "at least one pin event" was satisfied by that; **that gate hole
is the durable finding here**. The repair landed upstream as `d7325a272` while this review was
being written, taking `KNOWN_BROKEN` from thirteen to zero. Re-measured on that tree: 201 PWM
writes, 0/50/100 percent at the minimum, midpoint and maximum. The unit changed with the fix
(`percent` is 0..100 where the Arduino original is 0..255), so the lesson's predicted values moved
from 0/127/255 to 0/50/100.

Recorded while auditing the same eleven layouts, and outside every Wave 4 lesson:
`6502-terminal/controller.json` declares widget type `terminal`, which is not in
`ControllerPanel`'s `DEFAULTS`, so `addWidget` throws and the importer's bare `catch` leaves the
panel **empty** — it removes the old widgets before adding the new ones. Waves 6 and 7 should check
whether any of their lessons name it.

### Wave 6, where the instrument suite is the finding

Reviewed 2026-08-23 — `docs/LESSON-REVIEW-WAVE-6.md`. **10 lessons, 20 checkpoints, 9 defective,
10 revised (one to content version 3, nine to 2), 11 defects open — every one in an instrument or
an engine, none in a lesson.** The Tier-3 detector found one blocking (`signals-resonance` observes
`circuit-changed` on a bench with no pin declarations — the same app defect Wave 1 recorded for
`starter-circuit-path`); the other eight were found by measuring.

Nine of ten is the highest rate of any wave and it has one cause, not nine. The wave was written
against a signals toolkit that has three of its five pieces. It **has** a genuinely good AC sweep —
log-spaced, magnitude and phase, run on an offline copy of the board — and a scope with a trigger
and time cursors, both wired into the app, and the underlying solver is excellent (43-rc-timing
matches 5(1−e^(−t/τ)) to four decimals; the follower-versus-divider contrast is exact to four
figures). What is missing:

- **The Bode sweep reports no numbers.** `drawBode` writes four strings onto a 260×140 canvas: the
  two dB extremes rounded to whole decibels, and ±180°. No frequency axis, no per-point value, no
  table, no export. `signals-model-measurement` asks for "residuals with propagated uncertainty"
  and `signals-bode-sweep` for "dB/decade in three regions" from that.
- **There is no FFT anywhere in the circuit UI**, and the scope's ring buffer stores an interleaved
  (min, max) envelope rather than a sample series, so a transform bolted on later would still need
  a second tap. `signals-aliasing-fft` asks for "FFT with rectangular and tapered windows".
- **The scope timebase is fixed at 100 kHz × 8192 = 81.92 ms.** Both numbers are hard-coded in
  `addScopeChannel` and `ScopePanel` passes neither, so the record cannot hold `43-rc-timing`'s 1 s
  step or one cycle a decade below `50-rc-scope`'s cutoff (628 ms).
- **A Bode point costs 10/f seconds of simulated time** (`settleCycles` 6 + `measureCycles` 4), and
  the panel runs it synchronously. `pc50-two-stage-rc` corners at 0.159 Hz, so the decade below the
  corner its own lesson asks for is 629 s of simulation per point — measured 7.2 s wall for one
  point at 10 Hz, 57 s at 1 Hz, 84 s at 0.5 Hz. The panel's default range starts at 10 Hz, where
  that network is already at −71.5 dB.
- **The op-amp has no output limit and the meter has no input impedance.** Measured: the follower
  holds 2.5 V into 1 Ω (2.5 A) without drooping; `model/circuit.js` filters `p.kind !== 'meter'`
  out of the netlist before the solve. `signals-loading` asks the learner to find the regime where
  follower limits replace divider error, and to include probe loading.
- **The simulated potentiometer is bit-exact.** Twelve reads of a still knob give ADC count 380
  every time, standard deviation exactly 0. `signals-noise` asks for the standard deviation of raw
  and filtered series at three window sizes.
- **The first solve of a fresh board is a DC operating point**, in which a capacitor is an open
  circuit — so the meter reads 5.0000 V on `43-rc-timing`'s capacitor while the engine's own
  `getCapVoltage` says 0. One nanosecond of simulation fixes it. `signals-rc-response` asks for a
  reading at t = 0.

Two are bench-choice rather than instrument gaps, and both belong upstream in `sb3-creator`:
`pc50-two-stage-rc` would sweep in milliseconds if rescaled from 10 kΩ/100 µF to 10 kΩ/100 nF
(corner 159 Hz), and `pc52-inductor-filter` is used as an *RL* bench by `signals-rl-response` while
being an RLC — the L/R law holds beautifully for its first 300 µs (measured within 1.3 % of
50 mA × (1 − e^(−t/100 µs))) and then the 100 µF takes over, the current turns around at ~500 µs
and settles at 4.5455 mA against the RL asymptote of 50 mA.

Every lesson was revised to work within what exists, and each gap is pinned by an OPEN DEFECT test
that fails when it is closed.

### Wave 7, where the benches are whole computers

Reviewed 2026-08-23 — `docs/LESSON-REVIEW-WAVE-7.md`. **10 lessons, 20 checkpoints, 8 defective,
8 revised (one to content version 3, seven to 2), 8 defects open — five in an example, three in an
instrument, none in a lesson.** The Tier-3 detector found one blocking (`machines-contention`
observes `circuit-changed`, the third wave to meet that same dead observable after Wave 1's
`starter-circuit-path` and Wave 6's `signals-resonance`).

Much of this wave is in good shape and the good parts are load-bearing. The bus extract behind the
designer's **Build Machine** button produces exactly the map two lessons ask the learner to derive —
`MAP RAM $0000-$3FFF`, `MAP ROM $8000-$FFFF`, `CHIP via = W65C22 AT $6000`, plus notes for both
mirrors and for the 4096 open-bus addresses — and refuses the contention bench with
`bus contention at $2000: ram and via are both selected`. The machine benches also need **no
network**: `debug-runner.js` skips the image build for machine-class targets, so Wave 5's defect 0
does not reach them.

**A near-miss worth keeping.** Reading `DebugStatus.jsx` alone says the machine debugger shows a
halt flag, a step button and a millisecond counter, which would make three lessons impossible. They
are not: `ArchitectureFace.jsx` renders A/X/Y/SP/PC, the P flags, both buses, IR, the live
disassembly at PC and the cycle count, and `debug-drawer.jsx` renders paged memory and the stack.
Second time in this campaign that stopping at the first component would have produced a dramatic
wrong finding (Wave 1's flyback spike was the first).

Open, in the order they cost a learner most:

- **Three machine benches boot with an EMPTY ROM.** No example ships a ROM image (`28c256`
  parts carry `params: {}`), `sb3-creator` has no assembler, and the runner skips the build — so
  the runner says "extracted machine booted with an empty ROM — load a program (presets, file, or
  ASM tab)" and the CPU sits on `BRK` at `$0000`. The bundled presets (Tali Forth 2, MS BASIC,
  LCD Hello; Switch Mirror, BBC BASIC) fix it in one click, and no lesson mentioned them.
  **Where it belongs:** either the examples ship a ROM, or the machine lessons name a preset —
  they now name a preset.
- **`20-shift-register-binary` shifts a constant zero.** Measured over 3 s: clock 208 edges,
  latch 26, **data 0**. Isolated to the comparison, not to precedence: with `val = 128`,
  `bitand val 128 > 0` is false, `(bitand val 128) > 0` is also false, and `bitand val 128` alone
  is true. Whether the fault is the emitted comparison or the referee's evaluation was not
  isolated. **Blocked on:** deciding which, upstream in `sb3-creator`.
- **`ttl-clock-module`'s step button is wired to nothing.** Topology, not timing: the net carrying
  `btn1.b` carries only `r3.a`, and `r3` goes to ground; the 555's reset pin is strapped to the
  rail. `EXPECTED.md` still says "The manual step button injects a single pulse when pressed".
  The board also has no downstream state at all — no flip-flop, no counter — while its lesson asks
  the learner to "verify exactly one downstream transition". **Where it belongs:** upstream, and
  the fix is a wire plus a flip-flop, i.e. a real example revision rather than a typo.
- **No cycle-level step, and the scope is ten times too slow for a bus.** The 6502 target steps by
  instruction, step-over and step-out; the circuit-side button advances 50 ms (fifty thousand
  cycles at 1 MHz); the scope samples every 10 µs against a 1 µs bus cycle. `machines-buses` said
  "single-step the clock" and `machines-interrupts-performance` said "use pin edges for external
  timing".
- **The 8051 port mode changes the level a lesson quotes.** `06-active-low-high` measures
  P1.1 high = 4.93 V in push-pull and 2.12 V in the family's default quasi-bidirectional mode,
  where the active-high LED falls to 4 % brightness while the active-low one is unchanged. Now
  taught as the contrast rather than stated as one number.
- **`circuit-changed` still cannot fire on a bench with no pin declarations** — now pinned by three
  waves' gates.

### The Tier-3 detector, and what it changes about the estimate

Built and run 2026-08-23 — `docs/VERIFICATION-AUTOMATION.md` Tier 3, written up in
`docs/LESSON-ACHIEVABILITY-SWEEP.md`. **79 lessons, 180 checkpoints, 47 quoted quantities,
6 defects found, 3 fixed, 3 open.** It is mutation-proven against the two known version-1
defects — the actual lesson objects read out of git history, not synthetic ones — and asserted
not to flag either repair.

Three lessons were repaired from its findings and bumped to content version 2:
`signals-rc-response` asked for a discharge curve on a bench with no discharge path;
`machines-logic-levels` asked the learner to predict "press and release" on a bench with no
input of any kind, whose program declares two output pins; `interactive-extension-discovery`
hung a checkpoint on `starter-loaded`, which only fires for the three first-run journeys and
its example is not one of them.

Three remain open and share one cause: `bw-circuit-changed` is dispatched only when the derived
**pin declarations** move, so on an MCU-less bench no circuit edit can raise it — measured, and
ratcheted in `test/lesson-defect-detector.test.mjs`. It needs a `CircuitDesigner` change in
bw-circuit-ui. The learner is unaided rather than misled, so the lessons keep their intent.

**The estimate this changes, and the one it does not.** The detector understands exactly one
class: a checkpoint demanding a capability its bench does not have. Fed the version-1 forms of
the five defects Wave 1's reading pass found, **it flags none of them** — a wrong component name,
a false conservation equation, two nodes 0.2 mV apart, a condition to verify "while powered" on an
unpowered bench, an instrument reading 43.0 mA where its branch carries 5.8 mA. So the sweep
retires one class across all seven waves and leaves the rest of the debt exactly where it was.
Waves 2–7 still need reading; they now need it for fewer things.

Wave 1 is now reviewed in full — `docs/LESSON-REVIEW-WAVE-1.md`, every verdict backed by a
measurement taken from the engine the browser runs and re-derived on every test run by
`test/lesson-bench-claims.test.mjs` (mutation-proven: breaking a shipped circuit makes it red).
It found **five defective lessons out of twelve**, which is close to the rate the first two
predicted and is the reason waves 2–7 come before any new content:

- `electricity-polarity` asked the learner to identify two LED directions on a bench where both
  LEDs are forward-biased; the reversed part is a diode. Fixed, v2.
- `electricity-series-parallel` told the learner to write `Isource = Ibranch1 + Ibranch2`, which
  is false there by 3.158 mA at every node — all three branches share the supply rail. Fixed, v2.
- `electricity-inductor` asked to compare the signal before and after the inductor at a DC
  operating point where the two nodes are 0.2 mV apart, and never told the learner to make an
  edge. Fixed, v2.
- `electricity-motor-flyback` asked to verify the diode is reverse-biased "while powered" on a
  bench that opens with the switch off and every node at 0 V. Fixed, v2.
- `electricity-transistor-switch` switches correctly, but an ammeter on the transistor's
  collector reads 43.0 mA against 5.8 mA in its own series branch. Copy steered to the load
  resistor, v2; the engine defect is open.

Two defects could not be fixed from the lesson side and stay open, both pinned by tests that
fail when they are fixed: `branchCurrent()` reports a device model's internal quantity rather
than the solved branch current (and a flat zero for `switch`, `button`, `dc_motor`), and
`bw-circuit-changed` fires only on pin-declaration changes, so `starter-circuit-path`'s "change
one thing" checkpoint can never tick itself on an MCU-less bench. A third, found in passing:
`dc_motor` stamps its winding inductance in parallel with the winding resistance, so its DC
operating point depends on the solver's time step and its declared `windingR: 10` behaves as
4.5–5.0 Ω.

One finding is structural rather than per-lesson: ten of Wave 1's twelve lessons hang their
measuring checkpoint on `circuit-ready`, which fires when the example finishes loading. Those
checkpoints tick themselves before the learner has measured anything. Read waves 2–7 knowing
that, rather than rediscovering it seven times.

## Milestone 1 — First useful result

Status: **complete (2026-08-21)**

Create a first-run chooser with three outcome-oriented starter journeys:

1. **Build a circuit** opens a safe circuit-only battery and LED example.
2. **Program a board** opens the Blink program and its matching simulated board.
3. **Control LEGO** opens a LEGO hub project and explains that real hardware is
   optional until the connect step.

Scope:

- Show the chooser once on first use, after the editor is ready.
- Make it dismissible without blocking normal editing.
- Add “Getting started…” to Settings so it is never a one-shot surface.
- Reuse the canonical examples index and existing example loading pipeline.
- Localize the experience in English and German.
- Preserve the existing confirmation before a starter replaces project content.
- Record only local, anonymous journey events unless telemetry is explicitly on.

Acceptance criteria:

- Each card names the outcome, required hardware, and expected time.
- Choosing a journey selects the Circuit tab and loads the matching shipped entry.
- Missing index entries or files produce an actionable visible error.
- Dismissal survives reload; reopening from Settings always works.
- Keyboard focus is trapped sensibly in the dialog, Escape closes it, and all
  controls have accessible names.
- The starter IDs are validated against `examples/index.json` in CI/tests.

Non-goals: a multi-page tutorial engine, accounts, cloud progress, or mandatory
hardware pairing.

## Milestone 2 — Examples become guided lessons

Status: **79-lesson engineering draft complete; reviewed curriculum active**

Extend selected examples with a small, versioned lesson schema: objective,
prerequisites, ordered checkpoints, hints, success conditions, and optional hardware
steps. Render one instruction at a time alongside the live editor; never replace the
editor with documentation.

### Legacy Scratch tutorial decision

Retain the useful interaction idea from Scratch's legacy Cards—small guidance beside
the live workspace, previous/next navigation, and a Tutorials library—but do not use
its deck schema as Brickwright's curriculum format. Legacy decks are JSX containing
static image or hosted-video steps. They have no stable content format, prerequisites,
learner model, language variants, live success checks, progress versioning, circuit or
instrument state, hardware state, or offline guarantee. Brickwright lessons use
versioned JSON and can be adapted into a legacy Card renderer later; Scratch decks can
likewise be imported as `presentation`-only lessons through an adapter.

### Curriculum model

Lessons are organized on independent axes rather than equating age with difficulty:

- **Domain:** computing concepts, circuits, electronic components, instruments,
  control/widgets, extensions and hardware, representation/languages, debugging,
  embedded systems, and computer architecture.
- **Depth:** discover, foundation, practitioner, advanced, research. “Discover” uses
  concrete language and pictures suitable for roughly age 9+, while “research” may
  expect calculus, signal theory, data sheets, and experimental uncertainty.
- **Representation:** Blocks, Brickwright Code, Python, JavaScript, C, BASIC, and ASM.
  A lesson names a canonical semantic task and supplies only the variants it can teach
  honestly. Generated previews are not described as independently editable source.
- **Environment:** simulation, optional hardware, or hardware required. A simulation
  fallback and manual checkpoint are explicit where physical observation cannot be
  detected reliably.
- **Pedagogy:** predict, build, run, observe, explain, change, diagnose, and extend.
  Lessons should ask learners to make and test a claim rather than merely click Next.

The initial curriculum map is:

| Strand | Discover / foundation | Practitioner | Advanced / research |
| --- | --- | --- | --- |
| Circuits | closed paths, polarity, LED + resistor, series/parallel | dividers, RC time constant, transistor/motor drive | impedance, filters, loading, stability, uncertainty |
| Instruments | continuity and voltage | current, sweep, oscilloscope triggering | Bode plots, phase, FFT/noise, probe loading |
| Code | events, sequence, loops, variables | functions, state machines, concurrency, protocols | memory, timing, interrupts, optimization |
| Representations | Blocks ↔ Code correspondence | Python/JS/C variants and conversion limits | ABI, generated C, BASIC and ASM correspondence |
| Debugging | pause, step, watch one value | breakpoints, conditions, call stack, pin trace | instruction trace, buses, races, timing faults |
| Control | buttons, sliders, gauges | two-way widget binding and dashboards | HMI design, sampling, calibration, safety |
| Hardware/extensions | simulated sensors, extension blocks | connect/deploy/reconnect and capabilities | transport protocols, latency, firmware boundaries |
| Machines | MCU pins and peripherals | 6502/Z80 buses and memory maps | contention, decode logic, timing and architecture |

### Lesson schema and runtime

Each lesson has a stable id, schema version, content version, localized title and
objective, domains, depth, age guidance (advisory only), prerequisites, estimated
time, required/optional hardware, an example id, supported language variants, and
ordered checkpoints. A checkpoint includes an action, explanation, hint, observable
condition, and an always-available manual completion label. Conditions use a small
declarative vocabulary (`starter-loaded`, `project-run`, `project-stop`,
`circuit-ready`, `circuit-changed`, `debug-phase`, `hardware-state`)—never arbitrary
code from lesson data.

Progress is stored locally under lesson id plus content version. Updating content can
migrate deliberately or starts a clean attempt; it never mislabels obsolete progress
as complete. The runner shows one checkpoint beside the editor, records automatic or
manual completion distinctly, allows previous/next, reveals hints on demand, can be
closed and resumed, and can reset progress. Automatic observation is assistance, not
assessment: every step remains manually confirmable.

### Exemplary vertical slice

The first implementation proves the architecture with curated lessons spanning:

- a battery–resistor–LED closed-path lesson for discover/foundation learners;
- Blink represented in Blocks, Brickwright Code, Python, JavaScript, and C;
- voltage-divider and RC oscilloscope instrument lessons;
- a controller-widget binding lesson;
- a breakpoint/step/watch debugger lesson;
- an impedance/filter investigation for advanced learners; and
- a 6502 bus-contention diagnosis that can extend toward ASM instruction tracing.

Only the three onboarding lessons are initially launched automatically. The remaining
catalog entries establish validated curriculum breadth and are selectable from the
Lessons library in File or Settings. Content depth then grows strand by
strand; breadth must not be faked with duplicate prose under different level labels.

### Content production waves

Each wave ends with learner testing, technical review, English/German review, and an
example/lesson validation gate. Target counts describe distinct learning experiences,
not translations or language variants counted as extra lessons.

1. **Electricity you can see (12 lessons):** closed paths, polarity, resistance,
   Ohm's law, series/parallel, voltage dividers, buttons, capacitors, inductors,
   diodes, transistor switching, and safe motor/flyback circuits. Provide discover
   and foundation tracks with concrete prediction and observation.
   **Implementation status:** all twelve bilingual lesson sequences are shipped in
   the catalog and validated against real examples; technical and learner field
   review remains before the wave is considered editorially final.
2. **Measure rather than guess (10 lessons):** continuity, voltage, current and
   burden voltage, resistance, multimeter range/error, function generator, scope
   probes, vertical scale, sweep/timebase, triggering, cursors, and RC measurement.
   **Implementation status:** all ten bilingual sequences are in the catalog. The
   scope now supplies the controls they teach—manual vertical scale and position,
   edge/level trigger with explicit wait state, and sample-derived time cursors.
   Technical and learner field review remains before editorial finalization.
3. **One idea, several languages (12 semantic tasks):** sequence, events, loops,
   conditions, variables, procedures, concurrency, state machines, arrays/data,
   messages, pins/peripherals, and protocols. Blocks and Brickwright Code lead;
   Python/JavaScript/C variants explain runtime and conversion differences. BASIC
   and ASM enter where their machine model makes the concept clearer.
   **Implementation status:** all twelve bilingual engineering drafts are in the
   catalog. They compare semantic and runtime contracts rather than surface syntax,
   cover Blocks, Brickwright Code, Python, JavaScript, C, and targeted ASM, and use
   shipped projects to test boundaries, timing, state, data, hardware mapping, and
   interface waveforms. Technical, translation, and learner field review remains.
4. **Interactive systems (8 lessons):** extension discovery, sensor capability,
   LEGO connection/deployment/recovery, buttons/sliders/joysticks, displays/gauges,
   two-way binding, dashboards, calibration, sampling, and control-loop safety.
   **Implementation status:** all eight bilingual engineering drafts are in the
   catalog. They cover capability and failure-state contracts, optional LEGO hardware,
   discrete and continuous controls, honest displays, directed bindings, operational
   dashboard design, calibration, sampling delay, clamping, and fail-safe behavior.
   Hardware, accessibility, translation, and learner field review remains.
5. **Debug with evidence (10 lessons):** reproduce/minimize, pause/step, watches,
   conditional breakpoints, call stack, task scheduling, pins/signals, serial trace,
   timing bugs, and comparing simulation with hardware. Every lesson starts with a
   question the debugger can answer.
   **Implementation status:** all ten bilingual engineering drafts are in the catalog.
   Each starts with an explicit question and collects evidence from the smallest useful
   combination of debugger state, watches, task/call state, pin and serial traces,
   circuit instruments, timestamps, or optional hardware. Target-specific capability,
   translation, and learner field review remains.
6. **Signals and systems (10 lessons):** RC/RL response, impedance, complex models,
   cutoff and phase, Bode sweeps, resonance, loading, noise, aliasing, FFT limits,
   uncertainty, and model-versus-measurement analysis.
   **Implementation status:** all ten bilingual engineering drafts are in the catalog.
   They progress from time-domain RC/RL measurements through complex response, Bode
   sweeps, resonance, loading and noise to sampling/FFT limitations and a reproducible
   competing-model study. Every lesson predicts first and qualifies measurements with
   uncertainty, assumptions, residuals, error, or explicit limits. Technical,
   translation, numerical-method, and learner field review remains.
7. **Computers from wires upward (10 lessons):** logic levels, gates/registers,
   clocks, buses, memory maps, address decoding, 6502/Z80 execution, ASM/source
   correspondence, contention, interrupts, and performance/timing tradeoffs.
   **Implementation status:** all ten bilingual engineering drafts are in the catalog.
   They connect logical meaning to measured voltages, clocked storage and transactions,
   derive memory/decode behavior, cross-check instruction and bus traces, label lossy
   source/ASM boundaries honestly, and finish with safe contention diagnosis and
   measured interrupt tradeoffs. Architecture, electrical, translation, and learner
   field review remains.

Lesson quality rubric:

- The objective names an observable capability, not “understand” or “learn about.”
- Every lesson contains prediction, action, observation, and explanation; advanced
  lessons also require uncertainty, assumptions, or competing models.
- Safety-relevant physical steps state limits and a simulation alternative.
- Every code variant is executed or round-trip tested where supported, and labels
  generated/read-only representations honestly.
- Automatic checks cannot reward an unrelated state; uncertain checks remain manual.
- Hints reveal strategy progressively without giving away the conclusion immediately.
- A nine-year-old track avoids unexplained notation; a research track does not dilute
  rigor merely to share the same example asset.

Acceptance criteria:

- At least one lesson exists for each starter journey.
- Checkpoints can observe circuit state, program/runtime state, and connection state.
- Progress persists locally per lesson version and can be reset.
- Every checkpoint has a manual fallback when automatic detection is unavailable.
- Lesson content and referenced files are validated as part of the examples gate.

## Milestone 3 — Clear product identity and language

Status: **in progress — product copy and bilingual store metadata complete**

Apply one accurate product story everywhere: in-app welcome and About surfaces,
README, App Store/TestFlight metadata, website copy, screenshots, empty states, and
release notes. Explain the relationship to Scratch components precisely without
describing Brickwright Lite as a TurboWarp fork.

Acceptance criteria:

- The first screen explains the app in one sentence and demonstrates all three core
  outcomes visually.
- No active user-facing copy contains the incorrect fork claim.
- App Store screenshots and captions show circuits, code/blocks, debugging, and LEGO.
- English and German core product strings receive the same review.

## Milestone 4 — Trustworthy representation switching

Status: **in progress — representation capability contract visible**

Follow-on: [source/projection ownership and concrete Python reader defects](docs/CODE-RUNTIME-AND-GAME-EXPORT.md#2-what-exists-and-what-the-review-found),
with exact-or-refused conversion and source-mapped diagnostics. The new game
export backend must preserve admitted source semantics through a validated model.

Make the relationship among Blocks, Brickwright Code, Python, and JavaScript visible
and honest. Show the corresponding construct when switching, distinguish editable
source from generated previews, and surface unsupported or lossy constructs before
conversion.

Acceptance criteria:

- Selection/cursor correspondence works for the supported common subset.
- Conversion reports unsupported, changed, and preserved constructs.
- No tab implies round-trip editing if it cannot preserve semantics.
- A round-trip corpus covers starter projects, devices, control flow, variables,
  procedures, events, pins, and supported part bindings.

## Milestone 5 — One run and debug model

Status: planned

Follow-on: [one execution service and runtime evaluation](docs/CODE-RUNTIME-AND-GAME-EXPORT.md#4-code-tab-architecture-and-user-experience),
including explicit source/runtime/target requests, worker-owned input, streaming
output, reliable Stop/Reset and a shared simulation clock.

Unify run, stop, pause, step, speed, breakpoints, watches, pin activity, circuit time,
and hardware state into one coherent model. Complete the compact debugger strip
already tracked in `ROADMAP.md`, then use it consistently across workspaces.

Acceptance criteria:

- One obvious run/stop control governs the active simulated or connected target.
- Source, variables, pins, signals, and circuit time agree at every paused step.
- The UI states why stepping is unavailable or why execution stopped.
- A deterministic integration suite covers pause/resume, x10 stepping, reset,
  device changes, and movement of the debugger between docks.

## Milestone 6 — Faster circuit construction

Status: planned

Reduce friction in the circuit editor: searchable parts, recently used parts,
keyboard placement, alignment/distribution, clearer wire routing, net highlighting,
pin compatibility hints, and fixes for the outstanding layout issues in `ROADMAP.md`.

Acceptance criteria:

- A keyboard-and-mouse user can assemble and run a basic LED circuit in two minutes.
- Invalid power, shorts, open nets, and incompatible pins are explained at the
  component and net involved, with a suggested correction.
- Undo/redo covers every construction action and survives switching panels.
- Representative small, dense, and retro-computer circuits pass visual regression.

## Milestone 7 — Hardware that explains itself

Status: planned

Replace the generic Bluetooth journey with explicit device state: not supported,
permission needed, scanning, found, connecting, connected, incompatible firmware,
busy, disconnected, and simulation fallback. Include capability discovery and a
non-destructive diagnostic export.

Acceptance criteria:

- Supported LEGO families and limitations are visible before scanning.
- Every failure state has a next action and preserves the project.
- Reconnect is predictable after sleep, range loss, and app restart.
- A hardware test matrix covers current supported hubs on current macOS releases.
- Simulation remains usable when hardware is absent or disconnects.

## Milestone 8 — Task-oriented workspaces

Status: planned

Turn the existing flexible pane system into named presets—Learn, Blocks, Code,
Circuit, Debug, and Controller—while keeping custom layouts. Each preset prioritizes
the active task and reduces chrome without hiding state.

Acceptance criteria:

- Presets switch without remounting or losing editor/runtime state.
- Window sizes from compact laptop to large desktop remain usable.
- Pane choices persist per project where appropriate and have a global default.
- Full-screen modes always expose one consistent exit and restore the prior layout.

## Milestone 9 — Project integrity and recovery

Status: planned

Follow-on: [versioned authored source and projections](docs/CODE-RUNTIME-AND-GAME-EXPORT.md#41-authored-source-and-projections),
including runtime/dialect, dependencies, target, revisions and conversion reports.
Generated exports also retain source/asset provenance and backend versions.

Define and enforce a versioned Brickwright project contract containing all authored
representations, circuit/controller data, device choice, assets, and migration
metadata. Add autosave, crash recovery, recent projects, and a readable compatibility
report for old or newer files.

Acceptance criteria:

- Save/reopen round trips every part of each starter and regression project.
- Forced termination loses at most the documented autosave interval.
- Import never silently drops unknown data; export is atomic.
- Migrations are fixture-tested and preserve the original until success.

## Milestone 10 — Release-quality feedback and polish

Status: planned

Add an in-app feedback path that can attach an explicitly reviewed diagnostic bundle,
then close accessibility, localization, performance, packaging, privacy, and store
presentation gaps. Use staged TestFlight cohorts before each production submission.

Acceptance criteria:

- Feedback never includes project source, identifiers, or hardware details without
  a preview and explicit consent.
- Core workflows pass keyboard, screen-reader, contrast, and reduced-motion checks.
- Cold launch, example load, tab switch, and simulation targets have regression
  budgets measured on a baseline Mac.
- Release automation validates version/build numbers, signing, notarization,
  metadata, screenshots, privacy text, and rollback notes.
- External TestFlight feedback is triaged against the milestone success measures.

## Milestone 11 — Measurement depth and interchange

Status: scoped (2026-08-23) — the work items live upstream and land here by vendoring.

Deepen the circuit engine to measurement-grade and open the format surface both ways.
Fully-scoped items: `../../bw-board/ROADMAP.md` (E0–E4: correctness fixes, sparse
solver with factorization reuse, adaptive transient, exponential junctions, true
small-signal AC, model depth, scheduled digital events — mna.js items gated on the
spec-updates filed there) and `../../bw-circuit-ui/ROADMAP.md` (X0–X2: export-path
defect fixes, document export, SPICE-netlist import, breadboard-format and
applet-text interchange, LaTeX schematic export, FFT / tolerance / parameter-stepping
instruments in workers). Lite-side integration items: `ROADMAP.md` §3.5.

Acceptance criteria:

- An exported SPICE deck from any starter circuit runs unmodified in the CI oracle
  simulator and matches the in-app operating point within stated model tolerance.
- The frequency-response view is computed by small-signal analysis and agrees with
  the time-domain measurement on linear fixtures — shown side by side as a lesson.
- A student can save a schematic as SVG/PNG and a scope trace as CSV for a lab
  report without leaving the app.
- A published breadboard-format or applet-text file imports with zero silent drops
  (every unmapped part is named), and our own exports round-trip through our own
  importers with identical net partitions.
- No copyleft code enters the shipped dependency graph; the licence tripwire fails
  the build if it does. Solver upgrades keep the full oracle suite green.

## Release sequence

- **Continuous — Milestone 0.** Not a release band. It gates every other band: a release does not
  ship while a Milestone 0 acceptance criterion is failing, and no content wave starts while its
  predecessor's review debt is open.
- **0.1.x — Find the product:** Milestones 1–3.
- **0.2.x — Trust the model:** Milestones 4–5.
- **0.3.x — Build fluently:** Milestones 6–8.
- **0.4.x — Keep and share work:** Milestones 9–10.
- **0.5.x — Measure and exchange:** Milestone 11 (upstream engine/format campaign;
  individual items may ship earlier when their vendored landings are green).

Version numbers are targets, not promises; readiness gates control shipping. Critical
data-loss, conversion, hardware-safety, accessibility-blocking, or signing defects
stop a release. Cosmetic work does not displace a broken starter journey.

Large local builds also have an operational readiness gate: `npm run build:gui`
checks one-minute load normalized by logical CPU count and exits before webpack when
the system is already saturated. `BW_MAX_LOAD_PER_CPU` can tune the threshold;
`build:gui:force` is reserved for an intentional operator override.

## Current execution log

- [x] Corrected TestFlight/App Store descriptions and release notes for 0.1.4.
- [x] Updated sibling repository inputs and shipped 0.1.4 to external TestFlight.
- [x] Defined this ordered implementation and release plan.
- [x] Implemented Milestone 1: bilingual first-run chooser, three canonical starter
  paths, persistent dismissal, Settings reopen action, local-only event history,
  accessible keyboard behavior, responsive layout, and visible transactional errors.
- [x] Verified Milestone 1 with the production webpack build, the complete repository
  test suite, starter-data validation, and Playwright at desktop and compact sizes.
- [x] Implemented the Milestone 2 vertical slice: versioned bilingual JSON schema,
  nine-lesson cross-domain catalog, prerequisite graph, selectable language concept
  lenses, language/depth/environment metadata, live sidecar runner, local resume/reset,
  hints, observable checkpoints,
  and manual fallbacks.
- [x] Verified the lesson slice with schema/breadth tests, full repository tests,
  production webpack build, component lint, and browser workflows for the library,
  automatic completion, manual persistence, and all starter-to-lesson transitions.
- [x] Produce the full 79-lesson bilingual engineering draft across all seven content
  waves above; editorial finalization remains gated by each wave's explicit reviews.
- [x] Implemented the Wave 1 engineering/content draft: twelve distinct electricity
  lessons, real example mappings, explicit prediction and observation, progressive
  prerequisites, hardware safety boundaries, and searchable level-filtered discovery.
- [ ] Complete Wave 1 technical, translation, and learner field review, then revise
  lesson versions from the evidence gathered.
- [x] Applied the first Wave 1 technical-review revisions. The diode lesson had
  requested alternating input/output traces from a static polarity example; it now
  opens the reversible four-diode bridge and teaches its conducting paths and
  two-forward-drop cost. The capacitor lesson had requested discharge observations
  from a charge-only bench; it now opens the two-switch stored-energy experiment and
  explains its non-ideal LED-threshold tail. Both advance to content version 2 and
  have curriculum/example contract tests. Corrected linked copy that made the same
  nonexistent-waveform claim. Translation and learner field review remain.
- [x] Implemented the Wave 2 engineering/content draft and the previously missing
  oscilloscope controls: V/div, vertical center, rising/falling trigger, trigger
  level/status, dual time cursors, and measured Δt.
- [ ] Complete Wave 2 instrument verification, translation review, and learner field
  testing, then revise controls and lesson versions from observed use.
- [x] Rewrote the canonical English and German App Store/TestFlight descriptions
  for 0.1.5 around circuits, honest representation boundaries, guided lessons,
  evidence-based debugging, native/offline use, and supported LEGO hardware.
- [x] Shipped the signed native macOS 0.1.5 build to the public external TestFlight
  group with bilingual testing notes. App Store Connect build
  `6ab579dc-f98b-4a7c-9927-f3fd21b1e239` is valid and its Beta App Review
  submission is `WAITING_FOR_REVIEW` (2026-08-21).
- [x] Started Wave 3 with four bilingual, cross-representation lessons covering
  sequence, events, boundary conditions, and state machines against shipped projects.
- [x] Completed the Wave 3 engineering/content draft with twelve distinct semantic
  tasks, including loops, variables, procedures, concurrency, arrays/data, messages,
  pins/peripherals, protocols, and targeted ASM-level timing.
- [ ] Complete Wave 3 runtime/round-trip verification, translation review, and learner
  field testing, then revise content versions from the evidence gathered.
- [x] Implemented the Wave 4 engineering/content draft with eight bilingual lessons
  for extensions, sensors, LEGO recovery, controls, displays, bindings, dashboards,
  calibration, sampling, and control-loop safety.
- [ ] Complete Wave 4 hardware/recovery verification, accessibility and translation
  review, and learner field testing, then revise content versions from the evidence.
- [x] Implemented the Wave 5 engineering/content draft with ten bilingual,
  question-led debugging lessons spanning reproduction through aligned
  simulation-versus-hardware diagnosis.
- [ ] Complete Wave 5 target-capability verification, translation review, and learner
  field testing, then revise content versions from the evidence gathered.
- [x] Implemented the Wave 6 engineering/content draft with ten bilingual signals-and-
  systems investigations from first-order response through research-level model
  comparison and sampling limitations.
- [ ] Complete Wave 6 numerical/instrument verification, translation review, and
  learner field testing, then revise content versions from the evidence gathered.
- [x] Implemented the Wave 7 engineering/content draft with ten bilingual lessons
  connecting logic levels, buses, memory, execution, ASM, contention, interrupts,
  and timing to live electrical and debugger evidence.
- [ ] Complete Wave 7 architecture/electrical verification, translation review, and
  learner field testing, then revise content versions from the evidence gathered.
- [x] Started Milestone 4 with an always-visible bilingual capability contract for
  every Code tab: supported-subset editable conversion, generated read-only
  micro:bit/ASM views, and one-way editable ASM are labeled before conversion.
- [x] Added a persistent bilingual conversion report after Code ↔ Blocks operations,
  separating preserved project loading, reported semantic changes, unsupported
  constructs, and complete conversion failure.
- [x] Began the 2026-08-21 regression repair pass: moved guided lessons away from
  the right-pane run controls, restored debugger dock affordances for declared MCU
  programs, made Circuit SIM start authored MCU code, separated the embedded circuit
  toolbar from the green-flag row, repaired light-theme status contrast, and taught
  the voltage-on-wires control in the voltage lesson.
- [x] Added `npm run render:schematic -- --example ID [--format svg|png|both]`
  so the gallery's actual schematic projection can be inspected without manually
  navigating the app; it also writes a machine-readable render report.
- [x] Finished the regression pass with browser proof that the debugger keeps running
  while hidden and across view/dock changes, Blocks + Circuit + Debugger coexist,
  green flag and SIM both start MCU code, schematic fit/pan/zoom work at contrasting
  pane aspect ratios, example titles replace the generic project title, and no
  ResizeObserver error reaches the user.
- [x] Rendered all 246 circuit examples through the new CLI, fixed its omitted-wire
  and false VCC/GND-short defects, bounded pathological single-column layouts
  (worst height reduced from 3,356 to under 1,000 units), and reviewed simple,
  analog, 8-bit-bank, and retro-machine output.
- [x] Re-audited every schematic as a PNG contact-sheet corpus instead of relying
  on spot checks. Dense MCU/retro examples now use conventional repeated net labels
  rather than overlapping full-height trunks; tall packages are placed using their
  connected-pin height and wrapped into columns capped near one viewport. Across
  all 246 examples the largest projection is now 1,290 × 910 units.
- [x] Made the schematic CLI load sidecars and pass each example through the same
  legacy-wire normalization and breadboard strip/jumper resolution as the live
  Circuit Designer. Its PNG/SVG output is now an electrical audit, not merely a
  renderer test that can silently omit board-hole connections.
- [x] Corrected the scope of that audit after a Pico motor example exposed the
  missing dimension: the earlier 246-file pass covered only each example's default
  circuit and checked size/overlap, not whether a wire crossed a foreign symbol or
  whether a terminal met the artwork it named.
- [x] Extended the CLI with `--circuit FILE`, `--all-variants`, and `--check` and
  audited all 1,034 `circuit*.json` files. The report now records direct wires,
  labelled collision fallbacks, wire/symbol crossings, and symbol overlaps; the
  corpus gate fails if either mechanical legibility invariant is non-zero.
- [x] Added terminal-aware anchors for NPN/PNP base, collector, and emitter;
  NMOS/PMOS gate, drain, and source; and potentiometer ends and top wiper. Routes
  that would cross any symbol body now use conventional repeated net labels. The
  1,034-variant gate reports zero remaining wire/symbol crossings and zero symbol
  overlaps, including `10-motor-speed/circuit.pico.json` from the reported defect.
- [x] Added reviewed, byte-stable SVG baselines for representative simple, dense,
  analog, and retro-machine examples, with a test that requires explicit visual
  review before accepting layout drift. Added obstacle-avoiding Manhattan detours
  for two-pin teaching nets: after the corpus repair, 2,126 nets are drawn through
  explicit detours and only 1,379 require collision-label fallback; corpus labels
  fell from 14,842 to 10,269 while all 1,034 variants retain zero wire/symbol
  crossings and zero symbol overlaps. Pin-labelled rectangles for
  MCUs, memories, logic ICs, and modules remain conventional schematic symbols;
  only replace a box where standardized non-box artwork communicates more truth.
- [x] Closed the regression tranche at deployed checkpoint `5e044cf03`: all unit,
  circuit UX, 1,034-variant rendering/placement, view-button, editor, debugger
  dock/serial, Pages deployment, and deployed-GUI gates are green. Right-docking
  now opens the optional pane without remounting or stopping the running target.
- [x] Shipped 0.1.6 to the existing external TestFlight group on 2026-08-21.
  Signed macOS build `38909d58-f93a-4446-abda-06b8ed74454f` is `VALID`, has
  export compliance declared, carries bilingual testing notes covering schematic
  legibility, the voltage overlay, three-pane lessons, dock-preserved execution,
  green-flag/SIM start, and the retro-machine serial workflow, and is
  `WAITING_FOR_REVIEW` in the public group.

## N2e — bounded numeric lists on the 8086 C route (2026-09-08)

This lane moved the Lite pin to upstream `sb3-creator` `8c17dfa898f80a875e2a4bf044144564f8a4cebc`,
whose exact-head and promoted-main CI runs are green. The route admits numeric Scratch lists only under an
explicit fixed-memory contract: signed-16 elements, 32 items per list, at most 15 lists (990 bytes of static
state), checked one-based indices, zero for invalid reads, and no-op invalid delete/insert/replace. Full-list
add/insert traps rather than silently dropping data. Every initial value and value-producing write must pass
the conservative numeric-provenance proof; ambiguous identity or storage refuses the whole C output.

The downstream acceptance executes the emitted C through SmallerC and the 80186 assembler, then runs the
actual `.COM` on the DOS bench. Its visible rows equal an independent JavaScript array model across delete
all, add, insert, replace, delete, item and length. A zero-based-read mutation changes those rows. A silent
dropped-write mutation terminates and prints forbidden length `32`, while the real full-list write remains in
the overflow trap and prints nothing. The ceiling fixture compiles all 15×32 values into a 1,618-byte image,
leaving 63,662 bytes above the load image in the 64 KiB `.COM` segment before stack use.

Reach is unchanged, by measurement rather than expectation. Among 281 upstream programs only
`arduino-03-smoothing` declares/uses a list (delete-all 1, add 1, item 2, replace 1); numeric-list lowering
crosses, but unsupported ADC still refuses the program. The existing numeric-print census remains four
direct emitted programs and broad reach 46. N2e is therefore a semantics prerequisite, not a claimed reach
increase. The ASM route remains deliberately list-free; duplicating production logic merely to construct an
oracle would weaken the evidence.

