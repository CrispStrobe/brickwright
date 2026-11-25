## SPIKE deferred-storage observer cancellation — 2026-10-14

ADOPTED — [PR928](https://github.com/CrispStrobe/brickwright/pull/928), tested
source `aaa60836f1375a44cb69224e95dc511dd56e8d1c`, merged
`fff84dc6ead5c1da7a89fee52a256497d6cc32f2`. This continuation stays
within the merged G02 session/test envelope. Deferred storage frames can invoke
hub, output or frame observers that synchronously Stop the session. Check closure
after frame admission and output notification, and after the awaited storage
client reply, before later notifications or retained LOAD state are published.
A storage write may already have committed; this does not promise rollback.

Eight new actual-session/codec controls use authored pending/terminal storage
replies: five fail on the baseline, two live controls and an already-safe pending
frame cancellation pass. All 49 session controls pass with the candidate; removing
each of the three new guards is detected. Preserve storage correlation, uncertain
outcomes, durability checkpoints, native budgets and original failures. Fresh
source-bound installed own-NuttX SAVE/hub and LOAD/frame cancellation/recovery
cases passed standalone audits; all current enabled exact-head checks pass.
The pending-SAVE native checkpoint refusal remains reported, with cleanup and
recovery verified; no rollback or native-refusal fix is claimed. Firmware, Runtime, model,
native/Rust, dependency pins and workflows are unchanged; full G02 remains open.
