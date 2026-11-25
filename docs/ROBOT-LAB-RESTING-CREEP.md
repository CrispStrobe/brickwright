# Resting-frame creep: successor handoff

Status 2026-10-30: mechanism found and fixed in the core; see [Fix](#fix-2026-10-30).

Snapshot: 2026-10-27. The floor correction is complete; resting-frame creep is
open. This document is sufficient to resume the diagnostic lane, together with
[the repository protocol](../lanes/PROTOCOL.md) and
[the merged scope](../lanes/2026-10-27-robot-resting-creep-1435.md).
Refresh remote state before acting: this is a dated handoff, not a claim that
another owner or newer model cannot have landed.

## Completed work

- [Floor #1436 / PR #1445](https://github.com/CrispStrobe/brickwright/pull/1445)
  merged as `7b4f2f84ac55e238bbb75663acbdc1e26f3d0358`. Its finite contact
  acceptance and retained limits are in [the floor contract](ROBOT-LAB-FLOOR-CONTACT.md).
  No floor reimplementation or repeat acquisition is needed to resume this lane.
- [Diagnostic claim #1463](https://github.com/CrispStrobe/brickwright/pull/1463)
  merged as `d719999331dc6eae2ca929ae18f113a7e50b7e94` after four successful
  enabled checks and twelve declared conditional skips. This is a claim-only
  merge, not engine qualification.
- Source-only compilation identified the reported frame and two ordinary
  control models. Six local lane-protocol controls passed. No Jolt engine was
  initialized, no physics step ran, and no resting-frame implementation,
  official artifact acquisition or solver correction occurred.

## Open problem and frozen starting point

[Issue #1435](https://github.com/CrispStrobe/brickwright/issues/1435)
reports an unpowered rigid frame on four coplanar flat beams translating about
10 mm and yawing about 3 degrees in 1.75 seconds, with small vertical motion
and rocking. Raising one rail by 1 LDU suppresses the reported drift. Small-part
removal changes the symptom unreliably and is not a sound bisection strategy.
The issue's original stripped model and named census of sixteen standing
controls were not supplied. Do not invent either or claim exact recovery.

The known starting point is Main `7b4f2f84ac55e238bbb75663acbdc1e26f3d0358`:

| Input | Exact identity or source observation |
| --- | --- |
| Model | `overlay/scratch-gui/static/sim-lab/models/obliquity-orrery.ldr` |
| Model SHA-256 | `3d5b09ddf62e4912c4b68eb337e4f7e2170d72eb8bc296f8e963adfb57f41e86` |
| Catalogue | `overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json` |
| Catalogue SHA-256 | `dbde6c29d4ca0b5aff97bc75676bc12c723a447d0a5daecd124b4b7b6799dba9` |
| Core SHA-256 | `d793b51541af6a1a6ecccc61548670999bc378d2fb427456cf1fc6e19107cf58` |
| Engine | `jolt-physics` `1.1.0-bw.7`; URL and integrity are declared in `scripts/integrate.mjs` |
| Compiler preparation | `prepareModel(model, catalog, {mat: 'plain'})` |
| Complete mechanism | Four dynamic bodies and four joints |
| Rigid frame | Body `b2`, 0.20642000000000005 kg, 38 parts, 51 colliders, including all four `base_rail_*` supports |
| Shipped mitigation | `base_rail_0` y is `199.0`; the other rails have y `200` |

Use part membership to identify the frame; do not rely on body ordinal alone.
The same preparation uses the helper's existing plain-mat convention.
Sleeping is disabled by default in the existing core; position/velocity solver
iterations have explicit experiment options. These are hypotheses to investigate,
not demonstrated causes or authorized product-setting changes.

## Pending work, in order

1. **Refresh ownership and inputs.** Fetch Main; read the protocol, this claim,
   issue #1435 and open claims. Record continuation in the existing diagnostic
   claim after confirming no successor is active. Reconcile changes from
   [PR #1455](https://github.com/CrispStrobe/brickwright/pull/1455), which
   changes the shipped Orrery model. Preserve the exact historical input above
   as a test fixture and bind any newer input separately; do not silently relabel
   the repaired model as the reported reproduction. Keep the shipped mitigation.
2. **Implement deterministic diagnostic inputs.** Keep a complete frozen model
   and an exact test-only variant changing only the one rail coordinate from
   `199.0` to `200`. Record byte hashes and prove all other source bytes agree.
   For each variant, create a separately named isolated-frame mechanism retaining
   the compiled ground and frame bodies exactly, including mass, collider
   transforms and COM inputs. Remove all other bodies, joints, actuators,
   couplings, devices, hubs and their collision-filter relations explicitly.
   Validate the resulting graph and enumerate removed identities. This is an
   explicit mechanism extraction, not the reporter's unavailable stripped file.
3. **Implement passive recording and pure controls.** Use 200 Hz, 350 steps
   (1.75 s), including the initial pose and every completed step. There is no
   hidden settling interval. Record native position/quaternion, linear/angular
   velocity, core time, initial effective mass/COM/inertia and input/SDK/core
   identities. Copy binding-owned native values immediately; never destroy
   returned `[Value]` temporaries. Do not send motor commands, move poses,
   smooth transforms, alter material/geometry or change runtime defaults.
   Keep contact counts separate from unobserved manifold points or normals.
4. **Build the independent reader before observation.** From retained rows,
   recompute final and maximum horizontal displacement; unwrapped world-Y yaw;
   vertical range; and relative up-axis tilt. Validate finite values, normalized
   quaternions, sign invariance, exact step census and clocks. Require synthetic
   negative controls for missing/duplicate/out-of-order rows, bad quaternions,
   changed summaries and incomplete cases. Reader code must not import the
   producer or start the engine. A diagnostic pass proves data integrity only.
5. **Qualify the baseline on hosted CI.** Observe complete/isolated and
   raised/coplanar variants without changing assertions between runs. Add two
   explicitly selected ordinary shipped standing inputs, `driving-base.ldr`
   and `gearbox.ldr`; their source-only preparations had zero issues and four
   and eight dynamic bodies respectively. Freeze their identities and justify
   their unpowered saved poses before running. These two are not the unknown
   sixteen-model census. Admit metadata, acquire each official original once,
   and audit it with the standalone reader. Record absence of reproduction
   honestly. Approximate reported drift is comparison data, not an invented
   solver-pass tolerance. Do not rerun an unchanged failed or successful original.
6. **Choose a correction only after diagnosis.** Compare the baseline variants
   and separate contact manifold, solver/slop, mass/COM and sleeping hypotheses.
   A source-backed diagnosis and requirement-derived acceptance bounds precede
   any candidate. Merge a coordinated claim extension before changing core,
   settings, SDK/fork or pins: none is owned by this diagnostic claim. A proposed
   fix must preserve motion, the eight floor cases, original Sarrus judges,
   ordinary regressions and native/core rollback. Finish all enabled exact-head
   checks before normal matched-head merge and verify parents and landed tree.

## Successor progress (2026-10-27)

Steps 2–4 are implemented: frozen inputs and the one-coordinate coplanar
variant under `test/fixtures/resting-creep-1435/`, explicit isolated-frame
extraction, passive 200 Hz × 350-step recording in
`test/bw-sim-resting-creep.test.mjs`, and the standalone reader
`scripts/verify-sim-resting-creep.mjs` with synthetic negative controls.
Step 5's observations are the actual-engine test's retained `CREEP1435_RESULT`
diagnostics in the hosted unit shard; their results are recorded here only after
the official log is acquired once and audited with the reader.

### Step 5 audited observations

Source: the hosted unit (3/6) job of the Build run on head `23855bf1`, acquired
once. The standalone reader reports `PASS (data integrity only)` for all six
cases. The table covers the 1.75 s passive run (350 steps at 200 Hz). Values are
the subject body's final horizontal displacement, final unwrapped yaw, maximum
tilt and vertical range. Contact means rows with subject–ground contact, out of
351.

| Case | Horizontal | Yaw | Max tilt | Vertical range | Contact |
|---|---|---|---|---|---|
| orrery-raised-complete | 0.023 mm | 0.025° | 0.192° | 0.319 mm | 350 |
| orrery-raised-isolated | 0.023 mm | 0.027° | 0.199° | 0.324 mm | 350 |
| orrery-coplanar-complete | 8.407 mm | 4.005° | 0.811° | 0.520 mm | 350 |
| orrery-coplanar-isolated | 6.993 mm | 3.206° | 0.615° | 0.338 mm | 350 |
| driving-base-complete | 0.009 mm | 0.000° | 0.049° | 0.027 mm | 0 |
| gearbox-complete | 0.009 mm | 0.000° | 0.026° | 0.008 mm | 350 |

What these observations show, and no more:

- The reported creep (about 10 mm and 3° in 1.75 s) reproduces at the same
  order only in the coplanar variant. That variant changes one rail coordinate
  from 199.0 to 200 LDU. The raised input stays below 0.03 mm and 0.03°.
- The coplanar creep persists with every joint, gear, actuator and other body
  removed (the isolated frame), so it does not need the mechanism. Removing them
  reduces it somewhat: 8.4 mm/4.0° complete against 7.0 mm/3.2° isolated.
- The driving-base subject is its heaviest body, which does not touch the
  ground (0 contact rows). That case is therefore no floor-contact control.
- None of this identifies a solver cause or qualifies a fix. Comparing with the
  reported figures is informational, not a tolerance.

### Contact stage (#1498) and next step

The contact-stage diagnostics (#1498, merged) located the mechanism. The creep
occurs when a collider hovers within the 2 mm speculative contact distance
(`LEGO_SPECULATIVE_CONTACT_M`) above the floor while contact-manifold reduction
is on. In the Orrery, those colliders are the two `post_mid_low` parts, 1.6 mm up.
Removing them, lifting them out of the band, or turning manifold reduction off
removes the drift. A synthetic plate with a cube hovering 1.6–1.9 mm above the
floor reproduces the drift; at 1.2 mm and 2.1 mm it does not.

The full table and the scoped fix task are in
[the qualification handoff](ROBOT-LAB-QUALIFICATION-HANDOFF-20261028.md#4-resting-frame-creep-1435-cause-located).
A solver or setting fix needs its own claim; issue #1435 stays open until it lands.

## Fix (2026-10-30)

### Mechanism

Jolt's contact manifold reduction merges every floor hit of a compound body
that shares the floor normal into one manifold. When that manifold has more
than four points, `PruneContactPoints` (Jolt
`Physics/Collision/ManifoldBetweenTwoFaces.cpp`) keeps four. It ranks each
point by its distance from the centre of mass times its squared point
separation `(p2 - p1).LengthSq()`, clamped below at 1 mm². The separation has
no sign. A speculative point 1.6 mm above the floor therefore ranks 2.56 times
higher than a touching or slightly penetrating one.

A collider hovering inside the 2 mm speculative band (`LEGO_SPECULATIVE_CONTACT_M`)
takes one of the four slots, though it carries no load. A real support corner
drops out. The logged first step of the synthetic plate with its 1.6 mm cube
kept three rail corners and the hover point. The support triangle missed the
centre of mass, so the plate tipped towards the dropped corner. It sank
0.64 mm on that side, and the rank of each point changed with each step's
penetration, so the chosen points changed from step to step. The friction
anchors went with them, and the frame crept. The Orrery's two `post_mid_low`
parts are such hover colliders. Raising `base_rail_0` by 1 LDU worked only by
changing which points won.

### Fix

`jolt-core.js` installs a contact listener whenever the mechanism has the
static `ground` body and a dynamic body with two or more colliders. A single
convex collider gives at most a 4-point face, so its floor manifold is never
pruned. For a hit between such a compound and the ground, `OnContactValidate`
returns `RejectContact` only when all of the following hold:

- the hit is separated by more than the penetration slop (0.2 mm);
- its point's closing speed along the contact normal cannot close the gap in
  this step, with a factor 2 margin: `gap > 2 · v_closing · dt + slop`.

The closing speed is the point velocity `v + ω × r`, less the gravity Jolt
has already added for this step. A resting body's supports cancel that
gravity, and a body in free fall keeps its earlier speed.

A hit that the rule drops would not have pushed in this step unless another
constraint sped its point up within the step. A speculative constraint has zero
impulse unless the gap closes. The only effect of dropping
it is that the four pruned points are touching points again. Every touching
hit, every hit that can close, every other body pair and every single-collider
body take Jolt's unchanged path. No engine setting, fork or pin changes.
`experiments.floorSpeculativeFilter: false` restores the previous behaviour
for A/B runs.

Alternatives measured and not taken:

- Manifold reduction off moved 22 of 162 models, and is per body, not per
  floor pair.
- A smaller speculative distance moves the band without removing the
  ranking.
- The contact cache and the solver and sleep settings either moved unrelated
  models or did not stop the creep (issue #1435 table).

Fixing `PruneContactPoints` itself, so that separated points rank below
touching ones, would be the engine-level fix. It needs a fork release and the
owner's approval, and is not done here.

### Measurements

`test/bw-sim-resting-creep-fix.test.mjs` covers these cases over 350 steps at
200 Hz, comparing the old path (filter off) with the fix:

| Case | Old path | Fix |
|---|---|---|
| Coplanar Orrery, complete mechanism | 8.41 mm, 4.01°, tilt 0.81° | 0 mm, 0°, 0° |
| Coplanar Orrery, isolated frame | 6.99 mm, 3.21°, tilt 0.61° | 0 mm, 0°, 0° |
| Raised Orrery, hover parts up 0.5 mm | 9.37 mm, 5.10°, tilt 1.23° | 0 mm, 0°, 0° |
| Plate with hover cube at 1.6 mm | 1.73 mm, 0.02°, tilt 0.56° | 0 mm, 0°, 0° |
| Plate with hover cube at 1.9 mm | 2.75 mm, 0.05°, tilt 1.09° | 0 mm, 0°, 0° |
| Four coplanar beams alone, 3 s | 0 | 0 |

A plate dropped from 30 mm lands the same way on both paths.

The at-rest sweep compared every shipped model with main, unpowered, at
200 Hz for 2 s: 191 entries, the qualified `MODELS` plus
`EXPERIMENTAL_MODELS`, unique by id and mat.

- **172 models are bit-identical.** The rule never fires on them.
- **9 models** have dropped hits and change by at most 0.0205°.
- **All 72 models that are at rest on main are unchanged.** At rest means
  every body moves 0.05 mm or 0.05° or less.
- **10 models change by more than 0.05.** All ten already move on main.
  - **The creep is gone in six.** sarrus-lift goes from 12.07 mm to 0.004 mm;
    screw-crane from 4.83 mm to 0.14 mm; obliquity-orrery-turned-axis from
    4.00 mm to 0.015 mm; paritydial from 0.54 mm to 0.048 mm; forklift from
    0.85° to 0.09°. In snapgate, the 165-collider frame goes from 0.157 mm to
    0 mm.
  - **Freely swinging parts take a different path in three.** In tilt-lab,
    pulse-percussion and axis-plotter, the frames and resting bodies agree
    within 0.01 mm. A free lever, hammer or carriage that is already swinging
    or sliding on main ends at a different angle, by up to 21°.
  - **sarrus-lift-single-chain collapses on both paths.** This is the #1436
    scenario. Its 209-collider frame moves 0.9 mm instead of 8.8 mm.

The full table is in
[ROBOT-LAB-RESTING-CREEP-SWEEP.md](ROBOT-LAB-RESTING-CREEP-SWEEP.md).
A driven variant, with every actuator at 3 rad/s for 2 s (not the models' own
programs), is bit-identical for 165 entries. The rule fires in 26. The large
differences there are in mechanisms that already travel or tumble on main:
tipline, vector-delta and the two Sarrus models. The rule is therefore not
limited to resting frames. It applies to any compound with an idle hover
point. `bw-sim-qualification` (80/80) and the Robot Lab example gates for the
affected models pass.

Total CPU for the sweep is 22.37 s on main and 22.48 s with the fix (+0.5 %,
within the noise on a shared machine).

## Owned paths and adjacent work

Only the new `test/bw-sim-resting-creep.test.mjs`, fixtures under
`test/fixtures/resting-creep-1435/`,
`scripts/verify-sim-resting-creep.mjs`, this document and the diagnostic claim
are owned. The only GUI dependency declaration allowed is appending that exact
new test to the existing `jolt-physics/wasm-compat` consumer list in
`scripts/lib/gui-scope-allowed.json`, preserving all other entries.
An existing actual-test entry point or workflow edit needs a scope extension.
Use isolated worktrees; source/pure controls may run locally, actual engine and
browser qualification belongs on hosted CI in the owned repositories.

[Measurement PR #1437](https://github.com/CrispStrobe/brickwright/pull/1437)
and model PR #1455 have separate owners. Refresh their status; do not take over
their session, worker, model, catalogue, qualification harness or Circuit verifier
paths. Subsequent Circuit publication failures on other heads do not erase the
finite accepted floor-head result or establish a floor regression. Their owners
retain diagnosis and original intake; do not duplicate those runs or downloads.

The next deliverable is a reproducible baseline report with independently
checked raw observations, not a solver fix. Issue #1435 remains open. No general
stability, physical-accuracy, hardware, performance, deployment or release
conclusion follows from the completed floor work or this diagnostic preparation.
