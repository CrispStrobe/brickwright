> **Continuation, 2026-10-29:** [Coordinator tasks and current source/gates](DELIVERY-CONTINUATION-2026-10-29.md) and [editor follow-ups](EDITOR-HISTORY-FOLLOWUPS.md) supersede old pending code tasks below. Public PR1555 and an unpublished coordinator composition contain additional fixes; neither is a new release. The user defers iPad T1, T2 requires an observed crash and T4 remains unapproved. Preserve the device-test server/worktree and ask before any release step.

# Editor history, autosave and crash isolation — handoff (2026-10-28)

Lane claim: [`lanes/2026-10-27-editor-history-autosave.md`](../lanes/2026-10-27-editor-history-autosave.md).
Status: **DONE and on main.** What remains is listed under "Open tasks". Each task
there names its files, its steps and when it counts as done, so a fresh agent can
take one without reading the session that built this.

## What the owner asked for

- Undo/redo for **every** operation, not only edits inside one editor. For
  example, deleting a sprite in the costume editor had no undo.
- A step history: go back 10 or 50 steps in any editor, from a dropdown
  that names each step ("Blocks: Add", "Costumes: Remove", "Sounds: Change"…).
- Autosave in every editor and of the whole project, with a menu setting for the
  autosave location.
- A failing editor must not crash the app. The trigger was opening the colour
  palette in the graphics editor.

## What landed

| PR | Merge commit | Content |
|---|---|---|
| #1487 | `6248956820` | Global undo/redo and the History dropdown; project-structure steps (VM wrappers); autosave to IndexedDB and a folder (desktop app native, Chromium File System Access); per-editor error boundaries; Robot Lab connection and brick buttons folded into Manual controls (includes the closed #1473) |
| #1493 | `1419c02a4` | Named steps in every editor (Circuit, Tilemap included); FPGA design in the project file; crash recovery; History keyboard navigation; iPad/iPhone autosave folder; About → "Our apps" plus its refresh script |
| #1506 | `0e6112ed9` | 0.1.28 "What to Test" notes (en/de) for all of the above |

