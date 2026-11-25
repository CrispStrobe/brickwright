# Busch Microtronic 2090 in Circuits — CLAIMED, 2026-11-25

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
