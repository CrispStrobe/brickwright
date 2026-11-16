# Scoped official-build menu and Robot Lab browser qualification

Status: IN PROGRESS. The tilemap painter passed on the integrated local build.
Apex and Tempest exposed a blank view after resizing. The renderer fix passed
focused controls and the complete local Apex browser journey, using a 720-second
local allowance; on the integrated build it passed again in 524 seconds. Neither
run establishes the workflow's 480-second timing limit. Tempest initially failed
its connected-instruction step-size assertion. Its
oversized authored markers were removed without changing placements or the
program; the full local browser journey then passed in 373 seconds using the
renderer-fix JavaScript build with the two updated static model files. The
integrated build subsequently passed Tempest in 383 seconds, including its
controls, save/reopen and lessons. The integrated build also passed the held
Solstice browser journey in 407 seconds,
including its existing physics bounds and disconnected control. Use bounded local
or Kaggle compute;
do not add `ci:full`. Keep experimental models at their recorded limits.
Owner: scoped browser qualification lane.
Base: main `312609f46513d245e8e6ecb26bd91aa1ee83612c`.

Own only these paths and boundaries for the combined R3/R4 and submenu candidate:

- `.github/workflows/build.yml`: the existing `arcade-numeric-authoring` job's
  two-parent checkout, bounded changed-path selector, unchanged tilemap painter
  and separate Apex/Tempest example invocations, post-step snapshots and retention.
- New `scripts/menu-painter-browser-scope.mjs` and focused
  `test/menu-painter-browser-scope.test.mjs`: bind the actual synthetic checkout
  to the event base/head, inspect complete old/new rename paths, select affected
  guests, and select conservatively when identity or diff is uncertain. Prove
  unrelated PRs skip and a full label alone never suppresses affected guests.
- New `scripts/snapshot-scoped-browser-guest.mjs` and focused
  `test/scoped-browser-guest-snapshot.test.mjs`: retain each producing step's
  outcome/conclusion and move its original output before another guest can reuse
  the directory, including failure, timeout and no-output cases.
- This claim only. Existing menu and Robot Lab claims retain their source scope.

Preserve `needs: build`, existing job steps, conditions, permissions, action
pins, model laws, page-error assertions and workflow guest time limits. Exercise
the affected journeys against the matching frontend and embedded SDK. Retry
failed checks normally; keep their original results and do not weaken assertions.
Do not dispatch full CI or add a full-CI label. Post-step snapshots must execute after failed/timed-out
producing steps; do not let a failed snapshot permit the next guest to overwrite
its output. Keep original failures and absent-output facts.

Qualification requires focused synthetic-parent, rename, unrelated-PR and labeled
PR controls; actual finite child failure/timeout snapshot controls; clean affected
final-head painter/Apex/Tempest browser observations and every enabled check.
Source controls alone do not qualify the browser, physical behavior or Robot Lab
as a whole. Keep Vesper, Aster, Solstice and Impulse Line experimental at their
recorded limits; their earlier failures remain failures.
