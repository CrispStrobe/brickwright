# Robot Lab qualification, rotor inertia and #1435: handoff (2026-10-28)

> Current policy (2026-11-13): Do not add `ci:full` or dispatch full CI.
> Use bounded local or Kaggle runs when appropriate, retry failed checks
> normally, and keep product assertions and numerical bounds unchanged.
> Historical claim, admission, provenance and one-shot instructions below
> are superseded. Refresh current task status before acting.

This handoff is for a fresh agent. It covers four open work streams: model
qualification, geometry and collider repairs, the rotor-inertia fix (#1494), and
the resting-frame creep (#1435). Each section states what is done, what is open,
and the exact next actions. Refresh every PR head and check before you act. The
state below was true when this was written and will drift.

## Standing rules (apply to every task below)

- **Lanes.** Read `LANES.md` and `lanes/PROTOCOL.md`. Merge the applicable
  scope claim before new source implementation. Existing published work is not
  discarded to repair its historical claim sequence. Carry an explicitly
  delegated continuation in an owned isolated worktree; preserve other owners'
  unpublished source, branches and original evidence. Refresh live ownership
  before treating a snapshot's open task as unclaimed.
- **CI and `ci:full`.**
  - Iterate without the `ci:full` label and let the unit shards run.
  - Admit the actual opened-event scope before adding `ci:full` **once** on
    the final candidate. Browser shards, saved-project replay and export require
    the applicable thorough tier. Do not repeat a one-shot label, dispatch or
    Ready cycle; substantive successors use ordinary synchronize events.
  - The `full CI requested` check fails on code PRs without the label. That is
    the gate working, not a test failure, and such a PR cannot merge.
  - Label events create their own runs. Current concurrency distinguishes
    those from code events; do not assume a label cancels the preceding run.
    Bind each enabled result to its actual event, head, checkout and tree.
- **Merging.**
  - Use `gh pr merge N --merge --match-head-commit <sha>`, and only after every
    enabled check on that exact head is SUCCESS. Only conditional jobs and
    matrix template placeholders may be skipped.
  - Afterwards, verify that the merge commit's parents are main and the head,
    and that its tree equals `git merge-tree --write-tree <parents>`.
  - No force-push, no auto-merge, no duplicate dispatches.
- **Keeping up with main.** Don't re-merge main just because it moved. Do it
  only when GitHub reports a conflict, or when main changed files your PR
  touches or the qualification harness and its data.
- **Thresholds and evidence.**
  - Never weaken a tolerance, baseline or assertion to get green. A model that
    honestly fails stays experimental, with the reason recorded in
    `docs/data/robot-lab-experimental-checkpoint.json`.
  - Controls are never promoted.
  - Gates such as `savedProjectReplay`, per-model browser runs, export and
    manual controls stay `NOT_RUN` unless they actually ran. Say so in the
    checkpoint and contract (see Samebeat's `notRun`).
- **Engine tests.** A test that imports `jolt-physics` must be listed in
  `scripts/lib/gui-scope-allowed.json`, under `jolt-physics/wasm-compat` and/or
  `jolt-physics/wasm-simd-compat`. Unit tests must not write raw stdout; use
  `t.diagnostic`.
- **Fixture location.** Don't put diagnostic `.ldr` files under
  `test/fixtures/bw-sim/`, because `test/bw-sim-models-solid.test.mjs` scans
  that folder as buildable models.
- **CI is slow.** A unit round has waited 2–3 hours in the queue. Plan for it,
  and don't open more parallel PRs than you can land.

## How a model is qualified

The pieces:
- the contract in `docs/data/robot-lab-qualification.json`;
- a judge registered in `QUALIFICATION_JUDGES` (`scripts/lib/robot-lab-qualification.mjs`).
  Judges live in per-batch modules such as `scripts/lib/sim-lab-batch3-judges.mjs`
  and `scripts/lib/sim-lab-hubless-judges.mjs`;
- the harness `scripts/qualify-robot-lab-models.mjs`;
- the test `test/bw-sim-qualification.test.mjs`;
- the registry `MODELS` in `overlay/scratch-gui/src/lib/bw-sim/sim-session.js`;
- the experimental list in `overlay/scratch-gui/src/lib/bw-sim/model/experimental-models.js`;
- the catalogue and lessons, regenerated with the generators.

A promotion needs all of these to pass:
- the model's physical law, predicted from the compiled model;
- the frozen-output and 1 cm world-shift negative controls;
- a disconnection control: removing the causal part must break the law;
- the solid-construction suite.

Precedents to read first: #1446, #1455, #1483 (Samebeat), #1496 (Pivot Exchange,
plus hubless and motorless contract paths) and #1497.

Editing `scripts/lib/robot-lab-qualification.mjs`:
- Model PRs may add **only** their judge-module import and judge ids to
  `QUALIFICATION_JUDGES`.
- Validation logic belongs to the hubless-harness lane
  (`lanes/2026-10-27-robot-lab-hubless-harness.md`).
- When merging main, keep every side's entries.

## 00000. Next batch R1–R7 and engine task E1, 2026-11-10 (read this first)

**R1 DONE 2026-11-11 (#1725).** Obliquity Orrery promoted with judge
`obliquity-tilt-v1` (`scripts/lib/sim-lab-obliquity-judge.mjs`). The proposed
law is the mechanism's physics: 1:1 drive, equal 16 mm cranks on axles 32 mm
apart (the coupler-pin spacing) so the coupler translates without turning, a
22.5° axis that keeps its direction, and the Sun at the orbit centre level with
the Earth; the compiled geometry reproduces the law to 1.4e-5°. Hosted native
run: declination error 0.0021° (gate 0.01°), drive 0.0071°, radius 0.00095 mm.
Disconnection is crank A's coupler pin (law error 12.94°, refused). Crank B's
pin, as proposed here, also loses the law (22.55°: the free coupler swings), but
removing a driven-side pin is the cleaner causal cut. Mutants (tilt turned 90°;
Earth turning with its orbit) are refused. Browser gate on shard robotaddon15.

**R2 DONE 2026-11-12 (#1729, `lanes/2026-11-11-robot-r2-judge-family.md`) for Cadence, Helios and Orion;
Equinox stays experimental (below).** One judge module,
`scripts/lib/sim-lab-r2-judges.mjs`; every constant is read from the compiled parts and catalogue tooth counts.
Native runs (COLD 500), measured / gate:

| Model | Judge | Law error | Other measured | Disconnection (law error, lost) |
|---|---|---|---|---|
| cadence-geneva | `geneva-index-v1` | later steps 90° ± 0.114° / 0.25°; dial −star/3 0.095° / 0.25° | first step 88.63°; dwell 0.00013° / 0.1°; lag behind the ideal curve 4.11° / 4.5° | `driver_pin_axle`: star never moves, 1080° |
| equinox-differential | `differential-sum-v1` | L + R − 2K 0.013° / 0.1° | K vs (12/28)A 0.014°; brakes 0.005/0.009°; held outputs 0.25/0.20° / 1° | `pinion`: carrier span 1.7°, 1078° |
| helios-transmission | `willis-epicyclic-v1` | 3A − 2C 0.048° / 0.25° | carrier vs −(20/28)B 0.0072°; standstill at B = −63°/s, output 0.000°/s | `control_gear`: 415° |
| orion-cardan | `double-cardan-offset-v1` | output − input 0.048° / 0.25° | ripple law 0.099° / 0.5°; lead 12.84° p-p vs 12.76° | `fork_middle_far`: 7245° |

Corrections to the table below, by measurement: the Geneva star lags the ideal curve by up to 4.1° (the roller's
clearance in the slot; the first step is 88.6°, every later step 90°), so the law gates step size, dwell and dial
exactly and the in-step curve only within 4.5°. The differential's proposed "carrier gear" cut (`cover`) also
removes the planets' support: the model flies apart before the program's start check, which refuses; motor A's
12T bevel (`pinion`) is the clean cut. Helios's standstill is the program's stage 4 (the fourth speed step;
"stage 3" counted from 0). Orion's id is `double-cardan-offset-v1` because `double-cardan-v1` is Phasekeeper's
registered judge. The four shipped LDR files changed only in STEP markers (author steps of up to 100 parts):
Cadence and Helios now derive connected steps of at most six parts; Equinox's and Orion's author steps are split in
order, because the instruction planner's adjacency counts neither gear meshes nor universal joints and the derived
plans would show the differential casing and a middle-shaft marker as floating.
Browser gates on shards robotaddon16 (Cadence; its disconnected control is a second step because the law run,
control run and replay of its 144 s program exceed the 8-minute step cap), robotaddon18 (Helios) and robotaddon19
(Orion). **Equinox is not promoted:** its native law and controls pass (table above), but the browser gate's
manual-control check stops every motor (power 0 = hold) and then jogs each port alone. With both outputs held the
differential's carrier is locked (K = (L + R)/2), so motor A cannot reach its jog target (hosted chromium, twice,
210° and 30° steps). That is the mechanism's physics; promotion needs a manual-control rule for coupled
multi-motor mechanisms (the gate owner's decision). Its contract, registry move, fixture and shard were withdrawn;
`differential-sum-v1` stays registered and its STEP split stays.

**R3 (#1731, `lanes/2026-11-12-robot-r3-geometry-repairs.md`): Apex repaired and qualified; Vesper and Aster repaired but
stay experimental (browser gates, below); Bloom stays experimental (below).** One judge module, `scripts/lib/sim-lab-r3-judges.mjs`; every constant is read from the
compiled joints, colliders and catalogue tooth counts. Repairs (real parts only; source records in
`test/fixtures/model-files/<id>-source/SOURCES.md`): Vesper's fixed pivot bearing 3L beam → thin 1 × 5 liftarm 5 LDU
further out (it reached 5.5 LDU into the motor's output-side plate); Aster's four flyweight wheels 7.5 LDU further out
on axle 10s (they reached 7.5 LDU into the key beams); Apex's housing ring links redistributed over three layers (24
same-layer pairs overlapped by up to 0.6 LDU beyond the collider tolerance where the ring curves), 8 pins moved and 8
made 3L. Construction suite clean on all three (the repairs ship for all three). Native runs (COLD 500), measured / gate:

| Model | Judge | Law error | Other measured | Disconnection (lost) |
|---|---|---|---|---|
| vesper-quickreturn | `quick-return-v1` | ram vs compiled kinematics 0.30 mm / 0.5 mm | stroke 66.18 mm (pred. 66.17); arc ratios 1.4541–1.4582 vs 1.4588 / ±0.02; slow side swaps on reversal | `pin_P`: ram span 0.0002 mm, error 47.1 mm |
| aster-governor | `governor-lift-v1` | held speed vs speed the lift predicts 1.26–1.46 % / 3 % | lifts 3.04 / 7.84 / 16.09 mm at 675 / 725 / 800 °/s; lift-off 628 °/s; rest 0.02 mm; repeat 0.04 mm | `lower_arm_pos` + `lower_arm_neg`: lift −0.16 mm at 800 °/s |
| apex | `wankel-ratio-v1` | carrier vs −(20/28)A 0.0016°, rotor vs carrier/3 0.0017° / 0.25° | rotor centre on the 4 mm eccentric circle within 0.00005 mm / 0.1 mm | `idler_upper_8t`: error 14.0° |

Corrections to the table below, by measurement: Vesper's 1.4589 and 66.17 mm are right (the slot is 8 mm off the
pivot; the centred-slot formula would give 1.452). Aster's point-mass form ω² = g·k·tan a/(e + L sin a) with k from the
compiled masses is 7–11 % slow, because the arms' and wheels' own mass and inertia are not at the weight axle; the judge
uses the distributed form ω²(h) = 2g·(dY/dh)/(dJ/dh) from the compiled colliders. Its 1.3–1.5 % residual is the
engine's step size: with 4 collision steps the same plateaus sit 0.4–1.1 % on the other side of the prediction. Apex's
law is exact as proposed (eccentricity 4.000 mm). Wrong-model mutants are refused (Vesper pivot moved 8 mm, Aster collar
×4 mass, Apex rotor gear 24T→40T). Instructions: Vesper and Aster author STEP groups removed (46 and 62 derived steps);
Apex's author steps split in order (86 steps of ≤ 6; its derived plan has an 8-part step). Browser gate on shard robotaddon22 (Apex): passed (hosted chromium).
**Vesper is not promoted:** its hosted chromium gate (robotaddon20) measured the ram 0.504 mm from the kinematics
(bound 0.5 mm; natively 0.300 mm) and found 17 arc ratios with a minimum of 1.281, a turning point picked up at a stage
boundary on browser frames; the judge's turning-point extraction needs work before a retry. Its disconnected control
passed. Same withdrawal as Aster below.
**Aster is not promoted:** in the hosted chromium gate (robotaddon21) its law checks held, then the judge's hinge-closure
bound refused the run: a hinge opened 0.550 mm (bound 0.5 mm; natively 0.365 mm) with axes 0.73° apart at 800 °/s.
The bound is not loosened; its contract, registry move, fixture and shard are withdrawn, `governor-lift-v1` stays
registered and the construction repair stays. A fix would stiffen the arm hinges or lower the top speed (a program
change), the owner's choice. **Bloom is not promoted:** every one of its 24 scissor pivots
is a pin (43093) in the centre hole of angle connector #4 (32192), which reaches 2.0 LDU into that part's mesh for any
rotation of the pin (2.2 LDU flipped); its six cage hubs (44809) overlap ring ends and spacers by 9–19 LDU (12 pairs);
the compiler reports locked hinges. That is a redesign of the pivots and hubs, not a minimal repair; no judge was
written. Details in its checkpoint `promotionReview`.
**R4 (2026-11-12, `lanes/2026-11-12-robot-r4-start-guards.md`, in review): Tempest promoted after a start-guard
pose repair; Solstice (re-posed) and Impulse Line stay experimental (below).** Both saved poses were not gravity rests, so
the unpowered cold settle moved the input before the program's start guard read it. Solstice's crank is re-posed to
its rest at −75° with the linkage solved by kinematics; Tempest's carrier to 102.5° with both arms translated to
hang straight. Programs are unchanged; link lengths, parts, colours and IDs are unchanged. One judge module,
`scripts/lib/sim-lab-r4-judges.mjs`; constants come from the compiled joints and (Tempest) the engine's compiled
mass properties, which the qualification test recomputes. Native runs (COLD 500, frameMs 25, strict ports),
measured / gate:

| Model | Judge | Cold sag before → after | Law error | Other measured | Disconnection (lost) |
|---|---|---|---|---|---|
| solstice-pumpjack | `walking-beam-v1` | crank 5.9° @ 500 ms, 12.6° @ 1 s → 0.13° in 3 s | beam vs loop 0.0187° / 0.1°; piston 0.022 mm / 0.1 mm | drive 0.00002°; swing 42.417° vs 42.403° predicted; stroke 40.596 vs 40.578 mm; 2193 frames | `pin_P`: crank span 360.3°, beam-law error 42.39° |
| tempest-pendulum | `double-pendulum-mode-v1` | carrier 39.8° @ 400 ms → 0.08° @ 500 ms, 0.25° @ 2 s | slow period 0.6664 / 0.6656 s vs 0.6650 (0.2 % / 0.09 %, gate 1 %) | fast 0.2988 s vs 0.2989; two-mode residuals 6.5 % / 3.4 % (gate 15 %); 1832 frames | `motor_pin_h3` + `motor_pin_h5`: motor span 120.8°, carrier drive error 107.1° |

Solstice's gravity equilibrium is about −74.8°; poses at −70° and −80° sag 2.8° and 3.0° in 3 s. Tempest's
disconnection must leave the hanging load intact: cutting the elbow axle or either bob makes the carrier re-settle
(elbow cut 36.5° in 3.2 s) and the program's own start guard refuses at stage 0, so those cuts cannot serve as the
control; removing motor A's two pins to the carrier can. Tempest's wrong-model mutant (lower bob replaced by another
wheel) is refused. Browser gate on shard robotaddon24, one step (the program runs about a minute).
**Solstice is not promoted:** native runs pass walking-beam-v1 (beam 0.019°, piston 0.022 mm at both 25 ms and
33 ms frames), but the local chromium browser gate (Node 22, production build) measured beam error 0.132° and
piston 0.17 mm against the frozen 0.1° / 0.1 mm bounds, a steady offset during the fast reverse cycle at crank
235–247°. The likely cause is a solver-setting difference between the browser and the native helper, to be
investigated separately; no bound changes. Its contract, registry move, fixture and shard were withdrawn; the
re-pose and the registered judge `walking-beam-v1` stay. Next: browser/native solver parity, then re-promotion
at 0.1°.
**Impulse Line is not promoted:** its unpowered pusher (saved at +30°) droops about 4°/s (−1.98° at 500 ms,
−4.06° at 1 s, against the program's 2° guard) and comes to rest leaning on the first bob at −13.9° (bob −1.34°).
Free contact begins near −12.5°, so the saved pose has about 12.5° of clearance and no gravity-rest pose exists
short of the bob. A rest stop would block the program's −24.5° preload (same direction), so the fix is a design
change (a counterweight of roughly 5.7 g on the pusher's free −40 hole; the pusher is 13.24 g with its centre of
mass about 6.9 mm off the axis) plus a quantitative law. The supplied impact is strongly dissipative and no
restitution is compiled, so no bound is derivable from compiled geometry yet.

Read-only triage from code and data on main `d318ed6e`; nothing was compiled
or run. The experimental set is every id in
`docs/data/robot-lab-experimental-checkpoint.json` without a contract in
`docs/data/robot-lab-qualification.json` (54 contracts). Controls stay out
(`rimrun-swapped`, `evenhand-control`, `sarrus-lift-single-chain` and the rest
of the 2b controls list). That leaves 17 models. None of them has a judge in
`QUALIFICATION_JUDGES`, a contract, a recorded construction-gate
(`bw-sim-models-solid`) run, a disconnection run or a hosted browser gate
(robotaddon shard). So every item below also needs, in order: the solid suite,
the judge with frozen-output, 1 cm shift and disconnection controls, the
contract, hosted native qualification, a browser gate shard, then the registry
move and regenerated catalogue and lessons. The "blocker" column names only
what comes before that. Sizes: S = one model, existing law, no geometry;
M = a judge family or minimal real-part repairs; L = harness or engine
support, or an open design question.

| Batch | Model | Blocker before the shared steps | Proposed law / judge | Size |
|---|---|---|---|---|
| R1 | obliquity-orrery | #1460 is closed; headless agrees and the causal control `obliquity-orrery-turned-axis` passes; browser load passes | `obliquity-tilt-v1`: sin δ = sin 22.5° · cos(λ − 45°) from the compiled axle tilt, max error 0.01°; disconnect crank B's link | S |
| R2 | cadence-geneva | CRLF disconnection parser fixed (`d175b2f9`); no judge | `geneva-index-v1`: n = 4, 90° step per crank turn, 90°/270° engage/dwell, dial = star/3; disconnect the drive pin | M (with R2 family) |
| R2 | equinox-differential | as above | `differential-sum-v1`: L + R = 2K, K = (12/28)·A, brake motor = 20/12 · output; disconnect the carrier gear | M |
| R2 | helios-transmission | as above | `willis-epicyclic-v1`: ω_out = 3ω_A − 2ω_c, ω_c = −(20/28)ω_B, standstill at stage 3; disconnect the control gear | M |
| R2 | orion-cardan | as above | `double-cardan-v1`: output − input = 0 while the middle shaft ripples 12.76° p-p (β = 36.87°); disconnect one cross. Share helpers with Phasekeeper's judge | M |
| R3 | apex | 2b: housing links overlap; minimal real-part repairs in #1510's style | `wankel-ratio-v1`: carrier = (5/7)A, rotor = carrier/3, eccentricity from compiled hinges | M |
| R3 | aster-governor | 2b: flyweight overlaps its key | `governor-lift-v1`: ω² = g·k·tan a / (e + L sin a), k from compiled masses; disconnect the collar link | M |
| R3 | vesper-quickreturn | 2b: motor overlaps the fixed bearing | `quick-return-v1`: time ratio 1.4589 and stroke 66.17 mm from compiled geometry; slow side swaps on reversal | M |
| R3 | bloom | 2b: anchor pins reach into the elbows | `scissor-sphere-v1`: link rotation = Δmotor/72, r = a·cos(θ + 22.5°)/sin 22.5° | M |
| R4 | solstice-pumpjack | start guard faults at stage 0 after the 500 ms cold settle | `walking-beam-v1`: stroke 40.58 mm, swing 42.4°, turning points 115.5°/283.1° crank; rest stops as High Select (`1b251e04`) | M |
| R4 | tempest-pendulum | start guard: COLD 1000 sags 86° | `double-pendulum-mode-v1`: slow normal mode period and amplitude ratio (√2 point-mass ideal) predicted from compiled inertias, not the ideal | M |
| R4 | impulse-line | unpowered pusher droops ~4°/s in the cold settle against a 2° guard; law only qualitative | quantitative contact-transfer law (last-bob displacement after pusher clearance against `impulse-line-missing-middle`, ratio ≥ a derived bound); pose fix first | M–L |
| R5 | spiral-scribe | 64781 rack pitch 3.2 mm does not match the pinion law (37.7 vs 38.4 mm per turn); causal control not run on real parts | `radial-feed-v1`: carrier/motor = −1/3, planet/carrier = 2, feed = pitch·θ; first a correct real rack, else keep experimental with that reason | M |
| R5 | quiet-partner | locked-hinge warnings; elastic bands become spring couplings | `tuned-absorber-v1`: gain with/without bands, coupled modes 0.815/2.135 Hz vs predicted, control `quiet-partner-control`; needs harness support for spring couplings | L |
| R6 | pan-shift | run ~374 s against the 180 s contract maximum; whether ±14.2° is gravity rest or stop contact is undetermined | `roberval-v1`: load position changes beam angle ≤ 0.01°, trim ±60 gives symmetric ±tilt; shorten the program honestly or keep experimental | L |
| R6 | inertia-loop | geometry, construction-steps rule, motor-model dominated (2b); do last | `shape-cycle-yaw-v1`: net yaw per loop = (k_wide − k_compact)·Φ, sign flips on inverse loop, control ≈ 0 (reuse Afterturn's method) | L |
| R7 | vector-delta | blocked by a missing part | `delta-ik-v1`: tool head within 0.25 mm of 13 waypoints, shoulder angles vs IK; keep blocked | — |

Order: R1 first (smallest, unblocks a precedent), R2 as one judge-family PR,
R3 and R4 as geometry/pose PRs (one model per commit, before/after recorded),
R5–R6 after their open questions are decided, R7 waits for the part. Never
loosen the construction gate, a start guard or a threshold to promote.

### E1. Engine follow-up: Jolt enhanced internal-edge removal (proposed, not started)

Goal: remove the contact bump at abutting coplanar tile joints that RimRun
shows (about 0.0085 m/s per roller per joint; see 0000), so judges need not
avoid tile ends.

Where the setting goes: `BodyCreationSettings.mEnhancedInternalEdgeRemoval`,
set in the body loop of `overlay/scratch-gui/src/lib/bw-sim/physics/jolt-core.js`
(where `bcs` is built, next to `mMotionQuality`). The Brickwright fork's
binding (`jolt-physics` 1.1.0-bw.9) exposes the attribute and
`Body.SetEnhancedInternalEdgeRemoval`, so no binding change is needed for the
flag itself.

Why the earlier diagnostic (flag on the moving bodies only) changed nothing:
- Placement is not the cause. Jolt combines the flag per pair
  (`Body::GetEnhancedInternalEdgeRemovalWithBody` ORs both bodies), so setting
  it on the rollers is equivalent to setting it on the frame or a static
  compound.
- Removal only works within one body pair: `InternalEdgeRemovingCollector`
  voids the edges of faces of shape 2 that the convex shape 1 already touches.
  RimRun's tiles are sub-shapes of one body, so that part holds.
- Likely cause (hypothesis, verify first): RimRun's track frame is dynamic
  (the judge asserts only the floor is static). For two dynamic bodies
  `PhysicsSystem::ProcessBodyPair` orders the pair by body ID, so if the frame
  was created before the rollers, the frame compound is shape 1 and the roller
  cylinder is shape 2. The collector then voids features of the roller, not
  the tile joint, and the bump stays. Against a static frame or the ground the
  static body is always shape 2 and the method would apply.
- Also check: the tile boxes carry a convex radius (`boxConvexRadius`), which
  rounds the joint edge; verify the supporting faces still share the joint
  vertices exactly.

Proposed steps:
1. Read-only/instrumented diagnostic (no merge): record body IDs and the
   pair order for each roller–frame contact, and the contact normals at a
   joint with the flag on all bodies.
2. If the order is the cause, fix it in the fork, not in Lite: a sim
   collide callback (`PhysicsSystem::SetSimCollideBodyVsBody`) that, when
   enhanced removal applies, collides the body with fewer sub-shapes as shape
   1 and flips the results. It must keep `PartPairSimShapeFilter` working.
   This is a new fork release and a Lite pin bump (all pin surfaces).
3. Enable it opt-in, per model or per body (a compiled flag such as a
   `!BW` meta line, like the per-model rotor opt-in of #1494), first for
   RimRun only. Global enablement changes contacts in every model.

Affected models and requalification cost:
- Opt-in for RimRun only: RimRun and `rimrun-swapped`, native qualification
  and browser shard robotaddon14; the judge may then fit across joints, but
  its 5 % gate must not be widened (tighten only with evidence).
- Global: every model with contact between multi-collider bodies (track,
  ground, gear frames, stops), i.e. all 54 contracts natively, every
  robotaddon browser shard, and the checkpoint values; plus the cost of the
  extra contact pass. Not recommended without the opt-in step first.
- Any fork change: new `jolt-physics` release, Lite pin bump, full unit
  shards (pin bumps ripple), and determinism checks native vs browser.

Size: S for step 1, M for the opt-in flag, L if the fork collide order must
change.

## 0000. Status, 2026-11-09 (supersedes 000 below)

Q1–Q5 are all done. They landed together as one integration, #1683
(merge `98067ba8`), which merged #1684 (Q1/Q2), #1681 (Q3) and #1682 (Q4)
into the Q5 branch. All four PRs show as merged.

Promoted: Loop Relay, Parity Dial, Counter Slide (Q1/Q2), Point Weaver (Q3),
Evenhand (Q4, `counterbalance-holding-torque-v1`) and RimRun (Q5,
`rolling-inertia-v1`). Hosted unit shards on the merged head passed
ordinary, strict and disconnected qualification for all six, and the
construction gate. `rimrun-swapped` and `evenhand-control` stay experimental
as controls.

Open points, recorded rather than resolved:

- **Browser gates (2026-11-10):** Loop Relay, Parity Dial, Counter Slide and
  Point Weaver passed in #1703 (shards robotaddon10–12). Evenhand has its gate
  in #1714 (shard robotaddon13: counterbalance law, disconnected control,
  manual control, instructions, LDR/MPD, saved-project replay, EN/DE
  lessons); RimRun has its gate (shard robotaddon14) since its judge change,
  see the residual below. Evenhand and
  RimRun's build steps were re-authored to at most six parts per step.
- **Manual browser controls not run** for any of the six (superseded by the
  entry above). The checkpoint and
  contracts record them as `notRun`, together with saved-project replay and
  export. `ci:full` was added and then removed on operator decision, so no
  hosted browser shards ran on the merged head either.
- **RimRun residual.** Each roller accelerates about 4 % below its damped
  prediction g·sinθ/(1+I/mr²) − 0.05·v̄. That is inside the judge's 5 % gate,
  but it is not explained. The inner/outer ratio itself agrees to 0.4 %.
  The constants and inertia sources are in `scripts/lib/sim-lab-rimrun-judge.mjs`.
  Explain the residual before anyone tightens that gate. Never widen it.
  **Explained (2026-11-09):** each roller loses about 0.0085 m/s at each
  track-segment seam (128 mm box colliders laid end to end, about 0.05 mm
  out of plane, seams near 74 mm and 202 mm). The judge window
  (2960–3240 ms) covers one crossing, which accounts for ~0.03 m/s² of the
  0.0327/0.0331 m/s² shortfall. Between seams the prediction matches within
  0.1 %. Ruled out: missing inertia, joint friction or damping, timestep
  error, per-part mass. Judge and gate stay unchanged. Possible follow-ups,
  not done: fit within a single segment, or merge abutting track colliders
  (affects every model).
  **Correction and browser findings (2026-11-10, #1714):** the compiled
  track colliders are exactly coplanar (all 18 tile tops at 0.000000 mm along
  the surface normal), so the bump is not a step between tiles: it is Jolt's
  internal-edge contact where two abutting 320 LDU tiles meet. Tile geometry
  cannot remove it with stock parts (no smooth tile is longer than 320 LDU).
  Enabling Jolt's enhanced internal-edge removal is a possible engine
  follow-up; it affects every model. Two browser measurement defects were
  fixed on the way: (1) timestamp aliasing — the recorder stamped worker poses
  with the session clock (33.3 ms ticks) while each batch runs whole 5 ms
  steps (30 or 35 ms), so the fit read 16 % low; a gate that requests
  per-step sampling now gets frames stamped with the physics time of their
  poses (other gates keep the session clock their hold checks use); (2) coarse sampling — browser frames are whole batches,
  8 in the window; the worker's fixed-step collector now also samples up to
  four requested dynamic bodies, and the gate judges on the registry's 20 ms
  grid. On that clean data the left roller still fits 5.7 % low (right
  2.7 %): the one joint crossing falls mid-window, where natively it falls
  elsewhere. **Resolved (2026-11-10, judge change):** `rolling-inertia-v1`
  now fits each lane from gate clearance (the first frame after the engine
  last reports the gate in contact with either roller) to its first tile
  joint (from the compiled tile colliders), at least 10 frames at 20 ms, the
  same judge natively and in the browser, 5 % gate unchanged. On one tile
  both rollers match their predictions within 0.02 % (ratio 1.0783 vs
  1.0784); `rimrun-swapped` still moves the lead. RimRun's browser gate runs
  again (shard robotaddon14).
- **Merge exception for #1714 and the RimRun judge PR (operator decision,
  2026-11-10):** both may merge with browser (heavy) and browser (light)
  failing exactly the six steps that also fail on main eb7e1c91 (run
  42788806821: ESP32-S3 boot, S040 display/touch, 386 media in Widgets, x86
  debugger Pause, four-surface save/reopen, MakeCode import), only when the
  error signatures are identical and every other enabled check is green.
  #1714 merged on that basis (comment on the PR); no other step was excepted.
- **Arcade exception at merge.** On operator decision, "Arcade numeric
  authoring (official build)" was an exception for #1683 only. Both failures
  are kept on record:
  - attempt 1: a strict clock assertion got 1000.0000000000091 ms against
    1000;
  - attempt 2 (a single-job rerun): the official GUI artifact admission
    refused the rerun before the verifier ran.
  #1683 touched no Arcade path. Main's #1694 since changed that millisecond
  comparison. The rerun-admission behaviour is untouched and belongs to the
  Arcade lane.

## 000. Status, 2026-11-08 (read this first; supersedes P1–P6 below)

P1–P6 are all done. Merged: #1641 (Afterturn), #1639 (nine-intake judge,
no promotions), #1669 (disconnection run uses the compiler's registered hub,
so `spike_hub` models work), #1672 (geometry repairs; promoted Toggle Press,
Footfall, Phasekeeper, Vector Sum), #1671 (promoted Paired Door Sync, judge
`opposed-rack-pinion-v1`), #1668 (dropped the >50-piece bound; promoted
Helixgate).

Still experimental, each with its reason in
`docs/data/robot-lab-experimental-checkpoint.json`. All are unowned and
doable as geometry or test-design work:

- **Q1/Q2 (2026-11-08, `lanes/2026-11-08-robot-q12-geometry.md`)**: Loop
  Relay and Parity Dial input axles now end at the motor face; Counter Slide's
  eight 3L pins are turned end for end and each rack assembly sits 3 teeth
  (23.56 LDU) clear of its end-stop pin. Contracts added with the checkpoint
  values; promoted once the hosted runs pass. The two items below are kept as
  the historical diagnosis.
- **Loop Relay, Parity Dial**: pass ordinary, strict and disconnected runs at
  178° / 88° input floors; fail the construction gate because the input axle
  reaches 2.5 LDU into the motor. Fix the axle seat, then re-add the contract
  (values in the checkpoint) and promote as #1668 did for Helixgate.
- **Counter Slide**: same, at a 98° floor; both housing angles overlap their
  racks by 2.5 LDU and eight pins reach about 2 LDU into the housings.
- **Point Weaver**: DONE (Q3, 2026-11-08). Motor-foot mount redesigned: pads
  removed and the motor assemblies lowered 10 LDU onto the rails, so one 3L pin
  joins rear foot, rail and base cross; promoted (116 placements).
- **Evenhand**: DONE (Q4, lanes/2026-11-08-robot-q4-evenhand.md): judge
  `counterbalance-holding-torque-v1` registered and Evenhand promoted. The
  disconnection removes one inner counterweight pin (`forearm_weight_pin_-1_-20`,
  120 LDU behind the elbow): the elbow loses its mirror balance by that pin's
  moment (predicted 0.165, measured 0.166 mN·m) while the cold-settle sag
  (1.4° / 1.0°) stays inside the unchanged 3° start guard. Whole weight beams
  sag the arm 3.4–17° and fault the guard. `evenhand-control` stays a control.
- **RimRun**: done in Q5 (PR #1683, 2026-11-09) and promoted with judge `rolling-inertia-v1`.
  The hub is pinned to the motor posts with four 2780 pins, and the wheel half bushes, which sat
  7.5 LDU inside the wheels, are seated flush. The supplier's catch and fault-stop checks are not in
  the repository; both behaviours were measured instead, and the values are in the checkpoint.
  `rimrun-swapped` is the causal control. Disconnection removes all ballast.

Not run for the newly promoted models: manual browser controls (recorded as
not run in the checkpoint). Standing rules above still apply; never loosen the
construction gate or a threshold to promote.

## 00. Status and pending tasks, 2026-11-03 (read this first)

The owning agents stopped on the weekly usage limit. Everything below is
unowned and ready for a fresh agent. Refresh `origin/main`, PR heads and checks
before acting; another agent may have finished an item. Claim each task with
a `lanes/` file in the same PR as the change (see the existing
`lanes/2026-11-0*-robot-*.md` files for the format).

Merged since section 0: #1636 (batch A/B judges; promoted Poise, Bend Ripple,
Offset Relay, Rack Decoder, Remote Pivot, Schmidt Shift, Equal Share, Stroke
Shift, Triad Table), #1640 (disconnection checks; promoted Kestrel, Meridian,
Lumen, Tangent Table), #1635 (Afterturn measured under the native rotor) and
#1634 (this document's section 0/2b). #1512's collider changes landed via #1566.

