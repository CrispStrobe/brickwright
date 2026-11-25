# Busch Microtronic 2090 in Circuits

The first integration adds a runnable Microtronic component to the Circuits
palette. Its execution and electrical state belong to `bw-board`; its panel,
terminals and artwork belong to `bw-circuit-ui`. Brickwright consumes both
through its normal exact package pins.

## First phase

This is a **documented-behavior model of the Microtronic teaching instruction
set**. It executes the three-hex-digit programs described in Busch's manuals,
with 256 program locations, sixteen working registers, sixteen storage
registers, four inputs and four outputs. It uses the same simulated timeline
and electrical nets as the surrounding circuit.

It does not execute the original TMS1600 monitor ROM. A native processor model
and independently authored replacement firmware are a later phase. No original
ROM, disassembly, third-party emulator implementation, or manual artwork is
included in this integration. The component artwork is newly drawn.

## A first experiment

Add **Busch Microtronic 2090** from the Circuits palette. The component panel
provides the hexadecimal keypad, six-digit display, program editor and Run,
Halt, Step and Reset controls. Choose **Open wired I/O example** for a prepared
experiment with three input switches, four output LEDs and CLOCK wired to IN4.
Run starts the shared circuit simulation. Halt stops this computer while the
circuit clock continues; the circuit toolbar's Pause freezes the experiment.

Enter three-hex-digit words in the program editor and choose **Load program**
to validate and install them. **Run** also applies the current editor text
before starting. **Open file…** reads a local learner-program text file into
the editor; choose Load program or Run to apply it. An invalid draft leaves the
previously accepted program intact. Use **File → Save circuit** to download the
wiring and accepted program, and **File → Open circuit…** to restore them.

Program text is saved with the circuit; execution state is transient. A
restored circuit starts halted. Reset preserves program memory. Structural
edits in Build reconstruct the circuit, retaining the loaded program but
resetting the PC, registers and running state. Halt before rewiring.

The three-instruction input echo program is:

```text
00: FD0  ; DIN: read inputs into register 0
01: FE0  ; DOT: write register 0 to outputs
02: C00  ; GOTO address 00
```

Connect `CLOCK` to `IN1`, then connect `OUT1` through a resistor and LED to
`gnd`. Run the program and the LED follows the clock, with instruction-sampling
delay. Moving the jumper to `IN4` makes `OUT4` follow instead. Input/output
numbers have bit weights 1, 2, 4 and 8.

The 1 Hz signal is an independent output terminal. It is **not internally
connected to IN4**. An unwired input remains low. This visible jumper is part of
the original teaching experiments and is preserved in the model.

For a switch-controlled experiment, connect `5v` through a switch to `IN1` and
run the same program. Use the ordinary live switch controls while simulating.
Halt freezes program execution and retains the output latch; the circuit's
independent clock can continue advancing.

## Model boundaries

The instruction rate is a simulator setting, not a claim about TMS1600 clock
cycles or original instruction delays. The real machine has a 500 kHz processor
clock and a separate crystal-divider timebase. Output drivers and input
thresholds use the documented supplier model approximations. The exported
`5v` terminal is a convenient circuit supply; the original board's distinct
CPU/peripheral voltage references are not reproduced as a transistor-level
power-supply simulation.

The supplier's `docs/MICROTRONIC.md` records supported instructions, front-panel
behavior, omitted monitor functions, and timing/electrical limits. These limits
must remain visible when adding native firmware execution later; a passing
learner-program test does not qualify the original ROM or every hardware detail.

The default rate is 20 learner instructions per simulated second. PGM 3/4
sets/views the clock; PGM 5/6 fills program memory. Other historical built-in
monitor programs report that they are unsupported. Decimal division executes
in one configured instruction interval, and random-number generation uses a
deterministic simulator sequence. The panel is simplified: display scanning,
key debounce/repeat timing and cassette transfers are outside this phase.

Before implementing native SRAM cycles, reconcile a discrepancy in the supplied
hardware evidence: the original `microtronic.jpg` maps SRAM A4–A9 to CPU pins
5, 4, 3, 2, 1, 40; the attached redraw labels those six lines in the reverse
order. The original also describes separate opcode/high-operand/low-operand
fields selected by A8/A9. The behavioral model stores learner words directly
and makes no claim about that physical nibble-address layout.

## Verification

The app's `test/microtronic-circuit-adoption.test.mjs` exercises the installed
packages together through the actual engine-injection and circuit save/load
boundary. It verifies matching terminals, exclusion from synthetic MCU pin
driving, a physical switch → DIN → DOT → resistor/LED path, halt/resume/reset,
and the explicit clock jumper.

