# CrispBASIC Brickwright integration

- Owner: ChatGPT, working for CrispStrobe.
- Base: `1421e7f65821bd15c9e6d710627959ae03e8f04a` on `feature/crispbasic`.
- Status: implementation complete on the incubation branch; not merged to main.
- Scope: `packages/crisp-basic/**`; GUI-owned CrispBASIC adapter, BASIC controls
  and VDU renderer in overlay plus their exact package mirrors; focused tests,
  packaging/integration scripts, build workflow and notices.
- Delivery: generated/edited BBC source execution, interactive input, bounded
  worker lifecycle, partial VDU rendering, verified asset packaging and a
  deterministic logical-pin host contract with no BASIC/board bridge.
- Local qualification: 54 new adapter/UI/packaging checks, 13 simulation-host
  checks, 41 existing editor ownership checks, 46 related localization/mirror/CI
  checks and 13 existing source-preparation checks passed. Full editor, renderer
  and browser-harness JSX parsed. Real-runtime/browser gates are in the dedicated
  workflow; inspect its result for this commit before claiming CI qualification.

The user requested continuation of branch-only incubation. This follows the
existing CrispBASIC claim's explicit exception to merging claims to main. No
upstream generator, board package, vendor pin or default branch is changed.