### P1. Finish PR #1641 — Afterturn judge, Afterturn promotion, Poise lesson

Branch `lane/robot-afterturn-judge-20261103`, head `95e19460` (a merge of main
into `5a203448`), `ci:full` already labelled. Content: judge
`afterturn-shape-cycle-v1` from an independent prediction (Iw/J = 0.02608 at
B = 0 and 0.02746 at B = 70°; each stroke within 1 %, whole and inverse cycle,
fixed-mass control branch, removing both rods breaks the law); Afterturn
promoted; supplier claims and en/de lessons corrected from the #1494 artefact
4.66° to the physical value; Poise lesson no longer repeats "Roberval
balance". Native runs passed locally (cycle 1.24° against 1.25° predicted).

To do:
1. Wait for every enabled check on the current head. The previous head
   `5a203448` had one failure, `browser (light)`; its log was never read.
2. If `browser (light)` fails again, read the failed log (`gh run view <run>
   --job <job> --log-failed`). If it is a Robot Lab assertion, fix the cause;
   if it is an unrelated flake, retry only that job once (`gh run rerun
   <run> --job <job>` after the run finishes). Never weaken a check.
3. Merge: `gh pr merge 1641 --merge --match-head-commit <head>`; verify the
   merge parents and that the tree equals `git merge-tree --write-tree
   <main-parent> <head>`.
