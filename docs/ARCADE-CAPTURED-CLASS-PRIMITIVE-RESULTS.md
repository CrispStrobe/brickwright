# Captured class primitive results

## Capability and boundary

A class view can prove that an actual field, getter or owned method returns only
primitive values, while the generic graph still treats a captured receiver as
uninitialized. Native addition must compose these separate facts without marking
the receiver initialized or granting an Array producer.

The issuer in `overlay/scratch-gui/src/lib/bw-makecode/native-class-scalar-view.js`
now exposes `hasNormalPrimitiveResult(node)` for exact Conditional nodes it
allocated from already selected accesses. Copies, names, annotations and caller
tags grant nothing. Every carrier, primitive branch and prototype descriptor is
watched. The original access or call remains exactly once as the Conditional test.
Existing constructor, lineage, alias, writer, factory and SDK selection is unchanged.
New method-result delivery also requires actual arity and absence of default,
rest, optional, generic and asynchronous signatures.

The consumer in `native-array-binary-domain.js` tries this result only after its
existing operand admission refuses. It joins the issued carrier, test, branches,
receiver and arguments to the final model. Receiver declaration readiness comes
from the existing lexical frontier; call arguments retain their own obligations.
The complete original effect and Array census still runs. This grants only a
primitive normal result, preserving exceptions and nonreturn behavior. It does
not initialize the receiver, its inputs, method body or an Array/reference cell.
After use, an observed source/carrier/frontier failure permanently revokes the
proof; restoration cannot revive it. The first reflection error is preserved.

## Deliberate remaining boundaries

All 27 focused source-analysis groups pass: the new twelve, existing four class
groups and existing eleven captured-operation groups. Hosted, SDK, runtime and
browser qualification remain pending. This is not full class compatibility
or evidence of a completed corpus application. The original hosted failure drafts
available during this work identify Math.idiv operands, not a class/getter operand.
A real failing class export still needs its exact current input and result captured.

The follow-up [class lexical frontier](ARCADE-CLASS-LEXICAL-FRONTIER.md)
implements actual parser no-else If handling, nonstatic method-owned this syntax
and correctly typed private Boolean carriers. The follow-up passes all 38 complete focused source groups; hosted/runtime/
browser qualification remains pending. Method entry frontiers remain empty; static,
field and nested receiver contexts still require independent work. No source
annotation or guessed callback order supplies declaration readiness.

## Next tasks and acceptance

1. Retain the passing complete new
   `test/native-captured-class-primitive-results.test.mjs`, existing class-scalar,
   captured-operation controls. Qualify SDK receivers and all enabled final-head
   hosted checks. Preserve original SDK/native roundtrip fixtures and assertions.
2. Capture exact remaining class failures through the current export observation
   channels. Bind input bytes, source/build identity and result; unavailable capture
   remains unavailable. Do not infer the failed graph from an earlier saved file.
3. Qualify the scoped class lexical frontier and preserve its remaining boundaries: recognize a genuine method-owned `this`,
   retain global/foreign reflection refusals, constructor reentry, early virtual
   calls, all entries and arguments. Prove receiver declaration completion before
   any captured read. Audit the parser/private-view Boolean representation at that
   same boundary; do not relax all Boolean validation. For parser no-else If,
   prove that an own explicit null alternate means an implicit empty branch and
   preserves entry intersections. Do not turn missing, inherited or unsupported
   statement shapes into empty bodies.
4. Verify visible authoring independently. Create and initialize a Counter in Code
   and Blocks; read and edit its fields from a captured procedure and actual event
   callback; edit constructor values; save/reopen; inspect current exported source
   and actual runtime values. Repeat for getters/methods after their frontier is
   supported. Connected blocks and visible source must agree. Graphics/Image/Sprite
   reference fields need their separate storage and editor capabilities.
5. Run complete original/import/Code/same-and-fresh SB3/current-export/reimport
   journeys and genuine corpus applications before changing completion counts.

The ownership contract is
[`lanes/2026-10-23-arcade-captured-class-primitive-results.md`](../lanes/2026-10-23-arcade-captured-class-primitive-results.md).
The integration PR is [#1128](https://github.com/CrispStrobe/brickwright/pull/1128).
