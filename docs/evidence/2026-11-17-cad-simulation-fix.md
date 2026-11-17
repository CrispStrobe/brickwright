# CAD robot startup, solver stability and rendering repair

The preceding native app shipped stale robot archives: the generator updated the
canonical overlay but not webpack's static input. The GUI build consequently
replaced corrected examples with older circuits and programs. This repair makes
archive generation synchronize that input and makes the built-SDK verifier also
check every robot archive and the manifest against the canonical files.

Complete robot examples now restore Widgets before Run without mounting Circuit
or Controls. The shared GUI owns restoring and collecting the live panel state;
a late Circuit view no longer resets it. Run keeps an open Controls drawer open.
All six examples provide nonzero initial commands and only rewrite outputs when
an input changes. Loading an example replaces the coherent CAD/Code/Blocks/
Circuit/Widgets bundle after confirmation. Existing saved projects remain intact;
reopen Examples to acquire the corrected model version and program.

The new example circuits use paired dual-driver channels and a documented
functional DC model: resistance, back-EMF, current, torque and driver saturation
are retained; winding inductance and flyback diode transients are omitted. These
examples are for robot control, not winding or switching-waveform analysis.
Detailed circuits can still be edited at higher computation cost. The interface
shows this scope and the measured real-time factor.

The new CAD robot templates explicitly disable self collisions inside their
joint-connected assembly. Ground and separate object contacts remain active;
world settings can restore self collisions. This avoids internal detail/clearance
contacts fighting motor constraints in these interactive presets. It does not
qualify internal clearances. Legacy documents keep their previous behavior. No
actuator impulse guard, CCD rule or solver error threshold was relaxed.

Profiling then found duplicate rendering for pose and trace updates. These now
share a browser animation-frame invalidation, including transform-gizmo changes.
Electrical and sensor feedback still runs at 200 Hz; final poses/traces are drawn
together. A two-second WebKit Helios baseline had 132 scene draws, 74 within an
already-rendered animation frame. The post-change measurements are in the receipt.

Verification details and native artifact identity are recorded in
[the receipt](../receipts/2026-11-17-cad-simulation-fix.json). The initial six-second
WebKit run passed all six examples with untouched controls, Controls closed for
first Run and open on restart, Center controls, Stop and Reset. Helios reached
approximately 1x in that run; Atlas remained substantially slower than real time.
Browser proofs exercise the actual built GUI, VM, electrical solver and Jolt, not
simulation doubles. Native window behavior is a separate verification scope.

No GitHub Actions were dispatched, awaited or rerun. Purchased board/battery
visual details are a separate paused change; none are claimed by this repair.
