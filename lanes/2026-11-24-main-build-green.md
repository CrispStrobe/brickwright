# Bring main's Build (permissive base) back to green

Status: CLAIMED, 2026-11-24.
Owner: Claude, user-requested CI repair.
Base: Lite main `61eb1cda9` (pins bw-board 489ca7c6, bw-circuit-ui 7f98562f, sb3-creator de3c53c8).

Scope: the 14 failing jobs of Build run 45318622606 on main — unit shards
1-5/7/8, corpus, build, browser light/robotlab/heavy/robotaddon4/robotaddon5.
Lite-owned tests, recorded expectations, fixtures, gate lists and the
Lite code they exercise. Upstream defects (bw-board, bw-circuit-ui,
sb3-creator) are fixed upstream; this lane does not move pins. The sealed
x86 F10 scripts are not touched.

Qualification: each failing assertion explained (regression fixed, or a
recorded value re-derived from a measurement with a note naming what moved),
targeted local tests, then hosted Build on the merged commit.
