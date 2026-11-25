# Meter authority and ideal ADC package adoption

CLAIMED — Codex circuit/instrument owner. Initial base `a7f8348315ef7b31f33d8b236bf43d6e86c53a03`;
branch `claim/meter-adc-package-adoption-v2-20261025`. This is final consumer qualification
for steps4–5 of the existing ordered instrument campaign. Merge the claim
before package edits. This commit changes no pin, package or executable file.

## Supplier admission

Use only owned CrispStrobe forks. Select qualified Board
`836867513c3e7fac420ddaa32c17e1c7b6d3e513`, which contains the meter-authority
repair `6461f8be5210afdf77f518db275c9bf411730e8f`. Model, scheduler, scope,
controller, ROM and licence source bytes are unchanged between those commits.
Require the existing exact-source CI gate before adoption.

CUI must be the qualified normal landing of [PR122](https://github.com/CrispStrobe/bw-circuit-ui/pull/122).
It is unqualified at claim time. Freeze the exact full commit and reviewed,
qualified and landed tree before any pin write; never adopt its failed heads.
Preserve all original failures. Additional supplier executable changes require
a fresh affected-boundary measurement rather than a blind descendant bump.

The x86 owner retains historical source-role policy and
`test/pin-move-chain.test.mjs`. Compose only that owner's explicitly reviewed
forward contribution; do not rewrite or waive it. New current producer/profile
identities need explicit review. Historical packets keep their original source
identities. No F7/V8 actual event, inventory, guest acquisition or release here.

## Exact committed paths

Own this file and these package/derived identity paths:

- `vendor-pins.json`, `package.json`, `package-lock.json`,
  `packages/scratch-gui/package.json`, `packages/scratch-gui/package-lock.json`.
- `overlay/scratch-gui/static/licenses/bw-packages.sources.json` and
  `packages/scratch-gui/static/licenses/bw-packages.sources.json`.
- `overlay/scratch-vm/src/extension-support/bundled-upstream-pins.json`, only
  the generated controller record. Source has no imports and is unchanged;
  preserve bundle bytes and every unrelated extension record/pin.
- `docs/generated/bw-board-census.json`,
  `overlay/scratch-gui/src/lib/bw-matrix/census-snapshot.js` and
  `packages/scratch-gui/src/lib/bw-matrix/census-snapshot.js`.
- `docs/generated/I8086-CAPABILITY-REPORT.md` and
  `docs/generated/LANGUAGE-DEVICE-MATRIX.md`, canonical generated output only.
- `overlay/scratch-gui/static/roms/i8086-bios.provenance.json` and
  `overlay/scratch-gui/static/roms/i8086-demos.provenance.json`. Preserve ROM,
  assembly and demo bytes. Verify ignored generated package mirrors without
  force-adding them or creating replacement binaries.

Own only current-package identity expectations in the existing tests below,
preserving every behavior assertion and negative. The LM741 test may also
verify unsupported supply-current refusal and represented zero/sign behavior:

- `test/adp7118-limiter-package-adoption.test.mjs`
- `test/adp7118-package-adoption.test.mjs`
- `test/cli-op-kcl-package-adoption.test.mjs`
- `test/lm324-package-adoption.test.mjs`
- `test/lm741-package-adoption.test.mjs`
- `test/lt1001-package-adoption.test.mjs`
- `test/lt1763-package-adoption.test.mjs`
- `test/scope-reset-package-adoption.test.mjs`

Add `test/scope-digitizer-package-adoption.test.mjs` for the actual installed
helper/CLI, paired CSV, externally expected settings, meter-only refusal and
unchanged raw/default behavior. Extend `scripts/verify-circuit-ux.mjs` for the
actual built installed GUI: explicit point acquisition, range/code/readout/
trace, one probe, HOLD/export and reset/failure. No substituted Board solution
or private input. Existing aperture, reactive-live and identity controls run
unchanged; this is not permission to edit every test that reads a pin.

Also own `.github/workflows/circuit-instrument-regression.yml` and
`scripts/lib/instrument-regression-cases.mjs` only for the Board/CUI checkout
and `CONTRACT_SOURCES` identity substitutions to these qualified suppliers.
Keep all312 cases, inputs, models, comparisons, tolerances, resource caps,
deadlines, dispatch rules and historical receipts unchanged. Obtain explicit
x86-owner review of the resulting producer/profile identities before a new
current packet; no workflow behavior or historical-reader change.

Reconcile only the campaign sections in `PLAN.md`, `ROADMAP.md`,
`docs/CIRCUIT-INSTRUMENT-REGRESSION.md`,
`lanes/2026-10-25-imported-circuit-instrument-campaign.md` and
`lanes/2026-10-25-imported-measurement-package-adoption.md`. Report actual
completed evidence and narrowly scoped remaining work. Keep private operational
paths, session details, source payloads and raw receipts out of public files.

## Qualification and endpoint

Use canonical explicit pin, root/GUI lock, integration, controller, notice,
ROM-provenance, census and report generators. Match CI Node/npm versions;
retain the original lock-cleanliness failure and its guard. Predict/check
outputs first; unexpected changed paths need a bounded scope correction.
Run every generator check, including unchanged reader coverage, part profiles
and hosted-target facts; do not manufacture changed output or fresh evidence.

Verify root and GUI package contents against complete pinned Git/npm-pack
payloads, plus one engine per scope. A CUI development dependency declaration
is not the installed consumer Board identity; retain the former and prove the
actual resolved engine separately. Preserve pin history, provenance, mirror,
ROM, report, matrix and all enabled final-head checks. Admit official originals
once and audit actual built-GUI behavior before matched normal merge.

After source/profile admission, one bounded current fixed312-case recheck may
compare retained raw waveforms with the prior baseline. Do not repeat a
completed experiment or the private307-circuit/LM741 assessment. No force,
auto-merge, unchanged failed rerun, numerical relaxation, source fork, unrelated
pin, licence-text or deployment change. Numerical agreement is not physical
hardware, full-corpus or signed-release certification. Preserve release,
Robot Lab, SPIKE, Arcade and x86 ownership. Close the loop only after the fifth
step is accepted in the consumer and future work is scoped; ask the user then
and do not start a sixth lane.

## Supplier admission checkpoint

The canonical claim landed as `7c1da2f9c5efca5c40938daa1649d3e4060745a9`.
CUI PR122 is now qualified and merged as
`1bc233c9297e03abb9b7eb603e045b4e92b0bb40`, tree
`569336867886e38dc19e020511e39ad292b0d65c`, identical to the reviewed and
qualified merge tree. All three exact-head jobs succeeded:3349 unit passes
with17 declared optional skips,168 precision controls,17 SPICE checks and83
browser scenarios. Board target remains836867513c3e7fac420ddaa32c17e1c7b6d3e513.
The complete13 changed packaged CUI files have source witnesses; this is source
admission, not an installed-consumer certificate. The x86 owner is reviewing
its newer whole producer/control profile and bounded current selectors before
joint composition. No current pin or F7/V8 event is selected by that review.

## Minimal current-identity composition

The x86 owner supplies reviewed component
`558ce246cdf273fc167954db83f4b797266046f5` for normal composition. Its four
code files update ten current identity literals and the accompanying assertion
label: the GUI producer/reader, direct Circuit workflow and its source test.
Schemas, guards, resource caps, artifact-v2 protocol and GUI test body remain
unchanged. The larger pending B9 change set and historical profile table are
explicitly excluded. Ordinary package adoption does not require that separate
work or authorize an actual guest event. The composed package identities and
all14 existing GUI controls still require final acceptance.


## Consumer qualification checkpoint — 2026-10-26

This checkpoint describes the [pending adoption branch PR1413](https://github.com/CrispStrobe/brickwright/pull/1413).

**OPEN: consumer qualification has not passed.** At head
`dba6e95cc455296a41be013e3a5a4be50705d28b`,
[Build40250390101](https://github.com/CrispStrobe/brickwright/actions/runs/40250390101)
failed the actual circuit UX journey. The LM741 meter journey and the first
four ADC groups passed: explicit primary acquisition, modeled rendering with
unchanged raw data, modeled triggering, and paired CSV/HOLD behavior.

Envelope rearming remains blocked. At the end of the existing 30-second wait,
the diagnostic showed sample mode, ADC checked and enabled, and zero Board
scope channels. The required combined envelope state was not observed by the
wait predicate; the endpoint diagnostic is not a continuous component trace.
The subsequent envelope/point rearm and failed-source controls did not complete
and must not be reported as passed.

The forward diagnostic is designed to record the original selection's return values,
scoped/page control counts, exact element identities and connectivity, and a
64-entry capture/bubble input/change trace with an overflow count. It preserves
the original action, assertions, timeouts and engine clock. This is passive
evidence collection, not a product fix or an established cause; even a passing
diagnostic run alone does not close the defect. Source identity checks do not
convert a failed GUI journey into acceptance.

Next work within this lane:

1. Qualify the bounded diagnostic on the exact source head and identify where
   the native selection and observed component state diverge. Preserve the
   failed evidence; do not retry the same action or force component state.
2. Isolate a demonstrated cause and repair it in its owning repository, with
   a causal negative. Any supplier change needs explicit source admission and
   an exact qualified package update; do not create a Lite source fork.
3. Complete the affected actual GUI journey and every enabled exact-head check
   before normal matched-head integration and final campaign closeout. Keep
   the completed numerical study attached to its original source identity;
   do not replay it or claim physical oscilloscope/LM741 accuracy.

### Later point-rearm failure

At diagnostic head `65cc5c8d84852878c7d72ef842d5f3452ea006e2`,
[Build40256837534](https://github.com/CrispStrobe/brickwright/actions/runs/40256837534)
passed the combined envelope-publication wait and then failed
`ADC_POINT_REARM_REUSED_RECORD`. The earlier intermittent mode-publication
failure is not thereby resolved. The three-part point-rearm assertion did not
identify whether the handle, capture mode or count differed from its expectation.

The local evidence replacement keeps the second selection and exact three-part
predicate, preserving the original separate handle read and evaluating that
captured handle. Synchronous diagnostic reads follow the predicate in the same
callback; they are not an atomic snapshot of every getter. The tuple includes
the subsequently observed first handle so a change between evaluations stays
visible. Primitive values actually read by the short-circuit predicate and
attempted/read flags remain separate from the subsequent diagnostic snapshot.
Missing diagnostics remain a failure; an original predicate error
is rethrown. No new wait, retry, engine advance, state override or product fix
is introduced. This diagnostic still requires review and affected GUI evidence;
the consumer qualification and final failed-source controls remain open.

## Final bounded consumer closeout — 2026-10-26

**DONE — the bounded consumer contract is accepted.**
[PR1413](https://github.com/CrispStrobe/brickwright/pull/1413) matched-merged
as `b26ae0aedde4e53a254b0bc48c83b156be7cb026`. All five source workflows
succeeded: 36 successful checks and six source-declared skips. The actual
checkout `41aa713874cccb5457007a8b6d10f67a347c6634`, reviewed source and
landed merge share tree `922580819a699958a0003f4cab050a4dbd36067e`.
The historical checkpoints above retain their original failure and pending
states; this section records the later accepted run.

At source `02ef9419443bbc3154b7a94ace8e35616df31750`,
[Build40264899201](https://github.com/CrispStrobe/brickwright/actions/runs/40264899201)
passed the hosted circuit UX journey, including envelope/point rearm and the
failed-source refusal controls. Independent readback of retained official
outputs found all 10 new browser checks, 6 preserved browser checks and 3
required unit checks, across 18 selected originals. The actual checkout tree
matches the reviewed source tree. This closes that narrow installed-GUI
acceptance boundary for this run.

The earlier dba mode-publication timeout and 65 point-rearm failure remain in
the history above. The failing 65 conjunction's handle, capture and count were
not individually logged. A later pass does not establish either intermittent
cause or prove that a product defect was fixed. The point probe preserves
the separate captured-handle evaluation and records values actually used by
the predicate separately from the later diagnostic snapshot.

This readback does not prove compiled-bundle provenance or independently
re-execute the npm-pack verifier. It adds no physical/performance claim and
no new 312-case numerical result; the completed numerical study stays attached
to its original source.

### Scoped follow-up work

1. **Keep future failures attributable.** Start at
   `exerciseInstalledADC` in `scripts/verify-circuit-ux.mjs`. Preserve the
   captured handle, ordered short-circuit getters and attempted/read flags,
   together with the bounded native selection/event timeline and element
   identities. Maintain pure controls for a handle retired between the two
   browser evaluations, differing used/snapshot values, getter errors and
   diagnostic errors. Acceptance: those manufactured failures still fail,
   their original errors survive, and a future hosted failure identifies the
   used values without a retry, extra engine advance or state substitution.
2. **Repair a cause only when evidence identifies one.** Trace the supplier's
   [ScopePanel](https://github.com/CrispStrobe/bw-circuit-ui/blob/1bc233c9297e03abb9b7eb603e045b4e92b0bb40/src/components/ScopePanel.jsx)
   selection/channel lifecycle against that evidence. Any causal fix belongs
   in the owning repository, with a failing-before/passing-after control and
   an explicit qualified supplier update. Preserve the current pins until
   such an update is reviewed; do not infer a fix from this single pass.
3. **Qualify any later change at the consumer boundary.** Retain
   `test/scope-digitizer-package-adoption.test.mjs`,
   `test/scope-reset-package-adoption.test.mjs` and
   `test/lm741-package-adoption.test.mjs`, then the affected actual hosted
   circuit UX journey and every enabled exact-head check. Acceptance must
   preserve lifecycle/refusal behavior, real zero versus unavailable values,
   threshold boundaries and raw signals. No threshold relaxation, baseline
   rewrite, unrelated pin movement or repeat of the completed numerical
   campaign is part of this follow-up.

The protected numerical result remains
[Run40237367378](https://github.com/CrispStrobe/brickwright/actions/runs/40237367378)
on original source `1f967949ffc16a0ff792e493c1343e7fe88a6e2e`: 312 accepted
cases / 87,488 checks, with all 240 raw waveform CSVs byte-identical to the
preceding baseline. Its whole-head Rust cancellation remains unqualified.
The accepted consumer preserves the numerical source closure; no numerical
experiment, private cohort or completed LM741 assessment was repeated. Full
limits and scoped proposals are in the
[result handoff](../docs/CIRCUIT-INSTRUMENT-REGRESSION.md) and
[roadmap](../ROADMAP.md#scoped-follow-ons-after-consumer-acceptance).
The five-item campaign ends here; select the next priority before new work.
