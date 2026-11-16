# Complete CAD robot project validation — 2026-11-16

The logs retain actual Playwright GUI results and mechanical snapshots. All six
choices restored real Blocks, editable pseudocode, Uno circuit, actuator mappings
and Widgets before Run. Five advanced at least one simulated second, moved every
mapped actuator, preserved document source, and passed Stop/Reset. Trident fails
the existing time budget and is explicitly experimental; its failed log is retained.

The initial five-model results used clean CAD SDK c9c9680. Final Scout tablet
proof uses clean integrated SDK 987eab6, including merged PRs70–72. The SDK delta
adds qualified model-library cohorts and deferred archive preview loading; these
receipts do not claim a second complete five-model replay on that SDK. All11
SDK output digests match. Tablet proof means touch-enabled Chromium1024×768,
not physical iPad or WebKit. It also verifies Examples selection, replacement
cancellation, and the final program’s unchanged-output caching.

The first Atlas/Cyclone attempts refused an excessive actuator impulse with a
TT output-equivalent constant incorrectly applied to their ideal lead-screw drives.
The final generator uses nominal bare-rotor constants for linear stages. The
existing guard and solver limits are unchanged. Actual all-actuator reruns pass;
these are educational parameter assumptions, not calibrated hardware results.

Motion checks establish actuator response, not successful walking, sorting or
catapult tasks, servo accuracy under every load, or fabrication readiness.
The native app was compiled, signed in the dedicated brickwright keychain and
installed separately. It was not launched over the user’s running older test app.
Full build/source/signing details are in the accompanying receipt.
