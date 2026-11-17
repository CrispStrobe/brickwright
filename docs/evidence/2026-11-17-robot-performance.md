# Recent integration and CAD robot performance

The latest coherent-robots work was integrated into both repositories before
optimization, including all 22 complete project bundles, the revised Mantis and
Trident, and the later Atlas/Helios/Cyclone part improvements through CAD
`5b33a83`. The Board pin remains the current qualified `1db3d1b9`. The stronger
continuous-wheel-travel Nova regression and coalesced rendering were retained.

Two collision preprocessing changes reduce work while keeping the full visual
source, source mass properties, 200 Hz feedback, and existing solver guards:

* All three purchased motor models now share compact casing and shaft candidates.
  Runtime independently compares them with the source mesh under the existing
  2% volume and 0.2 mm bounds budgets. Serialized certificates are not trusted.
* Atlas forks and crate now use explicit extrusion layers. The forks retain their
  spline socket, screw bores, windows and bevels; the crate retains its cargo
  recess, side slots and fork pockets. Convex pieces fall from 127 to 56 for the
  forks and from 59 to 14 for the crate. Independent CSG error is approximately
  0.02% for the forks and essentially zero for the crate. Candidate generation
  reproduces byte for byte, and a regression guard catches an expensive BSP
  fallback at this contact interface.

A same-geometry isolated motor comparison halved physics time and reduced Atlas
preprocessing from 8.38 to 3.63 seconds. A separate detailed-Atlas contact case
fell from 11.80 to 2.83 wall seconds per simulated second. Those are Node physics
measurements, excluding the electrical solver and GUI, under uncontrolled external
machine load. The complete browser result is more relevant to app responsiveness:
Atlas's six-second default run previously timed out at 180 seconds, reaching only
5.33 simulated seconds. The layered version completed in 35.07 seconds, including
7.93 seconds of setup, and passed restart, Controls closed/open, Center and
Stop/Reset. That initial layered-compound run reached approximately 0.22x while running.
The final combined suite completed Atlas in 17.25 wall seconds,
including 4.82 seconds of setup, at 0.48x while running.
Background compilation/load differed, so these are separate observations rather
than a controlled end-to-end speedup claim.

The full browser sequence also exposed initial motor commands pushing sliders at
their travel stops. Generated defaults now use available travel, preferring the
longer direction for asymmetric limits. Regression controls cover the shipped
archives, including Apex, Hermes and Quasar. Nine missing German component labels
were added; the translation checker passes 1,772 messages and 1,427 references.

The full GUI runtime was built from Lite `5389b9b17` in production behavior with
minification disabled for local testing. Subsequent changes affect only canonical
CAD SDK/project payloads and generation/validation scripts. The final build
reuses those unchanged GUI JS/CSS files, refreshes both complete static snapshots,
and verifies every SDK digest and all 22 SB3 files against their manifests. This
is an explicit static-payload refresh, not a claim that webpack was rerun after
the final payload update. The native bundle embeds that verified final payload.

Detailed test scopes, browser outcomes, timings, native identity and remaining
limits are in [the receipt](../receipts/2026-11-17-robot-performance.json). Earlier
partial or timed-out browser runs are not counted as final passes. No cloud jobs
were dispatched, rerun or awaited. The existing completed Board CI receipt was
read by the normal pin verifier.

Save and quit an older test app before opening the new Mac product: test products
share their document profile. Open a robot again from Examples to acquire its
updated CAD, Blocks/Code, circuit and Widgets together. Existing edited projects
retain their own geometry and programs.

All 22 final bundled projects passed the complete six-second WebKit sequence,
including restart with Controls open, Center, Stop/Reset and unchanged source
CAD. Every mapped actuator moved; there were no page errors or duplicate scene
draws. Most presets were near 1x. Atlas and Scout remain slower than real time.

The longer checks also exposed under-converged serial servo joints in Polaris.
Only connected mechanisms with adjacent serial bounded axes now receive extra
native joint iterations on first servo use: 80 per bounded axis, capped at 320.
Independent drives, star-topology actuators, contact settings, torque bounds,
position gain and 200 Hz stepping retain their preceding settings. A new
six-second regression checks pan/tilt settling during sustained rail actuation;
43 related checks passed. Late diagnostic error fell from roughly 43 degrees to
0.06 degrees. The final browser angles were 14.997 and 14.962 degrees for
15-degree targets. This fixes the oscillation rather than relaxing the motion
assertion or the physical limits.

The signed Mac product is installed as `Brickwright Robots Performance Test.app`,
build `20261117.3`, using the Brickwright build keychain. Its Info.plist records
Lite `759c8968b`, CAD `48694e4`, and GUI-runtime `5389b9b17`; the receipt records
the full commits and binary digest. Native UI was not launched over the older
running test application. Its installed application and document data were
preserved.
