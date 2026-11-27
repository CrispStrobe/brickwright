# Code runtime and game export evaluation — 2026-11-27

Status: DONE — initial plan and bounded evaluation recorded; implementation remains planned.

Owner: Code runtime and game export evaluation maintainer, at the repository owner's request.

Base: `14de1c42bd2e2ea84086a2162d1eff1fdbbac20d`.
Work is prepared in an isolated source snapshot and published with a guarded,
non-force update of `main`; unrelated repository contents must be preserved.

## Scope

- `PLAN.md`, `ROADMAP.md`, and `docs/CODE-RUNTIME-AND-GAME-EXPORT.md`:
  record the Code tab review, runtime alternatives, acceptance criteria, and
  MakeCode Arcade / Scratch / pseudocode to Python + pygame export sequence.
- A focused evaluation report and, if executable qualification is available,
  a self-contained probe under `scripts/probes/code-runtime/` with its fixtures.
- This claim file records completion and evidence.

The initial plan lands before benchmark execution. Application code, vendor pins,
generated mirrors, importer/parser repairs, build/release workflows, and existing
Arcade import qualification are outside this lane. Shared converter work remains
upstream-first under `docs/VENDORING-REGIME.md`.

## Qualification

Review source-backed claims and links; preserve the existing plan and roadmap;
verify an atomic documentation-only diff and unchanged unrelated tree entries
before the first push. Any later probe records exact engine/source identities,
environment, commands, raw observations, and unmeasured cells. Host or headless
results do not qualify mobile WebViews or native standalone distributions.
No runtime or exporter implementation is declared shipped by this evaluation.

## Completion

The initial plan/roadmap landed first in
[`a29ac18c9e4a8789b6d58f8d5be4b5f034667627`](https://github.com/CrispStrobe/brickwright/commit/a29ac18c9e4a8789b6d58f8d5be4b5f034667627).
The same completion commit that updates this claim adds
[`docs/CODE-RUNTIME-EVALUATION-2026-11-27.md`](../docs/CODE-RUNTIME-EVALUATION-2026-11-27.md)
and the reproducible, isolated probes.

Evidence: pinned Skulpt/MicroPython/Pyodide Node and real headless Chromium runs;
preserved initial failures and a separately recorded browser input correction;
a pwasm host deadline/callback probe; eight source-pinned reader witnesses; and
a Linux pygame source/bundle comparison with all 24 state/frame records matching.
Independent review checked the report boundaries and probe interpretation.
Source/asset hashes, commands, raw observations and platform gaps are retained.

Application runtime code, vendors, dependency pins and release workflows are
unchanged. Source semantics, production execution adapters, real simulator/game
integration and device/OS qualification remain open under the linked roadmap.
No new interpreter mode, transpiler or downloadable game product is declared shipped.

