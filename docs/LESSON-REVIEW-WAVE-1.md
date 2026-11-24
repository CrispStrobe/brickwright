# Wave 1 technical review — "Electricity you can see"

Reviewed 2026-08-23 against `3c6948f5d`, twelve lessons.

The question this review asks of each lesson is not whether it reads well. It is:
**the checkpoint waits for the learner to observe something — can the bench it names
actually do that?** Two of the first three lessons ever put to this question failed it
(`electricity-diode` asked for alternating traces from a static-polarity bench;
`electricity-capacitor` asked for discharge observations from a charge-only bench).
Both were revised to content version 2 before this pass began.

Every number below came out of the engine the browser runs — `bw-circuit-ui`'s
`Circuit.fromJSON` over a fully-registered `bw-board` — via `scripts/lesson-bench.mjs`.
None of it is arithmetic done on the side and reported as a measurement.
`test/lesson-bench-claims.test.mjs` re-derives all of it on every run, so a verdict
here cannot quietly stop being true.

## Verdicts

| lesson | example | v | verdict |
| --- | --- | --- | --- |
| electricity-polarity | 28-diode-polarity | 1→**2** | **defect, fixed** — asked the learner to find two LED directions on a bench where both LEDs face the same way |
| electricity-resistance | 45-led-current-comparison | 1 | achievable |
| electricity-ohms-law | 34-ohms-law | 1 | achievable |
| electricity-series-parallel | 22-series-parallel | 1→**2** | **defect, fixed** — the conservation equation it told the learner to write is false on this bench by 3.158 mA |
| electricity-button | 11-toggle-button | 1 | achievable — circuit *and* program executed |
| electricity-capacitor | pc29-capacitor-discharge | 2 | achievable — the earlier revision verified |
| electricity-inductor | pc52-inductor-filter | 1→**2** | **defect, fixed** — at the state the lesson opens, "before" and "after" are 0.2 mV apart |
| electricity-diode | pc31-bridge-rectifier | 2 | achievable — the earlier revision verified |
| electricity-transistor-switch | 38-npn-switch | 1→2→**3** | switching is sound; the instrument lied about collector current — **engine defect FIXED 2026-08-24**, copy restored |
| electricity-motor-flyback | pc26-motor-clamp | 1→**2** | **defect, fixed** — asked to verify a condition "while powered" on a bench that opens with the switch off |
| starter-circuit-path | 47-battery-led | 1 | achievable, but **one observable cannot fire** (app defect, open) |
| instrument-voltage-divider | 52-battery-voltage-divider | 1 | achievable |

Five of twelve carried a defect. That rate — and it is the second pass in a row to find
them at roughly this rate — is the argument for finishing waves 2–7 before shipping
anything new.

## The defects, with evidence

### 1. electricity-polarity asked about an LED the bench never reverses

`28-diode-polarity`, solved at t = 50 ms:

```
part   kind     V(anode)   V(cathode)   state
led1   led        2.0469      0.0000     FORWARD
led2   led        2.0000      0.0000     FORWARD      <- also forward
d1     diode      2.7939      2.0469     FORWARD
d2     diode      2.0000      5.0000     reverse      <- the reversed part
```

The lesson's objective was "whether reversing an **LED** changes the circuit" and its
`inspect` checkpoint was "identify both **LED** directions". There is one LED direction
on this bench. The reversed component is the diode `d2`, and the branch it blocks
carries 0.000 mA against the forward branch's 4.694 mA, which is a good demonstration —
of diode polarity. The hint made it worse by saying "compare the symbol and lead
orientation, not only LED colour" when colour (green/red) is the *only* way the two LEDs
differ.

**Fixed** in copy, EN and DE: the lesson now names the diodes as the thing that differs
and the LEDs as the readout. Bumped to version 2.

### 2. electricity-series-parallel told the learner to write an equation that is false here

`22-series-parallel`, solved at t = 50 ms:

```
supply rail bb1:rail-t+ carries   r1.a  r3.a  r4.a  vcc1.vcc
  series branch   (r1+r2+led1)     3.158 mA
  parallel br. 1  (r3+led2)        6.250 mA
  parallel br. 2  (r4+led3)        6.250 mA
  supply          (vcc1)          15.658 mA  = 3.158 + 6.250 + 6.250
```