4. If main moved and conflicts, merge main into the branch (no rebase or
   force-push), keep both sides' entries, and repeat steps 1–3. `ci:full`
   must stay on the final head.

### P2. Finish PR #1639 — register the nine-intake judge (no promotions)

Branch `lane/robot-nine-intake-promotions-20261103`, head `e97ec9b4`, draft,
no `ci:full`. Final content after a revert: registers the existing judge
`scripts/lib/sim-lab-nine-intake-judge.mjs` in `QUALIFICATION_JUDGES` with a
throwing wrapper and a disconnection-loss measure, and records in
`docs/data/robot-lab-experimental-checkpoint.json` why each of the nine stays
experimental (see P3–P5). No registry move, contract or model byte change.

To do: mark ready (`gh pr ready 1639`), wait for the lite checks, add
`ci:full` once on the final head, then merge and verify as in P1. If P1
merges first, merge main into this branch and keep both sides' checkpoint
and handoff entries.

### P3. Geometry repairs for five passing intakes (after P2)

**Update 2026-11-07 (PR 1672):** Toggle Press, Footfall, Phasekeeper and Vector Sum
repaired, given contracts and promoted. Point Weaver stays experimental: its rear
motor-foot stack cannot be pinned cleanly (reason in the checkpoint).

Toggle Press, Footfall, Phasekeeper, Vector Sum and Point Weaver pass hosted
native ordinary, strict and disconnected qualification runs, but fail the
established construction gate `test/bw-sim-models-solid.test.mjs`:

