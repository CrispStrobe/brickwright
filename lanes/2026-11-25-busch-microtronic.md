# Busch Microtronic 2090 in Circuits — DONE, 2026-11-25

Owner: Brickwright Microtronic implementation lane, requested by CrispStrobe.
Base: `22aa167b6146fc5235127746529f91d41b804795`.
Branch: `feat/busch-microtronic-circuits`; isolated checkout.

Own the coordinated `bw-board` and `bw-circuit-ui` package boundary, exact
package pins and derived identity/notices in Brickwright, focused host
integration tests, and Microtronic usage/phase documentation. Source behavior
belongs in the owning packages. Preserve all CP1, desktop, CAD and other lanes.

First phase: a clearly identified documented-behavior Microtronic learner
instruction model, shared Board simulation clock, genuine circuit input/output
connections, separate 1 Hz terminal, keypad/program/display controls, authored
artwork and persistence. Native TMS1600 execution and a cleanroom replacement
firmware remain a later phase. Do not import historical ROMs, manual artwork,
third-party emulator implementation or disassembly.

Qualify documented instruction behavior and invalid input handling, actual
input-to-program-to-output wiring, explicit clock jumpers, deterministic
scheduling, reset/program retention, independent instances, program save/load,
part geometry and real browser controls. Adopt exact tested supplier commits;
do not create a private app-side simulator fork. Preserve existing gates and
report any unavailable full-app or hosted qualification explicitly.

## Delivered

The upstream engine and UI provide a runnable learner-instruction model,
eleven circuit terminals, six-digit display, 24-key panel, program editor/file
loading, and a wired switch/LED/clock example. Execution uses the Board clock;
the 1 Hz terminal reaches an input only through an explicit wire. Circuit
save/open retains the program and wiring and restores a halted computer.

The consumer adopts Board `cc18f3c8d84d68e008450e65ddf838b8ec03c7f7` and UI
`0a1b15edb0daecd723c7c07126450d84b86e3e68`. Both installed package trees were
compared with their exact Git/npm-pack source bytes in the root and GUI
installations, including single-engine resolution. Source notices, generated
capability/census/matrix records, and static provenance follow those identities.
Existing CP1 machine-bench and debugger-restoration changes are preserved.

The pre-existing package-history failures reproduced on the preceding main
revision. Current workflow/adoption identities and the two explicitly live
historical-routing constants now follow the actual pins. Frozen epochs,
producer/reader bytes, profiles, receipts and negative assertions are unchanged.
The controller-only generator verified identical source/carrier bytes before
updating its receipt; static assets were re-admitted only after their retained
bytes and supplier sources matched.

## Qualification

- Engine implementation: 155 focused checks; independent documented-behavior
  vectors; combined upstream coverage preserved. Upstream full CI at the adopted
  Board commit passes test, vectors, corpus and vectors186 in one run.
- UI: focused Microtronic/CP1/transport/geometry/persistence checks and production
  Vite build. Its two existing test-reader failures were reproduced on incoming
  master and repaired without runtime or gate-exclusion changes; 140 adjacent
  checks and three meaningful negative mutations qualify the repair.
- Consumer: 55 focused host checks pass. The current-reference repair passes
  100 source/history/provenance controls and 38 installed-package contracts.
  The final combined head's complete pin-history gate passes 43 checks, scans
  14,163 files and reports no stale references or unreadable files.
- The complete Brickwright production build passes, along with emitted broker,
  source-notice, mirror and installed-dependency checks.
- Actual production-host browser acceptance passes all ten checks, with zero
  page errors or failed requests: palette placement, editor/file/keypad loading,
  real switch/LED nets, explicit clock feedback, halt/step/reset, draft retention,
  and actual File-menu save/open. Final screenshots were reviewed.
- The adjacent CP1 component fixture passes twelve checks and desktop/German
  narrow-layout review. It uses original synthetic 8049 firmware; this is not a
  claim of full-host native CP1 firmware qualification.

Upstream changes: [Board PR #768](https://github.com/CrispStrobe/bw-board/pull/768)
and [UI PR #174](https://github.com/CrispStrobe/bw-circuit-ui/pull/174).
Full engine evidence: [CI run 45688117968](https://github.com/CrispStrobe/bw-board/actions/runs/45688117968).
The consumer's hosted qualification attaches to this implementation head.

Current main's Microtronic gallery entry, CAD artwork and KIM-1 lane reservation
are preserved. Five inherited host CI source-reader failures are repaired in
the coordinated `2026-11-25-microtronic-host-ci-controls.md` lane. On the combined
checkout, all 529 focused debugger checks and 132 HDD/history/projection controls
pass without changing runtime behavior, workflow gates or historical seals.

Usage and reproducible checks are in `docs/BUSCH-MICROTRONIC.md`. Native TMS1600
execution, display scanning, cassette support and replacement firmware remain
the later phase requested by the user; this integration imports none of the
historical firmware or third-party emulator implementation.