The `test` checkpoint's hint was "Write Isource = Ibranch1 + Ibranch2 for the parallel
case." The two parallel branches sum to 12.500 mA and the only source terminal carries
15.658 mA, because the series branch hangs off the same rail. **There is no node on this
bench where the stated equation holds** — a learner who measures carefully finds a
3.158 mA discrepancy and concludes they mismeasured.

**Fixed** in copy, EN and DE: the hint now states `Isupply = Iseries + Iparallel1 +
Iparallel2` and explicitly warns that the two parallel branches alone add to less than
the supply current. Bumped to version 2.

### 3. electricity-inductor asked for a comparison of two identical traces

`pc52-inductor-filter` as the lesson opens it — a 5 V DC source, settled:

```
V(before the inductor, r.b)  = 4.5261 V
V(after  the inductor, load.a) = 4.5263 V     difference: 0.2 mV
```

The `observe` checkpoint said "Compare the signal before and after the inductor filter"
and hinted "look at edge shape". There is no signal and no edge: a settled inductor is a
wire. Nothing in the lesson asked the learner to *make* a change, which is the only thing
that puts a difference on the screen. Stepping the source 0 → 5 V and sampling:

```
t after the edge     20 us    50 us   100 us   200 us   500 us     1 ms    20 ms
V(before)           4.1669   3.2070   2.1451   1.1027   0.2869   0.3877   4.0356
V(after)            0.0017   0.0070   0.0213   0.0602   0.1971   0.4296   4.0413
```

So the observation is real, and it lives in the first millisecond. A second finding while
measuring it: the load node's ~9 ms settling is the **100 µF capacitor's**, not the
inductor's. Replacing the 10 mH inductor with a near-short leaves the load trace almost
unchanged (0.4712 V vs 0.4296 V at 1 ms; 4.0357 V vs 4.0356 V at 20 ms) — the inductor's
whole contribution is the fast jump on the *upstream* node. A lesson that credits the
smooth load response to the inductor teaches the wrong cause.

**Fixed** in copy, EN and DE: the checkpoint now instructs the learner to set the source
to 0 V and back to 5 V, to use the scope rather than the meter, to look at the first
millisecond, and it attributes the slow tail to the capacitor and the fast jump to the
inductor. Bumped to version 2.

### 4. electricity-motor-flyback asked to verify a condition "while powered" on an unpowered bench

`pc26-motor-clamp` opens with `sw1` open. Every node reads 0.0000 V. The `trace`
checkpoint said "verify that the diode is reverse-biased **while powered**", and nothing
in the lesson told the learner to close the switch. With it closed:

```
V(d1.cathode) = 8.9980 V     V(d1.anode) = 0.0000 V     -> reverse-biased, as taught
```

The turn-off spike is real but needs the right instrument, and the lesson named none.
Read through the path a control click actually takes — `CircuitDesigner.handleControlChange`
advances the board by exactly 1 ms — the switched node reads **−0.27 V** after opening,
which looks like nothing happened. With a 100 kHz scope channel attached, which is what
`ScopePanel` does, the board sub-steps to the 10 µs sample cadence and the spike is there:

```
                       meter path (1 ms advance)     scope channel (10 us)
as shipped, with d1              -0.2695 V                  -10.09 V
d1 removed                       -5.2073 V                  -27.29 V
```

**Fixed** in copy, EN and DE: close the switch first, verify the reverse bias while it
runs, and put the scope on the switched node before opening it. Bumped to version 2.

I nearly filed this as "the spike is not observable at all", on the strength of the 1 ms
reading alone. Attaching the scope channel — the instrument the learner would actually
use — changed the answer by a factor of forty. Recording that because it is the second
time this month a dramatic result turned out to be a property of the rig.

### 5. starter-circuit-path's `circuit-changed` observable cannot fire — OPEN, app-side

`guided-lessons.jsx` maps the lesson observable `circuit-changed` to the DOM event
`bw-circuit-changed`. That event has exactly one producer: `circuit-tab.jsx`'s
`handleDeclarationChange`, which `CircuitDesigner` calls only when
`JSON.stringify(circuitToDeclarations(parts, wires, resolvedNets))` **changes**.