| Model | Gate finding |
|---|---|
| toggle-press | `fixed_pivot_U` penetrates `upper_toggle_UK` and `pivot_bridge`; three guide-post holes filled twice |
| footfall | `base_cross_support_A` hole h4 filled by two pins |
| phasekeeper | `base_rail_output` holes h1 and h13 each filled by a pin and an axle |
| vectorsum | `output_axle` reaches 0.7 LDU into `diff_cover_28t` |
| pointweaver | eight motor-foot pins penetrate their feet (1.3 LDU); `endpoint_marker_tip` penetrates `endpoint_marker`; six holes filled twice |

For each model: move or remove the offending parts in the `.ldr` (smallest
reviewed pose change, following how #1510 repaired Phasor Twin and #1551
repaired Paired Door Sync), keep the BOM honest, rerun
`test/bw-sim-models-solid.test.mjs` for that model, then requalify with
`scripts/qualify-robot-lab-models.mjs` (ordinary, strict, disconnected). Only
then do the promotion changes listed in
`lanes/2026-11-02-robot-batchab-promotions.md` (contract, source fixture,
registry move, generated catalogue/lessons, mechanism entry, checkpoint).
Never loosen the gate. Phasekeeper's Cardan dependence is already shown
(removing `joint_2_intermediate_yoke` gives about 321° phase error).

