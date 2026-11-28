# Cowgol in Brickwright

Cowgol is available from **Code → + → Cowgol**. It uses the shared
`CrispStrobe/sb3-creator` reader and generator, with source preserved in `.cow`
files and in the project's authored-code document. The same GUI code is used
by the web and native application wrappers.

## Editor workflow

1. Open Cowgol from the **+** menu, or open a `.cow` source file.
2. **From blocks** generates Cowgol for the supported program. Unsupported
   operations produce named diagnostics.
3. Edit the source, then **To blocks** to import it, or **Run as Blocks** to
   import and start the accepted program on the canvas and virtual circuit.
4. With a machine selected, **Run via blocks** opens the existing circuit
   debugger after successful conversion. Its established build/emulate/flash
   actions apply to the resulting pseudocode and the selected target.
5. Native **Cowgol on CP/M** and **Cowgol on DOS** compile the original source
   on the hosted service and hand the executable to the existing machine
   loaders. Downloads include Z80 and 8080 CP/M `.COM`, DOS `.EXE`, and compiled
   C source. These actions require the companion compiler-service deployment.

Syntax highlighting, editable optional tabs, the overflow language menu,
source downloads, reopen/autosave, conversion, and keyboard Run all recognize
Cowgol. Hosted actions obey the distribution's existing remote-toolchain policy.
Failed, refused, superseded, or wrong-target results cannot replace the current
project or start an old program.

## Conversion contract

The bridge is executable translation of a checked subset. It supports one
sequential flag script, signed `int32` variables, integer arithmetic and
comparisons, conditions, bounded repeats, repeat-until, forever, literal text,
text variables, simple nonrecursive typed procedures on import, explicit
message output, turtle graphics and digital circuit operations. Procedure
generation is not implemented. Generated source uses ordinary procedures from
`cowgol.coh` and `brickwright.coh`.

| Surface | Current bridge |
| --- | --- |
| Canvas | Clear; pen up/down, colour and size; move, turn, go-to, direction, X/Y operations and reporters |
| Circuits | Declared digital pins; mode setup, electrical high/low, logical on/off, input read and output-latch toggle |
| Timing | Literal waits converted between seconds and integer milliseconds |
| Console | `bw_print_text` and `bw_print_number` |
| Control | Assignments, integer expressions, comparisons, IF/ELSE, loops and stop |

Pin names and active-low polarity survive conversion. A toggle changes the
requested output latch rather than reading a possibly clamped electrical input.
Readable `# @bw-*` comments carry device and pin declarations; executable source
is always parsed, so edits to conditions and output calls change the imported
program.

**All intermediate numeric values must stay in signed 32-bit range.** Cowgol
wraps integers and Scratch uses a wider numeric model. The converter refuses
provable overflow and reports this range qualification on accepted conversions;
it does not prove arbitrary loop bounds or external inputs safe. Division,
remainder, floating point, narrower/unsigned numeric declarations, uninitialized
variables, arrays, arbitrary pointers/casts, recursion, concurrent events,
unsupported sprite assets, analog/PWM modes, and unported peripheral calls
are refused. String literals must fit Cowgol's 127 UTF-8-byte limit.

The native host ABI is larger than the conversion subset. Its pixel/rectangle/
circle/text drawing and analog callbacks do not imply reverse conversion for
those operations. Ordinary Cowgol byte-stream `print` is also not silently
changed into Scratch's message output; use `bw_print_*` for portable conversion.

## Machines and execution routes

| Machine family | Checked-subset route | Native Cowgol route |
| --- | --- | --- |
| 8051 / STC | Existing C backend and simulator/flasher | No new bare-metal backend |
| AVR / Arduino / ATtiny | Existing C backend and supported simulator/flasher | No new bare-metal backend |
| Pico / RP2040 | Existing MicroPython or C backend | No new bare-metal backend |
| STM32 | Existing C backend | No new bare-metal backend |
| ESP8266 | Existing blob-free C backend | No new bare-metal backend |
| micro:bit / Calliope | Existing MicroPython route | No new bare-metal backend |
| Eater 6502 | Existing C/BASIC routes | Cowgol's BBC/Tube backend is not a breadboard port |
| Z80 | Existing BASIC/C circuit routes | Real Z80 CP/M and 8080-compatible CP/M compilers |
| 8086 | Existing assembly/C circuit routes | Real DOS MZ compiler |
| Arcade / PyBadge | Existing PXT/TypeScript route where available | No new native backend |
| RISC-V | Pseudocode backend remains an existing open task | No native service target added |

Availability follows actual existing lowered routes. A selected backend still
enforces its own supported operations; accepting a Cowgol turtle program does
not give a display-less MCU a graphics runtime. Bare-chip ports are not inferred
from a matching CPU name. The shared producer documents exact accepted digital
coordinates and reserved pins in
[COWGOL-CONVERSION.md](https://github.com/CrispStrobe/sb3-creator/blob/feat/cowgol-integration-20261128/docs/COWGOL-CONVERSION.md).

The matrix keeps native CP/M and DOS facts **open** until the companion service
is deployed. Their console wrappers implement portable text/number output;
native canvas and GPIO require a real host binding and fail to compile/link
when absent. Circuit programs can use the Blocks route today.

## Companion repositories and reproducibility

All work is on `feat/cowgol-integration-20261128` in `brickwright`,
`sb3-creator`, `cowgol`, and `stc-compiler`. No production deployment or default
branch merge is part of these checkpoints.

The Cowgol fork supplies a dependency-light C bootstrap, an explicit fixed-width
host ABI, portable CP/M/DOS console headers and real compiler regression tests.
The compiler service builds pinned Z80 CP/M, 8080 CP/M, DOS and C backends,
checks source/includes and artifact limits, and packages them for Docker,
Hugging Face and Vercel. Missing toolchains return an explicit failure.

Brickwright vendors the shared producer at the exact SHA in `vendor-pins.json`
through the existing flatten-and-rewrite sync and refreshes tracked mirrors.
That pin also owns the example gallery: moving it adopts the producer's
intervening gallery and export fixes, so those generated updates accompany the
pin rather than leaving two upstream versions in the tree.

The earlier CrispBASIC branches informed the portable-call and pin-contract
design. They remain separate work; this feature does not merge them or label
their experimental behavior as Cowgol support.

## Validation

`test/cowgol-integration.test.mjs` checks source persistence, target visibility,
real machine-loader handoff, refusal/current-source behavior, restricted builds,
and exact native artifact identity. Existing editor ownership/conversion tests
cover the asynchronous import lifecycle. The producer tests also execute emitted
Cowgol through the actual compiler and compare its host trace. The service
tests run compiled `.COM` and `.EXE` files in independent CP/M and DOS emulators.

These checks qualify the conversion and software execution paths. They do not
claim physical-board testing or a full production GUI build.
