# Code worker ownership and JavaScript plan — 2026-11-27

Status: CLAIMED.

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
