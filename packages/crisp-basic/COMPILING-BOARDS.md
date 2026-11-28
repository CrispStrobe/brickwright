# Compiled C99 board targets

The independent BASIC compiler can emit a single C translation unit for
native GCC, Raspberry Pi Pico, or Arduino Uno. Board compilation uses the
real SDK/compiler; it never substitutes the host interpreter for firmware.
`src/compiler-targets.mjs` returns explicit artifact hashes and a
`validation.status: "build-only"` receipt. A successful link alone does not
change that status to an execution pass.

```sh
crispbasic compile examples/compiler/pins.bas --target native -o pins
crispbasic compile examples/compiler/pins.bas --target arduino-uno -o pins.hex
crispbasic compile examples/compiler/pins.bas --target pico \
  --pico-sdk /path/to/pico-sdk -o pins.uf2
```

The CLI writes the generated C alongside the output. Uno produces Intel HEX
plus ELF; Pico produces UF2 plus ELF and BIN. `--emit-c` can be used when the
toolchain is installed elsewhere. Generated program logic is C99. Pico SDK
2.x headers require a C11 compilation mode, so its CMake project selects C11
without changing the emitted language subset. Its CMake project selects the
compiler's full printf and double implementations: the SDK's compact printf
and ROM-oriented double implementation change decimal output and subnormal
results.

## Platform contracts

| Target | Compiler | Pin identifiers | Console and clock |
| --- | --- | --- | --- |
| `native` | GCC, C99 | Logical IDs 0–255 | stdin/stdout; portable delays advance integer logical milliseconds; `TIME` uses the host elapsed clock independently |
| `arduino-uno` | AVR GCC with binary64 support, avr-libc | D0–D13 as 0–13; A0–A5 as 14–19 | UART0, 9600 baud, 16 MHz crystal; Timer0 CTC provides 1 ms ticks |
| `pico` | Pico SDK and arm-none-eabi-gcc | GP0–GP22 and GP25–GP28 | SDK UART0 console and monotonic SDK time |

Portable calls are `PROCpinMode`, `PROCdigitalWrite`, `PROCdigitalToggle`,
`FNdigitalRead`, `PROCdelay`, and `FNmillis`. Modes are `"input"`, `"output"`,
and `"input-pullup"`. A mode change retains the output latch; toggle inverts
that latch. Physical reads observe the GPIO input. Native reads use the
deterministic logical model: output reads return its latch, input-pullup
returns high, and an undriven plain input fails instead of inventing a level.

The firmware console occupies the usual UART pins: Uno D0/D1 and Pico
GP0/GP1. Assigning those pins to another purpose conflicts with that console.
Timer0 is reserved by the Uno adapter. Analog input, PWM and interrupts are
outside this portable pin library.

Native runs can write a JSON Lines trace by setting
`CRISPBASIC_TRACE=/path/to/trace.jsonl`. The trace records pin modes, writes,
reads, toggles and logical delays in the existing simulation host's format.

### Uno numeric and memory requirements

Uno builds require `-mdouble=64 -mlong-double=64`, including matching
avr-libc multilib support. Older AVR GCC installations that cannot provide
these options fail with a toolchain diagnostic. Falling back silently to
32-bit floating point would change program results. Generated C also requires
GCC's libf7 arithmetic and math-symbol feature macros, so a custom toolchain
cannot silently bind incompatible math routines. The qualified build used
AVR GCC 14.2.0 and avr-libc 2.2.1.

