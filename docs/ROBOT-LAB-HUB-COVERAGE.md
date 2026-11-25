# Robot Lab hub coverage matrix (2026-10-23)

Which hub x extension x route x code-flavour combinations the Robot Lab (`bw-sim`) emulates and tests
end to end. The original matrix was built at main `95cc043c9`; the closure tests named below update that baseline, using code and executed tests rather than the plans alone
(`docs/ROBOT-LAB-HUBS-PLAN.md`, `docs/ROBOT-LAB-EV3-NXT.md` were the starting point and were checked).

Abbreviations: `G/` = `overlay/scratch-gui/src/lib/`, `X/` = `overlay/scratch-vm/src/extensions/crispstrobe/`,
WB = Web Bluetooth (lite's shim `G/virtual-hub/web-bluetooth-shim.js`), SL-BLE / SL-BT = Scratch Link BLE /
Bluetooth Classic socket doubles.

## Status

- **GREEN**: a virtual hub/peripheral exists that the REAL vendored extension (or the stock scratch-vm
  extension) talks to unchanged, AND a test drives that extension through the real Scratch VM (or the real
  download hook) and judges the result from the physics, the hub's encoders or the hub's replies.
- **PARTIAL**: the real extension is driven against a virtual hub but not in the Robot Lab physics, or only
  part of the surface is driven, or the route is a fake (e.g. the in-process fake emulator).
- **PENDING #N**: an open PR adds it.
- **GAP**: no end-to-end test. Each gap says whether the virtual hub support is missing, or only the test
  (marked **test-only**).
- **n/a**: the route or flavour does not exist for that hub.

## How the tests load the real extension

- `test/helpers/bw-extensions.mjs`: `bundledExtensionIds()` (id -> vendored dir under `X/`) and
  `loadExtensionClass(dir)`; tests patch `vm.extensionManager.loadExtensionURL` to instantiate it.
- `test/helpers/lab-hubs-vm.mjs`: `runLabHubProgram(source, {modelText, mat, transport: 'ble'|'scratchlink',
  timeLimitMs, stopWhen, onFrame})` for `legopoweredup` / `legoboostunified` / `wedo2unified` (pseudocode
  `pup`/`boost`/`wedo` words -> SB3 -> VM -> extension -> WB or SL-BLE -> `G/virtual-hub/lab-ble-peripherals.js`
  -> `G/bw-sim/hubs/lwp3|wedo2` -> Jolt); `runStockHubExtension('boost'|'wedo2', {modelText, mat, steps,
  firmware})` for scratch-vm's own extensions; `modelText(file)`, `programText(file)` read shipped
  models/programs. Returns `{session, hub, written, received, ...}`.
- `test/helpers/bt-hub-vm.mjs`: `runOnBtHub(program, {modelText, mat, profile: 'ev3'|'nxt', extensionId:
  'ev3'|'ev3comprehensive'|'legonxt', timeLimitMs, stopWhen})` over SL-BT (`connectVirtualHub`,
  `G/virtual-hub/connect-virtual-hub.js`); `projectOfBlocks()` for block JSON programs.
- `test/helpers/sim-lab-vm.mjs` `runOnSimLab(source, {modelText, mat, timeLimitMs})` and
  `test/helpers/spike-arena-vm.mjs` `runOnArena` / `registerVirtualHub` / `loadSpikeProgram` for `spikeprime`.
- All use a fake clock and step the VM at 30 fps with the world ticked by the same frame.

## SPIKE Prime / Robot Inventor

Virtual hub: `G/bw-sim/hubs/spike/spike-virtual-hub.js` + `G/virtual-hub/spike-prime-peripheral.js`,
`spike-hub-state.js`; firmware route `G/bw-sim/routes/renode-lockstep/`.

| Extension | Route | Flavour | Status | Evidence |
|---|---|---|---|---|
| spikeprime | WB | blocks / `DEVICE SPIKE` pseudocode | GREEN | `bw-sim-wall-stopper-program`, `bw-sim-line-follower-program`, `bw-sim-maze-program`, `bw-sim-sumo-program` ... (runOnSimLab); `spike-arena-sim` "the translator: every statement the spikeprime extension sends" |
| spikeprime | WB | SPIKE 3 Python (imported to blocks) | GREEN | `bw-sim-spike3-python-lab` "SPIKE 3 Python, imported to blocks, stops the Wall stopper in the Lab physics because of its reading" (+ a judge-can-fail control) |
| spikeprime | WB | Python/JS `_spikeprime.*` calls | GREEN | `hub-runtime-calls-to-blocks`: the shipped program’s complete hub calls (commands, nested reporters and every argument) survive both Code-tab readers and recompile to the same runtime calls. Registry-driven word lift; unknown methods, arity errors and unsupported menus are refused by name. The corresponding block program’s real-extension Lab evidence is listed above. This covers the default exporter subset, not arbitrary Python/JS. |
| spikeprimeble (direct BLE) | WB | blocks | GREEN | `bw-sim-spike-routes` "(a) a spikeprimeble project (SPIKE 3 direct BLE) migrates to spikeprime and stops the Wall stopper by its reading, in the Lab over Web Bluetooth". Legacy ids migrate to spikeprime on load (`lib/spike-project-migration.js`), and the test checks that only real spikeprimeble opcodes were in the file |
| spikeprimeBTC / spikeprime | SL-BT (RFCOMM double, 2.x firmware) | blocks | GREEN | `bw-sim-spike-routes` "(b) … motor A turns 360 degrees in the physics" and "(b) spikeprime over Scratch Link BT Classic stops the Wall stopper by its reading". The second needed two fixes to the double: the port report now streams on every hub change, and its distance is in whole cm, as a 2.x hub sends it (it was mm read as cm). |
| spikeprime | SL-BLE | blocks | GREEN | `bw-sim-spike-routes` "(c) spikeprime over Scratch Link BLE (the BLE double, SPIKE 3 GATT) stops the Wall stopper by its reading" (+ a judge-can-fail control) |
| spikeprime (absorbed spikeprimeBridge) | bridge (WebSocket relay, 2.x REPL) | `DEVICE SPIKE` pseudocode | GREEN | `bw-sim-spike-bridge` "spikeprime over its WebSocket bridge (firmware 2.x REPL) stops the Wall stopper by its reading" (+ a judge-can-fail control). The real extension's own `connect to bridge at [URL]` (ws://localhost:8081) -> `G/bw-sim/transports/virtual-bridge.js` (text both ways) -> `virtual-spike-stream.js`, which unwraps the same 2.x REPL double Scratch Link BT reaches. Needed CrispStrobe/extensions#58: BridgeLink sent the relay base64 while reading the hub's text as text. Legacy spikeprimeBridge / legospikeprimeBLE projects migrate to spikeprime (`spike-legacy-migration`) |
| Renode firmware (lockstep) | firmware route | blocks / pseudocode compiled for the firmware | GREEN | Required `robot-lab-own-firmware.yml` builds the project’s own NuttX and runs `verify-sim-lab-renode-lockstep.mjs` through the actual Lab compiler/upload/lockstep/Jolt route. Both timed-speed (within 1%) and degrees (within ±2°) comparisons pass against the Scratch route. See the source-bound qualification below. |
| Renode firmware | firmware route | embedded MicroPython in own NuttX | GREEN | Required `verify-sim-lab-python-guest.mjs` runs real Python in the project’s own simulated hub through the Lab route: computation/output plus physical motor motion, retained restart, Stop during sleep, sensor positive/wrong-scene refusal, OSError and distinct-source recovery. Actual coherent acknowledgements, status and output are independently observed within unchanged bounds; no interpreter is substituted. |

## EV3

Virtual hub: `G/bw-sim/hubs/ev3/ev3-virtual-hub.js`, `ev3-peripheral.js`, `ev3-direct-commands.js`.

| Extension | Route | Flavour | Status | Evidence |
|---|---|---|---|---|
| stock `ev3` | SL-BT | blocks | GREEN | `bw-sim-bt-hubs-program` "EV3 wall stopper: the stock Scratch EV3 blocks drive at the wall and stop before it" |
| ev3comprehensive | SL-BT | `DEVICE EV3` pseudocode / blocks | GREEN | `bw-sim-bt-hubs-program` "EV3 wall stopper: the DEVICE EV3 example through ev3comprehensive" (no longer `{todo}`; vendored ev3comprehensive has the `msgCounter`/`readBuffer` fix from upstream PR #53). Byte-level breadth (tank, sensors, sound/screen): `bw-sim-ev3-extension-bytes` |
| ev3comprehensive | upload + run | `.rbf` on-brick | GREEN (#1127) | `bw-sim-ev3-rbf-brick` "Robot Lab: the EV3 wall stopper runs wall-stopper.rbf — drives at the wall, stops before it" (clean-room VM, `routes/ev3-vm/`), plus the CDK download/start/stop system commands in the same file |
| ev3comprehensive | HTTP / `Scratch.fetch` | blocks | GREEN (#1127) | `bw-sim-ev3-rbf-ev3comprehensive` "ev3comprehensive: transpile → Scratch.fetch to the LMS compiler (stubbed) → the .rbf runs on the Virtual EV3". The real extension transpiles and posts. Only the hosted LMS compiler's reply is a recorded fixture, because that service is outside the repo. |
| ev3comprehensive | Web Serial, bridge | `DEVICE EV3` pseudocode | GREEN | `bw-sim-virtual-transports-ev3` "ev3comprehensive over Web Serial (115200 baud) stops the EV3 wall stopper …", "… in auto mode finds an already-authorised virtual serial port first", "… over its WebSocket bridge stops the EV3 wall stopper …" (+ two controls). The real extension connects with its own `set connection mode` / `connect` blocks, with no Scratch Link present; `G/bw-sim/transports/virtual-serial.js` (a `navigator.serial` double) and `virtual-bridge.js` (ws://localhost:8080, binary frames) carry the same EV3 command frames to the Virtual EV3 session |
| ev3dev | HTTP(S) | blocks | GREEN | `bw-sim-virtual-ev3dev` "ev3dev: its blocks drive the EV3 wall stopper at the wall and stop it before the wall by the ultrasonic reading", "ev3dev: motor position reads the brick's encoder", "… with the right credentials …" (+ two controls). The real extension (`scratchtoev3`) is set up by its own `set connection` / `test connection` blocks; its `Scratch.fetch` requests (GET `/`, POST `/` `{cmd,…}`, GET `/motor/…`, `/sensor/…`, `/button/…`, Basic auth) are answered by `G/bw-sim/transports/virtual-ev3dev.js` over `virtual-http.js`, which drives the scene's EV3. Only the requests the extension sends are served; other commands answer `{status: "error"}`. The SSH route is the extension's generated upload script, run outside the browser: n/a |
| ev3comprehensive | any | Python/JS calls | GREEN | `hub-runtime-calls-to-blocks`: the shipped program’s complete hub calls (commands, nested reporters and every argument) survive both Code-tab readers and recompile to the same runtime calls. Registry-driven word lift; unknown methods, arity errors and unsupported menus are refused by name. The corresponding block program’s real-extension Lab evidence is listed above. This covers the default exporter subset, not arbitrary Python/JS. |
| MakeCode EV3 | — | — | n/a | separate MakeCode simulator, not the Lab |

## BOOST Move Hub

Virtual hub: `G/bw-sim/hubs/lwp3/` (profile `boost-move-hub`), peripheral `G/virtual-hub/lab-ble-peripherals.js`.

| Extension | Route | Flavour | Status | Evidence |
|---|---|---|---|---|
| legoboostunified | WB | `boost` words | GREEN | `lab-hubs-extensions` "the shipped BOOST example drives the Move Hub rover ahead ..." (current + legacy firmware) |
| stock `boost` | SL-BLE | blocks | GREEN | `lab-hubs-extensions` "scratch-vm's own BOOST extension finds the Move Hub by its manufacturer data over Scratch Link ..." |
| legoboostunified | SL-BLE | `boost` words | GREEN | `lab-hubs-coverage` "legoboostunified drives the BOOST Move Hub rover ahead over Scratch Link BLE" |
| legopoweredup | WB | `pup` words on the Move Hub | GREEN | `lab-hubs-coverage` "legopoweredup also drives the BOOST Move Hub ..." (SL-BLE is the same extension path, proven on the Technic and City hubs) |
| legoboostunified / legopoweredup | any | Python/JS calls | GREEN | `hub-runtime-calls-to-blocks`: the shipped program’s complete hub calls (commands, nested reporters and every argument) survive both Code-tab readers and recompile to the same runtime calls. Registry-driven word lift; unknown methods, arity errors and unsupported menus are refused by name. The corresponding block program’s real-extension Lab evidence is listed above. This covers the default exporter subset, not arbitrary Python/JS. |
| legoboostunified / legopoweredup | HTTP bridge | `boost` / `pup` words | GREEN | `lab-hubs-bridge` "legoboostunified over its HTTP bridge drives the BOOST Move Hub rover ahead (the shipped example)", "legopoweredup over the bridge also drives the BOOST Move Hub: motor A one full turn". The real extension is set up by its own `set connection type` (bridge) and `set bridge URL` (http://localhost:8080) blocks; its BridgeAdapter's `Scratch.fetch` requests (POST `/scan`, `/connect`, `/write` `{deviceId, characteristic, data}`, GET `/notifications` polled every 100 ms) are answered by `G/bw-sim/transports/virtual-ble-bridge.js` over `virtual-http.js`, which writes to and notifies from the hub's GATT peripheral (`G/virtual-hub/lab-ble-peripherals.js`). No Web Bluetooth or Scratch Link takes part |

## Powered Up City / Technic hubs

Virtual hub: `G/bw-sim/hubs/lwp3/` (profiles `pup-city-hub`, `technic-hub`); protocol tests `lwp3-virtual-hub`.

| Extension | Route | Flavour | Status | Evidence |
|---|---|---|---|---|
| legopoweredup | WB | `pup` words, Technic Hub | GREEN | `lab-hubs-extensions` "legopoweredup turns the Technic large motor on port A by 360 ± 2° (over ble)", "the shipped Technic Hub example ..." |
| legopoweredup | SL-BLE | `pup` words, Technic Hub | GREEN | same test "(over scratchlink)" |
| legopoweredup | WB / SL-BLE | City Hub | GREEN | `lab-hubs-coverage` "legopoweredup turns a motor on the Powered Up City Hub's port A one full turn (over ble / scratchlink)", judged against the same free motor on a Technic Hub |
| legopoweredup | WB | stop actions (brake/coast/hold) | GREEN (#1127) | `lab-hubs-extensions` "legopoweredup \"turn motor A off\" with stop action …: the Technic Hub's motor ends in …" |
| legopoweredup | any | Python/JS `_legopoweredup.*` calls | GREEN | `hub-runtime-calls-to-blocks`: the shipped program’s complete hub calls (commands, nested reporters and every argument) survive both Code-tab readers and recompile to the same runtime calls. Registry-driven word lift; unknown methods, arity errors and unsupported menus are refused by name. The corresponding block program’s real-extension Lab evidence is listed above. This covers the default exporter subset, not arbitrary Python/JS. |
| legopoweredup | HTTP bridge | `pup` words, Technic Hub | GREEN | `lab-hubs-bridge` "legopoweredup over its HTTP bridge turns the Technic Hub's large motor on port A by 360 ± 2°" (+ a 180° control the judge rejects). The real extension is set up by its own `set connection type` (bridge) and `set bridge URL` (http://localhost:8080) blocks; its BridgeAdapter's `Scratch.fetch` requests (POST `/scan`, `/connect`, `/write` `{deviceId, characteristic, data}`, GET `/notifications` polled every 100 ms) are answered by `G/bw-sim/transports/virtual-ble-bridge.js` over `virtual-http.js`, which writes to and notifies from the hub's GATT peripheral (`G/virtual-hub/lab-ble-peripherals.js`). No Web Bluetooth or Scratch Link takes part |

## WeDo 2.0

Virtual hub: `G/bw-sim/hubs/wedo2/` (own GATT protocol), peripheral `G/virtual-hub/lab-ble-peripherals.js`.

| Extension | Route | Flavour | Status | Evidence |
|---|---|---|---|---|
| wedo2unified | WB | `wedo` words | GREEN | `lab-hubs-extensions` "the shipped WeDo 2.0 example runs the motor until the motion sensor sees the wall (over ble)" + judge-can-fail |
| wedo2unified | SL-BLE | `wedo` words | GREEN | same "(over scratchlink)" |
| stock `wedo2` | SL-BLE | blocks | GREEN | `lab-hubs-extensions` "scratch-vm's own WeDo 2.0 extension runs the rover until its distance ..." |
| wedo2unified | WB / SL-BLE | tilt sensor, lights, tones | GREEN | `lab-hubs-wedo-observables`: the real extension discovers the scene’s tilt sensor and its physics reading gates the hub’s red light and 440 Hz/100 ms tone, on both routes; an unreachable threshold fails the same judge. `hubBindings` now preserves sensor protocol IDs (it previously announced tilt as motion). |
| wedo2unified | any | Python/JS calls | GREEN | `hub-runtime-calls-to-blocks`: the shipped program’s complete hub calls (commands, nested reporters and every argument) survive both Code-tab readers and recompile to the same runtime calls. Registry-driven word lift; unknown methods, arity errors and unsupported menus are refused by name. The corresponding block program’s real-extension Lab evidence is listed above. This covers the default exporter subset, not arbitrary Python/JS. |

## SPIKE Essential

Virtual hub: `G/bw-sim/hubs/lwp3/` (profile `spike-essential`).

| Extension | Route | Flavour | Status | Evidence |
|---|---|---|---|---|
| legopoweredup | WB | `pup` words | GREEN | `lab-hubs-coverage`: the real extension turns motor A on the assembled Essential hub `67351c01.dat` one full turn; a half-turn fails the same judge. Assembly/profile already catalogued; `bw-sim-part-meta` checks connectors against the vendored LDraw geometry. |
| legopoweredup | SL-BLE | `pup` words | GREEN | Same Essential tests over Scratch Link BLE, including the wrong-program control. `67351.dat` is the shell; the complete hub is `67351c01.dat`. |
| spikeprime family | any | any | n/a | the Lab models Essential as an LWP3 hub |

## NXT

Virtual hub: `G/bw-sim/hubs/nxt/` (direct + system commands, files); VM `G/bw-sim/routes/nxt-vm/`.

| Extension | Route | Flavour | Status | Evidence |
|---|---|---|---|---|
| legonxt | SL-BT | blocks | GREEN | `bw-sim-bt-hubs-program` "NXT bumper bot: legonxt turns B and C 360 ± 2° ...", "NXT motor reporters ..." |
| legonxt | SL-BT upload | `.rxe` on-brick | GREEN | `bw-sim-nxt-rxe-legonxt` "legonxt uploads touch-bumper.rxe ... stops at the wall" (#1115 merged); `bw-sim-nxt-rxe-brick` |
| legonxt | SL-BT | `nxt` DEVICE words | GREEN (#1129 merged) | `lego-hubs-dialect` proves the words compile to the same real extension blocks that the NXT Lab tests execute. |
| legonxt | SL-BT | motor sync, buttons, ultrasonic listen | GREEN | `lab-nxt-live-surface`: the real pinned extension’s VM blocks synchronize both motors, read held/released buttons and release counts through the closed Button IOMap, and set/read ultrasonic listen mode through the actual scene. Zero-power and reversed-emitter programs fail the same motion/event judges. Direct extension probes also cover long releases, non-clearing counts and wrong-port refusal. Supplier CrispStrobe/extensions#63 is adopted at merge `428d440353120856620dac86a257e8e1b91d7348`; ultrasonic event bytes and the 2000 ms button-duration model remain estimates. |
| legonxt | hosted NXC -> `.rxe` | NXC source | GREEN | `bw-sim-nxt-rxe-legonxt`: the real compile/upload/start blocks post the exact committed `touch-bumper.nxc`, receive its recorded compiler reply, and the Robot Lab bot stops on its bumper; an altered source has no recorded reply, uploads no fixture and never drives. No live compiler is exercised. |
| legonxt | Web Serial ("direct"), bridge | blocks | GREEN | `bw-sim-virtual-transports-nxt` "legonxt over Web Serial (\"direct\", 9600 baud): the bumper bot drives until the bumper meets the wall and stops", "legonxt over its WebSocket bridge (base64 telegrams): …" (+ a no-stop control on both). Connected by its own `set connection mode` / `connect` blocks with no Scratch Link; `G/bw-sim/transports/virtual-serial.js` and `virtual-bridge.js` (ws://localhost:8765, one base64 text message per length-prefixed telegram) -> the Virtual NXT session. Needed CrispStrobe/extensions#58: both backends called methods they do not have, so neither could connect, and the bridge resolved numbers its callers parse as telegrams |

## RCX

Virtual hub: `G/bw-sim/hubs/rcx/rcx-virtual-hub.js`, `rcx-lab-target.js`; VM `G/bw-sim/routes/rcx-vm/`.

| Extension | Route | Flavour | Status | Evidence |
|---|---|---|---|---|
| (NQC tab) | download hook -> "Robot Lab RCX" | NQC on-brick | GREEN | `bw-sim-rcx-hub` "the bumper car (shipped NQC, downloaded to the Lab RCX) ...", "the line follower ..."; `bw-sim-rcx-vm` |
| legorcx | download hook -> "Robot Lab RCX" | blocks | GREEN | `bw-sim-rcx-legorcx` "legorcx blocks, sent with its own \"send to RCX\" block, run in the Lab RCX ..." (real extension transpiles, compiles locally, downloads; judged from drives and motion) |
| legorcx | IR tower (Web Serial) | blocks / NQC | n/a | real-hardware route; Lab target replaces it (`bw-sim-rcx-hub` "downloads go to the tower unless ...") |
| robotlab API | lab-direct | — | n/a | RCX refuses API motor calls by design (`bw-sim-robot-lab-api`) |

## Summary

| Hub | GREEN | PARTIAL | PENDING | GAP |
|---|---|---|---|---|
| SPIKE Prime / Robot Inventor | 9 | 0 | 0 | 0 |
| EV3 | 7 | 0 | 0 | 0 |
| BOOST Move Hub | 6 | 0 | 0 | 0 |
| Powered Up City / Technic | 6 | 0 | 0 | 0 |
| WeDo 2.0 | 5 | 0 | 0 | 0 |
| SPIKE Essential | 2 | 0 | 0 | 0 |
| NXT | 6 | 0 | 0 | 0 |
| RCX | 2 | 0 | 0 | 0 |
| **Total** | **43** | **0** | **0** | **0** |

## Gaps, by user impact

1. ~~SPIKE Prime, spikeprime over SL-BLE~~: closed by `bw-sim-spike-routes`. Was: test-only if the extension's Scratch Link mode uses the BLE double
   (`G/virtual-hub/scratch-link-ble.js`, `connectVirtualHub`); new `test/bw-sim-spike-scratchlink.test.mjs`.
2. ~~SPIKE Prime, spikeprimeble / spikeprimeBTC in the Lab physics~~: closed by `bw-sim-spike-routes`, with two RFCOMM-double fixes. Was: test-only (virtual hub exists, e2e only
   checks hub state); new test running the wall stopper with those ids.
3. ~~SPIKE Prime, SPIKE 3 Python in the Lab~~: closed by `bw-sim-spike3-python-lab`. Was: test-only; `runOnSimLab` on the
   imported program.
4. ~~SPIKE Prime, Python/JS `_spikeprime` calls~~: default-exporter round trips closed by `hub-runtime-calls-to-blocks`; every runtime argument and sensor reporter survives. Unsupported calls are named refusals.
5. ~~SPIKE Prime, real Renode lockstep and embedded MicroPython in own NuttX~~: closed by the required hosted own-firmware route and six Python cases. Standalone/raw-REPL firmware, installed native lifecycle and hardware are separate boundaries.
6. ~~SPIKE Prime, bridge route~~: closed by `bw-sim-spike-bridge` (virtual WebSocket relay + 2.x REPL stream; extension fix CrispStrobe/extensions#58).
7. ~~EV3, Web Serial / bridge~~: closed by `bw-sim-virtual-transports-ev3` (virtual Web Serial port and WebSocket bridge, `G/bw-sim/transports/`).
8. ~~EV3, ev3dev~~: closed by `bw-sim-virtual-ev3dev` (virtual ev3dev brick over HTTP, `G/bw-sim/transports/virtual-ev3dev.js`).
9. ~~EV3, Python/JS calls~~: closed by the same reader tests, including retained `DEVICE EV3` context.
10. ~~BOOST, legoboostunified over SL-BLE~~: closed by `lab-hubs-coverage`.
11. ~~BOOST, legopoweredup on the Move Hub~~: closed by `lab-hubs-coverage`.
12. ~~Powered Up City Hub, legopoweredup~~: closed by `lab-hubs-coverage` (an in-test City Hub bench).
13. ~~BOOST / Powered Up, Python/JS calls~~: closed by both real extensions’ shipped-program round trips. WeDo Python/JS calls are covered by the same suite.
14. ~~BOOST / Powered Up, bridge~~: closed by `lab-hubs-bridge` (virtual HTTP BLE bridge, `G/bw-sim/transports/virtual-ble-bridge.js`).
15. ~~WeDo 2.0, tilt / lights / tones through the Lab hub~~: closed by `lab-hubs-wedo-observables` on both BLE routes, after repairing sensor identity propagation.
16. ~~SPIKE Essential, legopoweredup over WB and SL-BLE~~: closed by `lab-hubs-coverage` using the already catalogued assembly `67351c01.dat`, with wrong-program controls on both routes. LDraw geometry/connector checks remain mandatory.
17. ~~NXT, NXC compile-then-run~~: closed by exact-source recorded compiler-reply tests, not a live compiler. #1129’s words are merged. The sync/buttons/listen cell is also closed by `lab-nxt-live-surface` through the real pinned supplier’s blocks and protocol replies, with motion and wrong-scene controls. Estimated sensor/button timing boundaries remain explicit.
18. ~~RCX, legorcx blocks into the Lab RCX~~: closed by `bw-sim-rcx-legorcx`.

The WeDo gap proved to require a sensor-binding product fix under `G/bw-sim/`; direct protocol tests had bypassed it. #1127 (merged) closed the Powered Up stop-action
and EV3 `.rbf` cells.

## Hosted firmware qualification

Source [#1239](https://github.com/CrispStrobe/brickwright/pull/1239) landed at `6da92497d2e8f51b2a75e137fab9e6946d3a3457` from qualified head `64949a78117a3937ad5241e8ec41d1b8fffca3b2` after all 32 enabled exact-head checks succeeded; six conditional jobs were skipped as declared. [Official own-firmware run 39892243464](https://github.com/CrispStrobe/brickwright/actions/runs/39892243464) passed both motor comparisons and all six real Python cases. Independent original reading bound the fixed Runtime/Infra/firmware graph, source hashes and built outputs to the actual Lab consumer. The timed speed ratio was 1.0053; degrees endpoints were 359.16° versus 359.15° (target 360°), within the unchanged limits.

This qualifies embedded MicroPython in the project’s own NuttX through the Lab route. No physical hardware accuracy, standalone raw-REPL or installed native lifecycle claim follows from this result.


The separate WP9/WP5 implementation candidate adds pane-selected virtual serial,
WebSocket and HTTP connections, owned brick-button inputs and coupled EV3 sync.
It preserves the 43-cell matrix above. See
[connections and buttons](ROBOT-LAB-CONNECTIONS-AND-BUTTONS.md) and the
[claimed implementation boundary](../lanes/2026-10-23-robot-lab-ui-transports-buttons.md);
its final built-pane and hosted qualification must complete before landing.
