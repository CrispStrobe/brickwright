# Recent robot integration before further performance work

Integrated the remote coherent-robots branches (Lite `529d00d2d`, CAD
`380775a`) into our existing worktrees, preserving the rendering coalescing and
Mac verification changes from main. All 22 complete robot presets are retained,
including Stratos and Kestrel, the revised printable Mantis and the qualified
Trident collision assembly and battery center-of-mass correction. The current
Board master is already pinned at `1db3d1b9`; installed Board source hashes match.
The Lite branch also brings the pending Board/desktop-menu integration repairs.

CAD SDK conflicts were resolved by building from combined CAD commit
`8915f201f9a26f83ff81a23d702a540d6dfd049e`, synchronizing its complete immutable
snapshot and refreshing the exact provenance carrier pins. The 22 project bundles
were regenerated from the combined CAD source, then mirrored through the normal
GUI integration producer.

Validation: 244 of 245 initial CAD cases passed. Nova's new test used reverse
wheel rotation while expecting contact with a payload ahead of it, and mistook
principal angles near a full revolution for small travel. It now drives forward,
accumulates signed wheel travel and requires over half a revolution on both
wheels, with the existing chassis, bucket and payload displacement checks retained.
All 8 Nova cases then passed. The CAD package and SDK builds passed. The focused
37-file Lite CAD/robot suite passed all 156 cases, with no skips. The refreshed
SDK provenance controls also passed. A fresh combined GUI and browser run remains
the next qualification step; earlier six-model browser receipts apply to their
recorded sources, not automatically to these 22 presets.

An accidentally broad test selection included unrelated Arcade/MakeCode project
checks and reported missing/local package integration failures. Those are not
counted as passing CAD checks. The pending Board repair PR also records an
unresolved Sky Courier base-travel browser check; this integration does not claim
that unrelated whole-app gate passed. No GitHub Actions were dispatched, rerun or
awaited. Subsequent performance work will build on this checkpoint.
