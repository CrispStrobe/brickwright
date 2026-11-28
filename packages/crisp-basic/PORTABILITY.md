# Where CrispBASIC runs, and what it can control

CrispBASIC executes BBC BASIC source through the pinned BBCSDL interpreter.
It currently has native Linux hosts, a shared browser/Node WebAssembly runtime,
and a Brickwright adapter that drives verified electrical controller models.
The portable source converter can also translate a qualified subset between
BASIC and pseudocode while preserving its CrispBASIC runtime requirement.

These are separate capabilities. Running CrispBASIC on an ARM64 Linux computer
does not install it on a Pico or micro:bit. Driving a controller's Circuit
model does not execute BASIC on that controller's emulated CPU.

## Choose an execution route

| Route | Current status | What executes and what it exposes |
| --- | --- | --- |
| Native Linux x64 | Qualified by native runtime CI | A new native BBCSDL process per run; local files, OS and native facilities remain available to trusted programs |
| Native Linux ARM64 | Qualified by native runtime CI | An ARM64 build using the upstream ARM64 data/assembler layout; no x86 emulation |
| Linux ARMv7 hard-float executable | Qualified on an emulated Cortex-A7 CPU | Upstream ARM32 layout and ARMv7-A/Thumb-2 instructions; suitable 32-bit Linux userspace required |
| ARMv7 / ARM64 through QEMU | Both CPU jobs passed at `00d05d03` | Real guest instructions on Cortex-A7/A53 user-mode emulation with a matching Linux sysroot; no guest board or kernel boot |
| WASM in Node on Linux x64 and Linux ARM64 | Qualified runtime/CLI routes | A new worker and restricted interpreter instance per run; optional deterministic logical-pin host; ARM64 consumes the same built artifact |
| WASM in the browser | Focused Chromium 158 qualification passed; browser and Brickwright gates exercise this route | The same restricted interpreter, interactive input, Stop/Reset, raw VDU output and a partial canvas preview |
| WASM CLI on macOS ARM64 and Windows x64 | Qualified at the runtime checkpoint linked below | Real Node CLI execution of the same downloaded WASM artifact used on Linux; no native BASIC executable is needed |
| Bare-metal MCU firmware or a native interpreter inside a retro CPU simulator | Not implemented by these ports | Requires a separate target runtime, board I/O contract and simulator qualification |

The native builds require Linux, Node 22+, Git and GCC/binutils; x64 additionally
requires NASM. A suitable ARM64 Linux machine, including a Raspberry Pi running
64-bit Linux, can use the ARM64 build. The ARMv7 hard-float port covers a
compatible 32-bit Linux userspace on ARMv7-or-newer CPUs; ARMv6 and soft-float
targets remain unsupported.
Native Windows and macOS executables are not supplied by the current builder.
Native execution retains host access and is intended for trusted local programs.
The pinned interpreter uses `long double` on native x64 and `double` on native
ARM targets. Passing the shared corpus does not imply identical results at every
floating-point precision boundary.

From the Brickwright repository root:

```sh
npm --prefix packages/crisp-basic run build:native
node packages/crisp-basic/bin/crispbasic.mjs packages/crisp-basic/examples/structured.bas --json
npm --prefix packages/crisp-basic run test:native
```

[CPU-EMULATION.md](CPU-EMULATION.md) gives cross-build and emulator CLI commands,
sysroot requirements, build-receipt checks and deployment guidance. The
separate [CPU-emulation workflow](../../.github/workflows/crispbasic-cpu-emulation.yml)
runs the real native test suite on emulated ARM CPUs; completed results and
exact commits are recorded in [VALIDATION.md](VALIDATION.md). This does not
port the interpreter to Brickwright's existing RISC-V32 Linux guest or to
bare-metal MCU simulators.

