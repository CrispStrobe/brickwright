# Target state and actionable lanes — 2026-10-07

This is the current handoff for this target/performance series. Refresh main
and open PRs before implementation and claim a bounded scope under
[LANES.md](../LANES.md). These proposed lanes do not themselves claim ownership.
[TARGET-EMULATOR-PERFORMANCE.md](TARGET-EMULATOR-PERFORMANCE.md) retains historical
source-bound results, not measurements of today's main.

## Current boundary

| Target | Preserved route / proof | Remaining boundary |
| --- | --- | --- |
| Arduboy / ATmega32U4 | Existing avr8js adapter, hosted target smoke 5.561x (receipt below) | Representative-game/full-app latency |
| Blinkenrocket / ATtiny88 | Existing avr8js board callbacks, hosted target smoke 10.227x (receipt below) | No second LabWired ATtiny88 model; not needed for the existing route |
| micro:bit | MakeCode/MicroPython source-level experience; native exact-board selected I/O proofs | CP13 shared IRQ/audio/browser |
| Arcade / PyBadge | PXT source simulator; real keyboard/mouse/touch controls qualified | Native ST7735/DMAC and full CP14 |
| SPIKE Prime | Independent virtual hub; optional build-pinned Renode desktop debugger; newer firmware ledger | Profile-specific packaged qualification/full workload RTx, not universal firmware support |
| EV3 | ARM926/AM1808, CP07–CP12 functional subset and actual packaged four-motor debugger contracts | PRU sensor protocols/full hardware and expanded-workload RTx |

PXT is intentionally wall-paced, not chip-cycle RTx. Historical PyBadge 3.78x
terminal self-branch is not native game proof. F0 synthetic capacity does not
qualify GPIO-heavy firmware or gate PXT usability.

Recent progress:

