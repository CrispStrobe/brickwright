# KIM-1 in Circuits

- Owner: KIM-1 Circuits implementation lane (`feat/kim1-circuits`).
- Status: CLAIMED.
- Date: 2026-11-25.
- Base: Brickwright `8e2c4c407205e687ea4330369a40c5fef7e39319`.
- Isolation: dedicated feature branches and selected-file working copies; no shared checkout edits.
- Scope: `bw-board` KIM-1 NMOS CPU profile, independent monitor, mapped RAM/6530 I/O and timers, registered system device, focused tests and provenance; `bw-circuit-ui` KIM-1 palette/art/panel/controls/examples and integration tests; Brickwright exact supplier pins, lockfiles, mirrored examples and focused qualification. No proprietary monitor ROM or GPL/NC implementation/asset reuse.
- Qualification: real 6502 program execution, keypad/memory/reset behavior, digital port interaction with circuit nets, timer semantics, persistence, and browser interaction checks. Record actual results and limitations before completing the lane.
- Research boundary: a research-only agent supplies factual behavior and licensing notes; implementation agents do not receive incompatible source code, ROM bytes or artwork.
