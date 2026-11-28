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
4. With a machine selected, **Run via blocks** imports successfully, then uses
   the existing circuit debugger and its build/emulate/flash actions. RISC-V
   instead compiles the accepted console Blocks project and loads the RV32 image.
5. **Cowgol on CP/M**, **Cowgol on DOS**, **Cowgol on RISC-V**, and
   **Cowgol on Eater 6502** compile the original source on the hosted service
   and hand the executable to the
   existing machine loaders. Downloads include Z80 and 8080 CP/M `.COM`, DOS
   `.EXE`, RISC-V `.ELF`, Eater 6502 ROM `.BIN`, and compiled C source. These
   actions require the companion compiler-service deployment.

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
| Eater 6502 | Existing C/BASIC routes | ROM-safe 65C02 compiler, 32 KiB boot ROM, ACIA console and VIA digital GPIO |
| Z80 | Existing BASIC/C circuit routes | Real Z80 CP/M and 8080-compatible CP/M compilers |
| 8086 | Existing assembly/C circuit routes | Real DOS MZ compiler |
| Arcade / PyBadge | Existing PXT/TypeScript route where available | No new native backend |
| RISC-V | Checked int32 console C through hosted GCC; one sequential flag script | Full Cowgol → cgen → RV32 GCC/picolibc → executable ELF, using console output |

