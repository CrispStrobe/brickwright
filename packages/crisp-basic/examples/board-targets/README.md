# Named board target examples

These examples execute ordinary BBC BASIC on CrispBASIC's real WebAssembly
interpreter and connect it to a named **logical digital simulation**. Each
program sets an output, samples a pulled-up input, waits for a scheduled input
change, and toggles its retained output latch twice. The input is released at
30 ms, so its logical pull-up becomes visible again.

This host does not run firmware on an emulated MCU. It does not flash a physical
board, solve electrical voltages/current, or model native peripherals. Use
Brickwright's Circuit host when the program needs the electrical solver.

## Run an example

From `packages/crisp-basic`, build the WASM runtime once and run the sample:

```sh
npm run build:wasm
node examples/board-targets/run.mjs pico
node examples/board-targets/run.mjs 8051
node examples/board-targets/run.mjs stm32
node examples/board-targets/run.mjs nano
node examples/board-targets/run.mjs 8266
node examples/board-targets/run.mjs microbit
node examples/board-targets/run.mjs microbit-breakout
```

The runner sends BASIC's output to stdout and the canonical target ID, execution
status and complete logical trace to stderr. Each example prints:

```text
1:1:0
0:0:25
1:1:30
```

Each line means `output latch : input level : elapsed milliseconds`. The
underlying BASIC output uses CRLF line endings. Elapsed time comes from
`FNmillis` and advances only through `PROCdelay`; it is not wall-clock time.

## Programs and exact pin numbering

| Runner target | Program and fixture | Selected profile | Output | Input |
| --- | --- | --- | --- | --- |
| `8051` | `8051.bas`, `8051.json` | Generic `mcu` logical ports | P1.0 = 8 | P1.1 = 9 |
| `stc15` | `stc15.bas`, `stc15.json` | `stc15_mcu` PDIP-40 surface | P5.4 = 44 | P5.5 = 45 |
| `stm32` | `stm32.bas`, `stm32.json` | `stm32f030` | PB1 = 17 | PA0 = 0 |
| `pico`, `rp2040` | `pico.bas`, `pico.json` | `pi_pico` | GP25 = 25 | GP2 = 2 |
| `nano` | `nano.bas`, `nano.json` | Classic `arduino_nano` | D13 = 13 | D2 = 2 |
| `esp8266`, `8266` | `esp8266.bas`, `esp8266.json` | `esp8266` | GPIO12 = 12 | GPIO0 = 0 |
| `microbit`, `micro:bit` | `microbit.bas`, `microbit.json` | Basic `microbit` edge pads | P0 = 0 | P2 = 2 |
| `microbit-breakout` | `microbit-breakout.bas`, `microbit-breakout.json` | `microbit_breakout` | P8 = 8 | P16 = 16 |

The BASIC programs use numeric logical IDs. The matching JSON fixtures use
canonical pad names to restrict the host to exactly those two pins and schedule
the input events. These numbers are neither physical header positions nor
register addresses.

`8051` selects the generic P0.0–P7.7 logical port surface, using
`8 * port + bit`; it makes no package-level or silicon-family claim. Choose
`stc15` for the explicit STC15 package subset. The `stm32` alias selects the
specific F030 profile, not every STM32 device. `nano` means the classic
ATmega328P-style Nano numbering, not Nano Every, Nano RP2040 Connect or Nano 33.
`rp2040` selects the existing Pico profile, not an arbitrary RP2040 board.

The basic micro:bit profile exposes P0–P2. P8/P12/P16 are admitted by the
separate breakout profile. Nano A6/A7, Pico GP23/GP24, ESP8266 flash-bus pads,
and STM32 pads outside the declared F030 subset are refused as digital pins.
Pico GP25 and Nano D13 are simply logical outputs here; their onboard LED
electrical loading is not simulated.

## Use the fixture from JavaScript

```js
import {createWasmSession, prepareTargetSimulation} from '../../browser.mjs';

// Read pico.bas and pico.json as the runner above does.
const prepared = prepareTargetSimulation('rp2040', fixture);
const session = createWasmSession({simulation: {
    maxRequests: prepared.maxRequests,
    createHost: prepared.createHost
}});
try {
    const result = await session.run(source, {filename: 'pico.bas'});
    console.log(result.status, result.text);
} finally {
    await session.dispose();
}
```

Keep the source/fixture/target selection together. Fixtures cannot enlarge a
target's supported pin set. A fresh host is created for each run; rerunning the
sample starts the clock, input schedule and latches from their initial state.

## Qualification

`tests/board-targets-wasm.test.mjs` executes every committed program/fixture
pair on the actual built interpreter. It compares exact output bytes and all
fifteen ordered pin/time events, executes the Pico/RP2040 and ESP8266/8266 aliases,
checks excluded-pad BASIC errors with original source positions, and verifies
fresh-run isolation and parent-owned time budgets.

```sh
node --test tests/board-targets-wasm.test.mjs
```

An absent compiled WASM artifact fails this suite; it is never reported as a
passing skip. These checks establish logical bridge behavior, not native CPU
execution or physical hardware qualification.
