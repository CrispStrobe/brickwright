# Robot Lab UI transports and brick interaction (WP9 / WP5)

DONE — merged in [#1274](https://github.com/CrispStrobe/brickwright/pull/1274).
All enabled exact-head checks and source-bound built-browser qualification passed.
Codex hub-coverage continuation, isolated branch
`lane/robot-lab-ui-transports-buttons-20261023`, base
`0e11f66d5ae1a9c5788756986c715bf86049ff16`. User requests the recommended
follow-on work after the 43-cell coverage closure. Preserve all existing owners.

Own WP9: a bounded Lab virtual-transport lifecycle module under
`lib/bw-sim/transports/`, the six existing serial/WebSocket/HTTP transport
adapters where ownership-safe installation, routing and active-session teardown
require repairs, and focused transport/real-extension controls. Connect the
existing serial, bridge, ev3dev, BLE HTTP and SPIKE text routes to the current
Lab session through explicit virtual routing. Preserve physical fallthrough,
other owners' wrappers and non-Lab requests. Dispose only owned endpoints and
connections; stale sessions and asynchronous replies must not revive a closed
or replaced scene. Supplier changes are limited to the send-failure amendment
below and the separately merged [WeDo follow-on claim](2026-10-23-wedo-send-failure.md);
do not change native or firmware.

Own WP5: `hubs/ev3/ev3-virtual-hub.js`, `ev3-direct-commands.js`, the button
capability adapters for already-modelled bricks, and `api/robot-lab-api.js` for
bounded button discovery/press/release. Qualify EV3 turn-ratio semantics from
open-source firmware facts; copy no GPL implementation. Preserve NXT's closed
Button IOMap and model estimates. Add visible brick-button controls with
release-on-cancel/unmount; prove actual WAIT_FOR_PRESS guest completion and
wrong-brick/index refusal. No new physical-accuracy claim.

Shared integration is limited to transport lifecycle exports in `sim-lab.js`,
new connection/button UI components and their narrow wiring in
`components/tw-pseudocode/sim-lab-pane.jsx`. PR1255's owner retains measurements,
worker telemetry and their current qualification; claim1259 retains measurement
refinements. Do not edit those active shared integration files until the
qualified parent composes normally or explicit owner coordination resolves the
boundary. Independent controller/protocol tests may proceed first. Preserve all
measurement behavior and their controls.

Own focused Node/actual VM/Jolt controls, removal of the six now-wired entries
from `test/no-dead-overlay-modules.test.mjs`, exact dependency-scope declarations,
a new browser journey helper called by the existing Robot Lab verifier, and
its focused preservation/negative controls; relevant coverage, EV3/NXT, usage
and handoff paragraphs plus this claim. Do not alter acceptance bounds, known
failure baselines, physics solver, compiler, model library or release workflows.
Require real extension traffic and physical/button consequences, wrong-input
and stale-owner controls, meaningful mutations, and affected clean browser/guest
qualification. Merge only after every enabled exact-head check succeeds and
reviewed/predicted/landed tree and parents agree. Keep raw evidence private.

The candidate wires the production coordinator, connection selector and brick
inputs through the pane and dynamic Lab boundary. Qualified measurement parent
#1265 is normally composed. Qualified plots #1272 has now landed on main; its
measurement import, timestamps and panel props are preserved during normal
composition and require the final combined-head qualification.

Before the latest current-main composition, 358 combined controls pass with no failures. One named
skip reports unavailable unrelated vendored-repository history; the previous-pin
history and tracked-file checks run and pass. The set includes actual VM/Jolt
transport guests and the complete Lab extension suite, unchanged physical
movement/sensor/stop judges, WAIT_FOR_PRESS, nine main/worker sync cases,
measurement preservation, and WeDo session/light/tone/identity controls.

Original exact-head CI failures are retained. Their repairs add the exact SIMD
test declaration, admit only the pure button facade in the API import boundary,
read the serial port's actual open options, and preserve an API model loader's
calling program while retiring old routes, clock, motors and pending Run intent.
Ordinary UI model loads retain their existing stop behavior. Shipped fetches,
HTTP feedback and title-callback continuations cannot replace a newer UI load
or publish stale lesson/help text. Both newly reviewed races were reproduced
before repair; five request/publication cuts and the earlier lifetime, feedback
and ordering cuts are detected with exact source restored. EV3/NXT peers remain
bound to their captured scene, and uncertain retirement blocks new execution.

Only the scoped Powered Up and WeDo pins advance, through qualified supplier
[#64](https://github.com/CrispStrobe/extensions/pull/64) and
[#66](https://github.com/CrispStrobe/extensions/pull/66). Canonical wrappers and
receipts match the merged supplier bytes. Every other pin, receipt entry and
the global baseline remain fixed. Supplier policy #65 recognizes owner-command
authorization without an inherited reviewer quota.

The hubs-bt browser part exercises the actual connection/button journey,
model replacement, delayed real-provider return, serial traffic and pane closure.
The close action is the arena ownership handover: Stage presentation changes
intentionally leave the Lab tab mounted. Captured serial and focused/held input
remain live before handover, then their cleanup is checked. Forty-nine affected
DOM/transport controls pass, including a real tab/simulator handover control at
a controlled lazy-child boundary; both source-copy handover mutations fail.
The original built-browser close-action failure and the subsequent gate-shape
audit failure are retained. The handover gate now proves the same arena control
appears before release and disappears afterward; the audit baseline is unchanged.
All 31 enabled exact-head checks passed across four workflows, with six declared
conditional job skips. The source-bound built-browser job ran all ten assigned
Robot Lab gates with zero skips. API-driven model/motor calls, radio-hub guests
and EV3/NXT guests passed. After real handover, the captured serial port is closed,
held input is released, the pane is disposed, its clock and API are removed, and
host wrappers are restored. The landed merge parents and tree exactly match the
prediction. This closes this transport claim; installed-native, all-VM ABA,
all-profile Reset and hardware qualification remain separate.
See [usage and model limits](../docs/ROBOT-LAB-CONNECTIONS-AND-BUTTONS.md).

Model PR1235/1236, native PR1224/1099/1100 and Arcade PR1128 remain with their
existing owners. Review current failures and retained originals without duplicate
acquisition or dispatch; carry their qualified composition through normal
landing only after their owning acceptance requirements are met.

## Radio notification ownership amendment

The HTTP BLE bridge uses the same model notification sink as Web Bluetooth.
An older peripheral currently clears that sink unconditionally on disconnect,
which can remove a newer connection's notifications. Before integrating this
route, also own the narrow sink-lifetime boundary in
`lib/virtual-hub/lab-ble-peripherals.js`,
`lib/bw-sim/hubs/lwp3/lwp3-virtual-hub.js` and
`lib/bw-sim/hubs/wedo2/wedo2-virtual-hub.js`: return an identity-guarded sink
release from the existing setter, and let each peripheral release only its own
sink. Preserve notification bytes, formats, motor/sensor behavior and existing
caller signatures. Qualify newer-owner preservation, idempotent disconnect and
real extension traffic. This does not add notification multicast, a new radio
protocol or a hardware connection-capacity claim. Do not edit those three paths
until this amendment merges. Existing authorized transport work stays isolated.

## Powered Up asynchronous send-failure amendment

Actual real-extension teardown exposes unobserved rejections from motor-stop
writes queued by `PROJECT_STOP_ALL`. Own the narrow producer boundary in
CrispStrobe/extensions `extensions/CrispStrobe/lego_poweredup.js`: observe and
report rejected sends while returning the original rejecting promise to awaiters.
Keep command bytes, rate limiting, stop actions and dispatch order unchanged.
Prove normal sends, awaited error identity, fire-and-forget stop reporting,
limiter failures and no unhandled rejection with actual extension controls and
meaningful mutants. No global rejection suppression or invented acknowledgement.
Do not edit this supplier source until the amendment is merged.

Carry only the directly affected scoped `legopoweredup` adoption through
`vendor-pins.json`, its canonical generated wrapper and upstream-byte receipt,
plus focused pin and real-extension transport controls. Other pins and the
global bundle baseline remain fixed. Owner-directed fork authorization and the
supplier's technical qualification requirements apply; downstream pin movement
follows qualified supplier merge. Keep existing
owners and all original failures. No unrelated extension or vocabulary changes.

## Existing radio button input

The LWP3 Button property and WeDo Button characteristic currently always return
unpressed. Within the same two radio-hub files, add owned input state behind
those existing reads and their existing notification subscriptions, a strict
single-button press/read capability, and worker state export/import. Default
unpressed bytes and every unrelated command stay unchanged. Qualify real
extension property/characteristic traffic, press/release and unsupported-input
controls, notification ownership and worker replay. This models readable input;
it does not model physical power, pairing or firmware button-event phases.
Keep these source edits behind this amendment's merge as well.
