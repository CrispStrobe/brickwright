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
