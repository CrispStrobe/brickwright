# CrispBASIC portable simulators and source round trips

- Owner: ChatGPT, continuing CrispStrobe's CrispBASIC feature-branch incubation.
- Base: `f574791` on `feature/crispbasic`.
- Branch: `feature/crispbasic-portable-simulators-20261128`.
- Status: in progress; incremental commits are preserved on remote feature branches.
- Scope: verified portable GPIO profiles in the owning `bw-board` repository;
  reversible CrispBASIC/pseudocode source conversion in `sb3-creator`; exact
  consumer pins and mirrors; GUI-owned BASIC circuit, canvas and conversion
  integration; focused executable examples and qualification. Standalone runtime
  portability is developed on a separate feature branch before integration.
- Qualification: real registered controller/solver behavior, supported source
  round trips and rejection cases, editor ownership and rendering, native/WASM
  runtime checks where the corresponding toolchain is available, and the
  existing hosted CrispBASIC workflow. Results will be recorded as they complete.
- Boundary: electrical host simulation is distinct from executing an interpreter
  on an emulated controller CPU. Physical hardware and new CPU firmware targets
  will not be advertised without direct execution evidence.

The user explicitly requests incremental saves to GitHub feature branches. This
continues the branch-only exception in the preceding CrispBASIC claims; neither
claims nor implementation are merged into repository default branches.
