# Board targets and emulator performance

Current handoff (2026-10-05): [target state and next lanes](TARGET-NEXT-LANES.md).
Arcade controls and native PyBadge buttons are now qualified/merged; blocking
SAM SPI has passed final engine CI but remains unmerged. Native display/DMA
and CP13/CP14 remain open.
The dated figures below are historical, not new measurements of today's main.

Baseline measured 2026-09-28 from Lite `dec8f2a`, bw-board `7a4b1e1`, and
LabWired `1cf3d3b8`. The exact-board follow-up uses LabWired engine commit
`cdd2f1fa` (merged as `313252d4`) and bw-board `bdffe947` (the exact target
bridge landed at ancestor `47e0cb0b`). RTx means simulated
seconds per wall second; 1.0x is real time. Functional and throughput evidence
remain separate.
The in-process figures below are three-pass medians from the quiet GitHub
Ubuntu 24.04 runner in [run 36404517587](https://github.com/CrispStrobe/brickwright/actions/runs/36404517587).
Run `npm run bench:board-targets` to repeat them; set `LABWIRED_WASM` and
`LABWIRED_CORE` to add the heavy-tier rows.

## What runs now

| Target | Shipped execution path | Measured RTx / status | LabWired | avr8js | Renode |
|---|---|---:|---|---|---|
| Arduboy / ATmega32U4 | avr8js, including the real Brickwright adapter | **3.93x** | no 32U4 model | **yes** | no AVR CPU |
| Blinkenrocket / ATtiny88 | avr8js, including board callbacks | **7.09x** | no ATtiny88 model | **yes** | no AVR CPU |
| Arduino Uno | avr8js; optional LabWired comparison | **3.38x** adapter | yes, ATmega328P | **yes** | no AVR CPU |
| micro:bit v2 | MicroPython WASM for `.py`; MakeCode source is translated; ELF/HEX/UF2 can use the exact-board debugger | **3.32x optimized post-boot smoke median**; native active matrix/button guest **2.376x median, 2.272x minimum**. Predecessor main motion **0.890x / 0.887x FAILED**. Landed discovery/pull-mask candidate controlled EPYC 7763 medians **1.037x / 1.023x PASS**, versus predecessor **0.880x / 0.883x**; exact successor-main `ede33fb4` motion **1.290x median / 1.261x minimum PASS**, all five samples above 1x on EPYC 9V74. Proper ADC scan guest qualified/landed; countdown landed `8736e1ff`; historical isolated A/B **+7.79%**. Qualified combined GPIO candidate motion **1.396x / 1.369x**, controlled A/B **+8.396746%**, all ten candidate windows >=1x, all 40 RTx and strict relative-cost gates pass; fresh EPYC 7763 rebase motion **1.116x / 1.051x**, all five >=1x, fresh A/B PASS. GPIO PR137 landed `5fb3d7d4`, final-head native **1.127x / 1.117x** and full Core CI/A/B PASS; exact post-merge main measurement pending. Historical Nordic issue not declared closed here. Historical shared VPS under load **0.337x**, variable; browser active-I/O qualification pending | **yes, exact nRF52833 CPU/flash/GPIO/UART path**; native matrix/buttons, bounded analog routing, real ARM ADC scan and selected motion qualified upstream, not app-shipped; timed microphone/audio/browser qualification pending | no | no exact target |
| MakeCode Arcade | PXT's source-level simulator | intentionally wall-paced | depends on selected Arcade board | no | depends on selected Arcade board |
| PyBadge / ATSAMD51J19 | PXT Arcade source-level simulator with qualified keyboard/mouse/touch controls; ELF/HEX/UF2 can use the exact-board debugger | **3.78x optimized post-boot smoke median**; earlier tight-loop ceiling 1.76x; neither is native game proof | **yes, exact ATSAMD51J19A CPU/flash/GPIO/Feather UART path**; upstream GPIO buttons merged; blocking SPI verified/unmerged; native display/DMA/audio/QSPI/USB incomplete, app adoption separate | no | no exact target |
| SPIKE Prime | Independent virtual-hub model; optional build-pinned native Renode debugger on desktop | exact Renode F413 hosted CPU instruction loop **2.182x median, 1.962x minimum**; UI selects 1x | no exact F413 board | no | **exact STM32F413VG platform, guarded CPU-loop RTx, and Lite semantic debugger adapter qualified** |
| EV3 | MakeCode source simulator where source is present; real-brick transport; optional build-pinned native Renode debugger on desktop | **1.548x median, 1.298x minimum** on a hosted ARM926 CPU instruction loop; full motor/peripheral workload RTx pending | no ARM9/AM1808 | no | **exact AM1808 foundation and Lite semantic debugger adapter qualified**: 300 MHz ARM926, high-vector SRAM, UART1, AINTC, GDB, GPIO/SPI display, raw ADC and ideal motor state; not yet full EV3 hardware |

The 2026-09-28 hosted core receipt remains the less noisy comparison for the
already integrated CPU engines: Z80 186x, 6502 150x, avr8js ATmega328P 13.3x,
8051 5.23x, RP2040 1.66x, and LabWired STM32F0 24.2x. The lower AVR values in
this document are intentional: they include timers, peripherals, debug-event
instrumentation, time conversion, and board callbacks rather than timing only
the instruction decoder.

The same target harness on the shared four-vCPU host ranged widely. Its first
usable pass put Arduboy at 1.55x; while unrelated browser/OCR/test jobs pushed
load average to 19.5 it fell to 0.50x. That is oversubscription, not an engine
regression, and is why release RTx gates run on an isolated hosted runner.
The removed Renode F411/F412 proxy figures were useful capability estimates,
but they are not measurements of Prime's F413 platform and are no longer used
as target claims. The exact F413 qualification now retires 96 million active
guest instructions in each of five hosted passes and retains both the JSON
receipt and UART proof in [run 36440006278](https://github.com/CrispStrobe/renode-spike-prime/actions/runs/36440006278).

The latest hosted repeat in [run 36669748932](https://github.com/CrispStrobe/renode-spike-prime/actions/runs/36669748932)
retains five-pass receipts with EV3 CPU-loop median 1.5484670176475972x
(minimum 1.2983640612844323x) and SPIKE Prime median 2.1824530772716755x
(minimum 1.961938395139389x). These benchmarks retire active CPU instructions;
they do not measure a complete motor, sensor or display workload.

“Intentionally wall-paced” is not a failed benchmark. Those engines model an
API and animation timeline, not chip cycles, and their browser loop sleeps to
keep one simulated second equal to one user-visible second. A CPU RTx number
would be invented. The virtual SPIKE model uses deterministic simulated time
and optional real-time pacing; old firmware-runtime throughput is retired.

The exact Cortex-M receipt is
[`2026-09-28-labwired-cortex-m-self-branch.json`](receipts/2026-09-28-labwired-cortex-m-self-branch.json).
It builds the released Node WASM on a Kaggle worker, applies the same
`recommended_tick_interval()` contract as the bw-board adapter, boots the
public micro:bit v2 and ATSAMD51 smoke ELFs until each prints `OK`, then measures
their terminal `b .` steady state. It is evidence for post-boot real-time
capacity, not for the still-unimplemented display, sensor, QSPI, USB or audio
devices.

The complete packaged SPIKE debugger contract also passed locally against the
exact Renode `06d86c51` source tree and the source-built public workload: all
ten operations (start, registers, memory, breakpoint set/clear, step, run,
pause, state, reset and close) completed in 29.91 seconds. That first real
package run exposed and fixed the cold-start timeout, Renode path-token, initial
GDB stop-frame, asynchronous stop-frame and Cortex-M xPSR assumptions in
Brickwright Lite PR 497. The independent hosted reproduction is isolated in
[run 36472620755](https://github.com/CrispStrobe/brickwright/actions/runs/36472620755);
it was still waiting for GitHub runner capacity when this checkpoint was
recorded, rather than being treated as a passing receipt.

The equivalent packaged EV3 contract passed locally against the same exact
Renode `06d86c51` tree and the public, source-built MIT smoke firmware: 1/1 in
21.29 seconds. Its UART receipt is emitted only after the ARM926 payload has
acknowledged AM1808 AINTC IRQ 53, so the state assertion cannot pass on boot or
idle output alone. The immutable post-merge hosted reproduction is isolated in
[run 36476481543](https://github.com/CrispStrobe/brickwright/actions/runs/36476481543);
it was queued for GitHub runner capacity when CP06 was closed and is likewise
not represented as a passing result.

The DA8xx Timer64 checkpoint is a separate hardware proof. Five focused NUnit
tests cover the TI-documented reset and writable masks, coherent 64-bit reads,
one-shot stop behavior, W1C status independent of interrupt masking, reset
gating, and the physical Timer64P0-to-AINTC route. The MIT ARM926 payload then
programs Timer64P0 at `0x01c20000`; only its IRQ handler emits
`EV3 TIMER64 IRQ`, after exact AINTC event 21 arrives. Both that payload and the
prior EV3 smoke passed against the source-built Release tree locally. The
post-merge hosted reproduction is [run 36479706220](https://github.com/CrispStrobe/renode-spike-prime/actions/runs/36479706220),
which was queued rather than represented as passing when CP07 was closed.

The clock, power and pinmux checkpoint models the next public handoff boundary
without distributing or pretending to execute the EV3 boot ROM or EEPROM
loader. Fourteen focused NUnit tests cover both DA8xx PSCs, both PLLCs and
SYSCFG0, including cold reset, domain isolation, DIV1/DIV2 change tracking,
GO completion, action-only CFGCHIP4 and the documented revision-2.2 behavior
where KICK writes do not lock pinmux. The board preset contains only the
publicly established post-EEPROM values; in particular, it does not invent an
EV3 PLL1 frequency. An independently authored 684-byte MIT ARM926 payload
mutates and restores PLL DIV2, PSC0 module 6, PINMUX, SUSPSRC and CFGCHIP, then
emits `EV3 PSC PLL PINMUX OK`. The full source build and that exact UART proof
passed locally. The post-merge hosted reproduction is
[run 36483611342](https://github.com/CrispStrobe/renode-spike-prime/actions/runs/36483611342),
which was queued rather than represented as passing when CP08 was closed.

The EDMA checkpoint adds the exact AM1808 EDMA0/EDMA1 CC and transfer-controller
topology, including all six completion/error routes into AINTC. Thirteen
focused NUnit tests cover DRAE and shadow-region gating, six-event A-sync,
AB-sync with signed indexes, STATIC and both link encodings, fixed 32-bit FIFO
accesses, event and interrupt W1C behavior, null versus dummy PaRAM sets, and
TC-owned bus errors. The exact-pin all-translator and managed Release build
completed with zero errors. Two independently authored 636-byte MIT ARM926
images then proved both paths: software channel 0 emitted `EV3 EDMA IRQ`, and
a request injected on the public MMC0 RX line 16 before CPU start was latched
while disabled, drained on EESR, and emitted `EV3 EDMA HW16 IRQ`. The latter is
request-line coverage, not a claim of MMC controller integration. Transfers
are functional and immediate; QDMA execution, arbitration and cycle timing
remain explicit exclusions. The post-merge hosted reproduction is
[run 36489661477](https://github.com/CrispStrobe/renode-spike-prime/actions/runs/36489661477),
which was queued rather than represented as passing when CP09 was closed.

The MMC/SD checkpoint replaces that injected-request boundary with a real
AM1808 MMC/SD0 controller at `0x01c40000`. A native-mode CMD8 fix first passed
4/4 focused tests and the complete peripheral suite (199 passed, 5 skipped).
Nine controller tests then cover reset and mask behavior, no-card response
semantics, TI short/long response ordering, CMD17/CMD18 and fixed-length data,
32/64-byte DMA thresholds, reset cancellation, rejected-write non-mutation,
and a real 512-byte EDMA channel-16 transfer with completion IRQ. The exact-pin
all-translator and managed Release build completed with zero errors. Two
independently authored MIT ARM926 payloads read the generated, nonpersistent
1 MiB SDSC image and emitted exactly `EV3 MMC PIO READ OK` and
`EV3 MMC EDMA READ OK`; the image remained byte-identical at SHA-256
`8e8b458d4c0b8ee96c726f78962fd63fb109f78b1dc073da15a8fc53df28c637`.
MMC/SD1 remains absent because EV3 does not enable it, and card writes/TX DMA,
cycle timing and Linux boot remain explicit exclusions. The post-merge hosted
reproduction is [run 36494374026](https://github.com/CrispStrobe/renode-spike-prime/actions/runs/36494374026),
which was queued when CP10 was closed and subsequently completed successfully.

CP11 adds the AM1808 144-pin GPIO controller, nine bank interrupts, all six
EV3 buttons and four status LED channels, and the actual SPI1/ST7586 display
path. Review corrected SPI interrupt masks/vector/read-clear behavior, reset
values, narrow writes and two-stage receive buffering. GPIO now supports
native byte/halfword accesses so GDB can read its registers while narrow
SET/CLR/W1C writes preserve unrelated bits. The exact merged-pin Release
solution build passed with zero errors; all 135 focused STM32/AM1808 tests
and four GDB-protocol regression tests passed.

Both original MIT ARM926 payloads passed on the full board:
`EV3 GPIO BUTTON LED OK` and `EV3 SPI DISPLAY IRQ OK`. Actual monitor reads
observed pixel (0,0) black, pixel (1,0) white, and visible-frame FNV-1a
`0xd1ab8c3a`. The real GDB server independently exposed GPIO direction,
LED output, button input, cleared IRQ status and SPI configuration. All
seven prior EV3 UART paths also passed, including non-mutating MMC reads.
The [post-merge hosted run](https://github.com/CrispStrobe/renode-spike-prime/actions/runs/36644899583)
subsequently passed. The panel is observable through Renode's video/debugger
interface and CP12's live neutral state feed into Lite. SPI wire timing, slave/multibuffer
modes, hardware chip-select and EDMA requests remain explicit exclusions
of this display-oriented functional slice.

## Circuit audit

The private repo contains 314 project-example directories. Every Lite
worktree on this VPS has exactly the same directory-name set as remote main,
and none has modified or untracked example files. The other apparent corpus is
the 49 JSON circuits in `bw-circuit-ui/gallery`; Lite already consumes that
gallery at pinned commit `1510d38`, and its gallery is byte-unchanged through
current upstream `6d6a464`. Copying those JSON files into Scratch project
examples would duplicate a different format, not integrate missing circuits.

The remaining `.hex` files found outside those repos are FPGA/toolchain test
firmware under `apicula/examples`; they are not Brickwright circuits. There
was therefore no orphan circuit to import from this VPS.

## Ordered target checkpoints

This table is the execution order, not a wish list. Work starts on the first
`NEXT` row. A checkpoint becomes `DONE` only when its definition of done is
met and the evidence column names an immutable commit, PR or hosted run. Later
rows must not be marked complete while an earlier row remains open.

| ID | State | Checkpoint | Definition of done | Evidence |
|---|---|---|---|---|
| CP01 | DONE | Reconcile the target ledger | Every currently claimed target has an exact engine, workload and non-idle result; stale EV3 VPS and F412-proxy claims are removed. | Renode [run 36437429134](https://github.com/CrispStrobe/renode-spike-prime/actions/runs/36437429134), docs `7a5d4173`; LabWired `bdffe947` |
| CP02 | DONE | Enforce ordered evidence | A repository test rejects fewer than ten checkpoints, malformed IDs/states, completion without immutable evidence, and any completed row after the first open row. | Brickwright Lite [PR 472](https://github.com/CrispStrobe/brickwright/pull/472) |
| CP03 | DONE | Qualify exact SPIKE Prime RTx | The STM32F413VG platform runs a source-built public firmware workload; five non-idle passes report exact instruction deltas, median/minimum RTx, UART/brick-state proof, and median plus minimum are at least 1.0x. | Renode [PR 7](https://github.com/CrispStrobe/renode-spike-prime/pull/7), [run 36440006278](https://github.com/CrispStrobe/renode-spike-prime/actions/runs/36440006278), merge `06d86c51` |
| CP04 | DONE | Supervise Renode as an optional native backend | The desktop Tauri host owns a build-pinned Renode executable without a shell, reserves a random loopback port and token, enforces time/output limits, and always kills the process tree through the shared reset, project-close and app-exit teardown path. The raw supervisor is deliberately not exposed as a Tauri command; CP05 attaches the isolated semantic broker and debugger adapter. | Brickwright Lite [PR 476](https://github.com/CrispStrobe/brickwright/pull/476), merge `1fc5a602`; 112 Rust library tests passed locally |
| CP05 | DONE | Connect SPIKE Prime to Lite | The debugger can load the public simulation firmware, run/pause/reset/step, inspect registers and memory, set a breakpoint, and receive bounded `brick-state/v1` updates through CP04. | Brickwright Lite [PR 487](https://github.com/CrispStrobe/brickwright/pull/487), [PR 488](https://github.com/CrispStrobe/brickwright/pull/488), [PR 493](https://github.com/CrispStrobe/brickwright/pull/493), [PR 497](https://github.com/CrispStrobe/brickwright/pull/497), merge `46380dba`; exact packaged test 1/1 locally |
| CP06 | DONE | Connect EV3 to Lite | The same debugger contract operates the source-built EV3 smoke image through Renode/GDB, including UART and AINTC IRQ evidence, without private recovery firmware. | Brickwright Lite [PR 504](https://github.com/CrispStrobe/brickwright/pull/504), merge `cb2e03ee`; exact packaged test 1/1 locally |
| CP07 | DONE | Model DA8xx Timer64 | Exact documented register behavior and IRQ routing are covered by unit tests and exercised by a source-built ARM926 payload. | Infrastructure [PR 3](https://github.com/CrispStrobe/renode-infrastructure-spike-prime/pull/3), merge `7feaab14`; Renode [PR 8](https://github.com/CrispStrobe/renode-spike-prime/pull/8), merge `bbaf76d4`; 5/5 model tests and executable IRQ proof passed locally |
| CP08 | DONE | Model EV3 boot clocks and pinmux | PSC, PLL and pinmux behavior required by the public DA850/EV3 boot path is modeled with mutation-sensitive tests. | Infrastructure [PR 4](https://github.com/CrispStrobe/renode-infrastructure-spike-prime/pull/4), merge `ad68f7601`; Renode [PR 9](https://github.com/CrispStrobe/renode-spike-prime/pull/9), merge `07a1bd6d`; 14/14 model tests, full Release build and exact executable UART proof passed locally |
| CP09 | DONE | Model AM1808 EDMA | The required EDMA channels, completion/error interrupts and memory transfers pass peripheral and executable payload tests. | Infrastructure [PR 5](https://github.com/CrispStrobe/renode-infrastructure-spike-prime/pull/5), merge `ecf4d0ac`; Renode [PR 10](https://github.com/CrispStrobe/renode-spike-prime/pull/10), merge `546300f7`; 13/13 model tests, exact-pin full Release build and both executable IRQ paths passed locally |
| CP10 | DONE | Model MMC/SD boot storage | A redistributable test image is read through the modeled AM1808 MMC/SD path with bounded media input and deterministic block receipts. | Infrastructure [PR 6](https://github.com/CrispStrobe/renode-infrastructure-spike-prime/pull/6), merge `0c92bedf`; Infrastructure [PR 7](https://github.com/CrispStrobe/renode-infrastructure-spike-prime/pull/7), merge `94ec6e91`; Renode [PR 11](https://github.com/CrispStrobe/renode-spike-prime/pull/11), merge `0b5d9cc3`; 9/9 model tests, exact-pin full Release build, both executable read paths and media non-mutation passed locally |
| CP11 | DONE | Model EV3 GPIO and SPI display | GPIO direction/edge IRQs and the physical 178x128 monochrome SPI1 display path (CS GPIO44, A0 GPIO43, reset GPIO80) are observable in tests and through the debugger; the disabled AM1808 LCDC is not misrepresented as the EV3 display. | Infrastructure [PR 8](https://github.com/CrispStrobe/renode-infrastructure-spike-prime/pull/8), [PR 9](https://github.com/CrispStrobe/renode-infrastructure-spike-prime/pull/9), [PR 10](https://github.com/CrispStrobe/renode-infrastructure-spike-prime/pull/10), merge `f3f7a7ec`; Renode [PR 12](https://github.com/CrispStrobe/renode-spike-prime/pull/12), merge `1484844e`; 135/135 model tests, full Release build, actual GPIO/display UARTs, pixels/checksum and GDB reads passed locally |
| CP12 | DONE | Model EV3 motors and sensors | Permissive front ends cover raw ten-bit analog channels and ideal PWM/bridge/quadrature motors and publish actual model output through the neutral brick-state contract. | Infrastructure [PR 11](https://github.com/CrispStrobe/renode-infrastructure-spike-prime/pull/11), [PR 12](https://github.com/CrispStrobe/renode-infrastructure-spike-prime/pull/12), merge `f864d7ce`; Renode [PR 13](https://github.com/CrispStrobe/renode-spike-prime/pull/13), merge `e0e38e7a`; 89/89 model tests, ADC injections, four-motor guest IRQ phases, full Release build and live model feed passed [hosted](https://github.com/CrispStrobe/renode-spike-prime/actions/runs/36669748932); both actual Lite packaged debugger contracts passed [hosted](https://github.com/CrispStrobe/brickwright/actions/runs/36671631679), merge `b71ee87e` |
| CP13 | NEXT | Complete micro:bit v2 board I/O | The LabWired target drives the 5x5 display, buttons and selected sensor/audio paths with board-level tests while retaining >=1.0x hosted RTx. | pending |
| CP14 | TODO | Complete PyBadge board I/O | ST7735, button mux, NeoPixels, audio and QSPI are exercised by public firmware and debugger-visible tests; USB is either implemented or explicitly isolated, while hosted RTx remains >=1.0x. | pending |

CP07–CP12 are intentionally ordered by the public EV3 boot path. PRU support is
not promoted ahead of those dependencies. PXT/MicroPython remain the complete
source-level experiences while CP13 and CP14 are partial.

### User-facing priorities: PXT first, firmware completeness next

PXT Arcade is the primary source-level game experience for PyBadge. It models
game APIs and wall-paced interaction, not ATSAMD51 instruction cycles; do not
assign it a CPU RTx or use the 3.78x terminal self-branch receipt as game proof.
STM32F030 also has a shipped light-tier emulator; optional LabWired F0 benchmark
floors are not a prerequisite for that route or for PXT micro:bit/Arcade use.

The immediate order for PyBadge work is:

1. Make PXT games usable with keyboard and on-screen controls; verify real
   program output and press/release through the running simulator. Then cover
   representative games, stop/restart, and supported circuit I/O. Do not infer
   PyBadge ST7735 or physical GPIO fidelity from source-level API simulation.
2. For actual firmware, implement and prove the ST7735 display and button mux
   first, then NeoPixels/audio and QSPI; USB remains explicitly incomplete
   until independently exercised. Use permissive source-built active guests
   and actual model/debugger observations, not terminal idle loops.
3. Measure those working experiences on a modest supported device with the UI
   and debugger active. Optimize only demonstrated latency, audio, rendering
   or firmware-throughput bottlenecks; retain existing correctness/RTx gates.

This priority does not close or reorder the CP13/CP14 engine checkpoints,
promote a WASM pin, or claim new browser performance. The Arcade page now
exposes its existing upstream controls with a bounded responsive layout;
`scripts/verify-makecode.mjs` checks actual PXT button press/release in hosted
production-browser acceptance. Source-only layout tests are not that proof.

CP13 remains in progress. Its first native slice landed in
[LabWired PR 126](https://github.com/CrispStrobe/labwired-core/pull/126), merge
`8bd67fe8`, with runtime source `87553ec2` qualified by
[hosted run 36674476161](https://github.com/CrispStrobe/labwired-core/actions/runs/36674476161).
The existing micro:bit v2 matrix and active-low buttons are exercised by an
original MIT guest scanning all five rows, verifying all 25 samples of a
diagonal frame and reading both buttons. Corrected real GPIO P1 addresses and
GPIOTE latch delivery through the scheduler are included. That first run passed
100 functional tests (12 integration plus 88 shared-library), four Python tests
and the explicit active-throughput benchmark. Five samples at 64 MHz measured
median 2.51244807473315x, minimum 2.510862493318595x and maximum
2.622815650932696x; all five exceeded 1.0x. The source-built guest SHA-256 is
`c570d6af4748e0788069a09362af904e974780c4509c754980cb6b8e64b14839`.

A second [hosted run](https://github.com/CrispStrobe/labwired-core/actions/runs/36675423739)
at `24719d90` also passed: median 2.812974211x, minimum 2.743114803x and maximum
3.155284579x. Its intervening changes were documentation only; this variation
is not an optimization result. The same executable source passed local guest
functional checks, but the shared VPS under concurrent build load measured
five 4-million-cycle samples at median 0.33661187736571163x, minimum
0.23030896234724468x and maximum 0.43397617680486633x. The
[complete VPS receipt](receipts/2026-09-30-microbit-active-vps.json) retains
every raw sample, display/button observations and source/ELF hashes, and records
`realtimeTargetMet: false`. CPU availability and contention were not isolated.
A repeat of the same binary without optimization or host isolation produced
median 1.567935483544028x, minimum 0.24086111370502475x and maximum
1.7200998956958944x. End-to-end GNU time reported 1.98 seconds elapsed,
0.31 seconds user CPU and 0.06 seconds system CPU (19% CPU), including guest
compilation, warmup and measurements. These uncontrolled VPS runs do not
establish stable >=1.0x performance there; the hosted result is not a universal
host guarantee.

The bounded SAADC/DMA follow-up landed in
[PR 127](https://github.com/CrispStrobe/labwired-core/pull/127), merge `29aeb1c6`,
with runtime source `38d0102f` qualified by
[hosted run 36676944828](https://github.com/CrispStrobe/labwired-core/actions/runs/36676944828).
It covers bounded analog inputs, gain/reference/differential conversion, DMA
and IRQ behavior, plus channel routing tested through the native WASM adapter.
The run passed 120 core tests (including 20 SAADC tests), three native WASM
routing tests, four Python tests and the explicit benchmark. The longer harness
warms up for 8 million cycles and measures five 64-million-cycle passes at
64 MHz: median 2.3764220999983445x, minimum 2.272225792494869x and maximum
2.606048763227372x; all five exceeded 1.0x. Its source-built guest SHA-256 is
`23f026e646677e642ab70e2f99f34724a8949d88ce878e9e9164e9ff883636bd`.
The earlier short-window results remain provenance, not comparable optimization
A/B measurements against this longer receipt.

The performance workload still exercises GPIO/matrix/buttons, not active ADC
sampling. Bounded analog support does not qualify continuous microphone/audio
or the full browser. The later ADC scan follow-up below supplies the actual
ARM guest and documented START versus per-SAMPLE buffer appends; remaining
work includes RUNMIC control/bias, timed microphone/audio, shared sensor IRQ
and browser-WASM/full Lite application qualification. The earlier 3.32x terminal
self-branch receipt does not close this checkpoint, and CP13 remains NEXT.

### CP13 selected motion-sensor slice: native hosted-qualified, landed upstream

[LabWired PR 129](https://github.com/CrispStrobe/labwired-core/pull/129), merged
as `ce60a49941f9fa94d83aca6859bc27ae1c5b9e0b`, adds the selected
LSM303AGR-equipped micro:bit v2 variant, not the alternative FXOS8700 board.
An original MIT model attaches separate accelerometer/magnetometer components
on internal TWIM0 at 7-bit addresses `0x19` / `0x1e`. An original MIT ARM guest
polls both sensors through EasyDMA while scanning all five matrix rows and
reading buttons. Held physical input poses alternate; guest results verify
the signed accelerometer/magnetometer conversions, complete diagonal frame,
button mask, progressing sample/scan counts, and exact DMA amounts.

The first [hosted motion run 36683869753](https://github.com/CrispStrobe/labwired-core/actions/runs/36683869753)
passed its functional checks but **failed the >=1.0x performance gate**. Five
64-million-cycle samples at 64 MHz measured median **0.3269082176558117x** and
minimum **0.32213465036135147x**. The
[complete failed-speed baseline receipt](receipts/2026-09-30-microbit-motion-hosted-baseline.json)
preserves raw observations, firmware hash, framed source-bundle hash and
compiler flags, and records `realtimeTargetMet: false`. GPIO/matrix/buttons
alone in that same hosted job measured **2.340300x median**; it is a distinct
workload, not evidence that sensor polling meets real time. The previously
landed **2.376x** GPIO-only receipt remains separate qualified history.

A Cortex-M fast-block structural-admission/barrier optimization at runtime
source `e32b4a35` passed the replacement
[hosted run 36687935898](https://github.com/CrispStrobe/labwired-core/actions/runs/36687935898):
motion median **1.7582140503340078x**, minimum **1.7339540271462885x**, all five
samples above 1.0x. The separately measured GPIO-only guest reached
**5.531283760017577x median** in the same job. Recorded receipt commit
`199af713794f9b2135f931bced3835203882bd76` is GitHub's tested PR merge-ref;
PR head `3c831043` changes only documentation after the runtime source. This is
**hosted-qualified and landed upstream**. The subsequent documentation-only
PR head `d05043dd` did not change runtime source `e32b4a35`; no later
lazy-construction candidate is included in that qualification. The
[full hosted motion receipt](receipts/2026-09-30-microbit-motion-hosted-optimized.json)
preserves the tested merge-ref and PR-head/runtime provenance, rather than
relabeling measurements as a post-merge run.

The subsequent exact-main
[run 36690708740](https://github.com/CrispStrobe/labwired-core/actions/runs/36690708740)
at `ce60a49941f9fa94d83aca6859bc27ae1c5b9e0b` **passed** native board/model,
eight CPU regression tests, input-routing, and RTx gates. The motion workload
measured **1.0306447307567719x median**, **1.0270104540205454x minimum**,
with all five samples above 1.0x. GPIO-only measured **3.355509706840291x
median** in that same job. The full
[exact-main motion receipt](receipts/2026-09-30-microbit-motion-hosted-main.json)
and [GPIO-only receipt](receipts/2026-09-30-microbit-active-hosted-main.json)
retain original hashes and observations. Motion guest source bundle
`e6b8c239dc7ee1aca736671350cda8101f4bf8d6c89d91e2a9e787c85b553939`
and runtime code are unchanged from the earlier PR-qualified run. These
different runner observations are not a runtime code regression or controlled
A/B speedup. That exact-main margin is thin; it does not establish stable real-time
performance on arbitrary hosts or a browser/full Lite application. This
success is the scoped native qualification lane, not a claim that every broad
repository CI job or target is green.

A second optimization, lazy successful-candidate construction, landed through
[LabWired PR 131](https://github.com/CrispStrobe/labwired-core/pull/131) as
`3456c048894f194bbabc9c414932a752d89da999`. The
[qualified PR run 36691941435](https://github.com/CrispStrobe/labwired-core/actions/runs/36691941435)
passed full functional/model/DMA, 11 CPU regression tests, native WASM input
routing, and real-time gates. Motion median was **1.1265547370697286x**,
minimum **1.1230014365962186x**; all five samples exceeded 1.0x. The separate
GPIO-only workload measured **3.7836838863482463x median**. Both
[full motion](receipts/2026-09-30-microbit-motion-hosted-lazy.json) and
[GPIO-only](receipts/2026-09-30-microbit-active-hosted-lazy.json) receipts
retain tested PR merge-ref `9e4e5f83586f7c94bc989a44399821401078ab37`,
qualified head `143402d6`, CPU source `ab501cdf`, and landed main `3456c048`
as separate provenance. Qualified CPU, all 11 CPU regression tests and all
three guest sources are byte-identical to landed main. The later exact-main
post-merge benchmark **failed** its motion real-time gate, as recorded below.
The first optimization's exact-main and PR-qualified results above remain
historical, not a controlled wall-time A/B against this second optimization.

The historical predecessor exact-main
[run 36694881019](https://github.com/CrispStrobe/labwired-core/actions/runs/36694881019)
at `3456c048894f194bbabc9c414932a752d89da999` passed functional checks but
**failed the >=1.0x motion gate**: median **0.8898152593409774x**, minimum
**0.8871067576500745x**, with all five samples below 1.0x. The
[full failed motion receipt](receipts/2026-09-30-microbit-motion-hosted-main-failed.json)
preserves exact-main provenance, guest/source hashes, conversions, DMA counts,
matrix/button observations and all timing samples. GPIO-only reached
**2.5459589767695143x median** in that job; its
[full receipt](receipts/2026-09-30-microbit-active-hosted-main-motion-failed.json)
is a separate workload and does not establish sensor real-time performance.

That predecessor's selected native motion workload **did not meet >=1.0x** in
this measurement. Earlier PR **1.126555x / 1.123001x**, first-optimization
exact-main **1.030645x / 1.027010x**, and earlier PR **1.758214x / 1.733954x**
remain historical observations, not controlled wall-time A/Bs. This failure
does not weaken the assertions,
change the threshold, promote a browser pin, or complete CP13.

### New landed discovery and ADC successors; remaining performance gates

[PR 134](https://github.com/CrispStrobe/labwired-core/pull/134), main
`96b739c259a0c09bfa71a499a43d74a96ed2c37c`, adds generation-scoped structural
discovery miss caching, code-cache invalidation regressions and derived Nordic
pull masks. The controlled identical-guest
[EPYC 7763 B/C/C/B run 36719325375](https://github.com/CrispStrobe/labwired-core/actions/runs/36719325375)
measured predecessor medians **0.8797522055451575x / 0.8827492813240173x** and
candidate **1.0368249705408994x / 1.0232886257270697x**; both strict candidate
gates pass. Its immutable
[source-bound receipt](https://github.com/CrispStrobe/labwired-core/blob/ede33fb4a4778f35cc3398190aaa3d2cf9beb4db/docs/receipts/2026-09-30-microbit-can-ab-36719325375/qualification-context.json)
distinguishes PR head, tested merge reference and actual guest ELF hashes.

[PR 135](https://github.com/CrispStrobe/labwired-core/pull/135), main
`ede33fb4a4778f35cc3398190aaa3d2cf9beb4db`, adds the actual original MIT ARM
ADC scan guest and proper START-latched buffer/PTR/MAXCNT state. One accepted
SAMPLE converts enabled channels in order, appending cumulative AMOUNT across
scans; END occurs only when the latched buffer fills. Sparse channels, live
register edits after START, partial-buffer sentinels and restart are checked
through the production CPU/bus, not host-side fabricated results.
[Combined run 36720954929](https://github.com/CrispStrobe/labwired-core/actions/runs/36720954929)
passed 311 core plus three native WASM selected executions, including 26 SAADC
tests, the ARM scan guest and four tick512 EasyDMA tests. Its recorded EPYC
9V45 motion median/min **1.996539x / 1.988887x** is a separate host observation,
not an ADC speedup measured against another runner. The
[combined proof and actual ADC ELF provenance](https://github.com/CrispStrobe/labwired-core/blob/ede33fb4a4778f35cc3398190aaa3d2cf9beb4db/docs/receipts/2026-09-30-microbit-saadc-scan-combined-proof.json)
are retained. Exact remote-main `ede33fb4`
[run 36725594408](https://github.com/CrispStrobe/labwired-core/actions/runs/36725594408)
subsequently passed native board qualification on EPYC 9V74: motion median
**1.2900968120384135x**, minimum **1.2610661709163336x**, all five samples above
1x; GPIO-only median **3.5557664867842327x**. The
[complete original motion receipt](receipts/2026-09-30-microbit-exact-main-ede33/microbit-motion-throughput.json),
[GPIO receipt](receipts/2026-09-30-microbit-exact-main-ede33/microbit-active-throughput.json)
and [source/runner/actual retained-ELF context](receipts/2026-09-30-microbit-exact-main-ede33/qualification-context.json)
preserve the exact source, unnormalized logs, and verified ADC scan and measured
motion guest ELF hashes. This supersedes the pending exact-main measurement,
not the historical predecessor failure. It is not a controlled cross-runner
gain, a post-main all-forty-chip result, browser qualification or a pin update.

The [PR 136 countdown change](https://github.com/CrispStrobe/labwired-core/pull/136)
landed at `8736e1ff`. Earlier main `8b1cd3f5` included countdown and CI-only
follow-up but not the GPIO changes; current main `5fb3d7d4` includes both.
Its earlier countdown candidate
passed all nine new whole-engine regressions. Its
[isolated run 36723407331](https://github.com/CrispStrobe/labwired-core/actions/runs/36723407331)
compares against exact optimized baseline `307541bd`, on EPYC 7763:
**7.79%** gain, candidate medians **1.092111x / 1.123578x**, minimum **1.087533x**,
all ten candidate windows >=1x. These are historical source-bound results,
not a current-main `5fb3d7d4` measurement or a Lite package promotion.

All 40 chip synthetic RTx fixtures passed for the landed optimization source,
while six historical Nordic single-step instruction-cost failures remain tracked in
[issue 120](https://github.com/CrispStrobe/labwired-core/issues/120). An empty
CAN-service guard did not reduce those costs. The isolated no-pull GPIO probe
saved approximately five host instructions per GPIO port and reduced the six
failures to three (nRF5340/nRF54L15/nRF54LM20A, about +3.3%); the subsequent
[PR 137 snapshot-path candidate](https://github.com/CrispStrobe/labwired-core/pull/137)
has a split result on old GPIO-only head `72f8b4cf`:
[CorePerf run 36726333551](https://github.com/CrispStrobe/labwired-core/actions/runs/36726333551)
passed all forty absolute RTx targets and every unchanged relative instruction-
cost gate. The six Nordic step deltas were +1.3% (nRF52832), +0.1%
(nRF52833/nRF52840), +0.2% (nRF5340), −1.7% (nRF54L15) and −3.0%
(nRF54LM20A). Yet [native run 36726335356](https://github.com/CrispStrobe/labwired-core/actions/runs/36726335356)
passed 331 functional executions and **failed the motion >=1x gate**, median
**0.995903x on EPYC 7763**. Passing synthetic cost gates does not override
that workload failure, land the candidate, promote main/browser or establish
closure of issue 120.

Fresh PR137 head `8c745a68` has the same runtime engine as the newly qualified
combined candidate (GPIO snapshot/no-pull, countdown and landed ADC source).
[Native run 36733437798](https://github.com/CrispStrobe/labwired-core/actions/runs/36733437798)
passed on EPYC 9V74: motion median **1.3963423432295103x**, minimum
**1.369084261691459x**, all five samples >=1x; GPIO-only median
**7.3078141345753265x**. [CorePerf run 36733427626](https://github.com/CrispStrobe/labwired-core/actions/runs/36733427626)
passed all forty absolute RTx targets and all unchanged strict relative-cost
gates over 78 board-modes and eleven memory maps, fixing all six tracked Nordic
cost regressions in that candidate without baseline changes.
[Controlled A/B run 36731892881](https://github.com/CrispStrobe/labwired-core/actions/runs/36731892881)
against runtime-main `ede33fb4` measured baseline median-of-medians
**1.0035145315080594x** and candidate **1.0877771001141803x**, a
**8.396746%** increase with all ten candidate windows >=1x.

Fresh rebased head `8c745a68`, tested merge-ref `3afa2088`, also passed
[native run 36772744347](https://github.com/CrispStrobe/labwired-core/actions/runs/36772744347)
on EPYC 7763: motion median **1.1161352077261557x**, minimum
**1.0514338861805301x**, all five samples >=1x and transport errors zero;
GPIO-only median **5.536380578241844x**. This is separate from the preceding
EPYC 9V74 1.396342x observation, not a cross-runner performance gain.
The [fresh rebase A/B run 36772744288](https://github.com/CrispStrobe/labwired-core/actions/runs/36772744288)
passed; the 8.396746% figure above belongs only to run 36731892881.
Browser CI, all three workspace shards and their aggregate passed for
`8c745a68`. Its original twenty-minute PR gate timed out during feature-off
core compilation after Clippy/default-member checks passed. Current PR137
final head `bd05656f9af2f4fa536db8834bccb9aa08b7b400` changes CI and its contract
test only; production source is identical to qualified `8c745a68`. The
[fresh Core CI run 36778919591](https://github.com/CrispStrobe/labwired-core/actions/runs/36778919591)
splits default-member and feature-off jobs while preserving all commands,
their twenty-minute budgets and the fail-closed original aggregate. That run
**passed full Core CI**, including all three workspace shards and aggregate. Passing
browser CI is not an active-browser performance measurement or package-pin
promotion.

The old `72f8b4cf` 0.995903x motion failure remains predecessor evidence,
not the newer combined source's result. **GPIO PR137 landed at main
`5fb3d7d44cc1487fdab757906ae62222e8798e93`**. Final-head
[native run 36778919418](https://github.com/CrispStrobe/labwired-core/actions/runs/36778919418)
passed on EPYC 7763: motion median **1.1267179334518453x**, minimum
**1.1174671337969828x**, all five samples >=1x with zero transport errors;
GPIO-only median **5.278344943272967x**, minimum **4.983698993391979x**.
All 349 overlapping functional executions and two benchmarks passed, with actual
guest executable hashes retained by the source qualification. The
[final paired A/B 36778919437](https://github.com/CrispStrobe/labwired-core/actions/runs/36778919437)
passed too. The previously qualified engine's strict forty-chip/78-mode result
remains separate evidence; [additional final-head CorePerf 36779028846](https://github.com/CrispStrobe/labwired-core/actions/runs/36779028846)
passed on exact final head `bd05656f`: all forty chip medians and minima >=1x,
all 78 board-modes over eleven memory maps passed unchanged strict relative-
cost gates, and zero regressions, waivers, skips or contract failures. Baselines
are unchanged; the faster-than-baseline nRF51 advisory remains. This is final-
head qualification, not an exact post-merge main result. Exact post-merge main
`5fb3d7d4` measurement is pending;
no browser/package promotion or issue 120 closure is claimed here. Historical exact-main
`ede33fb4` 1.290x/1.261x and every retained receipt above remain separate
evidence, and CP13 remains NEXT. No benchmark, 1x floor or 3% relative-cost gate
was weakened or re-baselined. Neither this native evidence nor these merges
change Lite's WASM pin, establish browser performance or complete CP13.

Callgrind recorded **1,375,692,554** host instructions for the first
optimization's native functional proof and **1,300,205,720** for the second,
about **5.5% less recorded instruction work** including configuration/guest
startup. This instrumentation result is neither a simulated ARM instruction
count nor a proportional wall-clock improvement.

The same first optimization reduced Callgrind's total native functional-test
host instruction work by **46.2%**, including configuration/guest startup.
Its shared-VPS motion receipt remained below real time: **0.31243952566997163x
median**, **0.288592214098303x minimum**. Contention was not controlled;
instruction-work reduction is not a proportional wall-time speedup or a
stable VPS real-time guarantee. The
[full optimized VPS receipt](receipts/2026-09-30-microbit-motion-vps-optimized.json)
retains all five observations and source/executable provenance.

This candidate does not change Lite's package pins, add an app
dependency, or introduce GPL model/guest code. It is not a claim that Lite
ships the sensor model: a WASM pin/build and browser/full-app
qualification remain necessary.

The motion workload above is polled and does not exercise the separately
qualified ADC guest. Shared P0.25 sensor IRQ,
RUNMIC control/bias, continuous microphone, speaker audio and browser-WASM
qualification remain outside these proofs. Functional simulated cycles are not silicon-cycle-
accurate measurements, and no sensor silicon capture is claimed. CP13 remains
in progress with state **NEXT**, not DONE.

CP12's hardware sequence starts with SPI0 (`0x01c41000`, AINTC20, PSC0
module4) and its chip-select-3 ADS7957. The ADC has 16 channels and 10-bit
samples; it requires 16-bit SPI frames and a two-frame manual-selection
pipeline, unlike CP11's byte-oriented display. The sensor proof reads input1
channel6 at deterministic raw samples 0, 341 and 1023 through the ARM926
guest. The motor proof exercises eHRPWM1 outputs B/A (motors A/B), eCAP0/1
(motors C/D), their physical bridge GPIOs and encoder GPIO interrupts.
Register/wiring facts come from the public
[AM1808/EV3 board descriptions](https://github.com/torvalds/linux/blob/master/arch/arm/boot/dts/ti/davinci/da850-lego-ev3.dts)
and [TI ADS7957 datasheet](https://www.ti.com/lit/ds/symlink/ads7957.pdf).

The CP12 integration extends Lite's target-specific `brick-state/v1` decoder:
EV3 uses `brickwright-ev3-smoke`, transport `none`, and exactly 178x128
integer luminance samples 0..255 (or an explicit unavailable empty display).
The debugger requests fresh paused-model observations, rather than treating
UART smoke text as motor/sensor/display state. Target identity cannot change
within a stream; replay, loopback, frame and collection bounds remain enforced.
Only named buttons and raw ten-bit ADC channel inputs are accepted; no caller
text becomes a monitor command. Full frames exceed the ordinary native broker
reply budget, so only the three exact correlated EV3 state/button/analog
operations get a bounded 272 KiB outbound envelope/256 KiB result string.
Inbound and all other operation limits remain unchanged.

Final local proofs use Renode `e0e38e7a` and Infrastructure `f864d7ce`:
89/89 focused model tests, three ADC guest injections and all four motor
forward/reverse/brake/coast phases passed. Forward produced five signed edges;
reverse returned the count to zero after ten emitted edges, with no new edges
during brake/coast. All nine prior UART proofs, actual GDB reads and four debugger
protocol tests passed. The live Renode/IronPython feed observed black/white
display pixels, all four motor edges, button press/release, ADC channel 3=777 and
rejected out-of-range/replayed/stale inputs. Lite's actual production debugger
modules passed both packaged contracts: CPU/UART/full-frame/controls in 27.63
seconds and guest-driven ABCD motion/controls in 37.22 seconds. The latter
requires every motor to report Forward, direction 1, duty 0.5 and positive signed
counts and emitted edges. Source validation passed 29 Python state tests,
62 Rust boundary/debugger/transport tests and 57 JavaScript broker tests.
The [hosted Renode reproduction](https://github.com/CrispStrobe/renode-spike-prime/actions/runs/36669748932)
passed. The first [hosted Lite reproduction](https://github.com/CrispStrobe/brickwright/actions/runs/36670127225)
failed before the debugger tests because Renode's build script was invoked from
the Lite checkout directory. The specialized job now builds from the Renode root
and installs the same required Tauri system libraries as the ordinary test job;
the [replacement hosted run](https://github.com/CrispStrobe/brickwright/actions/runs/36671631679)
passed both complete packaged debugger and guest-driven four-motor contracts
at Lite `b71ee87e`.
CP12 closes this functional subset; it does not establish >=1.0x RTx for the
expanded board. Performance qualification remains separate from these proofs.
UART sensors on inputs3/4 need
the PRU software-UART path, and sensor I2C is GPIO-driven; these cannot be
claimed from the existing NS16550 or EEPROM I2C support alone.

The immutable integration points are bw-board `bdffe947` for the exact
LabWired target bridge, Renode `06d86c51` for SPIKE Prime, Renode `1484844e`
for EV3's active-workload 300-MIPS qualification, Renode `e0e38e7a` and
Infrastructure `f864d7ce` for the completed CP12 peripheral and observer subset. Public
simulation firmware is kept in its separate MIT repository; no private
recovery image is read, copied, bundled or required by these source-only gates.
The public simulation firmware used by the current SPIKE qualification is
`b4cfe1fa`.
