# Arcade SDK scalar results and native addition

Status: IMPLEMENTED; final qualification pending. Claim merged in
[PR #1373](https://github.com/CrispStrobe/brickwright/pull/1373).
All 44 affected source controls pass across five complete cohorts; two guard
mutations are detected. Code/SB3/export/reimport preserve edited position and
pixels. Actual hosted runtime/editor acceptance remains open; see
[the current handoff](../docs/ARCADE-AGENT-HANDOFF.md#25-october-fresh-source-census-and-sdk-scalar-repair).
Owner: Arcade integration,
continuing PR #1128. Base: `23ec908232f6d4c4604ed6f7dcb23b75af19053d`.

## Problem and boundary

The ordinary-addition fallback accepts Opaque producers when no local Array
syntax is present. SDK calls can produce Arrays without Array literals:
`sprites.allOfKind(SpriteKind.Player)` and `tiles.getTilesByType(img`1`)`
are concrete counterexamples. Source probes confirm both receive the fallback.
Unknown producers and empty domains do not prove primitive membership. Native
value addition and ordinary source addition retain their separate contracts.

Application accounting is independent: retain raw tutorial fragments, starter
templates, original compiler failures and missing context as separate results.
No passing source cohort alone closes an application or editor gap.

## Owned implementation scope

- `overlay/scratch-gui/src/lib/bw-makecode/native-array-binary-domain.js` and
  `export-arcade.js`: remove the Opaque/empty-domain fallback; preserve
  initialized primitive and proved flat-Array routes, complete callers,
  helper identity/currentness and all-writer checks.
- `native-sdk-sprite-source.js`, `native-class-scalar-view.js`,
  `source-value-producers.js`, and optional new `ordinary-sdk-scalar-source.js`
  in that directory: prove missing scalar SDK normal results from exact
  unshadowed namespace calls or actual SDK receiver allocations, arguments,
  aliases and all writers. Begin with Sprite numeric properties and Image
  numeric results, selecting further members only from measured failures.
  This permits a private normal-result bridge, not blanket SDK/unknown Number
  facts or annotation authority. Preserve class, Array, Image identity and
  initialization contracts.
- Preserve existing test programs and semantic assertions. Correct the fallback
  test's unsafe premise while retaining the genuine SDK accumulator success
  through the new proof. Add `test/arcade-sdk-scalar-addition.test.mjs` with
  positives, SDK Array/unknown producer negatives, mixed writers, source edits
  and a meaningful guard mutation. The GUI census may add exact new test rows.
- Update this claim, `docs/ARCADE-AGENT-HANDOFF.md`,
  `docs/ARCADE-COMPATIBILITY-NEXT-STEPS.md`, and
  `docs/CONVERSION-CAPABILITIES-AND-GUI-GAPS.md`. Record source, original/emitted
  PXT, runtime, Code/Blocks/graphics/save-reopen and corpus separately.

No supplier pins, SDK files, workflow thresholds, baselines, timeouts or other
owners' implementations change. Claim separately any measured importer,
runtime or editor repair outside this envelope. Keep raw inputs/evidence private.

## Qualification and continuation

Preserve current exact-head CI originals once. Use genuine parser/helper bodies
for bounded counterexamples and complete affected source cohorts. Qualify SDK
producers and their negative controls; use existing hosted gates for heavy
runtime/editor work. Preserve original failures, live jobs and one-shot events.
Require every enabled final-head check and affected original/emitted MakeCode,
fresh reimport, authoring and save/reopen results before landing.

Remeasure the unchanged 184 raw inputs and retained complete contexts with
immutable source/input identities. Publish accurately bounded aggregate results.
Rank the remaining verified families, then take one family through conversion,
runtime and visible authoring. Historical counts remain historical until measured.

The factory slice also admits an actual explicit Undefined kind, matching the
retained SDK's omitted-kind behavior without publishing a Kind identity. The
complete scalar/ordinary-helper composition passes fifteen groups, including
writable z/lifespan String counterexamples and lexical-shadow AST refusal.
Default-kind and shadow-guard cuts are detected. Descriptor-only Sprite fields
and Image.getPixel inference are held for a separately scoped owner/effect
proof; no type declaration mints a Number certificate. Final hosted runtime,
original/emitted SDK and visible authoring qualification remains pending.
