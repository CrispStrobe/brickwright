# Robot Lab (beta) — LEGO® Technic models with physics

Live physical readings are available in **Simulate → Show → Measurements**:
model-derived presets and custom distances, angles, assembly masses, speeds and
supported loads, with optional updating scene overlays. See
[Live measurements](ROBOT-LAB-MEASUREMENTS.md) for targets, units, saving and
reading provenance.

The Robot Lab simulates a model built from real LEGO Technic parts and lets a program drive it through the **virtual SPIKE Prime hub**, the same hub the SPIKE arena uses. Scratch blocks, DEVICE SPIKE pseudocode and imported SPIKE 3 programs reach it unchanged: they cannot tell the hub is simulated.

The code and its paths call it **Sim Lab** (`lib/bw-sim/`, `sim-lab-pane.jsx`); the learner sees the **Robot Lab** / **Roboter-Labor** tab.

**Continuing this work?** Start with [ROBOT-LAB-AGENT-HANDOFF.md](ROBOT-LAB-AGENT-HANDOFF.md): what landed, how work lands here, what is in flight and the open work packages.

## Where it lives

The Robot Lab is **its own editor tab**, after Blocks, Costumes, Sounds, Code and Circuit (and FPGA when that is switched on): `components/tw-pseudocode/robot-lab-tab.jsx`, appended last in `gui.jsx` so no existing tab index moves (its own index is 5, or 6 with the FPGA tab). The 3D view fills the tab. The tab costs nothing until it is first shown: the pane and its toolbar arrive then (chunk `bw-robot-lab`), the scene, the catalogue and the 3D views after that (chunk `bw-sim-lab`), the physics in its worker (`bw-sim-physics-worker`, Jolt in `bw-sim-jolt`) — `scripts/verify-boot-payload.mjs` checks all four stay out of the first load and out of the arena's chunk. Once shown, the tab stays mounted: the model, the camera and a running program survive a trip to the Code tab.

**One hub, one world.** The Robot Lab and the SPIKE arena (right pane, **SPIKE arena** button in the Code tab) share one virtual SPIKE hub (`lib/virtual-hub/shared-spike-hub.js`), so they never both drive it. The arena no longer embeds the Lab: it offers **Open in Robot Lab**, which shows the tab. While the Robot Lab holds a session the arena is not mounted and says *“The Robot Lab tab is driving the virtual hub now…”*, with **Show the Robot Lab** and **Use the arena here**; the latter closes the Lab's session (its model is saved with the project first) and the tab then offers **Open the Robot Lab here**. The hand-over is three window events named in `lib/robot-lab-events.js`. *Why not show the Lab inside the arena as well:* two views of one session would need two WebGL contexts and two render loops on school hardware, and the arena's own mat would still be a second world; one session in one place, with a button from the other, is the honest model.

**The program it runs** is the project's, on the green flag (Run), through the project's hub: today the virtual SPIKE Prime, behind the VirtualHub boundary (docs/ROBOT-LAB-ARCHITECTURE.md R1); the tab knows nothing SPIKE-specific, so other hubs plug in at that boundary.

## Survey rover: three motors and a nodding sensor head

Choose **Survey rover** / **Erkundungsrover**, load its example program and press
Run on the Plain mat. Motors **A/B** drive the wheels; **C** tilts the distance
sensor on **D**. The rover homes its head, drives 10 cm to a survey point, looks
30° up and 30° down, returns the head to level, and reverses 10 cm to its start.
The Readings panel shows D; the example demonstrates movement and head positioning,
without using distance readings to navigate. Keep manual head movements within
±30° so the sensor cable does not wind around the motor.

The original 28-part model uses catalogue parts and a rear ball castor to support
the head's weight. The head uses **hold** after each positioning move: passive
braking alone lets gravity turn it. Instructions are generated from its actual
connections, including separate pin-insertion steps. Every motor is available to
the motor mixer, Robot Lab blocks and the API.

`test/bw-sim-survey-rover.test.mjs` checks the connections and solid overlaps,
instruction continuity, all three motors under load, independent API control,
and the shipped program through the Scratch VM and virtual SPIKE hub. It measures
the outward trip, return position, head travel and chassis stability; an omitted
return trip must fail its position judge. These are simulation checks, not a
physical LEGO build qualification.

## The toolbar

One row of grouped icon buttons (`sim-lab-toolbar.jsx`, words in `sim-lab-toolbar-text.js`, EN and DE). Every button has its name as its accessible name and a tooltip with the name and the shortcut, e.g. *“Turn 90° (R)”* / *“Um 90° drehen (R)”*, *“Undo (Ctrl+Z)”* / *“Rückgängig (Strg+Z)”*. Icons are inline SVG strokes, as the Code tab's icon is: no icon font, no new dependency.

- **Mode** — a segmented control: **Simulate · Build · Instructions**.
- **Simulate:** **Run/Pause**, **Reset**; **View**: Home, Fit, Top, Front, Side; **Show**: ports, how it moves (switches); **File** menu (Open a model…, Save as .ldr / .mpd / .io). The same scrolling row holds the compact Model/Mat lists, lesson icon and elapsed time. Selecting an example replaces its model, pseudocode and blocks automatically and sets the project title. Run starts it.
- **Build:** **Edit**: Move with arrows (W), Turn with rings (E), Turn 90° (R), Turn back 90° (Shift+R), Tip 90° (T); **Arrange**: Delete, Duplicate, Copy, Paste, Select all, Group, Ungroup, Cancel (Esc); **Undo / Redo**; **View**: Home, Fit (F), Top, Front, Side, Grid; **Show**: ports, how it moves; **Tools**: mirror ↔ / ⇅, Hide (H), Isolate (I), Show all (Shift+H), Measure (M), Eyedropper (K); **Panels**: Parts, Properties, Shortcuts (?); **File**. Under the toolbar: the selection as a chip, its Port list, the hidden-parts chip, and a one-line hint of what a click will do now.
- **Help (?)** at the right end holds what used to be the paragraph above everything: what the Lab is, and how to move the view (and, in Build, how to select and the full shortcut sheet).
- **Narrow panes.** The action row never wraps. Below 1200 px, buttons use their icons; rarer tools remain in **More** (⋯). Scroll horizontally when the core controls exceed the available width. Pop-up menus stay outside the scrolling clip. Below 720 px the parts palette is a drawer; explanatory text opens on request. Under a finger every button is at least 40 × 40 px.
- **Side panels (Build).** The parts palette is a panel left of the view and the properties a panel on its right (from 1280 px; narrower they open over the view); both close from the toolbar and are resized with the app's pane divider (`gui/pane-divider.jsx`; double-click closes).

**Manual controls.** The motion icon shows or hides the entire Drive/Motors bar.
Drive arrows and Motors share one row. Motor sliders start disabled, marked
“Off · program controls motors”; their angles remain live. Enable **Manual
override** to pause the program and use the sliders. Disabling override stops
manual commands; **Run** or the green flag returns control to the program.
The toolbar offers ¼×, ½×, 1×, 2× and 4×. Fast forward schedules additional
normal VM/physics steps; timer durations and physical trajectories keep the
same simulated time. A slower machine may achieve less than the requested rate.

## Moving the view

The same in Simulate and Build (`lib/bw-sim/view/camera-nav.js`):

| Input | Does |
|---|---|
| Left-drag on empty space, middle-drag | orbit about the target |
| Right-drag; Shift+drag in Simulate | pan (in Build, Shift+drag draws a selection box, so Build pans with the right button) |
| Wheel | zoom toward the pointer |
| One finger / two fingers | orbit / pinch-zoom and pan |
| ← → ↑ ↓ on the focused view | orbit 15° (in Build only with nothing selected) |
| Shift+arrows | pan a tenth of the view |
| + / − | zoom in / out |
| Home · Fit (F) · Top · Front · Side | the whole model from that side; Fit keeps the direction |

In Build a press on a part (or on the gizmo) belongs to the part: a drag there moves the part and leaves the camera.

How it is built, and what comes next, is in `docs/SIM-LAB-PLAN.md`.

## Using it (for kids and teachers)

1. Write a SPIKE Prime program in the Code tab (blocks or DEVICE SPIKE text). The reference model drives its wheels with ports **A (left, mounted mirrored) and B (right)**, like the arena's driving base, so `set movement motors A B` and `move forward 20 cm` work as in the arena.
   The **Model** list has the **SPIKE driving base**, the **Line follower** (the same base with a
   colour sensor on port **C** just ahead of the drive axle, for the Line Oval mat), the **Wall stopper**
   (the base with a distance sensor on port **D** looking ahead, for the Wall mat), the **Colour
   explorer** (the base with a colour sensor on port **C** centred ahead of the axle, for the Colour
   Zones mat) and the **Maze runner** (the base with a distance sensor on port **D** looking ahead and a
   colour sensor on port **C** looking down, for the Maze mat). Each of the last four comes with an
   example program: the examples are below.
2. Open the **Robot Lab** tab (or press **Open in Robot Lab** in the SPIKE arena).
3. Press **Run**. As the arena's Start does, Run connects the program to the virtual hub and starts it on the green flag. **Pause** stops the program and the clock; **Reset** reloads the model.
   The program's clock is the simulation's: `wait 2 seconds` is 2 s of simulated time on every computer. When a computer cannot simulate in real time, the whole program runs slower and the status line says how fast, e.g. *“0.40× real time”* (*“0,40× Echtzeit”*); what the robot does stays the same.

**The line follower, ready to run.** Choose **Line follower** in the Model list and **Line Oval** in the Mat list, press **Load example program** (the pane offers it while no SPIKE program is loaded; it puts the program into the Code tab and builds the blocks, and moves the robot onto the Line Oval if it is not there yet), then press **Run**. The robot follows the black line round the whole oval, in about 23 s of simulated time. The program (`static/sim-lab/programs/line-follower.bw`):

```
DEVICE SPIKE

# Robot Lab: follow the black line around the Line Oval mat.
# Model: Line follower (wheels on A and B, colour sensor on C).
# The sensor rides the line's outer edge: on black steer right, on white steer left.
WHEN flag clicked:
  set movement motors A B
  FOREVER:
    IF spike color C is black THEN:
      start tank 30 15
    ELSE:
      start tank 15 30
```

It is a two-state follower: the colour sensor on C rides the line's outer edge, steering right while it sees black and left while it sees white. `test/bw-sim-line-follower-program.test.mjs` runs exactly this text through the Scratch VM, the spikeprime extension and the virtual hub on the shipped model and mat (100 of 100 centre-line checkpoints in order, lap in 22.6 s, at most 2.3 mm off the centre line); `scripts/verify-sim-lab-browser.mjs` does the same through the pane's buttons in the built app. Swapping the two `start tank` lines also works: the robot then follows the line's other edge.

**The wall stopper, ready to run.** Choose **Wall stopper** in the Model list, press **Load example program** (it puts the program into the Code tab, builds the blocks and moves the robot onto the **Wall** mat, 0.64 m from the wall), then press **Run**. The robot drives at the wall and stops about 9 cm before it. The program (`static/sim-lab/programs/wall-stopper.bw`):

```
DEVICE SPIKE

# Robot Lab: drive at the wall and stop before it.
# Model: Wall stopper (wheels on A and B, distance sensor on D looking ahead).
# The distance sensor measures in cm: stop as soon as the wall is closer than 10 cm.
WHEN flag clicked:
  set movement motors A B
  set movement speed 30
  start moving steering 0
  wait until (spike distance D) < 10
  stop movement
```

The model is the driving base plus the distance sensor, held by real connections: two 15-hole beams pinned to the hub's four top holes, a 7-hole beam pinned across their front ends, and the sensor hung under that beam on two pins seated in its blind side holes. No two solid parts overlap, and the sensor is welded into the hub's body. `test/bw-sim-wall-stopper-program.test.mjs` runs exactly this text through the Scratch VM, the spikeprime extension and the virtual hub, and judges the robot's geometry, not the sensor's reading: at rest its foremost point and the sensor's ray origin are both 9.3 cm from the wall's face, and it never touched the wall. The same program with `< 1` stops 4.4 cm out (the sensor reads nothing closer than 5 cm, which the block reports as 0, and 0 is less than 1); with `< 0` it drives into the wall. *Challenge:* make it stop 20 cm before the wall.

**The colour explorer, ready to run.** Choose **Colour explorer** in the Model list, press **Load example program** (the robot moves onto the **Colour Zones** mat), then press **Run**. The robot turns to face the red corner, drives until its colour sensor sees red, rolls on into the square and lights the hub red. The program (`static/sim-lab/programs/colour-explorer.bw`):

```
DEVICE SPIKE

# Robot Lab: find the red square on the Colour Zones mat.
# Model: Colour explorer (wheels on A and B, colour sensor on C looking down).
# Turn left until the robot faces the red corner, drive until the sensor
# sees red, roll on into the square, stop and light the hub red.
WHEN flag clicked:
  set movement motors A B
  set movement speed 30
  reset yaw
  start tank -10 10
  wait until (spike angle yaw) < -130
  stop movement
  start moving steering 0
  wait until spike color C is red
  move forward 15 cm
  set center button light to red
```

The model is the driving base plus the colour sensor, looking down 16 mm above the floor and centred 32 mm ahead of the drive axle: a 5-hole beam pinned across the hub's front holes, the sensor on two pins through it, seated in the sensor's blind side holes. `test/bw-sim-colour-explorer-program.test.mjs` runs exactly this text and checks that, at rest, both the drive-axle midpoint and the sensor's spot are inside the red square (measured: axle at (-0.28, -0.31), spot at (-0.30, -0.33)); the same program waiting for blue drives over the red square and on. *Challenge:* make it find the green square (it is at (-0.35, 0.35): turn the other way).

**The sumo robot, ready to run.** Choose the **Colour explorer**, the **Sumo ring** mat (a white disc with a black band, inner radius 0.335 m and outer radius 0.385 m; the robot starts at the ring centre), put the program below into the Code tab and press Run. The robot drives forward until its colour sensor sees the black band, backs up a little, turns a quarter turn away and drives again — and never leaves the ring. The program (`static/sim-lab/programs/sumo.bw`):

