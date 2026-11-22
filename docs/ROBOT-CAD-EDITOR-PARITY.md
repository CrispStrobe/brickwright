# Robots and CAD editor convergence

Compared on 2026-11-15 against brickwright-lite `c6cae060b` and
brickwright-cad `da28ced`, plus this selection change.

## Implemented in this change

Build now uses empty-space left drag for a visible selection rectangle, as CAD
Select mode does. The rectangle replaces selection; Shift adds to the selection
captured at pointer-down. Shift+click still toggles. Intersecting projected part
bounds select, rather than requiring each part's center. Groups expand through
Robots' existing selection policy; hidden parts remain excluded. Selection does
not write model history. Escape, pointer cancellation, lost capture and window
blur discard a mouse rectangle. Middle drag orbits (Studio: right drag); touch
keeps one-finger orbit and long-press then drag to add with a rectangle.

The pure `overlay/scratch-gui/src/lib/editor-interaction/box-selection.js` owns
rectangle normalization and projected-box intersection. It takes homogeneous
clip coordinates and canvas-local pixels, with no dependency on either model,
DOM or Three.js. It clips near/far planes before perspective division. CAD uses
an identical vendored copy under `packages/editor/src/vendor`, following its
existing touch-gestures/transform-math reuse policy, with source commit and hash
recorded in `docs/brickwright-provenance.json`.

## Follow-up: optional CAD host

The default-off CAD host is now implemented; see
[CAD-EDITOR-INTEGRATION.md](CAD-EDITOR-INTEGRATION.md). It consumes the canonical
CAD editor/core as a pinned browser SDK, keeps the SDK's worker and WASM lazy,
and adds Settings → Workspace → CAD Editor. CAD state travels in the SDK's
`brickwright/cad.json` sidecar, including when the editor is disabled.

## Next work, in priority order

| Area | Current evidence | Recommended next change |
| --- | --- | --- |
| Camera controls (shared) | Both editors now use pinned `camera-pointer.js` intentions; Robots Build adds Space-drag pan with cancellation and EN/DE help. Existing preset mappings are preserved. | Continue sharing wheel/trackpad intentions where policies match; keep touch and Simulate behavior explicit. |
| Transform feedback | Robots has grid snapping, typed position/rotation and status feedback; CAD has transient transform readouts and precision controls. | Add a live distance/angle readout to Robots using its LDU-to-mm conversion. Preview must not create undo entries. Share formatting/precision arithmetic where the units are explicit. |
| Selection actions | Robots already has group/ungroup, connected selection, align, distribute, mirror, hide/isolate, paint, duplicate and fit-selection. CAD has its own solid operations and source editing. | Keep these domain commands; share gesture cancellation and selection-set operations when both need them. Do not transfer CAD scaling to Technic parts, whose connectors/colliders have fixed dimensions. |
| Embedding CAD (implemented) | CAD exports `mountCadEditor` and host callbacks for files, selection and command state; its Brickwright adapter already stores `brickwright/cad.json` and converts CAD/LDraw coordinates. | The host now lazy-loads the pinned SDK and owns its session, disposal and SB3 sidecar. Continue with native iPad coverage and shared camera/readout contracts. |
| User-created robot parts | CAD's `toBrickwrightPart` exports LDraw geometry with `requiresPhysicsMetadata: true`. | Start with visual parts. Require authored connectors/colliders before a generated part participates in robot mechanics; keep source CAD definitions editable. |

Avoid sharing either viewport wholesale: Robots renders LDraw in metres with Y
up, while CAD uses millimetres with Z up. Keep conversions at adapters and use
model-independent interaction functions as the shared layer. Once the SDK is
consumed in Brickwright, this layer can become a small independently packaged
module; until then, pinned, hash-checked copies avoid a cross-checkout runtime
dependency.

## Validation

- `node --test --import ./scripts/lib/register-gui-scope.mjs test/editor-box-selection.test.mjs test/bw-sim-camera-nav.test.mjs test/bw-sim-touch.test.mjs test/bw-sim-editor.test.mjs test/bw-sim-editor-parity.test.mjs test/bw-sim-editor-v2.test.mjs`
- `npm run verify:robot-selection` exercises the actual viewport in Chromium
  without building the Scratch shell. Install normal root/GUI dependencies and
  Playwright Chromium; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an installed
  browser. The fixture uses original box faces with real catalog metadata.
