# CrispBASIC CAD clock and machine expansion

- Owner: ChatGPT, continuing CrispStrobe's requested feature-branch development.
- Base: `ed2f9f28bc9d956a72e2a8e173b6e3209f8a1e73`.
- Branch: `feature/crispbasic-portable-simulators-20261128`.
- Status: in progress.
- Scope: GUI-owned BASIC circuit/CAD clock coordination, editor integration,
  executable robot examples and qualification; exact adoption of independently
  saved `bw-board` and `sb3-creator` producer improvements; separately developed
  CrispBASIC runtime ports.
- Ownership: this lane owns `overlay/scratch-gui/src/lib/crispbasic-*`, their
  package mirrors, the CAD coupling adapter, BASIC controls, focused tests and
  the integration workflow. Runtime port work uses a separate branch and is
  incorporated only after review and execution tests. Board and compiler
  changes are made in their owning repositories before consumer pins move.
- Qualification: actual interpreter execution; deterministic electrical and
  mechanical clock/feedback tests; cancellation and stale-owner tests; source
  round trips; exact package identity; browser and hosted runtime qualification
  for the final integrated implementation.

The user explicitly requests incremental saves to remote feature branches.
This continues the existing CrispBASIC branch-only incubation exception: this
claim and its implementation stay on feature branches, with no default-branch
merge. Existing producer identity and mirror requirements remain in force.
