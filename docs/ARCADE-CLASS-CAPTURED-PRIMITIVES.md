# Captured class primitives: implementation and remaining work

## Purpose and current boundary

Merged [claim #1300](https://github.com/CrispStrobe/brickwright/pull/1300)
owns this work. A complete inherited class example imports but refuses export
because the addition analysis cannot establish all captured operand domains and
entry readiness. Keep the entire original example, including field initializers,
constructor parameter properties, virtual dispatch, super calls, aliases and
temporary Undefined writers.

`native-class-scalar-view.js` computes private domains from actual lexical
bindings, calls, argument producers, field writers and complete class lineage.
A possible String operand in addition permits a String result; a pair of
non-String alternatives also permits Number. Annotations supply no domain.

The captured slice requires a closed synchronous caller/writer census. Every
captured module read needs a unique actual declaration and an inert prefix;
static effects, early construction, foreign calls and unknown writers decline
this extra proof. Actual Undefined values remain primitive alternatives.

The latest repair additionally connects two separate entry facts: formals are
initialized by their actual closed invocation, and an actual owned this/super
receiver is available at its method entry. These are private result-local
capabilities tied to the original binding, method, receiver and carrier identity.
They grant no generic initialized-value, Array or caller-supplied certificate.
Source edits, carrier edits and observed ambient changes expire used proofs.

## Tests observed so far

At `7f08e871ad3c76929282787092270b1b09158744`, all six complete groups in
`test/native-array-captured-class-scalar-domain.test.mjs` pass. The unchanged
full inheritance program completes import, real base Creator export, actual
emitted-file reimport/export and genuine Code feedback/export. Controls cover
alpha renaming, late unknown writers, early construction, static effects,
callback exposure, private membership and sticky source/prototype expiry.

Reimport introduces temporary reset/copy chains. The private class view now
resolves a direct uncaptured local copy from its nearest strictly preceding
write, following only finite same-body dependencies to a real constructor.
All original writers and effects remain. Branches, updates, foreign RHS,
captured locals and unsupported reads decline refinement. A separate assertion
checks that a later reassignment cannot retarget an earlier saved copy.

A separate run at the same source head passes all fourteen groups in the
complete existing class-scalar (four), local-lineage (six) and primitive-union
(four) modules. The first regression run caught an earlier primitive observation
being admitted before the constructor overwrite. The repair preserves that
original refusal and adds the same negative to the new suite. No original
expected value was changed.

These are two separate complete source runs, not a whole-unit or application
measurement. Earlier dependency-load and semantic failures remain preserved;
they are not passing results for their original heads.

## Deliberate remaining boundary

This extra proof still refuses captured callbacks, foreign or unresolved calls,
static executable effects and a temporary observed as a primitive before its
constructor overwrite. They are unresolved source patterns, not evidence that
these MakeCode capabilities are fully supported. A future broader occurrence
proof needs a separate scoped change, complete actual entry/writer coverage and
runtime-backed positive and negative programs; preserve the present refusal
controls while that proof is absent.

## Regression map

Run complete modules, without title filters or changed expected values.

| Repository test path | Acceptance purpose |
| --- | --- |
| `test/native-array-captured-class-scalar-domain.test.mjs` | Full real conversion roundtrip; capture, method entry, saved aliases and expiry |
| `test/native-class-primitive-union-results.test.mjs` | Number/String alternatives and unknown-writer refusal |
| `test/native-class-scalar-view.test.mjs` | Existing scalar members, aliases and unsafe writers |
| `test/native-class-local-lineage.test.mjs` | Owned inheritance, lexical super, early virtual entry and parent mutation |
| `test/native-class-contained-values.test.mjs` | Contained values, aggregate escape and cycles |
| `test/native-array-captured-scalar-domain.test.mjs` | Existing complete capture writer proof |
| `test/native-array-captured-lexical-ready.test.mjs` | Declaration readiness independent of value domains |
| `test/native-class-lexical-frontier.test.mjs` | Class activation and lexical entry frontier |
| `test/makecode-arcade-class-inheritance.test.mjs` | Original affected runtime and MakeCode qualification; keep its program and expectations unchanged |

The public continuation is [PR #1128](https://github.com/CrispStrobe/brickwright/pull/1128).
Refresh its actual head and enabled checks before acting. A successful result on
a different branch or an older head does not qualify its current candidate.

## Continue in this order

1. Exercise the remaining affected captured-scalar, native Array,
   contained-value, lexical-frontier and frame/custom-kind cohorts against the
   final composed source. The class-scalar, lineage and union modules pass on
   the source head above. Preserve every original assertion and source program.
2. Add meaningful mutations for private entry membership, complete caller/writer
   closure, global declaration prefix, sticky expiry and source-order alias
   dominance. Confirm each relevant negative detects the removed fence.
3. Qualify the final composed head with hosted enabled checks. The original
   inheritance VM/MakeCode qualification must execute the unmodified program;
   pure-source Creator/export tests do not establish runtime equivalence.
4. Exercise Code/pseudocode and Blocks authoring, graphics preservation,
   save/reopen, MakeCode export/compile/reimport and controller behavior. Track
   each visible gap in the GUI ledger rather than marking it complete from a
   converter test.
5. Remeasure the actual application corpus only after preserving source/input
   identities and per-app parse, compile and execution failures. Historical
   36 partial applications remain unremeasured by this work.

Do not suppress Opaque writers, borrow type annotations, remove a failed gate,
change original expected values or infer exact SpriteKind IDs. Generic producer
defaults, parser/emitter, SDK, dependency pins and workflows are outside this
claim's source envelope.
