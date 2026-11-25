# Arcade captured primitive domains across class initialization

Status: IN PROGRESS. Claim merged in [PR #1300](https://github.com/CrispStrobe/brickwright/pull/1300).
Owner: Arcade integration. The complete six-group source module passes at
`7f08e871ad3c76929282787092270b1b09158744`; the separate fourteen-group class
regression also passes.
Remaining affected cohorts, mutations, final-head hosted checks and affected runtime/editor qualification remain open.
See [the implementation and next tasks](../docs/ARCADE-CLASS-CAPTURED-PRIMITIVES.md).
Claim branch: `lane/arcade-class-captured-primitives-claim-20261023`.
Base: `9d037ce7427ed21ceca1f67be5a050131a96b4e2`.
This continues the same owner's [PR #1128](https://github.com/CrispStrobe/brickwright/pull/1128).
The custom-kind source implementation is preserved on
`lane/arcade-native-frame-reset-source-20261023`; its source tests do not mean
it is merged to main. Preserve other owners, original failures and live checks.

## Observed problem

The complete first program in `test/makecode-arcade-class-inheritance.test.mjs`
keeps a String trace through ordinary calls, field initialization, constructor
and super calls, virtual dispatch, aliases and conditional temporary writes.
A separate source-only reconstruction through the real base Creator and direct
`projectToArcade` retains its actual draft and refusal. The first reported
operand is a captured Identifier in the mark function, with Undefined, String
and Opaque domains; initialization and captured-scalar readiness are false.
There is no physical block or selected-source range evidence. This is not a
claim that the pure-source project equals the original VM-consumed project,
or that one internal predicate alone caused every remaining failure.

Two obligations must remain separate: a complete primitive occurrence and
all-writer domain, and declaration execution before every relevant entry.
Changing only subclass inertness cannot remove an Opaque domain. Neither a
String annotation nor an empty writer set supplies a primitive fact.

## Exact implementation envelope

Production paths under `overlay/scratch-gui/src/lib/bw-makecode/`:

- `native-class-scalar-view.js`: reuse its actual lexical/class/argument/writer
  analysis for a private complete captured primitive binding view. Correct
  primitive addition union results conservatively: a possible String operand
  does not imply an always-String result. Retain Number alternatives, actual
  calls/effects, unknown poisoning and source currentness.
- Optional new `native-class-captured-primitive-bindings.js`: factor that same
  private complete binding closure if necessary; no public caller certificate.
- `native-array-binary-domain.js`: consume only proved current occurrence and
  complete binding facts for the actual captured Identifier. Preserve the
  separate readiness, every helper operand and existing successful routes.
- `lexical-declaration-readiness.js`, only if needed: actual owned parent/class
  declaration or construction/field/super/virtual entry coverage. Keep complete
  caller intersections, zero-path joins and permanent expiry. Do not erase a
  field-entry path or treat every class with heritage as inert.

No generic `source-value-producers.js` defaults, callable-binding API, parser,
class lowering/emitter, helper runtime source, SDK, supplier pin, workflow or
original test expectation changes. Stop for a precise amendment if required.

Tests and documentation:

- New complete `test/native-array-captured-class-scalar-domain.test.mjs` and
  `test/native-class-primitive-union-results.test.mjs`.
- Optional `test/fixtures/arcade-inheritance-captured-source.mjs` retains the
  entire original public program; no normalization or removed effects.
- `scripts/lib/gui-scope-allowed.json`: only exact named new tests that really
  need its existing procedure-model dependency; no resolver/checker exemption.
- New `docs/ARCADE-CLASS-CAPTURED-PRIMITIVES.md`, current sections of
  `docs/ARCADE-COMPATIBILITY-NEXT-STEPS.md`,
  `docs/CONVERSION-CAPABILITIES-AND-GUI-GAPS.md` and
  `docs/ARCADE-AGENT-HANDOFF.md`, plus this claim. Refresh stale handoff status
  without rewriting historical evidence or exposing private operational data.

## Required proof and acceptance

A captured domain needs actual binding identity, primitive base producers,
every real writer, actual call arguments, branch alternatives and class/virtual
activation. Receiver-row safety alone is not a scalar binding closure proof.
Unknown writers, calls, escapes, reflection or entries must refuse the extra
fact. Do not infer it from generated names, annotations, flags or saved values.
Cyclic updates cannot prove their own unknown inputs. Issue no Array, element,
initialized-value or generic Number certificate from primitive membership.

Readiness must prove actual declaration completion independently. A narrow
class-prefix permission requires no static executable effects, a uniquely
resolved earlier owned parent and closed structural/ambient assumptions. An
instance initializer body is not executed by class declaration alone, but all
actual construction and virtual activation paths still need coverage. Preserve
early/foreign constructors, shadowed parents, static effects and callback paths.

First regression: the full original source through public import, real base
Creator, direct export, emitted-file reimport and genuine Code feedback. Keep
all trace/field/super/virtual/alias/temporary writers. Pair alpha-renamed and
primitive-union positives with late nonprimitive writers, foreign calls,
unknown arguments, before-declaration/initialization construction, static
initializers, callback exposure, changed parents, malformed ownership and
source/prototype edit/restoration refusals. Add meaningful guard mutations.

Run complete affected source modules; preserve the original inheritance suite
and its actual SDK/native tests. Qualify final-head hosted checks and affected
visible Code/pseudocode/Blocks, save/reopen, MakeCode export/compile/reimport and
controller behavior. Source-only success does not close GUI rows or reduce the
historical 36 partial applications. Do not dispatch duplicate unchanged jobs or
add a full-CI label for claim documentation.
