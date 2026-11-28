# LP1 — focused service-worker qualification — 2026-11-28

Status: DONE — focused workflow and LP1b wait correction independently reviewed; changed-candidate hosted qualification pending after the first recorded failure.

Owner: Language/platform extension maintainer, continuing the repository owner's
LP1 implementation and qualification request.
Branch: `codex/lp1-service-worker-qualification-2026-11-28`.
Main at claim: `6a9f6051edb157511b0ae80e1c02843036d07731`.
LP1b candidate at claim: `370ab5173adfc669208e73800ffd3480f15b4928`.
Isolation: dedicated remote branch and source-only workspace; preserve the verified
complete parent tree through guarded non-force Git updates.

## Problem and bounded scope

The old LP1b light job `140995616904` in run `46147041901` ended cancelled
at 30m18s, consistent with its 30-minute job ceiling. Its service-worker step
171 was skipped without invoking the verifier. Earlier journey failures had
consumed the job; no seven-scenario/seven-mutation worker proof was produced.

The existing `scripts/verify-service-worker.mjs` serves its own fixture and
reads the shipped worker and optional runtime inventory directly. It does not
need a Scratch GUI build. Inspection of all 40 workflows found no existing
isolated hosted invocation or dispatch input for this complete verifier.

Add `.github/workflows/service-worker-browser.yml` and this claim. Register only
this new workflow in `docs/generated/ci-step-census.json` using the existing
`census` and `mergeWorkflowReadings` exports for a truthful zero-run declaration.
Append its required dated, temporary zero-run pointer to `CI-POINTERS.md` until
actual hosted evidence is available. Preserve the historical repository/main
header, every existing run and workflow record, and all prior pointer text.
Only the new workflow entry/index and generated refresh metadata may change.
Existing Code-integration census/provenance and repository-rename repairs remain
with their published owner in PR #1855; do not copy or overwrite those changes.
The focused job must use the existing locked root dependencies, pinned setup
Actions, actual Chromium, an exact checkout and the existing unmodified command
`node scripts/verify-service-worker.mjs` with no narrowing flags. Record input
identities and actual seven-scenario/seven-mutation execution evidence.

This adds complementary qualification. Do not alter the broad build workflow,
its shard membership/scalar tables, timeouts, cancellation/failure conditions,
worker/runtime implementation, verifier, dependency pins or review flags.
The existing three-minute verifier-step bound remains in the focused job.
No failed broader gate is waived and no unchanged failed broad run is retried.

## Qualification

Independently review the narrow workflow, trigger/path coverage, locked install,
permissions, setup pins and failure propagation before publishing the candidate.
Use applicable existing workflow/source checks and the first automatic hosted
qualification to exercise the real default verifier. Distinguish a successful
focused worker result from whole-application qualification. Preserve current
claims and all existing source bytes. A real verifier failure requires diagnosis
and repair within owned scope; never replace it with a skipped or narrowed run.

## Reviewed implementation checkpoint

Claim-only PR #1864 is merged at
`ccc5c6405bd2065ab85d42fe660fb0bee391422f`. The complete initial source/metadata
checkpoint is `c83a1a4a526868f3eea040e626ba9256146529f3`.

