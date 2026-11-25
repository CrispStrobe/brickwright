# Legacy scroller test-local wait clock — narrow CI takeover

**IMPLEMENTATION CANDIDATE; hosted qualification pending.** Claim merged in
[PR 1352](https://github.com/CrispStrobe/brickwright/pull/1352). Owner: Codex CI audit repair,
under the user's explicit assignment to take over the CI audit repair.
Base: `ae38c0099337220cd68f62d588945883d4f4d438`. Public branch:
`lane/ci-legacy-scroller-clock-claim-20261024`. The isolated checkout and
retained original failure are recorded privately.

## Ownership and exact envelope

The active [Arcade integration claim](2026-10-07-arcade-compatibility-integration-and-gui-gap-closure.md)
includes Arcade runtime-associated tests. This claim records explicit narrow
coordination/takeover of one test-local scheduling fixture for CI qualification.
The broader owner retains all remaining Arcade feature, importer, exporter,
runtime, source-analysis and test scope. This assignment grants no feature
implementation or shared clock ownership.

Own exactly these two paths after this claim merges:

- `test/makecode-arcade-legacy-scroller-host.test.mjs`: only the failing
  six-API scene push/pop test's opt-in local clock fixture and focused controls
  proving its real wait-clock progress. Any helper adjustment stays in this
  same test file and preserves existing behavior for callers that do not opt in.
- `lanes/2026-10-24-ci-legacy-scroller-clock.md` only.

No shared test helper, runtime, translator, original library, generator,
supplier/pin, expected recording, application, workflow, CI pointer or census
change is included. Preserve all unrelated tests and active ownership.

## Retained failure and source premise

[Run 40121590975](https://github.com/CrispStrobe/brickwright/actions/runs/40121590975)
at `74bcffabf34956cc0b1453239977b77225d62ad6` retains the unit cohort failure
`scene callbacks complete` in the six-API legacy scroller test. Keep the original
failure; do not rerun the unchanged failed source or reinterpret it as success.
Its authored program contains two `pause(40)` calls. The test supplies at most
100 physical frames of 20 ms and waits for the real authored completion.

`stepFrames` explicitly advances physics and Promise continuations, not wait
timers. The translator emits ordinary Scratch waits, whose stack timers read
the runtime clock; a physical frame delta supplies no elapsed-wait guarantee.
The recorded whole-test duration also includes original compilation/execution
and VM setup. It cannot establish time elapsed inside the bounded native loop.
No failed-loop clock snapshot or final variable state was retained, so this
diagnosis establishes an unsafe timing premise, not a proven product defect or
proof that the product is correct. A product failure exposed by the repaired
fixture requires separately coordinated source scope.

## Required repair and proof

Give this fixture an explicit opt-in controlled program/wait clock before a
fresh actual VM generation. Use the existing owned clock-control pattern;
do not replace wait implementations, primitive results, source completion,
scene callbacks or real library operations. Never equate the supplied physical
frame delta with elapsed program time. Keep other fixtures' clock behavior held.

Preserve the original maximum of 100 frames, each requested with 20 ms, and
every authored call, raw offset/default/data comparison, original expected
value, real scene push/pop assertion, handler/opcode check and error assertion.
Do not add wall-clock sleeps, larger limits, retries, skips, TODOs or debt.

A controlled negative with the host clock frozen must show that physical
frames alone cannot complete the two 40 ms waits. The positive must explicitly
advance the actual wait clock within the same frame budget and retain every
original completion/data assertion. Observe real pending/due progress; do not
manufacture callbacks or write the program's result variables. Include a
meaningful mutation showing that removing elapsed-clock progress restores the
failure. Restore test-local clock bindings and retain cleanup on every exit.

Require complete affected-module and existing neighboring clock controls on
the final source, plus every enabled exact-head hosted check with declared skips
only. Qualification remains separate from the earlier browser/producer evidence
repairs; never borrow their prior head's checks. Preserve all original failures,
native event holds and other guest/feature limits. This claim selects no native
or GUI event, variable, label, artifact/log GET, guest or build operation.


## Candidate clock boundary

Only the opted-in scene fixture installs one test-owned time source before a
fresh `greenFlag` generation. The existing `bwArcadeProgramClock` hook and the
instance's Scratch `currentMSecs` clock reading use that same source; original
instance descriptors are restored at cleanup. The actual wait primitive and
scene/camera/scroller callbacks are unchanged. Native library version selection
still occurs after fresh-generation setup. Other callers retain their defaults.

The positive retains the original authored program and all original API/data
assertions while explicitly progressing wait time under frozen `Date.now`.
The counterfactual omits only elapsed-clock progress, keeps the same bounded
physical steps, expects the original completion refusal, and observes a real
40 ms stack timer still at zero elapsed time. It supplies no scene callback or
program result. Cleanup stops the owned generation and restores both fixture
and host clock bindings, including setup/refusal exits.

Local source/clock-contract controls are separate from full Arcade execution.
The complete affected module includes its existing original-reference browser
helper; fresh hosted qualification remains mandatory. No local pure result
establishes original/VM equivalence or closes an application/runtime defect.
