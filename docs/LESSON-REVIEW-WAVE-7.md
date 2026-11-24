# Wave 7 technical review — "Computers from wires upward"

Reviewed 2026-08-23 against `1d10902cb`. Ten lessons, twenty checkpoints.

**8 defective of 10 · 8 revised (one to content version 3, seven to 2) · 8
defects open — five in an example, three in an instrument, none in a lesson.**

Wave 7's benches are whole computers, so this review drives the surfaces the app
drives: `scripts/lesson-bench.mjs` for the analogue benches (the same
`bw-circuit-ui` over `bw-board` the browser runs), `extract6502Machine` and
`extractZ80Machine` for the bus extract behind the designer's **Build Machine**
button, `m6502-debug` for what the machine debugger can report, and lite's own
trace referee for the two MCU programs.

The Tier-3 detector found **1 blocking** — `machines-contention` observes
`circuit-changed` on a bench with no pin declarations, the third wave in a row
to hit that same app defect. The other seven were found by measuring.

## A near-miss that shaped this review

Reading `DebugStatus.jsx` alone says the machine debugger shows a halt flag, a
step button, a millisecond counter and a task list — no registers, no memory, no
disassembly, no cycle count. On that reading three lessons ask for five things
that do not exist, and Wave 7 looks like a catastrophe.

They do exist. `ArchitectureFace.jsx` renders A/X/Y/SP/PC, the P flags, the
address and data buses, IR, the **live disassembly at PC** and the **cycle
count**, with the executed instruction's data path highlighted;
`debug-drawer.jsx` renders a paged, space-selectable memory view and the stack.
Both mount alongside `DebugStatus` for a machine-class bench.

This is the second time in this campaign that stopping at the first component
which answers the question would have produced a dramatic and wrong finding —
Wave 1 recorded the same with the flyback spike, where attaching the scope the
learner would actually use changed the answer by a factor of forty. It is worth
saying plainly: **check the instrument the learner would use, not the first one
you open.**

## What is genuinely good here, measured

- **The bus extract is excellent.** For every working 6502 bench it produces
  exactly the map its lessons ask the learner to derive:

  ```
  MAP RAM $0000-$3FFF
  MAP ROM $8000-$FFFF
  CHIP via  = W65C22 AT $6000
  CHIP acia = W65C51 AT $5000
  💡 via mirrors through $6000-$7FFF (decoded coarsely); its registers sit at $6000
  💡 acia mirrors through $5000-$5FFF (decoded coarsely); its registers sit at $5000
  💡 4096 addresses decode to nothing (open bus) — reads there return $FF
  ```

  Ranges, mirrors **and** the hole, which is precisely
  `machines-memory-maps`'s "inclusive start/end ranges, mirrors or holes" and
  `machines-address-decode`'s "addresses that select zero, one, or multiple
  devices". `CircuitDesigner` renders the lines, the notes and — on failure —
  the reasons, under the Build Machine button.

- **The contention evidence is exact.** `eater6502-contention-bug` refuses with

  ```
  bus contention at $2000: ram and via are both selected — the decode must make them exclusive
  ```

  naming the address and both claimants, which is exactly what
  `machines-contention` asks the learner to confirm.

- **The machine benches need no network.** `debug-runner.js` skips the image
  build entirely for machine-class targets —
  `(selectedKind === 'z80' || selectedKind === 'eater6502') ? null : await build()`
  — so Wave 5's defect 0, which puts all ten of its lessons behind a hosted
  compiler, does **not** apply to any of Wave 7's machine lessons. Their ROMs
  are bundled static assets.

- **The 6502 debug target reports everything the execution lesson wants.**
  `capabilities().steps` = `insn`, `over`, `out`; `breakpoints` = `code`,
  `write`; `regs()` returns pc/a/x/y/sp/p **and cycles**; `disasm(addr)`
  disassembles live from machine memory; `readMem(space, addr, len)` reads it.
  Booted on the LCD Hello preset the machine starts at `$8000` with `LDA #$FF`.

- **The clock module oscillates cleanly and tunably.** Measured on the 555
  output at three potentiometer settings:

  ```
  pot        10 %      50 %      90 %
  period   127.10 ms  71.09 ms  15.00 ms
  high      63.20 ms  35.40 ms   7.80 ms
  duty       49.7 %    49.8 %    52.0 %
  ```

## Verdicts

