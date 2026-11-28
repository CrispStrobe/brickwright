# LP1 landing prerequisite: browser terminal evidence — 2026-11-28

Status: CLAIMED.

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
