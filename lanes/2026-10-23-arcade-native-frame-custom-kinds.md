# Arcade native-frame custom kind effects — scope amendment

Status: IMPLEMENTED; source controls qualified, final-head hosted qualification
pending. Owner: Arcade integration.
Claim branch: `lane/arcade-native-frame-custom-kind-claim-20261023`.
Implementation branch: `lane/arcade-native-frame-reset-source-20261023`.
Base: `c5be666c2faf24dbc5711069b5b79f8b83267c07`.
This is the same owner's merged claim #1283 and source continuation in
[PR #1128](https://github.com/CrispStrobe/brickwright/pull/1128).
The unchanged original source module passes at
`40f6434f0b5686032c5e5735708423d3335ef917`; the separate custom-kind
module passes at `40f6434f0b5686032c5e5735708423d3335ef917`. These source results
do not mean the implementation is merged to main or qualify the full editor
journey. Preserve the live PR head, originals and qualification; no takeover or
duplicate hosted event.

## Implemented behavior

The frame effect interpreter now admits the existing native numeric kind
allocator, fixed safe-name numeric binder and custom-name lookup after an actual
earlier binding. The translator, runtime and exporter already supported those
operations. The proof adds only an ordered numeric effect; it does not invent
an Array or initialized-value fact.

## Exact source and test envelope

- `overlay/scratch-gui/src/lib/bw-makecode/array-native-frame-reset.js`: private
  effect transfer for actual zero-input `arcade_createSpriteKind`, exact literal
  safe-name/numeric-kind `arcade_bindSpriteKind`, and custom-name lookup only
  where a real earlier binding remains proved on every normal path.
- `test/fixtures/arcade-frame-source-project.mjs`: extract the existing genuine
  source/artwork conversion fixture from the current frame regression module;
  expose no producer/currentness/type certificates or cached proof verdicts.
- `test/array-native-frame-reset.test.mjs`: fixture-only reuse; retain all 11
  existing groups, actual producer/consumer and unsafe control assertions.
- `test/array-native-frame-custom-kind.test.mjs`: new complete bounded module.
  Existing full frame controls are near their local CPU cap, so do not filter
  them, drop controls or increase limits to combine unrelated test cases.
- `scripts/lib/gui-scope-allowed.json`: add only the exact existing
  `scratch-vm/src/util/bw-procedure-constraint-model.js` dependency census rows
  for the existing native-frame test and the new custom-kind test. Both tests
  import owned overlay source and use the unchanged root GUI dependency hook.
  Preserve the checker, all existing rows, supplier identity and thresholds.
- Associated status and self-contained tasks in
  `docs/ARCADE-NATIVE-FRAME-RESET.md`,
  `docs/ARCADE-COMPATIBILITY-NEXT-STEPS.md`,
  `docs/CONVERSION-CAPABILITIES-AND-GUI-GAPS.md` and this claim.

No translator/parser, emitter, runtime, SDK, supplier, pin, workflow, policy
checker/threshold or browser fixture changes. The exact dependency census
addition repairs the hosted import-policy failure;
it grants no new resolver capability and does not exempt either test. The source
effect now admits the zero-input numeric allocator, fixed safe-name numeric
binding and ordered custom lookup only after an actual earlier binding. It
grants no exact kind ID, Array or initialized-value fact. Keep GUI authoring,
kind dropdown/decompilation and complete save/reopen/export/reimport/controller
behavior as open acceptance work. Do not execute SDK/reference code for this
slice. Stop for a precise amendment if another production path is needed.

## Semantic requirements

A native allocation advances its private numeric kind allocator and cannot
publish or read the current params frame. No exact integer ID is assumed.
Validate the actual empty input/field/mutation schema and native contract;
a number annotation, opcode prefix or saved value grants no authority.

Binding must use its actual fixed safe identifier and an independently proved
primitive Number operand. Reject coercing/dynamic/prototype names and readonly
built-in/library collisions. Treat it only as an ordered registry effect, never
an Array, Sprite, element, source-cell or initialized-input certificate.

For a custom name reporter, require the actual earlier binding in the current
execution prefix. Track private primitive-domain facts through the existing
zero-iteration loop join and complete callback/caller activation boundary.
A later declaration, another scope or ambiguous branch cannot supply a prior
binding. Conflicting or unknown effects refuse. Do not remove existing writer,
source-entry, ownership, declaration-role, prototype or permanent expiration
checks. Preserve the four older reset routes unchanged.

## Acceptance and unsafe counterparts

Use actual TypeScript namespace declarations and variable kind allocations
through real artwork installation, initial clean export, emitted-file reimport,
Code decompile/reparse and final clean export. Exercise real resulting blocks;
never inject a reset, change image dimensions or attach a type certificate.
Add a complete custom-kind module with positives and paired unknown/missing/
late binding, dynamic/coercing name or kind, builtin rebind, malformed schema,
loop zero-path, early callback/capture and second-writer refusals. Preserve
consumer IDs in negative graph edits and retain exact original failures.

The shared fixture extraction must preserve source construction, asset bytes
and per-exact-project asset association. Existing 11 groups must still pass
as a whole, with their full assertions. Separate SOURCE qualification from
actual SDK/native/GUI/controller/save-reopen acceptance and corpus completions.
All enabled final-head checks and existing affected clean guest gates remain
required before merging implementation; no partial-count claim from source
success alone.
