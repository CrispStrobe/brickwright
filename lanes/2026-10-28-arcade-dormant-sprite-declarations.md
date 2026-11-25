# Dormant Sprite local and return declaration fidelity

Status: DONE — scoped source implementation and focused controls completed.
External original-PXT/native and composed-head qualification remain pending.
Owner: Arcade dormant-declaration repair in an isolated branch.
Registration base: main `cb28becdb16`.
Source continuation base: typed-bitwise checkpoint `2b50a37cffc` on the existing
Arcade integration source. This registration does not land that source stack.

## Ownership and exclusions

The operator instructed this worker to continue coding after the two specific
dormant Sprite local/return repairs were proposed for takeover. This records
that narrow operator-authorized scope; it does not claim an acknowledgment or
release by the broader integration owner. Preserve the existing forward-fix and
accessor/Sprite integration claims, source, branches and qualification custody.
The parameter repair remains frozen at its separate checkpoint pending external
qualification. Do not push or supersede the integration branch.

## Reproduced failures

These sources import and export without a diagnostic, but exported TypeScript
loses the declaration needed to reimport the flags expression:

```ts
function returned(): Sprite { return null }
function unusedReturn() {
    return returned().flags & SpriteFlag.StayInScreen
}
let ready = 1
```

```ts
function unusedLocal() {
    let actor: Sprite = null
    return actor.flags & SpriteFlag.StayInScreen
}
let ready = 1
```

The exported result/local becomes `any`; reimport then refuses the bitwise
operand. These are source observations, not identification or closure of the
separate retained declared-reference runtime failure.

## Implementation envelope

Own only declaration reconstruction for these otherwise-untyped dormant
ordinary-procedure locals/results in
`overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js` and a necessary
adjacent dormant-declaration proof helper. Own a new focused
`test/arcade-dormant-sprite-declarations.test.mjs`, its exact GUI scope row,
this claim and `docs/ARCADE-AGENT-HANDOFF.md`.

Use the existing current closed ordinary-entry proof. Audit actual physical
reads, writes, callers, returns and lexical bindings before selecting a
compatible declaration. The complete affected local/callee closure must remain
dormant. Null is a compatible reference initializer, not an initialized Sprite
producer. Keep all original explicit constraints and evaluation effects; reject
incompatible declarations rather than silently overriding them. Do not infer
Sprite authority from a helper name, annotation, flags spelling alone, retained
source or an empty writer set. A later caller, writer, alias, escape, shadowing
or graph edit must revoke the declaration plan.

Do not populate the live producer graph or extend Number/Sprite/Array/runtime
admission. Do not change supplier pins, runtime services, workflows, budgets,
existing acceptance tests, baselines or diagnostics to conceal a failure.
General editor controls and serialization for arbitrary reference annotations
remain a separately scoped capability.

## Qualification and delivery

Cover both export APIs, Code rebuild, repeated exported-file reimports and SB3
reopen. Preserve actual local initialization and function returns. Include
reachable/unknown callers, non-null incompatible writers/returns, aliases,
multiple consumers, lexical collisions, graph edits and declaration conflicts.
Remove each actual repair and require a meaningful regression failure; restore
exact source bytes. Source controls cannot close a corpus row.

Run the unchanged original-PXT/native typed-bitwise and declared-reference
acceptance controls with Node 22, locked integrated dependencies, the pinned
synced Arcade runtime and Playwright Chromium on an external qualified worker.
Missing inputs remain unavailable qualification. Preserve original failures
and acquire each official original once. No heavy builds or suites on the
shared server, duplicate dispatches or full-CI labels without an actual need.
Deliver normal checkpoint pushes for integration-owner composition. Require all
enabled final-head checks and reviewed/landed tree and parent verification before
landing source. Registration itself is Markdown only, not runtime qualification.

## Source checkpoint and remaining gates

