# Solstice startup — optional read-only worker diagnostic

Status: LOCAL SOURCE CANDIDATE 2026-11-12; runtime qualification pending.
Owner: Codex, Robot Lab startup investigation.
Base: `d98897ce52bc1e0e2e0177747d4617828688f96e`.

Scope: a new `overlay/scratch-gui/src/lib/bw-sim/measurements/startup-diagnostic.js`;
optional request/collector plumbing in `overlay/scratch-gui/src/lib/bw-sim/sim-worker-protocol.js`;
optional reply forwarding in `overlay/scratch-gui/src/lib/bw-sim/physics/physics-host.js`;
`test/bw-sim-startup-diagnostic.test.mjs`; this claim file only.
No session/UI integration is claimed. Existing measurement selections, caps and
normal worker output/order remain unchanged without an explicit diagnostic request.

The diagnostic copies completed-step body pose, velocity and existing mass/inertia
getters, joint state and existing motor/limit effort, and native contact pair presence.
It does not claim contact impulses, hinge anchor impulses or effective island counts.
No model, solver behavior/settings, thresholds, dependency pin or workflow changes.

Qualification: pure actual-runner/fake-core tests for normal response parity, copied
binding temporaries, bounded prefix, validation, detach-on-error and redo isolation;
nonvacuous copy/redo mutations. Actual affected native/browser observation, source
and engine binding and independent original reading remain required before runtime
claims, a solver fix or promotion. No guest run is authorized by this claim alone.

Local evidence: six actual-runner/host fake-core controls and five existing precision
controls pass (11 tests). Omitting copied getter results or rollback is detected by
the corresponding regression. No actual engine, browser or guest was run. The
optional packet is forwarded on raw worker replies only; session/UI adoption and
accepted-batch consumer admission remain outside this candidate's scope.
