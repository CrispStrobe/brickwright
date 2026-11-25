# Arcade class lexical frontier and parser-shape results — claim

DONE for source implementation; focused qualification passed, hosted qualification pending. Owner: Arcade integration. Branch:
`lane/arcade-class-lexical-frontier-claim-20261023`.
Base: `eb21e4fd14686045ac49735037934d644c1a36d8`.
Merge this scope before implementation. Continue the same owner's lexical
readiness and captured class-result work; preserve preceding source candidates,
original failures, their pending qualification and all other owners.
This implementation follows the unmerged captured-result work in
[PR #1128](https://github.com/CrispStrobe/brickwright/pull/1128),
published at `df2cdb4c94592bdda7fb4c177e5d99604e1311e5`. Its capabilities
and pending hosted checks are not asserted as already landed on main.

## Concrete source boundaries

The existing declaration frontier rejects three legitimate shapes: parser If
without else has own alternate:null but the walker requires an Array; every
Identifier named this invalidates the whole frontier, including actual class
method bodies; private class-result Boolean literals use string false rather
than the parser's actual Boolean false. These prevent otherwise qualified
captured class getters/methods and primitive unions from using existing result
facts. They are independently observed source obstacles, not an explanation for
all application refusals or a claimed corpus reduction.

## Exact scope

Only these production paths under `overlay/scratch-gui/src/lib/bw-makecode/`:

- `lexical-declaration-readiness.js`: exact own-data parser no-else If handling
  and context-bound instance-method/constructor this syntax recognition.
- `ts-import.js`: retain an own Boolean `isStatic` on parsed constructors and
  record an explicit unsupported diagnostic for a static constructor-named
  method in this parser slice. Preserve
  every other parser option, parameter/body shape and language profile.
- `native-class-scalar-view.js`: Boolean false values in its own private literal
  and alternative carriers; preserve their issued identity/currentness model.

Add complete pure `test/native-class-lexical-frontier.test.mjs` and
`docs/ARCADE-CLASS-LEXICAL-FRONTIER.md`. Permit precise positive migrations in
`test/native-captured-class-primitive-results.test.mjs` as defined below.
Include this claim, associated status/limits in
`docs/ARCADE-CAPTURED-CLASS-PRIMITIVE-RESULTS.md`, and additive self-contained
next/GUI tasks in `docs/ARCADE-COMPATIBILITY-NEXT-STEPS.md` and
`docs/CONVERSION-CAPABILITIES-AND-GUI-GAPS.md`.

No generic graph, broader parser, native-array consumer, helper-recognition, runtime,
heap, emitter, SDK/supplier/pin, workflow or policy-ledger change. No new public
analysis option, caller certificate, receiver/type producer or method entry
seed. Keep all three helper profiles, native-domain import witness, preceding
source bodies and original native/SDK/GUI assertions unchanged. Stop for an
exact amendment if an additional module or capability is required.

## No-else semantics

Require a genuine own-data alternate descriptor: null means the parser's absent
else; an own dense statement Array retains ordinary two-arm behavior. Missing,
inherited, accessor, undefined or malformed alternate shapes refuse. Do not use
truthy/default-empty normalization to mask malformed source. Preserve condition
and consequent evaluation, exact binding identity and currentness.

A missing else contributes the actual incoming declaration-executed frontier,
joined with the consequent's completion. Branch-only declarations do not become
unconditional facts. Preserve both-arm intersections, return/throw/break/continue
completion and loop uncertainty. Executing a declaration remains distinct from
initializing its value; actual initialization/TDZ and every caller entry remain
separate obligations. Two same-name declarations in separate If blocks remain
distinct lexical bindings, not a reason to merge or discard a declaration.

## Method-owned this syntax only

Keep this in the reflective-root refusal set for global expressions, heritage,
template tags and other reflective routes. Exempt only the actual Identifier
occurrence in an exactly owned instance constructor/method/getter/setter record
created from the current Class's own constructor or method collection. Bind
actual parser shape, method identity, nonstatic role and lexical owner; a
params/body-shaped record, moved ordinary function, name or supplied owner flag
cannot enroll a method. A constructor must retain its actual own
`isStatic:false` parser role; absence is never treated as proof of instance
ownership. The parser currently erases that role, so the narrow retention and
static-constructor diagnostic above are part of this scope. Reject explicit this formals and inherited/forged role
metadata. Own source/accessor/prototype mutation remains revocable.

A nested ordinary function/allocation does not inherit this exemption merely
because it appears under a method. Global, static, field-initializer, dynamic and
unknown nested this remain refused in this first slice. A separately proved
lexical receiver capture can be scoped later using actual binding identity.

This is syntactic admission into the declaration analysis, not proof of an
initialized or safe receiver. Preserve method records' existing empty incoming
frontiers: do not invent method/callback/constructor entry seeds or mark this
initialized. Class field/getter/method and receiver facts still come solely from
the existing class issuer; all captured declarations still need actual every-
entry readiness. Constructor re-entry, early virtual calls, initializer self-
entry, an early second entry, extracted methods, aliases, unknown callbacks and
nonlocal effects retain all prior obligations. If those obligations cannot be
proved, refuse rather than infer lifecycle safety from method ownership.

## Private Boolean shape and result authority

Use actual Boolean false for the issuer's private Boolean literal alternatives
and synthetic conditional tests. Keep Number/String/Null/Undefined construction,
primitive domains, original getter/call test, issued-node membership, complete
writer/effect census and sticky currentness unchanged. Do not accept arbitrary
string-valued Boolean AST nodes or relax generic validation. A union remains a
normal primitive result only; Boolean is not Number, and no Array/input/receiver/
body/type or initialization certificate follows.

## Exact test migrations and new controls

In the existing twelve-group captured-class module, preserve the complete EOF
source, generic input-uninitialized assertions, canonical two-If own-null shape,
independent helper-free readiness positive, full consumer EOF and nested positive.
After no-else support is implemented, change only its named raw-header frontier
refusal assertion to a positive readiness assertion. Preserve its original
26-pass/one-failure diagnostic and the later genuine premise correction.

Migrate only the two actual this-based getter/method cases that currently assert
issuer membership but refuse consumer admission: require full consumer acceptance
on those same programs and retain exact issuer identity assertions. Update their
limit comment. Keep every surrounding opaque/reference/Array, TDZ/default/
generic/foreign-effect, copied-carrier, reflection, prototype/global intrinsic
forgery and currentness/ABA negative effective. No other refusal is relaxed to
get green. Add Boolean/union consumer positives and exact Boolean-value shape
assertions in the new module.

New complete controls must cover parser no-else and genuine two-arm flow, block-
local same-name bindings, consequent-only and early/unknown-entry refusals, abrupt
completion joins, missing/inherited/accessor/nondata alternates with zero getter
calls, and physical edits/observed restoration. Pair actual instance ctor/getter/
setter/method this positives with global/static/field/nested/forged-owner negatives.
Explicitly test parsed instance constructors retain own `isStatic:false`, parsed
static constructors retain own true plus an unsupported diagnostic, and absent,
inherited or forged constructor role metadata cannot authorize this.
Explicitly test generic receiver initialization stays false, method entry seeds
stay empty, constructor calling a captured read before its declaration completes,
early virtual field access, bad second call, extracted/escaped methods, defaults,
opaque/reference/Array field writers and original effect retention. Test private
Boolean false and primitive union shapes without Number/Array authority, carrier/
source/intrinsic mutation, exact reflection Error and no rereads after revocation.

## Qualification and fresh continuation

Run complete new and affected source modules within a separately admitted whole
cohort and unchanged bounds, retaining first failures; do not reuse a consumed
one-shot gate. Require every enabled exact-head hosted check and affected clean
normal guest/native/SDK acceptance. Original class-accessor, function-return,
Math.idiv, SDK Sprite and existing captured-operation/class source cohorts remain
complete. No local filtered SDK/VM replay or old-head borrowed success. Source
positives alone do not establish native/compiler/GUI or application completion.

Visible task: author constructor/this-backed getter/setter/method and Boolean/
primitive union field values in Code and Blocks, call through a real captured
procedure/callback, edit actual inputs, save/reopen and compare current exported
and running values. Graphics/Image/Sprite reference fields, static/nested receiver
capture and method/callback entry propagation remain separately scoped work.
Mark source DONE separately from qualification; update task limits from actual
evidence and remeasure complete applications before changing corpus counts.

## Source implementation checkpoint

The three production paths, complete new eleven-group frontier module, precise
three positive migrations in the existing class12 and task/editor documentation
are written. All 38 complete focused groups pass without failures or skips
(frontier11, class12, existing class4 and operation11). Final-head hosted/native/
SDK/browser checks remain pending. Original Array/effect/TDZ and receiver-initialization assertions
remain in place; no application completion is claimed.

The context permission is held only by private record membership. Supplied AST
owner flags cannot grant it. Record entry validates own data before traversal;
fields of nested Classes mask outer method permission. Method entry seeds stay
empty. The static constructor-named boundary is explicit unsupported syntax in
this importer slice, not a blanket statement about the source language.
