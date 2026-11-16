# Local macOS robot/CAD testing

This is a local test build, separate from an App Store/TestFlight release. Keep
the normal installed app and use a distinct product name and bundle identifier
for the test app. The CAD workspace remains off by default. Build from an
isolated worktree; do not mutate another agent's dependency tree or Cargo target.

## Try the coupled Scout

1. Launch the local test app and enable **Settings → Workspace → CAD Editor**.
2. Save any current project. Open **CAD → Circuit → CAD connections → Open Scout
   circuit + CAD example…**. This replaces the current project with one editable
   SB3 containing the circuit, rover and program.
3. Choose **Run blocks / pseudocode**. Check that the rover moves and turns and
   that the program receives actual encoder feedback. Switching to Code should
   keep the coupled run advancing.
4. Stop, then Reset. Stop removes power; Reset restores the initial mechanical
   pose. Simulation preview must not alter the saved CAD or its history.
5. Try **Run on simulated Arduino** with an internet connection to the configured
   compiler service. This executes compiled Uno/ATmega328P instructions rather
   than also executing the VM program. Stop an independent debugger first.
6. Switch between light and dark settings. Open the model library, select Source,
   inspect a preview, and insert a compatible editable source into the editor.

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
Keep that machine-specific configuration and Cargo caches under ignored artifacts.

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
