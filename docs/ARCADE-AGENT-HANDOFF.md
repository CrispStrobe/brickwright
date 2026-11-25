# Arcade compatibility: fresh-agent handoff and methodology

## Current checkpoint — 2026-11-06

Connected editor acceptance for published Array/snake, frame-delta and number
entry is being added under its [bounded claim](../lanes/2026-11-07-arcade-connected-authoring.md).
Qualification requires the exact-head official-build browser job and its original
PXT comparisons; source-only fixture checks do not establish GUI or runtime parity.
The [first hosted run](https://github.com/CrispStrobe/brickwright/actions/runs/42383883786)
completed all five snake editor and original-simulator samples, then stopped at
the number-entry readiness marker. Number-entry and frame-delta acceptance
remain pending on the corrected candidate.

#1643 landed as `8a969d7d` after its enabled checks passed. Its two cleared
rows leave 22 documented Arcade TODOs; see [ARCADE-888](ARCADE-888-OPEN-FAILURES.md)
and the [pending task list](../lanes/2026-11-03-arcade-pending-after-1643.md).
On that merge, the 184-input source import and Creator census reports **156
translated, 27 partial and one parse failure**. The inputs match the prior
`cb878669` census by hash, with no stage changes. This is not an export, VM,
original-PXT, browser or full application execution result.

The 29 October checkpoint below is historical: #1554 landed through #1572,
and the prepared created-field receiver work landed through #1631. Subsequent
Arcade changes include #1638 and #1646. The four Sprite-instance `onOverlap`
examples use a method absent from the pinned SDK; the projectile example lacks
a declared source sprite. Treat those inputs as limited rather than counting
unmeasured importer gains. Refresh main and pull requests, and merge a scoped
claim before implementation. Keep F/G and the timing, tile-callback and
do-while limits as recorded in ARCADE-888.

Refused by design (operator decision 2026-11-09): row 2h-2, a text-edited
argument to a Number formal (`makecode-arcade-managed-number-boundaries`,
ordinary-argument physical text). A registered stock or managed Number formal
rejects text before any body effects; the deliberate control is `registered
stock/managed Number rejects text before body effects` in
`test/arcade-procedure-constraints-native.test.mjs`. Such an argument stays
outside the roundtrip on purpose. Do not reopen it or change that control.



## 2 November: TODO closure status and decisions

Raw corpus census on main `5956c6ab`: 156 translated / 27 partial / 1 parse
failure out of 184 (was 147/36/1; nine partial -> translated, no regressions).
Source import and Creator only.

Merged or in flight: #1629 (nested parameter captures, H; exporter stop lift,
I) and #1631 (the prepared created-field receiver branch composed onto main,
plus a `scene.backgroundColor()` Number proof). Counts and reasons are in
[ARCADE-888-OPEN-FAILURES.md](ARCADE-888-OPEN-FAILURES.md#current-status--2026-11-02).

- G/F stay open: the pinned PXT simulator keeps exactly one runtime per
  simulator frame, so two Arcade owners in one runtime have no original
  behaviour to match. The duplicate-owner refusal stays.
- Group A stays open (operator decision): a PXT-faithful guard for an
  unproven Array receiver is the identity and would allow everything. Next:
  per-slot proofs for the three or four most tractable rows.
- Composing the prepared branch: where the branch's refusal tests met main's
  later nullable-Array and inert-store proofs, each case was checked against
  original PXT; main's admission was kept where sound, with the reason in the
  test, and `test/arcade-reset-prefix-store-pxt.test.mjs` compares the shape.
- Fixed in the group A follow-up: a global written from a typed SDK Number
  call (scene.backgroundColor, Math.floor/ceil/round/abs/sqrt) keeps its
  Number declaration, so `set color to 2` no longer stores text without sprites.
- Group A follow-up: nine rows cleared by per-slot proofs; five remain TODO.
- 2026-11-03: positional Array elements (B numeric constants) and constant computed indexes (A value arithmetic) cleared; 22 documented TODO rows remain, with reasons in ARCADE-888.
- Corpus levers checked: the Sprite-instance `x.onOverlap(fn)` used by four corpus programs is not in the pinned SDK (only `sprites.onOverlap(kind, otherKind, handler)` exists), so original PXT cannot compile them; the `createProjectileFromSprite` program uses an undeclared `heroSprite` fragment. Both are input-limited, not importer gaps.

## 30 October: unproven native-addition operands use runtime dispatch (owner decision)

Owner decision 2026-10-30: when the native-addition proof cannot establish
both `+` operands as initialized primitives or flat Arrays (the operand-domain
and Array-effect refusals, listed in `RUNTIME_DISPATCH_ADDITION_REASONS` in
`export-arcade.js`), Arcade export no longer refuses. It emits one
runtime-dispatch helper per program under the existing `__bwBinaryAdd` name:
`Array.isArray` selects the same `array.join(",")` the proven Array path emits,
and every other value keeps PXT's ordinary `+`. Proven primitive additions
still emit `return left + right`; proven flat-Array additions still emit the
existing join body. Source-integrity refusals (supplied private tags,
ambiguous or changed identity, a refused named-helper proof) still refuse.

Import recognizes only the exact dispatch body (unique root binding, own
locals, unbound global `Array`, direct two-argument calls) and restores each
call to the native value `+` (`calculate value ... op "+"`), which already
decides per value in the VM; the producer graph types that node like `+`.
`test/arcade-runtime-dispatch-addition.test.mjs` checks Array/number/string/
nullish operands against original PXT and the imported VM program.

Open follow-up: a typed-SDK table (member/method result types from the pinned
Arcade typings) so more operands get an exact static proof instead of the
runtime dispatch. `scripts/verify-arcade-numeric-authoring-gui.mjs` now
asserts that the unproven `music tempo + 1` exports through that helper with
no refusal details; the panel's collapse and dismiss controls stay covered.
## Historical checkpoint — 2026-10-29

Start with [the lane protocol](../lanes/PROTOCOL.md), the active
[Arcade integration claim](../lanes/2026-10-26-arcade-forward-integration.md),
and this section. Refresh main, branch ownership, pull request heads and checks
before changing anything. The prepared work is on
[`lane/arcade-created-field-receivers-20261029`](https://github.com/CrispStrobe/brickwright/tree/lane/arcade-created-field-receivers-20261029),
not yet on [PR #1554](https://github.com/CrispStrobe/brickwright/pull/1554)
or main. The live PR's last observed head was `6b811d1d`; its build and numeric
authoring job passed, but all six unit shards and the full-CI request gate
failed. The 32 distinct failing test identities in those shards are not corpus
rows. Preserve the original failures and do not report this PR as ready to land.

The latest historical raw census is **184 inputs: 147 translated, 36 partial,
one parse failure**. It predates the prepared candidate. No application has
been promoted by the source-only work below, and the count is not a guarantee
that all 147 run correctly on every route.

The prepared branch includes creation-event and callback Array-effect proofs,
SDK name inspection that avoids unrelated getters, a classless export crash
repair, a narrow `charCodeAt` numeric normal-result proof, and a pointwise proof
for an initialized startup Array self-update. The latter makes the maintained
compound-arithmetic fixture pass a source-only importer, Creator and exporter
check. Its three focused modules are
`test/native-array-startup-indexed-primitive.test.mjs`,
`test/native-array-startup-issuer-boundaries.test.mjs` and
`test/native-array-startup-indexed-export.test.mjs`. Their last local runs
passed 6, 3 and 1 tests respectively; they do not qualify VM, SB3, PXT or browser
behavior. Other source controls and their restrictions are described below.

Work in this order:

1. **Compose and qualify the prepared branch.** Refresh the live PR and main;
   preserve concurrent owners' changes and merge normally. Check the prepared
   candidate's tree and existing claim, then publish one successor only when
   the existing CI queue and owners allow it. Use the automatic checks for that
   exact head; do not dispatch duplicate runs or add `ci:full` casually. Every
   enabled final-head check must succeed before merging, including the request
   gate if it remains enabled. Run affected original-PXT, native and browser
   checks when the actual changes require them. Verify the reviewed and merged
   trees and parents; predecessor results do not qualify a successor.
2. **Diagnose actual export failures.** Preserve each first official log and
   artifact once. The reference Array test can retain its project and result
   through `ARRAY_ALIAS_EVIDENCE`; the callback test has the optional
   `BW_ARRAY_CALLBACK_EVIDENCE_DIR` hook. Coordinate their upload with the
   workflow owner rather than changing another lane's workflow. The compound
   arithmetic test emits its structured post-VM refusal and generated draft as a
   TAP diagnostic on failure. Use the actual failing operand, writer and source
   order to select a repair; leave assertions and uncertainty intact. In
   particular, source-only success for `rows[0]` does not identify the official
   post-VM operand. The SDK Sprite collection callback index and indexed Image
   pixel result are distinct unconfirmed candidates, not blanket type rules.
3. **Recover and rerun the corpus on an appropriate external worker.** Freeze
   the same 184 inputs, hashes, candidate and observer; retain every first
   outcome and compare import, export/reimport, original MakeCode execution,
   Lite execution and controller/editor behavior separately. The historical
   partials include missing art and dependency contexts; use authentic lawful
   project resources and report unavailable context rather than inventing it.
   Prepare an offline dependency closure for the worker before scheduling a
   run. Do not run large suites, browser builds or corpus jobs on a shared
   resource-constrained host. Promote a row only after its complete program and
   required routes pass; report old and new denominators and regressions.
4. **Close authoring gaps alongside conversion.** For each implemented
   operation, verify Blocks and pseudocode editing, graphic or tile editing when
   applicable, save/reopen, export to MakeCode and reimport, with actual runtime
   behavior. Record unsupported operations explicitly and retain failing cases;
   converter acceptance alone is not GUI or game parity.

## Current qualification and next failure families

[PR #1554](https://github.com/CrispStrobe/brickwright/pull/1554) remains
unmerged at `6b811d1df941815a54a7409d603d56318e12dbee`. Its six failed unit
jobs contain **32 distinct blocking tests**, compared with 33 at the preceding
checkpoint: the gate-shape control is repaired and no new failing test appeared.
The [Tauri run](https://github.com/CrispStrobe/brickwright/actions/runs/40830556918)
passed; its actual checkout tree equals the reviewed tree and contains the
unchanged submitted Rust fixture repair. This does not erase earlier failures.
The [Build run](https://github.com/CrispStrobe/brickwright/actions/runs/40830557085)
has successful build output but failed unit checks and a failed full-CI request
gate; its official numeric job passed. Its original log and proof artifact were retained and independently checked, including all five authoring records and the clean export capture. Do not duplicate running qualifications or
apply a full-CI label for this continuation.

The raw application census remains **184 inputs: 147 translated, 36 partial,
1 parse failure**. Unit-test counts are not application completion counts.

The retained historical 36-partial import report also gives a useful starting
point for the next corpus triage: ten partial inputs report unreadable background
artwork; three report a projectile factory used as a value; and three each report
`setVelocity` or `setStayInScreen` through the legacy stage fallback. Some inputs
also lack referenced song or animation resources and package functions. These
counts overlap and describe that historical report, not a current candidate
measurement. Inspect each original project and its available package/assets
before deciding whether to fix resolution, preserve an explicit missing-input
report, or implement a runtime operation. Do not fabricate absent artwork or
count a source-only fix as a completed game. The retained method cases also
report unresolved creation artwork: the current modern Sprite route already
implements velocity and stay-on-screen, but declines the whole route if a
creation image cannot be resolved. Its legacy fallback then emits the method
warnings. Diagnose the original file-map, generated resources and dependency
context before changing that dispatch; duplicating legacy motion support would
not establish the missing Sprite or image behavior.

One concrete context example is the [pinned upstream free-throw tutorial](https://github.com/microsoft/pxt-arcade/blob/8ae4f42df2b2f4a0472b0da04c3cdcd3438dbb02/docs/tutorials/free-throw.md#L625),
which declares an unpinned external artwork package. Its
[manifest](https://github.com/kiki-lee/throw_imgs/blob/master/pxt.json) lists
[image resources](https://github.com/kiki-lee/throw_imgs/blob/master/images.g.jres).
The tutorial and package are separate sources: the tutorial's license does not
establish the artwork package's license, and the manifest version does not
identify an immutable dependency revision. Verify both provenance and applicable
license before retaining or redistributing those assets. Where a user supplies
an actual project and lawful resources, pass the original file map to the
importer and preserve their bytes; leave missing assets explicit otherwise.

A focused synthetic control in `test/arcade-supplied-gallery-context.test.mjs`
now exercises the existing dependency-preparation path with genuine annotated
fixed-instance declarations and supplied JRES bytes. Its imported project has
no unsupported entries and retains background, velocity and stay-on-screen
blocks; a missing resource is refused. This is a source-level control, not a
complete game or license determination. JRES namespace metadata by itself does
not declare a TypeScript member; require the real configured source binding.

Continue in this order:

1. The terminal numeric evidence for the current live PR has been retained and
   independently checked. Qualify the prepared receiver repairs on the final
   composed head without removing assertions or borrowing predecessor results.
2. Qualify the creation-callback Array reset repair. Its real reimported
   callback resets `refs`, copies the creation-event Sprite, writes a primitive
   trace, reads a declared instance field, then overwrites `refs` with
   `sprites.allOfKind`. The new effect proof accepts that retained block graph;
   the unchanged full export/reimport and original PXT/native controls still
   need external execution. Preserve negatives for accessors, inheritance,
   arbitrary property access, coercion, authored calls, captures and yields.
3. Continue native-addition receiver/result/initialization work from the actual
   failing operands. In the reference-Array fixture, preserve the early
   `readText()`/`readArray()` startup calls, aliases and mutations. Inspect each
   leaf of the update-handler witness, then its concatenations. Native result
   domains and occurrence initialization remain separate obligations.
   The reference-Array fixture itself passes a bounded source-domain probe; its
   retained failure is in the exported program. On a failure the test writes
   structured refusal and generated source as a TAP diagnostic for the standard
   unit log, unless it contains a local path. The test also saves
   `export-project.json` and `export-observation.json` before the unchanged
   assertion when `ARRAY_ALIAS_EVIDENCE` is set. In the next authorized hosted
   run, set that variable to an artifact directory and upload it even on
   failure. Inspect `refusalEvidence.nativeAdditionDraft` and the operand details
   to bind the failure to its real producer before changing the domain proof.
   Run the full original PXT path; do not set `ARRAY_ALIAS_NATIVE_ONLY`.
4. Main now contains the reference-instrument owner's historical-study repair.
   The prepared integration preserves both its exact-byte sealed-study checks
   and the Arcade branch's separate frozen-controller checks. The prior live PR
   reported a stale-pin guard and two collector failures; run the combined head
   to establish whether those failures are resolved. Do not substitute a new SHA
   into historical fingerprints or weaken collector counts. Final landing still
   requires every enabled exact-head gate and applicable runtime qualification.

The callback prefix proof now also admits a strict comparison between the
fixed first creation-event Sprite's plain declared data field and a primitive
literal expression. It inventories physical classes and inheritance, refuses
accessors and SDK collisions, and expires if the underlying SDK descriptor
suppliers or their prototypes change. The retained full reimport graph's
previously refused Array input now passes this component proof. Full export,
PXT, native, Code/Blocks and saved-project checks remain pending; this does not
promote a corpus app. The separate ordinary symbol-hygiene path now reads SDK names from own data
slots without materializing unrelated class metadata. Its closed-entry receipt
also expires when those name suppliers change. Other SDK consumers need their
own getter-safety assessment; this change does not certify them.

The callback prefix proof now also admits an exact non-cloud global write when its initial value and all physical writers preserve a closed primitive domain. Unknown effects, calls, monitors and incompatible writers refuse; this is only a frame-effect fact. The following class-field read uses the separate bounded proof above.

The local reset proof can cross an inline or physical shadow primitive literal written to a different private local, with the same frame and prototype safeguards as the event copy. The actual trace and instance-field effects still need separate proof.

The local reset proof also refuses conditional overwrites when their condition can read the reset cell, or when either branch executes an unproved statement before overwriting it. Inline primitive conditions and immediate overwrites retain the bounded path; physical shadow conditions remain conservatively refused. The focused regression is in `test/project-event-copy-reset-prefix.test.mjs`.

The class-receiver validation is now also available on the empty-class export
model. A project without class declarations previously threw during export
when the new final validation was called; a focused import-to-export regression
now covers both classless and creation-handler cases. The prompt fixture no
longer throws in source-only export, but still reports a native-addition refusal
for the actual `result` producer; its full saved-project runtime and PXT paths
remain pending.

## Prepared repair: hoisted private Array resets

`local-array-declaration-reset-source.js` can now discount an uncaptured local
Null/Undefined declaration reset followed by a fresh empty Array overwrite
across unrelated literal declarations and literal assignments to other locals
in the same function body. It does not grant an initialized read or index fact.
Calls, pauses, properties, indices, captures, dynamic scope and control-flow
statements still refuse. Unindexed candidate identifiers also refuse; unrelated
object shorthand no longer invalidates the entire program. The focused and
existing controls pass, including the unchanged pause negative; five guard cuts
were detected.

A separate private synchronous-prefix evaluator now handles a bounded actual
single startup entry, ordinary called helper bodies, primitive operations,
fresh Array identities and alias mutations, and both branches of a proved strict
comparison. It refuses unknown calls, pauses, recursion, dynamic scope, unsafe
coercion, prototype changes, candidate exposure and unproved control flow. It
supplies only reset non-exposure, never an Array, result or initialization fact.
The supported profile requires an actually interpreted ordinary call; this is a
conservative limit, not a claim about call-free prefixes. Existing pause and
general-branch negatives remain unchanged.

The retained source-only emitted reference-Array draft now passes its complete
native-addition domain check. This draft came from the imported project before
VM save/reload, so the unchanged hosted post-load fixture still needs its own
capture and full original/native/export/reimport result. The original source-only
full-export CPU-limit failure remains a separate result; no corpus app is
promoted by this proof.

## Prepared repair: normal mutation effects on nullable Array alternatives

`source-value-producers.js` now has an internal mutation-only view of actual
Array allocation tokens plus Null/Undefined. For example,
`let empty=[]; let nested=[empty]; nested[0].push(9)` must retain the Number
writer into `empty`, even though indexing `nested` also has an Undefined
alternative. On an absent receiver the operation faults; on the actual Array
alternative it still mutates that allocation.

This view propagates indexed/update/push/unshift writes and method/prototype
poisoning. It grants no strict Array receiver, initialization, callback entry or
push/read result. The existing nullable-length theorem retains its own closed
source requirements. Unknown and non-Array alternatives cannot use this new
view: mutating mixed receivers instead conservatively poison their possible real
allocation tokens with an unsafe-method marker and Opaque elements. Incompatible
and reference element writers remain in their real domains.

The first three focused controls failed on the predecessor. Five groups now
pass, covering nested pushes, Null bindings, poisoning, declared-type conflicts,
reference elements and unknown receiver alternatives. Four deliberate cuts check
mutation propagation, strict result separation and both poisoning paths. Existing nullable-length
and native-domain regression groups remain required. These source facts alone
close no complete application or native-addition refusal.

```sh
node --test test/source-nullish-array-mutation-effects.test.mjs
node --test test/arcade-nullable-array-length.test.mjs
node --test test/native-array-binary-domain.test.mjs
```

## Prepared follow-up: creation-handler class field receivers

The `lane/arcade-created-field-receivers-20261029` branch prepares the next
exporter repair. The existing full control is the post-`setKind` case in
`test/arcade-extendable-constructor-scalar-source.test.mjs`: the creation handler
writes 9 into the real instance after its virtual override suffix writes a
String. A cast or retained class declaration alone is insufficient.

Implemented source boundaries:

- `sdk-sprite-constructor-scalar-effects.js` exposes
  `fieldReceiverClassesAt(assignment)` for the exact observed assignment. It
  retains every constructed class observed after complete SDK kind/notification
  dispatch. Missing fields, unsupported effects or invocations, and partial
  instance escape deny the whole receipt. Copied/lookalike nodes receive none.
- `export-arcade.js` records each actual non-class-body field-write emission
  with its physical target and block. `created-field-export-receivers.js` joins
  its parsed assignment to a unique occurrence in each complete newly parsed
  output: plain TypeScript and the ordered executable companion files. Duplicate
  emissions, ambiguous source occurrences, differing receiver sets, unknown
  effects or a stale project refuse the receipt. Syntax locates an occurrence;
  the constructor interpreter establishes the receiver.
- `object-class-export.js` runs the complete primitive validator after source
  assembly, including native-helper selection paths. No diagnostic is removed
  afterward. The receiver obligation applies only to that field writer's
  `OBJECT` input; RHS production, declared field/type, visibility and readonly
  checks still run. Private, protected, readonly, accessor and callable fields
  cannot consume this new receipt. Multiple distinct receiver classes remain
  refused until their MakeCode field layouts are independently qualified; the
  source observer deliberately preserves all of them rather than picking one.
- Receipts supply no general input type, receiver initialization, scalar result,
  Array fact or writable-field authority. Observed source/project expiry is
  permanent. Class-body receiver rewriting retains its existing validation.

Focused source controls cover actual override/handler order, class unions,
lookalikes, partial escape and namespace effects; emission controls cover unique
physical/source matching, all output variants, expiry and field restrictions.
Seven deliberate source cuts exercise observation, universal class accumulation,
source expiry, unique joins, companion validation, readonly enforcement and the
actual exporter-to-validator connection.
The minimal real import → blocks → export control returns empty unsupported and
warnings lists without modifying the project. These are bounded source controls,
not original-PXT/native/browser or whole-application completion evidence.

```sh
node --test test/sdk-created-field-receiver-observations.test.mjs
node --test test/created-field-export-receivers.test.mjs
node --test test/arcade-created-field-export.test.mjs
```

Complete the remaining qualification in this order:

1. Finish read-only source review and retain the focused controls and mutation
   results. Keep the live PR head unchanged until its pending terminal numeric
   original has been admitted, retained once and independently read.
2. Compose this follow-up normally into the owned integration branch. Preserve
   supplier pins, assertions, old failures and other owners' source. Qualify the
   exact final head through its enabled hosted checks; do not duplicate live
   runs or infer success from a predecessor.
3. Run the unchanged original-PXT/native post-`setKind` control and editable
   Code/Blocks, saved/fresh SB3, export and reimport paths externally. Confirm the
   final reconstructed output retains creation ordering and final Number result.
   Exercise incompatible/readonly/private fields, changed receivers, unknown
   callbacks, source edits and namespace replacement without weakening negatives.
4. After whole-case evidence, reassess the immutable corpus and update genuine
   application statuses. No corpus row is promoted by the source controls alone.
5. A separate continuation may prove compatible inherited field layouts for
   multiple observed classes; keep this refusal until that exact evidence exists.

The source claim remains the existing Arcade completion campaign. The live PR's
terminal-original intake and publication remain with its source owner; this
follow-up stays separate while the live head qualifies.

## Prepared follow-up: creation callback local Array overwrite

A captured reimported creation callback has this actual sequence: reset `refs`
to Null, copy the fixed event value into another local, assign the genuine
`sprites.allOfKind` Array to `refs`, then read its element. The Array-input
service refused the unmodified graph; reconnecting only the reset and overwrite
made that component pass. This identifies the intervening event copy, rather
than an inferred KIND or nominal class-type exemption.

`array-reference-export-authority.js` now permits that bounded inert local copy
at the occurrence-specific definite-overwrite frontier. It requires an owned
immutable JSON graph, same valid scope, exact fixed local name distinct from the
reset cell, exact `arcade_eventSprite` input with `first` or `second`, and no
unsafe inherited property, dynamic frame writer or prototype write. Intervening calls,
control flow, capture operations and early reads retain the reset; incompatible
Array writers remain refused. The copied event value issues no Sprite, Array or initialization fact.
Only an actual successful reset discount retains the new dependency; observed
ambient changes permanently expire it before early exits and publication.

Four independent physical-graph groups pass, including separate local/captured
prototype writers, dynamic names, wrong event operations, ownership edits and
expiry after restoration. Disabling the inert-copy rule or its expiry guard
fails the controls. Four existing local-reset controls remain green. The exact
captured reimport graph's Array-input query now passes. The complete second
export, original SDK/native execution and saved-project routes still need
external qualification; a component pass does not qualify the whole game.

After the normal dependency/integration setup, run the source control with the
repository's GUI scope hook:

```sh
node --test --import ./scripts/lib/register-gui-scope.mjs test/project-event-copy-reset-prefix.test.mjs
```

The GUI dependency registry explicitly admits this test's canonical procedure
constraint model import. Keep that narrow row in step with the test.

## Prepared follow-up: genuine SDK registry receiver lineage

The isolated `lane/arcade-sdk-snapshot-receivers-20261029` follow-up extends
`native-sdk-sprite-source.js` and `native-class-scalar-view.js`. It uses the
existing ordinary factory/source proof to recognize an actual closed
`sprites.allOfKind` call. The private registry collection already maps numeric
indices to genuine SDK instance rows plus a possible missing value; its length
now has a private Number result. This permits the exported canonical
snapshot/alias/index-loop shape to retain its actual Sprite receiver before
normal numeric x/y access. It grants no public Array, bounds, element-presence,
receiver initialization or class-override certificate.

Namespace aliases/extraction and reflected constructor/prototype access deny
the ordinary profile. Existing collection writers, escapes, unknown calls and
incompatible field writers poison the receiver rows. Source edits expire the
held proof permanently. Arbitrary JSON-derived indexed objects remain refused,
including when an unrelated genuine Sprite factory is present. The broader
unknown-Index Opaque draft remains withheld; this follow-up does not need it.

Three focused source groups pass: canonical/aliased snapshots; JSON, collection
mutation/escape, incompatible field, namespace and reflection negatives; and
source-edit/restore expiry. Registry-selection, length-result and namespace-guard
cuts each fail the controls and are restored exactly. The minimized actual
import → editable project → export probe has no diagnostics. These are source
and authoring observations, not SDK/VM execution or a whole-project promotion.

Terminal original intake for PR #1554 head `6e513efc20e` is complete. The prepared
branch already contains the separately owned Rust timing fixture repair
`fb43bdf543c` by normal composition; never modify its source in this lane. Qualify
the final exact head using
unchanged original/native tests, especially
`test/makecode-arcade-array-callbacks.test.mjs` and the Sprite/reference tests.
The focused source command is:

```sh
node --test test/native-sdk-sprite-snapshot-receivers.test.mjs
```

Run builds, browser, SDK and VM suites on an admitted external worker. Further
callback entries, other numeric Sprite slots, class overrides, mutated snapshots
and scene transitions require their own demonstrated receiver/effect boundaries.
The raw corpus remains 147 translated / 36 partial / 1 parse failure.

## 29 October: current qualification and ordered repairs

PR #1554 head `6e513efc20e472d3f5a57b7ebdd83c342442ae91`
passed build, corpus, Tauri, debugger, vendor, x86, Rust notices and PXT controls.
The [official numeric authoring job](https://github.com/CrispStrobe/brickwright/actions/runs/40826166493/job/123293573362)
passed all five bounded GUI journeys. A standalone reader checked 411 observed
bundle hashes/byte lengths and the complete clean export input/result hashes.
Its actual build checkout is `2e5345c50381743706f53ac73e75686b44535c7d`,
tree `6b764fb64d4ae7d5bc65a45d209c31f6a2115b01`. This synthetic merge differs
from the reviewed head only by the newly registered native-fixture claim
Markdown. Its exact parents, predicted tree and sole changed path were verified;
application source bytes agree. Preserve this actual checkout identity rather
than asserting full-tree equality with the reviewed head.

The six unit shards still contain **33 blocking test identities**, down from
37 on `ae22d4a`. Four controls are resolved, including the complete multiplayer
Player test's original-SDK/native, Code, saved/fresh SB3 and exported-PXT routes.
The containing shard remains failed. No new failing identity appeared; the
source-shape ratchet now reveals a remaining segment-match suspect after its
ambient-Git failure was fixed. The successor replaces the truncated Rust test
name extraction with explicit short/full selector equality; no ratchet baseline
changes. Other producer/effect failures remain open.

Original failed logs and numeric artifacts for both heads are retained once;
consult ignored operational notes before any intake. The `6e513` numeric capture
is `COMPLETE`, with no unsupported entries or warnings. Its earlier strict
full-tree equality audit failed and is retained alongside the separately
verified claim-only composition. Earlier skipped/freshness-unavailable captures
remain separate observations. These journeys do not qualify a complete corpus
application, the pending source changes, physical devices or a release.

The prepared successor repairs four exposed control problems: the literal
`parseInt("7")` normal-result case is positive while opaque-input cases still
refuse; the refusal-observer dependency inventory matches the current module;
the portable Player fixture has an explicit `mp.Player` parameter for strict
original-PXT compilation; and the Tauri source control reads the checked-out
Rust file instead of requiring Git from PATH. Fourteen focused controls pass;
the original-PXT Player execution passed on `6e513`; the new successor still needs its own qualification. The newly
[registered document-trigger claim](../lanes/2026-10-29-arcade-lineage-doc-trigger.md)
adds the lineage document read by a source test to the Build push-input list.
Existing complete trigger census and mutation controls remain mandatory.

A minimized Sprite snapshot loop exposed a separate value-graph defect:
indexing an unknown receiver emitted no result fact, so its destination looked
as if it contained only its initial Null writer. A conservative Opaque-result
draft fixed that omission, but review found an unsafe downstream interaction:
`JSON.parse('[{"x":[1]}]')[0].x` could be mistaken for a numeric SDK field.
The indexed-read draft is **withheld**, and its snapshot-positive control stays
an unresolved obligation. New JSON-derived-object refusal controls prevent
shipping that interaction. Do not merely add Opaque propagation and claim the
snapshot case works: the numeric field consumer needs genuine receiver lineage.

A separate source-edit/restore control exposed revival of the native domain
proof when no optional producer was involved. The successor adds a permanent
expiry latch, preserving both the original staleness failure and subsequent
refusal after restoration. Cutting that latch fails its new control. Nine
existing primitive-addition/operator controls also pass. These bounded source
checks establish neither VM/original execution nor a completed corpus row.

The earlier [isolated Tauri timing job](https://github.com/CrispStrobe/brickwright/actions/runs/40813806300/job/123250070998)
still failed: fastest 2.591604 ms against the preserved 2.5 ms assertion,
median 4.736635 ms. The remaining default suite passed 269 with 11 declared
ignored tests. A subsequent unchanged-fixture Tauri run on `6e513` passed; that
finite success does not erase the failures or establish a timing root cause.
Scheduling isolation alone was insufficient in the failed observation. Preserve this and
the earlier 2.555585 ms failure; route the actual Rust-source investigation to
its separately coordinated owner. Do not retry unchanged or relax the threshold.

Continue in order:

1. Finish source/control repairs in the isolated successor. For each remaining
   native-addition refusal, retain the original operation and first operand;
   distinguish actual producers, readiness, effect closure and Array writers.
   Do not solve these with annotations, helper names or blanket Opaque removal.
2. Prioritize actual Sprite registry elements and callback/for-of aliases,
   recursive class/virtual-call results, then remaining SDK/effect families.
   For registry reads, extend a private receiver-lineage service from actual
   `sprites.allOfKind` calls through aliases and canonical index/loop entries.
   Prove namespace identity, complete writers, all collection mutations and
   escapes, and genuine Sprite origins before issuing a numeric property result.
   An empty snapshot stays an Array without invented element presence. Keep the
   JSON-derived non-Sprite negative, changed KIND/namespace, incompatible writers,
   early reads and source-expiry controls. Neither existing
   `ordinarySpriteAyNumberReads` nor `nativeClassScalarView` currently proves
   general registry elements; do not treat either name as an existing grant.
   The ExtendableSprite reimport also needs its Array receiver/default-reset/
   KIND readiness join; the constructor interpreter's private snapshot is not
   an independent Array authority. Its post-setKind writer needs actual
   callback receiver lineage at the class consumer. Preserve these refusals.
3. Coordinate the inherited reference-instrument pin/fingerprint and collector
   failures with their source owner. Keep historical fingerprints and source
   identity guards; never replace an old SHA with the current pin by spelling.
4. Publish a complete successor normally, qualify its enabled final-head checks
   and affected SDK/native routes. When final fast checks are ready, request
   the required browser tier with `ci:full` once. The label-only event avoids
   repeating fast jobs. Do not remove/re-add labels or duplicate a dispatch.
5. Merge only after all enabled exact-head gates succeed or have declared skips,
   with reviewed/landed tree and parents verified. Then run the private raw
   corpus and recovered complete contexts on an admitted external worker.

The immutable raw census remains **184 = 147 translated / 36 partial / 1 parse
failure**. Only fresh whole-application execution and roundtrip evidence can
promote rows. Builds, browser, SDK, VM and corpus suites stay off the shared
server. Public reports contain public repository paths and URLs only.

## 29 October: multiplayer Player Number source checkpoint and GUI acceptance

The unchanged Player fixture's bounded authoring probe now imports, constructs
its editable project and exports without diagnostics. The initial refused probe
is retained. This is source/authoring evidence, not execution or corpus promotion.

`multiplayer-player-number-normal-source.js` binds actual registered Player
entry and receiver/helper writers to a closed effect census. The original
`multiplayer/player.ts` contract returns zero for Null/Undefined, or the genuine
Player's numeric index plus one for the named Number selector; its reviewed
SHA-256 is `03de34ae9da35c2a387bb5a5ce8be08117614e8d8f1d1a40c941d2afcb5136e0`.
Annotation markers are not value producers. The raw graph retains them; only the
receiver-domain query distinguishes a marker from actual nonempty
Player/Null/Undefined alternatives. Every other opaque alternative refuses.

Namespace, selector, callee, prototype, `_index`/`getProperty`, all receiver
writers/callers, primitive coercion and controller/event closure are required.
Source, realm and namespace snapshots permanently revoke observed stale facts.
The native consumer proves original operations before projections, joins exact
fresh call identities, preserves the actual invocation and grants only its
normal Number result. It initializes no receiver, variable or generic call.

This also exposed a general shared-helper gap: a `+` body with both String and
Number callers was becoming opaque. The ordinary producer graph now gives
Number/String normal-result domains only when both complete operand sets are
nonempty subsets of String, Number, Boolean, Null and Undefined. An exact String
operand forces String; a merely possible String keeps Number|String. Unknown,
reference, Array and any other alternatives still refuse. Initialization and
effects remain independent; no opaque fact is subtracted.

Ten Player source groups, four primitive-addition controls and two native
controls pass, with eight existing operator/import and 17 existing Image
controls unchanged. Five parse/Image native controls also pass. Removing the
normal-result consumer or the primitive-union rule is detected. The initial
aggregate CPU-cap failure is retained; candidate membership now uses captured
intrinsics before scanning live dependencies for genuine occurrences, without
executing a replaced observer. Limits were unchanged.

The complete Player acceptance test now additionally executes original authored
and exported programs in pinned PXT. Those guest executions remain **UNRUN**
here. Run the existing test externally with its native, Code, hot/fresh SB3,
reimport, negative-edit and original SDK assertions intact:

```sh
node --import ./scripts/lib/register-gui-scope.mjs --test --test-concurrency=1 test/source-primitive-addition-unions.test.mjs test/multiplayer-player-number-normal-source.test.mjs test/native-multiplayer-player-number-domain.test.mjs test/makecode-arcade-player-number-producers.test.mjs
```

Direct lookup results, Index/dynamic selectors, member access, arbitrary Player
escape and unrelated callback entries need separate proofs and acceptance.
Preserve the Player 2 output, both nullish zero results and every existing edit
refusal while qualifying this boundary. No full multiplayer compatibility claim
follows from these controls.

The authoring surface is already broader than that proof task. The Arcade
extension exposes Player number/index lookup, safe/member property access, a
numeric property socket defaulting to 2, token-linked connection registration
and callback hats, and the event Player reporter. Code/pseudocode words are
reversible. This inventory establishes source presence, not GUI/runtime passes.

Relevant implementation files are
`overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js` (blocks, menus,
identity, lookup and callback payload),
`overlay/scratch-gui/src/lib/arcadeDialect.js` (Code words),
`overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js` (SDK import and enum
conversion), and `overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js`
(export, typed callback entry, Player identity and inspection constraints).

Acceptance tasks for the existing editor owners:

- Author Number inspection from the actual event Player, then verify Blocks,
  Code, saved/freshly reopened project and original export/reimport.
- Change safe/member access and Number/Index independently. Retain the selected
  semantics or show the precise missing-proof refusal; do not silently replace
  either choice with Number. Dynamic selectors and direct lookup results need
  their own proof before claiming those conversion routes.
- Exercise a callback-local Null → Undefined → event Player alias without
  replacing reference identity with a numeric player index.
- Verify that property 2 exports as `mp.PlayerProperty.Number` and connection
  event selections as named Connected/Disconnected enums.
- Keep supported scalar inspection editable and make direct Player inspection
  refusal actionable. Player-object coercion is a separate capability.
- Scope labelled property selectors and clearer callback wiring separately with
  their UI owners; the current property socket uses a number.

## 29 October: parsing and creation-callback source checkpoint

The immutable raw corpus remains **147 translated / 36 partial / 1 parse failure**.
These are source-proof repairs awaiting complete application qualification.

`ordinary-parse-integer-number-source.js` now proves exact unshadowed global
`parseInt` calls with a literal String and an optional literal integer radix.
Normal return is Number, including NaN. It does not fold results or grant finite
values, completion or initialization. A closed scalar effect census rejects
extraction, namespace/prototype writes, unknown calls/coercions, classes, Arrays
and uncertain arguments. The selected original PXT and generated helper source
hashes are recorded in the module. Captured realm aliases, descriptors and
iterator chains, source snapshots and permanent revocation bind the receipt.

The ordinary value graph consumes that result before its generic Call fallback.
The frame-time census accepts the same independently proved calls, so a genuine
`onUpdate` delta-time read can coexist with literal integer parsing. Native
addition proves the original operations before class/result projections, joins
fresh call identities, and consumes only the exact normal-return receipt.
The actual call and arguments remain present; no binding or generic Call becomes
initialized. Supplied source tags remain refused. Internal Symbol tags are
consumed after identity joining rather than weakening opaque-source checks.

Nine leaf controls and three graph/frame/native controls pass. The original
realm-guard and native integration failures are retained. Removing the exact
native normal-return receipt is detected by the positive control.

A bounded pure authoring probe of the actual core-values source now imports,
constructs its editable project and exports with no diagnostics. It executes
neither Lite nor PXT. The generated-images authoring probe now also imports, constructs its editable
project and exports without diagnostics after closing the actual emitted alias
ingress. Its original refused probe is retained. The callback introduces a local
Sprite initialized to null, assigns the supplied formal once, then reads width.
The proof retains both writers and supports the original formal or that one
local alias after the bridge; extra writers, early reads and escapes refuse.

The mutable Image profile also supports an exact top-level inline
`sprites.onCreated` observer reading the direct formal's width privately.
Canonical creation attaches the issued Image before matching handlers run in
registration order, following the pinned original constructor, factory and
registration code. Width remains an unknown private Number; the public API
still issues only actual `getPixel` receipts. Classes, scaling/rotation,
formal reassignment, additional aliasing/capture/escape, scene changes, yielding and reentrant
creation/registration remain refused. Uninvoked writes/effects stay visible.
Eighteen source controls, all 17 unchanged Image controls and two native-domain
controls pass. Mutations that remove Image attachment, reverse handler order or
disconnect alias-ingress recognition are detected.

Continue in this order:

1. Retain the frozen integration head's required terminal numeric originals,
   then compose this follow-up normally into PR #1554. Require every enabled
   final-head check and affected original/native/browser qualification before
   main; predecessor successes do not qualify the successor.
2. On a prepared external worker, run the unchanged whole-application controls
   below. Preserve pixel arrays, identity, callback width, Code, hot/fresh SB3,
   executed original PXT export/reimport and presentation budgets. Diagnose the
   actual first remaining refusal; these source passes promote no corpus row.
3. If emitted source still fails, close its actual callback entry/alias ingress.
   The current profile accepts top-level registration and direct formal or
   unique bridged-local width reads. Startup registration, multiple aliases and
   width-dependent branches remain outside it. Prove original entry, all writers, lifetime and
   notification order rather than treating callback annotations as authority.
4. Extend parsing to independently proved nonliteral primitive inputs only when
   observed authoring failures require it. Preserve coercion effects and actual
   lexical/currentness obligations. Then reassess the immutable full corpus and
   authentic complete project contexts externally, promoting whole cases only.
5. Complete the tracked Blocks/Code and artwork editor acceptance: edit shared
   frames, preserve distinct equal-looking images, attach to Sprites, save and
   freshly reopen, then export/reimport. Coordinate existing editor owners.

```sh
node --import ./scripts/lib/register-gui-scope.mjs --test --test-concurrency=1 test/ordinary-parse-integer-number-source.test.mjs test/native-parse-integer-number-domain.test.mjs test/native-mutable-image-pixel-results.test.mjs test/native-array-mutable-image-domain.test.mjs test/makecode-arcade-core-values.test.mjs test/makecode-arcade-generated-images.test.mjs test/arcade-inline-animation-artwork.test.mjs
```

Full SDK/native/browser/corpus execution remains external. No runtime or
whole-application pass is claimed by the bounded source controls above.



## 29 October: mutable Image pixel occurrence follow-up

A separate `mutableImagePixelNormalResults` source API now issues Number on
normal return only for the actual observed `getPixel` occurrence. The old
`imagePixelNormalResults` API, immutable-list Number gate and Image/primitive
observation behavior remain independent. The new API exposes neither generic
Image/Array authority nor pixel values, element presence or initialization.

The closed profile tracks distinct Image allocations, clone identity, list
aliases and literal pixel/fill mutation. It permits a canonical Sprite factory
with a genuine issued Image and a named builtin kind input, plus `setImage`
retention of that issued Image. It does not invent kind ordinals. Classes,
callbacks, scene changes, namespace/method replacement, unknown escapes,
incompatible receiver writers and unsafe list indices remain refused. Every
mutable effect must be observed; an uncalled mutation body is not erased.

The native consumer proves these original operations before result projections,
joins fresh private call identities after class/source interpretation, and
keeps the actual call and arguments in the type-only normal-result view.
Original source, SDK descriptors, realm, absence and exception observations bind
permanent currentness. Supplied tags or copied nodes cannot enroll the receipt.
The reviewed original `ImageMethods::getPixel` contract returns a pixel integer
or zero out of range; source identities are recorded without executing SDK code.

Eighteen current source groups, all 17 unchanged Image controls and two native-domain
controls pass. Three mutations detect missing occurrence membership, skipped
unexecuted effects and missing native projection; exact original bytes are
restored. The unchanged authored artwork source is covered by the source test.
No runtime, rendered pixel or complete application verdict follows from it.

Run the full existing acceptance on the prepared external worker:

```sh
node --import ./scripts/lib/register-gui-scope.mjs --test --test-concurrency=1 test/native-mutable-image-pixel-results.test.mjs test/native-array-mutable-image-domain.test.mjs test/native-image-pixel-normal-results.test.mjs test/native-image-origin-observations.test.mjs test/arcade-inline-animation-artwork.test.mjs
```

Keep the original expected pixels, identity comparisons, Code, saved-SB3,
fresh reopening, executed PXT export and reimport checks unchanged. If another
operand remains refused, retain its actual first diagnostic and extend only
that producer. The previous full source/artwork probes reached the local CPU
cap; do not substitute a higher local cap or call them application passes.

This is a separate follow-up to the frozen `0eb57401b35` qualification head.
Preserve its required terminal originals before publishing the successor.
The immutable raw census remains **147 translated / 36 partial / 1 parse failure**.

The generated-image follow-up also accepts `fillRect` and `drawLine` with
five proved primitive int32 arguments, `replace` with two, and `flipX` with none.
Every effect must execute in the closed source traversal. The mutable factory
accepts only literal-proved int32 dimensions within the reviewed native
`mkImage` bounds, zero through 2000; invalid dimensions cannot become issued
origins for later control-flow selection. Issued Image dimensions
can feed that private traversal, but do not receive public Number receipts.
The pinned `screen/image.ts` helpers pack primitive coordinates and forward to
pixel-only native methods; reviewed SHA-256 is
`1fc7bed84554d0dab9d456c669babc746f0d0ddd7206b8efb29985cbb78e4a4a`.
All 10 source, 17 unchanged Image and two native-domain controls pass after
this extension. A missing drawing-input guard is detected by its negative
control; restored bytes are checked.

The next distinct acceptance task is **generated Image creation callback closure**.
`test/makecode-arcade-generated-images.test.mjs` still contains
`sprites.onCreated(SpriteKind.Player, function(sprite) { callbackWidth = sprite.width })`.
The top-level direct-formal source slice now accepts that observer privately,
as described above, including its unique emitted null/alias bridge. Startup
registration and broader alias graphs remain pending. Prove the actual
registered entry, receiver and width getter together with Image attachment
before notification; do not infer ordering from a callback annotation or name.
Preserve alias and clone identities, handler replacement, reentrancy, receiver
reassignment, scene changes and all incompatible writers. Keep the unchanged
whole-fixture pixel arrays, callback width, Code, SB3 and original PXT assertions.
The retained export failure supplied only a generic native-addition refusal,
so identifying this source frontier is not proof that all other frontiers close.
Run the complete generated-images test externally after the new boundary is
implemented; no application completion is recorded here.

GUI acceptance remains separate: edit either grouped animation frame, preserve
shared-alias mutation and distinct equal-looking artwork sites, attach the edited
Image to a Sprite, then save/reopen and export/reimport through original Arcade.
Source occurrence proofs do not establish those interactive editing routes.



## 29 October: active delivery checkpoint

Source checkpoint `6acccd1cbeeeded76a73282563010e8d6a7eb4cd` includes the
original-operation callback proof and clean-observation follow-up below.
Composition `c18f2cdc8f179ca1289c3149290b9b433a6d4a53` adds the latest reviewed
main, `47a9a122584`, through a normal documentation-only merge. Product
qualification remains pending; neither source controls nor predecessor successes
establish runtime or whole-application completion.

[PR #1554](https://github.com/CrispStrobe/brickwright/pull/1554) is the active
integration delivery. Its initial `cda475baa206c51e4004f186344a780a150a400a`
head was superseded after the separate source checkpoint was prepared. Only
queued Build/debugger runs with no running children were cancelled; the running
Tauri jobs were allowed to finish and both succeeded. Their originals were
retained before advancing the integration head. The cancelled numeric job had
no runner, steps or build artifact: `UNAVAILABLE_CANCELLED_BEFORE_PRODUCER`,
with no semantic outcome. These facts qualify neither the successor nor a
corpus row. Refresh the actual PR head and every enabled check before acting;
require final-head guest and browser qualification before main.



## 29 October: clean export observation opt-in candidate

The missing clean-export capture has a concrete producer cause:
`projectJsonToArcade` previously attached its owned JSON observation only for
refused results. A later successful export therefore had no observation to
satisfy the existing freshness observer. The default successful API deliberately
retains exactly `files`, `ts`, `unsupported` and `warnings`; its assertion is
unchanged.

The next candidate adds an explicit own-data `captureObservation: true` option.
Only that opt-in extends successful results with the same bounded observation
used for refusals. The stage exporter requests it on the single original
invocation. Capture retains the exact consumed JSON and actual semantic result,
without re-exporting or executing the project. Inherited or accessor options do
not enable capture. Serialization failure and the existing byte limit retain
unavailable outcomes. Original-source passthrough remains separately unavailable;
a refused or clean capture does not establish successful compilation or runtime.

Three focused source controls pass, including the unchanged default-key check
and execution of the actual stage-export method against the exporter. Two
mutations detect either missing opt-in; original source is restored. This is source qualification only. The initial [PR #1554](https://github.com/CrispStrobe/brickwright/pull/1554)
head did not contain this follow-up. Its terminal custody is now complete;
require the successor official numeric GUI job to
produce and independently audit a fresh complete capture. Never relabel the
older unavailable record or relax its freshness checks.

### Conditional destruction-callback result source candidate

The primitive producer graph now consumes selected `sprite.x` Number results
from genuine direct `onDestroyed` callbacks. This also handles closed
zero-argument ordinary startup calls and the emitter's callback-local
`let sprite = null; sprite = eventParameter` ingress. Other leading inert
null declarations may precede that assignment, as the actual replacement-Sprite
fixture requires. Lexical binding identity,
all references/writers, read-after-assignment order and source/SDK/intrinsic
currentness are required. The actual reset and operations remain in the program.
An inline callback or local alias does not become a generic Sprite or initialized
value certificate. The fixed-point getter dependencies stay protected; coordinate
setter arguments remain independently literal primitive expressions.

The private source model closes primitive Array construction/push effects too.
Nullable factory receivers retain every null/undefined writer and are used only
for closing the admitted method effects: a non-Sprite branch may throw, and no
Sprite or initialization fact is published for it. Foreign/object writers and
receivers without an actual factory remain refused.
A retained null receiver writer can still throw before registration; admitting
that operation's effects on its normal path grants no Array, presence or
initialization fact. Existing null-reset discounts are consumed only through
their independent proof. Inert recognition tokens retain identity/currentness;
they cannot authorize executable AST fields. All executable own data fields,
including non-enumerable ones, participate in the effect census. A review found
that boundary gap and a regression now detects hidden mutations and unknown
calls.

The 32 service source cases pass in bounded partitions, and five primitive
consumer/native-domain controls pass. The aggregate local source-file run
reached its CPU safety cap; that failure is retained and full-suite execution
remains hosted work. The earlier minimal import/authoring/export control also
passes. Three current mutation cuts detect missing consumer facts, missing alias
ingress and skipped hidden executable fields; original bytes were restored.
The earlier seven-control authored-source checkpoint and its failures remain
historical evidence, not a runtime verdict.

The minimal diagnostic is an ordinary primitive Array plus
`sprites.onDestroyed(SpriteKind.Enemy, function(sprite) { positions += sprite.x })`.
Before this repair its first export refused the **left** `positions` operand
with `Number | Opaque` and initialization true. The same actual conversion now
exports without refusals. Omitting the Array uses the pre-existing ordinary
fallback and is not sufficient evidence of this repair.

Run the complete controls on the prepared external worker:

```sh
node --import ./scripts/lib/register-gui-scope.mjs --test --test-concurrency=1 test/arcade-destroyed-sprite-callback-number-source.test.mjs test/arcade-destroyed-callback-consumer.test.mjs test/native-array-destroyed-callback-domain.test.mjs test/makecode-arcade-sprite-collections.test.mjs
```

The source effect profile now admits the actual snapshot `while` loop,
immutable direct comparison helpers and the compiler's pure unary helpers,
including `-1 * value`. It checks every actual argument and source writer.
Numeric indices come from the independent original source graph; nullable
snapshot/index receivers provide only a normal method-effect boundary, with
possible throws retained. No element presence or Sprite/Array initialization
certificate is published.

Pure unary calls are represented by their original operation at each actual
site in a private graph. This prevents one caller's unresolved formal domain
from contaminating another caller and never substitutes a numeric constant.
The native addition consumer proves original getter operations before its
existing unary/result projections, then joins exact private property identities
and carries original-source/SDK/currentness checks through the analysis.
Its type-only normal-result projection occurs after class/source interpretation;
actual emitted operations and evaluation order stay intact. Supplied tags cannot
enroll a proof. Original refusal inhibits later graph issuance. Throwing source
observations permanently revoke the receipt, and changed Array intrinsics are
observed without invoking the changed method. Mutation controls detect missing
normal-result projection, foreign method invocation and missing exception
revocation; the original source is restored.

The exporter also flattens a custom kind into a namespace slot declaration and
three adjacent root statements: `alias = undefined`,
`alias = SpriteKind.create()`, `SpriteKind.Custom = alias`. The private input
receipt now recognizes one such slot with unique lexical bindings and the
complete writer census. Alias/slot reads must be direct admitted SDK kind
inputs after that frontier; an inline callback must itself be registered later.
The source name is immaterial. No numeric kind value, kind equality or variable
initialization is inferred, and this receipt never joins the primitive producer.
Extra writers, changed factory identity, copied aliases, earlier use, ordinary
function captures and reserved/internal slots retain refusal. Multiple flattened
slots and additional kind-producer shapes remain open.

The new default-on acceptance must actually destroy a created Sprite and observe
`positions = 10`, `callbacks = 1`, `ready = 1` through original PXT, Lite, Code,
export/reimport and fresh saved-project routes. It is unexecuted locally.
The two unchanged snapshot-destruction fixtures also remain unqualified: their
replacement sprites, pauses, retained handles, snapshot loop/index receiver
and final coordinates must all pass. Do not erase an unproved callee or loop,
broaden this result proof into Array/Sprite authority, or promote a corpus row
from the minimal conversion. Extend only the first actual remaining emitted
operation, retaining its all-writer, entry and currentness obligations.

## 29 October: primitive Array callbacks and qualification checkpoint

The current source candidate proves primitive element and numeric index entry
for closed `forEach` and `filter` calls. The proof requires dense literal origins
or the emitter's unique empty local allocation followed by contiguous,
independently primitive pushes. Filter results have fresh allocation identity
and retain receiver elements, never predicate return types. Their callback
indexes are the filtered array's compressed indexes. A private analysis pass
checks lineage; public options cannot manufacture accepted calls or parameter
facts. Receiver mutations, later alias pushes, foreign effects, unsupported
callback/default syntax, sparse origins and source/intrinsic revocation refuse
the proof. No element presence, callback execution, exact index value, generic
Sprite receiver or initialized-value certificate is inferred.

The importer also lowers two-parameter filter predicates and predicate bodies
with a final value return. It executes the prefix and predicate for every
original element before starting the final `forEach`, preserving predicate
indexes separately from compressed result indexes. Early-return predicates
retain explicit refusal. This is not a general callback or mutation-semantics
completion.

Eleven bounded source controls and two separate import/authoring/export
controls pass. Two deliberate cuts detect missing entry facts and disabled
sticky expiry; the original source was restored. A read-only review found no
concrete bootstrap/lineage authority leak. Original PXT/native execution remains
pending. The default-on runtime control requires `sum = 323`,
`predicateIndexes = 1234` and `trace = "90:0;100:1;130:2;"` through original PXT,
Lite execution and exported PXT, with the existing finite frame budget.

Run on the prepared external worker:

```sh
node --import ./scripts/lib/register-gui-scope.mjs --test --test-concurrency=1 test/arcade-primitive-array-callback-source.test.mjs test/makecode-arcade-array-callbacks.test.mjs
```

The SDK `allOfKind` Sprite callback fixture is still a separate open producer
family. Blocks/Code need complete callback creation, parameter naming,
editing, save/reopen and export/reimport acceptance; these converter proofs do
not establish that GUI capability. Sparse literal parsing also remains open.

### Retained hosted results and next qualification

[PR #1544](https://github.com/CrispStrobe/brickwright/pull/1544) remains a
frozen draft at `69010112e7f497d2cd67a6d0bad1ebdcae59363c`.
Its [numeric-authoring job](https://github.com/CrispStrobe/brickwright/actions/runs/40758182799/job/123134743633)
succeeded, while its six unit jobs and full-CI guard failed. An independent
ZIP/JSON reader checked the retained proof's identity, receipt equality and
411 bundle observations across five passing producer records. The receipt
binds synthetic checkout `b4aa709a2d6947df012908d8eda7972c63c1c69a` to reviewed
tree `57480c9861f5f354fd0d957b2cdc97d745911cfc`; this is a tree claim, not
commit identity or independent guest replay. The clean export observer reports
`UNAVAILABLE_FRESHNESS / OBSERVATION_MISSING`. It is not a complete capture and
must be diagnosed separately from semantic refusal and the successful job.

The original typed-bitwise PXT/native/Code/fresh-SB3 control passed on that frozen
head. A corrected standalone TAP census binds each failing result to its own
adjacent subtest and location: the earlier baseline had 42 actual blocking
identities, not the historical 43-row summary; this head has 43 (one bitwise
repair, plus a stale import census and the new dormant marker failure).
The declaration-reference TODO is not a completion. The later source candidate
repairs the stale census and marker setup, but still needs final-head hosted
qualification.

Continue in order: qualify the combined source once on the current dependency
composition; repair its actual remaining failures without changing assertions;
resolve missing clean capture; then reassess all immutable original applications
and authentic complete contexts. Only whole-project conversion, original PXT,
Lite execution, controller/presentation and saved-project evidence promotes a
corpus row. The recorded raw census remains **184 inputs: 147 translated,
36 partial, 1 parse failure**; this checkpoint promotes none. Require every
enabled final-head check to succeed before a normal matched-head landing.


## 28 October: ExtendableSprite constructor-result source candidate

The constructor-effect service now has a bounded `sprites.ExtendableSprite`
profile. It preserves parameter-property stores before the superclass call,
executes the admitted creation handler after the complete virtual `setKind`
return, and retains the same partial instance in a private registry snapshot.
This follows the [selected original constructor](https://github.com/microsoft/pxt-common-packages/blob/v14.1.4/libs/game/extendableSprite.ts):
notification uses its supplied creation kind after physics registration, even
when an override changes current membership. The default identity control binds
the exact pinned target and original constructor source bytes.
Handler field writes and source overrides contribute before the actual method
result is observed. Only current primitive occurrence results are published;
private instances and snapshots provide no generic Sprite, Array or initialized
value certificates. The ordinary class graph's conservative foreign-effect
refusals remain intact.

Ten selected source controls pass: seven new groups and three unchanged Sprite
ownership/writer controls. Cuts detect missing handler execution,
parameter-store ordering, snapshot escape refusal, uncertain kind matching and
notification before the override suffix;
exact source bytes were restored. The unchanged `created-partial-fields` fixture
now exports without refusals in a bounded conversion probe. Its longer
export/reimport control reached the local CPU cap; full authoring and original
PXT/native qualification remain pending. No application completion is inferred.

Kind matching uses private identities for unchanged SDK members, not invented
ordinal numbers. This slice admits one named kind family, or exact numeric
kinds; mixed or different named identities and arithmetic without a proved key
refuse the whole interpretation, including earlier collected observations.
The retained original [`spritekind.ts`](../overlay/scratch-vm/src/extensions/crispstrobe/arcade/kind-source/spritekind.ts)
and its provenance identify the source for a later distinctness/creation proof;
do not replace uncertainty with a guessed Player/Enemy number. Yielding,
scene changes, escaping partial instances/snapshots, nested creation during
notification and unsupported reentrancy also retain explicit refusal.

Run on the prepared external worker, preserving existing acceptance assertions:

```sh
node --import ./scripts/lib/register-gui-scope.mjs --test --test-concurrency=1 test/arcade-extendable-constructor-scalar-source.test.mjs test/arcade-sdk-constructor-scalar-effects.test.mjs test/makecode-arcade-sdk-sprite-class.test.mjs test/arcade-dormant-sprite-declarations.test.mjs
```

The first hosted dormant-declaration test failed in its original-PXT observation,
before Lite execution: the single unused constant marker was absent from the
simulator globals. Its corrected fixture uses an executed
`ready = 0; ready += 1` marker. The original, exported and fresh-SB3 original
simulators must each publish exactly one `ready`/`Game_ready` marker equal to 1;
the native checks, source compilation, declaration assertions and frame budget
remain required. This correction has no passing external verdict yet. Preserve
the original failed result and qualify the corrected test.

This is converter proof work, not a new authoring-control delivery. Serialized
reference declarations/parameter properties, their Blocks and Code controls,
and graphics/animation/tile-map editing parity still need their own complete
editing, save/reopen and original MakeCode acceptance evidence.

## 28 October: local Array declaration resets and missing-index arithmetic

The next completion checkpoint fixes a producer-domain loss in the actual
exported missing-index fixture. Its emitter builds an Array with
`let temporary = null; temporary = []; temporary.push(1)`. The declaration's
null initializer previously remained in the complete writer domain, preventing
the indexed read from receiving any domain. The new source proof discounts only
that unobservable reset on a unique, uncaptured ordinary-function local followed
immediately by an assignment of a fresh empty Array to the same lexical binding.
The actual reset, allocation, evaluation order and runtime source stay intact.
Later null/incompatible writers still poison the receiver. No annotation,
initialization, bounds, presence or Number-only element fact is manufactured:
the missing element retains `Undefined` and ordinary addition produces `NaN`.

Globals, var/const/multiple declarations, unknown syntax, reflective evaluation,
nonempty or computed allocations,
intervening statements, conditional overwrites, duplicate bindings, defaults and
nested function/class captures cannot acquire the discount. The source and
analysis-intrinsic snapshots expire permanently after observed changes. Every
dependent Array value/safety/readiness query uses the shared fact-currentness
guard; music-derived Array element facts expire with their music producer too.

The combined source cohort passes 15 controls. Four reset cuts at the initial
reset checkpoint independently
detect a missing graph discount, empty-allocation restriction, class capture
guard and permanent expiry; exact source bytes were restored. The unchanged
missing-index fixture now exports without refusals in a bounded conversion
probe. Its original PXT/native/Code/saved-project acceptance is still required:

```sh
node --import ./scripts/lib/register-gui-scope.mjs --test --test-concurrency=1 test/arcade-local-array-declaration-reset.test.mjs test/arcade-music-number-source.test.mjs test/makecode-arcade-value-arithmetic.test.mjs
```

The separately observed `created-partial-fields` refusal is now localized to
the LEFT Identifier operand of `result += 0` after `result = easy.read()`:
its domain is `Opaque | Number` with initialization true. The preceding String
trace additions are not the first refused operands. The constructor-result
candidate above addresses this observed scalar path; qualify it before claiming
closure. Later expansions must preserve parameter-property visibility during
`onCreated`, yields, scene ownership, return writers and overrides. Callback
Sprite parameter authority is a separate capability, not this result-cell fix.

## 28 October: completion integration and music Number results

The [registered completion campaign](../lanes/2026-10-28-arcade-completion-integration.md)
owns the remaining Arcade continuation. Its separate integration branch composes
the dormant-declaration source with current main, preserves the newer compatible
Board and Creator changes from their respective parents, retains the Array pin
and Acorn, and rebinds the two frozen x86 receipt rows to the actual composed
script bytes. Frozen values and byte spans are unchanged. The pin metadata check
passes; installed dependency identity and runtime qualification remain pending.
Do not treat this composition as a qualified main landing.

The next source candidate adds independently guarded `music.tempo()` and
`music.volume()` Number results. The generated mixer coerces both stored values;
that proves a Number on normal return, without certifying their inputs. The
profile binds the generated mixer hash, closes mutable Math/music dependencies,
aliases and callback effects, rejects erased defaults and unrecognized syntax,
and permanently revokes consumed facts after an observed source/intrinsic change.
Native projections also retain an earlier source admission/currentness gate.
The existing helper recognizer already rejects defaults without their entry
prologue; do not report that defensive projection gate as a newly reproduced
runtime defect. Scroll-offset getters remain separate: their setters store raw
inputs, so their API names or result annotations cannot supply this proof.

Seven focused source controls pass. Three independent cuts detect a missing
Math dependency guard, erased-default refusal and permanent revocation; exact
source bytes were restored. A bounded conversion probe exports the unchanged
full music authoring fixture without refusals. Separate controls cover the source profile, both export routes,
repeated reimports, Code rebuild and actual SB3 archive reopening. The longer
authoring control reached its local CPU cap and has no passing full verdict yet.
Run the following on a prepared external Node 22 worker with locked, integrated
GUI/VM dependencies, pinned original PXT and the browser dependencies required by
the existing music acceptance test:

```sh
node --import ./scripts/lib/register-gui-scope.mjs --test --test-concurrency=1 test/arcade-music-number-source.test.mjs test/arcade-music-number-authoring.test.mjs test/arcade-export-refusal-report.test.mjs test/makecode-arcade-music.test.mjs
```

Keep the existing native/original-PXT test unchanged. The diagnostic-report
fixture now uses an unproved scroll-offset getter, because a guarded tempo
getter must no longer manufacture a refusal. Its transport, provenance, capture
and stale-publication assertions remain required. The exporter import census
includes the two added declaration dependencies.

Continue in order: retain/classify the frozen PR #1544 terminal originals once;
qualify the final composed source; close actual Array callback-entry/index,
SDK Sprite callback/partial-construction and ordinary-result/missing-index
producer gaps; then reassess all 184 immutable inputs and authentic complete
contexts through conversion, native/original execution, controller and saved
project routes. Only actual whole-case evidence changes the unchanged raw
147 translated / 36 partial / one parse failure census. Finish by refreshing the
Blocks, Code, graphics, animation and tile-map authoring gap inventory. Existing
editor lanes remain with their owners.

## 28 October: dormant Sprite local/return declaration candidate

The [separate dormant-declaration claim](../lanes/2026-10-28-arcade-dormant-sprite-declarations.md)
now has an isolated source implementation for null-initialized locals and
null-returning ordinary helpers whose complete affected closure stays dormant.
Conflicting Number, String or Boolean locals/results now retain their code and
list an explicit incompatible-flags declaration refusal.
Physical reads/writes/callers must match actual emitted lexical bindings. Real
null assignments must precede every local read; generated zero initialization
provides no evidence. The compatible declarations survive export and reimport
without adding initialized Sprite or Number facts to the live graph.

The 28 selected source controls pass; three separate cuts detect missing local
rendering, result rendering and physical initialization. The external acceptance
case was excluded from that bounded source probe.
The claim provides the exact external acceptance command and the source-only
boundary. Its enabled-by-default original-PXT/native test still needs an external
prepared worker. Source probes and read-only review do not qualify a corpus row.
The original typed-reference fixture still has its separate Array receiver and
native-addition refusals; preserve those failures. After actual acceptance,
compose with current integration/main and qualify the final head. Broader
reference producer support and editable serialized reference annotations remain
separate capabilities, not implied by this declaration repair.

## 28 October: typed-bitwise reimport source candidate

The [typed-bitwise claim and scoped continuation](../lanes/2026-10-28-arcade-typed-bitwise-reimport.md)
records an isolated exporter repair and its pending qualification. An uncalled
Sprite-flags helper now retains a `Sprite` signature through both export routes,
Code rebuild, archive reopen and repeated reimports when current whole-program
reachability and exact physical/lexical use agree. This is declaration rendering;
it supplies no live value or operand facts. Seventeen focused source tests pass;
removing the signature override breaks the two positive roundtrip controls.

Next, run the unchanged original-PXT/native typed-bitwise acceptance test on an
external builder, then qualify the composed integration head. Keep the separate
Sprite-return refusal and other failures visible. General preservation/editing
of arbitrary reference annotations in Blocks and Code remains a separate GUI
work item: define a serialized declaration contract, expose its editor controls,
and test editing, save/reopen and MakeCode roundtrip without treating annotations
as initialized-value evidence. This narrow repair does not implement that work.
Conflicting explicit primitive constraints are retained and now produce a clear
export refusal for a dormant flags receiver. Tests also revoke the old proof when
an already-exported project gains a caller or formal writer. The parameter lane
claim scopes the separately observed dormant Sprite return/local declaration
losses for a future owner; those overlaps require release before implementation.
The last raw census remains 147 translated / 36 partial / one parse failure out
of 184; source tests alone change no completion count.

## 27 October: current checkpoint and next actions

Start with [the frozen checkpoint and ordered continuation tasks](ARCADE-CHECKPOINT-2026-10-27.md).
It identifies the pushed source branch, publication/qualification boundary and
complete next steps; older sections below retain detailed history.

Readonly startup Number operands are implemented in the source candidate.
The focused cohort passes 31 tests without skips, with eight neighboring domain
controls passing separately. Three independent guard cuts detect missing
writer, entry-order and operand-domain checks. The unchanged snake project now
has four export refusal families instead of six: Array item, indexOf, mutation
and native addition. The raw census remains 147 translated / 36 partial / one
parse failure; no application completion is inferred from these source results.

The [conditional Array readiness scope](../lanes/2026-10-27-arcade-conditional-array-entry.md)
([merged claim #1464](https://github.com/CrispStrobe/brickwright/pull/1464))
also has a first source implementation. Its 13 groups pass, including two export
reimports, both public routes, Code reconstruction, writer/caller/branch
refusals and permanent expiry. The combined Number/Array/math cohort has 44
passing tests without skips; 41 existing local-reset/private-prefix tests pass
separately. Five independent cuts detect lost branch selection, complete-writer
census, registration order, literal-prefix admission and literal-operand guards.

`project-conditional-array-entry.js` privately follows finite literal startup
assignments, zero-argument ordinary calls and selected branches from unknown
initial cells. It returns an actual inventoried publication writer, while the
old producer, compatible-writer and initialization checks remain mandatory.
Paint registration must be the terminal statement of the direct source chain;
source decisions after registration cannot assume callbacks remain dormant.
The first profile refuses loops, unknown SDK effects, parameterized/value
callees, competing unexecuted writers and paint-reachable publication writers.
It grants no element-presence, generic Number or actual-run result.

Repeated export also revealed a separate local capture issue: a real null reset,
then a literal `0 + 0` assignment to another local, then the Array overwrite.
The authority now crosses only exact numeric-literal addition trees with safe
own-frame writes. It retains all actual statements and checks the used prefix
before diagnostics and after observers; variables, String operands, calls,
malformed ownership and observed prototype changes cannot borrow that proof.
This changes neither the source-start reset service nor runtime behavior.

**Next implementation work:** the unchanged snake still has the same four
refusals after this first Array profile. Extend the initial proof with separately
proved effects for its real SDK operations, ordinary value/parameter helpers,
and loop normal continuations. Do not simply add opcode names to a whitelist:
retain argument evaluation, actual callees, exceptions, control-state writers,
registration and unknown-effect boundaries. A compatible later Array publisher
needs its own complete occurrence coverage. Then prove receiver lifetime and
element presence across repeated unshift/pop; Array readiness alone does not
establish head values or permit downstream native addition.

The hosted-only `test/makecode-startup-number-roundtrip.test.mjs` and
`test/makecode-conditional-array-roundtrip.test.mjs` are written and syntax
checked; actual SDK/native and visible Blocks/Code/graphics/controller acceptance
remain pending on the final combined head. Their callback-only witnesses must
execute, and same/fresh VM SB3 reloads must preserve actual values. Historical
sections below retain prior observations and limits; they are not fresh
qualification. No new application completion or raw-census change is claimed.

## 26 October: forward-fix integration candidate

The integration under [the merged scope](../lanes/2026-10-26-arcade-forward-integration.md)
preserves the operator-approved Array source-bitwise conversions, exports
uncalled ordinary helper bodies, and retains the numeric GUI's music-tempo
refusal example. The original score fixture remains separate from its explicit
completion-observation variant. PR #1416's green checks qualify its reviewed
head; they do not qualify the subsequent combined source candidate.

The candidate follows parameterless Sprite-alias getters through their actual
immutable bindings. A straight-line scalar prefix needs independent primitive
writer proof; the single final alias return and complete caller census remain
required. Every writer and every known call must satisfy the
creation frontier. Early calls, null alternatives, escaping or exported getters,
managed-method entries and callable entries cannot borrow that authority.
The complete body and original receiver/RHS evaluation remain emitted. Fixed
Sprite flags reads are entry-neutral only inside the existing closed physical
project census; unknown dispatch still prevents dormant-body discharge.

Flags reads now use the same actual receiver provenance with a separate closed
primitive domain: Number, String, Boolean, null or Undefined. They supply no
Number-only, Array or initialization authority. Every flags writer must preserve
that domain. Native bitwise result cycles have a separate Number-or-Undefined
anchor, while each operation keeps its operand gate. Source controls cover all
seven existing writable-flags profiles through direct and JSON export, plus
compound-addition reimport with both effectful functions retained. The unchanged
native profiles still require hosted execution to prove trace 12 and final
flags 2.5/5; source acceptance alone does not prove their runtime order.

Math selectors never establish Number by themselves: min/max and equal-bound
randomRange can return connected values unchanged. Number consumers retain the
independent operand/current-result checks. Native subtraction and multiplication
also receive no blanket Number badge, since native coercion can retain BigInt.
Unknown addition results retain their diagnostic instead of gaining permission
from an unrelated Array. Project reopen preserves reference kind/id without
reviving a per-run Array body; held-live-body ownership remains separately
covered by the Arrays native controls.

The published predecessor passed 138 source-only tests without skips: 39
Image/domain/reset controls, eight direct/JSON Image export controls, 17
source-start/frame controls, 38 flags/boundary controls and 36 existing
roundtrip controls. These results do not replace the pending hosted SDK, VM
and browser qualification or promote a corpus application. The last measured
184-input census remains 147 translated, 36 partial and one parse failure.

The next candidate also repairs the shared extension test loader's missing
frame-delta module while retaining the installed-module identity checks. Its
successful export publication rechecks the actually consumed private prefix
after resource callbacks. Source tests retain the original late-mutation
regression and enforce permanent expiry. These repairs need final hosted
qualification; earlier green results cannot qualify a later head.

The [accessor/Sprite repair](../lanes/2026-10-26-arcade-accessor-sprite-addition.md)
is implemented in the next source candidate. Accessor receiver readiness now
requires complete implicit getter/setter edges with exact concrete receivers,
callees, shapes and actual argument cells; inherited halves, compound writes
and updates use the real dispatch. The existing Sprite invariant follows exact
controller registration after construction through every actual ordinary
caller, including emitted numeric events and source-entry callbacks. Lifecycle
callbacks and unknown entries remain separate refusals. Seven accessor and
five controller source groups pass; three guard cuts are detected. The original
inherited-class and whole text-game positives remain unchanged, and their
source exports are clean. Original SDK/native and connected editor qualification
remain required before these gaps can be reported closed.

The pin-history candidate now distinguishes three exact frozen executable
admission fields through a [source-bound inventory](receipts/frozen-control-pin-admissions.json).
It validates the complete regular file, mode, tracked Git blob, bytes and one
constant-token span independently of ordinary scanning. Only a shipped previous
pin of the exact supplier gains that historical role. All remaining code still
requires current pins; copied paths, extra active tokens, invented supplier
commits and changed frozen source refuse. The controllers themselves remain
byte-identical, including their old-candidate admission guards. This policy
does not qualify current dependencies or grant a new execution. Hosted policy
qualification is still required on the final integration head.

Continue in this order:

1. Qualify the implemented [Image-origin addition](../lanes/2026-10-26-arcade-image-nonarray-addition.md)
   and [source-start Image effects](../lanes/2026-10-26-arcade-image-startup-effects.md)
   in the final hosted candidate. The complete factory-based Image fixture and
   its Array-free sibling pass two direct/JSON source generations. Every normal
   observation, actual caller and source revision is checked independently of
   annotations or the general graph's nominal tags. Original operations choose
   original branches; Number-only zero projections are never executed as values.
   Unrelated flat primitive/Image lists do not affect the Image certificate.
   Mixed Image/Array addition remains refused. Actual authored Image.join
   helpers retain their import refusal; ordinary-body selection is export-only.
   The reset proof retains genuine Array producers and every reaching writer.
   Source declarations only bind metadata, including Any; they supply no value
   or readiness. Direct mutable export uses a descriptor-checked private JSON
   context without changing callback receivers. All used Array proofs are
   rechecked after callbacks; getters, toJSON hooks and shared physical objects
   cannot manufacture that context. Source controls do not qualify runtime.
2. Qualify the combined exact source head in hosted six-shard unit, actual VM,
   original SDK and affected editor/controller/save-reopen checks. Reuse retained
   originals once. Check flags compound assignment's single receiver/RHS order,
   duplicate-procedure diagnostics, source Array bitwise, score callbacks and
   frame/math results. Keep fresh capture availability separate from semantic
   refusals. Do not infer runtime success from the source-only checks.
3. Reobserve the valid ordinary-call corpus case against that qualified head.
   Diagnose its actual callee identity, arguments, defaults and entry order;
   preserve the body, caller effects and actual constraints. This needs a new
   merged claim if its files extend the integration scope.
4. Address the snake game's remaining startup scalar and conditional Array
   producer refusals, then Array.map/Throw and stopwatch/SDK contexts. For each,
   retain original source, match actual producers and all writers, and test
   Code, Blocks, graphics where applicable, export/reimport and fresh reopen.
   Promote an application only after observable execution matches its original.

**Costume-backed Image banks: source implementation complete; runtime pending.**
The scope is [source-entry bank effects](../lanes/2026-10-26-arcade-source-entry-image-banks.md).
Use the exact first source fixture in
`test/makecode-arcade-image-values.test.mjs`, replacing only
`image.create(2,1)` with an `img` literal containing two colour-5 pixels. The
actual Creator import, SVG upload, export, reimport, new SVG upload and second
export now pass through both direct and JSON routes. The private effect proof
tracks real allocation, ordered Image pushes, global publication and sealing
before the unique startup. A literal, finite in-bounds index transports only
its selected element's effect; every alias and writer remains relevant.

Frame-index arithmetic has an independent all-normal primitive observation
proof over original operations. It does not expand the Number API or grant
Array initialization. Callable pixel results use the existing complete
class/closure producer and observed original Binary additions; Arrow metadata
is retained through the established metadata parser profile. Uninvoked,
incompatible and escaping calls cannot borrow that fact. Observed source
changes permanently expire a consumed proof, including after restoration.

`test/makecode-arcade-image-bank-roundtrip.test.mjs` retains all 20 original
observable values and alias/clone identity checks. It requires three native
generations through both export routes, SDK compilation of each export and
fresh SB3 reload. This test requires hosted execution; source acceptance is
not that qualification. The separate Array-free fixture retains Any arithmetic
operands but uses typed Image receivers for native pixel methods. Its earlier
Any-method original-SDK failure must not be reported as an exporter failure.

**Image GUI acceptance remains open.** In visible Blocks and Code, build an
Image, clone and alias it, place it in an Array and connect native value-add
reporters. Exercise the same operations with a real costume-backed image, edit
its pixels in the graphics editor, and use a controller button to mutate a
pixel. Compare alias/clone pixels and addition values with original MakeCode;
export/reimport and reopen the SB3 in a fresh context. Reuse the existing
authoring browser harness. Source creation through VM APIs alone does not prove
this editor journey, and the bank runtime qualification must close first.

**Focused GUI task after runtime qualification:** reuse
`test/fixtures/arcade-writable-flags-roundtrip.mjs` to author a Sprite and raw
Number/String/null/Undefined flags in visible Blocks and Code. Connect a flags
read through arithmetic and bitwise reporters; edit a receiver/RHS function;
verify the unchanged fixture's trace and final values. Change its artwork in the
graphics editor, use the controller pane, and save/reopen in a fresh context.
Compare actual Lite execution with original MakeCode before promoting this
capability's GUI acceptance. Reuse the existing authoring browser harness and
record this as an additional bounded journey; do not infer it from numeric-menu
checks or from a program inserted only through VM APIs.

A fresh 26 October census of the unchanged 184 inputs still measures
**147 translated / 36 partial / one parse failure**, with identical diagnostics
and no input mutations. It uses the same importer/Creator observer and original
input hashes. The accessor, controller and Image-bank source repairs address
export and roundtrip boundaries; this import-only census does not measure those
repairs. No new corpus completion follows from this integration alone. Keep
invalid original snippets and recovered dependency contexts distinct from this
unchanged raw-input measurement.

## Recovered-input subset: keep source and reference evidence separate

Six additional prepared input sets were recovered from retained bytes. Their
project metadata was reconstructed only where the complete bytes matched the
recorded prepared-file hash, using the original project and retained palette;
no missing dependency source was invented or fetched. Together with the three
already complete sets, nine prepared input sets are now available. This is
input recovery, not a new preparation-provenance or execution qualification.

The six newly recovered sets have a fresh source-only result of two translated
and four partial, with unchanged inputs. The snake case is now translated in
this prepared view too; its six export refusal families remain open. The other
translated case was already translated in the earlier prepared report. This
subset cannot replace the historical complete 37-context census or promote a
game. A combined check of the three previously complete projects exhausted the
unchanged local source CPU budget and produced no report; the isolated tiny
project still refuses its projectile's source Sprite. Qualify larger cases on
an admitted hosted path rather than increasing local limits or treating a
resource failure as a semantic refusal.

The four newly reobserved partials use receiver-level `sprite.onOverlap(handler)`.
Their exact retained main sources also have failed original-compilation records.
Those are saved lineage, not fresh current-SDK results. Keep this historical
receiver API distinct from supported `sprites.onOverlap(kind, kind, handler)`.
Before claiming legacy compatibility, establish the actual historical API and
its callback, receiver-capture and lifetime semantics, then scope native Blocks,
Code and modern export behavior with original/native evidence. Do not clear
these diagnostics by dropping their callbacks or relabeling the inputs.

## Image addition and CI bootstrap follow-up

The unchanged owned Image-values whole-program fixture still exposes an export
refusal on an initialized Image operand. The scope in
[the Image-origin claim](../lanes/2026-10-26-arcade-image-nonarray-addition.md)
requires a separate all-observations origin proof and complete non-Array helper
caller checks. An Image on one visit does not prove every later visit; an
unrelated Array has no authority. Mixed Image/Array addition through one helper
must remain explicit until safely specialized. Preserve the existing original
SDK/native fixture and its identity, mutation and round-trip assertions.

The Tauri test bootstrap now reuses the existing official Ubuntu mirror helper
from the repository root before its unchanged package installation. Five source
policy controls pass, including a wrong-working-directory negative. This aligns
workflow policy; it neither diagnoses a previous slow install nor establishes a
speed improvement. The final integration's enabled hosted checks remain required.

## 25 October: latest complete source census and next boundary

The latest complete unchanged 184-input import/Creator census measures
**147 translated / 36 partial / one parse failure**, using the same observer
and input hashes. The repair that reduced 146/37/1 to 147/36/1 changed only the
retained snake-game primitive-caller case. A fresh census after composing the
frame/math result candidate still measures 147/36/1, with unchanged diagnostics
and no stage regressions. The earlier sorting repair changed 145/38/1 to 146/37/1.
This is source conversion, not SDK/native execution or completed applications.
Earlier measurements below are historical and must not replace this result.

The sorting case also passes targeted current JSON export with every authored
procedure retained. Independent controls cover Code, three JSON generations,
SB3 reopen and a separate loop/math conversion. See the
[execution-root implementation scope](../lanes/2026-10-25-arcade-closed-ordinary-entry.md).
Keep final exact-head SDK/native/editor qualification and dependency-context
measurement separate. Coordinate the active publisher and its once-only current
CI intake before publishing a successor; never repeat an acquired original.

The primitive-caller discrepancy is now diagnosed and repaired for import.
Lowered post-test loops split writes and reads across correlated guards. A
finite local control-cell proof preserves occurrence readiness without deleting
real Undefined writers or granting generic initialization/Array authority. The
emitted form also needs genuine strict predicate-helper recognition, pure
constant expressions and an independent numeric math-result inventory. See the
[implementation scope](../lanes/2026-10-25-arcade-emitted-guard-math-consumers.md).

The unchanged full post-test fixture passes Code, two JSON generations and SB3
reopen with all four actual variable writes. The composed source cohort has 43
passing controls; a separate six-control math cohort includes a real connected
String refusal. Counts overlap. Six source and four project guard cuts are
detected. This qualifies source boundaries, not SDK/native or visible editors.

**Readonly startup Number candidate:** the [merged scope](../lanes/2026-10-26-arcade-startup-number-operands.md)
now has a source implementation. `project-readonly-number-operands.js` proves
only actual arithmetic occurrences from readonly startup cells: physical cell
identity, complete writers, dependency order, every ordinary caller and paint
registration must agree. Earlier null/Undefined resets require a definite
numeric overwrite before use. No annotation, parameter label or arithmetic
output signature establishes a Number operand. Direct live export uses its
existing descriptor-checked private data copy, retaining original artwork
callback objects and rejecting changed source before publication.

The unchanged snake project now has four export refusal families in a bounded
source probe, down from six: Array item, indexOf, mutation and native addition
still refuse. All six procedure bodies and original writers remain. This is
neither a completed game nor a change to the 147/36/1 raw census. Unknown roots,
conditional or later writes, early registration, cycles, direct arbitrary
variable-to-Math inputs and ambiguous emitted bindings remain refused.

Run `project-readonly-number-operands.test.mjs` with the existing math-consumer
source controls. The hosted-only `makecode-startup-number-roundtrip.test.mjs`
requires the complete pinned original Arcade runtime and Lite VM: both export
routes, three generations, actual values and same/fresh VM SB3 reload. Do not
count a written test as a pass. Original SDK/native and visible-editor
qualification remain pending for this combined candidate.

**Separate remaining name-binding task:** ordinary locals/formals can collide
with an escaped global (`image` emits `image_`), a sprite-local cell (`w` on
Game emits `Game_w`), an SDK anchor (`Math`, `randint`, `screen`, `music`) or a
generated arithmetic helper (`__bwBinarySubtract`, including allocator suffixes).
Fixed SDK anchors must also be protected from emitted global-cell names; stock
random blocks call bare `randint`, whereas generated arithmetic helpers have
their own collision allocator. Compare the actual escaped emitted name.
The new Number issuer refuses these ambiguous bindings. Proper general support
requires hygienic allocation in `export-arcade.js`: bind declarations and every
reference to actual local/formal/cell identity, reserve SDK/generated symbols,
and rename consistently across nested scopes and procedure calls. Claim that
separately before editing the shared formatter. Retain complete bodies; do not
resolve a collision by dropping a declaration. Add source positives and shadow
negatives, then original SDK/native, Code/Blocks edits and fresh SB3 roundtrips.

The retained complete-context ordinary-call case also still refuses unchanged
callee proof. Its original reference compilation succeeded; the raw snippet's
missing extension/song diagnostics are a separate measurement. Inspect computed
Array reads, their actual allocation/alias flow, initialization and incompatible
Image element constraints. Retain dormant neighboring bodies and ambient/dynamic
callee-replacement negatives. Do not globally permit computed access or remove
the complete unchanged-callee census to clear this case.

**Editor acceptance remains open:** visibly edit min/max/atan2/randomRange
operations and operands in Blocks and Code, execute original/emitted MakeCode
and Lite programs, drive controllers, and save/reopen in a fresh context. The
current numeric proof starts with closed Number reporter trees in frozen JSON;
variable/parameter/captured operands remain conservative. Native do/while
authoring is separately scoped below.

## Frame-delta source, saved-project and runtime result candidate

The actual `game.eventContext().deltaTime` read now has a bounded source
producer inventory, and the exact saved reporter supplies its independently
proved Number result to scalar and caller flow. The unchanged full Code, two
JSON generations and SB3 journey passes. Malformed reporter fields, inputs,
socket roles, fallback shadows and ownership are named/refused; legacy live
expression export stays available without gaining immutable-project authority.

A separate actual-result service binds the original extension, adapter, empty
declaration, current state/scene, cached operation and completed Number result.
It preserves the original property read and `value || 0` fallback, refuses
text/accessor/nonfinite or substituted/stale state/results, and never treats a
metadata flag as execution. The claim is only the Number domain; an externally
assigned finite Number does not certify its elapsed-time origin or accuracy.
See the [exact implementation and qualification scope](../lanes/2026-10-25-arcade-frame-delta-number-abi.md).

The available source/synthetic owner cohort has 83 passing controls and five
detected guard cuts. The final source/project/math cohort has 23 passing
controls, overlapping the earlier 73-control source composition. Four project
and three source cuts are detected. Six engine-reader checks remain unavailable
locally; the new actual VM test is written and syntax checked, with actual
execution still pending on the final hosted head. Visible Blocks/Code edits,
controllers and fresh editor reload remain pending. These are not application
completion counts and do not replace the 184-input source census above.


## Remaining-input taxonomy and independently scoped next tasks

The 36 raw-source partial rows are not 36 established missing core APIs.
Twenty have exact matching recovered project contexts containing the named
resources; their historical canonical results were 13 translated, four parse
failures, two partials and one unavailable observation. These complete projects
must be measured separately without replacing the raw inputs. Four other
snippets use instance `Sprite.onOverlap`; all four retained original compiler
results reject that property in their recorded device-only projects. A valid
historical API or missing extension has not been established. Preserve these
input errors instead of inventing runtime semantics. The remaining twelve rows
need their original source/dependency context assessed individually.

A current follow-up of the thirteen formerly partial canonical contexts
completes twelve with unchanged partial diagnostics; one hits the fixed CPU
budget. It is unavailable, not translated or parse-failed, and these observations
do not constitute a fresh complete canonical census. An early, separately
bounded source-only sample does not establish the slowdown's full cause. Keep
both failed observations and all limits; do not raise the budget to get green.

| Next task | Implementation boundary to claim | Required evidence |
| --- | --- | --- |
| Math operands derived from startup scalars | Extend the independent producer proof behind `project-math-normal-results.js` with exact actual readonly startup writers, dependency order, all entry points, current physical binding and per-occurrence availability. Keep `scalar-export-flow.js` annotation inference separate from authority. | Real initialized writers and safe Number arithmetic qualify; omitted initialization, later writers, reentry, monitor writes, cycles, reference/BigInt/coercion and annotations alone refuse. A subtraction is not unconditionally Number: actual Arrays values can carry BigInt or effectful objects. Preserve original evaluation and errors. |
| Conditional startup Array allocation | Review `array-source-start-reset-effects.js` and `array-reference-export-authority.js` for the exact scalar branch and callee/effect/registration boundary. This is missing proof of actual startup order, not an observed uninitialized runtime Array. | Prove every read's allocation and complete compatible writers across branches, pauses, errors, callback registration, Stop and unknown effects. Keep actual resets and all body operations unless their prior value is genuinely unreachable. Validate original/emitted MakeCode and Lite execution. |
| Event-context frame delta source result | Source and result candidates are implemented under the [merged result scope](../lanes/2026-10-25-arcade-frame-delta-number-abi.md); qualify the final hosted head. Keep existing clock and info inventories independently bounded. | Exact actual SDK/lexical read, full relevant namespace/result-use census, real mixed-writer refusals, Code/JSON/SB3 and final actual SDK/native/editor controls. Do not claim this alone explains the snake game's addition refusal. |
| Bounded source-analysis cost | Locate the expensive phase from retained failures and bounded diagnostics before claiming a repair. Retain source proof currentness and every fact/threshold. | Same-input qualification within the original limits, unchanged refusals, and proof that any optimization cannot publish a stale or unproved fact. An unused-proof dependency cleanup has not resolved the measured CPU failure. |


## 25 October: fresh source census and SDK scalar repair

The subsequent four-shard run at
[`3fb45ce3`](https://github.com/CrispStrobe/brickwright/commit/3fb45ce31ff38bfdaeecaf2afc4e3106f1bf3f2d)
has 65 failures, compared with the earlier 70 below. Six actual failure titles
disappeared and one appeared; inspect each retained failure rather than treating
the net reduction as proof of a particular repair. Its numeric-authoring job
passed five reports covering 29 journeys. The optional clean-export capture
remains `UNAVAILABLE_FRESHNESS` / `OBSERVATION_MISSING`. These results qualify
that head's observed boundaries, not the later composed source candidate.

The new implementation follows the
[merged Image consumer ABI scope](../lanes/2026-10-25-arcade-image-consumer-abi.md).
The unchanged SplashDialog test reaches exported MakeCode execution and fails
inside generated startup. A source reconstruction shows Image aliases emitted
as `any`, but does not establish the exact failing expression. The same required
exported-PXT invocation now observes its compilation and, on failure, reports
hashed inputs and bounded generated-code context. It neither retries the guest
nor changes assertions. Prove actual current Image receivers before introducing
Image interface context; preserve writable fields, alias generations across
resize, early-read refusals and the original zero/negative allocation matrix.
Fourteen complete source controls and the composed 37-control cohort pass;
five guard cuts are detected. Actual current model identity, constructor and
parent records, physical socket ownership, source currentness and all relevant
writers gate the new context. One closed synchronous source start is supported;
unknown entries/effects decline the proof. Existing typed Image exports keep
their original emitted form. Final actual SDK/native/editor qualification is
pending; these controls do not establish that the old runtime crash is fixed.

The fresh baseline at `468f97a625c8065ea791047ddfb319563094be4e` measures
**145 translated / 38 partial / one parse failure** on the unchanged 184 raw
inputs. These are import-and-Creator classifications, not completed games.
The 37 companion contexts preserve the same selected main sources and measure
9 translated / 28 partial without dependency preparation. Do not call every
companion context a complete tutorial or replace a hint with starter code to
improve the count.

The canonical catalogue additionally supplies 41 retained root/dependency
contexts: 40 were observed (20 translated / 13 partial / seven parse failures);
one exceeded the unchanged source-execution bound, including when isolated.
Among the 29 observed contexts with historical original compiler successes,
19 translate, four are partial and six fail parsing. Those original compiler
results are retained evidence, not new SDK execution. Current runtime,
full-project equivalence and visible authoring remain separate gates.

[The merged scalar-proof claim](../lanes/2026-10-25-arcade-sdk-scalar-addition.md)
now has an implementation candidate. It removes the unsafe ordinary-addition
fallback for Opaque producers and proves Sprite position/motion results from
actual factories, aliases, writers and entry order. SDK-returned Arrays and
unknown producers remain refused. Canonical null resets require construction
before every use; no nullable binding-wide Sprite or Array authority is issued.
Unrelated primitive arrays do not invalidate the private Sprite slice.

The original 44 affected source controls pass across five complete cohorts.
The latest complete scalar composition passes 15 groups, retaining the existing
positive and negative programs and adding actual writable-field counterexamples.
Current export represents an omitted Sprite kind with explicit genuine
`undefined`; both calls have the same retained SDK behavior. The narrow factory
proof now accepts that form while refusing a shadowed spelling. This grants no
Kind value or initialization fact. Two cuts detect the default and shadow guards.

Descriptor declarations cannot independently prove primitive field contents:
the SDK z setter stores its input unchanged, and lifespan is writable. Their
String writers must not acquire Number authority. Further primitive Sprite
fields and Image.getPixel normal results need separately scoped actual-owner,
argument/effect, alias/writer and currentness proofs before admission.

Two original guard mutations were detected. The source journey covers connected property
blocks, Code, own-asset SB3, fresh export/reimport, an edited position and edited
pixels. It does not establish actual browser or SDK/runtime qualification.
Final composed hosted checks and affected actual authoring remain pending;
preserve the current original CI failures and terminal numeric intake before
publishing a successor.

The atan2 claim and both follow-up Number-consumer claims are merged. The
binary-math vocabulary landed upstream in
[sb3-creator #167](https://github.com/CrispStrobe/sb3-creator/pull/167), after
459 source checks, two meaningful mutation cuts and all enabled hosted checks.
Lite adopts that exact supplier through normal sync. The candidate adds radians,
argument-order and non-finite/signed-zero controls, current export, Code and
saved-project journeys, and a visible Blocks menu edit followed by restoration.
These new Lite runtime and browser controls still need final-head qualification.
The strict SPIKE supplier guard is updated under its separately merged scope;
the complete unchanged artifact module passes at the adopted pin. This does
not qualify SPIKE guest, firmware or hardware behavior.

The whole source journey exposed a separate startup reset boundary. The
[merged reset-proof scope](../lanes/2026-10-25-arcade-source-start-reset-effects.md)
adds a bounded execution-order analysis for closed startup/value procedures.
It can discount an unreachable null/undefined reset; it grants no Array,
initialization or caller-type authority. Keep unknown calls, early observations,
competing entries, references and changed-source negatives. The full atan2 source program passes JSON export, emitted-file reimport,
current Code and own-SB3 source journeys. Live-object export does not acquire
the JSON-only proof. Further nested export wrappers remain a separate frontier
until demonstrated by actual tests.

The [merged scalar Any-consumer scope](../lanes/2026-10-25-arcade-any-scalar-consumer.md)
addresses independently produced primitive values rejected against a consumer's
`any` annotation. It returns the actual value unchanged and preserves generic
and concrete-consumer checks. Fourteen complete source controls and four
meaningful mutation cuts pass, including the unchanged Image/class fixture
through Code and export/reimport. Hosted runtime qualification is still required.

The active score-callback candidate also fixes numeric editor-shadow ingress:
registration reuses the existing shadow-aware numeric adapter while connected
String/reference values stay refused. Seven source controls and two meaningful
cuts pass. These finite source-method controls do not execute the HUD SDK
algorithm; the unchanged actual original/native score journeys still qualify
registration, suspension and Stop independently.

The [merged score observation scope](../lanes/2026-10-25-arcade-score-completion-observation.md)
also has an implementation candidate. The exact raw owned fixture is retained;
an explicitly named observed variant changes only its auxiliary completion
marker, with false initialization before the unchanged game core and a true
assignment afterward. All existing runtime assertions, genuine main-completion
requirement and timeouts remain gates. The same required compilation checks
that both marker stores exist. Nine source controls and three meaningful cuts
pass; actual SDK/native qualification is pending. A successful observed variant
would not establish that the raw fixture completed or explain its historical
timeout; the retained failure did not observe main completion separately.

A repeat scan of all unchanged raw inputs on the composed source candidate
still reports **145 translated / 38 partial / one parse failure**. All five affected dependency contexts now import without the missing-atan2
diagnostic. Their overall source status remains four parse failures and one
partial because other diagnostics remain; an API repair does not count those
applications complete.

The [SDK constructor-effects scope](../lanes/2026-10-25-arcade-sdk-constructor-effects.md)
now has a source candidate. It proves individual captured/field/method primitive
occurrences from actual closed constructor effects, while keeping generic SDK
ancestry exclusions. It follows parameter-property stores, then field
initializers, then the original body, as emitted by
[PXT 13.2.1](https://github.com/microsoft/pxt/blob/v13.2.1/pxtcompiler/emitter/emitter.ts#L3060).
Canonical registration, Image/hitbox aliases and later SDK stores are audited;
facts remain conditional on normal SDK return, with no completion guarantee.
Reserved SDK slots cannot bypass refusal through the older projection.

The constructor module now has fifteen source controls. The earlier 99-control
source cohorts, twelve guard cuts and final composed 38-control SDK/Image/score
cohort pass; these cohorts overlap and are not additive. Actual Code constructor
argument and SVG edits, two source export/import cycles and owned saved-project
routes pass. An exploratory third live-object export reaches Array read/mutation
refusals; the equivalent three-stage owned-JSON discriminator passes on the
same projects/assets. The GUI and journey already use that API. This case is
an admission distinction, not an established Array implementation gap.
Broader SDK callbacks/setters remain outside this slice. Actual
original/emitted PXT, native execution and visible editor qualification remain
pending; no additional corpus completion is claimed.

The [closed ordinary-entry candidate](../lanes/2026-10-25-arcade-closed-ordinary-entry.md)
now retains uncalled procedure bodies while excluding only their runtime call
edges from ordinary constraints and Array effect analysis. Its source proof is
lexical and current; project authority requires a genuine frozen JSON snapshot.
Unknown entries, aliases, callbacks and unsupported shapes keep existing checks.
Actual storage writers prove only entry neutrality, never Array initialization.

Twenty-one composed source controls pass, including Code reconstruction, three
JSON generations, SB3 reopening and an independent looping/math case. The
seventy-five-control source cohort and the composed controls overlap. The
retained sorting source imports and reconstructs cleanly, and its retained JSON
now exports without unsupported diagnostics with every authored procedure still
present. A new bad live caller restores the Number refusal. Preserve all earlier
failures and detected guard cuts. Native helper bodies and call inventories were
not changed. Actual original/emitted MakeCode, native execution, visible editors
and a fresh aggregate census remain pending; the last full census is unchanged.

The retained four-shard CI baseline at
[`8e7691ad`](https://github.com/CrispStrobe/brickwright/commit/8e7691ad713fce0922a5558f3998c8e98c2b09d5)
has **13,191 passes, 70 failures, 19 skips and 37 TODOs**. Forty-nine failures
are native-addition groups; 21 have separate causes. The baseline numeric job
passes five reports covering 29 finite journeys. Its optional clean-export
freshness capture is unavailable. These are retained baseline results, not
qualification of the current fixes.

## Current qualification — 24 October 2026

Start with [the current results and task order](ARCADE-COMPATIBILITY-NEXT-STEPS.md)
and [captured class primitive work](ARCADE-CLASS-CAPTURED-PRIMITIVES.md).
Older sections below retain historical results; they do not describe the current
candidate or authorize reusing another head's test results.

The completed four-shard baseline has **12,463 passes, 147 failures, 19 skips
and 37 TODOs**. The later hosted numeric-authoring job passes five journeys;
its optional clean-export freshness observation is unavailable. Source controls
for native-frame reset and custom-kind binding pass eleven and four groups
respectively. These results cover different heads and boundaries.

The [current class candidate](ARCADE-CLASS-CAPTURED-PRIMITIVES.md) corrects
primitive addition unions and proves captured reads from actual producers and
writers. Its complete six-group module passes at
`7f08e871ad3c76929282787092270b1b09158744`, including the full inheritance
export/reimport and Code feedback journey. Actual method entry, formal input and
source-order temporary alias proofs remain private and separate from global
capture declaration readiness. The separate complete class-scalar, lineage and
union run passes fourteen groups at that same source head. Remaining affected cohorts, mutations and
hosted runtime qualification remain pending. Keep the original failed runs
and program.

Historical **147 translated / 36 partial / one malformed** application counts
remain unremeasured. No component result, passing corpus guard or source-only
conversion changes those counts. Final composed hosted checks, actual MakeCode
execution and visible authoring journeys remain required.

## Recursive Number capability — complete source controls pass

[PR #1213](https://github.com/CrispStrobe/brickwright/pull/1213) merged the
exact new proof scope after all four enabled checks passed. The integrated
candidate keeps generic cyclic `Opaque` facts and all preceding refusal gates.
Read [the capability and acceptance contract](ARCADE-NUMERIC-RECURSIVE-RESULTS.md)
and the Image/recursive authoring rows in the
[GUI ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md). Source eligibility,
original/emitted SDK, native execution, fresh project reload, actual authoring
and application accounting are separate gates. No recursive application is
counted complete yet; preserve the previous function-return failures and the
unmeasured historical 36 partial applications.

The complete source cohort passes **55/55**: all preceding 47 controls and all
eight new groups, without skips, TODOs or raised limits. The original complete
twelve-test native/SDK module and visible authoring gates remain pending.


## New hosted checkpoint — 22 October 2026

Read [the latest repair observation](ARCADE-CI-REPAIR-STATUS.md) first. The next
hosted unit run reports **12,160 passes / 168 failures**: thirteen old failures
resolved, zero newly failing titles. SPIKE power11 and Robot Lab groups pass;
legacy SDK controls improve to **31/32**, with mixed Array forwarding still
refused after exact-file reimport. The earlier run omitted its typing captures
and was incorrectly attributed to initial export. The next candidate now retains
those captures: initial export, Code feedback and exact-file import pass, then
second export refuses mutation/indexing Array producers. Diagnose the actual
second project and its writers; preserve the earlier missing-data limitation.

The standard build passes; numeric authoring stops at an open actions menu
intercepting a report click. The source repair uses the real summary and retains
all assertions. The complete candidate still needs qualification; historical
**36 partial applications remain unremeasured**. Next conversion capability is
[the bounded recursive Number proof claim](https://github.com/CrispStrobe/brickwright/pull/1213).
That scope has merged; preserve generic cyclic refusals and
track Code, Blocks, fresh reopen, actual export/compiler and graphics journeys
separately. No additional manual build dispatch or `ci:full` label is needed.

## Earlier qualification and continuation — 2026-10-22

Read [the current CI repair matrix](ARCADE-CI-REPAIR-STATUS.md) before the older
checkpoints below. The complete hosted F9 run finished, rather than remaining
pending: its ordinary unit shards report 12,103 passes and 181 failures. The
complete legacy SDK module has 30 passes and two failures, with its genuine
original/emitted compilation group passing. Native Array, CLI, word and bitwise
control cohorts pass. The historical **147 translated / 36 partial / one
malformed** application census has not been remeasured.

Main's school/SPIKE repair is now normally composed locally, retaining the
Arcade additions and compiler capabilities. Its compiler selection is a D7
descendant with identical compiler source; the x86 consumers match the current
selection and actual execution remains disabled. Earlier hosted controls do
not qualify the new composition. The incoming motor implementation removes the
measured eager import chain and restores the historical manual percent-speed
route, but the unchanged initial-JS budget and affected browser checks must
measure the final result.

Continue in this order: finish strict menu-companion proof; correct the scoped
failure witnesses and diagnostic capture; qualify one complete integration
candidate; inspect actual remaining operands; then perform the full corpus
permutations. The [failure-witness claim](../lanes/2026-10-22-arcade-failure-witness-maintenance.md)
is merged. Keep GUI journeys, original/emitted SDK, native execution and corpus
accounting as separate acceptance tasks. Preserve all original failures and
unsupported-element reports. Do not add `ci:full`, duplicate hosted dispatches,
relax budgets or claim application completions from component passes.


### Next semantic work: separate three return failures

The complete [function-return module](../test/makecode-arcade-function-returns.test.mjs)
reports **nine passes and three failures** in the hosted F9 unit run. Each failed
case passes its native/Code checks, then stops at initial export with the native
addition refusal. Exact rejected operands and type facts were not captured;
exported SDK compilation and save/reload are not reached for those cases.
Do not claim that all three have the same cause.

1. **Closed numeric recursion and mutual recursion.** The actual generic value
   graph deliberately adds `Opaque` to cyclic call results and excludes cyclic
   immutable-function facts. Formal parameters already receive actual entry
   initialization and argument propagation; a blanket initialization change is
   the wrong starting point. Claim a new private normal-return Number proof for
   closed recursive call components, with a narrow producer-query/native-addition
   bridge and focused complete controls. Existing numeric claims explicitly
   refuse recursion, so merge an expanded claim first. Keep generic `Opaque`
   intact, preserve real calls and effects, and reject unknown entries, aliases,
   defaults, fallthrough/undefined returns, opaque writers and source changes.
   Prove values on normal return; do not invent termination or replace recursion
   with constants. Qualify actual exported inputs before claiming either case.
2. **Sprite forwarding and numeric properties.** The third case includes
   `sprite.x += 5` and has no source class. The existing class scalar view returns
   early without a class, and the generic graph has no proven Sprite property
   contract. Capture the actual rejected operand first. Any new numeric-property
   fact must join genuine SDK allocations, receiver identity, aliases, every
   writer and effects; a Sprite annotation or field spelling grants no fact.
   Treat this as a separate capability until current evidence links it otherwise.
3. **Alias forwarding through the second owned Array export.** Use the newly
   enabled five-leaf hosted failure capture to inspect current project, draft,
   importer and refusal values. Preserve first/second export stages separately.
   Do not substitute an older capture or weaken initialization/reset checks.

For each capability, extend the GUI ledger with an explicit authoring journey:
Code/pseudocode and connected Blocks, edit an operand or return, save/fresh reopen,
run with the controller/stage, export and compile in MakeCode, and freshly
reimport. Sprite artwork and position edits must affect the game. Source tests
alone do not qualify those representations. The manual Robot Lab control's
Power label also needs a separate GUI scope clarifying its existing percent-speed
mode versus dedicated fixed-duty SPIKE power; it is not physical PWM acceptance.

The menu guard now has ten passing complete controls and a passing production
check on retained hosted JavaScript/HTML. Reporting and overwrite witnesses pass
all 23 complete controls. New-build, affected browser/guest and full corpus
qualification still belong to the final integration head.


## Latest observed state and next work — 2026-10-21

### Latest incremental closure

Closed numeric factories now pass all **39 affected source controls** and
**all eight original native counter tests**, without skips. The two original
export refusals are closed: edited captures and renamed aliases export and
reimport with values 9, 16 and 9. The tested export uses
`callableLexicalPrototype: true`. The bounded source proof preserves actual
calls, Undefined/callable facts, separate activations and unknown-entry refusals.
See [the exact scope and remaining GUI/SDK work](ARCADE-NUMERIC-CLOSURE-RESULTS.md).
These component results do not change historical corpus counts.

Nullable native Array `.length` now has a source-qualified Number result on
normal completion: **31/31 tests across nine complete modules**, no skips.
Null/Undefined receivers, initialization, all writers and strict Array/coercion
APIs remain unchanged. The original 29-pass/two-failure run is retained; the
corrected run includes meaningful canonical-helper selection witnesses.
See [the exact capability and next tasks](ARCADE-ANIMATION-NUMERIC-PRODUCERS.md).

Static fresh-resource emission now passes all **32 tests across three complete
affected source modules**, without skips. It preserves the raw AST API and
fallback paths; the earlier 31-pass/one-fail fixture original is retained.
Closed Image/factory normal results now pass all **47 controls across eleven
complete source modules**. All **three unchanged original animation carrier
tests** also pass: edited frame pixels survive save/reload, actual export,
fresh reimport and fresh VM execution, with no unsupported elements or warnings.
The audit wrapper retains a failed exact metadata comparison because JavaScript
rounds filesystem nanosecond timestamps; independent saved-result review verifies
the exact source identities. This is an observed test success with an audit
serialization failure, not an all-pass wrapper. Retained VM providers differ
from the current raw VM source in three files. Original/emitted SDK compilation,
current installed-runtime and actual editor/browser acceptance remain pending.
No historical partial-app count has been remeasured.


Latest main has been normally composed locally, preserving its new Robot Lab
library, both sides of the scope ledger and the 16-group browser matrix.
This is a source composition, not new hosted acceptance. The published PR
head and historical **147 translated / 36 partial / one malformed** corpus
measurement remain unchanged. See the repair matrix before scheduling CI.

### Local integration follow-up

The preserved Array/class, refusal-report, CLI fixture and SPIKE candidates now
have a clean local composition with the current main and the inert assessment
workflow registration. A source review verified merge ownership, the combined
scope ledger and the tracked importer mirror. This composition has not received
hosted qualification and is not the published PR head described below.

The complete refusal-report cohort passes **15 tests, zero failures or skips**.
Its earlier two fixture failures are retained; their correction did not relax
the product proof. The report provides observed operand facts and the analyzed
draft, while deferred UI updates retain request, revision and VM ownership.
An observed refusal remains a refusal, not a successful application conversion.

The complete genuine metadata generator now returns **615 menu rows**, with
only the SPIKE motor-power row added to the previous 614-row table. Its source
output was adopted whole. The preceding fresh installer exceeded its resource
limit; only its independently checked immutable outputs were admitted for this
subsequent metadata run. Do not call the installer successful or repeat it.
The actual menu CLI check, motor controls and affected guest remain pending.

One complete existing event-game example now passes import, genuine Creator
artwork ingress, actual SB3 save, reopened project/artwork and immutable JSON
export with **zero unsupported elements**. All three SVG references join the
actual saved archive. This is source/save/artwork acceptance; original/emitted
MakeCode compilation, native game execution and browser authoring remain
unqualified for this diagnostic. The earlier observer failure is preserved:
Creator supplies its default Stage asset during save, not in its asset map.
The diagnostic now uses the genuine package rather than a substitute image or
a weakened assertion. This example did not reproduce a native-addition refusal.

The preceding original edited-animation case had two passes and one export
failure (superseded by the three passing original tests above). Exact current export arguments and the returned diagnostic identify
an initialized `count` after `count = frames.length`, with `Opaque` and `Number`
producer facts. Its actual resource context and all original assertions remain
retained. The [next producer work](ARCADE-CI-REPAIR-STATUS.md#readiness-analysis-and-overlapping-power-work)
has a separate merged implementation claim; it must preserve dynamic fallback,
fresh/shared identity, all writers, null and possible missing elements.

Separately, captured lexical declaration readiness now passes all 23 controls
across eight complete source modules. It distinguishes declaration execution
from value initialization and proves complete closed function entries. Real
parser defaults, retained optional signatures, escapes, reflection and opaque
writers cannot acquire authority. The earlier failing originals are preserved.
See [the contract and remaining gates](ARCADE-LEXICAL-DECLARATION-READINESS.md).
This is source-analysis qualification; full SDK, native, browser and corpus
acceptance remain separate. No fresh corpus count is available.

The x86 refresh confirms that PR #1095 is already merged. Current main's SB3
selection is an ancestor of D7; retain the candidate's reviewed D7 compiler
capabilities and its matching consumer fences. Continue from the
[current x86 guide](X86-NEXT-LANES.md#next-finite-gui-composition-and-hosted-acceptance).

The operator-authorized x86 supplier-consumer claim has merged in PR #1193;
its two fixed D7 identities are a local candidate with actual execution disabled
and fresh affected GUI/guest acceptance pending. The school owner has separately
taken over the narrow SPIKE power repair. Preserve our candidate and receipts,
and reconcile with that owner's landed result rather than duplicating it.

This section supersedes older pending-run descriptions below. PR [#1128](https://github.com/CrispStrobe/brickwright/pull/1128)
at `125dacab7e183ca15d08224524b576894480d8b1` has finished all enabled
checks. All three browser groups passed; build and all four unit shards failed.
The repaired source fence passed all 178 controls. This is not a green candidate.

The complete unit logs contain 175 ordinary failures, of which 158 stop at the
native-addition operand-domain guard. A common message does not establish a
common cause: the logs do not contain the actual failing operand facts. The
other failures include bitwise expectations, the public assessment CLI output
layout, SPIKE power opcode/menu adoption, a stale word-table count, and an x86
supplier fence. See [the repair matrix](ARCADE-CI-REPAIR-STATUS.md#latest-complete-hosted-observation--2026-10-21).

Work is preserved in separate candidates. Their presence does not establish
execution, SDK, editor or application acceptance:

1. **Array writers and constructor effects:** the corrected candidate preserves
   actual mixed writer types, rejects missing/null malformed class kind fields,
   and uses a closed constructor-effect proof for startup resets. Qualify the
   entire corrected 32-test cohort in hosted CI with original and emitted SDK
   compilation. The prior complete local run failed seven assertions and its
   resource bound; do not repeat it locally or filter away cases.
2. **Refusal reports:** add already-observed operand facts and the exact analyzed
   export draft, then present them in the existing conversion report. Preserve
   original refusal reasons, evaluation order and proof rules. Unknown source
   locations and selected blocks must remain explicitly unavailable; candidate
   emission sites are not selected-block attribution. Test report ownership
   against deferred updates, edits, VM changes and overlapping requests. This
   supplies evidence for the 158 failures; it does not itself fix them.
3. **SPIKE supplier adoption:** the scoped upstream supplier already implements
   the motor power operation. Genuine bundle generation has been independently
   checked: only SPIKE's carrier and pin row changed; the other 29 bundles and
   global supplier pin are unchanged. The matching virtual motor models use
   torque, damping and inertia for power control. Full motor tests, affected
   guest qualification and the existing
   opcode/menu gate remain mandatory. Generated bundle identity alone is not
   motor qualification.
4. **Public CLI and word table:** the CLI test must place ordinary outputs
   outside its protected input catalogue, retain actual nonempty artifact and
   collision assertions, and pass the complete ten-test public module. The
   generated word table contains 406 forms, including two score-handler forms;
   update the fixed fixture and run all five module controls. Neither repair
   changes converter semantics or application counts.
5. **Fresh corpus measurement:** qualify the public hosted isolation controls
   before admitting private inputs. Preserve the existing failed local isolation
   result. Bind read-only inputs, report encryption and complete output/lifetime
   limits, then run the complete 225 observations once. Compare the historical
   36 partials against the original 184-input cohort, separately from 41 context
   revisits. A source-only isolation implementation is not a safe completed run.

The historical count remains **147 translated / 36 partial / one malformed**.
Do not promote applications from focused test successes. Every eventual closure
needs original input, native run, Code and Blocks edits, graphics/resources where
applicable, saved-project reopen, exported MakeCode compilation and fresh import.
Detailed Blocks/Code/graphics acceptance remains in the
[GUI capability ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md).
Private checkout locations, original logs, recovery patches and source-review
receipts belong only in the ignored local companion and private operational log.

## Start here — 2026-10-21

### Current composition and next acceptance

The extension menu table now includes the two missing source-operation menus.
It is copied from a complete run of the actual normal-installation metadata
generator: 614 opcode rows across 30 bundled and 12 stock extension attempts,
with only the existing camera-extension skip. No rows were supplied by hand.
The actual generator CLI `--check` also passes against that complete table.
Integrated mirror checks, the complete extension-menu/SPIKE module and visible
editor journeys remain gates; metadata checks do not qualify game execution.

The separate class/Array declaration candidate first exposed six failures in
its complete 24-control group (17 pass, six fail, one named missing-SDK skip).
Its expanded constructor-effect group now has 24 passes, seven failures and
one named SDK skip, and did not meet its declared local resource bound. Preserve
the complete failures; qualify the corrected whole 32-test group in hosted CI.
Correct class temporaries also made an existing raw safe-prefix proof applicable;
that case needs a positive control alongside a genuine immutable-boundary
negative. Mixed Array startup reimport still needs a closed constructor-effect
proof. The exact scope and unsafe-constructor controls are in
[`lanes/2026-10-21-arcade-class-reset-effects.md`](../lanes/2026-10-21-arcade-class-reset-effects.md).
Preserve complete failing graphs, actual writes and initializers; require the
full affected cohort and genuine original/emitted SDK compilation. A missing
compiler is an unqualified prerequisite. The historical 36 partials are unchanged.


The SDK Sprite receiver candidate now passes its complete nine-module,
35-control source cohort. It admits the genuine Sprite `x` slot through checked
Image ingress and closed `sprites.allOfKind` receiver sets, preserving possible
Undefined values, exceptions and unproved writers. The unchanged two-case
conversion diagnostic also passes; it covers import, Creator/assets and export,
with the full source and output files retained. Current VM execution, original
SDK execution, fresh reimport and visible authoring remain pending. Read
[the receiver contract and qualification boundary](ARCADE-CLASS-LINEAGE.md).

The stdout assessment transport passes all 23 controls across its writer,
unchanged progress module and independently implemented decoder. The CLI can
emit bounded framed progress, a compressed report, Markdown and a terminal
record using `--stdio-transcript`; normal file output remains the default.
A separate seven-invocation static CLI comparison also passes, preserving
complete graphs, actual parse-failure exit and output-conflict refusals. The
complete public CLI module with SB3/VM prerequisites, report admission and
filesystem isolation remain separate gates. Read
[the wire contract and pending work](ARCADE-PRIVATE-ASSESSMENT-STDIO.md).

A separate pending candidate adds a strict canonical Array menu reader shared
by the affected export analyses; it is not included in this composed slice.
Its reimported null initialization exposes a further requirement:
prove that an independent Array assignment precedes every read. The new proof
must use the existing immutable project-JSON export boundary, preserve direct
mutable-object refusals and retain all producer/writer checks. Its complete
round-trip and hostile-input controls remain pending; menu syntax support alone
does not close those application gaps.

Current main also adds generated extension menu normalization. The composed
candidate now adopts the complete actual `getInfo()` table, including
`arcade_sourceValueBinary` and `arcade_sourceValueUnary`. The genuine CLI
`scripts/gen-extension-menu-args.mjs --check` passes. Verify the source-integrated
table mirror in hosted qualification. Preserve the declared camera skip; it does not
qualify camera behavior or the complete extension-menu/SPIKE module.

Qualify the real outer creator/editor menu wrappers as well as the bare
converter: literal menu shadows must survive import, Blocks/Code changes,
export/reimport and saved-project reopening. Check Array mutation/sort and
animation resource menus too. The complete extension-menu test module includes
real SPIKE VM controls; it is not a pure metadata-only module and must not be
filtered into a misleading qualification claim. See the GUI ledger's current
menu-composition work package below.


Read [CI repair status](ARCADE-CI-REPAIR-STATUS.md) before continuing the current
Arcade/Array lane in `LANES.md`. It records the complete four-shard failure census,
the tested animation export repair and independently scoped class-value, native
Number, browser initialization, supplier measurement and corpus work. A passing
build or lesson corpus does not establish MakeCode application compatibility.

Keep the historical 147 translated / 36 partial / one malformed result until a
complete replacement census exists. Preserve failing inputs and diagnostics;
complete affected modules, current execution and export/reimport before claiming
a gap closed. Local operational paths and raw receipts belong in private ignored
handoff notes, never in this document.

The proposed [complete private-input assessment route](ARCADE-PRIVATE-ASSESSMENT.md)
scopes the remaining hosted census work, credential separation and encrypted
output admission. It is a plan, with no dispatch or replacement census yet.


Next, read [the complete application-journey acceptance work](ARCADE-COMPATIBILITY-NEXT-STEPS.md#next-acceptance-the-complete-application-journey--2026-10-21).
The opt-in `--journey` driver now covers actual import, three VM runs, Code,
current export and fresh reimport. Read [its CLI and acceptance boundary](ARCADE-CONVERSION-JOURNEY.md).
Its twelve focused tests pass; complete corpus measurement, private transport
prerequisites and visible authoring gates remain pending.


## Current integration checkpoint — 2026-10-20

The bounded nested-slice candidate passes its complete 50-test pure authority
module. Read [its proof and pending acceptance](ARCADE-SLICE-PRESENCE.md);
native, original-PXT, fresh-SB3 and browser checks remain separate.

Start with [the current CI repair matrix](ARCADE-CI-REPAIR-STATUS.md#current-batch-and-acceptance-boundary--2026-10-20)
for the exact red-check causes, local complete-module passes and pending hosted
acceptance. Supplier [#57](https://github.com/CrispStrobe/extensions/pull/57) is
merged; Lite final composition is still awaiting qualification.

The current hosted campaign also exposes genuine source-language Array coercion
and live editing failures. Read [their work packages](ARCADE-CURRENT-FAILURE-WORK-PACKAGES.md)
and [the GUI ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md#current-live-authoring-failures--2026-10-20)
before treating any headless or native authoring result as MakeCode parity.

For the latest functional repair and ordered acceptance work, read
[the current queue](ARCADE-COMPATIBILITY-NEXT-STEPS.md#current-integration-and-repair-queue--2026-10-20).
The named-empty Array candidate is additional to the qualified earlier49, and
must not inherit their runtime or roundtrip acceptance.

The current repaired Array runtime now passes all64 existing native controls
and the complete17 additional JSON/replacement/custom-parser controls, with
zero skips. The fresh normal installation and saved originals are audited.
Original failures and the two subsequent test-fixture defects are retained;
assertions were preserved. Both genuine public Code/export/reimport tests now
pass too, with independent saved-data checks of expected values, aliases,
diagnostics and Stop/quit completion. Final hosted checks, SDK compilation and
visible authoring remain pending. This does not change the historical36-partial
count or establish complete-game parity.

A later source-arithmetic candidate has a separately accepted normal installation,
six passing VM controls, three passing intrinsic-refusal controls and one passing
importer writer-union control. The original combined native episode retains its
two fixture failures; its corrected six-test successor passes separately.
The final hosted original SDK module is still required. Three focused scalar
export/metadata/capture controls and the corrected reference/SB3 case now pass.
The native export oracle passes full-file compilation and separate exact emitted
TypeScript execution in the original PXT Runtime/core board, including values and
aliases; its zero observed child fibers do not qualify background tasks or games.
The CSV eight-control module passes with the installed Papa parser on string
inputs; native File/browser and emitted-size qualification remain pending. Read
the [current work package](ARCADE-CURRENT-FAILURE-WORK-PACKAGES.md#current-original-pxt-array-coercion-work-package)
for final gates and the remaining browser diagnostics. These results do not
replace earlier regression cohorts or promote corpus entries.

Main has been normally merged into the current integration successor, including
[PR888](https://github.com/CrispStrobe/brickwright/pull/888) and the latest
Robot Lab and NXT changes. Supplier [PR52](https://github.com/CrispStrobe/extensions/pull/52)
merged after all seven enabled checks passed. Its explicit Array dependency
identity is preserved in the integration candidate. These local candidate
changes have not yet landed as a qualified Lite release.

At the preceding reconciled candidate, all 53 conversion component tests passed.
A fresh normal VM installation reproduced all 364 expected outputs, including
180 current VM source files. The shipped Array source admission and all 49
native Array tests passed; independent saved-data checks accepted both the
installation and the complete test result. Three actual original-Code,
captured-Code and fresh exported-TypeScript reimport executions also passed the
unchanged scalar/Array expectations and completed Stop/quit cleanup. Their
independent saved-data review also passed. These finite runtime results do not
qualify graphics, audio, browser authoring or complete games.

The delivery candidate passes all 151 selected conversion regression tests,
including Camera reconciliation, compiler-owned empty procedure preparation and
the complete controller-button module. The complete Console and Font source
and export modules pass all 31 tests. All six CI contract modules pass their 28
tests. Final hosted SDK/browser and affected guest qualification remain pending;
these component results do not establish full-corpus compatibility.

Two subsequent experiments tried omitting unused Console and Font producer
graphs. Their 18- and 27-test groups passed; independent saved-data review also
accepted all 68 full outputs across two diagnostic episodes using fixed real inputs,
with all five input snapshots unchanged. However, the balanced timing episode
showed overhead in the unused Font cases and mixed Console results. Both
experiments were normally reverted from the delivery candidate. Their commits,
tests and original evidence remain available; do not reintroduce them as proven
performance improvements. Measure selection costs as well as the work omitted.

The fifth complete 225-input CLI attempt ended with SIGKILL after 25.03 CPU
seconds and did not produce a complete report. **The historical result remains
147 translated / 36 partial / one malformed; current full-corpus outcomes are
still unmeasured.** Do not subtract component passes or completed progress rows
from that count. An independent saved-data check accepted the incomplete-run
diagnostics. Its inclusive conversion intervals account for 21.04 CPU seconds;
report-wire capture accounts for 2.34. These are prefix process intervals, not
exclusive function costs or a benchmark of the full input set.

A single real slow input was profiled next. Both importer and Creator returned,
but saving the full Creator observation exceeded the diagnostic file limit.
The diagnostic therefore failed; its retained partial profile may identify hot
functions, but supplies no successful conversion, corpus or speed claim. Keep
the original failure and separate observer sampling from product sampling.

Next, improve the measured conversion costs without changing the input set,
diagnostics, assertions or execution bounds, then obtain the complete unchanged
225-input report. Group its actual diagnostics by construct and source location,
implement each family, and qualify Code, Blocks, graphics, controller,
save/reopen and export/reimport journeys. Six broader SDK controls currently
lack the original compiler/browser runtime and remain pending for one final
hosted qualification. Keep browser gates for candidates that need them; do not
repeatedly request `ci:full` during component work. All enabled final checks and
affected guest qualification remain required before merging.

The ignored local handoff holds source identities, original evidence, commands
and active ownership. The dated notes below are historical and retain their
original result boundaries.

## Latest bounded qualification checkpoint — 2026-10-19

Three complete 225-subject CLI attempts ended without reports; **all 225 current
outcomes remain unobserved**. The historical 184 raw-input result stays **147 translated / 36
partial / one malformed**; the 41 original contexts retain 29 compiler successes and 12 failures
separately. These incomplete episodes do not establish their kill causes,
a bottleneck or a successful prefix.

C6 ran all 48 native Array controls: 45 passed and three failed. The composed
supplier/host repair has an independently audited C7 installation (363 outputs,
179 current VM files) and a complete pass of all 49 native tests, independently audited from the saved results.
Genuine original/Code/export-reimport comparison remains pending. Supplier final checks, new emitted-map SDK acceptance and visible GUI
journeys remain separate. The first optional-progress episode passed 44 of 45 tests, including all
eight new tests. The corrected successor passed all 45 unchanged tests;
independent saved-data review passes.
See [the current acceptance checklist](ARCADE-CURRENT-FAILURE-WORK-PACKAGES.md#methodical-acceptance-still-required).

## Current continuation checkpoint — 2026-10-19

Read [the current failure work packages](ARCADE-CURRENT-FAILURE-WORK-PACKAGES.md) and [the GUI capability ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md) before the dated historical results below. Local component work has been normally composed with a pinned recent main; it is not a merged, fully qualified public release. Refresh main, foundation [PR888](https://github.com/CrispStrobe/brickwright/pull/888), and supplier [PR52](https://github.com/CrispStrobe/extensions/pull/52) before acting. Preserve their owners' work and exact dependency pins.

The recorded historical census remains **147 translated / 36 partial / one malformed** out of 184. All 184 raw sources and 41 complete dependency-bearing inputs now have an independent input-lineage audit; their 29 original compiler successes and 12 failures are retained. Three complete current 225-input attempts ended without reports; all current outcomes remain unobserved. Original compiler validity, conversion, runtime and visible authoring are separate results.

Recent component results: Camera/parser 42 controls pass; lossless report codec/CLI 29 controls pass; compact native-byte observation passes 37 controls. An actual two-input compressed CLI report has an independent full payload/descriptor audit. The earlier Array episode failed during circular-module startup before any of its 45 tests ran. The repaired export cycle later ran all 48 tests, with 45 passing and three failing. The composed supplier/host successor now has a complete installation audit and an independently audited pass of all 49 native tests; genuine original/Code/export-reimport execution remains pending. These results retain their separate source boundaries.

Continue in order: qualify the composed current Array value/error semantics; obtain a complete bounded report from the same shipped public CLI/core over all 225 inputs; group actual unsupported constructs by cause and source location; close each family with negative controls and complete affected modules; qualify real Blocks/Code/graphics/controller/save-reopen/export journeys. The public failure table scopes those gates. The ignored local handoff holds exact source heads, commands, original evidence and recovery information.


Updated 2026-10-19. The checkpoint above supersedes the historical
2026-10-16 and 2026-10-10 notes retained below. This is the public
entry point for continuing MakeCode compatibility work without chat history.
Read the optional, gitignored `docs/ARCADE-AGENT-HANDOFF.local.md` for the
operator's actual checkouts, tools, private corpus and original receipts.
Historical checkpoints below are observations, not permission to assume that
branches, checks, ownership or dependency pins remain unchanged.

The [native frame scheduler contract](ARCADE-FRAME-SCHEDULER.md) records the
open startup and pause/callback phase limits and the claimed implementation
envelope. Merge that lane claim before changing the product hook; finite
prototype traces do not close its exact timing or installed-GUI gates.

Latest hosted editor evidence: the five journeys on consumer `777aae8e`
pass the official [authoring job](https://github.com/CrispStrobe/brickwright/actions/runs/38793608489/job/116659147575).
They cover visible Blocks and Code edits, fresh-session save/reopen and current
export/reimport. See the [exact scope and remaining limits](compatibility/arcade-numeric-authoring-gui.md#official-five-journey-result--2026-10-15).
The same workflow retains three failed unit shards; this is not an all-checks
passing integration. The corrected canonical compiler is separately under
[PR158](https://github.com/CrispStrobe/sb3-creator/pull/158); it is not the
compiler used by that hosted editor evidence.

## Open failures at the #888 landing — 2026-10-19

PR #888 landed with 45 unit tests marked as documented TODOs, plus two open
browser gates. Every open failure is listed in
[ARCADE-888-OPEN-FAILURES.md](ARCADE-888-OPEN-FAILURES.md), with its
root-cause group, what was tried and the next step. Start there.

## Latest development repair frontier — 2026-10-16

Read [the current repair table](ARCADE-CI-REPAIR-STATUS.md) first. The base
composition has 245 passing source controls across 18 modules, qualified in
segments. The original combined execution timed out after 215 complete cases;
its timeout remains retained. Only the remaining 30 cases were executed again,
all passing. Exact source, module and test-name multiplicities join the results;
this is not a successful single 245-case execution.

Subsequent focused successors qualify TextSprite positioning, exact music-call
non-exposure and dense indexed reads in current exported loops. The music suite
passes 46 controls. The map/loop/export suite has 27 passing cases in segments:
25 unchanged cases plus two corrected test oracles. The actual edited export
fixture completes ten stages, preserving its connected numeric edit from 1 to 2
through export and reimport. The original failures remain retained. These
source qualifications are separate from the complete original simulator/native
callback comparison and final composed hosted checks.

The private prepared-source receipt still grants no value type or effect
permission. Read the [shared-frame contract](ARCADE-SHARED-IMAGE-ARRAY-TRANSPORT.md)
and [GUI ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md) for exact boundaries.

Actual native shared-frame guests preserve aliases, independent clones,
separate equal-pixel resources, ordinary Array mutations and Stop/restart
reconstruction. A second guest also executes two stateful kind allocations in
source order and observes successive values without assuming a starting ID.
Authentic library effects, artwork editing and visible authoring remain open.

Owned class-update Throw now passes source admission with the explicit direct
converter option. Its original native failure exposed duplicate errors and a
suspended scene update iterator. The runtime repair now passes 18 controlled
unwind/publication checks and both unchanged native guests on a fresh normal VM
installation: one error, preserved earlier effects, later updates, independent
controller input and paused-constructor/Stop behavior. The public project
importer still does not forward this option, so these controls do not establish
GUI availability or generic class exceptions.

The small shared-frame missing-initializer distinction is repaired. Authentic
seven-backing library transport still needs exact selected-source provenance
and effect/receiver proofs. A separate 37-control run qualifies the private
Text source handoff and actual parser-return/currentness boundaries, with the
original 24 controls retained. It is not an authentic-project closure. Recheck the immutable corpus after composition;
its recorded count remains 147 translated / 36 partial / one malformed input.

## Development results and next gaps — 2026-10-16

These results concern the reviewed development composition. They do not establish
that its source has landed on public main or that the latest editor build has
passed every hosted check. The immutable corpus remains **147 translated /
36 partial / one malformed input**; no whole-project totals changed.

- The maintained null-Sprite regression suite passes all eight tests. The six
  unaffected test bodies remain unchanged. The other two use the qualified
  sequential VM lifecycle and current artwork callbacks, avoiding overlapping
  VM dispatch owners. Five routes of the authentic flame project also match
  its observed original x-getter fault boundary. Actual runtime image pixels
  are checked separately from the blank Scratch clone costume; later projectile
  and velocity effects remain blocked. This is bounded native evidence, with
  controller timing and visible-editor limits retained.
- Free throw passes current dependency-aware public import, Creator, Code, save
  and export after the nested private-reset proof. All 35 focused controls and
  all 42 current Array receivers pass while retaining every statement. An
  earlier headless native controller observes a genuine shot, overlap, score
  and ball destruction across public Code, current Code and same/fresh saved
  projects, with actual runtime artwork. The current runtime composition has
  separate saved-project qualification: it preserves the shot and reaches
  the 30-second countdown, completes the game's original 400 ms and 500 ms
  pauses, receives a real Right input at its pending button waiter, and lets
  the game restart itself. New owned actors, score zero, retained high score
  one, one handler per registration and the displayed score text/icon are
  checked after restart. This does not qualify initial activation, rendered
  editor output, terminal graphics/audio parity, or other terminal routes.
  Repeated source growth and preparation of the latest distinct exported root
  remain separate work.

- Generic Image expressions and exact fixed-instance JRES owners have focused
  controls. Rockscout retains all 48 resource pixel bodies and 43 unique helper
  bodies, but its source still has 79 unsupported diagnostics. Holiday retains
  all 58 helper bodies and 150 call records, but has 143 unsupported source
  diagnostics and two Creator unparsed entries. Class ownership, callback
  result flow and remaining default protocols need implementation.
- Omitted ordinary arguments preserve original formal/default provenance and
  pass 13 focused controls. This does not establish class or ambient receiver
  proofs, or the remaining mixed Carnival default protocol.

Next, close the remaining source-stability and complete-project gaps, and
carry the newly qualified native behavior through visible editor/controller
journeys. Keep the [scene-clock Number producer](ARCADE-CLOCK-NUMBER-PRODUCER.md)
and [frame scheduler](ARCADE-FRAME-SCHEDULER.md) boundaries explicit. Preserve
all current bodies, assets and diagnostic channels on each affected route.
The [GUI capability ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md) tracks
Code, Blocks, graphics, runtime/controller, persistence and export acceptance
separately. The five older hosted editor journeys remain the latest hosted
GUI evidence; these new native results do not extend their coverage.

## Current method and qualification frontier — 2026-10-15

Exact source `Math.idiv` now has [bounded native conversion and current-edit
qualification](compatibility/arcade-source-math-idiv.md). A nested named helper
capturing an outer parameter remains an explicit failing case; original-runtime
and visible-authoring gates are open.

Start with the [partial closure plan](ARCADE-PARTIAL-CLOSURE-PLAN.md) and
[LANES.md](../LANES.md). The raw corpus remains **147 translated / 36 partial /
one parse failure** with immutable inputs. A conservative 20-row floor contains
external asset references absent from those raw files. Use authentic project
context to investigate them; do not repair snippets or relabel the raw census.

The latest separate 29-project profile at development composition `36805661`, using
the complete canonical compiler `8b620dd`, selects the same retained
original-compiler successes: **20 source/Creator clean, 20 current-export clean
after clean input, 19 complete pure routes clean**. All twenty clean-input
exports and nineteen complete identities from `d14e9ccf` remain clean. Two
already partial graphs now receive explicit Array export diagnostics; neither
was a complete case. See [the ten incomplete routes](compatibility/arcade-current-remaining-project-gaps.md)
and [current Array export authority](compatibility/arcade-array-current-export-authority.md).
The same identities remain clean after the source wait and Math.idiv composition;
actual Creator `unparsed` diagnostics are now retained as well. This does not
promote a whole project. It exercises import, Creator, Code feedback,
saved Blocks/assets and current export/reimport, with all diagnostic channels
retained. It runs no SDK, native game or GUI. The historical `a32d6ef0a` profile
had eighteen complete routes; `b1ef5e4ea` measured
20/18/16. Do not confuse structural source admission with complete roundtrips.

Tile reservation fixes account for the two measured complete-route improvements.
Freethrow's 26 root-only reimport refusals disappear with its actual declared
`arcade-text` dependency context, but that focused check does not promote a whole
profile. Lyla's current required primitive formal metadata survives the complete
pure route, including its unused String helper. Its corrected source
`pauseUntil` scheduling now passes five bounded native startup/input/restart
routes; its selected original now also confirms bounded startup/A/Right behavior.
[Pickup, current-export and visible-authoring gates remain open](compatibility/arcade-authentic-project-qualification.md#lyla-condition-wait-correction--2026-10-15).
Never prune its unused helper or restore original source.

The development composition `049bf6b5a` passes 155 affected controls against the
complete corrected canonical compiler, with 785 unchanged file guards and 174
matching VM overlays. This qualifies those native/portable controls only. A real
selected-runtime comparison exposed an omission-versus-explicit-Undefined default
argument mismatch. The corrected omission flags now preserve that distinction;
a genuinely new edited export matches all six selected-runtime observations.
See [the actual mismatch](#actual-default-argument-mismatch-and-visible-display-boundary).
That older control batch does not qualify native behavior for the latest pure
profile, shipped consumer adoption or whole-game compatibility.

Existing `.mkcd` import/CLI support already accepts complete project files.
Offline preparation must bind actual dependencies to the current exported root,
preserve edited source/art and distinguish original files from prepared
sidecars. Missing package context is a named input limitation, not automatically
an unsupported API. Retain warning, error and unsupported channels independently;
unknown channels cannot pass a strict gate.

The selected-original Map semantic contract now records 69 global observations.
Its first readiness observer failure and successful cached-binary recovery remain
retained, with source unchanged. The native/source Map development prototype has focused conversion and lifetime
controls; consumer adoption and visible authoring remain separate gates.

### Animation resources and first authentic guest controls

The development composition `0c135e407` includes the independently reviewed
animation producer fix. Resource factories no longer allocate unused image
costume targets that current export turned into an observable invisible Player.
Actual frame resources remain editable and portable; genuine authored hidden
actors remain actors. Fourteen affected native controls pass in the composition,
with 764 unchanged guards and the same 174 VM overlays. Both affected authentic
projects pass five native routes, including current export/reimport, with full
actor inventories checked. Their earlier saved erroneous exports remain held;
there is no heuristic repair of ambiguous user actors.

One unchanged authentic project also passes its first cached-original startup
and real DOM controller check: Right moves its sprite, release stops it, and
life remains three. This reused its retained compiled binary without another
compile. Its genuinely new current export also passes the selected startup and
controller comparison described below. Neither result establishes complete gameplay or visible authoring,
and neither changes the whole-project census.

Two more authentic projects now pass the same five native routes. Basketball
preserves its athlete, hoop, motion and countdown. Winter's complete context
initializes three actors and a splash before registering the root interval;
real A input resumes that scene, then its snow callbacks advance. The first two
Winter observers made incorrect root-only assumptions and remain recorded as
failures. The corrected observations preserve all actors and input files.
These are bounded local controls with headless warnings, not original-runtime,
visible-editor or whole-project promotions.

The private development composition `50d863fbc` includes the reviewed optional
Array owner and supplier pre-effect pairing. It validates after argument
coercions and before corresponding writes, preventing the earlier observed
mutation. Across 29 modules, 207 controls passed with one sparse-metadata setup
failure; materializing the unchanged tracked metadata allowed only that module's
six controls to pass. Six actual mutation-boundary probes and the production
default-off control also pass. Independent review verifies all 175 installed VM
overlays and the full canonical compiler source. Old failures remain evidence.
This is an optional untyped host: the production supplier pin and registration
are unchanged. Typed Array formals, derived views and named-registry restart
policy still require real producer, writer and lifetime proofs.

The [authentic project ledger](compatibility/arcade-authentic-project-qualification.md)
now separates the sixteen retained compile-valid asset contexts by pure, native,
selected-original and visible-authoring gates. Twelve have bounded five-route
native controls. The difficulty sample uses the real prompt queue and one answer
per route, then Right press/release. The flamethrower current export also matches
all six retained selected-original observations, including measured clock/frame
and trusted input edges, after one new compile and one start. Its actual emitted
Sprite/Info bindings are derived independently from the new binary. No original
replay, whole-game, visible-editor or census promotion follows.

Both pizza contexts now pass their ten native routes with real splash input,
complete resources and a four-second song wait. The conditional helper observes
no connection before the splash and creates no actor; this is retained, not
silently repaired. Exact selected-original startup remains a separate gate.
The first observer failed after another VM replaced a global registry entry;
sequential VM ownership preserves the same checks without dispatcher rebinding.
See the ledger for the precise behavior and remaining qualification gates.

### Current hosted checks and held candidates

Canonical [PR157](https://github.com/CrispStrobe/sb3-creator/pull/157) is merged
at `ca0e177b`, with every enabled check successful and reviewed/landed trees equal.
Consumer adoption must preserve independently owned board/UI pins and use the
normal compiler writer, including `procedureParameterConstraints.js`.

Consumer [PR888](https://github.com/CrispStrobe/brickwright/pull/888) is now
at CI-only `9133a871b`; [its new Build](https://github.com/CrispStrobe/brickwright/actions/runs/38763540246)
is pending. The preceding `b190d3e7d` campaign is closed: heavy/light browser,
build, corpus and FPGA passed; unit-three TODO accounting, unit-four event
observation and the official Image selector wait failed. These original failures
are retained. The new head changes seven test/workflow files, with product and
pins unchanged; it needs its own hosted qualification. The prepared visible
Game Console journey is a later candidate, not part of this published head.

### Historical hosted checkpoint (superseded by the current head)

[PR888](https://github.com/CrispStrobe/brickwright/pull/888),
[Build38718916848](https://github.com/CrispStrobe/brickwright/actions/runs/38718916848),
has successful build, corpus, both browser shards and FPGA checks. Completed
unit censuses are:

| Required shard | Total | Pass | Fail | Skip | TODO |
| --- | ---: | ---: | ---: | ---: | ---: |
| [One](https://github.com/CrispStrobe/brickwright/actions/runs/38718916848/job/116380209371) | 2364 | 2356 | 1 | 6 | 1 |
| [Three](https://github.com/CrispStrobe/brickwright/actions/runs/38718916848/job/116380209378) | 2436 | 2425 | 2 | 8 | 1 |

Neither shard has cancelled tests. Shards two and four are successful; their
censuses have not been acquired. All six parent campaigns and 24 actual child
jobs are closed, including successful official numeric authoring and debugger
checks. The original run remains failed on the two recorded shards. Local corrections `02b87cc72`, `40048a9c7` and `5c4b3a762`
are reviewed stale-test candidates, not new hosted passes. The new GUI candidate
`a11` has not run. Preserve earlier failures and cancelled/incomplete runs;
the older eleven-failure/no-census text below describes those earlier runs.

The six coordinated claims in
[PR954](https://github.com/CrispStrobe/brickwright/pull/954), head `e978`,
merged normally at `8205ef07`, with every enabled exact-head check successful.
Bounded implementation is in progress; product and GUI qualification remain open. The supplier's
canonical protocol docs [PR156](https://github.com/CrispStrobe/sb3-creator/pull/156)
are merged without a compiler pin move. No final all-enabled-checks, installed
GUI or complete-game claim follows from these partial results.

## Later measured frontier — 2026-10-15

This section supersedes the earlier development and profile status above.
The raw corpus remains **147 translated / 36 partial / one malformed input**.
The new profile at `31abb5767`, using the same 29 original-valid complete
projects, measures **20 source/Creator clean, 20 current-export clean and
18 complete pure routes clean**. The full candidate compiler plus explicit
Throw prototype measures the same counts. These are portable conversion
results; no SDK game, controller or graphics-editor result follows from them.
Nine projects still fail at source admission. The two later-stage cases retain
a missing dependency context and unsupported helper constraints respectively.

Private development composition `0fa7d5ff9` passes **138 affected controls**
with the complete corrected canonical compiler candidate `9d3e222e`.
All 779 selected source, installed and compiler file guards remain unchanged;
174 VM overlay mirrors match. The tests cover native Procedure entry and
writes, source annotation prefixes, primitive Throw, owned Sprite creation,
Map lowering and current export. They do not establish production adoption.

The ordinary Procedure source prototype retains required primitive constraints
for supported ordinary and namespace declarations. Number compound writes
require real Number operands. The later explicit prototype also preserves
supported optional Any parameters and conditional primitive Any defaults.
Typed optional/default, generic, reference and mixed signatures remain explicit
diagnostics. The exact authentic Lyla source follow-up improves from six to
five diagnostics through optional Any support; it is not whole-project closure. Constraints remain obligations and never become
observations that a parameter has an actual value.

The corrected [canonical candidate](https://github.com/CrispStrobe/sb3-creator/pull/157)
rejects hidden inputs, inconsistent prototypes and malformed constrained
calls instead of dropping executable data on Code reconstruction. Its 457
focused controls pass. Its new exact-head hosted checks and normal merge are
still required. Consumer adoption must use the repository's vendor writers,
include the new constraint module in the identity mapping, and preserve other
lanes' hardware pins. Do not edit copied vendor files to introduce the words.

### Next work in dependency order

1. Finish all actual hosted jobs for the current published consumer and
   corrected compiler heads. Preserve the original failures. The consumer's
   unit-four failure exposed missing editor-closing assertions; the reviewed
   correction passes eleven focused controls with the baseline unchanged.
   Its actual browser execution remains pending.
2. Qualify and adopt the canonical words, then verify ordinary annotation,
   Throw and owned Sprite authoring in the installed Blocks and Code editors.
   Follow the [GUI ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md); native
   registration alone does not establish visible authoring.
3. Extend the now passing optional Any/primitive Any-default prototype only
   with proper invocation rules. Typed optional/default entry remains open;
   do not place a strict Number constraint before a default initializer and
   thereby reject a legal omitted argument.
4. Add real Array operation and alias guards before admitting Array formal
   constraints. Cover raw inputs, named aliases, all mutation paths, captured
   lifetimes, foreign runtimes and failure completion. Existing Array transport
   already preserves references; converting them to strings is not the gap.
5. Prove Settings results from the real decoder. Numeric settings can return
   an Array, Undefined or Null. An Undefined-only branch does not prove Array;
   a nullish Map must not silently act like an empty Array. Only then reassess
   the unchanged Settings project and handler-record Array cases.
6. Re-run affected complete-project routes after genuine capabilities land.
   Promote a case only when all diagnostic channels and current roundtrip
   stages pass. Keep raw-input, authentic-context, native and GUI counts
   separate. Missing authentic assets remain named input limitations.

## Earlier composition and canonical creator adoption — 2026-10-15

The following checkpoints are retained in chronological context and superseded
by the method, stage counts and hosted status above where they differ.

Implementation checkpoint `8aa1dfef0` includes main `06f647be5`, qualified
creator repairs and default admission for the bounded owned Image class/callback bridge. The creator
pin is `f2d4f879ba40dd9025070ed51af11ebe1ef14808`; standard sync checks all
20 mapped files with zero downstream differences. Supplier
[PR153](https://github.com/CrispStrobe/sb3-creator/pull/153) and
[PR154](https://github.com/CrispStrobe/sb3-creator/pull/154) each passed all four
enabled checks before normal merge, with reviewed and landed trees equal.
The main branch's STM32/i8086 changes and board pin are retained.

The Image/captured/named/Number composition passes 78 focused controls.
After creator adoption, another 24 affected consumer controls and six vendor
identity controls pass; these overlapping groups are not a full-suite census.
Two exact Image source/edited-export SDK programs pass, as recorded in the
[Image contract](compatibility/arcade-owned-image-class-callables.md).
Default admission now passes 119 affected controls and seven independent
controls. The source selector retains the actual completed proof identity;
current export validates the full current graph and reconstructed source.
Native, Code, edited blocks, same/fresh SB3 and export/reimport routes pass.
Duplicate variable IDs across targets refuse; legitimate Stage globals retain
their actual producer ownership. Hosted class authoring remains open.

Literal factory producers are now integrated at `d011d18fe`. Six independent
controls cover fresh allocations and aliases, all four pixels, actual editor
save/rename methods, asset remapping, same/fresh SB3 and current export/reimport.
Two genuinely new selected-original programs match their exact frozen inputs
and native observations, with source and edited-art scores 19 and 23. Current
resource export requires exclusive clone edges and actual target/costume
identities before sharing one decoded snapshot. PNG, custom palettes, dynamic
dimensions and Sprite producers remain excluded; hosted visual authoring is
still open. See the Image contract for the exact admitted boundary.

The bounded Image drawing follow-up now admits actual `fill` and `fillRect`
receivers and Number operands in those callbacks. Two new exact source and
connected-color-edited export programs match all nine pixels and one argument
callback effect in the selected runtime. Native source, Code, same/fresh SB3,
current edited export and reimport pass. An unused fill replacement socket
cannot erase an evaluated reporter during export; only inert Number literals
are admitted there. Existing drawing blocks implement the operations.

Two integration regressions are locally corrected. Disposed Image services stay
inert during shared Start events and become live only through a legitimate
project replacement and subsequent Start. Existing static/forwarded callbacks
and named scene procedures keep their complete established lowering route;
stored named values still require their separate strict proof. Six routing
controls and a nine-control routing/drawing composition pass. These are local
corrections, not a passing final-head hosted claim.

A follow-up at `e577d6547` fixes two actual class roundtrip boundaries:
finite signed Number literals retain their existing carrier, and proved Void
calls beginning with parentheses have explicit statement delimiters. Three
independent source/native/export/reimport controls pass. General unary
coercion remains refused; these repairs do not qualify a new SDK program.

The [Arrays Number-input contract](compatibility/arcade-arrays-current-number-inputs.md)
is merged. Shared current-input ownership and the candidate canonical source
correct all nine authored-block controls, including four retained failures.
The supplier's [PR48](https://github.com/CrispStrobe/extensions/pull/48) has two
independent local reviews, but GitHub rejects its CI dispatch with “Actions has
been disabled for this repository.” No supplier pin or bundle adoption follows
from absent checks. Preserve that rejection while continuing independent work.

The previous integration run passed both browser shards, FPGA and corpus;
its build and unit prerequisites stopped on a stale expected compiler pin.
The complete SPIKE artifact control now passes at the actual adopted revision.
At published `a30cb432c`, both browser shards, the official numeric authoring
journey, build and corpus now pass. The animation Pixel/Code/Blocks/export
journey genuinely ran and passed on that source. Unit shard two has five
failures; shard one reached its unchanged 30-minute bound without a census and
contains one additional Sprite constructor-service export failure, now locally
corrected as described below. Their
original results remain retained. The local workload correction requires four
complete, independently audited unit shards with the same budgets and hard
publication gates. Fresh final-head hosted qualification is still required.

The actual Sprite factory field-export correction is integrated at
`8aa1dfef0`. Canonical factory blocks and actual registered Sprite subclass
ancestry supply separate export constraints; annotations and raw IDs do not
supply runtime ownership. Actual Number writes survive Code, same/fresh SB3,
current connected edits and export/reimport. Text writes to Number fields,
readonly/unknown SDK writes, malformed factories and mixed opaque receivers
refuse, including local and returned aliases. Thirty-six affected owner
controls and ten independent integrated controls pass; these overlap and are
not a suite census. The retained full constructor-service current export now
passes. Fresh hosted qualification remains required.

The fresh raw184 audit at clean `8aa1dfef0` remains **147 translated /36 partial
/one parse failure**, with every original Git blob verified. Authentic contexts
remain a separate **29 original-valid /20 strict /nine blocked** observation.
Next: the procedure parameter contract and value-map lanes; proper discarded
expressions and Throw syntax/runtime contracts; canonical Arrays CI and
consumer/GUI qualification. The under-20-partials milestone is not reached.

## Captured cells and valid class exports integrated — 2026-10-15

Local integration `ff720cda29320f352d24ad1b7cb18a5cdfafb089` adds reviewed
[captured primitive cells](compatibility/arcade-console-captured-cells.md) and
valid class-export repairs. A 73-control combined selection passes with named
functions, Player producers, managed Number boundaries, Code/SB3 roundtrips,
the two runtime repairs and the source/mirror check. Full hosted qualification
is still required; this is not a full-suite or main-adoption claim.

Captured inspection now follows actual globally unique registration tokens,
scoped cells, forwarded formals and every local/captured writer, including
nested registrations and mutable primitive siblings beside an opaque Image.
Stop/restart and current graph edits retain their ownership guards. Lyla now
exports without the captured-inspection refusal, but its unused text helper
loses a parameter constraint on export and still prevents full reimport.
Preserve that body and fix the parameter ABI; do not prune it or waive the
text producer check. Selected-original captured controls are a separate gate.

Class exports now retain actual Undefined/Null facts, concrete array allocation
and element/writer flow, converged producer equations and exact inherited
intrinsic constructor descriptors. Incompatible Number/Text edits still refuse.
The producer repairs incorrect parent links in nested conditions; the matching
canonical change is [sb3-creator PR153](https://github.com/CrispStrobe/sb3-creator/pull/153),
with separate qualification and pin adoption. Malformed source roots, missing
edges, shared children and cycles explicitly refuse; cyclic statement walks
terminate. A genuine malformed-root bypass found during review remains retained.

The static rerun at `e9f4a909b` still reports **147 translated / 36 partial /
one parse failure**. Every input was compared again with its actual frozen Git
blob. Authentic context structural counts remain 20 of 29 original-valid
contexts; neither those counts nor focused passes establish complete gameplay.

## Named values, Player producers and runtime follow-up — 2026-10-15

Local integration `4638b66172ca53dc6154ebb01217e7eb0ddbbe40` adopts the
reviewed named-function and Player Number lanes alongside two runtime repairs.
These changes still require complete hosted qualification before adoption on
main. The raw184 corpus remains **147 translated / 36 partial / one parse
failure**; the fewer-than-20-partials milestone has not been reached.

- [Named declaration values](compatibility/arcade-named-function-values.md)
  retain real function identity, Number/String returns and Void continuation
  across native, Code, saved-project and edited export routes. Two genuinely
  new selected-original programs compile and execute: the actual edit changes
  the Number result from seven to eleven while preserving identity and 19
  once-only effects. The first fixture's compiler refusal from a global name
  colliding with the SDK is retained. Capturing globals, mixed callable plans
  and class Holder consumption remain explicit boundaries.
- [Player Number producers](compatibility/arcade-player-number-producers.md)
  require an actual unchanged registered connection-event Player and fixed
  Number property. Aliases and forwarded arguments retain the value; falsey
  pre-event states remain zero. Native, Code, same/fresh SB3 and current
  export/reimport controls pass. In the authentic retained41 audit, 29 contexts
  remain historically original-valid; 20 now pass current strict structural
  checks and nine remain blocked. Lyla is the sole improvement, with 608 blocks
  and 20 imported costumes. Its captured-variable inspection still prevents
  current export; this is no runtime, full-game or GUI promotion.
- [Runtime and hosted failures](ARCADE-UNIT-FAILURE-FOLLOWUP.md) track stale
  executable caches after extension refresh and shared caller context lost
  during nested Sprite callbacks. Both have actual native reproductions and
  independently reviewed engine corrections. The cancelled hosted unit logs
  retain eleven failed controls, including separate class-export proof gaps;
  no complete unit census or hosted GUI repair is claimed.

The named/runtime composition passes 35 selected controls; adding Player
passes 31 affected controls. These overlapping selections are not an aggregate
full-suite count. Image owner/source and captured-variable proof work remain
separate lanes. Preserve Number/Text refusals while extending actual producers.

## Console and real local defaults integrated — 2026-10-15

Local integration `cceebcfc4d4109f216fb38e7db50e7860d9c0283` normally adopts
reviewed console inspection and real primitive local declaration defaults. The
consumer compiler pin is now qualified supplier
`4e8a287244d31d82ac84dbef609f48f2c10efab2` (399 operations, 404 spellings).
The qualified current VM overlay contains 162 source files. Source admission
uses actual lexical producers, initialization and every writer; edited export
independently checks directed primitive operands. Image operands and generic
`console.inspect<number>` cannot obtain a primitive grant.

Four genuinely new original compiler attempts produced three successful guests
and one retained predeclaration compiler refusal. Primitive source and its
actual edited export match their expected strings, once-only effects and all
19,200 Image/display pixels. The original local-default program observes
`undefined` for typed/untyped primitive locals and globals, aliases and returns.
A fifth, genuinely changed current export separately compiles and executes with
those same observations. The unchanged source was not replayed.

Local declarations now emit actual Undefined at their declaration when the
unique primitive/untyped `let` binding is proved. Predeclaration reads and
unsupported reference declarations remain refused. No blanket local lookup
fallback or annotation supplies the value. The composed selection reports 98
passes and one environment failure from an obsolete external creator override;
the affected local-default selection passes all three checks with the current
bundled creator. Existing class, managed Number, bitwise and Font controls pass.

The newly repeated immutable raw184 audit still reports **147 translated /
36 partial / one parse failure**; all 184 files match the frozen corpus Git
blobs. This bounded integration makes no complete-project promotion. PR888 is
still published at `6350fba49` while that full diagnostic runs; do not overwrite
it with this later local source until the surviving run finishes.

A separate [Arrays input claim](https://github.com/CrispStrobe/brickwright/pull/949)
is under review in PR949. Actual authored Number shadows currently lose their
intent in Arrays value operations: 20 + 1 yields text `"201"`, and Number zero
is treated as truthy text. The canonical supplier and shared current-input
bridge must be corrected with exact producer ownership. A global Scratch
shadow conversion would exceed this contract.

## Latest integration checkpoint — 2026-10-15

Local `1e65f988c24df35ec99a33ba68520ec529f7fb7a` normally composes main
`84da6d07e` and the qualified managed Number adapters. It also implements the
[six identifier bitwise compounds](compatibility/arcade-primitive-bitwise-compound.md).
Eighteen focused checks pass independently; two exact ordinary source/export
programs pass selected-original execution. Captured factories have native and
portable evidence, with original execution still open. The raw184 count remains
**147 translated / 36 partial / one parse failure**.

Published PR888 remains `60de95e9`. Its replacement full run is complete and
failed: unit shard 1 reports 4,705 tests, 4,686 passes, three failures, 14 skips
and two TODOs. Shard 2 was cancelled and supplies no completed census. The three
failures concern legacy scene timer observation, yielding speech creation and
terrain contact timing. Local test corrections preserve original source and
assertions; their complete hosted rerun is still required. Keep the original
failure record and distinguish these fixes from runtime feature changes.

Class primitive export constraints are adopted locally after independent review;
36 composed controls pass, preserving native text while refusing incompatible
class source exports. Console inspection remains under review and is not adopted. Console supplier PR150 is merged, but
the consumer compiler pin remains unchanged. Named function values have an
approved separate declaration model under implementation. None of these
checkpoints establishes full game or GUI compatibility.

## Current local integration and next prerequisite — 2026-10-15

Refresh [PR888](https://github.com/CrispStrobe/brickwright/pull/888) and
its exact checks before adoption. Published `60de95e9c4dc4a6b4fe73ad30e7cf5713f85d750`
contains focused corrections for all 34 top-level failures observed before the
previous unit shard stopped; it has no completed replacement shard census yet.
See [the full retained failure record](ARCADE-UNIT-FAILURE-FOLLOWUP.md).

Local integration `8aae5ea3f4fa2786dd096c363f81f85b5a07d8f1` also normally
composes source freeze `d511484d6b8458c6b961d433cc22f9a4b5ae1b91` and its
contract clarification. It passes 122 composed native/pure checks. That source
is not a claim that remote main or the published PR already contains the change.
Its immutable raw184 audit remains **147 translated / 36 partial / one parse
failure**; the below-20 milestone is not reached.

Local integration `afa49ca09` additionally contains the proper managed
Number-input correction: current argument packing, local/captured writes,
ordinary class setters and managed returns interpret only their actual
connected Number shadow. Text `"20"` stays text. Fifty affected controls pass
with actual current-block edits, Code, same/fresh SB3 and export/reimport.
The [GUI and export ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md) records a
new confirmed class-export constraint failure: a text writer can still export
under an unchanged Number field declaration. Its newly compiled Number control
passes, while its newly compiled text export fails in the selected compiler.
Do not treat native or pure reimport success as compiler-valid class export.

Relevant implementation entry points:

- `overlay/scratch-gui/src/lib/bw-makecode/source-value-producers.js`: one
  read-only actual lexical producer/writer analysis shared with Font lowering.
  Its copied occurrence facts, binding kinds, initialization and actual unique
  function nodes do not derive authority from type annotations.
- `overlay/scratch-gui/src/lib/bw-makecode/callable-source-gate.js`: validates
  factory bodies, capture initialization, every writer/read and plain immutable
  calls before issuing numeric Arrow result facts. Constructor and explicit
  generic call descriptors must not be normalized away.
- `test/makecode-callable-source-producers.test.mjs`: regression entry point for
  misleading annotations, actual Image writers, unchanged callee identity,
  initialization, aliases, unused writers and constructor/generic descriptors.
- `test/helpers/arcade-timed-native.mjs`: actual shared timer observation for
  source pauses; physical frame counts do not imply elapsed program deadlines.

[Supplier PR148](https://github.com/CrispStrobe/sb3-creator/pull/148) normally
merged the inspection word at `4cff9b6bda7129958590718152abc0a6b6b1181d`.
Its reviewed head had the current compiler pin as parent, but supplier main
advanced with an independent STM32 test during the merge. The reviewed actual
combined-base tree matches the landed tree; it is not equal to the earlier
reviewed head tree. Its canonical/runtime sources and notices are unchanged by
that incoming test, with 399 operations and 404 spellings. Exact merged-main
qualification is still pending; the consumer compiler pin remains unchanged.
Inspection's source/native/current-project proofs and the
[managed return Number gap](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md)
remain required. A Number return must not be repaired with an inspector-specific
text caster or source rewriting workaround. Preserve earlier candidate failures
and separate native, selected-original and browser conclusions.

## Latest integrated follow-up — 2026-10-14

Integration `7878106481d56bf1d9722f75a9362aad44c169a7` normally composes
main `1007a7979613668cd0ce20ea6e0ab6ee2b5c9569` and qualified live Font
source `47147509a7f2b7d3ccf946c4ee8ba6ab50081ed5`. The compiler supplier is
`432f611897a16adc59568a0d949f2dbc9455b6db`, with **398 commands / 403 spellings**;
standard synchronization preserves the five unrelated supplier pins, gallery
identity, vocabulary and tracked mirrors.

- [Live Font values](compatibility/arcade-live-font-values.md) support actual
  Font constants, text selection, scaling, field reads and printing through
  editable Code, same/fresh SB3 and changed export/reimport. One changed exported
  original matched all **1,536 pixels and seven values/aliases**. The current
  export is byte-identical to that executed input; no replay was needed. Font
  field and shared glyph writes remain explicit first-slice refusals.
- The combined current runtime passes **75 native/frontend controls plus five
  controller/renderer controls**, without SDK execution in that verification.
  The owned VM projection applies the current source through the standard
  overlay tool; all 155 overlay files match and three engine hooks are retained.
- [Import readiness](compatibility/arcade-numeric-authoring-gui.md) and
  [debug drawable ownership](compatibility/arcade-show-physics.md) have bounded
  fixes and independent controls. The real numeric GUI failure and cancelled
  unit shards remain preserved; current hosted acceptance is still required.
- Default class callback [ownership PR937](https://github.com/CrispStrobe/brickwright/pull/937)
  merged after all eleven enabled checks passed. Its complete-source and
  current-project implementation is now integrated for the bounded ordinary
  Number/String profile; broader library and visible GUI qualification remain open.

The reviewed screen operand follow-up `3d42e8855badbddf972b900b343671edbc299c49`
is normally integrated at `990e0c961bdcb05e3c3b17fe5ba1213c8f3bb463`.
It proves the unshadowed built-in screen Image, Image dimensions, primitive text
concatenation and numeric derived expressions. Screen assignments invalidate
that authority. It does not widen Image factory operands or admit opaque values.
Independent review and root integration each pass **19 focused controls**.
The edited Font export remains byte-identical to its executed original.

The fresh immutable 184-input audit now reports **147 translated / 36 partial /
one parse failure**. Exactly the two newly regressed rows, `30c9e6286a9cbe22`
and `d9e8eb7569f760a9`, recover through that implementation. The earlier
**145/38/1** result and original inputs remain preserved. This is a static audit,
not whole-game qualification; the below-20 milestone has not been reached.

## Current continuation checkpoint — 2026-10-14

Start with [PR888](https://github.com/CrispStrobe/brickwright/pull/888),
its exact head/checks and `LANES.md`; this consumer is not merged. Refresh main
before implementation and preserve independently owned device/session changes.
The canonical supplier [PR146](https://github.com/CrispStrobe/sb3-creator/pull/146)
is merged at `7f74d75f3a574b5f74b5c62351326cd5d2e64c2a`: all four enabled
checks passed and the declared Pages job skipped. Reviewed, predicted and landed
trees match. Local consumer adoption uses the normal three-way sync and retains
existing STM32 changes. Current vocabulary: 393 commands, 398 spellings.
Arrays remains `4db2813d366af8a110fc79599afb55d1cd42d8df`. Later main adoption
[PR929](https://github.com/CrispStrobe/brickwright/pull/929) brings the
qualified Board `370be6994dcc6ffcef852f8f1d67861e3e98dd70` and Circuit UI
`9593a12056e72c10686232bb448f97471f98feec`; normal composition preserves them.

Reached, with original failures retained:

- [Circle drawing](ARCADE-CIRCLE-DRAWING.md): 57 selected original cases plus
  aliases/clones, 60 Images and 4,860 complete pixels. Native, Code, same/fresh
  saved SB3, executed MakeCode export and reimport pass. Standard radius edits
  survive Code/project/export. Typed Sprite-image routing additionally passes
  Code, executed export and reimport with three shared Images and 243 pixels.
  Visible browser authoring is pending.
- [Named Array helpers](ARCADE-NAMED-ARRAY-ITEMS.md): scalar and aggregate
  semantics, nested aliases and both real exported originals pass. A uniquely
  bound target-owned zero-argument procedure now supplies scalar values using
  complete current return-graph proof; native/export/original/reimport controls
  pass. Unknown/reference/recursive/parameter-dependent results remain refused.
- Circuit Playground uses the existing asynchronous builtin loader. Seven
  controls include real VM deduplication, runtime ownership and registration
  readiness. The startup marker gate rejects eager CPX payload. Fresh hosted
  bundle measurement remains required; the byte budget is unchanged.
- The latest [unit follow-up](ARCADE-UNIT-FAILURE-FOLLOWUP.md) retains the
  completed 4,610-control shard's 46 failures, cancelled shard without a census,
  real light-browser replacement-stage failure, build catalogue failure and
  startup-budget failure. Corrections require current hosted qualification.
  Tracked VM/compiler mirrors now match their owned overlay sources at HEAD.
  A genuine clone creation-after-render ordering defect is fixed in both scene
  composition routes; nine focused clone/scene controls pass. Optional-call and
  multiplayer negative expectations now match admitted behavior. The yielding
  function control observes actual 199/200 ms deadlines and Stop/restart.

The fresh immutable 184-input audit at
`57ba525fc6120922f4e656d657b35ecec44841e1` remains **147 translated / 36 partial /
1 parse failure**. All 184 committed input blobs and the unchanged content
multiset were verified. This is pure translation, not runtime/whole-game
qualification. The separately frozen authentic 41-context denominator remains
29 original-valid, 19 strict, 10 blocked and 12 invalid. The below-20 milestone
has not been reached.

Next ordered work:

1. Complete [stored class callbacks](ARCADE-STORED-CALLABLE-NEXT-SLICE.md) through
   broader default and visible editor admission. The
   [explicit prototype](compatibility/arcade-class-stored-callbacks.md) is now
   composed with current consumer source. It passes Number/String invocation,
   captured receiver ownership, pause/Stop, Code, same/fresh saved project,
   edited current-body export and native reimport. Two selected-original programs
   pass: source `3 / ok / 3`, edited export `8 / ok / 8`, with unchanged SDK guards.
   Composed control batches pass 81 and 66 tests; eleven root controls confirm
   current-body conversion and the retained default boundary. Class callbacks
   remain explicitly opted in; general default and GUI admission are closed.
   Independent review found generated discard temporaries could overwrite
   authored parameters. All three affected families now use fresh allocation;
   current-body export and actual native regression controls preserve the
   authored values. The earlier failures remain in the private evidence.
2. [Default numeric callable admission](compatibility/arcade-numeric-callable-default-admission.md)
   claim [PR931](https://github.com/CrispStrobe/brickwright/pull/931) merged
   with all 11 enabled checks successful and reviewed/landed tree equality.
   The local consumer now admits only proven Number factories returning captured
   zero-argument Number arrows. Its 17 composed controls pass; current edited
   export bytes match retained executed originals with all nine guards unchanged.
   Wider class/generic/typeof forms remain separately gated. Hosted consumer
   qualification and dedicated visible authoring are still required.
3. Implement [live Font values](compatibility/arcade-live-font-values.md) from
   measured selected-original records and glyph data. Fonts are mutable; an
   immutable descriptor does not make the value immutable. A native prototype
   and one original matrix exist privately. Source audit proves the selected
   simulator uses the full Font12 resource; hardware subsets remain separate.
   [Supplier PR147](https://github.com/CrispStrobe/sb3-creator/pull/147) prepares
   five ordinary connected Font words, with 448 affected controls passing.
   It is normally merged at `432f611897a16adc59568a0d949f2dbc9455b6db`:
   all four enabled checks passed, the declared Pages job skipped, and reviewed,
   predicted and landed trees match. Consumer adoption remains pending.
   Native preparation preserves lazy initialization, owner identity, aliased
   glyph storage and explicit mutation refusals. Complete source, Code, saved
   project and edited-export routes before widening the read slice.
4. Exercise actual Blocks/Code/graphics-editor authoring and keep every pending
   route in the [GUI ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md). Native
   metadata and source conversion are not a completed browser journey.

Use `scripts/compat-audit.mjs` with the exact frozen corpus for classification;
`--compile` and execution are separate gates. Original SDK guests require shared
reservation, immutable actual compilation inputs/executables/observations and
all nine SDK/bridge hashes before/after. Reuse a retained original only when its
actual input bytes match; preserve failed invocations. Private checkouts, command
lines and receipts belong in the gitignored local companion or private repo.

## Latest source qualification — 2026-10-14

The next shared lane is [typed stored callbacks](ARCADE-STORED-CALLABLE-NEXT-SLICE.md).
Generic class-method parsing now preserves actual names, type parameters,
constraints, defaults and bodies instead of misreading them as fields. Six
independent parser controls pass. Generic runtime lowering remains explicitly
refused while invocation-local types and the actual captured-receiver bridge
are implemented; this is a prerequisite, not a whole-library promotion.

Physical [ExtendableSprite updates](ARCADE-EXTENDABLE-SPRITE-UPDATE.md) now retain
constructor/image pauses, undefined fields, base destruction followed by the
same public update, independent scene workers, scene-change delta lookup and
live Sprite iteration order. Seven actual source controls and three newly
exported original programs pass with unchanged SDK/bridge byte guards.
The composed native check passes 17 update/activation controls together with
34 source-type controls. Plain Sprite lifecycle and speech share the actual
live update pass; an unset lifespan remains the original `undefined` value.
GUI, cadence, audio and whole-game qualification remain separate.

Array reference identity is now independent of sprite artwork routing. Actual
module/local/procedure ownership, startup defaults, mutation and aliases survive
Code, same/fresh saved projects, original source/export execution and reimport.
Opaque alternatives remain refused. Five composed native/portable controls
pass; missing artwork remains an explicit gap. The fresh unchanged 184-input
audit after both changes is still 147 translated, 36 partial and one parse
failure. Removing an Array alias diagnostic does not promote a project that
still lacks its genuine assets or helpers.

Source `typeof` now preserves the actual operator through native execution,
edited numeric Blocks inputs, Code, same/fresh saved projects, selected-original
export execution and reimport. The bounded E15 named-item control preserves
thirteen authored strings, primitive/null/undefined values, JSON aggregate text
and Array alias identity. The first exported Array receiver crash is retained;
the exporter now uses its actual scope/type graph for mixed local Array receivers.
It does not infer an Array from JSON-looking text. See the
[source-type contract](compatibility/arcade-source-typeof-values.md).
Composed-source review additionally passes 34 ownership/lowering/export/native
controls and both native portable routes. This is not yet a merged Lite consumer
or a visible editor qualification for this reporter. Sprite-backed and unowned
callable representations remain explicit boundaries.

The current compiler pin is qualified main
`2cc15b9951109f3eaf1d207ade4e6a93b13cf5e5`: the source-type supplier was tested
at `a1206d7508cf69c8f3cac0e0073827e8fb6a7698`, and the intervening
[B18 merge](https://github.com/CrispStrobe/sb3-creator/pull/142) changes the C
seven-segment generator, with unchanged Arcade vocabulary. Standard synchronization
preserves every other component pin. Inventory is 385 canonical forms / 390
including aliases; the composed canonical SPIKE artifact check also passes.

The [current official build](https://github.com/CrispStrobe/brickwright/actions/runs/38586245394)
passes numeric authoring and the heavy browser lane. Its second unit shard
finishes with 3,550 tests: 3,503 pass, 40 fail, five skip and two TODO. The first
shard has no completed census. The artwork reload journey fails because its
unhandled replacement confirmation is dismissed by the browser test; the new
test accepts that specific confirmation and retains stage, asset and pixel checks.
Its new browser qualification is pending. Earlier failures remain preserved.
The [unit follow-up list](ARCADE-UNIT-FAILURE-FOLLOWUP.md) names all forty
recorded failures and the route-by-route method for closing them.

The official [numeric authoring job](https://github.com/CrispStrobe/brickwright/actions/runs/38581351652/job/115917111987)
passes on reviewed head `c1128242b39ace14e6b911a784ce9ee3118540f7`, with qualified
compiler `3a2e423954ef9d6c6066c487e051c1e22496648d` and Arrays
`40184f1917d164cf45fc543117d5c1f9254f9cb6`. Four owned fixtures each complete
five journeys: import, visible block edits, Code edits, fresh saved-project
reopening, and actual export/reimport. The font fixture records four original
comparisons; the repeat fixture records twelve, including controller-pane
hold/release/repress for both players. Both reports contain no page errors.
These qualify the specific authoring controls, not the raw corpus or complete
unrelated games. The same head's heavy browser job passes, while unit and
artwork qualification remain separate; earlier failures are preserved.

The [bounded BaseDialog subclass contract](ARCADE-BASE-DIALOG-SUBCLASSES.md)
now covers authored `drawTextCore()` and `update()` overrides, explicit
`super.update()`, ordered pause completion, Stop cancellation, and real old/new
image aliases after resize. Source and newly exported original executions agree
on seven observations and all 843 image pixels; Code, same/fresh saved projects,
and export/reimport preserve them. Seven affected native/descriptor controls
also pass on the composed integration source. Existing native dialog instances
retain their actual SDK update method. Constructor virtual dispatch, layout
overrides, Sprite physical subclassing and a class authoring GUI remain separate
gaps. This does not qualify a complete Carnival game.

The unchanged 184-input audit remains 147 translated, 36 partial and one parse
failure after this integration, with every input checked against its original
Git blob. The separate authentic-context audit remains 29 original-valid
projects (19 structurally strict, ten blocked) and 12 original-invalid projects.
Neither structural audit establishes runtime or GUI compatibility.

Browser callback completion uses a separately authored, frame-observed profile:
the yielding collision handler waits until its actor actually moves, then its
inline successors must read that same position. It retains a bounded browser
timeout and genuine controller input. The original fixed 70 ms source and its
timed regression remain unchanged. A loaded browser need not service a positive
scene frame during that wallclock interval; earlier cold-start failures remain
recorded, and this browser-profile change is not a scheduler repair. The new
profile passes native timed preflight and actual selected-original execution:
both observe `before=15`, `after=12.609375`, with both following handlers and
the inline caller reading that same final position. All nine selected SDK and
bridge byte guards remain unchanged. Its browser qualification remains separate.

### Integration refresh

Integration source `33a469196cc648120d26c760796442bcfae036e3` adopts normally
qualified supplier merges: compiler
`3a2e423954ef9d6c6066c487e051c1e22496648d` and Arrays
`40184f1917d164cf45fc543117d5c1f9254f9cb6`. Compiler inventory remains 384
distinct operations / 389 forms including aliases; reserved `CALL:` is grammar,
not an additional native operation. All supplier enabled checks passed and
reviewed/predicted/landed trees matched. Lite integration checks remain pending;
this is not a Lite main or all-games GUI claim.

The fresh immutable audit at clean
`1813c7721d` repeats **147 translated / 36 partial / one parse failure** with
all 184 Git blobs independently matched and unchanged input multiset. Its
query/export fixes do not change the raw snippet diagnostics. Complete-project
context remains a separate denominator: 29 retained selected-original-valid
inputs, 19 structurally strict and 10 blocked; 12 selected-invalid inputs are
kept and must not be promoted by a permissive parser.

Typed array lookup preserves receiver type and identity, with an argument-only
search view and proper receiver/argument sequencing. See
[the query contract](ARCADE-ARRAY-SEARCH-EXPORT.md). Arrays named-item correction
is qualified independently of the held callable prototype. The bounded source
`typeof` routes are qualified above under merged ownership
[claim 913](https://github.com/CrispStrobe/brickwright/pull/913); Sprite
provenance and the reporter's visible editor journey remain open.

Two genuine controller-repeat original controls now observe each press/release
callback before sending the next input edge. The failed timed input schedule
is retained; counts and all 19,200 image pixels were not relaxed. Assigned image
editing retains its actual source carrier through native/Code/SB3/export paths;
its new visible Pixel/save/reload journey still requires hosted execution.
Browser callback motion during pause remains a failed gate: a real autonomous
native timer control passes, but its browser cause is not established. Preserve
the failure and collect actual clock/worker diagnostics instead of weakening
motion assertions.

[The ordered remaining-semantics plan](ARCADE-REMAINING-SHARED-SEMANTICS.md)
records primary source URLs/hashes and Blocks/Code/graphics acceptance contracts.

### Current immutable corpus audit

The fresh raw audit at clean `5470796506f6d7bd5d44433b65e17bcd4282cd6a`
reports **184 inputs: 147 translated, 36 partial, one parse failure**.
Corpus commit is `c67f4854610ccc823682280b4d1fbdf737f4a585`; input content
multiset SHA-256 is
`a3dc8c21a33a9fb5e1808d2b2b2d2dbc2f7ce1ab33655b7b4cb14a16894b9f03`.
An independent read-only comparison confirms all 184 files match that commit's
blobs. The audit receipt itself retains its original `commitVerified: false`;
the separate comparison supplies verification without rewriting evidence.
This audit requested no original compilation, execution or behavioral comparison.
The preceding clean `aa65b75733eb8abd3f14a6601c4f1608f0c10c5c` audit was
143/40/1. Exactly four rows now move from partial to translated, removing five
repeat-property diagnostics: `controller.A.repeatInterval` in all four and
`controller.A.repeatDelay` in one. No other row changes or regressions occur.

| Raw project identifier | Previous blocks | Current blocks | Removed diagnostic |
| --- | ---: | ---: | --- |
| `25b537cb2e5c14a1` | 405 | 406 | repeat interval |
| `268aab83dc4ee9a5` | 5 | 7 | repeat delay and interval |
| `30c9e6286a9cbe22` | 533 | 534 | repeat interval |
| `d9e8eb7569f760a9` | 533 | 534 | repeat interval |

The remaining 36 partial rows contain 120 diagnostic occurrences across
92 distinct diagnostic families. Missing asset references, unresolved authored
or dependency helper calls, and sprite/scene/tile stage-route diagnostics can
overlap within a project. They are raw-input diagnostics, not proof that all
underlying native APIs are absent. Array identity, song-expression format and
an empty emitted Code body also remain named diagnostics. The same parse
failure remains in `12904c83e83fe45a`.

The earlier change from clean `3867e7d84` to `aa65b75733` was Snake
`28379fc078a029bc`: the lexically qualified `randint` Number result now retains primitive and scalar
authority. Four strict provenance controls and three original/native/Code/SB3/
export authoring cases pass. The unchanged Snake source has separately observed
finite controller/state behavior. Explicit `CALL` now retains its rendering
procedure invocations and its screen contains drawn pixels. Its frame delta
still differs (`0.06` native versus `0.04` original at the retained observation),
and random food positions differ. Its whole-game verdict remains partial.
**No whole corpus game is GUI-qualified.** Clean `3867e7d84` was 142/41/1. The earlier clean `22ccdcd6`
audit was 140/43/1 with identical inputs. Only two creation-handler projects
changed from partial to translated: `a5ad2a27e66886ae` and `d5bdcef480c08ffb`.
Other recovered-project counts below describe historical profiles. Compare
identical input/profile receipts before attributing count changes to a feature.

Inline image-array artwork now groups ordered costumes while retaining ordinary
array evaluation and identity. The selected callback tests use actual handler
registration and timer authority: eight native controls pass without weakening
numeric, cancellation or ownership assertions. Original/native collision timing
has a separately preserved feature receipt; these results do not promote games.
Fresh [Build run 38514362889](https://github.com/CrispStrobe/brickwright/actions/runs/38514362889)
checks reviewed `0f2834b043bb7d59a6f94e6602cae96831c98021` at actual checkout
`88e1857e060b850c6c48980e0fa78e00c7430ddc`. Numeric and event authoring
each pass all five journeys and twelve original comparisons, with complete
frames and empty page errors. Light, heavy and FPGA browser checks pass.
Both unit shards fail; deployment and verification skip. The [combined proof](https://github.com/CrispStrobe/brickwright/actions/runs/38514362889/artifacts/11872663564)
ZIP SHA-256 is `3e6edaa2c91ec035fe9ee4c080064096a908f2a82ae2b80c5c0d5ae7633e4595`.
Later local source and supplier changes are not qualified by that build.

Current canonical supplier is `08612be429512583e9c23564a589b9872ba28073`: **384
distinct operations, 389 spellings including five aliases**, from normally merged
[compiler PR137](https://github.com/CrispStrobe/sb3-creator/pull/137).
All four enabled checks passed, with the declared Pages skip and matching
reviewed/predicted/landed trees. Source reference and nullable array flows
have bounded original/native/Code/SB3/export controls; their fresh production
editor qualification remains open. Literal runtime `Sprite.setImage` creates
a fresh image per evaluation, preserving dynamic kinds and instance identity;
seven affected original/native/artwork controls pass.

Three repeat words preserve initially undefined button properties, raw primitive
writes, defaults, compound assignment order and scene lifetime. All 24 advertised
player/button pairs have original-backed controls. Eight composed-root controls
pass native source, Code, same and fresh saved SB3, exact retained original export
inputs and reimport without replaying the SDK. Their real palette/controller-pane
journey is prepared and wired, but needs a matching official production artifact.
The raw count above measures translation only.

### Authentic project context is a separate profile

A fresh cached-source audit at clean `f679f214a2dd790d2a0a18e6cb57f2dcf957092f`
and compiler 380 recompiles all 41 authentic contexts using the current CLI
compiler bridge. Exact project inputs, resolved packages, source order and
generated source match the prior canonical context profile. There are **29
compiler-valid contexts, 12 compiler-invalid contexts, 19 strict structural
candidates and 10 valid contexts still structurally blocked**. The comparable
prior profile had 16 strict candidates; three improve and none regress.
These counts differ from the repaired 37-context profile and the bare 184-input
audit; do not mix their denominators. An incomplete interactive fragment still
lacks its actor initialization, even though it structurally translates. No
whole-game or GUI qualification follows from these structural counts.

### Live font metrics and explicit procedure calls

Supplier [font PR139](https://github.com/CrispStrobe/sb3-creator/pull/139) and
[procedure PR138](https://github.com/CrispStrobe/sb3-creator/pull/138) are normally
merged. Each passed all four enabled checks; only Pages publication skipped.
Predicted and landed merge trees matched. The qualified predecessor canonical source was
`3ee41478409b958e218735ce67fab5f866d80231`: 381 distinct Arcade operations.
The current repeat-composed supplier above retains both changes.

Six direct `image.font5/font8/font12.charWidth/charHeight` reads use the live
renderer objects with Number provenance. Scene lifetime, restart, field edits,
Code, saved projects, original export and reimport are covered. Raw selectors
reject objects without invoking `toString`. Font writes, dynamic selectors and
broader font-object authoring remain diagnosed. The hosted font journey is
prepared and wired; its new visible scene requires fresh official-artifact proof.

Generic `CALL show` and `CALL draw (x) (y)` preserve actual custom procedure
labels, argument shapes and ownership. Five producer controls and 110 combined
regression tests pass. Original/native/Code/same and fresh SB3/export/reimport
call effects and all 19,200 background pixels match for the rendering fixture.
The unchanged Snake witness now draws, while its cadence and random-position
comparison remain open. No whole-game or current-head GUI promotion follows.

The predecessor raw 184-input count was 143/40/1: two projects lost their font
diagnostic but still required repeat properties. The current repeat-composed
audit clears four partial rows to reach 147/36/1 as detailed above. Retained authentic project contexts and
static snippets keep separate denominators. The palette export test now waits
for the original simulator's genuine first screen update before comparing all
16 colors; [PR916](https://github.com/CrispStrobe/brickwright/pull/916) is
pending final checks. No expected-color polling or guessed delay is used.

### Prompt String provenance

The selected SDK's `game.askForString` has String result authority. Three strict
scope/provenance controls and one original/native/Code/same and fresh SB3/export/
reimport case pass, including a read before declaration, entered text, character
code and array alias identity. The original uses the simulator's real DOM input
and Enter handler; native uses the ordinary QUESTION/ANSWER path. No SDK answer
stub or broad array/Any inference is introduced. Hosted visible prompt controls
remain open. This repairs a retained typed string receiver diagnostic; its map
and exception diagnostics remain explicit.

### Initializer and virtual-slot qualification

`whenUsed` declarations now retain their emitted initializer effects as one
private staging group. Reachability follows actual lexical bindings; unused
functions and shadowed call names do not initialize global constants. Getter
and setter access remain separate. Class-table reachability follows the selected
MIT [PXT emitter](https://github.com/microsoft/pxt/blob/v13.2.1/pxtcompiler/emitter/emitter.ts)
`fixpointVTables`/`markVTableUsed` rules: used virtual roots reach overrides in
used tables, without making every declared class or method executable.
Implicit inherited constructors use the actual ancestor constructor procedure.
A staged class update retains its original update operation and the actual
temporary receiver binding, preserving the selected SDK restriction on `any`
property updates. Ordinary typed updates and permitted `any` assignments are
not refused. The unchanged inheritance authoring regression and six selected
original static-error controls pass; 21 text-member shape controls now inspect
the reporter inside the actual assignment grouping.

The unchanged TeamData and initializer-order regressions pass, including two
allocations rather than all fixed instances. Four new scalar/accessor/virtual
cases pass native, Code, same and fresh SB3, exported original execution and
reimport; the two new initial sources were also executed in the original SDK,
and the two virtual initial sources have separately retained original receipts.
Six compilation observations retain actual inputs and binaries. Three new
native/pure controls and six independent lexical/virtual retention probes pass.
These bounded results do not qualify arbitrary callable/interface dispatch or
an editor catalogue for unused fixed instances. Retain the declarations for
future editable selection without executing their unused initializer effects;
that user-facing authoring contract is still open.

### Current integration and official GUI acceptance

The preceding completed [Build run 38511065833](https://github.com/CrispStrobe/brickwright/actions/runs/38511065833) built reviewed `920e089927abd906d0608c2c8bad7462ec83ddf3` at actual checkout `adb3dc8689d37e7df9070c107a6b931a8cb9e4e6`. Its [combined authoring proof](https://github.com/CrispStrobe/brickwright/actions/runs/38511065833/artifacts/11870740594) passes all five numeric journeys and twelve original comparisons. Event import and visible block edits also pass, including controller input, waiter delivery, player selection and matching complete original frames. Event Code replay fails because its first text replacement edits the stopped game's saved trace rather than the handler message. The original proof ZIP SHA256 is `c5ab96b7858955a85fd4c75ecba47ae2e44ebacc40f29da16858ab19b19646d5`. Both unit shards and light/heavy browser jobs failed; deployment skipped. This is a preserved partial GUI result.

Follow-up corrections retain both message occurrences and verify the actual visible editor text. A real VM snapshot/controller regression passes. Native animation resource factories now evaluate once: ordinary staging had appended old frames to the complete factory result, doubling frame counts and undoing visible pixel edits later in playback. The corrected factory retains its type/artwork provenance and omits duplicate pushes; ordinary arrays keep their evaluation order. Unused classes retain field/type metadata without executing initializers, and the selected SDK's missing-constructor restriction applies only to reachable construction, including ancestors and registered callbacks. Seven combined original/native/Code/SB3/export/reimport tests pass for animation pixels and unused-class semantics. Edited construction from synthesized class Code is a separate authoring contract, not proof of the original source's constructor refusal.

Twenty-eight lifecycle/reference checks and six mock/startup controls pass after completing the native test Runtime contract; stale/foreign/disposal assertions remain intact and malformed nonempty source preludes still refuse before startup. Four controller-step tests now check exported numeric semantics and actual signed movement. The physics browser observer now waits for the game's own displacement observation as well as its velocity cap, retaining its numeric bounds and failing if the engine stalls. A fresh official browser run must verify these corrections before merge; no corpus project is promoted by these feature results.

Current supplier is `aa7ea1697a08eb393e6a002a2216f26b741f4fbf` (379 canonical forms), from [compiler PR134](https://github.com/CrispStrobe/sb3-creator/pull/134). All four enabled checks succeeded; the declared Pages job skipped. Reviewed, predicted merge and landed trees agree. Its nine added forms cover scene-owned control event registration/raise/wait and multiplayer connection registration, controller event source allocation and raw connection assignment. Fixed player selectors are native fields; connection values retain the selected runtime's actual value semantics. Native services preserve queue order, listener replacement, scene contexts, Stop/restart and the selected Arcade simulator's unconfigured notify mapping. Named and dynamic handlers still need the separate callable service.

The integrated event/scalar/staging/accessor/field/SDK-flag suite passes 32 tests through native Code, same/fresh SB3, selected original export and reimport; 15 further queue/scalar/SPIKE controls pass. The unchanged 433-input parser corpus passes all five controls, including zero unread lines, zero value/condition warnings, decompile fixed points and a failing mutation witness. Source lowering now produces 418 distinct outputs; the historical 417 count remains an older translator observation.

The [event authoring journey](compatibility/arcade-event-authoring.md) is wired after numeric authoring against the same sole admitted production archive and SDK. It prepares visible palette, value/player edits, controller input, Code, fresh SB3 and actual MakeCode export/reimport checks. Preparation and local fixture checks are complete; a fresh hosted event result is required before claiming GUI qualification. Both unit shards and light/heavy browser checks failed on the previous `4c2f901` build; corrections below and mock-lifecycle qualification must finish before merge. The earlier raw profile reported 142 translated, 41 partial and one parse failure; the current immutable audit above supersedes that count. No whole corpus game is promoted by these feature checks.

The subsequent [Build run 38508258984](https://github.com/CrispStrobe/brickwright/actions/runs/38508258984) built reviewed `4c2f901c73c3e98f2b57ef0472473e4c83bbf20a` at actual merge checkout `9b00057c993d6476136be348652ca8801efad921`, with compiler `8796b76eeb6d89a40d8f73bdffd8e78984796770` and Arrays `35719b72bb9280cc1e869616dd5019678f59b2f9`. Its [numeric authoring proof](https://github.com/CrispStrobe/brickwright/actions/runs/38508258984/artifacts/11868444530) passes all five authoring journeys and twelve selected-original comparisons with empty page errors. The original proof ZIP SHA256 is `ed4ab5eca8a69bdcb0ccb2005ad01de0a3f351b9517a496ed15b0dc610109d4c`. Light and heavy browser checks failed; unit checks were still running when this checkpoint was recorded. Keep these failures separate from the successful numeric journey.

Follow-up resource integration fixes a staging regression: a fully validated literal `tiles.createTilemap` factory must retain its private literal tile-image array for static resource decoding. Lexically shadowed SDK receivers and effectful or malformed factories retain normal evaluation and diagnostics. Ten focused controls pass, including existing generated-factory original/native/Code/SB3/export/reimport cases and direct-resource Code/export roundtrips. Fresh hosted camera, terrain and tile identity checks remain required. Two math tests now inspect actual native dropdown contracts and numeric outcomes rather than obsolete opcode/text assumptions; both pass without changing their expected numeric results.

The official [Build run 38504674776](https://github.com/CrispStrobe/brickwright/actions/runs/38504674776) built reviewed source `8d7f9776ac9d812289c26f696749968d0d65dcfa` at actual merge checkout `c3366ca72639e902cd792557b401effa4a92626b`. Build, light browser, heavy browser and numeric authoring succeeded. Unit shard 2 has 51 distinct failure blocks; shard 1 was cancelled. This is not an all-checks-passing integration or a corpus promotion.

The [numeric authoring proof](https://github.com/CrispStrobe/brickwright/actions/runs/38504674776/artifacts/11867327857) covers unchanged import, visible palette/dropdown/number edits, edited Code → Blocks, fresh-session SB3 reopen and actual MakeCode export/reimport. Twelve original execution comparisons preserve expected variables and complete rendered frames; browser errors are empty. The proof admits the actual production artifact, selected SDK and immutable supplier inputs. It qualifies the owned numeric/settings/source-loop game, not the 41 partial corpus projects.

Fixed native dropdown fields now preserve edited math operations, Text Sprite properties and Sprite Data types through Code and export. Recognized old literals and owned menu shadows migrate; computed or malformed fixed selections remain diagnostics. Compiler [PR130](https://github.com/CrispStrobe/sb3-creator/pull/130), [PR131](https://github.com/CrispStrobe/sb3-creator/pull/131), [PR132](https://github.com/CrispStrobe/sb3-creator/pull/132) and [PR133](https://github.com/CrispStrobe/sb3-creator/pull/133) merged after all four enabled checks passed, with the declared Pages skip and matching reviewed/predicted/landed trees.

The next integrated source adds typed scalar cells and selected PXT evaluation order, using canonical supplier `8796b76eeb6d89a40d8f73bdffd8e78984796770` and 370 forms. [Source scalar declarations](ARCADE-SOURCE-SCALARS.md) bind actual stock variable IDs, initialize typed undefined before source initializers and preserve ordinary Scratch saved defaults. Directed export flow preserves scalar types and the separate reference graph. Nineteen evaluation-order cases, staged field initializers, accessor side effects, source defaults/rename/reload/callbacks and bounded SDK `Sprite.setFlag` pass 11 combined tests through native authoring and selected original export. Twenty-eight scalar/dropdown/SPIKE controls, 22 version/prefix/type controls and the committed mirror gate pass. These additions need their own fresh official GUI qualification after this integration.

```text
DEVICE ARCADE
GLOBAL count
SPRITE Game:
WHEN arcade source starts:
  declare arcade source scalar count as Number
  set count to 0
```

The declaration is a source prelude, not an ordinary flag-time reset. Blocks use a connected stock variable reporter and a fixed type field. Graphics/class design, completion/signature help and debugger inspection remain tracked in [the GUI ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md). Typed reference preinitialization, captured callables/dynamic callees, event-bus/multiplayer authoring and full subclass drawing services remain separate ongoing lanes. Keep their unqualified domains explicit. That historical raw profile was 184 / 142 translated / 41 partial / 1 parse failure. Use the current immutable audit above; no whole corpus game has been promoted from these focused controls.

### Integrated accessor and Scene slices — 2026-10-14

The ordinary getter/setter slice is integrated without the experimental general
PXT staging or scalar prototypes. It retains inherited virtual halves, real
accessor bodies and aliases, managed cancellation, source restrictions and
receiver/quoted-string hygiene. Five integrated descriptor controls and one full
original/native compound-assignment authoring route pass. Full
isolated qualification and remaining package/GUI work are recorded in
[the accessor contract](compatibility/arcade-class-accessor-scope.md).

The [Scene flag/controller slice](compatibility/arcade-scene-flags-controller.md)
now preserves the selected SDK's conditional z/public-ID selection sort, live
render masks, transparent parent artwork and real controller state. Eleven
isolated authoring, four rendering and 24 phase controls pass. One full
original/native authoring control passes on integration. The native Scene flag
palette default now has a numeric editor shadow while connected reporters
retain their actual primitive values. Production GUI qualification remains open.
The combined merged Settings/Scene supplier pin has 369 canonical forms.

Official source-manifest checks continue to reject changed tracked build inputs.
The latest rejected build identified one stale migration mirror; it is corrected.
The existing committed mirror gate now runs in the bounded source suite before
heavy integration, preserving the final manifest check.

### Settings and array authoring — 2026-10-14

The latest official GUI build passed artifact admission, then exposed a real
Settings serialization defect: compiler menu inputs did not match native fixed
dropdown fields, so the editor replaced StringArray with Number. The paired
supplier correction is [producer PR129](https://github.com/CrispStrobe/sb3-creator/pull/129).
It preserves all supported type fields and genuine old literal menu shadows;
computed or malformed legacy types are diagnosed before replacing the open
project. The supplier passes 606 expanded compiler/dialect/SPIKE controls;
12 consumer controls include the actual native menu metadata and project-load
boundary. Export and type inference now read the same native field or validated
historical literal; 13 original/native/Code/saved-project/export/reimport
Settings controls pass, plus four serialization-version and refusal controls.
The default canonical array bundle passes its three full authoring controls.
Producer PR129 merged after all four enabled checks passed, with the declared
Pages skip and matching reviewed/landed tree. Fresh production GUI qualification
remains required.

[Producer PR127](https://github.com/CrispStrobe/sb3-creator/pull/127) and
[extension PR43](https://github.com/CrispStrobe/extensions/pull/43) merged with
successful enabled checks and matching reviewed/landed trees. Their three
array/string reporters preserve shallow copy identity, nested aliases and
selected PXT UTF16 indexing semantics. Integration now vendors those canonical
bytes through the standard scoped bundle generator and adds the isolated
array-copy/import/export slice. This array slice added three canonical
forms; the combined current supplier inventory is recorded above. Reporter availability is not whole-game qualification.

The official integration unit failure audit is ongoing. Distinct failing test
blocks must be counted from actual failure records, excluding repeated log
output and quoted examples. These counts never substitute for the unchanged
41 partial corpus projects.

### Latest integration work

The integration branch now includes managed class/object references and static
visibility metadata using producer [PR125](https://github.com/CrispStrobe/sb3-creator/pull/125),
which merged after its enabled checks passed. Ordinary inheritance and the bounded
SDK Sprite subclass slice are implemented and qualified below. Structured class
authoring, drawing overrides and other intrinsic subclasses remain separate gaps. Source-entry
palette editing and exact array helper recognition are repaired; scoped Arrays
bundle provenance matches the selected immutable dependency.

[Scene timer authority](compatibility/arcade-scene-timer-authority.md) now uses
per-scene workers, shared condition polling and owned source wait deadlines.
The isolated implementation passes 72 strict controls without skipped tests or
TODOs. Recorded genuine Cherry startup and countdown boundaries match the
unchanged original, including game over at 60,140 ms. The full probe's final
unsupported event observer failed; the saved timing rows passed a separate
read-only audit. This does not establish unseeded trajectory, full graphics or
installed GUI cadence.

Projectile finalization now applies the selected SDK's default flags after
creation handlers and preserves retained destroyed references, tile-map edge
placement and camera offsets. FreeThrow passes 44 raw and 90 authoring route
controls across Code, same/fresh SB3 and prepared export/reimport. Full GUI
qualification and unresolved asset licences still prevent whole-game promotion.
The integrated inheritance/callback/heap/reload gate passes 16 controls. The
full ordinary inheritance candidate passes 17 original/native authoring controls;
[producer PR126](https://github.com/CrispStrobe/sb3-creator/pull/126) merged after all
four enabled checks passed; its reviewed and landed trees match. Canonical mirrors
and the 363-word inventory agree.
Constructor and method string defaults are refused by the selected original SDK;
native admission preserves those errors.

The bounded SDK Sprite subclass slice retains canonical native Sprite identity,
scene-local public IDs, image aliases and virtual constructor ordering. Raw Sprite
and ExtendableSprite constructors retain their different physics and creation
services. The frozen original/native/authoring suite passes 27 controls; after
reserved internal descriptor refusal, the final SDK suite passes 11. Affected
object-heap and renderer suites pass 13 and five respectively. Four source
mutations are detected, and 503 source, VM and SDK inputs remain unchanged across
the final gate. Four focused controls pass on integration. Handle lifetime is
qualified within one loaded JavaScript realm; it does not establish persistent
live handles across fresh realms. Drawing, update and hitbox overrides and
status-bar accessors remain named admission boundaries.

The bounded SDK dialog bridge now preserves BaseDialog/SplashDialog object and
image identity through the existing managed class vocabulary. Seven integrated
controls pass: actual original/native complete image pixels, Code, original
export, reimport and same/fresh SB3, including fractional truncation and
zero/negative default-frame dimensions. Seven unrelated diagnostics remain in
the genuine multiplayer splash source. Oversized fault continuation, custom
frame/font/subclass and production GUI behavior retain their explicit boundaries
in [the dialog contract](compatibility/arcade-sdk-dialog-objects.md).

Saved-project device publication now listens to actual project load, preserves
newer explicit board selection and rejects late callbacks. Whole-project loads
clear stale STC metadata; sprite imports retain it. Twelve headless controls
pass, including real SB3 save/reload and sprite import. Fresh production GUI
restoration is still pending. Read [the device-pane contract](ARCADE-SB3-DEVICE-PANE.md).

Static SDK namespace receivers survive conditional argument lowering with
lexical shadow checks. Fourteen controls pass. A separate selected-PXT argument
staging mismatch remains: the original compiler can stage a later conditional
before an earlier argument call. The passing bounded namespace case does not
qualify that broader evaluation order.

The clean `947130db87` audit newly compiles all 41 contexts and retains **29
original-valid / 12 original-invalid / 19 strict structural candidates**, with
unchanged compiler results, binaries and resolved inputs. Separate evidence-bound
source-context repairs produce **37 original-valid / 24 structural candidates**:
they recover exact earlier tutorial setup or author-declared dependency contexts,
retain unchanged main/assets and preserve the failed envelopes. They do not
rewrite the immutable raw census or establish complete games.

Hero passes 101 and the recovered projectile demo passes 195 finite original/native
and authoring route controls. Wakanda passes 214 finite controller, complete-frame
and authoring route controls from its explicitly recovered context. Its source
contains no point-loss handler or terminal, so neither is invented for acceptance.
Genuine Corgio browser journeys verify imported map
and art, controller-to-win behavior, Code roundtrip, all coral costume pixels,
actual tile pixel editing, level painting, undo/redo and Save with unchanged walls
and other cells. Painted-level controller repetition, fresh-project device/pane
restoration and the matching later timer build remain unresolved. These observed
routes do not promote the 41 raw partial projects to full GUI compatibility.


Managed Arcade caller frames now preserve ordinary Scratch procedure recursion
checks. Scalar results and early void returns match the selected original SDK,
and native Code/export/reimport/SB3 routes pass. Two real-thread adversaries verify
that only the owned non-executable caller root is exempt from block lookup;
missing executable frames remain errors.

The [numeric authoring GUI](compatibility/arcade-numeric-authoring-gui.md) now has
an explicit CI consumer of the completed official build. Source/SDK manifests,
official run/job/artifact identities, archive safety and extracted asset bytes
are checked before the real editor journey. The 47 workflow controls pass,
including partitioning, deployment dependencies and unchanged wait ceilings.
Actual hosted browser qualification on that new artifact remains pending. The first hosted
attempt stopped in the prerequisite SPIKE artifact test because its exact
producer-pin assertion was stale. The assertion now names the adopted qualified
pin and the complete SPIKE artifact test passes; a fresh official build is required.
The browser audit also retries missing API step records and refuses permanent
absence or duplicates; 27 focused controls pass.

The editor-startup claim [PR893](https://github.com/CrispStrobe/brickwright/pull/893)
merged after all 12 enabled checks passed. The Costumes tab now checks tile-map
block presence through a pure helper; the full painter and its decoding/parser
remain lazy. Twenty-five controls preserve existing discovery for modern,
legacy, computed, malformed and non-editable maps and avoid artwork decoding.
The original startup byte budget is unchanged; a fresh production measurement
is still required.

The draft [integration PR888](https://github.com/CrispStrobe/brickwright/pull/888)
contains source startup and positive-condition loops, invocation-local
`break`/`continue` guards, native text dialogs, StringArray settings, null tilemap
guards, ordered clamp and typed bitwise operations. Producer
[PR120](https://github.com/CrispStrobe/sb3-creator/pull/120),
[PR121](https://github.com/CrispStrobe/sb3-creator/pull/121),
[PR122](https://github.com/CrispStrobe/sb3-creator/pull/122) and
[PR123](https://github.com/CrispStrobe/sb3-creator/pull/123) merged after all enabled
checks passed. The typed bitwise and writable-property vocabulary in
[PR124](https://github.com/CrispStrobe/sb3-creator/pull/124) is also merged.
Refresh the consumer's independent checks before adoption.

The clean `455b529e9c` audit retains every importer warning as a blocker:
**29 selected-SDK compile-valid, 12 compiler diagnostics; 19 of the 29 admit
without unsupported elements, importer warnings or producer warnings; 10 remain
blocked**. This establishes structural admission. The immutable raw census and
the fewer-than20-partial goal remain unchanged pending complete-game evidence.
The prior `dc3fc0d684` checkpoint admitted 18. Static event forwarding admits
Free Throw; declared SDK reference inference preserves Winter's unused typed
sprite helper under the stricter bitwise checker. Opaque and unknown operands
remain diagnosed. Four bitwise controls pass, including original execution,
Code, export/reimport and fresh SB3.

The [scheduler claim](https://github.com/CrispStrobe/brickwright/pull/881)
and [class claim](https://github.com/CrispStrobe/brickwright/pull/889) are
merged. Actual product phase controls cover source bootstrap, due continuations,
a shared work budget, owned host-turn continuation, managed callers and Stop/load
cancellation. The combined scheduler, bitwise and writable-flags backend gate
passes 32 controls. An additional actual reload control verifies that a cached
driver resumes only after successful project load and detached drivers stay
disposed; the combined phase/lifecycle gate passes 25 tests. Eight strict terminal/callback controls match original
program and scene clocks, full pixels and sound. Earlier failures remain retained.
The headless fixture now follows the production duplicate-extension guard.
Earlier source disposal during load permanently disabled the cached phase driver;
the product fix rearms a new generation on successful load.
Matching installed GUI, native debugging and original 50 fps versus compatibility
mode 30 fps behavior remain open; these controls do not promote whole games.

Follow [the GUI ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md). The prepared
numeric/settings/loop editor journey requires a matching production artifact.
[ShowPhysics](compatibility/arcade-show-physics.md) has original full-pixel and
Code/SB3/export/reimport controls; general debugger graphics remain separate.
[Writable flags](compatibility/arcade-writable-flags.md) preserve raw primitives,
destruction masks and clipping state; seven original/native/Code/SB3/export/reimport profiles pass, including raw
string/null/undefined values and clock-bound stationary physics.
[Typed bitwise values](compatibility/arcade-bitwise-values.md) preserve unsigned
shifts and once-only argument order, with explicit opaque-reference diagnostics.

Statically bound callable helpers now forward into the existing SDK event
registration schema through managed procedure calls. Truth guards preserve the
known callable value, and opaque/stored callable values remain diagnosed. Original,
Code, fresh SB3 and export/reimport controls cover button yields and overlaps.
The real FreeThrow prepared project has zero conversion or producer diagnostics;
its complete-game, asset-notice and GUI gates remain separate.

Bounded complete-source authoring routes for Maze and Corgio also pass: Code,
saved project reload in the same and fresh VM, actual artwork-aware export,
original SDK execution and native reimport. The tested controller paths retain
Maze's win/loss and Corgio's win, sampled full gameplay pixels and sound. These
are runtime and serialization results. Actual editor edits, installed controller
use and cadence remain separate requirements. Cherry Pickr retains a precise
Splash-resume timing failure: original condition polling and immediate native
continuation produce different startup and terminal times. Preserve that failure
while implementing shared polling semantics; do not add a game-specific delay.

Class implementation follows explicit reference identity, original constructor
order and receiver binding. Parser support alone does not admit runtime classes.
Keep the genuine selected-SDK do-while discrepancy and unsupported library
operations visible while completing source, whole-game and GUI qualification.

## Current integration checkpoint — 2026-10-13

The lower runtime and Buffer stack is integrated into main through
[PR856](https://github.com/CrispStrobe/brickwright/pull/856).
The next source stack is PR858, PR859, PR861, PR862, PR864, PR865,
[PR869](https://github.com/CrispStrobe/brickwright/pull/869) and
[PR870](https://github.com/CrispStrobe/brickwright/pull/870);
refresh their actual heads and checks before adoption. Follow the latest
`LANES.md` ownership, including the independent device and board work.

The higher integration adds exponentiation and original-compatible `Math.pow`,
full-precision numeric constants, original image/tilemap factory generation
before compilation, and own-key SpriteData semantics. Retained generic function
types, constructor properties and destructuring syntax now parse, but parsing
alone does not implement classes or destructuring execution. The pinned original
compiler rejects the tested active destructuring forms as well; preserve that
source boundary instead of using those tests to promote corpus cases.

Original root image and tilemap companions are generated only when absent;
authored companions and input bytes are preserved. An authentic recovered map
matches all 800 indices and wall flags and four tile images in original/native
observations. Random art and unreached callbacks remain unqualified. A prior
original compilation succeeded with a black screen because image factories were
missing: compiler success alone is insufficient acceptance evidence.

The immutable raw census remains **142 translated /41 partial /1 parse-failed**.
A prepared-context census and finite execution proofs are separate records.
The requested fewer-than20-partial checkpoint has not been established.
Next priorities are typed Settings persistence, original-supported library and
class operations, execution residuals, and visible authoring journeys. Continue
through those areas without counting focused controls as whole-game success.

The [native frame scheduler contract](ARCADE-FRAME-SCHEDULER.md) records the
open startup and pause/callback phase limits and the claimed implementation
envelope. Merge that lane claim before changing the product hook; finite
prototype traces do not close its exact timing or installed-GUI gates.

## Current-state refresh — 2026-10-11

The earlier runtime and documentation stack through scrolling is integrated into
main. PR773/774 were closed rather than individually merged; their commits are
ancestors of main through subsequent stack integration. The old template-clone
layer failure was repaired in [PR775](https://github.com/CrispStrobe/brickwright/pull/775),
with successful light/heavy browser checks in
https://github.com/CrispStrobe/brickwright/actions/runs/38051987912 .
Do not repeat that already completed lane based on section6's historical state.

Subsequent merged work includes particles, screen painting, music, core values,
game over, terrain/translator gaps, sevenseg, darts/corgio, scroller, character
animations, the original HUD and original-compiler extension fetching (PR776–788).
Original-compiler fetching does **not** implement editable native extension blocks.
The producer pin at the refreshed baseline is
`44d11124a725d209387ec524c6871d0356add3f3`; read current pins before any adoption.
[PR785](https://github.com/CrispStrobe/brickwright/pull/785) reports142 of184
translating. [PR789](https://github.com/CrispStrobe/brickwright/pull/789)
reports the unchanged, hash-verified **142 translated /41 partial /1 error**
census. These reports supersede109/74/1; a fresh exact-source audit remains needed.

The following authoring lanes are now merged, with enabled latest-head checks
successful and DONE claims in LANES:

- https://github.com/CrispStrobe/brickwright/pull/789 : readable art names,
  multi-costume animation holders and paint-editor edits reaching native games.
- https://github.com/CrispStrobe/brickwright/pull/790 : tilemap painter,
  new-level creation and its real-pointer browser journey in the CI light shard.
- https://github.com/CrispStrobe/brickwright/pull/791 : two-way fe/Tcl rescue
  and lazy-converter race repair preserving typed Code and debugger state.

The active Arcade lane is `lane/arcade-painted-project-roundtrip-20261011`,
claimed on main at `11529ce16d597d0d78d57731f1ce4fbddfb194cf`.
Its existing CI browser journey now additionally checks actual downloaded SB3
contents, fresh-context GUI reopening, every map/wall/tile pixel and block ID,
restored painter editing/undo, exact native startup map state, original MakeCode
compilation/rendering and actual downloaded MakeCode file reimport. Reported
hashes identify the fixture, probe, SB3 and MakeCode downloads; served script URLs
identify the consumer bundle. A prepared-build local pass is not exact-source
hosted qualification. Archive originals and inspect the latest-head light-shard
result before closing the lane. The original rendering check establishes that
export compiled and drew a frame; it does not prove whole-game frame equality.

Remaining tilemap authoring work: exported `myTiles` names/asset identity,
legacy colour-coded maps and painter sprite placement. Native editable support
for remaining third-party extensions and exact-source ranking of41 partials
remain separate lanes. The circuit green-flag first-write failure is owned by
another session; preserve that lane's assertions/bounds and diagnose failures
without treating unrelated browser retries as a feature fix.

## 1. Two-line starter prompt

> Read `docs/ARCADE-AGENT-HANDOFF.md`, its local companion when available, and the linked capability/lane records before editing.
> Refresh remote heads/checks, claim an isolated next lane, and close it across runtime, authoring, interchange and real GUI evidence; preserve failures and exact identities.

The local companion contains an absolute-path version usable from the operator's
workspace root. Neither prompt requires earlier conversation or session logs.

## 2. Objective and meaning of completion

A user must be able to build an Arcade game in Brickwright Code/pseudocode,
Blocks and the graphics/resource editors, run it natively, save/reload it, export
it and run the export in original MakeCode Arcade. Importing the original again
must preserve assets, values, behavior and editable authoring. Conversion-only
support is insufficient. Normal MakeCode/micro:bit and Scratch-format conversion
remain separate measured targets. TurboWarp-specific compatibility is not
established by an SB3 structural audit.

Do not obtain `partial = 0` by hiding diagnostics, dropping inputs, replacing
unsupported constructs with comments/no-ops or reclassifying untested features.
`translated` means the importer reported no named gaps; it does not mean a game
is behaviorally equivalent or fully editable. Full authoring and execution gates
must also pass. Some hardware-specific capabilities require an explicit target
boundary, rather than a fabricated browser equivalent.

## 3. Authoritative records and complete capability inventory

Read these in order. They contain the existing implementation history, API
families, graphics/GUI gaps, asset contracts and planned acceptance criteria;
this guide explains how to work and how to interpret their evidence.

| Record | Role | Full repository URL |
| --- | --- | --- |
| [LANES.md](../LANES.md) | Ownership, branch claims and checkpoints | https://github.com/CrispStrobe/brickwright/blob/main/LANES.md |
| [Capability and GUI ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md) | Complete conversion/runtime/authoring capability write-up and separate remaining GUI gaps | https://github.com/CrispStrobe/brickwright/blob/main/docs/CONVERSION-CAPABILITIES-AND-GUI-GAPS.md |
| [Arcade compatibility plan](ARCADE-COMPAT-PLAN.md) | Export mappings, named refusals and authoring closure | https://github.com/CrispStrobe/brickwright/blob/main/docs/ARCADE-COMPAT-PLAN.md |
| [Screen/render contract](ARCADE-SCREEN-RENDER-CONTRACT.md) | Indexed frame, render ordering and S01–S05 prerequisites | https://github.com/CrispStrobe/brickwright/blob/main/docs/ARCADE-SCREEN-RENDER-CONTRACT.md |
| [Animation interchange](ARCADE-ANIMATION-INTERCHANGE.md) | Images, resources, animation bindings and preservation | https://github.com/CrispStrobe/brickwright/blob/main/docs/ARCADE-ANIMATION-INTERCHANGE.md |
| [Public API census](generated/MAKECODE-PUBLIC-API-CENSUS.md) | Pinned declaration candidates; not a support denominator | https://github.com/CrispStrobe/brickwright/blob/main/docs/generated/MAKECODE-PUBLIC-API-CENSUS.md |
| [Authoring vocabulary](generated/ARCADE-AUTHORING-VOCABULARY.md) | Generated editable words and coverage joins | https://github.com/CrispStrobe/brickwright/blob/main/docs/generated/ARCADE-AUTHORING-VOCABULARY.md |
| [Historical compatibility audit](generated/ARCADE-COMPAT-AUDIT.md) | Per-input diagnostics at its recorded older source | https://github.com/CrispStrobe/brickwright/blob/main/docs/generated/ARCADE-COMPAT-AUDIT.md |
| [Historical permutations](generated/CONVERSION-ROUNDTRIPS.md) | Structural/asset roundtrip report, not behavioral proof | https://github.com/CrispStrobe/brickwright/blob/main/docs/generated/CONVERSION-ROUNDTRIPS.md |
| [Receipts](receipts/) | Exact tested source and bounded observations | https://github.com/CrispStrobe/brickwright/tree/main/docs/receipts |

`main` links are discovery links: these stacked changes may not be merged there.
For the complete implemented snapshot through scrolling, use
https://github.com/CrispStrobe/brickwright/tree/86a6335e55abea0c233d63118d4295e39a848842 .
Open the same relative paths at that immutable commit if main lacks them.
Older generated reports, plan paragraphs and private corpus READMEs retain their
historical counts. Do not silently treat them as a fresh census.

## 4. Repositories, pins and original sources

- Consumer: https://github.com/CrispStrobe/brickwright . Native VM,
  importer/exporter, GUI, overlay integration and qualification scripts.
- Producer: https://github.com/CrispStrobe/sb3-creator . Shared Code parser,
  decompiler, dialect/opcode/menu schema and generated examples. Do not fork a
  second parser into Lite to make a test pass.
- Producer snapshot: https://github.com/CrispStrobe/sb3-creator/tree/eca752b7011656b9e73917bc6f816ffed24ad4b9 .
  This is the current Arcade stack's `vendor-pins.json` producer pin, not a
  statement about producer main or unrelated dependency pins.
- Producer image scroll/copy work: https://github.com/CrispStrobe/sb3-creator/pull/82
  and https://github.com/CrispStrobe/sb3-creator/pull/83 . Refresh actual state.
- Original Arcade source: https://github.com/microsoft/pxt-arcade/tree/2d7d59b5226e8a1a1e05e8042dd9f5248ed68fea
  (`v4.2.1`). Core: https://github.com/microsoft/pxt/tree/v13.2.1 .
- Normal MakeCode source: https://github.com/microsoft/pxt-microbit/tree/v9.1.1
  and https://github.com/microsoft/pxt/tree/v13.0.1 .
- Original editor: https://arcade.makecode.com/ . Hosted original execution in
  tests uses the pinned local simulator, not whatever editor version is live.

Read `vendor-pins.json`, the prepared runtime's `VERSIONS.json` and notices at
startup. The pinned Arcade declaration bundle recorded SHA-256
`6f35aadf1456436b3318d2f2339cc3d1add6e6c3b0bf8566f86d7f7bb4f7722e`.
Prefer exact pinned target contents over a newer upstream API when qualifying
this source. Dependencies and pin moves must be reviewed and explicit.

## 5. Latest measured corpus and what it proves

The locked original Arcade set contains **184 inputs**: **109 translated,
74 partial, 1 malformed**. Latest importer-changing evidence is
[the follow receipt](receipts/2026-10-09-arcade-sprite-follow.json), tested source
`3c4493c1eb8f68343234e86141ebd9c9e8a277f8`, preserving all184 original hashes.
Subsequent render/speech fixes did not rerank that corpus. Do not infer an
improvement from passing runtime tests or the hosted dialect corpus gate.

Other denominators are distinct: original MakeCode inputs across both targets,
full tutorial projects, captured importer test inputs, shipped Brickwright
examples, Scratch-format SB3 fixtures and conversion permutations. Assets absent
from plain text are an explicit structural loss, not proof that the SB3 exporter
cannot preserve assets. Original-PXT compile failure is separate from importer
failure and exported compile failure. Record all of them.

## 6. Active stack and current blocking check

All three recent implementation PRs remain **draft/open**, not merged:

| PR | Branch | Reviewed implementation | Current published head |
| --- | --- | --- | --- |
| https://github.com/CrispStrobe/brickwright/pull/771 | `lane/arcade-native-legacy-bubble-20261009` | `d51cf93c7bcfd0bc62b9c9035d686651208939d8`; assertion repair `5c7b0435f7c3bf4175d4fb62c09f3bcb31c03c88` | `4e68ebbb8f96b3724ef96c4f84adbc24bf3e4c4e` |
| https://github.com/CrispStrobe/brickwright/pull/772 | `lane/arcade-speech-hitbox-20261010` | `f6b48a499dce678c91cef052fcde424c90a6413a` | `25ae4f5d5e03caef043acb45d3e2456f7b968e19` |
| https://github.com/CrispStrobe/brickwright/pull/773 | `lane/arcade-native-speech-scroll-20261010` | `7b158d559d92041a3d6893c29b2851dc6e5b8747` | `86a6335e55abea0c233d63118d4295e39a848842` |

PR773 is based on PR772's branch; PR772 on PR771; PR771 on PR770's
`lane/arcade-negative-kind-20261009`. Earlier PRs remain part of the stack.
Inspect bases and merge state before integrating any of it.

**First next task: investigate the real hosted light-browser pixel failure.**
The PR773 exact-head build, corpus, check, heavy browser and FPGA surface passed;
light browser failed. Deploy and verify-gui skipped downstream of that failure.
PR771/772 light checks also failed; earlier notes saying queued are superseded.

- Official run: https://github.com/CrispStrobe/brickwright/actions/runs/38025509301 .
- Failed job: https://github.com/CrispStrobe/brickwright/actions/runs/38025509301/job/114146423199 .
- Artifact metadata: https://api.github.com/repos/CrispStrobe/brickwright/actions/artifacts/11662660346 .
- Official artifact ZIP endpoint: https://api.github.com/repos/CrispStrobe/brickwright/actions/artifacts/11662660346/zip .
- Artifact name `arcade-rotation-browser`; report `current.json`.
- Failure is `waitLayerPixel` at script line657, called at664 in that exact head:
  initial sprite-layer centre RGB `[255,33,33]` was not observed in30seconds.
- Fixture `test/fixtures/arcade-sprite-layer-routing.mjs`; red Player/front z1
  and yellow Enemy/back z0 at80,60. `layerReady=true`, `layerPhase=0` were present.
- Report contained two native sprites, device `arcade`, stepping true,
  no page errors, no block errors and no diagnostic entries. The preceding
  multiplayer journey had completed. These observations do not establish why
  the renderer pixel failed; do not call it a flake or waive the assertion.

Inspect the actual report/screenshot and native indexed centre pixel, drawable
z ordering, canvas backing size/readiness, palette, visible device-pane pixels
and actual loaded bundle identity. Determine whether source, presentation or
harness is wrong. Preserve the original failure and keep the intended pixel and
controller checks. Do not fix a failure solely by increasing its timeout.

## 7. Historical render prerequisites and evidence map

Each link is a separate lane and bounded receipt, not a merge or full-game claim.

| Area | PR | Public receipt |
| --- | --- | --- |
| Native follow; last109/74/1 ranking | https://github.com/CrispStrobe/brickwright/pull/759 | [follow](receipts/2026-10-09-arcade-sprite-follow.json) |
| Sprite properties/layer routing | https://github.com/CrispStrobe/brickwright/pull/760 | [layers](receipts/2026-10-09-arcade-sprite-layers.json) |
| Original numeric sign | https://github.com/CrispStrobe/brickwright/pull/761 | Capability ledger's numeric sign section |
| Native info/browser typed observations | https://github.com/CrispStrobe/brickwright/pull/762 | [browser repair](receipts/2026-10-09-arcade-info-browser-repair.json) |
| Image.scroll | https://github.com/CrispStrobe/brickwright/pull/763 | [scroll](receipts/2026-10-09-arcade-image-scroll.json) |
| Image.copyFrom | https://github.com/CrispStrobe/brickwright/pull/764 | [copy](receipts/2026-10-09-arcade-image-copyfrom.json) |
| Indexed background/sprites | https://github.com/CrispStrobe/brickwright/pull/765 | [frame](receipts/2026-10-09-arcade-indexed-frame.json) |
| Native indexed tile layers | https://github.com/CrispStrobe/brickwright/pull/766 | [tiles](receipts/2026-10-09-arcade-indexed-tiles.json) |
| Modern speech compositor | https://github.com/CrispStrobe/brickwright/pull/767 | [modern speech](receipts/2026-10-09-arcade-indexed-modern-speech.json) |
| Global speech deadlines | https://github.com/CrispStrobe/brickwright/pull/768 | [clock](receipts/2026-10-09-arcade-speech-global-clock.json) |
| Legacy camera bridge | https://github.com/CrispStrobe/brickwright/pull/769 | [camera](receipts/2026-10-09-arcade-legacy-speech-camera.json) |
| Negative numeric sprite kinds | https://github.com/CrispStrobe/brickwright/pull/770 | [negative kinds](receipts/2026-10-09-arcade-negative-kind.json) |
| Native legacy bubble identity/callbacks | https://github.com/CrispStrobe/brickwright/pull/771 | [ownership](receipts/2026-10-09-arcade-native-legacy-bubble.json), [hosted gate repair](receipts/2026-10-10-arcade-hosted-gate-repair.json) |
| Scaled/rotated owner placement | https://github.com/CrispStrobe/brickwright/pull/772 | [hitbox](receipts/2026-10-10-arcade-speech-hitbox.json) |
| Frame-replayed native scrolling | https://github.com/CrispStrobe/brickwright/pull/773 | [scrolling](receipts/2026-10-10-arcade-native-speech-scroll.json) |

The complete earlier conversion additions (types, references, arrays, closures,
classes/namespaces, callbacks, scenes, controllers/multiplayer, physics, assets,
animations, palettes, tiles, dialogs and resource editors) are written in the
capability ledger. Follow its per-feature sources/tests instead of treating this
recent speech-focused table as the entire app's capability list.

## 8. Source ownership map

| Layer | Files/directory | Rule |
| --- | --- | --- |
| Arcade import | `overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js` | Typed/literal/asset translation and named unsupported diagnostics |
| Arcade export | `overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js`, `arcade-runtime.js` | Native PXT output/helpers; compile and run the real export |
| Values/types/resources | Same directory: `value-type-graph.js`, `declared-value-types.js`, `pixel-image.js`, `arcade-assets.js`, `arcade-animation-assets.js` | Preserve alias/type/asset identities and exact pixels |
| Native Arcade VM | `overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js` | Factory-generated extension, native scene/physics/image/callback state |
| Speech bridge | Same directory: `speech.js`, `speech-pxt.js`, `speech-native-legacy.js`, `speech-fonts.json` | Retained original glyph/renderer source; attributed resumable adaptation |
| Images/rotation | Same directory: `image.js`, `image-pxt.js`, `rotation-pxt.js` | Actual indexed images and original math/geometry |
| Shared authoring | Producer repo plus Lite `overlay/scratch-gui/src/lib/sb3-creator.js`, `arcadeDialect.js` | Change producer then official sync; no private parser fork |
| Controller/display | `overlay/scratch-gui/src/components/tw-pseudocode/arcade-device-pane.jsx`, `overlay/scratch-gui/src/lib/bw-arcade-device-frame.js` | Real user controls and renderer-backed display |
| Graphics/resources | `overlay/scratch-paint/`, `overlay/scratch-gui/` resource/editor integrations | Layered source, UUIDs, image/animation/tile metadata, palette and SB3 persistence |
| Original oracle | `test/helpers/pxt-arcade-runtime.mjs`, `scripts/lib/pxt-node.mjs` | Actual pinned compiler, simulator and fibers |
| Integration helpers | `scripts/apply-vm-overlay.mjs`, `scripts/integrate.mjs`, `test/helpers/bw-integrated.mjs`, `scripts/lib/register-gui-scope.mjs` | Source ownership and explicit prepared dependency root |

Edit tracked overlay sources, not only ignored prepared `packages/` files.
The factory serializes exported functions into the extension: a helper that
works through a module-scope Babel binding may vanish in the actual bundle.
Qualify both fresh development and production extension bundles.

## 9. Repeatable implementation cycle

1. Read applicable AGENTS files and these records. Inspect remotes, branch,
   worktrees, status, producer pins and current checks. Refresh narrow refs.
   Confirm the lane has not already been completed elsewhere.
2. Work in an owned isolated tree; record claim, affected files, branch/base and
   acceptance criteria in `LANES.md`. Follow its claim coordination rules.
   Do not reset, stash, clean, switch or overwrite somebody else's dirty tree.
3. Rank actual named corpus gaps. Pick one semantic family and an unchanged
   original app that needs it. Write the exact contract from pinned original
   source, including edge cases, ordering, timing and invalid/null/undefined data.
4. Demonstrate the current failure against actual original execution. Preserve
   source/inputs, command, versions, logs and original outcome. A harness failure
   is evidence about the harness, not an app bug.
5. Implement the native semantics. If new authoring words/schema are necessary,
   add them to shared producer, parser/decompiler, native Blocks metadata and
   runtime, then update importer/exporter and graphics/resource persistence.
   Reuse arrays extensions where appropriate, with real identity semantics.
6. Test original native behavior, authoring roundtrips, assets and browser users
   separately. Run affected regressions, not an indiscriminate local full build.
7. Commit implementation; record its immutable tested SHA. Keep prose/receipt
   checkpoint separate so the receipt never claims its own future hash was tested.
8. Normal push and draft PR with explicit base/stack and bounded evidence.
   Use a body file/structured argument, preserving real newlines. Archive raw
   private originals plus source patch/receipt/checksums before disposal.
9. Refresh all enabled exact-head checks. Merge only with authorization, all
   required checks successful, reviewed head matching and declared skip policy;
   use `gh pr merge ... --match-head-commit <reviewed-SHA>`. A green older head,
   subset of jobs or broad heavy shard does not clear a failed Arcade journey.
10. Re-measure the unchanged locked corpus when importer coverage actually
    changes. Record hashes, denominator and changed rows; update all capability,
    GUI, lane, receipt and handoff sections affected by the new evidence.

Parallel agents require explicit authorization, isolated worktrees and disjoint
file ownership. Do not delegate overlapping edits to the central importer or VM
class. Root integrates and reviews; a read-only independent audit is useful when
it can compare an exact final source/evidence boundary.

## 10. Original-PXT comparisons and clock methodology

`runPxtArcade` compiles `main.ts`/`pxt.json` with the prepared pinned target, serves
its actual simulator in Chromium, uses the original runtime/class dispatch/fiber
scheduler and returns scalar globals. Supply dependencies for optional packages
(e.g. multiplayer or color-coded tilemap). Use `waitForGlobals` for callbacks
that continue after main returns. The helper's completion is not a full-game win.

For complete planes, capture original `screen.getPixel(x,y)` into19200 palette
indices after the frame rendered. Prefer indexed values over RGB: custom
palettes, duplicate RGB colors and explicit color-zero writes can hide errors.
Compare native `bwArcadeDeviceState.sceneFrame.pixels`, coordinates, IDs, flags,
image dimensions, aliases and memberships independently. Hashes alone need
collision/boundary awareness; preserve actual pixels for failures.

For scrolling, the fixture registers an original diagnostic-priority150 handler
(after render90), records every original `game.eventContext().deltaTime`, captures
every observed bubble image and samples completed stage planes. Speech is
created after three update callbacks, not only at startup. Replay those exact
deltas through native `ARCADE_FRAME` events after authored initialization. Compare
all observed bubble pixels, the full samples and an actual return to the initial
image after scrolling. Test default speed, duration-dependent speed and both
6x8/12x12 font selections. Arbitrary wall-clock pauses and a different number of
native frames are not a valid timing comparison.

Current result at `7b158d559`:45 distinct checks, zero failures/skips. Shared
batch44 plus final3 repeats/strengthens two cases and adds international text.
Final traces replay921 frames, compare915 bubble images/1303328 pixels and
41 full planes/787200 pixels. This does not qualify suspension/modal clocks,
yielding scrolling constructors, complex reentry or shipped GUI presentation.
See `test/makecode-arcade-native-speech-scroll.test.mjs` for the runnable method.

## 11. Native pitfalls established by original execution

- Negative kinds keep scene/physics/creation callback identity, but original
  `allOfKind(-1)` is empty. Do not exclude negative sprites from overlaps.
  Observe bubbles through `sprites.onCreated(-1, ...)`.
- The legacy bubble is a real independent sprite/image with its own ID, z and
  callbacks. Creation handlers see blank artwork before Ghost/camera/text.
- Original owner destruction leaves the independent legacy bubble alive; owner
  updates and its expiry stop. Earlier assumed automatic cleanup was corrected.
- Native flags differ from the glyph bridge: RelativeToCamera512 maps to2;
  native Ghost7168 corresponds to all three ghost-through flags.
- Restore the originating shared BlockUtility thread/sequencer around Promise
  continuation and creation completion. Do not use whichever callback last
  mutated the shared utility. Respect project epoch and canceled callers.
- Copy global deadline semantics separately from per-scene suspended frame clocks.
  Capture native hitbox top before yielding constructor callbacks; scale/rotation
  and blank artwork invalidate a display-width mask-row guess.
- Initial scrolling hold reads the owning scene current delta, including
  creation within an update callback and resumption after optional allocation.
- Compare booleans as booleans, arrays/handles by semantic identity, NaN and
  signed-zero where relevant. Do not normalize failures to success defaults.
- Native images exist at spawn. Image mutation must preserve shared aliases,
  clone isolation, actual pixel buffers, hitboxes and renderer skin cleanup.
- `sceneFrame.coverage` currently includes background/tilemap/sprites/modernSpeech;
  renderables/HUD/legacySpeech/effects remain gated in `remaining`. Do not expose
  global `screen.clone()` as a background copy or advertise a completed screen API.

## 12. Authoring, assets and conversion permutations

For every newly supported family check the complete chain:

- Original TypeScript/project import to readable pseudocode, without named gaps.
- Pseudocode to native Blocks with correct argument/menu sockets and reporters.
- Blocks back to Code, including callbacks, captures, references and aliases.
- Native execution with actual costumes/resource uploads.
- SB3 save/load/green flag with exact indexed images and source/metadata intact.
- MakeCode export plus original compile and execution with real dependencies.
- Reimport that export and run again; include repeated/permuted conversions.
- Real GUI file chooser/Code entry, To blocks, Blocks editing, graphics/resources,
  controller pane, Stop/restart, save/reload and exported file reopen.

Pass `uploads: imported.costumes, storage: true` to `runProgram` for asset tests.
Keep plain-text `.bw` limitations distinct from binary SB3 preservation. Sprite
images, animation frame/resource identity, JRES/factory assets, palette metadata,
tile maps/wall layers/scales and layered editor sources need their own receipts.
The animation interchange document and ledger provide these contracts.

## 13. Commands and integration discipline

Run from the owned consumer root with Node22 and the prepared dependencies.
Machine-specific binary/dependency/corpus locations are in the local companion.
After **every VM source edit, including formatting**, apply the overlay before
fresh bundle tests:

```sh
node scripts/apply-vm-overlay.mjs
node --test --test-concurrency=1 --import ./scripts/lib/register-gui-scope.mjs test/makecode-arcade-native-speech-scroll.test.mjs
node --test --test-concurrency=1 --import ./scripts/lib/register-gui-scope.mjs test/arcade-browser-bundle.test.mjs
```

Other focused tests: `test/makecode-arcade-native-legacy-bubble.test.mjs`,
`makecode-arcade-speech-hitbox.test.mjs`, `makecode-arcade-speech-hitbox-roundtrip.test.mjs`,
`makecode-arcade-legacy-speech-camera.test.mjs`, `makecode-arcade-speech-global-clock.test.mjs`
and `arcade-speech-render.test.mjs`, all under `test/`.

Producer adoption is explicit and sequential:

```sh
node scripts/sync-sb3creator.mjs --dir "$ARCADE_PRODUCER" --pin
node scripts/sync-sb3creator.mjs --dir "$ARCADE_PRODUCER" --check
npm run integrate
```

`ARCADE_PRODUCER` is a reviewed local source checkout, not an arbitrary current
main. The producer must be committed at its reviewed SHA before sync; `--pin`
is a deliberate dependency adoption. Check both overlay/prepared mirrors and
run producer tests and the consumer dialect gate. Source tests use owned source;
`BW_INTEGRATED_ROOT` is an explicit dependency override, not source substitution.
A stale prepared extension cannot qualify current source.

The existing CLI reports unsupported elements and compiles with original PXT:

```sh
node scripts/makecode.mjs to-sb3 input.mkcd -o artifacts/imported.sb3 --bw artifacts/imported.bw --target arcade
node scripts/makecode.mjs to-project artifacts/imported.sb3 -o artifacts/exported.mkcd --target arcade
node scripts/makecode.mjs to-ts artifacts/imported.sb3 -o artifacts/exported.ts --target arcade
node scripts/makecode.mjs to-hex artifacts/imported.sb3 -o artifacts/game.uf2 --target arcade --board rp2040
node scripts/compat-audit.mjs --target arcade --out artifacts/audit.json --corpus-commit "$ARCADE_CORPUS_SHA" --compile --execute "$ARCADE_CORPUS"
node scripts/conversion-roundtrips.mjs --out artifacts/roundtrips.json --corpus-commit "$ARCADE_CORPUS_SHA" --compile "$ARCADE_CORPUS"
```

These are examples, not a command to build hardware firmware or perform flashing
for the current speech lane. CLI exit codes:0 complete,1 compile/refusal failure,
2 usage error,3 unsynced runtime. `--execute` audit smoke is bounded, not semantic
proof. The corpus-commit argument is a declaration; verify its tree and file
hashes independently. The report distinguishes start/end source/pin/version
identity and records dirty state; do not describe dirty-source results as clean.

`collect-makecode-corpus.mjs --out ...` collects inputs/provenance, while
`capture-arcade-import-corpus.mjs` captures current test importer inputs for the
dialect gate. They are different corpora. Do not rewrite the locked original184
inputs to make a regression disappear or regenerate fixtures without review.

## 14. Real browser qualification

Primary journey: `scripts/verify-arcade-rotation-browser.mjs`. Despite its name,
it now also covers imports, typed helpers, arrays, multiplayer, palettes,
following/layers, scroll/copy, tiles and dialogs. It opens files, uses visible
Code/Blocks and real controller controls, records runtime diagnostics and saves
screenshots. Other focused `verify-arcade-*.mjs` scripts cover resource/schema,
animation, terrain, scenes, physics and graphics families.

For an already built source-matching app:

```sh
PROOF_URL=http://127.0.0.1:8620/ node scripts/verify-arcade-rotation-browser.mjs --out artifacts/arcade-browser/current.json
```

The loopback URL is an example port, not a claim that a matching server is active.
Check served bundle identity and build profile. Run actual PNG decode readiness
and canvas dimensions before samples; do not replace intended palette/image
assertions with generic nonblank checks. Headless native indexed frames do not
prove the GUI compositor presented those pixels. Read job artifacts, not only a
summary or heavy-shard success. Use hosted full builds on the constrained host.

## 15. Evidence storage, licensing and publication

Public Markdown/receipts hold source URLs, public relative paths, exact SHAs,
contracts and bounded conclusions. Operator paths, credentials, hosts, raw logs,
private receipt URLs and corpus locations belong in the ignored local companion
or private evidence repository. The companion path is excluded by `.gitignore`;
never force-add it. Review diffs for accidental absolute paths/private links.

Preserve failed and passing invocations separately. Record source SHA, base and
producer pins, input hashes/manifest, original target/core versions, test counts,
actual build profile, original/native outputs, raw logs and check identities.
Archive explicit filenames with SHA256SUMS and a source patch to the final docs
head. Avoid broad artifact globs. If a failed oracle was overwritten, state that
only its failure log remains; never reconstruct a trace and call it original.

PXT source is used under its retained license/attribution, with notices preserved.
`speech-native-legacy.js` is an attributed resumable adaptation, not unchanged
original source or a clean-room rewrite. `speech-pxt.js` and font data are retained
comparison sources. Inspect `THIRD-PARTY-NOTICES.md` and exact corpus manifest
licenses before redistributing assets. User requested independent implementations
for missing TurboWarp-specific features: do not copy its implementation to fill
those gaps or claim SB3 structural tests establish TurboWarp equivalence. Existing
Scratch/PXT-derived components retain their own notices; no blanket clean-room
or license-clearance claim.

## 16. Next lanes and acceptance criteria

1. **Hosted layer/display failure:** preserve the exact failed report; prove the
   correct native indexed pixels and real visible centre palette pixel, then
   pass A/B z-change cycles and the complete source-matching browser journey.
2. **Speech reentry/scene/suspension:** original/native yielding creation and
   destruction, nested say/clear/destroy, owner/scene changes, project reset,
   long scrolling across suspension/modal changes, exact frame/ID/callback order.
3. **Live-image hitbox timing:** original mutation revision/cache/refresh order,
   scaled/rotated/blank image changes and constructor offset snapshots; do not
   assume recomputation at every API call is original behavior.
4. **Completed screen composition:** S01 closure, real global image identity
   and `screen.clone`, paint/shade/renderables ordered by z/id, HUD and effects;
   compare actual original planes before changing the coverage marker.
5. **Authoring/resource closure:** implement ledger GUI gaps across menus,
   Code/Blocks, graphics, tiles/animation/JRES/palette persistence, full authored
   game -> save -> export -> original run -> reimport -> edit/run.
6. **Corpus closure:** rank actual remaining named gaps, implement one family
   at a time, remeasure unchanged inputs and preserve changed rows. Repeat across
   extensions and normal MakeCode without substituting parser success for games.

Each lane finishes with concrete editable/runtime/original/GUI evidence and a
bounded receipt. Do not estimate a zero-partial date from these test counts.

## Named tile resources — 2026-10-11

The tile identity lane adds `tileId` and `displayName` to native map images. Namespace source paths and JRES resource IDs survive conversion; the painter exposes a tile-name input, and its rename operation is undoable. Pixel edits, tile-size changes and SB3 map literals preserve this metadata. Different named assets with identical pixels stay distinct. Conflicting edits to one ID export separate suffixed resources with a warning.

Full MakeCode project exports now include `tilemap.g.jres` and `tilemap.g.ts`, listed in `pxt.json`; map expressions refer to those named resources. Standalone TypeScript instead contains inline namespace declarations so it runs without companion files. Custom display labels are retained in full project exports; standalone TypeScript retains the qualified ID and pixels but currently derives its label from the identifier on reimport. Saving a named tile edit now updates matching copies across maps and targets. Divergent copies remain independent; ambiguous edits or a stale map reference refuse the save before any block changes.

The image resource codec follows the original PXT 4bpp format: each column is padded to a 32-bit boundary. Original-runtime qualification reads an edited pixel from the emitted JRES, rather than checking generated text alone. Format reference: https://github.com/microsoft/pxt/blob/v13.2.1/pxtlib/tilemap.ts .

Verification: 80 distinct conversion, namespace, native-runtime, original-PXT and CLI tests passed across the affected batch and CLI followup. Two original batch failures were absent example files in the sparse checkout; the full seven-test CLI followup passed after restoring tracked examples. Failed attempts are preserved in private evidence. The additional null-image guard is covered by a subsequent focused rerun.

Run `node --test --test-concurrency=1 --import ./scripts/lib/register-gui-scope.mjs test/makecode-arcade-tilemap-editor.test.mjs test/makecode-arcade-tile-data.test.mjs` with prepared dependencies and pinned MakeCode SDKs. Run `PROOF_URL=http://localhost:8617/ node scripts/verify-arcade-tile-identity.mjs` against a fresh source build. This browser gate uses actual Code import, painter rename/pixel controls, File save/load in a fresh context, and downloaded MakeCode export/reimport; observations and artifacts go to `test-results/arcade-tile-identity/`. CI registers it on the light browser shard. Its exact-source browser and remaining hosted checks are pending; this is not a full-compatibility or merge claim.

Remaining painter lanes include legacy colour-coded map authoring and sprite placement. Existing native legacy-map execution is already supported. Continue with the refreshed `LANES.md` ownership contracts and retain all refusals until behavior is qualified.

Shared-asset followup: the real browser fixture now uses one tile in two differently shaped levels and checks both uses after painter save, fresh SB3 load and MakeCode reimport. Native/original tests verify one exported resource per ID, unchanged unrelated level geometry, shared undo/save, and refusal of stale or ambiguous edits. Fresh hosted qualification remains pending.

### Next legacy painter implementation boundary

Inspect the real imported block graph first: a literal colour-coded map currently becomes `arcade_setLegacyTilemap` fed by `arcade_cloneImage`/`arcade_frameImage` referencing editable template artwork, rather than a JSON modern map. Tile definitions use `arcade_setLegacyTile`, and wall flags belong to a colour index. Image variables can remain live aliases and can change during the game; scene-local definitions can change independently. Do not replace these operations with a static modern map merely to make the painter work.

Add a colour-index layout view bound to the actual source artwork, with actual save/reopen/export evidence. Qualify direct literals and stable artwork-backed expressions first, while listing computed/dynamic sources with an explicit editability reason. Definition pixel/wall editing must preserve index-wide wall semantics, scene scope, definition timing and aliases. Native legacy execution already exists and is tested; this lane concerns authoring. Use the existing `test/fixtures/arcade-legacy-tilemap.mjs`, `arcade-legacy-tile-values.mjs` and `arcade-legacy-tile-collisions.mjs` as adversarial behavior boundaries before adding GUI support. Sprite placement is a separate subsequent task and must use real live sprite handles with deliberate script timing.

## Legacy colour-index layout authoring — 2026-10-11

Branch `lane/arcade-legacy-layout-authoring-20261011` is stacked on PR793, in a separate owned worktree. Its helper `legacy-layout-editor.js` reads the actual artwork-backed `arcade_setLegacyTilemap` reporter graph. The Tile maps panel lists supported legacy layouts beside modern levels and provides the sixteen colour indexes, paint/erase/fill, resize, undo/redo and save. It labels this as a colour-index layout, rather than a preview of runtime tile definitions. Walls and tile artwork remain in their original colour-tile blocks, and the original scale is retained.

Save changes the existing costume asset and its simple source document without changing the legacy script, its image expression, scene timing, tile definitions or selected target. Shared frame references keep pointing to that artwork. Single flat vector-asset or pixel-layer documents are preserved. Rich multi-layer/animated/locked artwork is explicitly delegated to Pixel; computed images/scales, missing/ambiguous artwork and runtime frame overrides have distinct listed reasons. Current layout editing follows the Pixel document bound of 160 pixels per dimension. Computed definition images/indices, computed wall authoring and complex alias/expression authoring remain gaps, not compatibility claims.

Checks exercise real import/native execution, unchanged block graphs, stale artwork refusal, single-layer source/SB3 persistence, resized native execution, actual original-PXT export/index/wall results, and preservation of unsupported multi-layer artwork. Run `node --test --test-concurrency=1 --import ./scripts/lib/register-gui-scope.mjs test/makecode-arcade-legacy-layout-editor.test.mjs` with prepared dependencies. The dedicated `PROOF_URL=http://localhost:8617/ node scripts/verify-arcade-legacy-layout.mjs` browser journey uses real controls, File SB3 save/fresh-context load, native execution and actual downloaded MakeCode reimport; its fresh-build result remains pending. Observations go to `test-results/arcade-legacy-layout/`. CI adds a light-shard gate with a registered provisional budget.

Fresh agents: refresh source/PR heads and `LANES.md` first, inspect the exact-source checks and the optional gitignored local companion, and continue from the actual report boundary. Claude owns sprite placement and circuit pin adoption; coordinate shared painter JSX/model changes with that session before implementation. Do not alter its pin or assertions to qualify this lane.

Final local lane qualification: all36 focused legacy authoring, modern/shared tile editor, tile data, exporter/original-runtime and browser-budget checks pass, with0 skips. JSX/script syntax, budget registration and added-prose privacy checks pass. Earlier sparse-checkout and source-document assumption failures are preserved privately. The new GUI controls still require their own fresh hosted browser run; do not infer that result from the headless tests.

### Legacy definition artwork and wall authoring followup

The same PR794 lane now includes `legacy-tile-definition-editor.jsx`. It lists each `arcade_setLegacyTile` command separately, retaining its index, script location and scene timing. Stable artwork gets a pixel palette/canvas, undo/redo and save; literal numeric wall predicates get a checkbox. Saving changes the existing definition's image resource and literal predicate operands. It never inserts a global definition, rewrites a computed predicate, changes scene timing, or flattens a rich source document. Reload refreshes stale source references explicitly.

Definition operations are `findLegacyTileDefinitions` and `writeLegacyTileDefinition` in `legacy-layout-editor.js`. Artwork editing and wall editability are separate: a computed wall remains in its own block while static artwork can be edited. A computed index or image is listed with its reason. Save checks source identity, current index and wall fingerprint before mutation. Native tests verify that the wall change affects every matching colour cell, source/SB3 persistence, original MakeCode tile pixel3 and wall false, stale-save refusal and saved undo back to the initial definition. The existing browser gate now exercises the actual definition pixel/wall controls before fresh File load and downloaded MakeCode reimport. Fresh GUI and enabled hosted results remain pending.

Definition followup qualification: all38 affected tests passed,0 skips; a final5-test focused rerun passed after validation guards. JSX/script syntax and unchanged workflow budget registration passed. Actual fresh-build browser controls remain queued and are not qualified by those unit/runtime results. Remaining authoring gaps include computed definition indices/images, computed wall expressions, richer layer/animation sources and broader source-alias resolution.


## Legacy authored image aliases — 2026-10-11

The image-source editor follows a single authored variable assignment and alias
chains when each initializer precedes its use on the same command chain. It
edits the original artwork, preserving assignment blocks and later pixel
mutations. The painter previews authored pixels rather than a live image
snapshot. Reassignment, computed creation and sources outside the preceding
chain remain explicitly unavailable in this editor; Code/Blocks execution is
unchanged. Definition artwork follows the same rules.

A native/SB3/original-MakeCode regression exposed saved image-reference text
being treated as a string during export. Export now honors version1 image
reference sidecars only when the standard field still matches their placeholder.
Per-run resources initialize as null and authored assignments recreate them;
external edits to the standard field remain intact. No runtime handle or resource
is copied into a MakeCode project. The real GUI legacy journey now uses variable
and alias sources, retaining pointer edits, SB3 reopening and MakeCode reimport.
Exact-source browser qualification is pending; no original-corpus promotion or
whole-game equivalence is claimed.

Persistence PR792 is merged at `18b2929a8479bcec880660b94c13bbb6c991741a`.
Its seven enabled checks and all34 hosted painter observations passed:
https://github.com/CrispStrobe/brickwright/actions/runs/38146762544 .
Reviewed head `eae43ccbad345a5d123026d6a615a83828a6de89`; expected and actual
merge tree `4470f89493e6c944ef62359888a9053df514c325` match. Conditional PR
deployment jobs skipped as configured. Original compilation/rendering is
qualified for this fixture; full-game equivalence is not established.

Alias lane continuation: branch `lane/arcade-legacy-image-aliases-20261011`,
stacked on [PR794](https://github.com/CrispStrobe/brickwright/pull/794).
Source ownership is `legacy-layout-editor.js` and `export-arcade.js` under
`overlay/scratch-gui/src/lib/bw-makecode/`; regression coverage is
`test/makecode-arcade-legacy-layout-editor.test.mjs` and
`test/makecode-export-arcade.test.mjs`. Run with the existing GUI scope hook and
Node22 as described above. The existing light-shard gate
`scripts/verify-arcade-legacy-layout.mjs` covers alias-based painter controls.
Sixteen affected checks passed, plus seven final focused checks with sidecar
external-edit protection. Preserve the initial original-simulator crash receipt;
do not replace it with the successful result. Before merging, collect every
enabled exact-head check, inspect actual browser artifacts, integrate parent
PRs normally, then compare the reviewed and merged trees. Do not merge a child
PR into its feature parent.


## Static legacy frame selection — 2026-10-11

The legacy artwork editor supports literal valid multi-costume ranges, selecting
the same frame as native execution: round the index, wrap it into the range,
and add the starting costume offset. Other costumes remain unchanged. Layout
and tile-definition saves retain the selected costume slot as well as its asset
identity; an old save cannot redirect to another identical frame after the
selection changes.

Frame keys are shared runtime bindings. If another reporter uses the same key
with a conflicting or computed template/range, the painter reports
`mutableFrames` rather than assuming that the later reporter owns its template.
Computed selections remain explicit refusals. No runtime expression, frame key,
image alias or animation sequence is rewritten.

Ten focused checks passed with zero failures/skips, including native state,
SB3 reload, original MakeCode execution, positive fractional/negative wrapped
indexes and identical-frame stale-save protection. A final conflicting-template
fixture check also passed. Source ownership is
`overlay/scratch-gui/src/lib/bw-makecode/legacy-layout-editor.js`; regression
coverage is `test/makecode-arcade-legacy-layout-editor.test.mjs`.
The lane `lane/arcade-legacy-frame-selection-20261011` is stacked on
[PR795](https://github.com/CrispStrobe/brickwright/pull/795). Fresh
exact-source browser checks and normal parent integration remain required;
these headless observations do not qualify a new frame-range GUI journey or
rerank the original corpus. No painter JSX/model or peer-owned placement changes.

Named-tile PR793 now includes main through a normal merge at
`aa6b54ae9d7416977d8953b0d73f41d34af692ff`. The preceding source
`4fb23b92b59b7b875d0cb1a690765ded4d778660` passed its light shard and all11
named-tile browser observations in
https://github.com/CrispStrobe/brickwright/actions/runs/38150051112 .
Actual downloads and failed/predecessor observations are archived privately.
The refreshed merge still needs every enabled exact-head check; the older
light-shard result is not a full-workflow or merged-main claim.


## Tutorial context collection and refreshed gap ranking — 2026-10-11

At source `35c21dd99440c1bd72468f63dae1ba4ff680ff6d`, the locked184 Arcade
fragments still measure142 translated /41 partial /1 parse failure. Every file
SHA-256 matches the retained original hash inventory; every blob matches the
declared private corpus commit. This is static translation only, with no
original compile or native-behavior claim for those184 inputs. Top diagnostic
families are unreadable backgrounds (10 projects), unreadable literal tilemaps
(4), tutorial bundle wrappers (3), song values (3), and sprite operations that
fall back to stage conversion when their artwork is unavailable. Families
overlap, so these counts must not be added to estimate closed projects.

The collector previously saved selected code fences without their tutorial
context. `node scripts/collect-makecode-corpus.mjs --out artifacts/tutorial-corpus
--projects` now additionally writes separate `<target>-projects/*.mkcd` files,
using the existing `tutorial-project.js` assembler. With Arcade documentation,
add `--arcade-docs "$ARCADE_DOCS"` pointing to the pinned target's docs tree.
It preserves custom TypeScript, exact asset file text, package versions and
existing project metadata. Main is the explicitly selected code fence; ghost
programs are not automatically substituted. Fragments remain byte-for-byte
unchanged, and context projects are a separate denominator. Malformed or
conflicting context is listed in `manifest.json` collectionFailures and produces
a nonzero exit; successfully collected files remain available.

The same established CLI is available for a single original fragment:
`node scripts/makecode.mjs tutorial-to-project tutorial.md --main main.ts
--target arcade -o context.mkcd`. Normal MakeCode without explicit package
metadata now receives the micro:bit core dependency through the same helper.
Seven affected checks passed, including native callback execution and original
MakeCode comparison. A real pinned micro:bit collection produced215 exact
baseline fragments plus227 context projects, with zero collection failures.

For the original Arrow Battle document at
https://github.com/microsoft/pxt-arcade/blob/8ae4f42df2b2f4a0472b0da04c3cdcd3438dbb02/docs/tutorials/arrow.md ,
retaining context reduced the selected fragment's five diagnostics to one:
`carnival.startCountdownGame()`. The original compiler gate is separately
unavailable offline for its declared arcade-carnival and arrow-images packages.
This does not close the original fragment, prove a complete game, implement
carnival, or qualify a rendered GUI journey. Raw original inputs, context
project, diagnostics and compiler unavailability are archived privately.

Next: qualify recovered projects without replacing the184-fragment census;
resolve exact declared compiler packages; implement remaining native extension
APIs one family at a time with original observations. Priority candidates are
carnival countdown behavior, persistent typed settings arrays, and song values.
Missing images/maps need actual matching project inputs rather than fabricated
artwork. Keep GUI authoring/Blocks/pseudocode/export tests alongside each native
implementation. Current collector lane is stacked on PR796; merge parent lanes
normally and require all enabled exact-head checks before adoption.

## Original extension compilation and carnival contract — 2026-10-11

The `lane/arcade-extension-project-qualification-20261011` lane is stacked on
PR798. GitHub package identities now accept repository subfolders, such as
`github:microsoft/arcade-tutorial-extensions/arrow-images#v0.0.11`. Raw downloads
place the ref before the folder; compiler matching retains the complete package
path, so sibling packages cannot satisfy each other's dependencies. License
reporting checks the package first, then the repository root, and records the
actual notice URL. File hashes and named fetch refusals remain visible. This is
compiler input resolution, not native API support or a dependency-pin change.

The audit remains offline by default. To explicitly resolve a complete project's
GitHub dependencies for the original compiler, run:

```sh
node scripts/compat-audit.mjs --target arcade --compile --fetch-extensions \
  --out artifacts/arcade-original-compile.json context.mkcd
```

`--fetch-extensions` requires `--compile`. JSON records compilerPolicy and each
fetched package's identity, ref, source hashes and reported license. Node's
`compile(target, files, {fetchExtensions: true, fetch})` exposes the same path;
passing a fetch adapter alone keeps fetching disabled. Neither mode vendors or
persists these packages. Fifteen affected checks passed with no failures/skips,
including actual original PXT compilation from a subfolder. Recovered Arrow
Battle now passes the original compiler with five fetched MIT-labeled packages:
carnival, arrow-images, status-bar, arcade-text and arcade-sprite-util. It still
has the native diagnostic `carnival.startCountdownGame()`; the184-input census
is unchanged. Full game execution and the production GUI are unqualified here.

The exact carnival tag v0.0.7 resolves to
`915caca4a2d83a7071df59407a9987992c083750`. Source and notice:
https://github.com/microsoft/arcade-carnival/blob/915caca4a2d83a7071df59407a9987992c083750/carnival.ts
and
https://github.com/microsoft/arcade-carnival/blob/915caca4a2d83a7071df59407a9987992c083750/LICENSE .
Its countdown implementation registers only the first end handler, retaining
that call's style/effect; later calls restart the countdown without replacing
the handler. Styles include win, lose, score, timed, multiplayer and custom.
Multiplayer considers defined scores for players1–4 and includes all tied
winners in its message. Non-lose styles use the extension's custom dialog and
score/time persistence, rather than core game-over rendering. Preserve source
defaulting and effects behavior, including the explicit-effect branch, in
original comparisons before changing anything. A generic `info.startCountdown`
and `game.gameOver` substitution is insufficient.

Next implementation needs the source-backed scoring/dialog/timer mechanism,
per-run initialization/reset and scene/event lifetime, regular extension blocks
and pseudocode metadata, MakeCode export with the correct dependency, SB3
reopen, and comparisons against the original for unique/tied winners, score and
time modes, repeat initialization, effects and button restart. Existing native
core helpers live in `overlay/scratch-vm/src/extensions/crispstrobe/arcade/index.js`
(`_gameOverModule`, `_runGameOver`, `_infoState`, countdown registrations). Reuse
their mechanisms where semantics match; do not erase the extension diagnostic
until the complete selected behavior has a real execution path. Private raw
inputs, compiler results and local paths belong in the private handoff.

Six original-only carnival controls (unique multiplayer winner, tied players,
lose, win, score and timed) compile and run for1800 virtual milliseconds without
simulator errors. Their actual binary output, palette-index frames, source
files and fetched responses are retained privately as comparison baselines.
This is original-simulator execution, not a native comparison, complete Arrow
Battle run, button-restart test or production-browser result.

## Carnival scoring/dialog implementation slice — 2026-10-11

The `lane/arcade-carnival-scoring-core-20261011` lane stacks on PR799 and owns
new `arcade/carnival-source/*`, `arcade/carnival-pxt.js`,
`scripts/generate-arcade-carnival.mjs` and
`test/makecode-arcade-carnival-core.test.mjs`. The exact pinned MIT source/notice
are retained with their original bytes. A reproducible AST selection and
fiber-to-Promise adaptation implements the original scoring and custom dialog
logic, rather than a generic game-over substitute. Eleven contract/generation
checks pass with no failures/skips. Their observing host doubles qualify source
control flow and data, not VM rendering, actual durable storage or native game
equivalence. No corpus row is promoted and carnival diagnostics remain visible.

Next: implement the VM host using native image/font/BaseDialog/renderables,
scene transitions, countdown-handler replacement, number settings, timer1,
music and button/reset operations. Verify program cancellation and scene
lifetime before exposing commands. PR800 separately owns countdown/life-event
ordering and the paused Playwright oracle; account for its qualified adoption
without overwriting that lane. The captured original-only carnival frames are
private reference inputs for subsequent native comparisons. Regular extension
blocks/pseudocode, fixed/dynamic style handling, MakeCode package export, fresh
SB3 reopening and a production GUI journey are still required. Original source
first-registration and explicit-effect branches must remain observable.

The painter-placement peer PR801 stacks on PR794. Preserve that parent history
and coordinate before changing it. A reviewed map-before-sprite case revealed
that inserting a new placement immediately after the map can precede sprite
creation; the peer owns the reported source-order fix. Pending peer PRs and
reported test totals are not qualified adoption claims.

## Carnival native host, authoring and saved records — 2026-10-11

The next slice implements `carnival.startCountdownGame` and
`carnival.onGameOverExpanded` with fixed `WinTypes` styles and optional fixed
screen effects. It connects the retained original scoring/dialog module to the
real VM's image/font renderer, scene stack, countdown callbacks, clocks, music,
button wait and restart. Ordinary Arcade extension blocks and pseudocode expose
both operations. Import/export retains the actual carnival API and declares
`github:microsoft/arcade-carnival#v0.0.7` in exported `pxt.json`.

For example, type this into Code and use To blocks:

```text
arcade set score player (1) to (7)
arcade carnival countdown (15) style Score effect unset
```

The countdown and game-over blocks offer Win, Lose, Score, Timed, Multi and
Custom styles. `Custom` here means the original `WinTypes.Custom` branch;
`customGameOverExpanded` with arbitrary text/scoring/sound is still diagnosed.
Dynamic styles and shadowed namespaces remain diagnosed. Timer HUD, carnival
ball helpers and additional extension APIs remain separate work.

`arcade/program-settings.js` stores number records under a program identity on
the Stage. SB3 carries a validated `bwArcadeSettings` sidecar, including exact
special numeric values, without adding learner variables. On a device with
usable localStorage, the latest records for that identity take precedence over
an older imported snapshot. A different device starts from the SB3 snapshot.
Without a device backend, records persist only in saved projects. Copying a
project retains its identity; a genuinely new project receives a new identity.
Quota/write failures propagate and leave both live values and snapshots intact.
This is app-owned record storage, not cloud sync or a general settings blocks UI.

Serializer integration in `scripts/lib/arcade-settings-sb3-hooks.mjs` patches
both the target-flattening and serialization boundaries plus restoration.
Changing only `serializeTarget` loses live Stage metadata. The focused SB3 test
injects these exact hooks into the actual serializer in memory, saves an actual
archive and loads it into another VM. It does not modify dependency files or
qualify a production browser build.

Qualification: 32 affected runtime/core/info-registration/export checks passed;
the expanded 11-test host suite also passed, without failures or skips. It
covers countdown first registration and later replacement, direct game over,
stop/restart cancellation, number records and actual SB3 reopening. Six source
controls (unique/tied multiplayer winners, lose, win, score and timed) exported,
compiled with the original PXT compiler and ran without native/original errors.
The original render helper aliases two black palette entries (0/15); comparing
displayed colours yields exact opaque dialog text/body in rows 40–76 after
excluding the animated cursor at x145–159/y69–76. Each full rectangle still has
42 cursor-phase pixel differences, preserved in private receipts. Exported
original dialog rectangles match the original baseline without differences.
These are bounded comparisons, not whole-game or cursor-timing equivalence.

The candidate branch is `lane/arcade-carnival-runtime-host-20261011`, stacked on
[PR802](https://github.com/CrispStrobe/brickwright/pull/802). It normally
integrates the exact [PR800](https://github.com/CrispStrobe/brickwright/pull/800)
candidate `a078a5e452991a69abb21c7a9bb6de3ae6c18e86` for countdown ordering.
That is isolated qualification, not adoption of an unmerged peer candidate on
main. Parent/peer hosted checks and final integration remain mandatory.

Next: a hosted production GUI journey through these blocks, dialog/controller
restart, saved project reload and original export. Then add the remaining
custom API/timer/helper capabilities with original controls. Preserve current
184-input census (142 translated / 41 partial / 1 parse failure) until an
immutable-input audit actually reruns; these tests do not promote corpus rows.
Private receipt URLs, commands and local paths live in the private handoff;
`docs/ARCADE-AGENT-HANDOFF.local.md` is ignored operational context.

### Carnival production browser journey — 2026-10-11

`scripts/verify-arcade-carnival-browser.mjs` is now registered on the heavy
browser shard, with a generated zero-reading provisional budget. Run it against
an already built production app:

```sh
BW_BASE_URL=http://localhost:8617/ node --import ./scripts/lib/register-gui-scope.mjs scripts/verify-arcade-carnival-browser.mjs
```

It imports an owned two-line MakeCode control using Code Open, observes the
translated pseudocode, clicks To blocks, checks the visible carnival block,
runs with the green flag, observes real native dialog pixels/score, restarts
through controller A, and saves through File. The downloaded archive must carry
exact program records. A fresh browser context with no carnival device records
loads that file through File, checks restored blocks/records and runs them again.
The gate records tested source, loaded scripts, screenshots, archive hash and
errors under `test-results/arcade-carnival-browser/`. `BW_CARNIVAL_REPORT_DIR`
overrides that output directory; `BW_EXPECT_GUI_BUNDLE` can require a named
bundle. It observes VM state and does not inject runtime/serializer operations.

The native button-restart control passes; all 12 host checks passed in the
expanded suite. Thirteen budget/timeout checks pass after registering the new
gate. The initial budget failures (missing registration) remain in private
receipts. Syntax checks pass. The production journey has **not yet executed**;
hosted build/browser qualification is pending, not inferred from these checks.
No app build or dependency mutation was performed locally. Palette/body controls
and corpus counts retain the previously documented boundaries.


## Carnival custom game-over authoring — 2026-10-11

The `lane/arcade-carnival-custom-gameover-20261011` candidate stacks on PR803
without changing its qualification head. `carnival.customGameOverExpanded` now
uses the retained original module, actual native Melody handles, game-over sound
configuration, scene/dialog renderer and program record store. An ordinary block
and pseudocode command expose message, fixed effect, melody reporter, fixed
scoring type and optional score. General playable objects are not Melody values;
invalid supplied sounds raise runtime errors instead of falling back silently.

Example, authored directly in Code and convertible to blocks:

```text
arcade set score to (7)
arcade carnival custom game over message ("Well done!") effect hearts sound (arcade melody baDing) use sound 1 scoring LScore score (3) use score 1
```

`use sound` and `use score` are boolean inputs, separate from the values. A false
flag represents an omitted MakeCode argument; a true score flag preserves zero.
Scoring menu: unset, None, HScore, LScore, HTime, LTime. The retained original
source owns defaulting, elapsed-time scoring and record comparison. The exporter
folds fixed flags and emits ordinary conditional statements for editable flags;
these reimport through the existing native control blocks. No helper shim or
replacement generic dialog is exported. Dynamic scoring types remain diagnosed;
remaining timer/HUD and ball helpers remain unsupported.

Qualification: 31 core/host/custom checks pass, plus one focused invalid-sound
check. Controls include omission, zero, low/high/unjudged score, timed zero and
editable presence flags. Six original and exported-original controls compile
and execute with the real PXT SDK and captured public package responses. After
aligning the native test's Scratch wait clock and Arcade frame clock, all six
native dialog rectangles (all x, rows40–76) match displayed original colours at
4000ms; exported-original rectangles match their original baselines. Original
RGB readback aliases palette indices0/15 to black as previously documented.
Unchanged original/reference frames are reused for the corrected clock pass;
actual initial failures and raw frames remain private. This does not qualify
whole-game behavior, general cursor timing or audible sound output.

Tests: `test/makecode-arcade-carnival-custom.test.mjs`; production paths are
`arcade/carnival-host.js`, native `arcade/index.js`, `arcadeDialect.js`,
`bw-makecode/arcade-translate.js` and `bw-makecode/export-arcade.js` under overlay.
The selected pinned source/generator is unchanged. The production custom-block
GUI journey and final hosted checks remain pending. Parent PR803's independent
browser journey is queued; do not label it passed. Corpus counts remain unchanged
until an actual immutable-input audit. Private paths, source receipts and commands
remain in the private handoff and ignored local Markdown.


### Refreshed immutable import census and recovered Arrow Battle — 2026-10-11

At custom-runtime source `bb95f4dfb6a94f0ddd6d36f0864553842a6137e3`, a fresh
184-input import audit still reports 142 translated / 41 partial / 1 parse
failure. Every input blob matches the immutable original corpus commit, and the
content-multiset hash matches the preceding census. The audit is static import
only; compilation/execution gates are separate. Its expected nonzero exit due
to partial inputs is preserved, not treated as a passing all-apps result.

The previously recovered Arrow Battle **project**, with its real assets and
declared dependencies, now imports with zero unsupported diagnostics. Its raw
tutorial fragment remains in the original 184-input denominator. This is not
full Arrow Battle gameplay qualification; the original compiler result was
recorded in the earlier package lane. Do not replace a fragment with the richer
project or count this separate one-project audit as a corpus promotion.

The leading census gaps are unreadable background artwork (10 inputs), literal
map data (4), bundles wrapper APIs (3 each), song values (3) and several sprite
operations in the older translation path (3 each). Next: recover explicit
project context/assets without rewriting original fragments, classify each
remaining input's real dependencies, then implement the remaining song/wrapper
and native-mode gaps with original controls. Keep census and context-project
results separate, and qualify runtime/Blocks/GUI/export for each accepted API.

## Carnival shared-parser integration repair — 2026-10-11

Lite PR #803's first hosted build failed before browser execution: its two new
Carnival words differed from the pinned producer, the tracked packages mirror
was stale, and the dialect census still expected 277 operations. These failures
are integration defects, not evidence that the browser journey passed.

The repair adds the three Carnival words (including the custom game-over word
used by stacked PR #804) to the shared producer in
[sb3-creator PR #93](https://github.com/CrispStrobe/sb3-creator/pull/93). Lite
explicitly adopts producer commit `06341e3dd0f5ddfbed6764ec5afe03b04b65e265`,
refreshes its tracked mirror and generated authoring inventory, and expects 280
dialect operations. The producer's Arcade dialect suite passed 323 tests.
The extra custom word in this parent is grammar support; its runtime and GUI
implementation remains in PR #804.

Vendor identity and exact-delta gates remain intact: the adopted producer and
Lite copies must match after the existing import rewrites. No downstream
exception or new normalization is introduced. Hosted consumer build/browser
qualification remains pending at this checkpoint. The immutable corpus result
remains 142 translated, 41 partial, and one parse failure; this synchronization
repair does not close a corpus gap.

## Song implementation next lane — 2026-10-11

### Source and present gap

The consumed target is Arcade 4.2.1 / PXT 13.2.1, built from
[Arcade commit 2d7d59b5226e8a1a1e05e8042dd9f5248ed68fea](https://github.com/microsoft/pxt-arcade/commit/2d7d59b5226e8a1a1e05e8042dd9f5248ed68fea).
Use the exact bundled strings in
`packages/scratch-gui/static/makecode/arcade/target.json`, package `mixer`,
not a moving copy of common-packages main. The upstream source repository is
[Microsoft pxt-common-packages](https://github.com/microsoft/pxt-common-packages);
retain its MIT notice and record hashes of every consumed bundled source.

`scripts/generate-arcade-music.mjs` currently replaces `createSong` with an
explicit refusal and installs an empty `_stopAllSongs` function. The runtime
host is `overlay/scratch-vm/src/extensions/crispstrobe/arcade/music.js`; the
generated module is `arcade/music-pxt.js`. Do not erase these limits by accepting
a buffer without implementing scheduling and sound instructions.

The bundled `instrument.ts` already contains the song/track/note/instrument
encoding and instrument rendering. `sequencer.ts` contains a real TypeScript
sequencer and a distinct simulator-shim wrapper. `Song.play` selects the latter
when `control.deviceDalVersion()` equals `sim`; the other path uses the
TypeScript sequencer. Choose and document a real host path, with faithful
clock/fiber suspension, rather than routing to absent native shims.

### Ordered acceptance

1. Generate retained song/instrument/sequencer logic using the existing fiber
   lowering and explicit host adapters. Add the needed buffer, clock and
   pause-until contracts. Verify playback completion, replacement, looping,
   global stop, restart and disposal.
2. Compare actual scheduled mixer instruction buffers against the original
   target for melodic, drum and polyphonic songs, tempo changes, empty tracks,
   and loop boundaries. Preserve failures; headless instruction equality is
   not audible output qualification. Check malformed input bounds explicitly.
3. Add `music.createSong(hex...)` as a genuine playable value, normal Blocks
   reporter and shared pseudocode word. Preserve exact song bytes through
   MakeCode export/reimport and SB3 save/reopen; inspect existing playable
   dispatch before adding a separate execution mechanism.
4. Provide editable song assets with note grid, tracks/instruments, tempo,
   measures, preview and undo/redo. Preserve naming and edits in both SB3 and
   MakeCode projects. Record unfinished editor capability in the GUI ledger.
5. Run the real production editor journey: import, edit, play with controller
   widgets, save/reopen, export, compile and run the resulting MakeCode
   project. Re-audit the locked 184 inputs independently; three original
   projects mention `createSong`, and unrelated missing assets/extensions
   may keep each partial. Report the actual census, not an assumed reduction.

### Vendor repair qualification checkpoint

At Lite parent `065a86dbd6da751709f7779874a55567a52c0996`, all 11 focused
parser/vendor checks and the separate HEAD mirror check pass. At custom
`1cbac9ad44ce957794d3eb2491b8150fc1320bd7`, all 12 checks pass without skips.
All 18 mapped source files were compared at producer
`06341e3dd0f5ddfbed6764ec5afe03b04b65e265`; the 3750-file gallery matches.
Fresh hosted build/browser checks remain queued, so do not merge or claim
production GUI qualification from these local results.

## Native song sequencing implementation slice — 2026-10-11

### Implemented source and host behavior

Branch `lane/arcade-song-runtime-20261011` is stacked on PR804. The generated
music module now retains the pinned mixer `instrument.ts` and `sequencer.ts`
in addition to the five existing files. Input hashes and MIT attribution are
in `overlay/scratch-vm/src/extensions/crispstrobe/arcade/music-pxt.js`.
`scripts/generate-arcade-music.mjs --check` reproduces that source. The explicit
`createSong` refusal and empty stop-songs placeholder are removed.

The host uses the original TypeScript sequencer through its non-simulator
branch; it does not call absent simulator-native song shims. `pauseUntil` is
lowered as an explicit primitive and polls on the Arcade clock. Positive music
pauses keep absolute deadlines, with bounded catch-up after a clock jump and
zero-duration polls deferred to the next pump. Existing melody/tone/effect
control tests cover the shared scheduler change.

One declared generation adaptation skips empty note streams before reading a
current event; otherwise the retained decoder can read into the following track.
`arcade/song-buffer.js` checks version-zero structure, positive timing, complete
instruments/drum steps/events, tick ordering/extents and drum references. It
refuses malformed data without changing song bytes. Mutable buffers are checked
again at each scheduled tick; failure ends sequencing and releases waiting
callers with the host error still visible.

### Evidence and limits

The focused tests cover melodic polyphony, drum and mixed tracks, envelope/LFO
modulation, volume/tempo, until-done/background/looping behavior, replacement,
global stop/reset, empty tracks, truncated streams and invalid edits. Four real
MakeCode programs compile and run in the complete original simulator; every
active instruction byte matches. The simulator's melodic buffers have an extra
zero record after the terminator. The comparison requires the entire unused
tail to be zero and compares all active bytes exactly; it does not normalize
frequencies, envelopes, waveform, duration, volume or order.

The oracle now has an opt-in `recordSongSound` observer on the original
`AudioContextManager.playInstructionsAsync` sink, because songs bypass the
existing melody queue observer. It calls the original sink unchanged. Initial
empty-capture failures and the subsequent padding-only comparison failures are
preserved privately. This is headless instruction/control-flow evidence, not
audible speaker output or a production GUI song journey.

The native backend uses the pinned hardware-path single-current-song behavior.
The simulator has a distinct sequencer backend; simultaneous-song semantics and
other binary format versions are not qualified by this slice. Version-zero
validation must not be labelled support for every song format.

### Required continuation

The following song-values slice implements importer value lowering, the normal
Arcade reporter block, shared producer pseudocode word, MakeCode export/reimport
and SB3 roundtrips. Editable song assets and a production GUI journey remain
required as specified in the song lane above.
The locked corpus census remains 142/41/1; runtime primitives alone do not change
its classification.

### Separate parent integration repair

The next hosted failure in PR804 was an old exact producer-pin assertion in
`test/lego-spike-roundtrip.test.mjs`. The canonical executable artifact test was
rerun against `06341e3dd0f5ddfbed6764ec5afe03b04b65e265` and passed. The assertion
was updated without weakening artifact checks. Repair is on PR803 at
`4e7fcfff80e8a4966e42ce41a19a85c6f7376dd9`, normally merged into PR804 at
`9e0456303180e7d93901e84b635228210ac9a404`. Fresh hosted checks remain required.

### Native song source qualification checkpoint

[PR806](https://github.com/CrispStrobe/brickwright/pull/806) tested code
`117a5b31230ae282aa4adee89bed2ab627fc0a6d`: 29 affected checks pass with no
skips (12 song, six existing music, 11 Carnival source/control checks). The
separate HEAD overlay/packages mirror check passes. Production build/browser
qualification remains pending; the runtime source tree and hosted app result
are separate evidence. No importer classification was promoted.


## Song values and conversion slice — 2026-10-12

### Implementation and authoring

``music.createSong(hex`...`)`` lowers to the normal `arcade_songPlayable`
reporter. Code uses `arcade song playable hex "00780004080100"`; a string
expression is also accepted. Connect the reporter to the existing music-play
block. The runtime creates the native typed playable through the validated PXT
song codec and sequencer, rather than interpreting a separate song format.

`music.createSong(Buffer.fromHex(expression))` preserves a dynamic hex string.
Literal reporter values export as ``music.createSong(hex`...`)``; expression
inputs export through `Buffer.fromHex`. Literal export validates hex before
embedding it in TypeScript. Unsupported constructor forms retain diagnostics;
invalid runtime bytes emit a visible block error and return no playable.
General Buffer variables, mutation and other binary versions remain open.

The shared producer word is in
[sb3-creator PR94](https://github.com/CrispStrobe/sb3-creator/pull/94), stacked on
[PR93](https://github.com/CrispStrobe/sb3-creator/pull/93). The adopted pin is
`c70963552a0ceac9456633cac24e9c62d922cde2`; the inventory now contains 281
Arcade words. All 18 mapped files match the sync's own transformation; the
permitted downstream delta set remains empty.

### Reproducible checks

`test/makecode-arcade-song-values.test.mjs` contains five checks:

- Real imported-song VM playback and until-done continuation.
- Exact literal-byte export and execution in the complete original MakeCode
  simulator, comparing active instruction bytes.
- Dynamic-string Code/Blocks/export/reimport plus actual SB3 save and reopening
  in a fresh VM; the exported dynamic program also runs in original MakeCode.
- Unsupported constructor forms, malformed hex and invalid native timing retain
  diagnostics or visible runtime errors; the normal reporter is discoverable.
- Editing a reporter's bytes changes exported tempo; unsafe malformed literal
  text is refused.

The combined song-values, native-song, existing-music, canonical SPIKE artifact,
dialect and vendor-identity checks pass: 35 tests, no failures or skips. The
shared producer's independent grammar checks pass: 324 tests. These checks do
not establish a production browser authoring journey or audible output.

### Remaining GUI and integration work

Provide named song assets and an editor for tracks, notes, instruments, drums,
volume and tempo. Save edits transactionally and exercise creation, playback,
export, original MakeCode import and SB3 reopening through the actual GUI.
General Buffer operations, simultaneous-song semantics and version-one songs
need separate qualification. Do not count an editable hex input as a song editor.

The parent runtime's hosted run
[38173020786](https://github.com/CrispStrobe/brickwright/actions/runs/38173020786)
is red: the build failed a particle-effect image assertion, the light browser
shard failed painted-level save/reopen execution, and the heavy shard stopped
before the Arcade journeys. The native-song checks did not fail. These failures
remain integration blockers; their causes must be established before a full
production claim. Preserve the original failures rather than rerunning them out
of the evidence record.


### Locked corpus checkpoint

The clean source `79b873478ca65972a45cb70471c0e0e797f6e139` was audited against
all 184 originals at corpus commit
`c67f4854610ccc823682280b4d1fbdf737f4a585`. Every original Git blob matched;
content-multiset SHA256 is
`a3dc8c21a33a9fb5e1808d2b2b2d2dbc2f7ce1ab33655b7b4cb14a16894b9f03`.
Source, vendor pins and MakeCode SDK identities were unchanged at both endpoints.
The census remains **142 translated / 41 partial / 1 parse failure**. This is
static translation, not compilation or execution of the complete corpus.

The three song cases use ``music.createSong(assets.song`countdown`)``, rather
than literal hex. Their standalone sources do not supply the named song bytes.
Resolve song assets from complete project manifests/JRES and preserve their names
and bytes through authoring/export. Keep the missing-asset diagnostic when only
a source snippet is provided; never manufacture a countdown song to make the
census green. These projects also have unrelated artwork and wrapper gaps.


## Named song asset candidate — 2026-10-12

The normal `arcade_namedSongPlayable` reporter / Code word
`arcade song named "countdown" hex "..."` preserves the display name and exact
version-zero bytes in ordinary blocks and SB3. Native song JRES entries use
`application/mkcd-song` and raw hex, as in pinned PXT13.2.1 generateSong and
emitProjectImages. Complete project imports resolve ID, short ID and display-name
aliases; missing, ambiguous or malformed entries remain diagnosed. The exporter
writes native song JRES, manifest entries and a song factory. The single-file
TypeScript export embeds its factory. Export refuses conflicting bytes under
one name or nonliteral named asset inputs. Internal JRES IDs are regenerated;
original display names and bytes survive.

Seven focused song checks pass, including complete-original MakeCode execution
of both file-map and single-file exports and an actual SB3 save/load into a fresh
VM. First fixture omitted pxt.json on its separate single-file compile and failed;
the required manifest was restored and that failed run is preserved privately.
Producer325 grammar checks pass at f079238eeb7d8ac6474048e748208fb7f954198f in
[sb3-creator PR95](https://github.com/CrispStrobe/sb3-creator/pull/95), stacked
on PR94. Broader combined gates and hosted production qualification remain open.
Unused song library entries, general Buffer operations and a graphical song
editor are not supplied by this slice. Full binary validation stays in the native
codec; the interchange boundary checks lexical bytes/version and asset identity.

The operator requested rescue of the ended Claude session during this slice.
Work remains on `lane/arcade-named-song-assets-20261012`, separately from the
rescue integration branch. Resume the named-song combined checks and GUI work
once the rescue is checkpointed. PR807's build/corpus checks passed; its light
shard failed painted-level reopening and heavy failed waiting for the visible
Carnival countdown block. Those exact failures are preserved and not production
completion. The prior PR806 heavy failure is a separate earlier failure.
## Claude session rescue — 2026-10-12

The operator reports that the Claude session has ended. Its useful work is
committed and pushed; there are no uncommitted tracked changes in its green-flag,
placement or countdown worktrees. Three diagnostic prototypes were preserved
privately, not promoted to production scripts.

The isolated `integrate/claude-arcade-rescue-20261012` branch merges these exact
candidates, preserving their original history:

- [PR801](https://github.com/CrispStrobe/brickwright/pull/801),
  `f97f3606a5cfcfd0ad7dc02e548736f6ab29dcd6`: sprite placement in the tile painter,
  including its PR793/794 parents. All seven enabled hosted checks succeeded.
- [PR797](https://github.com/CrispStrobe/brickwright/pull/797),
  `2a0f1e657163e25bf6ed1512fa6fb0ebe6a26b79`: exact bw-board package adoption
  `9c8777d5` and derived pins/receipts/lockfiles. Build and heavy browser passed;
  light failed saved-painted-level execution after reopening.
- [PR800](https://github.com/CrispStrobe/brickwright/pull/800),
  `a078a5e452991a69abb21c7a9bb6de3ae6c18e86`: native countdown event ordering and
  deterministic original simulator clock. Build and heavy browser passed; light
  failed the same painted-level check.

The original PR797/800 failure logs establish the shared failed assertion;
they do not establish that either source change caused it. Both failures remain
preserved. A separate active worker owns the painted-level installation and
original-display readiness proof repair. Do not overwrite or duplicate that
worker's source or claim its unpublished result.

This integration has documentation conflicts resolved while retaining lane
histories; executable source merged without conflicts. Fresh combined hosted
qualification is required before main adoption. PR801's green parent-specific
result does not qualify the new main-based combination. The original branches
and worktrees remain available. PR789/790/791 are already integrated and need no
second salvage. Song and Carnival descendants remain separate candidates.


Combined focused checkpoint: source `47982918f` passes20 checks, no failures or
skips: placement model with real runtime/export, info/countdown registration,
original-simulator terrain trajectories and HEAD tracked mirrors. This does not
qualify the full package/GUI combination. Reuse the original exact-head source
and retain its failed browser logs; require fresh hosted enabled checks before
merging the new main-based rescue candidate.


## Combined candidate and census reconciliation — 2026-10-12

This is the current integration checkpoint; preceding entries record their
original slices. `lane/arcade-complete-integration-20261012` includes every
recorded Arcade candidate head in PR793–807, plus rescue PR810
and named-song source `5db728c509d79fceeb047677c47e2bde48738b91`. Exact Git
ancestry was checked for all15 open relevant PR heads. Native source, ordinary
Blocks/Code words, graphics editor changes and their candidate tests are now
in one owned tree. This does not mean they have reached main or passed the full
production gates. Independently active painter/display proof repairs remain
outside this integration until their owners publish qualified results.

Exact audited main: `38b6bc3adbe636eb3b46dda6aa831e28a5df61fb`.
Exact audited combined source: `1ff099af6c0b65c81c5d15c663e38f252551b991`.
Both clean audits keep **142 translated /41 partial /1 parse failure** over the
same184 originals at `c67f4854610ccc823682280b4d1fbdf737f4a585`, content
multiset SHA256 `a3dc8c21a33a9fb5e1808d2b2b2d2dbc2f7ce1ab33655b7b4cb14a16894b9f03`.
Both source/vendor/SDK endpoint identities match. A subsequent main ledger-only
commit `51eea45fb` is integrated without altering source or the audited inputs.

### Why earlier counts look better

An older real report at clean source
`14934fb23ac8a68b6d9227d3325ff5609f7e25f2` uses a compiler-dependent top-level
stage:101 translated,29 partial,53 original-compiler failures and1 parse failure.
Its separate static translation field is109 translated /74 partial /1 parse
failure. Its original compile field is130 pass /54 fail, including the failed
parse input. These independent gates must not be collapsed into "29 apps still
not working" or compared directly with today's import-only41 partial.

Today's raw rows also mark183 inputs `translated: true` because they produced
translation output, including41 with diagnostics. The complete static status
remains142 translated, not183 fully supported. Neither static tally establishes
actual native gameplay, full-game equivalence or current original compilation.
The old report's content multiset matches the184 originals; its declared commit
field alone does not verify the original Git tree. The report remains archived
privately with its original provenance and failures.

### Qualification and next steps

52 combined checks passed; two vendor-declaration checks initially failed only
because the sparse tree lacked the tracked declaration Markdown. Materializing
that unchanged HEAD blob and rerunning those two yielded2 pass,0 skips. Thus
all54 selected checks passed across the preserved attempts, without modifying
assertions or source. A prior incomplete invocation saw only3 materialized tests;
it is preserved and is not the combined qualification. Always assert requested
test files exist and materialize their tracked dependencies before invoking Node.

Checks cover native songs/MakeCode/SB3, named-song files and single-file exports,
Carnival custom game-over, placement runtime/export, countdown ordering, ordinary
dialect inventory, canonical SPIKE artifact, all18 producer mappings, empty
vendor deltas and HEAD mirrors. Pin producer f079238e and engine9c8777d5 together.
Keep named song-editor GUI and missing context/wrapper operations on the open
ledger. Publish this exact combined tree on PR810, refresh all hosted checks,
and adopt main only after every enabled required check succeeds. Main's existing
painter red and the independently active repair are not waived by focused checks.

## Ordered zero-partial campaign — 2026-10-12

The approved [partial closure plan](ARCADE-PARTIAL-CLOSURE-PLAN.md) contains
the complete 41-row original diagnostic checklist, ordered batches, editor
acceptance criteria and corpus-preservation rules. Start with qualification
of the combined candidate, then authentic project context. PR810 final-head
build/corpus passed but both browsers failed; no main-adoption claim yet.

### First closure batch receipts — 2026-10-12

At clean49d3cc5a8, originals remain142/41/1 and separate authentic contexts
measure7/33/1 over41. All41 context projects retain exact original main.ts.
The reusable recovery CLI and tutorial package-pin refinement are candidate
source, with8 focused tests and3 CLI controls passing. Private unchanged first
failure and corrected41-context receipts are archived in the private corpus
repo.38 declared external dependency specifications form the next context
frontier. No gameplay, graphical song-editor or main-adoption claim is made.

### Dependency compiler loading checkpoint — 2026-10-12

Continue with the bounded loader section in
[the closure plan](ARCADE-PARTIAL-CLOSURE-PLAN.md). Both previously size-refused
real packages now resolve; the pizza context compiles in original Arcade, while
the Hawks snippet exposes an undeclared `harry`. Preserve that failure and the
original corpus. Fetch reports include exact hashes, retained UTF-8 byte counts
and explicit compiler-only editor-history exclusions. Source recovery has not
yet supplied native import assets or qualified gameplay/editor/roundtrip parity.
Respect the independent E10 importer ownership recorded in LANES.md.

### Native package-input bridge — 2026-10-12

The closure plan now documents `resolveProjectInputs`, the independent
`dependency-project.js` bridge and CLI `to-sb3 --fetch-extensions`. Original PXT
generates dependency inputs; the bridge preserves root galleries, namespaces,
source order and exact image pixels. SB3 conversion records dependency
provenance. A component control runs real Brickwright, exports to original Arcade
and reimports with exact pixels/positions. This is not a full-game GUI receipt.

Next implement namespace Buffer constants/dynamic song-buffer flow, wider native
animations and source-backed factory scopes, then measure all context projects.
Keep incomplete-source failures and private original receipts. Coordinate
importer work with E10; the graphical import/network-choice/provenance UI is
still open, as recorded in the GUI ledger.

## Bounded native animation dimensions — 2026-10-12

`animation-jres.js` now reads/writes the native u16 dimensions independently
of Arcade's 160x120 display. The unchanged 1MiB packed resource and 64-frame
budgets are joined by an explicit 2Mi decoded-pixel budget checked before
frame allocation. Timing, palette, identity, canonical encoding and unused
nibble checks remain enforced. Ten codec controls pass against the retained
original PXT encoder/decoder, including exact 161x121/32-frame bytes and pixels,
u16 endpoint dimensions, and header-only oversized-resource refusals.

This closes the codec's screen-size restriction, not full wide-artwork support.
Pixel document publication/import still uses `editablePixelSize` (160x160);
SVG-to-pixel reading separately permits512x512. Next work must align those
bounds with total document/layer/frame budgets, preserve artwork outside the
viewport, qualify native clipping/collision and run genuine editor/save/reopen/
MakeCode export journeys. Do not silently crop, rescale or drop unsupported art.

PR810 source1007dea43 passed both browser shards, corpus, FPGA and companion
checks in Build38237496710, but its build job failed two policy controls:
unclassified immutable tutorial fetch and computed CLI module consumption.
The candidate uses a literal lazy import for the existing dependency consumer
and declares validated manifest SHA input in the fetch census. Recovery CLI
controls reject branches, tags and abbreviated/nonhex revisions before network.
No dead-module exception or fetch waiver was added. Fresh hosted qualification
is required; the locked original census remains142/41/1.

Authentic follow-up at source6c93fb987 decodes/re-encodes the real Hawks
TrampolineDunk resource exactly:161x121,32frames,75ms,311720packed bytes.
Prepared native diagnostics drop from1 to0 for that recovered context; original
PXT still fails the unchanged snippet's undeclared `harry`. This does not
change the locked original census or establish game execution.40 affected
codec/dependency/native-import/companion/export controls pass, plus14 corrected
policy/recovery controls; the preceding census failures are preserved.

## Wide artwork authoring candidate — 2026-10-12

Pixel indexed artwork and native animation resource lookup now support up
to512x512, matching the existing SVG reader. An8Mi indexed-pixel budget covers
all document frames/layers and the active-frame copy; the16MiB serialized
document and64MiB artwork-bundle limits still apply. Native JRES export keeps
its separate1MiB packed limit and reports oversized resources explicitly.

Wide documents require artwork bundle8. Library installation and subsequent
saves keep that version; old bundle7 readers preserve source byte for byte
as future data. Narrow documents keep their existing minimum versions.
Resize, new frame/layer and sheet slicing check pixel budgets before allocating
new buffers, with English/German feedback. Imports check budgets before
constructing editable frame copies. IDs, timing and external pixels are retained.

A161x121/32-frame synthetic native project executes in the real VM, saves and
reopens into a fresh VM, exports/reimports exact source and compiles/runs in
original PXT. Native viewport clipping and offscreen frame pixels are checked.
Actual Pixel load/resize/Undo/Redo controls verify no shrinking and refusal
before oversized allocation. Historical bundle7 preservation also passes.
The hosted animation browser gate now adds a two-frame wide import, visible
Pixel corner painting outside the Arcade viewport, playback, bundle8 save/
reopen and original-compiler GUI export. That new GUI journey is PENDING,
not a completed browser receipt. Original184-input census142/41/1 unchanged.

The focused wide-sprite oracle now compares the original simulator and native
VM: offscreen edge collisions in both argument orders, transparent neighbours,
pixel edits and all19200 presented screen pixels. It repeats the checks through
Code reconstruction, SB3 reload, original execution of exported MakeCode and
native reimport. `test/arcade-wide-artwork.test.mjs` contains the portable control.
Original display readiness is observed after completion. The first fixture's
constant completion marker was optimized away; its timeout is preserved and
the corrected mutable marker passes. No runtime adjustment was needed.

Next: collect the exact-head hosted wide-artwork journey; resolve namespace
Buffer/song semantics in coordination with the importer owner and complete
graphical dependency import and authoring evidence. The original census and
pending browser acceptance are not promoted by this focused oracle.

## Byte-buffer runtime foundation — 2026-10-12

`scripts/generate-arcade-buffers.mjs` extracts the complete buffer methods from
the pinned pxt-core13.2.1 simulator, records their SHA256 and verifies exact
regeneration. The generated `buffer-pxt.js` retains original numeric, byte,
slice/write/fill/shift/rotate algorithms. `buffer.js` supplies a bounded mutable
Uint8Array facade; the mixer now uses it instead of its four-format adapter.
The original Microsoft MIT notice is shipped and recorded in the notices.

`test/makecode-arcade-byte-buffer.test.mjs` executes original MakeCode programs
and compares all16 number formats, aliasing, detached copies, self-overlapping
writes, range operations, clipping and UTF8. Allocation guards run before byte
allocation; unsupported numeric formats fail explicitly. Song/mixer regressions
remain required. The first original fixture used the shim's four-argument write
shape where the public TypeScript method takes two arguments; compilation
refused it. The corrected public call retains the overlapping-copy assertion.
That original failed attempt is preserved privately.

Next: wire distinct session-scoped Buffer values and native Blocks/Code words,
then coordinate importer/helper changes with E10 and preserve exact MakeCode
export operations. Namespace Buffer/song diagnostics remain until that complete
path works. This foundation does not establish graphical byte/song editing,
installed GUI acceptance or a changed original corpus census.

## Buffer value authoring and exact export followup — 2026-10-12

This continuation supplies a genuine `buffer` reference kind to BWValues and
its own-fork Arrays fallback. Arcade keeps a scoped mutable byte heap: variable,
custom-block and array aliases name the same bytes; slice copies are detached.
Project start/load/disposal drops the heap; foreign/stale references diagnose an
unavailable buffer. The per-allocation bound remains1MiB, not an aggregate heap
or whole-process memory guarantee. Saved runtime references do not reconstruct
heap contents: authored programs rebuild their buffers when reopened and run.

Sixteen native Arcade words cover construction, dynamic hex, readonly literals,
length, byte and all16 NumberFormat reads/writes, slice/write/fill/shift/rotate,
hex/UTF8 output and `music.createSong(buffer)`. The canonical words are in
`docs/generated/ARCADE-AUTHORING-VOCABULARY.md`; `bufferFormats` is a genuine
reporter-accepting dropdown. Export preserves hex strings with leading zeroes,
uses actual NumberFormat members, infers Buffer parameters and Buffer[] aliases,
and declares Buffer variables correctly. Dynamic numeric format reporters work.
The Buffer atom is added only to the value graph's existing two whitelists;
importer/namespace/type-lowering ownership stays with E10.

Original execution caught and corrected a literal-identity error: identical
hex literals at distinct source sites are different objects; repeated execution
of one source site returns the same literal. The runtime caches by source block
and target, rather than hex content. Literal byte mutation follows the original
readonly check; numeric setter behavior is delegated to the original algorithms.
A song keeps its actual buffer, so mutation changes its subsequent playback.

Owned producer candidate: https://github.com/CrispStrobe/sb3-creator/pull/96
(stacked on the named-song branch; not a main adoption claim). Arrays fallback:
https://github.com/CrispStrobe/extensions/pull/34 . Lite records exact candidate
pins. Targeted `vendor-bundles.mjs --only arrays` preserves every other bundle
and receipt; its offline test invokes the actual script with one immutable-source
fetch and checks same-repository per-file pin metadata. Full component and final
Lite hosted qualification remains required before normal exact-head integration.

Focused controls are `test/makecode-arcade-buffer-values.test.mjs`,
`test/makecode-arcade-byte-buffer.test.mjs`, song runtime/value regressions,
`test/bw-values.test.mjs`, `test/vendor-bundles-targeted.test.mjs` and the bundled
source gate. They execute native VM Blocks/Code reconstruction, custom arguments,
array aliasing, SB3 fresh reload, all16 menu formats and actual original exported
PXT programs, including real sound-instruction bytes. Failed controls are retained
privately. No importer diagnostic or locked corpus classification is promoted.

Next: coordinate E10 namespace Buffer/hex construction and mutable song flow;
add the GUI byte inspector and visible errors; exercise the new Buffer words in
the hosted editor before declaring GUI acceptance. Original142/41/1 remains the
last full immutable184-input census. Authenticated41-context results remain
7translated/33partial/1parsefailure; static classifications are not game failures.

### Hosted wide artwork proof received

Exact PR810 head387337ad5's Build38256137458 completed all enabled checks,
including both browser shards. The official `arcade-animation-resource-browser`
artifact11754784220 records a161x121 two-frame animation: stable UUID, offscreen
corner edit, bundle version8, actual SB3 reopening, original PXT compilation and
38962 compared pixels. This supersedes the preceding pending wide-GUI note;
it does not qualify subsequent Buffer edits or claim a production deployment.
Permanent run: https://github.com/CrispStrobe/brickwright/actions/runs/38256137458
Artifact API: https://api.github.com/repos/CrispStrobe/brickwright/actions/artifacts/11754784220/zip

Buffer followup local checkpoint: the seven named suites above pass54 distinct
controls, with zero skips. This includes the actual VM source-site literal
identity control and original exported mutable-song sound bytes. Producer's
canonical dialect suite passes341 controls with exact298-opcode fixture coverage.
The component CI jobs were still queued when this checkpoint was recorded.

## Buffer editor/controller proof preparation — 2026-10-12

The separate `lane/arcade-buffer-gui-proof-20261012` retains PR810's in-flight
hosted diagnostic head. Its new fixture/controller test exercises actual native
keyboard events, Blocks/Code reconstruction and export from `vm.toJSON()`;
original Arcade buttons verify byte/numeric/copy/custom-argument observables.
Original compilation exposed a global `hex` name collision; `hex` and `img` now
use the existing reserved-name allocator. Matching serialized Buffer sidecar
placeholders are discarded as initializers, like image references, so exported
variables retain Buffer types and source reconstructs the values.

`scripts/verify-arcade-buffer-browser.mjs` uses visible Code/To blocks, native
16-format dropdown/numeric-shadow edits, controller A/B/down, From blocks,
File save/replacement/reopen and the actual MakeCode download. Original PXT runs
that download under its real buttons and compares the bytes. VM/Blockly access
observes only. The additive light-shard gate writes its own JSON/screenshots/
SB3/MakeCode artifact and a provisional zero-reading budget registered by the
existing generator. Browser execution remains pending; do not claim acceptance
from script presence or local gate contracts.

Focused fixture plus gate contracts pass22/22, no skips; Buffer runtime/vendor
regression batch passes19/19, no skips. A separate actual serialized-project
export control passes after the sidecar fix. No full local app build was used.
Arrays PR34 received a test-format-only followup598fc966: sparse preparation had
omitted its repository Prettier configuration. Actual Arrays source is unchanged;
the targeted pin now records that candidate. The informational gallery validator
reports the same34 errors as current main; raw baseline/candidate logs are private.
All enabled final-head component checks still need a fresh review before merging.

Importer owner: read [ARCADE-BUFFER-IMPORT-CONTRACT.md](ARCADE-BUFFER-IMPORT-CONTRACT.md)
for AST/opcode mapping, scope/typing/initialization rules, original controls and
immutable-context rerun criteria. Namespace Buffer import remains diagnosed.

## UTF8 Buffer construction continuation — 2026-10-12

The missing UTF8 constructor is now represented by `arcade_bufferFromUTF8`
and Code `arcade byte buffer from UTF8 text TEXT`. Its runtime creates fresh
mutable bytes using the pinned PXT simulator's TextEncoder path. It counts
encoded bytes before allocation, including paired and unpaired surrogates,
rather than relying on JavaScript character length. Export emits genuine
`Buffer.fromUTF8`, preserves literal numeric text and records a Buffer type.
Producer [PR97](https://github.com/CrispStrobe/sb3-creator/pull/97) adds the
independent canonical fixture; the census advances from298 to299.

The focused byte tests compare Unicode, embedded NUL, BOM and malformed byte
sequences against executed original PXT. Native tests cover dynamic text,
mutation through an alias, Blocks/Code reconstruction, serialized-project
export/original execution and reopening the actual SB3 archive. A JSON project
without its assets is not an SB3 reopening control. The first such harness
attempt failed in costume loading; preserve that failure separately from the
corrected archive path. The original immutable corpus count is unchanged.

The prior PR810 build failure was the exact producer guard in
`test/lego-spike-roundtrip.test.mjs` still naming the preceding compiler.
Commit `bf5d99f74a` advances that guard only after re-running its unchanged SPIKE
artifact assertions. PR834 includes that fix by normal merge; earlier failed
logs remain private. Hosted checks and the visible Buffer journey still require
exact-head results before merge or product qualification.

## Buffer public API audit and readonly continuation — 2026-10-12

An original compiler control rejected four-argument `Buffer.write`; those extra
parameters are internal simulator arguments. The isolated proposed range word
is withdrawn and does not enter the candidate. Original source declarations
(`base/shims.d.ts` in the pinned target bundle) expose only `write(dstOffset, src)`.
Select fragments with the public detached `slice` operation before writing.
The failed experiment and its parser precedence failure are retained privately.

The next genuine missing public method is `Buffer.isReadOnly()`. The native
`arcade_bufferIsReadOnly` Boolean reports the generated original algorithm's
state; Code spells it `arcade byte buffer BUFFER is read only`. The facade,
block metadata and exporter retain actual Boolean values, including guarded
mutation. Literal aliases remain readonly; slices, hex decodes, UTF8 decodes and
allocated buffers are mutable. Its producer adds one canonical form,299→300.
The import contract now lists the remaining public Buffer declarations so the
next worker does not mistake internal simulator parameters for a public API.
Hosted GUI/feature qualification and E10 import remain separate requirements.

Readonly checkpoint:20 affected original/native/producer-identity/SPIKE controls
pass with zero skips; producer canonical controls343pass with zero skips.
The exporter recognizes the readonly reporter both in its type graph and Boolean
condition classification, avoiding a numeric comparison around Boolean guards.
Earlier malformed test grammar and an incorrect live-variable initializer
expectation are retained privately. Actual archive reopening rebuilds the scoped
heap. Product browser qualification and the184-input classification are unchanged.

## Buffer concatenation, equality and byte search — 2026-10-12

The continuation implements public `Buffer.concat(other)`, `equals(other)` and
`indexOf(other)` through three functions extracted from the consumed original
`base/buffer.ts` in Arcade4.2.1's target bundle. The reproducible generator records
complete/selected source hashes and preserves original expressions/control flow.
Its six indexed Buffer reads call the existing original `getByte` shim after
transpilation. This explicit adaptation preserves PXT out-of-range zero reads;
plain JavaScript typed-array indexing would change empty-needle search results.
`Buffer.create` is injected as the bounded allocator, so concatenation checks
combined size before allocation and creates fresh mutable storage.

Native blocks and Code spellings are listed in the generated vocabulary; typed
export emits the genuine instance APIs. Equality remains Boolean in guards and
variables, search remains a number, and concatenation yields a scoped Buffer.
Explicit null equality follows the original helper at the runtime boundary;
unknown, foreign and stale references retain named diagnostics. This is not a
new general null-literal/import capability claim. Static `Buffer.concat(Buffer[])`
is a separate remaining array integration task.

Checkpoint:25 affected controls pass with zero skips, including original PXT
empty/zero/bounds/null comparisons, detached/readonly concatenation, allocation
limits, native aliasing, Code reconstruction, actual saved SB3 reopening,
serialized export/original execution and exact producer/SPIKE artifact identity.
The producer's303 canonical forms have346 passing controls and zero skips.
Hosted build/browser qualification and E10 import remain pending; the locked
184-input corpus classification is unchanged142translated/41partial/1parsefailure.

## Full-build provenance failures — 2026-10-12

[PR834 Build38279944717](https://github.com/CrispStrobe/brickwright/actions/runs/38279944717)
failed four fast-suite controls: an obsolete282-opcode expectation, an uncensused
offline URL assertion, missing scoped Arrays license evidence, and omission of
the scoped Arrays pin from the pin-chain key inventory. The corpus inputs and
417 generated-program expectations were unchanged. The comparison candidate has
303 canonical forms; older candidates require their own exact counts.

The correction reads the shipped Arrays source header without evaluating code,
requires its MPL-2.0 notice, and checks its exact per-file repository/commit
receipt. Missing/malformed bundles and missing/wrong notices fail explicitly.
The URL census identifies the injected offline test assertion; production fetch
validation remains separate. Twenty-two affected controls pass with zero skips.
This is focused gate repair, not a new full-build or GUI qualification.

The same run's heavy browser job failed during dependency installation with
ECONNRESET before product checks. Its light browser diagnostic was still pending
at this checkpoint and must finish before advancing that source head. Preserve
both failures privately. Hosted candidate checks and the locked142/41/1 corpus
classification remain independent acceptance requirements.

## Particle composition assertion — 2026-10-12

[PR810 Build38279930848](https://github.com/CrispStrobe/brickwright/actions/runs/38279930848)
also failed a fire-frame assertion. Total fire-color counts need not exceed
sprite-color counts when particles overlap the sprite. The replacement requires
positive visible emission and compares every actual original-source pixel write
with the composed scene frame. Ghost/dissolve, lifetime, handlers, cleanup and
original-PXT comparisons remain. All eight particle controls pass with zero skips;
a deliberate missing composition layer is rejected by the exact-pixel assertion.
No product algorithm or random distribution changed. Parent provenance fixes are
prepared with the exact298-word table and original scoped Arrays commit; wait for
its surviving focused diagnostic before advancing its head. Candidate full-build
and Buffer browser qualification remain pending; no corpus promotion occurred.

## Buffer browser first execution — 2026-10-12

[PR834 light browser job](https://github.com/CrispStrobe/brickwright/actions/runs/38279944717/job/114927678175)
reached visible authored native blocks without page/block errors, then timed out
opening the format menu after a coordinate click. It completed no controller or
archive/export cycles; this is failed GUI qualification. The followup clicks the
identified authored SVG dropdown through Playwright's visibility/hit-target
checks, following the existing schema browser control, and retains a failure
screenshot and field observations. Hosted rerun must establish the result.

The surviving parent focused diagnostic passed before its source was advanced.
PR810 now includes prepared provenance fixes and the exact particle pixel check.
PR834 incorporates those fixes with298 canonical forms and its own selected598fc
Arrays source notice. Eighteen parser/fetch controls pass with zero skips; the
browser script passes syntax/whitespace checks. No corpus classification changed.

## Buffer number-format size authoring — 2026-10-12

The continuation extracts genuine `Buffer.sizeOfNumberFormat` from the pinned
common-package source. No parallel format table is maintained in runtime code.
Native `arcade_bufferFormatSize`, the shared16-format menu, canonical Code form
and typed export are added; producer PR100 advances303→304 canonical forms.
Numeric custom-function returns and invalid-format zero behavior are explicit
controls. The importer remains E10's lane.

The controls also exposed a weak older literal-return fixture: two malformed
argument inputs both returned zero, satisfying an identity comparison. It now
uses the actual empty JSON argument array and checks returned Buffer bytes and
length before identity. Preserve both failing harness attempts privately: the
first awaited an optimized-away original completion marker; the second used the
malformed function argument input. Neither licenses a wider compatibility claim.

Format-size checkpoint:28 distinct affected controls pass with zero skips
(5 unchanged parser/corpus,10 numeric-byte/helper,1 exact SPIKE artifact,
2 format-size and10 Buffer value controls). The final12-control run includes
the strengthened literal-return fixture and original execution of exported
numeric functions. Producer347 controls pass with zero skips. Generator and
whitespace checks pass. Hosted acceptance and the locked142/41/1 census remain
unchanged. Static Buffer-array concat, number arrays, Base64, chunking, packing,
hashing and aggregate resource limits remain on the source-derived backlog.

## Buffer number-array bridge — 2026-10-12

Original `Buffer.fromArray`, `buffer.toArray` and static `Buffer.concat` now have
native reporters, shared menu/Code forms and typed export. Producer PR101
adds304→307 canonical forms. The source extractor retains original loops and
records full/selected hashes; six indexed Buffer reads and one write use original
byte shims. Number-array reads are not treated as Buffer reads. Native references
are scoped, copies detach storage and static concat preserves readonly inputs.

The native authoring check exposed fixed numeric JSON reference constructors
that ran but were refused on export. They now emit parsed numeric source
literals (retaining negative zero syntax); other unsupported constructor forms
retain diagnostics. Export adds number[]/Buffer[] constraints through the
existing graph. No E10 shared inference/importer source was changed.

Five algorithm/guard controls passed in the first batch; its authoring fixture
initially used an invalid mutation spelling, then text values instead of numeric
reporters, and had a malformed replacement during correction. All attempts
remain private. The corrected fixture then exposed the real fixed-array export
gap. After implementing it, all6 array controls pass, zero skips, including
original exported execution, custom array return, Code reconstruction and actual
fresh SB3. Together24 distinct affected controls pass with zero skips; producer
350 controls pass. Hosted checks and locked142/41/1 classification are separate.

Readonly PR836's original heavy browser passed; light failed at the same Buffer
dropdown. Both completed before gate/actionability fixes were propagated with
its own300-word census. Preserve the failure. The UTF8 heavy diagnostic still
survived at this checkpoint; do not advance that head while it runs. Next source
APIs: Base64, chunked alias/copy semantics, pack/unpack, hash and aggregate heap
resource handling. Namespace importer integration and actual GUI evidence remain
required before any whole-game or corpus promotion.

## Buffer Base64 continuation — 2026-10-12

Candidate `lane/arcade-buffer-base64-20261012` is stacked on
[PR843](https://github.com/CrispStrobe/brickwright/pull/843). It adds native
`arcade_bufferFromBase64` and `arcade_bufferToBase64`, their Code spellings and
typed MakeCode export. Producer [PR102](https://github.com/CrispStrobe/sb3-creator/pull/102)
contains the independent vocabulary fixtures; its exact pin is in
`vendor-pins.json` and the canonical census is309.

The generator retains the original MIT alphabet, encoding, parsing and Buffer
construction from the consumed target. Nine Buffer reads, four writes and ten
string reads have checked adaptations. PXT string indexing uses `charAt`, so
unpadded `AQ` decodes to `010000`; `AQIDBA=` is rejected by original MakeCode.
The first test wrongly included that rejected form among accepted inputs and
used a fictional undefined sentinel; corrected fixtures preserve both failure
logs privately. No product fallback or parser weakening was needed.

The affected six-file batch passes29/29 without skips; producer controls pass
352/352 without skips. It covers original byte/Unicode/array/format behavior,
Base64 tails and URL-safe input, original malformed-input rejection, native
mutable aliases and readonly encoding, custom string returns, Code/Blocks
reconstruction, original typed exported execution and actual fresh SB3 reopening.
Both generators regenerate exactly. Hosted builds and visible GUI proof remain
pending; namespace imports, the byte inspector and whole-game recensus are open.

The older UTF8 candidate [PR835](https://github.com/CrispStrobe/brickwright/pull/835)
now retains the parent provenance/dropdown fixes by normal merge after its
previous diagnostics finished. That predecessor's heavy browser shard passed;
its build and light failures remain evidence. Fresh checks use merge `b662f2ecaf`,
299 canonical forms and the UTF8 producer pin. Never apply309 to older candidates.

Next Buffer slices: original chunking/UTF8 chunk boundaries, packing and unpacking
format parsing, then hash and aggregate heap lifetime. E10 keeps AST/namespace
import and shared type helper ownership. Locked184 originals remain142 translated,
41 partial and1 parse failure; authenticated41 contexts remain7/33/1.

## Buffer chunking continuation — 2026-10-12

Candidate `lane/arcade-buffer-chunking-20261012` stacks on
[PR844](https://github.com/CrispStrobe/brickwright/pull/844). Producer
[PR103](https://github.com/CrispStrobe/sb3-creator/pull/103) supplies311 canonical
forms with its exact pin in `vendor-pins.json`. Native `arcade_bufferChunked`
and `arcade_bufferChunkedFromUTF8` return scoped Buffer[] values through Code,
blocks and typed original MakeCode export, including custom returns.

Original helpers are source-extracted, with checked signed division and two
bounded collection pushes before the next output allocation. A fitting Buffer
is returned by identity, retaining readonly status. Multiple chunks detach.
Fractional slices, UTF16 search offsets, surrogate splitting, BOM/NUL and
malformed surrogates match executed original traces. Named guards bound unsafe
nonprogressing sizes, UTF8 inputs, individual bytes and chunk collections.
See [the import contract](ARCADE-BUFFER-IMPORT-CONTRACT.md) for limits and commands.

The first six-file batch passed29 controls and failed one authoring fixture:
it omitted the existing word `text` in `from hex text`. Correcting that fixture
gives the sixth chunk control; its native Code/Blocks, Buffer[] custom returns,
original exported execution and fresh SB3 pass. A separate existing Base64
authoring/archive regression also passes. Distinct affected controls31, zero
skips; producer354, zero skips. Both generators reproduce exactly. This is
focused source qualification, not a full product build or visible GUI proof.

The completed PR834 followup has a passing heavy browser shard and passing unit
suite. Its build job was cancelled after30 minutes before distribution guards
completed; do not call it a passed build or a new unit failure. Its light shard
failed when the Buffer menu selector found no element. Saved observations show
the field atx1122, clipped beyond the workspace atx865. The original Scratch
Blocks field initializer also places a shadow's dropdown attribute on its root,
not a child. Preserve the public failures and private screenshot/JSON; the
visible field journey needs corrected user panning and selector qualification.

Next source slices are pack/unpack/format parsing, hash and aggregate heap
lifetime. E10 retains AST/import/shared type helpers. The immutable184 census
remains142/41/1; authenticated41 contexts remain7/33/1 until a true recensus.

## Buffer shadow-menu browser correction — 2026-10-12

The completed [PR834 light followup](https://github.com/CrispStrobe/brickwright/actions/runs/38290533343/job/114968997925)
failed before any edit/controller cycle: the selector looked for a child
dropdown under the shadow root. Scratch Blocks `Field.init` places the argument
attribute on the shadow root itself. The captured field coordinates were also
beyond the clipped workspace, despite lying inside the page viewport.

The browser script now selects that actual shadow root, pans with real mouse
wheel events before dropdown and numeric edits, and waits until the observed
field is inside the editing area and its block receives the click point. It
records both positions, preserving failed JSON/screenshot evidence. It does not
set fields, reposition Blockly programmatically or mutate the VM. Syntax and
whitespace checks pass; fresh hosted visible journey remains required before
acceptance.

The same run's unit suite passed; its full build job was cancelled after30
minutes before final distribution guards. Heavy browser passed. These outcomes
do not qualify the full build or make a failed GUI journey a success.

Chunking integration retains the corrected shadow-root selector and real user
panning from PR834. The predecessor build job was still queued with no steps
when this necessary browser correction was carried forward; no surviving
browser diagnostic was interrupted. Native source controls remain31 passing
and the selected canonical fixture remains311; exact-head hosted acceptance
for the combined tree is pending.

Older integration errata: sparse restoration accidentally resurrected the
frozen282 fixture on UTF8/comparison integrations. Direct execution verifies
their actual tables at299/303. Corrected heads2074beaf5a and d2a1fd569a retain
their own producer pins and those independent fixtures. Their intermediate
heads are unqualified history, not passed acceptance. During merge resolution,
read automatically merged files from the index and validate each selected table
against its fixture before pushing; do not restore the predecessor over it.

CI qualification followup: the completed PR834 unit suite passed but left too
little time for its remaining build guards within the30-minute job. Audit the
actual durations and separate expensive original PXT compilation/simulator
controls into a required shard with the same complete file/skip census and
deployment dependency. Do not remove controls, hide failures or treat an
incomplete distribution guard as passed to recover the budget.

## Buffer packing checkpoint — 2026-10-12

Native blocks and pseudocode expose `Buffer.packedSize`, `Buffer.pack`,
`.unpack` and `.packAt` through genuine typed MakeCode export, scoped number
arrays and custom returns. Selected original format parsing is retained, with
bounded format length, repetition/work and unpack-result allocation. The
[Buffer contract](ARCADE-BUFFER-IMPORT-CONTRACT.md#packing-and-unpacking-continuation)
contains exact vocabulary, parser semantics, controls and remaining GUI tasks.

Seven packing controls pass with zero skips, including original simulator byte
comparisons, Code/Blocks reconstruction and actual fresh SB3. The preceding
30 affected controls passed in the first batch; its three new failures remain
preserved privately. They exposed Chromium/Node NaN payload differences,
original panic108 versus native detailed failure transport, and a fixture
variable named `size` colliding with an existing pseudocode command. Exact
missing-float byte comparison now executes the retained facade in Chromium;
no artificial NaN byte pattern was added. The authoring fixture uses
`packedWidth`. Producer controls pass358/358; canonical vocabulary is315.

The latest PR834 build and heavy browser shard passed. Its light browser shard
was still pending at this checkpoint. No fresh visible editor success or full
corpus promotion is claimed. Next source slice: original Buffer hash, then
aggregate live heap/lifetime; E10 import, byte/format/array inspection and
whole-app/controller/graphics qualification remain separate. Locked184 remains
142 translated /41 partial /1 parse failure until genuine recensus.

## Buffer controller-key browser followup — 2026-10-12

[PR845 light browser](https://github.com/CrispStrobe/brickwright/actions/runs/38306464578/job/115012657444)
completed both real shadow edits with all16 format choices and reached the
controller cycle. Initial state and A's numeric write passed; the B phase timed
out. The pane sends keyboard `z` for B, while the authored fixture listened for
`b`. Its original-export alias mapping alone did not establish pane behavior.

The fixture now listens for the pane's actual `z`. Its native control verifies
an ordinary `b` press leaves phase1 and source bytes unchanged, then `z` copies
and edits detached bytes; original exported A/B/down behavior remains required.
The browser failure report now includes observed values at the failure boundary
so later timeouts preserve the reached state. No VM/keyboard state is injected
into the visible browser journey. Heavy and FPGA passed at the failed head;
build was pending. This correction still needs fresh hosted editor proof.

## Original Buffer hash checkpoint — 2026-10-12

Candidate `lane/arcade-buffer-hash-20261012` is stacked on
[controller correction PR847](https://github.com/CrispStrobe/brickwright/pull/847).
The producer is `feat/arcade-buffer-hash-20261012`, stacked on
[packing PR104](https://github.com/CrispStrobe/sb3-creator/pull/104).
Native `.hash(bits)` uses unadapted FNV-1/folding functions extracted from the
consumed common simulator; its generated file records source hashes and the
existing Microsoft MIT notice is extended explicitly.

Three new hash controls pass, including original width/byte matrices, native
refusal and aliases, typed numeric custom returns, actual original exported
execution and fresh SB3. Seven packing controls pass on the corrected runtime;
16 other selected controls passed in the first batch. Producer359 passes, no
skips, selected vocabulary316. Preserve initial failures: wrong block-argument
helper prevented extension registration, a native fixture supplied TEXT instead
of HEX, and a return-type regex omitted permitted whitespace. Those controls
were corrected and rerun; no original algorithm was patched.

PR845 heavy/FPGA passed; light failed at the known B fixture mapping and full
build failed at30 minutes. The separate controller correction requires fresh
hosted proof. Audit full build durations and preserve every test/deployment gate
when separating expensive original simulator checks. Buffer memory roots and
collection acceptance are now specified in the Buffer contract. Locked184 is
still142 translated /41 partial /1 parse failure; no whole-app promotion.

## Required unit workload split checkpoint — 2026-10-12

Candidate `lane/arcade-unit-shards-20261012` follows original hash
[PR849](https://github.com/CrispStrobe/brickwright/pull/849). Two mandatory
unit legs partition the complete fast suite; original local full commands and
corpus membership remain intact. Each leg retains the original runner, GUI
resolution, file census and skip-pointer audits. Pages and external main
publication require both legs. Preparation is intentionally identical to the
build and enforced by a source contract; the build alone owns Pages artifacts.
See [CI qualification](ARCADE-CI-QUALIFICATION.md) for selection, full commands,
observed failure origins and exact hosted acceptance criteria.

Focused source controls pass40 with zero failures; four pre-existing flasher
source controls skip in the local environment without their checkout. These
are not substituted for actual hosted shard runs. The first batch's sparse
missing-input failures and a contract regex that matched an existing optional
preparation diagnostic are preserved privately. Materialize exact tracked
inputs and test the mandatory runner's error policy separately from unchanged
optional setup diagnostics. No test gate or historical receipt was weakened.
Next: complete hosted build/unit/editor proof, then live Buffer collection.
The immutable corpus remains142 translated /41 partial /1 parse failure.

## Hosted shard/editor followup — 2026-10-13

[PR850](https://github.com/CrispStrobe/brickwright/pull/850)'s first split
build passed6m57s, unit1 passed16m24s, and unit2 failed16m57s on two audit
assumptions. Heavy/FPGA passed; light failed on export download. Do not merge
or treat that combined source as accepted. The checkout audit now validates
both job-local flasher inputs; the step-ID audit resolves per job with explicit
cross-job, forward, duplicate, self-outcome and multiline adversaries. Focused
controls pass28, zero failures/skips. Initial local followup failure counted
build's separately literal-pinned compiler as another dynamic flasher site;
its independent full pin remains enforced by the checkout census.

The light script reached real edits, native/controller cycles, Code/Blocks,
and save/replacement/reopen before the collapsed export action stopped it.
Open the actual Code actions menu; handle event/action promises together so
errors reach the final receipt path. Original failed artifact lacks JSON; do
not fabricate it from control flow. Fresh hosted exported original execution
still required. Public CI guide records exact run URL and method.

Remote main refreshed to b54f292f88 (peer PR821 merge) during this followup.
These fixes remain on the isolated candidate; no unrelated main source was
silently mixed into its tested tree. Integrate refreshed main in a separately
reviewed step after fixing the current diagnostic, then qualify actual consumer
pins and the immutable app census. Locked184 remains142/41/1.

## Buffer reset/disposal ownership — 2026-10-13

Candidate `lane/arcade-buffer-lifetime-20261013` follows
[unit/audit PR850](https://github.com/CrispStrobe/brickwright/pull/850).
Buffer/music IDs now include distinct heap namespaces, preventing same-runtime
owner collisions and cleared-registry resurrection. Buffer allocation bodies
are suspended at disposal and reopened at successful project load. VM clear
uses disposal internally: do not make the suspension permanent or reopen it
with green flag alone. Disposal also releases Buffer-backed playable roots,
resets queued audio and resolves paused callers. Shared value/import helpers
remain unchanged.

Four lifecycle controls pass, including actual same-VM SB3 replacement. The
preceding25 affected lifecycle/value/original-song controls pass without skips;
26 distinct controls are covered across runs. The initial pre-fix run preserves
Buffer ID collision/resurrection failures and a fixture observation that read
an adapter property instead of its underlying instance. Tests now use the real
instance for root observations; no raw receipt is rewritten.

Root collection during a live run and aggregate allocation reservations remain
open. The Buffer contract records specific runtime roots and serialized custom
argument values that a weak registry would miss. Full hosted/editor acceptance
is pending; immutable app classifications remain142/41/1. Lower-stack landing
is handled separately using normal merges; work continues on this top candidate.

## Buffer editor proof and storage continuation — 2026-10-13

The fresh PR850 head f30e57cfa2 passed all enabled source/unit/browser checks in
[run38342374353](https://github.com/CrispStrobe/brickwright/actions/runs/38342374353).
The passing Buffer browser artifact11789541637 proves actual format/value edits,
three A/B/down cycles, Code/Blocks reconstruction, File save/replacement/reopen
and genuine MakeCode download running in original Arcade with matching bytes.
The original ZIP and all members are preserved privately. This supersedes the
pending GUI/export observation above; preserve the earlier failed receipts.
It does not qualify subsequent candidates or close namespace import coverage.

Next child `lane/arcade-buffer-storage-20261013` follows lifetime PR853 without
changing that pending head. It removes a second copy of original detached slice
storage and encodes UTF-8 directly into the prechecked destination. Readonly,
detachment, typed-array construction and original simulator values are required
controls. Root-aware collection and aggregate reservation remain open, with
serialized values and music fibers needing explicit ownership. Continue the
ordered method in the Buffer contract. Locked184 remains142/41/1.

## Buffer root inventory — 2026-10-13

Child `lane/arcade-buffer-roots-20261013` follows storage PR855. The internal
read-only memory snapshot distinguishes registry retention from graph roots,
counts backing stores once and follows reachable scoped arrays and serialized
JSON. Owner roots cover target values/block fields, thread and custom-call
slots, callback captures, retained scenes, playable objects and literal sites.
Inspect the Buffer contract for its limits and exact scope. The walk never
sweeps; both root-coverage and collection authorization remain false even when
the supplied graph was fully visited. Generator/host closures still need
explicit leases, followed by preallocation reservation and controlled tracing.
Shared BWValues and serialization source are untouched. Whole-app142/41/1
remains unchanged; parent and child hosted results are separate evidence.

## Sustained corpus closure checkpoint — 2026-10-13

The operator requested autonomous continuation until fewer than20 unresolved
corpus cases remain partial. Keep the immutable raw184 and authentic mapped
project-context results distinct. A fresh raw audit at ad96760f7e remains
142translated/41partial/1parse-failed. A raw snippet with missing libraries or
art cannot be fixed by inserting placeholder sprites, dropping callbacks or
forcing a different rendering route. Close actual APIs and recover original
project inputs, then prove compilation/runtime/roundtrips per mapped case.

Native namespace Buffer source import is integrated from independently tested
converter source bb0fd971c. Typed aliases, source mutation and live song Buffers
now use the existing native block surface; unsupported views/init-order errors
remain diagnosed. Authentic prepared pizza has zero original compiler and
native translation diagnostics. Broader project execution and the fresh full
census remain required before a case is promoted. Namespace/source and runtime
work use separate file ownership; original evidence is retained privately.

## Original tile and controller operations — 2026-10-13

The next source candidate adds sprite.tileKindAt, image.equals and
controller.pauseUntilAnyButtonIsPressed to runtime, native Blocks/Code, source
import and genuine export. Image equality is extracted from the pinned
original PXT simulator. Tile probes use the sprite's center, signed tile-scale
shift, direction offsets and original outside-map tile-zero behavior. Pending
native button waits are released on Stop/disposal without resuming a later run.

Producer110787e7 exposes319 canonical forms;362 dialect controls pass. Native
and original focused batch10 passes without skips, including exported Boolean
values and fresh roundtrips. First oracle fixture had a compile-eliminated
constant; keep its failed receipt. A subsequent real export error inferred new
Boolean reporters as numbers; the exporter now classifies both reporters as
Boolean. Native comparison succeeded before that export correction. New visible
GUI interaction acceptance and immutable project recensus remain required.

Builtin tile-map companion lookup now reads exact pinned builtin images after
project-provided assets, preserving override precedence and unknown-image
refusal. This enables authentic recovered JRES maps without substitute pixels.

## Authentic resource fences and reproducible prepared census — 2026-10-13

Recovery now retains standalone JRES from original tutorial documents and
calls the original pinned worker's emitter, with actual loaded-worker hash.
All three CLI assembler callers are wired. Four exact tutorial contexts now
compile and import; subsequent native/controller/original/SB3 receipts must
state their observed boundary. Source Buffer/import, typed tile probes and
these maps remain separate changes with separate hosted qualification.

`compat-audit --prepare-extensions` adds a separate prepared-input result,
leaving the raw original-input classification untouched. Add `--fetch-extensions`
only when online dependency recovery is intended. Per-file hashes and source
provenance distinguish supplied project context from newly generated dependency
views. The original main bytes are checked before/after. Missing offline
libraries or prepared parser failures remain explicit failing results.
Do not reinterpret prepared translation or compiler success as a working game.

## Text sprites and resource factory integration — 2026-10-13

The current integration branch is `lane/arcade-text-sprite-20261013`, stacked
on [exponentiation PR869](https://github.com/CrispStrobe/brickwright/pull/869).
The matching producer is `CrispStrobe/sb3-creator` commit
`e358c7cebdcf2055d0f31197833cffddea81dbff`: 338 canonical Arcade forms.
It contains current multi-board and Calliope changes; syncing must preserve them.

Text Sprite creation, text/font/icon/border/outline setters, explicit redraw and
public field access are native Blocks/Code operations. The complete retained MIT
Microsoft library provides the pixel algorithms. Exact source admission retains
its SpriteKind initializer in the original file order. Class instances retain
sprite identity through arrays and procedure arguments/results. Numeric
`Sprite.kind()` allocation remains unresolved. See
`test/makecode-arcade-text-sprite-converter.test.mjs` and
`test/makecode-arcade-text-sprite-host.test.mjs`.

Resource factories now distinguish image and tile names, return genuine null
when a supplied gallery lacks the requested kind, allocate fresh image results
and preserve shared tile instances. Missing standalone galleries still produce
diagnostics. `test/makecode-arcade-asset-factory-roundtrip.test.mjs` qualifies
original execution, native execution, Code regeneration, SB3 reload, export
execution in original MakeCode and reimport. Generic zero-sized image sprites
preserve zero dimensions and original constructor positioning; invalid image
construction reports the original error. Public size defaults are unchanged.

The combined affected integration batch passes 17 controls without skips.
Hosted qualification is separate. Earlier PR869 CI failures include stale
numeric-output assertions, an outdated power-word assertion and a divergent
Arcade pane mirror; these are corrected on this branch. The Question component
and container mirrors are also refreshed; the tracked mirror gate passes.

Exact legacy background-scroll source and a scene host are retained and tested
separately. Version selection, source admission and export dependency selection
remain pending. Distinct program/scene clocks, older character-animation rules,
general classes/callable values and whole-game GUI journeys remain active gaps.
Raw census remains 142 translated, 41 partial, 1 parse failure; no project has
been promoted from these focused controls alone.

## Continuation after Text Sprite: exact libraries, clocks and strings

Current branch: `lane/arcade-legacy-scroller-integration-20261013`, stacked
on [PR870](https://github.com/CrispStrobe/brickwright/pull/870). This section
supersedes pending statements about the following focused integrations above.

- Exact background-scroll revision `43651f88b917a98ad886fdd4c1c2ad8001ce9b9c`
  now has native version selection, full-source admission and matching export
  dependency selection. Original/native/Code/fresh SB3/export/reimport controls
  retain its single-background API and frame priority before the camera.
- `game.runtime()` reads scene time; `control.millis()` reads program time.
  Scene transitions, timer resets, stop and restart have separate controls.
  Original debugger-paused time and complete scheduling parity remain open.
- Arrays adds primitive `String.fromCharCode()` and single-argument `.concat()`.
  UTF-16, nullable arguments, NaN and dynamic string returns survive editable
  roundtrips. Known opaque arguments and unsupported arities are diagnosed.
  General object coercion and failure control-flow parity remain open.
- The TypeScript reader retains angle and postfix generic assertions without
  runtime coercion. Assertions, comparison/shift operators and assignments to
  a variable named `as` have controls. General assertion typing remains open.
- The matching producer `540f1b31495822bd6e17f1d92d7f5af2b717cf1e` supplies
  345 forms. Arrays source is `6139c269b07799bbcaa3335cf2ef1c328d5014ee`.
  Do not sync an older producer over multi-board or Calliope declarations.

The public Gallery authority helper was exercised with an actual hosted
read-only token in [run38388670119](https://github.com/CrispStrobe/brickwright/actions/runs/38388670119).
It resolves the current successful deployment and the official successful
Pages job, rather than assuming the source head is deployed. Product branch
checks remain separate from that permission/control proof.

`test/fixtures/arcade-owned-text-game.mjs` and
`scripts/verify-arcade-owned-game-gui.mjs` add the production IDE journey:
Code typing, Blocks fields, Pixel painting, controller input, saved SB3 reopen,
MakeCode export and reimport. Hosted execution is pending; its original
simulator controls establish expected observations, not an IDE pass.

Next workers own exact older character-animation conversion and proper numeric
SpriteKind allocation/event semantics. Preserve original dependency initializer
order, omitted/null kinds and numeric IDs. Fresh prepared corpus and whole-game
acceptance must follow. Raw 184-input census remains142 translated/41 partial/1
parse failure; none of these focused results promotes a whole project.

## Numeric kinds, exact character versions and particle collections

The next integration branch is `lane/arcade-character-kind-integration-20261013`,
stacked on [PR877](https://github.com/CrispStrobe/brickwright/pull/877).
It includes the latest main through `b86d1cb9f294052bd0ae6dc4cd97d5bc57193c55`.

- Exact older character-animation source admission, native version selection and
  matching export preserve the original rule semantics. Unsupported modern-only
  operations on that version remain diagnosed.
- Numeric SpriteKind allocation follows the retained original allocator. Builtin
  Player/Food/Enemy are 1000/1001/1002; Projectile remains 1. Unused dependency
  initializers consume IDs in original order. Mutable and uninitialized kind
  bindings, fractional/negative IDs, nullable creation, captured event IDs and
  `sprite.kind()` use actual numeric values. Friendly names are separate metadata.
- Three full kind programs pass original/native, Code, same/fresh VM SB3, original
  export execution and prepared reimport controls. The combined worker batch
  passes 14 controls. This qualifies those programs, not arbitrary games.
- Twenty numeric Scene constants come from the selected SDK. Expression and enum
  use, shadowing and readonly assignment controls pass. Primitive String admission
  composes with Scene constants and numeric kinds while rejecting opaque objects.
- Particle source calls are lowered to local retained PXT collection semantics,
  without modifying global Array prototypes. Twelve effects/collection controls
  pass. Genuine Dance Party accepts all four controller buttons, scores and wins
  without runtime errors; random trajectories and exact timing remain unqualified.

The matching 349-form producer is
`95b89bcba319562b34498ab23b9cdfe7aa8a8c9b`
([PR118](https://github.com/CrispStrobe/sb3-creator/pull/118)); Arrays source is
`3f9812599cef61a0d47c843c6ba2c5ef4bdb98b2`
([PR38](https://github.com/CrispStrobe/extensions/pull/38)).
The source audit on PR877 retains all original input and binary hashes:
29 original-valid contexts, 12 invalid contexts; 16 valid structurally importable
programs, 12 semantic/API blocked and one parser failure. This is a structural
audit, not a promotion. Raw counts remain 142 translated / 41 partial / 1 failure.

Open boundaries include frame phases/cadence and debugger time, default info
loss presentation, genuine splash acknowledgement through the production UI,
Story/classes/callable values, broader custom kind authoring and original
MakeCode Blockly decompilation. The owned full IDE game gate remains pending
hosted execution. PR877 unit shard 2 failed because the generated character
admission module was unused there; the next integration wires it into actual
admission, translation and export. Its production graph must pass hosted checks.

## HUD, camera and terminal integration after numeric kinds

Root continuation is `lane/arcade-camera-flags-info-selection-20261013`,
stacked on [PR883](https://github.com/CrispStrobe/brickwright/pull/883).
Latest main `0e1ff551b64cce3ff12903b9d989eaf31a4b3a5a` is merged normally;
its CLI/Calliope and LabWired changes remain intact.

- Matching producer `1567ea01771ef95b70a1f54cf3c40c9d5f00962f` supplies 351
  forms. Its 490 local checks and all enabled PR119 checks passed; Pages
  publication is a declared non-PR step.
- HUD score/life/countdown visibility uses the original setters, explicit flags
  and countdown visibility behavior. Source variables named `score` or `lives`
  are renamed consistently so export preserves ordinary variables rather than
  treating them as legacy HUD values. See the
  [HUD contract](compatibility/arcade-hud-visibility.md).
- Default loss captures the original final zero HUD and retains explicitly
  configured sound/effects. Custom life/countdown callbacks run at the original
  HUD drawing boundary; waits and scene replacement preserve ownership.
- `scene.cameraLeft()` and `scene.cameraTop()` read raw drawing offsets without
  triggering modern camera updates. Sprite `flags` is a numeric readable field,
  including the destruction bit on retained references. Direct flag writes
  remain diagnosed; the original SDK field is mutable, not readonly.

The combined HUD/default/custom/visibility batch passes 25 controls with no
skips and two explicitly failing timing TODOs. Camera/flags and latest main
regressions pass 11 controls, including original/native/Code/SB3/export/reimport.
Initial callback phase remains 20ms native versus 0ms original in the timing
controls; it is not fixed by this integration.

Fresh unchanged-context structural qualification on `d6db08184` admits 17 of
29 contexts that compile against the selected Arcade 4.2.1/PXT13.2.1 SDK. Eleven
valid contexts retain API/semantic blockers and one retains a parser failure.
Seven context rows have explicit producer warnings; warnings are now recorded
and prevent structural success. Twelve other contexts report original compiler
diagnostics for the selected SDK. That is not a blanket claim about their
historical editors: obsolete instance overlap APIs still need historical source
and SDK qualification. Raw 142/41/1 counts remain unchanged.

Genuine Maze has 35 original/native comparisons: win at3940ms, loss at10000ms,
final HUD, dialog/cursor pixels and sounds. Its production GUI, editing, saved
project and export/reimport journey is prepared privately and still unrun.
The owned Text Sprite GUI journey's first hosted attempt failed at a stage-ID
read during project replacement; source now waits for a valid replacement ID.
The full journey must rerun. See
[run38396998964](https://github.com/CrispStrobe/brickwright/actions/runs/38396998964);
build/partial job successes do not establish a full workflow pass.

Next active areas are validated tile-map factory aliases/null/order; explicit
source-loop eligibility and frame scheduling; and original native splash/long
text rendering and controller input. Their respective controls and lane claims
remain separate from whole-game promotions.


## Source startup and source loops

The [source-loop contract](compatibility/arcade-source-loops.md) records genuine
Code/Blocks source-start and positive-condition loop forms, changing-bound and
break lowering, fresh SB3/original export roundtrips, and the remaining frame
scheduler and GUI qualifications. Updated consumer checks: four focused, five
import-line/decompiler and eight legacy/kind roundtrip controls pass. No raw
corpus partial is promoted by these focused results.

Fresh immutable tile-factory baseline audit admits18 of29 selected-SDK valid
samples with zero producer warnings;11 valid samples retain parser/semantic
issues. The other12 retain selected-SDK compiler diagnostics. Raw184/142/41/1
is unchanged. Complete-game execution and editor/save/export qualification remain
required independently of structural admission.


### Historical native text dialog and class follow-up (superseded by current qualification)

Native text dialogs now use retained rendering with live parent scenes and
controller release guards. The integrated source-loop/dialog controls pass20
with one strictly failing scrolling TODO. Explicit required phase mode turns
preserved timing/pixel TODOs into failures; the unchanged scroll event still
fails. Hosted graphical application qualification remains pending.

The [class contract](https://github.com/CrispStrobe/brickwright/pull/889)
requires globally unique reference identity and original constructor order.
Read-only original controls expose argument/field order and cross-class identity
failures in existing shared record lowering. Preserve its working same-class
aliases while designing explicit object references; Arcade class admission is
still unsupported. Source parser `instanceof` is supported syntactically and
reports missing runtime identity.

## Development continuation: typed procedures and exceptional completion

The next canonical protocols have native prototypes and a separate supplier
[candidate](https://github.com/CrispStrobe/sb3-creator/pull/157). Do not infer
consumer adoption from the presence of source modules or native tests. Preserve
the existing compiler and hardware pins until exact supplier qualification and
the coordinated consumer review are complete.

Actual ordinary parameter entry belongs before body effects for both stock
`procedures_call` and managed `arcade_callFunction`. Scratch's `util.stackFrame`
is execution context; the actual installed parameter map is
`util.thread.peekStackFrame().params`. Validation must bind that real map.
Constrained managed calls must reject malformed or non-array argument transport
and inconsistent resolved definition/formal mappings before creating a callee.
Keep unconstrained legacy behavior separate. Never turn a rejected constraint
into successful Undefined or a normal zero result.

The native exceptional coordinator distinguishes a primitive thrown value from
a parameter diagnostic. Both retire the actual failing invocation lineage and
prevent stale asynchronous completion; neither grants project metadata the
ability to issue an exceptional completion. Keep other scripts running and
retain scoped cleanup for actual managed frames and return values.

Source normal-completion analysis does not produce a value type. A throwing
branch is not an implicit Undefined return; unreachable returns must not supply
normal result facts. Full-source constraint facts remain separate so that a
dead incompatible return or formal assignment still reports its source error.
Preserve ordinary no-Throw analysis, hoisted declarations and unknown/recursive
call conservatism. Source Throw remains an explicit prototype until canonical
adoption; ordinary annotations need their own prefix-preservation integration.

Run the focused native procedure, constraint rejection, Throw, Sprite, source
completion and Map controls together against byte-matched installed overlays.
Record the entire candidate compiler actually consumed, not merely an injected
dialect table. The helper `runArcadeSourceCode` supports an explicit compiler
directory; `runProgram` does not honor that setting. Do not mistake a narrow
table projection for qualification of parsing, decompilation or saved projects.
GUI acceptance remains separately tracked in the
[capability ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md#next-canonical-protocols-native-prototypes-and-gui-work--2026-10-15).


### Combined optional/default and CI accounting follow-up

Composition `196e61cc7` passes 151 affected controls with the complete corrected
compiler candidate `9d3e222e`: zero failures, skips or TODOs in that focused run,
784 selected file guards unchanged and 174 VM overlay mirrors equal. This adds
portable actual optional/default Any behavior and the test-accounting repair;
it does not change the measured raw corpus or complete-project profile.

The original published consumer unit-three job remains failed. Its actual
census was 2437 tests, 2428 pass, zero fail, eight skips and one TODO. The old
auditor mistook that explicit pending compiler discrepancy for an ordinary
failure. The development correction retains passing and failing pending bodies
separately, distinguishes pending suites from leaf summary counts, and still
rejects ordinary, escaped-name and construction failures. Actual hosted
qualification of the corrected consumer remains required.

The optional Arrays supplier hook has a separate 32-control frozen candidate
and independent review, covering its actual 62-method inventory and no-host
behavior. It provides before-operation/body/result boundaries; it does not yet
supply a current VM execution loan, failed-continuation coordinator, typed Array
formal, Settings certificate, compiler pin or visible authoring workflow.
Physical Number input preservation is a separate supplier prerequisite.


### Actual default-argument mismatch and visible-display boundary

The next selected-original comparison compiled and ran two genuinely new numeric
Any-default programs once each. In the original default-signature program,
omission produced 50, explicit Undefined produced NaN, and supplied arguments
produced 15. All actual completion, trace and call-count observations were retained.
The development native routes instead produced 50 for explicit Undefined: this is
a compatibility failure. The independently edited current conditional export
matched its own native 60/60/15 observations, which does not close the original
source mismatch. An earlier function-call-default program was rejected by the
selected compiler before any runtime start. Neither result promotes corpus rows.

The canonical supplier changes are merged in
[sb3-creator PR157](https://github.com/CrispStrobe/sb3-creator/pull/157) after all
enabled checks passed; the reviewed and landed trees match. Consumer adoption
still requires the coordinated pin/writer handoff and its own qualification.
The CI-only follow-up in [PR888](https://github.com/CrispStrobe/brickwright/pull/888)
preserves product and dependency bytes while fixing TODO accounting and the Image
journey's editor/target-selector waits. Its new hosted results remain pending.
The [GUI ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md#visible-console-and-default-argument-acceptance-follow-up--2026-10-15)
records the untested real Game Console display workflow and omission controls.


### Omission-only defaults corrected after the actual failure

Successor `967668298` retains one editable default per formal and carries actual
omission through hygienic visible Number1/0 formals and exact call operands.
Supplied Undefined remains supplied. Original argument effects are preserved;
all generated Number obligations are checked from actual producers. The
integrated `049bf6b5a` passes 155 controls with 785 unchanged file guards and
174 matching installed VM overlays. Independent review adds 22 controls and
11 binding/default/alias/hygiene probes; the default conversion differential
retains 406 exact prior outputs.

One genuinely new edited omission-flag export then compiles and runs once in the
selected runtime: all six observations match 60/NumberNaN/15/CCC/3/1, with 783
source/runtime guards unchanged. The unchanged original source is bound to its
retained successful compilation and actual observations, without replay. Earlier
compiler rejections and the real Undefined mismatch remain intact. This closes
the bounded numeric-default mismatch, not typed defaults, complete corpus games,
visible default-authoring controls or production dependency adoption.


### Three authentic asset-context native follow-ups

Three retained authentic projects now pass 15 bounded native portable route
controls: flamethrower movement, crystal-ball button input, and Froggy's authored
scene/countdown setup. Each checks source import, current Code, same-VM SB3,
fresh-VM SB3 and current export/reimport using genuine resources. Actual direction
press/release moves and stops the flamethrower; the crystal-ball A edge produces
its authored response; Froggy creates its two authored sprites and starts the
countdown. All 5,225 selected source/provider/compiler hashes remain unchanged.

First private observers incorrectly located a life field and saved SVG assets;
their failures are retained separately from the corrected native controls.
Headless renderer/audio and listener warnings remain in raw logs. These checks
establish neither rendering nor zero runtime warnings. Original compiler success
is not original gameplay: exact-input SDK runtime, visible editor/controller,
artwork/save/reopen and complete-case qualification remain open. The raw census
and the 29-project aggregate are unchanged.

### Required primitive-formal preservation and genuine score producer

The reviewed local native candidate now retains supported ordinary required
primitive annotations by default, including an unused String formal, and admits
the genuine player 1 score reporter through source and native producer checks.
The focused 29-control batch covers current inputs/cache, trusted registration
renewal and lifetime refusal; a separate full
29-project pure profile retained twenty clean source/Creator inputs and twenty
clean exports from those inputs, and improved complete measured pure routes
from eighteen to nineteen through Lyla. No previously complete route was lost. Canonical compiler consumer adoption remains a gate.
Do not infer native Lyla, selected-original or GUI acceptance.

Track the Code/Blocks authoring journeys in the capability ledger: explicit
Number/String/Boolean constraints, unused-formal preservation, procedure-specific
selection, valid and invalid current callers/body writers, player 1 score numeric
connections, and metadata-preserving Code/Blocks/SB3/save/reopen/export/reimport.
Existing constraint blocks provide a starting interface; the shared text/number
dialog and unfiltered formal menu need specific authoring work. The remaining
GUI behaviors require actual browser evidence before they can be marked complete.


### Correct tutorial input authority before closing converter gaps — 2026-10-15

The explicit PXT 13.2.1 collector candidate preserves source, artwork and custom
helpers while taking package identities from package fences and target defaults.
Three actual offline CLI projections match their pure file maps. Corrected
Rockscout and Holiday now compile successfully with the actual SDK; neither is
a whole-case closure. Rockscout exposes 78 converter diagnostics and a Creator
prototype failure, with every partial body and graph retained. Its later Code,
SB3 and export/edit stages are unavailable. Do not add a whole-file native
admission merely to remove these diagnostics: tile-map, world-map, class,
callback and numeric producer semantics require actual support. See the
[qualification ledger](compatibility/arcade-authentic-project-qualification.md#corrected-tutorial-inputs-and-newly-exposed-conversion-gaps--2026-10-15)
for observations, source links and remaining gates. The original raw184 and
pure29 counts are unchanged. The block-icons dependency authority hold remains.

### Helper ownership and downstream image gaps — 2026-10-16

The ordinary procedure emitter now uses actual owner/declaration identity across
event roots. Six focused controls pass; fresh Holiday conversion retains all
58 unique helper bodies while eliminating repeated definitions. Its 140 source
diagnostics and two optional-reference argument parser failures remain. Correct
the optional-argument semantics rather than padding unknown reference values or
removing helpers. A normalized startup header does not identify the selected
conversion route; compare actual emitted definitions and effects.

Rockscout's 48 package image initializers can now be prepared with exact pixels,
but generic conversion still lacks their actual image resources and emits
placeholders. The unsupported count remains 78. Share proper image resource
allocation with the native route, preserving literal evaluation position,
alias identity, distinct allocations and editable artwork. Do not force whole
program admission or hide unsupported classes. See the
[measured boundary](compatibility/arcade-authentic-project-qualification.md#dependency-helpers-and-image-values-next-measured-boundary--2026-10-16).


### Scene-clock Number completion candidate — 2026-10-16

The [exact scene-clock contract](ARCADE-CLOCK-NUMBER-PRODUCER.md) now has an
unqualified source candidate with [private finite-completion and current-input
boundaries](compatibility/arcade-scene-clock-number-completions.md). It reuses
existing execution hooks, preserves the info census and adds no word, engine
ABI, pin or clock policy. Source/boundary-model/native controls are authored,
not yet run on this candidate. Do not promote Sparks, its external Timer writer
or its cyclic fields, nor visible editor acceptance, from this source change.

## Image entry metadata and editor contract qualification

The optional Image Array clone entry analysis now separates opaque root metadata from consumed executable data. It tracks the current Program and descriptors, rejects host functions and BigInt in serializer domains before helper calls, and preserves the original strict source-origin protocol. All 60 focused tests pass, including the original 55 unchanged controls.

An authentic FreeThrow conversion now issues the entry query and accepts the same first clone that previously failed before the query. Its next named refusal is a zero-argument `destroy()` on a sprite alias from an actual overlap callback. Proving that callback origin, every receiver writer and destruction reentry remains necessary; a `Sprite` annotation supplies no authority. Whole-game acceptance and the raw census remain unchanged.

The complete 22 import-request and 13 editor-contract tests pass with their existing mutation controls. The 24-test native-prompt module, actual browser editing and installed native dialogs remain separate pending qualifications. The original notice inventory missed five hyphenated license filenames; preserve the original coverage gap and use the complete inventory for the next qualification.

### Empty ordinary procedure preparation candidate — 2026-10-20

The historical 36 partial translations are stale baseline observations, not a
current gap count. The fourth complete 225-input attempt also stopped without
full reports: it recorded 105 subject-begin markers and 104 completed conversion
markers, then exited with signal 9 after 25.082 seconds of process CPU and
13.049 seconds of wall time. The launcher did not time out or send that signal.
All 225 current outcomes remain unobserved; progress markers confer no prefix
coverage or successful conversion count.

Saved process intervals attribute 13.042 seconds to the interval ending at the
import return, 8.121 seconds from the import return to the Creator return, and
2.229 seconds to completed report-wire capture intervals. These are inclusive
phase intervals, not exclusive function profiles or proof of a particular
algorithm's contribution. The importer and Creator remain the main cost
frontier. No execution cap is raised.

A new source candidate avoids ordinary procedure validation work only when the
complete compiler-owned preparation has no selected ordinary functions. It
retains declaration identity analysis, callable routes, signature selection,
escape checks, exclusions and duplicate diagnostics. A local currentness
admission is taken before analysis and checked after selection; uncertain,
changed-intrinsic, Throw and unknown inputs use the original path. Selected
functions still receive the original value graph, defaults and both validation
calls. Public low-level preparation and validation retain their eager behavior.
No graph, source/type certificate, callback or truth cache escapes this complete
operation.

This candidate has not been executed or measured. The extra entry observation
may cost more on nonempty selections. Full affected controls and a separately
admitted changed complete-input run are required before selection; there is no
speed or fit claim. Runtime, exporter and editor differences remain separate
qualification work.

## Ordinary default export observation — 2026-10-22

The ordinary JSON API, without either prototype option, exported the captured
counter with no unsupported elements or result warnings; complete files match
the earlier export. Independent saved-result review verified current inputs,
source and module loads. Preserve the outer wrapper failure on Node's module
format warning; this is an observed conversion result, not an all-pass wrapper
or a GUI/SDK/corpus result. See [the exact boundary and remaining acceptance](ARCADE-NUMERIC-CLOSURE-RESULTS.md#ordinary-default-export-observation--2026-10-22).

## Ordered continuation after the dormant-declaration checkpoint

The string character-code candidate proves only a numeric normal result for a
direct, current `charCodeAt` call with independently proved primitive receiver
and index writers. An indexed receiver can still be absent; this proof does not
establish array element presence, initialization, or successful execution.
The source-only prompt example now passes its native-addition analysis while
retaining its String-or-undefined receiver. Ten focused controls and seven
mutation cuts passed; the affected arithmetic groups passed separately. The
aggregate local run exceeded its existing CPU limit and is not a passing suite.
The selected SDK declaration and simulator bytes have focused identity controls;
the saved-project round trip, original MakeCode execution, browser and native
behavior still need their own qualification. This result changes no corpus row.

1. Qualify the final narrow stacked candidate once through automatic CI. Run
   the enabled original-PXT/native declaration case, preserve its first result,
   and fix actual failures before any readiness/landing claim. Do not substitute
   the bounded source-only selection for this acceptance. Avoid additional
   dispatches and full-CI labels unless the affected browser gate requires them.
2. Have the integration owner compose the reviewed parameter/declaration repairs
   into the active Arcade stack. Recheck the separate frozen-control pin-receipt
   repair against the current tracked script bytes; do not silently move pins.
   Existing integration failures remain a landing gate even if this narrow case
   passes. Refresh all exact-head results after source composition.
3. Continue native-addition operand failures by actual producer/writer family:
   opaque cells, ordinary/SDK call results, Sprite receiver properties, indexed
   reads and superclass results. Claim the exact family and ownership boundary
   before edits. A familiar API/property name or desired annotation cannot
   replace the actual initialized receiver, call result and all-writer proof.
   For the Array callback round-trip failure, first capture the actual exported
   project, native-addition draft and structured refusal using the existing
   `BW_ARRAY_CALLBACK_EVIDENCE_DIR` test hook. A reduced source probe suggests
   an SDK Sprite collection callback index and indexed Image pixel results are
   separate proof candidates, but it does not identify the failing operand in
   the executed project. The existing flat-Array callback proof deliberately
   excludes SDK `allOfKind` results; do not generalize it without independently
   proving the SDK collection, callback, writer and currentness boundaries.
   The compound-value arithmetic round trip now emits the actual post-VM
   addition refusal and generated draft as a TAP diagnostic on failure, before
   its unchanged assertion. A separate source-only export of the checked-in
   fixture refuses the indexed left operand of a startup array update. Its
   producer graph retains the global array's initial null alongside its fresh
   allocation. The local reset proof does not establish when that global is
   assigned: a future pointwise proof must close the startup entry and call
   order, allocation and alias lineage, all writers, intervening effects and
   source/prototype currentness. Do not discard nullable alternatives globally.
   Confirm the actual post-VM refusal first; this source-only result does not
   prove it is the same operand or establish an application completion.
   A subsequent narrow candidate proves the primitive normal result of that
   particular startup indexed read when a verified sole entry assigns a fresh,
   privately populated Array immediately before its self-update. It checks the
   actual bindings, writers, effects and source/prototype currentness; it does
   not issue a general Array or element-presence fact. Focused source controls,
   direct issuer rejection cases and the maintained fixture's importer-to-exporter
   path pass. The official post-VM diagnostic and full PXT, SB3, browser and
   corpus qualification remain pending; no partial has been promoted.
4. Run the immutable corpus and complete original project contexts on a qualified
   external worker, retaining source hashes and the first results. Separate
   import, export/reimport, original PXT execution, Lite execution and controller/
   presentation outcomes. Promote a partial only when its whole actual program
   passes the required routes; synthetic helper successes change no corpus row.
5. Keep Blocks, Code and graphics authoring gaps in the capability handoff.
   In particular, arbitrary reference annotation editing/serialization and the
   broader initialized Sprite/reference graphs remain outside these dormant
   declaration repairs. Require save/reopen and MakeCode roundtrip evidence for
   each authoring capability rather than inferring it from converter support.

## Current bounded proof and corpus follow-through (2026-11-12)

PR #1734 combines bounded local literal-Array and numeric-overwrite proofs with
existing refusal controls. Refresh its head and exact enabled checks before
acting. Focused source tests do not qualify the original program: require
source-bound PXT and native execution, export/reimport, SB3 and browser results,
including actual effect order and output for multiple call-valued Array items.
One three-call middle-selection case has matching actual PXT and headless VM
results, including VM export/reimport, Code reparse and fresh-SB3 reload. An
actual editor journey and whole-project qualification remain pending. Keep
mixed, unknown and escaped values refused unless independently proved.

A prior nightly differential failed its rotating sample without retaining a
case verdict in the public job output. The candidate reports only bounded case
IDs and verdicts on a child failure and leaves the failure in force; it does
not establish that failure's cause. Preserve the original result, diagnose the
case from a subsequent authorized result, and do not change corpus thresholds.
