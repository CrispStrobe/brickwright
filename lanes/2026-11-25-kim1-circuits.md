# KIM-1 in Circuits

- Owner: KIM-1 Circuits implementation lane (`feat/kim1-circuits`).
- Status: BLOCKED on broader upstream qualification; implementation and focused built-app acceptance complete.
- Date: 2026-11-25.
- Base: Brickwright `8e2c4c407205e687ea4330369a40c5fef7e39319`.
- Isolation: dedicated feature branches and selected-file working copies; no shared checkout edits.
- Delivered: bw-board `e834b270cd21ca90be4407610566cdd75750168d` ([draft PR #771](https://github.com/CrispStrobe/bw-board/pull/771)); bw-circuit-ui `a76feb3000e30902537ef986c8c4c76cecf8e407` ([draft PR #176](https://github.com/CrispStrobe/bw-circuit-ui/pull/176)); exact Brickwright pins/lockfiles, original wired gallery lesson, generated notices/census, reproducible app acceptance workflow and receipts.
- Tested Brickwright implementation: `1512f923b42d64ab13dfdba969ef02fc1591bc8d`. The subsequent final receipt/documentation commit changes no implementation.
- Qualification: 1,510,000/1,510,000 NMOS vectors; 26 focused engine/circuit tests; 10 UI integration tests; 11 actual CircuitDesigner browser groups; 179 Brickwright source tests; 5 actual built-Brickwright browser groups. App job [139540746767](https://github.com/CrispStrobe/brickwright/actions/runs/45709736264/job/139540746767) passed. See [feature scope and receipts](../docs/KIM1-CIRCUITS.md).
- Blocker: the unchanged exact-pin upstream verifier is failing. Base engine `e744ede765c76ce15b9e5c101aa23f56210eab09` and candidate `e834b270cd21ca90be4407610566cdd75750168d` have the same multimeter current-mode failure (`0 9 7` expected, `0 9 2` actual); candidate adds exactly 26 passing tests. See [comparison receipt](../docs/receipts/2026-11-25-kim1-engine-ci-comparison.json). The overall app workflow is not green and the broader upstream/default-branch landing gates remain required.
- Research boundary: a research-only agent supplied factual behavior and licensing notes; implementation agents did not receive incompatible source code, ROM bytes or artwork. New KIM-specific implementation/art is MIT; existing file licenses remain. No historical monitor ROM or GPL/NC implementation/assets were reused.
- Compatibility boundary: independent learning monitor, documented NMOS opcodes and instruction-level port/timer model. No original-ROM services, cassette/TTY, undocumented opcodes, expansion RAM, external IRQ/NMI terminals or exact bus-waveform claim.
- Disposition: feature code remains unmerged and undeployed; the lane is not marked DONE while the upstream gate is blocked.
