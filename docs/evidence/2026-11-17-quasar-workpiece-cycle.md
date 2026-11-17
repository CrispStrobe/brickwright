# Quasar workpiece cycle and robot integration

The previous generic project ran all axes together, did not align the workpiece with the ram, and let parts pass through each other. Joint movement alone had been accepted as success. The new default program raises the ram, indexes the dial slowly through 90 degrees, presses, retracts, ejects and returns the wedge, then accepts manual Widgets. The C-frame is behind the dial so it clears the exit. The radial channel is wider than the blank to avoid yaw-induced bridging. Internal contacts are enabled. A rigid blank does not deform; the guided stages are functional ideal actuators, not a fabricated lead-screw assembly or a calibrated purchased motor.

Quasar uses nominal kV/kT 0.003 for the ram and 0.001 for the lighter ejector, rather than applying the same 0.005 constant to both small loads at a 5 ms feedback boundary. The program presses at 5%, ejects/returns at 10%, and holds the ram raised at 25%. Electrical current, back-EMF and mechanical feedback remain coupled. No solver impulse/force limit or geometric qualification tolerance was relaxed.

The CAD clock now retains circuit ownership through focus loss during preparation. The regression failed before the fix and passes afterward. Run immediately guards duplicate starts and shows preparation; connections that are not ready disable Run. The Controls drawer remains open during Run.

The coherent branch work is incorporated through CAD 8ac5dfa, alongside current main library originals. The imported solid Atlas crate produced approximately 52 degrees tilt for a 15 degree target in the coupled harness. Retaining the original hollow crate and precise fork candidates restores about 15.55 degrees while preserving the new cradle/wheel/mast candidates: 2,299 total hulls rather than 2,741. A separate actual WebKit run held approximately 15.42 degrees. These are correctness observations, not a controlled speed benchmark.

Earlier checkpoint SDK source: e803d8f49d9c9245e340a9f1b86e2e036c709dcc. At that checkpoint CAD targeted tests passed 28/28; the five merged robot suites previously passed 47/47. Lite targeted tests passed 126/126, and SDK pin controls passed 8/8. All 11 final SDK digests and all 22 SB3 archive digests pass the built-payload verifier.

The GUI was rebuilt with production webpack behavior (minification disabled), then its generated SDK and robot payloads were refreshed from the qualified source. There were two webpack asset/entrypoint size warnings. Quasar was checked through the real GUI/VM/Board/Jolt in WebKit, including screenshots and workpiece trajectories; a complete final-payload 22-robot run and native packaging are recorded in the accompanying final receipt when finished. Native window interaction is distinct from headless WebKit validation.

Existing saved projects are preserved. To use the corrected default example, select CAD → Examples → Quasar again. Reset restores the blank for a new cycle. Purchased electronics appearance is still separate work: this update does not replace the Feather/battery/driver clearance boxes in other robots.


## Trackpad and Stop continuation

The final Quasar pusher includes its visible carriage, with mass/inertia derived
from that geometry. The whole trajectory test rejects a blank dropping through
the dial. Three complete cycles passed, and a subsequent 22-project WebKit run
passed with no page errors. Verification also covers Controls closed/open and
Stop/Reset; motion-only checks on other robots do not certify their full tasks.

The Mac trackpad bridge is application-local and attached only to the main
webview. It routes precise wheel/magnification through `brickwright-camera-input`.
Blocks forwards wheel input to its existing SVG handlers and handles pinch only
inside the workspace. Unhandled native events go to their original NSWindow;
application-level redispatch failed the ordinary-panel regression. Non-precise
mouse wheel events follow their original native path. The isolated native test
uses an ephemeral WebKit data store and generated precise CGEvents, not the
user’s project profile. Actual finger motion on the physical trackpad remains a
user acceptance check distinct from these native-event tests.

The CAD native host has the same corrected window forwarding. Stop/release now
returns the viewport to the editable design and disposes the worker, preserving
recorded replay/traces. Pause retains the preview. The last measured snapshot
remains inspectable after Stop, and Live exits stopped replay to the design.
Regression controls failed against the preceding behavior; 31 focused CAD checks
now pass. Nine real-GUI input checks passed against the final payload. The expanded final
Lite CAD/bridge selection passed 130/130 before native packaging. The final receipt binds the exact source,
app metadata, SDK and project hashes and separates native routing from release
window interaction.


## Final upstream reconciliation

CAD PRs #74 and #75 landed during final validation. They add seven qualified LDraw
originals and their evidence/previews. Their tests pass 7/7. Git tree comparison
preserved all 2,355 remote library files exactly, including file modes. The merge
retains the complete robot/input lifecycle fixes; the refreshed SDK is built from
CAD 9b5be9f521fd01fc9691a771b97c702a23fa0992, now on remote main. This is a library
payload update after the clean GUI compilation at Lite 65463f90cb9c7bba9c427984b1b8ed76e337409f;
the app records GUI runtime and complete payload source commits separately.
