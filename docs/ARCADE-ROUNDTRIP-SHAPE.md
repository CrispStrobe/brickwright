# Arcade roundtrip shape: ordinary symbols and empty Arrays

## Scope and foundation

Repeated conversion must preserve the current program without adding avoidable
function qualification or Array transport layers on every trip. This contract
owns two independent changes: **A**, allocation of ordinary exported function
symbols by their actual current owners; and **B**, preservation of empty Array
allocations in two proved statement contexts. Neither change removes user code.

Implementation starts only after this documentation claim normally merges, from
a reviewed source composition containing the current exporter, staged-value
lowerer and Array receiver authority. Public adoption must include and qualify
that foundation with these changes. The
[local initializer contract](ARCADE-ARRAY-LOCAL-RESET-PROOF.md) authorizes export
receiver analysis and explicitly excludes source lowering; it does not authorize
this new work. Preserve all other lane owners and coordinate shared hunks.

## Ownership after merge

Own narrow coordinated changes to:

- `overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js`: ordinary declaration
  symbol inventory/allocation and the matching actual call emission only.
- `overlay/scratch-gui/src/lib/bw-makecode/ordinary-export-symbols.js`, if a
  separate pure helper is needed for that allocator.
- `overlay/scratch-gui/src/lib/bw-makecode/lower-pxt-staged-values.js`: the two
  bounded empty-Array statement contexts below, preserving existing staging
  elsewhere.
- New focused controls in `test/makecode-arcade-ordinary-symbols.test.mjs` and
  `test/makecode-empty-array-staging.test.mjs`, necessary additions to affected
  existing source/export controls, this contract and compatibility/handoff notes.

This claim does not authorize runtime, supplier/compiler, dependency pin,
managed invocation ABI, new primitive domain, GUI implementation or workflow
changes. A different implementation surface needs coordinated ownership first.

## A. Actual-owner ordinary function symbol allocator

Build the complete actual current declaration and emitted symbol inventory before
assigning ordinary function names. Bind each declaration to its real target,
unique definition/prototype and lexical procedure identity, and bind every
emitted call to that declaration. Names, target-name concatenation, generated
prefixes, cached annotations or retained source are not owner identity. Detect
ambiguous declarations and malformed or foreign call bindings explicitly.

Reserve every applicable current global/resource/helper/callback symbol and
language/SDK binding needed by emitted source, including sanitized collisions.
Preserve a legal unique current base identifier when the complete inventory
permits it. Qualify only actual collisions and allocate deterministic fresh
names against the same complete inventory; check the final allocated names for
collisions as well. Use owner-keyed maps rather than delimiter-joined strings
that can conflate different actual owners. Determinism must not depend on a
previous export's metadata or stable runtime IDs across import.

Update declarations, recursion, mutual calls and any already supported ordinary
function reference sites consistently by their resolved current owners. Do not
expand reference/callable admission to accommodate unresolved sites. Do not strip
an apparent target prefix, delete a function, merge same-name declarations,
rewrite a body or use original source as an export fallback. Preserve argument
order, omitted/default handling, return/completion semantics, captures, actual
body statements and diagnostic refusals. Unknown ownership remains a refusal.

## B. Safe empty-Array staging contexts

An actual empty Array literal may stay directly at its original evaluation
position only when it is either:

1. The complete initializer of an actual declaration with its exact lexical
   binding; or
2. The complete right-hand side of a plain Identifier assignment expression
   used as an expression statement, with its actual target binding resolved.

Prove the current AST context, scope, execution position and complete expression
shape. Preserve declaration kind, declarator order and surrounding evaluation;
multiple declarators require a separate position/order proof. Do not move an
allocation across an initializer, condition, exception, call or statement. The
result must still allocate a fresh Array exactly once each time that original
position executes. Direct initialization and assignment must retain their actual
alias and mutation behavior and all existing receiver/element proofs.

Do not take this shortcut for member/index targets, assignment expressions whose
value is embedded elsewhere, call arguments, conditional or short-circuit
operands, nonempty Arrays, resource-marked syntax containers or another lowering
protocol. Preserve their existing staging and operand order. Annotation bits,
temporary-variable spelling, a declared Array type or an empty-looking current
value cannot replace the actual empty-literal/context proof. Missing, malformed
or unknown syntax and binding/effect uncertainty keep the existing behavior and
explicit diagnostics; never replace an expression with an empty Array.

