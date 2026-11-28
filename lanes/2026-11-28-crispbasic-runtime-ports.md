# CrispBASIC runtime portability

- Owner: ChatGPT, continuing CrispStrobe's CrispBASIC incubation.
- Branch: `feature/crispbasic-runtime-ports-20261128`.
- Base: `f574791` on `feature/crispbasic`.
- Status: implementation and qualification in progress.
- Scope: the standalone `packages/crisp-basic` runtime, build selection,
  command-line runner, tests and its runtime workflow. No GUI or vendor changes.
- Goal: a native Linux ARM64 host using the existing pinned BBCSDL sources,
  plus an explicit portable WASM command-line path with capability discovery
  and deterministic logical-pin simulation.
- Qualification: existing native corpus and lifecycle tests on x64 and ARM64;
  real WASM CLI behavior, input, diagnostics, limits and simulation traces.

This continues the recorded branch-only incubation instruction. Neither the
claim nor the implementation is merged to the default branch. Actual built and
executed targets will be distinguished from proposed or unqualified targets.
