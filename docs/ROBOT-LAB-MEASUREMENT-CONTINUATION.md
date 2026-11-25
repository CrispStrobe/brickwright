# Robot Lab measurements — accepted checkpoint and next work

Updated 2026-10-28. The four measurement capabilities from
[PR1437](https://github.com/CrispStrobe/brickwright/pull/1437) are on main.
Their combined-main acceptance was independently audited on the exact checkpoint
below. Later physics and model changes need their own qualification. The broader
physics follow-up loop remains open; this document closes only the measurement
acceptance item.

## Accepted behavior

| Capability | Accepted boundary |
| --- | --- |
| Existing forces and dynamics | Slider motor/limit force and power, passive hinge friction, screw slip/supporting load and contact presence; units, unavailable states and provenance retained; native scalar joins accepted |
| Accepted-step analysis and recording windows | Fixed-step period, phase and signed discrete motor work; bounded simulated-time windows; lifecycle, completed-step arithmetic and saved histories accepted |
| Structural role packs and persistence | Pinned 60-source structural coverage with 493 packs; two real 95-placement, 12-decimal save/reopen pilots accepted |
| Explicit control pairs | Two authored model identities, typed mappings, units, origins, strict default same-model comparison and bounded paired-project persistence accepted |

Contact presence does not establish a contact-force vector. Filtered screw
supporting load is not signed instantaneous force. Discrete motor work is not
electrical energy. Structural coverage and two pilots do not establish all-model
mechanical or program replay. See [the measurement guide](ROBOT-LAB-MEASUREMENTS.md).

## Exact combined-main evidence

The accepted main checkout is
`566c905d2f6ce0db35f6037b589b91491678b94c`, tree
`d2d49b92a46419d6bcb9f9d050ed74422204e0c4`.
[Build40514051175](https://github.com/CrispStrobe/brickwright/actions/runs/40514051175)
completed successfully. All 46 exact-head check-runs were admitted: 43 SUCCESS
and three declared conditional skips (two deployment jobs and the PR-only
full-CI-label guard), with zero legacy statuses. This is acceptance of that
checkout, not a claim that every subsequent main tree has been tested.

The actual successful producers were:

- [Unit5 job122246021259](https://github.com/CrispStrobe/brickwright/actions/runs/40514051175/job/122246021259): seven actual source-timer lifecycle cases executed without target skips or TODOs; independent TAP and checkout joins passed.
- [Light job122246022260](https://github.com/CrispStrobe/brickwright/actions/runs/40514051175/job/122246022260): the independent native-keyboard trace audit and all 81 assigned browser-gate joins passed. Unassigned gates remained skipped.
- [Robot Lab job122246022225](https://github.com/CrispStrobe/brickwright/actions/runs/40514051175/job/122246022225): editor build, measurement journey and unique successful artifact12751668829 passed.

Each new official original was acquired once after exact metadata admission.
All three original logs bind the actual push checkout above. The measurement
archive passed size/digest, safe flat ZIP paths/types, CRC and exact-nine-member
checks. Standalone readers, without producer imports or guest replay, accepted
measurement/history, dynamics, lifecycle and native-keyboard publication.
The nine members are measurement edit SB3/JSON, runs CSV, experiments JSON,
experiment history SB3/JSON, role-persistence JSON, dynamics JSON and paired SB3.

The source coverage pin is
`8ecbb4c116e4123fb9de18cdb71570c0dad2ceb9`. The independent reports retain model
identity, typed semantic bindings, native observations, recording gaps/caps and
explicit control-pair provenance. The public byte readers are:

```sh
python3 scripts/read-sim-lab-measurement-artifact.py ORIGINALS --checkout ACTUAL_CHECKOUT --tree ACTUAL_TREE --require-history
python3 scripts/read-sim-lab-dynamics-artifact.py ORIGINALS --checkout ACTUAL_CHECKOUT --tree ACTUAL_TREE
```

Do not download these successful originals again merely to inspect them. Use the
retained receipt inventory and saved bytes. A new executable tree may need new
qualification and genuinely new originals; it cannot inherit these identities.

## Landing history and preserved failures

PR1437 landed at `cd0f7a9ae5b72e4918468e87eea487c56f9374af` before the required
combined-main qualification. Its ordered parents were
`9cdbe24286b02dc7cf7cdb3d722b0eeb00c7e859` and
`8a8421706541f706628d9872ca86e8b7b1fe34fd`, tree
`3ebcfc034d645406dea23a571298af2566362c49`. The actual tree equals Git's clean
merge result: 39 of its 41 changed paths match the old candidate; the workflow
and measurement guide were combined automatically. Later successful evidence
above does not retroactively turn this into a qualified pre-merge landing.

The old candidate had its own successful qualification and sealed originals;
those were not renamed as evidence for the new main combination. Earlier
[Build40468979773](https://github.com/CrispStrobe/brickwright/actions/runs/40468979773)
ended canceled and
[Build40470766517](https://github.com/CrispStrobe/brickwright/actions/runs/40470766517)
failed. Those outcomes remain preserved; they were not rerun to obtain this
later successful checkpoint.

An earlier Circuit trace failed strict sample publication after a synthetic
selection. The accepted diagnostic now uses one real focus and one page-level
native ArrowDown, with passive focus/input/change observations, an actual
precommit-negative state and strict final focused sample/ADC/zero-channel
publication. The original downstream add/handle/capture/count/time assertions
remain unchanged. This finite user-path acceptance does not establish the old
failure's historical cause or a general product repair. Do not add retries,
fallback selection, value patches or relaxed predicates.

## Continue the broader work in order

1. Refresh actual main and ownership. The measurement acceptance above is done;
   do not reimplement or merge PR1437 again, start a duplicate old observer or
   replay sealed guests. Read the operator's current ignored handoff and
   [the lane protocol](../lanes/PROTOCOL.md).
2. Coordinate the existing rotor-inertia, collider and model-geometry repairs
   (PR1505, PR1510, PR1512 and PR1514). Preserve their owners' source and original
   failures. Resolve real model-clearance and reaction/coupling failures before
   qualification; do not weaken model verdicts or numerical assertions.
3. Review the qualification handoff in PR1521 and carry the repairs through
   affected clean hosted qualification, exact original-byte audits and guarded
   normal merges. Existing in-progress contact work must be coordinated, not
   duplicated merely because a public snapshot says it is unclaimed.
4. Continue tracked-model coasting, a stock-part-buildable steering redesign
   and the resting-creep correction under separately merged, coordinated scopes.
   [The Robot Lab handoff](ROBOT-LAB-AGENT-HANDOFF.md) describes the analytic
   baselines and acceptance requirements. These physics items remain open.

Use an owned isolated worktree, normal checkpoint pushes and source-preserving
integration. Every enabled final-head check must succeed, with only declared
skips, before a guarded merge using `--match-head-commit`. Verify predicted and
actual parents/tree. No force push, auto-merge, unchanged failed rerun, repeated
one-shot label/dispatch, silent pin change or weakened threshold. Run heavy
qualification off a resource-constrained host; use the operator-approved runner.

Only after the last physics item works and final qualification/documentation is
reconciled should the broader user loop close. No physical-accuracy, hardware,
release, deployment, performance or blanket licence-clearance claim is implied.
Raw originals, private paths and operational receipts stay in ignored local notes.
