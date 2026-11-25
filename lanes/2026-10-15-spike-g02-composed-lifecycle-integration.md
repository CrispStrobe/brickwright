## SPIKE G02 composed lifecycle integration — 2026-10-15

Continuation of the merged SPIKE G02 pane/session claims, branch
`lane/spike-g02-lifecycle-batch-20261015`. Integrate the existing Pause ownership,
world-action ownership, pending-upload Arena Stop and replacement Code-feedback
fixes in that order. Preserve shared importer/conversion and other lanes.
The separate NuttX Code caller proposal remains outside this product change.

The Pause conflict retains both the full-session upload cancellation prefix and
the captured-session/teardown ownership branches. Stop keeps intent/bridge
bookkeeping and optional upload-message clearing. Eleven other inherited pane
methods and the feedback session file match their reviewed source inputs.
A new authored sequence catches either single-fix baseline losing the other
Pause branch. All 176 affected host controls pass. An attempted extra rendered
unit suite lacked React in the sparse validation environment; its original
failure is preserved and hosted CI must run with installed dependencies.

The frozen composed consumer `f903a966ea348fd7c3abd0ba693194fc813b4997`
passes all fifteen installed own-NuttX cases: four Pause, four representative
world/manual-drive, four pending-upload Arena Stop cases with retained-session
Stop positives, and three Code completion/error/retry/cancellation cases. All
fifteen standalone readers and the combined cohort reader pass, including thirty
successful native startup transactions, cleanup and distinct recovery per case.
The official frontend checkout tree equals this consumer; package payload and
input audits pass. Its eleven enabled CI checks pass in
[run38769805667](https://github.com/CrispStrobe/brickwright/actions/runs/38769805667);
the conditional GUI verification and deploy jobs skip.

Original failed test attempts remain preserved: a circular held-reply cleanup
wait, React component-pointer compatibility, recovery language conversion,
retry recorder lifetime, and a direct duplicate Stop before pending teardown
completed. Corrected tests retain the observation limits and two-START retry
gate. Visible Code cancellation awaits the original Stop method's returned
promise rather than issuing a second pane Stop. That direct repeated-Stop
boundary remains open below.

Current main's unrelated importer/debug changes are preserved exactly during
integration; the SPIKE session/pane/native inputs and NuttX Code dispatcher
method remain unchanged from the tested source. Final documentation-head CI
and merge review remain required. This result qualifies the named frozen
package, not every later frontend package or whole G02, hardware,
reference boot, rollback, distribution or licensing. This lane
changes no native input, firmware/Runtime/model/dependency pin, workflow or budget
relative to its main base. Do not merge the older draft sources independently
as a substitute for composed qualification.

### Continuation — disposed topology release, 2026-10-24

Claude (operator-assigned) continues this claim on
`lane/spike-g02-disposal-topology-20261024` (pane JSX and its teardown test).
An installed pane-disposal case on current main (dual-ultrasonic NuttX run,
then Scratch Stage closure and arena reopen) found port F still holding the
second ultrasonic sensor in the shared hub state. Closing the pane sets
`disposed`, so `stopProgram()` returns before its topology teardown; since the
hub now outlives the pane, the stale sensor reached the next pane. The pane now
returns port F after the disposed Stop settles, unless a newer session already
owns the hub configuration. Two focused controls fail on the original source;
removing the ownership guard or releasing before teardown settles is detected.
