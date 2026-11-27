# Code worker ownership and JavaScript plan — 2026-11-27

Status: IMPLEMENTED — hosted qualification pending; runtime code is held off main.

Owner: Code execution continuation maintainer, at the repository owner's request.
Base: `b819f8d9b52022484013f2a958cde0b9beb5a014`. Work uses an isolated checkout and guarded non-force
publication; concurrent changes must be preserved.

## Scope

- `docs/CODE-RUNTIME-AND-GAME-EXPORT.md`, `PLAN.md`, `ROADMAP.md`:
  add JavaScript execution across supported browser/WebView hosts, shared game
  runtime, source/web/PWA/native export distinctions and acceptance milestones.
- Owned Code tab component: generic Run/Stop/input/output ownership and source
  capture; delayed tab/option derivation fences. Preserve existing compile
  completion/editor ownership controls.
- New owned `overlay/scratch-gui/src/lib/code-execution-session.js` and, if needed,
  `code-execution-workers.js`; generated application mirrors through the normal
  overlay mechanism.
- New focused `test/code-execution-session.test.mjs`,
  `test/code-runtime-source-ownership.test.mjs` and browser execution probe.
  Existing touched-method fixtures may receive setup corrections without weaker
  assertions.
- This claim and the focused runtime plan record actual acceptance and remaining work.

Do not change board-model/applied-device helpers, SPIKE/NuttX caller ownership,
shared converter/emitter sources, vendor pins, app runtime dependencies or release
policy. The broader authored-document model, Pyodide/MicroPython adoption,
simulator bridge and game exporter remain separate follow-on milestones.

## Qualification

Exercise actual changed entry points with delayed conversions and lazy sources;
prove Stop before/during execution, no stale publication/input replies, bounded
live output, fresh recovery and cleanup. Preserve existing editor ownership and
device routing regression controls. Run a real browser worker/input/Stop probe
with the shipped worker/session source. Label source-level, worker-browser and
whole-app evidence separately. Supported-device and platform qualification is
not inferred from one server browser.

Existing examples-gallery CI drift remains recorded in the evaluation report;
no unrelated examples or gates are removed or relaxed in this lane.

## Implementation and evidence

The JavaScript chapter and linked PLAN/ROADMAP were published separately on main
at [`d787866d`](https://github.com/CrispStrobe/brickwright/commit/d787866d8662bb6aab07253643ea7a6edb56fcce).
The runtime candidate contains the shared derivation ownership fence, owned
console sessions, bounded streaming, inline input, explicit awaited JS work,
global/project Stop and rerun/VM/unmount cleanup. Tracked application mirrors
are included. Existing Pico routing and the labeled legacy interactive JS board
adapter remain unchanged; no new game/device/runtime acceptance is asserted.

Focused source qualification: **112/112 pass, no skips**, using:

```sh
node --test test/code-execution-session.test.mjs \
  test/code-runtime-source-ownership.test.mjs \
  test/code-tab-empty-target-after-failed-conversion.test.mjs \
  test/code-conversion-editor-ownership.test.mjs \
  test/code-tab-run-via-blocks.test.mjs \
  test/spike-code-caller-ownership.test.mjs
```

Before the derivation repair, 4 ordinary controls passed and 29 stale-publication
counterexamples failed. The existing empty-target test's missing `leaveCp1` and
VM fixture setup were corrected without weakening its assertions. New methods
and the edited JSX parse; the focused SPIKE test verifies the tracked component
mirror. Session tests include an actual busy Node worker terminated by Stop.

The [production browser probe](../scripts/probes/code-runtime/session-browser-probe.mjs)
records [19/19 passing cases and zero page errors](../scripts/probes/code-runtime/session-browser-results.json)
in real Chromium 158 with Skulpt 1.2.0 and no COI/SAB. Source hashes match the
candidate. These are worker/browser and source-method controls, not a complete
rendered application, production-CSP or supported-platform qualification.
Synchronous JS prompt replay preserves answers/randoms only; generated detached
async task ownership and the simulator bridge remain follow-on work.

## Landing status

The existing [vendor-freshness run](https://github.com/CrispStrobe/brickwright/actions/runs/45950936687)
fails only its examples-gallery step: stale index and three orphaned Microtronic
lesson files. Converter identity/transpiler steps pass. The exact gallery and
adoption paths are already claimed by
[the Microtronic integration lane](2026-11-25-microtronic-gallery-source.md) /
[PR #1846](https://github.com/CrispStrobe/brickwright/pull/1846).
This lane does not delete that lesson, duplicate its claim, advance its pin or
waive its gate. Keep the implementation candidate reviewable while that owner
qualifies the adoption and hosted candidate qualification completes.

### Continuation inspection

The remote `18113510` candidate's hosted checks confirmed the gallery failure in
[45956026910](https://github.com/CrispStrobe/brickwright/actions/runs/45956026910)
and three inherited HDD workflow identity-reader failures in
[45956027049](https://github.com/CrispStrobe/brickwright/actions/runs/45956027049).
The latter test/workflow bytes match main, and their repair is already owned by
PR #1846's `2026-11-25-microtronic-host-ci-controls` claim. They are not changed
here. The initial build census was incomplete; no successful overall qualification
is inferred.

The explicitly claimed
[owned JavaScript console follow-on](2026-11-27-javascript-owned-console-tasks.md)
adds scoped tasks and repairs the reproduced input-watchdog gap. Its 139 focused
controls and 38-case production-worker/browser receipt supersede coverage only
for those named sources and behaviors. Its required hosted qualification and
normal supplier adoption remain pending.

The next published continuation preserves those production sources, reruns all
139 controls, and records a 39-case generator/worker successor plus 16 real
default-factory CSP cases and two enforced denial controls. The supplier repairs
Boolean reporters in admitted value sockets with 201 passing focused controls;
the worker probe executes that exact published generator. See the owned-task
claim and section 8.2.1 of the runtime plan for receipts and the inherited
supplier RF failure. Rendered application/deployment and native qualification
remain open; these browser loading checks do not replace them.
