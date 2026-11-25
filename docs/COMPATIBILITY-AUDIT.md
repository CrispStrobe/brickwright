# Conversion compatibility audit

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

`scripts/compat-audit.mjs` and `scripts/conversion-roundtrips.mjs` measure how much of a
corpus of MakeCode programs Lite's importer, translator and exporter carry. The
`makecode` CLI converts one project. These tools inspect many. A parsed or stepped project
is **not** proof that graphics, sound, hardware, timing or extension behaviour match the
original. The audit keeps those gates apart, and each needs its own focused test.

Ported from the parked Codex WIP (branch `wip/codex-parked-main-checkout-20261005`,
`23e9c7f44`) as task F1 of [OPEN-TASKS-2026-09-29.md](OPEN-TASKS-2026-09-29.md). The WIP's
TurboWarp corpus, its TurboWarp reports and its `.sb3` native round-trip script are not
ported: TurboWarp is clean-room only for this project.

## Convert one project

```sh
npm run makecode -- to-sb3 game.ts --target arcade -o game.sb3 --bw game.bw
npm run makecode -- to-sb3 microbit.hex -o microbit.sb3
npm run makecode -- to-ts game.sb3 --target arcade -o main.ts
npm run makecode -- to-project game.sb3 --target arcade -o game.mkcd
npm run makecode -- to-sb3 game.mkcd -o returned.sb3
npm run makecode -- to-hex game.sb3 --target arcade --board rp2040 -o game.uf2
npm run makecode -- to-hex robot.bw --target microbit -o robot.hex
```

A bare `.ts` input is a single MakeCode `main.ts` with the target's default packages. A
program that needs another package should be imported from an embedded-source `.hex`, `.uf2`
or cartridge. Arcade firmware needs `--board` (one of `ARCADE_HARDWARE` in
`lib/bw-makecode/pxt-runtime.js`) and that board's firmware base, which `npm run
sync:makecode` serves. Without the base, the build is refused by name (exit 1). `--source`
writes an editable project file instead. Every conversion lists what did not translate on
stderr.

## Audit a corpus

```sh
npm run compat:audit -- --target arcade --compile --execute \
  --corpus-commit CORPUS_FULL_SHA --out arcade.json --markdown docs/generated/ARCADE-COMPAT-AUDIT.md makecode/arcade
npm run compat:audit -- --target microbit --compile --execute \
  --corpus-commit CORPUS_FULL_SHA --out microbit.json --markdown docs/generated/MICROBIT-COMPAT-AUDIT.md makecode/microbit