[CPU run 46129143522](https://github.com/CrispStrobe/brickwright/actions/runs/46129143522)
passed both Cortex-A7/ARMv7 and Cortex-A53/AArch64 jobs at
`00d05d0377b1000b498e451439a12097a4078ec2`. Each ran 122 source/contract checks,
53 native runtime/CLI/corpus checks and the documented standalone example,
with zero failing or skipped tests. The artifacts include architecture-checked
executables and matching binary digests; no physical ARMv7 board was used.

To build the WASM artifact, make Emscripten **3.1.64** available as `emcc`, or set
`EMCC` to that executable. Run:

```sh
npm --prefix packages/crisp-basic run build:wasm
node packages/crisp-basic/bin/crispbasic.mjs --backend wasm packages/crisp-basic/examples/hello.bas
node packages/crisp-basic/bin/crispbasic.mjs --backend wasm --capabilities
npm --prefix packages/crisp-basic run test:wasm
```

The generated `.mjs` and `.wasm` files stay together under `.build/wasm/`.
Execution in Node needs these artifacts, Node 22+ and worker support; it does
not need a native BASIC executable. `--capabilities` describes the selected
backend without launching it and does not prove that its build files exist.
The CLI default remains `--backend native`; select WASM explicitly.

WASM has no host filesystem, process, network, native-call or arbitrary
JavaScript interface. Its `TIME`/`WAIT` clock is separate from simulated circuit
time. See [CLI.md](CLI.md), [SIMULATION.md](SIMULATION.md) and the
[runtime README](README.md) for input, limits, capabilities and API details.
The [workflow](../../.github/workflows/crispbasic.yml) defines the platform
matrix. [Runtime run 46124192458](https://github.com/CrispStrobe/brickwright/actions/runs/46124192458)
qualified native Linux x64/ARM64, WASM and the portable Node CLI on Linux ARM64,
macOS 15 ARM64 and Windows Server 2025 x64. The three portable jobs verified and
executed the same WASM artifact: Linux/macOS each passed 15 checks and Windows
passed 14, all without skips. POSIX signals are qualified only on POSIX hosts;
parent-enforced execution and output limits are qualified on all three.
[VALIDATION.md](VALIDATION.md) records completed qualification evidence and
the integration test counts.

## Connect BASIC to a Circuit

Build and package the browser runtime from the repository root with
`npm run build:crispbasic`. In the Code tab choose **BAS → BBC BASIC →
CrispBASIC (browser)**, open a supported circuit, and enable **Connect Circuit**
before running pin/time calls. The supported-controller list in the BASIC panel
shows the model names and numbering guidance.

For an Uno D13 LED circuit, this directly authored program requests an output,
drives it for 25 simulated milliseconds, then toggles its retained latch:

```basic
PROCpinMode(13, "output")
PROCdigitalWrite(13, 1)
PROCdelay(25)
PROCdigitalToggle(13)
PRINT "Elapsed ms: "; FNmillis
END
```

The library exposes `PROCpinMode`, `PROCdigitalWrite`, `PROCdigitalToggle`,
`FNdigitalRead`, `PROCdelay` and `FNmillis`. Modes are `"input"`,
`"input-pullup"` and `"output"`; digital writes take electrical `0` or `1`.
Reads observe the solved circuit voltage, while toggle changes the retained
output request. A heavily loaded output can therefore read LOW while its
requested latch is HIGH. Only explicit `PROCdelay` calls advance circuit time.

### The 16 admitted electrical controller profiles

The authority is `bw-board/portable-gpio.js` at
[`8be0fbc8e91f1ed2cebb26883210efceef9234cc`](https://github.com/CrispStrobe/bw-board/blob/8be0fbc8e91f1ed2cebb26883210efceef9234cc/src/portable-gpio.js).
Terminal names are matched in full, without case sensitivity. IDs are logical
library numbers, not physical connector positions or CPU register addresses.

| Circuit kind | Modeled logic supply | Admitted terminals and BASIC IDs |
| --- | --- | --- |
| `mcu` | Circuit bench voltage | `P0.0`–`P7.7`: `8 * port + bit`, IDs 0–63 |
| `arduino_uno` | 5 V | D0–D13 → 0–13; A0–A5 → 14–19 |
| `arduino_nano` | 5 V | D0–D13 → 0–13; A0–A5 → 14–19; A6/A7 excluded |
| `arduino_mega` | 5 V | D0–D53 → 0–53; A0–A15 → 54–69 |
| `pi_pico` | 3.3 V | GP0–GP22 and GP25–GP28 → their GPIO numbers |
| `microbit` | 3.3 V | P0, P1, P2 → 0, 1, 2 |
| `microbit_breakout` | 3.3 V | P0, P1, P2, P8, P12, P16 → their pad numbers |
| `calliopemini` | 3.3 V | P0–P3 → 0–3 |
| `circuit_playground_express` | 3.3 V | A0–A7 → 0–7, with no Arduino analog-pin offset |
| `esp8266` | 3.3 V | GPIO0–GPIO5 and GPIO12–GPIO15 → their GPIO numbers |
| `esp32_4848s040` | 3.3 V | H1 GPIO1, GPIO2, GPIO40, GPIO43, GPIO44 → those numbers |
| `attiny85` | 5 V | PB0–PB5 → 8–13 |
| `attiny88` | 5 V | PB0–PB7 → 8–15; PC0–PC7 → 16–23; PD0–PD7 → 24–31 |
| `attiny88_qfn32` | 5 V | PA0–PA3 → 0–3, plus the same PB/PC/PD ranges as `attiny88` |
| `stm32f030` | 3.3 V | PA0–PA7 → 0–7; PA9 → 9; PA10 → 10; PB1 → 17 |
| `eater6502` | 5 V | VIA1.PA0–PA7 → 0–7; VIA1.PB0–PB7 → 8–15 |

Only the admitted terminals actually present in the loaded circuit are
available. The adapter requires exactly one GPIO controller, verifies the
registered model and supply, and refuses duplicate logical aliases. It does
not infer connections, clamp invalid pin numbers or guess an unverified model.
A 3.3 V controller retains its modeled output voltage on a 5 V bench.

This inventory describes electrical model pads. The ATtiny profiles include
some pads that have reset/fuse roles on physical chips; this host does not
emulate those roles. The source generator deliberately excludes ATtiny85 PB5
and ATtiny88 PC6. Its language-level maps are also narrower than this host
inventory: ESP32-S040 and the ATtiny88 QFN-only PA pads are currently usable
through authored BASIC, without a corresponding portable `DEVICE` conversion
route. See [GENERATOR.md](GENERATOR.md) for exact language maps and spellings.

`eater6502` here means host-driven VIA terminal simulation. It does not mean
the CrispBASIC interpreter runs on the 6502. Likewise, the generic `mcu` profile
is not permission to reinterpret arbitrary STC model aliases or autonomous CPU
simulators. Analog I/O, PWM, interrupts and peripheral protocols are outside
this digital library. [BOARD-SIMULATION.md](BOARD-SIMULATION.md) specifies
thresholds, ownership, cleanup and limits.

### A CLI logical-pin fixture is a different host

The standalone WASM CLI can execute the same library against deterministic
logical pins:

```sh
node packages/crisp-basic/bin/crispbasic.mjs --backend wasm \
  --simulation packages/crisp-basic/examples/simulation.json \
  packages/crisp-basic/examples/simulation.bas --json
```

That JSON fixture defines logical IDs, scheduled input levels and limits. It
does not load Circuit JSON, simulate voltage/current, or connect equipment.
The JSON result includes the host capabilities, elapsed simulation time and
completed-operation trace. Use the connected GUI adapter or the real-solver
integration tests when electrical behavior matters.

## BASIC ↔ pseudocode: use the explicit portable subset

The shared producer is `CrispStrobe/sb3-creator` at
[`2c991d9a590d189eaad66c96951d4815a9f34e29`](https://github.com/CrispStrobe/sb3-creator/tree/2c991d9a590d189eaad66c96951d4815a9f34e29).
Brickwright consumes that exact revision through its compiler sync. The
converter preserves a qualified source subset; it is not a general equivalence
claim for every BBC BASIC program or for ordinary Scratch VM execution.

In the Code tab, select **Portable BASIC ↔ pseudocode** while BBC BASIC and
CrispBASIC are selected. **From blocks** generates explicit portable calls.
Switching between BASIC and pseudocode uses the qualified reader. A saved
portable pseudocode file can regenerate BASIC with its requirement intact.
**Connect Circuit** is a separate execution choice: enable it for pin/time
calls. Ordinary canvas-only BASIC does not need a circuit connection.

From the repository root, save this as `lamp.bw`:

```text
DEVICE UNO
PIN lamp = D13 OUTPUT
PIN button = D2 INPUT ACTIVE LOW

WHEN flag clicked:
  set lamp high
  wait 0.025 seconds
  toggle lamp
  print read button
```

Then convert in both directions:

```sh
node bin/bwlite.mjs convert lamp.bw --to crispbasic --out lamp.bas
node bin/bwlite.mjs read lamp.bas --crispbasic --out lamp-portable.bw
node bin/bwlite.mjs convert lamp-portable.bw --to crispbasic --numbered --out lamp-numbered.bas
```

The sibling producer exposes the same explicit route through `bin/bw.mjs`:
`transpile FILE.bw --to crispbasic` and `read FILE.bas --crispbasic`.

The reverse result begins with this durable source requirement:

```text
# @crispbasic-portable 1
```

**Preserve that line when saving, copying or editing the portable source.**
It records the required runtime, clock and latch semantics. The parser retains
the requirement in project metadata and decompilation writes it back. Duplicate,
malformed and unknown versions refuse. Marked source cannot be exported through
generic Blocks/SB3, C, JavaScript, Python, MicroPython, retargeting or flashing
paths. **To blocks** retains its refusal boundary. Recompile it with explicit
CrispBASIC mode and run with a fresh portable host and the same pin model.

| Qualified reverse area | Conditions |
| --- | --- |
| Digital I/O | Static `REM @bw device`/`pin` metadata and matching ordered `PROCpinMode` prelude; proven 0/1 electrical writes, latch toggles and solved reads with ACTIVE LOW preserved |
| Simulation time | Literal integer millisecond delays; `FNmillis` recovered through the portable timer representation |
| Values | Finite numeric literals, lowercase unsuffixed numeric scalars, qualified arithmetic/comparisons and Boolean expressions; quoted literal PRINT text |
| Control flow | Structured IF/ELSE and WHILE, FOREVER, literal-count FOR loops with unobserved private counters, and recognized generated numbered control-flow shapes |
| Canvas source | Clear, known palette helper, pen up/down, integer go-to/set-x/set-y, and direct MOVE/DRAW on the generator's four-unit coordinate grid |

Forward generation accepts more operations than this strict reverse subset.
For example, a forward-generated computed delay can be valid to run yet fail
reverse conversion without an integer/range proof. Arbitrary GOTO, EVAL,
computed pin IDs, dynamic modes, arbitrary non-0/1 writes, typed/string
variables, unqualified expressions, unsupported graphics and modified helper
bodies refuse the whole conversion. Diagnostics identify physical source lines
and numbered BASIC lines when present; no partial pseudocode is returned.
Existing output files are preserved on CLI refusal. See
[GENERATOR.md](GENERATOR.md) for semantics, examples and API contracts.

## Canvas support is independent of source conversion

The interpreter emits raw VDU bytes. Brickwright's canvas preview renders
fixed 40×16 opaque text cells, TAB/cursor movement and DEL, independent text
and graphics background colours, ORIGIN, relative/absolute lines, points,
filled triangles and axis-aligned filled rectangles. Supported geometry uses
PLOT families 0, 64, 80 and 96 with normal foreground/background drawing.

The preview uses a fixed 320×256 canvas and an eight-colour palette. It does
not implement every MODE's dimensions or palette, scrolling, arbitrary raster
actions, graphics queries, sound or the complete VDU protocol. Unsupported
drawing operations and text outside the preview produce visible bounded
diagnostics. A command that can execute and render is not automatically
accepted by the stricter BASIC-to-pseudocode converter.

## Robot motor example and the CAD boundary

The self-contained [robot motor example](examples/robot-motor/README.md) includes
Circuit JSON and BASIC source. Uno D3/D7/D8 drive an H-bridge and a DC motor with
real winding resistance/inductance, back EMF, clamp diodes and viscous friction.
The program drives forward, reverses, brakes, then disables the driver over
825 simulated milliseconds. Qualification observes signed current, speed and
shaft angle, and checks that swapping only the motor leads reverses the physics.

**Stop** during an outstanding delay and an interpreter error both release the
GPIO drives and clock. Pulldowns disable the driver even when circuit power
was already on. Cancellation preserves the rotor state; it does not invent an
instantaneous brake, and abandoned work cannot continue advancing the motor.
Run the real-interpreter qualification after building WASM and installing the
root dependencies:

```sh
node --test packages/crisp-basic/tests/robot-motor.test.mjs
```

CAD body motion and Robot Lab world motion are not connected to this BASIC
host. BASIC and CAD/circuit coupling currently require exclusive ownership of
the same circuit clock. CAD uses reset origins and fixed 5 ms coupling frames;
BASIC preserves existing circuit history and permits individual millisecond
delays. A future coupled adapter needs one clock owner, an explicit sub-5 ms
policy and cancellation/cleanup spanning both electrical and mechanical state.
The existing mutual exclusion remains in place.

## Reproduce and extend the support boundary

After installing the root dependencies and building the required backends:

```sh
npm --prefix packages/crisp-basic test
npm --prefix packages/crisp-basic run test:native
npm --prefix packages/crisp-basic run test:wasm
npm --prefix packages/crisp-basic run test:parity
npm --prefix packages/crisp-basic run test:brickwright
```

Runtime-dependent suites fail when an artifact is missing; they do not turn
missing engines into passing skips. Board-profile additions belong in the
canonical `bw-board` profile module and need terminal, voltage, drive/read and
release checks against registered models. A new native CPU target additionally
needs a real interpreter build and execution tests in that machine's simulator.
Those are different qualification steps, and neither should be inferred from
a new label or a logical register fixture.