The generated AVR runtime formats binary64 values itself because avr-libc's
floating printf only handles binary32. Its original integer-ratio formatter
uses 288 bytes of heap workspace and rounds nine significant digits to
nearest, with ties to even. It includes an original replacement for libf7's
weak `__f7_get_double` boundary, correcting halfway rounding and preserving
subnormal results. This replacement uses libf7's ten-byte representation
(flags, seven significand bytes, signed 16-bit exponent); that ABI is qualified
against GCC 14.2.0. No GCC implementation is incorporated into the generated
runtime. See the [GCC libf7 interface](https://github.com/gcc-mirror/gcc/blob/releases/gcc-14.2.0/libgcc/config/avr/libf7/libf7.h)
for the ABI. Toolchain variants require the same firmware qualification;
successful compilation alone retains `build-only` status.

Decimal literals and `VAL` use the common runtime's BBC numeric conversion
rules. They do not silently substitute libc's differently rounded `strtod`.
Successful output and known numeric-overflow behavior are checked separately.

The link gate limits application flash to 32,256 bytes and static SRAM to
1,536 bytes, reserving 512 bytes for stack/working storage. This is a static
capacity gate, not a bound on every possible allocation or recursive call.
The Uno has limited RAM; the compiler/runtime's documented target numeric
profile and diagnostic restrictions still apply. Board execution evidence
below covers the named GPIO, console, numeric and error fixtures. It does not
bound the memory required by arbitrary arrays, strings or recursion. Generated
statement scopes allow temporary stack storage to be reused between sequential
BASIC statements; a GCC `-fstack-usage` regression checks this on real AVR code.

## Repeatable MCU trace verification

Build the BBCSDL WASM oracle, install the real toolchains, and prepare
Brickwright's pinned MCU package:

```sh
npm run build:wasm
git clone https://github.com/CrispStrobe/bw-board.git .build/bw-board
git -C .build/bw-board checkout cda715c16d4b733ceb73f7720a236b5ea9e3f21d
npm --prefix .build/bw-board ci --ignore-scripts --no-audit --no-fund

node scripts/verify-compiler-boards.mjs \
  --target uno --board-root .build/bw-board

node scripts/verify-compiler-boards.mjs \
  --target pico --board-root .build/bw-board \
  --pico-sdk /path/to/pico-sdk
```

`--cc`, `--objcopy`, `--size`, and `--cmake` select explicit tool executables.
`--build-directory` preserves a CMake build directory for incremental Pico
builds. `--output-directory` changes the default
`.build/compiler-board-proof` destination. The default runs all four fixtures;
`--fixture pins|console|decimal|overflow` selects one.

| Fixture | Executed behavior |
| --- | --- |
| `pins.bas` | Pin mode, high/low/toggle transitions, 10 ms and 5 ms delays |
| `console.bas` | Actual UART bytes for strings, integers, binary64 PRINT, SQR/ABS, LEFT$/RIGHT$ |
| `decimal.bas` | Large exponents, subnormals including `5E-324`, signed zero, rounding boundaries, VAL integer tags, long fractional input and trailing text |
| `overflow.bas` | BBC numeric overflow near the largest binary64; matching output prefix, runtime source-line diagnostic and no unreachable output |

The verifier executes each source in `examples/compiler/` through the
independently implemented BBCSDL interpreter with its normal portable library.
It then compiles the same source, builds actual MCU images, and cold-boots each
image twice in Brickwright's corresponding AVR or RP2040 adapter. Pico runs its SDK
flash image and boot2; the verifier does not patch CPU registers to skip SDK
startup. It checks output edge count and levels exactly, UART bytes exactly,
and the requested 10 ms and 5 ms intervals to within 1 ms. The tolerance
accounts for the Uno's millisecond tick and instructions surrounding the
calls; an instantaneous host operation and executed MCU instructions do not
have identical timestamps. Successful console/numeric fixtures require
byte-identical output. The overflow fixture requires BBCSDL error 20 on the
expected line, identical program output before that error, and the compiled
runtime's corresponding source-line error. Its diagnostics are recorded
separately; the two implementations do not use identical error wording.

Each fixture writes C, firmware and a JSON evidence report; an all-fixture run
also writes a target summary. The report records
the BASIC/C/firmware digests, compiler commands, reference trace, adapter
source digests, observed edges, timing error, and two cold boots. Missing
simulator dependencies yield an explicit `build-only` report with the
reason. A trace mismatch is a failing verification, not a build-only pass.

### Observed qualification, 2026-11-28

Both targets passed two cold boots per fixture against the real BBCSDL oracle.
The MCU dependency was Brickwright `bw-board`
`cda715c16d4b733ceb73f7720a236b5ea9e3f21d`, with its locked AVR fork
`feea84c43e36e578841b5fce640202823b69b7f7` and RP2040 dependency. Pico used
Pico SDK 2.2.0 with the actual ARM GNU toolchain.

| Target | Requested intervals | Observed intervals | Result |
| --- | --- | --- | --- |
| Uno/ATmega328P, 16 MHz | 10 ms, 5 ms | 10.338500 ms, 5.781187 ms | Exact high/low/high transitions; both intervals inside 1 ms tolerance; two cold boots passed |
| Pico/RP2040, 125 MHz | 10 ms, 5 ms | 10.027232 ms, 5.019216 ms | Exact high/low/high transitions; both intervals inside 1 ms tolerance; two cold boots passed |

The independently compiled fixtures had these measured sizes:

| Fixture | Uno flash | Uno static SRAM | Pico UF2 container |
| --- | ---: | ---: | ---: |
| Pins | 7,472 bytes | 396 bytes | 82,944 bytes |
| Console | 24,304 bytes | 646 bytes | 133,120 bytes |
| Decimal boundaries | 16,958 bytes | 574 bytes | 100,352 bytes |
| Numeric overflow | 13,416 bytes | 380 bytes | 96,256 bytes |

The decimal fixture includes the minimum binary64 subnormal, exponent and
rounding transitions, signed zero, and long decimal text. Its Uno execution
finished
within 509 simulated milliseconds including the final quiet interval. The
288-byte decimal-format heap workspace is in addition to static SRAM and
stack; these size figures do not prove a general bound on dynamic memory.
The compiler stack regression measured 28 bytes for the combined program/main
frames of 50 identical PRINT statements, versus 185 bytes when GCC inlined the
one-statement program's helpers into main. These are fixture-specific compiler
measurements, not whole-program worst-case stack bounds.

These figures describe the generated fixtures at the recorded checkpoint.
Later runtime changes can change sizes and instruction overhead and must rerun
the verifier. Exact BASIC/C/image hashes and observations are emitted in
`.build/compiler-board-proof/{arduino-uno,pico}.json` and the individual
`<target>-<fixture>.json` reports. The checked-in
[qualification summary](validation/compiler-boards.json) preserves the observed
results and hashes of the restored compiler sources. The original firmware
files and their recorded hashes were not retained after an executor reset;
those fields are explicitly unavailable in that summary. Rerunning the verifier
produces fresh complete artifact receipts.

These results exercise actual firmware GPIO and UART output, including the
binary64 formatter, arithmetic and decimal conversion paths. The trace sink
records the simulator's GPIO boundary; it is not an electrical circuit solver.
UART input and every combination of language features are not covered by these
fixtures. No physical board was flashed or measured.

## Brickwright integration boundary

The companion Brickwright change adds a **Compile BASIC** action and explicit
**BBC BASIC (compiled C99)** board profiles. It loads this repository's
compiler as a browser module, preserves the authored BASIC, and exposes the
C result through the existing C view. Uno C builds reuse the existing
compiler, firmware/emulation and flash routes with the binary64 flags.

The hosted RP2040 C service currently builds an SRAM-only image without the
Pico SDK. The GUI therefore refuses to send SDK-generated C to that route.
Build the UF2 with this CLI and load it through the existing firmware route.
An older hosted AVR compiler may also refuse the required binary64 flags;
that is reported, not silently downgraded. Local CLI builds and the simulator
proof above are independent of that hosted service's deployment.

This compiled route is separate from the Pico interpreter-firmware route.
It neither changes that firmware nor replaces its console/upload behavior.
