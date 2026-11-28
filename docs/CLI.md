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
firmware unless you explicitly use `8051 build` or a toolchain command.

| Task | Lite command |
| --- | --- |
| Validate pseudocode | `bwlite check program.bw` |
| Convert pseudocode to a Scratch project | `bwlite convert program.bw --to sb3 --out program.sb3` |
| Recover pseudocode from a project or code file | `bwlite read program.sb3 --out program.bw` |
| Emit C, host C, Python, JavaScript, MicroPython, BASIC, or Cowgol | `bwlite convert program.bw --to c --out program.c` (change `--to`) |
| Read or check the supported Cowgol subset | `bwlite read program.cow --out program.bw`, `bwlite check program.cow` |
| Export the supported Blocks/pseudocode subset as Cowgol | `bwlite convert program.sb3 --to cowgol --out program.cow` |
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
