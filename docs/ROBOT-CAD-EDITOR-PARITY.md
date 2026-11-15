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
| Camera controls | Robots has Brickwright/Studio mouse presets and wheel/trackpad modes; CAD has navigation profiles and Space-drag pan. | Define common gesture intents and shortcut labels, then adapt the existing camera controllers. Keep touch orbit and Simulate's camera behavior explicit. |
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
