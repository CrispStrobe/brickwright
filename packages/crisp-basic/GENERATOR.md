# Portable generation and the reverse boundary

The shared implementation belongs to `CrispStrobe/sb3-creator`. Brickwright's
`vendor-pins.json` identifies the exact adopted revision, and the existing sync
derives both tracked compiler mirrors. The incubation producer is based on the
previous pin `1c29f69fd22c86ecb0051938eedb246921cb3b88`, keeping this adoption
separate from unrelated later upstream work. No board, Circuit or interpreter
pin changes are required.

The producer also reconciles the existing Microtronic gallery entry with its
already-published source, so the new pin accounts for the complete current
consumer gallery. No consumer example changes. [VALIDATION.md](VALIDATION.md)
records that baseline provenance and the observed qualification.

## Use in the Code tab

1. Choose **BAS → BBC BASIC → CrispBASIC (browser)**.
2. Select **Generate portable Circuit calls** and click **From blocks**.
3. Inspect the generated source and any diagnostics.
4. Load a supported Circuit and select **Connect Circuit** to execute the
   library calls on its existing solver.

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

| Device | Logical map accepted by generation |
| --- | --- |
| Arduino Uno/Nano | D0..D13 → 0..13; A0..A5 → 14..19 |
| Arduino Mega | D0..D53 → 0..53; A0..A15 → 54..69 |
| Pico | GP0..GP22, GP25..GP28 → the GPIO number |
| Recognized STC12/STC15/STC89 | P0.0..P7.7 → `8*port + bit` |

The connected host still validates actual board terminals and resource limits.
The map is not a claim about physical packages or connections. Unsupported
devices, pins, aliases, modes, input writes, PORT and peripheral PART declarations
refuse. Analog I/O, PWM, tones and interrupts are not implemented by this library.

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

Toggle also refuses. `FNdigitalRead` observes the electrical solution, not an
output latch. Under a clamp or load it can disagree with the stored output
request. Inverting that read does not implement latch toggle. Use explicit
writes or a program-owned state variable.

## To blocks

Live portable calls and definitions currently return a hard conversion refusal
with an empty pseudocode result. Diagnostics name the operation and physical
source line, plus the numbered BASIC line when present. Both the ordinary
**To blocks** path and intermediate language derivation honor this refusal
before parsing or replacing a project. The terminal CLI also preserves an
existing output file on refusal.

This qualifies a refusal boundary, not a portable-library round trip. Supporting
reverse conversion later requires preserving pin polarity, simulated-clock
units, reset offsets, validation and expression evaluation. Unknown functions
must not become zero and library procedures must not become unresolved custom
blocks. Existing supported BASIC still converts with its subset warnings.

REM retains the whole physical line, including colons. A hardware instruction
written in a comment remains a comment, and quoted operation names remain data.
Computed source through EVAL has no qualified reverse meaning and also refuses.

## Evidence and limits

The owning producer checks generation, refusals, its CLI and legacy BBC/6502
output. Brickwright tests the exact vendored source against the real C/WASM
engine, a fixed logical trace and the real pinned electrical solver. A clamped
output fixture explicitly demonstrates a solved read differing from the latch.
Editor tests assert that refusals preserve source and block ownership. Two
production Chromium scenarios exercise the new generation control, connected
execution, reverse refusal and disabled Run after toggle refusal.

See [VALIDATION.md](VALIDATION.md) for observed results, exact revisions and
remaining qualification limits. This change does not qualify all Scratch
language semantics, all VDU operations, other browsers or physical hardware.
