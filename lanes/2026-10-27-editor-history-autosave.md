# Editor history, autosave and crash isolation

Status: DONE — landed in #1487 (6248956820), #1493 (1419c02a4) and #1506
(0e6112ed9); internal TestFlight 0.1.27.1 and 0.1.27.2. Owner request: undo/redo
on every operation, a step history, autosave in every editor and of
the whole project with a settable path, and one failing editor must not crash
the app. Handoff with the code map and the scoped open tasks (T1 device
acceptance on iPad, T2 palette crash if it recurs, T3 operations not yet
undoable, T4 history across reloads (owner decision), T5 Android autosave
folder, T6 stronger keyboard gate, T7 app list upkeep):
[`docs/EDITOR-HISTORY-HANDOFF.md`](../docs/EDITOR-HISTORY-HANDOFF.md). Those
tasks are not claimed by this lane; claim each one separately.
Owner: Claude (editor UX lane). Base: current main at claim time.

Scope:
- `overlay/scratch-gui/src/lib/global-undo.js` (first load, kept small): Redo
  and step depths; `lib/bw-undo-coordinator.js` (new, lazy): the shared project
  stack ordered against each editor's own steps, and multi-step moves.
- Stage drags and sprite-info edits (x, y, size, direction, show/hide) are
  project steps too.
- `lib/bw-project-history.js` (new, lazy): add, delete, duplicate, rename and
  reorder of sprites, costumes, backdrops and sounds as undo/redo steps (VM
  wrappers); `lib/bw-target-artwork-operations.js` records its artwork-aware
  sprite deletion there.
- Editors registering Undo/Redo depth: blocks, code, circuit, widgets, paint
  (scratch-paint `hocs/undo-hoc.jsx` via a global bridge), pixel, tilemap,
  sounds (`containers/sound-editor.jsx` overlay), FPGA gate builder, Robot Lab.
- Menu bar: Redo and History buttons; Settings > Autosave & history….
- `components/bw-history-panel/` (new, lazy): history list (10/50 steps back,
  jump to any step, project steps by name) and autosave settings/versions.
- `lib/bw-autosave.js` (new, lazy): whole-project versions in IndexedDB, an
  optional folder (File System Access API; in the desktop app a native folder,
  `apps/tauri/src-tauri/src/autosave.rs`, 4 new commands with ACL grants).
- Per-editor autosave where it was missing: pixel-editor drafts
  (`lib/bw-editor-drafts.js`), FPGA Verilog/constraints and gate canvas.
- Crash isolation: `components/editor-error-boundary/`; `lib/error-boundary-hoc.jsx`
  (Blocks, Costumes, Sounds) uses it instead of the full-screen crash page; tabs,
  stage, sprite list, paint/pixel/tilemap editors and the project palette panel
  each fail in place. `project-palette-editor.jsx` no longer throws on an
  unreadable startup stack.

Qualification: `test/editor-history.test.mjs`, `test/project-structure-history.test.mjs`,
`test/autosave-settings.test.mjs`,
the existing undo/artwork/asset-library/ACL/boot-payload tests, the extended
`scripts/verify-global-editor-undo.mjs` browser gate, `cargo test` for
`autosave.rs`, and the P17 first-load limit (all new UI is lazy).
