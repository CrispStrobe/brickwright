# CLI instrument regression

## Current circuit/editor status — 2026-11-05

Circuit/editor integration [PR1536](https://github.com/CrispStrobe/brickwright/pull/1536)
merged as `81d8f4929a17e1d0c645c07b99eda0dd818d9642`; the circuit handoff
[PR1542](https://github.com/CrispStrobe/brickwright/pull/1542) also merged.
The original fast Build `40869114327` succeeded. The separately dispatched full
Build `40869128682` failed: its heavy Machine Loader gate and light Circuit UX,
Code chrome/Controller/Instruments and CPX circuit gates failed. Preserve that
failure; the cause has not been established from retained original diagnostics.
A later main [Build41735633603](https://github.com/CrispStrobe/brickwright/actions/runs/41735633603)
at `f17192e868049eff3487377a996fc3ffa03f76ac` succeeded: those four named
browser gates and the FPGA surface job succeeded according to job metadata. The
original heavy log reports a 30-second file-chooser timeout; the light log
reports a 30-second locator timeout. The bounded diagnostic reader did not retain
the light locator target, and job metadata alone does not establish the causes
of the remaining failed gates. The originals were acquired once and preserved.
This is later-head evidence, not proof of the original causes or a physical
hardware, synthesis, calibration or broad model-accuracy qualification.

Lite main `e1f3d152b912db90baf917227a3b46a111b2dac3` pins Board `c87cfa32`
and CUI `15416c7e`; the live version endpoint earlier returned Lite `656f4da`
on 2026-11-05. A version response does not qualify a live GUI journey or prove
deployment of the later test-only merge. The CUI S040 Stop/restart fix
[PR135](https://github.com/CrispStrobe/bw-circuit-ui/pull/135) merged as
`9d7a9a260d00d3c26a77e749aec55ceddbe29a52`. All three hosted checks passed
on continuation `3f154d684506ec53d0d4e7afc5d661638576dee3`, and post-merge
CI also passed. The original face source and browser fixture were preserved.
Lite S040 package adoption and the actual consumer firmware journey remain open;
do not silently advance either package pin.

Next: (1) use the already retained failed-job originals and frozen diagnostic summary;
do not download them again or rerun the consumed study. Identify any unresolved
cause without guessing from a later passing run; (2) coordinate with existing
[Lite PR1622](https://github.com/CrispStrobe/brickwright/pull/1622), whose
S040 binding lane already owns supplier pins and the firmware-to-screen journey.
Review the complete supplier ranges, then qualify one package/lock update,
installed identity and affected actual GUI journeys. A read-only preview of
PR1622 head `d2b083e4` against Lite `e1f3d152` found 26 content conflicts:
package manifests/locks and pins, mirrored Circuit and notice files, adoption
tests, live instrument contracts and historical x86 evidence. Preserve main's
newer micro:bit and SB3 pins; regenerate derived package evidence. CUI `9d7a9a2`
descends from both the current Lite pin and the draft's S040 source. The draft
Board `cda9d13b` descends from Lite's current Board pin; review its complete
range before choosing it or a newer qualified descendant. Preserve historical
study and x86 identities separately from live supplier authorities;
(3) choose representative project-authored analogue circuits and explicit
voltage/current/time measurement points, declare model domains, tolerances and
analytical or comparable SPICE references before running a bounded hosted study;
(4) fix only demonstrated importer, solver, instrument or oracle defects in the
owning repository, with a meaningful failing control. Report refusals and
noncomparable cases rather than treating them as passes. Keep physical-device
calibration, probe-loading claims, LM741 instant-settling TODO, long-capture
current-polarity limits and the untested output-size boundary explicit.

The earlier `test/circuit-passive-batch-5ms.test.mjs` compares all 5,000
voltage points but checks meter-current magnitude only. The new
`test/circuit-signed-current-5ms.test.mjs`, merged in
[PR1656](https://github.com/CrispStrobe/brickwright/pull/1656), checks two
newly authored positive/negative RC cases through the installed CLI. Each checks
5,000 voltage points, both signed resistor-terminal meter means and a single
whole-capture work budget. The comparator rejects reversed nonzero current and
nonfinite values. The independently authored analytic reference was checked
against ngspice 42; worst voltage and instantaneous source-current errors were
8.54 nV and 10.2 pA, and the 5 ms integral differed by at most 41.1 pA. The
[hosted Build42120820267](https://github.com/CrispStrobe/brickwright/actions/runs/42120820267)
passed both installed CLI cases and the comparator control. The retained log
records assertion outcomes, not exact observed numeric readings. This covers
two authored cases and the pinned model, not physical calibration or general
corpus accuracy. Do not call the older magnitude-only test signed-current
evidence or rerun its consumed inputs.

The dated material below is historical unless a later section expressly says
otherwise. Refresh heads, current claims, CI and deployment before acting.


## Current handoff — 2026-10-29

The remaining delivery is owned by the Circuit/editor integration maintainer.
The frozen [PR1536](https://github.com/CrispStrobe/brickwright/pull/1536)
head is `2e7846f8a901726a296e3a8ef006cff24bc457b5`. At the latest check its
fast [Build40869114327](https://github.com/CrispStrobe/brickwright/actions/runs/40869114327),
necessary full [Build40869128682](https://github.com/CrispStrobe/brickwright/actions/runs/40869128682)
and other enabled workflows were queued. Refresh the actual head, default branch
and checks before acting; a queued run is not a passing result. Use fast-tier PR
checks by default and do not add a `ci:full` label.

To finish, in order:

1. Observe all enabled checks for the current candidate. Diagnose genuine failures
   using the retained original evidence; make a bounded forward fix and qualify
   its new head when necessary. Do not repeat an unchanged dispatch or weaken a
   test, a numerical bound or the profiling-size ceiling.
2. Admit the final run and job identities before reading any original. Preserve
   the existing independent readers and their predicates; acquire each original
   only once. The supported-event numeric consumer owns its Pages archive
   acquisition, so use its retained proof instead of downloading that archive a
   second time. Never replay the completed reference study.
3. Establish affected application acceptance: Circuit and Manual browser journeys,
   FPGA workspace visibility and retained design, the profiling-build byte guard,
   and the required native checks. The manual full run uses separate production,
   FPGA-enabled and profiling builds; do not claim byte identity between them or
   the Pages artifact. The reduced FPGA gate does not qualify synthesis, simulation
   correctness or an FPGA release.
4. Refresh main and preserve concurrent changes. Once the reviewed candidate and
   its enabled checks qualify, perform a normal matched-head merge, then verify
   its actual parents and tree. PRs 1515, 1516, 1517 and 1538 are preserved through
   the combined integration; do not describe their closed originals as merged.
5. Observe existing production deployment activity before using the guarded
   deployment workflow. Verify the published version and affected live UI, then
   update this handoff, PLAN, ROADMAP and the campaign record with actual landing,
   delivery and remaining limits. Close the campaign only after these endpoints.

The accepted historical study has 32 inputs, 31 conforming results and one named
refusal; its supplier identities and four study seals stay historical. Live
package contracts follow the currently adopted pins. Physical calibration, probe
loading, a GUI AC-coupling selector and the untested 32 MiB output boundary remain
outside the established evidence. Preserve the recorded LM741 TODO and the
long-capture current-polarity limit. Keep private paths and evidence outside public
repository documents.

## Active continuation — 2026-10-28

**Status: frozen circuit source passed its approved fast-tier checks; combined
application delivery and campaign closeout remain pending.** This is the
only current action list. Dated snapshots below retain their original evidence
and failures; their old resume instructions are historical. Read `LANES.md`
and refresh live PR heads before acting. Never replay the consumed studies.

The current [Lite PR1536](https://github.com/CrispStrobe/brickwright/pull/1536)
preserves longer-capture PR1516, repaired LM741 PR1515, provenance PR1517 and
the complete frozen `93aba75473e65042925928fe8c1a0a4427fd59ca` ancestry.
The separate PR1538 was closed without merging. Current candidate pins are Board
`8785e4688cc308b34fea434c1734523caa621f74` (unchanged) and the qualified CUI
PR131 landing `4b65f15485abbc039958d8e1a8a29ac3459b75f9`. Neither closed PRs
nor supplier qualification establish this consumer's main landing or deployment.

### Verified results and their boundaries

| Item | Verified result | Evidence boundary |
| --- | --- | --- |
| 1. Reference study | v2 run 40681635060: 32 inputs, 31 comparable passes, one named refusal, 4,260 values, 15 captures, 83/84 passing selector locations | Original source `bfa530fc`, historical Board `c7bcbe4b` / CUI `da28bb8c`; numerical conformance to admitted ngspice-42 references, not calibration or a new-pin cohort |
| 2. Four earlier disagreements | All noncomparable; no demonstrated model defect (PR1495) | Preserve original denominators; do not fit a model to an uncertain reference root |
| 3. Scope rearm cause | CUI PR128 merged; unmerged negative PR129 fails the injected host re-render control with identical tests and the exact historical component | Establishes that mechanism, not every historical timeout or race |
| 4. Longer captures | At successor `93aba754`, three hosted RC regressions pass all 5,000 points per waveform, trigger checks, voltage means and current magnitudes; original refusals pass | Step, pulse and sine; first sample at 1 microsecond. Current-polarity coverage is separate. Regression assertions do not relabel older retained raw captures as new outputs |
| 5. LM741 | At `e85dc904`, hosted v2 passes six sign/load combinations, refusals, default-off output and GUI non-exposure; the v1 TODO remains | Nominal typical 25 C domain. Successful per-load JSON was not separately retained; this is CI assertion evidence |
| 6. Coupling and provenance | At `e85dc904`, four installed AC tests pass, including three buildable supplier mutants. Independent retained-log reader accepts all 60 values across three modes | One authored two-channel circuit; maximum error below 5e-16 V. CLI-only RC view; no physical calibration or probe-loading claim. Provenance/redaction integration still needs final combined qualification |

The AC original is [unit shard 3](https://github.com/CrispStrobe/brickwright/actions/runs/40744838545/job/123035439525);
LM741 is [unit shard 2](https://github.com/CrispStrobe/brickwright/actions/runs/40744838545/job/123035439624).
The long-capture and historical-seal assertions passed inside
[unit shard 6](https://github.com/CrispStrobe/brickwright/actions/runs/40744838545/job/123035439688),
whose overall result failed the documentation-trigger gate. These observations
retain their actual `e85dc904` source identity and do not qualify the successor.
A private exact-package preflight also passed 11 CLI tests and two static
metadata/GUI non-exposure checks; hosted application evidence remains distinct.

The provenance helper admits all three static-asset records as one transaction
or refuses before writing. Census redaction handles assignment-prefixed
locations. Their causal controls remain part of the combined candidate; final
current-head qualification is still required.

### Failure preserved and forward repair

The original unit-6 failure was a dependency-map omission: the LM741 TODO
reason named this broad handoff while it was excluded from Build triggers.
The same failure reproduced locally. The forward checkpoint instead points the
TODO to the dedicated [startup-window record](receipts/lm741-startup-window.md),
which already triggers Build under the existing receipt-directory rules.
Thirty-five focused checks pass after the repair. Production code, package
pins/locks, numerical test bodies and the historical-study guard are unchanged;
the only non-Markdown change is that documentation pointer. No workflow policy
or numerical bound was weakened. Fresh successor qualification is required.

The consumed collector, fixture, comparator, reader and workflow keep their
original bytes and pins. Four explicit complete-file seals protect historical
roles and the old manifest; synthetic controls use an isolated historical root.
Ordinary stale-current and never-pinned negatives remain mandatory. The separate
x86 history-reader changes must be composed without replacing this guard.

The final `93aba754` checkpoint has 17 successful checks, nine declared skips
and no pending checks, including the successful Arcade official build. The sole
red verdict is the absent `ci:full` label covered by the earlier operator-approved
fast-tier exception for this predecessor. This does not relabel the overall
Build green or waive any enabled check on the final combined UI candidate.

### Supplier return — 2026-10-29

CUI PR131 landed at `4b65f15485abbc039958d8e1a8a29ac3459b75f9` after all
three enabled checks and retained browser evidence were accepted. This is
supplier evidence, not a qualified Lite adoption. The delivery owner is composing
the entire `93aba754` source ancestry with the editor/menu changes and preparing
the explicit package return. The new consumer menu helper resolves the actual
trigger-owned popup. Its combined browser result is still pending.

The authored regression's `CONTRACT_SOURCES` and matching workflow checkout
are live current-package authorities; their prior adoption commits deliberately
advanced them. They must follow the new CUI pin with the adoption assertions.
This is separate from the four complete-file seals protecting the consumed
reference-v2 study, whose bytes and identities stay unchanged. Do not broaden
historical exemptions to quiet an ordinary stale live contract. Updating live
source authority authorizes no completed study, CLI or reader replay and turns
neither old study nor predecessor CI into new-pin evidence.


The frozen combined successor is `2e7846f8a901726a296e3a8ef006cff24bc457b5`.
It includes main `19c073bd` and both registered CI follow-through repairs:
selected-tier admission and supported-event numeric-consumer selection. The
manual consumer is skipped because its existing artifact trust admits push/PR
only; successful supported events remain required. The obsolete wiring-message
assertion now executes the real classifier-output forwarding and verifies its
tier bindings. Locally, 39 focused CI controls and 11 gate-shape checks pass,
and three isolated wiring mutants fail. These are source controls, not browser
or delivery acceptance. The reduced FPGA browser journey now switches all three
workspaces and checks visibility, selected controls and exact retained node/HDL
state; its live synthesis path remains byte-identical. Actual hosted acceptance
is still required. The preceding `09a4f407` run set was superseded before any
child started; cancellation followed explicit zero-running-child verification.

Fresh fast [Build40869114327](https://github.com/CrispStrobe/brickwright/actions/runs/40869114327)
and necessary full [Build40869128682](https://github.com/CrispStrobe/brickwright/actions/runs/40869128682)
are pending on that exact source. The earlier manual run `40856189963` was
cancelled before application execution after its unsupported consumer context
was identified; it is not qualification. The prior fast head `d32860b8` had one
real unit-2 wiring-assertion failure. Both originals remain distinct from this
successor; neither failures nor cancelled checks are waived. No main landing or
production deployment is claimed yet.

### Next actions, in order

PR1538 was closed without merging to consolidate the queue. Its complete
source ancestry is preserved in PR1536, whose main landing remains pending.
Do not reopen the old PR or infer main adoption from its closure.

The operator transferred remaining delivery to this campaign's maintainer under
[`circuit-menu-workspace-delivery`](../lanes/2026-10-28-circuit-menu-workspace-delivery.md).
The coordinator's former separate source/pin writer stopped. PR1536 contains
the full Circuit ancestry and exact CUI `4b65f154` adoption; Board is unchanged.
Packaged native confirmation is accepted at `17bbefca`. Forward checkpoint
`a0c0a60e` carries the measured viewport, Pixel and trigger Escape/Tab repairs.
These bounded results do not qualify the final combined application.

1. Registration and bounded policy source are complete: claim PR1558 landed at
   `f5acf3b3`; published PR1536 head `0f5dca52` admits selected fast/thorough
   execution and detects invalid/empty inputs through executable controls. The operator requires fast
   PR checks by default and no `ci:full` labels. Do not change job selection,
   thresholds, browser assertions or main/dispatch behavior.
2. Batch the guard and editor repairs into the existing PR1536. Require all
   enabled exact-final-head checks and actual affected application acceptance.
   Bind the production GUI readback to source, configuration and artifact; finish
   FPGA flag-on evidence and the unchanged profiling-build initial-JavaScript
   guard. Production entry bytes and profiling-build bytes are distinct metrics.
   Keep actual menu/chooser events, measurements, refusals and viewport limits.
3. Freeze independent readers' exact final head, pins, run and job identities
   before acquiring numerical originals. Preserve predicates and four historical
   study seals, advance only live current-package authority, acquire each
   original once and never replay the consumed study. Share retained native
   originals with their original custodian rather than downloading them again.
4. Normally merge the qualified matched head and verify parents/tree. Reconcile
   PR1516/1515/1517/1538 as integrated through that actual landing, without
   pretending the original PRs merged. Preserve source branches and failures.
5. Verify the guarded production deployment and actual live version/UI, then
   reconcile PLAN, ROADMAP, this handoff and the campaign record with actual
   landing and delivery identities. Source/package and local patched production
   observations are not release/deployment evidence.

Only then close the six-item campaign and ask for the next priority. No seventh
implementation lane is opened. Package adoption and browser qualification do
not establish a newer signed release or deployment.

The corrected successor also passes
[unit shard 6](https://github.com/CrispStrobe/brickwright/actions/runs/40767699282/job/123128359151):
three long-capture assertions, original refusals, all four historical seals and
the previously failing documentation-trigger check. The shard reports zero
ordinary failures; its four declared Arcade TODOs remain recorded. The complete
combined application result is still owed.

The successor `93aba754` unit-shard-3 original also passes the same four AC
checks and three mutations. Its independent reader accepts all 60 values,
with maximum error below 5e-16 V. This repeats the same authored input at CUI
`373d562b`; it adds no distinct designs and does not qualify the later menu
package. [Original job](https://github.com/CrispStrobe/brickwright/actions/runs/40767699282/job/123128359044).

### Explicit remaining limits

- Failed v1 study remains incomplete: 23 conforming inputs and nine unsuccessful
  inputs. It is not combined with v2 to inflate design coverage.
- The original pre-observation first-sample-at-zero expectation failed; the
  operator accepted the 1-microsecond convention now frozen in the regression.
- The original LM741 instant-settling predicate remains a documented TODO;
  its independently frozen settled-window replacement is the acceptance check.
- Long-capture current checks cover magnitude; a follow-on signed-current gate
  must first admit terminal orientation and include a wrong-sign mutation.
- The 32 MiB output-byte cap is untested through this CLI because the separate
  20,000-attempt cap prevents reaching it. Preserve both limits.
- AC coupling explicitly refuses combination with ADC reconstruction, watch
  mode or receipt/replay. These need separate composition/replay admission.
- A GUI AC-coupling selector, physical front-end calibration, noise and broader
  vendor-device domains remain separately scoped work.

## Previous handoff — 2026-10-27, updated 2026-10-28

**The earlier five-item campaign is complete; the subsequent six-item campaign
is not.** Lite adoption (step 1) and the v2 reference-qualified study (step 2)
are accepted as of 2026-10-28; tasks 3 to 6 remain open or partial. This is a historical
handoff; current actions are above, and dated results retain their original sources and limits. The
[ordered contract](../lanes/2026-10-26-reference-qualified-instrument-campaign.md)
owns this sequence. Read `LANES.md` and the affected lane records before edits.

### What is actually complete

| Boundary | Accepted evidence | Limit |
| --- | --- | --- |
| Previous consumer and fixed regression | Lite PR1413; 312 cases and 87,488 checks in the separately retained numerical run | 12 authored topologies; not 312 distinct imported designs, a new run on a later head, or physical calibration |
| New teaching-study acquisition | [Run40335666363](https://github.com/CrispStrobe/brickwright/actions/runs/40335666363), retained and independently read once | Failed/incomplete: 23 conforming designs, not a completed 31-design qualification |
| Board junction DC reachability | [Board PR710](https://github.com/CrispStrobe/bw-board/pull/710), merged `dfa4be8eff4cef22462ac508a67da5f706f7d72d` | Conservative DC-path admission repaired; no new transistor law or solver calibration |
| Matching CUI package return | [CUI PR124](https://github.com/CrispStrobe/bw-circuit-ui/pull/124), merged `66e3724020e795c3442f8da9a7af149dd5f74bd9`; actual Circuit/CLI checks, 17 SPICE checks and 83 browser scenarios | Supplier acceptance; not Lite adoption or v2 study execution |
| Lite adoption of the repaired pair | [Lite PR1478](https://github.com/CrispStrobe/brickwright/pull/1478), merged `e643932e`; pins Board `c7bcbe4b` and CUI `da28bb8c` | Step 1 done; packaged GUI acceptance of the LM741 domain is still owed (task 5) |
| v2 reference-qualified study | Harness [PR1501](https://github.com/CrispStrobe/brickwright/pull/1501), merged `8afe1333` at reviewed head `bfa530fc`; sole event [Run40681635060](https://github.com/CrispStrobe/brickwright/actions/runs/40681635060) attempt 1, read independently once | **Accepted** as numerical conformance against admitted ngspice-42 references; no physical calibration claim |
| Scope proof source | Merged publication observer and strict gates; forward native-keyboard diagnostic composed in [Lite PR1437](https://github.com/CrispStrobe/brickwright/pull/1437) | Forward native-keyboard path accepted in the actual browser; source PR remains unmerged at the recorded handoff; historical cause and product repair remain unproved |

Board's new checks exercise Shockley bridge and NPN-tail connectivity rather
than disguising a floating circuit with a ground resistor. A reference mismatch
was traced to ngspice's omitted fourth BJT terminal: its grounded substrate adds
a collector-to-substrate conductance absent from the authored three-terminal
law. The admitted zero-base/collector-resistance reference now explicitly ties
substrate to collector and retains physical junction conductance. This is a
reference-domain correction, not evidence for a Newton or voltage-fitting fix.
CUI's actual installed-package tests preserve Circuit state while comparing
signed node/branch observations and conservation against independent bounds.

### Current Lite boundary and preserved failures

#### 2026-10-28

Lite PR1478 (merged `e643932e`) now pins Board `c7bcbe4b` and CUI `da28bb8c`.
Board carries PR710's junction repair and PR717's opt-in LM741 nominal 25 C
bias/supply domain, using TI SNOSC25D typical values. CUI carries PR124, the
PR127 LM741 CLI, the PR126 opt-in passive precision batch and one whole-capture
budget. The paragraphs below describe the 2026-10-27 boundary and are retained
as history; the pins and local-only preparations they name are superseded.

The v2 study ran once: harness PR1501 merged `8afe1333` at reviewed head
`bfa530fc`, and the sole `study/reference-qualified-v2` event produced run
40681635060, attempt 1, success. Its original artifact (sha256 `59752a74…`) was
acquired once. An independent reader and a standalone recount matched the
frozen intent (`2b3a5be4…`) and found: 32/32 inputs; 31/31 comparable designs
conforming with 0 disagreements; 4,260/4,260 values; 15/15 captures; 83/84
selector locations, the 84th being the LT1763 named-refusal control that
correctly exited 2; no errors. The verdict is numerical conformance against
admitted ngspice-42 references, not physical calibration. The v1 result
(23 conforming, nine unsuccessful) stays recorded as failed/incomplete.

#### 2026-10-27

At this handoff Lite still pins Board
`836867513c3e7fac420ddaa32c17e1c7b6d3e513` and CUI
`1bc233c9297e03abb9b7eb603e045b4e92b0bb40`. The new pair above is qualified
at its suppliers. Package/lock/provenance preparation and v2 source controls
have been retained, but are **not published consumer acceptance**. The preserved package preparation is checkpoint
`5cfc7499ccabd0e45cf72b8806f43f466d0f48fc`; the stacked harness preparation
is `466f115f5c0591976a4f94a52660af9be69c5d4d`. Both are local-only, unpushed
and unqualified; they are recovery identities, not remotely available accepted
commits. Recover them through the ignored operational handoff, or reconstruct
the scoped work if unavailable. Verify live
`vendor-pins.json` and open PRs before resuming; neither a newer supplier default
branch nor prepared lock metadata proves an installed Lite package or GUI.

The v1 study contains 32 inputs: 31 graph-distinct candidate designs and one
named-refusal control. Its independent readback reported 23 conforming designs,
zero observed numerical disagreements, nine unsuccessful requests, 3,726
conforming values, 9/15 successful capture designs and 59/84 successful selector
locations. All 32 inputs remain in the denominator. Six LM741 requests exceeded
the CLI's 2 MHz contract, two nonlinear requests hit the repaired DC-path
admission, and the LT1763 refusal returned 2 while the harness expected 1.
Zero disagreement among acquired values does not qualify missing observations.

The consumed v1 source `92a9ab6e7e4c639fb43299451a974c6a700592d3`, its
`study/reference-qualified-v1` ref, official run, originals and reader verdict
remain immutable. The protected 312-case experiment and completed research
batches must not be repeated to populate this new study. No v2 event has been
selected. Prepared v2 requests use 2 MHz/40 samples for the same 20 microsecond
LM741 window and 20 ns solver cap, the real named-refusal exit, explicit BJT
substrate topology and version-42 thermal constants. Circuit/model parameters,
comparison bounds and the full denominator are preserved. The prepared source
passes 49 synthetic/source controls and 11 gate controls; these are not circuit
simulations or numerical qualification.

The scope failure has a separate boundary. An actual retained run observed the
same selector as sample during input capture, then envelope before change
capture and afterwards. The strict publication predicate correctly rejected it.
Playwright's option-selection return describes its pre-event selection and does
not prove React committed it. No observer write path or exact restoration
trigger has been established. PR1437's forward diagnostic uses one focus and one
page-level native ArrowDown, preserving actual identity, channel-removal,
precommit-negative, committed-mode, ADC, sole-add and rearm assertions. Four pure
controls and eight isolated syntax-valid mutants passed source review. The
owner's subsequent original-log audit accepted Browser light job122009150417 in
[Build40446909033](https://github.com/CrispStrobe/brickwright/actions/runs/40446909033):
all81 assigned gates passed without skips or failures. The actual trace records
one focus/input/change, the observed envelope-to-sample ArrowDown action,
precommit rejection and strict final focused sample/ADC/zero-channel publication.
This accepts the finite changed user path; it does not identify the original
restoration cause or establish a product repair. At this recorded receipt the
source PR was still open, pending its remaining checks and guarded merge.
The exact source diagnostic is
`4ea3c00858d5e56a45e0abdbc6baecf809f95567`, composed at owner head
`8a8421706541f706628d9872ca86e8b7b1fe34fd` in PR1437. Its three released
source/test/lane blobs are the reviewed handoff; a later composition needs an
explicit source and qualification join, not an assumption of identity.
The existing combined-browser owner retains this run and its one-time intake;
do not start a duplicate run or alter its released scope leaf.

### Resume in this order

**2026-10-28:** steps 1 and 2 below are done (Lite PR1478; v2 run 40681635060
accepted) and task 2 is recorded (PR1495). Resume with task 3, then the task 4
batch comparison, task 5 packaged CLI/GUI acceptance and task 6. The original
order is retained for its rules.

1. **Close the dependency boundary, then qualify Lite adoption.** Preserve the
   agreed current-supplier x86 GUI/PR1318 landing sequence. That lane owns its
   producer, reader, workflow and current-versus-historical source roles. Its
   rejected environment admission is not a guest pass and must not be retried
   unchanged. Once its accepted source lands, fetch actual main and compose the
   [junction package return](../lanes/2026-10-26-junction-package-adoption.md)
   against that parent. Require Board/CUI compatibility, both root and GUI
   manifests/locks, canonical notices and source identities, census mirrors,
   current identity tests and generated reports/matrix. Review current ROM
   identities with their owner; retain archived qualification/source identities
   and do not replace SHAs globally. The matrix output is
   `docs/generated/LANGUAGE-DEVICE-MATRIX.md`. Acceptance requires the standard
   hosted install, actual non-symlink full-source identity, one resolved engine,
   affected CLI/integration tests and the actual built GUI. Local metadata
   preparation is not a substitute. Preserve protected-profile cases, numerical
   methods and bounds; changing its current source selector must not dispatch it.
2. **Admit and execute one new v2 study.** Resume only after qualified package
   return, under the [harness scope](../lanes/2026-10-26-reference-qualified-study-harness.md).
   Bind exact qualified sources, UI manifest and independently derived runtime
   fingerprints; freeze the resulting intent and independent reader before any
   observation. Retained preparation binds Board `dfa4be8e` and CUI `66e37240`;
   a different supplier requires a fresh source admission, not a quiet literal
   edit. Keep other workflows' census/pointer entries intact. Perform exact-head
   source qualification, then separately admit the reviewed-head variable and
   sole `study/reference-qualified-v2` event. Source controls do not authorize
   this event. Acquire admitted originals once; independently reconcile all
   inputs, refusals, errors, values, captures, locations and clocks. Preserve a
   failed study as failed; no unchanged rerun or post-observation tuning. The
   original requirement for numerical acceptance before harness merge remains.
3. **Finish the remaining five tasks below in order.** First record the study's
   actual verdict and limits. Coordinate current owners and merge a bounded
   phase claim before implementation. Do not start a seventh task or imply the
   six-item campaign is complete because this documentation is merged.

### Scoped remaining tasks and acceptance

| Task | Bounded next work | Acceptance and stop condition |
| --- | --- | --- |
| 2. Four historical disagreements | **Completed as classification** (recorded in PR1495). All four rows are noncomparable on their disputed observables; other observables in those rows agree. 830/5564: a cutoff MOS drain on an unconnected label floats; ngspice sits 0.01 V below the source at 5 V and 3 V, ours at the source. Witnesses w09/w10 show the gap depends on source voltage, not node name; a finite drain load removes it. 4525/6597: no DC path fixes the common mode, so the DC root is not unique; with a tied common mode both engines agree to about 1e-7 V on both sides of the M2 threshold and for both capacitor placements. Ten of the twelve admitted witness cases were used; native output was identical at Board `761153ff` and `dfa4be8e`. | No model or importer defect was demonstrated, so no repair was made and no fitting toward either reference. Unknowns remain: the physical cause of ngspice's 0.01 V offset, which solve path ours took (not observable without instrumentation), the importer warnings (retained only as hashes) and whether a 26.83 C versus 27 C temperature difference applied at the historical head. The first witness harness had hash-path defects that stopped runs before any simulation; these failures and the wrong initial loaded-drain predictions are preserved, not rewritten. |
| 3. Scope rearm causality | Reuse the existing owner's accepted diagnostic receipt without reacquisition or replay. Separate the native-keyboard path from the original synthetic input/change restoration and stale-envelope observation. | Retain ordered original getters, handles, event/element identities and failures. A causal fix needs failing-before/passing-after evidence for its actual mechanism and affected hosted GUI acceptance. A passing different path alone does not close causality. |
| 4. Longer captures | **Partial (2026-10-28).** The refusal was traced to the precision-watch domain gate, not a sample cap. CUI's opt-in passive batch (PR126, one whole-capture budget) landed and Lite adopted it. The 5 ms/1 MHz batch comparison against closed-form/ngspice references has **not** been run. Original scope: start with a bounded passive-RC 5 ms/1 MHz batch. Account for whole-capture steps, solves, advances, history, output bytes and meter quadrature; distinguish capture from report cadence. | Compare all requested raw points, trigger times and meter windows to admitted references. Preserve the refused request and existing defaults/refusals. There is no universal 5,000-point cap: first establish which actual route/budget refused it. No per-chunk budget renewal or truncated-success claim. |
| 5. LM741 bias, supply and power | **Partial (2026-10-28).** The opt-in domain landed (Board PR717, CUI PR127) and Lite adopted it, with Board focused tests for KCL, rail power/energy, both bias polarities, zero/nonzero load and refusals. Packaged CLI/GUI acceptance is not done. Original scope: first define an opt-in nominal 25 C domain from published conditions: input bias/offset currents, quiescent current, rail return paths and output-load rail accounting. Keep unsupported domains unavailable. | Independent nominal equations plus terminal KCL and rail-power/energy checks, both bias polarities, zero/nonzero loads and refusal negatives; then actual packaged CLI/GUI acceptance. Typical datasheet values are not guaranteed limits. The 2.8 mA warning budget is not an existing measured-current law. |
| 6. Provenance and instrument realism | Complete the static-asset provenance transaction and assignment-prefixed census-location redaction, with failing omission/stale/changed-byte/leak controls. Then select one demonstrated bandwidth/coupling gap. | Canonical identity/mirror/notice checks, no confidential locations in generated output, independently expected time-domain behavior, unchanged ideal/raw defaults. Noise needs a separately justified model; randomness is not accuracy. |

The acceptance endpoint is a truthful completed/partial/refused result for each
bounded task, not a promise to simulate every imported circuit or every physical
oscilloscope effect. Shared models belong only in the owned `CrispStrobe/bw-board`
fork; shared import/CLI/instrument behavior belongs in the owned
`CrispStrobe/bw-circuit-ui` fork; Lite adopts qualified exact packages. No
third-party original, release or deployment is changed by this handoff.

### Fresh-agent checklist

- Read this handoff, `LANES.md`, the ordered contract and relevant phase leaves;
  refresh remote main, live pins, PR heads and actually enabled checks. Historical
  claim text describes an envelope, not proof that its implementation landed.
- Recover unpublished prepared candidates and retained-original identities from
  the private operational handoff when available. Their local locations and raw
  evidence are intentionally absent here. If unavailable, reconstruct and review
  the narrowly scoped source changes; never invent a missing original or replay
  an already consumed experiment to replace it.
- Preserve other owners' live work. The x86 lane controls current/historical
  roles; the combined-browser lane controls its actual diagnostic acquisition.
  Poll at most once a minute and acquire each admitted official original once.
- Keep public commits, prose, workflow output and artifacts free of confidential
  payloads and operational locations. Put operational recovery details only in
  ignored local notes. After the sixth task and final reconciliation, close the
  campaign and request the next priority; until then, report remaining limits.


## Current sequence — 2026-10-25

The [five-item contract](../lanes/2026-10-25-imported-circuit-instrument-campaign.md)
has reached its bounded consumer acceptance endpoint: current-consumer baseline;
a source-admitted distinct imported-circuit cohort; demonstrated recurring-cause
repairs; one existing part's reference assessment; one deterministic modeled
instrument effect. The remaining reference and model limits stay explicit. All source patches
remain in operator-owned CrispStrobe repositories. Stop only after the fifth
accepted step. The previous sequence and receipts below remain complete and
retain their own identities.

### Current supplier and consumer boundary

Step3 is adopted by Lite PR1397 at `7f9edea2cc648d7139d1f57099d5121361d48a01`:
CUI `408c179a9bf5ffc28a4626e9ff5a78fc35cdc671`, unchanged Board761153ff.
The actual built consumer passed both signed PMOS bulk-wiring journeys. The
retained 307-input affected recheck left previous native observations identical;
this does not convert unknown reference eligibility into physical validation.

For step4, the authored LM741 assessment used eleven related requests across
**two topologies**, not eleven distinct imported designs. Endpoints around
±0.999989289V and 20us continuous means around ±0.732945462V describe different
quantities. A 150kΩ external rail load draws 0.0001A, but that does not supply a
missing LM741 quiescent-current law. The demonstrated false supply-current zero
is repaired by Board PR704: absent/nonfinite represented branch current refuses
by name while genuine finite zero/signs remain valid. Its selected qualified
consumer target is `836867513c3e7fac420ddaa32c17e1c7b6d3e513`.

For step5, CUI PR122 landed `1bc233c9297e03abb9b7eb603e045b4e92b0bb40`.
[CI40226023234](https://github.com/CrispStrobe/bw-circuit-ui/actions/runs/40226023234)
passed all three jobs: 3,349 unit passes with 17 declared optional skips,
168 source-precision controls,17 SPICE checks and83 browser scenarios. The
ADC uses explicitly requested primary voltage point samples and an ideal
uniform reconstruction grid. The raw default, original measurements and meter
means remain authoritative. Modeled trace/trigger/readout, HOLD, clipping,
paired CSV and externally expected receipt settings are separately observable.
Supplier arithmetic/served-UI mutations are distinct from consumer acceptance.
The original failed source heads remain failed; later greens do not relabel them.

The [joint consumer lane](../lanes/2026-10-25-meter-adc-package-adoption.md)
landed through PR1413 as `b26ae0aedde4e53a254b0bc48c83b156be7cb026`.
No private cohort replay, physical certificate, signed release or deployment
is part of this closeout.

### Accepted joint consumer and protected numerical result — 2026-10-26

[Build40264899201](https://github.com/CrispStrobe/brickwright/actions/runs/40264899201)
qualified source `02ef9419443bbc3154b7a94ace8e35616df31750` with all five
workflows successful: 36 successful checks and six source-declared skips.
Independent original-log readback accepted 10 new browser checks, six preserved
browser checks and three required unit checks. The actual checkout
`41aa713874cccb5457007a8b6d10f67a347c6634` and reviewed source share tree
`922580819a699958a0003f4cab050a4dbd36067e`, also verified at the matched merge.
The accepted journey includes meter unavailable/represented-current recovery,
ideal ADC reconstruction/trigger/CSV/HOLD, reset/rearm and failed-source refusal.
Pinned-package verification reports were observed; the independent reader did
not re-execute npm-pack verification or audit a compiled artifact body.

The separate fixed recheck
[Run40237367378](https://github.com/CrispStrobe/brickwright/actions/runs/40237367378)
ran once at `1f967949ffc16a0ff792e493c1343e7fe88a6e2e` with Board83686751
and CUI1bc233c9. Independent readers accepted 312 cases and 87,488 checks:
264 ngspice cases and 48 explicitly nominal cases across 12 authored topologies.
All 240 raw waveform CSVs match baseline40172711900 byte-for-byte. Its numerical
source closure remains unchanged in the accepted consumer; the experiment was
not repeated or relabelled as a numerical run on source02ef. The original1f
whole-head qualification remains rejected because an enabled Rust check was
cancelled; the accepted numerical result does not waive that failure.

The earlier mode-publication timeout and point-rearm failure remain unresolved
causal observations. This later successful hosted journey qualifies this run;
it does not identify either intermittent cause or establish a product fix.
The [unclaimed follow-ons](../ROADMAP.md#scoped-follow-ons-after-consumer-acceptance)
cover that attribution, long captures, broader admitted references and physical
part/instrument modeling. No further lane is started by this closeout.

### Step 1 accepted: current package baseline

[Run40172711900](https://github.com/CrispStrobe/brickwright/actions/runs/40172711900)
executed once at `4c416bcfe1a219faaec371ac638f607628f347a7` on the frozen
`lane/circuit-instrument-baseline-20261025` reference, with Board
`761153ff92d521c01107ee7b32922ba7adc10ee2` and CUI
`91d8434a79d373cef2837c137ab356356f1a3b44`. Node 22.23.3 and ngspice42 were
observed in the retained runtime/version records, not inferred from the old run.
Readers, case intent and source fingerprints were frozen before dispatch.

All 312 cases passed independent readback: 264 ngspice and 48 explicitly nominal
analytic, across 12 authored topologies. Independent readers admitted 4,448
files and recomputed 87,488 numerical checks, with zero failed, refused,
noncomparable or missing cases. Coverage remains 2,024 measurement locations,
704 waveform channels / 68,480 points, 960 static observations and 26,760 meter
windows. The unchanged case-definition SHA-256 is
`063ee3e41c26a30ae2fbf9e6435d0423215c62a8b738e5b4c8385f233c6a0304`.
All 240 retained waveform CSVs equal the preceding run40077158320 byte-for-byte;
this informational comparison did not replay either experiment or replace the
frozen independent numerical acceptance criteria. Nine retained producer
perturbations were detected; independent pre-run controls additionally rejected
eight common-mode definition corruptions, 20 invalid acquisition contracts and
11 wrong runtime/path/oracle identities.

The selected engine source fingerprint covers 321 JS/JSON files and is
`7663f7e174247a075e965cbfa7273cdf4aa13e60a10e890f8ec31264dc95fbb8`;
the selected CLI fingerprint covers 433 files and is
`25ede8e0dce25a7eb7cf6b642c874303165fb29f43f5446e20d934744d7df6c1`.
All 240 waveform receipts and 72 static command records join the admitted
installed package/runtime identities. The actual original archive is
14,265,673 bytes, SHA-256
`b7f0b3e83f0452ffe04f299ef1c7616aecd03745e99a8d5bd189ed26a2d61679`;
the original job log is 267,987 bytes, SHA-256
`9845bafdffc1597f163e0b75c945c0141ac44ad39e7fd1f4784b2bc50b1a5191`.
Both were acquired once after terminal metadata admission. Independent readers
use the originals, without importing the producer helpers or replaying CLI,
engine or oracle. This is JavaScript MNA and stated nominal-reference agreement,
not native execution, full transitive-dependency reconstruction, physical part/
ADC calibration, full-corpus validation or a newer signed release receipt.

### Step 2 evidence: imported structures and actual CLI

The frozen offline research cohort contains 307 graph-distinct structures:
299 OP-only and8 OP/AC source inputs,with 278 containing MOS devices. Exact
labelled connection-graph isomorphism preserves ground,directed terminals and
model polarity; device retargets,value changes,formats and analysis choices do
not inflate the design count. Sources are small (at most 13 parts / 14 nodes),
not a balanced inventory of op-amp/regulator/teaching circuits. Private input
rights do not become public redistribution clearance.

At the same qualified Board/CUI package commits as step1,with Node 22.23.2 and
ngspice 42, the unchanged comparison contract reports:

| Imported source outcome | Inputs |
| --- | ---: |
| Pass | 67 |
| Partial | 8 |
| Numerical disagreement | 4 |
| Not-run/refused or unavailable comparison | 228 |
| Total requested | 307 |

There are 350 compared numerical observations:339 agree and11 disagree; no
missing,extra or nonfinite compared values. These counts are not350 circuits.
The first oracle sandbox failure remains retained. Repairing its temporary-file
boundary reruns only the failed oracle work and reuses all307 byte-identical
original native responses. Original raw SPICE bytes,generated decks,streams,
source/runtime hashes and every failed/incomplete invocation are independently
reconciled. Three extra invocations are explained FAILED fallback trials and
never rescue a result. Numerical bounds and original failures are unchanged.

An actual installed-CLI study uses 32 of those inputs,not 32 additional designs.
It runs 32 `op` and 32 `op --kcl --json` commands. Twenty OP calls succeed;19
also provide complete conservation diagnostics. Independent readback of 190
terminal observations recomputes 169 net/part checks,all passing,and 81
descriptive oracle comparisons (58 voltages/23 signed source currents) agree.
Reference-method eligibility remains unknown for those 19 cases; agreement is
not a device-accuracy certificate. Refusals include time-varying sources,
DC-floating networks,semantic loss and unsupported PMOS representations.
A genuine implicit-NMOS-body mapping gap explains the additional KCL refusal.
The audit accounts separately for six expected intrinsic NPN collector nodes
and authored external nodes; arbitrary unexplained nodes are not ignored.
This does not add a new public/diagnostic-node CLI output format.

Two unchanged original RC inputs separately request5ms/1MHz watch acquisition
with5,000 samples,ideal differential source/R/C channels and signed meter
queries. The current product refuses passive precision watch before creating
CSV/receipt artifacts. Both conditional transient references remain NOT-RUN.
These are observed acquisition refusals,not successful traces or completion
of the source's5,001-point analysis. The CLI reserves captureSamples+2,so this
request also proves no ring wrap. Existing312-case time-domain evidence stays
separate. Static OP current is INTO-terminal; the meter uses OUT-of-terminal
current. A5ms meter window covers0..t and is not an arithmetic sample mean.

### Step 3 source repair and remaining endpoint

[CUI claim PR119](https://github.com/CrispStrobe/bw-circuit-ui/pull/119)
bounds exact PMOS bulk wiring (88 refused inputs),strict implicit-NMOS-body
conservation,and authored-step-aware preflight. Preserve the fourth PMOS
connection and all unsupported-model refusals; never drop bulk current or raise
the default20k work cap. Require nonzero-body-current/wrong-ground/missing-wire
controls,actual CLI/SPICE checks,affected browser proof and all enabled
exact-head checks before qualified consumer adoption. A four-terminal SPICE
representation does not assert a new physical package face.

The four numerical mismatches reduce to weakly anchored cutoff/common-mode
witnesses. Retain them and their original bounds; successful SPICE execution
alone is not a robust unique physical reference,and normal device physics must
not be tuned to a convenient root. Long passive-watch support is a separate
capability: an additive domain/profile design must bound whole-capture work,
distinguish report callbacks from all acquired samples,preserve the original
failed request,and handle meter history plus accepted-solve quadrature. Do not
rename200 samples as5000 or reset limits at each report.

Step 4 still needs an independent lawful LM741 reference across rails, load,
saturation,frequency and slew. Step 5 still audits existing effects and qualifies
one genuinely missing deterministic measurement-chain effect with ideal/raw
preserved. Aperture/audio is already adopted; do not reimplement it. Only owned
CrispStrobe source repositories are patched. No new release upload or physical/
full-corpus accuracy claim follows from these studies. The five-item loop stays
open until the fifth accepted step.

## Previous completed sequence — 2026-10-24


Status reconciled 2026-10-24: **existing TestFlight delivery verified; fixed
312-case CLI campaigns independently accepted; bounded scope-display consumer
adopted and actual built-GUI originals independently accepted**. This is a bounded follow-up to the qualified circuit CLI, not a
report that the schematic corpus or physical instruments have been validated.
Use [the lane protocol](../lanes/PROTOCOL.md) and dated claims for current ownership and the
[current plan](../PLAN.md#current-circuitinstrument-campaign--2026-10-15) for order.

## What is complete and what remains

The upstream nominal LM741 six-case CLI proof and Lite adoption
[PR965](https://github.com/CrispStrobe/brickwright/pull/965) are complete.
The new harness contract was traced against Board
`b5650092695643622a53bcc40008133760e2d8a2` and CUI
`17fd4afb0bf27015b099ca67c9cca05919084654`. The runner refuses a different
consumer pin until its admission and manifest have been reviewed; it never
substitutes a newer sibling or silently moves a dependency.

1. **Release prerequisite: verified.** The read-only
   [audit 40048235422](https://github.com/CrispStrobe/brickwright/actions/runs/40048235422)
   observed v0.1.26 on both iOS and macOS: valid, unexpired, matching English and
   German notes, both groups linked, review approved, and both internal/external
   states `IN_BETA_TESTING`. Independent readback of the retained original
   recomputed complete availability. This is the existing immutable release
   `6d78f7e107752497ed96b30b03e985386916fc59`, not a new application build.
   No recovery write or upload was needed; the earlier metadata-wait failure
   remains preserved separately. This is a finite observation, not a continuing
   distribution guarantee.
2. **Harness implementation.** Preparation is permitted in parallel with release
   recovery. The [merged claim](../lanes/2026-10-23-circuit-instrument-regression.md)
   owns the bounded implementation below. Pure controls exercise transport,
   independent equations and false-success cases; they are not an engine run.
3. **Campaign execution, after TestFlight.** Run once on the admitted installed
   consumer with the fixed manifest, independent references and original outputs.
   A clean harness unit suite is not a measurement-campaign result.
4. **Causal repairs.** Classify every demonstrated failure, repair the owning
   upstream layer, qualify it and adopt one purposeful exact-pin batch.
5. **Instrument realism.** After the numerical boundary is understood, qualify
   the display-only scope improvement below and report remaining limits before
   proposing another campaign.

## Executed campaign — 2026-10-24

[Run 40057471489](https://github.com/CrispStrobe/brickwright/actions/runs/40057471489)
executed the fixed manifest at Lite `20f5ade6dda10616a3f51d5230496415c6e6b2f4`,
Board `b5650092695643622a53bcc40008133760e2d8a2` and CUI
`17fd4afb0bf27015b099ca67c9cca05919084654`, using Node 22.23.3 and ngspice 42.
All **312 attempted, executed and comparable cases passed**: **264 ngspice**
and **48 nominal analytic**, with zero failed, refused, noncomparable or not-run
cases. The nine required retained-record perturbations were detected without
replaying an original experiment. These are 12 authored topologies, not 312
imported schematics or validation of the historical corpus.

Independent readers checked all **4,448 retained files** and recomputed
**87,488 numerical checks**, agreeing on all 312 cases. Observed coverage was
**2,024 measurement locations**, **704 waveform channels / 68,480 waveform
points**, **960 static observations** and **26,760 meter-window observations**.
All 240 waveform receipts and 72 static command records join the admitted
installed package identities. Independently reconstructed source fingerprints
match the recorded CLI/engine fingerprints. This matrix uses JavaScript MNA;
package-byte checks of unrelated Wasm payloads do not establish native execution.
Transitive dependencies were not independently reconstructed; this is not a
hermetic-execution certificate.

The official original archive SHA-256 is
`1456d0437b78c55b06b90dfa0b2b8ef60992a7ebd729184e6f08624d691a9828`.
Input definitions and tolerances remained frozen at definition SHA-256
`063ee3e41c26a30ae2fbf9e6435d0423215c62a8b738e5b4c8385f233c6a0304`.
The archive and job log were acquired once; independent audit did not rerun
CLI, engine or oracle. No model defect was demonstrated in this matrix, so no
numerical patch or tolerance change is justified. Existing unrelated producer
and audio work remains separately scoped. The fifth ordered task is also
complete; its separate consumer identities and built-browser proof appear below.

This result does not establish physical LM741/ADP7118 accuracy, missing device
physics, analog front-end/ADC fidelity, hardware behavior, or a newer signed
TestFlight application. Later package adoption must preserve this historical
receipt rather than relabel it with unmeasured sources.

## Bounded implementation

The eleven owned paths are the dated claim, campaign sections of `PLAN.md` and
`ROADMAP.md`,
`.github/workflows/circuit-instrument-regression.yml`,
`scripts/circuit-instrument-regression.mjs`,
`scripts/lib/instrument-regression-cases.mjs`,
`scripts/lib/instrument-regression-compare.mjs`,
`test/circuit-instrument-regression.test.mjs`, this document, `CI-POINTERS.md`
and the workflow's scoped `docs/generated/ci-step-census.json` entry.
The case and comparator modules are pure; neither imports a test module or
launches a process on import. Keep the workflow manual-only. Do not dispatch
the campaign while preparing the harness. No production model, GUI, existing
workflow, dependency, lock, pin or private corpus input belongs in this lane.
The pointer/census follow the release workflow's canonical bootstrap; this
lane does not change the generator or unrelated observations.

## Commands and evidence

`node scripts/circuit-instrument-regression.mjs --plan` prints the deterministic
manifest without installing, simulating or invoking an oracle. Pure controls:

```sh
node --test test/circuit-instrument-regression.test.mjs
```

After harness qualification and merge, dispatch **Fixed CLI instrument regression**
once with `release_run: 40048235422`. It checks that exact official run/attempt/
job/source metadata and that the admitted release source is an ancestor.
Its categorical release snapshot is bound to the independently read original:
summary SHA-256 `5f3b7d92ede237ab656d79e2a1d9812474f33197e8dd337f0b95b143ce35510e`;
original log SHA-256
`734373adbf58a5763860f558e8568ac82b8a173ad90f00cbee8cc8da38502bdb`,
24,622 bytes. The raw original was acquired once and retained; the campaign
does not download it again or publish a raw-log copy. The snapshot contains no
private resource IDs. A different observation requires a reviewed provenance
update; an arbitrary successful run or pending review cannot open the gate.

The manual workflow installs the locked consumer and ngspice on the hosted
runner, fetches the two exact source commits, and invokes `--run` with explicit
installed-root, source, admitted release observation and fresh output paths. The runner
itself never installs dependencies. Existing output directories are refused.
Every original command/stdout/stderr, input, oracle deck/table, raw capture,
work receipt, package proof and comparison is retained. Incomplete reports and
missing prerequisites fail. The default and unit-test paths never run this job.

Ngspice retains its adaptive raw table for meter-window integration, then
produces a separately labelled equidistant reference with `linearize`. This
oracle interpolation does not alter CLI samples. The comparison rejects shifted
or incomplete time grids. Output columns use the documented
[ngspice table controls](https://ngspice.sourceforge.io/docs/ngspice-manual.pdf),
16-digit output, a single scale and explicit vector names.

Use Node 22 and the installed `bw-circuit-ui` CLI, not a sibling checkout's CLI
or engine override. Before numerical work, use the existing package-provenance
verifier to compare installed Board/CUI bytes against independently fetched Git
sources at the consumer's exact pins and verify single-engine resolution.
Metadata consistency alone is insufficient. Record actual CLI and oracle argv,
versions, source/tree identities, input bytes and hashes. Keep this verification
read-only; the runner must not silently install dependencies or move a pin.

## Planned matrix: freeze before observing results

| Family | Cases / templates | Parameter grid | Reference |
|---|---:|---|---|
| Resistive divider / bridge | 64 / 2 | 32 each; four signed/zero source levels, resistor scales and ratios; include a balanced bridge | ngspice, plus closed-form controls |
| RC low-pass / high-pass | 64 / 2 | R: 1k, 2k, 5k, 10k; C: 10n, 20n, 50n, 100n; two polarities | ngspice |
| RL low-pass / high-pass | 64 / 2 | R: 100, 200, 500, 1000; L: .01, .02, .05, .1 H; two polarities | ngspice |
| Two source/diode/resistor arrangements | 48 / 2 | Three signed bias cases, four resistances, two explicit IS values | matched Shockley ngspice |
| NPN common-emitter / emitter-follower | 24 / 2 | Three supplies, two base-bias values, two BF values | matched explicit DC model, ngspice |
| Nominal LM741 follower | 24 / 1 | Two signs, three source phases, four loads | independent loaded transfer function |
| ADP7118 startup | 24 / 1 | Three loads, four capacitances, two rails; include 47uF and 100uF | independent RC/current-limit envelope |

Total: **312 parameter cases, 12 authored topology templates**; **264 direct
ngspice cases and 48 analytic model cases**, reported separately. These are not
312 distinct imported schematics or a fresh count of the historical corpus.
The executable manifest freezes the concrete values, initial conditions,
selectors, integer clock grids and per-quantity tolerances before observation.
It contains **72 static DC cases and 240 waveform cases**. Its definition hash
identifies all 312 cases, not just this summary table.
Do not fit thresholds to output or silently remove refused combinations.

RC/RL proposals use 100 observations over eight time constants with the exact
same finite source ramp and zero-state assumptions in both systems. Verify
integer-nanosecond admission rather than promising all combinations succeed.
Resistive sources rise over 10us in a 100us capture. Reactive sources rise over
one tenth of a sample interval. LM741 uses ±10mV, delays of 10000/10033/10067ns,
1ns rise and 2k/10k/100k/1M loads. It stays within 20us / 2MHz and uses a loaded, phase-aware nominal reference,
not ideal unity gain. ADP7118 stays within 1.2ms / 100kHz and must include current
limit entry and release witnesses. Its loads are 100/1000/10000 ohms,
capacitances 1/10/47/100uF and input rails 6/8V. The 47uF cases require entry
and release; 100uF requires entry, without claiming release inside this window.
Those witnesses use interval currents recovered from actual prefix integrals,
not an inaccessible internal region flag. If a chosen case never enters a required
branch, do not count it as covering that branch.

For diode/NPN comparisons, match every relevant model field and the fixed
thermal point: VT=0.02585 V, TEMP and TNOM both 26.826793442075882 C. Unsupported
breakdown, temperature, charge or other physics is not a numerical pass. Do not
substitute generic transistor defaults or a current-source surrogate.

Fixed absolute/relative gates are: passive waveform 100uV/0.1%, passive means
1uV/0.01% or 1nA/0.01%; static voltage 10uV/0.1% and current 1nA/0.1%; LM741
waveform 100uV and means 2uV (current allowance 2uV/load + 1pA); ADP waveform
0.5uV, voltage/current means 1uV/1uA and package KCL 0.1nA. LM/ADP relative
allowances are zero. These gates are frozen before the first circuit output;
failure is a diagnosis input, never permission to fit the gate.

## Measurements and comparisons

- Include supply, output and differential nodes, signed load/source currents,
  and terminal/net KCL where exposed. NPN observations include B/E/C; LM741
  includes actual input/output and both load terminals. ADP package-current
  checks must use actual exposed authority, never nominal quiescent current.
- Name the probe explicitly. The initial mathematical matrix uses `ideal`;
  1x/10x loading requires the same impedance in the reference. Ideal-probe
  agreement is not a physical oscilloscope front-end qualification.
- Treat clock and acquisition identity as data. Scope CSV `elapsed_seconds`
  is relative to its own `startTimeNs`, not time zero. Retain and check the
  header, interval, point count, requested window and actual timestamps. Never
  shift a later record into an earlier missing sample's position.
- Keep sign conventions explicit per channel. Static OP currents are INTO
  the terminal; multimeter currents are OUT of the part. Transform the reference
  deliberately and retain its original sign. Do not compare formatted display
  strings instead of finite SI values and units.
- `measure --current` is refused; use `--meter current:PART.TERMINAL`.
  `op --kcl --json` exposes signed static conservation, not an independent oracle.
  Plain `op --json` is not a JSON voltage API at the adopted revision. The typed
  `dc-sweep` route needs distinct endpoints and 2–501 points. Pick the actual
  supported route; do not invent one-point or equal-endpoint sweeps.
- Compare whole records and meter-window integrals, not only final values.
  Reject absent/duplicate channels, points or selectors, nonfinite data, wrong
  units, ambiguous grids, incomplete capture and failed bounded-work receipts.

Retain original input and oracle decks, CLI stdout/stderr, oracle output,
waveform CSV, manifest and work receipts, each with bytes and hashes. Input
generation alone is not oracle execution. Reconstructing a topology incorrectly
in both generators must not yield a misleading pass: add independently authored
topology/parameter controls and simple analytic witnesses.

## Required negative controls and report

Pure tests cover deterministic IDs and the 312/12 and 264/48 counts; finite,
unit-typed data; exact clock/window identity; missing/duplicate observations;
and complete denominator accounting. Detect a changed voltage, reversed
nonzero current, timestamp-only shift, wrong R/C/L, LM741 phase/pole substitution,
and omitted ADP current-limiter branch. Negative tests must reach numerical
comparison, not pass because an unrelated parser or model refused the input.
Use nonzero witnesses: flipping a genuine zero does not prove sign sensitivity.

During actual execution, repeat the relevant perturbations against retained
real outputs without replaying the guest or replacing original evidence. Report
all preselected IDs, reference class, meaningful measurement locations and
attempted/executed/comparable/pass/fail/refused/not-run counts. The partitions
must reconcile. Preserve originals on failure and exit nonzero for a failed or
incomplete campaign; unavailable ngspice is not a successful skipped campaign.

## Follow-up repair and realism lanes

For each failure, retain the smallest original reproducer and distinguish:
import loss, unsupported/model-mismatched physics, engine error, instrument or
clock/sign error, bounded-work exhaustion, and harness/oracle error. Change only
the owning layer with a load-bearing negative control. Shared engine/importer/
instrument behavior lands upstream first, then Lite adopts exact qualified
packages; do not create a local fork or move thresholds to improve a score.

The bounded scope-display implementation is upstream
[PR117](https://github.com/CrispStrobe/bw-circuit-ui/pull/117). It exposes actual
capture mode, interval, capacity, retained/displayed counts, origin and ring wrap.
Only point-sampled spectra receive a Nyquist value. Viewport-overrange warnings
refer to the drawn range, not physical clipping; absence of an analogue
anti-alias filter or ADC model is explicit. HOLD freezes the last drawn caption
and picture while capture can continue. Raw samples, CSV, solver and electrical
probe loading are unchanged. No ADC noise, resolution, filtering or hardware
accuracy is invented.

The upstream real-browser qualification passed all 71 scenarios, including
actual vertical warning/clear controls with byte-identical CSV, prefix/wrap,
HOLD with a changed requested viewport, visible redraw on RUN, and the separate
sample-series metadata. An earlier proof failed because it inspected a queued
Step before cooperative work completed. The forward evidence waits for the
actual clock, capture count and ready state; it preserves the original failure
and does not change production behavior, expected counts or timing budgets.

The first consumer source-controls job
[40072171188](https://github.com/CrispStrobe/brickwright/actions/runs/40072171188)
reported 66/67: the tracked GUI manifests and current x86 browser
controller/reader still selected the preceding CUI pin. An initial census of
materialized sparse files had omitted them. The forward repair derives the
complete dependency closure from the Git index, updates only current identity
bindings, regenerates GUI metadata and notice source URLs, and preserves every
guest/reader assertion and disabled actual-execution guard. All 67 local source
controls pass; the original failure is retained. The final hosted controls job
also passed all 67 on the qualified consumer head. Historical originals keep their original reader
revision and measured sources.

Lite adoption [PR1334](https://github.com/CrispStrobe/brickwright/pull/1334)
is qualified under the
[consumer claim](../lanes/2026-10-24-scope-display-consumer.md). Its evidence
was acquired once and read independently, without replaying the CLI, engine,
oracle or browser. Historical originals above retain their original identities.

### New-consumer numerical result

[Run 40077158320](https://github.com/CrispStrobe/brickwright/actions/runs/40077158320)
executed once on branch `lane/scope-display-adoption-20261024`, exact head
`75c95bea9b34b08d0dc1014c41df551c1451b10f`: Board
`b5650092695643622a53bcc40008133760e2d8a2`, CUI
`420f3e15bd0064119416386853bd35713347c252`, Node 22.23.3, ngspice 42.
The existing workflow accepts this branch; this was not a default-branch run.
The unchanged definition SHA-256 is
`063ee3e41c26a30ae2fbf9e6435d0423215c62a8b738e5b4c8385f233c6a0304`.

All 312 cases passed: 264 ngspice and 48 explicitly nominal analytic, across
12 topologies. Independent readers admitted 4,448 files and recomputed 87,488
numerical checks, with zero failed, refused, noncomparable or missing cases.
The measured coverage remains 2,024 locations, 704 channels, 68,480 waveform
points, 960 static values and 26,760 meter windows. All 240 waveform CSVs are
byte-identical to the retained preceding campaign; none was replayed.
All 240 waveform and 72 static receipts bind the observed runtime and packages.
Nine retained perturbations were detected.

Original archive: 14,265,211 bytes, SHA-256
`33d69d284ffe2b75fe6d7e475845b14b628a075a51a2636cf75b11e1f17e38d4`.
Original job log: 261,846 bytes, SHA-256
`1b5acf3f86c83c8cc4a073f64e8f5c4da95293694b3f31c70f64d7c06026a9ef`.
These are JavaScript MNA and stated analytic comparisons, not native/Wasm,
transitive-dependency reconstruction, hardware or full-corpus qualification.

### Actual built-browser result

[Build 40074942830](https://github.com/CrispStrobe/brickwright/actions/runs/40074942830)
qualified the same consumer. Light browser job `120819548000` passed its actual
Instruments checks. The original checkout
`5070169cc275ec5035b81bcc6c5545dfb8cdef60` has parents
`ab7c288fe7bf82ed34cb5c1d28219961a14bde78` and the candidate above; its tree
`03785084571a28c1184563b7587bb49df1c26d9f` equals the candidate tree exactly.
The original log proves installed package payload checks in both root and GUI
scopes, single-engine resolution, editor build and serving that built editor.

Adoption landed as `b0b9b3d55eaac812484018f7856089c71bed775d` after all
34 enabled candidate checks succeeded; six conditional jobs were skipped and
the superseded branch-push Rust run was replaced by its successful PR run.
Main advanced during qualification by 21 disjoint CI-reporting and native-
qualification tooling paths. The merge preserved them: every tracked byte
outside those paths equals the qualified candidate, including application
inputs, pins, case definitions and browser producer. The actual merge parents
and predicted tree were verified. This is consumer-input equivalence, not a
claim that the new whole-repository tree was the earlier browser checkout or
that the native qualification tooling was exercised by this browser proof.

The real RC example uses the actual 100 Hz sine source, amplitude/offset 2.5 V.
Six retained observations join capture clocks to displayed mode, interval,
counts, capacity and origin. They cover the 5,000-point prefix, 10,000-point
wrapped envelope, HOLD while acquisition advances, RUN redraw, a separate
500-point sample capture and viewport warning/clear. The disclosed sampling
limits are actual UI text; overrange describes the viewport, not hardware
clipping. Three decoded canvas controls confirm HOLD stays unchanged and RUN
redraws. Both 5,000-row CSV downloads are exactly 225,269 bytes and have SHA-256
`3832bae83cecc5f7ce1633fdf60d7b0577e9f06e98744d599833d22a8066ac77`.

Original Instruments artifact `12555357324`: 559,808 bytes, SHA-256
`87d271539f0d2ed03e2a501bd41b3ffdecc12c0443670d210184f1af804997ca`.
Original light-browser log: 394,057 bytes, SHA-256
`2eecb25256f76e8628d2bbe23a3c9d3e2055e04dbe9a928b66e7ab70719fb8b3`.
The archive retains both CSV downloads, observed circuit, capture/clock/readout
records, warning text and canvases. Independent readers use the originals,
not producer imports or a browser replay. Neither this built web application
nor its package provenance qualifies a newer native or signed TestFlight binary.

Stop after these bounded tasks and report unresolved physics and evidence
limits. Do not turn "fix failures" into implementing every device model or
automatically starting another corpus-wide campaign. Check existing owners
before taking a follow-up; release, runtime and other simulator lanes remain
independently owned.

## Work beyond this bounded endpoint

These are follow-ups, not evidence that the fixed matrix covers them. Refresh
ownership and source state before claiming one; do not begin another campaign
as an automatic continuation of this five-item sequence.

- **Imported-corpus measurements:** select a frozen, licensed inventory and a
  stratified set of supported circuits with meaningful probe locations. Record
  actual attempted/comparable/refused denominators and explicit model assumptions.
  Retain input decks, raw captures and independent SPICE results. Acceptance is
  per supported topology and measurement; it is not a count of files that parse.
- **Part-specific model accuracy:** choose one actual op-amp or regulator and a
  lawful independent reference. Specify rails, loading, temperature, startup and
  bandwidth limits before measurement. The 48 nominal analytic cases establish
  agreement with their stated approximations, not vendor or hardware accuracy.
  Repair only a demonstrated cause upstream, then adopt one reviewed pin batch.
- **Physical instrument behavior:** separately scope probe loading, bandwidth,
  anti-alias filtering or ADC behavior with explicit parameters and independent
  time-domain expectations. Preserve the ideal/raw acquisition path and identify
  each modeled effect in CLI receipts and GUI labels. Disclosure alone does not
  implement these effects, and invented noise cannot serve as validation.
- **Aperture/audio acquisition:** respect the existing upstream aperture/audio
  and Lite supplier-adoption claims. Their sampling, filtering and playback work
  is separate from the additive display metadata in this lane.
