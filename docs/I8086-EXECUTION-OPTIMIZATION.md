# 8086 execution optimization, September 2026

This pass measures host execution cost with UI pacing removed. It does not
change guest clocks, instruction timings, or the debugger's wall-time budget.
The production browser benchmark remains the acceptance check for UI latency.

## Reproduction and evidence

`.github/workflows/i8086-execution.yml` runs `scripts/profile-i8086-execution.mjs`
in Chromium against two explicitly identified source trees. Five fresh-context
repetitions alternate baseline/candidate order at normal and 4x CPU throttling.
The mixed, word/stack and REP-string workloads run through bare CPU, machine,
DOS, debugger and peripheral configurations. The peripheral case programs a
PIT while masking delivery so its architectural result remains comparable.
It measures advancement cost; interrupt correctness is tested separately.

Each run must advance its memory heartbeat after warm-up. Comparisons require
identical cycle counts, registers, heartbeat and whole-memory hash. Timings
exclude setup and state hashing. Separate Chrome CPU profiles exclude hashing
as well, and can be opened directly in DevTools. Sampling is never enabled
during a timed comparison. These are source-module engine diagnostics, not
measurements of webpack startup, React, rendering, or a physical phone.

The initial A/A control, hosted run `34196975249`, used identical engine code
from Lite `1d849ee9bc03565cba16e3012ca4fa0629df5b44` on both sides. The mixed
baseline medians for one second of guest work were 18.1 ms core, 21.9 ms
machine, 30.6 ms DOS and 33.6 ms debugger. At 4x throttle those were 78.8,
98.0, 140.3 and 142.6 ms. The A/A variation is retained in the raw receipt;
small differences must not be described as wins. That first run's sampled
profiles included post-run hashing; subsequent profiles exclude it. Its
peripheral configuration had an unprogrammed PIT, also corrected subsequently.

## Candidate decisions

* Prefix dispatch: evaluate two masked prefix-classification checks before
  the ordinary opcode path. Preserve all eight prefixes, both CPU variants,
  the single-fetch contract, 16-bit IP wrap and bus traces. Upstream
  `f2c89fc32c2ac747d8c073c742f68153ee0d1cc1` passed CI run `34197350409`
  (unit tests, 8086 vectors, 80186/V20 vectors and real-program corpus).
  Accepted from Chromium run `34197418847`: mixed debugger median wall time
  fell 33.2 to 30.4 ms at normal speed (9.2% throughput gain), and 186.5 to
  162.4 ms under 4x throttle (14.8%). Bare-core gains were 18.6% and 13.0%.
  Word-heavy debugger gains were 4.5% and 6.3%; string-heavy differences
  overlap observed variation and are not credited. Every compared state
  matched. The scoped Lite sync changes only `i8086.js` and its source pin;
  35 focused Lite workload, debugger, checkpoint and replay tests passed.
* Word access: only activate after attributing a material memory cost.
  A fast path must preserve segment and physical wrap, MMIO side effects,
  ROM protection, write watches, traces and display invalidation.
* Allocation-free string callbacks: rejected. Upstream `b6edb18` passed CI
  `34197965819`, but Chromium run `34198035385` slowed the bare string core
  from 4.4 to 4.7 ms normally and 19.1 to 22.0 ms at 4x throttle. Debugger
  and peripheral results did not improve consistently across profiles.
  Reverted upstream in `cc84a67`; never vendored into Lite.
* DOS timer listener caching: direct memory access and bulk/state restore
  make cache invalidation part of correctness. Moving the deadline check
  alone cannot remove steady-state lookups in an unhooked program: the last
  delivered tick remains zero, so the deadline stays overdue. Dedicated
  experiment-branch tests checked late-hook, masking, unhooking and timer-owner
  behavior; no DOS timer source change is included in the final engine pin.