node scripts/conversion-roundtrips.mjs --compile --corpus-commit CORPUS_FULL_SHA --out roundtrips.json makecode/arcade makecode/microbit
node scripts/report-roundtrips.mjs roundtrips.json docs/generated/CONVERSION-ROUNDTRIPS.md
```

Run these from the Lite checkout, with the corpus input paths supplied explicitly.
Replace `CORPUS_FULL_SHA` with the corpus's immutable 40-character commit. It is a declared
identity, not independent verification of the files. JSON also records the input content
multiset hash, source commit and dirty status, tracked-diff hash, exact vendor pins and
synced MakeCode versions. Preserve full JSON privately; review public Markdown before
publishing. Public summaries use anonymous input numbers and omit raw failure diagnostics.
Gap rankings count affected projects separately from diagnostic occurrences.

- **Stages:** `translated` (no named gap, no Code-to-Blocks warning), `partial` (at least
  one named gap or warning), `parse-failed`, and `pxt-compile-failed` (with `--compile`).
- **`pxt-compile-failed`:** the pinned PXT compiler rejects the source itself. That is not
  counted as a Brickwright gap. Many corpus entries are documentation snippets that need an
  extra package or earlier lesson code.
- **`--execute`:** steps 24 frames after the green flag in a headless Scratch VM. The run
  includes the importer's artwork (`uploads`), exactly as the importer GUI applies it.
  Without the artwork, every Arcade image read fails, and the run measures the harness
  instead of the game. Each program runs in its own child process under a watchdog
  (`--execute-timeout-ms N`, default 120000). A program that exceeds it is stopped and
  recorded as `execution.status: "timeout"`; the audit goes on with the next input.
- **`--limit N`:** gives a repeatable smoke run in sorted path order.
- **Exit code:** nonzero for read, parse, missing-asset or missing-opcode rows.

## Round-trip statuses

`conversion-roundtrips.mjs` and `report-roundtrips.mjs` share one definition
(`scripts/lib/roundtrip-status.mjs`). `loss` means a measured difference (missing target,
opcode, asset, extension or artwork). The hop through a plain-text Brickwright file cannot
carry binary artwork; a path that hits that limit but has no differences and no unsupported
element is reported as `preserved-structure, binary assets not compared` (column "binary
not compared" in the summary), not as `loss`. It is a limit of the measurement: artwork
was not compared on that path.

`normalized` is a third category on the MakeCode round trip: the structure is equal apart from
importer scaffolding that the exporter deliberately does not write back, so nothing the author
wrote is lost. Two kinds are recognised, and each is listed per path under `normalization`:
the `hide` the importer writes as the first statement of a start script (on the Arcade host
and on artwork carriers), and a carrier whose only artwork is a 1x1 fully transparent
placeholder and which holds nothing else. A `hide` that is not that first statement, or a
carrier with any pixel or script, is still a `loss`.

## Browser checks

The Arcade behaviour the audit cannot see (drawing, the controller, dialogs, scenes) has its
own checks in `scripts/verify-arcade-*.mjs`, ported from the parked WIP as task F3. Each one
serves `packages/scratch-gui/build`, so build the GUI first:

```sh
npm run verify:arcade-camera          # one journey; see package.json for the rest
BW_ARCADE_CORPUS=…/compat-corpora/makecode/arcade npm run verify:arcade-projectile-corpus
```

The 15 checks that need no corpus run on the heavy browser shard of `build.yml`. The 7
`*-corpus` checks read programs from the private corpus, so CI cannot run them; they are listed
in `KNOWN_UNWIRED` in `test/gate-coverage.test.mjs`. Each writes a JSON report under
`test-results/`.

## Where the corpus lives

The corpus is the pinned 828-file set in the private repository
`CrispStrobe/brickwright-firmware-private`, under `compat-corpora/`. Its `manifest.json`
records the SHA-256, upstream revision, URL and licence of every file. The MakeCode part
(215 micro:bit and 184 Arcade examples) comes from `pxt-microbit` 9.1.1 and `pxt-arcade`
docs, both MIT. `scripts/collect-makecode-corpus.mjs` re-extracts it. The corpus is test
data: it is never shipped and never committed here. Lite's CI cannot reach it, so its
tests use small inline fixtures.

## Current checkpoint — 2026-10-07

The previous Arcade agent is paused. The active integration lane in
[LANES.md](../LANES.md) owns the preserved branch work and its qualification.
Source checkpoint: [`bfecedb74`](https://github.com/CrispStrobe/brickwright/commit/bfecedb74).
The fresh generated Arcade audit records exact tested source
[`293cf62a8`](https://github.com/CrispStrobe/brickwright/commit/293cf62a8), clean at invocation,
and declared corpus commit `19a52f6d65ab9e8adc90bb19a6e3ea04544a1339`.
This is integration-branch evidence; it is not a claim that a shipped package has adopted it.

| Independent gate | Observed result |
|---|---|
| Static Arcade translation, 184 inputs | **90 translated / 93 partial / 1 parse-failed**; 283 named gap occurrences (285 before the consumed-update fix) |
| Original MakeCode compilation | **130 pass / 54 fail**, including the malformed fixture that also fails translation parsing |
| Combined legacy `--compile` stage tally | **84 translated / 46 partial / 53 pxt-compile-failed / 1 parse-failed** |
| Runtime smoke among the 130 original-compile-pass inputs | **127 stepped / 3 event-only / 0 block errors** |
| Runtime behavioural equivalence | **Not measured** by the 24-frame smoke audit |
| Fresh micro:bit audit, 215 inputs | Static **205 translated / 10 partial**; original compile **206 pass / 9 fail**; runtime **205 stepped / 1 event-only / 0 block errors** |
| Fresh conversion permutations, 399 inputs | 398 converted / 1 malformed input; MakeCode→Code→MakeCode **279 structurally preserved / 61 loss / 56 partial / 2 source-invalid**; runtime equivalence not measured |

The combined legacy stage tally masks some static translation gaps behind original-compile
failures. Keep the independent static result and compiler result together. A bare source
file missing its package or asset can fail PXT without establishing that the complete
original app is invalid. Conversely, a successful PXT compile or a stepped VM does not
establish faithful behaviour.

Fresh [Arcade report](generated/ARCADE-COMPAT-AUDIT.md),
[micro:bit report](generated/MICROBIT-COMPAT-AUDIT.md) and
[roundtrip report](generated/CONVERSION-ROUNDTRIPS.md).
The Arcade runner snapshots invocation identity and detects changes by completion:
its final source differs because browser harness and speech factory fixes landed
while the cached-module audit ran. Dependency pins and MakeCode versions stayed
unchanged. The recorded invocation source identifies this run, not its final head.
The [conversion capabilities and GUI closure ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md)
tracks Blocks, Code, asset editors, original MakeCode checks and authoring evidence separately.

### Changes since the historical checkpoint

- F6 parser fixes are adopted. Lite pins sb3-creator
  `8ba3508eab2ad99b9d9a6478c9a45a7200ca4fde`, including the merged
  [Sprite data dialect PR59](https://github.com/CrispStrobe/sb3-creator/pull/59).
  Empty bodies parse but still produce a named warning; the audit keeps that warning
  visible as partial rather than silently discarding it.
- `Sprite.data` is implemented as reference identity, including typed payload export.
  Arbitrary object-member operations remain explicitly refused; support for `data` does
  not imply general JavaScript object support.
- Arcade's global `score` and `lives` variables map to native Info state on export.
  The earlier lost-HUD observation is historical, not an outstanding product decision.
  The fresh Arcade MakeCode→Code→MakeCode permutation preserves 82 projects
  structurally, up from the historical 81; 50 show structural loss, 49 are partial
  and two exports fail compilation alongside their original bare sources.

### Next gap families

The fresh ranking identifies these leading named families. Counts overlap across projects;
do not sum them as a number of distinct partial apps.

| Affected projects | Named family | Next qualification |
|---:|---|---|
| 10 | Background image artwork unavailable | Recover complete project assets/manifests; distinguish missing corpus inputs from unsupported rendering |
| 7 | Legacy `scene.setTileMap()` | Implement and compare the legacy map format through runtime and export |
| 7 | `tiles.setTilemap()` without a readable literal map | Preserve wall layer, tile scale and asset references |
| 6 | Sprite destruction effect/duration | Implement rendering and lifetime scheduling against original MakeCode |
| 5 | `music.play()` | Implement supported music forms and playback timing |
| 5 | `sprites.createProjectile()` | Close importer/runtime/export overloads with real-app fixtures |
| 4 each | Starfield screen effect, `game.ask()` value, `music.playSound()`, legacy `scene.setTile()` | Separate implementations with targeted original-runtime checks |

The former array block error was caused by a consumed update expression being
replaced with zero, skipping initialization. Executing that update clears the
error. `game.onPaint` remains a named unsupported feature; its eventual
implementation still needs registration and startup-order qualification.
Work each family through a reproducer, source implementation, original-runtime comparison,
roundtrip permutations, real GUI authoring/save/reopen and a corpus recount. Do not lower
partial counts by suppressing diagnostics or removing difficult programs.

## Historical checkpoint — 2026-10-06

Corpus: `brickwright-firmware-private` `19a52f6d6` (`compat-corpora/makecode`).
The table and comparisons below preserve the previous measurements; they do not qualify
the current integration source.

| | F2 (main `31a505c30` + F1) | after F5–F9, F11 (2026-10-06) |
|---|---|---|
| Arcade static audit | 89 translated / 94 partial / 1 parse-failed | **90 / 93 / 1** |
| Arcade `--execute` (24 frames) | 171 stepped, 7 event-only, 5 block errors | **175 stepped, 7 event-only, 1 block error** |
| Arcade MakeCode → Code → MakeCode | 70 preserved, 12 rejected by PXT, 1 error | **81 preserved, 0 rejected**, 0 errors, 2 "source invalid" |
| micro:bit static audit | 205 / 10 | 205 / 10 |
| micro:bit round trip | 197 preserved | 197 preserved |

With `--compile`, PXT itself rejects 53 Arcade and 9 micro:bit documentation snippets as
bare `.ts` files: undeclared names, or a missing package or asset. Those are counted apart
from translation gaps. In the round trip, "source invalid" is a re-export that MakeCode
rejects when it also rejects the original.

**Against the parked WIP.** Both trees were run on the same corpus and the same scripts; the
WIP's own run reproduces its 89 / 94 / 1. The WIP's stored reports in the corpus
repository are an older baseline (2026-09-27, 27 translated).

- **micro:bit:** main is ahead in both views: 205 / 10 against 166 / 49 statically, and
  197 preserved round trips against 106.
- **Arcade static audit:** main is ahead, 90 / 93 / 1 against 89 / 94 / 1.
- **Arcade round trip:** main preserves 81 against the WIP's 82. Three projects the WIP
  preserves are not preserved on main, and two go the other way. Each of the three is named
  below.

**What F5–F9 and F11 fixed** (rows in section F of the task file):

- **F5 — Arcade re-exports MakeCode rejected (12 → 0):**
  - A stop guard's bare `return` inside a value-returning function.
  - A cloned sprite's interval/update hat that used an unbound `self`.
  - A named list read as an array reference (`.length`/`.push` on a number).
  - Globals typed `number` because the importer had turned unknown art (`sprites.dungeon.*`)
    or an unread asset into a silent variable.
- **Three silent import losses**, now carried or named:
  - Untagged template strings with placeholders had become `"(image)"`.
  - PXT's built-in art stored as `{data}` entries was missing. The table went from 507 to
    763 images and now includes all of `sprites.dungeon`. Unknown built-in art is named.
  - A sprite property written through a value the stage cannot follow (`paddle.x = …` in a
    loop, a text sprite) had become `set 0 to …` / `change 0 by …`.
- **F7 — run-time errors in partial projects (5 → 1):** an untranslated array stands in as
  an empty one, and the named-list fix above closed two of them.
- **F8 — Lite's own export reads back as itself:**
  - The run-token machinery A5's `stop` blocks export is lifted back to `stop all` /
    `stop other scripts in sprite`; before, `stop all` was lost.
  - `!x` in a condition is `not` again (E9's `x === false` value form had leaked into
    conditions).
  - Literal say-block arguments stay literals.
- **F9:** `fn: () => void` parameter types parse.
- **F11:** `Math.percentChance` (6 projects), `Math.clamp` and `control.millis` translate as
  their PXT definitions.
- **Also:** `pick random a to b` is parenthesised as an operand. Before, it swallowed
  `- 80` and read back as `randint(a, b - 80)`.

### Historical unresolved observations and present disposition

At the 2026-10-06 checkpoint, F6 was awaiting a parser pin move; that pin move is now
complete. The array error formerly attributed to paint startup is now traced
to skipped consumed-update initialization and fixed. The fresh Arcade smoke has
zero block errors; paint support remains incomplete and named.

Three roundtrip differences against the parked WIP were recorded: Arcade HUD score
renaming, equivalent arithmetic represented as `calculate value` rather than
`operator_multiply`, and an array literal passed to an empty-body function. Native score
mapping has since been implemented. The fresh full permutation run records current structural losses separately
from compilation; structural opcode differences and prior counts alone do not
establish behaviour.

The historical five-project `sprite.data` gap is addressed by the implemented dialect,
VM reference identity and typed export described above. Arbitrary object members remain
named refusals. Consult the fresh generated ranking rather than treating this historical
list as the current backlog.

### Additional verified fixes and boundaries

Consumed `++`/`--` expressions preserve prefix/postfix results, numeric conversion,
lazy branches, argument order and evaluated-once receiver/index semantics.
Original PXT, export/reimport and SB3 fixtures pass. The pinned PXT compiler
re-evaluates a side-effecting complex index during an update; a separate test
records that difference from JavaScript's evaluated-once contract.

Production browser qualification exposed a speech factory serialization failure:
Babel hoisted object-spread helpers outside a function serialized with
`Function.toString()`. Self-contained copies fix the actual factory boundary;
a regression transforms and isolates the exported factory before checking its
rendered speech pixels. Production rebuild and controller qualification pass at app source
`57f9b9d29`; they remain separate from the headless corpus smoke above.

### Plain Code and binary assets

The complete permutation run at invocation source `bfecedb74` retains 197
structurally preserved micro:bit re-exports, 11 structural losses and 7 partials.
Across both targets, 396 re-exports compile in original PXT and two are rejected
alongside their original bare sources. One malformed input never converts.

The SB3→plain Code→project path reports binary assets absent for all 398
converted inputs, including default Scratch media. The archive metadata route
and plain text asset transport are different gates. A Code file naming a
costume does not contain its image bytes. Complete Code-plus-assets authoring
and share/archive handoff remains an explicit GUI/storage task. Do not erase
that loss merely because opcode metadata survives.

### Browser qualification boundary

The production authored rotation game completes the visible Code, Blocks,
controller, Stop/restart, download and file-reimport journey with 12 observed
states. Its actual downloaded source compiles in original PXT. The original
simulator comparison additionally exposed a raster footprint extending beyond
PXT's truncated collision box. The renderer now preserves that footprint without
changing collision geometry: 211,200 exact original stage pixels pass in 11
focused cases, and the rebuilt browser matches all 19,200 initial-stage palette
pixels. Two controller cycles, Stop/restart and file reimport preserve the
observed images. Repeated definition/input warnings remain recorded; successful
interaction does not imply a warning-free editor.

The existing MakeCode GUI gate also passes all 31 checks against the same built
app and fully synchronized pinned runtime: micro:bit import/simulator/universal
HEX, original Arcade on-screen A press/release, actual PyBadge UF2 download and
family validation, imported costume Pixel editor, live Scratch→Arcade
compilation/drawing, EV3 simulator and invalid-file diagnostics. These are
browser/compiler checks, not physical hardware qualification.

## Explicit retained contexts and shared conversion operation

The proposed `compat-audit.mjs --context-catalogue catalogue.json` input keeps
raw source snippets and retained complete projects separate. Positional inputs
retain their original target, generated configuration, public import and
Creator classification. A retained context supplies its own target, exact root
files, original resolved package graph, source order, resources and original
compiler outcome. Failed original compilations remain in the input denominator.
No compiler runs unless its existing explicit option is selected.

The CLI and bounded conversion consumers use
`scripts/lib/conversion-audit-core.mjs`. It calls the actual public importer and
Creator; the legacy translated/partial/parse-failed label remains separate from
all provided errors, warnings, unsupported and unparsed channels. Full actual
returns, dependency callback data, Creator project/assets and own error data
remain in the JSON observation graph. Absent channels and unobserved private or
callable implementations are labelled explicitly. Data capture invokes no input-defined accessors or `toJSON` methods.
Native collection iteration and byte views use held internal-slot operations;
custom iterators and view-property accessors are recorded without invocation. This is conversion evidence, not semantic,
archive, runtime, GUI or hardware equivalence.

The shared reader is `scripts/lib/conversion-context-inputs.mjs`. A catalogue
uses schema `brickwright/conversion-context-catalogue/v1`, an ordered `subjects`
array and a `blobs` map. A blob records a physical root ID, relative path,
length, SHA-256 and encoding (`utf8`, `json` or `gzip-json`). Gzip references also
record decoded length and SHA-256. References select a blob and an exact JSON
pointer. `--context-root ID=directory` explicitly binds additional local data
roots; it does not fetch data or execute modules. Physical paths are bounded
and reject symlink traversal. Logical MakeCode filenames, package IDs, Unicode,
percent characters and prototype-spelled keys remain exact data in own maps.

Each subject preserves its original opaque ID and has kind `RAW_BASELINE` or `RETAINED_CONTEXT`, target,
name and complete root-file length/hash rows. Identity is the compound pair
(kind, ID): raw and retained contexts can share an original ID, while duplicates
within one kind refuse. A root must already be a record containing only string
values; arrays and malformed values are rejected before any map copy. Retained contexts additionally
provide original root/graph/compiler references, each selected package's full
source/config/resource rows and complete JRES/source-order manifests. Available
notice bytes can be referenced and checked; missing retained notices stay
explicitly unavailable. Licence and historical producer claims are recorded
separately from verified byte relations; the reader does not authenticate an
SDK execution or issue a legal clearance.

Legacy graph metadata is explicitly derived from current root and retained
config data, with original fields preserved. Dependency identities use the
current canonical identity helper. Conflicting declarations remain recorded;
the unchanged public dependency validator makes the actual acceptance or
rejection. No catalogue label bypasses it or repairs conflicting refs. A
bounded full-input census additionally needs independent admission of its
originals and historical source-contract evidence before execution.

Input limits are distinct from output limits: at most 16 MiB per packed or
decoded blob, 96 MiB aggregate catalogue/input reads, and an 8 MiB shared
metadata-string cache. Decoded shared values are fresh per subject. The reader
checks the declared whole-input budget before loading subjects. A particular
corpus must have its exact budget checked; these limits do not promise it fits.
Duplicate JSON keys, malformed UTF-8, corrupt or concatenated gzip members,
wrong hashes, extra files and missing resource roles refuse rather than being
silently dropped. Optional compiler/runtime work and normal CLI Git provenance
remain outside the pure conversion core; default conversion no longer eagerly
loads the SDK helper.

The reader/shared-core and compact-report component controls and two authored
raw-input shipped gzip CLI reports have independent saved-data acceptance.
The complete 225-subject attempts remain incomplete, with all outcomes
unobserved. This integration covers the reader, shared core and compatibility CLI.
`conversion-roundtrips.mjs` remains unchanged; sharing this reader and initial
conversion operation there is an explicit follow-up, followed by its affected
archive/export controls. Current raw partial counts and complete-context results
must be observed afresh before a new corpus claim.

Reached Creator module acquisition is setup outside the shared core's product
catch. A missing or refused module propagates as an observation/setup failure,
not a product parse failure. This deliberately tightens the former CLI routing,
which included its lazy module import inside the parse catch. Actual constructor
and parse exceptions still retain the legacy parse-failed label; valid-input
classification is unchanged.

### Lossless report encoding

The CLI's conversion records use the explicitly versioned
`brickwright/conversion-observation-graph/v2` encoding. Native byte payloads
are base64. Consecutive own numeric-index descriptors may be stored as runs
containing their exact index range and enumerable, configurable and writable
attributes. Values are derived from the stored payload only when they were
actually equal to those octets. Named properties, accessors, differing signed,
wide or floating values, graph references and special primitives remain explicit.
A run does not grant a type, dependency identity or compiler result.

`expandConversionObservationGraph` in `scripts/lib/conversion-audit-core.mjs`
expands parsed v1 or v2 JSON into the original v1 data representation. It checks
versions, references, descriptors, payload sizes and the original logical graph
limits, including every expanded run entry. It rejects getters in supplied JSON
metadata. Its payload budget defaults to 16 MiB and can be explicitly selected
up to 64 MiB within the consumer's resource envelope; this is a decoder memory
bound, not a compatibility or source-trust option. Decoder inputs are parsed
own-data JSON, not proof of arbitrary proxy or hostile-realm provenance.

The existing `conversionObservationGraph` API still returns v1. The CLI selects
`compactConversionObservationGraph`, which observes the same full values and
uses v2 byte packing. Conversion, Creator calls, provided diagnostic channels,
legacy classifications and original compiler outcomes are unchanged.

An output name ending in `.json.gz` explicitly selects gzip of the **complete**
JSON report. Other names keep plain UTF-8 JSON. `outputEncoding` records that
choice; Markdown and console summaries remain separate. Node's gzip module is
acquired only on the compressed output path. For example:

```sh
node scripts/compat-audit.mjs --target arcade \
  --context-catalogue contexts.json --out report.json.gz --markdown report.md
