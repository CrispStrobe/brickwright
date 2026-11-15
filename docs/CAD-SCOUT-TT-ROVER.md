# Scout TT rover in Brickwright Lite

The [Scout TT kit in Brickwright CAD](https://github.com/CrispStrobe/brickwright-cad/tree/feat/printable-robot-20261115/examples/scout-tt-rover)
provides the editable robot model and build guide. Its Lite demonstration is
`lite/tt-rover.sb3`, containing the assembled model, both motor drives, a
ready-to-run block program and redistribution notices. The kit is stored with
the CAD project; access follows that repository's permissions. You can also
create the demonstration locally using the command below.

## Run the example

1. Use a Brickwright Lite build containing the CAD Editor and the SDK recorded
   in the demonstration's `manifest.json`.
2. Choose **Settings → Workspace → CAD Editor** and enable it. This is a device
   preference; opening the example does not change it.
3. Choose **File → Load from your computer** and select `tt-rover.sb3`.
4. Open the **CAD** tab to inspect the assembly. Then press the green flag. The
   program drives forward, brakes, pivots, brakes, reverses and stops. The VM
   stop button also stops pending CAD commands.

Port **A** drives the left wheel and **B** the right. Both axes use the same
orientation, so equal positive speeds drive forward. The demo starts both
speed commands before each wait; a degree command waits for one wheel and is
not suitable for starting both wheels in sequence.

The full editable program is `tt-rover-program.txt` beside the SB3.
It is already compiled into the SB3. To change it, use the Code tab and
**To blocks**, or edit the existing **CAD models** blocks directly. The CAD
simulation continues when its tab is hidden. Disabling CAD or hiding the
application stops pending control.

For a separate CAD import, use `tt-rover.bcad` beside the SB3. The PLA print
parts, fit gauge, bill of materials and assembly guide belong to the
[Scout TT print kit in Brickwright CAD](https://github.com/CrispStrobe/brickwright-cad/tree/feat/printable-robot-20261115/examples/scout-tt-rover).

## What the demo establishes

The program operates the CAD simulation's ideal wheel actuators. It does not
send commands to a physical Adafruit controller, and the stock TT motors have
no physical encoders. Simulation angles and timing do not establish a real
robot's distance, speed, torque or battery performance. The physical build
remains a prototype that needs the fit-gauge and motor-cradle checks in the
assembly guide.

Original robot geometry and the program use BSD-3-Clause. The assembly includes
Adafruit TT motor mesh derivatives under MIT. Both full notices are in this
demonstration directory and inside the SB3 under `brickwright/licenses/`; the BCAD retains
its exact vendor source/provenance records.

## Recreate the files

From a prepared Lite checkout, after pinning the intended clean CAD SDK:

```sh
node --import ./scripts/lib/register-gui-scope.mjs \
  scripts/create-cad-rover-project.mjs \
  /path/to/brickwright-cad/examples/scout-tt-rover/scout-tt-rover.bcad \
  artifacts/cad-rover
node --import ./scripts/lib/register-gui-scope.mjs \
  scripts/verify-cad-rover-project.mjs artifacts/cad-rover
```

The generator validates the model with the shipped SDK, preserves its exact
bytes in the sidecar, and records hashes for the distributed files. The checks
in `test/cad-rover-project.test.mjs` cover packaging and the A/B program; the
verification command checks the generated example's exact source, notices and
hashes against the currently pinned SDK. Native apps need to be rebuilt to
include a newly pinned SDK.
