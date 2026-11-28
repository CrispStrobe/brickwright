# CrispBASIC first native runtime

- Owner: ChatGPT, working for CrispStrobe.
- Base: `a08f561f593d31b72671fa0c967b4f04c8c9637c` (`main`).
- Status: initial implementation complete on `feature/crispbasic`; not merged.
- Scope: `packages/crisp-basic/**` and `.github/workflows/crispbasic.yml`.
- Delivery: an isolated native BBCSDL batch host, source preparation and line
  maps, Node session API, CLI, pinned source hashes and notices, real runtime
  tests, examples, and an extraction-ready roadmap.
- Qualification: 54 standalone tests pass (13 source, 29 native runtime, 12
  CLI), with no skips. Seven repository workflow-shape/reference checks pass.
  Native source built locally with GCC 14.2 and NASM 2.16.03.
- Intentional boundary: Linux x86-64 trusted native execution. WASM, app/GUI
  integration, full graphics, source debugging, portable hardware procedures,
  physical targets and compilation for tiny devices remain future milestones.

The user explicitly requested incubation on a feature branch before creating a
separate repository. That branch-only instruction takes precedence over the
usual merge-claim-to-main step; no claim or implementation was merged to main.
The self-contained package owns no existing GUI/vendor package boundary.
