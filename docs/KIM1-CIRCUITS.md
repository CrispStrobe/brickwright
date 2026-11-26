# KIM-1 in Brickwright Circuits

## Open the first experiment

Open **Circuit → Examples**, search for **KIM-1**, and open **KIM-1: Wired I/O**. The KIM-1 also appears in the computer palette. Its front panel appears in Instruments.

Press **GO**, then toggle PB0–PB3 under Switches. The four external PA LEDs follow the input bits through a running NMOS 6502 program. The engine, ports and external components use the same circuit clock and electrical network.

The panel provides all 23 keys, the SST switch, a six-digit display, CPU registers, port values, an editor for addressed hex, Intel HEX and paper-tape programs, and Brickwright-authored examples. Accepted programs and keypad edits are saved with each circuit part.

| Control | Action |
| --- | --- |
| AD, then four hex digits | Select a memory address |
| DA, then two hex digits | Change the selected writable byte |
| + | Advance to the next byte |
| GO | Execute from the selected address |
| SST, then GO | Execute one instruction |
| ST | Stop this computer while the circuit continues |
| PC | Return to the stopped program counter |
| RS | Reset controls and ports, retaining RAM and the SST switch position |

Keyboard entry stays within the focused panel. Text editors retain normal editing keys. Unloaded program text is a draft; Load or GO accepts it. Save exports the accepted memory image.

## Implementation and scope

The engine belongs to **bw-board**; the panel, palette, connector and controls belong to **bw-circuit-ui**. Brickwright consumes exact supplier revisions from `vendor-pins.json`. There is no app-local duplicate of the emulator.

The CPU implements the 151 documented NMOS 6502 opcodes and their architectural cycle counts, including decimal arithmetic, indirect-JMP page wrapping, read-modify-write behavior and the JSR operand/stack overlap case. The CPU reuses this project's original MIT W65C02 instruction plumbing with a separate NMOS profile. The monitor, memory map, 6530-style ports/timers and demonstrations are independently written.

The learning monitor starts with 1 KiB main RAM and the two 64-byte 6530
banks. To open a paper tape, use **Open…** and **Load program** in the KIM-1
panel. The loader verifies the checksum and end record before applying the
bytes. Paper tape (.pap and .ptp) and Intel HEX can enable expansion RAM.
Circuit saves preserve the accepted program and its expansion map.

For hardware mode, open **Firmware and TTY** and choose **Use Brickwright ROM**.
The independent 2 KiB monitor drives the keypad and display through the 6530
at the simulated 1 MHz clock. It provides a 300-baud terminal and its own
paper-tape load and dump commands. Use the keypad to select a program entry
after importing a file. The same menu accepts 6530-003 and 6530-002 images for
the active session.

## Source and licensing boundary

The research-only agent inspected references and sent independently phrased hardware facts to the implementation agents. No incompatible implementation, disassembly, monitor binary, photograph, manual illustration or PCB artwork was passed to the writers or included in the feature.

| Source | Use |
| --- | --- |
| MOS KIM-1 User Manual and MOS 6530 documentation | Hardware and user-interface facts only; no ROM/listing/artwork reuse |
| Obsolescence KIM Uno operating guide | Front-panel behavior facts only |
| maxstrauch/kim-uno | Identified as a distinct SUBLEQ project; no code or assets reused |
| eduardocasino/kim-1 | License reviewed; NC-covered source/assets excluded |
| cc65 KIM-1 documentation | Target facts; no runtime/library code imported |
| Existing bw-board W65C02 core | Reused under its MIT license |
| SingleStepTests/65x02 | MIT-licensed NMOS test vectors downloaded transiently for verification |

New engine and KIM-specific UI files, demos and connector drawings are original MIT work. Existing app and UI files retain their existing licenses, including the UI repository's MPL-2.0 license. No GPL or NC source or asset was incorporated.

