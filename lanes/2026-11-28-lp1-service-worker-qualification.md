# LP1 — focused service-worker qualification — 2026-11-28

Status: DONE — workflow implementation independently reviewed; first hosted browser qualification pending.

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

Its PR/main source-path filters and input manifest cover exactly the same seven
files. The manifest verifies the event checkout and every tracked input Git blob,
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

The shipped worker, verifier and inventory remain at blobs
`b448f93f65fc5519f86e1fae2ab237542e4393ba`,
`6747940d9133a06030f617524c80eca422c86743`, and
`84ea367a2bb149891829c2c930fb4d7478a5032f` respectively. No broad Build step,
scalar table, shard, application payload, dependency pin or review flag changes.
The first automatic focused run must still supply the seven-scenario and
seven-mutation browser result. Broader unit/browser failures still block landing.