The supplier suites cover the instruction semantics, malformed-program
refusals, deterministic scheduling, front-panel controls, independent instances,
terminal geometry, and browser interactions. Run the app adoption check with:

```sh
node --test test/microtronic-circuit-adoption.test.mjs
```

Package pins, installed-content provenance, mirrors, and upstream license
notices use the existing Brickwright checks. The focused host integration run
passed **55 checks, with no failures or skips**, and `npm run build:gui`
completed the production build. These results are separate from the supplier
component-browser checks and the full-host browser run below; they do not
replace the repository's remaining CI gates.

### Full Brickwright browser check

`scripts/verify-microtronic-circuit.mjs` visits the built Brickwright app and
drives its real Circuit tab, palette, panel, switch controls and File menu.
Production diagnostics are read only: the verifier does not install a mock
designer, inject circuit data, control a device through a test API, or advance
simulation time itself.

Build the app from the repository root, then serve the build directory:

```sh
npm run build:gui
python3 -m http.server 8242 --bind 127.0.0.1 --directory packages/scratch-gui/build
```

While that server is running, invoke the verifier in another terminal. Set the
browser variable to an installed Chromium executable:

```sh
MICROTRONIC_BASE_URL=http://127.0.0.1:8242/
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium \
  node scripts/verify-microtronic-circuit.mjs "$MICROTRONIC_BASE_URL"
```

The example passes `MICROTRONIC_BASE_URL` as the URL argument. Without an
argument, the verifier reads `BW_MICROTRONIC_URL`, then `PROOF_URL`, and finally
defaults to `http://127.0.0.1:8242/`. `BW_CHROMIUM_EXECUTABLE` is the alternate
browser-path variable; omitting both browser variables uses Playwright's
installed Chromium. `BW_MICROTRONIC_BROWSER_OUT` overrides the artifact
directory, which defaults to `artifacts/microtronic-circuit`.

The recorded full production-host run passed all **10 browser checks**, with
**zero page errors and zero failed requests**:

| Check | Observed application behavior |
| --- | --- |
| 1 | The real palette places the component and opens its 24-key front panel. |
| 2 | Run applies the visible editor draft and executes it on the installed engine. |
| 3 | A local program file loads, while an invalid draft preserves the accepted program. |
| 4 | Physical switches drive IN1/IN3 through the drawn nets and light the external LED faces. |
| 5 | The explicit CLOCK-to-IN4 wire changes OUT4 through the running echo program. |
| 6 | Opening a switch removes its input and extinguishes the corresponding external LED. |
| 7 | Halt, Step and Reset operate on the computer while the shared circuit clock remains independent. |
| 8 | Keypad NEXT commits a program word into the live model and saved circuit source. |
| 9 | An unloaded editor draft survives live rerenders, and Run executes that retained draft. |
| 10 | File-menu Save/Open restores the wired circuit and accepted program, which runs again. |

The verifier writes `result.json`, the actual downloaded `saved-circuit.json`,
and `wired-experiment.png` / `round-trip-program.png`. Both successful-run
screenshots were visually reviewed with the front panel, circuit wiring and
external LED states visible. A failed run writes `failure.json` and, when a
page is available, `failure.png`; a failed or unrun browser check must not be
reported as a pass.

## Documentation used

- [Busch Microtronic information and original downloads](https://www.busch-modell.de/information/Microtronic-Computer.aspx)
- [Busch quick reference](https://www.busch-model.com/online/produktinfos/docs/anl2090-0.pdf)
- [Busch manual, part 1](https://www.busch-model.com/online/produktinfos/docs/anl2090-1.pdf)
- [Busch manual, part 2](https://www.busch-model.com/online/produktinfos/docs/anl2090-2.pdf)
- [Block diagram](https://github.com/lambdamikel/Busch-2090/blob/master/manuals/blockschaltbild.jpg)
- [Microtronic hardware documentation](https://github.com/lambdamikel/Busch-2090/blob/master/manuals/microtronic.jpg)
- The four circuit schematics supplied with this task: CPU/inputs, timebase and
  supply, outputs/SRAM, and keypad/display.

The user also supplied the [fischertechnik interface discussion](https://forum.ftcommunity.de/viewtopic.php?t=7993)
and the [Microtronic remake discussion](https://forum.classic-computing.de/forum/index.php?thread/21829-neuauflage-busch-microtronic-2090-lerncomputer/).
They provide project context; the implementation specification comes from the
manufacturer documentation and supplied schematics.