* Peripheral batching: the PIT's `nextWake()` reports device ticks while
  `advanceMs()` consumes milliseconds. A safe scheduler must convert units
  and preserve fractional phase, I/O observations and interrupt boundaries.
  Accepted: arithmetic countdown within `Counter.advance()` only
  when the entire call finishes before an edge. The programmed-PIT mixed
  profile attributed 39.3% of samples to `_advanceChips` and 12.4% to PIT
  `_tick`. This candidate retains the original loop for edge-crossing calls,
  BCD, unsupported mode values and fractional requests. Differential tests
  compare all modes and both bases against individual `_tick` transitions,
  including callback snapshots, interleaved gates/latches/restores and
  callback-driven reloads. No new scheduler, time conversion or cached state.
  Isolated Chromium run `34198634470` compared this change against prefix-only:
  peripheral mixed workload 41.1 to 39.0 ms (5.4% throughput gain), word/stack
  31.7 to 28.4 ms (11.6%), and strings 16.3 to 11.0 ms (48.2%). At 4x
  throttle, word/stack improved 10.3% and strings 59.2%. Those ranges did
  not overlap; the throttled mixed result had overlapping outliers and is
  not credited. These gains apply to the programmed-PIT benchmark, not
  every emulator workload. Architectural states matched throughout.
* Workers, dynamic translation and lazy flags remain conditional on the
  resulting profiles. They introduce independent behavior and validation
  requirements; they are not prerequisites for a smaller interpreter change.

## Final engine integration

The two accepted changes are isolated on `bw-board` branch
`fable/i8086-optimized`, revision `492e6782ee92f1ad351d64afcf16cfc224a5d508`,
based directly on Lite's original source pin. No unrelated upstream board
changes are included. Upstream run `34198916054` passed unit tests, all
646,000 8086 vectors, 80186/V20 vectors and the 525-program corpus.
Lite vendors only the changed CPU and PIT sources, with regenerated pin,
ROM provenance (unchanged ROM bytes), census and capability metadata.
The execution workflow's final comparison uses the actual vendored candidate
against the original Lite revision, without experimental source overlays.

Final combined Chromium run [34199861670](https://github.com/CrispStrobe/brickwright/actions/runs/34199861670)
compared Lite `f76e32abef43f85bd4d2c94c8aab4104b374de67` against
`1d849ee9bc03565cba16e3012ca4fa0629df5b44`. All 300 timing observations
completed with matching compared architectural states. Selected results
whose five-observation ranges separated:

| Workload / layer | Normal throughput gain | 4x-throttled throughput gain |
| --- | ---: | ---: |
| Mixed / peripherals | 16.2% | 20.7% |
| Word-stack / peripherals | 20.8% | 27.1% |
| REP strings / peripherals | 50.9% | 54.0% |
| Word-stack / core | 12.6% | 12.8% |

Normal mixed-core throughput improved 15.4%; throttled mixed-debugger and
word-debugger improved 7.6% and 10.6%. Other observations include overlapping
ranges and regressions: normal string-debugger median rose from 7.0 to 9.3 ms
with overlapping ranges, while throttled string-debugger was effectively
flat (50.4 to 51.2 ms, also overlapping). No general string-core or
universal debugger speedup is claimed. Raw medians, ranges and CPU profiles
are in the run's `i8086-execution` artifact. These percentages measure engine
headroom with UI pacing removed; they do not increase the emulated clock.

The production browser artifact from run `34199861677` retains approximately
2x real-time pacing across desktop, mobile and 4x-throttled minimum-device
profiles. Median p95 runner-pump costs across three repetitions were 1.6,
1.7 and 6.3 ms respectively. The separate source-module comparison above
measures headroom; this production run verifies the existing UI budgets.
The build's bounded unit set reported 3,022 passing tests, eight documented
skips and no failures (3,030 total).

Full production workflow [34199861677](https://github.com/CrispStrobe/brickwright/actions/runs/34199861677)
finished green for build, lesson corpus, and both light/heavy browser suites
at runtime integration revision `f76e32abe`. Deploy and deployed-GUI verification
were intentionally skipped by the branch workflow's conditions. The final
follow-up only records this evidence and releases the lane claim; no default
branch was changed and nothing was deployed.
