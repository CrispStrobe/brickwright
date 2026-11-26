# Microtronic host CI control repairs — DONE, 2026-11-25

Owner: the coordinated Microtronic integration session, requested by CrispStrobe.
Consumer PR: #1846. Canonical base: `64cb2e31f87e5a88588a6ea24a6b468134d0b775`.
Investigated candidate: `3dd88b7ea953ce73e96faa956066f20eda71b250`.

The required host checks exposed five inherited source-reader failures. The
HDD workflow changed four repository-name guards to immutable repository ID
1291854269 in the repository-rename work, while three controls still expect
the old name. Two reverse-continue tests still look for a parameterless
start method after CP1 work added the optional paused argument. The relevant
workflow, runtime and tests are unchanged by the Microtronic integration.

Own only the narrow test/projection repair and its connected negative proof:

- `test/i80386-hdd-gui-actual.test.mjs`
- `test/helpers/reviewed-repository-identity.mjs`
- `test/fixtures/i80386-repository-identity-review.json`
- `test/helpers/reviewed-concurrency-projections.mjs`
- `test/reviewed-concurrency-projections.test.mjs`
- `test/pin-move-chain.test.mjs`
- `test/debug-reverse-continue-coordinator.test.mjs`
- `test/debug-reverse-continue-runner-contract.test.mjs`

Preserve the current workflow's real repository-ID guards, all application
runtime bytes, frozen producer/reader bodies, historical epochs, old receipts
and existing source/workflow digests. Invert only complete, exact predicates
at the four reviewed named jobs for the historical workflow comparison.
The new test-source delta must be exact and reversible before the existing
fixture and concurrency inverses. Reject wrong IDs, altered boolean/event/
actor policy, duplicate or moved guards, missing hunks, and unrelated drift.
Update the two live font predicates to require the actual repository ID.

The debugger readers must locate the actual start-method body with its
supported parameter signature, retaining every branch/reset assertion.
Meaningful removed-call mutations must remain red.

Qualify the previously failing HDD controls, reviewed projection and pin
admissions, both debugger contracts and their negative controls. No workflow
execution gate, fixture exclusion, historical restamp, production code change
or dependency/pin change is part of this repair. Carry the verified correction
into the same Microtronic consumer PR and release this claim in that candidate.

## Delivered and qualified

The repository-identity review records the exact four named-job predicate
changes from the repository rename. Its sealed inverse restores the original
workflow bytes for the historical comparison; the two live font controls now
require the actual immutable repository ID. An exact test-source inverse runs
before the existing fixture and concurrency inverses. The original historical
digests, receipts, producer/reader code and workflow execution policy remain
unchanged. Wrong IDs, old live-name guards and altered or duplicated predicates
remain rejected.

The two debugger readers use the already-declared Acorn parser to locate the
actual asynchronous start-method body. Every reset and forward-branch assertion
is retained. Removing either required call in memory still fails its intended
test; the application runtime is unchanged.

After combining these repairs with current main's gallery/CAD adoption, the
prepared host checkout passes all **529 focused debugger checks** and all
**132 HDD, download, pin-history and reviewed-projection controls**, with no
failures or skips. The pin scanner judges 14,170 files and reports no stale
references or unreadable files. The seven implementation files match the
independently reviewed repair byte-for-byte. No workflow, frozen fixture,
dependency, execution gate or production code is modified by this repair.
