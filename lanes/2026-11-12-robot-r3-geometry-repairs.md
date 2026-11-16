# Robot Lab — R3 geometry repairs: Vesper, Aster, Apex (repairs, judges, controls, browser gates, promotion); Bloom triaged

Status: CLAIMED 2026-11-12 — claim and change in one PR. Only Apex is promoted. Vesper stays experimental: its hosted
browser run measured the ram 0.504 mm from the kinematics against its judge's 0.5 mm bound. Aster stays experimental: its hosted browser run opened a
hinge 0.55 mm at 800 °/s against its judge's 0.5 mm closure bound; for both, the contract, registry move, fixture and shard
are withdrawn; their judges and construction repairs stay.
Owner: Claude, Robot Lab promotion lane.
Branch: `lane/robot-r3-geometry-20261112`.

Scope: minimal real-part repairs of the shipped LDR/MPD files of `vesper-quickreturn`, `aster-governor` and `apex`
(each edit recorded in the model's source record and the checkpoint), their building steps (STEP markers only, at most
six parts per instruction step); the new judge module `scripts/lib/sim-lab-r3-judges.mjs` and its three ids in
`QUALIFICATION_JUDGES` (`quick-return-v1`, `governor-lift-v1`, `wankel-ratio-v1`; every existing judge unchanged); three
contracts in `docs/data/robot-lab-qualification.json`; source fixtures
`test/fixtures/model-files/{vesper-quickreturn,aster-governor,apex}-source/`; the `r3` disconnection branch and one
wrong-model mutant per model in `test/bw-sim-qualification.test.mjs`; the registry move (`sim-session.js` MODELS after
Orion, `experimental-models.js`, dialect and extension model lists, all in MODELS order); catalogue, lesson and
mechanism entries and their generated outputs; registration tests that enumerate MODELS; the browser gate
(`scripts/lib/sim-lab-q5-browser-gate.mjs`, new shards `robotaddon20`–`robotaddon22` in `build.yml`, Vesper's and
Aster's disconnected controls as second steps on their shards, the shard tests and the readings registration); the
checkpoint review records (including Bloom's), the handoff and the pending file. Programs, start guards and every
existing judge, threshold and gate are unchanged.

Bloom is not repaired here: its scissor pivots are pins in the centre hole of angle connector #4 (32192), which the
mesh check refuses for any pin orientation, and its cage hubs overlap the ring ends by up to 19 LDU; that is a
redesign. The measurements are in the checkpoint's `promotionReview`.

Qualification: run the affected Chromium browser journeys and relevant checks.
Use bounded local or Kaggle compute where appropriate; do not add `ci:full`.
