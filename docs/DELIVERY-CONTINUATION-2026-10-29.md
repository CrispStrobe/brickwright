# Delivery continuation, 29 October 2026

This is the current public entry point. Earlier handoffs are historical where
they disagree. This is a continuation, **not a completed-delivery statement**.
The private coordinator handoff supplies the working clones, retained evidence
and local patch locations. Preserve other owners and read their current claims.

## Checkpoints and the immediate blocker

- Public delivery PR [#1555](https://github.com/CrispStrobe/brickwright/pull/1555)
  had product checkpoint `4fd045d0bea9b22a4c5259768a2e5df54a6a7df2` before this
  documentation update. It retains #1508/#1535/#1539/#1541, five proposed
  promotions, explicit motor compatibility and editor follow-ups. Its earlier
  bounded sound/History production checks pass; it has not landed on main.
- Local coordinator branch `integration/sound-menu-preflight-20261029` has
  product checkpoint `01f7d531074d625c6b014b4edb3dfe09d97f2cdf`. It normally
  composes Circuit source `2e7846f8a901726a296e3a8ef006cff24bc457b5`, retains both
  sound/menu cleanup paths, disables destructive shared-menu actions while
  busy and ignores already-handled document shortcuts. These local changes are
  not yet in the public delivery branch. They pass 79 focused controls, 179
  source checks, canonical sound-container lint, boot and the real production
  global-Undo browser gate, including Escape preserving the audio selection.
- **P0 blocks promotion.** The local full five-model receipt at `01f7` says all
  11 stages PASS, but its Chromium/WebKit calls dispatch **zero** journeys for
  the five requested IDs. Each browser log ends only `PASS no page errors`.
  Keep that receipt unchanged as evidence of the bug. Its 277 construction and
  27 native-motion/negative checks are valid bounded evidence; it is not model
  browser acceptance. The private kit promotion helper is locked against use.
- Circuit [#1536](https://github.com/CrispStrobe/brickwright/pull/1536)
  is owned elsewhere, last observed frozen at `2e7846f8a901726a296e3a8ef006cff24bc457b5`.
  Its current exact-head qualification is pending. Predecessor `d32860b8` had
  build and five unit shards green, one genuine stale-wiring test failure;
  those results do not qualify its successor. Claim amendments #1559 and #1563
  merged under explicit claim-only exceptions, not product-code waivers.

## Standing decisions

- No `ci:full` label on PRs. Require the actual final fast build and all six
  unit shards plus the lane's other enabled gates. The usual unlabelled
  `full CI requested` signal does not waive a genuine failure. Main's full run
  remains required after landing. Do not rerun an unchanged failing source.
- Normal pushes, explicit path staging and normal reviewed merges. Preserve
  source histories, other owners' branches/worktrees and original evidence.
  Register a claim on remote main before new implementation; previous narrowly
  approved claim exceptions do not automatically cover another claim.
- The motor choice is decided: absent declaration means `legacy`; explicit
  `0 !BW MOTOR_DIRECTION motor-frame` opts into the corrected motor frame.
  Do not re-ask or apply the old global fix that broke 23 behavior tests.
- Models, programs, fixtures, judges, physical tolerances and scientific study
  seals stay held. Do not change them to make a gate green. No model-API reset,
  initial-state replay, extra arm job, release or device action is authorized.
- The user will test the iPad later. History persistence remains deferred.

## P0 — repair model browser dispatch and coverage admission

**Owner:** next coordinator, after registering the exact repair scope. Can be
worked on while Circuit CI queues; preserve its writer and originals.

**Files:** `scripts/verify-sim-lab-browser.mjs`, the narrowly necessary real
Robot Lab browser helper, `scripts/qualify-robot-lab-models.mjs` and bounded
routing/qualification tests such as `test/robot-lab-ci-examples.test.mjs`,
`test/robot-lab-qualification-runner.test.mjs` and
`test/robot-lab-qualification-identity.test.mjs`. Record any additional path
in the claim before editing. No model/judge/fixture/tolerance changes.

**Observed defect:** the qualifier passes
`--part=examples --examples=high-select,final-squeeze,tipline,twistspan,swayshift`.
The browser runner filters routes with `runExample`, but none of those five IDs
has a route. Its final page-error assertion accepts this empty execution.
Neither the optional `fixed-machines` route nor the nine-intake routes covers
these five. A generic success line or a model-select click is insufficient.

**Implement:** real shipped-UI model/program journeys for all five IDs, retaining
meaningful model-specific observations. Reject unknown IDs, explicit empty
filters, zero completed journeys and partial requested coverage. Mark an ID
complete only after its journey succeeds. Emit source/build-bound requested
and completed ID sets and per-ID evidence separately for Chromium and WebKit;
require exact five-unique-ID coverage in both stages. Preserve older routes.

**Verify:** a regression must reject the old zero-match behavior, known+unknown
filters, a skipped one of five and generic page-error-only success. Then freeze
and run a new output directory with Node 22:

```sh
NODE_ENV=production NODE_OPTIONS=--max-old-space-size=2560 node scripts/qualify-robot-lab-models.mjs   --models=high-select,final-squeeze,tipline,twistspan,swayshift   --mode=full --out=/new/unique/evidence-directory
```

**Done when:** all 11 real stages pass, every requested ID has actual completed
proof in both engines, source identity is unchanged and the promotion validator
rejects old/missing/zero/partial coverage. Never edit the old `01f7` receipt into
success. Audit retained older targeted receipts for this same dispatch gap;
coordinate existing promotions with their owner instead of silently demoting
or replaying historical studies. The editor browser gate cannot fill this gap.

## P1 — return Circuit/paint work to its owner

**Owner:** #1536 maintainer; coordinator coordinates and supplies tests.
Read [the paint patch return](https://github.com/CrispStrobe/brickwright/pull/1536#issuecomment-6496620103)
and [the bounded FPGA return](https://github.com/CrispStrobe/brickwright/pull/1536#issuecomment-6496282204).

The paint proposal changes only both PaintEditor container mirrors and existing
`test/paint-editor-menu-bridge.test.mjs`: a bound native key wrapper ignores
handled events, forwards other events to current props and removes exactly the
registered wrapper. Its five source tests pass; the original listener forwards
handled Escape. Paint browser acceptance remains outstanding. Do not modify
the upstream shortcut HOC, take over the branch or claim a paint browser pass.

The FPGA four-suite result is 102 component/source checks under passive
fixtures, with source binding to the owner's `2e7846` paths. It is not actual
Build/Simulate, synthesis, hardware or whole-head acceptance. The owner added
real reduced-mode Design → Build → Simulate → Design checks and must qualify
that driver on the final source, alongside its required full application and
profiling gates. Do not acquire the official originals twice or repeat an
unchanged dispatch. Resolve the paint feedback with the owner before treating
relevant editor behavior as complete. Done means actual final source gates and
owner-qualified landing, not a fixture-only or predecessor success.

## P2 — integrate the local coordinator fixes without losing ownership

**Owner:** next coordinator, on the existing owned delivery worktree/branch.
First compare the public PR head, remote branch, main and the local preflight.
Private instructions identify all three owned worktrees; do not create a fourth.

After #1536's actual qualified source lands, normally merge the latest owned
public delivery head into the local preflight if needed, then normally compose
qualified main. Keep the public delivery head as an ancestor before pushing
that branch normally to `delivery/robot-editor-compat-20261029`. Never push to
Circuit's branch or cherry-pick its large merge as a replacement for main.

Retain both sound/menu unmount guards, busy/selection menu conditions,
handled-key guard, six actual menu-registry tests, the two-line existing owner
sound-fixture adaptation, and the strengthened real browser gate. Resolve any
new conflicts manually using actual current sources; older patches are not
blindly applicable to a changed owner head. Preserve all existing assertions.

Run the current focused History/project/artwork/sound/mirror/boot/claim tests,
owner menu fixtures and scoped lint with Node 22/canonical dependencies. Build
production and run `scripts/verify-boot-payload.mjs` and
`scripts/verify-global-editor-undo.mjs`. The latter must preserve all previous
journeys, real sound buffers, busy/recovery checks and the selected audio range
after menu Escape. P0 and fresh final-source model coverage are required before
this candidate is eligible to merge. The old local build is bounded evidence.

## P3 — land the delivery and update the kit

**Dependencies:** P0, owner-qualified P1/main and final P2 composition.
Require a clean frozen source and a new full five-model receipt with real
coverage. Require fresh final-head hosted build and six unit shards green.
Merge #1555 normally with an exact matched head; verify actual parents/tree,
then observe the actual merged main full run, including its selected browser
and FPGA jobs. A superseded green run with skipped required jobs is insufficient.
If main/source changes, review the actual delta and requalify as needed.

Only then release the private promotion-helper lock after adding coverage
validation and its rejection tests. Dry-run/review the exact main/source/run
bindings. Update two existing kit statuses (`high-select`, `final-squeeze`) and
add the three missing metadata rows (`tipline`, `twistspan`, `swayshift`). Keep
comparison entries experimental. Validate the committed kit tree and push
normally; no private Actions. Close #1460 with delivered compatibility evidence
only after it is actually delivered. Evenhand still needs a torque-based judge;
RimRun still needs its hub mounted and its own failed finish/hold gates repaired.
Their scientific details remain in the older dated handoff.

## P4 — resume the arm only with the required gates and authorization

**Owner:** coordinator; no builder or arm job is running. Runs 16–18 were audited.
The retained main005 original topology gate is **FAIL7**. A read-only frozen
primitive audit identifies link1 overlap with the rotor in motor B's moving
body, not its stator boxes; it does not prove physical clearance or buildability.
Nine of ten accepted jobs are used. Controls 008/009 failed the actual endpoint
frame; the cold repeat is not completed. Do not spend the remaining job by
assuming budget approval, or change the ledger/old results.

First propose a real mechanical revision and obtain any needed new-main scope;
require fresh topology/construction acceptance without ignoring overlaps. Then
obtain the explicitly needed job budget for corrected control and cold repeat,
keeping the original history. Only a meaningful passing control plus independent
cold repeat makes the package submittable. Never reset/replay the API state.
The worker remains `696f00761`; it does not qualify new motor-frame models.

## P5 — deployment, device and other owner lanes

| Lane | Exact next action and completion boundary |
| --- | --- |
| #1507 Vercel policy | Wait for the workflow owner's explicit review; compose qualified main and revalidate the monotonic newest-validated-main policy before a normal merge. Deployment execution remains with its owner; confirm a real deployed version only after authorized publication. |
| #1553 native rotor / #1557 onset / #1564 Twinpoint | Preserve the active owners. Read their current source-bound consumer failures; the shorter pivot pin and first-completed-step proposals are separate qualifications. Do not tune masses, solver, programs or bounds, copy old successes, or adopt an unqualified package. Requalify affected models after any actual qualified pin change. |
| #1554 Arcade | Preserve its owner. Number-returning SDK calls (including music.tempo) and SDK callback Sprite are approved. General index reads/user-function results have no new ruling. Fix within approved semantics or ask for that specific decision; corpus/unit failures remain real gates. |
| #1540 x86 V10 | Preserve the owner and strict V8/V9 readers. Typed V10 regular-file-or-exact-symlink observation is approved. Require new source-bound qualification; do not arm/replay an old gate. No exception for four historical cancellations exists without exact run/reason audit and explicit approval. #1318 is superseded, not a reusable receipt. |
| #1562/#1565 SAMD | Preserve the owner; distinguish source landing, enabled-check closure and the separately claimed debugger route. Complete their published claim and actual route acceptance; no native release follows automatically. |
| Other model/engine lanes (#1510/#1537/#1542/#1543/#1549/#1550/#1551/#1440) | Remain with their owners. Read current PR/claim and retained evidence before coordination; do not fold active scientific or engine work into this delivery just to reduce PR count. Their exact enabled checks and stated model/source gates remain mandatory. |
| iPad/editor | User tests T1 later; T2 only if a real palette crash is reported. T3/T5/T6 code is in delivery candidates, not a new shipped build. T4 persistence is deferred. T7 keeps Brickwright's chosen icon and refreshes listings before any later release. Ask before release/App Store Connect/TestFlight; no such step is authorized here. |

#1477 is closed after five observed successful main Builds following #1486.
SPIKE #1513 and editor handoff #1527 merged. Preserve the existing device test
server/worktree until the user says testing is finished. No automated cleanup
should remove another owner's tree or a source/evidence artifact still needed.
