# Actuator closed-loop positional precision

Status: DONE (investigation) — 60-step experiment rejected; previous setup restored.
Owner: Codex, user-authorized Robot Lab gap closure.
Base: `b26ae0aedde4e53a254b0bc48c83b156be7cb026`.

The crane's unchanged lift and hook-angle checks still fail after removing the
observed boom/actuator contacts. Retained fixed-step poses show loaded anchor
and axis errors in the closed actuator loop, without recognized clutch slip.
A source calculation gives the connected B motor a 39-position-step override;
the screw slider currently requests 10, so a change to 20 would not increase
the documented island maximum. This supports investigating numerical closure,
not attributing the remaining error to a proven cause.

Scope: only the bounded actuator position-iteration override and its explanation
in `overlay/scratch-gui/src/lib/bw-sim/physics/screw.js`, focused setup controls
in `test/bw-sim-screw-clutch.test.mjs`, affected existing actuator and crane
regressions in `test/bw-sim-linear-actuator.test.mjs` and
`test/bw-sim-crane.test.mjs`, the actuator explanation in
`docs/ROBOT-LAB-ARCHITECTURE.md`, and this claim. Evaluate a fixed 60-step
screw-constraint position override, above the motor's existing 40-step cap.
Other constraints may request a higher island maximum. Do not change global
solver defaults or motor iteration rules.

Preserve timestep, velocity iterations, mass/inertia floors, physical parameters,
clutch threshold and averaging, targets, coupling ratios, checkpoint schema,
program, model geometry, all existing accuracy/motion assertions and every
per-case and outer time/resource limit. No pins, workflow, API, native, pane,
registry or unrelated model changes. No physical calibration or performance
claim follows from higher solver precision.

Merge this claim before implementation. Keep the failed original results.
Require focused setup controls with a meaningful mutation, fresh clean affected
hosted Jolt actuator/crane qualification using the unchanged motion oracles,
independent retained-original review without producer imports or guest replay,
every enabled exact-head check and normal matched-head landing with exact
reviewed/predicted/landed tree and parents. Increased precision must fit existing
budgets; a failure is retained and blocks landing.

The fixed 60-step experiment in `3e224535` failed hosted qualification. Unit6
reported two actuator clutch regressions and excavator yaw above its unchanged
10-degree bound. The crane also retained an alignment failure and failed its
removed-counterweight stability control. The source and original failures are
retained in [the official run](https://github.com/CrispStrobe/brickwright/actions/runs/40271880462).

The experiment is withdrawn: the product restores the previous 10-step screw
position request, velocity setup and ten pre-existing clutch controls byte for
byte. The added setup control for the withdrawn 60-step feature is removed;
existing physical motion checks, thresholds and limits are unchanged. This
investigation establishes neither convergence nor a physical calibration. Fresh
combined qualification remains mandatory for the crane design continuation.
