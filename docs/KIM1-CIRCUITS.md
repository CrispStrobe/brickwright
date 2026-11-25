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

For hardware mode, open **Firmware and TTY** and mount your 6530-003 and
6530-002 ROMs. A combined 2 KiB file is also supported with 003 first.
The ROM drives the keypad matrix and display at the simulated 1 MHz clock.
The optional virtual TTY operates at 300 baud. Use the keypad to choose the
entry address after a file import. ROMs stay in the active simulation session.

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
