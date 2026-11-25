# Microtronic Code-tab part profile — CLAIMED, 2026-11-25

Owner: the coordinated Microtronic integration session, requested by CrispStrobe.
Consumer PR: #1846. Canonical base: `fc4ed7a5bafa8e29edcf271b9ac0f5591adfe7a6`.
Isolated worktree: `brickwright-microtronic-full`.

The full host registry gate identifies fourteen uncatalogued device kinds.
One is the newly introduced `busch-microtronic`; close that integration gap
without silently classifying the thirteen unrelated kinds or relaxing coverage.

Own only the Microtronic entry in
`overlay/scratch-gui/src/lib/bw-parts/profiles.js`, its `packages/` mirror,
the normally generated `docs/generated/PART-PROFILES.md`, and focused
Microtronic assertions in `test/microtronic-circuit-adoption.test.mjs`.
The computer runs its learner instruction set from the Circuits front panel;
it has no Code-tab compiler dialect or emitted hardware verb. Record it in the
existing `host` category and explain that boundary rather than inventing a
compiler capability. Preserve the registry schema, verb/family derivation,
all coverage assertions and every existing profile.

Verify the exact single new registry entry, generated-document freshness,
mirrors and installed Microtronic electrical/save-load behavior. Record the
remaining inherited whole-registry failure separately. No native TMS1600 or
firmware work is included. Broader host and gallery CI failures remain visible
and block landing under `lanes/PROTOCOL.md`; this claim does not waive them.