On `47-battery-led` — battery, resistor, LED, breadboard, no MCU — the declarations are
constant:

```
edit                                    declarations after      event?
change the resistance 1k -> 470   {"pins":[],"ports":[],"parts":[]}   no
break one wire                    {"pins":[],"ports":[],"parts":[]}   no
delete the LED entirely           {"pins":[],"ports":[],"parts":[]}   no
```

Those first two are precisely the edits the checkpoint's hint suggests ("try a different
resistance or briefly break and restore one wire"). The checkpoint can therefore only
ever be completed by its manual button. It is worth being clear about the severity: the
learner is **not** misled and **not** blocked, only unaided — which is why this is left
open rather than papered over by deleting the observable from the lesson. The lesson's
intent is right; the app should emit `bw-circuit-changed` when the circuit changes, not
only when the derived pin declarations do.

Not fixed here because the fix belongs in `CircuitDesigner`, which is vendored from
`bw-circuit-ui` and would be reverted by the next `npm run sync:circuitui`. Pinned by
`test/lesson-bench-claims.test.mjs`, which fails when the behaviour changes so this
document gets updated with it.

### 6. The ammeter contradicts itself on a transistor terminal — FIXED 2026-08-24

`38-npn-switch` switches correctly. Base 0.0050 → 0.6957 V, collector 4.0146 → 0.07829 V,
LED branch 0 → 6.6113 mA, LED brightness 0 → 0.33056 (re-measured 2026-11-24 on bw-board
489ca7c6: exponential LEDs, 74d42338 — the released collector hangs on the LED's leakage). The `test` checkpoint asked the
learner to "compare base voltage, **collector current**, and LED state" — and that middle
reading is wrong. Taken through the real learner-facing path (`getMeterReading` in
current mode, which is what the placeable meter part uses):

```
ammeter probe on q1.collector    reads 43.0 mA
ammeter probe on r1.b            reads  5.8 mA     <- same series loop
ammeter probe on led1.anode      reads  5.8 mA     <- same series loop
ammeter probe on rb1.b           reads  0.4 mA
ammeter probe on btn1.a          reads  0.0 mA     <- in series with rb1, so it is 0.4 mA
```

43.0 mA is β·I_b = 100 × 0.43 mA — what the model would drive into an ideal load, not what
this saturated stage passes. `branchCurrent()` returns a device model's own quantity on a
device-model terminal rather than the solved branch current, and returns a flat zero for
`switch`, `button` and `dc_motor` terminals. Node voltages are unaffected and correct;
this is a reporting defect, not a solver defect.

**Partly mitigated** in copy at the time: the hint told the learner to measure the collector
current in the load resistor rather than on the transistor terminal, and said plainly why.
Bumped to version 2.

**Fixed at the source 2026-08-24** (bw-board `6df60a5`, vendored here), and the copy is
restored to version 3. Two separate faults, both in the *extraction* rather than the solve:

- the BJT extraction always computed `beta * Ib`, ignoring the region. The stamp already
  knew better — in saturation it replaces the VCCS with a stiff Vce clamp, so the collector
  passes whatever the load passes — and the extraction now uses the same clamp;
- `button` and `switch` are stamped as plain two-terminal conductances and nothing
  extracted their current, so `branchCurrent` fell through to its flat 0. `dc_motor` gets
  the same treatment through a `branchCurrents` hook.

Re-measured on the same bench, through the same `getMeterReading` path:

```
                       before (Wave 1)        after
q1.collector             43.0 mA             5.8321 mA
r1.b                      5.8 mA             5.8321 mA
led1.anode                5.8 mA             5.8321 mA
q1.base                   0.4 mA             0.4304 mA
rb1.b                     0.4 mA             0.4304 mA
btn1.a / btn1.b           0.0 mA             0.4304 mA
```

Every reading in a series loop now agrees to four figures, and KCL holds across the whole
bench. Version 3's hint quotes those numbers and asks for the collector current directly,
which is what the lesson wanted in the first place.

### 7. `dc_motor` ignored its declared winding resistance — ALREADY FIXED, re-measured 2026-08-24

Found while measuring the flyback bench; it does not change that lesson's verdict, but it
makes `pc26-motor-clamp/EXPECTED.md` wrong, so it is recorded here.

`motor1` declares `windingR: 10`. At 8.998 V across it the current should be 0.900 A.
Measured, advancing to the same 50 ms by different step sizes:

```
advance step     1 us     10 us    100 us     1 ms    10 ms    50 ms
I(winding)     1.801 A   1.818 A   1.980 A  1.980 A  1.980 A  1.980 A
implied R      4.995 Ω   4.951 Ω   4.546 Ω  4.545 Ω  4.545 Ω  4.545 Ω
```

`devices/dc-motor.js` stamps the winding's series inductance companion conductance
`dt/L` **in parallel** with `1/R` rather than in series with it, so the branch is
R ∥ L-companion and the steady-state answer is a function of the solver's step. A DC
operating point must not depend on `dt`.

Consequence for the docs: `pc26-motor-clamp/EXPECTED.md` quotes "0.9 A through the 10 Ω
winding" and a clamped bound "about −9.7 V". The bench now gives 1.80–1.98 A and a bound
near −20 V at fine steps (−10.09 V at the scope's 10 µs). The *qualitative* claim that
file exists to make — unbounded without the diode, bounded with it — reproduces exactly,
and that is the claim the lesson teaches:

```
sample step     no diode     with d1
  100 us        -27.29 V    -10.09 V
   10 us       -206.78 V    -17.90 V
    1 us      -1988.55 V    -20.19 V
  0.1 us     -19804.73 V    -20.46 V
```

EXPECTED.md's numbers are left alone pending the engine fix, since correcting them to
today's dt-dependent values would only have to be corrected again.

**Re-measured 2026-08-24 against `7ce24a619`: it no longer reproduces.** `dc-motor.js` now
declines to stamp the winding inductance at all, and the board expands every `dc_motor`
into a motor plus a first-class solver inductor on a hidden series net
(`_expandMotorWindings`), so the motor's `a` pin sits between L and R and the resistive
formula reads the true series current:

```
advance step     100 us     1 ms     10 ms     50 ms
I(winding)       0.8999 A  0.8999 A  0.8999 A  0.8999 A
```

9 V across a declared 10 Ω winding, at every step size — which is exactly what
`pc26-motor-clamp/EXPECTED.md` said all along, so that file needed no correction after all.
The finding expired between the Wave 1 vendor (`3c6948f5d`) and today; it was not fixed by
this campaign, and the new gate pins it so it cannot come back. Re-measuring the clamp
while I was there found one thing the doc DID need: the diode-clamped bound is now
−9.6973 V at every sample step rather than climbing −3.5 / −8.1 / −9.5 / −9.7 V as the step
shrank, and the unclamped spike is still unbounded. EXPECTED.md is updated upstream.

## The eight lessons with no defect, and what was measured

- **electricity-resistance** / `45-led-current-comparison`: 220 Ω → 13.043 mA, 470 Ω →
  6.250 mA, 1 kΩ → 2.970 mA; brightness 0.652 / 0.313 / 0.149. Monotone and separable by
  eye, which is what the `compare` checkpoint needs.
- **electricity-ohms-law** / `34-ohms-law`: the lesson has the learner calculate
  (5 − 2)/1000 = 3.00 mA and then measure. Measured 2.970 mA with 2.9703 V across the
  resistor. The 1 % gap is exactly what the `explain` checkpoint is there to account for
  ("LED voltage is not perfectly fixed"), so the lesson's three steps land in order.
- **electricity-button** / `11-toggle-button`: the only Wave 1 lesson with a program, so
  both halves were executed. Circuit: input 5.0000 V released, 0.0000 V pressed, pull-up
  0.5 mA — a defined level in both states, as the `predict` checkpoint claims. Program,
  run under lite's trace referee with a three-press stimulus: `led1` → 1 at 500 ms, → 0 at
  1500 ms, → 1 at 2500 ms. One transition per press, none while held, which is precisely
  the level-versus-edge distinction the `explain` checkpoint asks for.
- **electricity-capacitor** / `pc29-capacitor-discharge` (already v2): charge switch
  closed drives the cap to 4.907 V in 4 s (τ = 1 kΩ × 1 mF = 1 s); opening charge and
  closing discharge starts the LED at 2.876 mA; the tail flattens at 2.0011 V — the LED's
  forward voltage, not 0 V. The revision's central claim ("does not fall as one ideal
  exponential all the way to 0 V") is exactly what the bench does.
- **electricity-diode** / `pc31-bridge-rectifier` (already v2): at +9 V, `d1`+`d4`
  conduct and the bridge output is 7.4913 V at 5.437 mA; at −9 V, `d2`+`d3` conduct and
  the output is 7.4913 V at 5.437 mA — same polarity, same magnitude, to within 1 mV.
  9 − 7.4913 = 1.5087 V = 2 × 0.7544 V, so the "subtract two measured forward drops"
  instruction gives the right answer to four figures.
- **starter-circuit-path** / `47-battery-led`: 9 V, 1 kΩ, red LED, 6.931 mA around a
  closed loop `bat1.pos → r1 → led1 → bat1.neg`, matching the hint's trace exactly. Only
  the `change` checkpoint's observable is affected (defect 5).
- **instrument-voltage-divider** / `52-battery-voltage-divider`: 10 k/10 k off 9 V, midpoint
  measured 4.5000 V against the lesson's predicted `Vin × R2/(R1+R2)` = 4.5 V. The
  `meter` part exists in the palette in voltage mode, and the lesson's claim that an ideal
  voltmeter draws almost no current is literally true here — the meter is filtered out of
  the netlist before the solve, so it draws none.
- **electricity-transistor-switch** / `38-npn-switch`: the switching itself, listed under
  defect 6 above, is sound.

## A structural note that belongs to the whole catalog, not to Wave 1 — FIXED 2026-08-24

Ten of the twelve lessons carry `observe: {event: "circuit-ready"}` on their measuring
checkpoint. `bw-circuit-ready` fires once, when the circuit finishes loading. So those
checkpoints tick themselves the moment the example opens, before the learner has measured
anything. They are not wrong — the manual "I did it" affordance is still there and the
lesson text still says what to do — but the automatic tick certifies nothing, and it is
worth knowing that the catalog's apparent progress-tracking is, for circuit lessons,
almost entirely decorative. Waves 2–7 should be read with that in mind rather than
discovering it seven more times.

**Measured across all seven waves afterwards: 28 lessons, not ten.** Counted from the wave
JSON — `circuit-ready` is the observable on a measuring checkpoint in nine Wave 1 lessons,
seven of Wave 2, eight of Wave 6 and four of Wave 7. That makes it the largest open defect
of the whole campaign by lessons affected, by a factor of two over the next one, and no
wave counted it, because each wave counted defects in ITS lessons and this was filed as a
note about the catalog. `docs/WAVE-OPEN-DEFECTS.md` D1.

**Fixed 2026-08-24.** `guided-lessons.jsx` now separates ARMING observables from completing
ones: `circuit-ready` sets an `armed` flag and the step says "Bench ready — mark this step
when you have the reading", leaving the manual button as the only thing that completes it.
The other four observables are untouched, because pressing the green flag, editing the
circuit, reaching a debug phase and connecting a hub are all things the LEARNER did. The
observable is not deleted: on a circuit lesson, "the bench came up" is the one thing the
app can honestly tell the learner, and it is worth telling them.

## Reproducing this

```
node --test test/lesson-bench-claims.test.mjs
```

The gate has been mutation-proven, not merely observed to pass: changing `34-ohms-law`'s
resistor from 1 kΩ to 470 Ω makes it red ("branch current: measured 6.2500, expected 2.97"),
and deleting the flyback diode from `pc26-motor-clamp` makes it red ("d1.cathode is on no
net"). Both mutations were applied to the real file — `realpath` checked, no symlink in
the path — and reverted afterwards.

Two of its tests were named `OPEN DEFECT` and asserted that a defect **still reproduces**.
Both have now fired: the ammeter defect was fixed at the source and the motor defect
expired on its own. `test/wave-open-defects.test.mjs` pins both repairs, and bw-board's own
`test/wave-open-defects.test.mjs` holds the measurements.
