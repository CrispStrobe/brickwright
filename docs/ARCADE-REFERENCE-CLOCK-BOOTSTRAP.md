# Deterministic original Arcade clock bootstrap

**Claim merged in [PR1001](https://github.com/CrispStrobe/brickwright/pull/1001).**
Implementation and runtime qualification remain pending.
This continues the deterministic original-clock lane recorded in `LANES.md`.

## Observed failure

The original-simulator helper pauses Date, performance and time origin at zero
before document startup. Preserve that initial-clock assertion. The retained
original PXT runtime uses a zero profiler offset as an inactive sentinel:
starting its profiler at performance zero and then stopping it throws
`bad time now`. This is a reference-harness failure; it does not establish a
failure in the corresponding Brickwright game.

## Owned change

Own `test/helpers/pxt-initial-clock.mjs`, the initialization call site in
`test/helpers/pxt-arcade-runtime.mjs`, focused reference-clock controls, this
contract and the matching ledger entry. Coordinate any other original-simulator
consumer before changing its setup. No application, simulator vendor source,
dependency pin or workflow change is included.

Keep the existing empty-context admission and paused-zero document assertions.
After verifying them, explicitly advance a bounded, complete animation-frame
quantum **before constructing the guest Runtime**. Observe the resulting Date,
performance and time origin separately. Bind the quantum to the actual retained
Playwright scheduler implementation and qualify the hosted version as well.
The inspected scheduler uses a 16 ms grid; a 1 ms advance would move the next
relative animation callback from 16 ms to 15 ms and is insufficient.

Do not replace or suppress PXT profiling, patch its sentinel, inject a positive
profiler offset, subtract an invented elapsed value, or replace a guest clock.
The actual original Runtime must establish its own game-time baseline. Unknown
scheduler versions or an unexpected clock observation must refuse this protocol.

## Required qualification

- Preserve original failed runs and exact vendor/helper identities.
- In separate fresh contexts, observe zero-start and whole-frame-bootstrap
  scheduler paths. Compare actual relative frames, timeouts, intervals and input
  ordering, including the first frame. Keep timers paused between explicit
  advances and exercise delayed host execution.
- In unmodified PXT, use `control.millis()` to observe initial program time
  zero, profiling without the sentinel failure, and exact requested elapsed
  increments. Observe the baseline; do not normalize a wrong result afterward.
- Retain countdown, frame ordering, motion, button, dialog and rendering
  expectations. Run affected original/native/authoring comparisons; preserve
  phase-dependent mismatches as failures requiring investigation.
- Check fresh contexts, repeated runs and disposal independently. A clock
  control does not qualify a game, image plane, sound or editor journey.

All enabled checks for the actual candidate and affected runtime qualifications
remain required before adoption. No timing budget, assertion, skip policy or
compatibility count changes are authorized by this claim.

### Explicit reference browser executable

Both the platform clock controls and the original PXT reference helper accept
`BW_PXT_CLOCK_BROWSER_EXECUTABLE` as an explicit Playwright executable path.
When absent, the normal Playwright browser selection is unchanged. An invalid
explicit path fails normally; there is no executable substitution or fallback.
This permits qualification using an independently bound retained full Chromium
without requiring a separate headless-shell download. It does not transfer
platform-only results to the actual PXT program: the corrected program-clock
control's 0, 20 and 40 ms observations still require their own run.

### Program time and scene-frame time

The bootstrap elapsed-wait control uses `control.millis()`, the program clock.
It keeps the exact zero, 20 and 40 ms assertions. Its newly authored predecessor
used `game.runtime()` for those wall-clock expectations; that API choice was
incorrect. Preserve the predecessor failure and qualify the corrected guest
separately. No simulator, helper scheduling or clock value is rewritten.

`game.runtime()` reads the current scene's frame clock. The original simulator
accumulates that clock from its event context's frame deltas. A resumed ordinary
fiber and a frame callback can read at different phases of the same absolute
time. An ordinary `pause(20)` therefore does not establish that a particular
scene-frame callback has completed. Keep that distinction in original/native
comparisons rather than forcing the scene clock to equal the program clock.

A separate scene-phase control remains a design task. Before giving an exact
scene value authority, bind the scene owner, original frame-delta update and
callback priority ordering, including the initial zero delta. Read actual
program time and actual scene time separately; do not infer callback equality
from a timer delay or normalize either value. This change authorizes no native
scene-clock policy, simulator vendor change, timing tolerance or skip.
