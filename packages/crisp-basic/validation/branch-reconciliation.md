# CrispBASIC branch reconciliation — 2026-11-28

Read-only GitHub inventory: all four CrispBASIC branches, all 531 Brickwright branches, and all eight open Brickwright PRs. This records the initial observed heads; later work may advance them. Ancestry was checked with GitHub compare. No source branches were deleted or force-updated.

## CrispBASIC

| Branch / PR | Observed head | Disposition |
| --- | --- | --- |
| `main` | `7626346440b7dad4691b2e9e782ad2bf3e1e083e` | Initial main |
| `brickwright-mirror` | `a297da88e0bf7046103ba4c1f0732b83a6fcfbcb` | Already contained by main; two commits behind |
| `feat/bundle-c99-compiler` / [#1](https://github.com/CrispStrobe/crispbasic/pull/1) | `a7ba8f950c75a43e08ce079a70569c1393954add` | Four commits ahead; draft |
| `switchover` | `9b81f4e188137ca1b3d5f0574f37f43416928c29` | One separate commit; no PR; prepared source-ownership transition |

The [switchover commit](https://github.com/CrispStrobe/crispbasic/commit/9b81f4e188137ca1b3d5f0574f37f43416928c29) explicitly requires the board/Pico/compiler work to be reconciled first. It removes six Brickwright-dependent package tests, the old extraction utility and the transition guard. Test relocation and final package synchronization must be verified before applying it. Do not discard these tests or overwrite new compiler work with an older mirror.

## Brickwright open PRs

Initial main: `561957ce675b42f89276bb136a32b58be3dd2911`.

| PR | Observed head | Relationship / boundary |
| --- | --- | --- |
| [#1867](https://github.com/CrispStrobe/brickwright/pull/1867), Compile BASIC | `735b4ca7d8558adcaea34d9666b297b9db09c658` | Draft, stacked on #1866; two commits ahead and six behind its current base branch |
| [#1866](https://github.com/CrispStrobe/brickwright/pull/1866), board targets / recovered work | `6d3d685ddc757cd6ee75c51b5ac731dbe246bfdb` | 195 commits ahead of main; requires current-head hosted and production-editor qualification |
| [#1865](https://github.com/CrispStrobe/brickwright/pull/1865), Cowgol | `5b8c0717c690d5d90befea2ae973d2f306c4f813` | Separate draft; unresolved browser/audit gates |
| [#1857](https://github.com/CrispStrobe/brickwright/pull/1857), SDCC cache | `c2815064c060da3eba53790455e95cc0bd975b27` | Exact head already contained by #1866 |
| [#1856](https://github.com/CrispStrobe/brickwright/pull/1856), SDCC inventory | `950038fd4c13c41d3c13be8dc1ccda6fa91ee314` | Exact head already contained by #1866 |
| [#1855](https://github.com/CrispStrobe/brickwright/pull/1855), Code/runtime/CrispBASIC/xKIM | `737eff86ec419c7ece2b46a26e70257c134eb611` | Exact head already contained by #1866 |
| [#1833](https://github.com/CrispStrobe/brickwright/pull/1833), STC15/8051 | `58a9f7d3962d79e0014a0164a6f728f2e41a90af` | Exact head already contained by #1866; no separate replay required |
| [#1800](https://github.com/CrispStrobe/brickwright/pull/1800), MakeCode experiment | `80e93ee917d28a99c419413bcd5fa15847e68cd1` | Unrelated unfinished draft; not a compiler dependency |

#1867's common base with current #1866 is `8918704a62ba0a5534ed12ec334456c73933a82d`. Later #1866 commits repair ROM mirrors, UART fixtures and the canonical workflow scanner. Include them before final compiler-integration qualification.

## Recovered branches already included by #1866

| Branch | Contained head |
| --- | --- |
| `feature/crispbasic` | `f57479185974a3a658fe5899183448ddf9792413` |
| `feature/crispbasic-runtime-ports-20261128` | `597fc385277769c10c9c5791081b19002e638b6f` |
| `feature/crispbasic-emulator-ports-20261128` | `adc82ad6888b12a4816afa6bf588c67360b0f61e` |
| `feature/crispbasic-portable-simulators-20261128` | `f66e9e68b86b08d714cab37152dde81e0afe4658` |
| `feature/crispbasic-board-cli-20261128` | `0998294b48082d06a205e84083fba16b0b56d4f4` |
| `feature/crispbasic-board-profile-api-20261128` | `dc315b6e4cb50327fd245574b9913a42a5d5e5b4` |
| `feature/crispbasic-board-target-examples-20261128` | `95081a9b71be5a32dfe01666a0ab247562c2031a` |
| `recovery/crispbasic-editor-proof-20261128` | `815d86dcad47d1c6d9fbaada48fc4af961c00c13` |
| `recovery/crispbasic-cad-lifecycle-20261128` | `ea13d3ca3e4709342d8f389d6d2ac8bf8b45adec` |
| `recovery/crispbasic-finish-20261128` | `52c8e89976b6c019ac32307800557b9e0a967e55` |

Every observed `fix/crispbasic-*` branch and `fix/kim1-platform-localization-20261128` is also contained. `fix/crispbasic-workflow-census-20261128` equals #1866's head.

## Separate extraction and WIP checkpoints

| Branch | Observed head | Scope |
| --- | --- | --- |
| `chore/crispbasic-upstream-20261128` | `6117750c1193703cec6c087f636cc0cc9bc8ab66` | One ten-file extraction-consumer commit atop broad aggregate history |
| `chore/crispbasic-upstream-switchover-20261128` | `0da658fc3cd99097362dca4b37652ec109e80dae` | Prepared test relocation / source-ownership transition; explicitly not ready to merge |
| `wip/chore/crispbasic-upstream-20261128` | `780f2ae508b7009534b03b46d512e341a31405a1` | Earlier usage-limit checkpoint |
| `wip/feat/crispbasic-pico-20261128` | `bb9ae4f6eebac63b8a7eef6027c1fa3c980631a6` | One two-file WIP commit atop `a7abfb94b28f2ad8067ab0a9c9ebe2cc5d64f2ef` |
| `wip/feat/crispbasic-compile-20261128` | `c8b0befe3b2f356737c50df084ac5f3b7255dd91` | One five-file early compiler WIP on the same parent |
| `integ/followup-lanes-20261128` | `7367d5455bdbd3a3c9ff35af4a2387d95ad88567` | Broad aggregate including unrelated Cowgol/media work |

The extraction branches diverge from #1866 by 59/60 commits ahead and eleven behind. Their single-purpose tips can be reviewed separately; wholesale branch merging also imports unrelated Cowgol/media history. Cowgol #1865's retained [strict run](https://github.com/CrispStrobe/brickwright/actions/runs/46168276196) reports 24 unqualified browser probes, four SEGMENT-MATCH findings and one WINDOWED-SEARCH finding, with no successful final-tree receipt. These are not waived by the compiler merge request. MakeCode #1800 remains a separate unfinished experiment.

## Landing approach

Preserve existing branches and normal merge ancestry. Bring #1866's current fixes into #1867, qualify #1866 before landing its contained histories, qualify the extracted compiler, then update the immutable compiler pin and qualify the composed editor integration. Reconcile extraction-only commits and moved tests against the final package source. Keep separately preserved WIP checkpoints out of the production path unless their implementation and qualification are actually complete. Queued, superseded and earlier-head checks are not current-head passes.

## Bounded WIP source audit

Both snapshots are explicitly titled “WIP snapshot … agent paused by usage limit” and have the same parent, `a7abfb94b28f2ad8067ab0a9c9ebe2cc5d64f2ef`. Their broad branch ancestry is not the scope of their WIP additions.

### Pico interpreter checkpoint

[Commit bb9ae4f6](https://github.com/CrispStrobe/brickwright/commit/bb9ae4f6eebac63b8a7eef6027c1fa3c980631a6) adds exactly two files, 360 lines:

- [`packages/crisp-basic/pico/picobb-library.mjs`](https://github.com/CrispStrobe/brickwright/blob/bb9ae4f6eebac63b8a7eef6027c1fa3c980631a6/packages/crisp-basic/pico/picobb-library.mjs): a BBC BASIC portable-pin library appended at reserved lines 65280 onward, plus ASCII/line-limit validation and serial command preparation.
- [`scripts/lib/crispbasic-picobb-rp2040.mjs`](https://github.com/CrispStrobe/brickwright/blob/bb9ae4f6eebac63b8a7eef6027c1fa3c980631a6/scripts/lib/crispbasic-picobb-rp2040.mjs): a prospective PicoBB firmware/emulator harness that records UART, GPIO and circuit observations.

The snapshot contains no `pico/picobb.lock.json`, despite the library comment promising one, and no promised `overlay/scratch-gui/src/lib/bw-machines/crispbasic-picobb-library.js` mirror. There is no firmware builder, new CLI route, GUI caller, test or workflow invocation for either export. Git references to `crispBasicPicoProgram` occur only in these two files; `runCrispBasicOnEmulatedPico` occurs only at its own definition. The helper accepts an arbitrary caller-provided UF2 and checks its flash base, but contains no firmware hash/manifest verification. Thus it is unfinished work toward the separate Pico interpreter route, not a delivered or qualified alternative to the compiler's pico-sdk route.

The existing native and ARM tests ran, but [its runtime workflow](https://github.com/CrispStrobe/brickwright/actions/runs/46171504253) failed at “Verify source round trips, controller profiles and coupled CAD physics”; downstream production and portable jobs were skipped. This does not attribute that inherited integration failure to the two new files, nor establish execution of the new harness. Preserve the checkpoint and finish its pin/build/delivery/tests together if that separate route is resumed. It cannot be claimed as superseded by the C99 compiler, but leaving it out of production loses no previously wired route.

### Older compiler checkpoint

[Commit c8b0befe](https://github.com/CrispStrobe/brickwright/commit/c8b0befe3b2f356737c50df084ac5f3b7255dd91) changes exactly five package files: `bin/crispbasic.mjs`, `native/crispbasic.c`, `scripts/build-native.mjs`, `src/bundle.mjs`, and `src/compiler/lexer.mjs`.

The CLI imports `src/cli-tools.mjs`, which does not exist in that commit. The lexer is the only file in `src/compiler/`; there is no parser, code generator or C runtime. The CLI therefore cannot invoke either advertised command. It contains no new tests. [Its runtime workflow](https://github.com/CrispStrobe/brickwright/actions/runs/46171499842) also failed at the source-roundtrip/controller/CAD stage; successful existing native/ARM jobs did not qualify a compiler.

The extracted PR #1 supersedes its headless native/web packaging design with wired commands, verified runtime inputs, artifact tests, and additional full SDL profiles. Its differing experimental overlay format and `--web`/`--emit` spellings were never a completed released interface.

One semantic idea remains useful: the WIP lexer tracks the complete BBC keyword set, keyword delimiters and abbreviations. It is explicitly a translated adaptation of permitted BBCSDL lexical code, not proprietary compiler code. The completed independent compiler does not use it. A bounded source probe during this audit found that the independent compiler accepted `CLS=2:PRINT CLS:END`, `OPENOUT=3:PRINT OPENOUT:END`, and `PRINT RND2:END`; this raises a reserved-word/delimiter compatibility risk that was passed to the compiler-validation owner for actual interpreter comparison and an independent fix. The probe establishes acceptance only, not interpreter parity. Do not transplant the abandoned compiler wholesale to retain this semantic lesson.


## Reconciled candidate

The standalone compiler candidate contains every original CrispBASIC branch head through normal merge ancestry. The prepared switchover was composed in `8430c861b5cd467349e0b07efdd61baec92ff51f`, retaining compiler/MCU validation gates and importing the four supplier-provenance corrections from Brickwright. The six dependent integration suites were relocated in the coordinated Brickwright adoption branch and executed against the real WASM interpreter.

The lexical concern above was confirmed against BBCSDL and corrected independently in `4486adb6d5a93ed7e33bc999f2e44f25040003d1`. Native AArch64 and ARMv7 numeric edge cases were fixed in `d93388c2a9bed8a294be37c3e28560523fd84aa4` and `3c54195cfc696edac2c6d9e776360bb2e9592256`. Those commits and the durable compiler evidence at `eff597d992898d5d604bb95486c1b10e13d5c4ce` are included. The compiler receipt records 347 passing test executions across core, all three native architectures and binary64/WASM, without skips.

Fresh bundled execution passes 36 native SDL tests across x64, ARM64 and ARMv7. The web runtime builds and passes its five packaging checks; local Chromium was blocked before page execution by the managed workspace socket restriction. The separate SDL receipt records that limitation explicitly. Fresh MCU verification executes four fixtures on two cold boots of both Uno and Pico, for 16 successful runs with regenerated artifact hashes.

Brickwright #1867 first incorporates #1866 at `bd2e5e6d16150bc6e6147dcdffc1cb5382206a80`. The extraction-only and test-relocation commits are composed on `review/compile-basic-adoption-20261128`, excluding unrelated aggregate ancestry. A real supplier synchronization repairs the live firmware manifest/archive at `0f4920cbba99214fd5262439e274d0eb67d20210`; all 71 archive source payloads/modes/links and the firmware bytes remain unchanged, and the complete pin-history checks pass. Its ancestry is included by the consumer candidate at `7a6576b4bd2cfa40b4b64d63e0582048989817bb`.

The historical tables above are an audit snapshot, not final PR status. Final heads and merge results must be read from GitHub. Pending hosted checks are never recorded as successful local execution or as a passed hosted gate. The unfinished Pico interpreter checkpoint and unrelated Cowgol/MakeCode drafts remain separately preserved.
