# 8086 fastpaths, phase 2

## GUI diagnostics and promotion follow-up

The promotion branch reconciles current main with the verified fastpaths,
retaining upstream tone and W65C51 changes at engine `4c6ab1a7289db121284a2c0e98435598bd3ef24c`.
Engine CI `34235227257` is green. The reconciled comparison `34236231622`
passes state checks with no separated performance regressions. First GUI CI
`34236244217` passed the new lab checks, build and corpus but found the Bluetooth
panel's probe selecting the lab's hidden Close button. Revision `c05b6be37` unmounts
closed dialogs; rerun `34237479071` passes all 18 8086 browser checks, including
the new assertion that no closed sandbox controls remain in the document.

Final combined [application CI](https://github.com/CrispStrobe/brickwright/actions/runs/34237479071)
is GREEN at `c05b6be37`: build, corpus, light and heavy browser suites, including
the Bluetooth check. This verified runtime is being fast-forward promoted to
main with a ledger/report-only handoff; the default engine branch receives the
reconciled history too. The normal main workflow handles deployment.

Settings → **8086 execution diagnostics…** provides:

* **Optimized / Reference byte access** for newly constructed 8086/80186
  project targets. Rebuild or reattach to apply. This diagnostic switch disables
  only guarded RAM word access; it neither changes a live machine nor rolls
  back REP optimizations or correctness fixes. Storage failures fall back to a
  tab-local preference and are reported.
* An isolated, lazy-loaded **JS / decoded / Wasm comparison** using three
  bundled bare-CPU programs, private RAM, bounded execution slices, cancellation,
  warmup and three alternating-order samples. Registers, cycles and RAM hashes
  must match or the result is rejected. UI shows timing ranges, RT, compilation
  and fallback counts. This is a logical isolation boundary, not a security
  sandbox for untrusted code: user code and device attachments are not accepted.

No experimental backend is selectable for project execution. Timer batching
remains excluded. The executor previously kept in `scripts/lib/` is now shared
with the lazy GUI benchmark to avoid testing one copy and displaying another.
Historical statements below about prototypes not being imported by production
refer to normal project execution; the explicit diagnostic panel now loads the
decoded/Wasm prototype on demand. Synthetic best-case gains remain distinct
from general emulator performance.

## Phase 2 benchmark record (before promotion)

Baseline Lite: `abc4634dad85b570ea64b979fcb67d32194c3fd3`.
Baseline engine: `492e6782ee92f1ad351d64afcf16cfc224a5d508`.
Work is on Lite `perf/i8086-execution` and engine `fable/i8086-fastpaths`.
No default-branch changes or deployment. This is a measured experiment log,
not a promise that every candidate will ship.

## Acceptance plan

1. Expand production measurements: distinguish paced UI throughput from
   unpaced webpack-target throughput; preserve heartbeat/provenance checks.
   Expand representative executable workloads and record absolute RT rates.
2. Evaluate an unobserved debugger run loop with configuration-epoch escape
   for re-entrant observers. Keep the instrumented interpreter as reference.
3. Evaluate dedicated MOVS/STOS loops preserving byte callbacks and interrupts.
4. Establish correct device-deadline units and observability prerequisites;
   test any batching against per-instruction advancement, including fractional
   phase and callback snapshots. Do not hide an incompatible state change.
5. Evaluate guarded RAM access and decoded-block execution independently.
6. Build a bounded WebAssembly translation experiment; measure guards,
   compilation and fallback costs, not only a compiled arithmetic loop.
7. Retain only repeatable improvements. Run upstream vectors/corpus and full
   Lite build/browser checks on the final integrated runtime revision.

## Decisions and evidence

* Fast runner: five new differential cases, including re-entrant code
  breakpoints, stepping and recorder installation; 20 focused tests pass.
  Chromium run `34216385933` compared this alone against phase 1. Rejected:
  every range overlapped, including unchanged control layers. Debugger mixed
  medians improved 4.1% normally but regressed 1.4% throttled; throttled
  string-debugger regressed 7.6%. Candidate and its candidate-specific test
  remain available in experimental commit `54f32c3bf`, not in the final source.
* Dedicated MOVS/STOS: engine `e00d877`, upstream CI `34216385584` green
  (units, 8086 vectors, 80186/V20 vectors, 525-program corpus). Differential
  test preserves overlap, wraps, prefix order, bus access traces and mid-REP
  interrupts. Accepted after Chromium run `34216833481`: string debugger
  +18.0% and peripherals +13.4% normally, with separated sample ranges;
  throttled bare core +14.2% and machine +16.9% also separated.
* The production benchmark now includes a separate unpaced-target phase.
  This intentionally excludes React/paint; the existing paced phase remains
  the UI responsiveness check. A mutation test rejects a no-progress target.

* Guarded RAM words: accepted in engine `6b7761d210698c8f392e28ce85d02c5d94ee676f`.
  Fast reads require ordinary RAM/ROM; writes require RAM outside video memory.
  Trace, replaced callbacks/memory, segment/page boundaries, MMIO and ROM writes
  fall back to the byte path. `fastWords: false` selects the reference path.
  Isolated 25-million-cycle Chromium run `34218453349`: normal string DOS,
  debugger and peripherals improved 22.1%, 20.9% and 65.2%; throttled string
  machine/DOS/debugger/peripherals improved 50.2–68.8%, separated ranges.
  Mixed workloads were essentially flat. These are workload-specific gains,
  not an application-wide multiplier.
* PIT deadlines: accepted correctness groundwork (`a1a22c43`). Deadline units
  now distinguish milliseconds from CPU cycles, account for fractional PIT
  phase, BCD counts and gated one-shots, and conservatively stop before edges.
  Unknown advancing devices veto skipping. Active instruction batching is OFF.
* Scoped PIT batching: implemented only in `scripts/lib/`, rejected for normal
  execution. Run `34219643563` was 65–71% slower in Chromium despite matching
  final states. Direct public counter-field reads can also observe deferred
  state; a negative test records that incompatibility. An earlier eligibility
  run failed on the CGA advancing device, then was corrected and rerun.
* Decoded blocks: benchmark-only, rejected. Run `34217670824` regressed
  throughput 46–77%; validation and dispatch costs outweighed decode savings.
* WebAssembly: implemented a bounded, self-validating register-block prototype,
  then a counted-loop version which keeps iterations inside Wasm. Seeded
  differential tests cover arithmetic flags, code mutation and cycle budgets.
  Initial blocks (`34217673170`) regressed 47–87%. Backedge-discovered counted
  loops (`34219049254`) reached 11.4× on the synthetic register-loop case,
  but mixed/word workloads regressed 19–25%. Kept as an opt-in benchmark,
  NOT imported by production; no claim of general MMIO/IRQ/debugger support.

## Final integration verification

The production candidate combines REP loops, guarded words and deadline fixes.
Engine [CI 34219643631](https://github.com/CrispStrobe/bw-board/actions/runs/34219643631)
passed units, all 646,000 8086 vectors, the 80186/V20 suite and 525 assembled
programs. Lite preserves its explicitly allow-listed machine divergences.
The scoped pin move retains the original engine ancestry and excludes unrelated
upstream changes; ROM bytes are unchanged and provenance is regenerated.

The browser comparison uses alternating A/B order, five fresh-context samples,
25 million guest cycles per sample and 1×/4× CPU throttling. It checks matching
retired state and reports absolute real-time throughput, not only percentages.
Three pinned third-party sorting programs add completed-program measurements
(reset/load/execution included, assembly excluded), checking exit, output and
memory state. These do not replace the larger correctness corpus.

Production runtime revision: `911d09104d7bace67ff592e8f944e85e8fd66e40`.
The 8086 benchmark in full build `34220310752` passed. Across 15 unpaced samples
per profile (five within each of three browser repetitions), median RT ratios
were desktop **26.95×** (25.84–27.32), mobile viewport **27.17×** (26.95–27.32),
and 4× CPU-throttled **6.51×** (5.55–6.68). The paced UI medians stayed at
2.02×/2.02×/2.02×. Mobile viewport is not a measurement on physical mobile
hardware. Unpaced timing excludes rendering and setup; this is a workload
measurement, not a claim that every 8086 program runs at the same rate.

First combined comparison `34220298875` preserved state and improved normal
word DOS/debugger/peripherals 6.3–9.9%, and string machine/DOS/debugger/peripherals
62.4–86.9%, with separated ranges; mixed cases overlapped. Completed sorting
program ranges all overlapped (heap-sort median +16.1% normal/+7.5% throttled).
Its bare-core rows are INVALID for CPU performance: the harness deleted the
machine-installed word methods, converting the CPU to V8 dictionary properties.
The constructor opt-out now avoids that mutation; a V8 `HasFastProperties`
diagnostic confirmed default and opt-out are fast, deletion is not. A corrected
full comparison is required before reporting bare-core rates.

Full build `34220310752` found two integration metadata failures (3031 pass,
2 fail, 8 named skips): the new corpus makes the emu8086 adapter no longer dead,
and the generated tracked-file inventory omitted the new word helper because
it was generated before that file was committed. Removed the stale dead-code
exception and regenerated the inventory after tracking. Focused tests confirm
both corrections. Rerun `34221225525` passes all **3033** executed unit tests
with **8 explicitly accounted-for skips**, and its editor build is green.
The repeated production benchmark measures **22.73×** desktop, **22.83×**
mobile viewport and **5.45×** at 4× throttle (15 samples/profile); pacing
still yields about 2.02×. This repeat on another CI runner illustrates why
the 27× result above is not a hardware-independent guarantee.

Ownership correction (2026-09-08): “tracking” above initially meant only the
overlay copy. That was incomplete: the already-tracked package
`i8086-machine.js` imports `i8086-ram-words.js`, while a clean checkout had no
tracked package-side helper and depended on `integrate.mjs` creating it. The
helper already exists byte-for-byte at the recorded bw-board pin (`4c6ab1a`),
so it is ordinary upstream-owned vendored source, not a lite-authored
exception. Both overlay and package copies are now tracked; a focused ownership
gate rejects a missing pair, mismatched bytes, or a future `liteAuthored` claim.

Corrected comparison
[34221210990](https://github.com/CrispStrobe/brickwright/actions/runs/34221210990)
is green at `79c401df76e1a7cc13f336f7a54cb20196058660`, with unchanged production
code from `911d09104` and no bare-core regression. Final normal-speed string
machine/DOS/debugger/peripherals gains are **113.2% / 48.1% / 78.9% / 34.2%**;
4× throttled gains are **80.3% / 69.1% / 58.3% / 55.8%**, all separated ranges.
Throttled word DOS/debugger improve **10.6% / 9.1%**, also separated. Other
word and all mixed cases overlap. All sorting-program ranges overlap; their
median changes do not establish a repeatable application-wide gain.

Mixed-workload candidate source-module RT medians were bare core **79.6×**,
debugger **41.2×**, peripherals **27.9×**, or **18.6× / 10.3× / 6.9×** with
4× throttling. These source-harness measurements are distinct from the webpack
production target above. Comparing absolute rates between separate CI hosts
would confound host variation with code changes; the alternating same-run
baseline/candidate comparisons are the optimization evidence.
No default-branch merge or deployment has been performed.

Final application
[CI 34221225525](https://github.com/CrispStrobe/brickwright/actions/runs/34221225525)
is **green** at `79c401df76e1a7cc13f336f7a54cb20196058660`: build, corpus,
light browser and heavy browser suites. Deployment and deployed-site checks
were intentionally skipped for this feature-branch run. Final ledger/report
edits do not alter the verified runtime or benchmark harness.
