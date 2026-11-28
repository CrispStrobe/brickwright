# Brickwright

**Build circuits. Program machines. See how they work.**

Brickwright is a free, open-source workbench for electronics and
programming that runs entirely in a web browser, and as a native desktop and
mobile app. You wire up a circuit on a virtual breadboard and watch it behave,
write a program as Scratch blocks or as real code, run that program on an
emulated chip or a real one, step through it in a debugger, and follow guided
lessons the whole way.

- **For learners** meeting electronics and microcontrollers for the first time.
- **For teachers** who need a zero-install lab that works on a school Chromebook.
- **For retro-computer and LEGO builders** who want to try a design — a Z80
  board, an STC flash program, a SPIKE robot — in software before touching the
  real hardware.

The earlier TurboWarp-based editor lives in [Brickwright Legacy](https://github.com/CrispStrobe/brickwright-legacy) and remains available at its [web editor](https://brickwright-legacy.vercel.app/editor.html). See the [repository migration notes](docs/REPOSITORY-RENAME.md) for compatibility links.

**Try it now (web)** · <https://brickwright.vercel.app>
**Native apps:** Tauri wrappers target macOS, Windows, Linux, iOS and Android.
See [local macOS testing](docs/LOCAL-MACOS-ROBOT-CAD.md) for the robot/CAD build;
repository merges do not imply a new App Store or TestFlight delivery.

---

## What you can do

### Build and control 3D robot assemblies

Enable **Settings → Workspace → CAD Editor**, then open CAD and expand
**Program** in the CAD toolbar. The self-contained Scout example includes an
editable printable rover, yellow TT motors, an Uno, a battery, an H-bridge and
its blocks/pseudocode. Motor current drives physical joints; measured shaft
motion returns encoder feedback to the program. Compiled Uno firmware can use
the same connection. Atlas adds a forklift with a driven mast and tilt joint.
The bundled curated library has **302 models with previews: 154 editable source
models and 148 mesh models**. Additional Adafruit archive folders are original
files, separate from this screened catalogue. Their 482 component folders now
have bundled thumbnails and selection previews too.

CAD stays optional and off by default. The simulation is educational rather
than calibrated hardware certification; Pico firmware coupling and additional
physical sensor bindings remain open work. See
[supported components, limits and validation](docs/CIRCUIT-CAD-CO-SIMULATION.md).

### Design and measure circuits

Drag parts onto a breadboard, wire them together, and press the green flag.
An analog circuit engine uses modified nodal analysis to solve supported
electrical models. State and measurements follow simulation time, independently
of display frames, so you can see node voltages, LED brightness and meter
readings as you change things. Model coverage and accuracy vary by component;
a successful numerical solve is not physical-device certification.

- A full parts bin: power, resistors, capacitors and other passives, LEDs,
  transistors and MOSFETs, logic ICs, sensors, displays, motors, servos,
  meters, and microcontroller boards.
- **Design-rule checks** catch the mistakes beginners actually make — a missing
  series resistor, a reversed LED or diode, a short across the supply, a
  floating input, a GPIO pin driven past a safe voltage.
- A realistic board view plus an automatically generated schematic.
- Open and save circuits in the common formats: **KiCad, EasyEDA, EAGLE and
  LTspice**.

For repeatable headless measurements, the pinned `bw-circuit-ui` package also
provides the `bwc` CLI: voltage traces, signed meter readings, finite streaming
captures, saved receipts and explicit reference comparisons. Invoke it with
`node node_modules/bw-circuit-ui/bin/bwc.mjs`. See the
[CLI instrument guide](https://github.com/CrispStrobe/bw-circuit-ui/blob/master/docs/CLI-INSTRUMENTS.md)
for supported models, sample rates and bounded precision captures. CLI and GUI
acquisition limits differ; neither implies an unmodelled oscilloscope front end.

### Program a Logikus with wires

Open **Widgets → Logikus Lab**, or search **Logikus** in **Lessons**. Ten
switches operate five independent contact banks each; ten lamps show the
results. Ten editable programs cover AND/OR/NOT, XOR, a half-adder, majority
voting, the river-crossing puzzle, a ten-bit code lock and a railway crossing. Follow a lamp's
connection path, edit the wires, and use **Test all states** to find a concrete
input that disagrees with a preset's goal. **Use in Widgets** makes the same
logic available through a live control panel. Wiring and switch settings travel
with `.sb3` projects and can also be exported as JSON.

The railway scene connects route requests, occupied sections and stop/go
signals to the editable contact network. Its exhaustive checker reports unsafe
permissions separately from target mismatches: an always-red circuit can pass
the safety checks while failing to permit a clear, requested route.

Seven English/German lessons teach prediction, testing and the distinction
between combinational logic and a sequence supplied by the person. The lab
models ideal contacts; its highlights show source connectivity, not measured
current. See [Logikus Lab: operation, model and next ideas](docs/LOGIKUS-LAB.md).

### Program with blocks — or with code, and switch freely

The editor is a Scratch-style block canvas. A **Code tab** shows the exact same
program as text, and you can edit either side; the two stay in sync.

- Every project reads and writes in three core forms: **Brickwright Code** (a
  plain, readable pseudocode), **Python** (an algorithmic subset), and
  **JavaScript**.
- The same converter round-trips more: **C**, **BBC BASIC** (numbered or
  structured), and **MicroPython** in two real dialects — for the **micro:bit**
  and the **Raspberry Pi Pico** — plus live **Forth** (zForth), **Tcl**
  (Jim Tcl / partcl), **Lisp** (`fe`) and **Cowgol** tabs. Cowgol is available
  from **Code → +**, with a checked integer, turtle-canvas and digital-circuit
  subset, plus native CP/M/DOS compiler routes. See [Cowgol support and limits](docs/COWGOL.md).
  It reads hand-written code back
  too: edit the C or BASIC a program became and import it to blocks again.
- Beyond the round trip, programs can be **compiled and run on emulated DOS and
  CP/M machines** through real toolchains — **GW-BASIC** and **uBASIC**,
  **Pascal** and **Modula-2** (ACK), and **C** (SDCC, including via CP/M) — with
  **8051 / AVR / ARM / 6502 assembly** listings from the compile service.
- Conversion is two-way wherever it can be. Anything the target language has no
  equivalent for is **marked in place and counted in the status line — never
  silently dropped** — so a program always survives the round trip as a program.

The green flag starts the Scratch scripts and the circuit simulation together.
A **LEGO SPIKE App 3 Python** program can also be imported and run on the
virtual hub. The full language-and-target table is in
[the code-tab language/device bridge](docs/CODE-TAB-LANGUAGE-DEVICE-BRIDGE.md).

**Extensions and media.** 23 extensions ship built in (the LEGO family,
gamepad, arrays, text-to-speech, camera, a bridge to the circuit surface, GPIO,
and more), plus 150 reviewed extensions available from the gallery on the web.
A **sound-effects creator** and a full **German** translation sit alongside
English.

### Draw and edit graphics

The costume and sprite editor is Scratch's, extended into a capable vector and
bitmap design tool.

- **In vector mode:** an **objects panel** that lists every shape to show, hide,
  lock, rename and reorder; a **properties panel** with exact position, width,
  height, rotation, opacity and locked aspect ratio; **align and distribute**;
  **boolean path operations** (unite, subtract, intersect, exclude overlap,
  divide); **mirror/symmetry**; and shape tools for **rounded rectangles,
  polygons and stars** next to the usual rectangle, ellipse, line and triangle,
  with independent bezier handles when you reshape a path.
- **In bitmap mode:** a **lasso** and a **magic wand** with adjustable
  tolerance, **layers**, and brush presets with an opacity control.
- Throughout: an optional pixel grid, a scrollable canvas, recent-colour reuse,
  and text costumes that rasterise with their real fonts.

### Run and debug emulated machines

Programs run on instruction-level emulators you can **run, pause, single-step,
reset**, and inspect register-by-register and byte-by-byte in memory.

- **On the breadboard**, with a full debugger: the **8051 / STC** family —
  **STC89C52RC** (a classic 12-clock 8052), **STC12** and the fast 1-clock
  **STC15** — **AVR** (Arduino Uno / Nano), **RP2040** (Raspberry Pi Pico),
  **6502** (W65C02), and **Z80**.
- **Board and firmware targets** loaded from real `ELF`, Intel `HEX` and `UF2`
  files: **BBC micro:bit v2**, **Adafruit PyBadge**, **LEGO SPIKE Prime**,
  **LEGO MINDSTORMS EV3**, **Arduboy**, and **ATtiny** boards.
- A **Machine Manager** boots whole computers and operating systems from
  separately distributed disk/ROM images, each introduced by a guided lesson:
  an **80386 AT PC** running **DOS/FreeDOS**, **ELKS** (a small Unix) on an 8086,
  **CP/M on a Z80**, **Microsoft BASIC on a 6502** single-board computer (RAM,
  ROM, VIA, ACIA, screen and keyboard), and a **RISC-V Linux** machine. See the
  loading guides below for the image and licensing details.

Different targets run on different emulation cores, and each states which
peripherals it models rather than pretending: the permissively licensed
**avr8js** (AVR) and **rp2040js** (RP2040) JavaScript cores; **LabWired**, a
native core compiled to WebAssembly, for the micro:bit and PyBadge; a
**Renode**-derived boundary for the LEGO SPIKE Prime and MINDSTORMS EV3 firmware
targets; an LGPL **Bochs** core for the 80386 AT PC (a native 386 core is in
progress); and small in-house cores for the Z80, 6502 and 8086/80286 machines. Output appears on the **Widgets pane**
(screens, LEDs, GPIO strips); a **Debug view** adds a serial console and video. The emulators clear real-time speed on the established targets in the
browser; the exact per-target numbers, the shipped-versus-candidate matrix, and
the remaining gaps live in
[board targets and emulator performance](docs/TARGET-EMULATOR-PERFORMANCE.md).

For x86 programs, raw floppy/HDD images and DOSBox configs, see
[the GUI loading guide](docs/I80386-GUI.md),
[what backends and formats are in scope](docs/X86-LOADING-SCOPE.md), the
[upstream CLI/GUI loading guide](https://github.com/CrispStrobe/bw-board/blob/master/docs/X86-LOADING-GUIDE.md),
and the [x86 checkpoint and next lanes](docs/X86-NEXT-LANES.md), which keeps
reached evidence separate from pending work.

### Design digital logic — gates, ICs and FPGAs

Two things ship in every build:

- **Verilog → schematic.** Point the renderer at a Verilog/HDL design and it
  produces a clean SVG schematic with [Yosys](https://yosyshq.net/yosys/) —
  named modules preserved, one level of hierarchy expanded by default, with
  control over depth, the top module, and when large repeated arrays stay
  collapsed (`npm run render:fpga`). It is for reading and documenting how logic
  is wired.
- **A Tang Nano 20K** (Gowin GW2AR-18) board you can place and wire on the
  breadboard with its real pinout, with a 3.3 V design-rule check that catches
  5 V fed back into a bank pin.

Behind the build flag **`BW_ENABLE_FPGA`** there is a fuller, still-experimental
**digital-logic lab**: write Verilog, **synthesise** it to a gate netlist
(locally, in a WebAssembly Yosys worker, or through a hosted service), bind its
ports to board pins with a Gowin `.cst` constraints file, and drive the LEDs on
the virtual Tang Nano through the same analog solver that runs the breadboard —
stepping the clock and mirroring the result into the Widgets view. The same
design can be read as a **schematic, truth table, waveform, or gate netlist**
with a node inspector; you can build equivalent logic from **CMOS transistors or
74-series logic ICs**, and work through guided challenges. Because compiling a
GPL-licensed source on a server and returning a bitstream would distribute a
derivative work, the hosted route refuses GPL sources by name and points them at
the local WebAssembly tier, which conveys nothing off your machine.

Real-hardware bitstream flashing is scaffolded but **not yet functional**, and
the lab is **off by default**. See [the Tang Nano notes](docs/TANG-NANO.md) for
the exact state.

### Bring a MakeCode project in, and take one back out

MakeCode embeds its own source inside everything it downloads, so Brickwright
can open a cartridge and recover the **project**, not just the machine code.

- Open a MakeCode `.hex`, `.uf2`, `.elf` or `.png` file: a **micro:bit**
  project comes back as blocks; a **MakeCode Arcade** game comes back as a
  Scratch project — sprites with their real artwork, overlaps mapped to
  `touching`, the controller mapped to the arrow keys, and levels painted whole
  as backdrops.
- A micro:bit **MicroPython** `.hex` (from python.microbit.org or uflash) needs
  no translating — the simulator runs it as it is.
- Import from a MakeCode share link, or **save a project as a `.hex`** that
  makecode.microbit.org opens again.
- These are not dead imports — they **run**: an imported micro:bit project
  executes as a Scratch project (and a MicroPython `.hex` directly in the
  simulator), and an imported Arcade game **plays** through the Scratch renderer
  and the game console (display, controls, tilt and NeoPixels where present).
- A micro:bit or Calliope mini MakeCode program also runs as **real firmware**
  on the emulated board (the micro:bit V1 with its radio stack emulated, and the
  micro:bit V2 on Bluetooth-free firmware): its LED picture and serial console
  appear as it runs. The V2's serial output is not shown yet.
- Anything with no equivalent here is listed, not quietly discarded.

Both directions are also available from the command line — `bwlite makecode …`
and `bwlite convert` — using the same readers as the in-app Code tab.

### Program real hardware

- **Flash a real STC 8051 board:** choose or retarget the part — **STC89C52RC**,
  **STC12** (e.g. STC12C5A60S2) or **STC15** (STC15F2K60S2) — with `bwlite
  devices` / `bwlite retarget`; the installed SDCC compiler turns your
  pseudocode or C into Intel HEX and `stcgal` flashes it over a serial port. The
  toolchain models each part's own timers and second UART baud source, and the
  1-clock STC12/STC15 cores run far faster than the classic 12-clock STC89.
- **Program real LEGO bricks — the whole lineage.** Blocks transpile to the
  code each brick actually runs and connect over its real transport:
  **SPIKE Prime / Robot Inventor** and **EV3** (Python / ev3dev2, plus EV3
  `.lms` bytecode), **NXT** (NXC), and **Boost**, **WeDo 2.0** and **Powered
  Up** over Bluetooth LE or Classic — and the classic 1998 **MINDSTORMS RCX**,
  whose blocks compile to `.rcx` bytecode through an in-browser **NQC**
  compiler and download to the brick over a **Web Serial infrared tower** (you
  supply the RCX's own firmware). The native app's own ScratchLink provides
  BLE + Bluetooth Classic (plus a WiFi/USB bridge for SPIKE) with no browser or
  separate install.

### Learn with guided lessons

Three first-run journeys each lead to a working circuit, board, or LEGO
project. A searchable English/German catalog then teaches circuits, safe
measurement, the programming representations, debugging, controls, and machine
architecture. Lessons sit beside the live project and use prediction,
observation, hints, resumable progress, and manual fallbacks — not a
click-through slideshow.

### Follow a whole computer with CARDIAC

Open **Code → CARDIAC** to explore a decimal computer with 100 memory words
and ten instructions. Assemble labelled source, feed numeric cards, inspect
every memory change, set a breakpoint, or predict the next program counter
and accumulator before taking a step. Code and Controller share one machine.

Six original English/German lessons connect arithmetic and branching to
bootstrapping and self-modifying code. The night-light example adds an explicitly
modern circuit adapter: sample a voltage into an input card, let the program
make its decision, and watch the solved resistor/LED circuit respond. Saved
projects keep unfinished source separately from the last loaded image and
reopen paused. See the [CARDIAC Lab guide](docs/CARDIAC-LAB.md) for the exact
compatibility profile, examples, reference comparisons and verification scope.

### Use it as a native app

One Tauri 2 project produces apps for **macOS, Windows, Linux, iOS and
Android**. They add an offline asset library, camera and microphone access,
native `.sb3` save/load/share, file associations and deep links, and the native
Bluetooth transports above.

---

## Quick start

### Command line

`bwlite` is this repository's CLI (the older `bw` command belongs to the
separate `sb3-creator` compiler repo). A `.bw` file is Brickwright pseudocode.
After the web-build setup has populated `packages/`, run `npm link` once to put
`bwlite` on your PATH (or use `npm run cli --`).

```bash
bwlite --help
bwlite spike probe
bwlite spike run scripts/spike/example-usb-stream.bw
bwlite convert program.bw --to sb3 --out program.sb3
bwlite convert program.bw --to c   --out program.c
bwlite read program.c --out recovered.bw
bwlite 8051 build program.bw --out program.ihx
bwlite 8051 flash program.ihx --port /dev/cu.usbserial-XXXX
bwlite toolchain status
bwlite machine validate machine.json
bwlite circuit test 05-counter --device stc12c5a60s2
bwlite circuit test --json > circuit-report.json
```

`convert` reads `.bw`, `.sb3`, `.c`, `.py`, `.js` and `.bas`, and writes
pseudocode, SB3, C, host C, Python, JavaScript, MicroPython or BASIC — using the
same pinned `SB3Creator` and language readers as the Code tab. `8051 build`
uses installed SDCC; `8051 flash` uses installed `stcgal` and an explicit
serial port (and the STC's usual cold power-cycle into its ISP bootloader).
`machine` manages emulator configurations and boot plans; `toolchain`, `fpga`
and `makecode` forward to their repository CLIs.

`circuit test` loads, powers and advances every selected gallery bench with the
same circuit engine the app uses. The JSON report gives a separate functional
verdict. Scripted scenarios run the actual lesson program in the headless
Scratch VM and measure the circuit's response to inputs. A bench without a
scenario is marked `unverified` for behavior. Use `--smoke-only` to skip
functional checks. Failed or incomplete checks set exit status 1.

SPIKE over USB needs LEGO MINDSTORMS MicroPython firmware and Python with
`pyserial`. See the [CLI guide](docs/CLI.md) (it maps old `bw` references to
current commands), the [USB bridge guide](scripts/spike/README-usb-stream.md),
and the [MINDSTORMS `.lms` guide](docs/mindstorms-lms.md).

### Build the web app

```bash
npm ci --ignore-scripts --no-audit --no-fund   # root tooling + pinned engine/UI packages (Node 22)
npm run vendor                                 # fetch pinned sources into packages/
node scripts/integrate.mjs                     # overlay our changes
cd packages/scratch-gui
npm install --ignore-scripts --legacy-peer-deps
node ../../scripts/apply-vm-overlay.mjs         # built-in extensions + upstream fixes
node ../../scripts/apply-paint-overlay.mjs      # the extended costume designer
node ../../scripts/apply-render-overlay.mjs     # text costumes wait for the lazy render fonts
NODE_ENV=production npm run build               # -> build/
```

### Build the native app (needs the web `build/` first)

```bash
cd apps/tauri && npm ci
npx tauri dev                   # desktop
npx tauri android build --apk   # or:  npx tauri ios build
```

For an installable physical-iPad development package, use the production asset
pipeline even when signing with an Apple Development profile:

```bash
cd apps/tauri && npm run ios:device-build
```

Do not package a device app with `tauri ios dev --no-dev-server`: it compiles
Tauri in development mode, where `tauri://localhost` expects a live dev server
instead of serving the embedded web build, so the app installs but cannot open
its start page offline. CI builds every
platform in `.github/workflows/release.yml` (desktop) and `mobile.yml` (Android
APK + iOS simulator).

### Render Verilog to SVG (needs Yosys)

```bash
npm run render:fpga -- design.v --output render --title "My circuit"
```

Use `--expand-depth 0` for macro boxes, `--expand-depth 2` to expose another
level, `--top module_name` when a file has several candidates, and
`--max-expanded-instances` to adjust when large arrays collapse.

---

## Roadmap

- [x] Permissive base pinned and verified (BSD-3 / Apache-2.0 / MIT).
- [x] Code tab — blocks / pseudocode / Python / JS (plus C, BASIC, MicroPython,
      and the Forth/Tcl/Lisp DOS benches).
- [x] SoundFX creator; German i18n.
- [x] 23 built-in extensions everywhere; 150 additional gallery extensions on the web.
- [x] Tauri native app for all five platforms.
- [x] Native ScratchLink — BLE + Bluetooth Classic + WiFi bridge.
- [x] Native save/load/share, offline library, camera + microphone.
- [x] Circuit Designer: breadboards, schematic, DRC, autosave, undo/redo.
- [x] 8051 / AVR / RP2040 / 6502 / Z80 instruction-level emulation and debugging.
- [x] Signed macOS and iOS builds uploaded to App Store Connect / TestFlight.
- [ ] Hardware-verify each LEGO transport against real hardware (macOS BLE done).
- [ ] Complete Arduino Uno/Nano peripheral fidelity and source-level debugger.
- [ ] RP2040/MicroPython compilation path for the Pico.
- [ ] Schematic symbol coverage beyond the generated projection.

See [the target handoff](docs/TARGET-NEXT-LANES.md) for the current state and
actionable lanes, [PLAN.md](PLAN.md) for the working sequence, and
[ROADMAP.md](ROADMAP.md) for the engineering backlog.

---

## How it's built: vendor + overlay

Brickwright is built on the last BSD-3-licensed release of the Scratch
editor stack (see **Licensing** below for why). Rather than fork those
repositories, it **pins exact versions, keeps its own copies of only the files
it changes in `overlay/`, and copies them over the vendored sources at build
time**:

```
overlay/scratch-gui/      <- GUI files we own
overlay/scratch-vm/       <- built-in extensions + registration
apps/tauri/               <- the Tauri 2 native app
scripts/
  vendor.mjs              <- fetch pinned sources into packages/ (gitignored)
  integrate.mjs           <- copy overlay/ over the vendored GUI
  apply-vm-overlay.mjs    <- lay the VM overlay onto node_modules/scratch-vm
  apply-paint-overlay.mjs <- the extended costume designer
  apply-render-overlay.mjs<- text costumes wait for the lazy render-fonts chunk
```

The runtime is layered: `sb3-creator` converts between representations, local
or hosted compilers produce executable images, `bw-circuit-ui` builds circuits,
`bw-board` supplies machines and debug adapters, and `bw-debug` records,
inspects and replays. A project saves Scratch content plus Brickwright Code,
Circuit and Controller state in one `.sb3` sidecar.

**Upstream integrity.** `bw-board` and `bw-circuit-ui` are installed from exact
git SHAs; `sb3-creator`, the only vendored upstream, is checked for pinned byte
identity and matching tracked mirrors. Shared behavior lands in its upstream
repository first and reaches Lite through an explicit pin move. The enforced
invariants are in [the vendoring regime](docs/VENDORING-REGIME.md); check
[LANES.md](LANES.md) before claiming implementation. A new claim is its own file,
`lanes/<YYYY-MM-DD>-<slug>.md`; new PRs never edit LANES.md.

---

## Development and tests

With Node 22 or newer, run the bounded source-only suite without preparing the
generated GUI tree:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check:setup
npm run test:source
```

Root tests import owned GUI modules from `overlay/scratch-gui`; the generated
`packages/scratch-gui/src` is not a test input. Tests that need vendored
dependencies or assembled build artifacts still require the full `vendor`,
`integrate`, GUI dependency install, and VM/paint/render overlay steps; run
`npm run check:setup -- --integrated` to verify that runtime first.

---

## Simulator and oracle policy

The browser and the shipped app use **only permissively licensed execution
paths**. External emulators are developer-side test oracles — they cross-check
our results in CI and are **never bundled** into the product or its dependency
graph:

- `ucsim-stc` (GPL) — an STC/8051 oracle, paired with the MIT `emu8051-stc`
  differential runner.
- `simavr` — an optional external AVR hardware/peripheral oracle.
- MIT `cemeyer/avr-emu` and `Gregwar/avrel` — independent CPU-level cross-checks.

GPL/AGPL oracle code stays outside the product entirely.

---

## Licensing

Brickwright's application code is **BSD-3-Clause**. The shipped dependency
set is open source under BSD-3-Clause, Apache-2.0, MIT and MPL-2.0 — **no GPL or
AGPL code is bundled**. [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) has the
exact file-and-package inventory.

### Why this base

The Scratch Foundation relicensed its whole stack from BSD-3-Clause to AGPL-3.0
on 2024-11-25 (scratch-gui commit `3de24da0`). Brickwright pins the **last
BSD-3 commit** of each component:

| Component | Pin | License |
|---|---|---|
| **scratch-gui** | `7a72429477eb` (v4.1.7, 2024-11-23) | **BSD-3-Clause** |
| **scratch-blocks** | `1.3.0` | **Apache-2.0** |
| **scratch-vm** | `4.8.115` | **BSD-3-Clause** |
| **scratch-paint** | `2.2.518` | **BSD-3-Clause** |
| scratch-render / audio / storage / svg-renderer | pinned | **BSD-3-Clause** |

> **Do not** swap in `scratch-blocks@2.x` — it is a ground-up Blockly rewrite
> incompatible with the v4 GUI.

Web and native editions can opt into **separately distributed** GPL tools or
media, with each tool's license and corresponding source shown at the point of
download; those user-initiated downloads stay separate from the BSD-3
application. A review-specific, self-contained build can disable remote
toolchains, machine images and extension JavaScript at compile time with
`BW_REMOTE_CODE_POLICY=deny` (the normal build policy is `allow`). The narrower
`BW_REMOTE_EXTENSIONS_POLICY`, `BW_REMOTE_TOOLCHAINS_POLICY` and
`BW_REMOTE_MACHINE_IMAGES_POLICY` variables override that umbrella
independently, so a review channel does not disable unrelated features.

### The bundled extensions

The 23 extensions under `overlay/scratch-vm/src/extensions/crispstrobe/` are
**20 MPL-2.0 and 3 MIT**. MPL-2.0 is file-level weak copyleft: the files may be
combined into a larger work under other terms, provided the MPL files stay MPL
and their source stays available — it is, in this repository. The upstream
`TurboWarp/extensions` gallery's GPL-3.0 covers its images, dev server and
website, not the extension code, and none of that is vendored here.

This was established by re-runnable checks, not by trust:

| check | result |
|---|---|
| license header of every bundled extension | 20 MPL-2.0, 3 MIT, 0 GPL |
| our 21 gallery extensions vs 129 third-party, distinctive lines ≥ 60 chars | **0 shared of 3,114** |
| bundled vs upstream TurboWarp's own extensions | **0 shared** |
| bundled vs every copyleft-flagged third-party extension | **0 shared of 424** |
| gallery images / dev server / site code vendored | **none** |

### How this differs from mainline Brickwright and from TurboWarp

Brickwright freezes a BSD-licensed Scratch stack (so upstream security and
compatibility fixes must be ported deliberately) and does **not** use
TurboWarp's compiler or addon system. In exchange it ships its own electronics,
debugger, lesson and native-device layers — including direct LEGO Bluetooth —
without depending on TurboWarp. Brickwright is not a TurboWarp fork.

### Affiliation and trademarks

Brickwright is an independent project. **Not affiliated with or endorsed
by Scratch, MIT, LEGO, STC, Arduino, or Raspberry Pi, nor by the makers of the
circuit file formats the Circuit tab imports and exports (KiCad, EasyEDA, EAGLE,
LTspice). All trademarks belong to their owners.** It is likewise not authorized
or sponsored by any company whose products, hardware, file formats or trademarks
it names for compatibility.

In particular, **LEGO®, SPIKE™ and MINDSTORMS® are trademarks of the LEGO
Group**, which does not sponsor, authorize or endorse this project; the virtual
SPIKE hub is an independent reimplementation and bundles no LEGO firmware (the
LEGO MINDSTORMS MicroPython firmware that real-hardware USB use requires is
supplied by the user). Scratch is a trademark of the Scratch Foundation / MIT;
micro:bit is a trademark of the Micro:bit Educational Foundation; MakeCode is a
Microsoft project; and Arduino, Raspberry Pi, STC, Adafruit, Arduboy, and the
circuit file formats the Circuit tab reads and writes (KiCad, EasyEDA, EAGLE,
LTspice) are trademarks of their respective owners.

All such names are used only to identify compatible hardware, software and file
formats. Their use does not imply any affiliation or endorsement, and all
trademarks remain the property of their respective owners.

The virtual SPIKE hub uses an
[independent simulator backend](docs/independent-spike/README.md) for Scratch
and native programs, with shared arena state and deterministic motor control;
supported LEGO SPIKE App 3 Python imports run through the same virtual hub.
