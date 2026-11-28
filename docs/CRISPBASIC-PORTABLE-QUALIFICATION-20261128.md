# CrispBASIC portable simulation qualification — 28 November 2026

## Result and exact source

The combined implementation at
[`59f079bfa0b890a37701334a1de36f0a9b115458`](https://github.com/CrispStrobe/brickwright/commit/59f079bfa0b890a37701334a1de36f0a9b115458)
passed all seven jobs in
[CrispBASIC run 46125708968](https://github.com/CrispStrobe/brickwright/actions/runs/46125708968),
completed **28 November 2026 at 09:36:33 CET**. The workflow recorded **900
passing test executions**, with zero failures, cancellations or skipped tests.
Shared tests run on several platforms; this is an execution count, not a claim
of 900 distinct test cases.

This receipt is a documentation-only follow-up. The tested implementation tree
is `0422befd2a69c3ced5b2df5d14a724d14c714e4f`. All implementation and producer
changes were saved incrementally on remote feature branches; this work does
not merge any repository's default branch.

| Repository / role | Saved feature branch | Qualified implementation |
| --- | --- | --- |
| Brickwright integration | [`feature/crispbasic-portable-simulators-20261128`](https://github.com/CrispStrobe/brickwright/tree/feature/crispbasic-portable-simulators-20261128) | `59f079bfa0b890a37701334a1de36f0a9b115458` |
| Board profiles | [`feature/crispbasic-machine-profiles-20261128`](https://github.com/CrispStrobe/bw-board/tree/feature/crispbasic-machine-profiles-20261128) | `8be0fbc8e91f1ed2cebb26883210efceef9234cc` |
| Pseudocode compiler | [`feature/crispbasic-roundtrip-20261128`](https://github.com/CrispStrobe/sb3-creator/tree/feature/crispbasic-roundtrip-20261128) | `2c991d9a590d189eaad66c96951d4815a9f34e29` |
| Standalone runtime, incorporated into integration | [`feature/crispbasic-runtime-ports-20261128`](https://github.com/CrispStrobe/brickwright/tree/feature/crispbasic-runtime-ports-20261128) | `597fc385277769c10c9c5791081b19002e638b6f` |

The integrated runtime is `0.1.0-dev.7`. Its BBCSDL source remains pinned to
`6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f`; `bw-circuit-ui` remains pinned to
`0a1b15edb0daecd723c7c07126450d84b86e3e68`. Producer changes live in their
owning repositories, with exact consumer pins and reproducible import rewrites.

## Hosted execution evidence

All rows below refer to the exact integrated commit above, rather than an
earlier runtime-only checkpoint.

| Job | Passing executions | Scope |
| --- | ---: | --- |
| [Native ARM64](https://github.com/CrispStrobe/brickwright/actions/runs/46125708968/job/140919726773) | 159 | 117 source-preparation checks and 42 real native runtime/CLI checks on Linux ARM64 |
| [Native x64](https://github.com/CrispStrobe/brickwright/actions/runs/46125708968/job/140919726942) | 159 | The same 117 source and 42 native checks on Linux x64 |
| [WASM and integration](https://github.com/CrispStrobe/brickwright/actions/runs/46125708968/job/140919726918) | 526 | 162 WASM, 10 native/WASM parity, 18 engine-browser, 292 Brickwright integration, 30 ownership/CAD and 14 focused GUI-browser checks |
| [Portable CLI, Linux ARM64](https://github.com/CrispStrobe/brickwright/actions/runs/46125708968/job/140921222659) | 15 | Real Node CLI execution of the downloaded shared WASM artifact |
| [Portable CLI, macOS 15 ARM64](https://github.com/CrispStrobe/brickwright/actions/runs/46125708968/job/140921222678) | 15 | Real Node CLI execution of the same WASM artifact |
| [Portable CLI, Windows Server 2025 x64](https://github.com/CrispStrobe/brickwright/actions/runs/46125708968/job/140921222769) | 14 | Real Node CLI execution of the same WASM artifact; POSIX-signal cases are outside this platform's suite |
| [Complete production editor](https://github.com/CrispStrobe/brickwright/actions/runs/46125708968/job/140921222677) | 12 | Full flagged webpack build, emitted-asset authentication and actual Chromium interaction |
| **Total** | **900** | **All seven jobs successful** |

The production job authenticated **20 runtime assets against the packaging
recipe** and verified the production asset boundary, recording hashes for
**three entry scripts and 563 lazy chunks**. Its complete editor build succeeded in 123.875 seconds,
with three existing build warnings. The browser suite includes generating and
running BASIC, interactive input, canvas pixels, circuit toggle behavior,
Stop/Reset and missing-runtime handling. The new portable scenario performs
BASIC → marked pseudocode → incompatible-output refusals → saved `.bw` reopen
with the preference unchecked → automatic portable BASIC regeneration → the
same interpreter output. This tests the actual editor and production bundle.

The hosted run retained these artifacts:

| Artifact | GitHub ID | Size | SHA-256 |
| --- | --- | ---: | --- |
| [WASM runtime](https://github.com/CrispStrobe/brickwright/actions/runs/46125708968/artifacts/15255483018) | `15255483018` | 123,092 bytes | `ba501e86095af3eeb56fbcb2e6bbdd24232c31750898882bc376038d41a03e18` |
| [Production qualification evidence](https://github.com/CrispStrobe/brickwright/actions/runs/46125708968/artifacts/15255693031) | `15255693031` | 958,607 bytes | `851701820ca5465a77b5ba0e0c127a701b3bf71e815fb9e81de6cb8bee1bd992` |

The hashes above are GitHub artifact archive digests, not individual WASM or
screenshot hashes. Artifact retention expires on 5 December 2026; the source,
workflow, tests, immutable commit references and this receipt remain in Git.

### Producer and independent local evidence

The final `sb3-creator` producer commit passed
[run 46125404430](https://github.com/CrispStrobe/sb3-creator/actions/runs/46125404430)
with **375 tests, zero failures and zero skips**. This includes BOM/Unicode
whitespace marker regressions. The `bw-board` profile change passed **94
focused tests** for profile admission, registration, terminals, electrical
drive/read and cleanup. The adopted board commit also passed its ordinary
repository CI in [run 46123632767](https://github.com/CrispStrobe/bw-board/actions/runs/46123632767).
All steps in the test job passed; four optional vector/corpus jobs were skipped.

An isolated full local production checkout at `59f079b` independently passed
the same **12 production GUI scenarios** in Chromium 158.0.8127.0, with no page
errors, failed scenarios or skips. Its normal locked build and distribution
policy checks passed. Installed-package provenance verified all **13,742
`bw-board` files** and **1,463 `bw-circuit-ui` files** against the pinned source
in both root and GUI dependencies, together with single-engine resolution.

Additional local checks passed: **292 integration tests**, **14 focused real
browser scenarios**, **nine compiler identity/localization checks**, and the
unchanged **5,941-file gallery consistency check**. Compiler sync confirmed all
22 mapped producer files after import rewriting. These local repeats provide
independent confirmation and are not added to the hosted 900-execution total.

## What is now connected

### Hosts and simulated controllers

CrispBASIC has actual native Linux x64 and ARM64 execution, plus the shared
WebAssembly runtime in Node and the browser. The same built WASM artifact was
executed on Linux ARM64, macOS ARM64 and Windows x64. The CLI exposes explicit
`--backend native|wasm`, capability discovery, deterministic logical-pin
simulation fixtures and JSON traces. Native noninteractive input is prepared
before interpreter startup to avoid the input-file race.

The Circuit adapter admits these **16 verified electrical controller models**:

- STC/8051 logical ports (`mcu`).
- Arduino Uno, Nano and Mega.
- Raspberry Pi Pico; micro:bit and micro:bit breakout; Calliope mini.
- Circuit Playground Express, ESP8266 and ESP32-4848S040 H1 connector.
- ATtiny85 DIP-8, ATtiny88 DIP-28 and ATtiny88 QFN-32.
- STM32F030 TSSOP-20 and Eater 6502 VIA.

For named controller models, profiles verify the registered model, nominal
voltage and available terminal definitions. Every profile checks exposed
logical pads, rejects duplicate pin aliases and requires one controller. The
generic `mcu` profile uses the circuit's exposed logical ports and bench
voltage. These checks do not validate solved supply rails. The editor lists
the models and their numbering conventions. [PORTABILITY.md](../packages/crisp-basic/PORTABILITY.md)
contains the exact terminal tables and the distinction between electrical
host profiles and the narrower source-generator pin maps.

These are host-driven electrical models. No new native MCU BASIC firmware or
interpreter running inside an emulated AVR, ARM MCU, 8051 or 6502 CPU is claimed.
Native Linux ARM64 covers a suitable 64-bit Linux host; 32-bit ARM and native
Windows/macOS executables were not implemented. Native x64 uses `long double`
where ARM64 uses `double`; parity tests do not prove bit-identical behavior at
all floating-point boundaries.

### BASIC ↔ pseudocode

The explicit portable converter accepts a qualified subset covering static
device/pin declarations, ordered pin modes, proven digital writes, electrical
reads, atomic toggles, active-low logic, literal integer-millisecond delays,
timers, numeric scalars and accepted predicates, structured conditions and
loops, and supported integer pen paths. Recognized generated numbered BASIC
can be read back. Real interpreter tests compare output bytes and ordered GPIO
traces through the complete round trip.

Converted source retains `# @crispbasic-portable 1`, including when saved and
reopened. The editor restores portable generation, and GUI/CLI/direct build
entry points refuse generic Blocks, Python, C, JavaScript, MicroPython,
retargeting and incompatible hardware outputs before mutating the destination.
Duplicate, future, malformed and Unicode-whitespace markers are handled
consistently. Unsupported or semantically unproven input fails as a whole.

This is a qualified source subset, not arbitrary BASIC reversal or a portable
Blocks runtime. Dynamic or unproven electrical expressions, arbitrary control
flow, authored runtime overrides and unsupported graphics remain refused.
See [GENERATOR.md](../packages/crisp-basic/GENERATOR.md) for accepted forms and
the runtime contract.

### Canvas and a physical motor circuit

The VDU preview now handles graphics origins, relative/absolute plotting,
lines, points, filled triangles and rectangles, independent graphics/text
colors, and bounded visible diagnostics for unsupported operations. Text uses
opaque fixed cells with cursor/TAB handling, horizontal wrapping and DEL
erasure. Actual browser pixel checks cover the corrected coordinate mapping.
The preview remains 320 × 256 with 40 × 16 text cells; full BBC screen-mode,
palette, scrolling, query and sound emulation is outside this increment.

The [robot motor example](../packages/crisp-basic/examples/robot-motor/README.md)
connects Uno GPIO to an H-bridge, clamp diodes, pulldowns and a real inductive
DC motor model. Tests exercise forward, reverse, braking and coasting, signed
motor current/speed/shaft movement, swapped motor leads, and independent
steady-state anchors. Stop during a delay and BASIC failure release ownership
without late GPIO work while preserving physical rotor state and existing
power.

Full CAD/world coupling is still separate. CAD uses a fixed 5 ms step/reset
contract while BASIC accepts explicit integer-millisecond advances and
preserves circuit time. Existing exclusive clock ownership remains tested;
joint robot/world operation needs a defined shared clock and cleanup contract.

## Use this checkpoint

From the integrated feature branch, follow the build prerequisites in
[PORTABILITY.md](../packages/crisp-basic/PORTABILITY.md). In the editor select
**BAS → BBC BASIC → CrispBASIC (browser)**, enable **Connect Circuit** for
electrical programs, and use **Portable BASIC ↔ pseudocode** for source
round trips.

```sh
# Pseudocode → BASIC → portable pseudocode → numbered BASIC
node bin/bwlite.mjs convert lamp.bw --to crispbasic --out lamp.bas
node bin/bwlite.mjs read lamp.bas --crispbasic --out lamp-portable.bw
node bin/bwlite.mjs convert lamp-portable.bw --to crispbasic --numbered --out lamp-numbered.bas

# Explicit WASM CLI; build the runtime as documented first
node packages/crisp-basic/bin/crispbasic.mjs --backend wasm --capabilities
node packages/crisp-basic/bin/crispbasic.mjs --backend wasm \
  --simulation packages/crisp-basic/examples/simulation.json \
  packages/crisp-basic/examples/simulation.bas --json
```

CLI simulation JSON describes a deterministic logical-pin fixture. It is not
a Circuit JSON electrical solver or a CAD world. The GUI Circuit route and
the motor example exercise the electrical solver separately.
