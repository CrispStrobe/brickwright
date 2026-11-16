# Robot Lab validation: test machines against closed-form physics

`test/bw-sim-validation.test.mjs` builds test machines from real LEGO parts
(`test/fixtures/bw-sim/machines/*.ldr`; each file's header says how it is built),
runs them through the real pipeline — LDraw → `parseModel` → `compile` (CompiledMechanism v2)
→ the Jolt core → the virtual SPIKE hub with its DC motor model where a motor drives — and
compares each against a value derived in the test from the parts' catalog geometry and
textbook physics. No expected value is read back from a simulation.

Every fixture passes `test/bw-sim-models-solid.test.mjs`, which walks `test/fixtures/bw-sim/`:
no overlapping colliders or meshes, no pin past its hole, no two pins in one hole. The suite's
first test checks that each one is connected and compiles without diagnostics; the drop test's
loose parts are the only exception, by design. The suite takes about 1.5 s (22 tests). Measured
at 200 Hz (`STEP_MS` 5), on 2026-10-18, after the fixes below (all 22 pass; before them 15 passed and
7 were `todo`).

## Results

| # | Machine (fixture) | What it tests | Expected (derivation) | Measured | Tolerance (why) | Verdict |
|---|---|---|---|---|---|---|
| 1a | `gears-compound-8-24-8-40.ldr` | compound train, direction | +1/15 = (−8/24)(−8/40) | +0.06667 | 1 % (gear constraint is exact; solver residual) | pass |
| 1b | `gears-24-8.ldr` | speed-up | −3 | −3.00000 | 1 % | pass |
| 1c | `gears-idler-24-24-24.ldr` | idler: direction, not ratio | +1 (idler −1) | +1.00000 | 1 % | pass |
| 2 | `load-worm-24.ldr` / `load-spur-8-24.ldr` | worm self-lock vs spur back-drive | worm holds (tan λ = m/2r_w = 0.125 < μ 0.4); spur falls, motor back-driven ×(−3) | worm 0.0000° in 3 s; spur arm 75.3°, motor −225.9° (−3.000) | worm ≤ 0.5°; spur > 30° and ratio ±1 % | pass |
| 3 | shipped `forklift.ldr`, hub clamped | rack and pinion | r·θ, r = m·z/2 = 4 mm (25.13 mm per turn), upwards | 37.626 mm for 538.95° (= r·θ) | 0.5 % | pass |
| 4a | `pendulum.ldr`, stand–beam contact off (control) | physical pendulum | T(A) = 4K(sin A/2)·√(I/mgd), I = m(18²+138²)/12 + m·60² LDU² (catalog box, 2.3 g): T0 = 0.3740 s, T(36.2°) = 0.3836 s | 0.3839 s at 36.2° (+0.1 %); amplitude kept 96.4 % after one period | 2 % (step error); ≥ 90 % kept | pass |
| 4b | `pendulum.ldr` as built | period, small damping | as 4a; ≥ 90 % amplitude per period | 36.9° → 36.2° → 35.6° (96.4 % kept); period +0.1 % | as 4a | pass (was todo: 59.5 % kept, +2.1 … +11.8 %) |
| 5a | `four-bar-crank-rocker.ldr`, links' mutual contacts off (control) | crank-rocker kinematics | loop equation (circle intersection) for a 40/100/60/100 linkage; rocker −146.4° … −60.0° | worst 0.03° | 1.5° (hinge-chain compliance, step) | pass |
| 5b | `four-bar-crank-rocker.ldr` as built | the same | as 5a | worst 0.03° | 1.5° | pass (was todo: 3.03° at 180 °/s) |
| 6a | `balance-equal.ldr` | equal masses, equal arms | Σ m·g·x = 0: stays level | 0.0000° | 0.5° | pass |
| 6b | `balance-equal.ldr` | lever square to its pin | droop ≤ 1° (hole clearance) | 0.07° | 1° | pass (was todo: 17.9°) |
| 6c | `balance-unequal.ldr` | heavier but smaller arm goes down | α0 = τ/I = −17.3 rad/s² from per-part masses (the beams' side goes down) | −19.11 rad/s² (+10.5 %) | sign; 15 % | pass (was todo: +23.0, the wrong way) |
| 7a | `drop-on-beams.ldr` at 20 cm | free fall | v = g·t = 1.4715 m/s at 0.15 s | 1.4658 m/s (−0.39 %) | 0.5 % (Jolt's default 0.05 s⁻¹ linear damping costs 0.4 %) | pass |
| 7b | `drop-on-beams.ldr` at 5 cm / 20 cm | lands on the beams | falls h, rests on the beams' tops | 50.18 / 200.18 mm | 1 mm (contact slop, rounded edges) | pass |
| 7c | `drop-on-beams.ldr` at 50 cm / 1 m | no tunnelling; since the materials (ABS e 0.4, 2026-10-20) a straight first bounce | never sinks below flat on the beams by half a beam (4 mm), ends on them; first bounce e·v, spin < 0.5 rad/s, tilt at its top < 5° | deepest 1.3 / 1.7 mm; bounce 0.400 / 0.400, spin 0.24 / 0.33 rad/s, 1.8° / 3.5° | as stated | pass (was: falls h ± 1 mm, inelastic; before that todo: 508.1 / 1008.2 mm, through the beams) |
| 7d | rolling wheel on an incline | — | — | not built: the arena has no slope | — | skipped (as briefed) |
| 8a | shipped `driving-base.ldr` | straight drive | π·d per wheel turn, d = 56 mm (catalog radius 70 LDU): 351.96 mm for the encoders' 720.2°/720.2° | 351.88 mm, yaw 0.005° | 1 % (tyre creep, castor drag) | pass |
| 8b | shipped `driving-base.ldr` | spin in place | 360°·d/track per wheel turn, track 136 mm (wheels at x ±170 LDU): 296.58° | 296.58°, to the left | 1 % | pass |
| 9 | shipped `driving-base.ldr` + wall obstacle | robot into a wall | stops after the 50 mm gap (front = the colliders' most forward point) | 50.05 mm | 1 mm | pass |
| 10 | `motor-arm-stop.ldr` without its post, motor clamped, world obstacle | motor stall | arm stops at first touch (separating-axis sweep of the catalog boxes): +92.35° / −33.52°; hub reports the stall | +94.24° / −34.22°, stalled | 3° | pass (was todo: +276.65° / −865.88°) |
| 11 | `motor-arm-stop.ldr`, motor clamped | self-collision: arm into its own frame | stops at first touch, +92.35° | 93.53°, stalled | 3° | pass (was todo: 871.5°, through the post) |

Gear trains also have older coverage in `test/bw-sim-gear-trains.test.mjs` (8:24, 8:24:8,
8:40, bevel 12:20, stall through a mesh). The suite has no bevel 20:20 machine. The rolling
incline is skipped because the arena is flat. Passing rows whose numbers moved with the fixes: the
spur arm falls further in 3 s (49.7° → 75.3°; part masses moved its centre of mass), the pendulum
control's period error fell from +1.2 % to +0.1 % and its amplitude kept rose from 93.8 % to 96.4 %
(the pin is no longer a body of its own), the four-bar control's error from 1.21° to 0.03°.

## Fixes made

Each was a `todo` test with its expected value; each now passes with that value and tolerance
unchanged. Step costs are node medians at 200 Hz (min of 5 runs); `docs/ROBOT-LAB-ARCHITECTURE.md`
("Validation fixes as built") has the design.

1. **Neighbours on one pin rubbed (4b, 5b).** D2's filter excluded joined body pairs only; two
   beams on a pin are each joined to the pin, not to each other, so their faces touched at zero
   gap and carried friction. *Fix:* `mech/collision-filter.js` groups connector endpoints joined
   by edges into axis groups; every body pair in one group is in `noCollide`. Pendulum 59.5 % →
   93.8 % kept per period (96.4 % with fix 2), four-bar 3.03° → 0.34° (0.03° with fix 2).
2. **A frictionless pin was its own light body (6b; part of 4b, 5b, 6c).** A 0.25 g body between
   two hinges at 10 iterations could not hold a 9 g lever: droop 17.9°. *Fix:* a free pin is
   welded to its first partner: one hinge, the same kinematics. Droop 0.07°. (Since the merge
   with the excavator lane, which solved the same problem, the one mechanism is
   `mech/free-pins.js`, extended to pins with more than two partners.) Chosen over more iterations, which only reduced it (0.45° at 30/10,
   measured) and cost every hinge island.
3. **Centre of mass from collider volume (6c).** Jolt gave each compound one density: the 8 g,
   642 000 LDU³ sensor outweighed 9 g of beams; α0 +23.0 rad/s² (the wrong side down; −17.30
   expected). *Fix:* colliders carry their part's mass share (`massKg`, by volume; motors by
   `massFraction`), sub-shapes get density = massKg / volume. α0 −15.79 (−19.11 with fix 2,
   which stops the lever wobbling on its pin chain).
4. **Tunnelling (7c).** *Fix:* every dynamic body `EMotionQuality_LinearCast`. Drops land
   0.2 / 0.1 mm from h. Cost a fixed ~13 µs per step (shipped examples 35 → 48 µs; stress model
   +1.5 %); applied to all bodies: any body can be the fast one, and a slow one costs a compare.
5. **Motorised hinges got too few iterations (10).** *Fix:* 30 velocity steps and 0.33/ε
   position steps in [5, 40] per motorised hinge, ε = m·r² / (I_axis + m·r²) of its lighter
   body once the rotor inertia is on it (`jolt-core.js setMotorSteps`). First derived as 60/5
   (+1.4° / −0.9°); with fix 3 the arm's centre of mass moved and 60/5 crept to +9°: the
   rotor's 3e-4 kg·m² on an 8 g body leaves a contact ε = 0.011 of the turn per iteration, and
   only position steps converge it (5: +6.4°, 20: +2.8°, 30: +2.0°, 40: +1.5°; velocity 30–500
   not monotonic). The arm gets 30 (+1.89° / −0.70°), a SPIKE wheel 7. Shipped examples
   48 → ~68 µs per step.
6. **Self-collision off across a joint (11).** The exclusion was per body pair. *Fix:*
   `localNoCollide` lists the part pairs to keep apart (seated on one axis, or never brought
   together by the pair's motion: a hinge keeps intervals along its line and distance bands
   from it, a ball distance from its point); a pair with any other part pair goes to
   `noCollideParts` and is filtered per sub-shape by a Jolt SimShapeFilter (installed only
   then; no shipped example needs it, step time unchanged). Arm stops at 93.53°.

## The Forklift's carriage (resolved 2026-10-19)

The left tine (2823 at x −60) and its 3L pin sat on the guide axle's own line (x −60, z 155 LDU), 13 LDU
under the guide's T holder and 32 under the guide, so with local filtering the carriage jammed after
5.2 mm of its 40 mm lift. The tines now hang on a cross beam in front of the mast: a beam 5 (32316,
x −20, y −14, holes z 155…235) pinned to the fork arm's two lower holes (z 155, 175), the 3L pin at z
215 carrying the tines at x −40 and 0 (still 40 LDU apart for the pallet's pockets). Their roots
(z 195…235) are 30 LDU in front of the T holder. The Warehouse pallet moved with them (world x −0.136,
z −0.016). Slider pairs are filtered locally now; the Forklift tests pass unchanged (40 mm lift: 39.82
against r·θ 40.03; held drift 0.013 mm; slip on the forks 0.00 mm).

## Integration with the gearbox lane (2026-10-19)

Merged with the gearbox lane, local filtering failed three gearbox tests: (1) the differential's
side gears, right axle and planets sit inside the casing's and cover's solid colliders, joined by
the carrier joints that kind makes without connector edges, so nothing said they were seated —
parts that interpenetrate at t = 0 are now excluded as nested; (2) the shipped `gearbox.ldr`'s
pointer (a thin 1 × 3 on the output axle at LDraw y −20) swept through the drive motor's housing
(its far end reaches 49 LDU from the axle, the housing is 10 LDU away), so the output could not
turn — it now sits at the top of a 12L output axle (3708, y −170), 25 LDU above the 16T gears.
Gearbox program: output/motor −0.3333 / −1.0000 (tooth ratios), the differential tests pass.

## Gear meshes: torque × ratio and momentum conserved (resolved 2026-10-19, the Jolt fork)

Until 2026-10-19 two gear bugs were open: Jolt's `GearConstraint` passed torque across a mesh 1:1
(`GearConstraintPart` applied λ, not ratio·λ, to body 2: rows 15 and 16 of round 2), and it is
angular-only, so no tooth reaction reached the axles' frame and a machine on a moving frame gained
angular momentum (the Excavator's base yawed 15–140° in a dig cycle; floating, it spun ≈ 285° while
only its bucket actuator ran). Neither can be fixed around the solver (tried and rejected: a SixDOF
tooth contact re-made every step — no warm start, did not converge against the hinges; the missing
impulses applied after each step — unstable).

The Robot Lab now runs on the Brickwright fork of Jolt (`jolt-physics` 1.1.0-bw.2, pinned by release
tarball and integrity; <https://github.com/CrispStrobe/JoltPhysics.js/blob/brickwright/gear-mesh/BRICKWRIGHT.md>,
Jolt v5.6.0 + the fix in <https://github.com/CrispStrobe/JoltPhysics>). Its `GearConstraint` passes
torque × ratio, and its new `GearMeshConstraint` is the mesh as a tooth contact at the pitch point:
an equal and opposite force pair, so torque scales with the ratio, the reaction loads each gear's
frame (the other body of its hinge), and momentum is conserved. Every mesh kind uses it
(`jolt-core.js` `meshGear`; ROBOT-LAB-ARCHITECTURE.md §1.2 has the details). Measured at 200 Hz:

| Check | Expected | Before (Jolt 1.1.0) | Now | Tolerance |
|---|---|---|---|---|
| row 15: 8:24 dyno, motor operating point | 16.253 rad/s | 11.796 rad/s | 16.205 rad/s (−0.30 %) | 1 % |
| row 16: mesh efficiency | η = 1 | 0.332 | 0.979 (207.0 mW in, 202.6 mW out) | 3 % |
| Excavator dig cycle: base yaw | < 10° | 139.4° | 5.0° (turntable −81.1° … +98.7°, back to 7.6°) | 10° |
| free-floating 8:24 gearbox, motor internal, no gravity: max abs(ΔΣL) / Σ abs(L_i) over 2 s | 0 | (the fork: 0.68 with GearConstraint) | 1.13e-3; 24T/8T relative to the frame −0.33328; the frame turned 151.5° | 2e-3 (integrator: no gyroscopic term; the gearbox without its mesh drifts 4e-3) |
| differential, one side held: the other side / casing (Willis) | 2 | 1.992 (240 iterations, re-made contact) | 1.9999 / 2.0000 | 2 % |

Two measured limits of the solver, handled in `jolt-core.js` and documented there:
- The fork's mesh can also pull back accumulated phase error from the hinge angles. Kept on across
  steps, that correction fought the rest of the solve: a stalled DC motor's arm on a driven 24T was
  pushed 7.7° into a static block (P5 §6 allows 6°), and the Excavator's bucket actuator chain rang
  and diverged (NaN) within a second. The phase is therefore re-based before every step: the mesh is
  exact in velocity and removes each step's drift; slip the solver cannot prevent (the stalled arm's
  impact: 10.5° of the 24T) stays slipped, as with the gear constraint.
- A light gear body between its hinge and a contact or a mesh gives way sideways: gear bodies get a
  solver mass of at least 20 g with their weight kept (as the actuators' parts already did). Without
  it the slew pinion slipped 17° of the turntable in a dig cycle and the stalled arm kept rocking.
- A mesh island solves with 120 velocity iterations (the carrier contact needed 240): with 30 the
  Excavator's boom left its law-of-cosines angle by 1.73°, with 120 by 0.73° (tolerance 1.5°).

Minor, recorded by the passing tests: Jolt's default linear damping (0.05 s⁻¹, not set by
`jolt-core.js`) acts as a weak, velocity-proportional air drag (−0.4 % on free fall at 0.15 s).

## Round 2: more machines

`test/bw-sim-validation-2.test.mjs`, fixtures `test/fixtures/bw-sim/machines-2/*.ldr` (each header
says how it is built) and four shipped models (`driving-base.ldr`, `wall-stopper.ldr`,
`colour-explorer.ldr`, `forklift.ldr`). The method is round 1's: real parts, real builds (the fixtures
pass `bw-sim-models-solid`; the suite's first test checks they compile with no diagnostics except
the loose parts that are the point of a machine), the real pipeline, and expected values derived in
the test from catalogue geometry and documented physics. The suite takes about 4 s (18 tests: since 2026-10-19 also the free-floating gearbox above).
Measured at 200 Hz on 2026-10-19.

| # | Machine (fixture) | What it tests | Expected (derivation) | Measured | Tolerance (why) | Verdict |
|---|---|---|---|---|---|---|
| 12 | `gear-train-243.ldr` | five 8:24 stages | (−8/24)^5 = −1/243; same ratio over both halves of 10 s; no creep while held | −1/242.999 (both halves); held 2 s: output 0.00000° | 0.5 % (exact kinematics) | pass |
| 13 | `worm-then-spur.ldr` | worm direction from the thread's hand, then 8:8 | right-hand thread: wheel = −k/((a_w × (P − C))·a) · worm, k = 1.25 LDU/rad; then −1: +1/24 about the output's axis | +0.04167 | 0.5 % | pass |
| 14 | `dyno-direct.ldr` (slip clutch held by its mesh) | DC motor on its torque–speed line | Philo's 9 V points → R, k_t, k_e → at 7.2 V τs 10.44 N·cm, ω0 18.46 rad/s; load 3.75 N·cm (the clutch's catalogue rating): ω = ω0(1 − τL/τs) = 11.832 rad/s | 11.800 rad/s (−0.27 %) at duty 1 | 1 % | pass |
| 15 | `dyno-geared.ldr` (8T drives the clutch gear, its axle held) | torque through a mesh | load at the motor 3.75/3 N·cm → 16.253 rad/s | 16.205 rad/s (−0.30 %); ring/motor 0.3333 | 1 % | pass (was todo: 11.796 rad/s, the direct bench's — torque 1:1) |
| 16 | `dyno-geared.ldr` | mesh efficiency | ideal spur gears: P_out/P_in = 1 | η = 0.979 (207.0 mW in, 202.6 mW out) | 3 % | pass (was todo: η = 0.332) |
| 17 | shipped `forklift.ldr`, hub clamped | force through rack and pinion (control for 15) | hold torque m·g·r = 14.8 g · g · 4 mm = 0.579 mN·m | carriage sinks at 0.9×, rises at 1.1× | ±10 % bracket | pass |
| 18 | shipped `driving-base.ldr`, A −300 °/s, B 150 °/s | differential steering on a circle | from the encoders: Ω = (v_R − v_L)/t = −30.882 °/s, R = t/2·(v_R + v_L)/(v_R − v_L) = 204.00 mm (outer/inner 2.000) | Ω −30.882 °/s, R 203.98 mm | 1 % | pass |
| 19 | the same run | hub yaw, gyro, encoder | yaw (cw) = −geometric yaw; ∫gyro z = geometric yaw; encoder A = the wheel's turn in the chassis | 92.646° vs −92.646°; −92.645°; −899.998° vs −899.998° | 0.1°, 0.5 %, 0.1° | pass |
| 20 | shipped `wall-stopper.ldr` + a 2 cm wall | distance sensor | ray distance D/cos ψ, mm; −1 outside 50 … 2000 mm: 30 mm → −1, 100, 300, 319.3 (20°), 391.6 (40°), 800, 1732.1 (1.5 m at 30°), 2.2 m → −1 | 100, 300, 319, 392, 800, 1732, −1 / −1 | 1 mm | pass |
| 21 | shipped `colour-explorer.ldr` on `colour-zones` | colour sensor | mat layout: white 10, red 9, yellow 7, green 6, blue 3, border black 0, off-mat white; white reflection 100·(1 − h/32 mm), h = 16.4 mm → 48.8 | all colours right; reflection 48 | exact; ±2 | pass |
| 22 | `tilt-table-tower.ldr` | tower tips at tan θ = (b/2)/h | COM 72.75 LDU above the table (catalogue colliders), half base 10 LDU: θc = 7.83° | tips at 7.38° one way, −7.43° the other (stood at 6.01° / −5.93°) | 0.5° (the 0.5° steps) | pass (was todo: 10.00° / 6.45°; margin 0.1°) |
| 23 | `carts.ldr` (robot pushes cart 1 into cart 2) | momentum in a collision | Σ m·v changes only by the rolling resistance's impulse Σ m·(a0 + 0.05·v)·dt over the 70 ms window (a0 from cart 1 coasting alone; masses from the catalogue: 54.6 g each) | 6.525 → 5.611 g·m/s, impulse 0.951: 0.67 % off (2026-10-20) | 1 % | pass (was: Σ m·v conserved, 7.413 → 7.387, before rolling resistance) |
| 24 | `carts.ldr` | restitution | they meet at 0.12 m/s, below the 1 m/s bounce threshold: they leave together | e = 0.000 (2026-10-20, LIGHT_BODY_VELOCITY_STEPS; was 0.235, 0.065, 0.097) | e ≤ 0.05 | pass (was todo) |
| 24c | `carts.ldr`, all mass in the bumper bodies (control) | the same | e = 0 | e = 0.000 | e ≤ 0.05 | pass |
| 25 | `carts.ldr`, cart 2 coasting | rolling resistance | a = c_rr·g·M/(M + ΣI/r²) + 0.05·v = 0.1378 m/s² (c_rr 0.02, M 54.6 g, ΣI/r² 24 g) | 0.1377 m/s²; stops, never rolls back | 5 % | pass (2026-10-20; was todo: 0.0038 m/s², damping only) |
| 26 | universal joint (`test/bw-sim-universal-joint.test.mjs`) | ω2/ω1 = cos β/(1 − sin²β cos²θ) | at 30° / 45°: 0.866…1.155 / 0.707…1.414; tan φ = tan θ / cos β; two in phase: constant | 0.8660…1.1547 / 0.7071…1.4142; angle within 0.047° / 0.156°; two in phase within 0.026 % | 0.5 % beyond a step's change; 0.25°; 1 % | pass (2026-10-20; was todo: not buildable) |

Not built in this round: a crank-slider (needs a frame that holds the smooth toggle joint's
slide bores at the coupler's height), a scissor lift, a Watt's linkage, and a spur–bevel–worm train
over three axis directions (the motor's housing gives bearings along y and x only; a third needs a
Technic-brick frame). The stepped table of row 22 is the quasi-static form of the brief's "tilting
platform"; the arena still has no slope (round 1, 7d).

### Discrepancies and diagnoses (round 2)

7. **Gears pass torque 1:1 (15, 16). Resolved 2026-10-19** (the Jolt fork, section above; the
   diagnosis is kept as it was found). A gear constraint makes the driven
   gear turn at the tooth ratio, but the torque it passes is not scaled by that ratio: a load torque
   on the driven gear reaches the driver unchanged, whatever the teeth. Energy is not conserved: in
   row 16 the motor puts 3× the power into the 8:24 mesh that the slipping clutch takes out. So a
   reduction gear gives no torque gain — a crane's 1:243 lifts no more than its motor shaft could.
   *Minimal repro* (no motor, no hub): two wheels on hinges, a `GearConstraint` with mRatio 3, a weight
   on each at the same radius. Physics balances them at m2 = 3·m1; Jolt balances them at m2 = m1
   (raw JoltPhysics.js 1.1.0, measured), as does the compiled 8:24 bench, with any ratio either way.
   *Diagnosis:* Jolt's `GearConstraintPart` puts the ratio into the constraint (ω1 + r·ω2 = 0) and
   into the effective mass (r²), but applies λ, not r·λ, to body 2 (`ApplyVelocityStep`; upstream
   master reads the same). `jolt-core.js buildGearConstraint` uses it for every 'gear', 'worm' and
   non-carrier 'relativeGear' coupling. The `RackAndPinionConstraint` is correct (row 17). *Possible
   fixes:* build meshes as the planet-carrier path already does (a SixDOF tooth-point constraint,
   kinds/relative-gear.js, which is exact for forces), or patch the gear part upstream. Not made here:
   `jolt-core.js` is another lane's. Round 1 and the gear suites missed it because they measure
   kinematics only.
8. **A tower on a small footprint rocks and tips early or late (22). Passes since (measured
   2026-10-19, the same with Jolt 1.1.0 and the fork): 7.38° / −7.43°, 0.1° inside the tolerance.** The table stopped at 5–6°
   leaves the tower leaning 1.5°: the loaded edge sinks into Jolt's 0.2 mm penetration slop
   (`LEGO_PENETRATION_SLOP_M`), and on an 8 mm footprint that is atan(0.2/8) = 1.4°. With the table
   still and gravity tilted instead, it tips between 6° and 7° (θc 7.83°). The table's steps then set
   it rocking ±2°, so the tip angle depends on the direction (6.45° / 10.00°). *Possible fixes:* a
   smaller slop for small bodies, or more contact points per face. Not made here (`jolt-core.js`).
9. **A light body between hinges springs back (24). Resolved 2026-10-20:** it was not compliance but
   convergence: with 200 velocity iterations instead of Jolt's 10 the carts leave together (e 0.000; 60:
   0.011; position steps and Baumgarte change nothing, measured). `jolt-core.js` gives a body with two or more
   joints that weighs under a quarter of its lightest jointed partner `LIGHT_BODY_VELOCITY_STEPS` (120): only
   its island pays. The diagnosis as first written: each cart's bumper is a 4.8 g beam hinged to
   two 25 g wheel sets. On impact the hinge chain stores the energy and returns it: e = 0.67 with
   restitution 0 when found, 0.235 now (2026-10-19). Not the body model: no body sets a restitution.
   The 20 g solver mass floor that gears and actuators use does not apply: in a collision the floored
   mass is the mass, and row 23's momentum would not be conserved. With the carts' mass moved into the bumper body (control 24c) e = 0.01. Momentum
   is conserved either way (23). This is round 1's bug 2 (soft pin chains), seen in a collision.
10. **No rolling resistance (25). Resolved 2026-10-20** (`physics/rolling.js`, section "Materials" below):
    a tyred wheel on a hinge gets c_rr·N·r against its roll, N read from its axle's constraint impulse.
    The cart now slows at 0.1377 m/s² for 0.1378 predicted (was 0.0038, damping only).
11. **No universal joint (26). Resolved 2026-10-20** (`kinds/universal-joint.js`, `physics/universal-joint.js`):
    a 'uj-fork' connector on each end, a 'universalJoint' coupling, built as a cross body on two
    perpendicular hinges (a SixDOF/SwingTwist with the twist locked would be a constant-velocity joint,
    not a Cardan). The single joint follows the closed form, two in phase are constant-velocity.

Passing rows 12–14, 17–21 and 23 check the gear kinematics (including the worm's direction), the DC
motor model's operating point against Philo's numbers, rack force transmission, differential
steering, the IMU's yaw and gyro, the encoders, and the distance and colour sensor models. No product
code was changed in round 2. Every discrepancy is in `jolt-core.js` (7, 8, 10), in the body model
(9: `joints.js`/`islands.js`), or in the catalogue and kinds (11), and other lanes own all of them.

## Materials: restitution and rolling resistance (2026-10-20)

`contracts.js MATERIALS` / `restitutionOf`, `physics/rolling.js`, `physics/materials.js`, `test/bw-sim-materials.test.mjs`,
rows 7c and 23–25 above, the tracked frame in `test/bw-sim-chain.test.mjs`.

| material | friction | e | E | c_rr | source |
|---|---|---|---|---|---|
| ABS (every part unless its catalogue entry says otherwise) | 0.4 | 0.4 | 2.3 GPa | — | e: solid polymers 0.6–0.9 (J. Phys.: Conf. Ser. 2557 012057, "Restitution coefficient of various particles"; polymer composites 0.63–0.82, Bull. Mater. Sci. 22(6) 1009); a hollow brick less: an estimate. E: datasheet range 2.0–2.6 GPa |
| rubber (`"material": "rubber"`: the tyred SPIKE wheels) | 1 | 0.05 | 5.5 MPa | 0.02 | c_rr: rubber on hard floors 0.010–0.025, drum-rig deceleration method (Hungarian Journal of Industry and Chemistry, "Laboratory Measurement of Rolling Resistance Coefficient under Different Conditions"). E: Shore A ≈ 70 by Gent's relation. e: an estimate |
| tread (a tread's sprockets: their wheel of the tread's outer radius) | 1 | 0.4 | 2.3 GPa | 0.05 | c_rr: link (steel) tracks on concrete 0.03–0.06, the literature table of Łopatka & Muszyński, "Validation of rolling and steer resistance of articulated tracked robot", ISARC 2013 (their elastomeric belt tracks measured 0.14); LEGO's are hard plastic links |
| the floor and the arena's walls | 0.8 | — | rigid | — | a part bounces off them with its own e |

- **Bounce, per material pair.** e_ab² = (e_a²/E_a + e_b²/E_b) / (1/E_a + 1/E_b): each side of an impact stores its
  energy in proportion to its compliance and gives back e² of what it stored. The table is installed in Jolt by the
  fork's `MaterialPairs` (jolt-physics 1.1.0-bw.3: a body's material in its user data, the pair's e from the table,
  Jolt's max rule for bodies without one). A part on the floor: its own e; ABS on ABS 0.4; a brick on a tyre 0.054
  (measured 0.055; Jolt's max rule said 0.4). Measured: a 2 × 2 brick dropped 20 cm leaves the floor at 0.41 of its
  landing speed and rebounds to 15.9 % of the height at 2 kHz (e² 16 %; 14.5 % at the app's 200 Hz, where the contact
  and the top of the flight fall between steps). Impacts slower than `LEGO_MIN_BOUNCE_SPEED_M_S` = 1 m/s do not
  bounce: no driving calibration moves (SPIKE wheels at full speed: 0.5 m/s).
- **A bounce across two bodies (the Jolt fork, 1.1.0-bw.3).** With 1.1.0-bw.2 and ABS e 0.4 the round-1 drop (a
  2 × 4 brick from 20 cm, 50 cm, 1 m across two loose beams) turned the brick over: Jolt's continuous collision
  (`EMotionQuality_LinearCast`, which the tunnelling test needs) applies an impact, restitution included, at the
  average contact point with the ONE body it hits first, off the brick's centre when it lands across two. The fork
  (JoltPhysics `a40ff0b`, its `BRICKWRIGHT.md` §3) leaves a bouncing CCD impact that touches another body as well to
  the next step's discrete solve, which has every manifold; single-body bounces and every impact that does not
  bounce are upstream's, bit for bit. Now: 20 cm lands flat (200.05 mm); 50 cm and 1 m leave at 0.400·v straight up
  (spin 0.24 / 0.33 rad/s, 1.8° / 3.5° at the top of the first bounce).
- **What is left (open).** Jolt's sequential-impulse solver resolves a flat multi-point restitution impact
  non-uniquely (a point may end with no impulse while the body spins): a flat box bouncing off two beams leaves with
  0.1–0.3 rad/s however many velocity steps (10 → 100: 0.26 → 0.17 rad/s, measured; also with CCD off). From 50 cm and
  1 m the brick's second landing is a few degrees off flat, and it comes to rest leaning on a beam edge (34°, 40°),
  on the beams (1.3 / 1.7 mm below flat). A real brick tumbles too; this one does it from a solver residue.
- **Rolling resistance.** For each dynamic body with `rollingResistance` (its grippiest part rubber, or a tread's
  sprocket) that turns on a hinge and has a cylinder coaxial with it: r = that cylinder's reach, N = m·(g + a·up) −
  F·up from the previous step's hinge impulses (`HingeConstraint.GetTotalLambdaPosition`) and the body's vertical
  acceleration. While its hinge's motor is off (a free wheel, a coasting motor) the hinge's friction torque is its
  bearing friction + c_rr·N·r: Coulomb friction, solved by Jolt, so it slows a rolling wheel and HOLDS a parked one
  (up to tan α = c_rr); a driven wheel gets c_rr·N·r as a torque against its roll, capped at what its inertia absorbs
  in a step. Checkpointed (the worker's rollback). Measured: four wheels under a block carry its weight (sum within
  1 %), nothing in free fall; the coasting cart 0.1376 m/s² for 0.1376; a 180 g cart on 0.5° does not move in 1 s, on
  3° accelerates at 0.2508 m/s² for 0.2509; a coasting tracked frame 0.1133 m/s² for 0.1133 (with the solver's floored
  sprocket mass and inertia, which make it coast 4.4× longer than its parts would: GEAR_MIN_*). Not modelled:
  hard-plastic wheels without a tyre.


## Effort, effective properties and transient rolling load (2026-10-25)

`test/bw-sim-effort-inspection-jolt.test.mjs` checks signed motor impulse per
fixed step against `I·Δω/Δt`, matching-step mechanical power, braking, motor-off
passive friction, COM/inertia observations and checkpoint/rollback. Its freely
falling floored gear assembly must report no supporting floor load; prescribed
up/down velocity increments isolate the effective-mass acceleration term.
These are simulator controls, with actual execution supplied by hosted CI.

The pure force-balance control uses configured mass 0.01 kg, solver mass 0.02 kg,
gravity factor 0.5, gravity 10 m/s² and upward acceleration 1 m/s², without joint
load. The expected estimate is `0.02·(0.5·10+1) = 0.12 N`; the old expression gave
`0.01·(10+1) = 0.11 N`. The correction uses solver inertial mass for acceleration
and gravity-scaled solver mass for weight, preserving existing steady-load,
free-fall, ordinary-wheel and rollback controls. It changes no floor, friction
coefficient, solver iteration or mechanical acceptance threshold.

The imported-steering controls bind the existing catalogue's locked differential
and Cardan-style hub representation to finite geometry expectations. A 0.16 m
track turning at radius 0.5 m needs an outer/inner wheel-rate ratio
`0.58/0.42 = 1.38095…`; a locked axle cannot provide it without slip. A single
Cardan proxy at 20° has a varying speed ratio `cos(20°)` through `1/cos(20°)`,
rather than a true CV joint's constant rate. Existing actual differential-car and
universal-joint suites remain required. No new imported-model steering repair or
hardware calibration is inferred from these controlled boundaries.

## Functional model sweep (2026-11-14)

The [functional matrix](data/robot-lab-functional-matrix-20261114.json) records a bounded headless smoke run of all 82 checkpoint models using the Scratch VM, Robot Lab extension and Jolt. All 104 motor shafts moved, including two passive Equinox outputs and a separate motor exercise for the intentionally held Sarrus control. The supplied program threads ended for 13 models; the other 69 were still running at their recorded time bounds. These smoke results do not establish successful program completion or valid output. The [program gap list](data/robot-lab-program-gaps-20261114.json) tracks those requirements per model. Neither list establishes rendered mesh loading, the built GUI, physical-device behavior or precision laws.

With the repository's integrated GUI dependencies installed, run selected models with Node 22:

```sh
node --import ./scripts/lib/register-gui-scope.mjs scripts/test-robot-lab-functional.mjs --models=cross-ratio --sim-ms=15000 --wall-ms=120000 --out=./functional-results
```

Omit `--models` to run the checkpoint inventory serially. Use a fresh output directory for each run. Longer program phases may require a larger simulated interval; an inconclusive motor observation is not a pass.

The separate program gap list now records all 82 supplied programs reaching their documented terminal states with observed mechanism outputs in headless runs. Its entries retain each run's source, output observations and nonfatal model warnings; this is not a precision-law, rendered-GUI or physical-device qualification. To repeat the program checks with bounded-memory measurement streaming:

```sh
node --import ./scripts/lib/register-gui-scope.mjs scripts/test-robot-lab-programs.mjs --bounded-memory --sim-ms=1000000 --wall-ms=1200000 --out=./program-results
```

Use `--models=id1,id2` for a subset and a fresh output directory for each run. A program that reaches the test's time limit without its required terminal outcome remains partial.
