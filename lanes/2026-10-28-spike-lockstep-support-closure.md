# SPIKE current Runtime support closure — 2026-10-28

Status: DONE — selected software acceptance and normal landing completed through PR1533 (`9f1a620f2aae5ee988ed02069a8bf34c18949123`). Owner: Codex SPIKE software-delivery continuation, operator
requested current Runtime/firmware and installed-consumer qualification.
Branch: `qualify/spike-consumer-delivery-20261028`, isolated internal worktree.
Base: `3d9763e4a`. Preserve existing owners' worktrees and other native functions.

The current Runtime MicroPython support imports and manifests
`tools/spike_lockstep.py`. Lite's compiled-support assembler, pin preparer and
native MicroPython manifest admission still accept the earlier closed set and
refuse that helper. This blocks a package of the current source-bound Runtime.
The earlier G02 pairing work is merged; preserve its mixed-profile refusals.

Envelope: `scripts/prepare-spike-compiled-micropython-support.mjs`,
`scripts/prepare-spike-micropython-pins.mjs`, their existing focused tests;
`apps/tauri/src-tauri/src/renode_supervisor.rs` only the MicroPython manifest
allowlist/count and focused manifest tests; this claim and a new scoped delivery
record. Accept the declared helper conditionally, carry its digest and resource
mapping, and require it when the service imports it. Preserve closed unions,
legacy support, exact runtime/profile bindings, source-only model separation,
notices and tamper/missing-input refusal. No native producer/default change,
release workflow change, firmware/model pin change or unrelated Rust repair.

Qualification: preserve failure against the current real support manifest;
positive legacy/current compiled support, missing/tampered helper and unknown
file controls; affected Rust and packaging tests; source-bound Linux installed
actual guest completion/error/cancellation and fresh-generation recovery;
every enabled final-head check before normal matched-head landing. No ci:full.
The separate native owner-death gate remains with its current owner.

Results: 29 focused Node controls, 150 production native tests (ten existing
ignored), an offline source-bound Linux package and twelve actual installed
NuttX native/Python/storage/lifecycle cases passed. Original source-manifest,
launch and view failures remain retained and scoped in
[the delivery record](../docs/SPIKE-CURRENT-RUNTIME-DELIVERY-2026-10-28.md).
PR: https://github.com/CrispStrobe/brickwright/pull/1547.

Integration: the complete SPIKE change is folded into existing PR1533 for one
final fast-CI queue. PR1547 and its published branch preserve the original
candidate. Firmware57 and Runtime66 merged normally. The composed desktop
package and official SAMD acceptance passed as separate results.

29 October checkpoint: the fresh composed package passed all 13 installed cases,
including natural expiry at 120.14 seconds and fresh-session recovery. Independent
custody readback binds one image/app/source/firmware/helper set and unchanged
resource bounds. The exact shared test-only JSON-line repair is adopted; hosted
native 275 standard tests plus nine explicit controls passed. Original failures,
private distribution boundary and normal landing requirements remain intact.

Final landing: PR1533 merged as `9f1a620f2aae5ee988ed02069a8bf34c18949123` after the required checks passed.
