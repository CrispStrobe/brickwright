## SPIKE NuttX Code caller ownership — 2026-10-15

IN PROGRESS — Codex SPIKE G02 continuation, branch
`lane/spike-g02-code-caller-20261015`. Scope claim [PR978](https://github.com/CrispStrobe/brickwright/pull/978)
merged before product changes. Extend the existing SPIKE session/pane/feedback envelope only
to `runOnNuttxPython` in
`overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx` and
focused `test/spike-code-caller-ownership.test.mjs` controls, this ledger and the
SPIKE status guide. Preserve the shared import, conversion, Arcade, namespace,
lexical/type-lowering and other target dispatchers owned by their existing lanes.
The separate G03 importer permission remains limited to SPIKE toolbar text.

Two authored scheduling controls on the original dispatcher reproduce an earlier
call's `finally` clearing a newer pending call's busy flag and an earlier `catch`
replacing the newer call's status. They use the original feedback helper and
controlled pane promises, with no native or guest execution. Bind callbacks,
output, Stop ownership and post-await/catch/finally publication to the current
NuttX Code caller; preserve current completion/error/Stop and retry/cold paths.

Acceptance requires the baseline failures, positive current-owner controls,
old callback/output/Stop and overlapping-call adversaries, affected session/pane
regressions and guard mutations, then a source-bound installed Code scenario
with actual owned firmware, visible controls, cleanup and distinct recovery.
All enabled final-head CI checks must pass before normal exact-head merge.
Do not claim host scheduling controls qualify installed concurrency, native UART
output attribution, whole G02, physical behavior or a release. No native,
firmware, Runtime, model, dependency pin, workflow or deadline change is included.

Implementation now binds a NuttX caller token before opening the arena, installs
Stop cancellation before either wait, checks ownership after each wait, and
scopes feedback, captured callbacks/output, queued Stop and asynchronous Stop
errors to that caller. Its existing tracked generated importer twin receives
the same method projection; bytes outside this method remain unchanged in both
files. No removed arena source mirror is recreated.

All 20 focused authored scheduling controls pass; the unchanged dispatcher
passes six and fails fourteen of those controls. Ten deliberate ownership,
resume, cancellation, callback/output and error-publication mutations each fail
a behavioral control with canonical and generated twin mutated together. These
are host controls, including calls through the existing shared Stop handler;
they do not establish that a Stop button is rendered during every cold phase.
Installed overlapping-Code qualification, output attribution and final-head CI
are pending. The independently frozen lifecycle-batch package does not contain
this dispatcher change.
