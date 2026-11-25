# Model measurement API takeover and bounded resource admission

DONE qualified source integration — Codex API takeover, explicitly approved by the user. Existing claim
PR #1261 (`lanes/2026-10-23-model-measurement-api.md`) is preserved. Take over its
API service resource/authentication qualification in a new isolated branch
`lane/model-api-resource-takeover-20261023`; preserve the previous source branch
`lane/model-measure-api-20261023`, its commits and evidence. Reviewed starting
source is `17b2338410fdf22a45a80707b6b2f129a378d0df`. Claim PR #1278 merged before implementation.

Own `tools/model-api/` gateway/backend/resource helpers, their API documentation
and schemas, focused `test/model-api-*.test.mjs` controls and the bounded submitted
model workflow `.github/workflows/model-measurements.yml`. Compose current main
and the separately qualified model/native measurement dependencies normally.
Do not take over the model-library assets or live measurement UI, plots,
physics, compiler, telemetry or other owners' worktrees.

Admit finite artifact metadata and streamed HTTP bytes before whole-body
allocation. Before loading ZIP metadata, verify a bounded worker-produced
single-root `result.enc` archive layout; reject unsupported ZIP64/multidisk,
entry-count, malformed lengths and ambiguous layouts. Bound extracted encrypted
bytes before concatenation/string/decryption, preserving CRC, authenticated
encryption, ownership, request/source identities and original errors. No
archive expansion, authentication or evidence assertion may be weakened.

Add actual atomic per-agent and global accepted-nonterminal job admission
through a reviewed private-repository GitHub Contents SHA-CAS store with finite
bytes, records and retries. Refuse unset, public or unauthorized backing stores. An
in-process counter in a serverless handler cannot establish a global limit.
Refuse excess before dispatch; release terminal/failed-dispatch capacity exactly
once and conservatively retain ambiguous dispatch reservations. Expiry alone
cannot free a possibly live accepted job; release requires trusted terminal
observation or proved pre-dispatch refusal. Preserve safe retries and concurrent
callers without inventing race-free quotas.
Deployment must refuse missing/unqualified admission configuration.

Require focused negative and concurrent controls, meaningful source mutations,
actual pinned JSZip boundary tests and affected existing authentication/protocol
controls. Qualify actual native submitted-model jobs and bound source/input/
workflow/report identities before deployment. Hosted exact-head enabled checks
and reviewed/predicted/landed tree/parents precede any normal matched-head merge.
No deployment, pin/library change, private Actions, heavy local build/guest,
upstream contact, credential publication, original re-download or consumed-event
replay is authorized by this claim. Preserve all original failures and source
branches; no force push or automatic merge.


Implementation adds finite HTTP and pre-JSZip/native-inflate admission, signed
private Contents SHA-CAS reservations and trusted terminal/source joins. 56 focused
resource/admission/protocol controls and 33 governance controls pass; ten source
mutations are detected. Original proposals and failures are
preserved. The final composed source passed its hosted controls and isolated real
Docker/Jolt encrypted fixture. This status does not authorize deployment or
claim live private-store/service or installed-firmware acceptance.

## Qualified-main continuation

The retained PR1282 head `2b19a0765d3aedea01817dac6888f8913e8f0fd4`
continues in the isolated branch `lane/model-api-qualified-core-20261024`.
It normally composes qualified main
`1825cf0308d3ba0e217a3117fedefbe959cab8c8`, preserves every existing workflow
record and ordered observation, and adds only the API's historical registration
and matching native-test registrations. The API host documentation now states
the raw-stream helper contract and the separate configured-host acceptance.

[PR1337](https://github.com/CrispStrobe/brickwright/pull/1337) merged as
`0576e01408145c79a03508909adbde388710dfe1` after 36 current enabled checks
passed, with 21 declared skips. The obsolete pre-label full-CI guard refusal is
retained; the successful current-label verdict superseded only that guard under
the workflow policy. No actual test failure was waived. The actual parents and
tree matched the reviewed current-main composition, preserving all 49 API paths
and every other main entry.

Its fresh fixed-model worker and unchanged independent reader passed 335 source
blobs, 185 actual Jolt samples and six real VM controls without skips. PR1282 was
closed as included after ancestry and implementation checks; its branch and
original outcomes remain preserved. Source qualification does not establish
deployed-service, production-dispatch, installed-firmware or physical-device
acceptance. The separately owned model-delivery lane retains configured-host
and deployment follow-through.
