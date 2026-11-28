# LP1 — SDCC historical-build evidence — 2026-11-28

Status: CLAIMED.

Owner: Language/platform extension maintainer, continuing the repository
owner's LP1 request and incremental GitHub checkpoints.
Branch: `codex/lp1-sdcc-build-evidence-2026-11-28`.
Main at claim: `bac6e65879683079a6d351c175235246f3bb8b9f`.
Supplier under review: `CrispStrobe/sdcc-wasm`
revision `64ea6915733cf6d6563dfe9424c8cc71b4731e06`.

## Bounded evidence slice

Preserve metadata-only evidence in
`docs/receipts/2026-11-28-lp1-sdcc-historical-build.json` and this claim.
Inspect the actual successful historical producer workflow and job at
`CrispStrobe/emu8051-stc` run `33351025168`, exact producer revision,
build inputs, commands and existing artifacts. Verify the archive digest and
compare actual produced compiler modules, glue, headers and six runtime
libraries with the pinned supplier and the decoded pinned `runtime.json`.
Record exact source/build/artifact identities, per-member sizes and hashes,
documented post-processing and remaining evidence gaps.

This slice stores no compiler, runtime, header, source or notice payload.
No downloader, distribution policy, license-review status, pin, application
or service-worker behavior changes. The runtime/member source-license
mapping in PR #1857 remains preserved. A matching historical build artifact
does not establish a fresh independent reproducible rebuild or qualify
every compiler dependency or generated program.

## Qualification

Use primary GitHub run/workflow/artifact and immutable supplier evidence.
Compute hashes independently from the retrieved bytes, reject digest
mismatch, bind the decoded installed runtime to its inventoried digest and
length, and distinguish exact-byte matches from explicit transformations.
Independently review the metadata and its limitations before publishing.
Preserve the complete remote tree and existing claims with guarded
non-force updates. No failing implementation gate is waived.
