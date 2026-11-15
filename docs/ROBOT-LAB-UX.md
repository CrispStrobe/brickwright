# Robot Lab Build mode: connection-first UX spec

Status (2026-10-19, lane `lane/simlab-tab-20261018`): **P1 and P2 implemented**, P3 not yet (see §7). Items below are marked ✅ implemented, ◐ implemented with a stated difference, ☐ not implemented. The pure core is `overlay/scratch-gui/src/lib/bw-sim/editor/snap.js` (`snapAtPointer`, `connectorUnderPointer`, `connectionLine`, `turnAboutLine`, `connectedComponent`) and `view/camera-nav.js` (`orbitAboutPivot`, `zoomAbout`, `wheelIntent`, `viewCubeDirection`); the view is `editor/editor-view3d.js`; the words are `components/tw-pseudocode/sim-lab-editor-text.js` (`connect`, EN and DE). Tests: `test/bw-sim-snap-pointer.test.mjs`, `test/bw-sim-camera-nav.test.mjs`, and the browser gate `scripts/lib/sim-lab-connect-gate.mjs` (`npm run verify:sim-lab -- --part=editor`).

2026-10-19. Code read in `wt-simlab-tab`: `lib/bw-sim/editor/*`, `view/camera-nav.js`, `part-meta/parts.json` and `docs/SIM-LAB.md` § Build mode. Units are LDU; one hole pitch is 20 LDU. Claims marked UNVERIFIED could not be confirmed from a source.

## 1. How established editors do it

