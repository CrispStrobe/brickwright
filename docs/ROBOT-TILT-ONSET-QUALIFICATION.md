# Tilting-tower onset measurement

The measurement source is implemented under [the merged claim](../lanes/2026-10-29-negative-tilt-onset-measurement.md)
and [PR 1556](https://github.com/CrispStrobe/brickwright/pull/1556).
Only pure observer controls have run for this candidate. Both-direction actual
native qualification, the adopted package/source join and current-head CI remain
pending. The claim merge establishes ownership; it does not qualify an app tree.

## What is measured

The existing test tilts the table in both directions using the original
`runForDegrees('A', 0.5, 20 * dir)`, 300 ms settle, at most 40 commands, at most
40 polls of 50 ms per command, and a full 500 ms hold after each poll sequence.
The callback of the existing `tick` helper runs after each original
`bridge.step()`. It reads poses without changing the bridge, hub, motor command,
promise publication, or elapsed simulation time. Even if a crossing occurs
inside a poll or hold, that already-started poll sequence and full hold finish.

The observer retains the **first completed step** where
`Math.abs(towerTilt - table) > 5`. It uses the original quaternion rotation and
wrapped tower-angle convention, with no quaternion normalization. The first
sample is immutable and cannot be replaced by a later falling orientation,
wrapped angle, re-entry, or late hold check. Samples count the settle steps too;
command indices in the diagnostic start at zero. `core.time` is recorded in
seconds. The original late checks are retained separately in the test diagnostic.

The rounded-support critical-angle calculation is unchanged. The original
critical-error assertion is unchanged:

```js
for (const o of out) assert.ok(o.tipped !== null && Math.abs(Math.abs(o.tipped) - critical) <= 0.5, `tipped at ${o.tipped}° vs ${critical}°`);
```

Missing or nonfinite poses, a pre-tipped initial/settling tower, missing or
out-of-order completed-step observations, an unfinished command at the original
poll/hold boundary, and a missing crossing refuse a result. A fully frozen scene cannot supply an onset. A world-space frozen tower
under a moving table crosses near 5 degrees and must fail the unchanged
critical-error guard; a later sample near the expected angle cannot rescue it. The observer never substitutes an expected tip angle.

## Evidence and limits

The original bw.9 negative-case failure remains recorded in
[PR 1553](https://github.com/CrispStrobe/brickwright/pull/1553): the late check
was −7.672831 degrees against a 6.977503 degree critical angle and the unchanged
0.5 degree limit. Separate saved-step analysis found the first strict crossing
at −7.289738 degrees, during the same unmodified hold. The different sample times
motivated this source change; those prior observations do not qualify this new
candidate or its positive direction, and do not establish a complete physical
cause for the motion.

Fourteen pure tests cover both signs, first versus late samples, wrapped falling
orientations and re-entry, frozen output, immutable results, invalid poses,
pre-tipped inputs and missing observations. Six mutations are detected: replacing
the first crossing, raising the predicate threshold, using a world angle instead
of relative tilt, accepting no crossing, skipping validation after a crossing,
and accepting a pre-tipped initial pose. These tests import only the observer
and Node's test/assert modules; they do not execute Jolt or a VM.

Affected clean actual-native qualification must still exercise both directions
at the actual source and package, retain first and late samples, preserve any
failure, and satisfy every enabled current-head check before merge. No pin,
model, collider, contact, material, motor, timestep, iteration or tolerance changes
are included. Twinpoint, Watt, coasting, steering, rendered saved projects,
hardware accuracy and the overall physics work remain outside this result.
