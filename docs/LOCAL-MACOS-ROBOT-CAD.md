# Local macOS robot/CAD testing

This is a local test build, separate from an App Store/TestFlight release. Keep
the normal installed app and use a distinct product name and bundle identifier
for the test app. The CAD workspace remains off by default. Build from an
isolated worktree; do not mutate another agent's dependency tree or Cargo target.

## Compact CAD workspace

CAD uses the shared tabs and one modeling/program toolbar. Entering CAD compacts
Brickwright’s upper menu without changing the saved preference; leaving CAD
restores that preference. Use the tab-row ellipsis to show the shared menu when
needed. CAD New/Open/Save/Import/Export and Model library are in its File menu;
the embedded editor does not add another File button. Standalone CAD retains its
own document controls.

**Run**, **Stop**, **Reset** and **Program** sit in the existing CAD toolbar.
Program opens a closeable side drawer over the workspace, with program choice
and motor-to-joint connections. Opening it does not reduce canvas height. Use
**Edit program** or **Open circuit** to switch to the relevant editor. Gear,
servo, mounting and measurement details stay collapsed until needed. **Physics
preview** is available in the drawer for manual assembly checks. The drawer
follows Brickwright’s light/dark setting and closes with its X or Escape.

The updated local bundle is `~/Applications/Brickwright Robots UX Test.app`.
Save and close the earlier `Brickwright Robots Test.app` before opening it:
these local bundles share the test identity and native bridge ports. Do not
replace or forcibly terminate a running test app with unsaved user work.

## Try the coupled Scout

1. Launch the local test app and enable **Settings → Workspace → CAD Editor**.
2. Save any current project. Open **CAD → Program → Open Scout example…**. This replaces the current project with one editable
   SB3 containing the circuit, rover and program.
3. Choose **Blocks / pseudocode** under Program, then press **Run program**. Check that the rover moves and turns and
   that the program receives actual encoder feedback. Switching to Code should
   keep the coupled run advancing.
4. Stop, then Reset. Stop removes power; Reset restores the initial mechanical
   pose. Simulation preview must not alter the saved CAD or its history.
5. Choose **Arduino Uno** under Program and Run with an internet connection to the configured
   compiler service. This executes compiled Uno/ATmega328P instructions rather
   than also executing the VM program. Stop an independent debugger first.
6. Switch between light and dark settings. Open the model library, select Source,
   inspect a preview, and insert a compatible editable source into the editor.

The bundled curated catalogue contains 302 models with previews: 154 editable
source models and 148 mesh models. Check both filters. The standalone Adafruit
archive folders contain original files and are separate from those totals. All
482 component folders also have local thumbnails and selection previews. The
metadata-only archive root is not a component.

Mantis 3-servo walker, Cyclone 2-axis gantry sorter, and Helios turret catapult
are available from **Shapes → Robots** with separate print layouts and fit gauges.
Their model/print-geometry/physics cases and SB3 packager structure pass; the full
generated sequential tasks still need browser-driven physical qualification.

Atlas is also available in the robot catalogue. Kestrel is deferred because its
physical gripper qualification failed. Dedicated newer motor drivers, CAD-fed
IMUs/contact sensors, and coupled Pico firmware remain gaps. See
[component coverage and accuracy limits](CIRCUIT-CAD-CO-SIMULATION.md).

## Build and record

Use the root README's vendor/install/overlay sequence before a clean build. If
upstream CAD changed, build its packages and SDK from a clean committed checkout,
then run `node scripts/sync-cad-sdk.mjs /path/to/brickwright-cad` in Lite. Commit
that exact SDK snapshot; do not hand-merge generated SDK chunks.

Build the GUI with `BW_ENABLE_CAD=1` and `BW_ENABLE_FPGA=1`; set
`BW_GUI_OUTPUT_DIR` to a dedicated output such as `build-robot-cad-macos`.
Run `node scripts/verify-built-cad-sdk.mjs packages/scratch-gui/build-robot-cad-macos`
against the resulting bundle, and run relevant local tests and browser checks.
The final SDK bytes must match every manifest digest after webpack processing.

Install the CLI with `npm ci --ignore-scripts` in `apps/tauri`. Pass a local
Tauri configuration overriding `build.frontendDist` with the absolute GUI output,
and giving the test app its own product name, bundle ID and deep-link scheme.
Run `npm run build -- --bundles app --config /path/to/local-config.json` there.
If overriding `bundle.macOS.infoPlist`, retain the privacy descriptions from
`src-tauri/Info.plist` along with local build metadata. Keep that machine-specific configuration and Cargo caches under ignored artifacts.

For local ad-hoc signing, use signing identity `-`; this does not select an Apple
private key or create a store-distribution artifact. Explicit final signing uses
`codesign --force --deep --sign - --keychain "$HOME/Library/Keychains/brickwright-build.keychain-db" /path/to/Test.app`.
For certificate-based signing/export, select the identity from that same
Brickwright keychain and pass it explicitly. Never fall back to the login keychain.
Store profiles, certificates, credentials and provisioning data outside commits.

Verify with `codesign --verify --deep --strict`, install the test app under the
user's Applications folder, and launch that exact installed path. Record the
Lite commit, CAD SDK commit, app/binary hashes, architecture, signing method,
build result and native launch outcome in a dated delivery receipt. Do not claim
device functionality or calibrated physics from compilation/launch alone.

## Recovery / first Run / sketch repair build (20261116.4)

Use `~/Applications/Brickwright Robots Repair Test.app`. Save and close UX Test
first; Repair Test preserves its bundle identity and native bridge ports. The
older running bundle is not overwritten.

Reopen can now restore large CAD autosaves when localStorage is full. A failed
recovery exposes X, Not now and Save autosave copy. The original IndexedDB
autosave is retained.

**Run** executes the green-flag program. **Program** opens runner and connection
settings. First Run initializes the saved Circuit in the background and waits
for its mapped motors to load; no preparatory Circuit visit is required. With
no start script it explains what to add, and clicking a toolbar error opens its
full explanation.

For Sketch: choose a profile and plane, drag the corner for size and the upper
handle for extrusion height, or type the named dimensions, then press Create
extrusion. Dragging through the base clamps at 0.01 mm. Invalid typed dimensions
keep Create disabled; Create commits one undoable step.

Scout's motors are source-derived meshes; its PCB and battery parts are still
clearance envelopes. Parametric screws and nuts are under Shapes → Supports &
connections, but Scout does not yet include its fasteners/headers. The detailed
Feather candidate failed source-mesh checks and is not substituted silently.
See [actual UI regression evidence](receipts/2026-11-16-cad-recovery-run-sketch.json).
