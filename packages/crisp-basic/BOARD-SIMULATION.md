# Brickwright Circuit adapter

The Code tab's **BBC BASIC → CrispBASIC (browser)** engine can run the ordinary
pin/time library against the active Circuit board. Enable **Connect Circuit**
before Run. With the option off, the editor keeps its ordinary restricted BASIC
profile and does not acquire a circuit. No physical hardware is accessed.

The implementation belongs to Brickwright's GUI integration, outside the
interpreter package. The package still has no React or `bw-board` dependency.
The adapter uses the existing pinned `bw-board` revision
`cc18f3c8d84d68e008450e65ddf838b8ec03c7f7`; this change does not move the pin or
modify the solver.

## Selecting a board and pins

The authoritative board is `vm.runtime.circuitBoard`, the same board published
by the Circuit canvas. A missing or rejected circuit produces an actionable
failure. The adapter never creates an inferred replacement bench. The circuit
must contain exactly one supported GPIO controller; ambiguous multi-controller
circuits and unsupported controllers are refused.

Logical pin numbers have these meanings:

| Circuit controller | BASIC logical IDs | Circuit terminals |
| --- | --- | --- |
| Arduino Uno / Nano | `0..13`, `14..19` | `d0..d13`, `a0..a5` |
| Arduino Mega | `0..53`, `54..69` | `d0..d53`, `a0..a15` |
| Raspberry Pi Pico | `0..22`, `25`, `26..28` | Corresponding `gpn` terminals |
| STC-style `mcu` | `8 × port + bit`, ports/bits `0..7` | `Pport.bit`, such as `P1.0` → `8` |

Only terminals actually exposed by that controller are included. Power, ground,
reset and reference pads are excluded. Nano's analog-only A6/A7 are excluded.
Unknown pins are rejected; values are never clamped or redirected to another
terminal. The host exposes a frozen controller/pin-map capability record for
inspection. This mapping is a library contract, not a CPU register interface or
package-pin numbering scheme.

## Drive and sense semantics

The five BASIC calls are unchanged:

| Call | Circuit behavior |
| --- | --- |
| `PROCpinMode(pin, "input")` | Release the GPIO drive to high impedance. |
| `PROCpinMode(pin, "input-pullup")` | Use the solver's input pull-up mode. |
| `PROCpinMode(pin, "output")` | Apply the retained output latch using the solver's push-pull drive. |
| `PROCdigitalWrite(pin, level)` | Set numeric `0` or `1`; requires output mode. |
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
the Circuit's own reset when a fresh electrical history is required.

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
board. The code generator's existing hardware comments remain comments; this
milestone executes authored library calls without changing generator semantics.

## Qualification scope

Focused tests use the actual pinned solver, the actual compiled BASIC runtime
and the editor's production lifecycle/control seams. They check fixed
electrical/time results as well as cancellation, ownership and resource bounds.
The production gate additionally builds the full webpack workbench and drives
its real editor and Circuit file controls in Chromium. See
[VALIDATION.md](VALIDATION.md) for the exact revision, commands and observed
results. Complete VDU implementation and physical-board behavior remain outside
these qualifications.
