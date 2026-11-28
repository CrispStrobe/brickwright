# CrispBASIC production UI gate repair — 2026-11-28

Base: board prerequisite `3f1f9a41d6d986027b41bcec9eb29e55ac1d8331`.
Failure: [production job 141108243430](https://github.com/CrispStrobe/brickwright/actions/runs/46185229752/job/141108243430).

The hosted job passed runtime packaging, the production webpack build and emitted
runtime/CAD asset checks. Chromium launched the real application. All 14 browser
scenarios failed; the saved report records no page errors. The first failure
screenshot contains the expected `PRODUCTION` and three `X` output lines and an
enabled Run control. Its completion wait still required `bw-code-status`, which
is now mounted only while the Info popup is open. The production editor already
publishes the same current state in its `data-code-operation-status` attribute.
All operation status reads and waits now use that existing attribute. Completion
still requires Run to be enabled, Stop to disappear and a terminal status; exact
output, source refusal, worker and cleanup assertions remain in place.

The two CAD cases failed before requesting any CAD assets. Their screenshots show
the uploaded Scout project in Blocks. Successful SB3 upload returns to Blocks,
unmounting the previously displayed Circuit. The gate now waits for that actual
upload to finish and reopens Circuit through its public tab before requiring the
replacement live electrical board. The board identity, part IDs, CAD bindings,
shared clock, mechanical motion and cancellation assertions are unchanged.

Downloaded artifact `15280258180` has ZIP SHA-256
`b4a0ace996ae53e06d3e7a04aec3d14f0f95028f6249fdaedba1f5f293a58de7`.
The relevant evidence is `artifacts/crispbasic-production/result.json`,
`failure-1.png`, `failure-11.png` and `browser.log` inside that artifact.

Local validation: `node --check scripts/verify-crispbasic-production.mjs` and
`node --test test/crispbasic-production-ui.test.mjs` passed (4 tests, no skips).
The tests execute the gate's actual predicates and tab sequence, including a
negative control that removes post-upload Circuit activation. They do not claim
to render the application. Local Chromium cannot start under the executor's
socket restriction; the unchanged hosted production job must qualify all 14
scenarios on the composed commit before landing. No runtime/vendor/compiler
payload, production UI, timeout or required gate has been changed by this repair.
