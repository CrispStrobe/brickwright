# CAD motor programs in Brickwright

CAD models can also be driven from Code and Blocks. Enable CAD Editor under
Settings → Workspace, add an articulated model, then add the **CAD models**
extension. The Simulate panel shows each hinge’s saved program port (A, B, …).
Ports remain stable when other motors are deleted; duplicate/insert assigns
unused ports. Existing projects without ports can use their joint IDs or assign
ports in Simulate.

```text
WHEN green flag clicked:
  cad start
  cad run motor A for 720 degrees at 180 degrees per second
  say (cad motor A angle)
  cad stop motor A brake
  cad stop
```

The same commands round-trip through Python/JavaScript (`_cadlab`), pseudocode
and blocks. Execute them using **To blocks** and the green flag. The shared CAD
simulation keeps running when its editor tab is hidden; the VM stop button,
project changes, closing/disabling CAD, and hiding the application stop or cancel
pending control. An unopened editor loads lazily for the first command only if
its setting is already enabled.

Degree commands wait for the simulated encoder, including multi-turn and reverse
travel. Speed is degrees/second, limited to ±720. Power is an ideal speed command
(-100…100% maps to -720…720 degrees/second); it does not model motor voltage,
current, temperature or manufacturer performance. Brake and coast are distinct
finite-torque and free-running actions. `cad status` reports disabled/loading
failures and simulation state. Simulation poses never overwrite saved geometry
or populate the design’s undo history.
