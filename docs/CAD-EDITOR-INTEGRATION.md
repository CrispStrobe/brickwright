# Optional CAD Editor

The CAD tab is a host for Brickwright CAD's existing editor and core. There is
no second CAD implementation in Lite. Build the SDK in the CAD repository and
pin its browser bundle, worker, WASM and notices here:

```sh
# In a clean CAD checkout containing the SDK packaging entry:
npm run build:brickwright-sdk
# In Lite:
node scripts/sync-cad-sdk.mjs /path/to/brickwright-cad
node scripts/sync-cad-sdk.mjs /path/to/brickwright-cad --check
npm run integrate
BW_ENABLE_CAD=1 npm run build:gui
```

`overlay/scratch-gui/static/cad-sdk/manifest.json` records the exact source
commit and SHA-256 of every file. The SDK uses the same `mountCadEditor`,
`createCadSession`, document validation, geometry worker, shape library,
precision controls and selection arithmetic as standalone CAD. Host callbacks
provide file import/export, autosave and the global Undo/Redo surface. Native
exports use Brickwright's existing Files/share integration.

## Visibility and lifecycle

The build flag is off by default, as with FPGA. Shipping web builds explicitly
compile it alongside FPGA, while the user preference stays off. A build without it has no CAD
tab, setting or copied SDK assets. A build with it still defaults to CAD **off**.
Turn it on under Settings → Workspace → CAD Editor. The tab is appended after
Robots so the Code/Circuit/FPGA/Robots indices stay unchanged. Toggling FPGA
keeps the active Robots or CAD surface selected as optional tab indices shift. Enabling the
setting adds the tab; the SDK/worker load only when CAD is first opened.

A host-owned session keeps undo history while switching tabs or turning the
setting off/on. Disabling the setting disposes the viewport and worker and
returns an active CAD tab to Robots. CAD's Shadow DOM contains its styles and
controls. Loading another project replaces its document and resets its session
history. Unsupported CAD documents remain preserved and show a load error if
someone tries to edit them.

## Projects

The compatible SDK sidecar `brickwright/cad.json` travels separately from
`brickwright/state.json`, with a 16 MiB bound. It is carried even in CAD-off
builds, without loading the SDK. Its raw document stays intact, including future
versions. The full CAD validator runs before mounting/editing a design. The
archive loader checks the sidecar envelope before changing any project state.
The storage transaction and VM-load rollback include CAD. Loading a project
without CAD clears the previous CAD document rather than leaking it into the
new project.

Autosave uses `bw-cad-document`; visibility uses `bw-cad-enabled` and is a device
preference, not project content. A live document cache lets SB3 saves include
the current design if localStorage is full; the UI reports that the file must
be saved to keep that session's work.

## Checks

```sh
node --test --import ./scripts/lib/register-gui-scope.mjs test/cad-project-bundle.test.mjs test/bw-cad-preferences.test.mjs
node scripts/verify-cad-editor.mjs --sdk-only
# After a BW_ENABLE_CAD=1 GUI build:
node scripts/verify-cad-editor.mjs
node scripts/verify-cad-editor.mjs --ipad
# For a build made with BW_ENABLE_CAD=0:
node scripts/verify-cad-editor.mjs --expect-absent
```

The SDK check evaluates a real WASM solid and preserves a session across
viewport disposal/remount. The GUI check covers default-off visibility, lazy
loading, the Settings toggle, the real shape library, persistence and host Undo.
`--ipad` uses an iPad-sized touch viewport in Chromium; it is not a physical-device
UI test. `--expect-absent` verifies that a CAD-excluded build stays excluded even
with a saved opt-in. `BW_GUI_BUILD_ROOT` can select a separate compiled directory.
For concurrent native/frontend work, webpack accepts `BW_GUI_OUTPUT_DIR` so an
active native build keeps its frontend inputs unchanged.

## Next parity steps

The two editors share rectangle intersection math, touch arithmetic and core
transform arithmetic already. With CAD hosted through its SDK, future CAD
improvements flow through a pinned SDK update. The next shared extraction is
camera gesture intents and precision/readout formatting. Robots keeps its fixed
Technic dimensions, connector snapping and physics model; the SDK retains its
solid document and millimetre/Z-up coordinate system. CAD-to-Robots geometry
export already exists in the CAD adapter; enabling simulated custom parts still
requires explicit authored connectors and collision metadata.

## Shared fixes upstreamed on 15 November 2026

CAD PRs #53 and #54 merge the simulation work and embedded-library/appearance
fixes into `CrispStrobe/brickwright-cad` main. PR #55 updates archive regression
coverage for the source-details disclosure. Lite pins source
`89b379b8df0a1f273025a1892dec12663081655f`, already included in CAD main.
The SDK owns the catalogue, thumbnails, source insertion, simulation UI and
light/dark palette. Lite supplies its persisted colour preference and retains
SB3/VM adapters. Changing colour mode preserves the editor session and history.

Before pinning future shared changes, build a clean CAD checkout and run:

```sh
node scripts/sync-cad-sdk.mjs /path/to/cad-worktree
node /path/to/cad-worktree/scripts/verify-brickwright-sync.mjs "$PWD"
```

Local validation: 49 focused CAD unit tests; three embedded regressions on iPad
WebKit (catalogue/thumbnails/preview/insertion, simulation close, light/dark
contrast); Chromium coverage of the same behavior plus both archive flows;
seven Lite CAD host/VM/persistence unit tests; production webpack build; all ten
emitted SDK asset hashes verified. These source changes require a new native app
build before appearing in an installed app.
