# Shared project chrome and CAD history

File is the project menu in both layouts. Collapsing the top row moves the
same File actions and Project History control into the CAD tool ribbon (or
beside other editor tabs). Its dropdown is placed outside the scrolling toolbar
so it remains clickable. Expanding moves the controls back. The selected
collapsed state is global and remains the same when switching editors.

The editable project title comes from the shared project state. CAD's embedded
model title input is hidden; an internal asset name no longer competes with the
project title. Complete robot examples set the shared project title. The sole
title appears in the top row when expanded and the CAD ribbon when collapsed.

CAD exposes complete in-memory step labels/depths to the existing undo bridge.
The main Project History lists all mounted editor histories in chronological
order alongside structural project edits. A jump can undo/redo hidden CAD edits
without changing tabs or focusing another editor. It stops when the project or
an editor owner is replaced. The ordinary Undo/Redo buttons remain scoped to the
active editor plus structural project actions; CAD retains its detailed local
stack. Saved autosave versions restore the combined Code/Circuit/Widgets/CAD
project, including after restart. In-memory steps do not survive restart.

Desktop File uses the same complete-project saver and native Open. Its current
editor supplies import/export and editing commands. CAD contributes selection,
transforms, Boolean operations, views, sketching, parameters, source, model
library and program controls. Editors provides navigation to the visible tabs.
Disabled/stale editor commands are rechecked at invocation. Native entries do
not bypass project or editor file ownership.

## Detailed purchased components

Scout and related models still contain explicit electronics clearance envelopes.
They are not detailed component models, and this UX delivery does not replace them.

The pinned MIT Adafruit CAD Parts archive contains detailed source files:

- `4884 Feather RP2040/4884 Feather RP2040.step` (SHA256
  `de85fb7f6644cdea17808208d888e64264d691573da8cd0fee808e2fd44d477f`).
- `830 Battery Holder/830 Battery Holder 4xAA.step` (SHA256
  `aed16f3913d44d3c4ac6912c489efec9d65dcadad6b03940968d205af98ade67`).

The Feather STEP and vendor STL previously failed our closed-solid import
qualification; diagnostics remain in the CAD worktree's `artifacts/scout-detail`.
An attractive preview is not evidence of an insertable, simulation-ready solid.
The exact DRV8833 product3297 is not a component folder in this pinned archive.
Adafruit's public PCB repository supplies Eagle board/schematic data, which is a
source for outline, holes and placement, not already a qualified assembled 3D model.
Its separate CC BY-SA3.0 licence must be retained/reviewed when using those files.

Sources:
- https://github.com/adafruit/Adafruit_CAD_Parts (MIT licence in repository).
- https://learn.adafruit.com/adafruit-feather-rp2040-pico/downloads (official 3D download).
- https://github.com/adafruit/Adafruit-DRV8833-Motor-Driver-Breakout-PCB

A suitable further implementation would distinguish detailed visual reference
geometry from collision geometry, preserving units, mounting references, source
attribution and assembly poses. It must not make every header pin a physics
collider or silently claim unqualified geometry is an exact purchased solid.