- [PR625](https://github.com/CrispStrobe/brickwright/pull/625) merged
  `0577e68e3745a20c9ebb60d1f5d4ef04d9ebdb06`: actual upstream Arcade controls,
  six press/release paths, keyboard, changed pixels and stop/restart qualified
  on desktop/mobile. [Isolated run37211432649](https://github.com/CrispStrobe/brickwright/actions/runs/37211432649)
  and [full-app run37211432613](https://github.com/CrispStrobe/brickwright/actions/runs/37211432613)
  passed. Verification observes the original `board.handleKeyEvent` after
  forwarding; it does not inject state or replace the bridge.
- [LabWired PR151](https://github.com/CrispStrobe/labwired-core/pull/151)
  merged native PyBadge GPIO-clocked buttons and shared non-finite-input
  rejection; that engine merge does not silently change Lite's WASM pin.
- [LabWired PR152](https://github.com/CrispStrobe/labwired-core/pull/152)
  merged as `67920fcf8d82c74f3cc63285181fe26db93cf720`. Merged-main
  [Rust Core CI37481145753](https://github.com/CrispStrobe/labwired-core/actions/runs/37481145753)
  passed, but [Core Perf37481145682](https://github.com/CrispStrobe/labwired-core/actions/runs/37481145682)
  measured native PyBadge **0.05x**, batch **1**, against generic ATSAMD51
  **67.97x**, batch **1023.8**. That is the pre-repair baseline.
- Idle-controller repair [LabWired PR159](https://github.com/CrispStrobe/labwired-core/pull/159)
  merged as `ae127c89b9f60ed8a239f82858859c31ef8255af`, tested source
  `547da6da814afd0375199b192db7e3e2416042a0`, with identical review/merge trees
  and all 20 enabled correctness checks passed. Two full native chip-spin runs
  pass all 42 absolute floors; PyBadge medians **61.4713x / 84.1056x**, batch
  **1023.8**. The first run's F411 relative-cost failure is preserved; the full
  repeat and two valid isolated candidate comparisons pass unchanged baselines.
  Read [receipts and open measurement stability work](https://github.com/CrispStrobe/labwired-core/blob/main/docs/receipts/2026-10-07-sam-spi-p0/README.md).
  These runner-specific spin rates are not active display, full-board batching,
  WASM or app-pin adoption. Full-board GPIO still requires interval 1.
  Native pixels, DMAC, split IRQ and dynamic clocks remain separate.
- [LabWired PR161](https://github.com/CrispStrobe/labwired-core/pull/161)
  landed the ST7735 colour/parser/inspection and write-driven reset/backlight
  foundation as `f77110d4646cab67cb12be9a19fc787afe3a650b`, reviewed source
  `90943b8d72957f497d6794913ef43a066b302711`. All 20 enabled checks passed;
  four authored SAM guest tests passed in both feature configurations.
  [Native micro:bit run37605866679](https://github.com/CrispStrobe/labwired-core/actions/runs/37605866679)
  measured five-sample medians **5.6307x** GPIO/display/buttons and **1.1656x**
  motion/display/buttons (motion minimum **1.1487x**). Tested merge checkout
  `4e99e37cd4ded9cb932c333418d5935dc1481477` has the landed main's tree.
  These are selected runner-specific native workloads, not an A/B, PyBadge,
  complete-board, WASM or installed-Lite result. The test-only 2×2 crop is not
  the deployed panel. Read the [qualified foundation and remaining P3 contract](https://github.com/CrispStrobe/labwired-core/blob/main/docs/engineering/st7735-color-foundation.md).
  This engine merge changes no Lite artifact or app capability.
- Lite's current source-bound WASM pin in `scripts/sync-labwired-wasm.mjs`
  remains **`31b6f8aade1af3329cf686438acb31bee204e23d`**, before that SPI merge.
  Do not silently adopt newer source or attribute its features/regression to
  this artifact. [WASM publication37438840274](https://github.com/CrispStrobe/bw-board/actions/runs/37438840274)
  passed builds/determinism and 108 integration tests (zero failures/skips),
  but its motion job was **skipped**: active WASM motion/RAM/GPIO remains owed.
- Lite [target performance37463042960](https://github.com/CrispStrobe/brickwright/actions/runs/37463042960)
  on `23bc15cf4e9f5910f1f7455425b238cccd4c4834` measured Arduboy **5.561x**,
  ATtiny88 **10.227x**, Uno **5.178x**, micro:bit-class WASM **26.818x** and
  PyBadge-class WASM **33.417x**. The WASM rows are terminal post-boot smoke,
  not motion, display, a native game or whole-board proof.
- Newer main includes offline SPIKE Linux packaging and bounded UART/state/
  control routes. Read [desktop packaging](SPIKE-LINUX-DESKTOP.md),
  [native UART](spike-micropython-native-uart.md) and
  [x86 loading scope](X86-LOADING-SCOPE.md); do not recreate PR625-era code.

## A — representative PXT games/circuits (ready)

**Files:** `scripts/verify-makecode.mjs`, `.github/workflows/arcade-controls.yml`,
the host/layout tests from PR625, `docs/ARCADE-COMPAT-PLAN.md`.
Select small permissive programs covering controls, animation/collisions, score
and one supported circuit output. Test actual production browser desktop/touch:
press/release, focus, resize, stop/restart and missing runtime. Assert progressing
program outputs, not just visible controls or host-injected pixels. Keep the
existing observer's forwarding/cleanup and report compiler-network/browser errors.

**Done:** isolated controls and affected full-app checks pass on hosted CI with
program/runtime identities and meaningful negative tests. This is source-level
usability, not physical PyBadge fidelity.

## B — engine-native PyBadge completion (engine-owned; ordered)

**Dependencies/files/acceptance:** follow
[LabWired P1–P5](https://github.com/CrispStrobe/labwired-core/blob/main/docs/engineering/target-next-lanes.md)
and [panel/runtime contract](https://github.com/CrispStrobe/labwired-core/blob/main/docs/boards/pybadge-native.md).
P0's bounded idle-controller repair has landed; preserve its stability follow-up.
P3's codec, parser, inspection, GPIO and bounded authored guest foundation has
landed in PR161; preserve it rather than repeat it. Next order: rectangular
actual-driver stream, deployed build/CF2 evidence, panel aperture/GM and
orientation/presentation qualification (remaining P3); split IRQ routing (P2) and then DMAC/driver
completion (P4) as separate bounded changes; active native guest (P5).
SPI itself has landed; do not redo its merge. Buttons and five NeoPixels already
exist. Prepare permissive app fixtures/debugger observations without duplicating
engine models in Lite. Consumer adoption belongs to C.

**Done:** exact engine artifact has guest-driven pixels/buttons/DMA proof.
CP14 remains TODO until its full advertised scope, remaining audio/QSPI and
explicit USB treatment pass; display alone does not close it.

## C — explicit engine adoption and app proof (blocked on engine qualification)

**Files:** `vendor-pins.json`, derived package/lockfile evidence,
`docs/VENDORING-REGIME.md`, `scripts/bench-board-targets.mjs`,
`.github/workflows/target-performance.yml`, engine integration/browser tests.
Compare installed pins with qualified source/module/glue hashes. Shared bridge
work lands in bw-board first; use explicit pin flow and identity/mirror gates.
Exercise real firmware import, run/pause/step/breakpoint/registers/memory,
input/display/reset and unavailable/wrong-artifact refusal. Retain real same-PC
RAM -> MMIO -> RAM regression proof. Run active distributed-WASM gates and
full-app production browser checks.

**Done:** exact pin and app behavior qualify with unchanged floors. Native
>=1x or a successful WASM build is not this browser throughput proof.

## D — experience-level performance (ready on existing routes)

**Files:** board-target harness, production-browser checks, performance workflow
and source-bound receipts. Use representative Arduboy, ATtiny88, micro:bit and
Arcade programs with rendering/debugger active on a declared modest supported
device. Record startup, frames, input-to-visible latency, audio continuity where
supported, pause/step latency and dropped updates. For CPU backends separately
record active simulated-time RTx; for PXT report pacing/latency, not invented RTx.
Establish baseline attribution before changing an engine hotpath.

**Done:** reproducible receipts distinguish UI/engine cost, pacing/compute and
active/idle load; controlled A/B proves an observed product improvement without
correctness/other-target regressions. Record contention rather than treating
uncontrolled shared-host rates as an engine regression.

## E — micro:bit remaining CP13 I/O/browser (engine then consumer)

Follow [LabWired M1](https://github.com/CrispStrobe/labwired-core/blob/main/docs/engineering/target-next-lanes.md)
for selected LSM303AGR shared P0.25 IRQ, RUNMIC bias/control, timed microphone
and speaker. Bounded SAADC and selected motion already exist; alternate sensor
variants/physical capture are separate. After guest proof, C qualifies the exact
distributed browser and full app.

**Done:** remaining guest-driven I/O, active unchanged RTx and browser/app proof
pass. Native GPIO-only/historical PR receipts must not turn CP13 NEXT into DONE.

## F — EV3 expanded workload and missing sensor protocols (ready to scope)

**Repos:** [runtime](https://github.com/CrispStrobe/renode-spike-prime),
[infrastructure](https://github.com/CrispStrobe/renode-infrastructure-spike-prime),
Lite target debugger/state adapter and board-target harness.
Refresh both heads and runtime infrastructure pin. Preserve CP07–CP12 Timer64,
clocks/pinmux, EDMA/MMC, physical SPI display and ideal motor/raw ADC proofs.
Measure the source-built four-motor/display/ADC guest, not the old ARM926 CPU
loop (historical 1.548x median/1.298x minimum). Retain model/guest hashes and
actual bounded state observations.

Then separately claim PRU software UART for inputs3/4 and GPIO-driven sensor
I2C, using public board definitions and one permissive transaction plus negative
cases per change. NS16550 and EEPROM I2C do not prove these protocols.

**Done:** expanded-workload RTx is actually measured, each added protocol has
guest/debugger positive and negative proof. No private OS/recovery image is
needed; CPU-loop throughput/ideal motors do not mean full EV3 hardware/dynamics.

## G — SPIKE use the newer canonical firmware ledger (existing owner-led work)

Desktop firmware adoption G01 is **claimed** on 2026-10-07 in
[LANES.md](../LANES.md), branch `lane/spike-desktop-adoption-20261007`.
Do not duplicate its packaging, retained-program restart or installed-GUI work.
The target/performance continuation owns no paths in that claim.

Read firmware [next steps](https://github.com/CrispStrobe/brickwright-spike-prime-fw/blob/main/docs/project/next-steps.md),
[capabilities](https://github.com/CrispStrobe/brickwright-spike-prime-fw/blob/main/docs/project/capabilities.md)
and [qualification](https://github.com/CrispStrobe/brickwright-spike-prime-fw/blob/main/docs/project/simulation-qualification.md)
before claiming runtime/infrastructure/firmware work. Do not duplicate its new
capability batch. App lane: qualify the supplied source-built profile through
installed-resource launch, UART cancellation, shared arena input/state and
debugger lifecycle, retaining exact runtime/infrastructure/guest pins.

**Done:** declared profile works in the packaged app, missing profiles fail
clearly and notices/provenance remain intact. Public CI uses redistributable
authored fixtures only: no recovery-image publication, implicit download,
hardware flashing or universal firmware support claim.

## H — CI evidence reconciliation (ready; check for supersession)

**Files:** `scripts/gen-ci-steps.mjs`, census/ledger tests, affected workflows.
PR625 added scoped refresh. A broad refresh then exposed 19 unrelated Tauri
step/job gaps; this is historical, not a current failure count. Compare current
workflow source and authoritative completed runs first. Classify renamed/removed
steps, missing evidence and actual failures; repair only the demonstrated gap.
Scoped refresh must preserve unrelated dates/head SHA and genuine failures.

**Done:** census and workflow contracts agree with current source/runs, without
sentinel disabling, success relabeling or full compiler reruns for prose alone.

## Landing invariants

Claim one bounded scope first, land shared behavior upstream and adopt explicit
pins afterward. Record exact source/artifact/guest hashes, positive/negative
proof and exclusions. Preserve old failures and physical captures; approved
drift acknowledgments do not replace re-capture. Change CP states only when their
whole contracts pass. Component/license review and notices remain required;
simulation tests are not app-store approval or blanket legal clearance.
