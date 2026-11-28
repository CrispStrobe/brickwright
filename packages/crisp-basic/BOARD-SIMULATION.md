# Brickwright Circuit adapter

The Code tab's **BBC BASIC → CrispBASIC (browser)** engine can run the ordinary
pin/time library against the active Circuit board. Enable **Connect Circuit**
before Run. With the option off, the editor keeps its ordinary restricted BASIC
profile and does not acquire a circuit. No physical hardware is accessed.

The implementation belongs to Brickwright's GUI integration, outside the
interpreter package. The package still has no React or `bw-board` dependency.
The adapter consumes `bw-board` revision
[`8be0fbc8e91f1ed2cebb26883210efceef9234cc`](https://github.com/CrispStrobe/bw-board/commit/8be0fbc8e91f1ed2cebb26883210efceef9234cc).
That revision owns the reusable `portable-gpio.js` profile inventory and resolver;
the GUI adapter owns run lifecycle, time, resource limits and cleanup. See
[PORTABILITY.md](PORTABILITY.md) for the distinction between host platforms,
electrical model support and native MCU interpreter ports.

## Selecting a board and pins

The authoritative board is `vm.runtime.circuitBoard`, the same board published
by the Circuit canvas. A missing or rejected circuit produces an actionable
failure. The adapter never creates an inferred replacement bench. The circuit
must contain exactly one supported GPIO controller; ambiguous multi-controller
circuits and unsupported controllers are refused.

The 16 admitted profiles define these logical pin numbers:

| Circuit kind | BASIC logical IDs | Circuit terminals | Modeled logic supply |
| --- | --- | --- | --- |
| `mcu` | `8 × port + bit`, ports/bits `0..7` | `Pport.bit`, such as `P1.0` → `8` | Bench voltage |
| `arduino_uno` | `0..13`, `14..19` | `d0..d13`, `a0..a5` | 5 V |
| `arduino_nano` | `0..13`, `14..19` | `d0..d13`, `a0..a5` | 5 V |
| `arduino_mega` | `0..53`, `54..69` | `d0..d53`, `a0..a15` | 5 V |
| `pi_pico` | `0..22`, `25..28` | Corresponding `gpN` terminals | 3.3 V |
| `microbit` | `0..2` | `p0..p2` | 3.3 V |
| `microbit_breakout` | `0,1,2,8,12,16` | Corresponding `pN` terminals | 3.3 V |
| `calliopemini` | `0..3` | `p0..p3` | 3.3 V |
| `circuit_playground_express` | `0..7` | `a0..a7`; no Arduino analog offset | 3.3 V |
| `esp8266` | `0..5`, `12..15` | Corresponding `gpioN` terminals | 3.3 V |
| `esp32_4848s040` | `1,2,40,43,44` | H1 `gpio1`, `gpio2`, `gpio40`, `gpio43`, `gpio44` | 3.3 V |
| `attiny85` | `8..13` | `pb0..pb5` | 5 V |
| `attiny88` | `8..15`, `16..23`, `24..31` | `pb0..pb7`, `pc0..pc7`, `pd0..pd7` | 5 V |
| `attiny88_qfn32` | `0..3`, `8..15`, `16..23`, `24..31` | `pa0..pa3`, `pb0..pb7`, `pc0..pc7`, `pd0..pd7` | 5 V |
| `stm32f030` | `0..7`, `9,10,17` | `pa0..pa7`, `pa9`, `pa10`, `pb1` | 3.3 V |
| `eater6502` | `0..7`, `8..15` | `via1.pa0..via1.pa7`, `via1.pb0..via1.pb7` | 5 V |

Only admitted terminals actually exposed by the controller are included. Power,
ground and reference pads are excluded, as are Nano A6/A7, Pico GP23/24/29,
ESP8266 flash pins/GPIO16 and STM32 boot/reset/crystal/SWD pads. The ATtiny
electrical models expose some reset-capable port pads; the host does not model
reset or fuses. Generation uses a stricter map and excludes ATtiny85 PB5 and
ATtiny88 PC6. These host profiles also do not imply matching `DEVICE` syntax:
ESP32-S040 and ATtiny88 QFN-only PA pins currently require authored BASIC.

The resolver matches complete canonical terminal names without case sensitivity.
Duplicate logical aliases refuse. Unverified kinds and missing/incompatible
registered models refuse rather than falling back to a generic controller.
Unknown pins are rejected; IDs are never clamped or redirected. A 3.3 V model
keeps its modeled output voltage on a 5 V bench.

The host exposes frozen `controller`, `profile`, `pins` and `pinMap` capability
records. Profile metadata includes the label, numbering/help, nominal voltage,
`execution: 'host-driven-circuit'`, `hardware: false` and
`nativeInterpreter: false`. This is a library/electrical-model contract; it
does not run CrispBASIC on the component's CPU or use package-pin numbering.

## Drive and sense semantics

The portable library provides six BASIC calls:

| Call | Circuit behavior |
| --- | --- |
| `PROCpinMode(pin, "input")` | Release the GPIO drive to high impedance. |
| `PROCpinMode(pin, "input-pullup")` | Use the solver's input pull-up mode. |
| `PROCpinMode(pin, "output")` | Apply the retained output latch using the solver's push-pull drive. |
| `PROCdigitalWrite(pin, level)` | Set numeric `0` or `1`; requires output mode. |
| `PROCdigitalToggle(pin)` | Invert the retained electrical output latch and apply it to the solver; requires output mode. |
| `FNdigitalRead(pin)` | Read the solved electrical level, including when configured as an output. |
| `PROCdelay(milliseconds)` | Cooperatively advance the circuit by the requested integer milliseconds. |
| `FNmillis` | Read integer milliseconds elapsed since this BASIC run acquired the board. |

Each run starts its mapped pins as inputs with zero output latches. Changing a
mode retains that run's latch. A pull-up is an electrical source in the solver,
so an external switch to ground can override it. A read uses the pinned solver's
digital threshold, currently **strictly greater than 1.5 V** for high. Output
reads therefore sense the net; the standalone reference host instead reads its
logical latch. An unconnected circuit input follows the solver's regularized
electrical solution; the reference host's `floating-input` stimulus rule does
not establish a circuit floating-net detector.

Toggle uses the output request, even when a clamp makes the solved net disagree
with that request. For example, a high latch held electrically low toggles to a
low latch. It never inverts `FNdigitalRead`. ACTIVE LOW is a generator-level
logical interpretation; it does not change this electrical latch operation.
Successful writes and toggles update the same retained latch. A successful
toggle consumes one request and one `digital-toggle` trace record containing
`pin`, `terminal` and the resulting `value`; it performs no read and advances no
time. Pin, mode and trace-budget refusals occur before driving the solver.
Unexpected solver failures retain the ordinary host-error and cleanup behavior.

These operations exercise the solver's existing electrical models. They do not
qualify MCU-specific thresholds, timing or physical-device fidelity. Analog
reads/writes, PWM, interrupts and peripheral protocols are not exposed by this
library.

## Time, responsiveness and resource limits

Starting BASIC preserves circuit component state and the solver's absolute
time. The host records that time as its origin, so `FNmillis` initially returns
zero even when the Circuit was already running. There is no implicit circuit
reset. Pin operations and reads do not advance time. `PROCdelay(0)` does not
invent elapsed time. BASIC's existing `TIME` and `WAIT` remain separate.

Positive delays repeatedly call `advanceToLive` in small batches, verify its
reported progress against the board clock and yield to the parent event loop
between batches. A request returns only after the solver reaches its requested
time. The continuation checks cancellation and board ownership before every
deferred effect. Simulation runs as fast as the bounded solver work permits;
`PROCdelay` does not promise wall-clock pacing or CPU cycle timing.

The adapter has cumulative per-run limits:

| Resource | Default |
| --- | ---: |
| BASIC host requests, including `FNmillis` | 4096 |
| Retained host trace records | 4096 |
| Elapsed simulation milliseconds | 60000 |
| Solver scheduling steps | 65536 |
| Steps per cooperative batch | 16 |

The existing editor wall-time deadline of 60 seconds and input/output bounds
also remain active. Trusted embedding configuration can lower or change the
documented host limits within their validated ranges. A solver step is one
bounded scheduling interval; it is not a count of all internal matrix operations
or a hard CPU-time bound. Synchronous solver work must still return to the event
loop. The underlying solver retains its own convergence and integration limits.

Time and trace budgets are checked before their corresponding operation's
effects. A cumulative solver budget can end a delay after partial progress;
already accepted electrical history is not rolled back. Such exhaustion uses
`solver-limit`, a parent-owned `simulation-limit` outcome. `ON ERROR` cannot
catch it or renew its budget. Unexpected solver exceptions or malformed solver
receipts produce `host-error`.

## Ownership and cleanup

The GUI obtains the Circuit view's clock handoff before creating the host. The
host then claims the solver's external-clock lease. Competing simulators and
debuggers must relinquish the board before a connected BASIC run can start.
The run owns the captured board and lease; it never follows a replacement board
silently.

Stop, Reset, unmount, accepted project replacement, circuit edits and other run
invalidation revoke the connection. Normal completion and errors also dispose
the host. Pending work checks cancellation before advancing or driving again.
Cleanup releases the run's pin drives to input and releases its own clock
handoff. An external GPIO write cancels BASIC, preserves that externally written
terminal and releases BASIC's other pins. External power changes are preserved;
otherwise cleanup restores the captured power state while its lease and topology
remain valid. Stale cleanup cannot release a later run's lease or mutate a
replacement board. The final trace remains available to its owner after disposal.

The captured Circuit model revokes BASIC before it saves undo history or
rebuilds the solver. This ordering matters because the model transfers the old
board's snapshot, including GPIO, into a replacement. Cleanup therefore finishes
before either rebuild path or a history snapshot can copy BASIC's temporary
drives and power. Read-only board snapshots and circuit exports still expose
the current state without ending the run. The guards apply only to that captured
model and restore its original methods after successful cleanup.

If a model mutation reenters a synchronous solver/cleanup callback, it is refused
until cleanup has unwound. A cleanup failure remains visible and blocks repeated
mutations of that captured model, rather than allowing a later retry to copy an
unreleased drive. Another BASIC session cannot install over a pending or failed
cleanup guard. A later run can use the model normally after successful cleanup;
stale callbacks cannot remove its guards or restore an earlier owner's methods.

The BASIC Reset control clears BASIC output and ends the active connection. It
does not rewind capacitors, motors, circuit controls or the solver clock. Use
the Circuit's own reset when a fresh electrical history is required. The next
BASIC run receives new zero latches; it cannot inherit the previous run's
output request.

## Example

Open a supported Uno or Nano circuit and enable **Connect Circuit**. The
[circuit blink example](examples/circuit-blink.bas) drives logical pin `13`
(D13) for four pulses, advances 2000 simulated milliseconds, and prints:

```text
Simulated 2000 ms
```

For a switch on D2 connected to ground:

```basic
PROCpinMode(2, "input-pullup")
PRINT STR$(FNdigitalRead(2))
END
```

The electrical pull-up reads high while the switch is open and low when it is
closed. An external resistor/LED on D13 must be wired into the same Circuit
board. The code generator's default hardware comments remain comments. Select
**Portable BASIC ↔ pseudocode** and then **From blocks** for the explicit
portable generation mode, including `toggle` as `PROCdigitalToggle`. See
[GENERATOR.md](GENERATOR.md) for its pin maps, polarity rules and refusals.

The [robot motor example](examples/robot-motor/README.md) supplies a complete
saved Circuit and BASIC source. It drives an H-bridge and an inductive DC motor
forward, reverse, brake and coast. The test loads the same Circuit JSON and runs
the actual WASM interpreter while checking current, signed speed, shaft travel
and cancellation. Pulldowns disable the driver after Stop or an interpreter
error even if the circuit was initially powered. Stop preserves residual rotor
state; it does not reset or instantaneously brake the motor.

### CAD and Robot Lab boundary

CAD/circuit coupling and BASIC each require exclusive ownership of the circuit
clock, so they cannot run together through these adapters. CAD coupling uses
reset origins and fixed 5 ms mechanical frames; BASIC preserves existing circuit
history and supports individual integer-millisecond delays. Direct integration
needs one shared clock owner, a defined policy for sub-5 ms delays and cleanup
across both electrical and mechanical state. The robot example qualifies the
electrical motor model, without CAD body or Robot Lab world motion.

## Qualification scope

Focused tests use the actual pinned solver, the actual compiled BASIC runtime
and the editor's production lifecycle/control seams. They check fixed
electrical/time results as well as cancellation, ownership and resource bounds.
The latch tests include a high output request clamped to a low electrical read,
mixed writes and toggles, retained state across modes, fresh-run state, and
refusals before mutation. Generated active-low toggle is also exercised in the
production scenario set.
The canonical profile tests check every admitted model terminal against the
registered models, including voltage, drive, release and sensing. Consumer tests
exercise all newly admitted controller kinds through the GUI-owned host, and the
robot test additionally verifies current/velocity against a steady-state oracle,
reversed motor leads, Stop during a delay and interpreter-error cleanup.
The production gate additionally builds the full webpack workbench and drives
its real editor and Circuit file controls in Chromium. See
[VALIDATION.md](VALIDATION.md) for the exact revision, commands and observed
results. Complete VDU implementation and physical-board behavior remain outside
these qualifications.
