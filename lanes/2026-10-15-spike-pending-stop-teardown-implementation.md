## SPIKE pending Stop teardown implementation — 2026-10-15

G02 continuation, branch `lane/spike-g02-pending-stop-20261015`, based on main
after the Code caller/output follow-up [PR985](https://github.com/CrispStrobe/brickwright/pull/985) merged.
Its frozen-package qualification below does not
qualify this new teardown change. A second Stop can see no
attached session while native teardown still owns the hub clock. Remember the
pending teardown before invoking the native Stop, and await it before restoring
topology, cancelling the shared backend or continuing Start. A synchronous Stop
listener joins that same teardown. Earlier completion cannot clear a later
pending teardown; joined teardown failures wait for all outstanding stops and
retain the original error for the current intent. Existing intent, bridge and
disposal guards still admit shared cleanup.

Ownership is limited to canonical `stopProgram`, new
`test/spike-arena-pending-stop.test.mjs`, this ledger and the SPIKE guide. Extend
the existing continuation contracts only to timing adaptations in the pane
composition, lifecycle, Pause, teardown, world-ownership and upload-Stop tests.
These controls now release native teardown before awaiting a later Stop. Where
an older reply must arrive after replacement, hold its original promise delivery
after teardown rather than creating a circular wait. Preserve success/error,
replacement/disposal, retained-program and fresh-Start assertions.

Twelve authored controls use the real hub clock guard and arena bridge. All
pass, and six broken pending/intent/error guards are detected. The broader 220
controls passed before adding the twelfth focused case; the final twelve pass
separately. A rendered React test is unavailable locally and is not counted.
No installed package or guest result qualifies this change yet. Require affected
installed own-guest repeated Stop, cleanup and distinct recovery, plus every
enabled exact-head check before merge. Firmware, Runtime/models, dependency
pins, protocol, product budgets and other pane methods are unchanged. This does
not close G02 or establish reference, physical, licensing or release results.
