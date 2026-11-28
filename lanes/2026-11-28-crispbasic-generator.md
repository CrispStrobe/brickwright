# CrispBASIC portable generator boundary

- Owner: ChatGPT, continuing CrispStrobe's CrispBASIC incubation.
- Base: `dd10d0af2a2230ec6b474cf7ee99e91f42c93004` on `feature/crispbasic`.
- Producer base: the existing `sb3-creator` pin,
  `1c29f69fd22c86ecb0051938eedb246921cb3b88`.
- Adopted producer: `0b2224b75baa6492fcc77118a54780174b116f42` on
  `feature/crispbasic-generator`; hosted run `46104135534` passed 299 tests.
- Scope: the producer's opt-in BBC generator and BASIC reader, their direct
  callers and qualification; its exact pinned consumer sync; the Code tab's
  explicit generation choice and refusal handling; focused runtime/browser
  tests and the CrispBASIC documentation.
- Status: DONE and qualified on the incubation branch. Implementation
  `73370eb148c8833b20e464e5576f1e33b206c386`; no merge to either default branch.
- Qualification: producer hosted run passes 299 tests; consumer
  [run 46104769080](https://github.com/CrispStrobe/brickwright/actions/runs/46104769080)
  passes 544 tests, including all ten complete production Chromium scenarios.
  The separate BASIC oracle run `46104769121` passes nine fixtures. The pinned
  consumer passes 176 integration tests, 10 identity/mirror/SPIKE tests and
  27 editor-ownership tests locally; the complete local production build passes.
  Official source sync, provenance, mirror checks and flagged JSX parsing pass.
- Delivery: default and retro generation remain legacy;
  portable digital/timing operations require an explicit mode. Toggle and
  unsupported operations refuse. Live portable calls cannot yet return to
  blocks without losing semantics, so that path refuses before project mutation.

This continues the existing branch-only incubation instruction recorded in the
2026-11-27 CrispBASIC claims. Neither repository's default branch is changed.
The producer branch starts at the consumer's existing pin deliberately. Its
gallery reconciliation preserves the consumer's existing Microtronic entry
using the already-published producer bytes from `312fa6b0feb72fd18fef8a6b865f708642acad9f`;
no consumer examples change. Other upstream gallery/runtime changes remain
outside this adoption. The complete producer range is reviewed and qualified;
both transformed mirrors and derived provenance match the exact adopted pin.
