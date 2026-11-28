# Named CrispBASIC board targets

Use a named board target to run the real CrispBASIC WASM interpreter against a
fresh logical GPIO host whose admitted pins match Brickwright's controller
profile. This extends the standalone CLI and JavaScript API to the same board
families already available through the Circuit adapter.

The interpreter executes in the host's WebAssembly worker. This route does
not execute firmware on an emulated MCU, model an electrical network, or
connect physical equipment. The target descriptor reports
`execution: 'host-driven-logical-simulation'`, with
`hardware`, `nativeInterpreter` and `circuitPhysics` all false.
For solved voltages and connected components, use **Connect Circuit** in
Brickwright. Linux native execution is a separate backend.

## Select a target

From `packages/crisp-basic`:

```sh
node bin/crispbasic.mjs --list-targets
node bin/crispbasic.mjs --backend wasm --target pico --capabilities

npm run build:wasm
node bin/crispbasic.mjs --backend wasm --target nano \
  --simulation examples/board-targets/nano.json \
  examples/board-targets/nano.bas --json
node examples/board-targets/run.mjs rp2040
```

Discovery and capability queries need no interpreter build. Executing a program
requires the real built WASM assets; missing assets fail explicitly.
`--target` requires `--backend wasm` and does not change the legacy
native default. `--list-targets` is a standalone JSON query and accepts
no source file or execution options.

### Requested families

| Name or alias | Canonical target | Exact scope |
| --- | --- | --- |
| `8051`, `stc8051` | `mcu` | Generic logical P0.0–P7.7 inventory, IDs `8 * port + bit`; this does not assert a physical 8051 package |
| `stc15`, `stc15f2k60s2` | `stc15_mcu` | Exposed STC15 DIP-40 GPIO pads only |
| `stm32`, `stm32-f030` | `stm32f030` | STM32F030 TSSOP-20 model: PA0–PA7, PA9, PA10 and PB1 |
| `pico`, `rp2040` | `pi_pico` | Pico profile: GP0–GP22 and GP25–GP28 |
| `nano` | `arduino_nano` | Classic AVR Nano: D0–D13 and A0–A5; excludes A6/A7 |
| `8266`, `esp-8266` | `esp8266` | GPIO0–GPIO5 and GPIO12–GPIO15; excludes flash pads and GPIO16 |
| `microbit`, `micro:bit` | `microbit` | Large P0/P1/P2 pads |
| `microbit-breakout`, `micro:bit-breakout` | `microbit_breakout` | P0/P1/P2/P8/P12/P16 breakout pads |

These family aliases deliberately select concrete existing profiles. In
particular, `stm32` does not claim every STM32, `nano` does not
select Nano RP2040 Connect, and `rp2040` does not expose every SoC pad
or every RP2040 board.

The full catalog includes all 18 admitted profiles: the targets above plus
Arduino Uno/Mega, Calliope mini, Circuit Playground Express, PyBadge,
ESP32-S040, ATtiny85, ATtiny88, ATtiny88 QFN32 and the Eater 6502 VIA model.
Canonical underscore names and their hyphen spellings are accepted.
`--list-targets` supplies the complete exact terminal map and aliases;
[PORTABILITY.md](PORTABILITY.md) describes the electrical counterpart.

## Stimuli and resource limits

A selected target creates all its admitted logical pins by default. Supply
`--simulation FILE` to restrict those pins and provide scheduled inputs:

```json
{
  "schemaVersion": 1,
  "pins": ["D13", "D2"],
  "maxRequests": 100,
  "maxTimeMs": 1000,
  "inputs": [
    {"pin": "D2", "value": 0, "atMs": 25}
  ]
}
```

This is a Nano example. Terminal names must match a complete admitted name,
ignoring case only; numeric logical IDs are also accepted. Names such as
`D013`, physical connector positions, numeric strings such as
`"13"`, and unavailable pads are rejected. Listing the same pad
twice using both a terminal and a number is also rejected. A fixture can
narrow a profile, never add pins to it. Scheduled inputs must belong to the
active subset.

