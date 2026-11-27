# Owned JavaScript console tasks — 2026-11-27

Status: IMPLEMENTED — published draft checkpoints; hosted qualification and
coordinated supplier adoption remain blocked. No runtime code has landed on main.

Owner: Code execution continuation maintainer, continuing the repository owner's
runtime/export request and PR #1855. Branches:
`codex/code-worker-ownership-2026-11-27` (consumer) and
`codex/javascript-owned-console-2026-11-27` (supplier).
Work uses separate isolated repository checkouts and guarded non-force publication.

Bases: Brickwright main `d787866d8662bb6aab07253643ea7a6edb56fcce`,
runtime candidate `18113510b7f1ac9f78d4bc8b744406b42136427f`,
sb3-creator main `682e462914a22947b196858e5687800521b368e8`.

## Scope and package boundaries

- In sb3-creator: `src/utils/sb3Creator.js`, a new
  `test/javascript-owned-console.test.mjs`, and
  `docs/JAVASCRIPT-OWNED-CONSOLE.md`. Add an explicit opt-in, versioned
  generated-console task contract. Preserve default generated output and reader
  behavior. Own flag/procedure completion, asynchronous input and finite waits;
  reject unsupported event/persistent lifecycle constructs.
- In Brickwright: `overlay/scratch-gui/src/lib/code-execution-workers.js` and
  its tracked application mirror; focused task tests under `test/`;
  `scripts/probes/code-runtime/` for real production worker qualification;
  the runtime/export plan and these two Code-runtime claims for evidence.
  The owned session module and its mirror may change only if needed to enforce
  task/input lifetime and bounded transport.
- The consumer runner may expose the versioned task API now. Generator adoption
  and Code-tab opt-in plumbing wait for a qualified upstream revision and
  coordinated normal pin adoption. Do not edit vendored generator copies.

This is the explicitly scoped follow-on to the earlier claim's excluded shared
emitter work. No gallery files, HDD controls, device/simulator adapters, dependency
pins, workflow gates, or separately owned Microtronic adoption paths are claimed.

## Qualification and landing

Exercise the actual generator and production worker: concurrent/nested task
completion, rejection, owned input and delays, Stop during input/CPU work, output
limits and fresh restart. Prove regressions fail without ownership. Preserve
legacy source/worker controls and normal mirror checks. Keep synchronous prompt
replay separate from task ownership. Report worker evidence separately from the
rendered app, native WebViews, simulator/game semantics and playable exports.

Supplier behavior must land and qualify upstream before normal consumer pin
adoption. The existing gallery and HDD-control failures remain real landing
blockers, already owned by PR #1846 and its source/controls claims. Do not waive
or rerun unchanged failures.

## Implementation and observed evidence

The supplier adds opt-in `owned-console-v1` generation with scoped flag/procedure
APIs and explicit console-subset admission. The consumer owns registered task
lifetimes, per-task input/delays, failed-scope cleanup and an input responsiveness
watchdog. `spawn` returns no join handle; sequential calls retain their task API.
Unawaited owned resources, completed scopes and work continued under the same
scope's pending input fail explicitly. The original generator/pin/UI selection
remain unchanged in the consumer.

- Consumer focused controls: **139/139 pass, no skips**.
- Supplier owned-console/codegen/roundtrip controls: **193/193 pass, no skips**.
- Existing source compatibility: **240/240 byte-identical generated outputs**.
- [Actual production-worker/browser receipt](../scripts/probes/code-runtime/session-task-browser-results.json):
  **38/38 pass, zero page errors**, including three actual generated programs.
- Negative controls detect removed input-watchdog termination, removed registered
  task waiting, and a missing generated procedure owner argument. The earlier emitter failed the new task
  contract controls while preserving the ordinary default-generation control.

### Boolean values and default-worker CSP continuation

The supplier's admitted comparison/Boolean reporters could disappear as
`undefined` in ordinary value sockets. The owned-only correction is published at
[`cbdf1791`](https://github.com/CrispStrobe/sb3-creator/commit/cbdf179160a3f3054872d045503659967bd1b72e).
All eight new executable controls fail against the prior emitter; the corrected
focused suite passes **201/201**, including **44** owned-console cases. Existing
outputs remain byte-identical: **240/240** corpus outputs against the original
baseline and **84/84** outputs from the 14 new graphs under six legacy options
against `c7584fd0`, including generation after owned mode on the same instance.

The [39-case successor receipt](../scripts/probes/code-runtime/session-console-values-browser-results.json)
passes with zero page errors against that published supplier. It retains the
actual SB3 graph and generated source for the Boolean-value regression. The
consumer production sources are unchanged and its **139/139** controls pass.

The [new default-factory CSP receipt](../scripts/probes/code-runtime/session-csp-browser-results.json)
passes **16/16** cases and **2/2** enforced-policy negative controls, with zero
page errors. It uses the production Blob-worker factory under real HTTP CSP:
permitted execution/input/Stop/output limits and explicit worker/eval denial,
resource cleanup and fresh recovery. This is localhost browser evidence, not a
rendered application, deployed-header or native-WebView qualification.

The runtime checkpoint `b875bc6b` has the same separately owned
[gallery](https://github.com/CrispStrobe/brickwright/actions/runs/45965021137)
and [HDD-control](https://github.com/CrispStrobe/brickwright/actions/runs/45965021191)
failures assigned to PR #1846. Supplier checkpoint `c7584fd0` passed all 36
original owned-console controls in its hosted shard, but that shard failed the
RF mixer test with **1170.569 Hz versus 5830 ±600 Hz**, exactly matching its
[baseline failure](https://github.com/CrispStrobe/sb3-creator/actions/runs/45836555459/job/139966847463).
The RF repair is separately owned as recorded in supplier PR #244. Successor
hosted runs must qualify their own heads; earlier partial or cancelled runs do
not qualify them. No unchanged CI rerun, gate relaxation or pin advance is part
of this continuation.
