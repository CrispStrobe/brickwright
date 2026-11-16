# Historical Arcade receiver-overlap import

Status: implementation and bounded qualification DONE; current-head CI acceptance and supplier landing pending.
Owner: Codex, user-requested MakeCode coverage continuation.
Branch: `lane/arcade-instance-overlap-20261114`.
Base: `43f534195db2dcfa072a68b17654fad4d14a7c08`.

The user requested coordination and implementation in one local batch, without
a claim-only push. Scope: Arcade importer, canonical Creator vocabulary and registering door, runtime overlap registration/dispatch, its capture and
palette metadata, four existing MIT corpus-source fixtures and focused tests.
Canonical supplier pin advances from `8e53c1621a1b9eeb42e0565f987c4c47ab598961`
to `b211d4a10bcd575cc4b2174962bbcb36c67c8203` for the two vocabulary entries,
with normal sync and byte-identical mirrors. The app-only wrapper is removed.
No corpus runner or audit core changes.

Support the historical `sprite.onOverlap(callback)` receiver slot: replacement,
actual receiver identity, the other-sprite parameter, deferred slot lookup,
shared pair locking and scene-owned sprite lifetime. Preserve modern kind-pair
registrations. Admit zero callback parameters or one explicitly Sprite-typed
parameter; other parameter domains remain diagnosed. Compatibility does not
claim equivalence to the entire historical engine or current MakeCode SDK
support for this removed API. MakeCode TypeScript re-export remains diagnosed;
Code-to-blocks and pseudocode decompilation retain the new words.

Validation: four genuine projects compile with five receiver callback hats;
nine focused compiler/source-method tests pass, including broadphase admission,
replacement, deferred lookup, orientation, pair locks, fault/reset/ghost cases,
negative domains and pseudocode roundtrips. Independent review passed. These
are source/compiler and bounded method tests, not full VM game qualification.
The unchanged 184-input corpus run follows this clean local candidate.


The same-owner continuation in PR #1785 includes the later parser, producer and
native runtime slices. The latest diagnostics slice has focused original/native
Code and SB3 qualification, six detected causal mutants, and one immutable
partial-to-translated comparison. The stored complete 500-project result remains
336/135/17/9/3; targeted improvements are separate. Private research inputs are
excluded. Current-main integration preserves both palette-label preparation and
Array-result owner bindings, with eight actual adapter checks passing. Supplier
#184 remains a prerequisite; its exact inventory/schema regression has eleven
focused checks passing. Final acceptance uses the integration head's own checks.
