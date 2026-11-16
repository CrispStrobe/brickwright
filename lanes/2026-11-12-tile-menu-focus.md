# Preserve submenu focus during rapid selection

Status: IMPLEMENTED; current-head qualification pending. Owner: editor delivery maintainer.

A deferred keyboard submenu focus can overwrite a newer focus selection. Own the
shared menu component and its mirrored package copy, plus focused menu keyboard
controls. Preserve keyboard opening, submenu navigation, accessibility and all
existing editor actions. Include a control that opens a real submenu, moves focus
before the scheduled callback and proves the newer focus is retained; also prove
normal keyboard opening still focuses the first item. Preserve the original
browser failure and verify the affected tilemap journey on a qualified build.
Do not modify thresholds, unrelated editors, pins or workflows.

The submenu callback now retains the originating open, connected opener and
only focuses its first item if focus has not moved. Focused controls cover normal
opening, later item/outside focus, closing, unmount and replacement; the affected
real browser journey and final enabled checks remain required.
