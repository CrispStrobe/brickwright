# Edit saved Robot Lab measurements

DONE — qualified implementation and normal merge — Codex,
user-authorized measurement usability follow-up, 2026-10-24.
Isolated branch `lane/robot-measurement-editor-claim-20261024`, claim base
`835e96acb9557df07f8e7eb0797b895bded9592a`.

The existing panel already supplies recommendations, units, provenance and
saved definitions. Add an explicit Edit action so a saved measurement can be
renamed or retargeted without removing and recreating it. Keep its stable ID,
visibility and plot selection. Recompute joint or rope bindings through the
existing readers, and let existing definition-change handling reset affected
plot history. Saving an edit at the 64-definition limit must remain possible.
Cancel must leave the saved definition untouched; model or definition replacement
must not apply a stale draft to another target.

Own only the measurement editor in
`overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-measurements.jsx`,
its focused `test/bw-sim-measurements-ui.test.mjs` controls (and, if useful, a
dedicated measurement-editor test), the measurement-interaction portion of
`scripts/lib/sim-lab-simulate-ux-gate.mjs`, `docs/ROBOT-LAB-MEASUREMENTS.md`,
and this claim. Preserve all existing browser assertions and deadlines.
Generated GUI integration follows the established overlay mechanism.

The live-measurement, refinement and plot implementations are already landed.
The current renderer/native/model integration retains its separate owners and
frozen qualification heads. The initial claim was prose only; implementation started
from their qualified main after that integration landed. No schema, persistence
format, physics, solver, native session, transport, dependency pin or workflow
change is in this envelope.

Qualification: exercise the actual rendered component handlers for edit/save,
cancel, the full definition limit, visibility and ID preservation, changed
joint/rope bindings and stale-model refusal. Use meaningful negative controls
for replacement rather than duplication and binding refresh. Run the affected
real browser/Jolt measurement journey and saved-model round trip against the
new source-bound frontend, plus every enabled exact-head check. A matched-head
merge requires reviewed/predicted/landed tree and parent equality. Keep prior
failures and existing limits; no hardware-accuracy or release claim follows.

## Qualified implementation and controls

Implementation started from qualified joint main
`1825cf0308d3ba0e217a3117fedefbe959cab8c8`, including the merged claim.
The panel reuses the existing form and change callback. It preserves measurement
identity and current visibility, checks current model and target identity at
Save, and requires explicit confirmation of a legacy or mismatched joint/rope
binding. Opening or canceling an edit does not migrate saved definitions.

Eleven local controls exercise the actual constructor and editor actions at a
controlled state callback boundary. Three targeted callback/focus mutations are
detected with all eleven controls running. The earlier seven edit-guard mutations
and original failures are retained. Preset actions remain immediate when no draft
is open; an active draft clears before a preset callback, with focus restored to
its row. The existing lesson-preset assertion is unchanged.
These controls do not qualify ReactDOM, browser behavior or guest physics.

The existing real React UI controls are extended, and the real measurement
browser journey now edits targets through controls, checks stable IDs and plot
selection, independently checks the selected hinge binding, inspects the saved
project sidecar and reopens the generated project. Untouched automatic names
follow quantity and locale changes without becoming stale custom labels.
All 19 affected actual React/Babel controls passed without failures, skips or
TODOs on the corrected source. The original failed lesson-preset assertion is
byte-for-byte unchanged and now passes, together with the new deferred callback
control. The original 17-of-18 failure remains preserved.

The source-bound official RobotLab job passed the real Jolt Edit/Save/Cancel
journey, stable IDs and plots, fresh target binding, and downloaded-project CRC
and sidecar checks before actual reopen. An independent reader admitted the
retained successful log. The observed checkout `2fb2726d` joins to tree
`7652ba23` through Git commit metadata and an independently computed merge tree.
Successful JSON/SB3 files are not retained by the existing workflow; no separate
independent audit of original saved-project bytes is claimed.

[PR1339](https://github.com/CrispStrobe/brickwright/pull/1339), reviewed head
`e774a119d5f4603e17c735ae1980f7ae27ec6862`, merged normally as
`2351457441a5188247ba3600d9192583d735ccda` after all 28 enabled checks passed,
with seven declared skips and no external legacy statuses. The actual parents
`176e88ea` and `e774a119`, and tree `f48b6757`, matched the reviewed prediction.
The five editor entries match the reviewed candidate, every other current-main
entry is preserved, and all 49 qualified API paths remain exact. Production GUI
inputs match the accepted CI composition; the branch tree, CI tree and landed
tree retain their distinct identities.

The implementation and qualification scope is complete. This status update is
prose only. No package, schema, persistence format, physics, workflow, new
installed-native package, deployed API, release or hardware/physical-accuracy
claim follows from this editor result.
