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

The updated production host check (`verify-cad-editor.mjs --ipad`) also passes:
lazy catalogue/preview loading, live dark/light switching with an unchanged
session/history, shape creation, CAD/FPGA toggles, persistence and global Undo.
The check waits for asynchronous shape insertion and respects Settings sections
that remain expanded across menu openings.

## TestFlight delivery: 0.1.33

The iOS/iPad and macOS packages were rebuilt from native source commit
`98b38d047` with the tested CAD SDK and uploaded to App Store Connect.
Both builds are VALID and IN_BETA_TESTING for the internal group. Both are also
assigned to the external group and submitted for beta review; Apple reports
WAITING_FOR_BETA_REVIEW. English and German tester notes were read back and
verified against `docs/app-store-metadata.md`.

The signed package hashes, source/SDK identity and tester-state verification are
recorded in [the delivery receipt](receipts/2026-11-15-cad-testflight-0.1.33.json).

For local builds, use Apple's `/usr/bin` tools first in PATH when exporting the
iOS archive: Homebrew rsync rejects Xcode's extended-attribute argument. Use
`~/Library/Keychains/brickwright-build.keychain-db` for all Apple signing,
including `codesign`, `productbuild`, and Xcode/Tauri signing/export. Select it
explicitly where the tool supports `--keychain`; never fall back to the login
keychain. See [the native signing instructions](../apps/tauri/AGENTS.md). Simulator binaries
copied from an installed TestFlight app carry Apple's beta signatures and must
be signed with our distribution identity before upload. Compute the packaged
runtime pin after this signing step and rebuild with that pin. The receipt's
runtime-pin check covers the package before Apple's TestFlight re-signing;
launching the installed TestFlight simulator was not tested in this delivery.

## Chosen-edge fillets, STEP import as exact bodies and kernel 0.1.10 (27 November 2026)

Lite pins CrispCAD SDK `02287df59bdb8ba7f3685a9241dd6b299276b1c3` (previously
`afb2984b`, the robot-wiring pin; the last section here described `68666ce`).
`02287df` is CrispCAD main `80d8666` plus the BrickWright round-trip proof for
document versions 44 to 46. Over `68666ce` the exact-modeling side brings:

- **Exact kernel 0.1.10** (CrispCAD `083a85f`, release `exact-kernel-v0.1.10`,
  tarball SHA-256 `ffe86ae0...9b7d`), after 0.1.8 (topology, face naming,
  fillet/chamfer of edge indices, strict `importStepBodies`) and 0.1.9, which
  the `afb2984` pin already carried without THIRD-PARTY-NOTICES.md following;
  it now names 0.1.10. STEP export writes one named, coloured solid per body.
  Exact commands recorded with 0.1.9 replay as stale, as designed.
- **Fillet and chamfer of chosen edges, document version 44** (CrispCAD
  `a981d0f`, `80d8666`): "Chosen edges" in the Fillet, chamfer, shell dialog
  lists the body's B-rep edges; they are picked in the dialog's edge drawing or,
  new in this pin, with "Pick in the 3D view" on the model itself (24 px touch,
  10 px mouse targets, hidden edges never picked). Edges are stored as stable
  references (the two faces each edge bounds), resolved again after upstream
  edits; a reference that no longer resolves leaves the feature stale rather
  than picking another edge.
- **STEP import as exact bodies, document version 45** (CrispCAD `6e86c6e`,
  `80d8666`): File > Import STEP as exact bodies keeps each solid's B-rep and the
  kernel's display mesh, so the project opens, displays, simulates and prints
  without loading the kernel; exact measure, fillet, chamfer, shell and STEP
  export work on the body. Import is about twice as fast in this pin (58-body
  board 38.5 s to 19.5 s) and new imports store a lighter display mesh.
- **CAD Script loft pairing, document version 46** (CrispCAD `afa1536`):
  `loft([...], {pairing: "closest"})` and `smoothLoft` re-start each section
  where it is closest to the previous one; lofts without the option are
  unchanged byte for byte.
- **Drawings from exact edges** (`f8730d4`): assembly drawing sheets can take
  B-rep edges and true arcs from the kernel. **Rounded and bevelled hole rims**
  display in linear time (`286f36a`; 200-hole plate fillet display 28 s to
  2 s). **Journal export** writes parametric profiles and Booleans of portable
  bodies as CAD Script (`7264e9a`).

