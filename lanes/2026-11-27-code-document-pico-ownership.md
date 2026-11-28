# Code document integration: Pico startup ownership — 2026-11-27

Status: IMPLEMENTED — 18 helper/epoch controls and 8 actual importer ownership
controls pass; landing remains ordered with the parent Code integration.

Owner: Code execution continuation maintainer on
`codex/code-worker-ownership-2026-11-27`, PR #1855. This continues the
repository owner's approved milestone and incremental checkpoints.

Base: consumer `8f6ce4aa2e6d5e6455313aba1063a44e523bcc71`, including canonical
main `d1e76cc60244ef8814d33e147e39ce4c58749dbc`. Use the same isolated consumer
worktree as the existing Code document claim.

## Scope

The integration must run the visible authored Python on its preserved Pico
target. Review found that importer-only request fencing is insufficient:
`startPicoSimRun` can publish a board after asynchronous startup, and an old
handle's unconditional teardown can remove a replacement run's board.

Own the narrow cancellation/identity boundary in:

- both `src/lib/pico-sim-run.js` mirrors;
- the Code importer's Pico call, Stop and teardown integration;
- focused startup/cancellation/identity tests and existing runtime documentation.

Add an optional standard AbortSignal without changing no-signal behavior, the
firmware, deployment protocol, hardware API or selected simulator route.
Cancellation must revoke startup, interrupt its transport/pump, and remove only
the board and observation record owned by that invocation. An old completion
must not erase a newer run. Preserve existing partial work while recording this
scope before its next implementation step.

The completed one-board display lane and the older node-oracle transport lane
were inspected; neither owns this startup-cancellation boundary. This companion
does not take over the RF, gallery, HDD, device-engine or firmware lanes.

Qualification: execute the real helper with controlled asynchronous boundaries,
cover pre-abort, abort during startup and after success, replacement-owner
cleanup, and unchanged default behavior. Existing Pico/route controls still
apply. These controls do not claim physical-device qualification.
