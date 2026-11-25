# Claim: actual frame completion in the Arcade pauseUntil input test

DONE locally — owner: Robot Lab delivery lane. Claim merged in
[PR1191](https://github.com/CrispStrobe/brickwright/pull/1191); hosted source
qualification remains part of the addon candidate.

Scope: only the `native pauseUntil consumes actual held controller input after
readiness` test in `test/arcade-import-truth-values.test.mjs`, its focused
regression evidence and this claim. No importer, exporter, runtime, supplier,
shared test helper or neighboring Arcade source-analysis change is included.

The full addon qualification reported `done = 0` after posting held input and
awaiting a previously started frame. The original receipt is preserved. Inspect
the scheduling assumption before implementation: authored initialization must
finish, the false predicate must remain pending, and actual VM frames must run
after the keyboard event before completion is asserted.

Retain the original 15-second bound and actual keyboard/predicate assertions.
Use bounded actual frame progress rather than sleeps, a larger timeout or a
retry of the whole test. Prove released input stays pending and held input
completes, including the case where the initialization frame already finished
before input is posted. Run the complete affected test module. If investigation
instead identifies a runtime defect, stop at this boundary and claim it
separately. Merge this claim before changing the test.

Investigation found that scene-frame completion is not the condition-polling
boundary: source `pauseUntil` uses its independent program timer. The test now
uses the existing discrete-timer platform, starts an actual fresh VM generation,
finishes initialization and observes its false initial poll before posting real
keyboard input. Completion remains false at 49 ms and becomes true at the actual
50 ms poll. No source state or primitive result is supplied by the clock.
Removing keyboard delivery fails the final assertion. The original 15-second
timeout remains. Both complete affected Arcade modules and the catalog module
pass: 35 tests, zero failures, three pre-existing skips. Runtime, importer,
exporter and shared helpers are unchanged.