References: [MOS manuals](https://bitsavers.trailing-edge.com/components/mosTechnology/kim-1/), [user manual transcription](https://www.kim-1.com/docs/usrman.htm), [MOS 6530 datasheet](https://www.retrodocs.fr/wp-content/uploads/pdf/MOS-6530.pdf), [KIM Uno operation](https://obsolescence.wixsite.com/obsolescence/kim-uno-how-to-use), [cc65 target](https://cc65.github.io/doc/kim1.html), [maxstrauch reference](https://github.com/maxstrauch/kim-uno), [replica license](https://github.com/eduardocasino/kim-1), [NMOS vector source and license](https://github.com/SingleStepTests/65x02/tree/2f6980a2d95757486c7bee24355c360e40e2a224).

## Qualification

The NMOS CPU passed 1,510,000 generated reference cases: 10,000 for each documented opcode, checking registers, memory, cycle totals and every ordered bus transaction. Asynchronous interrupt races and electrical waveforms need separate qualification. The source-bound receipt and reproducible harness live in the engine repository.

The circuit UI has focused engine/connector/persistence tests and a real Chromium interaction gate. `scripts/verify-kim1-circuits-browser.mjs` exercises the KIM-1 through the built Brickwright application and its example gallery. A passing upstream designer harness alone is not a claim that the full app was built or tested; the actual run results remain the authority.

## Brickwright ROM qualification

The replacement passed the original-ROM comparison for keypad entry, GO, ST,
SST, TTY input and the serial paper-tape loader. It also passed checksum
rejection and tape dump/reload. The cc65 KIM-1 C target and the opening of
the 50th anniversary demo both ran through its serial monitor interface.
Audio cassette support remains unavailable. The hardware monitor implements
a fixed 300-baud TTY profile.

## Baseline qualification

The tested implementation is Brickwright `1512f923b42d64ab13dfdba969ef02fc1591bc8d`, with **bw-board** `e834b270cd21ca90be4407610566cdd75750168d` and **bw-circuit-ui** `a76feb3000e30902537ef986c8c4c76cecf8e407`. The final evidence/documentation commit does not change that implementation.

| Check | Actual result | Evidence |
| --- | --- | --- |
| NMOS CPU reference vectors | 1,510,000 / 1,510,000 passed | [Engine qualification and reproducible harness](https://github.com/CrispStrobe/bw-board/blob/e834b270cd21ca90be4407610566cdd75750168d/docs/KIM1.md#cpu-qualification-and-tests) |
| Focused engine and electrical-circuit tests | 26 passed, 0 failed, 0 skipped | [Supplier receipt](receipts/2026-11-25-kim1-ui.json) |
| UI integration tests | 10 passed, 0 failed, 0 skipped | [Supplier receipt](receipts/2026-11-25-kim1-ui.json) |
| Actual CircuitDesigner Chromium interaction | All 11 groups passed | [Upstream run](https://github.com/CrispStrobe/bw-circuit-ui/actions/runs/45706138128) |
| Brickwright source suite | 179 passed, 0 failed, 0 skipped | [App job](https://github.com/CrispStrobe/brickwright/actions/runs/45709736264/job/139540746767) |
| Built Brickwright application in Chromium | All 5 groups passed | [App receipt](receipts/2026-11-25-kim1-app.json), [app job](https://github.com/CrispStrobe/brickwright/actions/runs/45709736264/job/139540746767) |

The CPU oracle checks registers, final RAM and instruction cycle totals for 10,000 generated cases per documented opcode. It does not grade every bus transaction or asynchronous interrupt timing.

The upstream designer check covers all 17 contacts at eight rotations/reflections, program import/export, atomic invalid loading, single stepping, live and saved RAM behavior, save/reload, real switches and LEDs, independent machines, and a 390-pixel panel. The final lesson also verifies that all wire paths fit within the canvas.

The full application was actually built and served. `scripts/verify-kim1-circuits-browser.mjs` opened the real example gallery and verified artwork and all 23 keys; PB switches through the running CPU to external PA LEDs; a newly entered program storing 42 at $0300; atomic invalid loading and SST; and keypad edits/RS retention in the serialized circuit. Both screenshots were visually reviewed. The panel screenshot retains the deliberate malformed-load warning from the negative test; subsequent valid operations passed.

The app job verified the installed bw-board and bw-circuit-ui package contents against their exact Git/npm-pack bytes in both root and GUI installations, plus single-engine resolution. This does not claim complete transitive-dependency byte verification. The production build used the existing circuit acceptance profile with CAD and FPGA disabled. Emitted broker proof, license notices, distribution policy and the existing no-GPL-payload/no-LGPL-sparse-solver check passed. The [app receipt](receipts/2026-11-25-kim1-app.json) includes the build manifest, browser version, artifact identity and SHA-256 hashes.

### Remaining upstream qualification blocker

**The app job is green; the overall workflow is not.** Its independent, unchanged `verify:bwboard-ci` job fails because the exact engine pin has no successful complete upstream CI run. Focused feature acceptance does not waive that gate.

The sole ordinary engine-test failure is present on the exact pre-KIM base as well as the candidate:

| Engine revision | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Base `e744ede765c76ce15b9e5c101aa23f56210eab09` | 10,046 | 1 | 307 |
| Candidate `e834b270cd21ca90be4407610566cdd75750168d` | 10,072 | 1 | 307 |

Both fail `test/multimeter-chain.test.mjs:163`, current mode `A`: expected digits `0 9 7`, actual `0 9 2`. The candidate adds exactly 26 passing KIM tests. See the [comparison receipt and original run links](receipts/2026-11-25-kim1-engine-ci-comparison.json).

The feature code remains on `feat/kim1-circuits` in all three repositories, with [engine PR #771](https://github.com/CrispStrobe/bw-board/pull/771) and [UI PR #176](https://github.com/CrispStrobe/bw-circuit-ui/pull/176). No feature merge, deployment or release qualification is claimed. Landing must still satisfy the repository's upstream-default and exact-pin qualification rules.
