# Native Arcade animation interchange

Status: native gallery export/import, validated rich-source companion transport,
persistent hidden artwork libraries and uniform-animation authoring are
implemented. The finite live-original-Assets editor journey now passes: native
project import, unedited PNG save with exact rich source/UUIDs, actual asset
edits, download and Brickwright return with visible edited playback. See the
[latest original-editor boundary](#original-makecode-assets-editor-and-native-project-files)
and [GUI closure ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md#u04--animation-binding).
Earlier sections preserve chronological qualification boundaries; later
receipts supersede their open items only where explicitly tested. Unequal
frame timing, action binding, sheets, custom palettes and corpus-wide closure
remain open. No locked corpus partial result is closed by these synthetic
fixtures alone.

## Reached format boundary

`overlay/scratch-gui/src/lib/bw-makecode/animation-jres.js` implements native
`application/mkcd-animation` entries. Data is base64 of ASCII hexadecimal bytes:
four little-endian u16 values (interval, width, height, frame count), followed
by row-major packed bitmap pixels, low nibble first, padded per frame. This is
different from the column-major `image/x-mkcd-f4` image encoding.

The codec validates native namespace/ID and display names, timing, frame/pixel
counts, palette indices, exact payload length, padding and canonical encoding.
Its explicit application bounds are160×160,64 frames,1MiB packed bytes;
intervals are1–65,535ms. Pixel publication now supports1–64 frames,
1–65,535ms and uniform timing. Extended timelines use document5/bundle6;
ordinary timelines retain their existing document/bundle versions. Outside-policy input produces named errors;
it is not resized, coerced or truncated. Palette RGB and rich source are not
represented by this native binary format. Native IDs/namespaces are bounded
nonblank printable references, not JavaScript identifiers. Display names follow
original MakeCode asset-name rules; they are not silently sanitized.

The decoder accepts explicit native IDs/namespaces, including entries normalized
by original `Package.parseJRes`. Its raw-gallery convenience arguments use a
qualified fallback key once; this intentionally does not reproduce original
PXT's double-prefix edge case for missing IDs and already-qualified gallery
keys. Keep the original gallery key when generating native factory aliases.

`test/makecode-arcade-animation-jres.test.mjs` invokes the actual retained
Microsoft PXT worker encoder, decoder, package normalizer, emitter and name
validator. Eight tests cover asymmetric odd/even layouts, large bounds, frame counts, native key/namespace
resolution, hyphen/Unicode IDs and namespaces, and malformed input. The combined
maximum resource has an exact local roundtrip; original-worker goldens test the dimension/count bounds
separately. This is compiler-format evidence, not original asset-editor evidence.

## Adopted native authoring boundary

The shared parser [PR62](https://github.com/CrispStrobe/sb3-creator/pull/62) is
merged and the consumer now pins
[`33ce7380e388e20b7c3a30e8ea84d1b774c30248`](https://github.com/CrispStrobe/sb3-creator/commit/33ce7380e388e20b7c3a30e8ea84d1b774c30248).
At consumer source
[`96e812a23`](https://github.com/CrispStrobe/brickwright/commit/96e812a2355a193bfb92cfb4b6982d82299792ad),
the canonical frame/interval resource words and native menu shadows are adopted.
Three publication-browser journeys qualify the named Blocks reporters, actual
palette drag/drop and UUID picker storage alongside Pixel publication/SB3
persistence. Eight codec tests, two highlight tests, four explicit producer
identity tests (zero skips), and four vendored original-export tests pass. The
full production controller/export/reimport journey subsequently passed at
`89700204711ce470ebb7a77e511ec960fa1e8b6d`, before native gallery wiring.
Native original-MakeCode animation asset editing remains open.

## Native wiring qualification

At source `8bca7037c`, the explicit production build passes. The full browser
journey passes six workflows with zero page errors and zero invalid playback
frames after readiness. The downloaded HEX contains a native gallery named
`Run`, three exact3×2 frames in the edited order and100ms timing, with both
asset files listed in `pxt.json`. Original PXT compiles those downloaded files
without network attempts; all19,200 same-frame screen pixels match Brickwright.
File reimport and repeated controller stop/restart pass. This is native asset
transport and playback evidence, not original Assets editor or rich-source
reconstruction evidence.

The final export/import/integrated-overlay batch passes21 tests without skips;
the browser budget/shard/timeout/wait contracts pass25. The earlier affected
export/census batch passed119 tests with two stale integrated-copy failures;
after synchronization, both overlay checks pass in the final focused batch.
The saved-zero scalar test separately passes against original PXT. Earlier
failures remain preserved, including a stopped preview server and a harness
assertion that read shared dimensions from individual decoded frames.

## Companion transport qualification

At product source `55da1b20e`, the explicit production build passes. The browser
gate passes seven journeys: its downloaded companion recovers exactly the
current source document, including UUID, frame IDs, layers and palette. A real
malformed companion file import reports the error and preserves loaded target
identities, Code and published resources. Valid file reimport, controller
stop/restart, native gallery data and all19,200 original-PXT pixels still pass;
there are no page errors or compiler network attempts. The recovered document
is not yet installed into an editable imported Pixel timeline.

The affected project/import/export/overlay batch passes20 tests; the final
companion/project/overlay batch passes17, including native galleries larger than
128 assets. All seven existing CLI tests pass, including firmware roundtrips.
Companion unit cases cover native edits, missing/unused/deleted entries, palette
remapping, source validation, duplicate identities and bounded malformed input.
The first combined run passed24/25: its new file fixture passed a source string
where the byte importer requires bytes; the corrected three project tests pass.
This fixture failure is preserved, alongside the previous hosted single stale
unclaimed-animation diagnostic test. Native fresh-array runtime semantics are
unchanged by source recovery.

## Deferred loading and final local qualification

Native gallery parsing now lives in `arcade-animation-assets.js`, separate from
shared Pixel image rendering. The earlier hosted head had pulled the codec
into startup through shared artwork helpers. At product source `9f6ace3da`,
the production React profiling build passes the existing webpack ownership gate:
initial JavaScript is4,466,111 bytes, below the unchanged4,467,136-byte limit.
The [emitted ownership receipt](receipts/2026-10-07-arcade-animation-deferred.json)
identifies all three native animation parser/codec/companion modules in a
noninitial chunk. This qualifies emitted ownership/bytes, not startup latency.

The final ordinary production build also passes. Its animation gate passes all
seven journeys again with exact companion source recovery, atomic malformed-file
refusal and19,200 original-PXT pixels. The background gate separately passes
seven journeys after observing decoded SVG corner pixels before opening controls.
The saved hosted failure showed the asynchronous SVG load closing that panel;
no fixed sleep, forced click, timeout increase or assertion waiver was added.

The translation/companion batch passes140 tests without skips; after the module
split the native import/project/overlay batch passes16. Browser budget/shard/
timeout/wait contracts pass25. The stale hosted unclaimed-tag test now asserts
separate exact diagnostics for unsupported tags and missing native animations.
The earlier hosted build and both browser failures remain preserved. Fresh
final-head hosted qualification remains required before merging PR704.

## Original generated asset contract

Original PXT `emitProjectImages(jres)` emits `images.g.ts` with
`helpers._registerFactory("animation", function (name: string) {...})`.
Its switch checks `helpers.stringTrim(name)` and returns an Image[] for the
generated gallery-key alias or display name. Canonical IDs are identities,
not necessarily lookup aliases: ordinary galleries accept a short key, custom
namespaces and nested gallery keys can require the full key. The importer
reproduces the original package/emitter rules, including wildcard defaults,
explicit empty namespaces and double-prefix normalization. Actual original
compile/simulation tests cover eleven alias lookups and reject names for which
the original factory returns null. Each lookup allocates a new array; no
factory cache or interval reporter exists. Native references use
`assets.animation` tagged templates. The original
[asset template declarations](https://github.com/microsoft/pxt-arcade/blob/2d7d59b5226e8a1a1e05e8042dd9f5248ed68fea/libs/game/assetTemplates.ts)
provide the animation block identity separately from generated declarations.

A Brickwright exporter must cache each native factory result once to preserve
its own shared frame-array identity. Include `images.g.jres` and `images.g.ts`
in `pxt.json.files`, not only generated inline image literals. Asset display
names must satisfy original MakeCode rules, with explicit mapping/diagnostics
if a richer Brickwright display name needs adjustment. Avoid duplicate native
names and generated variable collisions.

## Remaining implementation sequence

1. **Native export implemented:** published resources, including unused ones,
   emit real `images.g.jres` entries and `images.g.ts` factories. Main code caches
   each used resource once, preserving shared array identity and computed UUID
   lookup. Uniform intervals remain explicit. Native ID/display-name collisions
   and user-global namespace collisions are handled; invalid names and duplicate
   aliases produce diagnostics. Original emitter substitution and actual PXT
   execution verify exact dimensions, frame order, pixels and fresh factory
   arrays. Palette remapping precedes both native and factory encoding.
2. **Behavioural native import implemented; persistent resources open:** native
   animation galleries are parsed separately from image assets. Tagged lookups
   lower to typed image arrays with original allocation and alias semantics.
   Malformed entries and ambiguous aliases produce diagnostics. Unused assets
   are validated but do not yet become editable GUI resources. Rich documents
   and stable UUIDs arrive separately through companion recovery below; this
   lowering preserves the native factory allocation semantics.
3. **Validated rich-source transport implemented; GUI restoration open:**
   `brickwright-animation.json` is listed in `pxt.json.files`. Version1 records
   bind canonical native asset IDs to complete validated source documents and
   exact exported projections. A no-edit match recovers UUIDs, frame IDs,
   layers and palette; native name changes update the label. Pixels, order,
   dimensions, timing or project-palette edits invalidate old source with a named
   warning while retaining native assets. Malformed/future metadata or duplicate
   bindings fail atomically. Missing metadata remains valid native playback.
   The companion is limited to16MiB and128 source records; this count limit does
   not restrict native gallery imports. Recovered documents are separate from
   image-array code and are not yet installed into an editable GUI library.
4. **Original GUI:** open the exported project in actual MakeCode Assets, locate
   the animation, edit name/frame order/pixels/timing, save/download and reimport
   in Brickwright. Verify native asset-backed blocks and test whether the
   original editor retains the companion file. Compiler inclusion alone does
   not establish that retention.
5. **Cross-surface regression:** verify Code↔Blocks, SB3 save/reopen, Pixel source,
   controller trigger/stop/restart and exact original playback. No-edit imports
   should recover validated source/UUID; edited assets must never resurrect
   stale layers. Test duplicate/renamed/deleted resources and generated names.

## Next persistent-resource transaction

Keep native resources separate from costume imports. `arcade-animation-assets.js` already
returns all valid animation entries, including unused entries. These now travel
through `arcadeToPseudocode` and `importProjectFiles` with independently validated
rich documents and named recovery warnings. `applyMakeCodeImport` displays those
warnings but does not yet install the resources. Carry them into the existing
compile transaction next. Generate validated resource carrier costumes
and artwork metadata inside the SB3 before `vm.loadProject`, then use the
existing artwork/resource synchronization and Code artwork retention. Clear
pending imports at the same unrelated-file/example/project boundaries as other
artwork. A half-valid document must never replace the loaded project.

Do not append resource carriers to existing actors or Stage: doing so changes
costume/backdrop counts and index behaviour. A dedicated hidden resource-library
target needs an explicit persistent role, preserved visibility through
Code↔Blocks, and exporter exclusion from gameplay actor creation. Name-based
recognition is insufficient. Rename/delete/Undo/duplication must preserve or
renew identities appropriately. The current Code artwork retention does not
preserve such a role or visibility; implement that before introducing carriers.

Native factory references create fresh arrays and images per lookup, while the
existing Brickwright frame-resource reporter returns a shared cached array.
Live imported resource bindings therefore need a fresh-copy access operation
with correct mutation/alias semantics; replacing every native lookup with the
cached reporter is incorrect. Pixel publication and versioned persistence now preserve native single-frame
resources and1–65,535ms intervals. Native imports can use those timelines
without frame duplication or timing clamps. The dedicated library transaction
and fresh-copy access operation remain open.

Reuse the existing bundle document validator and resource normalizer rather
than adding a second definition of valid layers. A bounded, versioned companion
must bind unique native IDs and resource UUIDs to source documents and their
exact exported projection. Compare dimensions, ordered pixels, interval and
palette against current JRES after the same palette remapping as export.
No-edit matches may restore UUIDs/layers; changed native pixels/order/timing or
palette must retain the edited native asset under a fresh identity and emit a
stale-source diagnostic. Names alone do not establish resource identity.

Acceptance must cover unused assets, multiple resources, duplicate UUID/ID
bindings, malformed/future metadata, renamed/deleted/edited native assets,
transparent pixels, custom palettes, SB3 reopen/Undo and Code↔Blocks. Test both
file and share imports. Original editor companion-file retention still needs
an actual Assets edit/save/download journey; compiler acceptance is insufficient.

Variable-duration scheduling, attached action bindings and custom-palette RGB
qualification remain distinct work. Neither the native format nor the current
uniform interval reporter should silently flatten those differences.


## Native timeline bounds

Pixel accepts exact integer frame durations in1–65,535ms and publishes one-frame
resources. Invalid input is refused before creating an Undo entry or changing
artwork. Removing a resource binding retains nondefault timing; Undo restores
the original UUID. Unequal frame durations remain editable and cannot publish
as a uniform native resource.

Extended bounds use artwork document5 and bundle6. Documents3/4 retain their
previous validation rules. An older bundle5 reader recognizes the newer bundle
as future source and preserves its raw bytes; a document5 falsely marked as
bundle5 is refused. The companion accepts validated resource documents4/5 and
recovers endpoint timing without an editor-bound fallback.

Focused tests pass50/50, including actual original-PXT compile/simulation of
one/two-frame resources at1ms and65,535ms, native gallery decoding, source
recovery and behavioural reimport. Policy/authoring controls pass31/31. These
synthetic cases do not change the locked corpus tally or establish editable
native imports. Production-browser qualification is recorded separately below.


### Final timing qualification

At product source `f945e7feb0522833c1794fe802fee6afc28f1507`, the runtime
resource reporters also accept1–65,535ms. Six runtime tests pass, including
actual frame advancement and invalid-value refusal. Three CLI/project tests
pass, covering both ordinary bundle5 source and single-frame bundle6 source at
both interval endpoints. Artwork roundtrip/import/wait checks pass17/17.

The production React profiling build passes the unchanged ownership gate with
4,466,357 initial JavaScript bytes against a4,467,136-byte limit. Native parser,
codec and companion modules remain deferred in chunk2182; the
[emitted receipt](receipts/2026-10-07-arcade-animation-native-bounds.json) binds
these observations to the raw stats hash. This is a bundle ownership/size proof,
not a startup latency measurement.

That verified profiling production app passes nine browser journeys, including
actual one-frame publication and SB3 reopen at1ms/65,535ms, Code-to-Blocks live
resource reporters at both endpoints, and exact visible pixels. Existing
controller, source-recovery, malformed-file and original-PXT journeys still
pass:19,200 actual Brickwright/original screen pixels agree and no page errors
occur. The browser records its served script identities and can require an
expected GUI bundle before starting.

An earlier ordinary production build and its eight-journey gate passed before
the runtime bound was updated. Two subsequent endpoint checks accidentally
served that older ordinary output rather than the corrected profiling output;
their unchanged failures and observed undefined frame/interval values are
preserved. Serving the correct build fixes those failures without weakening
assertions or timing budgets. Two profiling builds stopped for runtime/preparation
corrections are also preserved. Browser policy checks pass25/25. Fresh hosted
qualification is required before merge; editable imported library installation,
original Assets editing and93 corpus partials remain open. Fresh-copy native
lookup is implemented in the continuation below.


## Fresh and shared frame lookups

Consumer product source `fbac95e16bef9cf1cb289e0e503d328380ce8622` adopts
[sb3-creator PR63](https://github.com/CrispStrobe/sb3-creator/pull/63) at its
qualified merge `983aa61f2fa44901074763b7347588b4e210fc77`. All enabled producer
checks passed and the merge tree matches the reviewed head. Official consumer
sync and four vendor identity tests verify the adopted source.

```text
set shared to arcade animation frames resource "<resource UUID>"
set independent to arcade animation fresh frames resource "<resource UUID>"
set interval to arcade animation interval resource "<resource UUID>"
```

The first reporter shares a cached array and runtime images. The second creates
a new array and new images on each evaluation, including independent pixels and
palettes; it reads authored source rather than the possibly mutated shared cache.
All three accept native UUID menus or computed IDs and diagnose missing resources.
The native Blocks menu includes both frame operations. Code offers **Insert
frames**, **Insert fresh frames** and **Insert interval** with selection replacement
and a single Undo transaction. Python/JavaScript conversion retains distinct
reversible host-runtime calls; standalone generated renderer playback is unqualified.

Original Arcade export uses `assets.animation` factory calls for fresh lookups
and cached arrays for shared lookups. Actual original-PXT tests verify literal
and computed IDs, isolated image/array mutations, unchanged shared identity,
missing-resource results and helper-name collisions. Complete Brickwright →
Arcade → Brickwright → Arcade permutations attach the imported artwork through
the normal creator API and preserve all observed pixel values and identities.
A failed first permutation harness omitted that artwork step; its exact output
is retained. This does not establish an editable imported asset library.

Adopted consumer tests pass29/29 without a producer override. The profiling
production build passes all emitted ownership gates:4,466,357 initial bytes
against the unchanged4,467,136 limit, with native asset/parser/companion modules
remaining deferred. The [emitted receipt](receipts/2026-10-07-arcade-animation-fresh-lookups.json)
binds those observations to the exact raw stats hash.

The verified emitted bundle passes all ten full browser journeys, including
actual fresh-frame Code picker insertion, Code-to-Blocks, independent arrays,
isolated mutation and shared animation playback, controller stop/restart,
SB3 reopen, native timing endpoints and export/reimport. All19,200 actual
original-PXT/Brickwright screen pixels agree; compilation makes no network
attempts and the page reports zero errors. A separate four-journey publication gate drags all three native resource
reporters from Add Extension → Arcade, selects their actual dropdowns and
checks the published name and UUID in the VM.
Hosted final-head consumer checks
remain required before merge. Editable imported resource carriers, original
Assets editing, variable timing and action binding remain open.


## Explicit asset-library foundation

Product source `794cc9082344c837efc7beebc8e72e2f2056c5aa` adds a versioned,
name-independent `arcade-animation` library role. Artwork bundle7 carries an
explicit target-index/role table; bundles without a library retain their
existing versions. The previous bundle6 reader preserves the complete newer
source as opaque future data. Role validation is deferred until that table is
present, and rejects Stage bindings, duplicate targets, unsupported roles,
visible targets and targets containing scripts, variables or sounds.

The Code handoff carries library targets and their exact live assets/source
separately from program declarations. The language views generated by From Blocks omit those targets;
To Blocks restores them hidden. A program sprite with the same name receives
no role, and the preserved carrier receives a distinct display name. Source
UUIDs remain independent of target names. Rename/visibility changes during
asynchronous compression invalidate the pending conversion. GUI deletion/Undo
restores the role, and duplication restores the role while the existing source
copy operation renews resource UUIDs. GUI and CLI gameplay export project out
validated library targets while retaining resource documents for native export.

The focused foundation/artwork batch passes45/45; the earlier broader batch
including existing CLI conversions passes51/51. Actual VM tests cover role and
source save/reopen, rename, Code handoff, name collision, malformed-role refusal
and previous-reader opaque preservation. Initial fixture attempts used temporary
compiler filenames instead of content hashes, then asserted a fixed source count
on a save containing all costume documents. Both failures are retained. The
correct fixture uses real asset hashes and checks every inspected source record.
The first production build passed but failed the unchanged startup ownership
limit by240 bytes. Role restoration is now deferred without adding eager async
wrappers, and delayed restoration checks the captured target and project. The
new focused batch passes46/46. At qualified product source
`6f29dc3e317b7cfd0c25ce600fe912e50ba8801a`, the rebuilt profiling production app
passes all emitted ownership gates at4,467,115 initial JavaScript bytes against
the unchanged4,467,136 limit. The role helper, native codec/parser and companion
remain deferred; the [emitted receipt](receipts/2026-10-07-arcade-asset-library-foundation.json)
binds the graph to its raw stats hash. The failed emitted graph is retained.

That verified production bundle passes thirteen full browser journeys. An
explicit owned SB3 library fixture opens in Pixel, edits frame1, saves/reopens
and survives Code/Blocks with its hidden role, source UUID, frames and layers.
Fresh and shared lookups then play the edited source. Actual GUI and CLI exports
retain the edited native gallery and exact companion, omit the library actor,
compile without network attempts and play the edited frame in original PXT.
The earlier original-screen comparison still matches19,200 pixels; there are
zero page errors. The first library browser attempt selected the last frame and
painted through the open Frames panel. Its failure is retained; the corrected
journey selects frame1 and closes that panel without relaxing assertions or
budgets. This proves the explicit fixture workflow, not automatic native import.
Hosted final-head checks remain required.

This is a library foundation, not automatic MakeCode resource reconstruction.
Remaining work before enabling native imports:

1. Generate validated carrier documents with content-derived render asset IDs
   for all native resources, including
   unused ones, and bind native factory expressions to fresh UUID reporters.
2. Install the carriers and role table in the owned generated ZIP before the
   VM load. Preserve exact valid companions and build fresh documents/UUIDs
   for native-only or changed assets. Never resurrect stale source layers.
3. Clear pending resource imports at unrelated project/file/example boundaries;
   reject late asynchronous work with an import-generation guard.
4. Complete the library's editor affordances, including clear naming/navigation,
   protection against accidentally showing it or authoring gameplay scripts on
   it, and actual rename/delete/Undo/duplicate journeys.
5. Qualify original MakeCode Assets edits/download, automatic Brickwright import,
   Pixel editing and controller playback, then return export/reimport.

The predecessor's hosted build at documentation head `07d9265b7` stopped on an
intentional SPIKE compiler pin assertion left at33ce7380. The expected pin now
names983aa61f after reviewing and rerunning its unchanged motor/distance/extension
and roundtrip checks; no assertion was removed. Its original failure is retained.


## Automatic native resource import transaction

GUI file/share imports and CLI `to-sb3` now request resource-aware lowering.
The low-level translator retains its ordinary inline-array mode for callers
that do not install artwork. Both modes infer the same typed image arrays;
resource mode emits fresh-frame UUID reporters at native factory expressions.
A factory lookup therefore remains independent, while ordinary variable aliases
continue to share their array and image objects.

All valid native animations, including unused gallery entries, receive source
costumes in an explicit hidden artwork library. Exact matching companions keep
their UUIDs, frame IDs, layers and palette. Native-only assets receive validated
version5 documents and secure new UUIDs, chosen once during import preparation.
The installation revalidates the pending plan against native pixels/timing and
uses the storage hash of the exact rendered SVG bytes. It prepares every render,
hash and binding before mutating the owned generated ZIP. Invalid documents,
conflicting identities or storage failures abort before VM replacement.

Code compilation installs the library before artwork inspection and VM loading.
Pending imports clear at unrelated project, file, example and From blocks
boundaries. File/share results check their request identity and original Stage;
compilation checks its pending plan, Stage and authored buffer after asynchronous
preparation. CLI import uses the same installer, then validates the bundle before
writing its output.

The focused regression batch passes51/51. A separate four-test transaction and
CLI batch additionally observes exported fresh semantics in original PXT:
mutated alias9, independent lookup2, frame count2. CLI import/export/import retains
unused artwork and exact source identities, compiles without network attempts,
and passes actual storage/load/source/save checks. Initial test harness failures
are retained: live costumes use storage assets rather than serialized md5ext,
headless stepping needs the normal VM startup sequence and device declarations,
and saves need the GUI artwork attachment path and include ordinary costume
source records as well as animation records.

At product source `7a4101798e304e459a1b40d77b5c2d8bee0dbb2e`, the production
build and emitted ownership checks pass at4,467,115 initial JavaScript bytes
against the unchanged4,467,136 limit. The installer remains deferred. All14
full browser journeys pass with zero page errors, including actual automatic
file import, matching companion UUID, Pixel editing, SB3 save/reopen,
Code/Blocks retention and controller playback of the edited frames. The
original19200-pixel comparison still passes. The
[receipt](receipts/2026-10-07-arcade-native-animation-library-import.json) binds
the source, emitted graph and browser harness. Hosted final-head checks remain
required.

The follow-up library safeguards are described below. Original MakeCode Assets
editing/download remains open. No corpus partial has been reclassified by these
synthetic checks.

### Artwork library controls and lifecycle

Libraries appear in a separate Artwork libraries group in the Pixel target
picker. Their sprite controls show an explicit hidden-library label. Rename is
available; visibility, position, size and direction controls are disabled.
Selecting a library opens artwork. Blocks and Sounds show an explanation and an
Edit artwork button. The hidden Blockly workspace retains a categorized empty
toolbox: Blockly rejects changing an existing categorized toolbox to flyout
mode. Queued Blockly model events and attempts to show the library are refused
while its explicit role is present. Clearing that role restores ordinary target
behavior. Sound and code backpack drops are refused for library targets.

Duplication snapshots source before asynchronous work and finds the actual new
target by identity, independently of subsequent editing selection. The copy
retains layers/frame identities and receives fresh resource UUIDs. Delete/Undo
restores source, roles and original UUIDs onto the actual restored target.
Operations check their captured Stage and reject stale project ownership or
ambiguous newly added targets. Saving a project with an invalid library source
fails explicitly rather than silently dropping its authored resource bundle.

Actual-VM regression tests cover queued edits, visibility, deliberate selection
changes during duplicate/Undo, stale ownership and invalid-source save failure.
The regression batch passes83 tests with one explicitly unavailable full vendor
history check skipped; the adopted-producer contract batch passes27 tests with
one unrelated STC compiler check skipped. The CI audit request path now reads
the identified job directly, validates run/attempt/job identities and fails
closed on unreadable responses. Its audit/shard/timeout/pinning batch passes
52 tests. Completion requirements and the one-minute audit window are unchanged.

At product source `0a187a8c62ef19543d5fb89f598bdd6843c67014`, the production
build passes the unchanged startup limit:4,357,538 bytes against4,467,136.
The sprite pane is a noninitial chunk. All16 browser journeys pass with zero
page errors and19,200 matching original-PXT pixels, including real library
rename, duplicate, delete, Restore Sprite, save/reopen and controller playback.
Both library roles survive; duplication renews the resource UUID and Undo
restores the original binding. Final mirror/handoff tests pass22/22. The
[emitted receipt](receipts/2026-10-07-arcade-artwork-library-safeguards.json)
binds the source, graph and harness. Hosted final-head qualification remains
required. Earlier budget, Blockly and selector failures are preserved privately.

Costume drag/share source transport, sprite-file library transport, and original
MakeCode Assets editing/download still require qualification. Native names for
duplicated libraries are handled in the follow-up below. These safeguards
do not promise protection against arbitrary direct VM mutation. Whole-corpus
compatibility remains90 translated /93 partial /1 malformed.

### Native animation names and authored identity

The exporter allocates a distinct native display name for every resource UUID.
It trims surrounding whitespace and projects punctuation forbidden by MakeCode
to underscores. Duplicate names receive bounded numeric suffixes; allocation
reserves all projected source names before choosing suffixes and keeps native
ID aliases clear of those names. Both the downloaded gallery and its generated
factory use the same allocated names. Mappings produce explicit warnings.
Authored documents are never renamed or mutated during export.

Rich animation companions now use version2 with the exact exported native name
beside each native ID, source document and pixel/timing projection. If that
native name is unchanged, recovery retains the original authored display name,
UUID, layers and frame identities. A native asset that keeps its ID but changes
its name recovers with that new name and the retained UUID. Version1 companions remain readable
with their original rename semantics. A version2 record with a missing or
invalid native name, a downgraded mapped record, and unknown versions are
refused explicitly. Original MakeCode retention of the companion remains
unqualified; native playback does not depend on it.

The final focused export/import/companion/native-library batch passes39/39 without skips. Actual
original PXT compiles and runs both generated and original-emitter factories
for duplicate names, reserved suffixes, punctuation and alias collisions; every
lookup returns its own resource pixels. Maximum-length names stay bounded and
allocation is deterministic. Three direct and embedded export/import cycles
preserve complete source documents for duplicate and nonnative names. An
initial independent-pixel test fixture accidentally shared source arrays; that
failed attempt is preserved and the corrected fixture owns its arrays.

The expanded browser journey exposed a real Scratch schema boundary: two
different resource UUIDs can have identical names and rendered pixels, producing
identical carrier costume records that Scratch refuses. Native import now
allocates distinct carrier costume names without changing source documents or
storage hashes. A real-VM test loads both resources, saves and reloads them,
checking exact source and both UUIDs. Its initial save assertion incorrectly
counted only animation records; it now checks application of every inspected
source record and separately verifies the two animation documents.

The preceding hosted heavy job remained unaudited because one completed gate
was still reported unfinished. GitHub's job response advertises a60-second
cache lifetime. Each listing/detail poll now has a unique read key and requests
no cache reuse; the audit still requires completed steps, exact run/attempt/job
identity and the existing one-minute polling window. A cache-snapshot adversary
and the full audit/shard/timeout/pinning batch pass53/53. Authenticated and
public fresh-key API reads returned the correct job identity; an earlier
diagnostic request hung and was stopped, not counted as success. Hosted
qualification of this audit repair remains required.

At product source `6f78b0151f15711725ae4d10f0449f9cdfca4dbb`, production
startup is4,357,538 bytes against the unchanged4,467,136 limit. All17 browser
journeys pass with zero page errors, including duplicate-library GUI and CLI
downloads, exact companion recovery of both authored documents, original-PXT
compilation/execution, native-file import through Code, To Blocks and returned
animation playback. The original19,200-pixel comparison still passes. Final
overlay-pair validation passes; the separate codec/library/handoff batch
passes40/40. The
[emitted receipt](receipts/2026-10-07-arcade-native-animation-names.json)
binds the product source, emitted graph and harness. Initial menu/download
handling and use of the SB3 chooser for a native file were harness failures;
the actual duplicate-costume validation failure and all attempts are preserved.
Hosted final-head checks, original Assets editing/companion retention,
distinguishable duplicate names in authoring pickers and string-valued VM error
presentation remain open. The corpus still has93 partial cases.


### Duplicate resource pickers and conversion validation details

PR704 merged at `9e869b97e7bfe8680dd43f8b51568edb5199b7dd` after all11
enabled checks passed on `24480d493dd89925461b488c1858f659a33739be`,
including both browser jobs. Reviewed and merged trees matched exactly.
This completes hosted qualification of the native-name and audit repairs above.

The follow-up shares label generation between the Arcade Blocks dropdown and
Code animation picker. Duplicate authored names show their artwork owner and
costume; identical owner labels receive a unique UUID suffix. Labels are
presentation only: the selected value remains the full resource UUID. Live
owner renames update labels without changing source documents, frame revisions
or bindings. Unique resource names retain their simple labels.

Code conversion failures now handle serialized VM validation objects, plain
strings and normal Errors. Scratch validation paths and messages appear in the
status and unsupported-elements report. SB3 diagnostics take precedence over
unrelated SB2 schema failures. Strict conversion still rejects the original
error. A negative integration fixture inserts an identical costume into a
real generated SB3, executes the actual Code compile method with the real VM,
and verifies the rejection is explained and the prior loaded project survives.

At product source `1c0749b0d9c8dfd72dd8d70a912e30936d3fb742`, the focused
batch passes27/27 and packaging/diagnostics passes11/11, with zero skips.
The production build has zero errors and4,357,698 initial JavaScript bytes
under the unchanged4,467,136 limit. All18 browser journeys pass with zero
page errors. The actual Code picker inserts the copy UUID; the actual Blocks
dropdown selects it and restores the original binding. Both expose identical,
distinct owner labels. Existing export/reimport/original-PXT/playback checks
remain passing. The [receipt](receipts/2026-10-07-arcade-resource-picker-errors.json)
binds the source, bundle, graph and harness. The initial test-loader, method
extraction, build-directory and dependency-export failures remain preserved.

The shared helper uses the same narrow webpack VM source-alias convention as
the existing broker adapter; no dependency export map or compiler pin changes.
Hosted follow-up checks, original MakeCode Assets editing/download/companion
retention and the93-case partial corpus remain open.


Hosted follow-up found three old extracted-method device tests that omitted
the new formatter binding; the real product browser jobs both passed. The
harness now supplies the actual imported formatter and all15 affected tests
pass. Main PR709 was merged into this branch, preserving its stage and
unsupported-diagnostic changes. At integration source
`968877994643949878a48869b81c013a3878e691`, the refreshed production build has
zero errors and4,360,502 initial bytes; all18 browser journeys still pass with
zero page errors. Refreshed focused tests pass23/23; mirror and embedded-factory
checks pass2/2. The original failing hosted log is retained privately. Exact-head
hosted requalification remains required before merge.

### Original MakeCode Assets editor and native project files

The GUI's **To MakeCode** downloads and CLI `to-project` now write native
`.mkcd` project envelopes containing `{meta, source}` and every generated file.
Both Arcade and micro:bit exports use this container. File import accepts
`.mkcd`, `.pxt`, compressed native projects and current MakeCode PNG envelopes,
while retaining historical flat file-map PNG support. No firmware, cloud
account or compression service is needed to export the JSON project.

This corrects two observed integration defects: the live Arcade editor rejected
our previous uncompressed source-only HEX, and its downloaded PNG contains a
compressed project envelope rather than the bare file map our reader expected.
Self-import of the old HEX did not establish acceptance by the original editor.
The legacy `to-hex --source` API remains for Brickwright readers; use
`to-project` for editor exchange. Original-editor reopening of source embedded
in compiled firmware remains a separate unqualified path.

The opt-in `scripts/verify-makecode-assets-roundtrip.mjs` imports a genuine GUI
export through the original editor's Import File controls, opens both animations
in Assets, saves an unedited PNG, changes the used animation through actual
name/timing/fill controls, downloads again and imports that PNG through
Brickwright Code and To Blocks. The unedited return preserves both exact rich
source documents and UUIDs. A native edit invalidates only its stale companion:
import generates a new UUID and source document for that animation and retains
the untouched animation exactly. Its changed first frame appears in the running
Brickwright stage. Stale companion diagnostics remain visible.

Asset timing metadata is preserved as250ms. The existing game's exported
numeric playback argument remains100ms: changing native asset metadata does
not rewrite that independent code argument. This qualification does not claim
that MakeCode's Assets editor preserves Brickwright layers on modified art;
modified art is reconstructed from its native flattened frames. Arbitrary
projects, custom palettes, firmware reimport and the93 partial corpus cases
remain open. The live editor test is opt-in because it depends on the external
editor and records its exact version and any exceptions.

Protocol references: Microsoft PXT's
[project serialization](https://github.com/microsoft/pxt/blob/master/pxtlib/package.ts)
and [editor project import](https://github.com/microsoft/pxt/blob/master/webapp/src/app.tsx).
See the [qualification receipt](receipts/2026-10-07-original-makecode-assets-roundtrip.json).


The first PR711 hosted run exposed stale background/rotation download checks
expecting `.hex`, an outdated file-dialog format list and missing explicit
opt-in registration for the networked live-editor harness. These are corrected
without changing product export behaviour. The affected unit/registration
batch passes30/30; background authoring passes7 browser journeys, and rotation
passes12 observed phases, including `.mkcd` file reimport. These local reruns use
the previously qualified `gui.b3d98153.js` Arcade surface. Main's subsequently
merged Circuit dependency changes require the hosted final-candidate build;
they are not credited to that older local bundle.

PR710 merged at `0441d5b6247e3b3c6a41fac68fba36f0c7387927` after all9
enabled checks passed on `814e72192f96fb5a875aac753907d4ab2af5275d`.
Four conditional jobs skipped. Main had advanced through PR707/PR712: the
merge tree differs from the reviewed head and exactly matches the independently
computed merge of that head and main `948e02fdc07cbd625d4a0bb82e8099ea1dfc9c25`.
PR711 is retargeted to main and includes this integration. Its repaired final
head still requires hosted qualification.