```
DEVICE SPIKE

# Robot Lab: stay inside the Sumo ring.
# Model: Colour explorer (wheels on A and B, colour sensor on C looking down).
# The robot drives forward until the sensor sees the black band, then backs up
# a little and turns away, then drives on again - for as long as it runs.
WHEN flag clicked:
  set movement motors A B
  set movement speed 60
  FOREVER:
    start moving steering 0
    wait until spike color C is black
    stop movement
    move backward 8 cm
    reset yaw
    start tank -20 20
    wait until (spike angle yaw) < -90
```

The Model list keys its entries by the model's file name (one example per model), so it cannot offer a second example for the Colour explorer — the program is loaded from the code above instead. `test/bw-sim-sumo-program.test.mjs` runs exactly this text through the Scratch VM, the spikeprime extension and the virtual hub on the shipped model and mat, for 40 s of simulated time: the drive-axle midpoint never leaves the 0.385 m ring edge, the robot reaches the band more than three times and travels more than 6 m; the same program waiting for a colour the mat does not have (blue) rolls straight out of the ring in seconds. *Challenge:* make the turn angle random so the robot explores the whole ring.

**The maze runner, ready to run.** Choose **Maze runner** in the Model list, press **Load example program** (it puts the program into the Code tab, builds the blocks and moves the robot onto the **Maze** mat), then press **Run**. The robot keeps its left hand on the wall: in every square it turns a quarter to look left with the distance sensor, then ahead, then right, and drives one cell into the first open way (left, then ahead, then right, then back); the colour sensor looking down stops the robot the moment the floor under it is the goal cell's green. From the start it reaches the goal in about 70 s of simulated time. The program (`static/sim-lab/programs/maze.bw`):

```
DEVICE SPIKE

# Robot Lab: find your way through the maze to the green square.
# Model: Maze runner (wheels on A and B, a distance sensor on D looking ahead,
# a colour sensor on C looking down).
# Keep your left hand on the wall: at every square look left first, then
# ahead, then right, and drive that way when it is open. The colour sensor
# stops the robot the moment the floor under it is green.
WHEN flag clicked:
  set movement motors A B
  set movement speed 30
  reset yaw
  REPEAT UNTIL spike color C is green:
    # Look left: turn a quarter to the left and take a reading.
    reset yaw
    start tank -20 20
    wait until (spike angle yaw) < -83
    stop movement
    wait 0.5 seconds
    IF (spike distance D) > 25 THEN:
      move forward 30 cm
    ELSE:
      # Left is a wall. Face ahead again and take a reading.
      reset yaw
      start tank 20 -20
      wait until (spike angle yaw) > 83
      stop movement
      wait 0.5 seconds
      IF (spike distance D) > 25 THEN:
        move forward 30 cm
      ELSE:
        # Ahead is a wall too. Face right and take a reading.
        reset yaw
        start tank 20 -20
        wait until (spike angle yaw) > 83
        stop movement
        wait 0.5 seconds
        IF (spike distance D) > 25 THEN:
          move forward 30 cm
        ELSE:
          # Only the way back is open: face it and drive.
          reset yaw
          start tank 20 -20
          wait until (spike angle yaw) > 83
          stop movement
          wait 0.5 seconds
          move forward 30 cm
  # Home: the floor is green. Stop, light the hub and beep.
  stop movement
  set center button light to green
  play beep 440 0.3
```

The two waits are what make the moves repeatable: `stop movement` shorts the motors and the robot rolls on for a moment, so each turn stops a little past the 83° the block waits for and settles on 90°, and each one-cell drive runs on a moment after its block returns. The 25 cm threshold sits between the two readings that matter: a wall on the edge ahead has its near face 0.15 - 0.01 = 0.14 m from the cell centre and the sensor's ray starts 44 mm ahead of the axle, so it reads about 96 mm, while the nearest open corridor (one cell, then the rim wall's near face at 0.15 + 0.3 - 0.01 = 0.44 m) reads 440 - 44 = 396 mm. The model is the driving base plus the wall stopper's distance-sensor mount and the colour explorer's colour-sensor mount on the same base: two 15-hole beams on the hub's top holes carry a cross beam, the distance sensor (ray 36 mm up) hangs under it on two pins seated in its blind side holes, and the colour sensor sits on a 3-hole beam on the right, held on two pins, looking down 16 mm above the floor. No two solid parts overlap, and the compiler welds both sensors into the hub's body. `test/bw-sim-maze-program.test.mjs` runs exactly this text through the Scratch VM, the spikeprime extension and the virtual hub on the shipped model and mat, for 120 s of simulated time: the colour sensor first sees the goal's green at 70 s, and at rest the drive-axle midpoint (0.49, -0.44) and the sensor's spot (0.52, -0.41) are both on the goal cell's green floor (read from `createMat('maze')`, x 0.3–0.6, z -0.6 to -0.3), and the axle midpoint never crosses a wall's centre plane. The same program waiting for blue (which the mat does not have) never stops. *Challenge:* put the goal behind a wall the left hand alone will not pass, and see the program miss it.