BrickWright's SB3 bundle keeps `brickwright/cad.json` byte for byte at every
version; until this sync the vendored editor refused version 46 documents.
CrispCAD's `npm run verify:brickwright` now round-trips one document of each
version from 41 to 46 through the real BrickWright writer and loader (`02287df`).
The 22 robot projects were regenerated from this pin with
`npm run gen:cad-robots`: they are byte-identical to the committed ones, so
`static/cad-robots` is unchanged, and `npm run gen:cad-robots:check` passes.

Checks on a fresh `BW_ENABLE_CAD=1` production GUI build of this pin, in the
shared Chromium: CrispCAD `verify:brickwright` (versions 41 to 46) and
`verify:brickwright-sync`; `sync-cad-sdk.mjs --check`; `gen:cad-robots:check`
(against the pin and the embedded documents); the CAD SDK fetch-pin and
fetch-pinning tests (24 pass) and `prove:pins` (11/11 mutations caught);
`verify-built-cad-sdk` (842 files) and `verify-built-cad-robot-projects` (22);
`verify-cad-editor.mjs` default, `--sdk-only`, `--ipad`, `--shapes-ui`,
`--sdk-only --shapes-ui`, `--robots` and `--robots --ipad`. In the CAD tab: a
2 mm chamfer of the box's +z edges measures exactly 5810.667 mm³ with the
kernel fetched only on first use; the version 42 and 43 loft documents open,
edit and save at their versions; a 150-hole rim fillet is refused with the
tablet-limits message before the kernel runs. A STEP export of a 20 × 30 × 10 mm
block imported with `import step` (File > Import STEP as exact bodies is not
shown in the tab's menu bar; the terminal command opens the same chooser)
becomes an exact body (version 45) measuring 6000 mm³; two 30 mm edges chosen
in the dialog's edge drawing chamfer it to exactly 5880 mm³ with two stable
edge references, and after a reload Manifold displays it with no request under
`assets/exact/`. A version 46 paired-loft document opens (6000 mm³), edits and
saves at version 46. The `BW_ENABLE_CAD=0` build passes `--expect-absent`.
Picking edges in the 3D view itself was not driven in BrickWright (the dialog's
button is present); CrispCAD's `exact-edge-pick-viewport` spec covers it.

## Exact kernel 0.1.7 and faster shape thumbnails (26 November 2026)

Lite pins CrispCAD SDK `68666cefe89235eaff9b1ccd3eeb9543ce299b81` (previously
`5d40e251`). Over that pin it brings:

- **Exact kernel 0.1.7** (CrispCAD `fc554d5`, release `exact-kernel-v0.1.7`,
  tarball SHA-256 `09f406f6...ad92b`): the kernel finds smlibwasm's heap-resize
  import by its key in the module's import table rather than by function name,
  so the memory ceiling holds in minified builds without CrispCAD's
  `preserveExactKernelNames`, which is gone; `pairing: 'closest'` handles curved
  loft sections (CrispCAD passes no pairing, so its lofts are unchanged).
  Exact commands recorded with 0.1.6 replay as stale, as designed.
- **Shape library thumbnails** (CrispCAD `68666ce`): a thumbnail is rasterised
  only while its card is still shown, in a task of its own, with plain arithmetic
  instead of three.js vectors. Searching the Shapes library and clicking "Add
  Box" no longer waits behind ~36 thumbnails of cards the search already
  replaced (5 of 6 runs took 15-17 s before, all 6 under 0.5 s after); the
  thumbnails themselves are byte-identical.
- **Scout TT rover collisions** (CrispCAD `adb5b52`): the collision candidates'
  check compares solids instead of bytes and the file was regenerated (same
  hulls and vertices, Manifold's triangulation of coplanar faces changed). Only
  `static/cad-robots/scout.sb3` and the manifest changed; the 22 projects were
  regenerated from this pin with `npm run gen:cad-robots` and
  `npm run gen:cad-robots:check` passes against it.
- Robot and physics test timeouts in CrispCAD (`3ee1328`) and one hinge-clearance
  check per physics boundary (`a9214b2`).

## Exact-kernel limits and kernel 0.1.6 (26 November 2026)

Lite pins CrispCAD SDK `5d40e251083012f6517c79a0c3fa012b6a055a7d` (previously
`38e3eabb`). Over that pin it brings:

- **Limits for heavy exact jobs** (CrispCAD `e429280`, `d4a0616`). A fillet or
  chamfer that touches too many edges (a curved edge counts as four straight
  ones) or a shell of a body with too many faces is refused before the kernel
  runs, with a translated message (German included); the exact kernel's memory
  has a ceiling; its worker is recycled after a job that grew it or broke the
  kernel; every exact job shows elapsed time and Cancel in the status bar and is
  stopped after its budget. None of it changes the model or its history. Lite
  passes no `exactLimits`, so the CAD tab runs with `EXACT_LIMITS_TABLET`
  (400 weighted edges, 160 shell faces, 512 MiB, 60 s); a desktop host may pass
  `exactLimits: EXACT_LIMITS_DESKTOP` to `mountCadEditor`.
- **Exact kernel 0.1.6**: smlibwasm built from source by the kernel lab with
  recorded provenance (the file is byte-identical to the npm build), loft
  sections joined vertex i to vertex i as authored, and the kernel's own memory
  ceiling (`maxMemoryBytes`) and shell guard (`guardSeconds`, half the request
  budget), which replace CrispCAD's rewrite of the wasm's memory maximum.
- **Robot fixes** (CrispCAD `a0b0f2e`): Scout's encoder, the electronics-tray
  posts and access holes, Nova's drive housings and Mantis's power pod. The
  22 `static/cad-robots/*.sb3` projects were regenerated from this pin with
  `scripts/generate-cad-robot-projects.mjs`.

## Ruled and smooth lofts: document versions 42 and 43 (26 November 2026)

Lite pins CrispCAD SDK `f2a596a23ca6a03b967c2a7ebc19ab6df26e71da` (previously
`f0136b8c`). The CAD tab now opens and saves two newer document versions:

- **Version 42**: a code program may be CAD Script revision 2, whose `loft` builds
  ruled side surfaces between turned sections. Saved revision-1 lofts keep their
  triangulated geometry until the user runs **Upgrade lofts to ruled surfaces**
  (`upgrade-lofts`, one Undo step).
- **Version 43**: a program calls `smoothLoft`, the exact kernel's smooth loft
  through three or more sections.

Documents without such programs keep their version. The previous SDK refused both
("unsupported format, version or units"); `brickwright/cad.json` was always carried
byte for byte. Lite creates no code programs itself, so no host change was needed.

The same pin brings exact kernel 0.1.4, which refuses self-crossing outlines with an
explicit error and keeps `profile.path` loft sections' vertex order as authored
(`smlibwasm` is again byte-identical), runs exact requests in their own
lazily created worker so a slow fillet never blocks the editor (the optional
`exactFallback` mount option is not used by Lite), and meshes exact faces with many
holes face by face.

## Exact kernel and document version 41 (25 November 2026)

Lite pins CrispCAD SDK `f0136b8cb85ffc71f103fa7fa3768a899e919b4b` (previously
`dda7ce21`). That pin brings exact kernel 0.1.2, whose bounding box evaluates
B-spline edges in JavaScript (the same boxes, milliseconds instead of up to minutes
on trimmed curved bodies; `smlibwasm` is again byte-identical), fresh `for (let ...)`
bindings per iteration in CAD Script import, and a 2,048-face limit for exact
polyhedra. The `dda7ce21` pin, over `0953e188`, brought exact kernel 0.1.1 (exact bounding boxes of
rotated curved solids, tighter convex hulls; the `smlibwasm` file is unchanged, only
the kernel's JavaScript under `assets/exact/` changes; exact commands recorded with
0.1.0 are refused on replay as stale while saved exact features keep their display),
compact one-line display buffers for exact features in saved documents (same JSON
format and version), atomic multi-line terminal scripts, and the CAD physics
cold-start and repeat-Run work recorded in [CAD-ROBOT-PROJECTS.md](CAD-ROBOT-PROJECTS.md).
It reads and
writes CAD document version 41, which adds exact fillet, chamfer and shell
features (`exact-feature` nodes). Such a node stores the exact kernel's display
mesh, so evaluation, simulation and printing of a saved design still use Manifold
alone. Projects without exact features keep their document version. An editor on
the previous SDK refused version 41 sidecars; `brickwright/cad.json` was always
carried byte for byte.

The SDK now ships CrispCAD's optional exact B-rep kernel (`@crispcad/exact-kernel`,
MIT AND Apache-2.0; notices in the SDK's `NOTICE.txt` and in
THIRD-PARTY-NOTICES.md) under `static/cad-sdk/assets/exact/`: about 11 MB on
disk, of which the separate `smlibwasm-*.wasm` file is 9.4 MB. Nothing there
loads with the CAD tab: the geometry worker imports it only when a user creates
or recomputes an exact feature, measures exactly or exports STEP. The service
worker has no precache list; it caches those files only after such a request,
like every other lazy chunk.

The CAD tab's host session (`sdk.createCadSession(doc)`) declares the pinned
exact kernel by default, so Edit → Fillet, chamfer, shell works in Lite without
host code declaring a kernel.
