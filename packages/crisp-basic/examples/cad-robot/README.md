# BASIC drives the saved Scout CAD robot

[source.bas](source.bas) runs the shipped
[Scout encoder project](../../../../overlay/scratch-gui/static/circuit-cad/scout-encoder.sb3)
through the actual CrispBASIC interpreter, Circuit electrical solver and CAD
physics worker. The project already contains the robot, circuit and saved motor
connections; this example does not require a second copy of its CAD document.

## Run in Brickwright

1. Use a build with CAD enabled (`BW_ENABLE_CAD=1`) and the packaged CrispBASIC
   engine. In the File menu, choose **Load from your computer** and open
   `scout-encoder.sb3` from the link above.
2. Open the CAD Editor so its saved design and simulation controller are ready.
   The project's saved Circuit-to-CAD motor connections must remain enabled.
3. In Code, select **BAS → BBC BASIC → CrispBASIC (browser)** and open or paste
   `source.bas`.
4. Select **Connect Circuit** and **Connect CAD motors**, then **Run BASIC**.

The program drives both H-bridges forward and reads an encoder input. Its three
delays total **205 ms**: 2 ms, 3 ms and 200 ms. `FNmillis` prints 205 (with BBC
BASIC's normal numeric padding). The encoder reading depends on the resulting
shaft position; it is not a fixed expected output value.

| Logical Uno pins | Saved circuit role |
| --- | --- |
| 5, 6 | H-bridge enables |
| 8, 9 and 10, 11 | Direction inputs for the two motors |
| 2, 3 | Encoder inputs |

## One owner for electrical and mechanical time

Electrical operations take effect at the exact requested integer millisecond.
The adapter accumulates motor torque over each **5 ms** mechanical interval and
applies its impulse through the saved joints. The first 2 ms delay does not
invent a mechanical step; the following 3 ms completes the first interval. This
program completes exactly **41 mechanical steps**.

Each BASIC run starts `FNmillis` at zero while retaining the existing electrical
and mechanical state. Run the program again to continue the same world. A
second complete run adds another 205 ms; it does not restart the robot or reset
its pose and velocity.

**Stop** releases BASIC's GPIO drives immediately and awaits any physics command
already submitted. It then reconciles that command's final snapshot and releases
the clock without adding another motion step. The world remains paused and can
be acquired by the next run. Residual motor velocity is preserved, rather than
being replaced by an artificial brake. Use the Circuit and CAD reset controls
when a fresh physical state is wanted; BASIC Reset clears BASIC output and ends
its connection.

A run ending between mechanical boundaries retains its exact electrical time
without rounding up or submitting a partial mechanical step. Mechanics is
quantized to 5 ms; the two clocks are compared relative to their captured
origins. BASIC `TIME` and `WAIT` retain their separate interpreter semantics;
use `PROCdelay` for the shared simulation clock.

## Reproduce the complete pipeline check

From the repository root, install the pinned dependencies, stage a valid WASM
build and the pinned CAD SDK, then run:

```sh
node --test test/crispbasic-cad-physics.test.mjs
```

The tests execute the saved project with the real interpreter, solver and
shipped geometry/Jolt worker. They check forward and reversed motor leads,
movement of the free robot body, same-world reacquisition, and Stop after a
physics step has actually been submitted. The production editor gate loads the
same `.sb3` through the visible File menu and checks repeated runs and Stop.

This example qualifies the saved Scout's motor/joint path. Physical hardware,
native MCU execution, Robot Lab worlds and general robot-controller fidelity
remain outside this qualification. See [BOARD-SIMULATION.md](../../BOARD-SIMULATION.md)
for ownership, limits and electrical pin semantics.
