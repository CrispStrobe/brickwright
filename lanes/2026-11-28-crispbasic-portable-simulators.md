# CrispBASIC portable simulators and source round trips

- Owner: ChatGPT, continuing CrispStrobe's CrispBASIC feature-branch incubation.
- Base: `f574791` on `feature/crispbasic`.
- Branch: `feature/crispbasic-portable-simulators-20261128`.
- Status: complete and qualified at `59f079bfa0b890a37701334a1de36f0a9b115458`; all seven hosted runtime/integration/production jobs passed, with 900 passing test executions and no failures or skipped tests. Incremental commits are preserved on remote feature branches.
- Scope: verified portable GPIO profiles in the owning `bw-board` repository;
  reversible CrispBASIC/pseudocode source conversion in `sb3-creator`; exact
  consumer pins and mirrors; GUI-owned BASIC circuit, canvas and conversion
  integration; focused executable examples and qualification. Standalone runtime
  portability is developed on a separate feature branch before integration.
- Qualification: real registered controller/solver behavior, supported source
  round trips and rejection cases, editor ownership and rendering, native/WASM
  runtime checks where the corresponding toolchain is available, and the
  existing hosted CrispBASIC workflow. The final results are recorded in the
  [closing qualification receipt](../docs/CRISPBASIC-PORTABLE-QUALIFICATION-20261128.md).
- Boundary: electrical host simulation is distinct from executing an interpreter
  on an emulated controller CPU. Physical hardware and new CPU firmware targets
  will not be advertised without direct execution evidence.

The user explicitly requests incremental saves to GitHub feature branches. This
continues the branch-only exception in the preceding CrispBASIC claims; neither
claims nor implementation are merged into repository default branches.

## Implemented increment

- Adopted `bw-board@8be0fbc8e91f1ed2cebb26883210efceef9234cc`: 16 verified
  controller profiles with exact logical terminal maps and named-model nominal
  voltage checks.
- Adopted `sb3-creator@2c991d9a590d189eaad66c96951d4815a9f34e29`: explicit
  reversible source subset, persistent runtime requirement, strict refusal
  boundaries and shared target pin maps.
- Integrated native Linux ARM64, explicit Node/WASM CLI and strict simulation
  fixtures from runtime commit `597fc385277769c10c9c5791081b19002e638b6f`.
  Native Linux x64/ARM64 and portable Linux ARM64/macOS ARM64/Windows x64
  execution pass at that runtime checkpoint.
- Wired editor/CLI conversion, direct MakeCode refusal, controller inventory,
  canvas origins/geometry/text and real H-bridge/DC-motor physics example.
- Local complete integration: 292 checks; real focused Chromium: 14 scenarios;
  exact compiler pin/localization checks: nine. No failures or skips.
  See `packages/crisp-basic/VALIDATION.md` for the distinct qualification scopes.
- Final integrated hosted run [46125708968](https://github.com/CrispStrobe/brickwright/actions/runs/46125708968)
  passed native Linux x64/ARM64, shared WASM, portable CLI on Linux ARM64/macOS
  ARM64/Windows x64 and all 12 complete production-editor scenarios. The same
  12 production scenarios also passed independently in a full local build.
- Final compiler producer run [46125404430](https://github.com/CrispStrobe/sb3-creator/actions/runs/46125404430)
  passed all 375 tests. Board-profile qualification passed 94 focused tests.
  The adopted board commit also passed ordinary repository CI in
  [run 46123632767](https://github.com/CrispStrobe/bw-board/actions/runs/46123632767);
  its four optional vector/corpus jobs were skipped.
- Full CAD/world coupling and native MCU interpreter firmware remain outside
  the implemented increment; existing exclusive clock ownership is retained.