The existing fixture checks still apply: unknown fields, unsupported schema
versions, invalid levels/timestamps and exhausted limits refuse before an
interpreter starts. An omitted schema version defaults to 1 for the named
target API; including it in saved fixtures makes the format explicit.

BASIC pin calls continue to take numeric logical IDs. For example, Nano D13
is 13, its A0 is 14, STM32 PB1 is 17, and Pico GP25 is 25. The JSON fixture
and JavaScript host API also accept the exact terminal spellings.

Time advances only through `PROCdelay`; call `PROCdelay(0)`
to apply stimuli scheduled at time zero. Writes and toggles retain their
output latch. Logical output reads observe that latch; an electrical Circuit
adapter can instead observe a loaded voltage. These hosts have different
models even when they share the same numbering.

JSON execution results retain the target identity, active pin map, limits,
elapsed simulated time and bounded trace after host disposal:

- `simulation.capabilities.target.id` identifies the canonical target.
- `simulation.capabilities.pinMap` gives active terminal/ID pairs.
- `simulation.trace` records only completed operations.
- `simulation.elapsedMs` reports completed simulated time.

## JavaScript API

The same target API is available from the package entry, the browser-safe
entry, and the `./targets` package export.

```js
import {createWasmSession, prepareTargetSimulation} from './browser.mjs';

const fixture = prepareTargetSimulation('pico', {
  pins: ['GP25', 'GP2'],
  inputs: [{pin: 'GP2', value: 0, atMs: 25}],
  maxTimeMs: 1000
});
let host;
const session = createWasmSession({
  simulation: {
    maxRequests: fixture.maxRequests,
    createHost() {
      host = fixture.createHost();
      return host;
    }
  }
});
try {
  const result = await session.run(
    'PROCpinMode(25, "output")\nPROCdigitalWrite(25, 1)\nPROCdelay(25)\nEND\n'
  );
  console.log(result.status, host.capabilities.target.id, host.trace);
} finally {
  await session.dispose();
}
```

`listBoardTargets()` returns frozen descriptors.
`resolveBoardTarget(name)` resolves a canonical name or explicit alias.
`prepareTargetSimulation(name, fixture)` validates a fixture and
returns a fresh-host factory; use that factory for repeated interpreter runs.
`createTargetSimulationHost(name, fixture)` is convenient for one
run or direct logical-host use. Its pin methods accept terminal names as
well as numeric IDs. Hosts retain the existing reset, disposal, time/trace
limits and per-run ownership rules.

## Source authority and qualification

The committed catalog is generated from the exact `bw-board` revision
in the root `vendor-pins.json`. Each descriptor includes the supplier
repository, commit, source path and Git blob identity. Runtime users do not
need to install the electrical solver.

From the repository root, after installing its locked dependencies:

```sh
node packages/crisp-basic/scripts/sync-board-targets.mjs --check
npm --prefix packages/crisp-basic test
npm --prefix packages/crisp-basic run test:wasm
node --test test/crispbasic-board-target-identity.test.mjs
```

After a deliberate supplier pin move, regenerate with a clean supplier
checkout at that exact commit:

```sh
node packages/crisp-basic/scripts/sync-board-targets.mjs --board-dir /path/to/bw-board
```

The real-WASM suite runs all eight committed program/fixture pairs and the
RP2040/ESP8266 aliases. It checks byte output, complete operation traces,
excluded-pad diagnostics, fresh-run isolation and parent-enforced limits.
Source tests separately check aliases, immutable maps, named terminals,
fixture refusals and CLI discovery. Browser-package tests import the relocated
target API so a missing transitive asset cannot hide behind a complete-looking
manifest. See [examples/board-targets](examples/board-targets/README.md).

Actual bare-metal MCU execution needs an independently built target runtime,
its I/O ABI, firmware packaging and execution qualification on the target CPU.
The named logical hosts make no such firmware claim.
