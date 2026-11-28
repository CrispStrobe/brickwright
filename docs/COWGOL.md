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
   **Cowgol on Eater 6502**, **Cowgol on Arduino Uno**, or **Cowgol on Arduino Nano** compile the original source on the hosted service
   and hand the executable to the
   existing machine loaders. Downloads include Z80 and 8080 CP/M `.COM`, DOS
   `.EXE`, RISC-V `.ELF`, Eater 6502 ROM `.BIN`, ATmega328P `.HEX`, and compiled C source. These
   actions require the companion compiler-service deployment.
6. On a qualified native machine, **Run Blocks via Cowgol** is available in
   both the Cowgol and pseudocode editors. It first checks the selected native
   runtime, imports the accepted source into Blocks, then compiles those Blocks
   with Cowgol. The existing C/BASIC **Run via blocks** action remains available.
7. The Cowgol action menu also offers **Run in CP/M 2.2 (Z80)** and
   **Run in CP/M 2.2 with display**. These boot the existing full CP/M computer,
   mount the compiled program and launch it at the command prompt. With Z80
   selected, pseudocode and Cowgol also offer the corresponding checked
   **Blocks via Cowgol** actions. The full-source menu also offers explicit
   8080-compatible compiler variants, which still execute on the Z80 CPU.
8. **Download Blocks via Cowgol** validates the active pseudocode or checked
   Cowgol draft and downloads the selected machine artifact. It leaves the
   current project and authored buffers intact and does not start a machine.
9. The DOS action menu also offers **Cowgol in MS-DOS 2.0** and the matching
   display actions on 8086, 80186 and 80286. These boot a fresh OS disk and
   launch `COWGOL.EXE` through the actual DOS kernel. Checked source has the
   corresponding **Blocks via Cowgol** actions.

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

The explicit **Run Blocks via Cowgol** action uses a separate `native-int32`
generation profile. It checks intermediate addition, subtraction and
multiplication at runtime and stops with a diagnostic on overflow. It lowers
Boolean conditions to control flow so the unused branch does not read a pin or
execute an arithmetic helper. This stronger execution contract does not change
the ordinary, reversible **From blocks** output or broaden the reader to full Cowgol.

The native host ABI is larger than the conversion subset. Its pixel/rectangle/
circle/text drawing and analog callbacks do not imply reverse conversion for
those operations. Ordinary Cowgol byte-stream `print` is also not silently
changed into Scratch's message output; use `bw_print_*` for portable conversion.

## Machines and execution routes

| Machine family | Checked-subset route | Native Cowgol route |
| --- | --- | --- |
| 8051 / STC | Existing C backend and simulator/flasher | No new bare-metal backend |
| Arduino Uno / bare ATmega328P | Existing C backend; additional checked Blocks → Cowgol console/digital route with literal waits | Full Cowgol → cgen → AVR GCC → Intel HEX; fixed 16 MHz Uno runtime with blocking millisecond delays |
| Arduino Nano (classic ATmega328P) | Existing C backend; checked native console/digital route with literal waits | Separate `arduino-nano` HEX profile: 16 MHz, 30 KiB application flash, 2 KiB bootloader reservation |
| Other AVR / Arduino / ATtiny | Existing C backend and supported simulator/flasher | No native Cowgol port qualified |
| Pico / RP2040 | Existing MicroPython or C backend | No new bare-metal backend |
| STM32 | Existing C backend | No new bare-metal backend |
| ESP8266 | Existing blob-free C backend | No new bare-metal backend |
| micro:bit / Calliope | Existing MicroPython route | No new bare-metal backend |
| Eater 6502 | Existing C/BASIC routes; additional checked Blocks → Cowgol console/digital route | ROM-safe 65C02 compiler, 32 KiB boot ROM, ACIA console and VIA digital GPIO |
| Z80 | Existing BASIC/C circuit routes; checked Blocks → Cowgol CP/M console route | Real Z80 CP/M and 8080-compatible compilers; direct program bench or full CP/M 2.2 with serial/TMS9918 output |
| 8086 / 80186 / 80286 | Checked `DEVICE I8086` console programs select the execution CPU | DOS MZ on the service bench or a fresh booted MS-DOS 2.0 disk; console and 720×400 Controller text output; 80286 executes in real mode |
| 80386 | Exact `DEVICE I80386` console source, or checked `I8086` source with an explicit 386 execution selection | The same 16-bit DOS MZ on the actual 386 core, in ordinary real mode; separate DOS-service console/display/keyboard route |
| Arcade / PyBadge | Existing PXT/TypeScript route where available | No new native backend |
| RISC-V | Checked int32 console C through hosted GCC, or checked Blocks → Cowgol; one sequential flag script | Full Cowgol → cgen → RV32 GCC/picolibc → executable ELF, using console output |

