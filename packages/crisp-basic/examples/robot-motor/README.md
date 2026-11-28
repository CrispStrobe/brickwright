# CrispBASIC drives a simulated robot motor

This example runs the real CrispBASIC interpreter against Brickwright's electrical
Circuit model. Three Uno GPIO signals control an H-bridge, which drives an
inductive DC motor forward and backward. The circuit solver computes winding
current, back EMF, signed rotor speed and shaft angle. BASIC advances that same
solver with `PROCdelay`; the example does not command a separate animation.

## Run in Brickwright

1. Open [circuit.json](circuit.json) in the Circuit designer.
2. Open the BASIC panel, choose **BBC BASIC** and **CrispBASIC (browser)**, and
   paste [source.bas](source.bas).
3. Select **Connect Circuit**, then **Run BASIC**.

The output is:

```text
forward
reverse
brake
coast
Elapsed ms: 825
```

The printed duration is circuit simulation time. Wall-clock execution time
depends on the computer. The program has no wall-clock sleeps.

## Wiring and behavior

| Uno terminal / logical ID | Driver terminal | Purpose |
| --- | --- | --- |
| D3 / `3` | `en1` | Enable channel 1; LOW releases both outputs |
| D7 / `7` | `in1` | Forward input |
| D8 / `8` | `in2` | Reverse input |
| 5V | `vcc` | 5 V supply |
| GND | `gnd` | Common reference |

Each control signal has a 10 kΩ pulldown. The second driver channel is disabled
with `en2`, `in3` and `in4` grounded. Driver `out1` connects to motor `a`; `out2`
connects to motor `b`. Exchanging these two motor leads reverses the actual rotor
direction for the same BASIC program.

| Simulation interval | Enable / IN1 / IN2 | Result |
| --- | --- | --- |
| 0–200 ms | HIGH / HIGH / LOW | Forward drive |
| 200–500 ms | HIGH / LOW / HIGH | Reverse drive after disabling while direction inputs change |
| 500–800 ms | HIGH / LOW / LOW | Both outputs held at the same potential; electrical braking |
| 800–825 ms | LOW / LOW / LOW | Disabled, high impedance outputs; coast |

The model is an L293D-style bridge: each conducting output contributes a 1.4 V
drop and 2 Ω resistance. Its built-in clamp diodes provide a path for the
inductive winding current when an output is released. The motor has 5 Ω winding
resistance, 5 mH inductance, torque/back-EMF constants of 0.05 in SI units,
rotor inertia of 0.00001 kg·m², and viscous friction of 0.0001 N·m·s/rad.

At steady speed, the available 2.2 V balances the winding/output resistance and
back EMF, while motor torque balances friction. These parameters predict about
32.35 rad/s (309 rpm) and 64.7 mA in either driven direction. The qualification
checks these values against the solved circuit, then checks braking below
0.01 rad/s and disabled winding current below 1 µA. It also verifies that
exchanging only the motor leads changes the signs of speed, current and travel.

## Stop, errors and ownership

A completed run, **Stop**, or an interpreter error releases all three GPIO
drives and the circuit clock. The pulldowns disable the bridge even when the
circuit was already powered before BASIC started. The previous circuit power
setting is restored.

Stopping a run does not reset the rotor or pretend that it stopped
instantaneously. Its current mechanical state remains in the circuit; an
abandoned BASIC delay cannot continue advancing it. The normal example brakes
before disabling the driver.

This is host-driven electrical simulation. CrispBASIC executes in its browser
WASM runtime; the Uno component supplies modeled GPIO terminals and logic
voltage. This example does not install an interpreter on an AVR CPU or control
physical hardware. PWM, analog I/O, CAD body motion and Robot Lab world motion
are outside this example. BASIC and CAD/circuit coupling retain their existing
exclusive clock ownership; stop one before starting the other.

## Reproduce the qualification

From the Brickwright repository root, install the pinned dependencies and build
the authenticated WASM interpreter following the [CrispBASIC package
README](../../README.md), then run:

```sh
node --test packages/crisp-basic/tests/robot-motor.test.mjs
```

The test loads this exact saved JSON through `Circuit.fromJSON`, runs this exact
BASIC source in the real WASM worker, and observes the solver after each delay.
It also cancels while the motor is turning and raises a BASIC division-by-zero
error after forward drive. Missing WASM artifacts or dependencies fail the
qualification; the tests do not skip or substitute a register-only model.
