# LP1 landing prerequisite: browser terminal evidence — 2026-11-28

Status: IMPLEMENTED SOURCE CANDIDATE; hosted qualification pending.

Owner: Language/platform extension maintainer, continuing the repository
owner's request to preserve incremental remote checkpoints and carry LP1
through a properly qualified main merge.
Branch: `codex/lp1-ci-evidence-repair-2026-11-28`.
Consumer main at claim: `44e08bc8eb2c5a283cfe199d611c0b9253dedb68`.
LP1 candidates: PR #1856 `aa949bc54c6a561ac513da53fc5341400a5be408`
and PR #1857 `f39fe653d5bc5c376ff9ab993cfc5ef18b09fb95`.
Use isolated source work and guarded non-force publication.

## Bounded repair

- Own only the browser job's three `BW_BROWSER_RUNNER_TERMINALS_V1*`
  scalar tables in `.github/workflows/build.yml`, restoring the exact ordered
  mapping of the current 295 preceding step IDs. Nine existing steps lack
  rows. Preserve every job, command, condition, step ID, timeout, permission,
  shard assignment, audit invocation and source-verification requirement.
- Extend `test/audit-job-steps.test.mjs` with meaningful missing-row and
  cross-step expression controls. Preserve source-derived mapping, bounded
  scalar parts, complete identity checks and fail-closed terminal judgments.
- Reuse, with attribution, only the already published repository-identity
  repair in PR #1855 at `ccb18429b306fe50810da5d3adb438c11072caf4`
  from `scripts/audit-job-steps.mjs` and its focused tests. This binds the
  unchanged repository ID and exact accepted names, and requires the
  executing workflow reference to match the active repository name.
  Do not recreate a different fix or modify PR #1855's branch.
- Record this prerequisite's focused controls, source identity and hosted
  results here and in the LP1 PR descriptions as they become available.

## Coordination and boundaries

This continues the published runner-evidence mechanism by repairing its
newly incomplete declaration. The original runner-evidence lane retains
attribution. PR #1855 and its Code integration qualification claim retain
ownership of Code documents, Robot Lab/menu/camera fixtures, supplier
adoption, package pins and their other integration repairs. Reusing its
published narrow identity correction does not claim those other paths.
The LP1b claim continues to own its service-worker checks.

No failing gate is waived, no expected product behavior is weakened, no
optional compiler payload is vendored, and no stale or incomplete hosted
result is called a successful current-head qualification.

## Qualification

Run the complete existing audit suite against the actual workflow and
prove all current shards have complete ordered source mappings. Missing
rows, wrong expressions, foreign repository identity, mixed-name workflow
references, malformed/extra/contradictory terminal records and real prior
step failures must still refuse. Compare the before/after workflow outside
the three scalar bodies byte-for-byte. Independently review the patch,
preserve the complete remote tree and publish incremental checkpoints.
Applicable hosted checks and the real LP1b service-worker journey remain
landing requirements. Independent active claims on main remain untouched.

## Source checkpoint

The declaration now covers all 295 preceding workflow steps in 100/100/95
rows. The production repository-identity correction is copied verbatim from
PR #1855 at the revision above; its test fixture selects this candidate's
first actual shard. The original workflow reproduces the exact-scalar mapping
refusal. No workflow content outside the three scalar bodies changes.

Node 24.22.3 qualification: 42/42 audit controls and the existing 11/11 browser
shard controls pass, without skips or cancellations. The audit controls exercise
all 32 actual shards through complete source-derived expressions and the real
Git-bound CLI. Each of the nine omitted rows has a regression whose deletion
must refuse. Existing false-success, identity, malformed evidence, size,
expression, partition and legacy controls remain load-bearing.

Workflow blob: `a3f0cad0d6dc116d0d8ee1738edec687439bd343`.
Audit script blob: `795d96410a7a65c4fbeffb5342bbfb0db564964e`.
Audit test blob: `614fbe602bb2a5edda9b5475f4d0eb58ea9b5511`.
The unchanged parser remains `4d833a5c95e61e65a09f9b33d8e5aa8c4b4014d8`.
Removing the scalar bodies from old/new workflows produces identical bytes
(SHA-1 `7ea55689207c97723b19575544aef69b5cca5528`). No browser product
journey, condition, timeout or tolerance changes.

This source checkpoint preserves both LP1 slices and the independent
CrispBASIC and Cowgol claims. It is saved separately while the existing LP1b
thorough browser run continues. The hosted service-worker journey and other
integration failures still control landing; focused source success does not
waive them.
