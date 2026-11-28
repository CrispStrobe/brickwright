# Terminal commands: `bw` and `bwlite`

`.bw` is the **Brickwright pseudocode file extension**. It is not a command.

`bw` is the CLI in the separate [sb3-creator compiler repository](https://github.com/CrispStrobe/sb3-creator)
(`bin/bw.mjs` there). Older architecture and proof documents use commands such
as `bw transpile` to describe tests run in that repository. The `bw` executable
is not installed by Brickwright Lite and is not needed to use this checkout.

`bwlite` is this repository's CLI, implemented in [`bin/bwlite.mjs`](../bin/bwlite.mjs).
After installing dependencies and populating `packages/` as described in the
[README](../README.md#quick-start), run it as `npm run cli -- COMMAND` from this
checkout or `npm link` once and invoke `bwlite` from any directory. It calls
the pinned compiler and language readers shipped with the app. `compile` in
`bwlite` is retained as a compatibility alias for `convert`; it does not build
firmware unless you explicitly use `cowgol build`, `8051 build` or a toolchain command.

| Task | Lite command |
| --- | --- |
| Validate pseudocode | `bwlite check program.bw` |
| Convert pseudocode to a Scratch project | `bwlite convert program.bw --to sb3 --out program.sb3` |
| Recover pseudocode from a project or code file | `bwlite read program.sb3 --out program.bw` |
| Emit C, host C, Python, JavaScript, MicroPython, BASIC, or Cowgol | `bwlite convert program.bw --to c --out program.c` (change `--to`) |
| Read or check the supported Cowgol subset | `bwlite read program.cow --out program.bw`, `bwlite check program.cow` |
| Export the supported Blocks/pseudocode subset as Cowgol | `bwlite convert program.sb3 --to cowgol --out program.cow` |
| Export checked native Cowgol | `bwlite convert program.bw --to cowgol --target atmega328p --out program.cow` |
| Compile full Cowgol or checked Blocks to a native artifact | `bwlite cowgol build program.cow --target z80-cpm --out program.com` |
| List and change target boards | `bwlite devices [program.bw]`, `bwlite retarget program.bw stc15f2k60s2 --out revised.bw` |
| Compile STC/8051 pseudocode or C to Intel HEX | `bwlite 8051 build program.bw --out program.ihx` (installed SDCC) |
| Flash an STC/8051 | `bwlite 8051 flash program.ihx --port /dev/cu.usbserial-XXXX` (installed stcgal) |
| Inspect USB SPIKE ports or run the supported stream subset | `bwlite spike probe`, `bwlite spike run program.bw` |
| Import or export a LEGO MINDSTORMS archive | `bwlite mindstorms import project.lms --out project.sb3`, `bwlite mindstorms export project.sb3 --template original.lms --out revised.lms` |
| Use an existing repository CLI | `bwlite toolchain ...`, `bwlite machine ...`, `bwlite fpga ...`, `bwlite makecode ...` |

The `machine` command handles emulator configurations and boot plans. It is
not a headless run/step/debug command for all chip emulators; those controls
are currently in the app. The terminal conversion readers cover documented
language subsets and report unmapped constructs. `spike run` accepts a smaller
USB streaming subset than the general pseudocode compiler, as described in
the [SPIKE USB guide](../scripts/spike/README-usb-stream.md).

## Cowgol conversion

`read`, `check`, `convert`, `transpile`, `devices` and `retarget` accept
`.cow` and `.cowgol` input files. `convert --to cowgol` and its
`transpile`/`compile` aliases generate Cowgol from the same checked
Blocks/pseudocode subset as the Code tab. For example:

```sh
bwlite convert program.bw --to cowgol --out program.cow
bwlite read program.cow --out recovered.bw
bwlite convert program.cow --to sb3 --out program.sb3
bwlite convert program.cow --to javascript --out program.js
bwlite check program.cowgol
```

The reader processes executable Cowgol statements, so edits to a generated
file are reflected in recovered pseudocode. It retains the declared device
and digital pin metadata; `--device` uses the existing checked retargeting
rules. Integer-profile warnings go to stderr, leaving stdout available for
the requested source. Unsupported source, unsupported Blocks, and pseudocode
parse warnings during Cowgol generation fail with exit status 2 before
writing an output file. An existing output file is preserved on refusal.

These commands use the [Cowgol conversion subset](COWGOL.md); they do not
invoke the native compiler or produce CP/M, DOS, RISC-V, or Eater executables.
Arrays, pointers and other full-language constructs may compile through a
native Code-tab route while still being refused by terminal conversion.

Add `--target z80-cpm|i8080-cpm|dos|riscv32|eater6502|atmega328p` to
`convert --to cowgol` (or its `transpile`/`compile` aliases) to generate the
checked native int32 profile. It includes runtime overflow checks and refuses
operations that the selected native runtime does not implement. `--target`
does not change a project's declared board; use the separate `--device`
retargeting option when that change is intended. Cowgol export checks an SB3's
original block graph so unsupported extension instructions cannot disappear
through decompilation. If an explicit retarget is requested, the original graph
must pass the Cowgol checks before conversion proceeds.

## Native Cowgol builds

`cowgol build` invokes the same companion compiler service and artifact
validators as the Code tab. It accepts full `.cow`/`.cowgol` source directly,
including arrays and pointers beyond the conversion subset. `.bw` and `.sb3`
inputs first pass the checked native generator; the original SB3 graph is
preserved for validation.

```sh
bwlite cowgol targets
bwlite cowgol build program.cow --target z80-cpm --out program.com
bwlite cowgol build program.cow --target i8080-cpm --out program-8080.com
bwlite cowgol build program.cow --target dos --out program.exe
bwlite cowgol build program.cow --target riscv32 --out program.elf
bwlite cowgol build program.cow --target eater6502 --out program.bin
bwlite cowgol build blink.bw --target atmega328p --out blink.hex
bwlite cowgol build program.cow --target cowgol-cgen --out program.c
```

The `cowgol-cgen` target exports C and accepts `.cow`/`.cowgol` input. It is
a source artifact; the remaining six targets produce executables. Native
builds require an output path (`--out` or `-o`) and never write a binary to
stdout. They build the file without flashing hardware or launching a machine.

The endpoint is selected by `--endpoint`, then `BWLITE_COWGOL_ENDPOINT`, then
the Code tab's hosted service URL. A deployment must include the qualified
Cowgol bundle. Redirects are refused so the source stays at the selected
endpoint. An explicitly empty endpoint is an error. To use a local companion
service:

```sh
bwlite cowgol build program.cow --target z80-cpm --out program.com \
  --endpoint http://127.0.0.1:8000/compile
```

`--timeout-ms` accepts 1–300000 milliseconds and defaults to 120000.
Hosted-toolchain distribution policy applies to this command as it does to
the editor. Compiler failure, timeout, malformed artifact metadata, invalid
machine images and unsupported source return status 2 and retain any previous
output. The validated result is written with an atomic replacement. Source
and output paths, including symbolic-link aliases, must differ.

The original `bwlite compile` alias remains source conversion. Use the explicit
`bwlite cowgol build` command when a compiled machine artifact is required.