| lesson | example | v | verdict |
| --- | --- | --- | --- |
| machines-logic-levels | 06-active-low-high | 2→**3** | **defect, fixed** — its measured 4.93 V holds only in push-pull; in the 8051's default mode the same pin reads 2.12 V |
| machines-gates-registers | 20-shift-register-binary | 1→2→**3** | defect, **example FIXED upstream 2026-08-24** (prefix bit test → infix); the defect under it was **isolated and mostly closed 2026-08-29** — see defect 2 — and it was not in the compiler |
| machines-clocks | ttl-clock-module | 1→2→3→**4** | defect ×2, **BENCH FIXED 2026-08-29** — the step button was wired to nothing and there was no downstream state to advance; sb3-creator `56bd1ce` gave it a D flip-flop as a divide-by-two on the button's own edge, so both halves are demands again |
| machines-buses | eater6502-bench | 1→**2** | **defect, fixed** — "single-step the clock" has no cycle-level step, and the scope is ten times too slow for the bus |
| machines-memory-maps | eater6502-full-build | 1 | achievable |
| machines-address-decode | eater6502-bench | 1 | achievable |
| machines-6502-execution | eater6502-blink | 1→**2** | **defect, fixed** — the bench boots with an empty ROM; the example's own program is not the image |
| machines-source-asm | eater6502-vdp-hello | 1→**2** | **defect, fixed** — same empty ROM, plus the listing view needs the hosted assembler |
| machines-contention | eater6502-contention-bug | 1→**2** | **defect, fixed** — its observable cannot fire; the evidence side is the best in the wave |
| machines-interrupts-performance | z80-bench | 1→**2** | **defect, fixed** — no interrupt source until a preset is loaded, and no usable external timing route |

## The defects

### 1. machines-logic-levels — the quoted high level belongs to one port mode

The lesson is already version 2 and its hint quotes measured numbers: "P1.0
low = 0.07 V lights the active-low LED; P1.1 high = 4.93 V lights the
active-high one". Both are right — for a **push-pull** port. Measured on the
bench in each mode, driving P1.0 low and P1.1 high:

```
mode        V(P1.0)   V(P1.1)   active-low LED   active-high LED
pushpull    0.0725    4.9275        0.1449            0.1449
quasi       0.0725    2.1193        0.1449            0.0066
```

The 8051's default is quasi-bidirectional: a weak pull-up that cannot source an
LED. The active-low LED is unaffected — that is *why* active-low is the
convention on this family — while the active-high one drops to about 4 % of its
brightness and the "high" a learner measures is 2.8 V lower than the hint says.
A learner in the default mode reading 2.12 V concludes they mismeasured.

**Fixed**, version 3: the hint now labels its numbers as the push-pull case,
gives the quasi-mode reading beside it, and makes the contrast the point —
same bit, same Boolean meaning, different electrical level, which is the
lesson's own objective.

> **Re-measured 2026-11-24** (bw-board `489ca7c6`; LEDs exponential since
> `74d42338`): push-pull 0.0794 / 4.9206 V, both LEDs 0.1587; quasi P1.1 high
> 1.7251 V, active-high LED 0.0076. The hint's quasi figure moved 1.93 -> 1.73 V
> (EN/DE); the push-pull figures it quotes (0.08 / 4.92 V) still hold.

### 2. machines-gates-registers — the register was fed a constant zero — FIXED 2026-08-24

The `trace` checkpoint asks the learner to "correlate data, clock, latch,
internal sequence, and final LEDs". Run through lite's own trace referee for
3 s of program time, `20-shift-register-binary` produces:

```
clock  208 edges     latch  26 edges     data  0 edges
```

The data line never changes level, so every byte shifted in is zero and all
eight LEDs stay dark. One of the four signals the checkpoint correlates is flat.

Isolated to a three-line reproduction — and the result is not what it first
looks like:

```
IF bitand val 128 > 0 THEN     (val = 128)   ->  false, no pin edge
IF (bitand val 128) > 0 THEN   (val = 128)   ->  false, no pin edge
IF bitand val 128 THEN         (val = 128)   ->  TRUE, data goes high
```

So it is not operator precedence — parentheses do not help — but the
**comparison of a bitops reporter against a number**, which is false even when
the bit is set. Whether the fault is in the emitted comparison or in the
referee's evaluation of it was not isolated, and that is stated rather than
guessed: the real device runs generated C, not the referee. What is certain is
that lite's own execution model shifts zeros through this example.

**Fixed**, version 2 at the time: the checkpoint had the learner record that the
data line never moves, explained that a stuck data line shows up as eight
identical bits, and named the working form.

