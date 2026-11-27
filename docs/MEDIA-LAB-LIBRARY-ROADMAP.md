# Media lab in Machines

This inventory covers the 34 manifests on media-lab main at `5e54caab98d7ca6f641d7cc3e21f2ebdab937400`. Each entry needs an exact artifact or a reproducible build, a reviewed redistribution licence, a compatible machine and a guest-output check through its ordinary UI. A program can appear under its host CPU without being presented as a bootable operating system. The library fetches reviewed media on demand. ROMs with unclear redistribution terms stay out of its downloadable entries.

[Media-lab projects at the reviewed revision](https://github.com/CrispStrobe/brickwright-media-lab/tree/5e54caab98d7ca6f641d7cc3e21f2ebdab937400/projects) · [Candidate ledger at that revision](https://github.com/CrispStrobe/brickwright-media-lab/blob/5e54caab98d7ca6f641d7cc3e21f2ebdab937400/docs/CANDIDATES.md)

| Manifest | Machines handoff or work remaining |
| --- | --- |
| ACK | Three DOS programs under 8086. Pascal and Modula-2 print primes. C prints factorials. The media-lab copy of the BSD-3-Clause licence is linked per entry, and each COM has its own SHA-256. The ACK cross-compiler runs on the build host. |
| fe, zForth, partcl and uBASIC for DOS | Existing named entries under 8086. |
| ELKS | Existing 8086 lesson with a terminal in Controller. |
| zForth for CP/M and CP/M-80 software | Existing Z80 entries. CP/M Sieve has an editable C route. |
| BBC BASIC for Z80 | Existing serial and VDP lessons boot CP/M. The media-lab manifest describes a separate BDOS-shim workflow. |
| Microsoft BASIC for 6502 | Existing 6502 lesson. |
| Tali Forth 2 with framebuffer | The Machines entry runs the reviewed ROM on its declared 65C02 map. Switch between ACIA and Screen in Controller to define words and inspect the 64 × 32 framebuffer. The GUI check exercises VIA writes and verifies all 2,048 displayed pixels. |
| 6502 Animation Lab | The 6502 Machines entry runs the original MIT ROM and shows the 100 × 64 animation in Controller. It captures each visible frame when the guest publishes it at $0200. Source editing and rebuilding remain part of the Media Lab CLI lesson. |
| Linux on RISC-V | Existing Linux lesson and cold-boot option. |
| PicoBB | Existing RP2040 entry using the reviewed filesystem-enabled revision. |
| TOPBENCH and Native 386 Sieve | Both run from the 80386 Machines group. Sieve loads the MIT raw binary in 32-bit protected mode and validates its AT UART output and guest halt. |
| Whetstone | The existing benchmark panel retains the separately reviewed Painter Engineering permission and runtime notices. No new Machines entry was added under that grant. |
| F83, VolksForth and Small-C | The reviewed revision contains fetch recipes and manifests. Publish pinned, redistributable program bytes, then exercise the interactive Forth prompts and Small-C's shared DOS files. |
| MINIX 2.0.4 | Runs under 80386 in Machines with a checksum-pinned floppy and the bundled free AT BIOS. Boot with `=` in Controller and log in as `root`. The GUI regression exercises the keyboard, full screen and a root-directory listing from the shell. [Floppy and licence](https://github.com/CrispStrobe/brickwright-media-lab/pull/45) |
| MINIX 1.7.5 | The 8086 release reaches the boot monitor. Its RAM disk still exceeds the current memory profile. |
| Multitasking MS-DOS | The MIT beta recipe reaches its banner and then faults before a prompt. Build the mainstream version and verify the interactive shell before admitting it. |
| ALICE Pascal, OpenGEM and Freedoom with FastDoom | Need packages mounted in a working DOS guest. Verify the Pascal main menu or graphics and input on the two graphical titles. |
| ACE KIM | The pinned repository contains the BIOS and monitor. Qualify the keyboard and LCD routes on the dedicated KIM hardware before presenting a library launch. |
| KIM-1 expansion demos and CP/M-65 | Give paper tape, expanded RAM, video and SD images a handoff through the existing KIM controls. Expansion demos have committed artifacts. CP/M-65 has media recipes and needs an interactive boot check with its matching storage profile. |
| KIM-1 memory card and xKIM | Source manifests. The programmable board needs card firmware or a behavioral model. xKIM needs a matching storage and monitor configuration. |
| Bad Apple and tron-0xf | The 6502 demo needs a verified player image, SD card and framebuffer. The Spectrum game requires a compatible ROM with reviewed redistribution rights as well as the tape. |

The next candidates from the ledger are PDOS/86, Berkeley Logo, and the native DOS programs listed under Sopwith, zmiy and sudoku86. Review the exact source and every included dependency before assigning a library licence. Prioritize MIT, Apache-2.0, BSD and CC0 projects. GPL and LGPL media can be offered as separate downloads under their licence terms. Continue beyond the ledger by CPU, with a boot or interpreter acceptance test and at least one meaningful user action for each entry.