- CAD: package build, production build, camera browser tests and the existing
  multi-body rectangle/Escape browser test.

The focused viewport check does not exercise the complete Scratch shell.

## Robot Lab corrections and motor preview (2026-11-15)

Pre-Run warning dismissal is keyed by diagnostic code and retained for the app
session, including loading transitions and released/reopened Robot tabs. The
idle build info row is folded into the existing top Help control. Touch tab
layout reserves 60 px beside the 44 px menu toggle and its 8 px right inset.

Frame 39794 is correctly named 7×11. It and 64179 now include the side bores
from their official LDraw primitives, retain existing connector IDs, and use four
rail collision boxes instead of a solid window. Rails use their actual 20 LDU
width so side contact does not create a false collision. A two-pin regression
fixture connects the flat 7×11 frame beside the SPIKE hub's long side.

Existing 45601 placements render the official complete 45601c01 assembly with
45610 battery; their model ID and hub profile stay compatible. The loader fetches
both the original part and visual assembly closures. The battery category adds
25 boxes/packs/cells across Power Functions AA/AAA/rechargeable, Powered Up,
Control+, 9 V, 4.5 V, SPIKE and EV3 families from the same pinned official archive.
These are part/attachment additions; electrical battery discharge is not modeled.

The shared CAD SDK now supplies a worker-based motor/joint preview with hinge
speed, finite torque, joint angle, Run/Pause/Stop/Reset and an explicit fixed-base
option. Preview poses remain outside documents and undo. Existing geometry and
collision qualification still applies. Mate authoring and virtual robot programs
remain follow-up work.

## Further camera parity

Robots Build now supports Space-left-drag panning over empty space and parts.
The gesture preserves the model, selection and history and ends on Escape,
pointer cancellation, lost capture or focus loss. Space still places a palette
part when a part is in hand. CAD and Robots share `camera-pointer.js` button/
modifier intentions, with their established navigation presets preserved.

Validation: the real Robots viewport selection/Space-pan check, 10 shared and
Robot camera unit checks, CAD package/production builds, its two pointer/wheel
unit checks and two real browser camera/history checks. The previously signed
iPad package remains fixed at frontend `3a36d37`; this subsequent parity change
is committed for the next package, independently of the pending WLAN install.

## Transform feedback

Build now shows a transient on-canvas readout while parts or gizmos move. It
reports the actual snapped displacement and per-axis deltas in millimetres
(0.4 mm/LDU, with Robot viewport Y/Z signs), plus the shortest orientation
change from the original pose (0–180°). The badge is hidden at idle, does not
intercept pointers, and uses the pane's EN/DE labels and number formatting.
Blocked previews are tinted red. No model or history data is written to display it.

The regression also exposed missing gizmo cancellation. Escape, pointer cancel,
lost capture and focus loss now relinquish gesture ownership before ending the
Three.js drag, restoring original poses without committing them. Selection is
retained. Tests exercise the real viewport preview and cancellation, alongside
pure unit conversion and orientation checks.

The follow-up frontend was built separately under `build-parity` from
`a5b2c016f`, with both optional editors compiled and default-off. The compiled
GUI's iPad touch check passed Robot warning dismissal/header clearance and CAD
opt-in, shape creation, persistence, FPGA tab-index changes and host Undo. The
shape-library check waits explicitly for its dialog to become visible before
filling the search field. SDK shape UI and geometry/remount checks also passed.

The prior signed frontend `3a36d37` was successfully installed and launched on
the physical iPad over WLAN; receipts are in `artifacts/ipad-cad-final`.

The shared SDK now includes saved motor ports, encoder-based program controls,
MIT-licensed DC/yellow TT motor presets and the full Adafruit archive browser.
See [CAD motor programs](CAD-EDITOR.md) for the Code/Blocks workflow. The archive
loads all 1,825 verified originals from brickwright-media-lab on demand; qualified
STL insertion records explicitly selected units and orientation.

## 2026-11-17 simulation qualification