**The example was repaired upstream on 2026-08-24**, by rewriting the bit test
from the PREFIX form to the INFIX one — `IF (val bitand 128) > 0` where it was
`IF bitand val 128 > 0`, and `set val to (val shiftleft 1) bitand 255` where it
was `set val to bitand shiftleft val 1 255`. Re-measured over the same 3 s of
program time:

```
              before        after
clock          208           208
latch           26            26
data             0            32
```

All four signals move, so the correlation the checkpoint asks for is real.
Version 3 drops the never-moves finding and quotes the three edge counts,
adding the thing actually worth noticing: the data line changes only BETWEEN
clock pulses, never during one, and that ordering is what makes the shift
deterministic.

**And the finding underneath it has a different shape than I reported.** I wrote
that "it is not operator precedence — parentheses do not help — but the
comparison of a bitops reporter against a number". The first half is right and
the second is too broad. Measured across all six forms:

```
  bitand val 128 > 0      prefix, compared    no edge
  (bitand val 128) > 0    prefix, compared    no edge     <- parentheses do not help
  bitand val 128          prefix, bare        fires
  val bitand 128 > 0      infix,  compared    fires
  (val bitand 128) > 0    infix,  compared    fires       <- the form now shipped
  (val bitand 128)        infix,  bare        no edge
```

The two forms have **complementary holes**: prefix works bare and fails
compared; infix works compared and fails bare. "A bitops reporter compared
against a number is false" would have predicted the fourth and fifth lines
wrong. Whether the fault is the emitted comparison or the referee's evaluation
is still not isolated — the real device runs generated C — so that stays
recorded rather than claimed, and all six lines are now pinned by the gate.

> **ISOLATED AND MOSTLY CLOSED 2026-08-29** (sb3-creator `32b1e1a`), and the
> answer was neither of the two readings above. **The referee's own truth test
> was inverted** — `num("true")` is 0 — so a bare value in condition position was
> answered four different ways by four backends, and the disagreement was
> invisible because the referee, the thing every measurement above went through,
> was one of the four. Both "it is the comparison" and "they are complementary
> holes" were descriptions of that shadow. One `boolishTruthTest` is now promoted
> to all four backends, and the PREFIX spelling is **refused by name** instead of
> evaluated to something: it is a variable reference to a variable nothing ever
> writes, and saying so is more useful than silently reading zero. Re-measured
> here against the vendored compiler and referee:
>
> ```
>   bitand val 128 > 0      prefix, compared    refused, with the naming warning
>   (bitand val 128) > 0    prefix, compared    refused, with the naming warning
>   bitand val 128          prefix, bare        refused, with the naming warning
>   val bitand 128 > 0      infix,  compared    fires
>   (val bitand 128) > 0    infix,  compared    fires       <- the form shipped
>   (val bitand 128)        infix,  bare        fires       <- was the second hole
>   not (val bitand 128)    infix,  negated     correctly does NOT fire
>   not (val bitand 1)      infix,  negated     fires
> ```
>
> The warning text is the repair's other half: *"`bitand val 128` reads as a
> VARIABLE NAME, and nothing ever writes it. The bit operators are infix in this
> dialect — write `val bitand 128`."* 0 false positives over 280 programs.
>
> **What is still open is a different shape and lives upstream**: `not <cond>` in
> VALUE position (rather than condition position, which measures correct in both
> directions above) is a phantom variable, and `cToPseudocode` EMITS that shape —
> so it needs a dialect decision rather than a patch. It is pinned as an OPEN
> DEFECT test in sb3-creator.

### 3. machines-clocks — nothing downstream, and a step button that reaches nothing

Two faults on `ttl-clock-module`.

**(a) There was no downstream state.** The board was a 555, three resistors, a
potentiometer, two capacitors, one LED, one button, a supply and a ground —
measured, that is the complete part list. No flip-flop, no counter, no register.
The `predict` step asks "which edge advances downstream state" and the `measure`
step asks the learner to "verify exactly one downstream transition". There is
nothing downstream of the oscillator but an LED.

**(b) The step button was electrically isolated.** This was topology, not timing:
the net carrying `btn1.b` carries exactly one other terminal, `r3.a`, and `r3`'s
other end is ground. The button and its pull resistor form a divider whose
midpoint connects to nothing. The timer's `reset` pin, meanwhile, sits on the
supply rail, so the button cannot halt the oscillator either.
`ttl-clock-module/EXPECTED.md` nevertheless states "The manual step button
injects a single pulse when pressed."

