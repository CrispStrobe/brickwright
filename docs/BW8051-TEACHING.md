# The bw8051_1 teaching additions

The existing 8051 emulator, debugger and SDCC toolchain remain the execution path.
This pack adds six runnable assembly exercises, byte-level debugger explanations,
and an optional small scheduler guest.

## Run an assembly exercise

1. Select an STC89, STC12 or STC15 device and open **Code → ASM → Source**.
2. Choose a **Lab:** entry in the example picker. Its opening comments contain a
   prediction question, initial data, the result to inspect, and attribution.
3. Choose **Assemble & Run**. The existing SDAS8051 route builds the source.
4. Pause and open **Under the hood**. Every exercise finishes in a stable loop at
   code address **0300 hex**. Use **Run to address** with `0300` when stepping.
5. Compare the registers or memory bytes with the stated result, then change an
   input and predict the new result before running again.

| Example | Initial data | Observation at 0300h |
|---|---|---|
| Add two 16-bit numbers | `2E5Fh + A3B4h` | R7:R6 = `D213h` |
| AND two bytes on P2 | `AAh AND 23h` | A and P2 = `22h` |
| Copy ten RAM bytes | Ten explicit bytes at IRAM `50h–59h` | The same bytes at `70h–79h`; R0=`5Ah`, R1=`7Ah`, R2=`00h` |
| Sort twelve RAM bytes | Twelve explicit bytes, including duplicates and `80h/FFh` | `00 01 02 03 09 12 12 20 40 7F 80 FF` at `50h–5Bh` |
| Hexadecimal to decimal digits | `ABh` | R5=1, R6=7, R7=1: decimal 171 |
| Rotate a register pair | R1:R0 = `8180h` | R1:R0 = `0301h` |

These are CPU/memory exercises. They do not require an ESA31 trainer ROM, an
8255, unimplemented peripheral behavior, or external data memory above the
selected chip's internal XRAM. P2 is an observable output latch in the AND lesson.

## Inspect a byte

The memory window now explains the byte under the pointer in hexadecimal,
decimal and binary, with ASCII for printable values. The current snapshot marks:

- **Blue:** the active 8051 register bank selected by PSW.
- **Yellow:** the internal RAM byte addressed by SP.
- **Purple:** the XRAM address selected by DPTR.
- **Green:** the program byte selected by PC.

Hovering upper IRAM explains its indirect addressing and distinguishes it from
the SFR at the same numerical address. Bit-addressable RAM, SFRs and bit-space
views explain their corresponding bit addresses. These annotations are offered
only for an 8051 snapshot; other architectures retain numeric byte descriptions.

The explanations describe the current snapshot. They do not assert a last writer,
write timestamp, or complete per-instruction write history. Brickwright's existing
recorded-event inspector remains the place for recorded write evidence.

## Optional cute-os scheduler guest

Download the [SDCC C source](../overlay/scratch-gui/static/teaching/bw8051-1/cute-os-timer0.c)
or its [compiled Intel HEX](../overlay/scratch-gui/static/teaching/bw8051-1/cute-os-timer0.ihx).
The same files ship at `static/teaching/bw8051-1/` in the app build. This is a
download/load or native-build example; it is not a new Scratch execution mode.

Select **STC89C52RC at 12 MHz** when loading the image. It owns Timer0 and uses
idle mode between interrupts. Three short callbacks toggle P1.0, P1.1 and P1.2
every 8, 20 and 40 scheduler ticks. At tick 200 the fast task is removed and P1.3
goes low. At tick 240 Timer0 stops and IRAM `36h` becomes `A5h`.

| Observation at completion | Expected value |
|---|---|
| IRAM `30h`, fast callback count | 25 |
| IRAM `31h`, medium callback count | 12 |
| IRAM `32h`, slow callback count | 6 |
| IRAM `33h`, API check errors | 0 |
| IRAM `34h–35h`, tick counter, little endian | `F0 00` (240) |
| IRAM `36h`, completion marker | `A5` |
| P1 output latch | `F6` |

Each timer reload requests 5 ms on the selected 12T/12 MHz profile. ISR and reload
latency add time, so the lesson demonstrates task ratios and removal, not a
calibrated wall clock. Callbacks execute inside the ISR and must remain short.

This is an explicitly changed teaching adaptation of cute-os. It uses Timer0
mode 1 instead of the original Timer2/GCD configuration, validates callback and
period arguments, uses stable task slots and per-task countdowns, and repairs the
callback/status conventions. The original Timer2 firmware is not claimed to run
unchanged. It does not replace Brickwright's generated cooperative scheduler.

## Source provenance

| Material | Pinned upstream | What was retained or changed |
|---|---|---|
| Six assembly algorithms | [AshrithSagar/MicroController-Lab, `11d6f887feaffb763b937693d440d79fda31a65c`](https://github.com/AshrithSagar/MicroController-Lab/tree/11d6f887feaffb763b937693d440d79fda31a65c) | MIT; originals retained byte-for-byte. Shipped versions adapt ORG/END and numeric syntax to SDAS8051, initialize inputs, and add the stable stop loop. |
| Optional scheduler guest | [makaram99/cute-os, `c489ebfb1a9186903b6c60db66bd1154ec703d71`](https://github.com/makaram99/cute-os/tree/c489ebfb1a9186903b6c60db66bd1154ec703d71) | MIT; original scheduler/header retained for provenance; the C guest describes its changes. Keil startup/compiler outputs are excluded. |
| Byte presentation ideas | [STC15F2K60S2 visual simulator, `742d2ea1ca2c9e2cdfc463f212242936767b10ea`](https://github.com/mantou1233321/STC15F2K60S2_visual_simulator/tree/742d2ea1ca2c9e2cdfc463f212242936767b10ea) | Design reference only. No simulator code, opcode table or uncertain SFR dataset was imported. Existing Brickwright names and snapshots supply the annotations. |

Original material lives in `test/fixtures/bw8051-1/upstream/`. Complete MIT notices
travel in the example source and under `static/licenses/`. Course PDFs, unfinished
exercises and trainer-ROM stubs were not imported.

## Reproduce the checks

The committed Intel HEX fixtures allow the runtime tests to execute without
requiring a native compiler or a network service:

```sh
node --test test/stc8051-teaching-examples.test.mjs test/memory-byte-help.test.mjs
```

The runtime suite runs each assembly image on STC12C5A60S2, STC12C5A16S2,
STC15F2K60S2, STC15W408AS and STC89C52RC, checks the
explicit finish address and result bytes, and proves that a corrupted result is
rejected. It runs the scheduler guest through idle wake-up to its stated counters
and removal result. Source hashes bind the byte fixtures to the picker source;
Git blob hashes protect the retained original exercises.

With SDCC 4.5 (`sdcc`, `sdas8051`, `sdld`) available, reproduce the binaries:

```sh
node scripts/build-8051-teaching.mjs --check
```

Set `BW_SDCC_BIN` to the toolchain's `bin` directory if it is not on PATH.
`--out artifacts/8051-teaching` produces source, HEX and a manifest for review.
After a deliberate source change, `--write-fixtures` refreshes the checked-in
fixtures and downloadable scheduler image. The C build uses `--data-loc 0x40`
to reserve its observation bytes at `30h–36h`.

These checks execute the shipped emulator. They establish the stated emulator
behavior and reproducibility; they are not a physical-hardware qualification.
