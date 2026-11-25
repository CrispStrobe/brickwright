# Resting-frame baseline: independent review checkpoint

Status: CHECKPOINT — source review completed; hosted baseline admission pending
with the PR #1472 successor (see Takeover below).
Owner: Codex, independent resting-frame review.
Branch: `lane/robot-resting-creep-independent-review-20261027`.
Review checkpoint base: `dea504b32a9a4bd43a2a9d25b587590a0ac9763f`.
Scope: this review record and read-only qualification metadata. The diagnostic
implementation remains owned by the successor in
[PR #1472](https://github.com/CrispStrobe/brickwright/pull/1472).
Coordinate sole artifact intake before any original acquisition or source edit.

## Completed source review

Reviewed candidate `d249c0322ca166ef2e08d724cabc1ae1ed200eb1` against
[the diagnostic contract](../docs/ROBOT-LAB-RESTING-CREEP.md).
Three focused pure checks passed independently under Node 24.22.1:

- Frozen input hashes, the one-coordinate coplanar variant and declared source identities.
- Exact frame/ground object retention and explicit enumeration of removed bodies and parts.
- Standalone-reader recomputation and synthetic corrupted-record rejection controls,
  including quaternion sign, yaw wrap, tilt and the case/step census.

Only those named pure tests were selected. No local engine initialization,
physics step, browser run, build or full suite occurred. These checks establish
source/control behavior, not actual baseline observations or solver acceptance.
The reader is independent of the producer; the test harness exercises both.

## Refreshed Main source census

Source-only compilation of the same frozen inputs against Main
`dea504b32a9a4bd43a2a9d25b587590a0ac9763f` retains a four-body/four-joint
Orrery and the 0.20642 kg frame with 38 parts and 51 colliders in both rail
variants. Both named ordinary inputs still prepare without issues. The actual
catalogue SHA-256 is now
`7e6d25950dd815729e25aafa031370c415e5382676e7dcb9bf9f235fd2cd0320`,
which differs from the historical handoff catalogue. These are source facts;
they do not establish unchanged native trajectories.

The new test has no recorded timing entry and maps to unit shard **3/6** under
the workflow's SHA-256 filename fallback. Confirm the official shard census and
actual checkout before original admission; this prediction is not evidence that
the engine test ran.

## Next admission steps

1. Refresh the PR's exact head, claim ownership, workflow selection and current
   Main before acting. Source implementation is already present in PR #1472;
   preserve that work and coordinate changes with its owner.
2. Admit the hosted unit job that actually contains the six baseline cases.
   Bind its actual checkout and full tree, workflow, catalogue, compiler, core
   and installed SDK to the reported observations. CI may test a synthetic merge;
   do not call that checkout the candidate source without proving equality.
   Main contains compiler/catalogue changes since the historical handoff base.
3. Establish one owner for original metadata admission and acquisition. Acquire
   each official original once; use the retained original for subsequent readers.
   Independently audit all six reports with the standalone reader and preserve
   original failures. Missing or unbound evidence keeps acceptance pending.
4. Publish the measured complete/isolated and raised/coplanar contrasts and the
   two named ordinary controls. Integrity acceptance must remain separate from
   stability or issue resolution. Record an absent reproduction honestly.
5. After actual diagnosis, separately scope any justified solver correction and
   its requirement-derived bounds. Preserve the floor/Sarrus/motion/rollback
   controls, enabled exact-head qualification and normal matched-head landing.

Current checkpoint verdict: pure source controls passed; no actual baseline
admission or solver-fix conclusion. Issue #1435 remains open. This review does
not confer acceptance on subsequent Main changes or other owners' source PRs.

### Takeover — 2026-10-27

The Codex review session that opened this record is frozen. Claude takes over
only to land this record as a checkpoint. No source or evidence changed, and no
review was repeated. The admission steps above go to the diagnostic successor
in PR #1472, which already owns the implementation. Its owner decides how and
when to do them. This record claims no artifact intake or source path.
