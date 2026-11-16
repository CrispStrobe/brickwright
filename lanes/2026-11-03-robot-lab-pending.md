# Robot Lab — pending qualification tasks (unowned)

Status: Q1–Q5 DONE (2026-11-09). Next batch R1–R7 and engine task E1 are
OPEN and unowned (2026-11-10); details in handoff section 00000.

The full task list with exact steps is section 00 of
`docs/ROBOT-LAB-QUALIFICATION-HANDOFF-20261028.md`:

- P1–P6 all DONE (2026-11-08): #1641, #1639, #1669, #1672, #1671, #1668.
  Promoted this round: Afterturn, Toggle Press, Footfall, Phasekeeper,
  Vector Sum, Paired Door Sync, Helixgate.
- Q1–Q5 all DONE (2026-11-09), landed together in #1683 (merge `98067ba8`),
  which also merged #1684, #1681 and #1682. Promoted: Loop Relay, Parity
  Dial, Counter Slide, Point Weaver, Evenhand, RimRun.
  - Manual browser controls, saved-project replay and export not run.
  - RimRun: about 4 % residual, inside the judge's 5 % gate, now explained:
    each roller loses about 0.0085 m/s at each 128 mm track-collider seam
    (about 0.05 mm out of plane, near 74 mm and 202 mm); the judge window
    (2960–3240 ms) covers one crossing (~0.03 of the 0.0327/0.0331 m/s²
    shortfall). Between seams the prediction matches within 0.1 %. Inertia,
    joint friction/damping, timestep and per-part mass ruled out. Judge and
    gate unchanged. Follow-ups not done: single-segment fit, or merging
    abutting track colliders (affects every model). Details in handoff 0000.
  - "Arcade numeric authoring (official build)" was an operator-declared
    exception for that merge. Details are in handoff section 0000.

- R1–R7 (2026-11-10, open): R1 obliquity-orrery (DONE 2026-11-11, #1725); R2 cadence-geneva,
  equinox-differential, helios-transmission, orion-cardan (judge family; DONE 2026-11-12, #1729, except
  equinox-differential: browser manual-control check vs a locked differential, see handoff 00000;
  `lanes/2026-11-11-robot-r2-judge-family.md`);
  R3 apex (repaired and promoted, #1731, `lanes/2026-11-12-robot-r3-geometry-repairs.md`),
  vesper-quickreturn (repaired, not promoted: browser law 0.504 mm vs 0.5 mm bound and a stage-boundary turning point),
  aster-governor (repaired, not promoted: browser hinge gap 0.55 mm vs 0.5 mm bound), bloom (not promoted: its scissor pivots need a redesign, see handoff 00000);
  R4 solstice-pumpjack, tempest-pendulum, impulse-line (start-guard poses; both re-posed; tempest-pendulum
  promoted in review on `lane/robot-r4-start-guards-20261112`; solstice-pumpjack stays experimental: browser beam
  0.132° / piston 0.17 mm vs 0.1 bounds, native 0.019° / 0.022 mm, needs browser/native solver parity; impulse-line stays
  experimental: no gravity-rest pose short of the bob, needs a design change, see handoff 00000;
  `lanes/2026-11-12-robot-r4-start-guards.md`);
  R5 spiral-scribe, quiet-partner; R6 pan-shift, inertia-loop; R7
  vector-delta (blocked by a missing part).
- E1 (2026-11-10, open): Jolt enhanced internal-edge removal for tile-joint
  bumps; diagnose pair order first, then opt-in per model.

Rules: do not add `ci:full` or dispatch full CI. Use bounded local or Kaggle
runs where appropriate and retry failed checks normally. Keep model assertions
and numerical bounds unchanged. Merge only at the reviewed head after enabled
checks pass; use normal pushes and do not rewrite shared branches.