**Worked around**, version 2: the checkpoint measured period, high and low time
at three potentiometer settings — which works, and works well — and asked the
learner to say what a single-step control would have to reach, given that this
board's button reached nothing.

> **BOTH FIXED 2026-08-29** (sb3-creator `56bd1ce`), and version 4 restores both
> halves as demands. The bench grew a **D flip-flop wired as a divide-by-two** —
> D tied to its own Q̄ — with the step button on its clock. Re-measured here
> against the vendored engine:
>
> ```
> btn1.b net    btn1.b, ff1.clk, r3.a      (was: btn1.b, r3.a, and nothing else)
> ff1.d net     ff1.d, ff1.q_bar           (divide-by-two)
> ff1.q  net    ff1.q, r4.a                (the second LED)
> Q at rest     0.0000 V
> press 1       4.4643 V   released 4.4643 V   <- it HOLDS
> press 2       0.0000 V   released 0.0000 V
> press 3       4.4643 V   press 4  0.0000 V
> ```
>
> **Re-measured 2026-11-24:** Q sets to 4.4064 V (exponential LEDs, bw-board
> `74d42338`; sb3-creator `9f50f601` re-derived EXPECTED.md to match). The hint
> quotes 4.4064 V in both languages and the gate asserts that figure.
>
> The holding is the point: it is what distinguishes stored state from a button
> the LED merely follows. 4.4643 V is hand-computed in the example's own
> EXPECTED.md from the drop across R_OUT, and the engine agrees to four decimals.
> The timer's `reset` is still strapped to the supply, so the oscillator still
> cannot be halted — and the lesson now says single-stepping happens *downstream*
> of it rather than to it, which is true and is also the better idea.

### 4. machines-buses — "single-step the clock" is finer than any control offered

The `trace` checkpoint says "Single-step the clock and reconstruct the cycle from
signal state". Three measurements bound what is possible:

- the 6502 debug target's step granularities are `insn`, `over`, `out` —
  there is no cycle step;
- the circuit-side step button is labelled "Advance one 50 ms tick", which at
  1 MHz is fifty thousand cycles;
- the scope samples every 10 µs against a 1 µs bus cycle.

So the per-cycle bus picture cannot be captured at all. What *can* be done is
one instruction at a time, reading address and data off the architecture face
and memory out of the drawer — which still supports the lesson's real question,
who drives what in each phase, as a reconstruction rather than a capture.

**Fixed**, version 2: the action now steps by instruction and reconstructs the
cycles, and the hint states all three limits.

### 5, 6, 7. The three machine benches boot with an empty ROM

`machines-6502-execution`, `machines-source-asm` and
`machines-interrupts-performance` all wait for the debugger to halt and then ask
the learner to step through a program. None of them says which program, and the
answer is: none.

- No example in this wave ships a ROM image — every `28c256` part carries
  `params: {}`, and no example declares media.
- `sb3-creator` has no assembler, and the runner skips the image build for
  machine-class targets, so the example's `program.bw` never becomes the ROM.
- The runner therefore reports, in its own words, *"extracted machine booted
  with an empty ROM — load a program (presets, file, or ASM tab)"*.
- Measured on the empty machine: the reset vector reads `$0000` and the CPU sits
  on `BRK #$00`.

The remedy exists and is bundled — the machine loader offers Tali Forth 2, MS
BASIC (6502) and LCD Hello for the 6502, Switch Mirror and BBC BASIC for the
Z80, all as static assets — but no lesson mentions it. Booted on LCD Hello the
same bench starts at `$8000` with `LDA #$FF`, and every view the lessons name is
populated.