### P4. Loop Relay disconnection run

Ordinary and strict runs pass. The shared disconnection run removes
`chain_input16` and then fails before measuring: the hub observation base is
not found. Find out why the harness loses the hub (read
`scripts/qualify-robot-lab-models.mjs` and the nine-intake disconnection
measure) and either pick a removal that keeps the observation base while
breaking the law, with a justification in the code comment, or fix the
harness lookup in a separately reviewed change. Do not swap parts just to
get green.

Diagnosis (2026-11-07): the removal is not the cause. Loop Relay's hub part is
`spike_hub`, and the shared disconnection test looked up a body containing a part
named `hub`, which no Loop Relay body has, with or without `chain_input16` (the
compiled hub body is unchanged by the removal). Helixgate, Parity Dial and Counter
Slide use `spike_hub` too. Fix on `lane/robot-looprelay-20261107`: the test takes
the compiler's single registered hub part (`mechanism.hubs[0].id`), as the
nine-intake judge already does; all 31 registered contracts resolve to `hub`, so
their runs are unchanged. The removal of `chain_input16` stays as reviewed.

### P5. Remove the 50-piece minimum from qualification (operator decision, 2026-11-07)

Decision: the >50-piece minimum is dropped from qualification altogether.
Qualification judges the simulated physics and its dependence on the
mechanism; piece count is not part of that. The builder brief
(`docs/ROBOT-LAB-MODEL-BUILDER.md`) keeps "models above 50 pieces are
welcome" as a design preference, and the gallery's "More than 50 pieces"
filter stays, both reading the honest count.

