# Technic Sim Lab — implementation plan

Status: **S1 done** (§0). Created 2026-09-02.
Owner of record: unclaimed — claim individual tasks in `LANES.md` per its protocol.

A simulation lab for LEGO® Technic: build a model from parts in the
browser, attach the hubs/motors/sensors we already have extensions for (SPIKE
Prime, Boost, Powered Up, WeDo 2.0, EV3), press the green flag, and watch the
program drive the simulated machine — motors spin gear trains, driving bases
drive on a mat, the color sensor reads the line it is actually over.

Everything shipped is BSD-3/MIT/Apache-2.0/zlib code plus CC-BY-2.0 part
geometry (content, attribution-only — same treatment as a font). No GPL, no NC,
no "check with legal" licenses. See §7 for the full ledger.

---

## 0. Status and revisions — 2026-10-16

Status: **S1 done** (branch `lane/simlab-20261016`; see `LANES.md`, "Sim Lab S1").
This section overrides the sections below where they disagree.

In Robot Lab, **Run** on the starter driving base loads its bundled program
when Code and Blocks are empty. If the workspace already contains code and
there is no program for the selected motorized model, Run offers the
matching example or opens the example gallery. Loading a matching example
into an existing workspace is an explicit action.

**S1 as built.**
- `bw-sim/contracts.js`: PartMeta / PlacedModel / CompiledMechanism, frames,
  units, the signed gear-ratio convention, validators. Extensions over the
  plan: `ball`/`ballsocket` connectors and a `ball` joint (the SPIKE castor
  ball is its own rolling body), `motor.outputColliders` (the drive hub's
  shapes), optional part `friction`.
- B1, changed: the curated LDraw subset is **vendored unmodified** under
  `static/ldraw/` with a per-file lock (hash, release, author, licence line),
  not fetched at build time: `complete.zip` lives at one mutable URL, so a
  hash pin would break at every LDraw release. `npm run sync:ldraw:check`
  verifies it offline. Packing for the browser is a build step for M2.
- B3a + B3b: `part-meta/parts.json`, 34 parts (SPIKE hub, both angular
  motors, the three sensors, wheel, castor, beams, axles, pins, bushes,
  8/16/24/40T spur and 12/20T bevel gears), each connector checked against
  the mesh by `test/bw-sim-part-meta.test.mjs` (`ldraw/ldraw-geometry.js`).
- D1-D4: `bw-sim/mech/` compiler; C8 data half: `bw-sim/model/ldraw-model.js`.
- D5 core: `bw-sim/physics/jolt-core.js` (in the worker since 2026-10-17: "§4.9" below). Jolt
  contact tolerances are set for millimetre parts: the defaults (2 cm) made
  the driving base drive 15 % slower than its wheels.
- A6 (S1 form): `bw-sim/hub-bridge.js` - the unchanged virtual SPIKE hub
  drives the real-parts driving base (`test/bw-sim-s1-driving-base.test.mjs`).

**Next:** the physics worker (D5), packing and rendering the vendored parts in
the arena three.js view (C2), then the M2 editor (C3-C7).

**What landed since the plan was written (2026-09-02).**
- Lane A for SPIKE is largely done, by other lanes: `virtual-hub/` ships the
  Web Bluetooth shim, the SPIKE peripheral, `spike-hub-state.js` and the
  dashboard panel. **A4 is superseded**: the Sim Lab drives the existing
  `VirtualSpikeHubState` (docs/SPIKE-ARENA.md, "The hub contract") instead of
  a new `HubState`. A2 (LWP3: Boost/Powered Up/WeDo) remains open.
- The SPIKE arena (docs/SPIKE-ARENA.md) ships a 2D world, simulated sensors, a
  checker, units, and a lazily loaded three.js 3D view. `three` 0.186.1 is a
  GUI dependency, so **C1's dependency step and the three.js half of F2 are
  done**.

**One clock.** The arena contract says motors advance only inside
`hubState.stepMotors(dt)`, owned by whoever runs the world. In the Sim Lab
the physics core is that owner: motor targets flow from the hub state into
the hinge motors, and joint angles flow back as encoder positions. The hub's
own kinematic motor model is not stepped while a physics scene runs.

**Order changed: S1, a vertical slice, comes first.** M2's editor is the
largest UX job; the riskiest *technical* path is compile → physics → hub. S1
proves that path headless, before any editor exists:
1. `bw-sim/contracts.js` — the PartMeta / PlacedModel / CompiledMechanism
   contracts and validators (the D5 "engine-agnostic seam", made concrete).
2. D5 core — `bw-sim/physics/` runs a CompiledMechanism in Jolt under
   `node --test` (worker wrapper later).
3. D1–D4 — `bw-sim/mech/` compiles a PlacedModel + PartMeta catalog to a
   CompiledMechanism (connection graph, islands, hinges, inferred gears).
4. B1 + B3a — the pinned, curated LDraw subset and hand-authored metadata for
   the ~10 parts of a driving base.
5. A6 (S1 form) — a hand-written driving-base fixture driven by the existing
   virtual SPIKE hub: `start motor A` turns the simulated wheel and the
   encoder reads it back.
Then M2 (editor) as planned, rendering through the arena's three.js stack.

**Verified 2026-10-16.** `jolt-physics` 1.1.0 (MIT) in Node: a velocity-
motorised hinge driving an 8T gear into a 24T via `GearConstraint` holds the
angle ratio at −0.3333 after 2 s simulated and tracks its 555°/s target.

**License ledger corrections (§7).** The LDraw parts library is **not**
uniformly CC-BY-2.0: parts are CC BY 4.0, dual CC BY 2.0 / 4.0, or (older,
unreachable authors) CC BY 2.0 only (`CAreadme.txt`; Contributor Agreement
rev. 2024-06-06, which also allows CC0). All are attribution-only and
compatible. Obligations for our curated, packed subset: credit "The LDraw
Parts Library" (accepted by LDraw.org in place of per-author lists), state
that the files were modified (packed), link the licence(s), ship
`CAreadme.txt`, and keep every part's `!LICENSE` and `Author` header lines
(or record them in the manifest). Official library parts only — unofficial
parts are excluded. Trademark: "LEGO®" appears only as an adjective, never in
a product name or logo, with the standard not-endorsed disclaimer; no
official instructions, box art or catalogue images. Rapier (fallback) is
Apache-2.0: ship its licence and NOTICE if it is ever adopted.

