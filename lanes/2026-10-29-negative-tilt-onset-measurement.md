# Tilting tower first-crossing measurement

Status: IMPLEMENTED — pure observer controls complete; affected actual-native qualification and current-head CI pending. No repaired-physics claim.
Owner: Codex, user-authorized Robot Lab measurement and physics continuation.
Base: `00f38286b12fab3a611df0c7d34f4a364bece863`.

The existing tower validation checks its relative-angle tip predicate after a
500 ms hold. On the current qualified bw.9 library, the negative case reports
-7.672831 degrees against a rounded-support critical angle of 6.977503 degrees
and the unchanged 0.5 degree error limit. Preserve that original failure.

A separate source-bound negative-only capture saved every original 5 ms native
step before that assertion. Independent saved-data analysis finds the first
strictly greater than 5 degree relative tilt at 3.195 seconds, during the hold,
when the physical table angle is -7.289738 degrees. Its critical-angle error is
0.312235 degrees; the late check instead has 0.695328 degrees error. This
identifies different measurement times, without establishing that every
remaining physical behavior or either direction is qualified. Supporting
consumer status is recorded in [PR 1553](https://github.com/CrispStrobe/brickwright/pull/1553).

Own only the tilting-tower measurement in `test/bw-sim-validation-2.test.mjs`,
focused first-crossing controls in a new `test/helpers/tilt-onset.mjs` and
`test/tilt-onset.test.mjs` if a shared detector helps, this claim, and a new
`docs/ROBOT-TILT-ONSET-QUALIFICATION.md`. Other validation cases and their helper
behavior remain unchanged. Do not change product physics, native or JavaScript
engine source, dependency pins, firmware, model/catalogue geometry, collision
policy, controller parameters, command arguments, programme timing, the 40
command limit, the strict 5 degree relative-tip predicate, or the 0.5 degree
critical-error assertion.

Measure the first actual completed-step crossing in both directions with the
existing source-bound pose convention and without quaternion normalization.
Retain the late sample as a diagnostic; never overwrite an earlier crossing
with a later wrapped falling orientation or call that a recovery. A missing
crossing, missing observation, early termination or nonfinite pose must refuse.
Do not make an unobserved positive-direction result pass by analogy.

Before source implementation, merge this claim through every enabled exact-head
check, with only declared skips, a normal matched-head merge and exact parent
and tree preservation proof. Then require meaningful first/late/re-entry and
frozen-output negative controls, both-direction affected clean actual native
qualification at the adopted package and actual source, and all enabled
current-head CI. Preserve original failed source/results and any new failures;
no retuned tolerance, motor input or timing is admitted to get green.

This scope repairs measurement timing if supported by qualification. It does
not accept Twinpoint, Watt, tracked coasting, steering, contact-policy work,
rendered saved projects, physical hardware accuracy, or the overall user loop.

## Implementation checkpoint

The scoped implementation adds a read-only completed-step observer in both
directions and retains immutable first-crossing and separate late-check
diagnostics. The original commands, settle/poll/hold durations, limits, strict
5 degree predicate, critical-angle calculation and 0.5 degree assertion remain
unchanged. Fourteen pure controls and six detected mutations cover the observer;
no engine or VM qualification has run for this candidate. See
[the qualification boundary](../docs/ROBOT-TILT-ONSET-QUALIFICATION.md).
The scope remains owned until affected actual-native qualification and normal
matched-head landing; other owners' physics/model/pin regions are unchanged.
