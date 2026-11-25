> **Read first, 2026-10-29:** [Current delivery continuation and fully scoped open tasks](DELIVERY-CONTINUATION-2026-10-29.md). This supersedes dated next-action sections below. Five-model promotion is blocked by zero browser dispatch despite a green receipt; do not mark the kit from that receipt. The motor compatibility decision is already made.

# Robot Lab: fresh-agent handoff

For the current experimental checkpoint and explicit unchecked work, start with [the 24 October checkpoint](ROBOT-LAB-CHECKPOINT-2026-10-24.md).

## Read first: status and open work, 2026-10-28

This section supersedes older "in flight" notes below where they disagree. Check every PR's live state before you act on it.

**Where things stand**
- **The library grew:**
  - **#1446** promoted Toggle Lever and Thirdline.
  - **#1455** promoted six models: Cross Ratio, Foldback, Ghost Pivot, Travel Dial, Carry Ratio and Air Budget. It also added High Select's four rest-stop bushes and the qualification harness extensions.
  - **#1508**, if merged, promotes High Select and Final Squeeze; see O1.
- **Experimental intake:**
  - #1499 added RimRun, SwayShift, Tipline, TwistSpan and Evenhand, ten entries with their comparison scenes.
  - For RimRun, SwayShift, Tipline and TwistSpan, each package's own runner was re-run on main, with tracks byte-identical to the supplied recordings.
  - All ten entries complete in Chrome on the live GitHub Pages site.
  - Evidence for every entry is in `docs/data/robot-lab-experimental-checkpoint.json`.
- **See new models on Vercel.** Open https://brickwright.vercel.app/ and check `/brickwright-version.json` against main. See O3 for deployment timing.
- **`ci:full` policy changed (owner, 2026-10-27).** No `ci:full` label on PRs at all, overriding the rule further down: merge on the fast tier and fix forward from main's full run.
  - Removing the label doesn't change a run that's already queued, because the scope comes from the event payload.
  - To swap a queued full run for a fast one, close and reopen the PR.

**Open work**

**O1. Merge #1508 (High Select and Final Squeeze promotion) and watch main.**
- `--mode=full` qualification, limited to the two models, passed all 11 steps.
- When its fast tier is green (`build`, `unit (1/6)`…`unit (6/6)`; ignore `full CI requested`), merge normally with `gh pr merge 1508 --merge`.
- Then watch main's Build for the merge commit. If it goes red, read the failing job's assertion text and fix forward in a new PR.
- Known weakness, recorded in the PR: High Select's disconnection control misses the max(a,b) law by only 3.7 mm. The bridge still rests on the higher carriage, so no part removal fully breaks "follows the maximum".

**O2. Decide #1460 (motor orientation; owner decision first).**
- The compiler merges collinear hinge candidates and takes axis and body order from `group[0]` in `mech/joints.js`. A bearing hinge can therefore decide a motor's drive direction.
- Branch `fix/motor-orientation-axis-1460` (6fcdffe99) uses the motor member as the lead. It breaks 23 behavioural tests, because those programs then drive the wrong way:

  | Test file | Failures with the fix |
  |---|---|
  | `bw-sim-seven-machines` | 2 (mean-machine, stepworks) |
  | `six-technic-intakes` | 8 (atlas-six, dune-strider, oblique, vernier-drive) |
  | `phase-bridge` | 4 |
  | `physics-addons` | 2 (ripple-relay) |
  | `sarrus-lift` | 1 |
  | `wavemaker` | 4 |
  | `new-models` | 1 (gimbal-lab) |

  Main passes them all. The full table is in the #1460 comments.
- Options:
  - (a) land the fix together with updated programs and expectations for every affected model;
  - (b) add a compatibility path that keeps the old behaviour for existing models and applies the fix to new or flagged ones.
- Ask the owner which. Obliquity Orrery's promotion stays blocked until then: #1497 records it "BLOCKED by #1460".

