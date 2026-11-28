# Code documents and owned console integration — 2026-11-27

Status: implementation candidate; normal supplier adoption and main landing are
blocked by the existing qualification dependencies recorded below.

This is the next bounded milestone in
[the runtime plan](CODE-RUNTIME-AND-GAME-EXPORT.md#83-authored-documents-and-actual-code-tab-integration),
continuing [Brickwright #1855](https://github.com/CrispStrobe/brickwright/pull/1855)
and [sb3-creator #246](https://github.com/CrispStrobe/sb3-creator/pull/246).
The owner authorized implementation, incremental remote checkpoints and qualified
merges. The feature was refreshed with current main before implementation and
again with the later CAD update `d1e76cc60244ef8814d33e147e39ce4c58749dbc`.
The companion Pico ownership claim on main
`87daa291de5c16aef181cf1e9d9688ca81e9eaa5` is included before that helper's
implementation. The final production/UI/harness checkpoint is
[`71d6854c`](https://github.com/CrispStrobe/brickwright/commit/71d6854cb3c4411072deeaee448281d2fc9d13c1).

## Source and execution contract

`code-source-document.js` owns a version-1 record in the existing Code autosave
and `brickwright/state.json` Code section. There is one authored document, with
independent selected-view state and disposable generated projections:

| Field | Meaning |
| --- | --- |
| `lang`, `code` | Exact authored language and text; older readers recover these fields |
| `revision` | Authored revision, incremented even by an edit followed by undo |
| `selectedLang` | Visible language without changing authorship |
| `target`, `runtime` | Persisted device and selected execution engine |
| `generationOptions` | Driver/async/events, console contract and BASIC generation settings |
| `execution` | Authored JavaScript's owned-console contract, when applicable |
| `projections` | Generated text, originating revision/options, diagnostics and execution contract |

Tab derivations start from the authored source. A stale asynchronous derivation,
changed VM, edit/revert or displaced request cannot publish into a newer editor.
To blocks preserves the exact author even when invoked from a generated view;
its final admission check runs before project mutation. From blocks reads the
actual SB3 graph and retains the canonical Boolean-value lowering.

Editing a generated view makes that text the new authored source and clears
stale projections. Loading an explicit file, catalog item or starter program
creates a fresh document. This includes ASM/C starters: their old Pseudo text
belongs to the previous program, while the deliberately selected device is
preserved independently. Generated assembly from a machine build remains a
revision-bound view, and does not replace authored assembly.

Empty programs persist. Legacy records retain their archive shape and migrate
when read by the editor. Unsupported versions are refused without overwriting
their stored bytes. In-memory editing accepts text beyond the persistence budget;
the 512-KiB UTF-8 envelope limit is enforced at read/save boundaries. Save flushes
the live editor and refuses the archive if that flush fails, preventing an old
localStorage record from silently accompanying newer blocks. Refused sidecars
preserve live edits that have not reached the debounce timer yet.

JavaScript offers **Classic source** and **Console program**. The latter requests
the existing `owned-console-v1` generator contract: shim driver, async tasks and
the admitted console subset. A supplier revision that ignores that contract
produces an explicit refusal. The generated header and durable provenance both
identify the contract; deleting the header after editing does not enable an
unsupported reverse conversion. The existing worker owns input, delay, Stop,
output and completion. This does not implement Scratch game scheduling or a
simulator/game bridge.

Pico Python/MicroPython Run forwards the exact visible text to the existing
firmware deployment route. Its optional AbortSignal cancels lazy imports, boot,
deployment and a running simulator. Cleanup removes only its own board and
observation object. Stop, a replacement target/VM, unmount and rerun revoke the
old owner. Generic Python remains Skulpt. These ownership controls do not claim
new firmware, GPIO or physical-device qualification.

## Python conversion integrity

Supplier checkpoint
[`4994e2c7`](https://github.com/CrispStrobe/sb3-creator/commit/4994e2c77143c7bee9eb8b76706ffae3321743a0)
refuses generic Python floor division, unsupported augmented assignments and
`break`/`continue` before producing pseudocode. It retains one-based, end-exclusive
statement spans and individual diagnostic codes. It does not pretend that
ordinary division, addition or omitted control flow preserves these operations.
Supported `+=`/`-=` and independent specialized readers retain their existing
behavior. See the supplier's
[conversion semantics record](https://github.com/CrispStrobe/sb3-creator/blob/4994e2c77143c7bee9eb8b76706ffae3321743a0/docs/PYTHON-CONVERSION-SEMANTICS.md).

The consumer formats each location for the existing visible conversion report
and retains the structured codes/spans. A failed conversion leaves its source
and loaded project intact; that Python may still run in its selected runtime.

## Behavioral evidence

The focused consumer set passes **214/214**, with zero skips/failures, on Node
24.22.3. It covers worker sessions/tasks, authored document and bundle behavior,
conversion/editor ownership, specialized caller controls, Pico startup ownership,
exact visible Pico source, and per-statement Python diagnostics. The supplier's
focused converter/generator set passes **217/217**; its independent reader and
specialized-route controls pass **177/177**. These are selected behavioral sets,
not a claim that every hosted repository gate passes.

An additional inspected local legacy/import set passes **133/133**, covering
compile/device admission, ASM starter ownership, artwork and MakeCode handoff,
conversion refusals, project bundles and editor menus. The final toolbar wording
and wrapping limit notice pass **15/15** localization, toolbar and representation
controls. The owned-console limitation sits below the toolbar so Run stays
visible, and its generation selector explicitly preserves authored JavaScript.
These are separate selections, not a claim that their counts are disjoint.
Six remaining source-document fixture updates pass **32/32 selected local
controls**, with zero skips: example-bench, NQC, MicroPython retargeting,
fe/Tcl registration, the 8086 assembly view and starter confirmation (including
the existing mutation-negative sweeps). Their assertions now execute the real
document adapters instead of counting removed inline buffer resets. They add no
further product-contract change.

Reproduce the focused consumer set with the normal workspace dependencies:

```sh
node --test --test-timeout=5000 \
  test/code-execution-session.test.mjs test/code-javascript-tasks.test.mjs \
  test/code-runtime-source-ownership.test.mjs \
  test/code-tab-empty-target-after-failed-conversion.test.mjs \
  test/code-conversion-editor-ownership.test.mjs test/code-tab-run-via-blocks.test.mjs \
  test/spike-code-caller-ownership.test.mjs test/code-document-editor-integration.test.mjs \
  test/code-source-document.test.mjs test/code-source-document-bundle.test.mjs \
  test/pico-sim-run-ownership.test.mjs test/pico-sim-run.test.mjs \
  test/pico-sim-epoch.test.mjs test/code-pico-source-ownership.test.mjs \
  test/python-conversion-diagnostics.test.mjs
```

The real-editor harness is `scripts/verify-owned-console-code-tab.mjs`. It uses
visible CodeMirror edits, generation controls, the production worker, and actual
File Save/Open. It observes the VM and editor without replacing workers or
calling component setters. Its candidate bundle is built in a separate detached
worktree through the official compiler/gallery sync and normal GUI build. The
shipping feature retains its existing supplier pin.

`scripts/write-owned-console-qualification-manifest.mjs` binds that experiment
to the immutable supplier, consumer checkpoint, exact local sync patch, canonical
rewritten compiler bytes/mirrors and emitted JS/index hashes. The browser checks
the hashes of loaded assets and records its actual command line/capabilities.
The manifest deliberately says `shippingEvidence: false`; it does not fabricate
a hosted build receipt. The final
[rendered Code-tab receipt](OWNED-CONSOLE-CODE-TAB-RECEIPT-2026-11-27.md)
passes **12/12** checks on consumer `71d6854c` with the official experimental
supplier `4994e2c7`, in Chromium 158 on Linux. It covers real generation from
Pseudo and a loaded SB3 graph, multiple flags, an awaited procedure, input held
for 4,502 ms, Stop/rerun, Boolean output, edited-source conversion refusal,
File Save/Open, autosave reload, and a Python line-2 floor-division refusal
followed by Skulpt output `3`.

All 53 observed same-origin script responses (29 distinct emitted files) match
the recorded production build. All nine observed workers close, including seven
Code-tab runs. There are zero uncaught page errors. Four console resource-404
entries are retained and attributed to HEAD/GET probes for
`/static/labwired/labwired_wasm_bg.wasm` on the initial load and reload; this is
not a zero-console-error claim. The full receipt, asset manifest, nine final
screenshots, authored/generated programs and two SB3 archives are retained.
Run and the complete conversion-limit notice are visible at 1440 px. Later
fixture/documentation/receipt commits do not relabel this tested build or move
the shipping supplier pin.

## Reused prerequisite and remaining landing dependencies

The five-file HDD identity repair is reused from the exact first-parent subset
of Microtronic PR #1846 commit
[`ad492c7a`](https://github.com/CrispStrobe/brickwright/commit/ad492c7ac87d2ca393e0da9ceed4d96a3da16563).
Ownership remains with
[its existing lane](../lanes/2026-11-25-microtronic-host-ci-controls.md).
The subset changes no workflow, dependency pin, runtime, firmware fixture or
original historical digest. It exactly inverts four reviewed repository-identity
guards for historical comparisons while requiring repository ID `1291854269`
in the live workflow. Wrong IDs, obsolete name guards, displaced/duplicated
predicates and unrelated drift still refuse.

The complete HDD control file passes **29/29**, and the five connected identity,
fixture-stage and policy/negative controls pass **5/5**. The broader connected
pin/download/projection run is **96 passed, 7 failed, 0 skipped**: all seven are
pre-existing current-pin consistency failures in unchanged files, not a passing
qualification. Its scan reads 14,224 files and reports 79 stale occurrences in
26 files. Reusing the HDD repair does not repair this separate pin drift.

The supplier's existing RF mixer scenario remains a real upstream blocker. A
read-only reproduction at its exact Board/CUI pins measured 1170.56856 Hz versus
the existing 5830 ±600-Hz expectation. Board #779/#780 were examined; the pinned
and #780 traces were identical for all 300 retained samples. No tolerance,
expected frequency or physics fixture was changed. The RF owner still needs a
settled oscillator/audio explanation and a qualified correction.

The exact supplier checkpoint `4994e2c7` also reproduces that failure in hosted
[shard 4/4](https://github.com/CrispStrobe/sb3-creator/actions/runs/45976023828/job/140427833984):
9,185 tests, 8,561 passed, one failed and 623 skipped. The failing test is
`lab-circuits-r7mix.test.mjs:224`, reporting 1170.569 Hz against 5830 ±600 Hz.
Passing focused conversion tests and a successful experimental browser journey
do not supersede this failed upstream qualification.

Normal adoption remains ordered: qualify and land the supplier upstream, then
move the consumer's exact pin through official sync and regenerate its dependent
identities. The gallery and pin consistency gates must also pass. Implementation
checkpoints on the existing feature branches preserve the work while these
dependencies remain open. No failed gate is treated as green, and no worker,
desktop-Chromium or method test establishes other browser/native/mobile support.

## Subsequent qualification repairs

The owner authorized continuing through the concrete remaining failures under
[the qualification-repair claim](../lanes/2026-11-27-code-integration-qualification-repairs.md).
Both feature candidates first incorporated the newer canonical mains. The
consumer then reused PR #1846's exact live-current-pin updates and regenerated
the required report, controller-bundle and ROM/static provenance through their
official tools. The rebuilt BIOS, seven demo ROMs, retained static assets and
controller source reproduce their existing bytes; only their current source
identities change. Sealed historical constants and admission digests remain
historical.

The strict full-history pin suite now passes **46/46** with all three supplier
histories available: 14,245 judged files, 133 receipts, zero unreadable files
and zero stale findings. The connected package/provenance controls pass
**113/113**. These supersede the earlier seven local current-pin failures as
bounded repair evidence, while full hosted qualification remains separate.

The earlier 39-case worker receipt named an experimental supplier commit in a
current shipping-pin file role. Its complete 122,743-byte JSON is now preserved
byte-for-byte in [a documentary receipt](CODE-CONSOLE-VALUES-WORKER-RECEIPT-2026-11-27.md),
SHA-256 `7fefc5441fae0dddf91ccb2177e99fe77e8ec01fe7c054f89d5a7601816ce971`.
No pin-scanner exemption or historical requalification was introduced.

Another **70/70** selected controls cover corrected editor/lifecycle fixtures:
actual menu adapters, camera-listener disposal, CP1 hooks used by the ESP32
runner, debugger pane context and the reviewed parsed start-method boundaries.
**23/23** further local controls cover every Code document language buffer,
compact accessible mode buttons, and classification of the generated
gzip-compressed Robot Lab LDraw archive as binary. These are separate selected
sets; remaining failures and the RF investigation are still open.

### Additional fixture and localization checkpoint

The next bounded repair retains the production CP1 dock, component ownership,
static-asset copy wiring, and immutable iOS repository identity in their test
readers. The emitted-asset controls passed 8 cases, Circuit component controls
passed 27, and the four selected iOS admission/controller tests passed; their
existing tamper, stale-receiver and missing-activation controls remain active.

Two user-visible strings now use the existing English/German localization
tables: the CP1 firmware-ready status (including its unnamed-ROM fallback) and
the controller grid-snap label/state tooltip. The overlay and package mirrors
are identical. The localization and controller undo selection passed 19/19,
with no skipped cases. These changes do not qualify the still-open RF or full
integration jobs.

### Corpus, historical controls and recovered third-shard repairs

The [CP1/profile repair](CP1-CORPUS-PROFILE-REPAIR-2026-11-27.md) passes
23/23 controls: all 1947 circuits retain endpoint/placement checks; eleven
strictly validated internal CP1 lessons are distinguished from 737 externally
wired circuits, with zero unexplained empty circuits. Fourteen existing device
kinds are now catalogued, and the official profile generator and integrate
pass keep the generated document and package source aligned.

The clock/restart, Resonance-history, immutable HDD identity and random/literal
reach files pass 17 cases with the one pre-existing hosted compile case skipped.
The historical Resonance digest and held HDD workflow hashes remain unchanged;
only explicitly reviewed production deltas are projected before comparison.
The original 399 program files all remain. The 244 added analog lab programs
and 56 CP1 stubs are retarget-refused in every i8086 variant; emitted sets and
actual print/wait/lowering expectations are unchanged. The separate print/wait
files pass all six cases, including local SmallerC compilation of all 62 emitted
programs and the commented-zero negative control. No compiler upload is used.

The missing third-shard detail was recovered from the SHA-256-verified
`unit-shard-3` artifact of run 45982318911. Its ROM census now resolves literal
local constants through their actual lexical bindings and refuses dynamic,
mutable or shadowed names (4/4 cases). The lazy-catalog reader checks actual
method calls, awaited loading and the current packed-geometry import (7/7).
The four schematic SVGs pass their deterministic baseline check after rendered
old/new visual review, documented in [the baseline review](schematic-baselines/README.md).

The [owned-console Git authority repair](OWNED-CONSOLE-GIT-AUTHORITY-2026-11-27.md)
uses the existing absolute executable identity binding in both manifest
production and browser admission. Its three focused controls pass; exact dirty
patch binding is retained, and historical receipts are not rewritten.

These are bounded local results. The remaining browser coverage/lifecycle
inventory repairs and exact-head hosted qualification are still open.

### Browser source and executable coverage repairs

The subsequent [browser source repair](BROWSER-GATE-SOURCE-REPAIR-2026-11-27.md)
passes all 21 scanner, request-observer and controller controls. It requires
actual disappearance after close/finish actions, retains complete request
origins and routes, and reads the real shipped controller corpus instead of
returning from an empty directory. No scanner baseline or allow marker changes.

The [CI coverage repair](BROWSER-PROOF-CI-COVERAGE-2026-11-27.md) gives all 38
previously unreferenced browser proof scripts direct, independently guarded
steps in five new shards. Its 66 local controls verify executable callers,
correct fixture arguments, failure preservation, family selection, browser
installation and bounded runner audit delivery. All previous budget readings
remain unchanged; the new entries have zero observations. Real hosted browser
qualification and a fresh bound Code-tab bundle receipt remain required.

### Landed Board and committed-pin qualification checkpoint

The RF engine prerequisite is now qualified and merged in
[Board #782](https://github.com/CrispStrobe/bw-board/pull/782) at
`b47e7e09ed873b33ca2fd912b21e136decc5e677`. Its complete tree is identical to
the qualified candidate `6b9e281ca0104ebccacca6d8020295fe18ceb929`; the merge
does not introduce an untested source delta. Applicable hosted Board tests,
vector/corpus controls and native/hybrid qualification passed before landing.

Consumer checkpoint `66da9e8c6fa7959be1db1c29c0047a2eb4650d25` adopts that
landed Board through the official package/provenance producers. Both installed
roots match the exact pinned payload: 13,850 Board files and 1,463 Circuit UI
files each, with single-engine resolution. The package/provenance selection
passes 153 cases with six explicit missing-optional-checkout skips; the final
full-history/workflow selection passes 79/79 with zero skips. BIOS, seven demo
ROMs and controller bundle bytes are unchanged. See the
[complete adoption record](BOARD-PACKAGE-ADOPTION-2026-11-27.md).

The [committed-pin qualification mode](OWNED-CONSOLE-COMMITTED-PIN-QUALIFICATION.md)
now permits a fresh local Code-tab journey after normal supplier adoption. It
requires explicit clean consumer/supplier commits, the committed supplier pin,
an empty tracked patch and a complete inventory of matching source and integrated
mirrors. Browser admission drains late response reads and requires every
observed emitted script to match the recorded build. Twenty selected positive
and negative controls pass. Both local modes retain `shippingEvidence: false`;
the actual build command/log, fresh browser receipt and hosted qualification
remain separate required evidence.

As of 2026-11-27T15:32:38Z, supplier candidate
`8c9a7aacbed998a07d5c44b44d0f2dd25f4c6432` is published in
[supplier #246](https://github.com/CrispStrobe/sb3-creator/pull/246). It adopts
the landed Board, replaces the invalid startup-crossing oracle with settled
carrier/mixer/speaker agreement and an open-RF-input negative, and records fresh
provenance for 315 lesson pages. The four hosted test shards and WebGL job have
not all completed. The older failed measurements above remain historical
evidence; the published repair is not yet a supplier release qualification.

The consumer's diagnostic run `46019734010` is bound to `29e5265`, before the
later source-binding and Board checkpoints. Separate runs for that same head
have passed CP1, the selected 386 controls, debugger checks and Tauri tests.
Its known stale-gallery failure remains open, and no queued or unselected job
is treated as a pass. The shipping compiler/gallery pin remains
`1c29f69fd22c86ecb0051938eedb246921cb3b88`.

Remaining order: qualify and merge the supplier; use its exact landed commit
for official compiler/gallery sync and dependent identity regeneration; build
the resulting clean committed consumer; obtain a new bound Code-tab receipt
and applicable hosted qualification; then merge the consumer. The earlier
experimental receipt keeps its original source/build identities throughout.

The two newly enrolled CAD fixture journeys subsequently passed against a fresh
CAD-enabled diagnostic build of `10fd4689f0addcb63acba6a3e92d108449470525`:
actual DWG import/export/reimport and project restoration, and STEP import of
eight colored reference bodies with print exclusion and project restoration.
The application, proof scripts and fixtures were unchanged. The
[CAD browser receipt](CAD-BROWSER-FIXTURE-RECEIPT-2026-11-27.md) records their
source/build/runtime identities, complete command outputs and retained
diagnostics. These two local passes do not qualify the other browser proofs or
the later supplier adoption.

### Latest-main compatibility and continuing supplier qualification

Main subsequently advanced to `b2912f4a081cf0bf0721b29f781e065429e5741c` with
CrispCAD SDK `02287df`. It is incorporated in feature merge `32a7b117` without
conflicts or changes to the incoming source. The new SDK preserves the generic
STEP reference-import contract and adds a separate exact-body route. The two
existing browser proofs retain all their original assertions.

Two current DWG reproduction identities needed updating after that merge. The
new admitted worker reproduces the original fixture bytes in two fresh codec
contexts; all four fixture/admission controls pass with the existing negatives.
The three-file repair is published at `dd65496e`. A fresh build of that exact
clean commit preserves all 842 SDK file digests and all 22 robot projects, and
both unchanged DWG/STEP browser journeys pass again. The
[current-SDK receipt](CAD-BROWSER-CURRENT-SDK-RECEIPT-2026-11-27.md) is separate
from the byte-identical earlier receipt.

Supplier qualification remains open. At original supplier candidate `8c9a7aac`,
the settled direct-conversion scenario passed in hosted CI in 435.96 seconds;
all seven r7mix scenarios and all eleven WebGL tests passed. A different shard
required adjacent evidence for fifteen new numerical bounds. Supplier
checkpoint `8f3763a6` adds only those comments: executable AST and token streams
are identical, all eight selected controls pass, and the ratchet ceiling and
retained measurements are unchanged.

Another hosted shard then reported the Meissner squegging scenario's existing
quiet-between-bursts assertion failing. The untouched scenario reproduces the
failure at Board `b47e7e0` and passes at the older `de8083c` pin. Its circuit,
sampling and independent fine-step behavior are under investigation; no
expectation has been replaced. Any additional physical repair must be qualified
before supplier landing and exact-pin consumer adoption. Neither the successful
receiver scenario nor the CAD receipts close that remaining supplier gate.

The diagnostic consumer run at `29e5265` subsequently completed unit shards
5–8 successfully. Shard 1 reported one ordinary failure in the source-only CI
tier control: its isolated Bash environment omitted the five newly declared
CAD/artwork/robot-view scope variables. The real workflow supplies them, but
the fixture reached Bash's existing unset-variable refusal before selection.
The fixture now supplies explicit false defaults and includes shell diagnostics
in a failed status assertion. No workflow, selector or gate was changed.

The original six-case file reproduced one failure locally before the repair.
Afterward, the tier controls and executable browser-wiring controls pass all
nine selected cases with zero skips. They retain actual fast/default/full,
main/dispatch and docs-only decisions, invalid-input and missing-branch refusal,
the unconditional-success negative, all 38 command-failure controls and mixed
browser-family selection. This bounded fix does not relabel the older hosted
run or qualify the pending supplier pin.

Unit shard 3 of the same diagnostic run reported 1,963 passed assertions, two
documented skips, one existing TODO and zero failures across 267 files, then
failed its GUI dependency audit. The retained artifact `15215421252` has ZIP
SHA-256 `0ce5c3e5eea8718b5b126ba1f41055c036232af737e8a6644571388d3578ac37`.
Replaying its actual redirect log with the unchanged checker names exactly one
undeclared edge: `three <- test/bw-sim-tube-layer.test.mjs`. That test directly
imports `Vector3` and the real rope/hose geometry implementations. Its exact
filename is now declared for `three`; no resolver or wildcard boundary changed.

The original redirect log now passes. The original TAP and census also pass all
post-run accounting checks, including zero raw stdout, every skip/TODO and every
expected file. The current and original shard-3 file lists are identical. All
14 selected dependency-boundary and rope/hose tests pass with zero skips,
including actual undeclared-package and undeclared-test refusals. This replay
explains the old failure; a fresh hosted run remains necessary for the current
consumer candidate.

The first newly enrolled CAD browser shards also exposed a live runner-receipt
identity refusal. `audit-job-steps.mjs` still required the pre-rename
`CrispStrobe/brickwright-lite` repository and workflow prefix, although the
current hosted checkout is `CrispStrobe/brickwright`. The live reader now admits
the two documented workbench names only with stable GitHub repository ID
`1291854269`, independently confirmed by the repository API. The workflow prefix
must match the actual admitted name. The separate Legacy application ID
`881088189`, a missing ID, foreign owners and both mixed-name workflow headers
remain refused.

All 41 runner audit controls pass with zero skips, including both valid names
and six hostile headers through the genuine CLI. Existing source/shard mapping,
Git-byte binding, row completeness and earlier gate failures remain enforced;
historical receipt schemas and recorded names are unchanged. The same hosted
CAD jobs reported two real browser failures after touch gestures, in outline
constraints and DXF regions. Fixing the receipt identity does not clear those
application journeys; they remain under investigation.
