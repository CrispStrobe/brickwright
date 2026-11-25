## Original Arcade profiler clock bootstrap — 2026-10-16

CLAIMED — Codex Arcade integration; documentation claim
[PR1001](https://github.com/CrispStrobe/brickwright/pull/1001) merged after
all four enabled checks passed. Source candidate and runtime qualification are
pending. Contract: [reference clock bootstrap](docs/ARCADE-REFERENCE-CLOCK-BOOTSTRAP.md).
Own the original-simulator clock helper, its Arcade runtime initialization call
site, focused controls and qualification notes. Preserve paused-zero document
admission, then prove a deterministic complete-frame bootstrap before actual
guest construction, positive profiling and unchanged relative timer/frame/input
phases. No PXT vendor patch, guest-clock replacement, normalized result,
expectation/budget reduction, dependency pin or workflow change.
The exact elapsed-wait control uses program `control.millis()`; scene
`game.runtime()` is a separate frame-phase contract and cannot borrow elapsed
wait expectations. The incorrect newly authored guest and its failure remain
retained; corrected-guest qualification is pending. No simulator or native
clock policy changes. All unrelated
source, runtime, editor and device owners retain their lanes.
