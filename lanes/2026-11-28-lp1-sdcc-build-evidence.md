# LP1 — SDCC historical-build evidence — 2026-11-28

Status: DONE — historical build evidence recorded and independently reviewed.
Fresh independent reproduction and aggregate license qualification remain open.

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

## Recorded result

The receipt binds successful producer run `33351025168` at
`47c504191a8420676415a1b86766621d6ea0de86` to final artifact
`9743737939`. Its 1,551,456 bytes hash to
`9f82e8f11e3cbf582c22508efcafdae0bf8a1e5ee61953d07bb2a9374e894d54`,
matching both GitHub artifact metadata and the historical upload log.
The artifact expires 2026-11-29T02:33:10Z; the receipt preserves canonical
identities and comparison evidence without retaining the payload.

All four WASM modules match the supplier exactly. Each JavaScript file matches
with exactly the documented 27-byte export appended. The actual installed
`runtime.json` was verified against its pinned digest, byte length and Git
blob, then all 92 base64 members were strictly decoded: all six libraries and
85 headers match the historical ZIP exactly; EFM8BB1.h matches after converting
2,591 CRLF pairs to LF (152,200 to 149,609 bytes). All six native small-model
library member lists match the actual historical `sdar -rcD` commands, in
order, with hashes for all 224 compiled objects. Earlier primary-source paths
are explicitly attributed to the prior PR #1857 audit; they are not claimed
as a new source-archive review.

The historical 13-program native/WASM image comparison passed with a corrupt
image rejection. This is preserved historical evidence. No fresh independent
rebuild, complete compiler/dependency attribution or generated-program member
clearance is claimed. The receipt identifies specific open zlib, Boost,
Emscripten/glue, transitive compiler and linked-output evidence gaps.

Independent review checked authoritative run/artifact/source identities,
all nine installed artifact pins, archive accounting, 92 runtime members,
224 objects and the earlier mapping's TSV digest. Selected glue bytes were
independently checked, all source/metadata identities and explicit transforms
agree, and no signed URL or payload is included.
Receipt: 79,292 bytes; SHA-256
`bf526df79ca7e0c3cbe361dec564effbeb178d6f85085b016ed9a28257b390e5`;
Git blob `5807afcf1489e05ae7aa38f3489d097f2ba7e593`.
This metadata is carried with PR #1857; implementation landing still requires
its separate applicable hosted gates.
