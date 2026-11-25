# Robot Lab measurement experiments — 2026-10-25

Status: DONE — all six items qualified and landed in [PR1375](https://github.com/CrispStrobe/brickwright/pull/1375).
Owner: Codex, user-requested six-item continuation. Isolated branch
`lane/robot-measurement-experiments-20261025`, base `23ec908232f6d4c4604ed6f7dcb23b75af19053d`.
The claim merged before implementation. All six items completed qualification;
delivery, experimental model batch, configured API and release lanes remain
with their existing owners.

1. Scene-assisted measurement targets: select and highlight existing part
   identities, preview the definition, preserve editor cancellation and binding
   fences, keyboard selection and supported 2D/3D behavior.
2. Audit existing Jolt and mechanism diagnostics; expose additional dynamics
   only where the observed state supports a documented value and units.
   Unsupported force or torque stays unavailable. No dependency or engine pin
   change, solver tuning or hardware-accuracy claim.
3. Bounded experiment recording, CSV export and comparison of retained runs,
   with simulated timestamps, gaps and source/target identity preserved.
4. Extend authored measurement lessons to existing gear, pulley, spring and
   pneumatic mechanisms; validate targets and expected analytic relationships.
   Do not edit the other owner's experimental model batch.
5. Verify documented material estimates, tracked-vehicle mass/inertia floors
   and steering limitations against current source and independent analytic
   controls. Repair only demonstrated defects within this scope; preserve
   estimates and unresolved physical calibration explicitly.
6. Retain successful measurement browser SB3/JSON evidence and independently
   audit saved bundle bytes, sidecar and source joins after metadata admission.
   Apply retention to new affected qualifications; do not replay old successes.

Path envelope: measurement panel/plots and measurement integration in
`overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-pane.jsx`; helpers in
`overlay/scratch-gui/src/lib/bw-sim/measurements/`; scene-selection integration
in the existing view; read-only diagnostic publication in physics/worker paths
where required; focused tests and existing measurement browser gates; the
measurement gate artifact-upload section of `.github/workflows/build.yml`;
`docs/ROBOT-LAB-MEASUREMENTS.md`, lesson/dynamics and physical-validation docs;
this claim. Generated GUI mirrors follow the established overlay process.
No native/firmware, transport, model API, release, dependency, unrelated CI or
experimental model source ownership is transferred.

Acceptance: real rendered interaction and actual Jolt browser journeys, stable
saved identities and save/reopen, bounded memory/CSV and cross-run controls,
independent analytic expectations and meaningful negative controls, retained
successful originals audited without producer imports or guest replay, every
enabled final-head check admitted, and reviewed/predicted/landed parents/tree.
Keep original failures, thresholds and deadlines. No physical/reference,
performance, signed release or licence-clearance claim follows.


## Implemented boundary

Scene picks and highlights fill the existing draft, preview real geometry and
preserve Cancel, saved identities and stale-model/binding refusal. Gestures,
secondary pointers and Escape have separate negative controls. Committed
acceleration sampling is isolated from overlay and preview rendering.

The dynamics audit adds sampled COM acceleration and existing connected-network
pneumatic gauge pressure. Motor torque, power, energy and total contact force
remain unreported because the current observer does not establish them.
No solver, material coefficient, model geometry or dependency pin changed.
The current tracked-coasting, material and steering limitations are surfaced in
the panel and documented, with original physical-calibration boundaries intact.

Recording supports two bounded runs of four selected readings, at most 600
sample sets or 60 simulated seconds each. Reset restores the recorded model’s plot selection for comparison;
closing the measurement panel stops active capture and preserves completed runs
in its owning pane. Comparisons require the same model and physical definitions
and use exact shared times. CSV preserves gaps, units, source and target identity.

Four additional authored lesson families use checked semantic bindings and
bilingual explanation: gearbox, Sky Courier ropes/pulleys, Snapgate spring and
pneumatic cylinder. Unsupported or changed mechanisms refuse the preset.

The actual browser journey now exercises those lessons, a changing pneumatic
gauge, nonzero scene geometry, sampled moving-body acceleration, two actual
recordings and downloaded CSV, followed by the existing SB3 save/reopen checks.
Successful new qualifications retain four bounded originals for seven days.
A separate Python stdlib reader validates CRCs, saved sidecar/model/definition
joins and CSV source/time/definition joins; it imports neither producer nor Jolt.
Existing assertions and deadlines remain in place.

## Qualified result

[PR1375](https://github.com/CrispStrobe/brickwright/pull/1375) landed normally
at `eef726fe67d505733b31c599a677ab1897f96a94`, with the reviewed parents and
predicted tree verified. Its exact head passed 31 checks, with six declared
conditional skips and no failing or pending checks. All 18 browser shards passed.
The real Jolt measurement journey covered the four new lessons, changing air
pressure, scene picks, preview and Cancel, moving-body acceleration, two recorded
runs, downloaded CSV and project save/reopen.

The four successful official originals were acquired once after metadata
admission. A separate stdlib reader accepted ZIP CRCs, seven saved definitions,
model/sidecar/reopened-definition joins and the actual CI checkout/tree binding.
Both six-sample runs passed independent CSV source, time, unit and definition
joins. Maximum CSV format bounds have separate pure controls. Original failures
and their corrections remain preserved; thresholds and deadlines were unchanged.
No guest replay was used for the byte audit or this status closeout. Material
estimates, tracked coasting and steering limitations remain documented; no
solver tuning, unsupported force/torque or physical-accuracy claim follows.