- **Connection data**
  - LDCad snaps "100% through meta information": `!LDCAD SNAP_CYL/CLP/FGR/GEN/SPH` lines in a shadow library, written on primitives and inherited by parts ([meta spec](http://www.melkert.net/LDCad/tech/meta), [shadowLib](http://www.melkert.net/LDCad/tech/shadowLib), [forum](https://forums.ldraw.org/thread-11110.html)).
  - A cylinder connector has a gender, a section profile (R round / A axle / S square), caps, a grid of copies, and a slide flag.
  - LDCad left anti-studs off the tube primitive because it lacked "multi matching" ([stud4.dat](https://raw.githubusercontent.com/RolandMelkert/LDCadShadowLibrary/master/p/stud4.dat)). Our derived connectors carry the same information, so we can do the multi-matching LDCad skipped.
- **Hover and preview**
  - Studio's Connect tool draws a part's connectors as small blue cubes and cylinders, and lights the compatible points on the second part ([Studio Connect](https://studiohelp.bricklink.com/hc/en-us/articles/6481651047319-Connect)).
  - Mecabricks shows snap points as dots. You click one, and the next part from the palette lands there ([Brickset](https://brickset.com/article/52336/let-s-build-in-mecabricks)).
  - LDD makes the carried brick translucent ([LDD 4.3 manual p.9](https://www.blinklearning.com/useruploads/r/a/234389417/activity_other_imported/ManualdeusuariodeLEGODigitalDesigner.pdf)).
  - LDCad shows its grid only when no connection is near ([basicEdit](http://www.melkert.net/LDCad/docs/basicEdit)).
  - UNVERIFIED: whether Studio or LDD highlight the target connector during an ordinary drag.
- **Choosing the target**
  - LDCad v2 snaps "based on the actual part shape and not the cursor location", but needs the part roughly oriented first (forum above).
  - Studio "tries to place parts in a valid, connected position" and re-orients them to sit flush ([Moving parts](https://studiohelp.bricklink.com/hc/en-us/articles/5410338956695-Moving-parts)).
  - Studio has hysteresis: a moving part "will tend to jump to connect", a part at rest is "a bit sticky". Axles step one stud at a time, and Ctrl lets them glide ([Snap](https://studiohelp.bricklink.com/hc/en-us/articles/5412087360919)).
  - UNVERIFIED: any editor's numeric tolerances.
- **Rotation**
  - LDD: the arrows turn a held brick 90°. The hinge tool (H) has a Tab key that cycles candidate pivots (green = active, yellow = alternatives) and steps of 45° (manual pp.7–8).
  - Studio: arrows 90°, Shift+arrows 45°, and both work while dragging ([shortcuts](https://studiohelp.bricklink.com/hc/en-us/articles/5410055533207)).
  - Studio's hinge tool turns "around a shared connection point" and carries the connected side with it. Mouse turns respect collision; arrow keys do not ([Hinge](https://studiohelp.bricklink.com/hc/en-us/articles/5411433123351-Hinge-and-Rotation-tool)).
  - LDCad: 90°, Ctrl 45°, Home resets ([keys](http://www.melkert.net/LDCad/docs/keys)).
- **Several connectors at once**
  - Studio's Connect tool adds points with Ctrl. It turns "only as much as needed" and refuses a misalignment over 45°.
  - UNVERIFIED: any editor's documented all-or-nothing best fit.
- **Collision**
  - LDD refuses the slightest collision ([Eurobricks](https://eurobricks.com/forum/forums/topic/145733-ldd-collision-confusion-conundrum/)).
  - Studio has a Collision toggle (Ctrl+Alt+C). UNVERIFIED: how Studio shows a collision (its help page returned 403).
- **Palette**
  - Studio offers click-then-place (the camera stays usable) and drag-in. Click or Space places, Esc or a right-click cancels, and repeat-insert is on by default (shortcuts above).
- **Connected parts**
  - Studio's Shift+V selection modes include "By Connected" ([selection](https://studiohelp.bricklink.com/hc/en-us/articles/5410231515543)).
  - UNVERIFIED: whether a plain drag carries connected parts along in LDD or Studio.
- **Camera**
  - LDD: right-drag orbits, Shift+right-drag pans, the wheel zooms.
  - Studio: right-drag or Ctrl+left-drag orbits; middle or Space+drag pans. F means "pan to cursor", and there is a view cube ([camera](https://studiohelp.bricklink.com/hc/en-us/articles/5409213150487-Camera-control-in-the-viewport)).
  - LDCad: C centres on the selection, Z fits the model.
  - UNVERIFIED: any LEGO editor's rule for the orbit pivot.
- **Touch**
  - Mecabricks "works even on touch screens". UNVERIFIED: its gesture mapping.

## 2. Robot Lab today and the gaps

Already working:
- The magnet (`snap.js` `snapCandidates`) counts every pair a pose makes and checks overlap exactly (`overlap.js`, SAT).
- A green ghost appears, with marker spheres on the paired connectors. Alt turns the magnet off.
- R turns a part about its connection axis.
- Palette: click-arm and drag-in.
- Zoom to the cursor, touch gestures, and a red refusal on overlap.

| # | Gap | Where |
|---|---|---|
| G1 | Hovering outlines the whole part. No connector lights up, and nothing shows which holes the part in hand could use. | `drawOutlines`, `showMagnet` |
| G2 | The target is driven by the pose, not the cursor. The palette ghost seeds the snap with `{hit.point, IDENTITY}` and a 40 LDU 3D radius; a drag seeds it with the grid-snapped pose and `MAGNET_RADIUS = 32`. So the winning hole depends on where the held part's connectors happen to land. The score is `pairs×1000 − dist`, with no hysteresis, so the target flickers. | `updateGhost`, `magnetFor` |
| G3 | The axis sign is the one nearest the current pose, not "sticking out towards the viewer". The twist is always rounded to 90°, even for round pins. | `rotationForAxis` |
| G4 | You cannot cycle through alternatives (other face, other pin end, next hole). | — |
| G5 | The magnet runs only for a single part (`moves.length === 1`), so a beam carrying its pins never seats. | `showMove` |
| G6 | A colliding candidate is dropped silently, and the user sees a free ghost somewhere else instead of a red one where they aimed. | `snap.js` overlap `continue` |
| G7 | The orbit turns about a fixed `controls.target`, and `maxPolarAngle = π/2`, so you cannot look under a part. | `editor-view3d.js:645` |
| G8 | Double-click enters a group but does not focus the view. There is no view cube, and Fit jumps without animating. | `onDblClick`, `fitBox` |
| G9 | A trackpad's two-finger scroll zooms, as a wheel does; it never pans or orbits. | OrbitControls |
| G10 | There is no keyboard-only placement, no hint bar that follows the state, and the cursor never changes. | pane |

## 3. Spec

### 3.1 States

- **Idle.** Hovering a part outlines it and lights the connector under the pointer (§3.2). Cursor: `grab` over a part.
- **Holding.** Entered from a palette tile, or by dragging the selection more than 4 px. The ghost follows the pointer. Cursor: `grabbing`.
  - **Free:** a neutral translucent ghost resting on the surface, at today's `restingPose`.
  - **Snapped:** a green ghost. The active target shows amber, the held connector green.
  - **Blocked:** a red ghost at the aimed pose. The colliding part is tinted, the status reads *"Would go into …"*, releasing changes nothing, and the cursor is `not-allowed`.
- **Target-first** (Mecabricks style).
  - In Idle, clicking a lit free connector pins it as the target. It gets a pulsing ring and a chip such as *"Target: Beam 7, hole 3"*.
  - Palette tiles that cannot connect to that target dim. Clicking a compatible tile places the part straight into the target.
  - This is the owner's "hover a pin hole, a fresh part slots in". Esc, or a click on empty space, clears the target.

### 3.2 Connector highlight

- **Compatibility comes from the registry**, never from a hard-coded list:
  - pin–pinhole, axle–axlehole and axle–pinhole (`kinds/pin-axle.js` `edgeKind`);
  - stud–antistud and stud–tube (`kinds/stud.js`);
  - ball–ballsocket;
  - any registered rule: gear-seat, clutch, spline, slide.
- **Free** means no current pair uses the connector, judged by the compiler's own pairing.
- **Idle:** only the single connector nearest the pointer lights up. Its projected entry face must be within 16 px (mouse) or 28 px (touch).
- **Holding:**
  - Every free connector compatible with any free held connector lights up faintly, on visible parts within 160 px of the pointer.
  - The active target is drawn opaque and 1.3× larger.
  - The held part's matching connector is green on the ghost.
- **Style** (depth-tested, so holes behind a part stay dark):
  - Holes and anti-studs: a ring at the entry face. Axle holes add a "+" inside the ring.
  - Shafts and studs: a ring at the tip.
  - Balls and sockets: a sphere.
  - Colours: cyan `#38bdf8` for candidates, amber `#f59e0b` for the active target, green for the held connector, red when Blocked.
- **Performance:** studs and anti-studs are about 3,900 of the roughly 4,000 catalogue connectors. Show them only on parts whose screen bounding box contains the pointer.

### 3.3 Choosing the target

This is cursor-driven. A new pure export, `snapAtPointer(model, catalog, held, ray, project, opts)` in `snap.js`, replaces the pose seed.

1. **Ray.** Cast the existing collider-aware ray to get the part P and the hit point h.
2. **Targets T.** Take the free compatible connectors on P and its spatial-index neighbours whose entry face projects within R_px of the pointer (24 px mouse, 40 px touch).
   - A hole's entry face is the end (±length/2) whose outward normal faces the camera.
   - If none qualifies, fall back to the connector nearest h, within 12 LDU.
3. **Seating pose** for each target t and each compatible held connector m:
   - **Axis.** Align m's axis with t's. Choose the sign that puts the held part's centre of mass on the camera side of the entry face.
   - **Depth.** Keep today's rules:
     - A shaft's centre sits at the hole face, so a 40 LDU pin goes 20 LDU in.
     - A hole on a shaft is clamped onto the shaft.
     - Studs, tubes and balls coincide.
     - The pose must have `shaftEngagement` ≥ 8 LDU and a lateral error ≤ 0.5 LDU.
   - **Twist.** Keep the current twist, rounded to the connection's symmetry step: 90° by default; round pins also allow 15° (§3.5).
4. **Evaluate the whole pose.**
   - Count all pairs (the existing second phase) and run `partOverlaps`, ignoring the parts being paired.
   - **All-or-nothing:** reject the pose if any held shaft is laterally aligned with a compatible hole but seated less than 8 LDU deep. No half-seated pins.
5. **Rank** in this order:
   1. Target nearest the pointer, in px.
   2. Not blocked.
   3. More pairs.
   4. Smaller twist change.
   5. Model order.
   - If the nearest target's best pose is blocked, show it red. Do not jump to another hole.
6. **Hysteresis.** Keep the current target until another is at least 8 px nearer the pointer, or offers more pairs at equal distance.
7. **Tab / Shift+Tab** cycle the alternatives at the same pointer position: the other entry face, the other pin end, another held connector as the lead, the next hole.
8. **Alt** turns the magnet off: the ghost goes back to Free, on the grid.

### 3.4 Selections and multi-connector parts

- The held set's connectors are the members' free connectors, minus the pairs between members.
- The lead connector is the held connector nearest the grab point. It chooses the target (§3.3); then the whole rigid set is evaluated, all-or-nothing, and ranked by pairs.
  - So two pins 20 LDU apart seat in two holes together, and that beats a one-pin pose.
- The move commits as one `moveMany`, so one Ctrl+Z undoes it.
- Dragging breaks the pairs with parts outside the selection. The status says *"Released from Beam 7"*.
- **P2:** "Select connected" (Ctrl+click, or a button) grows the selection along the pair graph, like Studio's "By Connected". A plain drag moves only the selection.

### 3.5 Turning

- **R / Shift+R:** ±90° about the active connection axis while Snapped (`rotateAboutSnap`), and about the vertical while Free. Both also work mid-drag.
- **[ / ]:** ±15° on round connections (pin in pinhole, axle in pinhole, ball).
  - On an axle in an axle hole, or on studs, they are refused: *"An axle only turns in quarter turns here"*.
- **T:** tips 90° about the screen-horizontal axis.
- **X:** flips the part end for end along the connection axis.
- Every turn is collision-checked, and a blocked turn shows red (unlike Studio's arrow turns).

### 3.6 Palette

- **Click a tile:** the ghost appears under the pointer, and orbit, pan and zoom keep working.
  - A click or Space places the part.
  - Esc, or a right-click without dragging, cancels.
  - Shift+click places and keeps the part in hand.
- **Drag a tile in:** the same behaviour. Letting go outside the view cancels.
- **Orientation:** a Free ghost uses the canonical orientation. On the first snap the axis comes from the target, so a pin always points into the hole you hover.

### 3.7 Camera

- **Orbit pivot,** fixed when the gesture starts. This is a design choice, not one documented by LEGO editors.
  - The pivot is the 3D point under the pointer. Without one, it is the selection centre; without a selection, the model centre.
  - The camera and its target turn together about the pivot, so nothing jumps. A dot marks the pivot during the drag.
- **Mouse (Build):** left-drag on empty space draws a selection rectangle; intersecting part bounds select, including whole groups. Shift adds to the selection (Shift+click toggles). Middle-drag orbits, right-drag pans, and the wheel zooms to the cursor. Studio keeps right-drag orbit and middle-drag pan. Touch keeps one-finger orbit and long-press then drag to add with a box. Escape, pointer cancellation and window blur cancel the rectangle.
  - P3, built (§14): an "LDD/Studio" preset where right-drag orbits and middle-drag pans.
- **Trackpad:**
  - A pinch (`ctrlKey` wheel) zooms to the cursor.
  - A two-finger scroll orbits; Shift+scroll pans.
  - Tell a wheel from a trackpad by `deltaMode === LINE` or integer deltas ≥ 100, and offer a setting to override the guess.
- **Build polar range:** 5°–175°, so you can look under parts. Simulate keeps π/2.
- **Double-click:**
  - On an ungrouped part: the target animates to the clicked point (300 ms ease-out) at the same distance.
  - On a grouped part: enter the group, as today.
  - On empty space: leave the group.
- **F:** fit, animated.
- **P2:** a corner view cube (faces, edges and corners clickable, animated). The Top/Front/Side buttons stay.
- **Animation:** every programmatic camera move animates for 250–400 ms. Under `prefers-reduced-motion` it jumps.
- **Keys:**
  - Idle: the arrows orbit 15°, Shift+arrows pan, + and − zoom.
  - Holding: the arrows nudge the held part one grid step along the screen-projected plane axes.

### 3.8 Touch

- **Tapping a tile:** the ghost appears, snapped to the target nearest the view centre.
- **One-finger drag:** the ghost is drawn 60 px above the finger, so the finger does not hide it.
- **Lifting the finger:** places the part when the ghost is Snapped or unblocked.
- **Floating buttons:** a ✓ / ✕ / ⟳ cluster for place, cancel and R.
- **Two fingers:** camera only. They also call off a part drag, as today.

### 3.9 Discoverability and accessibility

- **Hint bar** that follows the state. Holding: *"Click to place · R turn · Tab other spot · Alt no magnet · Esc cancel"*. Snapped on a round connection, add *"[ ] fine turn"*.
- **Cursor:** changes per §3.1.
- **P3:** coach marks the first time, which can be dismissed (try/catch around localStorage).
- **Keyboard-only placement:**
  1. Enter on a focused tile arms the part. The ghost appears at the target nearest the view centre.
  2. Tab cycles targets in reading order, then the §3.3 alternatives.
  3. R, [, ], X and T turn the part.
  4. Enter places it; Esc cancels.
- **Announcements:** an `aria-live="polite"` region speaks each new target, e.g. *"Pin with friction → Technic beam 7, hole 3 of 7, from the front; 1 connection"*, and speaks every refusal.

## 4. Priorities

- **P1:**
  - ✅ the connector highlight (§3.2);
  - ✅ cursor-driven targets with entry-face orientation, hysteresis and red Blocked (§3.3), which close G1–G3 and G6;
  - ✅ R mid-drag (§3.5);
  - ◐ the camera pivot, the 5°–175° polar range, trackpad support, double-click focus and animated Fit (§3.7) — see §7 for the pivot fallback;
  - ✅ the hint bar and cursor changes.
- **P2:**
  - ✅ Tab alternatives (G4);
  - ✅ snapping for selections and groups (G5);
  - ◐ the Target-first flow (a static amber double ring, not a pulsing one: §7);
  - ✅ 15° turns;
  - ✅ the view cube;
  - ✅ Select connected (Ctrl+click, and a button in the properties panel's Group section);
  - ◐ the touch offset and button cluster (the 60 px lift applies to a part from the palette, not to dragging a placed part: §7);
  - ✅ keyboard-only placement with aria-live.
- **P3:** ✅ the mouse preset (§14), ✅ coach marks (§14), ✅ Ctrl-glide for pins and axles in holes (§14), ✅ a Studio-style hinge tool (§10), ✅ flexible parts (chains and treads: §11; rubber bands: §12; cables: §13).

## 5. Browser-gate acceptance tests

**Fixture:** Beam 7 (32524) at the origin, holes along z, hole axes along y. Home camera, 1280×800 view.

**Hooks the gate needs:** `view.debug.highlights()` → `[{partId, connectorId, active}]`, `view.debug.candidate()` → `{pose, pairs, blocked}`, `view.debug.ghostTone()`, and the existing `view.camera()`.

**Highlight and placement**

| ID | Prio | Action | Expected |
|---|---|---|---|
| T1 | P1 | Arm 2780 and point at the projected top face of hole h3. | `highlights()` lists only free pinholes and axleholes, on parts within 160 px. Exactly one is active: h3. No studs or anti-studs. |
| T2 | P1 | Then click. | One part is added. Its axis ∥ ±y (\|dot\| > 0.9999). Lateral error ≤ 0.5 LDU. Its centre is 10 LDU above h3's centre, on the hole face. `shaftEngagement` = 20. The pin protrudes on the camera side. The compiler finds 1 pair. |
| T3 | P1 | Arm gear 3648 and hover h3. | No highlights, and the ghost is Free. With axle 4519 seated in h3, hovering the axle makes its connector active. |
| T4 | P1 | Pin in hand on h3, then move 5 px towards h4. | h3 stays active. Moving fully onto h4 makes h4 active. |
| T5 | P1 | Idle, pointer on h3. | Exactly one highlight (h3). 30 px away from every hole, none. |
| T10 | P2 | Click h3, then click the pin tile. | Same result as T2. |

**Blocked, turning and selections**

| ID | Prio | Action | Expected |
|---|---|---|---|
| T6 | P1 | A Brick 2×4 sits over h3's top face. Pin in hand on h3. | `blocked` is true and `ghostTone() === 'blocked'`. A click adds no part, and the status kind is `refused`. |
| T7 | P1 | Drag Beam 3 (32523) with its end hole over a seated pin, then press R. | The ghost turns 90° about the pin axis, and the pin's world point is unchanged to within 0.5 LDU. Releasing commits one command; Ctrl+Z restores the beam. |
| T8 | P2 | Pin on h3, then Tab. | The active target changes. Shift+Tab goes back to h3. |
| T9 | P2 | A grouped Beam 3 with pins in both end holes, dragged so the lead pin is over Beam 7's h1. | At least 2 pairs (h1 and h3), and one undo step. If Beam 7 is moved so only one pin fits, no half-seated pose is offered. |
| T17 | P1 | `[` on an axle in an axle hole; then `[` on a pin. | Axle: the pose is unchanged and the status names the quarter-turn rule. Pin: a 15° turn, with the pin's point fixed. |

**Camera and keyboard**

| ID | Prio | Action | Expected |
|---|---|---|---|
| T11 | P1 | Middle-drag 200 px starting over point Q on the beam. | Q's projection stays within 2 px of where it started. |
| T12 | P1 | Pinch (`ctrlKey` wheel) or wheel at pixel q over the beam. | The world point under q stays within 2 px of q, and no part moves. |
| T13 | P1 | Orbit downwards with the arrow keys. | Build passes a 100° polar angle. Simulate stops at 90°. |
| T14 | P1 | Double-click an ungrouped part at Q. | Within 400 ms the target is Q (≤ 0.5 LDU) at the same distance. With reduced motion, on the next frame. |
| T15 | P1 | Trackpad scroll (`deltaMode` 0, small deltas, no ctrl). | The camera orbits, and its distance changes by less than 1%. |
| T16 | P2 | Keyboard only: Tab to the pin tile, Enter, Tab to "hole 3", Enter. | The model matches T2, and the aria-live text contained "hole 3". |

## 6. Honesty notes

- §1 lists what I could not confirm: target highlighting during a drag in Studio and LDD, numeric tolerances, all-or-nothing fitting, whether LDD carries connected parts in a drag, orbit pivots, Studio's collision visuals, and touch gestures.
- Where this spec covers those points, the behaviour is a design decision, not a copy of an editor.
- The pixel thresholds (16, 24, 40 and 160 px, and the 8 px hysteresis) are starting values to tune in the gate.
- The key layout is a proposal and is open to change:
  - F stays Fit and X is Flip, so no key means two things.
  - Double-click focuses, except on a grouped part, which keeps its group-edit meaning.

## 7. Implementation notes (2026-10-19)

**Thresholds** (`snap.js` `SNAP_PX`), checked in the browser gate at the Home view on the fixture (Beam 7 holes 38 px apart at 1280×800):

| Threshold | Value | Why it holds |
|---|---|---|
| Idle highlight radius | 16 px mouse, 28 px touch | under half the hole pitch on screen, so at most one hole is ever within reach; 30 px from every hole nothing lights (T5) |
| Target radius | 24 px mouse, 40 px touch | a hole is reachable from anywhere over its own face, never from the next hole's |
| Holding highlight radius | 160 px | about four hole pitches around the pointer: enough to see where the part could go without lighting the whole model |
| Hysteresis | 8 px | 5 px towards h4 keeps h3; at the midpoint plus 3 px h3 is still kept; fully on h4 switches (T4). The current target counts up to radius + hysteresis, or the hysteresis could not hold it past the radius |
| Fallback | 12 LDU | the connector nearest the ray's hit point when none projects within the radius |

The starting values from §6 were kept: every gate reading lies well inside them (camera checks: a middle-drag orbit moves its point 0.00 px, a wheel zoom 0.38 px, a pinch 0.12 px; a double click centres on the clicked point within one pixel's span on the face, at once with reduced motion; the gate waits on that end condition, never on wall time).

**Differences from the text above, and why**

- *Orbit pivot fallback.* With no part under the pointer the pivot is the camera's current target (not the selection or the model centre). Fit, F, Home, a double click and the view cube put the target on the selection or the model, so the result is the same in practice, and an orbit started on empty space never moves the target (the toolbar gate relies on that).
- *Lead connector.* The held connector nearest the grab point does not exclude the others: options are ranked not blocked, more pairs, then nearest the grab point, then least turning (at most four leads per target). A Beam 3 carrying two pins, grabbed near its free middle hole, still seats both pins.
- *Pinning a target.* A click on a lit hole pins it only when its part is already selected: the first click selects (as everywhere else in the editor), the next pins. Pinning on the first click turned every click that selects a beam into a target, so the next palette pick jumped into a hole the learner never meant.
- *Pinned target.* A static amber double ring and a chip ("Target: Technic beam 7, hole 4") with a ✕; no pulse, because the view draws only when something changes (a pulsing ring would redraw every frame).
- *Touch.* The 60 px lift is for a part carried from the palette; dragging a placed part keeps the finger on the part (the tablet gate's grid-step drag depends on it). The ✓ / ⟳ / ✕ cluster shows while a palette part is in hand on a touch device.
- *Hole numbers.* The screen and the screen reader count holes from 1 (h3 is "hole 4 of 7"); §5's h-numbers are connector ids.
- *X* flips a part in hand to the other way round; for a placed part sitting on one connection line it turns half a turn about the world axis most across that line, through the part's middle on the line.
- *Scroll setting.* "Scrolling in the 3D view" (Guess / Always zoom / Trackpad) is in the shortcut sheet (?), kept in localStorage (try/catch).
- *Animation.* Every programmatic camera move eases over 300 ms (Fit, Home/Top/Front/Side, a double click, the view cube); the other browser-gate parts run with `prefers-reduced-motion: reduce`, so they read the camera right after a button; the connect checks test the easing.

**Gate coverage of §5:** T1–T17 run in `scripts/lib/sim-lab-connect-gate.mjs` except the second half of T9 (a moved Beam 7 so only one pin fits), which `test/bw-sim-snap-pointer.test.mjs` covers ("all-or-nothing"). Debug hooks: `window.__bwSimLab.highlights()`, `candidate()`, `ghostTone()`, and `editView.debug.viewCube()` / `animating()`.

## 8. Simulate: speed, readings, sensor rays, replay (2026-10-19)

- **Speed:** 1×, ½× and ¼× in the Program group, over the clock's time scale (also the API's
  `setTimeScale`). Slow motion is paced against the wall clock (`sim-clock.js slowMotionWait`):
  ½× measures 0.47 of 1×'s rate in the gate, where the old per-step wait gave about 0.74.
- **Readings** (Show group): a panel over the view with each motor's angle and speed and each
  sensor's value, now and as a line over the last 10 s, sampled 10 times a simulated second
  through the Robot Lab API.
- **Show sensor rays:** each sensor part's probe (`PartMeta.probe`, part frame) drawn from the
  part; a distance sensor's ray is as long as what it measures (2 m when it sees nothing).
- **Replay:** paused after a run, a slider goes back through the last 20 s of body poses (about 30
  per simulated second). It only shows them: Run goes on from now, and neither physics nor the
  program is rolled back (a program's state cannot be).
- The no-program note above the view is one line at every width; ▸ shows all of it.
- Gate: `scripts/lib/sim-lab-simulate-ux-gate.mjs` (`--part=ui`) on the Wall stopper.

## 9. Challenges on the mats (2026-10-20)

- One per mat (`lib/bw-sim/world/challenges.js`): **One lap** (line oval), **Stop at the wall**,
  **Stay in the ring** (sumo, 30 s), **Through the maze** (to the green cell), **Four corners**
  (colour zones), **Draw a square** (plain: a part marked "Draws on the floor" draws it; judged
  once the robot has stopped, the stars for its two sides alike and its end on its start; the
  Drawing robot's program earns 2). Warehouse has none yet.
- A judge sees only what someone watching the mat would: what the pens drew, the robot's outline on the floor (its
  parts' collider corners, `partOutline` in the Robot Lab API), which mat obstacles it touches,
  and the simulated time. So it works for every hub, firmware and language.
- Stars are for how well: a time, the gap to the wall, how far parts went past the ring. The
  shipped examples earn 2 of 3 (Line follower ~23 s for a lap, 3 stars at ≤ 20 s; Wall stopper
  ~8 cm, 3 stars at ≤ 8 cm), so the third star is for improving them.
- Simulate's **Challenges** button (Program group) lists them with the best result on this device
  (`localStorage` `bw-sim-challenge-best`). Start switches to the mat and puts the robot back at
  the start; Run begins; a result pauses the world. Reset starts the judge afresh.
- Tests: `test/bw-sim-challenges.test.mjs` (each challenge won, each way of losing, on made-up runs);
  gate `scripts/lib/sim-lab-challenges-gate.mjs` (`--part=ui`): the Wall stopper's own program
  wins "Stop at the wall"; on the sumo mat, driving straight on leaves the ring.

## 10. The hinge tool (2026-10-20)

- A selection turns on its **hinge**: one round connection line next to it (a pin or an axle in a
  round hole, a ball in its socket). Cut every joint on that line and the selection comes free
  with everything that hangs off it; that side turns, the other stays (`hingeCandidates` in
  `lib/bw-sim/editor/snap.js`). Studio's hinge tool turns "around a shared connection point" and
  carries the connected side the same way.
- Two parts held at two places stay together (a joint is cut only when all its pairs are round
  and on the line), and the side that stays must be more than the pins on the line, so an arm
  pinned through two holes has no hinge.
- **[ / ]** turn the selection and what hangs off it 15° on its hinge, collision-checked, one undo
  step. **N** shows the hinge as a green line on its axis; pressed again it steps to the next one
  (LDD's Tab through pivots; Tab stays keyboard focus here), Shift+N back. The fewest moving parts
  come first. The properties panel's Rotation section has the same as buttons (−15°, +15°, N).
- Hinges are worked out only when asked for, never on a selection change (a Select all of the
  2,054-part model would search every joint), and a side of more than 400 parts is not offered.
- Tests: `test/bw-sim-hinge.test.mjs`; gate `scripts/lib/sim-lab-hinge-gate.mjs` (`--part=editor`).

## 11. Chains and treads round gears (2026-10-20)

- The first flexible part: the Technic chain link (3711). Select two or more spur gears side by
  side in one plane and press **Chain or tread round** in the properties panel: a closed chain runs
  round the outside of their pitch circles (a gear inside it is not wrapped), its links' pivots
  16 LDU apart (one link spans two teeth), laid in one undo step and then selected
  (`lib/bw-sim/editor/chain-path.js`). The pivots are spaced by the link's straight chord, and the
  chain closes within a fraction of a link's play.
- Refused, with a reason: fewer than two gears, not spur gears, axles not parallel, not in one
  plane, gears too close (their teeth would touch), a gear inside the chain, a link that would
  go into another part.
- Simulate (`lib/bw-sim/kinds/chain.js`, architecture M6): links join where a pivot of one is on a
  pivot of the next; a chain goes round a gear when two of its pivots are on the gear's pitch
  circle. Gears on hinges in one frame then turn the same way at the teeth's ratio (the core couples
  them as a gear mesh, the tooth contact outside the two sprockets on their line of centres; two
  equal sprockets, whose contact would be at infinity, get the fork's `GearConstraint` on both
  hinges, exact at 1:1 — it was measured 27 % off at 16:24, so it is used for nothing else). The links are welded to the frame: in the core they do not move, but the view runs
  them round with their first sprocket (`view/chain-motion.js`: each link slides along the loop of
  the links' places by the chain's travel).
  So a chain in a Studio or LDraw file works as well: the detector reads the links, not a record
  of the tool.
- **Treads**: the same button round two or more tread sprockets (57519, gear type `sprocket`, its
  pivot circle r = 48.54 LDU: one 30-LDU tread link per tooth of ten) lays the 5-wide tread (57518),
  its tread face outward. A tread runs on the floor, so its links are `drawnOnly` (no colliders in
  the core: welded to the frame, they would drag), and each sprocket it wraps gets a wheel collider
  of the tread's outer radius (r + 14 LDU) with a tyre's grip — architecture M6's approximation. A
  frame on two such sprockets drives straight on at the tread's outer speed (test, ±20 %).
  The classic 2.5-wide tread (3873) round its sprocket (32007) is not in yet: LDraw draws 32007's
  bore as a pin hole, so it could only be an idler.
- Warnings: a chain round fewer than two gears; gears whose axles sit in different parts; a gear
  fixed to the frame locks the chain.
- Example models: **Chain drive** (the motor's 16T and a 24T, its program turns it both ways) and
  **Drawing robot** (the driving base, its castor ball a pen; its program draws a square), in the
  model list (`sim-session.js` MODELS; `test/bw-sim-gearbox-program.test.mjs` runs both programs).
- Tests: `test/bw-sim-chain.test.mjs` (the path, the compile, the real core: 8T→24T turns +1/3, a
  16T +1/2, two 8Ts 1:1, links running round, a tread's wheels, a tracked frame driving);
  `test/bw-sim-part-meta.test.mjs` (the sprocket's teeth from the mesh, its pivot chord the tread's
  pitch); gate `scripts/lib/sim-lab-chain-gate.mjs` (`--part=editor`).

## 12. Rubber bands (2026-10-20)

- **Rubber band round** in the properties panel puts a band round the selected parts: round a
  part's circle — its pulley, else a round collider on its hole (a bush, a wheel, a gear: the band
  sits 2 LDU into it), else a pin or an axle (radius 4) — on parallel axles side by side, round
  the outside of them (`lib/bw-sim/editor/belt-path.js`). The band is LEGO's 15, 26 or 33 mm one
  (85543/85545/85546), the one stretched nearest 1.4 times (at most 2.5). Refused when nothing is
  round, the axles cross, even the smallest band would hang loose or the biggest would snap.
- LDraw has bands only as fixed rings, so a band is the model's `belts` record ({id, band,
  around}; `0 !BW BELT <id> <band> <part…>` in LDraw) and its path is drawn as a tube
  (`view/belt-layer.js`). It goes with a part it is round when that is deleted (and comes back
  on undo); **Take off rubber band** removes it.
- Simulate (`lib/bw-sim/kinds/belt.js`, architecture M11):
  - round parts turning on hinges in one frame it is a **band drive** ('band'): the same way round,
    ω_i = (r₀ / r_i)·ω₀, as a chain, but with few velocity steps, so it slips under a load a chain
    would carry;
  - round two parts on other bodies it is a **spring** ('spring'): slack up to
    d₀ = (L₀ − π(r₁ + r₂)) / 2 between the circles' centres, beyond that 4k·(d − d₀) (two strands,
    each k·ΔL), k = 25 N/m for the 15 mm band and softer in proportion for longer ones. The core:
    a distance constraint free from 0 to d₀, a spring beyond;
  - Simulate draws each band round its parts where the bodies are, every frame, so a spring band
    stretches and slackens.
- Tests: `test/bw-sim-belt.test.mjs` (circles, band choice and refusals, the model and LDraw, the
  band drive at 1/3 and the spring pulling an arm in the real core); gate step 5 of
  `scripts/lib/sim-lab-chain-gate.mjs` (`--part=editor`).

## 13. Cables (2026-10-20)

- With the port labels ("Show ports", on by default), Build and Simulate draw a dark cable from each
  plugged-in motor and sensor to the hub its port belongs to: the hub it names (models with several
  hubs), else the model's first hub (`mech/insight.js` `portItems` → `hub`; `view/insight-layer.js`).
- It is a diagram, not a part: it arches over the model from part centre to part centre (so it shows
  between parts that touch), because the parts carry no
  socket positions, so it says WHICH hub a device is on, not where its plug is. It does not collide,
  weigh or pull.
- Gate: the insight gate (`--part=ui`) checks a cable per motor of the driving base, none while
  "Show ports" is off, and the same two in Build; `test/bw-sim-model-insight.test.mjs` the hub
  each port item names.

## 14. Studio mouse, coach marks, Ctrl-glide (2026-10-20)

- **Mouse buttons** (the shortcut sheet, kept on this device): *Brickwright* (left or middle drag turns
  the view, right drag slides it) or *like Studio and LDD* (right drag turns it about the point under
  the pointer, middle drag slides it), in Build and Simulate (`view/camera-nav.js` `MOUSE_PRESETS`).
  In both, a right click without a drag puts down the part in hand (it was described here before
  but not built).
- **Coach marks**: the first time Build opens on a device, a small card in the corner of the view
  shows three tips one after the other (the parts list, holes first, turning and `?`). It is not a
  dialog; Got it puts it away for good (`localStorage` `bw-sim-lab-coach-done`, read in try/catch),
  the shortcut sheet's *Show the tips again* brings it back. An automated browser
  (`navigator.webdriver`) gets it only on `?bwCoach=1`, so it never covers what a gate clicks.
- **Ctrl-glide**: Ctrl+drag on a pin or an axle in its holes slides it along them, following the
  pointer (0.1 LDU), one undo step; it stops where it would come out of its last hole, and a pose
  into another part is refused when let go. Ctrl+click still selects what is connected; neither
  moves the camera any more (OrbitControls pans on Ctrl+drag).
- Gates (`--part=editor`): the connect gate's T11b (right drag orbits about the point, middle drag
  slides, a right click puts the part down), `scripts/lib/sim-lab-coach-gate.mjs`, the hinge gate's
  step 6 (an axle glides up its hole); `test/bw-sim-camera-nav.test.mjs` the presets.

## 15. Ropes and winches (2026-10-20)

- **Tie a rope** in the properties panel: select the drum first (something round on an axle: a bush,
  a pulley, a wheel), then any parts it runs over (sheaves), then the hook last. The rope runs from
  the drum's centre over the sheaves' centres to the top of the hook, taut as they stand, in one undo
  step (`lib/bw-sim/editor/rope-path.js`); **Untie rope** takes it off. It is the model's `ropes`
  record (`0 !BW ROPE <id> <length> <drum> <sheave…> <hook>` in LDraw: LDraw's strings are fixed
  shapes), drawn as a thin tube (`view/rope-layer.js`), and it goes with a part it is tied to.
- Simulate (`kinds/rope.js`, `physics/rope.js`, architecture M10's v1 approximation): the last segment
  is a distance constraint (slack allowed, never longer than the free rope); before each step the
  free length is the rope's length less what the drum has wound (r·θ, + winds in) and less the other
  segments where the bodies are now, so a luffing boom pays rope out or in. The tension turns back on
  the drum (T·r against winding), so its motor feels the load and a free drum is turned by the
  weight. A part hung on a rope is not a loose part.
- Tests: `test/bw-sim-rope.test.mjs` (tied taut, LDraw, undo; in the real core a held drum holds the
  hook, ±6 rad/s winds it up or down by r·Δθ, a free drum pays out under the weight); gate step 6 of
  `scripts/lib/sim-lab-chain-gate.mjs` (`--part=editor`).

## 16. Pneumatics v1 (2026-10-20)

- Parts: the 1 x 11 cylinder (body u9145c01 with its rod 21828c01, a 120 LDU stroke) and the valve
  with axle hole (19474-f1). The valve's lever turns on an axle put through its pivot; its angle
  from where the model has it is the valve's state: past +15° air goes to outlet A, past −15° to B,
  in between the valve is shut.
- **Connect a hose** in the properties panel (two parts selected): a hose from the nearest free valve
  outlet to the nearest free cylinder port (`lib/bw-sim/editor/hose-path.js`), in one undo step;
  **Remove hose** takes off the selection's hoses. It is the model's `hoses` record
  (`0 !BW HOSE <id> <part> <port> <part> <port>` in LDraw: LDraw's tubes are fixed shapes), drawn
  as a blue tube that sags between the nozzles and follows them in Simulate (`view/hose-layer.js`),
  and it goes with either of its parts.
- Simulate (`kinds/pneumatic.js`, `physics/jolt-core.js` `pneumaticDrives`, architecture M12's v1):
  the cylinder is a slider narrowed to its stroke. Before each step the valve's hinge angle picks
  the way: towards the port the open outlet feeds the rod moves at 6 cm/s with at most p·A
  (150 kPa on a 10 mm bore, about 12 N); a shut valve holds it. A program cannot drive the cylinder
  itself; it turns the valve's lever with a motor, as a real motorised valve does.
- Air (v2, `physics/air.js`): the ports a valve's supply reaches through hoses, T-pieces (4697b, drawn
  only, riding on the part their first hose goes to) and air tanks (75974, 37 cm³) are one network with
  an amount of air n = p·V; a tank starts pumped up to 150 kPa. A cylinder fed from it pushes with the
  network's p·A, not the ideal supply's, and each stroke takes (p + p_atm)·A·L of air, so the tank empties
  stroke by stroke (150 → 126 → 105 kPa … for the 1 x 11 cylinder on one tank) until the rod stops.
  A valve whose supply has no hose is still fed ideally (v1).
- A pump (2943bc01 body, 2944c02 piston: a sprung slider, 16 mm stroke, 8 mm bore) hosed into a network
  puts the air it sweeps into it each time it is pushed in (+2.1 kPa a stroke into one tank, up to 250 kPa),
  and the network's pressure pushes back on the piston. A motor works it with a crank or a cam, gravity
  with a weight.
- Simulate's readout shows each network's pressure ("Air 126 kPa").
- Left out, and said so: the air in a cylinder does not compress (a shut valve holds the rod rigidly,
  up to 40 N), the outlet the valve does not feed vents freely, and the lever is drawn where the model
  has it.
- Example: **Pneumatic cylinder** (`static/sim-lab/models/pneumatic-press.ldr`, `programs/pneumatic-press.bw`):
  motor A's axle turns the lever of a valve on a beam on top of it; the valve takes its air from a tank on
  the base, two hoses feed a cylinder pinned to the motor's side; the program turns the lever 40° one way
  (the rod comes out), 80° back (in), twice, and the readout's air falls from 150 to about 67 kPa.
- Tests: `test/bw-sim-pneumatic.test.mjs` (hoses through LDraw and undo, the stroke and p·A, the
  hose tool's port choice; in the real core one way out by 48 mm, the other way back, shut holds;
  a network of tank, T-piece and supply; a tank emptying as n·exp(−A·L/V) per stroke until the rod stops;
  a pump stroke adding p_atm·A·L);
  `test/bw-sim-gearbox-program.test.mjs` runs the example (out 48 mm, back to 0); browser: editor
  gate step 7 (`--part=editor`), and the example run from the pane (`--part=examples`, 8d).