To do:
1. In `scripts/lib/robot-lab-qualification.mjs` (contract validator, the
   `assert.ok(Number.isInteger(c.parts)&&c.parts>50)` line) keep the
   integer/positive check on `parts` but drop the `>50` bound. The `>50`
   instruction-step check in `scripts/lib/sim-lab-arm-lift-gate.mjs` is a
   different rule; leave it.
2. Add or adjust a validator test: a contract with an honest small count
   (e.g. 20) is accepted, a missing or non-integer `parts` is still rejected.
3. Note the change in this handoff and in the checkpoint reasons for
   Helixgate (20 pieces), Parity Dial (31) and Counter Slide (44).
4. Qualify those three through the normal pipeline (contract, ordinary,
   strict, disconnected, construction gate `test/bw-sim-models-solid.test.mjs`)
   and promote whichever pass. Never pad a model's count.

Progress (2026-11-07): step 1–2 done on `lane/robot-piece-minimum-20261107`
(`assertHonestPartCount`, `test/robot-lab-qualification-parts.test.mjs`).
Outcome (2026-11-08): after #1639 (judges) and #1669 (P4 harness fix), hosted
native ordinary, strict and disconnected runs pass for Helixgate, Loop Relay,
Parity Dial and Counter Slide with strict disconnection input thresholds (each
program's own completion tolerance: 717, 178, 88, 98). Only Helixgate also
passes the construction gate and is promoted. Loop Relay and Parity Dial fail it
(input axle reaches 2.5 LDU into motor_A); Counter Slide fails it (housing angle
connectors interpenetrate the racks by 2.5 LDU, eight pins reach about 2 LDU into
the housings). These three stay experimental pending geometry repair and
requalification; their trial contract values are in the checkpoint reasons.

### P6. Other remaining experimental entries

From section 2b: RimRun (hub stands loose; mount it with real parts, then
write a judge), Evenhand (needs a motor holding-torque judge; reference
figures in 2b) and Paired Door Sync (repaired in #1551; needs a qualification
contract and the registry move). Controls and comparison variants
(`*-control`, `*-swapped`, `*-in-phase`, `afterturn-fixed-masses` and the
like) stay experimental by design.


Status 2026-11-07 (PR #1671): Paired Door Sync promoted (`opposed-rack-pinion-v1`; pinion
disconnection loses the law by 24 mm). Still open:
- **Evenhand**: a holding-torque judge passes its law (branch `lane/robot-evenhand-20261107`,
  unregistered): the measured torque matches statics within 0.002 mN·m, elbow < 0.002 mN·m.
  Next: pick a removal that does not trip the program's 3° start guard during the 500 ms cold
  settle (removing the forearm counterweights droops the arm 9–17°), or justify a different
  disconnection. Then register the judge and promote.
- **RimRun**: mount the hub with real bridging parts (the hub is about 170 LDU from the nearest
  frame member; the feet are separate bodies), repair the supplier's failing catch and
  watchdog-hold checks, then write the judge with `rimrun-swapped` as the causal control.

## 0. Status refresh, 2026-11-02

Done on main since this handoff was written:

- **#1435 (resting-frame creep)** fixed by #1577 (idle speculative floor hits
  no longer displace resting supports); the issue is closed. Section 4 is
  history.
- **#1494 (rotor inertia)** fixed for opted-in models by #1573 (native relative
  rotor via `0 !BW ROTOR_INERTIA native`; supersedes #1505 and #1553); the issue
  is closed. Models that do not opt in keep the old behaviour. Section 3 is
  history; Afterturn needs the opt-in plus its own judge.
- **CRLF disconnection parsing** fixed by #1549. The seven CRLF models in
  section 2 are no longer blocked by the parser; each still needs its own judge.