A separate declaration plan now checks the physical local/return/caller census
against actual emitted lexical bindings. Locals require real null writes before
every read under the canonical initialization analysis, including both branches
and loop entry. Its private analysis excludes only the emitter-generated `any = 0`
initializer. Accepted locals render as `Sprite = null`; original assignments and
other effects remain. Result reconstruction requires null-only returns, current
ordinary call identity, and a wholly dormant caller closure with exact flags
consumers. The plan changes no live value graph or runtime service.

The final selected source cohort has 28 passes (11 new plus 17 parameter
controls); the external acceptance case was explicitly excluded from this probe.
Removing local/result reconstruction causes four expected failures each; removing
the physical initialization guard causes two. Exact helper bytes were restored
and all 28 source controls passed again.

The source cohort covers repeated direct/JSON reimport, Code rebuild, SB3 reopen,
live callers, non-null writers/returns, extra consumers, branch initialization,
reads before initialization, actual helper/loop name captures, multiple calls,
side effects and edits after prior export. The parameter cohort is retained.
Independent read-only review found no concrete counterexample; that is not
runtime qualification.

The same new test file contains an enabled-by-default original-PXT/native case.
Its [first hosted attempt](https://github.com/CrispStrobe/brickwright/actions/runs/40758182799/job/123090494998)
failed in the original simulator's startup-marker observation, before Lite ran:
the single unused constant was absent from simulator globals. The corrected
fixture executes `ready = 0; ready += 1` and requires exactly one published
`ready`/`Game_ready` marker equal to 1 in each original route. Native startup,
declaration, compilation and saved-project assertions remain required. The
corrected case has no passing external verdict yet; retain the first failure.
It compiles original and exported files in the pinned simulator, checks actual
Lite startup through Code and reimport, and reopens a fresh VM from SB3. It does
not execute the intentionally dormant null receiver bodies or assert hardware
behavior. Run it on an external prepared Node 22 worker with locked/integrated
GUI/VM dependencies, pinned synced Arcade runtime and Playwright Chromium:

```sh
node --import ./scripts/lib/register-gui-scope.mjs --test --test-concurrency=1 test/arcade-dormant-sprite-declarations.test.mjs test/arcade-typed-bitwise-reimport-fidelity.test.mjs test/makecode-arcade-typed-bitwise.test.mjs test/makecode-arcade-declared-references.test.mjs
```

Preserve the declared-reference test's existing TODO/runtime limitations; this
repair does not resolve its independent Array/native-addition refusals. A bounded
source-only probe can explicitly use `--test-skip-pattern='original PXT/native:'`;
that excludes acceptance only for that probe and cannot qualify landing. Missing
Playwright or other setup inputs remain an unavailable external qualification.
No compiler/native/corpus success is inferred from the source cohort. The last
raw census remains 147 translated / 36 partial / one parse failure out of 184.

After actual acceptance passes, compose with current integration/main, retain
first originals once, qualify every enabled exact-head check and verify landed
tree/parents. Keep the separate original declared-reference failure and unrelated
integration failures visible. General reference annotation authoring, initialized
Sprite producer support and broader reference-return graphs remain separate work.

### Primitive declaration conflicts

A later edit can replace null with a Number, String or Boolean while retaining
a Sprite flags getter. The actual emitted primitive declaration is now checked
against physical flags uses and their emitted lexical binding. Export lists the
incompatible local/result declaration and preserves its exact type and body;
it neither silently returns invalid typed code nor coerces the value to Sprite.
The expanded negative covers all three primitive types for locals and results.
Removing only diagnostic publication produces two expected assertion failures;
restoration retains the passing 28 selected source controls. Prior local/result/
initialization mutation receipts remain associated with their earlier checkpoint.

Source work is complete for this narrow contract. Publication and original
intake stay with this candidate's author through external qualification. The
DONE status does not assert original-PXT/native acceptance, corpus closure,
landing or broader reference-graph support.