**The differential car, ready to run.** Choose **Differential car** in the Model list (it stands on the **Plain** mat), press **Load example program**, then press **Run**. The car drives ahead, steers left and goes once round a circle (its yaw counts the turn), straightens its wheels and backs up to about where it started — about 20 s of simulated time. Motor A drives the rear wheels through the **differential** (the Differential example's gears: a 12-tooth pinion on the 28-tooth casing, three 12-tooth satellites, a 12-tooth side gear on each half axle), so in the curve the outer rear wheel can roll faster than the inner one. Motor B steers with a **rack and pinion**: it stands upright in front of the hub and turns a 12-tooth gear on a gear rack lying across the car, and a **tie rod** from each of the rack's ends turns a steering arm. The arms reach one hole in and four holes back, so their lines meet at the middle of the rear axle: the **Ackermann** trapezoid, the inner wheel turns further than the outer one (the rack, moving both tie rods as one, takes some of that back). The rack slides in a **guide**: two toggle joints on its ends run along two axles fixed to motor B, and they stop it 12 mm each way. The program (`static/sim-lab/programs/differential-car.bw`) steers by position: 100° of motor B move the rack 10.5 mm (the 12-tooth gear's pitch radius is 6 mm: 0.105 mm per degree) and turn the wheels about 19°; the guide stops the rack at about 115°. The model (`static/sim-lab/models/differential-car.ldr`, written by `scripts/gen-differential-car-model.mjs`): motor A lies over the rear axle with its output pointing down at the casing, held by two 7L posts on each side and a 3L rail under them that carries the half axle; the hub lies over motor A on a thin beam and carries two 11L beams with alternating holes that reach forward to the front axle; motor B stands between them, pinned into their holes across; each front wheel turns on a Technic axle 3L with a perpendicular pin hole (5713) whose axle is its kingpin, so the kingpin meets the wheel's axle (no trail: a parked car does not move when it steers). See docs/ROBOT-LAB-ARCHITECTURE.md *Differential car as built*. `test/bw-sim-differential-car.test.mjs` runs the program through the Scratch VM and the virtual hub and judges it against the geometry: on the straight the car drifts 0.01 mm sideways over 139 mm; in the steady turn (rear axle middle on a circle of R = 295.7 mm, rear track 98.4 mm) the outer rear wheel turns 1.3991 times as fast as the inner one, (R + t/2)/(R − t/2) = 1.3992, and the casing at the mean of the two; the front wheels stand at 19.32° and 18.31°, where the arms and tie rods put them for the rack's 10.45 mm (exact Ackermann would be 16.61°), so the tyres scrub a little and the car turns about a point between the two wheels' own centres, 4.9 % wider than the bicycle model R = L·cot δ (L = 96 mm, 282.0 mm); the rack moves 0.1046 mm per degree of the pinion; steering both ways at full speed, the rack stays within 0.06 mm of the pinion's turn and the car tips 0.12°; the car ends 6.2 cm from its start and never comes nearer than 0.34 m to the floor's edge. Parked, steering ±19° turns the car 0.000°. With one axle through both side gears instead (no differential) the rear tyres scrub: one spins 17 % faster than it travels, the other drags 13 %. *Challenge:* drive a figure of eight.

**The excavator, ready to run.** Choose **Excavator** in the Model list (it stands on the **Plain** mat), press **Load example program**, then press **Run**. The excavator lifts its boom a little, opens the bucket, reaches out, lowers the boom until the bucket's teeth touch the floor, curls the bucket in, lifts it, swings a quarter turn, dumps, and swings a quarter turn the other way and back — about 50 s of simulated time. The program (`static/sim-lab/programs/excavator.bw`) uses six motors: A and B are the wheels (held still), C turns the turntable (an 8-tooth gear on the 28-tooth turntable: 315 degrees of the motor are a quarter turn), D, E and F turn the spindles of three small linear actuators one to one (360 degrees push or pull 1.2 mm), which move the boom, the stick and the bucket. The model (`static/sim-lab/models/excavator.ldr`, written by `scripts/gen-excavator-model.mjs`) is the SPIKE driving base with a 28-tooth Technic turntable on the hub's back top holes (two axle-and-pin connectors 42003 on axle pins), the slew motor behind the hub on 3L pins, castors front and back; on the turntable a small frame, two 9L posts on pins with a cross hole (15100), a 15L boom and a 13L stick; each actuator pivots on an axle that its motor turns through two 16-tooth gears, and a 12-tooth bevel pair inside the actuator's fork turns its spindle. `test/bw-sim-excavator.test.mjs` runs the program through the Scratch VM and the virtual hub and judges the bucket's lowest point against the floor (down to the floor, then lifted 19 cm), the turntable's angle (a quarter turn each way, within 12°) and the base (it turns less than 10° on the floor); without the boom lowering, the bucket never reaches the floor. *Challenge:* dig twice before you swing.

**The crane, ready to run.** Choose **Crane** in the Model list (it stands on the **Plain** mat), press **Load example program**, then press **Run**. The crane lifts its boom from 30 to about 60 degrees, so the hook rises about 4 cm, swings a quarter turn, lets the hook down again and swings back — about 11 s of simulated time. The program (`static/sim-lab/programs/crane.bw`) uses two motors: A turns the turntable (an 8-tooth gear on the 28-tooth turntable, at a tenth of the motor's speed: 315 degrees of the motor are a quarter turn), B turns the spindle of a small linear actuator one to one (360 degrees push 1.2 mm), which pushes the boom up; the actuator's screw holds the boom when B stops. The model (`static/sim-lab/models/crane.ldr`, written by `scripts/gen-crane-model.mjs`) is a SPIKE Prime hub standing on the floor with the Excavator's turntable, slew motor, frame and posts; a 15L boom on a pivot axle through the posts, the actuator's eye three holes up the boom and its pivot five holes under the boom's; a hook (a 5L link and a Technic brick 1 x 4) hangs from the boom tip on a frictionless pin, so it hangs straight down however the boom stands. There is no winch yet: ropes are not on main. `test/bw-sim-crane.test.mjs` runs the program through the Scratch VM and the virtual hub and judges the hook's rise against the law of cosines on the compiled hinge points and the luff motor's encoder (41.8 mm measured, 41.5 mm expected), the turntable's angle against the slew motor's encoder × 8/28 (90.1° for 315°, back to 0.1°) and the hook hanging free (its pin turns with the boom, the link stays within 3° of vertical); without the lift, the hook does not rise. *Challenge:* swing the other way, or lift the boom higher before you swing.

**RCX bumper car / RCX line follower (2026-10-19).** The first robot on another hub: a LEGO MINDSTORMS **RCX 2.0** (LDraw 76454c02) on two 9 V **mini-motors** 71427 (outputs A left, C right, 56 mm wheels straight on their output axles), a ball castor at the front on two Technic bricks, a **touch sensor** 879 as a bumper on the RCX's top front (input 1) and a **light sensor** 9758 looking down beside the castor (input 2, held by a pin/bush connector with two studs; its eye 8 mm over the floor). It is programmed in **NQC** for the RCX's standard firmware: **Load example program** puts the NQC text into the NQC tab, compiles it with the in-browser NQC and downloads it to the Lab's RCX ("Robot Lab RCX", chosen in the pane's *RCX downloads go to* picker); **Run** starts it, as the RCX's Run button does. The NQC tab's *send to brick* and the RCX blocks' download block go to whichever target is chosen there — the IR tower (a real RCX) stays the default and is never fallen back to. The examples: `rcx-bumper-car.nqc` (Wall mat: forward at power 3 until the bumper is pressed, back 0.3 s, turn 0.2 s, stop) and `rcx-line-follower.nqc` (Line Oval: edge following with `THRESHOLD 41` between white ≈ 51 % and black ≈ 31 %, one lap in about 7 s). The two motors are mirror images, so *forward* is `OnRev(OUT_A); OnFwd(OUT_C)`. Power levels set **torque, not speed**: the firmware drives a motor (p+1) of every 8 ms and floats it the rest, so an unloaded mini-motor turns at its full ~360 rpm at every level — at full power the start lifts the robot's front (its wheels are behind the RCX's centre of mass), which is why the bumper car uses power 3. Tests: `test/bw-sim-rcx-hub.test.mjs`. How the RCX is simulated, its sources and what is missing: `docs/ROBOT-LAB-RCX.md`.

**EV3 wall stopper / NXT bumper bot (2026-10-19).** A LEGO MINDSTORMS **EV3** (LDraw 95646) and an **NXT** (53788), each between two Technic beams 15, with two of their motors behind (EV3 large motors 95658 / NXT motors 53787; B left, C right) on 88 mm wheels and two free 88 mm front wheels. The EV3 looks ahead with its **ultrasonic sensor** (input 4); the NXT's **touch sensor** (input 1) is its bumper. Their blocks reach the Lab's brick the way they reach a real one: over **Scratch Link Bluetooth**, where the Lab answers as *Virtual EV3* / *Virtual NXT* while the scene has that brick, and runs the **direct commands** the blocks send (clean-room from LEGO's EV3 Communication/Firmware Developer Kits and the NXT Bluetooth Developer Kit). **Run** connects the loaded EV3 or NXT extension to the brick and presses the green flag. Examples: `ev3-wall-stopper.bw` (DEVICE EV3: drive at 40 % until the wall is closer than 15 cm, brake) and `nxt-bumper-bot.blocks.json` (legonxt blocks, added to the sprite: both wheels one turn, then drive until the bumper touches). The stock Scratch EV3 blocks drive the EV3 too; the DEVICE EV3 example's extension (EV3 Universal) does not yet send over Scratch Link — an upstream bug. Tests: `test/bw-sim-ev3-direct-commands.test.mjs`, `test/bw-sim-nxt-direct-commands.test.mjs`, `test/bw-sim-ev3-extension-bytes.test.mjs`, `test/bw-sim-bt-hubs-program.test.mjs`; gate `--part=hubs-bt`. Protocol, sources, motor model and what is open: `docs/ROBOT-LAB-EV3-NXT.md`.

`scripts/verify-sim-lab-browser.mjs` runs both examples through the pane's buttons in the built app and judges them the same way.

If no SPIKE program is loaded when you press Run, the pane shows: *“No SPIKE program is loaded yet, so nothing tells the motors to turn. Write one in the Code tab and press ⇦ To blocks (or build it with blocks), then press Run — or drive the robot with the arrows below.”* The clock still runs, and the Drive pad works.

**Drive pad.** Below the 3D view, four arrow buttons ▲ ▼ ◀ ▶ and a **Speed** slider (10–100 %, step 10) drive the movement pair (A left, B right, as set in the hub) even with no program. Hold an arrow (or the keyboard arrow keys) to drive; an arrow follows the finger or button that pressed it, so sliding off it keeps driving and lifting that finger (or the browser cancelling it) stops — a second finger on another arrow takes over. The hub readouts show motor positions and sensor values. The slider sets the percent the pad uses for `percentToDps`.

**Mat selector.** A dropdown next to the model name chooses the floor pattern. The mats are in `bw-sim/world/mats.js`:
- **Plain** (`plain`, 1.2 × 0.8 m) — uniform white, the default when no mat is chosen.
- **Line Oval** (`line-oval`, 1.2 × 0.8 m) — a white field with a 20 mm black stadium line (two 0.6 m straights at z = ±0.25 m plus two 0.25 m semicircles). The robot starts **on the line** at (0, 0.25) heading +x, ready for a line follower.
- **Colour Zones** (`colour-zones`, 1.0 × 1.0 m) — four 0.3 m squares in the corners (red at (-0.35,-0.35), yellow at (0.35,-0.35), green at (-0.35,0.35), blue at (0.35,0.35)) plus a 20 mm black border, for colour-sorting tasks.

- **Wall** (`wall`, 1.2 × 0.8 m) — the plain white floor with a blue wall 4 cm thick, 15 cm high and 60 cm wide standing across it at x = 0.4 m (its face toward the robot at x = 0.38 m). The robot starts at (-0.3, 0) heading at the wall (+x). The wall is an obstacle the mat carries (`obstacles` in `mats.js`): choosing the mat puts it into the scene.

- **Sumo ring** (`sumo`, 1.0 × 1.0 m) — a white disc with a 5 cm black ring band centred on the mat (inner radius 0.335 m, outer radius 0.385 m — outer diameter 0.77 m). The robot starts at the ring centre, heading +x, ready for a stay-in-the-ring robot.

- **Maze** (`maze`, 1.2 × 1.2 m) — a 4 × 4 grid of 0.3 m cells with 2 cm grey walls standing on the grid lines at -0.6 + 0.3 k; the goal cell (3,0) has a green floor (colour id 6), the other cells are white. The robot starts at the start cell's centre (-0.45, -0.45) heading +z, ready for a wall-follower. The walls are the mat's obstacles, so the distance sensor sees them.


Choosing the line-oval mat puts the robot on the line, the wall mat puts its drive axle 0.68 m before the wall face, the maze mat puts it at the start cell's centre heading into the maze; the other mats start at (0,0) heading 0.

**Open…** loads your own model: LDraw `.ldr`/`.mpd` from any LDraw editor, a BrickLink Studio `.io` or a LEGO Digital Designer `.lxf` (see *Model files* below). LDraw files from any editor (LeoCAD, BrickLink Studio's LDraw export, including MPD files with `0 FILE` submodels; Studio meta like `!LDCAD`, `!STUDIO`/`PE_TEX` is ignored, `0 STEP` becomes building steps and `0x2RRGGBB` direct colours are kept). Parts the Robot Lab does not know, loose geometry and mirrored parts are listed under **Notes about this model** and skipped; the rest still runs. A motor or sensor is bound to a hub port by a meta line before its part line:
```
0 !BW PORT A
1 71 -100 10 80 0 1 0 1 0 0 0 0 -1 54696p01.dat
```

`0 !BW LOAD` before a part declares an intentional free payload (for example, the Switchback ball). Structural loose parts still produce issues. `0 !BW ROTOR <degrees>` sets a motor output’s initial angle independently of its housing; its encoder starts at zero in that loaded pose. Both annotations survive LDraw/MPD saves. The fixed-library exporter also writes standard LDraw rotor-pose part files for external viewers. See [the arm, lift and straight-line examples](ROBOT-LAB-ARM-LIFT-AND-STRAIGHT-LINE.md).

Without WebGL the pane says so and the simulation still runs (encoders and yaw keep working; only the picture is missing).

**Model files** (`bw-sim/model/model-file.js`). **Save as…** (Build and Simulate) writes the model on show as `.ldr`, `.mpd` (one `0 FILE` section) or `.io`; all three read back to the same model, byte for byte for the LDraw text.
- **BrickLink Studio `.io`** is a ZIP whose `model.ldr` is the model in plain LDraw with LDraw colour codes (LDraw wiki "IO"; read the same way by the open-source readers in vengi and brick-mcp). Opening reads only `model.ldr`; parts Studio carries in `CustomParts/` are listed as Studio-only, other parts the Robot Lab does not know as unknown. Studio's own library has 127 part names in another frame than upstream LDraw (the MIT-licensed census in tribixbite/craftmatic); none is a Robot Lab part, so nothing is re-framed. **Older Studio versions encrypt the archive: such a file is refused** with a message to re-save it in a current Studio or export LDraw there — the Robot Lab does not open protected archives. Saving writes a plain ZIP holding `model.ldr` (the `.ldr` save byte for byte, `!BW` ports, ids and groups inside as LDraw comments); not written: the thumbnail, `.info`, `model2.ldr`/`modelv2.ldr`, instruction settings and `CustomParts/`.
- **LEGO Digital Designer `.lxf`** (LDD 4, LXFML version 5; open only) is a ZIP with `IMAGE100.LXFML`. Each `<Part>` becomes the LDraw part of the same number (LDD design numbers are LEGO's moulded design numbers, which LDraw also uses as file names). No per-part frame table is kept (the community `ldraw.xml` mapping file has no licence statement, so it is only a local check): the frame is worked out from the part's geometry where that is safe (`bw-sim/model/ldd-frame.js importFrame`: stud-grid parts, pins, axles, bushes, straight beams) and otherwise from its connections in the model (`bw-sim/model/ldd-snap.js`; docs/ROBOT-LAB-LDD-FRAMES.md). LDD units are 25 LDU, LDD is +y up. Materials are LEGO colour numbers, mapped through LDraw's own `LDConfig.ldr` `LEGOID` comments. A design outside the table that is a plain studded catalogue part (brick, plate, tile) is placed from its geometry and flagged `lxf-derived-frame`; any other design — every SPIKE element included — is listed and left out; so are mirrored parts; an unknown material keeps the part in light bluish grey. Why LDD needs per-part offsets at all, how far geometry predicts them, and the two planned better routes (snapping to connections; the user's own `ldraw.xml`): `docs/ROBOT-LAB-LDD-FRAMES.md`.

**What opens and what saves (2026-10-18).**

| Format | Program | Open | Save | Notes |
|---|---|---|---|---|
| `.ldr` | LDraw (LeoCAD, LDCad, MLCad, Studio export) | yes | yes | the format of record |
| `.mpd` | LDraw multi-part | yes (sub-models flattened) | yes (one `0 FILE`) | sub-model structure is not kept |
| `.io` | BrickLink Studio | yes (unencrypted) | yes | only `model.ldr` is read/written |
| `.lxf` | LEGO Digital Designer | yes (27 Technic parts + studded parts) | no | LDD can export `.ldr` itself |
| `.sb3` | Brickwright project | yes | yes | the model rides inside, byte for byte |

Not supported: Mecabricks `.zmbx`, LDD `.lxfml` without the ZIP, BrickLink/Rebrickable parts lists (XML/CSV), 3D export (STL/OBJ/glTF), Studio's encrypted `.io`.

**Limits and what a damaged file does.** The LDraw reader refuses by name, never throws and never opens half a model: sub-models nest at most 32 deep (`too-deep`, that copy left out), a model flattens to at most 20,000 parts (`too-many-parts`: nothing opens), a coordinate beyond 10⁶ LDU is `out-of-range`, a garbled number or colour refuses its line (`unparsable`; `parseFloat`'s "12abc" → 12 is not accepted), a matrix must be a rotation to 0.02 (rows orthonormal, determinant positive: a mirror, scale or shear is `bad-matrix`; a rotation written with three decimals, as MLCad does, is accepted and made exactly orthonormal, while our own six-decimal rotations are kept as written). A part in colour 16 inside a sub-model takes the colour the sub-model is placed in; direct colours are written as `0x2RRGGBB`. An MPD section that is a part (`.dat`, or `!LDRAW_ORG …Part/Subpart/Primitive/Shortcut`: an embedded unofficial part) is placed as the catalogue part of that name or refused once as unknown, never opened up into its primitives; of two sections with one name the first counts. A ZIP that JSZip cannot read (bad CRC, cut off, sizes that do not match) is `not-a-zip`; an entry declaring more than 32 MB is `model-too-big`; an LDD bone with absurd numbers is `lxf-bad-transform`.

**Testing the readers and writers (2026-10-18).**
1. **Every shipped and generated model** (`test/bw-sim-model-roundtrip.test.mjs`): the six shipped models and the 2,054-part stress model go `.ldr`, `.mpd`, `.io` and the project's `simLab` record (and the stress model through a real `.sb3` via the bundle writer/reader) and back, compared as models (part, colour, pose to 1e-6 LDU, port, id, group, steps) and byte for byte.
2. **Randomised round trips** (same file; seeded, a fixed 150 + 150 cases, the seed in every failure, `modelCase(seed)`/`mpdCase(seed)` rebuild one): random catalogue parts, the 24 axis-aligned rotations and uniformly random ones, every LDConfig colour and direct colours, ports, ids, groups, `0 STEP`, through every format; and random MPDs with nested sub-models placed several times (colour 16 inherited, ports inside) flatten to exactly what placing every part by hand gives (`test/fixtures/bw-sim/model-gen.mjs`, its own matrix arithmetic). Minimal reproductions of each bug found are tests in the same file ("found: …").
3. **Real files from other programs** (`test/bw-sim-model-foreign.test.mjs`, fixtures and licences in `test/fixtures/model-files/SOURCES.md`): three LDraw OMR Technic sets (CC BY 2.0) — 42022 Hot Rod (MLCad-style, three-decimal rotations, 3 deep), 42032 Compact Tracked Loader (LDCad 1.4, 4 deep, an embedded unofficial part), 42034 Quad Bike — each against what it must open to, written down by hand from the file text (leaf count 414/251/147, named parts placed by hand with colour and rotation); unknown parts are refused line by line by name, the rest opens and round-trips byte-stably. **Missing:** a Studio 2.x `.io` and an LDD `.lxf` with an open licence (none found; one real `.lxf` with only a bare "BSD" tag was opened locally, not vendored) — the owner can supply files saved in Studio/LDD (`SOURCES.md` says what would help).
4. **Our files read by LeoCAD** (`scripts/check-model-files-leocad.mjs`, not in CI yet): every shipped model and OMR fixture is saved as `.ldr` and `.mpd` and given to `QT_QPA_PLATFORM=offscreen leocad -l <library> --export-csv out.csv <file>`; LeoCAD's parts list (part, colour code, quantity; sub-models flattened) must equal ours. The CSV export needs LeoCAD 23.03 or later and creates no render context (offscreen is enough). **Proposed CI job** (the lead decides; not in `build.yml`): on `ubuntu-latest`, download the LeoCAD release AppImage and its `Library-*.zip` from github.com/leozide/leocad/releases (pinned version and sha256), `--appimage-extract` it (no FUSE on the runners), unzip the library, `npm ci`, run the script; about 2–3 minutes, no GUI build needed. Ubuntu's apt `leocad` (21.06 on 22.04/24.04) has no `--export-csv` and no parts library (`ldraw-parts` is a separate multiverse package), so apt alone is not enough. Not run here yet (nothing big installed on the Mac); the first CI run confirms it.
5. **Fuzzing** (`test/bw-sim-model-fuzz.test.mjs`; seeded, 120 cases per family): mutated `.ldr`/`.mpd` (truncated, garbled characters, absurd numbers — 1e308, NaN, Infinity, hex, empty — stray metas, a line repeated thousands of times, other line ends), mutated `.io`/`.lxf` bytes (truncated, garbled data, a garbled central directory, absurd entry counts), broken LXFML (lost closing tags, broken attributes, absurd transforms, thousands of parts), ZIPs with the wrong entries, deep nesting (20,000), cycles, sub-models doubling at every level (2⁴⁰), 30,000 parts, and mutated `simLab` records. Each case either refuses the whole file with a code the pane words, or opens a valid model in which every non-comment line of a single-file model is a part or a named refusal; each case is timed (3 s budget).
6. **Studio and LDD, by hand, once per release** (they do not run headless):
   - [ ] Save the driving base and the forklift as `.io`; open both in a current BrickLink Studio 2.x: every part present, colours right, the hub's ports and ids survive a save in Studio and reopening in the Robot Lab (Studio keeps `0 !BW` comments in `model.ldr`).
   - [ ] Open a Studio-made `.io` with a sub-model and a Studio-only part in the Robot Lab: the sub-model is flattened, the Studio part is listed as Studio-only.
   - [ ] Save as `.mpd` and `.ldr`; open in LeoCAD and LDCad: the same parts, poses and colours; `0 STEP`s become steps.
   - [ ] In LDD 4.3, build a small model from the 27 table parts (beams, pins, axles, gears) and one brick; save `.lxf`; open it in the Robot Lab: parts where LDD shows them, the brick placed with `lxf-derived-frame`, other designs listed by number.
   - [ ] Note the program versions and any difference here.

**Big models.** A model of 200 parts or more is drawn instanced (`bw-sim/view/instanced-parts.js`): one `InstancedMesh` per part geometry for its own-colour faces and one for its fixed-colour faces, and instanced edge and conditional-edge lines; the placed colour is a per-instance colour, a motor's drive hub keeps its own batch and turns. Every part keeps an invisible mesh where it always was, so picking in Build, port badges, tints and highlights work unchanged. In Simulate a big model is redrawn only when something changed. `scripts/measure-sim-lab-scale.mjs` measures the 2,054-part stress model (`scripts/lib/sim-lab-stress-model.mjs`) with instancing on and off. Measured 2026-10-18 on an Apple-silicon Mac (headless Chromium; instanced vs one mesh per part): through ANGLE/Metal a forced frame 19.5 vs 30.7 ms (pixel read-back included), 43 vs 6,130 draw calls, JS heap after opening 37.8 vs 64.3 MB, opening 1.3 vs 1.7 s; through SwiftShader (the browser gate's software GPU) 3.2 vs 4.7 s a frame — rasterising 4.3 M triangles and 3.4 M line segments dominates there — and opening 4.9 vs 6.8 s. Build on the full model (after the 2026-10-18 performance work: a frozen, structurally shared editor model instead of a deep copy per read, a spatial hash for overlap/snap/picking/insight, redraw only on change): idle frame 4,650 → 16.7 ms, pointer move 8,200 → 12–54 ms, click-select from never-within-180 s to 44–71 ms, opening Build 98 s → 13–28 s (SwiftShader, Mac under load; the 10 s target is not met yet). The scale gate runs Build on the full model with budgets written next to these measurements.

**Saved with the project.** “Save to your computer” stores the model the Lab shows (the Build scene, or the model being simulated) inside the `.sb3`, as its LDraw text, in the `simLab` section of the Brickwright bundle (`lib/bw-project-bundle.js`; record in `bw-sim/model/sim-lab-persist.js`). Opening the project restores it byte-for-byte; a project without one opens the reference driving base. Vanilla Scratch ignores the entry. Saving (`serializeModel` in `bw-sim/model/ldraw-model.js`) writes a flat single-file model (first FILE is main, submodels expanded), not an MPD.

## Steering the Lab from blocks, `lab` words and Python/JS

Owner (2026-10-18): *"all must be steerable also by pseudocode and blocks and other code flavors. motors etc directly by code/blocks. and also the hubs."* The Lab has one API, `lib/bw-sim/api/robot-lab-api.js`, and four ways to reach it — one method list, so a block, a word and a call are the same thing:

| Block (extension **Robot Lab**, `robotlab`) | `lab` word | Python / JS (`_robotlab.…`) |
|---|---|---|
| load model [motor-bench] | `lab load model motor-bench` | `loadModel("motor-bench")` |
| start the simulation | `lab start` | `start()` |
| stop the simulation | `lab stop` | `stop()` |
| reset the simulation | `lab reset` | `reset()` |
| set motor [A] power to [50] % | `lab set motor A power to 50 %` | `setMotorPower("A", 50)` |
| run motor [A] at [360] °/s | `lab run motor A at 360 degrees per second` | `setMotorSpeed("A", 360)` |
| run motor [A] for [360] degrees at [180] °/s | `lab run motor A for 360 degrees at 180 degrees per second` | `runMotorDegrees("A", 360, 180)` |
| stop motor [A] and [brake/coast/hold] | `lab stop motor A brake` | `stopMotor("A", "brake")` |
| (motor [A] angle) | `(lab motor A angle)` | `motorAngle("A")` |
| (motor [A] speed) | `(lab motor A speed)` | `motorSpeed("A")` |
| (sensor [D] value) | `(lab sensor D value)` | `sensorValue("D")` |
| (part [hub] [x/y/z/heading]) | `(lab part "hub" x)` | `partPosition("hub", "x")` |
| (Robot Lab status) | `(lab status)` | `status()` |
| when part [gear] touches [ground] | `WHEN lab part "gear" touches ground:` | `_robotlab.on("robotlab_whenTouch", fn, "gear", "ground")` (events mode) |

- **Blocks**: *Add Extension → Robot Lab*. Every block calls one method of `runtime.robotLab`, which the Lab's pane installs when it opens (the `runtime.nqcCompile` / `runtime.rcxDownload` hook pattern). Before the Robot Lab tab has been opened there is no API: commands do nothing, reporters answer 0, the hat stays quiet and *Robot Lab status* says `not-open` — a program never crashes on a closed Lab. Motor and sensor menus offer the model's ports; any text works too: a port, a motor's part id (its `!BW ID`) or an actuator id (`a0`). EN and DE.
- **`lab` words** work under any `DEVICE` line (or none). The table is `lib/robotLabDialect.js`, one table for the parser and the decompiler; a part name is "quoted" (`lab part "gear" x`), a bare word in a menu slot is a variable, as everywhere in the dialect. The words are lite's: they are layered on the pinned sb3-creator compiler at its registering door (`lib/robot-lab-pseudocode.js`, `lib/sb3-creator-register-art.js`), which stays byte-identical to upstream.
- **Python/JS**: the Code tab writes `_robotlab.<method>(…)` and reads it back into the same blocks. The *simulated board* driver binds `_robotlab` to the Lab's API when the program runs in the page beside an open Lab; in the Code tab's console (a Web Worker, Skulpt) there is no Lab to reach, so the driver is neutral — press **⇦ To blocks** and the green flag to run a program in the Lab. Hats need *events* mode (as every extension hat does).
- **Run** in the Lab presses the green flag for a Robot Lab program as for a SPIKE one; *start the simulation* inside a script never does (no loop). A motor told to turn makes the world run, like holding the drive pad's arrow.
- **Units**: degrees and degrees per second for motors (the encoder angle, unwrapped), power −100…100 %, positions in cm (world frame, y up), heading in degrees clockwise seen from above (0 at load), distance in cm (−1 when nothing is in range), colour as a word (`red`, `none`), force 0–100.

**Program connections and brick inputs.** Use **Program connection** to choose a model brick and its
Bluetooth, USB serial, local bridge or HTTP route, when supported by the loaded extension. **Connect**
establishes the link; **Run** starts the program. Disconnecting, replacing the model or closing the Lab
invalidates outstanding connections. **Brick buttons** holds the model's inputs with the pointer, Space
or Enter and releases them on cancellation or pane closure. Hosts use `brickButtons()`,
`holdButton(hub, button)` and `pressButton(hub, button, pressed)` on the same Lab API.
See [connections and buttons](ROBOT-LAB-CONNECTIONS-AND-BUTTONS.md) for endpoints, supported inputs and limits.

**Which motors a program may turn directly.**
- A model **with no hub** (the *Motor bench* model) runs on the Lab's own `lab-direct` hub (`bw-sim/hubs/lab-direct/`), which owns every motor of the model. Its controller is the SPIKE hub's (trajectory generator + PI/damping loop into the DC model, `hubs/spike/spike-motor-controller.js`): power is an open-loop duty; speed and degrees are regulated; *run for degrees* ends when the **encoder** is within 1° of the target and slower than 10 °/s, then brakes (or holds) — never on a clock. Measured: 360 ± 2° (the bound is derived in `test/bw-sim-robot-lab-api.test.mjs`).
- A motor on a **SPIKE hub port** run from Scratch blocks: the command goes to that hub's own controller, exactly as a SPIKE block's does (one owner per port; the last command wins, as between two blocks). The API's `{power}` there is a speed (N % of the motor's top speed, as `start motor A forward` at speed N); a program's **start motor at % power** block is the unregulated duty (*Motor power* below).
- A motor on a hub that **runs its own program** (the SPIKE firmware route; the RCX VM when it lands here) is **refused** by name: *"Motor A belongs to the SPIKE Prime hub, whose own program drives it."* Two programs fighting over one port is not something a child can debug, and the hub program is the one the learner chose to run there. (Chosen over "allowed while the hub program is idle": an idle firmware still owns its ports and may start any moment.)
- Every command crosses the VirtualHub boundary as port data and reaches the motor on the next 5 ms step. With the physics in the worker, a command made while a batch is in flight redoes that batch from the worker's checkpoint, as SPIKE commands always have: part poses are bit-identical to the main-thread run (tested).

**The API for gates and hosts** (`window.__bwSimLab.api`, `runtime.robotLab`): scene — `status()`, `models()`, `loadModel(id | LDraw text)`, `start()`, `stop()`, `reset()`, `setTimeScale(0.1…4)` (slow motion or requested fast forward; achievable speed depends on physics throughput), `camera('home'|'top'|'front'|'side'|'fit' | {follow: partId})`; lists — `motors()`, `sensors()`, `parts()`; control — `setMotor(actuator | part | port, {power} | {speedDps} | {degrees, speedDps, then} | {position, speedDps, then} | {stop: 'brake'|'coast'|'hold'})` → `{ok, done?}` or `{ok: false, code, message}`, `stopMotor(ref, action)`; reads — `encoder(ref)`, `readSensor(ref)`, `pose(partId)` (world position, quaternion, heading), `touching(a, b)`, `onContact(a, b, fn)` (a part, `ground`, or a mat obstacle such as `wall`; checked after every step, edge-triggered; boxes from the compiled colliders with a 1 mm margin). It reads the session only through its public surface and imports nothing from `physics/` or `mech/` (`test/bw-sim-hub-boundary-imports.test.mjs`).

## Powered Up, BOOST and WeDo 2.0 hubs

The Lab simulates the LEGO hubs a program reaches over Bluetooth Low Energy, and the **real** LEGO extensions
drive them, unchanged: their transport is swapped underneath (docs/LWP3-VIRTUAL-HUB-NOTES.md has the protocol
coverage and every source).

| Hub | Part | Extension(s) | Example model |
|---|---|---|---|
| Technic Hub (Control+) | 22127 | **LEGO Powered Up** (`legopoweredup`) | *Technic Hub motor bench* — motor A turns one full turn and back |
| BOOST Move Hub (motors A, B built in) | 26910 | **LEGO Boost** (`legoboostunified`), scratch-vm's *LEGO BOOST* | *BOOST rover* — drives ahead with one "AB" block, then spins on the spot |
| Powered Up Hub (City), SPIKE Essential | 28738, 67351c01 | `legopoweredup` | — (parts and hubs; build your own) |
| WeDo 2.0 Smart Hub | 19071 | **LEGO WeDo 2.0** (`wedo2unified`), scratch-vm's *LEGO Education WeDo 2.0* | *WeDo 2.0 rover with motion sensor* — drives until the sensor sees the wall |

- **Run** connects the program's LEGO extension to the scene's hub — the extension's own *connect* (its block's
  function), over whatever connection it is set to: *Web Bluetooth* reaches the hub through the Web Bluetooth shim,
  *Scratch Link* through a Scratch Link double that answers only while the Lab connects (a real Scratch Link is used
  any other time) — then presses the green flag. The hubs speak the hub's own bytes: LWP3 for the Powered Up family
  (LEGO's public document), the WeDo 2.0 GATT service for WeDo. Motors with a tacho are regulated by the hub
  (StartSpeed, ForDegrees, GotoAbsolutePosition, end states float/brake/hold, MaxPower), WeDo's are not.
- **Words**: `pup …`, `boost …`, `wedo …` are the three extensions' commands and reporters, one table for the parser
  and the decompiler (`lib/legoHubsDialect.js`), under any DEVICE line: `pup turn motor A on for 360 degrees`,
  `boost turn motor A on`, `wait until (wedo distance) < 5`. **⇦ To blocks** makes the real extension's blocks.
- **Ports**: a motor or sensor part says its port with `!BW PORT`; the Move Hub's motors A and B are inside the hub.
- **Not modelled**: the extensions' Python/JS calls in the Lab; hats and Boolean blocks as words; Port Mode
  Information; synchronised (virtual) ports. **Found in the extensions** and fixed upstream (CrispStrobe/extensions
  `ea3e08e`, vendored): the BOOST blocks sent 10 % max power, a block for "AB" reached A only (a 50 ms rate limit),
  and they addressed the Move Hub's pre-1.0.00.0224 port map. Now "AB" reaches both — B 50 ms after A (a queue),
  which turns a rover a little at the start, as on a real hub — and the Lab's Move Hub runs the current firmware
  (1.0.00.0224) or, as an option, the legacy one (1.0.00.0223); docs/LWP3-VIRTUAL-HUB-NOTES.md "Findings".

## Motor power: a duty cycle, on every hub that has one

Most motor blocks ask for a **speed**, and the hub keeps it: under load it raises the power until the
speed is back (a regulated motor). **Start motor at % power** asks for a **duty cycle** instead (the
share of the time the motor gets the battery's voltage, "PWM"): nothing holds a speed, so the motor
slows down when it has to push and stops — stalls — at a hard stop, pushing with that share of its
stall torque. In the Lab the duty goes straight into the motor's DC model (`physics/actuators.js`),
so it does all of that for the same reasons a real motor does.

| Hub | Block (extension) | Word | What the hub is sent | Source |
|---|---|---|---|---|
| SPIKE Prime / Robot Inventor | **[A] start motor at [100] % power** (`spikeprime_motorStartPower`) | `start motor B at 50 % power` (DEVICE SPIKE) | SPIKE 3: `motor.set_duty_cycle(port.B, 5000)` (−10000…10000); 2.x: `hub.port.B.motor.pwm(50)` (−100…100) | the SPIKE app's *More Motors* extension, "start motor at % power"; SPIKE 3 Python `motor.set_duty_cycle(port, pwm)`; the 2.x hub module's `pwm(duty_cycle)` |
| Technic Hub, City Hub, SPIKE Essential | **start motor [A] at [50] % power** (`legopoweredup_motorStartPower`) | `pup start motor A at 50 % power` | LWP3 StartPower(Power) as WriteDirectModeData mode 0 | LWP3 §3.27.1 "adjustable PWM output … no speed regulation", §6.1 |
| BOOST Move Hub | **start motor [A] at [50] % power** (`legoboostunified_motorStartPower`) | `boost start motor AB at 50 % power` | LWP3 StartPower, each motor of the block | LWP3 §3.27.1, §6.1 |
| EV3 | **start motor [B] at [50] % power** (`ev3comprehensive_motorStartPower`) | `start motor BC at 50 % power` (DEVICE EV3) | opOUTPUT_POWER + opOUTPUT_START | EV3 Firmware Developer Kit: OUTPUT_POWER, against OUTPUT_SPEED's speed regulation |
| NXT | **start motor [B] at [50] % power** (`legonxt_motorStartPower`) | `nxt start motor B at 50 % power` | SETOUTPUTSTATE: MOTORON + BRAKE, regulation IDLE | NXT Bluetooth Developer Kit, Appendix 2 |
| WeDo 2.0 | **set motor power to [N] %** + **turn motor on** (already) | `wedo set motor A power to 50 %`, `wedo turn motor A on` | the Output Command's power: a duty | the WeDo 2.0 motor has no encoder, so the hub has nothing to regulate |
| RCX | NQC `SetPower` / `OnFwd` (already) | — | power levels 0–7, drive/float PWM | the RCX motors have no encoders |
| The Lab's own hub (no hub in the model) | **set motor [A] power to [50] %** (Robot Lab, already) | `lab set motor A power to 50 %` | an open-loop duty | — |

Names to tell apart: **set motor power to … %** on the Powered Up and BOOST blocks, **run motor … at … %** on
EV3 and **motor … power …** on NXT are speeds the hub regulates (StartSpeed, OUTPUT_SPEED, MOTOR_SPEED) — LEGO's own Scratch blocks call that number
"power" too. Only WeDo 2.0 (no encoder) and the RCX have no regulated speed at all.

What the Lab does with it (tests): SPIKE, `test/bw-sim-spike-power.test.mjs` — at 50 % power the medium
motor runs at 527.5 °/s free (u·ω0 = 529.0), and under 30 % of its stall torque it slows to 206.9 °/s and
stays there (the line says 207.4; the hub's speed loop holds the same load at its set speed); at 50 % it
holds an arm 3 % lighter than half its stall torque and lets one 3 % heavier sink.
`test/bw-sim-differential-car.test.mjs` — the Differential car's program `start motor B at 50 % power`
pushes the rack into the guide's stop: B rests at 114.4° (the geometry says ±114.6°) and the parked car
turns 0.014° (−50 %: −114.3°, 0.045°). Powered Up, `test/lab-hubs-extensions.test.mjs` — `pup start
motor A at 50 % power` sends one StartPower(50) and the Technic large motor runs at 942 °/s (0.5·ω0 at
the hub's supply: 945). EV3 and NXT, `test/bw-sim-bt-hubs-program.test.mjs` — the bricks drive both
motors open loop at a duty of 0.4.

Found on the way (fixed upstream, CrispStrobe/extensions #62): spikeprime's **start motor** fell back to
`hub.port.X.motor.pwm(speed)` when the hub did not take its JSON verb — on a real 2.x hub a duty, not the
speed the block asks for. The Lab's virtual SPIKE hub takes that fallback, and read `pwm` as a speed until
now; the fallback is `run_at_speed(speed)` now, and `pwm` means a duty everywhere.

Not there: a **motor power** reporter (SPIKE's *More Motors* has one, `motor.get_duty_cycle` in SPIKE 3
Python): the spikeprime extension has no block for it yet, so `motor.get_duty_cycle` stays refused by the
SPIKE 3 Python reader.

## Seeing the model

Kids cannot read `motor-without-port`; the Lab shows what a model is made of and what is wrong with it (`bw-sim/mech/insight.js` computes it, `bw-sim/view/insight-layer.js` draws it, the words are in `components/tw-pseudocode/sim-lab-insight-text.js`, EN and DE):

- **Notes about this model** lists every issue as a sentence for children ("SPIKE medium angular motor is not plugged into the hub yet: click here, then choose a port (A–F) on its label"). An issue that names parts (`parts` on the diagnostic or refusal) is a link: in Build it selects those parts and frames them, in Simulate they pulse orange for 3 s. In Build the list comes from compiling the editor's model 150 ms after the last edit (about 8 ms for 72 parts).
- **Before you press Run:** a box above the view says when no motor is plugged in, there is no hub, or the model falls apart (two or more loose groups, or loose parts that are a quarter of the model). A part is **loose** (`loose-part`) when no joint links its body, directly or through others, to the hub's body.
- **Show ports** (on by default): a badge next to every motor and sensor with its hub port, or **?** when it has none. In Build a click on a badge selects the part and opens a port picker (none, A–F).
- **Show how it moves** (off by default): every rigid body in its own pastel colour (parts in one colour move together), each hinge axis as a thin arrow (red: a motor's, blue: a free hinge), a blue dot at a ball joint, and a violet line between meshing gears with their tooth ratio ("1:3"). In Simulate the marks ride on the moving bodies.

## Building instructions

Kids who built a robot in the Lab (or opened an example) can build it for real: **Instructions** (next to Simulate / Build; **Bauanleitung** in German) opens the model on show as the pages of a LEGO manual.

- **Each step** shows the parts built before in their colours, a little paler, and the parts new in this step in full colour, outlined in orange. The camera always looks from the front-right above and frames the new parts with the model around them. A **Parts needed** box lists the step's new parts with their pictures (the Build palette's, in the part's colour) and counts; axles carry their length in a circle ("4" for an axle 4), straight beams their holes, a 3L pin its 3.
- **Where each part goes** (2026-10-20; the page also turns the model when the new parts go on at the back or the left side, and says so): every new part that slides on (along the pin, axle or hole that seats it in a part already built) flies in from three studs away, three times, then rests in place; on the printed page, and for a reader whose system asks for reduced motion, it is drawn pulled out with an orange arrow home (from the face of its box that leads the way). A new pin or axle hidden in a hole keeps its outline drawn faintly through what covers it (X-ray, small parts only), so the page shows which hole it went into. A pins step says "First push these pins and axles into the model, where they are shown in orange."
- **Previous / Next** or **← / →** turn the pages ("3 / 12"); **Esc** closes. The last page is the **parts list**: every part with its count and its EN/DE name.
- **Print / Save as PDF** draws every step into one page in a new window (one picture per step, then the parts list) and opens the browser's print dialog; choose "Save as PDF" there. Pop-ups must be allowed for the page.

**The step order** (`bw-sim/instructions/steps.js`, pure). A model whose LDraw file has `0 STEP` (or `0 ROTSTEP`) lines is built in those steps: `model/ldraw-model.js` keeps them as `model.steps` and writes a `0 STEP` after each step when it saves, so they survive Build and the project file (a model without them is written exactly as before). Parts added since come after them, in derived steps. Otherwise the steps are worked out from the connector graph (`mech/graph.js`):

1. the hub first (or, without one, the heaviest part);
2. then a breadth-first walk over the structural parts (beams, motors, sensors, wheels, gears, connectors), neighbours being parts that touch directly or through pins and axles;
3. a pin, axle or bush goes on in the step where the *second* part it joins does: a pin with the beam it holds on, an axle with the wheel it carries (one that sits in another, such as a bush on an axle, counts with it);
4. about four parts per step, at most six unless one part brings more fasteners; a one-part step joins the step before when that stays within six;
5. an editor group (`0 !BW GROUP`) whose parts hold together on their own is a **sub-assembly**: built on its own pages right before the step that attaches it;
6. a part that touches nothing built starts a step marked loose ("This part does not connect to the rest yet").
7. **mirrored pairs go on together**, as LEGO prints them, with "2×" in the callout (`mirrorPairs`): the symmetry plane is the axis-aligned plane across which the most parts have a mirror image; two structural parts pair when they have the same part number and colour, their connectors mirror onto each other within 0.5 LDU, and everything touching one has its image touching the other (iterated, so the second is held by the image of what holds the first). The two drive motors and the two wheels of every shipped model go on in one step each (the Colour explorer used to put its wheels in steps 3 and 4). Should pairing ever make a step unbuildable, the steps are derived without it.
8. **pins first** (`pinsFirst`, after the walk, as a LEGO manual does it): a step's pins and axles that go into the model built so far, and that a part of the step then goes onto, get a step of their own (`pins: true`) right before it, so the page shows them sticking out of their holes before anything covers them; the first step of the model or of a sub-assembly puts its first part on alone (the hub; then its pins and the motors; the RCX, then the motors and plate under it). The driving base: hub; its two pins; the motors; the front pins; the front beam and castor; the axles; the wheels and the ball (7 steps, were 3).
9. **which way each part goes in** (`insertDirections`, a step's `moves`): along the axis of each connection (mech/graph.js edge) between a new part and a part built before, from the built part's connector toward the new part's; a stud in its socket goes by the stud, which points out of its own part (a brick set onto built studs comes from above, a part whose stud goes up into a built one from below); any other connection centred on its partner (a wheel on the middle of its axle) takes the side of the page's centre the part is on; a part whose connections disagree has none.
10. **which corner the page looks from** (`stepCorner`, a step's `view`): front-right as a manual usually does, turned to front-left, back-right or back-left only when the new parts clearly come from that side (scored by how their ways in face each corner, horizontally; the page before's corner is strongly preferred, so the model turns 0–4 times in a shipped manual). A turned page says "Turn the model round: this page looks at it from another side."

Every derived step is buildable: each new part touches a part built before, directly or through other new parts of the same step. `test/bw-sim-instructions.test.mjs` checks this on the S1 driving base and every shipped model (every part once; pins and axles with what they join or on the pins step just before it; mirrored motors and wheels in one step; the bill of materials counts the model; the driving base's pins-first steps and each part's way in), the `0 STEP` fixture `test/fixtures/bw-sim/driving-base-steps.ldr`, groups and loose parts. The pictures are `view/instructions-view.js`; the dialog is `components/tw-pseudocode/sim-lab-instructions.jsx` (words in `sim-lab-instructions-text.js`); the print page is `instructions/print-page.js`. All of it is in the lazy Sim Lab chunk (`scripts/verify-boot-payload.mjs`); `scripts/lib/sim-lab-instructions-gate.mjs` drives it in the built app.

## Build mode

Build is a small CAD editor (`bw-sim/editor/editor-view3d.js`; arithmetic in `editor/transform-math.js`). Every change goes through the editor command stack; a change to several parts is one `moveMany`/`batch` command, so one Ctrl+Z undoes it.

How a part finds its connection — the lit holes, the cursor-driven target, hysteresis, Tab, red refusals, turning in the hand, Target-first, keyboard placement and the camera (orbit about the pointer, the view cube) — is specified, with what other LEGO editors do and what is implemented, in [ROBOT-LAB-UX.md](ROBOT-LAB-UX.md) (pure core: `editor/snap.js` `snapAtPointer`; tests: `test/bw-sim-snap-pointer.test.mjs`, `scripts/lib/sim-lab-connect-gate.mjs`).

**Mouse**
- **Click a part** selects it. If it is in a group, the whole group is selected.
- **Shift+click** adds or removes a part (or its whole group). **Click empty space** clears the selection; **Esc** also clears.
- **Shift+drag on empty space** draws a box; parts whose centres lie inside are added to the selection.
- **Drag a part** slides the selection on the work plane (the floor or the top face of another part), grid-snapped.
- **Gizmo:** when a part is selected, three coloured arrows (X red, Y green, Z blue) and planes move it along axes or in planes (W for move, E for rotate). Coloured rings turn it (see R/T below). Dragging the gizmo shows the “Moving x…/Turning …” status.
- **Magnet (connection-first, ROBOT-LAB-UX.md §3):** with a part in hand, the free holes, pins and studs it could join light up near the pointer; the one under the pointer (24 px) is the target and the ghost seats there, green, with every pair it makes counted — or red where it was aimed when it would go into a part. A selection or group snaps too (its pins all seat, or the pose is not offered). **Tab** tries the other spots, **R / [ ] / X** turn it in the hand. **Hold Alt** to turn the magnet off. With nothing in hand the hole under the pointer lights; click a selected part's lit hole, then a palette part, and the part goes in (Target-first). A pin must be within 0.5 LDU sideways and reach at least 8 LDU into the hole (the compiler's seating rule, below); a placed part that would overlap another is refused (see below).
- **Camera:** left-drag on empty space or middle-drag orbits about the point under the pointer; right-drag pans; wheel (and a trackpad pinch) zooms to the point under the pointer; a trackpad's two-finger scroll orbits, Shift+scroll pans; Build looks from 5° to 175° (under a part too); a double click centres the view on the clicked point; the view cube (bottom right) turns the view to a face, edge or corner; with nothing selected the arrows orbit, Shift+arrows pan and + / − zoom (see *Moving the view*).

**Fingers (tablets: iPad, touch Chromebooks; `editor/touch-gestures.js`)** — Pointer Events with `pointerType === 'touch'`, `touch-action: none` on the canvas; the mouse is unchanged.
- **One finger on a part** selects it and drags it on the work plane: the mouse's drag (magnet, resting on top, overlap refusal). A **tap** selects just that part.
- **One finger on empty space** orbits; a **tap** there clears the selection. **Two fingers** pinch to zoom and move together to pan (a second finger calls off a part drag).
- **Long press (0.5 s) on a part** adds it to the selection or removes it (the finger's Shift+click). **Long press on empty space, then drag**, draws the selection box.
- **Gizmo:** a finger grabs a handle within 22 px of its shape (a mouse: 8 px) and the arrows are at least 72 px long (a mouse: 44 px), when the device's main pointer is coarse or the last press was a finger; a press within 30 px of the gizmo's centre on a part goes to the part.
- **Palette:** a tap arms a tile and a tap in the view places it; a finger carries a tile sideways into the view (up and down scrolls the list).
- Fingers never reach three's OrbitControls/TransformControls (except on a gizmo handle): the view moves the camera itself with the same arithmetic. Simulate keeps OrbitControls' own one-finger orbit and two-finger pinch/pan.
- Hit targets: with `(pointer: coarse)` every pane button is at least 40 × 40 px, and the status line speaks of taps and long presses.

**Palette (`components/tw-pseudocode/sim-lab-palette.jsx`)** — after Tinkercad's shape panel.
- Each part is a **tile with a picture** drawn from its real LDraw geometry in the placed colour (Light Bluish Grey), edges on, from the front-right above (`view/part-thumbnails.js`: one offscreen WebGL renderer, a picture per part drawn when its tile scrolls into view or its category is opened, a few ms per frame, kept as a data URL for the page's life). Without WebGL the tiles show names only. The tooltip gives the full name and the part number.
- **Search** filters by EN and DE name and part number, ignoring case and umlaut spelling (`zahnrad`, `zaehne`, `beam 7`, `Lochbalken 7`, `3647`); a number matches a whole number in the name (`beam 7` is not `beam 17`), three digits or more also the start of a part number (`editor/palette.js` `searchPalette`).
- **Recently used** — the last six parts placed this session, newest first.
- **Click a tile, then click in the view** to place (Shift+click keeps the tool), or **press a tile and drag it into the view**: the same ghost (magnet, resting on top, overlap refusal) follows the pointer and letting go places the part. Letting go outside the view, or **Esc** during the drag, places nothing.
- Categories are collapsible and keep their open state across a search.

**Keyboard (onKey)**
- **R / Shift+R** — turn 90° about the vertical (world Y). If the selection is a single part sitting on a pin or axle, it turns about that connection's axis instead; a part in hand (palette or drag) turns about the connection it would make.
- **[ / ]** — turn 15° on a round connection (a pin or an axle in a round hole, a ball); refused on an axle in an axle hole and on studs. **X** — flip end for end along the connection.
- **Tab / Shift+Tab** (a part in hand) — the next / previous way to put it here; **Enter / Space** places it; **Enter on a palette tile** takes the part with the keyboard (the ghost starts on the target nearest the view's centre).
- **T / Shift+T** — tip 90° about the horizontal axis facing the camera (the closer of world X or Z).
- **F** — fit the selection (or the whole model) in view; **Home/Top/Front/Side** buttons do the same with fixed directions.
- **Ctrl+Z / Ctrl+Y** (or Shift+Ctrl+Z) — undo / redo one command step.
- **Ctrl+D** — duplicate the selection one hole pitch (20 LDU) along +X.
- **Ctrl+C / Ctrl+V** — copy/paste the selection (each paste steps one hole pitch further; the clipboard survives mode switches).
- **Ctrl+A** — select all.
- **Ctrl+G** — group the selection (needs ≥2 parts); a click on any member then selects the whole group. Stored as `0 !BW GROUP <id> <name>` plus `0 !BW IN <groupId>` before each member's type-1 line (see `bw-sim/model/ldraw-model.js`; exact syntax below). Groups do not nest; a part belongs to at most one group.
- **Shift+Ctrl+G** (or **Ctrl+Shift+G**) — ungroup every group the selection touches (one undo step).
- **Delete / Backspace** — delete the selection (a batch of deletes, one undo step; a group left with <2 members dissolves).
- **Esc** — stop a placing tool or clear the selection.
- Every key has a button on the build bar (below) for a tablet without a keyboard; only Alt (magnet off) and Shift's 15° ring steps have none.

**Build toolbar (sim-lab-pane.jsx, sim-lab-toolbar.jsx; see *The toolbar* above)**
- **Move with arrows (W) / Turn with rings (E)** toggle the gizmo mode.
- **Grid** — 1 / 5 / 10 / 20 LDU (default 10 = half a hole pitch).
- **Turn 90° (R)**, **Turn back 90° (Shift+R)** and **Tip 90° (T)** — same as the keys (they also turn a part being placed).
- **Group / Ungroup** — buttons for Ctrl+G / Shift+Ctrl+G (disabled unless the selection qualifies).
- **Duplicate / Delete** — same as Ctrl+D / Delete.
- **Copy / Paste / Select all** — same as Ctrl+C / Ctrl+V / Ctrl+A.
- **Cancel (Esc)** — same as Esc: calls off a drag, stops the placing tool, or clears the selection.
- **Undo / Redo** — same as Ctrl+Z / Ctrl+Y.
- **Home / Fit (F) / Top / Front / Side** — camera views (Simulate has them too).
- **File › Save as** — downloads the model as `.ldr`, `.mpd` or `.io` (the editor's current model, title `Robot Lab model`).
- When one part is selected, a **Port** list (none / A–F) beside the selection chip binds a motor or sensor; it is only shown for motors and sensors.
- **Simulate / Build** in the mode switch change modes; Simulate compiles the built model and starts the session.

**Overlap and what may sit inside**
A move, turn or place that would make two solid parts intersect is refused: the status says *“Would go into <target>: let go and it stays where it was”* and on release nothing changes. The test is exact primitive SAT on the PartMeta colliders (box / cylinder / sphere, tolerance 1 LDU), ignoring the parts the move is meant to connect to.

What *is* allowed to occupy the same space: a part whose collider is meant to sit inside another part, as in the real Technic system — pins in pinholes, axles in axleholes or through pin holes, and the **castor ball** (52629.dat, sphere radius 24 LDU) in its socket (ball-and-socket on 39370.dat). Those are not overlaps; they are connector pairs that the snap system recognises.

A part can be partly shaft and partly solid: **87082** (pin 3L with centre pin hole: two pin ends and a solid centre) and **32054** (pin with stop bush). Their colliders are split by region, measured from the LDraw mesh: the shaft colliders carry `region: 'pin'` (or `'axle'`/`'ball'`) and may sit inside other parts; the rest is solid and is checked like any solid part (`editor/overlap.js` `solidColliders`). So 87082 pins into two beams, while a beam pushed into its centre, or 32054 with a beam over its bush, is refused. A part that tags no region is wholly shaft when every connector is a pin, axle or ball, else wholly solid. `test/bw-sim-part-meta.test.mjs` checks that every region collider is around a shaft connector of its kind, that no pin or axle runs through a solid collider, and that every pin/axle connector really is a shaft in the mesh (within 8.5 LDU of its axis). That last check found **32039**'s "axle" inside its own body: the part has two axle holes (along x at z = −20 and along z at the origin), and its connectors now say so.

**Groups in LDraw text**
`bw-sim/model/ldraw-model.js` writes and reads:
```
0 !BW GROUP <id> <name>
0 !BW IN <groupId>
0 !BW ID <placedId>
0 !BW PORT A   // for motors/sensors only
1 <color> <x> <y> <z> <a> <b> <c> <d> <e> <f> <g> <h> <i> <file>
```
Groups are declared before the parts, in definition order. Each member carries `0 !BW IN <groupId>` on the line before its type-1 line (like `!BW PORT`). Unknown or malformed group metas become **refusals** (`bad-group`, `duplicate-group`, `unknown-group`), not crashes. A model without groups writes no `!BW` group lines and round-trips byte-identically.

## What is simulated

- Rigid parts merge into bodies; axles in round holes, frictionless pins and
  motor shafts become hinges; a castor ball rolls freely in its socket; spur
  and bevel gears that mesh are coupled with their tooth ratio.
- Gears transmit only when both axles turn in the same part (the frame: a
  beam, or the motor housing and everything pinned to it). A gear rigidly
  joined to the part its partner turns in locks the pair (warning
  `gear-on-frame`: the two become one rigid body); gears whose axles turn in
  two separate parts are not coupled (`gear-frames-differ`). The coupling
  works both ways: a blocked output stalls the motor at its torque limit.
  Since 2026-10-19 a mesh is a tooth contact (our fork of the Jolt physics
  engine): torque is multiplied by the gear ratio (an 8:24 reduction gives
  three times the torque at the 24T), the teeth push back on the frame that
  holds the axles (a machine standing free turns the way real ones do, and
  conserves its angular momentum), and gears on a turning frame (a turntable,
  a planet carrier) keep their ratio relative to it. Test gearboxes: `test/fixtures/bw-sim/gears/`, run by
  `test/bw-sim-gear-trains.test.mjs` with the motor housing clamped (a static
  body made of model parts is the machine's frame: it does not collide with
  the machine's moving parts).
- **Gearboxes** (since 2026-10-18): a gear with a round hole (a clutch gear,
  18946/81346/2471/35185; a peghole bevel 87407/65413) spins freely on its
  axle; its mesh with a gear in the frame still counts (the frame is found
  through the axle turning in it). The **driving ring** 6539 slides on a
  ridged axle joiner (6538a/b); pushed 4 LDU or more into a clutch gear's
  socket it locks that gear to the axle. The **changeover catch** 6641 on a
  turning axle pushes the ring along as it swings: a motor shifts gears. The
  **white 24T clutch gear** (76019) passes torque up to its stamped
  2.5–5 N·cm (the simulation uses 3.75) and slips above. Two gear paths
  between the same axles run when their ratios agree and lock (warning
  `gear-loop-locked`) when they do not.
- **Differentials and planet carriers**: gears whose axles are held by a part
  that itself turns (the differential casing 65414 with its 28T cover 65413
  and three 12T satellites, placed as LDraw's own assembly 65414c01 places
  them) are coupled relative to that part (Willis: ω₁ − ω_c = −(z₂/z₁)(ω₂ −
  ω_c)), exact however the carrier moves: hold one side and the other turns
  twice as fast as the casing. Examples: **Two-speed gearbox** (motor A
  drives, motor B shifts; `gearbox.bw`) and **Differential** (motor A drives,
  motor C holds or turns the right side; `differential.bw`). Tests:
  `test/bw-sim-gearbox.test.mjs` (benches in `test/fixtures/bw-sim/gearbox/`)
  and `test/bw-sim-gearbox-program.test.mjs` (the shipped examples).
- Motors: the hub's own motor controller decides each motor's speed (ramps,
  holds, run-to-position, stop actions); the hinge turns under the motor's
  torque limit, and the **encoder reads what the wheel actually did**.
- The hub's yaw (`motion_sensor`, `hub.motion`) follows the hub body.
- **Sensors (via raycast in `bw-sim/sensors.js`, ignoring the robot's own bodies; ground colour via `createMat(ground.mat).colorAt(x,z)` when a mat is chosen):**
  - **Distance (port D, device 62):** ray forward up to 2.5 m; distance in mm, rounded; outside 50–2000 mm → -1.
  - **Colour (port C, device 61):** ray down up to 32 mm; if it hits the ground or a coloured body within that range, reports its `color` id (0 black, 3 blue, 6 green, 7 yellow, 9 red, 10 white) and `reflection` (0–100, 100 for white, 5 for black on the mat, scaled by `1 - d/0.032`), plus `red`/`green`/`blue` (0–1024). Beyond 32 mm → colour -1, reflection 0.
  - **Force (port F, device 63):** ray along the plunger up to 10 mm; if it hits within 2 mm, `force = 100·(1 - d/0.002)` (0–100), `pressed` when >10; otherwise 0.
  - **IMU (motion_sensor):** pitch/roll from the hub body's quaternion, `faceUp` (0 top … 5 bottom), `angularVelocity` and `acceleration` (milli-g) derived from body motion and gravity.
- **Mats and obstacles (`bw-sim/world/`):** the Mat selector above; obstacles are static box bodies (compile option `obstacles: [{id, shape:'box', size:[w,h,d], position:[x,y,z], yawDeg, color}]`) — colour is a SPIKE colour id 0–10 shown as a box mesh; the S1 driving base collides and stops against them, and the distance sensor's ray meets them. A mat may carry obstacles (`createMat(id).obstacles`, same shape); `prepareModel` compiles them with the model, which is how the Wall mat's wall gets into the scene.
- **Turntables** (60 and 28 teeth): the two halves turn on each other; the toothed top is a spur gear for a pinion on the base (`bw-sim/kinds/turntable.js`).
- **Linear actuators** (the small one, 92693): the spindle's turn moves the piston by its thread's lead (1.206 mm per turn), it holds any load up to its slip clutch (self-locking), it stops at the ends of its stroke while the spindle turns on, and the motor feels the load (`bw-sim/kinds/screw.js`, `bw-sim/physics/screw.js`).
- **Universal joints** (since 2026-10-20): two universal joint ends (62520 the 3L end, 3712 and 575 the
  old 4L ends) placed fork in fork, the second turned 90° so the cross fits, join the two axles they
  sit on (`bw-sim/kinds/universal-joint.js`; the cross itself, 62519/3326, is not a catalogue part and
  is implied). It is simulated as what it is, a cross on two hinges (`bw-sim/physics/universal-joint.js`),
  so a bent joint turns its output unevenly, as the real one does: at a bend β the output's speed swings
  between cos β and 1/cos β of the input's twice a turn (ω₂/ω₁ = cos β / (1 − sin²β·cos²θ)), on
  average 1:1; two joints in phase (the shaft between them with its forks in line, equal bends) turn
  the output evenly. A joint bends at most 45° (warning `uj-too-bent`); ends whose forks are not at
  right angles do not join (`uj-not-square`). Tests: `test/bw-sim-universal-joint.test.mjs`.
- **Materials** (since 2026-10-20, `MATERIALS` in `bw-sim/contracts.js`): a part is ABS unless its
  catalogue entry says `"material": "rubber"` (the tyred SPIKE wheels); a tread's sprockets are `tread`.
  A body bounces and rolls like the part it touches the ground with (its grippiest):

  | material | friction | restitution e | Young's modulus | rolling resistance c_rr |
  |---|---|---|---|---|
  | ABS | 0.4 | 0.4 | 2.3 GPa | — |
  | rubber (tyres) | 1 | 0.05 | 5.5 MPa | 0.02 |
  | tread (link tracks) | 1 | 0.4 | 2.3 GPa | 0.05 |
  | the floor and walls | 0.8 | — | rigid | — |

  *Bounce, per material pair:* two materials meet with e_ab² = (e_a²/E_a + e_b²/E_b)/(1/E_a + 1/E_b)
  (`restitutionOf`: each side stores the impact's energy in proportion to its compliance and gives back
  e² of it), installed in Jolt as a pair table (our Jolt fork's `MaterialPairs`, jolt-physics 1.1.0-bw.3).
  A part on the floor: its own e; ABS on ABS 0.4; a brick on a tyre 0.054 (Jolt's own rule, the larger of
  the two, said 0.4). A brick dropped 20 cm bounces off at 0.41 of its landing speed and rebounds to e² ≈
  16 % of the height. Impacts slower than 1 m/s (`LEGO_MIN_BOUNCE_SPEED_M_S`, a 5 cm drop) do not bounce:
  a robot driving into a wall at SPIKE speeds (≤ 0.5 m/s) stops dead, as a real build's give takes that
  energy. A part landing across two others bounces straight (the fork leaves such an impact to the full
  contact solve; 1.1.0-bw.2 turned a brick over on two beams). *Rolling:* a tyred or tracked wheel on a
  hinge feels c_rr·N·r against its roll (`bw-sim/physics/rolling.js`), N its normal load read each step
  from what its axle does not carry: as its hinge's friction while nothing drives it (Coulomb: it also
  HOLDS a parked cart on a slope up to tan α = c_rr, 1.15° for tyres) and as a torque on a driven wheel.
  A coasting cart slows at c_rr·g·M/(M + ΣI/r²) and stops (0.1376 m/s² measured, 0.1376 predicted);
  on 3° a cart rolls down at g·(sin α − c_rr·cos α)·M/(M + ΣI/r²) (within 0.1 %), on 0.5° it stays put.
  Sources: tyres, rubber on hard floors 0.010–0.025 (Hungarian Journal of Industry and Chemistry,
  "Laboratory Measurement of Rolling Resistance Coefficient under Different Conditions"); treads, link
  tracks on concrete 0.03–0.06 (the literature table in Łopatka & Muszyński, "Validation of rolling and
  steer resistance of articulated tracked robot", ISARC 2013); ABS e, solid polymers rebound with
  0.6–0.9 (J. Phys.: Conf. Ser. 2557 012057; Bull. Mater. Sci. 22(6) 1009), a hollow brick less: 0.4 is
  an estimate, as is the tyre's 0.05. *Limits:* Jolt's solver resolves a flat multi-point bounce
  non-uniquely, so a part bouncing off two others leaves with a little spin (0.1–0.3 rad/s) and a tall
  drop's second landing can leave it leaning; a part's whole island bounces with one material; hard
  plastic rolling on its rim has no rolling resistance.
- A frictionless pin or axle that only joins two parts is one hinge between them (`bw-sim/mech/free-pins.js`).
- Not yet simulated: flexible parts (hoses) and the colour sensor's ambient-light modes.

## The parts it knows (56)

From `overlay/scratch-gui/src/lib/bw-sim/part-meta/parts.json` (grouped by `category`; English name and LDraw file):

- **axle (8):** Technic axle 2 notched (32062.dat), Technic axle 3 (4519.dat), Technic axle 4 (3705.dat), Technic axle 5 (32073.dat), Technic axle 6 (3706.dat), Technic axle 8 (3707.dat), Technic bush (3713.dat), Technic half bush (4265c.dat)
- **beam (18):** Technic beam 11 (32525.dat), Technic beam 13 (41239.dat), Technic beam 15 (32278.dat), Technic beam 2 with axle hole (60483.dat), Technic beam 2×4 L-shaped (32140.dat), Technic beam 3 (32523.dat), Technic beam 3×5 L-shaped (32526.dat), Technic beam 5 (32316.dat), Technic beam 5×3 H-shaped with ball socket (39370.dat), Technic beam 7 (32524.dat), Technic beam 9 (40490.dat), Technic frame 5×11 open centre (39794.dat), Technic frame 5×7 open centre (64179.dat), Technic liftarm 1×11.5 double bent (32009.dat), Technic liftarm 1×7 bent 4×4 (32348.dat), Technic liftarm 1×9 bent 6×4 (6629.dat), Technic thin liftarm 1×3 (6632.dat), Technic thin liftarm 1×4 (32449.dat)
- **connector (6):** Technic axle and pin connector perpendicular (6536.dat), Technic axle and pin connector perpendicular 2×2 split (41678.dat), Technic axle and pin connector perpendicular 3L with 2 pin holes (42003.dat), Technic axle and pin connector perpendicular 3L with centre pin hole (32184.dat), Technic axle connector with axle hole (32039.dat), Technic axle towball (2736.dat)
- **gear (7):** Technic gear 12 tooth bevel (6589.dat), Technic gear 16 tooth (94925.dat), Technic gear 20 tooth bevel (32198.dat), Technic gear 24 tooth (3648.dat), Technic gear 40 tooth (3649.dat), Technic gear 8 tooth (3647.dat), Technic worm gear (4716.dat)
- **hub (1):** SPIKE Prime hub (45601.dat)
- **motor (2):** SPIKE large angular motor (54675.dat), SPIKE medium angular motor (54696p01.dat)
- **other (1):** Technic ball 19 mm for ball castor (52629.dat)
- **pin (8):** Technic axle pin with friction (43093.dat), Technic axle pin without friction (3749.dat), Technic pin 2L with stop bush (32054.dat), Technic pin 3/4 (32002.dat), Technic pin 3L with centre pin hole (87082.dat), Technic pin 3L with friction (6558.dat), Technic pin with friction (2780.dat), Technic pin without friction (3673.dat)
- **sensor (3):** SPIKE colour sensor (37308.dat), SPIKE distance sensor (37316.dat), SPIKE force sensor (37312.dat)
- **wheel (2):** Wheel 56×14 with medium azure tyre (SPIKE Prime) (39367p01.dat), Wheel 88×14 with medium azure tyre (SPIKE Prime large) (49295p01.dat)

**Radio hubs and their devices (2026-10-19; docs/LWP3-VIRTUAL-HUB-NOTES.md "Devices"):** BOOST Move Hub (26910.dat, its motors A and B built in), Powered Up Hub (28738.dat), Technic Hub (22127.dat), SPIKE Essential hub (67351c01.dat), WeDo 2.0 Smart Hub (19071.dat); Control+ Technic L and XL motors (22169.dat, 22172.dat), BOOST interactive motor (26913.dat), WeDo 2.0 motor (21980.dat); BOOST colour and distance sensor (26912.dat), WeDo 2.0 tilt (20841.dat) and motion (20844.dat) sensors — numbers checked against the LDraw library, connectors derived by `scripts/derive-part-meta.mjs` and completed by hand.

Every connector in that file is checked against the part's LDraw mesh by `test/bw-sim-part-meta.test.mjs`, including where a pin seats: a pin-hole connector's two ends must be where its bore opens and ends (±2 LDU).

**Sensor pin holes, measured (2026-10-17).** The SPIKE colour, force and distance sensors have *blind* side holes (LDraw `p/connhol3.dat`, "Technic Connector Hole One-Sided"): the bore opens on the side face at |x| = 30 LDU (distance sensor: 70) and ends 18 LDU in, at |x| = 12 (52). Their connectors used to sit at the bottom of the bore (|x| = 12 / 52) instead of the middle of the pin seat (|x| = 20 / 60), so a pin through a beam pulled the sensor 8 LDU (3.2 mm) into the beam: the shipped Line follower's sensor was inside its mounting beam, and the Wall stopper and Colour explorer used 3L pins to reach, which would end 12 LDU (Wall stopper) and 20 LDU (Colour explorer) past the bottom of the sensor's blind hole, inside its body. The large motor (54675.dat) had the same error on its side holes (bore |x| 32..50, connector at 32) and two end holes on the wrong end of the housing (z = +12, where there is no bore; the bore is z 132..150). All are now at the measured seat; the Line follower's sensor moved 8 LDU forward (z 152 → 160, still 8.4 mm above the floor) to rest on its beam, and the two examples use ordinary 2L pins. `test/bw-sim-models-solid.test.mjs` checks every shipped model and fixture against the real meshes (no point of a solid part inside another, no pin reaching past its hole).

**Holes from the hole primitives (2026-10-17).** A part's holes are read from the LDraw Technic primitives it places, not from fitted circles: `connhole`/`beamhole` (a through bore, local y −10..10), a `peghole` pair around a 6 LDU `4-4cyli`, `connhol3` (blind, 18 deep), `axlehol*` scaled to the axle hole's length; pins from `connect*`/`confric*` (`confric` = friction ridges). Fitting circles had read the `npeghol*` outer-shell fragments of a bend as holes: the bent liftarms 32348 and 6629 had 8 and 12 "holes", some 10 LDU apart, instead of 7 and 9 (with an axle hole at each end). `test/bw-sim-part-meta.test.mjs` now also refuses two parallel hole connectors of one part whose axes are under 15.5 LDU apart unless they are coaxial (the tightest real pair, 16.57 LDU, is the two ends of the slot in the double-bent liftarm 32009). The driving base and the models built on it hold the front beam and the castor with one 3L pin per side through hub, beam and castor; they used to have a 2L pin from each side in the same beam hole, which `test/bw-sim-models-solid.test.mjs` now reports.

**When a shaft is held (2026-10-17).** A pin, axle, axle pin or stub seats in a hole when, along their common axis (parallel within 1°, coaxial within 0.5 LDU), it engages at least **8 LDU** of the hole (`mech/graph.js` `shaftEngagement`, `MIN_ENGAGE_LDU`; the compiler and the editor's magnet share it). Technic lengths come on a 10 LDU lattice, so a real seat engages 10, 20, ... LDU and a shaft ending at a hole's face engages 0; 8 is 2 LDU of slack under the shortest real hole (10: thin liftarm, half bush, bevel hub). The rule used to demand that the shaft cover the whole hole, so the towball 2736's 17.5 LDU stub held only in 10 LDU holes and a half-inserted 3L pin held nothing; both hold now, as they do in the real thing. A **blind** pinhole carries `closedEnd` (±1, which end of its segment is the bottom; 92 such holes on the motors, hub and sensors, read from LDraw's one-sided `connhol3` bore and checked by `test/bw-sim-part-meta.test.mjs`): a shaft that would reach past the bottom by more than 0.5 LDU does not seat. On every shipped model and fixture the compiled bodies, joints and gears are byte-identical to before (the new rule accepts every pair the old one did, except through a blind bottom, where none of them reach). `test/bw-sim-shaft-seat.test.mjs` covers the towball, a half-inserted 3L pin, a pin 3/4 in a thin liftarm, a sensor's blind hole and the magnet.

Adding a part: add it to `parts.json` (measure it with `bw-sim/ldraw/ldraw-geometry.js`; never copy connectivity data from BrickLink Studio, LDCad or another database), then run `npm run sync:ldraw -- --from <extracted complete.zip> --source-sha256 <hash> --source-date <date>` and `npm run sync:ldraw:check`.

## Geometry and licence

Part geometry is a curated subset of the official **LDraw Parts Library** (CC BY 4.0, some files dual CC BY 2.0 / 4.0), vendored unmodified in `overlay/scratch-gui/static/ldraw/` with its licence texts; see `THIRD-PARTY-NOTICES.md`. Physics is **Jolt** (MIT). LEGO® is a trademark of the LEGO Group, which does not sponsor, authorize or endorse this project.

## Checks

**Unit (bw-sim):** 72 files in `test/bw-sim-*.test.mjs`, each a pure check of one area:
- `bw-sim-contracts.test.mjs` — PlacedModel, CompiledMechanism and CompiledModel validators.
- `bw-sim-editor-overlap.test.mjs` — build moves/turns/places that would intersect are refused; pins/axles/ball may sit inside.
- `bw-sim-editor-ports.test.mjs` — copies of motors/sensors keep a sensible port (free keeps, taken gets first free, six full → none, three at once distinct, beam none, undo restores).
- `bw-sim-editor.test.mjs` — editor commands and undo/redo (place, move, delete, clone, recolor, setPort).
- `bw-sim-editor-v2.test.mjs` — multi-select, groups and grid arithmetic.
- `bw-sim-gear-trains.test.mjs` — spur and bevel gear couplings and ratios.
- `bw-sim-groups.test.mjs` — group/ungroup/rename, merge, dissolve, clone, moveMany, LDraw group syntax and refusals.
- `bw-sim-imu.test.mjs` — hub pitch/roll/faceUp/yaw from body pose.
- `bw-sim-ldraw-model.test.mjs` — LDraw parse/serialize, MPD sub-models, ports, groups, refusals, byte-identical round-trip.
- `bw-sim-line-follower.test.mjs` — line-oval colour readings along the centre line.
- `bw-sim-mats.test.mjs` — mat sizes, colours and reflection for the three mats.
- `bw-sim-mech.test.mjs` — compiler: islands, hinges, gears, sensors, locked-hinge merging.
- `bw-sim-model-roundtrip.test.mjs` — every shipped model, the stress model and 150 seeded random models through `.ldr`, `.mpd`, `.io` and the project record, compared as models and byte for byte; 150 random nested MPDs equal placing by hand; minimal reproductions of the bugs these found.
- `bw-sim-model-foreign.test.mjs` — three LDraw OMR files (MLCad, LDCad) open to the model written down by hand; unknown parts refused by name; embedded parts; round trips.
- `bw-sim-model-fuzz.test.mjs` — seeded mutations of every format (and deep, cyclic, doubling MPDs) are refused by name or open as valid models, in bounded time.
- `bw-sim-model-file.test.mjs` — `.ldr` → `.io` → `.ldr` and `.ldr` → `.mpd` → `.ldr` byte-stable; a password-protected `.io` (a self-made fixture) and broken or foreign files refused by name; Studio-only parts; a hand-made `.lxf` opens with its parts at poses worked out by hand; colours from LDConfig's LEGOIDs.
- `bw-sim-instancing.test.mjs` — a big model drawn instanced: one instance per part at its LDraw placement (motors split), instances follow a physics snapshot, tints and highlights; proxies still answer a raycast; the 2,054-part stress model in a few dozen drawn objects.
- `bw-sim-model-insight.test.mjs` — every issue code in the sources has an EN and DE sentence; issues name their parts (motor without a port, gear-on-frame, a loose part); body tints, hinge-axis segments and gear ratios against the compiled mechanism; compile time for 72 parts.
- `bw-sim-overlap.test.mjs` — primitive SAT for box/cylinder/sphere colliders.
- `bw-sim-part-meta.test.mjs` — every connector and collider against its LDraw mesh.
- `bw-sim-models-solid.test.mjs` — every shipped model and model fixture is buildable: no collider overlap, no point of a solid part's LDraw mesh inside another's (generalised winding number), no pin or axle reaching past its hole.
- `bw-sim-persist.test.mjs` — sim-lab LDraw text saved with the project and reopened byte-identically.
- `bw-sim-physics-cast-ray.test.mjs` — raycast for sensors and distance.
- `bw-sim-physics-core.test.mjs` — Jolt body and hinge creation, stepping.
- `bw-sim-physics-worker.test.mjs` — worker message protocol.
- `bw-sim-physics-worker-session.test.mjs` — the physics in the worker gives the main-thread numbers bit for bit (driving, sensors, a command in flight, the line follower's program through the VM).
- `bw-sim-program-clock.test.mjs` — one clock (docs/SIM-LAB-PLAN.md §4.9): the browser's path in real time with a worker 200 ms away; program time equals simulated time at every VM step, a 1 s drive lasts 1 s simulated and covers the same distance as with a fast worker; the previous wall-clock loop fails it.
- `bw-sim-render-quality.test.mjs` — part-geometry and material fidelity.
- `bw-sim-s1-driving-base.test.mjs` — the S1 driving base drives, turns and hits a wall.
- `bw-sim-scene3d.test.mjs` — Sim Lab 3D view, mat texture and obstacle meshes.
- `bw-sim-sensors.test.mjs` — distance/colour/force readings from a running core.
- `bw-sim-session.test.mjs` — session tick, snapshot, time and yaw.
- `bw-sim-snap-rotate.test.mjs` — magnet snapping and `rotateAboutSnap`.
- `bw-sim-snap.test.mjs` — snap candidates (pins, axles, studs, ball).
- `bw-sim-camera-nav.test.mjs` — the camera keys (arrows orbit, Shift+arrows pan, + / − zoom; modified keys are not camera keys), orbiting keeps target and distance and never goes under the floor, panning carries camera and target sideways, OrbitControls' button set-up, named views frame a sphere from their side.
- `spike-simulator-pane.test.mjs` — the arena offers **Open in Robot Lab**, stands aside while the Robot Lab drives the shared hub and hands it over either way.
- `bw-sim-touch.test.mjs` — fingers: tap, drag, long press, long-press drag and pinch from touch event sequences (slop, long-press time, a late lift), one-finger orbit against an independent rotation, pinch zoom and two-finger pan.
- `bw-sim-world.test.mjs` — mats and obstacles in the compiled mechanism and scene.
- `bw-sim-linear-actuator.test.mjs` — the small linear actuator from its three parts: stroke from LDraw's assemblies, lead from the measured turns, extension per revolution, self-locking under a hanging load, end stops with the clutch, and a frame–boom–actuator loop against the law of cosines.
- `bw-sim-turntable.test.mjs` — each turntable pair is one hinge on its axis; slewing turns the turntable by the tooth ratio.
- `bw-sim-differential-car.test.mjs` — the Differential car: the differential's gears, the rack and pinion in its guide and the Ackermann steering from the parts, and its example program's run against the geometry (straight line, (R + t/2)/(R − t/2), casing = mean, the wheels where the linkage puts them, bicycle model, the rack's travel per pinion degree = the pitch radius, steering inside the rack's travel, motor B stalling at the rack's stops by speed and at 50 % power, a parked car still while it steers, steering at speed without tipping, on the floor; scrubbing without the differential).
- `bw-sim-excavator.test.mjs` — the Excavator: couplings from the parts, the boom against the law of cosines, and its example program's dig cycle.
- `bw-sim-crane.test.mjs` — the Crane: slew and luff couplings from the parts, the hook's rise against the law of cosines and the motor's encoder, the slew against 8/28, the hook hanging free.
- `bw-sim-robot-lab-api.test.mjs` — the Robot Lab API and the `lab-direct` hub: a hubless motor turned to 360 ± 2° (bound derived from the controller's window and the motor's time constant), power/speed/hold/coast and an interrupted wait, part poses bit-identical through a redone worker batch, a SPIKE hub from blocks allowed and a hub running its own program refused (EN, DE), sensors, positions and contact with the ground and the wall, neutral answers without a model.
- `lwp3-virtual-hub.test.mjs`, `wedo2-virtual-hub.test.mjs` (not `bw-sim-*`) — the radio hubs byte by byte against layouts written out from LEGO's LWP3 document and the WeDo sources; StartSpeedForDegrees 360 on the physics; the worker mirror.
- `lab-hubs-extensions.test.mjs` — the real `legopoweredup`, `legoboostunified` and `wedo2unified` through the Scratch VM, Web Bluetooth and the Scratch Link double, on Jolt: the Technic L motor 360 ± 2°, the BOOST rover drives (its heading the one the 50 ms start skew explains, held while cruising) and spins on both Move Hub firmwares, the WeDo rover stops at the wall (and the judge fails without the stop).
- `scratch-link-ble-double.test.mjs`, `lego-hubs-dialect.test.mjs` — the Scratch Link BLE double (fall-through, JSON-RPC, manufacturer data) and connectVirtualHub; the `pup`/`boost`/`wedo` words counted against the extensions' getInfo and round-tripped.
- `robot-lab-dialect.test.mjs` (not `bw-sim-*`) — one method list: every robotlab block is one `lab` word, one `_robotlab` op and one API method; every block round-trips blocks → words → blocks and through Python and JavaScript; the words under any DEVICE; the simulator driver; EN/DE block texts; the blocks with no Lab open.

Plus `test/bw-sim-persist.test.mjs` ↔ `test/project-bundle-archive.test.mjs` (real bundle writer/reader) and `scripts/verify-boot-payload.mjs` (the Sim Lab view stays out of the first load, chunk `bw-sim-lab`; Jolt and the physics worker stay out of that chunk too, chunks `bw-sim-jolt` and `bw-sim-physics-worker`).

**Browser (after a GUI build):**
- `npm run verify:sim-lab` — `scripts/verify-sim-lab-browser.mjs` loads the reference driving base with a WebGL view, runs with no program (hint shown, robot stays put, Drive pad moves it), chooses the line-oval mat (robot on the line), checks palette place/snap/undo, palette pictures (drawn, lazily), search, drag from the palette onto the floor and onto a beam hole, Esc cancelling a drag, Build→Simulate compile, a green-flag Scratch program drives with physical encoders, saved model reopens byte-identical, project load replaces the model, no-WebGL fallback still runs.
- `scripts/lib/sim-lab-insight-gate.mjs` — port badges in both views, "Show how it moves" (overlay objects and red axis pixels) in both, unplugging a motor from its badge lists the issue, the issue selects the motor, the badge's picker plugs it back in, "Before you press Run" with no motor, the issue pulses the motors in Simulate.
- `scripts/lib/sim-lab-cad-gate.mjs` — `npm run test:sim-lab-cad` places a part on the floor, drags the gizmo, turns with R/ring, slides on the work plane, Shift+multi-select and box-select, groups/ungroups, pins snap from above and beams stack, pushing into the hub is refused.
- `scripts/lib/sim-lab-api-gate.mjs` (`--part=api`) — a Blocks project of robotlab blocks (built in the VM, saved and reloaded as an `.sb3`) loads the Motor bench and turns its motor 360 ± 2° through `runtime.robotLab`, in the worker; the Motor bench's example in `lab` words, through the UI only (Load example program, Run), turns 360°, rests there through its wait, runs on at 90 °/s and brakes.
- `scripts/lib/sim-lab-hubs-gate.mjs` (`--part=hubs-ble`) — through the UI only, the three radio-hub examples: Load example program turns their words into the real extensions' blocks, Run connects them (Scratch Link double for Powered Up and WeDo, Web Bluetooth for BOOST): motor A at 360 ± 2° and back, the rover drives ahead and turns, the WeDo rover stops at the wall.
- `scripts/lib/sim-lab-toolbar-gate.mjs` (`--part=ui`) — the Robot Lab tab is selected and filled by the Lab; Help holds the description; every toolbar control (bar and More) has a name and a tooltip starting with it and giving its shortcut, in English and on a de-DE page in German (*Roboter-Labor*, *Rückgängig (Strg+Z)*); the File menu; every Build action by click and by its key (W/E, R/Shift+R/T, Ctrl+A/Esc, Ctrl+Z/Y, Ctrl+D, Delete, copy/paste, Ctrl+G/Ctrl+Shift+G, H/Shift+H/I, M, K, F, ?) with its effect; in both modes Top/Front/Side/Home frame the model, a left drag on empty space orbits about a fixed target, a right drag pans, Shift+drag pans (Simulate), the wheel zooms, arrows/Shift+arrows/− move the focused view; a drag on a part moves the part and leaves the camera, and with a part selected the arrows leave the camera. The core part reaches the Lab through the arena's **Open in Robot Lab** and checks the arena stands aside.
- `scripts/lib/sim-lab-layout-gate.mjs` (`--part=layout`) — the tab alone at 1024×768 … 1920×1080, with the stage column beside it at 1024×768 and 1366×768, and with the stage dragged wide so the Lab is ~470 px: the view big enough and wholly visible, primary controls pressable, the toolbar never wider than the pane (More when narrower than 1000 px, its Top view works), the palette (drawer when compact) places a part and Undo removes it.
- `scripts/lib/sim-lab-touch-gate.mjs` — a school tablet (1024×768, `hasTouch`, real touch through CDP `Input.dispatchTouchEvent`): tap a tile then the floor places a part, one finger drags a part by grid steps and a tile out of the palette, a long press adds to the selection, a long press then drag on open floor box-selects, a finger drags the gizmo's X arrow (x only), the build bar's Select all / Copy / Paste / Turn ↺ / Undo, one finger orbits and two pinch-zoom in Build and Simulate, holding ▲ drives (sliding off keeps driving) and lifting the finger stops both motors; two fingers moving together pan the Simulate view. It starts with the stage column beside the tab (compact), then hides it so the tab takes the whole width.

Counterturn and Snapgate add reaction-wheel yaw and over-centre spring memory.
See [their mechanisms, bounded design revisions and validation](ROBOT-LAB-COUNTERTURN-AND-SNAPGATE.md).
Both have one motor, automatic example programs, bilingual lessons and connected
building instructions. The current source library has 72 assemblies and 80 example
choices; individual release tags preserve their own documented inventories.

## Motor direction compatibility

Models without a direction declaration keep their existing behavior. A new or
deliberately migrated model can opt into the motor's own shaft frame by placing
this line once in its main LDraw/MPD model section:

```text
0 !BW MOTOR_DIRECTION motor-frame
```

With this setting, turning a motor over reverses its drive direction in world
coordinates, and inserting a symmetric axle the other way around does not
reverse the motor. `0 !BW MOTOR_DIRECTION legacy` explicitly keeps the older
bearing-led convention. Build edits, undo, save and reopen preserve the setting;
embedded submodels do not override their receiving model's choice. Invalid or
duplicate declarations refuse simulation.

This does not migrate any existing example. A migration must check its program,
lesson directions and mechanical-law qualification together. The setting makes
the compiler consistent with the motor's frame; it does not establish a
physical SPIKE motor's clockwise/counterclockwise command convention. See
[issue #1460](https://github.com/CrispStrobe/brickwright-lite/issues/1460).
Qualify an opted-in model on a runtime revision that includes this setting;
older pinned-worker receipts cannot qualify the changed drive behavior.

## Motor rotor treatment

A motor's rotor, reflected through its gearbox, adds inertia Jr to the hinge it
drives (the SPIKE medium motor: about 3e-4 kg·m²). By default (`legacy`) the
simulator adds Jr about the hinge axis to both hinge bodies. That is exact when
the motor's housing does not turn about its own axis: a clamped motor, a frame
standing on the floor, a driving base. It is wrong when the housing is free to
turn about the axis: each body then gets its own Jr, and a free platform turns
(Iw + Jr)/(J + 2·Jr) per wheel degree instead of Iw/J
([issue #1494](https://github.com/CrispStrobe/brickwright-lite/issues/1494)).
A model whose motor housing is free to turn about the motor axis can opt into
the engine's relative hinge rotor by placing this line once in its main
LDraw/MPD model section:

```text
0 !BW ROTOR_INERTIA native
```

With `native`, the rotor's kinetic energy is ½·Jr·(ω2 − ω1)². It depends only on
the hinge's relative rate, and bare body mass, centre of mass and inertia stay
unchanged. `0 !BW ROTOR_INERTIA legacy` explicitly keeps the default. (This is
separate from `0 !BW ROTOR <degrees>`, which sets one motor output's initial angle.) Build edits, undo,
save and reopen preserve the setting. Embedded submodels do not override the
receiving model's choice. Invalid or duplicate declarations refuse simulation.
Afterturn opts in. Its platform turns 0.0261 degrees per reaction-wheel degree,
which matches Iw/J at the saved pose, and 0.0275 with the masses in (B = 70°); its
judge (`afterturn-shape-cycle-v1`) predicts both from the compiled masses and the
net 1.25° cycle from their difference. The earlier 4.66° cycle was the legacy
double count.

Known limit: the engine solves the native rotor as its own constraint row
alongside the output body's contact, end-stop, friction and gear-mesh rows, and
those rows see the bare body. When the output is a light part (a gear, arm or
wheel of a few grams) that is stopped, held or meshed, the rotor's momentum
converges slowly. Arms then pass end stops, holds slip and gear trains can
become unstable. Keep `legacy` for such models; a solver change that solves the
rotor row with those rows is separate future work. Qualify an opted-in model on
a runtime revision that includes this setting.

An authored linkage with light moving bodies attached to a much heavier frame
can request stronger solver convergence with one declaration in its main model:

```text
0 !BW SOLVER light-links
```

This preset requests 120 velocity and 10 position iterations on hinges and sliders
whose lighter body is below 10 g and whose mass ratio exceeds 20. The existing
motor conditioning still applies. It changes neither masses, geometry nor
collision filtering. Save and reopen preserve the declaration; invalid or
duplicate declarations refuse simulation. Models without it retain their existing
settings. Solstice opts in with its linkage saved at gravity rest and connected
automatic instruction pages. It remains experimental; the preset does not establish
physical accuracy or buildability.