Complete CAD robot presets now use version 2 project bundles. Widget restoration
and collection belongs to the GUI, so Run works before opening Circuit or
Controls. Run preserves an open Controls drawer. The generator synchronizes GUI
static inputs; final SDK verification also checks all six built project archives.
Existing saved projects remain unchanged: reopen an Example to use the new
circuit and program defaults.

Interactive presets use a functional motor circuit (R, back-EMF, current and torque,
without winding/flyback transients) and normally disable self collisions within
the joint-connected robot. Quasar enables its internal contacts so the ram
stops against the blank and the ejector interacts with the dial. Ground and independent bodies still collide; world
settings can enable internal collisions. These are control examples, not internal
clearance or switching-transient qualification. CAD poses and trails now share
one scheduled browser draw while electrical/mechanical feedback remains 200 Hz.

All six models passed real-GUI six-second WebKit and Chromium runs with default
inputs, Controls closed/open, restart, Center controls and Stop/Reset. The
post-rendering-change results and precise performance limitations are recorded in
[the simulation repair receipt](receipts/2026-11-17-cad-simulation-fix.json).
Atlas remains below real time; successful control runs do not certify 1x speed
for every model. Purchased electronics detail work is separate.

The subsequent performance continuation integrates 22 complete robot examples,
shared compact motor collision candidates, and layered Atlas fork/crate contacts.
Generated slider defaults now point toward available travel. See the
[performance evidence](evidence/2026-11-17-robot-performance.md) and its receipt
for actual browser rates and the distinction between isolated physics timing,
whole-project control checks and native window verification.


## Quasar workpiece cycle and cold-start preparation

Quasar now loads a staged circuit/Blocks/Code program: retract the ram, index
90 degrees, press, retract, eject, return, then accept manual Widgets. Reset
restores the workpiece. The frame is behind the dial, the ram has a guide
opening, and the wider radial channel avoids a yawed blank bridging the walls.
The 80 mm wedge stroke clears the exit. Workpieces remain rigid; this is not a
material deformation or build-qualified press simulation. The two small linear
actuators use separate nominal motor constants and speeds; these are functional
control models, not Adafruit motor datasheet calibration.

A circuit-owned mechanical clock survives window blur while preparing. Run
shows preparation and guards duplicate starts immediately; unavailable
connections disable it. Actual hidden-page and explicit Stop policies remain.

Native tests now check the workpiece and ram contact. WebKit verification records
the entire VM-driven cycle, including rigid poses, ejection and return, instead
of accepting joint displacement alone. See the Quasar evidence and receipt.

The coherent robot branch is incorporated. Atlas retains the original hollow
crate and precise fork spline candidates: the imported solid crate caused a large
loaded tilt error. New cradle, wheel and mast collision candidates reduce the
scene from 2,741 to 2,299 hulls without relaxing geometric qualification.


## macOS trackpad and editing after Stop

The Mac host now routes precise scrolling and magnification through the shared
CAD native-input contract. Blocks consumes input only inside its visible workspace;
the block palette uses its own wheel handler. Other panels receive the original
event once through its NSWindow. An isolated native AppKit/WKWebView check verifies
precise Blocks panning and ordinary-panel fallback; a WebKit GUI check also covers
pinch, tab round trips and source preservation.

Stop now restores CAD selection/dragging immediately while keeping recorded motion.
Pause keeps the inspection pose. Previous frame begins at the end of a stopped
recording; Live returns to the editable design if there is no running worker.
The focused regression suite passes 31/31. The three-cycle Quasar test requires
the blank to clear the dial before falling, and the pusher is a visible printed
carriage rather than a blade with overridden mass.

### Purchased component appearances (2026-11-17)

Scout and Trident examples now show full-size Adafruit Feather RP2040 STEP
surfaces; Scout also shows the 830 4×AA case and an original illustrative
DRV8833-style PCB with headers. All source motor cases have distinct plastic,
can, cap and terminal materials. Rendered details follow the existing body;
colliders, mass and ports stay unchanged. Reopen an example for the new saved
appearance presets. Mantis's shortened controller placeholder and Trident's
battery/FeatherWing still need geometrically appropriate replacements; the
full-size parts are not scaled into incompatible spaces.

### Visible wiring (2026-11-17)