Internal TestFlight (internal group only, no Beta App Review): **0.1.27.1**
(run 40510897135, contains #1487 plus the app gallery) and **0.1.27.2**
(run 40610548552, contains #1487 and #1493). The full Build on main passed after
both merges.

## How it is built (map for the next agent)

All paths are under `overlay/scratch-gui/src/` unless noted. `scripts/integrate.mjs`
copies the overlay into `packages/`. A file that also has a tracked `packages/`
mirror must stay byte-identical to it (`test/overlay-packages-pairs.test.mjs`).

- **First load, kept tiny (P17 budget):** `lib/global-undo.js`. It holds the
  surface registry, `undoActiveSurface`/`redoActiveSurface`, `getUndoState`, and
  the `globalThis.__bwGlobalUndo` bridge that scratch-paint uses. Everything else
  is in lazy chunks registered in `scripts/verify-boot-payload.mjs`
  (`bw-project-safety`, `bw-history-panel`, `about-apps`).
- **Coordinator (lazy):** `lib/bw-undo-coordinator.js`. It keeps the project-level
  stack (limit 200) and orders it against each editor's own steps by sequence
  number. `moveHistory(n, 'all')` makes the multi-step jumps. `timeline()` merges
  the step names into "Area: label" strings.
- **Project steps (lazy):** `lib/bw-project-history.js` wraps these VM methods:
  `deleteSprite addSprite duplicateSprite renameSprite reorderTarget startDrag/stopDrag
  postSpriteInfo addCostume addBackdrop duplicateCostume addSound duplicateSound
  deleteCostume deleteSound renameCostume renameSound reorderCostume reorderSound`.
  `withoutHistory()` suppresses recording while an undo or redo replays itself,
  and holds until an async replay settles. History is cleared on `loadProject`.
- **Editor surfaces.** Each registers depth, `steps()` (or `snapshots()`) and
  names:
  - Blocks: `containers/blocks.jsx`
  - Code: `lib/codemirror-editor.jsx`
  - Widgets: `controller-panel-view.jsx`
  - Paint: `overlay/scratch-paint/src/hocs/undo-hoc.jsx`
  - Pixel: `pixel-art-editor.jsx`, with drafts in `lib/bw-editor-drafts.js`
  - Tilemap: `tilemap-editor.jsx`
  - Sounds: `containers/sound-editor.jsx`
  - FPGA: `fpga-gate-builder-rf.jsx` and `fpga-tab.jsx`
  - Robot Lab: `sim-lab-pane.jsx` with `lib/bw-sim/editor/editor-state.js`
  - Circuit: `circuit-tab.jsx`, with names from `lib/bw-circuit-step-names.js`
- **UI:**
  - Menu bar: Undo, Redo and History buttons in `menu-bar.jsx`; the Settings item
    "Autosave & history…" is in `settings-menu.jsx`.
  - `components/bw-history-panel/history-panel.jsx`: the dropdown list, plus the
    autosave view (settings, folder, versions to restore, download or delete).
- **Autosave (lazy):** `lib/bw-autosave.js`.
  - Settings live in localStorage `bw-autosave-settings`: interval of at least
    15 s (default 60 s), keep 1–200 versions (default 30).
  - Versions are stored in IndexedDB `bw-autosave`.
  - Folder targets:
    - Desktop app: native commands in `apps/tauri/src-tauri/src/autosave.rs`.
      There are four commands; their ACL grants are in `build.rs` and
      `capabilities/default.json`, and the count is in
      `test/tauri-app-command-acl.test.mjs`.
    - iPad/iPhone: the fixed folder `Documents/Autosave`. `UIFileSharingEnabled` in
      `apps/tauri/src-tauri/Info.ios.plist` makes it visible in the Files app.
    - Chromium: `showDirectoryPicker`.
  - Crash recovery: the `bw-autosave-unclean` flag plus `recoveryCandidate()`
    (the newest version within 24 h). The banner is in `lib/bw-project-safety.js`.
- **Crash isolation:** `components/editor-error-boundary/` is a small in-place
  "Try again" panel. It dispatches `bw-editor-error`, which is recorded under
  `data-bw-error-notes`. `lib/error-boundary-hoc.jsx` uses it instead of the
  full-screen crash page, and `gui.jsx` wraps each tab, the stage and the sprite
  list.
- **About → "Our apps":**
  - The UI is `components/menu-bar/app-showcase.jsx`. The data is
    `app-showcase-data.js`, which is generated; the icons are in
    `static/app-showcase/`.
  - To regenerate: `node scripts/refresh-app-showcase.mjs [--dry-run]`. It only
    reads from App Store Connect and the iTunes lookup. Credentials come from the
    `APPSTORE_API_KEY_ID`, `APPSTORE_API_ISSUER_ID` and
    `APPSTORE_API_KEY_P8`/`APPSTORE_API_KEY_PATH` environment variables.

### How to verify after a change

```bash
node --test --import ./scripts/lib/register-gui-scope.mjs \
  test/editor-history.test.mjs test/global-editor-undo.test.mjs \
  test/project-structure-history.test.mjs test/autosave-settings.test.mjs \
  test/about-app-showcase.test.mjs test/fpga-project-bundle.test.mjs \
  test/overlay-packages-pairs.test.mjs test/tauri-app-command-acl.test.mjs \
  test/boot-payload.test.mjs
# production build of packages/scratch-gui, then the browser gate (Chromium):
node scripts/verify-global-editor-undo.mjs   # costume undo/redo, History jump + keys, autosave, crash recovery
node scripts/verify-boot-payload.mjs         # first-load JS under the P17 limit, lazy chunks stay lazy
(cd apps/tauri/src-tauri && cargo test --lib autosave)
(cd apps/tauri/src-tauri && IPHONEOS_DEPLOYMENT_TARGET=16.0 cargo check --lib --target aarch64-apple-ios)
```

Two CI-only traps:
- A root test that pulls a bare package through the GUI scope must be listed in
  `scripts/lib/gui-scope-allowed.json`.
- Tests must not call `console.log`.

Check both statically before pushing; a local run does not catch them.

## Open tasks

Numbered by priority. T1 needs a person with the iPad. The rest an agent can do.
Claim each code task with its own `lanes/<date>-<slug>.md` before editing (see
`lanes/PROTOCOL.md`).

### T1. Device acceptance of TestFlight 0.1.27.2 on iPad (needs a person)

No device has run any of this yet; it has only been built and tested in desktop
Chromium and WebKit. Install 0.1.27.2 from TestFlight (internal group) and check:

1. Settings → Autosave & history… → "Also save into the app's Autosave folder
   (Files app)". Wait one interval (60 s by default), or press "Save version now". Then
   check that `.sb3` files named `<project> autosave <timestamp>.sb3` appear in
   Files → On My iPad → Brickwright → Autosave.
2. Pixel editor (a MakeCode Arcade project) → open the colour palette. Expected:
   no crash. If something fails, only the palette panel shows "Try again".
   **This is the owner's original crash report, and it was never reproduced off
   the device** (see T2).
3. Delete a sprite, then a costume, then a sound. Undo each from the menu bar, then
   Redo each.
4. Make 10 or more edits across Blocks and Costumes. Open History and click the
   10th step back. All 10 are undone, and "● Now" moves there.
5. Make an edit, kill the app from the app switcher before autosave clears the
   unsaved flag, and reopen it. A banner offers to reopen the autosave.
6. About → "Our apps": the links open the App Store or TestFlight.

Record the result in this file (replace this section with what was seen, with
date and build) and in the 0.1.28 release lane. A failure becomes a new task
with exact steps.

### T2. Colour-palette crash (investigate only if T1 step 2 fails)

- **Known:** the "whole app crash" came from `lib/error-boundary-hoc.jsx`, which
  showed the full-screen crash page for any error in Costumes. That is replaced,
  so a palette error now stays inside its panel. One plausible trigger was fixed:
  `project-palette-editor.jsx` threw when the stored startup stack was
  unreadable; now it is read defensively.
- **Not known:** the real exception on the iPad. Reproduction attempts in
  Chromium and WebKit, on the stage and with palette interactions, all passed.
- **If it fails on the device:** connect the iPad to the Mac, open Safari → Develop
  → [iPad] → Brickwright, and reproduce. The boundary's error notes are
  `role="alert"` items inside the `<div data-bw-error-notes>` fixed at the bottom
  right of `<body>`, and the console shows the stack. Fix the cause in `pixel-art-editor.jsx` or `project-palette-editor.jsx`,
  and add a unit test with the offending palette or project data.
- **Done when:** the palette opens on the device with the project that failed,
  and the test covers that data.

### T3. Undo steps that are not recorded yet (audit, then cover)

`lib/bw-project-history.js` covers the VM methods listed above. Known
operations that change the project but are **not** project steps:

- `vm.shareBlocksToTarget`: dragging a script onto another sprite in the sprite
  list.
- Changing the project title.
- Adding an extension.
- Robot Lab or Circuit actions that load a whole example. These replace the
  editor's state; check what their own undo does.

For each one, verify in the browser whether Undo reverses it. Wrap the ones that
don't, using the same pattern as `wrap('renameSprite', …)`: record a step with
undo and redo closures and an "Area: Verb “name”" label. Extend
`test/project-structure-history.test.mjs`. Done when every listed operation either
undoes from the menu bar or is written down here as intentionally not undoable,
with the reason.

### T4. Undo history across a reload (owner decision before any code)

Today the steps live in memory and are gone after a reload. The History list
then links to autosave versions instead (`older` / `showVersions` in
`history-panel.jsx`). Keeping the steps would mean serializing each step's
undo/redo payload, including the sprites, costumes and sounds a delete removed
(assets, possibly MBs), into IndexedDB, keyed per project, with eviction. The
owner deferred this until testers ask for it. **Do not start without the owner's
go-ahead.** If approved, scope it as one lazy module next to `bw-autosave.js`.
Steps that are not serializable (live editor objects) must end the restored
history cleanly instead of being faked. The P17 first-load budget must not grow.

### T5. Android autosave folder label

On Android, `choose_autosave_folder` (mobile branch in `autosave.rs`) uses
`document_dir()/Autosave`, which is app-private and not visible to the user.
The button text "(Files app)" in `history-panel.jsx` (`fixed`) is iOS wording.
`fixedFolder()` in `bw-autosave.js` also returns true on Android. Either:
- (a) write to a user-visible location via the Storage Access Framework, which
  needs a plugin; or
- (b) on Android, hide the folder option (`fixedFolder` and
  `folderPickerAvailable` false) and say autosaves stay in the app.

(b) is the small, safe fix. Update `test/autosave-settings.test.mjs`
("the app on an iPad…" case) with an Android user agent. Done when Android shows
no option that writes somewhere the user cannot reach.

### T6. Strengthen the History keyboard gate

`scripts/verify-global-editor-undo.mjs` checks Home, End and Enter, but at that
point the list holds a single step, so ArrowUp and ArrowDown across several
steps are not exercised. Neither is the "Now stays in view" scroll. Before
opening History, add 3 or more project steps (for example rename the sprite
three times). Then:
- assert that ArrowDown and ArrowUp move focus one step at a time, and that
  Enter on the 2nd step down moves two steps;
- with 30 or more steps undone, assert that the `aria-selected="true"` row is
  inside the list's visible box when the panel opens.

### T7. "Our apps" maintenance (each release)

Before each release, run `node scripts/refresh-app-showcase.mjs --dry-run`.
The issuer id and the key location are in the owner's private App Store notes;
never commit or paste the `.p8`. As of 2026-10-28: 19 apps, 8 on the App Store,
18 with a public TestFlight link, no entry changes. The dry run reports the
`brickwright` icon as "changed". The script prefers the App Store artwork, and
uses the latest build icon only for apps not yet on the store. Decide once
whether to accept Apple's copy (run without `--dry-run`) or to pin the current
file with `icon: 'local'` on the `brickwright` entry in `app-showcase-data.js`,
so the report stops flagging it.

## How to ship an internal-only TestFlight build from a branch

This keeps the release version (0.1.28) free. Use the previous version's train
with a higher build number; 0.1.27.1 and 0.1.27.2 are taken, so the next is
0.1.27.3.
1. Make a throwaway branch `testflight/<slug>-<date>` from main. Never merge it.
2. In `apps/tauri/src-tauri/tauri.conf.json`, set `"version": "0.1.27"` and add
   `"bundleVersion": "0.1.27.3"` under `bundle.iOS`.
3. In `.github/workflows/mobile.yml`, make three changes:
   - Add `if: github.ref != 'refs/heads/<branch>'` to the `android` and `ios` jobs.
   - In the `ios-signed` job, after the step that writes `IPA=… >> $GITHUB_ENV`,
     add a step gated on `workflow_dispatch` and this ref.
   - In that step: unzip the IPA; assert that `CFBundleShortVersionString` and
     `CFBundleVersion` are the expected ones; write the `.p8` from secrets; run
     `xcrun altool --validate-app`, then `--upload-package`; then run a helper.
     The helper waits for the build to turn VALID, sets export compliance to
     false if it is unset, and adds the build to the app's **internal** beta
     groups only, using `scripts/lib-appstore.mjs` (`client`, `readEnv`,
     `alreadyDone`).
   The last version of that step and helper is in this repository's history as
   commit `c08519131`. It is unreferenced now that the branch is deleted, so
   recreate it from this description if it has been pruned.
4. `gh workflow run mobile.yml --ref <branch> -f sign_ios=true`. When the log
   says `added to internal group`, delete the branch.

Merging without `ci:full`: repository auto-merge is off, so `gh pr merge --auto`
merges at once. Instead, poll `gh pr checks` and merge with
`gh pr merge --merge --match-head-commit <sha>` once `build` and `unit (1/6)`
through `unit (6/6)` pass and nothing else has failed. The "full CI requested"
check fails by design without the label.
