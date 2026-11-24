# Kosmos CP1 implementation progress

Date: 2026-11-24. Branch in each owning repository: `feat/kosmos-cp1-20261124`.
The accepted plan is [KOSMOS-CP1-PLAN.md](KOSMOS-CP1-PLAN.md).

## Checkpoints already saved remotely

| Repository | Commit | Checkpoint |
| --- | --- | --- |
| brickwright-lite | b660a46c3151433e60619bd1e6f93d4b1870aec7 | Accepted plan and clean-room constraint |
| brickwright-lite | 65cf01247a7024ecac430ccf20040fd57bf8cd86 | Canonical lane claim merged into feature |
| bw-board | 227cd54a2a87a6e17281158a962d199c58561534 | Original 8049 core, disassembler and 32 tests |
| bw-board | 50a6786cd7d13048ef98047084e2fb3822533a0c | 8155, CP1 machine, adapter, debugger, connector and hardware tests |
| sb3-creator | e6b8a91258f2a1773dc0faa60b68bfcab83a8188 | Original CP1 assembler and three teaching programs |
| sb3-creator | 480efb1e8cfb346dccaecdf8ada1c972b9ab90a5 | Gallery registration and actual LED/button circuits |

Subsequent checkpoints are recorded by this branch's commit history. None of these
feature commits constitute a production deployment or a merge into the release branch.

## Implemented and measured

- Original JavaScript NMOS MCS-48/8049 CPU from Intel documentation: 230 documented
  opcode encodings, explicit handling of reserved slots, banking, RAM stack, timer,
  external/timer interrupts, T1 counter, port latches, MOVX, expander hooks and disassembly.
- Independent 8155 and CP1/CP3 machine with real firmware execution, shared memory,
  keyboard matrix, multiplexed display duty, external ports and transactional snapshots.
- A single machine is shared by the circuit adapter and debugger. CPU pause freezes
  simulated time; original CP1 HLT/STP behavior remains firmware behavior.
- The combined CPU/hardware/debugger/target registry command passed **78 tests**.
- Original assembler supports structured decimal cells, mnemonics, labels, ORG/EQU,
  data, bounds, source maps and atomic diagnostic rejection. Its suite passed **11 tests**.
- Panel/project helpers passed **14 tests**. The editor workspace preserves incomplete
  source; portable projects hold configuration and ROM identity, not ROM bytes or held keys.
- Three original examples: first display, switch input, and timed LED output.
- Eight original English/German lessons have explicit learner-observed checkpoints.

## Firmware oracle observation

The research/oracle agent ran the supplied 2716 firmware, SHA-1
`ff4befcf82a664950186d3af1843fdef70d2209f`, against an external reference emulator.
After boot and physical `0, 0, 0, PC, RUN` contacts, the original seven-cell blink
program produced the same 14 Port 2 transitions and intervals in both machines.
Intervals included 225.785, 225.610 and 225.995 ms. The CP1 delay instruction's
200 ms operand is not a guarantee of a 200 ms complete loop.

Our I/O callbacks report the instruction-start boundary; the reference reports
the completed instruction boundary. The observed edge timestamps therefore differ
by a constant 5 microseconds for this program. This is instruction-level emulation
with machine-cycle accounting, not a claim of oscillator-edge bus timing.

The oracle exposed a reversed keyboard-column assumption. The independent hardware
writer checked the enlarged original schematic, found its crossed column wires,
and corrected the mapping. No reference implementation was supplied to that writer.

## Clean-room and media boundary

CPU and peripheral implementation agents started with fresh contexts and used
Intel/Kosmos documentation. They received hardware requirements and observable
test outcomes, not GPL source, translated algorithms or implementation structure.
Provenance is recorded upstream in `docs/MCS48-IMPLEMENTATION.md` and
`docs/CP1-HARDWARE.md`, and locally in [CP1-CLEAN-AUTHORSHIP.md](CP1-CLEAN-AUTHORSHIP.md).

The GPL reference and historical ROM stayed in temporary oracle storage. Neither
is a runtime dependency or committed asset. A user must supply a 2048-byte ROM.
Known ROM identifiers do not establish permission to redistribute those bytes.

## Current integration checkpoint

Lite now has CP1 target routing, ROM loading, a shared-machine panel host, program
loading, original key contacts, a separate 8049 instruction step, CP3 selection,
draft persistence in the optional `.sb3` CP1 section, gallery source loading and
lesson registration. The circuit repository has an original system-connector
schematic and CP1 extraction. These application paths are under integration review;
upstream package pins and browser verification must accompany the final checkpoint.

## Explicit remaining qualification

- Full browser interaction, project restore and actual external-circuit measurements.
- Broader firmware instruction/error/CP3 program corpus and independently obtained
  mask-ROM-B testing. The current oracle evidence is for the named 2716 image only.
- Hash-qualified semantic CP1 instruction stepping/breakpoints and source highlighting.
- Cassette pulse timing/CP2, CP4 relay and CP5 dedicated teaching surfaces.
- Chip-level, freely rewired 8049/8155 schematic construction. The initial circuit
  part is the complete CP1 system connector with real external I/O.
- Generic 8155 strobed-port modes and exact internal timer-register encoding are
  explicitly unsupported/limited; the CP1 firmware uses simple I/O and its CPU timer.
- Debugger event replay and physical hardware qualification are not claimed.
