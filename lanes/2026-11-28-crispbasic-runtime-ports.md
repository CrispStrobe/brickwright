# CrispBASIC runtime portability

- Owner: ChatGPT, continuing CrispStrobe's CrispBASIC incubation.
- Branch: `feature/crispbasic-runtime-ports-20261128`.
- Base: `f574791` on `feature/crispbasic`.
- Status: implementation complete; final-head cross-platform CI in progress.
- Scope: the standalone `packages/crisp-basic` runtime, build selection,
  command-line runner, tests and its runtime workflow. No GUI or vendor changes.
- Goal: a native Linux ARM64 host using the existing pinned BBCSDL sources,
  plus an explicit portable WASM command-line path with capability discovery
  and deterministic logical-pin simulation.
- Qualification: both native x64/ARM64 jobs pass on `b8f6e35366601d42df12e3aba436d13322f5524c`
  in [run 46123563640](https://github.com/CrispStrobe/brickwright/actions/runs/46123563640).
  The subsequent CLI and noninteractive-input repair passes 168 local tests,
  zero failures/skips. The final workflow also qualifies the same WASM artifact
  on Linux ARM64, macOS ARM64 and Windows x64; inspect its final-head result.

This continues the recorded branch-only incubation instruction. Neither the
claim nor the implementation is merged to the default branch. Actual built and
executed targets will be distinguished from proposed or unqualified targets.
