# Portable BASIC and pseudocode conversion

The shared implementation belongs to `CrispStrobe/sb3-creator`. Brickwright's
`vendor-pins.json` adopts
[`b8a8f0b39ec24a5e6daf0ab08b4ee3979db7179a`](https://github.com/CrispStrobe/sb3-creator/tree/b8a8f0b39ec24a5e6daf0ab08b4ee3979db7179a),
and the existing sync derives both tracked compiler mirrors. This revision
provides explicit portable generation and a qualified BASIC-to-pseudocode
source conversion. The ordinary BASIC-to-Blocks reader keeps its refusal
boundary. [PORTABILITY.md](PORTABILITY.md) connects these language capabilities
to the runtime platforms and electrical controller inventory;
[VALIDATION.md](VALIDATION.md) records observed qualification.

## Use in the Code tab

1. Choose **BAS → BBC BASIC → CrispBASIC (browser)**.
2. Select **Portable BASIC ↔ pseudocode** and click **From blocks** to generate
   portable source from the current project.
3. Inspect the generated source and any diagnostics.
4. Load a supported Circuit and select **Connect Circuit** to execute the
   library calls on its existing solver.

With that portable option enabled, switching from BASIC to pseudocode uses the
strict portable reader. Keep the returned source marker when saving. Switching
marked pseudocode back to BASIC preserves its required CrispBASIC generation
mode. **To blocks** remains a separate operation and refuses this source dialect.

The generation choice starts off. Selecting the interpreter or enabling
Connect Circuit alone does not reinterpret old hardware comments. Changing
the generation choice preserves the current source and diagnostics; regenerate
from the current blocks to apply it. Selecting a retro engine never silently
rewrites edited source.

The producer API is explicit:

```js
creator.generateBASIC(project, {
    profile: 'bbc', mode: 'crispbasic', lineNumbers: false
});
```

Both numbered and structured BBC output work. Other profiles refuse the mode.
Omitting `mode` retains legacy output. A generation error contains descriptive
`reasons` and structured `diagnostics`, with a stable code and block ID/opcode
where applicable, and contains no partial executable source. The UI disables
Run for its explanatory error buffer and refuses attempts to convert that
buffer into blocks or another language.
Whitespace edits retain this refusal. Remove or replace the generation-error
banner when authoring corrected source; reopened error buffers have the same guard.

## Pin values and timing

Digital declarations emit `PROCpinMode`. Logical on/off and reads honor ACTIVE
LOW. Explicit high/low and computed writes are electrical levels. Computed
writes evaluate once and normalize nonzero to numeric `1`, zero to `0`, including
BBC Boolean `TRUE` (`-1`). Boolean NOT/AND/OR first normalize their numeric
operands, so a digital high (`1`) behaves correctly under BBC's bitwise operators.
ACTIVE LOW input declarations request `input-pullup`; other inputs request `input`.
Boolean reporters keep numeric `0/1` inside arithmetic with explicit grouping.
Serialized projects recover existing pin metadata, and referenced finite
numeric scalar state is initialized. Ambiguous variable scopes or unsupported
initial values refuse instead of producing an uninitialized BASIC variable.

Toggle on a declared digital OUTPUT emits one `PROCdigitalToggle(id)` call. It
inverts the host's retained electrical output request, independently of ACTIVE
LOW and the solved net. Each fresh run starts the latch at `0`; successful
writes and toggles update it, and pin-mode changes retain it. Toggle advances no
simulated time and creates one `digital-toggle` trace record. Input toggles and
undeclared or unsupported pins refuse generation with diagnostics.

The `crispbasic-v2` source banner identifies this output-latch contract. It
requires the rebuilt simulation ABI `2` runtime. A legacy custom host without
`digitalToggle` can still execute the original operations, but a toggle call
raises catchable `ERR208` (`unavailable`). There is no sensed-read fallback.

| Device | Logical map accepted by generation |
| --- | --- |
| Arduino Uno/Nano | D0..D13 → 0..13; A0..A5 → 14..19 |
| Arduino Mega | D0..D53 → 0..53; A0..A15 → 54..69 |
| Pico | GP0..GP22, GP25..GP28 → the GPIO number |
| Recognized STC12/STC15/STC89 | P0.0..P7.7 → `8*port + bit` |
| micro:bit / breakout | P0, P1, P2, P8, P12, P16 → their numbers; the host validates the actual exposed subset |
| Calliope mini | P0..P3 → 0..3 |
| Circuit Playground Express (`CPX`) | A0..A7 → 0..7, without the Arduino offset |
| PyBadge | D2, D3, D5, D6, D9..D13 → their numbers; A0..A5 → 14..19 |
| ATtiny85 | PB0..PB4 → 8..12; reset-capable PB5 excluded |
| ATtiny88 DIP | PB0..PB7 → 8..15; PC0..PC5 → 16..21; PC7 → 23; PD0..PD7 → 24..31; PC6 and PA pads excluded |
| STM32F030 | PA0..PA7, PA9, PA10 → the bit number; PB1 → 17 |
| ESP8266 | Pseudocode GP0..GP5, GP12..GP15 → the GPIO number; the Circuit terminal spelling is `gpioN` |
| Eater 6502 default VIA | PA0..PA7 → 0..7; PB0..PB7 → 8..15 |

The connected host still validates actual board terminals and resource limits.
The map is not a claim about physical packages or connections. Unsupported
devices, pins, aliases, modes, input writes, PORT and peripheral PART declarations
refuse. Explicit CHIP/MAP layouts also refuse; the portable Eater mapping refers
only to the default VIA. Analog I/O, PWM, tones and interrupts are not implemented
by this library. The host's 18 electrical profiles are broader than these
language maps: ESP32-S040 and ATtiny88 QFN-only PA pins currently require authored
BASIC. PyBadge's RX/TX, FREE and SPI host pads also require authored BASIC;
SDA/SCL and STEMMA aliases remain excluded. This is not a native MCU firmware generator.

Wait and supported timed statements convert seconds to integer simulated
milliseconds, rounding nearest with half upward: `0.0004 → 0`, `0.0005 → 1`,
`0.025 → 25`. Durations must be numeric seconds in `0..2147483.647`. Literal
errors refuse generation. Computed delays evaluate once and validate before
advancing time; their generated check/call lines retain the owning block map.
The host independently enforces cumulative time, request, trace and solver-work
limits. This is not an instruction-to-time model.

The timer reporter uses `FNmillis / 1000` relative to a private initial/reset
offset. Reset does not rewind the solver or change BASIC `TIME`. Ordinary
authored `TIME` and `WAIT` retain their established runtime semantics. Simulation
time moves only through delays; `wait until` refuses because no implicit polling
interval is defined. A repeat-until loop can contain an explicit wait.

`FNdigitalRead` continues to observe the electrical solution. Under a clamp or
load it can disagree with the stored output request. `PROCdigitalToggle` uses
the separate latch, so a high request clamped electrically low toggles to a low
request. The latch operation does not substitute a read followed by a write.

## Qualified BASIC-to-pseudocode source conversion

Opt into the shared reader explicitly:

```js
const result = basicToPseudocode(source, {mode: 'crispbasic'});
if (!result.ok) showDiagnostics(result.diagnostics);
else saveSource(result.pseudocode); // Preserve the complete source marker.
```

Successful output begins with `# @crispbasic-portable 1`. Its capabilities state
`pseudocode: true`, `blocks: false`, `requiredRuntime: 'crispbasic'`,
`simulationABI: 2` and `freshRun: true`. Recompile only with
`{profile: 'bbc', mode: 'crispbasic'}` and use a fresh portable host with the same
pin model. The marker's version 1 describes the saved source requirement; the
simulation ABI remains version 2.

The strict reverse subset includes:

- Static device/pin metadata and exactly matching ordered pin-mode preludes;
  proven 0/1 electrical writes, atomic latch toggles and solved reads with ACTIVE
  LOW compensation.
- Literal integer millisecond delays, the recognized checked computed waits
  described below, and `FNmillis`, recovered as rounded
  portable timer milliseconds. Conversion does not rewind the solver.
- Lowercase unsuffixed numeric scalars, finite numeric literals, qualified
  arithmetic and comparisons, and quoted literal PRINT strings. BBC comparison
  values retain their -1/0 meaning when used as numbers; digital reads are not
  duplicated by normalization.
- Lowercase numeric procedures after the main `END`, with read-only numeric
  parameters and forward, nested or recursive calls. Arguments retain one
  evaluation each, left to right, including electrical reads and numeric
  BBC Boolean values. Generated parameter names avoid authored globals.
- `PI`, `SQR`, `LN`, signed integer `MOD`, and degree-based trigonometry in the
  exact forms `SIN(RAD(x))`, `COS(RAD(x))`, `TAN(RAD(x))`, `DEG(ASN(x))`,
  `DEG(ACS(x))` and `DEG(ATN(x))`. Ceiling uses `-INT(-x)`, evaluating `x` once.
- Structured IF/ELSE, WHILE, FOREVER and literal-count FOR loops whose private
  counters are unobserved, plus recognized generated numbered control-flow
  shapes. Numbered input must be complete, unique and increasing.
- Clear, the known pen-colour helper, pen up/down, integer go-to/set-x/set-y,
  and direct MOVE/DRAW on the generator's four-unit coordinate grid. The helper
  body and signed 16-bit coordinate bounds are checked.

Forward generation is broader than the reverse subset. Computed delays without
an integer/range proof, dynamic pin modes, arbitrary non-0/1 writes, observed FOR
counters, typed/string variables, arbitrary GOTO, EVAL, unknown expressions,
unsupported graphics and altered helper definitions refuse the whole conversion.
The reader returns no partial pseudocode. Diagnostics name physical source lines
and numbered BASIC lines where present. Runtime request/work budgets still apply;
translation can add bookkeeping instructions or clock observations.

Numeric procedures use lowercase unsuffixed names and definitions after the
top-level `END`. Assigning parameters, `LOCAL`, `BYREF`, arrays, typed/string
parameters, nested definitions, mismatched calls and early `ENDPROC` refuse.
Free references to another procedure's parameter also refuse because BBC's
dynamic scope cannot silently become a pseudocode global. Different procedures
may use the same parameter spelling; generated argument names remain distinct.
Static pin setup still belongs to the main-program prelude.

A computed wait is reversible only with the recognized adjacent range guard
and half-up integer rounding. For a qualified scalar or procedure parameter:

```basic
IF seconds<0 OR seconds>2147483.647 THEN ERROR 204,"CrispBASIC wait seconds outside 0..2147483.647"
PROCdelay(INT(seconds*1000+0.5))
```

The recreated program preserves that guard, its BASIC error, evaluation order
and timing: 0.0015 seconds followed by 0.0025 seconds advances 2 ms then 3 ms.
An arbitrary computed `PROCdelay` expression still refuses. See the executable
[reusable pulse example](examples/procedure-pulses.bas).

Math-domain errors remain BASIC errors. General radian trigonometric forms
refuse because converting through degrees could change floating-point rounding.
Signed `MOD` retains BBC integer-remainder semantics, which is another reason
the saved source must keep its CrispBASIC runtime requirement.

For authored pin calls, metadata must describe their executable setup. For
example, this source can use the portable reader:

```basic
REM @bw device arduino-uno
REM @bw pin lamp D13 output
PROCpinMode(13,"output")
PROCdigitalWrite(13,1)
PROCdelay(25)
PROCdigitalToggle(13)
PRINT "done"
END
```

Metadata alone grants no pin authority. Omitting, reordering or changing the
matching prelude can make conversion refuse even if the BASIC program itself
could execute against a supplied host.

### CLI and saved-source requirement

From the Brickwright repository root:

```sh
node bin/bwlite.mjs convert program.bw --to crispbasic --out program.bas
node bin/bwlite.mjs read program.bas --crispbasic --out program-portable.bw
node bin/bwlite.mjs convert program-portable.bw --to crispbasic --numbered --out numbered.bas
```

The sibling producer uses `node bin/bw.mjs transpile ... --to crispbasic` and
`node bin/bw.mjs read ... --crispbasic`. Refusals preserve existing output files.

Preserve `# @crispbasic-portable 1` in saved pseudocode. The parser records it as
`project.crispbasicSource`, and decompilation and JSON serialization retain that
requirement. Duplicate, malformed or unknown marker versions refuse before
parser mutation. Generic Python, JavaScript, C, MicroPython and SB3 generation,
hardware compilation/flashing and device retargeting refuse marked source.

The ordinary `basicToPseudocode(source)` reader and GUI **To blocks** path still
refuse live portable library calls before replacing a project. This is deliberate:
the source round trip does not qualify ordinary Scratch execution to preserve
electrical reads, retained latches or simulated time. Ordinary supported BASIC
continues to convert with its documented subset warnings. REM consumes the
whole physical line, including colons; quoted API names remain data.

## Evidence and limits

The owning producer checks generation, refusals, its CLI and legacy BBC/6502
output. Brickwright tests the exact vendored source against the real C/WASM
engine, a fixed logical trace and the real pinned electrical solver. A clamped
output fixture explicitly demonstrates a solved read differing from the latch
and checks toggle against the retained request. The producer covers both source
forms and both polarities, mixed writes/toggles, saved metadata and block maps.
Editor tests assert that refusals preserve source and block ownership.
Production Chromium scenarios exercise the generation control, connected
execution, generated active-low latch toggle under a clamp, and the ordinary
To-blocks refusal. The explicit portable reader has separate source-round-trip
and saved-marker gates, including refusal before other language/Blocks exports.
A separate unsupported `wait until` case retains the disabled-Run and
editor-newline refusal regression now that toggle is supported.

See [VALIDATION.md](VALIDATION.md) for observed results, exact revisions and
remaining qualification limits. This change does not qualify all Scratch
language semantics, all VDU operations, other browsers or physical hardware.