## Acceptance and retained evidence

Review A and B independently before composition. Authored allocator controls must
cover same-name procedures across targets, sanitized and reserved-name
collisions, a legal authored name matching another qualified candidate, collisions
with globals/resources/helpers/callbacks, actual recursive/mutual calls, ambiguous
or foreign owner bindings, and declaration/call identity after reimport. Preserve
full bodies and effects when only symbols change. Include current editing,
renaming and save/reopen rather than trusting stale name metadata.

Empty-Array controls must observe fresh allocation identity, independent Arrays,
alias mutation, repeated execution, declaration/assignment order and exceptions
before and after allocation. Exercise both admitted statement contexts and all
excluded embedded/member/index/effectful/nonempty cases. Compare the original
and generated behavior in separately admitted selected-PXT and affected native
controls; a shorter source string is not semantic qualification.

For the actual current application, retain complete raw input files, graph,
source/body/asset inventories and every conversion result before assertions.
Preserve diagnostic channel presence and values, Creator warnings/errors/unparsed
arrays, parse exceptions and partial graphs. Exercise source import, actual
Creator/Code feedback, current Blocks, same/fresh SB3 with actual assets, current
export, and reimport using preparation bound to those exact newly exported
files. A different exported root requires its own fresh admitted preparation;
no original-source or stale prepared-result restoration is permitted.

Measure multiple consecutive actual conversions and independently compare owner,
call, body, allocation, source-shape and diagnostic inventories. Establish that
these two mechanisms stop adding qualification prefixes or Array transport layers
without hiding growth from other mechanisms. Preserve original growth and failing
outputs. Do not reduce compatibility counts or claim stable whole-project
roundtrips from an isolated allocator/lowering test. Actual guest, visible GUI,
full-pipeline and exact-head hosted checks remain separate required gates.

## Other growth mechanisms remain open

The following are tracked design work, not implementation permission from this
claim:

- **C: Local initialization transport.** Distinguish scope declaration from an
  executed reset only with structural current-binding, all-writer/read/capture
  and control-flow proof; preserve user-authored Null/Undefined resets.
- **D: Startup ownership and wrappers.** A wrapper may be composed only after
  actual caller, scope/capture, recursion, return and scheduling/lifetime proof.
  A startup-like name cannot make a function disposable.
- **E: Callback formals and aliases.** Allocate from actual event and lexical
  binding identity; do not delete authored aliases or grant reference authority
  from spelling or metadata.

Those mechanisms can still grow source after A and B pass. They require their
own reviewed ownership and qualification before product changes. Runtime
prototype-sensitive dictionaries, graphics/editor authoring, missing assets and
all unrelated compatibility gaps remain separately tracked.

## A implementation coordination

The matching resolved-call scope includes the existing class field-initializer
ordinary-call lookup in
`overlay/scratch-gui/src/lib/bw-makecode/object-class-export.js`. Its narrow
lookup adapter is coordinated with the ordinary symbol owner. It does not
change class bodies, defaults, field types or class admission. Wider class
changes require separate coordination.

The A candidate reserves the closed current runtime/helper/resource/generated
identifier families and all actual current lexical binders for name hygiene.
Those reservations never establish an owner or runtime value. Ordinary names
come from unique actual target/definition/prototype and ordered formal records;
validated signature placeholders are removed once before sanitization. Actual
current project semantics and object identity are rechecked after rendering,
including artwork callbacks. Unresolved foreign calls remain diagnostics.
Prototype-sensitive native procedure dictionaries remain an unresolved runtime
name-support gap; a conservative owner refusal does not implement that support.
Source and authored controls alone do not qualify the candidate.

Owner schema checks include actual definition/prototype/formal socket tags,
arity, parent/role/shadow identity and stock-call input shapes. Plain-project
snapshots reject hidden or symbol properties and accessors without invoking
getters; ordinary Array length is the schema exception. Generated legacy
callback `sprite`/`otherSprite` formals and restart-script `_g` declarations
also reserve lexical hygiene. Authored source controls cover these actual
callback/restart bodies as well as malformed and post-plan hidden edits.