**O3. Vercel production lag, proposal #1507 (workflow owner's review).**
- `deploy-daily.yml` publishes only main's tip, and only if that exact commit is fully validated and main doesn't move during the build. With main Builds queuing for hours, it publishes nothing: on 2026-10-28 production served `5cd027707` from 2026-10-26, 356 commits behind.
- #1507 publishes the newest validated first-parent main commit instead. It keeps the guard against an older tree overwriting a newer one, as an ancestry check against the live commit.
- Do not merge without the owner's approval. After it merges, confirm that `/brickwright-version.json` reaches a recent validated main commit within a day.

**O4. Next promotion candidates (one batch PR).**
- **Ready:** Tipline, TwistSpan and SwayShift each passed their package's full native qualification on main, so they are the next candidates. For each:
  - write a judge in `scripts/lib/` that rejects a frozen output and a 1 cm world shift;
  - add a contract in `docs/data/robot-lab-qualification.json`, a source fixture with `provenance.json`, and a disconnection branch in `test/bw-sim-qualification.test.mjs` that asserts the law is lost;
  - register the model everywhere `MODELS` is enumerated;
  - run `node scripts/qualify-robot-lab-models.mjs --mode=full`.
- **Worked examples:** commits `f94ebec21` (#1508), `d58d8b92b` and `6b8501171`.
- **Model notes:**
  - SwayShift: the comparison is a second program on the same model (entry id `swayshift-in-phase`).
  - TwistSpan: the control is `twistspan-inner`.
  - Tipline: the control is `tipline-swapped`.
- **Evenhand** needs a torque judge. Its law is visible only in motor holding torque (`session.core.jointDynamics(id).motorTorqueNm`), not in poses, because the engine's motors hold any load:
  - balanced, all nine poses: shoulder 0.33–0.36 mN·m, elbow < 0.01 mN·m;
  - control: elbow 0.61·cos(A+B) mN·m.
- **RimRun** is not ready: its hub stands free beside the ramp, so `prepareModel(...).issues` reports `loose-part` for the frame and promotion requires `issues: []`. First mount the hub to the frame with real pins or plates. Re-run its package's construction and rolling checks, which still pass on main. Its post-finish catch and watchdog-hold gates fail by its author's own declaration and need a design change too.

**O5. #1477 closed after verification, 2026-10-28.**
- #1486 fixed the scope-capture re-render. The five most recent completed main Builds after that fix succeeded; their three selected `browser (light)` jobs passed, and the other two did not select that shard. Newer queued runs were not counted as passing evidence.
- The [issue closeout](https://github.com/CrispStrobe/brickwright/issues/1477) links all five runs. Preserve the assertion trace and run link if `ADC_POINT_MODE_PUBLICATION` recurs.

**O6. #1435 (coplanar flat-beam frame creeps on the floor).** Diagnostics PR #1498 merged; this does not establish that the engine defect is fixed. Preserve the owning lane and re-qualify affected models only after its engine fix lands.


Updated 2026-10-28. This is the public entry point for continuing Robot Lab work (the
`lib/bw-sim/` simulator, the virtual hubs, the Robot Lab tab) without chat history.
It records what landed, how work lands here, what is in flight and — scoped so a new
agent can pick it up cold — every open item. Verify the state of a PR or branch before
acting on it: this page is a snapshot, not a lock.

Related: [SIM-LAB.md](SIM-LAB.md) (what the Lab is and how it works),
[ROBOT-LAB-ARCHITECTURE.md](ROBOT-LAB-ARCHITECTURE.md) (mechanisms, couplings, the
T-series machines), [ROBOT-LAB-VALIDATION.md](ROBOT-LAB-VALIDATION.md) (physics validation
rows), [ROBOT-LAB-HUB-COVERAGE.md](ROBOT-LAB-HUB-COVERAGE.md) (which hub works over which
transport), [ROBOT-LAB-EV3-NXT.md](ROBOT-LAB-EV3-NXT.md), [NXT-PROTOCOL-FACTS.md](NXT-PROTOCOL-FACTS.md),
[NXT-RXE-VM.md](NXT-RXE-VM.md), [EV3-RBF-VM.md](EV3-RBF-VM.md),
[LWP3-VIRTUAL-HUB-NOTES.md](LWP3-VIRTUAL-HUB-NOTES.md), [ROBOT-LAB-LDD-FRAMES.md](ROBOT-LAB-LDD-FRAMES.md).

## What landed 2026-10-19 … 21

- **Hubs:** NXT protocol corrected against LEGO's BDK appendices and the 1.29 firmware
  (#1111); clean-room NXT `.rxe` VM with file download and STARTPROGRAM (#1115); NXT words
  for legonxt (#1129); NXT motor sync, buttons, ultrasonic listening (#1130); EV3 `.rbf` VM,
  `Scratch.fetch` in the CrispStrobe adapter (legonxt/ev3comprehensive compile blocks),
  Powered Up stop actions and hub names (#1127); legonxt reply offsets re-vendored (#1113);
  virtual transports for EV3, ev3dev, LWP3 bridge, NXT and SPIKE bridge (#1161).
- **Physics (Jolt fork releases bw.3 → bw.5):** universal joint, rolling resistance,
  restitution (#1126); CCD-bounce fix in the fork, restitution per material pair, static
  rolling resistance (parked wheels hold), tread rolling resistance (#1134);
  chassis-relative rack and pinion `RackMeshConstraint` (#1149); end stops through gears,
  chains, bands, racks and shift forks that stall speed **and** power drives, pneumatics,
  big-model speed-ups, the native part-pair collision filter (bw.5), real-model import
  (#1137).
- **Machines and examples:** chains, treads, rubber bands (#1116, #1123); crane (#1135);
  differential car (#1142) with a real steering rack (#1155) and its stall test (#1160).
- **Later on 2026-10-21:** extension menu arguments stored in their declared shape, old projects repaired on load (#1163, generated `extension-menu-table.js` via `scripts/gen-extension-menu-args.mjs`); old motors and the LeoCAD/LDD importers (#1151, squash-merged); real-model stability and four example fixes (#1169).
- **CI:** browser shards run only for the paths a PR touches (#1121); two flaky light gates
  fixed (#1159); AshFactory test seeded (#1146).

## How work lands here (rules that cost time when ignored)

- **Batch.** One PR per batch of related work; push checkpoints to the branch without a PR.
  The CI queue runs only a few jobs at once and a full Build is about 15 jobs.
- **`ci:full` only when the browser tier can catch something:** startup bundle / P17
  (anything that might load at first paint), Robot Lab UI / editor / tablet, CI workflows
  or gate scripts, dependency bumps (Jolt). Everything else merges on the fast tier
  (`build` + the `unit (n/6)` shards). The `full CI requested` check fails on unlabelled
  code PRs by design — ignore it. `main` runs the full set on every merge: watch it and fix
  forward at once if it goes red.
- **A rerun keeps its original merge SHA.** After `main` moves, merge `origin/main` into
  the branch (never rebase or force-push a shared branch); a rerun will not pick the fix up.
- **A conflicting PR gets no CI run at all.** Check `mergeable` before waiting on CI.
  Lane claims are one file each under `lanes/` (see `lanes/PROTOCOL.md`) precisely so
  PRs stop conflicting on `LANES.md`.
- **New models go into four lists:** `MODELS` in `lib/bw-sim/sim-session.js`, the model
  list in `test/bw-sim-models.test.mjs`, and the model names in
  `lib/robotLabDialect.js` and the robotlab extension (`overlay/scratch-vm/.../robotlab/index.js`);
  models with derived parts also go into `NEEDS_REST` in `test/bw-sim-lazy-catalog.test.mjs`.
- **New physics tests go into `scripts/lib/gui-scope-allowed.json`** (a CI-only check).
- **Run unit tests with the repo loader:** `node --test --import ./scripts/lib/register-gui-scope.mjs <files>`.
  Plain `node --test` cannot find `jolt-physics`: physics tests fail in milliseconds and the
  worker test hangs. After switching branches run `node scripts/worktree-deps.mjs link`
  (integrates, links the content-keyed deps store, applies overlays, verifies). MakeCode /
  Arcade tests also need `npm run sync:makecode`; without it they fail with `NO_RUNTIME` —
  that is a local setup error, not a regression (it misled a bisect once).
- **P17 first-load budget** (`scripts/lib/webpack-ownership.mjs`): about 0.5 KB headroom.
  New UI goes behind `React.lazy`, `lazyBuiltinExtensions` or the `bw-sim-lab` chunk, with a
  LAZY entry in `scripts/verify-boot-payload.mjs` and its fixture line.
- **Vendored code moves upstream first.** Extensions come from CrispStrobe/extensions via
  `scripts/spike/bundled-upstream.mjs` (`UPSTREAM_COMMIT`, then
  `node scripts/spike/vendor-bundles.mjs`); `sb3-creator.js` / `sb3-creator-spike3.js` must
  stay byte-identical to the CrispStrobe/sb3-creator pin — Lite-side compiler fixes go in
  `sb3-creator-register-art.js`. Jolt changes go into the fork (documented in its
  `BRICKWRIGHT.md`), released by its own workflow, then pinned here; nothing goes upstream to
  Jolt.
- **Licences and data:** third-party sources (LEGO firmware, NBC, nxt-python, lms2012, …)
  are fact sources only — cite, never copy. Never commit LEGO PDFs, LDD data, `ldraw.xml`
  or per-part numbers derived from it (frames come from geometry rules or connections; see
  ROBOT-LAB-LDD-FRAMES.md). A PR whose history once held such data, or a machine path, is
  **squash-merged** and its branch deleted.
- **Shared machine:** stop processes by your own PID or your own worktree path, never by a
  broad pattern (`pkill -f webpack` matches other sessions' builds). Keep build output and
  `TMPDIR` on the large data volume; delete them when done.

## In flight at handoff

Refreshed 2026-10-28. Robot Lab has no open PRs of its own.

| PR | What | State and next step |
|---|---|---|
| #1128 | Arcade numeric integration (other lane) | Draft, owned by the Arcade lane. Its fixes (for example `game.runtime()` as an SDK Number source) land on that lane's integration branch first. Do not take it over. |

#1138, #1099 and #1100 have merged; #1125 was closed.

## Open work, scoped for a fresh agent

Each package is one PR unless it says otherwise. Read the linked docs first; follow the
rules above. Put a claim file in `lanes/` in the same PR. For a code change, run the
affected tests locally only when the host is idle. Otherwise let CI's change-scope job pick
the browser shards. Merge with `--match-head-commit` only after every enabled check passes.

### P1 and P2 — done
- **P1:** the motor power blocks landed with #1162 (after #1163).
- **P2:** CrispStrobe/extensions #68 fixed micro:bit+ `set pin pull` (it read `MODE`, the block
  declares `PULL`) and NXT `raw value of sensor` (it read the normalized word at 10–11; the raw
  ADC word is at 8–9, which touch-pressed `raw < 500` assumes). Both are vendored here with
  `test/extension-p2-pin-fixes.test.mjs`. The legonxt bridge items were fixed earlier (#58, #59).
  The SPIKE 3 Python writer's `A+B` report was **not reproduced**: transpiling a stored project
  whose port menu holds `A+B` emits one command per port, and the superseded BLE extension has
  only single-port menus. Reopen with a concrete project if it recurs.

### P3 — NXT and EV3 gaps
- NXT (ROBOT-LAB-EV3-NXT.md, NXT-PROTOCOL-FACTS.md "still unverified"): ultrasonic value with
  no echo (we use 255), echoes 1–7, the interval default, whether off mode keeps the last
  reading; firmware timing after SETINPUTMODE and for I²C transactions (we complete at
  once). These remain documented as unverified there, with the reason.
- Settled: the reply to an unknown system command. Firmware 1.29 returns status 0x02 with
  the opcode and stale bytes (NXT-PROTOCOL-FACTS.md §Disagreements, #1489); the Virtual NXT
  deliberately keeps 0xBE.
- NXT `.rxe` VM (NXT-RXE-VM.md): FLATTEN/UNFLATTEN and standard virtual-file calls
  (0–8, 47) are implemented. A bounded IOMapRead/Write candidate adds shared Button
  counter/held reads and exact three-counter zero writes; hosted qualification
  remains pending. Other modules and arbitrary writes remain unsupported; see
  NXT-RXE-VM.md for the exact subset. Bluetooth, colour sensor, datalog and
  pictures remain refused by name. File calls share bounded virtual flash, with
  explicit binary extents and program-owned cleanup; physical flash layout and an
  active-image loader handle are not modeled. Open
  questions to settle on real hardware or from the firmware: NXC `Float` leaves BRAKE set
  (does the brick coast?); 2-D array element assignment is a no-op in our reading of 1.29.
- EV3 `.rbf` VM (EV3-RBF-VM.md): COM_*, MAILBOX_*, other FILE subcommands, PROBE, DO,
  breakpoints, SYSTEM, PORT_CNV, NOTE_TO_FREQ, MEMORY_READ/WRITE, INPUT_SAMPLE, FILENAME, TST
  are refused by name; the instruction rate (200/ms) is an estimate; lmsasm gives
  ARRAY16/32/F one byte per element (assembler bug — fixtures use ARRAY8/DATAS).
- Powered Up: the Technic Hub (0x80) and SPIKE Essential (0x83) system-type IDs come from
  community sources (LEGO's LWP3 document does not list them).
- **Acceptance:** each item either implemented with a test against a cited fact, or
  documented as unverified with the reason. Fixtures come from the owner's hosted compilers
  (NBC for NXC → `.rxe`, lmsasm for `.rbf`, NQC for `.rcx`) compiled once and committed;
  tests never call the network.

### P4 — physics follow-ups

**P4a. A tracked frame coasts about 4.4× longer than its real parts would.**
- *Cause (read from code, not yet measured):*
  - `physics/jolt-core.js` gives every gear and sprocket body a floor of
    `GEAR_MIN_INERTIA = 3e-5` kg·m² (:978, reason at :964–977) and `GEAR_MIN_MASS_KG = 0.02`
    (:991, applied at :993–1012).
  - Chain and tread sprockets get both floors at :1138.
  - At the tread's outer radius (r ≈ 25 mm, `test/bw-sim-chain.test.mjs` :265), the inertia
    floor equals about 48 g of extra linear inertia per sprocket. A real sprocket adds about
    0.2 g.
  - `physics/rolling.js` sizes the coasting drag (c_rr·N·r) from the true weight.
  - So the floored sprockets store spin energy that the drag was never sized to remove.
- *The existing check does not catch it:* `test/bw-sim-chain.test.mjs:251–299` predicts the
  deceleration from the floored values (:259, :290–293), so it proves the solver agrees with
  itself, not with the real parts. ROBOT-LAB-VALIDATION.md :280–281 quotes the 4.4×; no test
  asserts it.
- *Step 1, measure first:* on an idle host or in hosted CI, record the tread bench's coast
  deceleration under three floors at :1138: the current value, 1e-5 and 3e-6. Also compute
  the true-parts prediction c_rr·g·M / (M + ΣI_true/r²).
- *Step 2, the fix, in order of preference:*
  1. **Coast-only drag correction in `rolling.js`.** Scale the coasting friction torque by
     k = (M_solver + I_solver/r²) / (M + I_true/r²). Jolt-core already records the
     configured mass and baseline inertia (:660–663).
     - Apply k only above a small |ω| threshold, and keep the static hold at plain c_rr.
       Otherwise the 0.5° and 3° slope-hold rows break.
  2. **Lower or remove the floor for chain sprockets only.** The floor was measured for a 24T
     arm against a block, never for a tread. Watch for tread slip and sprocket rocking when
     the motor stalls.
  3. **Merge the sprocket's spin inertia into its motor rotor.** This is the largest change: it
     touches the compiler's islands, jolt-core and `bodyDynamics` (:2066).
- *Do not* use Jolt angular damping. It is viscous (proportional to speed), not Coulomb, and
  distorts the curve that validation row 25 checks.
- *Acceptance:*
  - `bw-sim-chain.test.mjs` predicts from the true parts and passes.
  - Row 25 and the "Rolling resistance" rows (cart 0.1376 m/s²; the 180 g cart parks on 0.5°
    and 3° slopes) still pass.
  - The hosted Robot Lab shards for the tracked and excavator models pass.
  - ROBOT-LAB-VALIDATION.md :280 is updated with the new measured ratio.

**P4b. The differential car turns 4.9 % wider than the bicycle model.**
- *Cause:*
  - `scripts/gen-differential-car-model.mjs` (it writes
    `static/sim-lab/models/differential-car.ldr`) puts the 5L tie rods in line with the rack,
    level with the steering-arm pins (rack at z = ZT = −40, end holes at x = ±120; arm pins at
    x = ±40).
  - The rack moves both inner pivots together, so the linkage is close to parallel steer. At
    the program's rack position the wheels steer 19.6° inner and 18.6° outer; exact Ackermann
    for that inner angle is 16.8°.
  - The run test (`test/bw-sim-differential-car.test.mjs` :402–421) therefore accepts any
    radius between the two front wheels' own turn centres. The static test at :218–240 checks
    only "short of Ackermann, better than straight arms".
  - ROBOT-LAB-ARCHITECTURE.md :1927–1932 has the measured numbers.
- *Measured from the geometry (planar linkage solve; it reproduces today's angles):*
  - Moving the rack 20–25 LDU **forward** (toward the kingpins) cuts the wheels' turn-centre
    spread from 5.7 % to 0.6–0.7 %.
  - Moving the rack backward, or using straight arms, makes it worse (7–8 %).
  - **But that layout is not buildable with stock parts.** Every improving offset needs a
    tie-rod span between pin holes of 80.6–89.4 LDU, and Technic liftarms span multiples of
    20 LDU. The only exact fit, a 6L rod with the rack 60 forward, overshoots to 10 %.
    Do not place a rod whose pins miss their holes.
- *What remains is a part-level redesign. Options:*
  1. Use the arm's hole x2 (40 in), which gives 4.6 %. The tie rod's inner end then swings into
     motor A's front face at z = −30, so motor A moves back 20–40 LDU. That also moves the
     differential's pinion mesh and the rear-axle geometry tests.
  2. Use a different steering-arm part whose pin offset makes a whole-stud tie rod meet the
     rack at the improving angle. Search the parts library for liftarms with the right
     hole pattern.
  3. Use a rack with different end-hole positions.
- *Acceptance:*
  - Regenerate the `.ldr` with the generator (never hand-edit it).
  - `test/bw-sim-differential-car.test.mjs` passes in full. Its static test hard-codes
    L = 240 and w = 120, and `worst(h3)` must follow a changed hole.
  - `test/bw-sim-models-solid.test.mjs` and `test/bw-sim-models.test.mjs` pass (no overlaps;
    every pin in a hole).
  - The hosted Robot Lab shards that run the example program pass: steady circle, steering at
    speed, parked no-turn, rack stops.
  - Then tighten the run test's band back toward the bicycle model and update the
    ARCHITECTURE numbers.

**P4c. Other physics items (unchanged, not started):**
- Measure, or source better, restitution and rolling resistance for LEGO parts on the mat
  (ABS e 0.4 and tyre/tread c_rr are cited estimates; ROBOT-LAB-VALIDATION.md "Materials").
  This needs real measurements or a citable source; do not tune the values to make tests pass.
- A dropped brick bounces straight once, but Jolt gives the flat multi-contact bounce
  0.1–0.3 rad/s of spin, so it lands tilted after the second bounce. Validation row 7c was
  reformulated to "first bounce straight, no tunnelling". A fix belongs in the contact
  settings or the Jolt fork and needs the drop rows re-run.
- The crane winch continuation replaces the fixed hook link with a retained drum on C,
  a moving boom-tip guide and balanced rope-hung payload. Before it lands it needs the
  affected hosted hoist/hold/payout/slack qualification and a real project save/reopen;
  virtual tension checks do not establish physical accuracy.
- The Jolt fork's next step is the multithreaded build (the native part-pair filter in bw.5
  removed the JS callback that blocked it).

### P5 — CI flakes

Done (2026-10-28):
- **Controller-pane layout gate** (browser light), #1502. `scripts/verify-controller-pane.mjs`
  now waits for fonts and for every control's rectangle to stay unchanged for ten consecutive
  frames (bounded at 15 s; not settling fails the gate) before the normal and the full-screen
  reads. The assertions are unchanged.
- **`verify:debug-inspection`** ("1 debugger browser check failed"), #1504.
  - Exactly one failure means a Playwright wait threw. A failing `check()` reports two,
    because it also fails the journey.
  - The run-to step polled for the brief `running` phase, which the 9-byte ROM can skip
    between two polls. A MutationObserver armed before the click now latches it, and the gate
    still requires that running happened.
  - The run-to control's enabled state and the selected inspection's panes are now awaited
    before they are judged.
  - The cause was read from the code; no failing CI log was found to confirm it.
- **Browser step audit failing when GitHub reports steps late**: already fixed on main on
  2026-10-24 (`4d121180`). The audit runs with `--runner-terminals-v1` and reads earlier step
  outcomes from the workflow's `steps` context, not the jobs API. A later failure reading
  "one unique declared ID per preceding step" (`scripts/audit-job-steps.mjs:320`) is a
  workflow edit in which a step before the audit lacks a unique `id:`. It fails every time;
  fix the workflow, do not rerun.

Open (the Arcade lane owns these, and docs/ARCADE-888-OPEN-FAILURES.md records them):
- `verify-arcade-legacy-layout.mjs` `runEdited` 30 s timeout, and
  `verify-arcade-physics-engine-browser.mjs:99` (`oldX` 22 vs 20, a frame race). Fix each by
  waiting on the state the assertion needs, not by retrying or raising the timeout.
- Load-sensitive Arcade unit tests failed together on main once, then passed on a rerun:
  value-arithmetic (`makecode-arcade-value-arithmetic.test.mjs` :54 and :144),
  `makecode-export-arcade.test.mjs` :275 and :360, and randint authoring. In each the PXT
  program never started within the 20 s guard. Look for several PXT runtimes booting at once
  in that unit shard. Do not raise the timeouts again.

When a gate fails without a related change, compare it with the same check on main's own
Build at the PR's merge base. If main passed with the identical UI, re-run only the failed
job once, keep the original log, and record the flake here.

### P6 — not code
- TI service-pack PR on CrispStrobe/extensions waits for git.ti.com; its bytes are licensed
  for TI devices only and never go into a public repository.
- A machine-path file was briefly committed on a PR branch that has since been
  squash-merged and deleted; GitHub keeps PR commits, so removing it completely needs a
  GitHub Support request (owner's decision).
