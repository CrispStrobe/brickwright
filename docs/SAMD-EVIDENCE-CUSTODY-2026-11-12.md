# SAMD retained-evidence custody — 2026-11-12

Status: input custody verified; original consumer-result custody remains open.
This handoff supplements the existing
[adoption record](SAMD-NATIVE-GAME-HANDOFF.md) without promoting its historical
results to a new runtime or physical-hardware qualification.

[PR1533](https://github.com/CrispStrobe/brickwright/pull/1533) landed as
`9f1a620f2aae5ee988ed02069a8bf34c18949123` with 17 successful checks, 11 conditional
skips and one enabled failed admission check. The
[failed check](https://github.com/CrispStrobe/brickwright/actions/runs/40836953746/job/123335306292)
remains a failure. [PR1562](https://github.com/CrispStrobe/brickwright/pull/1562)
corrected that record; later policy changes do not change the original verdict.

The current standalone readback opened all 24 retained files in the following
input groups and matched their bytes and SHA256 digests to the existing
manifests: 284,547,326 bytes in total. This verifies retained input custody and
includes the archived metadata and original logs as well as the input archives.

| Retained input group | Original run | Files matched |
| --- | --- | --- |
| Frontend | [40783464522](https://github.com/CrispStrobe/brickwright/actions/runs/40783464522) | 6 |
| Native executable | [40803428616](https://github.com/CrispStrobe/brickwright/actions/runs/40803428616) | 7 |
| SAMD engine and producer results | [40699886470](https://github.com/CrispStrobe/bw-board/actions/runs/40699886470) | 11 |

The consumer-result custody is a separate unresolved boundary:

| Historical result | Exact job | Observed official status |
| --- | --- | --- |
| Browser game, run40826297334 | [browser123290650463](https://github.com/CrispStrobe/brickwright/actions/runs/40826297334/job/123290650463) | SUCCESS; the overall run failed in its installed job123290650497 |
| Installed game, run40828345515 | [installed123297230735](https://github.com/CrispStrobe/brickwright/actions/runs/40828345515/job/123297230735) | SUCCESS; browser was conditionally skipped |

The prior acceptance record reports three fresh games per realm, 102 RGB frames,
press/release behavior, sampled RSS and identity joins. This review has not
accessed those original result archives, so it does not establish a new
independent audit of those frames. The needed artifact names are
`samd-actual-browser-game` and `samd-actual-installed-game`. On 12 November both
runs' artifact listings contained zero entries; their source workflows declared
14-day retention. That listing does not establish the status of a custodian's
retained copy. No original was downloaded again and no guest was replayed.

The later selected-tier policy and consumer-event wiring landed through
[PR1536](https://github.com/CrispStrobe/brickwright/pull/1536), merge
`81d8f4929a17e1d0c645c07b99eda0dd818d9642`, reviewed head
`2e7846f8a901726a296e3a8ef006cff24bc457b5`. Its PR rollup has 19 successes and
10 conditional skips; its automatic fast run40869114327 succeeded. However,
the separate full run40869128682 on that same head failed: 33 jobs succeeded,
four were conditionally skipped and these two failed:

- [browser (heavy), job123463606621](https://github.com/CrispStrobe/brickwright/actions/runs/40869128682/job/123463606621).
- [browser (light), job123463606624](https://github.com/CrispStrobe/brickwright/actions/runs/40869128682/job/123463606624).

The two already-retained failure logs were accessed and matched their previously
recorded SHA256 digests: 293,548 bytes for heavy and 605,264 bytes for light.
Their precise observed failures were:

- Heavy: `scripts/verify-machine-loader-rom-control.mjs:106`, in
  `open8086Machine`/`driveTimerdemo`, waited 30 seconds for a file chooser.
  The following Machine Loader proof upload also failed because no files existed.
- Light Circuit UX: `scripts/verify-circuit-ux.mjs:338` waited 30 seconds for the
  visible designer's `[data-circuit-view-toggle]` after opening More circuit
  controls.
- Light Code chrome: `scripts/verify-chrome-sweep.mjs:189` passed the real edit
  and enabled Undo checks, then waited 30 seconds for the first `.cm-content`
  text to equal the pre-edit buffer after clicking Edit Undo.
- Light CPX: `scripts/verify-cpx-circuit-face.mjs:169` waited 30 seconds for a
  file chooser during Open circuit.

These observations locate failed UI transitions. They do not prove the
underlying product causes or an engine/hardware failure. No log was downloaded
again, no test was replayed and no assertion was changed.

A later main-push [run41735633603](https://github.com/CrispStrobe/brickwright/actions/runs/41735633603)
on different head `f17192e868049eff3487377a996fc3ffa03f76ac` succeeded. Official
metadata records these narrower successful contexts:

| Later job | Successful named steps |
| --- | --- |
| [heavy126265415625](https://github.com/CrispStrobe/brickwright/actions/runs/41735633603/job/126265415625) | Machine Loader preset reaches the debugger |
| [light126265415413](https://github.com/CrispStrobe/brickwright/actions/runs/41735633603/job/126265415413) | Circuit UX; Code chrome/Controller/faceplates/Instruments; CPX native circuit face |
| [FPGA126265414425](https://github.com/CrispStrobe/brickwright/actions/runs/41735633603/job/126265414425) | Builder canvas without synthesis, pinch, flag-on surface and learning path |

This is later-head workflow metadata, not an independent readback of its
application artifacts or the original SAMD frames. It preserves the old failed
verdicts and does not identify their fixes or replace the missing result custody.

Remaining work:

1. Identify the custodian and locate the already-retained browser and installed
   result archives, their acquisition records and identity receipts.
2. Review those originals with a standalone reader, joining consumer, frontend,
   executable, observer, engine, profile and firmware identities before any new
   independent frame/input/memory acceptance claim. Do not replay or download a
   successful original merely to read it.
3. Reconcile the old heavy/light observations with the later successful metadata
   through their owning delivery lane before broader application claims. Preserve
   each head's evidence, original failures, thresholds and assertions; do not
   rerun an unchanged failure or relabel a later pass as the original result.

Physical capture, a normal SAMD GUI compile/import/export route and universal
real-time performance remain separately scoped work.