- **Paired Door Sync**: construction repair (from #1514) and programme-outcome
  contract merged in #1551. It is still on the experimental list: promotion
  (registry move, qualification contract) has not happened.
- **Promoted**: Final Squeeze and High Select (#1555, superseding #1508),
  Phasor Twin (#1510), Tipline, TwistSpan and Swayshift (#1555/#1566).
- **Closed/superseded**: #1505, #1508, #1512, #1514.

In progress by other agents (do not touch these branches):
`lane/robot-batchab-promotions-20261102` (batch A/B judges: poise, the A1 set,
equal-share/stroke-shift/triad-table), `lane/robot-afterturn-rotor-20261102`
(Afterturn with the native rotor opt-in) and
`lane/robot-collider-catalogue-20261102` (the mesh-collider work #1512 left
open).

The experimental list on main has 66 entries. Section 2b triages the ones the
2026-10-28 table did not cover.

## 1. Promoted so far, and work in flight

Merged on main:

| PR | Models promoted |
|---|---|
| #1446 | Toggle Lever, Thirdline |
| #1455 | Cross Ratio and the batch-2 set |
| #1483 | Samebeat |
| #1496 | Pivot Exchange |

#1497 (batch C) merged too, but promoted nothing. Final Squeeze, High Select
and Obliquity Orrery were reviewed and kept experimental.

Open PRs: refresh each one and coordinate the existing owner before carrying
its published continuation. Where the author delegates finishing qualification,
retain the frozen source and originals. Add `ci:full` only if absent and its
one-shot admission has not already happened; never blindly repeat it. Merge only
a fully qualified current combination, after source-review blockers are resolved.

| PR | Branch | Content | State at handoff |
|---|---|---|---|
| #1508 | `lane/robot-batchD-20261028` | Promotes High Select (judge `max-select-v1`) and Final Squeeze (construction repaired); records the batch-6 browser run | Unit checks running; no `ci:full` yet |
| #1510 | `fix/robot-lab-model-geometry-20261028` | Repairs Phasor Twin's construction (idler gear sat 7.5 LDU inside the motor; 20 pins reached into solid parts) and promotes it. The edit table is in the PR body | `ci:full` on; full run in progress |
| #1512 | `fix/robot-lab-mesh-colliders-20261028` | Mesh-derived shock-absorber and linear-actuator colliders | Full label admitted and added once; run40729193655 pending. Independent slab-containment, conservative-rounding and repeat-generation admission gaps require correction scope #1531. No actual missed surface is claimed. Every shipped model verdict must remain unchanged |
| #1514 | `fix/robot-lab-model-geometry-b3-20261028` | Seats Paired Door Sync's carriage pins | Full label admitted and added once; run40729199310 pending. Four along-axis moves, 88-placement canonical/MPD and checkpoint-hash joins are source-consistent; hosted clearance and program qualification remain necessary |
| #1505 | `fix/rotor-inertia-1494` | Rotor-inertia fix | Blocked; see section 3 |

## 2. Remaining models

Triage of batches B and A, 2026-10-28:

| Model | Status | Next action |
|---|---|---|
| poise | judge passes | Promote in a batch PR. The judge was written in the previous agent's scratch area and **never committed**, so re-derive it |
| bend-ripple, offset-relay, rack-decoder, tangent-table, remote-pivot, schmidt-shift | judges pass locally (law, disconnection, frozen, shift) | Same as poise: they were never committed. Re-derive and promote as batch "A1" |
| equal-share, stroke-shift, triad-table | meshes clean; only the oversized colliders fail | Wait for #1512. Then write their judges (previously measured: share ratio 2.0003 against a control of 1.00; strokes = 2r within 0.004 mm; 3-RPR kinematics within 0.0025 mm) and promote |
| paired-door-sync | pins repaired in #1514 | After #1514, judge and promote |
| apex, aster-governor, vesper-quickreturn | solid overlaps: housing links, flyweight against its key, motor against the fixed bearing | Make minimal real-part LDraw repairs (follow #1510's style and record every edit), then qualify |
| bloom | anchor pins reach into the elbows | Same |
| spiral-scribe | the 64781 rack pitch (3.2 mm) does not match the pinion law (37.7 vs 38.4 mm per turn) | Use a correct real part, or keep experimental with that reason |
| solstice-pumpjack, tempest-pendulum | each start guard faults at stage 0 after the 500 ms cold settle | Repair the pose, for example with rest stops as `1b251e04` did for High Select. Change the program only if the guard itself is wrong, and justify it |
| inertia-loop | geometry, the construction-steps rule, and likely motor-model dominated | Do it last, after #1494 lands |
| cadence-geneva, equinox-differential, kestrel-flapper, lumen-iris, helios-transmission, orion-cardan, meridian-linkage | CRLF line endings break the physical-ID disconnection parser. The existing JavaScript multiline author assertion already accepts CRLF | A narrow harness candidate normalizes CRLF in the disconnection matching view, with LF/CRLF and strict-ID controls. Original model bytes and provenance checks stay unchanged. Hosted qualification and unchanged existing verdicts remain required; this parser repair does not promote these models. Kestrel, lumen-iris and meridian had earlier local judge passes |
| pan-shift | runs past the 180 s contract maximum | Investigate the program length; keep experimental if it can't be fixed honestly |
| vector-delta | blocked by a missing part | Keep blocked |
| obliquity-orrery | #1460 closed | Done 2026-11-11 (R1, #1725): promoted with `obliquity-tilt-v1` |
| afterturn | Promoted 2026-11-03 with the new `afterturn-shape-cycle-v1` judge: independent prediction from compiled masses and slider-crank poses, Iw/J = 0.02608 (masses out, B = 0) and 0.02746 (masses in, B = 70°); measured strokes 0.0261/0.0275 (within 1 %), cycle 1.24° vs predicted 1.25°, inverse back to 0.04°, fixed-mass control 0.01°. The earlier "0.02749 (masses out)" label was reversed: B = 70° moves the masses in. The supplier figure 4.6625° was the #1494 double count; claims and lessons now give the physical value | Done (control afterturn-fixed-masses stays experimental as the control) |
| impulse-line | the unpowered pusher droops about 4°/s during the cold settle, against a 2° guard; its law is only qualitative | Needs a pose fix and a quantitative law |
| quiet-partner | compiler warns of locked hinges, and the elastic bands become spring couplings | Needs harness support for spring couplings, or stays experimental |

Geometry edits must be the smallest real-part change that makes the model
buildable while keeping its principle. Record before and after for each edit. If
the model came from an addon archive, update the archive hash, canonical copy and
checkpoint consistently, as #1510 did.

## 2b. Triage of the remaining experimental entries, 2026-11-02

Read-only triage; nothing was compiled or run (host load was about 8).

**Nine Technic intakes** (added by `ddb5a6c1d`; record
`docs/data/robot-lab-nine-intakes-20261026.json`, handoff
`docs/ROBOT-LAB-NINE-MODELS-HANDOFF.md`). Each has a native passive-law judge in
`scripts/lib/sim-lab-nine-intake-judge.mjs` (gate
`sim-lab-nine-intake-gate.mjs`, test `test/bw-sim-nine-intake-motion.test.mjs`)
that passes both cadences, the part-removal control and the terminal hold. None
has a contract in `docs/data/robot-lab-qualification.json` or an entry in
`QUALIFICATION_JUDGES`, and the browser journeys (shards `robotaddon10..12`) are
incomplete. Shared next step: register the existing judge as a
`QUALIFICATION_JUDGES` entry, add the contract, run
`scripts/qualify-robot-lab-models.mjs` on the single model (cold repeat, two
cadences, frozen output, translated foundation, disconnection), then the hosted
browser journey, then promote as #1555 did.

| Model | Mechanism / law | Blockers and notes |
|---|---|---|
| helixgate | 24:1 worm drive; gate turns 30° per two motor turns, worm holds when coasting | 20 pieces, under the generic builder's >50-piece rule: decide if the rule applies to intakes or keep experimental with that reason |
| looprelay | chain drive 16→24, then 8→24 reversal: ratio −2:9 | Partial browser journey passed (lessons included) |
| paritydial | one 8T drives two 24T hands; the idler path reverses sign, same 1/3 speed | 31 pieces (same piece-count question); browser journey cut off at lessons |
| counterslide | one pinion, two opposed racks: equal and opposite jaw travel, fixed centre | Depends on the 3L shaft envelope fix (in main); two archives are one model |
| toggle-press | toggle (knee) linkage approaching dead centre: ram force/displacement ratio | Program must not cross dead centre; judge checks the approach only |
| footfall | twelve-link (Jansen-type) leg, closed foot path per crank turn | None known beyond browser journey |
| phasekeeper | double Cardan at equal angles: ripple of joint 1 cancelled by joint 2 | Needs the two inferred real Cardan crosses (83 physical pieces); keep the loose-part recognition test |
| vectorsum | open differential: carrier = mean of the two side-shaft angles | Two motors (A, B); check shaft-tip clearance stays clean |
| pointweaver | two-motor five-bar, endpoint reaches four corner poses | Chromium full journey already passed once (preliminary) |

**Update 2026-11-03 (nine intakes):** judges registered per family in
`QUALIFICATION_JUDGES` with a disconnection-loss measure. Toggle Press, Footfall,
Phasekeeper, Vector Sum and Point Weaver pass the native qualification runs but fail
the construction gate (`bw-sim-models-solid`), so they stay experimental pending
geometry repair. Helixgate was promoted on 2026-11-08 (P5). Loop Relay, Parity
Dial and Counter Slide pass the native runs but fail the construction gate (P5
outcome). Reasons are in `docs/data/robot-lab-experimental-checkpoint.json`.

**Batch E remainders** (added in #1499):

| Model | Mechanism / law | Contract / judge | Blockers and next step |
|---|---|---|---|
| rimrun, rimrun-swapped | rolling bodies of equal mass, different moment of inertia: inner ballast rolls faster | Package runner only; no contract | Hub stands free, `prepareModel(...).issues` reports `loose-part`. Mount the hub to the frame with real pins, then repair the author-declared failing finish/catch and watchdog-hold gates, then write a judge with the swapped scene as the causal control |
| evenhand, evenhand-control | counterbalanced two-joint arm: near-zero holding torque | None | Law is visible only in `jointDynamics(id).motorTorqueNm`. Write a torque judge (balanced: shoulder 0.33–0.36 mN·m, elbow < 0.01; control: elbow 0.61·cos(A+B) mN·m) with the control as the causal pair |

**Swayshift on the experimental list is not a bug.** The entry is id
`swayshift-in-phase`: the same `swayshift.ldr` with a second program,
`swayshift-in-phase.bw` (full-period timing). #1555 moved the plain
`swayshift.ldr` entry out of the list and kept this comparison, exactly as for
`tipline-swapped` and `twistspan-inner`. No duplicate entries exist in the list
(checked by file and id).

**Controls and comparisons of promoted or triaged models.** These stay
experimental by design; they are the causal controls of their parent's judge and
are not promotion candidates themselves: poise-mass-control,
equal-share-even-springs, impulse-line-missing-middle, travel-dial-wheel-raised,
ghost-pivot-unequal-link, afterturn-fixed-masses, quiet-partner-control,
high-select-mirror, obliquity-orrery-turned-axis, pivot-exchange-wide,
air-budget-two-tanks, foldback-open, thirdline-control, samebeat-conjugate,
samebeat-control, carry-ratio-control, sarrus-lift-single-chain,
phasor-twin-control, swayshift-in-phase, tipline-swapped, twistspan-inner,
rimrun-swapped, evenhand-control. Next step for each: none, unless its parent's
judge needs it as its disconnection or causal control.

## 3. Rotor inertia (#1494), PR #1505 (history: fixed by #1573)

The defect: `setRotorInertia` in `overlay/scratch-gui/src/lib/bw-sim/physics/jolt-core.js`
adds the motor's reflected rotor inertia to **both** hinge bodies. Afterturn's
free platform therefore turns 0.124 per wheel degree, where physics predicts
about 0.026.

What #1505 does:
- **Derivation.** The ideal axial model has coupled inertia
  [[I1+Jr, −Jr], [−Jr, I2+Jr]]. Published source
  `92fb5d37cb244855b9a8af40dd122b444a21ec7a` still applies a lagged correction
  derived from whole-step angular-rate changes. Its current PR description
  discusses a different motor-impulse-only candidate; bind the actual source
  instead of assuming that description is already implemented.
- **Limit.** Post-step correction is not proof of exact contact/common-mode or
  integrated-position dynamics. A candidate must pass the original guards and
  independent momentum, servo and rollback controls; algebra alone is not
  qualification. A required native solver extension needs separately reviewed
  ownership, build/release and explicit pin adoption.
- **Regression fixture.** `test/bw-sim-rotor-inertia.test.mjs` compares a
  free-floating housing against the ideal ratio 0.02525; the previous diagonal
  model predicts 0.12381. Require the fixture on the actual corrected head,
  together with all original model and transport guards. Previously reported
  local results do not establish current-head qualification.

**Blockers.** Retained first failure logs from run40688505800 bind actual
synthetic checkout `9c14fbd252b21cae00b009bbabc2ae839284e1ad`, whose rotor and
failing test bytes equal the published head. Sarrus clearance is −0.004174 mm;
the world collision bench travels 0.012009 m against its unchanged <0.01 m guard;
City and Essential BLE/ScratchLink endpoint comparisons also fail their 0.5°
agreement guards. These are completed assertions, not missing command events or
infrastructure failures. Preserve every failure and original assertion. Scope
#1531 prepares a source correction; do not import a tolerance relaxation. Next:

1. Log, per step, the reaction impulse the coupling applies to the baseplate.
   Compare it with the physical reaction Jr·(relative angular acceleration)·dt,
   especially at the worm's abrupt speed changes.
2. **If the applied impulse is too large,** for example because the lag doubles
   it at a step change, fix the coupling with a same-step or implicit solution.
   Don't keep the lagged correction.
3. **If it matches the ideal model,** investigate contact and integrated-pose
   behavior under the original Sarrus, world and transport guards. Preserve
   their assertions. Do not infer a physical measurement from the simulation or
   replace a source correction with a looser clearance tolerance.
4. Add `ci:full` once and compare the 13 promoted models' verdicts with main's.
   On main all of them pass: air-budget, carry-ratio, cross-ratio, foldback,
   ghost-pivot, quartermaster, samebeat, sine-shuttle, thirdline, toggle-lever,
   travel-dial, twin-tempo and watt-line, plus any promoted since. If any
   verdict changes, investigate before merging.
5. After merging, close #1494. Re-run Afterturn and promote it only if it
   passes honestly. Its recorded figures (a 4.66° cycle; the supplier's 4.6625°)
   were measured with the old code. (Done 2026-11-03: about 1.25° under the
   native rotor, judged by `afterturn-shape-cycle-v1`, promoted.)

Lane file: `lanes/2026-10-28-rotor-inertia-relative-1494.md`.

## 4. Resting-frame creep (#1435): history, fixed by #1577

Both stages of the diagnosis are merged:
- #1472: the baseline, its reader `scripts/verify-sim-resting-creep.mjs`, and
  the table in `docs/ROBOT-LAB-RESTING-CREEP.md`.
- #1498: the contact stage, with the reader
  `scripts/verify-sim-resting-creep-contact.mjs`.

The audited official #1498 log (reader verdict: PASS for data integrity) gives
these results:

| Case | Drift in 1.75 s |
|---|---|
| Coplanar Orrery, all colliders | 6.99 mm, 3.21°; lowest collider 0.84 mm *below* the floor |
| Coplanar, rails only / floor supports only | 0 |
| Coplanar without the two `post_mid_low` parts (their bottoms sit 1.6 mm above the floor), or with them raised 0.5 mm | 0 |
| Coplanar, manifold reduction off | 0.0015 mm |
| Raised Orrery with the hover parts up 0.5 mm (so they sit in the band) | 9.37 mm, −5.10° |
| Flat plate with a cube hovering 1.2 / 1.6 / 1.9 / 2.1 mm above the floor | 0 / 1.73 / 2.75 / 0 mm |
| Flat plate, cube at 1.6 mm, manifold reduction off | 0 |

**Bounded finding.** In the retained cases that creep, an in-band hovering
collider and contact-manifold reduction are part of the demonstrated trigger.
The speculative distance is `LEGO_SPECULATIVE_CONTACT_M = 0.002`. Removing the
hovering collider, moving these cases out of the band or disabling reduction
removes their observed creep. The 1.2 mm plate control did not creep: this is
not a claim that every collider anywhere inside the band necessarily drifts.

**Next action.** Refresh live ownership of the correction before creating a
new fix: the merged diagnostics do not imply that the implementation is still
unclaimed. Preserve and coordinate any active successor; the diagnostic lanes
did not authorize solver changes. Candidate approaches include:
- (a) disable reduction through a verified supported policy. A body's
  `mUseManifoldReduction` / `SetUseManifoldReduction` applies to that body's
  contacts generally; it is not a ground-pair-only switch. A narrower policy
  needs its own verified native/API path, not an assumed contact-listener hook;
- (b) reduce the speculative distance.

Investigate (a) first; (b) moves the band rather than resolving the demonstrated
mechanism. Keep the broader effect of a body-level flag explicit. Requirements:
- a regression test from the #1498 cases that fails before the fix and passes
  after: coplanar all-colliders and plate-hover 1.6/1.9 mm drift go to about 0;
- no change to currently qualified models' verdicts under affected full qualification;
- the existing floor-contact tests, `docs/ROBOT-LAB-FLOOR-CONTACT.md`, still pass;
- no engine-pin change.

Keep #1435 open until the fix is merged. Lane files:
`lanes/2026-10-27-robot-resting-creep-1435.md` and
`lanes/2026-10-27-robot-resting-creep-1435-contact.md`.

## 5. Not in this handoff's scope

These belong to their own owners: #1440, #1318, #1128, #1499 (new experimental
models), #1517 and #1518. Issue #1460 (motor orientation) blocks Obliquity Orrery
and is not owned here.
