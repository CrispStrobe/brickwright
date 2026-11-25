# Arcade checkpoint and fresh-agent continuation — 27 October 2026

Read this file first, then the checkpoint branch’s
[detailed handoff](https://github.com/CrispStrobe/brickwright/blob/lane/arcade-source-entry-image-banks-20261026/docs/ARCADE-AGENT-HANDOFF.md) and
[GUI ledger](https://github.com/CrispStrobe/brickwright/blob/lane/arcade-source-entry-image-banks-20261026/docs/CONVERSION-CAPABILITIES-AND-GUI-GAPS.md). Follow `LANES.md` and
`lanes/PROTOCOL.md`. Operational paths and retained-original locations belong in
ignored local Markdown; none are required to understand the public tasks below.

## Where the code is

The complete source checkpoint is on
[`lane/arcade-source-entry-image-banks-20261026`](https://github.com/CrispStrobe/brickwright/tree/lane/arcade-source-entry-image-banks-20261026).
The current test/diagnostic continuation is
[`lane/arcade-source-continuation-20261027`](https://github.com/CrispStrobe/brickwright/tree/lane/arcade-source-continuation-20261027),
based on that complete source branch. Its checkpoints `0aa5d9add99` and
`f6ad4b17a33` are pushed, but have not replaced #1128 or passed hosted tests.

Later source checkpoints add ordinary value calls, repeated publication
frontiers, frame-delta operands and `game.askForNumber` operands. Use the complete
branch history; isolated cherry-picks lose earlier Array, Image, callable,
accessor, controller, loader and pin-policy repairs documented in the handoff.

This is a **source checkpoint, not a merged or runtime-qualified release**.
[PR #1437](https://github.com/CrispStrobe/brickwright/pull/1437) and the
previous documentation checkpoint #1470 have merged. Their owner retains the
#1437 originals; do not download them again.
[PR #1128](https://github.com/CrispStrobe/brickwright/pull/1128) now has
integration head `7ef0dacc`, containing the qualified main composition and
source work through the publication-frontier checkpoint. Its hosted gates are
still running. Unit shard 4 failed with 11 blocking tests and three declared
TODO failures. Preserve that original; do not rerun unchanged or supersede the
candidate before its numeric authoring job has a retained terminal result.
The later askForNumber checkpoint `90fa84b` is on the source branch and is not
yet part of #1128. Refresh all remote heads before acting.

## Implemented and measured

- Readonly startup Number operands retain real cell/writer/dependency identities,
  initialization order and actual caller checks. Annotations grant no authority.
- Finite conditional Array entry and repeated publication frontiers retain the
  existing producer, all-writer and initialization checks. Closed SDK effects
  and ordinary calls can cross only their individually admitted boundaries.
- Reexported captures retain their actual overwrite and currentness proof;
  source statements, evaluation order and null assignments remain emitted.
- Frame-delta native addition uses the existing closed scene-clock proof.
  `game.askForNumber` supplies a Number only on its actual normal-return path.
  Neither rule supplies Array elements, exact input values or game completion.

The unchanged snake now has **zero source export refusals**, down from four;
its math queries still pass. This has not qualified its original SDK execution,
Lite runtime, connected editors or full game behavior.

The raw 184-input import census remains **147 translated / 36 partial / one
parse failure**. The separate export census, using the actual imported artwork,
is **124 clean / 22 refused / 36 import-partial / one exception / one timeout**.
Earlier export reports with missing artwork are superseded and retained.
These source classifications are not app-completion counts. All 22 refused
exports include a native-addition refusal; 11 also involve a Sprite property
whose complete receiver/use invariant is not proved. Do not assume one fix
will close every row.

## Current repair queue

1. Classify the terminal originals for the current #1128 head once. Shard 4
   exposes native-addition refusals in Array callbacks, class inheritance,
   discarded projectiles, field staging, generated Images and sprite extensions,
   plus a bitwise producer refusal. Keep the original assertions and repair
   producer evidence rather than adding opcode/name allowlists.
2. Reconcile the old frame-delta negative with the actual new supported contract:
   test canonical frame reads positively and retain shadowed/replaced/escaped
   context negatives and source-mutation revocation. The isolated continuation
   includes this test repair; it has not been run on the shared server.
3. Merge the claim in [#1482](https://github.com/CrispStrobe/brickwright/pull/1482)
   before implementing known `controller.moveSprite` reference retention.
   Preserve actual receiver allocation, speed Number/readiness, all writers,
   namespace ownership and construction-before-use. Qualify an independently
   authored controller/property program through direct and JSON export, Code,
   repeated import/export and actual hosted SDK/Lite controller input. Unknown
   escapes, opaque speeds and unsafe lifecycle paths must remain refused.

### Newly retained integration failures

The admitted failed jobs all belong to #1128 head `7ef0dacc` and run
`40469189304`. Their logs are retained once by the integration owner. Reuse the
retained originals; the public links identify the jobs without requiring
private operational details.

| Shard | Original job | Blocking tests | Declared TODO failures |
| --- | --- | ---: | ---: |
| 2 | [122078179870](https://github.com/CrispStrobe/brickwright/actions/runs/40469189304/job/122078179870) | 20 | 2 |
| 3 | [122078179967](https://github.com/CrispStrobe/brickwright/actions/runs/40469189304/job/122078179967) | 13 | 10 |
| 4 | [122078179880](https://github.com/CrispStrobe/brickwright/actions/runs/40469189304/job/122078179880) | 11 | 3 |

Counts include nested tests and are failure diagnostics, not corpus rows or new
app regressions. Other jobs are still pending and must be classified separately.

Unit shard 2 additionally exposes five browser-shard inventory/mapping failures
and producer refusals. The browser matrix and `test/ci-browser-scope.test.mjs`
belong to the Robot Lab shard lane; coordinate that owner before changing them.
Main has not independently repaired them at this checkpoint.

Unit shard 3 includes an actual failure in
`test/makecode-startup-number-roundtrip.test.mjs`: the original SDK phase passes,
but the native generation check observes `result = 0` instead of `14`. The
original failure remains open. The continuation reports runtime/Creator errors
before value assertions and labels initial/generation/same-VM/fresh-VM routes;
it retains every expected value and existing execution bound. Qualify this
with the existing hosted gate, identify whether the cause is current connected
producer admission, execution or callback entry, and repair that actual boundary.
Do not replace the expected value, add a delay, waive the test or promote the
representative on source-only evidence. Its sibling conditional-Array test must
also retain its independent original/native and reopen checks.

No builds or suites run on the shared server for this continuation. Use hosted
CI or an approved build machine. Do not add full-CI labels, duplicate dispatches,
Ready cycles or unchanged retries. The ordered qualification below remains
required before reporting app or GUI completion.

## Ordered tasks

1. **Qualify the complete integration.** The first normal main composition is
   already published at #1128 head `7ef0dacc`. Let its admitted runs finish,
   retain terminal originals once and repair their actual failures. Normally
   compose later source checkpoints and fresh main only after that intake. Keep the
   existing CI scope; do not add a full-CI label, duplicate dispatch, Ready cycle
   or unchanged retry. Inspect every enabled exact-head result. Preserve original
   failures and terminal numeric intake before any successor. Merge only after
   every enabled check succeeds or has its declared skip; use matched head and
   verify predicted/reviewed/landed tree and ordered parents. Never substitute
   the source tests above for SDK/native/browser qualification.
2. **Qualify the new representative programs.** Run the hosted-only
   `test/makecode-startup-number-roundtrip.test.mjs` and
   `test/makecode-conditional-array-roundtrip.test.mjs` with the pinned original
   SDK and actual Lite VM. Each covers both equal export routes, three native
   generations, callback-only witnesses and same/fresh VM SB3 reopen. They are
   written and syntax checked, not yet hosted passes. Retain original SDK/native
   observations and diagnose failures without changing expected values/budgets.
3. **Extend SDK effect framing.** Claim the boundary before adding new files.
   Integrate explicit effects with `project-conditional-array-entry.js`, keeping
   runtime implementations unchanged. Screen operations mutate Image/renderer
   state but require owned receivers and closed arguments. Music can yield and
   report errors. Splash pushes scenes, runs scene handlers and suspends for
   input; cancellation can resolve waits. Game over can stop and restart the
   program, invalidating Array epochs. Model normal/abrupt/suspended continuation,
   callback interference and ownership. Do not merely whitelist these opcodes or
   carry a prior Array certificate across a restart.
4. **Add ordinary value/parameter calls.** The actual retained helpers include
   `encode`, `inSnake` and `isEdge`. Work in the conditional-entry module and its
   actual authority bridge. Validate definition/call/prototype and linked
   argument identities, evaluate arguments in original order, bind fresh formal
   cells, and propagate explicit normal returns. Existing call records establish
   identity, not argument domains. Parameter annotations, metadata, dormant
   callers and provisional recursion must not supply values or initialization.
5. **Prove loop and repeated-publication preservation.** Establish a genuine
   startup constructor base, then an independent every-path invariant for later
   writers and normal loop continuations. Include zero iterations, exceptions,
   aliases, callbacks, Stop and changed epochs. Do not relax the current stable-
   writer guard on the strength of inferred Array types or an `initialized()`
   recursion shortcut. Reobserve the complete unchanged snake after each repair.
6. **Prove element presence and native addition separately.** Array readiness
   does not establish `items[0]` or `items[1]`. Model real unshift/pop order and
   every shrink/writer before transporting primitive head values into addition.
   Preserve Undefined/object/BigInt/coercion and mixed-writer refusals; retain the
   original expression evaluation. A successful source export is not a game.
7. **Close connected editor acceptance.** In Blocks and Code, author and edit
   the same startup dependencies, branch, calls and Array operations; inspect
   diagnostics at their real blocks. Run and steer an actual game through the
   controller pane, edit its imported artwork, export/reimport, and save/reopen
   in a fresh context. Use the GUI ledger for remaining graphics, tiles, assets
   and authoring gaps. General hygienic local/formal allocation is still a
   separate formatter task; the current issuer refuses ambiguous spellings.
8. **Reassess corpus completions.** Keep all original bytes and the denominator.
   Measure recovered complete contexts separately from raw snippets; never invent
   missing assets, dependencies or source. Preserve original compiler rejections
   of invalid/incomplete inputs. Count a completion only after genuine conversion,
   original/native execution and required roundtrips, retaining what was and was
   not observed. Then continue the handoff's ordinary-callee, map/Throw and other
   remaining work packages.

## Working rules for the successor

Use an isolated owned worktree; never reset, stash, clean or force-push another
worker's tree. Check current claims and collaborators first. Complete the existing
candidate within its merged scopes; claim broader implementation boundaries
before editing them. Batch related source fixes, run bounded focused tests and
nonvacuous guard cuts, and preserve failures. Source tests use real importer,
Creator, immutable snapshots and current public export APIs. SDK/native/browser
work belongs in the approved hosted qualification environment, not a heavy local
build. Acquire each admitted official log/artifact once and reuse saved originals.
Do not weaken assertions, thresholds, source-currentness fences or diagnostics.
Keep implementation, runtime, visible-editor and corpus-completion results
separate. No physical-accuracy, hardware, release or licensing conclusion follows
from this checkpoint. The overall compatibility goal remains unfinished.