```

Packing and compression do not guarantee that a particular corpus fits an
execution budget. Report-write, decode or resource failures remain observation
failures. Rows, diagnostics, assets and original failures must not be omitted to
fit a limit. Static translation still does not establish runtime behavior or
behavioral equivalence. The current Markdown gap tables use historical legacy
labels; presenting modern Creator errors and unparsed channels alongside those
labels remains separate reporting work.


### Native octet descriptor observation

The compact report observer can encode native Uint8Array integer-index
properties directly from the existing byte snapshot. Native slots establish the
brand, including Buffer and subclasses; fixed ordinary ArrayBuffer backing is
required. This preserves the existing v2 format and all logical entry limits.
Own keys are still enumerated once, and every named or symbol property retains
its actual descriptor and value observation. Shared, resizable, unrecognized or
changed-intrinsic cases retain the original descriptor loop. The v1 observer and
conversion/classification remain unchanged.

This is an observer-cost candidate, not a measured conversion speedup. The
complete 225-input episode timed out before its full report; all current subject
outcomes remain unobserved. Component controls, actual measurement and a freshly
bound complete run remain separate requirements. No cap increase, filtering or
partial-prefix result is implied.

### Optional phase progress journal

`--progress-jsonl FILE` requests a separate, fresh JSONL observation journal.
It is off by default and does not replace the complete JSON/gzip report,
Markdown, provided diagnostics, source inputs or qualification gates. The file
must not exist, alias an input/report, or lie inside a positional input directory,
the catalogue directory or an explicitly supplied context root. This prevents
journal creation from changing input collection or supplying a missing input.
The CLI opens the leaf exclusively without following a leaf symlink. It does
not claim continuous protection against concurrent ancestor-directory changes.

Each complete line records its sequence, fixed phase, exact input identity when
applicable, process CPU microseconds and monotonic nanoseconds. Core markers
observe only existing dependency-callback, import and Creator phase/status
scalars. They never read conversion values or error getters. A dependency
callback marker precedes validation; import/Creator markers follow the actual
return or throw. Row-in-memory markers do not establish a persisted full report,
clean conversion, compiler result, runtime behavior or completed census.

Intervals include all intervening process work, including collection, GC and
observation. Cumulative observer write cost is measured before each event; the
last event's write and close residual remain unmeasured. Missing markers or a
partial last line remain unobserved. There are no timers or profiler hooks.

The journal is bounded to 8 MiB, 65,536 events and 16 KiB per line. Partial
writes are completed with explicit progress checks. Its first write, bound or
close failure stays sticky, attempts a fixed stderr marker, and escapes the
per-input error classifiers. It cannot become a product diagnostic or a new
parse failure. Complete lines and any failed partial write remain available;
normal completion closes the journal once. A killed process has no invented
success footer. Full reports remain mandatory before census claims. This
option neither raises execution limits nor makes an incomplete run successful.

### Compact capture native-brand candidate

An unqualified compact-observer candidate uses captured Node native brand checks
to skip impossible Map, Set and byte-view slot probes on ordinary records. A
positive brand still runs the original complete collection or byte operation.
The existing v1 observer and compact descriptor, sharing, byte and bound rules
remain the comparison contracts. This requires explicit `node:util` admission;
there is no prototype, constructor, tag or source annotation shortcut. Normal
module initialization is assumed, as with the held native observer operations.

The saved diagnostic contains incomplete process-CPU phase intervals, not a
function-level exception profile. This candidate has no measured speed or
complete-census fit result. Earlier incomplete attempts and their unknown
conversion outcomes remain retained.
