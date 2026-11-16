# Solstice startup — optional session and browser recorder plumbing

Status: LOCAL SOURCE CANDIDATE 2026-11-12; actual qualification pending.
Owner: Codex, Robot Lab startup investigation.
Base: `8aa4a4d137d5e8cc748a782363d3fa69a34faa7e`.
Depends on the local optional worker diagnostic candidate; no solver change.

Scope: a new `overlay/scratch-gui/src/lib/bw-sim/measurements/startup-diagnostic-consumer.js`;
optional request forwarding in `overlay/scratch-gui/src/lib/bw-sim/physics/physics-client.js`;
opt-in selection and accepted-batch admission in `overlay/scratch-gui/src/lib/bw-sim/sim-session.js`;
an opt-in channel in `scripts/lib/sim-lab-browser-recorder.mjs`;
`test/bw-sim-startup-diagnostic-session.test.mjs` and
`test/sim-lab-startup-diagnostic-recorder.test.mjs`; this claim only.

Normal request/record shapes and ordering remain unchanged without the explicit
option. No changes to existing measurement selection/caps, startup telemetry bounds,
model, program, solver, engine APIs, pins, output thresholds or workflows.
No replacement of contact or anchor impulses by pair presence or motor effort.

Qualification: pure actual session/client/recorder tests using bounded fake worker
replies, including redo/disposal/stale revision, copied data, missing/invalid packets,
restoration and disabled-option parity; nonvacuous mutation checks. Actual engine,
native/browser trajectory and independent original qualification remain owed.
Source stays local pending review; this claim does not authorize a guest run.

Local evidence: 26 pure controls pass across the optional raw worker collector,
session/client admission, serialized recorder, existing precision and original API
identity tests. Rejected batches, stale selections, divergence and disposal do not
publish telemetry; unavailable packets remain explicit. Sparse IDs are rejected by
the raw validator under the prior startup-worker-diagnostic claim, and sparse rows
and non-finite observations are refused by this consumer. Five admission/copy/stop/
default-shape mutations and sparse-ID/row mutations are detected. No engine, guest
or browser execution, source push, solver fix or promotion is claimed.