Availability follows actual existing lowered routes. A selected backend still
enforces its own supported operations; accepting a Cowgol turtle program does
not give a display-less MCU a graphics runtime. Bare-chip ports are not inferred
from a matching CPU name. The shared producer documents exact accepted digital
coordinates and reserved pins in
[COWGOL-CONVERSION.md](https://github.com/CrispStrobe/sb3-creator/blob/feat/cowgol-integration-20261128/docs/COWGOL-CONVERSION.md).

The matrix keeps native CP/M, DOS, RISC-V, Eater, Uno and Nano facts **open** until the
companion service is deployed. All supply portable text/number output;
Eater, Uno and Nano also supply serial input and checked digital calls. Uno and Nano supply
blocking delays; native clocks, canvas and other unimplemented host calls fail to compile/link. Circuit
programs can also use the established Blocks route.

### Checked native Blocks and pseudocode

Select Z80, 8086, 80386, RISC-V, Eater 6502, Arduino Uno, bare ATmega328P or classic Nano, then use
**Run Blocks via Cowgol** in the pseudocode or Cowgol tab. To start with an
existing Blocks program, use **From blocks** first. The selected machine is
retained when the source has no device declaration. A conflicting declaration,
unsupported native operation, noncanonical clock, or unsupported memory map
is refused before the current project is replaced.

The shared producer API is `generateCowgol(project, {target})`. Qualified
targets are `z80-cpm`, `i8080-cpm`, `dos`, `riscv32`, `eater6502` and
`atmega328p`, and `arduino-nano`. CP/M, DOS and RISC-V accept sequential int32/text console
programs. Eater adds digital VIA operations; Uno and Nano add digital GPIO and input
pull-ups and literal millisecond waits. Native Eater can use PB7, but its ordinary C export is cleared with
a diagnostic when that older backend cannot represent the pin. The reversible
Cowgol reader still has its existing PB7 restriction. Eater active-low input
is refused because that pin declaration requires a pull-up the VIA runtime
does not supply; active-low outputs remain supported.

Native waits are available on Uno and Nano; the other native profiles still refuse them.
Graphics, clock queries, concurrent events, custom procedures and lists remain
unavailable in these profiles. Calls are not silently removed. Source edits,
edit/revert, target or device-metadata changes, project replacement, Blocks
edits, cancellation and unmounting revoke pending builds during module loading
and compiler requests. Stop during the import phase prevents its subsequent
compiler launch. The full-source actions retain arrays, pointers and other
Cowgol constructs beyond the checked reader/generator subset.

### CP/M 2.2 computer and Controller display

The action menu provides two full CP/M computer surfaces in addition to the
existing direct **Cowgol on CP/M** program bench:

| Action | Execution and output |
| --- | --- |
| Cowgol on CP/M | Compiled program on the existing Z80 CP/M service bench |
| Run in CP/M 2.2 (Z80) | Digital Research CCP and BDOS with the existing BIOS and RAM disk; serial console |
| Run in CP/M 2.2 with display | The same full OS with the TMS9918 BIOS; 256×192 text display in Controller and serial console |

The full-source actions compile the active Cowgol source directly to a Z80
`.COM`. On the full-OS routes, the exact validated bytes become `COWGOL.COM`
on drive A:. The runner waits for CP/M's `A>` prompt, types `COWGOL`, and
executes the program through the real CCP and BDOS. Returning from the program
reaches a new prompt; `DIR` shows the mounted executable. Each run starts a
fresh machine and RAM disk. Files created in that guest are not an autosave of
the Brickwright project.

With **Z80** selected, the pseudocode and Cowgol action menus also offer
**Blocks via Cowgol in CP/M 2.2** and **Blocks via Cowgol on CP/M display**.
They apply the same checked sequential int32 console profile as the native
Blocks bench action. Unsupported GPIO, timing and canvas operations are refused
before importing the source or replacing the project. The TMS9918 surface
displays the OS console; it does not add a native turtle or pixel API to Cowgol.

Both full-OS routes use the existing Z80 CPU. An 8080-compatible `.COM` can be
qualified on that machine, but this is not an 8080 CPU-emulation claim. These
actions require both the hosted-toolchain and machine-image distribution
policies to permit them. The OS/BIOS bytes come from the app's existing bundled
CP/M assets. Pending launches are revoked when the source, Blocks, project,
selected device or device metadata changes, including during media activation,
lazy runner/ROM loading and the wait for the CP/M prompt. Stop settles a pending
launch promptly; an older cancelled launch cannot stop its replacement. Once
the program command is queued, the debugger owns the running guest. A failed
OS attachment remains an error in the editor and cannot replay stale media.

`test/cowgol-computer-surfaces.test.mjs` exercises the actual editor methods and
machine activation, including exact bytes, mounted filename, automatic command,
Controller configuration, policy gates and stale-result cancellation.
`test/cowgol-cpm-launch-ownership.test.mjs` exercises the actual panel and runner
methods across delayed attachment, cancellation, failure and replacement.
`scripts/verify-cowgol-cpm-system.mjs` is the separate exact-machine witness:

```sh
node scripts/verify-cowgol-cpm-system.mjs \
  --com program.com --target z80-cpm --expect "42" \
  --board ../bw-board --out cpm-system-report.json
```

Supply a `.COM` built by the qualified Cowgol compiler and the expected output
from its source. The witness requires the exact pinned `bw-board`, boots the
real OS through the GUI's Z80 target factory and debug execution loop, checks
program output and return to the prompt on both surfaces, and reads back the
TMS9918 text cells and rendered pixels. Missing prerequisites fail; no test is
silently skipped. This machine execution witness is separate from a rendered
browser interaction check.

### DOS CPU variants and Controller text display

Full-source Cowgol actions select the **8086**, **80186**, **80286** or
**80386** DOS service bench, with a console or Controller text display.
Checked `DEVICE I8086` source offers the same choices through **Blocks via
Cowgol**. Exact `DEVICE I80386` source retains its execution selection and
uses the separate 386 route by default, including keyboard Run and checked
artifact downloads. The compiler target remains `dos`, producing a 16-bit
MZ executable; this does not introduce 32-bit code generation.

All eight routes load identical validated executable bytes. The Controller
shows the actual 80×25 mode-3 text screen, rendered at 720×400 pixels. Its
keyboard supplies DOS ASCII input, including when a program is already
waiting. Programs exit through the service and notify the existing debugger.
These service routes do not boot an OS disk. The 80286 and 80386 execute in
ordinary real mode.

The 80386 route uses the actual pinned `ExperimentalI80386` core and its
32-bit debugger. Its private DOS adapter updates segment-cache bases and
preserves architectural FLAGS and the upper halves of registers across the
16-bit service boundary. The machine configuration must explicitly name
`machineConfig: "dos-service"`, a functional 80386 CPU and exactly one COM or
EXE slot. It cannot reuse an AT BIOS/disk configuration or native-block
execution. Entering protected mode, virtual-8086 mode, paging or a nonstandard
segment layout is refused. Instruction scheduling is functional, not measured
386 cycle timing; the route inherits the 386 debugger's forward-execution
limitations.

`DEVICE I80386` supplies a console contract only. GPIO/peripheral declarations
and unsupported timing remain refused. Its ordinary device C backend remains
unavailable; **To blocks** and **From blocks** retain the Cowgol/pseudocode
views, clear that unavailable C view and show its diagnostic. The new source
contract does not grant 8086 circuit hardware to the 386 machine.

`scripts/verify-cowgol-dos.mjs` exercises the real GUI benches and debugger
loop on the exact pinned machines. It checks all four CPUs on both surfaces,
complete program output, exit status, screen cells and pixels, live keyboard
input, and variant-specific shift/flag behavior. The 386 witness additionally
executes operand-size-prefixed 32-bit arithmetic, proves upper EAX and IOPL
preservation, observes display changes after live input, and tests refusal
after an actual `MOV CR0` mode switch.

### Booted MS-DOS 2.0

**Cowgol in MS-DOS 2.0** and **Cowgol on MS-DOS 2.0 display** are separate
OS-boot actions for 8086, 80186 and 80286. Checked pseudocode/Cowgol offers
matching **Blocks via Cowgol** actions. Each CPU/display choice is explicit.

The helper verifies the SHA-256 and size of the app's existing 360 KiB
MS-DOS 2.0 FAT12 image, copies the compiled MZ into `COWGOL.EXE`, and writes
`AUTOEXEC.BAT` to launch it. Readback must preserve both files exactly. The
pinned disk has room for a **319,488-byte executable**, after reserving one
cluster for the startup command. A larger program can still use the direct
DOS-service route subject to its own loader limits.

`IO.SYS`, `MSDOS.SYS` and `COMMAND.COM` execute in the guest. The machine
adapter supplies BIOS services; this qualification does not include a ROM
BIOS or hardware disk controller. The guest DOS kernel handles INT 21h,
loads the MZ and returns to the command shell when it exits. The Controller
shows the same 720×400 text screen and accepts live keyboard input. Each run
starts with a fresh disk; guest writes are not project autosaves. The 386
OS-boot route remains outside this qualification.

These actions require both hosted-toolchain and machine-image policies.
Missing or changed OS images, disk capacity errors and failed attachments
remain visible errors. Source/project/Blocks/device edits, Stop and image
policy changes revoke pending work across compilation, image preparation,
activation and attachment. A late result cannot start an obsolete program.

`scripts/verify-cowgol-dos-disk.mjs` verifies six real boots. It checks the
unchanged system files, exact injected executable, the INT 21h vector moving
from the service trap into guest RAM, full program output, actual text pixels,
return to the live shell, zero guest `ERRORLEVEL`, and a subsequently typed
command. To check a separately compiled program:

```sh
node scripts/verify-cowgol-dos-disk.mjs \
  --exe program.exe --expect "42" --board ../bw-board \
  --out dos-boot-report.json
```

The combined HTTP/CLI witness builds full Cowgol once through each frontend
entry point, requires identical artifacts, and runs all eight DOS-service and
six OS-boot configurations:

```sh
node scripts/verify-cowgol-platforms.mjs \
  --service ../stc-compiler --bundle ../cowgol-bundle --board ../bw-board \
  --targets dos,cowgol-cgen --cli --tmpdir ../validation
```

### Arduino Uno / ATmega328P and classic Nano

Choose **Cowgol on Arduino Uno** to build the original source and start the
existing AVR debugger with the exact validated Intel HEX. Keyboard Run uses
this route on Uno and bare ATmega328P; the menu also offers **Download
ATmega328P .HEX**. The firmware handoff fixes the CPU and clock even when an
older debugger selection used a different AVR part or frequency.

| Resource | Native AVR contract |
| --- | --- |
| MCU and clock | ATmega328P, 16 MHz |
| Program flash | `$0000–$7DFF`; final 512 bytes reserved for the Uno bootloader |
| SRAM | `$0100–$08FF`; static data ends by `$0700` |
| Allocation | Bounded 512-byte arena, included in static SRAM; allocation failure returns null |
| C stack reservation | `$0700–$08FF`, 512 bytes; not a proof of arbitrary call-depth safety |
| Serial | USART0, 9600 baud, 8N1; D0/RX and D1/TX reserved |
| Digital pins | D2–D13 and A0–A5 (native IDs 14–19); input, output and input pull-up |

The runtime implements byte input/output, signed text/number console output,
digital read/write and output-latch toggle. Unsupported or reserved pins and
invalid modes stop with a diagnostic. `argv.coh` observes an empty argument
list. File I/O, clock queries, analog/PWM and graphics are unavailable. The runtime is
plain AVR C; it does not link the Arduino sketch core or emulate missing APIs.

`bw_delay(milliseconds)` accepts a nonnegative signed int32 count and performs
16,000 CPU cycles per millisecond plus small loop/call overhead. Zero returns
without waiting; negative values print a diagnostic and stop. The fixed 16 MHz
profile keeps interrupts disabled, so this is a blocking minimum delay and
does not imply a scheduler or `bw_millis` clock. Literal `wait` statements in
the checked native Blocks profile use this binding, enabling native blink and
timed digital sequences. Variable durations remain outside that generator's
literal-wait contract; full Cowgol can calculate its own int32 duration.

The service checks actual AVR ELF identity, symbols, flash initializers and
SRAM bounds before emitting HEX. The frontend independently checks every HEX
checksum, record length, contiguous flash address, final EOF, reset JMP and
reported memory layout. The reset must enter code after the interrupt vector
table, before any ROM copy of initialized data. Extra address spaces, EEPROM,
bootloader overlap and malformed metadata are rejected before handoff.

Execution tests cover cold SRAM, initialized data, arrays, pointers, integer
division, allocation/free, serial receive/transmit and digital pins on all
three ports. Measured GPIO transitions qualify 0, 1 and 7 ms waits; a bounded
observation of 65,536 ms checks that the count does not narrow to 16 bits.
No physical-board qualification is claimed. Mega, ATmega168P, ATtiny and
other AVR targets remain outside these explicitly qualified native profiles.

**Classic Nano** has its own `arduino-nano` target and **Cowgol on Arduino
Nano** action. It accepts the classic ATmega328P board at 16 MHz. Application
flash is limited to `$0000–$77FF` (30,720 bytes), retaining the final 2 KiB for
either official ATmega328P Nano bootloader variant, in agreement with the
[Arduino AVR board definitions](https://github.com/arduino/ArduinoCore-avr/blob/master/boards.txt).
The linker, compiler service and frontend all enforce this smaller boundary;
an Uno-sized reply cannot satisfy the Nano target. The response must identify
Nano's toolchain, board and bootloader reservation. The debugger still fixes
the underlying MCU to ATmega328P and its clock to 16 MHz.

Nano retains the SRAM, heap, stack, serial and digital-pin contracts above.
A6/A7 have no native digital binding, and analog/PWM operations remain refused.
Nano Every, Nano 33, ATmega168 variants and other Nano families require separate
ports. The execution tests cold-boot the compiled application on the CPU model;
physical bootloader upload transport is not qualified. Use the existing
board-specific upload settings when flashing a separately reviewed artifact.

### Command-line conversion

`bwlite` now accepts `.cow` and `.cowgol` with `read`, `check`, `convert`,
`transpile`, `compile`, `devices` and `retarget`. `--to cowgol` exports the
reversible checked subset, and the existing `--device` option retargets that
subset through the usual pin-aware pipeline. For example:

```sh
node bin/bwlite.mjs check program.cow
node bin/bwlite.mjs convert program.cow --to pseudocode
node bin/bwlite.mjs convert program.sb3 --to cowgol -o program.cow
```

These are source/Blocks conversions; the CLI's `compile` alias does not invoke
the hosted native compiler. Reader and generator refusals exit with status 2
and preserve an existing output file. Integer-profile qualifications go to
stderr. See [CLI.md](CLI.md) for all options.

The terminal also exposes the native profiles explicitly:

```sh
node bin/bwlite.mjs convert blink.bw --to cowgol --target atmega328p -o blink.cow
node bin/bwlite.mjs cowgol targets
node bin/bwlite.mjs cowgol build blink.bw --target atmega328p --out blink.hex
node bin/bwlite.mjs cowgol build program.cow --target z80-cpm --out program.com \
  --endpoint http://127.0.0.1:8000/compile
```

`cowgol build` accepts full Cowgol source directly or validates the original
Blocks graph for `.sb3` and the parsed graph for `.bw`. All eight compiler
outputs are available; C export requires `.cow`/`.cowgol`. The command validates
the artifact using the editor's client, then atomically writes it. Errors and
timeouts preserve prior output, and source/output aliases are refused.

The Code tab's **Download Blocks via Cowgol** offers the same checked native
artifact route for the currently selected machine. It compiles the active draft
through a temporary graph; it neither imports that graph into the current
project nor starts a guest. Parser warnings, device conflicts and unsupported
operations refuse the download. Source edits, selection changes, project or
Blocks edits, Stop and replacement builds revoke pending downloads at each
asynchronous boundary. Ordinary full-source downloads retain full Cowgol
language features. Checked downloads are limited to the native conversion
profiles and do not offer C export.

The producer CLI exposes the same checked profile with
`bw transpile program.bw --to cowgol --target atmega328p`. Its embedded bundle
supports `bwTranspileCowgol(source, device, {target})` and `bwCowgolTargets()`.
The latter reports generator capabilities, separately from compiler installation
or hardware qualification. Native parser warnings and unsupported graph nodes
remain refusals across these surfaces.

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
as native pin 15. The ordinary reversible conversion profile still excludes PB7 because its
existing C/BASIC runtime reserves that pin for a timer. The explicit native
Blocks profile can use PB7 from pseudocode. A native Cowgol program
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
The compiler service builds pinned Z80 CP/M, 8080 CP/M, DOS, RISC-V, Eater ROM, Uno, Nano and C routes,
checks source/includes and artifact limits, and packages them for Docker,
Hugging Face and Vercel. Missing toolchains return an explicit failure. Its
browser demo also exposes all eight targets, including distinct Uno and
classic Nano profiles, and selects the required C/BIN/ELF/HEX format. Cowgol
keeps its fixed clock contract when switching between targets. Authored source
is preserved across language changes.

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

`test/cowgol-download-surfaces.test.mjs` verifies current-draft export without
project mutation and stale-download cancellation. `test/cowgol-dos-surfaces.test.mjs`
verifies all four DOS CPU selections, booted MS-DOS actions, Controller
display/keyboard and ownership. `test/cowgol-i80386-surfaces.test.mjs` covers
the distinct 386 schema, runner selection and asynchronous attachment.
`test/cowgol-dos-disk.test.mjs` checks base-image integrity, disk capacity,
exact file preparation and cancellation before FAT mutation.
`test/cowgol-native-surfaces.test.mjs` runs the actual editor methods with the
real shared generator, validates AVR artifacts, and exercises cancellation and
ownership at each asynchronous boundary. `test/bwlite-cowgol-cli.test.mjs`
invokes real CLI subprocesses, executes converted JavaScript, round-trips SB3,
and checks that refusals do not overwrite prior outputs.

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

To include Uno or Nano, supply a bundle with `atmega328p` or `arduino-nano` and a clean avr8js checkout
at the exact SHA in `scripts/lib/avr8js-spec.mjs`:

```sh
node scripts/verify-cowgol-platforms.mjs \
  --service ../stc-compiler --bundle ../cowgol-bundle-avr \
  --targets atmega328p,arduino-nano --avr8js-root ../avr8js-oracle \
  --avr-runner ../cowgol/tests/avr-run.mjs --tmpdir ../validation
```

The AVR runner must come from a clean Cowgol checkout matching the bundle's
compiler revision. This check crosses the actual HTTP route, boots the exact
downloaded HEX twice with cold SRAM, checks stack use and immutable flash, and
records flash/SRAM size, cycles, and the exact AVR emulator commit. A reduced
cgen/AVR bundle can be checked independently from a legacy-target bundle.

These checks qualify the conversion and software execution paths. They do not
claim physical-board testing or a full production GUI build.

The CP/M and terminal surface witness builds through both the real frontend
client and `bwlite cowgol build`, requires byte-identical artifacts, then boots
them under CP/M 2.2 with serial and TMS9918 BIOSes:

```sh
node scripts/verify-cowgol-platforms.mjs \
  --service ../stc-compiler --bundle ../cowgol-bundle --board ../bw-board \
  --targets z80-cpm,i8080-cpm,cowgol-cgen --cli --tmpdir ../validation
```

The source exercises arrays, allocation, integer division/remainder and both
signed int32 limits. Both CP/M compiler targets execute on the exact pinned
Z80 machine, produce the complete expected console trace, return to `A>`, and
appear in `DIR`. The display run also checks actual text cells and rendered
pixels. C export is compiled and executed on the host. The dedicated Cowgol
workflow runs this witness and archives its compiler/machine identities and
artifact/display hashes as `cowgol-native-surfaces`.
