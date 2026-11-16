# Robot Lab — R4 start-guard poses: Solstice, Tempest (judges, controls, browser gate, Tempest promotion)

Status: IN REVIEW 2026-11-12 — claim and change in one PR. Promotes Tempest only. Impulse Line stays
experimental: its pusher has no gravity-rest pose short of the first bob (handoff 00000).
Solstice is not promoted. The original browser verdict was 0.132° / 0.17 mm
against unchanged 0.1° / 0.1 mm limits. The original judge mixed first-frame
angles with authored geometry; the corrected judge still refuses the retained
browser track at 0.115890° / 0.171740 mm, while retained native tracks pass.
The largest browser deviation begins before motor movement; an initial-condition
difference is observed, not proof of a solver defect. Preserve all startup frames
and original failures. Investigate the early constraint relaxation and require
fresh affected browser qualification before any promotion.
Owner: Claude, Robot Lab promotion lane.
Branch: `lane/robot-r4-start-guards-20261112`.

Scope: the pose repair of the two shipped models (`solstice-pumpjack.{ldr,mpd}`: crank re-posed to its gravity rest
at −75°, linkage placed by kinematics; `tempest-pendulum.{ldr,mpd}`: carrier re-posed to 102.5°, arms translated to
hang straight; parts, colours, IDs and programs unchanged); the new judge module `scripts/lib/sim-lab-r4-judges.mjs`
and its two ids in `QUALIFICATION_JUDGES` (`walking-beam-v1`, `double-pendulum-mode-v1`; every other judge is
unchanged); Tempest's contract in `docs/data/robot-lab-qualification.json`; source fixture
`test/fixtures/model-files/tempest-pendulum-source/`; the `r4` disconnection branch, Tempest's wrong-model mutant and its normal-mode recomputation from the engine's mass properties in
`test/bw-sim-qualification.test.mjs`; Tempest's registry move (`sim-session.js` MODELS after Orion,
`experimental-models.js`, dialect and extension model lists); catalogue, lesson and mechanism entries and their
generated outputs; registration tests that enumerate MODELS; the browser gate
(`scripts/lib/sim-lab-q5-browser-gate.mjs`, new shard `robotaddon24` in `build.yml`, the shard
tests and the readings registration); the checkpoint review records (including Impulse Line's), the handoff and the
pending file. Start guards, thresholds and every existing judge and gate are unchanged.

Laws (constants from the compiled model):
- `walking-beam-v1`: crank-rocker, crank 16 mm, pitman 64 mm, beam arms 48/56 mm, pump rod 64 mm; for each crank
  angle |B(β) − P(φ)| = Lp fixes the beam and |S − D(β)| = Lr the piston on its slider; swing 42.40°, stroke 40.58 mm.
- `double-pendulum-mode-v1`: M·q̈ + K·q = 0 from each arm's compiled mass, centre of mass and inertia; slow mode
  0.6650 s (+1.485), fast 0.2989 s (−1.436); each held-carrier window must be the sum of the two modes.

Measured (native, COLD 500, frameMs 25, strict ports):
- Solstice: cold sag 5.9° @ 500 ms / 12.6° @ 1 s before, 0.13° in 3 s after; beam law 0.0187° (gate 0.1°), piston
  0.022 mm (gate 0.1 mm), drive 0.00002°, swing 42.417° vs 42.403°, stroke 40.596 vs 40.578 mm; disconnection
  `pin_P`: beam-law error 42.39°, crank span 360.3°, refused. Browser (chromium): beam 0.132°, piston 0.17 mm,
  over the bounds; not promoted.
- Tempest: cold sag 39.8° @ 400 ms before, 0.08° @ 500 ms and 0.25° @ 2 s after; slow period 0.6664 / 0.6656 s vs
  0.6650 (gate 1 %), fast 0.2988 s vs 0.2989, two-mode residuals 6.5 % / 3.4 % (gate 15 %); disconnection
  `motor_pin_h3` + `motor_pin_h5`: carrier drive error 107.1°, motor span 120.8°, refused. Load-changing cuts
  (elbow axle, a bob) make the carrier re-settle and the program's start guard refuses, so they are not the control.

Controls (Tempest): frozen-output and 1 cm shift; the disconnection above; a wrong-model mutant (other bob wheel), refused.

Qualification: run the affected Chromium browser journeys and relevant checks.
Use bounded local or Kaggle compute where appropriate; do not add `ci:full`.
Solstice remains experimental. With the opt-in light-links solver preset, the
integrated local browser run passed the existing 0.1° / 0.1 mm limits
(0.00977° / 0.01258 mm), disconnected control, instructions, saved-project
replay and English/German lessons in 407 seconds. Before any promotion, review
the preset and its effect on other models, run the applicable promotion suite,
and update the registry, catalogue and qualification contract together.

Startup follow-up: the browser's early Solstice samples exceed both 0.1 bounds
before settling. An isolated 5 ms-step comparison using the existing light-link
solver policy produced the same startup errors as the baseline; raising its
position iterations to the existing engine cap reduced but did not resolve them.
The native rotor representation increased the startup errors in the same
short comparison, so neither experiment is a fix.
A comparison using the existing light-link policy with 120 velocity iterations
kept all 110 startup samples within both bounds. A narrowly scoped authored
model preset also passed the full simulated program and the disconnected
control under the unchanged bounds. Run the held browser diagnostic, including
startup observations, before considering promotion. Keep early samples and
the bounds unchanged; Solstice remains experimental.
