# All 22 robot examples: complete electronics, 2026-11-18

All default assemblies now include a METRO Mini ATmega328P/16 MHz controller, regulated 5 V, nominal 6 V supply, sufficient dual H-bridges, servo distribution where required, prototype carriers and visible conductors. Atlas has two bridges for DC channels A/B/D and a separate servo C signal. Controller and regulator surfaces derive from the full-size licensed Adafruit STEP models.

Existing saved examples: **CAD → Properties → Add controller and power**. One explicit Undo operation preserves sibling Code, Circuit, Blocks, Widgets and bindings. Moved/rotated mounting frames are supported; resized or conflicting frames are left alone. Fresh Examples contain the hardware. No silent migration. Fresh Nova includes revised bays; the upgrade preserves existing authored mechanics.

## Verification

All 22 projects passed actual GUI WebKit selection → VM → Widgets → Circuit → Jolt, with Controls closed, cold Run/preparation focus loss, matching physical/circuit bridge counts, moving controlled joints, repeat Run, Stop/Reset and visible conductors. Nova additionally translates >5 mm; Atlas holds the loaded 15-degree tilt. Results combine four recorded batches, not one uninterrupted run.

The original batch caught Quasar's ejector catching the retaining lip. Its wedge base now clears the lip (42.1 versus 41.8 mm). Native contact physics passes, and the corrected GUI project completes three index/contact/eject/land/return cycles. Only Quasar changes after SDK 90aee1c; corrected SDK 9d2f832 contains that clearance. The other 21 exact qualified SB3 archives remain unchanged. This proves the listed motion, not every complete robot task or fabrication readiness.

The legacy Atlas regression compares the full live `circuitModel.toJSON()` state and all sibling editing data across upgrade, Undo and Redo, plus exact CAD serialization after Undo. Comparing raw deferred autosave had initially mistaken independent battery/rotation normalization for an edit; the corrected full-state check passes after loading other projects as well as alone. No circuit fields or physics gates are excluded.

| Example | Dual H-bridges | Visible conductors |
|---|---:|---:|
| tt-rover | 1 | 21 |
| steerable-rover | 1 | 22 |
| atlas-forklift | 2 | 33 |
| mantis-walker | 0 | 15 |
| cyclone-sorter | 1 | 22 |
| helios-catapult | 0 | 15 |
| labyrinth-tilter | 0 | 15 |
| apex-scara | 1 | 23 |
| orion-carousel | 1 | 23 |
| vortex-pinball | 1 | 23 |
| titan-vise | 1 | 22 |
| hermes-crane | 1 | 22 |
| chronos-drawbridge | 1 | 23 |
| polaris-tracker | 1 | 23 |
| boreal-launcher | 1 | 22 |
| zephyr-conveyor | 1 | 22 |
| vector-plotter | 1 | 22 |
| aegis-sentry | 1 | 23 |
| stratos-gimbal | 0 | 15 |
| kestrel-arm | 0 | 15 |
| quasar-press | 1 | 22 |
| nova-loader | 1 | 22 |

## Scope

Adafruit METRO Mini 2590 Rev B and MPM3610 4739 use pinned originals and MIT notices. Existing licensed motors, servos and AA surfaces remain available. No runtime conversion or new runtime dependency.

Pad locations and cable routes are illustrative; arbitrary Circuit edits do not reroute physical pads. Original supply/driver/encoder/drive housings are functional prototypes, not rated vendor modules. Linear stages and regulated rails remain ideal. Battery discharge, converter switching, current capacity, complete screw/gear trains and fabrication tolerances are not qualified. Added carriers can be exported individually; existing print-only layouts retain their scope.

The native app uses the explicit Brickwright build keychain. No user app is closed and no build is auto-launched into the shared test profile. Close older robot test apps before opening it. No GitHub Actions dispatched, awaited or rerun.