The 3D view now has coloured functional motor/servo harnesses, plus Scout's
battery and controller/driver loom. Cables follow their body anchors during
editing and simulation and reuse tube buffers. They add no mass/collisions and
are excluded from printed geometry. Port/component roles determine this routing
illustration; physical pin mapping and direct Circuit-tab wire import remain
unimplemented. The illustrated Feather does not turn the functional Uno circuit
into a verified physical Feather build. Existing saved model identities work
without project migration.

### Complete example electronics (2026-11-18)

All 22 default CAD robot projects now contain a METRO Mini ATmega328P/16 MHz
controller matching their Uno-compatible program target, a regulated 5 V module,
a nominal 6 V source, a prototype carrier and enough dual H-bridges for their DC
channels. Servos have a separate power header and direct signal connections.
Atlas has two bridges for A/B/D and a servo C bus. Mantis uses a split layout;
Nova has functional compact drive housings and clearance bays; Scout has an ideal
encoder pickup. The two newly imported Adafruit STEP assets retain MIT provenance.

Older saved examples show **Add controller and power** in CAD Properties. This
adds the hardware in one revision-checked, undoable CAD edit, keeping the project
identity, title, earlier history and the sibling Code/Circuit/Blocks/Widgets.
The isolated SDK and actual integrated Atlas upgrade tests both pass, including
exact CAD Undo/Redo and unchanged sibling editors. Resized/conflicting mounting
frames are not silently altered. Reopening a default example also loads the new
hardware, including Nova's revised chassis bays.

Electronics proxies contribute approximate mass and collisions; all 22 original
geometry/physics suites and the explicit hardware audit passed (240 local tests).
Nova's ground-contact regression was corrected without weakening its travel gate.
Supply/driver/encoder/drive housings and physical pad routes are functional
illustrations. Converter transients, power ratings, exact physical pin mapping,
ideal linear-stage internals and fabrication qualification remain outside this
pass. Existing print-only layouts are retained; added carriers are exportable
from their assembly. See the final receipt for full GUI/co-simulation/native scope.

### 2026-11-18: screw forms and tablet Properties

SDK `ac32c189d219437bf06f46075ed645ffd1b510b6` fixes unsupported thread ends, shared head/point geometry, fully threaded cup ends and headless drive sizing. Generic Screw and Thread are covered too. Saved meshes/history stay intact; Apply shape parameters explicitly regenerates an existing part. Properties updates applicable controls immediately and scrolls only vertically on touch. Source/limitations: CAD `docs/evidence/2026-11-18-screw-forms-and-properties.md`.

Local qualification: 35 head/point render combinations and the form/Undo flow pass in iPad WebKit; actual horizontal/vertical Chromium finger gestures pass. The embedded Brickwright SDK additionally passes bounded generic dimensions, changing head/point + exact Undo, editable cup depth with no fictitious length control, and trusted touch without a model edit (`scripts/verify-cad-fasteners.mjs`). All 130 Lite CAD/pinning/bridge tests pass. The 22 robot archives are unchanged. CAD's 134 geometry/physics checks pass across batches: one unrelated five-second hinge timeout during concurrent work passes alone without changing its test or implementation.

### Precision drafting and CAD exchange

The [shared CAD drafting roadmap](https://github.com/CrispStrobe/brickwright-cad/blob/main/docs/DRAFTING-ROADMAP.md)
sets the order: improve Sketch & Extrude, add precise retained sketches, produce
linked drawings/PDF, expose visual modeling commands, then extend file exchange.
DXF is the first fabrication exchange format. DWG follows through a reviewed
optional codec, with STEP import tracked separately for supplier components.
The first cross-host acceptance model is a TT motor mounting plate with a
driving hole-spacing dimension and a 1:1 drilling template.

The embedded editor shares sketch UX and design history with standalone CAD.
The host owns the compact File and History controls, project title, file pickers
and native menus. Check compact/expanded layout, keyboard and touch access,
and light/dark rendering on both desktop and tablet widths before integration.

The first DXF slice is **Properties → Export sketch as DXF** for a selected
rectangle or circle extrusion. It exports the original profile in its local
sketch plane at its evaluated dimensions in millimetres. Rectangles use a
closed polyline and circles remain analytic circles. Body transforms, cuts
and projection of an entire assembly belong to separate export workflows.