The final focused job uses Node 24 (supported by the repository's >=22 preflight,
and matching the current production build's observed Node 24.22.3), pinned
checkout/setup/upload actions, `contents: read`, and checkout credentials disabled.
Root `npm ci --ignore-scripts --no-audit --no-fund` retains the lockfile's
Playwright/playwright-core 1.62.1. After the existing apt helper, one bounded
`./node_modules/.bin/playwright install --with-deps chromium` runs with the
established 10-minute install bound. The existing default verifier keeps its
three-minute bound; `pipefail` preserves nonzero outcomes through log capture.

At the initial checkpoint, its PR/main source-path filters and input manifest
covered exactly the same seven files. The manifest verifies the event checkout and every tracked input Git blob,
and records the reviewed head, actual merge checkout/tree, Node/Playwright
versions, byte lengths and SHA-256 identities. The retained artifact includes
that manifest and the verifier log. Manual dispatch selects the same full command.

| Reviewed file | Git blob |
| --- | --- |
| `.github/workflows/service-worker-browser.yml` | `5c9e568b978fea9559a7ac7bf06776df37998a0b` |
| `docs/generated/ci-step-census.json` | `85cae0737fa7aba6234c5de6b4abde022e08f3c6` |
| `CI-POINTERS.md` | `f4b9f1f907f25ce227f31f063e83a9070b8ffb3b` |

### Source validation and preserved evidence

- Five existing scoped census/source/mutation controls and six existing optional
  cache/inventory controls passed. Deterministic inventory generation, verifier
  syntax, all five shell blocks and the embedded Node manifest syntax passed.
- Independent review approved the exact final workflow and additive metadata:
  full default command, unchanged verifier timeout, pinned/locked setup, minimal
  permissions, trigger/input equality and failure propagation. Root reviewed the
  initial source/diff and requested the final single-install refinement to keep
  setup within the focused job budget.
- Removing only the new census entry/list item and restoring refresh metadata
  reproduces the original 242,022 bytes and Git blob
  `0eab104f5bd3800b60d57ddc1a44ae95537dd621`. All 336 old runs, 35 old workflow
  objects, main/repository provenance, ordering and 306 Unicode escapes survive.
- Removing only the appended dated pointer and separator reproduces all 53,655
  previous pointer bytes and blob `33607e97f3d2291d85fe88a4b67959f5ee2acf5a`.
  Removing the pointer alone causes the expected zero-completed-run refusal.
  Root independently repeated both exact historical-byte restoration checks.
- The generator's existing pure exports produced eight declared steps with zero
  observations. This is a source declaration, not a fabricated run or browser
  success. Existing missing census entries for five other workflows remain with
  the Code integration lane; the global census gate is not claimed green.

At that initial checkpoint, the shipped worker, verifier and inventory were at blobs
`b448f93f65fc5519f86e1fae2ab237542e4393ba`,
`6747940d9133a06030f617524c80eca422c86743`, and
`84ea367a2bb149891829c2c930fb4d7478a5032f` respectively. No broad Build step,
scalar table, shard, application payload, dependency pin or review flag changes.
That checkpoint awaited the first automatic focused result recorded below.
Broader unit/browser failures still block landing.


## First hosted failure and LP1b verifier correction

The first complete focused execution is
[run 46164509507](https://github.com/CrispStrobe/brickwright/actions/runs/46164509507),
job `141038956411`, on candidate
`a6c82c0c23aa3506111270c0ab38b5fa55ecaedd`.
Its actual PR merge checkout
`ce5a075b73bb0532cd6d558505efd0d7b1b7eea7` has the exact candidate tree
`54854b2c5122d7d1a0fe31f974fa86da75b5a89f`. Node 24.22.3,
Playwright/playwright-core 1.62.1 and Chromium 151.0.7922.34 executed all seven
scenarios and all seven mutations within the existing bound.

Six shipped scenarios passed. `optional-toolchain-survives-update` failed
because it checked obsolete/lookalike caches before activation cleanup settled.
The job exited 1 normally; setup and result upload succeeded. The optional-cache
erasure mutation also failed at that premature obsolete-cache assertion, so its
RED result does not yet establish the intended erasure control. This run is
recorded as a failure, not a seven-plus-seven qualification.

The retained [artifact 15271377470](https://github.com/CrispStrobe/brickwright/actions/runs/46164509507/artifacts/15271377470)
has ZIP SHA-256
`84959e5fdaa547f0071d21ba055f3a9c36fcc0981c8015e50846efee2a3e95a2`.
Its exact input manifest and verification log preserve the failed execution.
The census now records this real failed run, with `conclusion: failure`;
the generator's `ran` and `always` fields describe observed execution, not
successful outcomes. Only this workflow's temporary zero-run pointer is removed.

The defective wait supplied an async function to the locked Playwright poller.
The [v1.62.1 implementation](https://github.com/microsoft/playwright/blob/v1.62.1/packages/playwright-core/src/server/frames.ts)
calls the predicate and tests its immediate truthiness before fulfilling the
result. A Promise is truthy even when its eventual value is false; the old wait
therefore did not keep polling until the lifecycle condition became true.

This verifier repair is within the already-merged original LP1b ownership claim,
`lanes/2026-11-28-lp1-verified-installation-cache.md`, which explicitly owns
these optional-toolchain browser and mutation checks and their test fixtures.
It does not broaden this focused-workflow claim into runtime or unrelated
integration changes.

The verifier now saves the registration and previous active worker before its
update. A small closure-free synchronous predicate reads their current state on
each poll and returns an actual Boolean. It requires a different active worker,
state `activated`, and that exact worker as the page's controller.
The existing 20-second condition bound, all retention/cleanup/offline-byte/
zero-prefetch assertions, and all seven mutations are unchanged.

The existing activation test now serializes the real callback into a page-like
realm. Ten independent lifecycle cases, transitions of the live registration
and controller, and an async counterfactual establish the predicate contract.
The counterfactual reproduces a truthy Promise whose awaited value is false and
must fail the immediate-Boolean contract. All seven tests in the file pass;
independent review approved the exact source and test changes.

The focused workflow runs this source test before the same complete browser
verifier inside the existing three-minute step. Its PR/main filters and input
manifest now cover the same ten paths, adding the helper, related test and
tracked worker mirror. No worker, inventory, dependency pin, broad Build step,
review flag, timeout or mutation was changed.

The separate pre-existing async wait in `library-previews-on-demand` remains
unchanged. That scenario passed the first observed run, and its later reload,
request-count and offline checks remain strict. Worker preview persistence uses
`event.waitUntil` independently of `respondWith`, so a one-shot cache check
would be unsafe; a future repair needs bounded asynchronous polling or an actual
completion signal. No preview-worker policy change is justified by this finding.

The changed candidate must now pass all seven shipped scenarios and make all
seven mutations RED. In particular, `activate-erases-optional-toolchain` must
fail because it erases the optional installation after the healthy scenario
passes, rather than reusing the premature obsolete-cache failure. Broader failed
unit and integration gates still block landing.
