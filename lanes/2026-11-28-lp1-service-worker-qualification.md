# LP1 — focused service-worker qualification — 2026-11-28

Status: CLAIMED.

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