`machines-source-asm` carries one more limit: its ASM *listing* view is built by
the hosted assembler (Wave 3's finding), while the running machine's
disassembly is local. The lesson asks the learner to label each view as editable
source or generated evidence, so the distinction belongs in that label.

`machines-interrupts-performance` carries another: its hint says to "use pin
edges for external timing", and the scope cannot resolve a Z80's cycles.

**Fixed**, version 2 each: `machines-6502-execution` now starts with Build
Machine and a preset and names where each view lives;
`machines-source-asm` labels both the empty ROM and the hosted listing;
`machines-interrupts-performance` names the preset and drops the pin-edge route
in favour of the instruction trace.

### 8. machines-contention — the third wave to meet the same dead observable — FIXED 2026-08-24

`circuit-changed` maps to `bw-circuit-changed`, dispatched only when the derived
**pin declarations** change. A 6502 bench has none, so no wiring edit can fire
it. Wave 1 recorded this for `starter-circuit-path`, Wave 6 for
`signals-resonance`, and here it is a third time.

**Fixed**, version 2: the checkpoint now names Build Machine as the evidence —
which refuses with the conflicting address before the repair and prints the map
after it — and tells the learner to tick the step manually.

**The app defect is fixed as of 2026-08-24**, in the repo that owns it.
`CircuitDesigner` gained `onCircuitEdit`, a second callback fired from a
structural signature of the circuit (part ids, kinds, params, wire endpoints)
rather than from the derived declarations, and lite's `circuit-tab.jsx`
dispatches `bw-circuit-changed` from it. So a wiring repair on a 6502 bench —
which has no pin declarations to move — now reaches the lesson. Three waves
found this one at a time; `docs/WAVE-OPEN-DEFECTS.md` D6 records it once. The
"tick it manually" sentence stays in the hint: it costs nothing and a learner
who mis-clicks still needs the button.

## Checkpoint ledger

| checkpoint | settled by |
| --- | --- |
| machines-logic-levels/predict | off-bench (predict voltage, bit, assertion) |
| machines-logic-levels/measure | **defect 1**, measured in both port modes |
| machines-gates-registers/predict | off-bench (write the bit order for 0xA5) |
| machines-gates-registers/trace | **defect 2**, measured under the referee |
| machines-clocks/predict | off-bench (predict ten edge times) — but see defect 3a |
| machines-clocks/measure | **defect 3a + 3b**, measured and topological |
| machines-buses/predict | off-bench (predict one read cycle) |
| machines-buses/trace | **defect 4**, three granularities measured |
| machines-memory-maps/predict | off-bench (derive ranges from the decode) |
| machines-memory-maps/verify | achievable — extract lines and notes measured |
| machines-address-decode/predict | off-bench (write and simplify select equations) |
| machines-address-decode/test | achievable — same evidence, plus DRC |
| machines-6502-execution/predict | off-bench (predict PC, registers, cycles) |
| machines-6502-execution/step | **defect 5**, empty ROM measured; the views verified |
| machines-source-asm/predict | off-bench (predict calls, bytes, device writes) |
| machines-source-asm/trace | **defect 6**, empty ROM + hosted listing |
| machines-contention/predict | off-bench (predict both selects from the decode) |
| machines-contention/repair | **defect 8**, detector-confirmed; evidence verified |
| machines-interrupts-performance/predict | off-bench (define trigger, deadline, load) |
| machines-interrupts-performance/measure | **defect 7**, empty ROM + scope cadence |

All twenty accounted for.

## What I could not check

- **No browser.** The debug faces were read, not rendered: `ArchitectureFace`
  and `debug-drawer` were verified to consume `regs`/`disasm`/`readMem` and to
  draw the cycle count and the memory pane, but nobody watched them update.
- **No live stepping.** The 6502 target's `step(kind)` arms a pending step that
  the session's `runFor` loop executes; driving that loop faithfully outside the
  app was not attempted, so what is asserted about the debugger is its
  *contract* — capabilities, register fields, disassembly at a known address —
  and not a stepped trace. My first attempt to step it in Node produced a
  machine that never advanced, which was my harness and not the product; that
  is exactly the failure mode this section exists to prevent me reporting.
- **Whether the shift-register fault is the compiler's or the referee's.**
  Isolated to the comparison, not attributed. The real device runs generated C.
- **`eater6502-full-build`'s cost.** The Tier-3 detector needed 459 s to solve
  it once — by far the most expensive bench in the catalog — and what that means
  for a browser was not measured. Recorded because `machines-memory-maps` names
  that bench.
- **The German copy**, revised alongside the English, is not independently
  reviewed.

## Reproducing this

```
node --test test/lesson-bench-claims-wave7.test.mjs
```

Six of its thirteen tests were named `OPEN DEFECT`. They fail the day the port
mode question is settled, the shift register's data line moves, the clock
module's button is wired, a cycle step appears, an example ships a ROM, or
`circuit-changed` learns to fire — each message naming the lesson hint to soften
and this document to update.

**Two fired on 2026-08-24** and were retired per their own instructions: the
shift register's data line (the example was repaired upstream) and
`circuit-changed` (fixed in bw-circuit-ui). Both were replaced by positive
assertions, and the shift-register one carries the six-form probe above, so the
compiler defect that survives cannot quietly change shape again.

The gate is mutation-proven: changing the clock module's potentiometer from
100 kΩ to 50 kΩ turns the oscillator test red, and reverting restores it.
