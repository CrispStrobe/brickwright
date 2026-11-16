# tempest-pendulum — source record

- **Origin:** the Tempest serial double pendulum intake already in the Robot Lab experimental registry (CrispStrobe, BSD-3-Clause; loose LDR and BW files, checkpoint `docs/data/robot-lab-experimental-checkpoint.json`). Program bytes are unchanged.
- **Adaptation at promotion (R4):** start-guard pose repair. The saved pose was not a gravity rest: the unpowered cold settle swung the carrier 39.8° by 400 ms. The carrier is re-posed to its rest at 102.5° and both arms are translated so they hang straight down from the moved shoulder; it now moves 0.08° in 500 ms (0.25° in 2 s). Parts, colours and IDs are unchanged; the MPD wrapper matches the LDR.
- **Law (`double-pendulum-mode-v1`):** `judgeDoublePendulum` in `scripts/lib/sim-lab-r4-judges.mjs`. Two compound pendulums in series on a held carrier; the normal modes come from the engine's compiled mass properties (slow 0.6650 s, lower/upper +1.485; fast 0.2989 s, −1.436), which the qualification test recomputes. In each held window the arms must be the sum of the two modes.
- **Disconnection** (`motor_pin_h3` and `motor_pin_h5` removed: the motor no longer drives the carrier. Cuts that change the hanging load, such as the elbow axle or a bob, make the carrier re-settle and the program's own start guard refuses, so they cannot serve as the control.)
- **Piece count:** 69, honest; qualification has no piece minimum (operator decision 2026-11-07).

- **Building instructions:** coarse authored assembly-stage `0 STEP` markers were removed so the native connector-based generator produces connected pages of at most six parts. Placement records and their order, colours, transforms, ports and program are unchanged.