Availability follows actual existing lowered routes. A selected backend still
enforces its own supported operations; accepting a Cowgol turtle program does
not give a display-less MCU a graphics runtime. Bare-chip ports are not inferred
from a matching CPU name. The shared producer documents exact accepted digital
coordinates and reserved pins in
[COWGOL-CONVERSION.md](https://github.com/CrispStrobe/sb3-creator/blob/feat/cowgol-integration-20261128/docs/COWGOL-CONVERSION.md).

The matrix keeps native CP/M, DOS, RISC-V and Eater facts **open** until the
companion service is deployed. All four supply portable text/number output;
Eater also supplies serial input and checked VIA digital calls. Native canvas,
timing, and other unimplemented host calls fail to compile/link. Circuit
programs can also use the established Blocks route.

### RISC-V console

Select **RISC-V**, open **Cowgol**, and choose **Cowgol on RISC-V** to compile the
original program. The keyboard Run action selects that route on RISC-V.
Cowgol's C backend and the service's RV32 GCC toolchain produce a real ELF for
Brickwright's four-MiB RV32 machine. Arrays, pointers, allocation and integer
division are available through this full compiler route. This is a port through
generated C, not a new Cowgol RISC-V instruction selector. Console output is
implemented; file I/O, command-line arguments, clocks, GPIO and graphics are
not supplied. `argv.coh` sees a safe empty argument list.

**Run via blocks** is a separate checked route: after a successful import, the
current Blocks project becomes console C and is compiled with hosted
`riscv32-gcc`. Pseudocode also offers **Run on RISC-V via Blocks**. Programs may
declare `DEVICE RISCV32`; a declaration-free Cowgol program retains the selected
RISC-V machine for this action. An explicit conflicting device declaration is
refused before replacing the project.

The console lowerer supports int32/text variables, assignment, addition,
subtraction, multiplication, bit operations, comparisons, short-circuit
conditions, loops, output and stop. Arithmetic intermediates are checked at
runtime; overflow prints an error and exits. GPIO, canvas, waits, concurrent
events, procedures, lists and unsupported reporters are refused before C is
submitted. There is no qualified timer in this console profile. It requires
full GCC and does not claim compatibility with the browser's shecc subset.
The producer's [RISC-V console contract](https://github.com/CrispStrobe/sb3-creator/blob/feat/cowgol-integration-20261128/docs/RISCV-CONSOLE.md)
documents the exact boundary.

For native Cowgol, both the service and editor validate the ELF architecture,
entry point, load segments and uninitialized workspace. The top 32 KiB of guest
RAM remain reserved for the stack. The image the editor boots must exactly
match the downloadable ELF, including zero-initialized workspace. Source,
device or project changes revoke a pending run; edits to Blocks during either
module loading or compilation revoke the checked route as well.

### Eater 6502 ROM

Select **Eater 6502**, open **Cowgol**, and choose **Cowgol on Eater 6502**.
Keyboard Run selects the same native action; **Download Eater 6502 ROM** saves
the exact 32 KiB image. The loader selects the canonical 1 MHz W65C02 board:

| Resource | Native ROM contract |
| --- | --- |
| RAM | `$0000–$3FFF`; zero-page workspace and hardware stack kept separate |
| ROM | `$8000–$FFFF`; reset at `$8000`, NMI/reset/IRQ vectors at the top |
| VIA | `$6000`; PA0–PA7 and PB0–PB7 digital input/output |
| ACIA | `$5000`; 19200 baud, 8N1 serial console |

The action supplies this complete map even if another 6502 circuit was
previously selected. The editor checks the compiler identity, exact ROM size,
reset and interrupt vectors, halt/interrupt instructions, and reported
workspace/relocation bounds before handing the ROM to the existing loader.
The service separately checks those bounds against real assembler labels.

This target has a ROM-safe backend and its own startup/runtime. Existing
Cowgol 6502 code assumes writable program memory: nested calls patch return
addresses, and initialized arrays can live alongside code. The Eater backend
places return slots and writable initialized data in RAM, and startup copies
initial data from ROM on every reset. Tests audit CPU writes and require no
attempted write into ROM. Arrays, records, pointers, native integer arithmetic
and the allocator are exercised on the actual machine emulator.

`bw_print_text`, `bw_print_number`, `print_char` and `get_char` use the serial
console. `bw_pin_mode` accepts mode `0` (input) or `1` (output), and
`bw_digital_write`, `bw_digital_read` and `bw_digital_toggle` use the VIA.
Native pins `0..7` mean PA0..PA7 and `8..15` mean PB0..PB7. Invalid pins or
modes stop with an explicit diagnostic. Toggle uses the requested output
latch, including when a measured input differs from the output latch. These
bindings own both VIA output latches; direct writes to the VIA must not be
mixed with their saved latch state.

The native runtime owns the VIA and clears its timer mode, so PB7 is available
as native pin 15. The checked conversion route still excludes PB7 because its
existing C/BASIC runtime reserves that pin for a timer. A native Cowgol program
using pin 15 can therefore compile successfully while **To blocks** refuses it.
Pull-ups, analog/PWM, clocks/waits, graphics and file I/O have no native binding.
Empty command-line arguments are supported. RAM, zero-page workspace, ROM,
heap and the hardware stack are finite; oversized static allocations fail
explicitly. The compiler reserves eight bytes at the top of RAM for allocator
bookkeeping. Each complete input parameter list and each complete output
parameter list must independently fit 128 bytes; larger lists fail compilation
instead of overflowing the inherited transfer loop. The 256-byte hardware stack
does not establish safety for arbitrary call depth or inline assembly. Hardware
testing remains outstanding.

## Companion repositories and reproducibility

All work is on `feat/cowgol-integration-20261128` in `brickwright`,
`sb3-creator`, `cowgol`, and `stc-compiler`. No production deployment or default
branch merge is part of these checkpoints.

The Cowgol fork supplies a dependency-light C bootstrap, an explicit fixed-width
host ABI, an embedded C console profile, portable CP/M/DOS console headers,
and the Eater ROM backend/runtime. Array sizes, record sizes, static frames and
combined call workspace are checked before their 16-bit object representation
can wrap; the checks are present in both compiler source and bootstrap.
The compiler service builds pinned Z80 CP/M, 8080 CP/M, DOS, RISC-V, Eater ROM and C routes,
checks source/includes and artifact limits, and packages them for Docker,
Hugging Face and Vercel. Missing toolchains return an explicit failure.

Brickwright vendors the shared producer at the exact SHA in `vendor-pins.json`
through the existing flatten-and-rewrite sync and refreshes tracked mirrors.
That pin also owns the example gallery: moving it adopts the producer's
intervening gallery and export fixes, so those generated updates accompany the
pin rather than leaving two upstream versions in the tree.

The earlier CrispBASIC branches informed the portable-call and pin-contract
design. The producer pin also includes its CrispBASIC generator work, merged
to the producer's main branch during this integration. Cowgol has its own
checked reader and native routes; its GUI changes do not activate CrispBASIC's
separate experimental browser runtime.

## Validation

`test/cowgol-integration.test.mjs` checks source persistence, target visibility,
real machine-loader handoff, refusal/current-source behavior, restricted builds,
and exact native artifact identity. `test/cowgol-platforms.test.mjs` covers RV32
ELF/image identity, Eater ROM/vector/layout validation, canonical machine
selection, unsafe-memory refusal and actual editor-method ownership.
Existing editor ownership/conversion tests
cover the asynchronous import lifecycle. The producer tests also execute emitted
Cowgol through the actual compiler and compare its host trace. The service
tests run compiled `.COM` and `.EXE` files in independent CP/M and DOS emulators,
and RV32 ELF images and Eater ROMs on the pinned Brickwright machines. The producer additionally
compiles and executes the checked console C on that same RV32 machine.

The reproducible HTTP check uses Brickwright's actual client against a child
local service, then executes the returned artifact on the pinned machine:

```sh
node scripts/verify-cowgol-platforms.mjs \
  --service ../stc-compiler --bundle ../cowgol-bundle --board ../bw-board \
  --riscv-gcc-stage ../riscv-gcc-stage --tmpdir ../validation
```

The default checks native RISC-V and compiled C export. It exercises arrays,
integer division, allocation and both signed int32 limits. Dependencies and a
built compiler bundle must already exist; it installs nothing and sends no
source to a deployed service. The JSON result records exact compiler and
machine commits. Add `--targets riscv32,cowgol-cgen,eater6502` to include the
Eater ROM, its serial output, cold-RAM startup and a no-ROM-write audit. Use
`--help` for paths and explicit target selection.

These checks qualify the conversion and software execution paths. They do not
claim physical-board testing or a full production GUI build.