### §4.9 The physics worker — 2026-10-17 (ROADMAP §4.9)

*Since Robot Lab slice R1 (`docs/ROBOT-LAB-ARCHITECTURE.md` §6.5, "R1 as built")* the protocol
below is generic over hubs: the worker entry and the protocol are `bw-sim/physics-worker.js` and
`bw-sim/sim-worker-protocol.js` (out of `physics/`), a batch carries `hubs: {id: exportState()}`
of each `VirtualHub` (SPIKE's adapter exports exactly the controller state listed in step 1),
and a frame is `{t, hubs: {id: {drives, readings, pose}}}`, replayed through the hub's
`advanceTo`/`readDrives`/`writeReadings`. The SPIKE numbers are unchanged to the bit.

**Where the physics runs.** In the app, in a Web Worker (`physics/physics-worker.js`, its own
chunk `bw-sim-physics-worker`; Jolt in chunk `bw-sim-jolt`, which the main thread fetches only
when it has no worker). In node, without `Worker`, or when the worker cannot load the scene
(no WebAssembly in workers), on the main thread as before; `session.workerError` says why.
`session.worker` says which; the browser gate asserts `true`.

**What stays on the main thread.** The hub state and its motor controller
(`VirtualSpikeHubState` and the independent backend): the VM reads and writes them
synchronously, and a run-for-degrees promise or a wait must finish there.

**Why not "send motor targets, get poses back".** Within one 5 ms step the controller and
the hinge are a closed loop: the controller's velocity drives the hinge, the hinge's measured
angle is the next step's encoder (run-to-position, holds). Splitting that across the message
boundary adds a step of latency to every encoder reading, and sensors would read a different
step's pose than the encoders. So the loop runs where the physics is.

**Protocol** (`physics/sim-worker-protocol.js`; one batch = the steps one `tick()` makes due):

1. main → worker: `{scene, steps, hub: exportMotorState(hub)}` — everything the controller
   reads when it steps (per-port controllers minus their promise resolvers, motor data, port
   devices, simulated ms, clock owner).
2. worker: `core.checkpoint()` (Jolt `SaveState` + the core's own unwrapped angles and motor
   commands + the bridge's heading/IMU memory), import the state into a **mirror** hub, run the
   unchanged `SimHubBridge.step()` N times — controller, hinge targets, physics step, encoders,
   heading, IMU, sensor rays — and record each step's **frame** (what that step writes into the hub).
3. worker → main: the frames and every body's pose / joint state after the last step (Float64).
4. main: if the controller state is still the one sent, **replay**: per frame, the real
   controller steps once (`stepMotors(5)`; its waits and promises finish on that step), then
   `applyFrame` writes the frame exactly as the in-thread bridge does; then one `changed()`.
   Each frame carries the velocity the mirror commanded; the replay checks the real controller
   commanded the same (`stats.diverged`, always 0).
5. If the controller state changed while the batch was in flight (the VM set a motor, the drive
   pad, Pause): re-send with `redo: true` — the worker `rollback()`s to the checkpoint and runs the
   batch with the new state. In-thread a tick is atomic, so that command reached the controller
   before the tick; the redone batch is exactly that. A command that changes nothing the
   controller reads (the same speed again) is not a conflict.

**One clock — the world's.** The hub's simulated time, `session.time`, the encoders, the sensors and the poses
all advance together when a batch is applied; nothing the VM can see moves while a batch is in
flight. The cost is one round trip between a tick and its result. A batch is at most
`MAX_BATCH_STEPS` (20 = 100 ms); when the worker cannot keep up, the rest is dropped
(`stats.droppedMs`), as the pane's 50 ms frame clamp drops it on the main thread.

**One clock — the program's too (2026-10-18, `bw-sim/sim-clock.js`).** Dropping time kept the
world consistent with itself but not with the PROGRAM: the Scratch VM and the spikeprime
extension ran on wall time (`wait 5 seconds`, `timer`, `move for 2 seconds`, the extension's
`setTimeout`/`Date.now` waits, its send rate limiter), so on a machine whose physics ran below
real time a timed block ended early in simulated time and the same program drove a shorter
distance on a slow Chromebook than on a fast Mac. Measured in the browser gate with the worker
slowed (`--worker-latency`, every message to the worker delayed): before, `wait 5` + `start
moving` + `wait 2` + `stop` lasted 1.30 s of simulated time on a loaded Mac with no added
latency, 0.30 s at 600 ms and 0.10 s at 1000 ms; the Sumo program left its ring at every latency
(axle up to 390–405 mm from the centre, the edge is at 385); and the line follower, colour
explorer and forklift ended differently with and without latency (rest poses apart by up to
24 mm, the line follower 2.9 vs 9.1 mm off its line). Now the program's time IS simulated time:

| when | what happens |
|---|---|
| VM step k | runs at program time T: `runtime.currentMSecs = epoch + T` (the clock replaces `updateCurrentMSecs` on the instance, so `wait`, every stack timer and the `timer` reporter read it); its commands reach the hub in the step's promise continuations |
| flush (a macrotask later) | `session.tick(stepMs)`: the step buys exactly its nominal `runtime.currentStepTime` of simulated time |
| applied (`session.idle()`) | program time becomes T + stepMs = `session.time` − its value at install; the extension's timers due by then fire |
| VM step k + 1 | only now: a VM interval tick that came while the world was busy was held back (`stats.heldBack`) and runs as soon as the batch is applied (a macrotask, after the timers' continuations) |

So the VM never runs ahead of the world: if the physics cannot keep up, the whole program slows
down and the pane shows the real-time factor (`{f}× real time` / `{f}× Echtzeit`, below 0.95).
A batch never exceeds one VM step (33 ms), so nothing is dropped any more on this path. The
step counting reuses the SPIKE arena's `VmStepClock` (`spike-arena/arena-clock.js`, which gained
optional `beforeStep`/`afterStep` hooks; the arena passes none and is unchanged), including its
inertness check: if the VM ever steps around the hook, the pane falls back to wall-clock frames
rather than freezing the world.

*The extension's timers.* The CrispStrobe extension adapter (`scratch-vm
extensions/crispstrobe/adapter.js`) runs every bundled extension's source with its own
`setTimeout`, `clearTimeout`, `setInterval`, `clearInterval` and `Date` (only `Date.now`
differs): while `runtime.bwProgramClock` is set (the Robot Lab, running) they schedule on program
time, otherwise they are the browser's. The extension bundle itself stays byte-equal to upstream.
`window.setTimeout` stays wall time on purpose (Bluetooth discovery). On Pause, a new model or
the pane closing, the clock uninstalls and timers still pending move to the wall clock with the
time they had left.

*What is not on it.* The VM's stepping interval itself (wall time: it is the pace a fast
machine keeps), and the virtual hub's transports, which deliver at once
(`spike-prime-peripheral.js` notifies on every `hubState.changed()`, which a batch replay calls
once). The SPIKE firmware route's main-thread scenes keep their own clock: the emulated hub runs
the program and the lockstep runner steps one physics step per exchange
(`routes/renode-lockstep`), so the pane installs no program clock there. The SPIKE arena counts
VM steps for its world but its programs' `wait`s still read wall time (`currentMSecs`), so a
starved VM there still sees a `wait` end early in mission time; this change does not touch it.

**Measured** (`node scripts/verify-sim-lab-browser.mjs --part=examples --worker-latency=N`, headless
Chromium on an Apple Silicon Mac, 2026-10-18), identical at every latency to the printed digit:

| check | 0 ms | 600 ms | 1000 ms |
|---|---|---|---|
| timed drive: simulated span, distance | 2.033 s, 744.4 mm | 2.033 s, 744.4 mm | 2.033 s, 744.4 mm |
| line follower lap, worst offset | 22.6 s, 2.4 mm | 22.6 s, 2.4 mm | 22.6 s, 2.4 mm |
| wall stopper (front from the wall) | 8.6 cm | 8.6 cm | 8.6 cm |
| colour explorer at rest (axle) | (−0.311, −0.282) | (−0.311, −0.282) | (−0.311, −0.282) |
| forklift lift | 39.82 mm | 39.82 mm | 39.82 mm |
| sumo, 20 s: furthest out, axle at 20.033 s | 338.1 mm, (−0.0361, 0.2964) | 338.1 mm, (−0.0361, 0.2964) | 338.1 mm, (−0.0361, 0.2964) |
| real-time factor (timed drive) | ~1 | 0.055 | 0.033 |

The drive's span is 2 s plus one VM frame (33 ms) at every latency: `start moving` reaches the hub
in the step that runs it, and its promise lets the thread start `wait 2` one step later — the VM's
behaviour, the same headless (`test/bw-sim-program-clock.test.mjs`: 1 s + 33 ms). Nothing is
dropped and no batch is redone (commands now arrive between batches). The cost is wall time: one
round trip per VM frame, so a worker 600 ms away runs the program at 0.055× real time, 1000 ms at 0.033×.

The order is the one the headless runs always used (`test/helpers/spike-arena-vm.mjs`: timers,
VM step, world tick, in fake time). `test/bw-sim-program-clock.test.mjs` runs the browser's path
for real — the VM on its own `setInterval`, the adapter's timers, a real worker thread behind a
transport that delays every message by 200 ms — and checks that at every VM step the time the
program reads has advanced exactly as far as `session.time`, that a 1 s drive is 1 s of simulated
time ± one VM frame with and without the delay, the same distance ± 1 %, and that the pane's
previous wall-clock loop fails that judge.

**Determinism.** Jolt's checkpoint → rollback → step with the same commands is bit-identical
(measured), so the worker gives the in-thread numbers to the last bit, not approximately:
`test/bw-sim-physics-worker-session.test.mjs` runs both side by side on a real worker thread
(driving base forward, turning, run-for-degrees; distance and colour sensors on their mats;
encoders of the same step as the mirrored poses; a redone batch; a hub-less model; the line
follower's example program through the real VM, frame for frame).

**Consumers.** `session.core` on the worker is a `MirrorCore`: `snapshot()` (Float32, as the
core's), `bodyPose()` and `jointState()` at full precision, from the last applied batch;
`castRay`/`step`/`setMotor` throw (they run in the worker, inside their step). The 3D view and
the pane use `snapshot()`; sensors.js runs in the worker; instruments that sample "after every
step" use `session.onAdvance(fn)`; headless code that ticks in lockstep awaits `session.idle()`.

**Measured** (`node --import ./scripts/lib/register-gui-scope.mjs scripts/bench-sim-lab-worker.mjs`,
node worker_threads, 10 s simulated at 60 fps, lockstep; Apple Silicon Mac, 2026-10-17, with other
jobs running, so ±30 %):

| model | main thread, physics here | main thread, physics in worker | work in the worker | round trip |
|---|---|---|---|---|
| S1 driving base (16 parts, 5 bodies) | 12.1 ms / sim s | 5.7 ms / sim s | 14.4 ms / sim s | 0.37 ms mean, 3.8 max |
| gear train (144 parts, 42 bodies, 18 gear meshes, 6 motors) | 38.4 ms / sim s | 7.1 ms / sim s | 50.3 ms / sim s | 1.0 ms mean, 8.0 max |

The main thread keeps what does not grow with the model (export, compare, replay, mirror);
the work in the worker is 1.2–1.3× the in-thread physics: the per-batch Jolt checkpoint and the
frame records are the price of exact redo. In the browser gate (headless Chromium, SwiftShader)
the line-follower lap ran 457 batches of ~10 steps: 1.3–1.5 ms per batch in the worker,
0.16 ms per batch on the main thread, round trip 3–5 ms mean (single stalls up to ~1 s when the
page's main thread is busy rendering; simulated time simply waits, nothing is lost).

**A race this exposed (fixed for both modes).** A new session used to leave each sensor port's
reading from the previous model until the first step; with the worker that window is a round
trip, and a stale "nothing ahead" (−1) ended the Wall stopper's `wait until distance < 10` before
the robot moved (seen once in the gate under load, reproduced on purpose). Both the in-thread
bridge and the worker's load now publish the sensors' t = 0 readings when the session is made.


---

## 1. Decisions (made — do not re-litigate in tasks)

### D1. Physics: Jolt Physics (`jolt-physics` npm, MIT)

Why not the alternatives:

- **Rapier** (Apache-2.0): excellent engine, first-class JS bindings, optional
  cross-platform determinism — but **no gear, rack-and-pinion, or worm
  constraints**. We would hand-write per-tick velocity coupling for the single
  most important mechanism class in Technic. Kept as the named fallback if Jolt
  WASM proves too heavy on iOS (see task F5); the worker protocol in D-lane is
  engine-agnostic for exactly this reason.
- **Ammo.js** (zlib): license is fine, and Bullet does have `btGearConstraint`,
  but it is an Emscripten port of Bullet 2.8x that is effectively unmaintained,
  with an awkward hand-bound API and no active upstream. Rejected on
  maintenance, not license.
- **Jolt** (MIT): actively maintained, official WASM/JS binding
  (`jolt-physics`, by the Jolt author), and natively ships **GearConstraint,
  RackAndPinionConstraint, motorized HingeConstraint, SliderConstraint** — the
  Technic drivetrain vocabulary as engine primitives. AAA-proven solver for
  stacked constraint chains (gearboxes).

### D2. Rendering: three.js + its built-in `LDrawLoader` (both MIT)

`three/examples/jsm/loaders/LDrawLoader` parses `.ldr`/`.mpd` and understands
the official parts library, LDConfig colors, and packed part bundles. We do not
adopt react-three-fiber; the sim UI is plain three.js in a lazily-loaded
bundle, same pattern as the labwired engine (`verify:labwired-lazy`).

### D3. Part geometry: official LDraw parts library, curated subset

The LDraw library is CC-BY-2.0 (LDraw Contributor Agreement). We vendor a
**pinned snapshot, curated to the parts we support** (§B2), packed at build
time by a `sync:*`-pattern script with hash verification, and credited in
`THIRD-PARTY-NOTICES.md`. We never ship the whole 15k-part library.

### D4. Connectivity metadata: ours, hand-authored, one source of truth

There is **no permissively-licensed connectivity database**. BrickLink
Studio's is proprietary; LDCad's shadow library has no clear license; do not
copy from either, ever, even "just to check a coordinate". We author our own
JSON (`part-meta`, §B3): connector sockets (pin-hole, axle-hole, axle, pin,
stud), pitch radii for gears, collider primitives, mass. The **same file**
drives editor snapping (C-lane), mechanism compilation (D-lane), and collision
tests — so it cannot drift.

Validation is geometric, not trust-based: every declared connector position is
cross-checked against the LDraw mesh it sits in (a pin-hole connector must be
centered in an actual cylindrical bore of radius ~2.4 LDU… within epsilon).

### D5. The virtual-hub seam: fake Web Bluetooth, real protocol

All BLE LEGO extensions call `navigator.bluetooth.requestDevice(...)`. The repo
already ships one Web Bluetooth implementation over a different backend:
`overlay/scratch-gui/src/lib/native-web-bluetooth.js` (Web Bluetooth over the
in-process Scratch-Link server, for webviews that lack it). The virtual hub is
the same move with an in-memory backend: a `BluetoothDevice`/`GATTServer`/
`Characteristic` object graph whose write/notify endpoints are a **protocol
emulator** instead of a radio. Consequences:

- The 20+ LEGO extensions need **zero changes**. They cannot tell the
  difference, which is the point.
- The emulator's required scope is defined **by the traffic our extensions
  actually send**, enumerated from their source — not by implementing whole
  protocol specs.
- EV3 (Bluetooth Classic, native-app-only today) is out of scope until M4;
  the browser never had an EV3 transport anyway.

### D6. Simulation altitude: mechanisms, not bricks

One rigid body per part with a constraint per stud does not scale and does not
converge. Instead the **mechanism compiler** (D-lane) collapses the model:

1. Everything rigidly connected (studs, pins in beam holes, axles in
   axle-holes) merges into one compound body ("island") with merged colliders
   and summed mass/COM.
2. Joints exist only where relative motion is real: axle-in-*round*-hole →
   hinge; motor output → motorized hinge; linear actuator → slider.
3. Gear meshing is **inferred**: we know each gear's part ID (hence tooth
   count and pitch radius) and transform; two gears on parallel axes at center
   distance ≈ sum of pitch radii mesh → `GearConstraint` with tooth ratio.
   Perpendicular at bevel distance → bevel pair. Worm and rack get special
   cases. No user annotation.

A typical SPIKE driving base compiles to ~5 bodies and ~6 constraints.

### D7. Code placement and format of record

- Sim/editor code: `overlay/scratch-gui/src/lib/bw-sim/` (sibling of
  `bw-board/`, `bw-circuit-ui/`). Kept in-overlay; spin out to a pinned repo
  later only if it stabilizes (the `bw-circuit-ui` path).
- Virtual hub: `overlay/scratch-gui/src/lib/virtual-hub/`.
- The model's format of record is **LDraw MPD text**, stored as a project
  asset inside the `.sb3` (same persistence trick as the circuit designer).
  One format drives rendering, compilation, export; a file we write must
  reopen in BrickLink Studio and LeoCAD unchanged.
- Physics + compilation logic that is pure (no DOM) lives in plain modules
  testable by `node --test` under `test/`.

---

## 2. Architecture at a glance

```
 Scratch blocks (unchanged LEGO extensions)
        │  navigator.bluetooth
        ▼
 virtual-hub/web-bluetooth-shim ──── device chooser offers "Virtual SPIKE Prime" etc.
        │  GATT writes / notifications (real protocol bytes)
        ▼
 virtual-hub/emulators/{spike,lwp3}  ── decode → HubState (motors, ports, LEDs)
        │                                ▲ encode ← sensor values, encoder angles
        ▼                                │
 bw-sim/bridge  ←──────────────────────── (M1: dashboard widgets fake the values)
        │ motor targets            sensor sources
        ▼                                ▲
 bw-sim/physics-worker (Jolt WASM, fixed 120 Hz)   ← compiled mechanism
        ▲                                           (islands, joints, gears)
        │ snapshots (interpolated)        ▲
        ▼                                 │
 bw-sim/viewer (three.js) ← bw-sim/editor (CAD: palette, snap, undo) ← part-meta + LDraw parts
```

Green flag / stop plug into the same start-stop bus the circuit sim uses.

---

## 3. Lanes and tasks

Task granularity is one focused agent session. Every task: claim it in
`LANES.md`, keep `npm run test` green, add license entries for any new
dependency to `THIRD-PARTY-NOTICES.md` **in the same change**, and extend the
relevant verify script rather than writing prose claims. "DoD" = definition of
done; every DoD line must be mechanically checkable unless marked *(manual)*.

### Lane A — Virtual hub (protocol emulation)

**A1. Web Bluetooth virtual backend + device chooser entry.**
Depends: —.
Build `virtual-hub/web-bluetooth-shim.js`: minimal `BluetoothDevice`,
`BluetoothRemoteGATTServer/Service/Characteristic` classes whose I/O calls a
pluggable `VirtualPeripheral` interface (`onWrite(uuid, bytes)`,
`notify(uuid, bytes)`, advertised name + service UUIDs). Install it the way
`native-web-bluetooth.js` installs — but *additively*: when a real
`navigator.bluetooth` exists, wrap `requestDevice` so virtual peripherals
appear alongside real ones via our own chooser UI; when none exists, provide
the whole object. Registry API: `registerVirtualPeripheral(factory)`.
DoD:
- [ ] Unit tests (`test/virtual-hub-shim.test.mjs`, node --test): a fake
      peripheral registered, discovered by filters/namePrefix, connected,
      written to, notification round-trip.
- [ ] With no virtual peripherals registered, behavior is byte-identical to
      before (guard: existing `verify:bluetooth` still passes).
- [ ] JSDoc on the `VirtualPeripheral` interface; A2/A3 build against it only.

**A2. LWP3 emulator (Boost Move Hub, Technic Hub, City Hub, WeDo 2.0).**
Depends: A1.
First deliverable is an **inventory doc** (`docs/generated/virtual-hub-lwp3.md`)
enumerating every message `legoboostunified`, `legopoweredup`, `wedo2unified`
actually send/expect (message type, port, payload), extracted by reading those
extensions. Then implement exactly that subset in
`virtual-hub/emulators/lwp3.js` over a plain `HubState` object: hub attach
I/O messages on connect (motors on configured ports, tilt, color-distance),
port output commands (start speed, goto position, LED), port input format
setup + periodic value notifications, hub properties (battery, name).
DoD:
- [ ] Inventory doc exists and each row is marked implemented/rejected.
- [ ] `test/virtual-hub-lwp3.test.mjs`: byte-level — feed captured command
      frames from the extensions' own encoders, assert `HubState` mutations;
      set `HubState` sensor values, assert emitted notification frames parse
      with the extensions' own decoders.
- [ ] Boost extension connects to "Virtual Boost Hub" in the live GUI and
      `start motor A` mutates `HubState` *(covered by A5's verify script)*.

**A3. SPIKE Prime emulator (BLE, new firmware protocol).**
Depends: A1. Same two-step shape as A2: inventory
(`docs/generated/virtual-hub-spike.md`) from `spikeprimeble` +
`legospikeprimeBLE` sources (framing — COBS/CRC if used, info request,
motor start/stop/position, 3×3/5×5 light matrix, distance/force/color
sensor notifications, IMU/orientation, battery), then
`virtual-hub/emulators/spike.js` implementing that subset over `HubState`.
DoD: mirror of A2's, plus:
- [ ] Framing codec has its own tests with malformed-frame cases (truncated,
      bad checksum) asserting the emulator stays alive and ignores them.

**A4. HubState contract.**
Depends: — (do first or alongside A2/A3; it is small).
`virtual-hub/hub-state.js`: the neutral state object both emulators share and
the sim bridge drives. Ports (device type, mode), motor command sinks
(target speed / target position / stop-brake-hold), sensor value sources
(distance mm, color id + reflected %, force N + pressed, IMU quaternion +
accel, encoder deg), LED/matrix framebuffers, battery. Explicitly an events +
plain-data contract — no physics, no protocol bytes.
DoD:
- [ ] Typedef'd (JSDoc) and unit-tested (subscription semantics, port
      attach/detach events).
- [ ] A2, A3, A5, D6 import it and nothing else crosses lanes.

**A5. Virtual hub dashboard (the M1 deliverable).**
Depends: A1–A4.
A GUI panel (opened from the connect-device modal after picking a virtual
hub): rendered hub with live motor dials (angle/speed from `HubState`), the
light matrix, battery; sensor widgets are **inputs** — distance slider, color
swatches, force slider, tilt control — writing into `HubState`. This is
Tinkercad's "interact with the sim" affordance before any 3D exists, and it
stays useful forever as the debug view.
DoD:
- [ ] `scripts/verify-virtual-hub.mjs` (playwright, added to the verify
      family): loads GUI, connects SPIKE extension to virtual hub, runs a
      motor block → dial moves; sets distance slider → `distance sensor (mm)`
      reporter returns it; same smoke for Boost.
- [ ] Works with zero hardware and zero network *(that is the point)*.
- [ ] German + English strings via the existing i18n pattern.

**A6. Physics bridge.**
Depends: A4, D5, D6. Replaces dashboard-slider sensor sources with physics
sources when a sim scene is running: motor sinks → joint motor targets,
encoder sources → joint angles, IMU → hub body pose, distance/color/force →
E2 sensor queries. Dashboard stays live as a read-only monitor; sliders
disable with a "driven by simulation" hint.
DoD:
- [ ] With the M3 reference model loaded, `start motor A at 50%` spins the
      physical wheel joint and `motor A position` reads back the integrated
      angle (asserted in `verify-sim-physics.mjs`, D7).
- [ ] Stopping the sim returns sensor authority to the dashboard sliders.

### Lane B — Parts pipeline (geometry, metadata, packing)

**B1. `sync:ldraw` vendor script.**
Depends: —.
`scripts/sync-ldraw-parts.mjs` + entry in `vendor-pins.json`: fetch a pinned
LDraw library release (fixed URL + SHA-256), extract **only** the parts listed
in `part-meta/manifest.json` (plus their subfile closure and required
primitives + `LDConfig.ldr`), and pack them with three.js's packing format
into `overlay/scratch-gui/static/ldraw/`. `--check` mode verifies hashes and
closure completeness like the other sync scripts. Update
`THIRD-PARTY-NOTICES.md` with the CC-BY-2.0 attribution block.
DoD:
- [ ] `npm run sync:ldraw` and `npm run sync:ldraw:check` wired in
      package.json and passing.
- [ ] Packed output loads in a bare LDrawLoader smoke test
      (`test/ldraw-pack.test.mjs`, node --test, no browser — parse only).
- [ ] Fetch is pinned (proof added to `prove:pins` corpus) and notices updated.

**B2. Curated part manifest v1 (~45 parts).**
Depends: B1 (format), not B1's execution.
`part-meta/manifest.json`: Technic beams (3/5/7/9/11/13/15, plus 3×5 and
2×4 L-beams), axles (2–12), pins (friction, frictionless, 3L, axle-pin), bush
+ half bush, gears (8T/16T/24T/40T spur, 12T/20T bevel, worm, 28T diff
housing deferred), wheels+tires (SPIKE small + medium), frames (5×7, 5×11),
and the electronic parts: SPIKE Prime hub, S/M/L angular motors,
distance/color/force sensors; Boost hub + external motor + color-distance
sensor; EV3 brick/motors/sensors *listed but flagged `deferred` until M4*.
Each entry: LDraw part number, display name, category, LDraw color default.
DoD:
- [ ] Every manifest part resolves in the pinned library (checked by
      `sync:ldraw:check`).
- [ ] Reviewed against the SPIKE Prime set 45678 inventory: everything needed
      to build the standard driving base is present *(manual, listed in PR)*.

**B3. Connectivity + gear metadata ("part-meta") schema and authoring.**
Depends: B2. The heart of the system — split into B3a (schema + validator +
10 pilot parts) and B3b (the rest), claimable separately.
Schema per part: `connectors[]` (type: `pinhole|axlehole|axle|pin|stud|antistud`,
position, axis, length in LDU), `gear` (toothCount, pitchRadius, type:
spur|bevel|worm|rack), `colliders[]` (box/cylinder/capsule/convex primitives),
`massGrams`. Authored by hand from LDraw geometry — **never** copied from
Studio/LDCad (license, §D4).
The validator (`test/part-meta.test.mjs`) is what makes hand-authoring safe:
for each declared connector it loads the part's LDraw mesh and asserts the
local geometry matches the connector type (cylindrical bore of the right
radius at a `pinhole`, cross-shaped section at an `axlehole`, etc.) within
epsilon; gear pitch radius must equal toothCount·π…/π formula
(r = toothCount/2 · 1 mm in LEGO module = toothCount·1.25 LDU exactly).
DoD:
- [ ] Schema doc in the file header + validator running in `npm run test`.
- [ ] 100% of manifest v1 non-deferred parts have validated metadata.
- [ ] Collider volume vs. LDraw mesh bounding volume sanity check (collider
      must cover ≥60% and ≤110% of mesh AABB volume) passes for all parts.

**B4. Part thumbnails at build time.**
Depends: B1, B2.
`scripts/gen-part-thumbs.mjs`: headless render (playwright screenshot of a
minimal three.js page, consistent with how this repo already drives
playwright) of each manifest part → `static/ldraw/thumbs/{part}.png`,
deterministic camera per category. `--check` compares the manifest against
the thumb set.
DoD:
- [ ] All manifest parts have thumbs; check mode wired into `build:gui`'s
      pre-flight like the other `:check` gates.

### Lane C — Viewer and CAD editor

**C1. Sim tab scaffold + lazy bundle.**
Depends: —.
New top-level tab ("Sim Lab") beside the Circuit Designer, following the
labwired lazy-bundle pattern: the three.js/Jolt chunk loads only when the tab
is first opened. Empty scene: ground grid, orbit/pan/zoom camera
(three `OrbitControls`), lighting, resize handling, light/dark aware.
DoD:
- [ ] `scripts/verify-sim-lazy-bundle.mjs`: main bundle size unchanged beyond
      a small tab stub (mirror `verify:labwired-lazy` assertions).
- [ ] Tab opens, canvas renders, no console errors (playwright smoke in
      `verify-sim-editor.mjs`, started here, grown by C2–C7).

**C2. LDraw model rendering.**
Depends: B1, C1.
Load `.ldr`/`.mpd` from a project asset via `LDrawLoader` against our packed
parts; smooth-shaded, edge lines on, LDConfig colors; per-part
`Object3D` identity retained (selection needs it). Import button accepts a
`.ldr`/`.mpd` file (Studio export) and rejects parts outside the manifest
with the repo's standard "refusals are listed, not dropped" report.
DoD:
- [ ] Reference driving-base `.ldr` (checked into `test/fixtures/`) renders;
      screenshot-based smoke in `verify-sim-editor.mjs`.
- [ ] Import of a model containing an unsupported part shows the refusal
      list and loads the rest.

**C3. Selection, transform, delete, clone.**
Depends: C2.
Raycast pick (click = select, drag = move), highlight, Del deletes, Ctrl+D
clones, Esc cancels, R rotates 90° about the dominant axis of the hovered
connector (see C5), free-ground placement when no snap candidate.
DoD:
- [ ] Playwright: place, select, clone, delete, verified via editor's model
      state (exposed test hook, pattern used by circuit verify scripts).

**C4. Part palette.**
Depends: B4, C1.
Dockable palette with category groups (beams/axles+pins/gears/wheels/
electronics), B4 thumbnails, search, drag-out or click-to-attach.
German+English labels from part-meta display names.
DoD:
- [ ] Every manifest part reachable and placeable from the palette
      (playwright iterates the manifest — no hand-listed subset).

**C5. Connectivity snapping — the CAD core.**
Depends: B3a, C3.
This is how "actual 3D CAD designing" stays LEGO-simple instead of free-form
CAD: parts only ever attach **connector-to-connector**. While dragging,
gather candidate pairs (dragged part's connectors × scene connectors) within
a search radius; score by distance + axis alignment; show the best candidate
as a ghost preview; commit on drop. Rotation about the snapped axis
quantizes to 90° (v1; finer steps later). Type rules from part-meta: pin↔
pinhole, axle↔axlehole (rigid) / axle↔pinhole (free-spinning — recorded,
because D3 turns exactly these into hinges), stud↔antistud. Multi-connector
matching (a 3L pin bridging two beams) resolves as simultaneous pair
satisfaction.
DoD:
- [ ] Pure snap-resolver module with node --test cases: pin into beam hole,
      axle through two aligned holes, gear onto axle, impossible type pairs
      rejected, 90° rotation cycling preserves the snap.
- [ ] Playwright: build pin + two beams into a hinge triangle via drag/drop.

**C6. Overlap rejection.**
Depends: B3 (colliders), C5.
On drop, overlap-test the placed part's colliders against the scene (a few
dozen primitive-primitive tests — no physics engine needed here; reuse the
primitive intersection module D-lane also uses). Colliding placement = red
ghost, refused.
DoD:
- [ ] node --test: two beams through each other refused; the same two beams
      pin-connected side by side accepted.

**C7. Undo/redo + keyboard map.**
Depends: C3, C5.
Command-stack undo (place/move/delete/clone/recolor as inverse-able
commands), Ctrl+Z/Ctrl+Y, plus a color picker restricted to LDConfig solid
colors. Document the keymap in the tab's help popover.
DoD:
- [ ] Playwright: 10-step build, undo all 10 → empty scene, redo all 10 →
      byte-identical LDraw serialization.

**C8. Save/load/export.**
Depends: C2, C5.
Serialize the scene to MPD text (deterministic ordering — stable diffs) as a
project asset in the `.sb3`; load on project open; export/download `.ldr`;
model round-trips through save/load byte-identically. Extend
`verify:project-bundle` to cover the new asset.
DoD:
- [ ] Round-trip test (node --test on the serializer + playwright for the
      .sb3 path).
- [ ] Exported driving base opens in BrickLink Studio and LeoCAD
      *(manual, screenshot in PR)*.
- [ ] `verify:project-bundle` covers a project with a sim model.

### Lane D — Mechanism compiler + physics runtime

**D1. Shared geometry/graph module.**
Depends: B3a.
`bw-sim/mech/`: connection-graph builder from a placed model + part-meta
(nodes = parts, edges = satisfied connector pairs with their type), and the
primitive-collider intersection module C6 reuses. Pure, no DOM.
DoD:
- [ ] node --test: the C5 fixture models produce the expected graphs.

**D2. Island merge.**
Depends: D1.
Partition the graph by rigid edges (pin↔pinhole is rigid in v1 — friction
pins; axle↔axlehole rigid; stud rigid; axle↔pinhole is NOT rigid) into
islands; per island emit a compound collider set, merged mass, COM.
DoD:
- [ ] Driving-base fixture compiles to the documented island list (chassis /
      2 wheels / caster) — golden test.
- [ ] Mass/COM asserted against hand-computed values for a 2-part fixture.

**D3. Joint synthesis.**
Depends: D2.
Non-rigid edges become joints: axle-in-pinhole → hinge (axis = connector
axis); motor part's output connector → **motorized** hinge bound to a
`HubState` port by the motor part's placement; linear actuator (post-v1) →
slider. Encoder zero = pose at sim start.
DoD:
- [ ] Golden test: driving base yields exactly 2 motorized hinges + caster
      joints, axes correct to epsilon.

**D4. Gear inference.**
Depends: D2.
Detect meshing per §D6.3 (pitch-radius sums, parallel/perpendicular axes,
tolerance ±0.5 LDU), emit gear constraints with signed tooth ratios; worm →
worm ratio special case; rack → rack-and-pinion constraint.
DoD:
- [ ] node --test fixtures: 8T→24T parallel (ratio −3), 8T idler 24T chain
      (net +3), 12T↔20T bevel at 90°, worm→24T, non-meshing gears 1 stud too
      far apart produce **no** constraint.

**D5. Physics worker (Jolt).**
Depends: D2–D4 outputs (consumes their compiled description; can start from
the schema before they finish).
`bw-sim/physics-worker.js`: Jolt WASM in a Web Worker; loads a compiled
mechanism (bodies/joints/gear constraints as plain JSON — the
engine-agnostic seam per §D1 decision); fixed 120 Hz stepping; transferable
snapshot buffer (body poses + joint angles/velocities) at ≤60 Hz to the main
thread; command channel for motor targets and scene resets. Main-thread
interpolation between snapshots.
DoD:
- [ ] Node-side harness test (worker logic factored so the stepping core runs
      under node --test with the WASM build): a hinge with motor velocity
      target reaches target ±2% within 0.5 s; a gear-constrained pair holds
      ratio under load ±2%.
- [ ] Deterministic replay: same compiled scene + same command script twice →
      identical final snapshot (documents Jolt's determinism boundary: same
      build, same platform).

**D6. Compile-and-run integration.**
Depends: C8, D3–D5, A6.
"Run" in the Sim tab: serialize → compile → spawn worker → bind `HubState`
ports (A6) → animate three.js scene from snapshots. "Stop" tears down and
restores the edit-time model pose. Compile diagnostics surface in the UI
(unpowered motor, gear meshing ambiguity) in the repo's
refusals-are-listed style.
DoD:
- [ ] `verify-sim-physics.mjs`: load driving-base fixture, connect virtual
      SPIKE, run "start motor A at 50%" for 2 s → chassis body translated
      ≥ threshold; "motor A position" reporter ≈ integrated encoder.

**D7. Determinism/regression harness.**
Depends: D6.
Scripted scenario runner (`scripts/verify-sim-physics.mjs` grows into a small
corpus like `verify:schematic-corpus`): fixtures × command scripts × asserted
end-state tolerances, run headless in CI.
DoD:
- [ ] ≥5 scenarios (drive straight, turn in place, 3:1 gearbox ratio check,
      tower stays standing, tower with silly COM falls) green in CI.

### Lane E — Sensors + world

**E1. Scenes and mats.**
Depends: C1, D5.
Scene = ground plane + optional mat texture + static obstacles, selectable
per project, serialized with the model. Ship 3 mats: plain, line-follow
track, colored-zones — all **drawn by us** (SVG in-repo → rasterized at
build; no scraped FLL assets).
DoD:
- [ ] Mat selection persists through save/load; obstacles participate in
      physics (box collides in a D7 scenario).

**E2. Sensor physics.**
Depends: D5, E1, A6.
Distance: shape-cast from sensor face, mm, cone falloff and max-range
clamp matched to the real sensor's spec. Color: sample mat texture under the
sensor axis (plus obstacle albedo on hit), map to LEGO color IDs + reflected
%. Force: contact force on the plunger face, N + pressed bool. IMU: hub
island's orientation/angular velocity/linear accel (gravity included). All
implemented as worker-side queries surfaced through the A6 bridge.
DoD:
- [ ] Unit tests per sensor against constructed scenes (sensor 100 mm from
      wall reads 100±2 mm; sensor over the line reads black/white correctly
      at 5 sampled poses; upside-down hub reports the right face).
- [ ] Line-follow D7 scenario (E3) actually uses the simulated color sensor.

**E3. The flagship scenario: line follower.**
Depends: D6, E2.
Reference project (fixture `.sb3`): driving base + color sensor + the
classic two-state line follower in blocks, on the line mat. This is the
"Tinkercad moment" demo and the M4 acceptance test.
DoD:
- [ ] Headless run: robot completes one lap (returns near start pose) within
      a time budget, asserted in the D7 corpus.

**E4. Lessons + examples.**
Depends: E3, A5.
Two lessons in the existing lesson infra (EN+DE): "Your first simulated
robot" (virtual hub dashboard → sim, no hardware needed) and "Line follower
in the Sim Lab" (predict-observe structure like existing lessons). Register
example projects in the example selector.
DoD:
- [ ] `verify:starters` / `verify:examples` extended and green; lesson
      review checklist from LESSON-REVIEW waves applied *(manual)*.

### Lane F — Product integration, licensing, performance

**F1. Green flag / stop semantics.**
Depends: D6. Flag starts scripts + circuit sim + (if the project has a sim
model) the physics scene; stop-all halts motors (brake per hub behavior) and
pauses physics. Sim tab also has its own run/pause/reset for building-time
testing.
DoD: covered by an assertion added to `verify-sim-physics.mjs` (flag-started
run) + existing green-flag verify stays green.

**F2. Licensing ledger + gate.**
Depends: first task that adds a dependency (A1/B1/C1) — do early.
Add `three`, `jolt-physics`, LDraw CC-BY-2.0 attribution to
`THIRD-PARTY-NOTICES.md`; extend the license-check gate so a `bw-sim` or
`virtual-hub` import of anything outside the allowlist
(MIT/BSD/Apache-2.0/zlib/MPL-2.0-file-level + the LDraw content exception)
fails the build. Document the §D4 "never copy connectivity data" rule where
part-meta contributors will read it.
DoD:
- [ ] Notices complete; gate demonstrably fails on a planted GPL test dep
      (test proves the gate, then the plant is removed).

**F3. Bundle size + performance budget.**
Depends: C1, D5.
Budgets: sim chunk (three + editor) and physics chunk (Jolt WASM) each
lazy, sizes recorded and gated (numbers fixed when first measured, then
ratcheted); worker step time budget asserted in D7 scenarios (steps/sec ≥
2× real-time for the driving base on CI hardware).
DoD:
- [ ] Size gate in `verify-sim-lazy-bundle.mjs`; step-rate assertion in D7.
- [ ] If Jolt WASM breaks the iOS memory/size reality check (F4), the
      documented fallback decision (Rapier port of the worker) is raised as
      a BLOCKED.md entry — not silently absorbed.

**F4. Tauri/native parity.**
Depends: M2 done.
Verify workers + WASM + OffscreenCanvas behavior in WKWebView/WebView2/
WebKitGTK; the virtual hub must not fight `native-web-bluetooth.js`
(virtual chooser wraps whichever `navigator.bluetooth` is installed —
including ours). iOS device test of the Sim tab.
DoD:
- [ ] Desktop Tauri dev build runs M2 editor + M3 physics *(manual,
      recorded)*; chooser shows both real and virtual hubs on macOS BLE.

**F5. EV3 virtual brick (deferred until M4).**
Depends: A4, A6.
EV3 speaks Bluetooth Classic via the native bridge, so the virtual EV3 hooks
that seam (`native-scratch-link-bridge` / BTC session factory) instead of Web
Bluetooth; emulate the direct-command subset `ev3comprehensive`
send (inventory-first, like A2/A3).
DoD: mirror of A2 with the EV3 extensions; dashboard gains an EV3 brick face.

---

## 4. Milestones

**M1 — "No hardware needed" (Lane A: A1–A5).**
Any LEGO lesson runnable against a virtual SPIKE/Boost hub with dashboard
widgets. *Exit:* `verify:virtual-hub` green in CI; a SPIKE lesson completed
end-to-end with zero hardware (manual walkthrough recorded).

**M2 — "Build it" (B1–B4, C1–C8, F2).**
Build the driving base in-app from the palette with snapping, save into the
project, export `.ldr` that Studio opens. *Exit:* `verify-sim-editor` +
round-trip DoDs green; Studio-open screenshot.

**M3 — "It moves" (D1–D6, A6, E1, F1, F3).**
Green flag drives the built model with real motor/encoder/IMU physics.
*Exit:* `verify-sim-physics` driving scenarios green.

**M4 — "Sim Lab" (E2–E4, D7, F4, F5).**
Line follower completes a lap on the simulated color sensor; lessons ship;
native parity checked; EV3 virtual brick lands. *Exit:* full D7 corpus green,
lessons pass review checklist.

Parallelism: A-lane, B-lane, and C1 are independent starts. The long pole is
B3 (metadata authoring) → C5 → D-lane; put the strongest agent on B3a's
schema+validator early, then B3b parallelizes across agents part-category by
part-category.

## 5. Non-goals (v1) — write refusals, not scope creep

- Flexible parts (string, rubber bands, pneumatics), tracks/treads.
- Stud-heavy System building (plates/bricks beyond what hubs need to mount).
- Differential internals, clutch gears slipping, backlash modeling.
- Multi-hub simultaneous virtual connections (matches the native shim's
  documented single-peripheral stance).
- Sub-models/groups in the editor; angled (non-90°) connections.
- Importing `.io` (Studio's own format — encrypted zip; export via `.ldr`).

Each of these, when hit, gets the repo-standard treatment: a visible refusal
with a count, not silence.

## 6. Risks and their tripwires

| Risk | Tripwire | Response |
|---|---|---|
| Jolt WASM too big/slow on iOS | F3 budget gate | Rapier fallback via the engine-agnostic worker schema; gear coupling done manually |
| Hand-authored part-meta errors | B3 geometric validator | Validator is the contract; a bad part fails CI, not a user's build |
| Gear inference false positives | D4 negative fixtures | Tolerance is a named constant with tests on both sides |
| SPIKE protocol drift across firmware | A3 inventory doc | Emulator scope = our extensions' traffic, re-inventoried when extensions change |
| Two engines of truth (dashboard vs physics) | A6 authority switch | `HubState` is the single bus; sliders disable when physics owns a value |

## 7. License ledger (ship set)

| Component | Use | License |
|---|---|---|
| three.js + LDrawLoader + OrbitControls | render/CAD | MIT |
| jolt-physics (Jolt WASM/JS) | dynamics | MIT |
| LDraw parts library (pinned, curated subset) | part geometry (content) | CC-BY-2.0, attributed |
| part-meta connectivity/collider data | ours | BSD-3-Clause (repo) |
| All `bw-sim/`, `virtual-hub/` code | ours | BSD-3-Clause (repo) |
| Mats/scene art | ours, in-repo SVG | BSD-3-Clause (repo) |

Explicitly excluded and never to be consulted for data: BrickLink Studio
connectivity (proprietary), LDCad shadow library (unclear), GearsBot /
ev3dev / LeoCAD / EV3 firmware sources (GPL). LEGO's published LWP3 docs may
be *read*; emulators are written against our extensions' observed traffic.
