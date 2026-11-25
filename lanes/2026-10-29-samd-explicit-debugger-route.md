# Explicit SAMD software debugger route

Owner: Codex SAMD continuation. Status: ACTIVE — not qualified or ready to merge. Isolated checkout:
`lego-work/spike-delivery-20261028/lite`; base `19c073bd6`.

Add an explicitly selected authored SAMD software profile to the normal
LabWired debugger, without changing project-board or catalog-board defaults.
Own this claim, narrowly necessary LabWired selection and attachment paths in
`overlay/scratch-gui/src/components/tw-pseudocode/debug-panel.jsx` and
`overlay/scratch-gui/src/lib/bw-debug/debug-runner.js`, a focused release-pin
boundary shared with `scripts/sync-labwired-wasm.mjs`, and focused tests.
Keep mirrored package files consistent. Land the supplier factory and RGB888
decoder first; advance the exact bw-board package pin only to its qualified
landed commit through the existing vendor regime. Preserve all other owners.

The explicit option uses trusted release pins, an addressed user ELF/UF2,
the admitted authored input images, visible controller-memory output and
recorded button inputs. Refuse mismatched assets, conflicting circuit choices,
and unsupported images; do not assert physical display or hardware fidelity.
Validate controls and actual browser plus installed routes before claiming
product acceptance. No `ci:full` label or repeat of retained guest originals.

## Handoff, 2026-10-29

The consumer is draft [Lite PR #1565](https://github.com/CrispStrobe/brickwright/pull/1565),
branch `lane/samd-profile-admission-20261029`, in the isolated checkout above.
The supplier is [bw-board PR #721](https://github.com/CrispStrobe/bw-board/pull/721),
branch `lane/samd-controller-memory-rgb888-20261029`, exact final source candidate
`5a1a8c3b7a7c8a14548f763ddf309a37a07d1af8` and documentation-only handoff
successor `24a876b48b813219176fe3847f9e0effa7400247`, checkout
`lego-work/spike-delivery-20261028/bw-board`. It folds RGB888 decoding and the
explicit no-circuit profile factory into one PR. Both upstream claim-only
commits are already on bw-board master (`9c2fb685`, `4fd3f958`). The Lite
claim-only commit is on main (`311f853ae`). Do not reset any other worktree.

The consumer selects `software:samd51-no-asf-simulation` only when explicitly
chosen. It admits the pinned profile, passes its two authored input blobs to
the supplier factory, retains a video accessor while pixels are unknown, and
exposes eight press/release buttons through the recorded atomic input route.
The browser pin module and sync script have a drift guard; the profile digest
is checked at load time. The existing engine loader does not independently hash
the glue or WASM at runtime: the synchronizer and build asset checks establish
those release bytes. Never describe the profile check as runtime verification
of the engine binary.

Evidence and limits:

- The focused consumer controls and existing LabWired firmware/engine controls
  passed on Node 22; the real sync command rejects a mutated browser pin. The
  standard GUI build passed before the final accessibility-only `aria-pressed`
  update. Rerun the full GUI build and focused controls at the final head.
- Supplier factory, display and input controls passed locally and on the Linux
  VPS against the retained real WASM bytes. All 102 retained browser/installed
  RGB frames decoded byte-for-byte; the original guests were not replayed.
- A provisional Chromium build used an explicit alias to the unmerged supplier
  checkout. Fresh minimal loop firmware attached and the route ran; this did
  not render game frames, prove button movement, qualify installed WebKit, or
  establish a release. The first provisional build used stale Webpack cache and
  failed against the old factory; a cache-free attempt exposed a missing
  local-alias `buffer` fallback; after correcting the diagnostic configuration
  the smoke passed. Retain these observations. Private artifacts and scripts are
  under `lego-work/spike-delivery-20261028/evidence/`, including
  `samd-route-interface-probe.json`, `samd-provisional-browser-failure.json`,
  `samd-provisional-webpack-buffer-failure.log`, and the provisional harness.
- At the last batched status check, both PRs' selected hosted checks and Lite
  main Build run `40858868240` were still queued. Lite main Tauri run
  `40858868251` passed. `full CI requested` is an enabled administrative gate,
  and the operator explicitly directed no `ci:full` label; do not call the
  overall check set green while it is red or queued. Do not poll or pull more
  frequently than every few minutes.

Next agent, in order:

1. Review the supplier's exact final head and actual enabled fast checks; act
   on real failures, preserve the original logs, and land normally with a
   matched head and parent/tree proof. Do not label `ci:full`. Update the Lite
   bw-board pin only to the actual landed commit using the repository's vendor
   tools and all required identity checks; never pin the provisional branch or
   use the temporary Webpack alias as a release.
2. Finish and review the consumer route. In particular verify the normal GUI
   uses the final supplier pin, a real ELF/UF2 preserves its load address,
   unknown controller pixels do not become invented colour, the button's
   pointer, keyboard, cancellation and teardown release paths work, and error
   messages remain visible. Re-run the focused controls and GUI build. Update
   `aria-pressed` and both tracked GUI mirrors together if changing them.
3. Write a source-bound actual-product qualification for fresh authored guest
   firmware through the ordinary GUI: import firmware, select the explicit
   profile, run, inspect real controller-memory RGB frames, press and release
   a button, and verify observable guest response. Exercise both Chromium and
   installed Tauri/WebKit with bounded waits and retained original logs and
   asset/source identities. The earlier observer-canvas 102-frame result is
   not this product-route proof. Address failures; do not repeat a failed run
   unchanged or relabel a provisional smoke as acceptance.
4. Check the final head's selected hosted jobs, upstream/consumer pin identity,
   and main-branch alarm. Finish this claim with exact receipts, mark the draft
   ready only when actually qualified, and merge normally with matched-head and
   parent/tree verification. Preserve other owners' active documentation lanes,
   including `2026-10-29-samd-enabled-check-record.md` and PR #1562.

Physical board capture remains open: flash power loss, panel colour, analogue
signals and oscillator drift need actual PyBadge hardware and instruments. SPI
slave, PDM and GhostFAT require a board that selects them; HF2 flashing needs a
bootloader and must not acquire vendor bootloader bytes. Drift acknowledgements
for the seven non-SAMD boards were renewed to 2026-11-27; plan the next operator
decision before that date. The earlier clock and RAFFS software tasks landed in
codal-samd #103; SPIKE host ownership/recovery landed in Runtime #66 and
firmware #57. The private installed package is not redistribution-qualified.

The full physical-capture procedure, starting files and done criteria are in
`codal-samd/docs/PXT-NO-ASF-NEXT-LANES.md` H2 and H4–H6. In the SPIKE Runtime,
`docs/SPIKE-STATUS-AND-LANES.md` remains the authoritative inventory: R01/R03/R06
contain broader guest and consumer goals than the finite scenarios completed in
#66 and #57; R02 capability APIs require choosing a documented operation and
testing its freshness/refusal contract in both host fixtures and an actual
MicroPython guest; R05 requires an evidenced model correction, exact dependency
closure and affected guest qualification. R06 additionally requires consumer
route/version identity and installed checks for each claimed platform. Its
LPF2 DATA-budget, addressed-distance and paused-publication candidates have
their own stated gates; review their actual PR/merge status before resuming,
because their dated prose may predate later work. Do not infer support for
external MicroPython raw REPL, arbitrary topology, hardware timing, or package
redistribution from the finite combined-package matrix.