## B source implementation boundary

The first source candidate keeps a literal empty Array directly only in an
actual single `let`/`const` initializer or a complete plain Identifier assignment
statement to a unique existing `let`/parameter binding. Lexical binding identity
is read from the current pure source graph; no result type is inferred from it.
Only current unique syntax nodes with the ordinary empty-Array shape qualify.

Programs containing `var`, unsupported scope syntax, unknown nodes or exceptional
lowering retain existing staging. Multiple declarators, for-init positions,
class/resource metadata, shared syntax and every consumed/member/index/nonempty
expression also retain existing staging. These conservative limits preserve the
previous behavior; they are not newly supported source features. The source
candidate has no runtime, supplier, GUI or primitive-domain changes. Focused
controls and actual affected current-program qualification remain required.

The existing root procedure-constraint prefix envelope is not executable syntax.
Its actual frozen or current lowering-clone container and prefix function identity remain bound separately;
this shortcut neither calls that function nor obtains a lexical/value fact from
it. Unknown metadata and changed current syntax keep their previous lowering.
Existing value-lowering hooks and resource protocols still run before deciding
whether only the empty allocation transport can be omitted.

Actual parser parameter arrays carry three nonenumerable data channels. Only
those exact parser descriptor roles, with their current function optional-name
identity and empty default/property protocols, participate in the lexical census.
Unrecognized hidden fields, substituted metadata and unproved default protocols
keep previous staging. JSON snapshots do not preserve these descriptors; source
controls must inspect the actual parser objects.


The existing namespace lowering can prepend real `SpriteKindReset` statements.
The empty-Array census admits only their exact data-only root leaves, in the
producer's order and linked one-to-one to unique current flattened kind
Declarations. These remain actual Undefined writes in place; the shortcut does
not remove them, treat them as Array/value producers or admit arbitrary unknown
syntax. Malformed, foreign, nested, shared or mutated reset/declaration contexts
keep existing staging. Focused source and public Code/graph controls qualify
this bounded syntax model; affected complete-project and native evidence remain
separate requirements.


## Observed authoring and conversion capabilities

These observations describe the reviewed source composition; they do not mean
that the full composition is already adopted on public main.

| Capability | Observed boundary | Still required |
| --- | --- | --- |
| Ordinary function names | Current owner-based allocation preserves legal names, resolves collisions and keeps declaration/call bindings through authored conversion cycles, including parameterized functions. | Full-project roundtrip stability and affected native/editor qualification. |
| Direct empty Arrays | Eligible declarations and complete assignments retain their actual allocation sites. Code conversion controls preserve aliases, repeated allocation positions and a current edit from `[]` to `[5]` in blocks and export. | Native behavior of affected complete projects and visible editor journeys. |
| Namespace kinds beside Arrays | Actual root kind-reset statements and their order survive alongside eligible direct Arrays; unknown or changed syntax keeps prior staging. | Broader syntax and project coverage. |
| Complete project conversion | Import, both Creator passes and export reported no diagnostics for one affected project; its actual asset-bearing SB3 was retained and audited. | Fresh preparation/compile/reimport of that new export, and native execution of its new saved graph. |

The retained saved outputs were audited for the bounded Array transport changes,
owner-scoped internal local names, unused automatic capture entries and derived
script layout. All remaining graph metadata, variable monitors and ordered
costume/sound bytes were preserved. An initial comparison failure remains
retained; the later audit is a saved-graph comparison, not emitted-source AST
equality, native or export equivalence, visible GUI qualification or a
compatibility-corpus promotion.

A separate [ordinary local initializer transport contract](https://github.com/CrispStrobe/brickwright/blob/main/docs/ARCADE-LOCAL-INITIALIZER-TRANSPORT.md)
now defines **C1**: represent a proved first literal write at the same position
without adding a duplicate declaration initializer. Its reviewed foundation must
qualify before implementation. A no-value declaration protocol (**C2**), startup
wrappers (**D**) and callback formal/alias allocation (**E**) remain separate work;
A/B observations do not close those gaps.
