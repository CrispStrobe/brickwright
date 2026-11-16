# Circuit and CAD co-simulation

Enable CAD Editor in Settings → Workspace, open CAD, and expand **Circuit → CAD
connections**. The **Open Scout circuit + CAD example…** button loads one editable
SB3 containing the Uno pin declarations, blocks, pseudocode, wired L293D, 6 V
battery, two yellow TT output-shaft motor models, and the printable Scout rover.
Save the current project before replacing it.

Connect each circuit DC motor to a CAD hinge or lead-screw slider. Select the
motor and joint explicitly. Ratio is rotor revolutions per joint revolution;
slider lead is mm per output revolution. Direction reverses the transmission.
Efficiency reduces delivered motoring work and increases generator-side loss.
Connections use stable part, joint and CAD document IDs; names are display labels.
They travel in the SB3 `cadCircuit` section independently of the device's default-off
CAD preference. Missing or conflicting IDs refuse the run instead of reconnecting
by name. The design and all saved CAD history revisions remain unchanged.

**Run blocks / pseudocode** uses the current VM program. Its waits and pin writes
share the mechanical clock. When connections are enabled, the ordinary green
flag also takes this route. **Run on simulated Arduino** compiles those same
blocks using the existing compiler route and executes the resulting instructions
in the ATmega328P emulator. It does not also execute VM scripts. Edited Arduino
programs need the configured compiler service; no compiler or debug clock is
silently substituted. Stop the circuit debugger or another simulator before
starting. Uno/ATmega328P is the first supported firmware target.

Each 5 ms interval advances electronics/MCU, consumes integrated electrical
motor torque, applies equal and opposite impulses to the physical CAD joint, and
returns measured shaft motion. Resistance, inductance and back-EMF stay in the
circuit solver; the separate free-running motor inertia model is suspended.
Encoders publish actual measured quadrature transitions back onto circuit pins.
The coordinator gates subsequent program frames until mechanics catches up.
Display and UI refreshes occur once per program frame, while shaft/sensor samples
remain at 200 Hz. A slow computer slows the whole experiment rather than letting
program waits outrun the robot. Program time is quantized to a maximum 5 ms
mechanical remainder; AVR instruction overshoot is bounded and checked separately.

Position servos decode the circuit's PWM and use a torque-limited internal position
loop, with a 300 degrees/s target-speed limit and both-body reaction. These are
**ideal position servos**: electrical power draw, thermal behavior and stall current
are not modeled. A servo connection defaults to 90 degrees at a zero-angle hinge.
Ultrasonic sensors can be attached to a CAD body with a local origin, direction and
range. An ideal single collision ray follows that body, ignores its whole fixed
assembly, and supplies the existing trigger/burst/echo model. No hit produces no
echo. It does not model an acoustic cone or surface reflectivity.

Stop removes controller output power and both clock owners. Reset restores the
initial mechanical pose and circuit time. Project replacement, CAD edits, closing
simulation, disabling CAD and hiding the page interrupt the coupled run. Stale
worker replies and old leases cannot restart a stopped experiment or power off a
new owner. Servo drive commands are cleared when their owner releases the clock.

## Limits and validation

### Component and controller coverage

An editable 3D model, an electrical device model, a firmware target, and a
physical CAD feedback connection are separate capabilities. Importing an STL or
STEP file does not create an electrical or behavioral simulation model.

| Component | Circuit support | Coupled CAD support |
| --- | --- | --- |
| DC motor, gearmotor, encoder motor | Winding/current/back-EMF models | Hinge or lead-screw slider, measured shaft feedback |
| L293D / L298N-style driver | Generic dual `h_bridge`: direction, brake/coast, voltage loss and optional clamp diodes | Drives any connected DC motor through the electrical solver |
| ULN2803 | Low-side Darlington array | Can drive circuit loads; no dedicated stepper-to-CAD binding |
| Servo | PWM target decoding | Ideal torque-limited position control |
| Ultrasonic | Trigger/echo protocol | Body-mounted collision ray |
| Stepper, solenoid | Electrical/behavioral device models | No coil-to-CAD actuator binding yet |
| ADXL335, MEMSIC2125, MPU6050 | Sensor models | No automatic CAD acceleration/orientation input yet |
| VL53L0X, AS5600 | Distance/angle device models | No automatic CAD range/joint-angle input yet |
| BMP280, BH1750, TCS34725, INA219, DHT11/22 and other environment sensors | Device models with supplied inputs | No physical environment synthesis yet |

The generic H-bridge is not a complete vendor-specific L298N module: it has no
separate logic-supply domain and uses a supply-relative logic threshold. A 3.3 V
controller therefore cannot be assumed compatible with every motor supply.
TB6612FNG, DRV8833, A4988/DRV8825 and TMC modules do not currently have dedicated
functional models. Existing generic drivers should not be relabelled as those ICs.

Blocks/pseudocode use the VM pin route. The coupled compiled-firmware route is
currently Uno/ATmega328P only. RP2040/Pico emulation and compilation already exist
in the independent Circuit editor, but are not yet accepted by this coupled
runner. Other MCU adapters likewise require explicit integration and qualification;
their presence in the board engine alone does not establish CAD support.

Useful next physical bindings are contact/limit switches, body IMU measurements,
VL53L0X rays, AS5600 joint angles, stepper coil torque and solenoid slider force.
These need units, mounting transforms, timing and load feedback, rather than
simply adding palette icons or visual models.

The demo's DC parameters are an ideal equivalent output-shaft model, not calibrated
manufacturer specifications. Motor constants and mechanical inertia need suitable
values for the 200 Hz coupling interval. A quadrature sample may cross at most
one edge; faster encoder rates are refused explicitly. Armature work excludes the
energy stored in the separate series winding inductance and is not battery energy.

This adds meaningful circuit/mechanics control; it does not claim complete
Tinkercad Sim Lab parity, arbitrary MCU support, deformable bodies, calibrated
motor heating, acoustic sensors, or firmware source-level debugging during the
coupled run. Existing independent CAD program and Robot Lab controls remain
available when circuit connections are disabled.

The reusable physical APIs live upstream in `brickwright-cad`; electrical shaft,
servo and distance ports live in `bw-board`. The host binding, project persistence
and VM coordination live in Lite. No Board/electronics dependency enters CAD.

Local validation commands:

- `node --test test/circuit-cad-*.test.mjs`
- `node scripts/verify-built-cad-sdk.mjs packages/scratch-gui/build-circuit-cad`
- `PROOF_URL=http://127.0.0.1:8134/ node scripts/verify-circuit-cad.mjs`
- `node scripts/qualify-circuit-cad.mjs <built-cad-checkout>` runs the compiled AVR, circuit and CAD together without the GUI.
- Add `--firmware` or `--webkit` for the corresponding browser path.
- In CAD: `npx vitest run tests/actuator-impulse.test.ts tests/tt-rover-physics.test.ts --maxWorkers=1`
- Regenerate the example with `node scripts/generate-circuit-cad-demo.mjs <built-cad-checkout>`.

The final app preserves every manifest-bound SDK byte after webpack's hashing and
minification passes. `verify-built-cad-sdk` checks the packaged output rather than
only the source snapshot, catching broken renamed imports and modified assets.
