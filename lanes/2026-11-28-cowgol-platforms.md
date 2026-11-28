# Cowgol platform expansion and default-branch integration — 2026-11-28

Status: DONE. Owner: ChatGPT, at the repository owner's request.
Implementation and focused qualification are complete; the final candidate must pass its normal enabled pull-request checks before default-branch landing.
Branch: `feat/cowgol-platforms-20261128`, continuing `feat/cowgol-integration-20261128`. Base: `2f5aebabc023d5473958a549318d99adfd92819a`; current default at claim: `ca1e54a6733d17f9a97ffca12747af28c8f3849d`.

Continue the existing Cowgol integration lane with two qualified expansions: booted MS-DOS 2.0 on the actual 80386 core (console and Controller display), and an explicit bare ATmega168P 16 MHz runtime with its own 16 KiB flash and 1 KiB SRAM limits. Retain source ownership, cancellation, image policy and target validation across both routes.

Owned paths: Cowgol editor/client/CLI routes, the 386 DOS bench and associated machine activation/schema/runner integration, Cowgol tests and witnesses, related documentation/workflows, and the exact producer pin plus its map-derived source/gallery/mirror outputs. Owning sibling boundaries: `CrispStrobe/cowgol` runtime and execution oracle, `CrispStrobe/stc-compiler` target build/service/demo, and `CrispStrobe/sb3-creator` checked generation/source contracts. Preserve unrelated main and open-PR work. Machine-engine pins remain fixed unless independently qualified.

The owner now explicitly requests incremental GitHub saves and an attempt to merge the completed integration into each repository's default branch. This supersedes the earlier lane's feature-only delivery direction. Use reviewed dependency order, normal protected-branch PR merges, and exact supplier identities; never overwrite newer default-branch work or bypass a failed gate.

Qualification: dedicated conversion/editor/ownership/refusal tests; exact-MCU cold-memory, heap/stack, flash and GPIO/delay execution for ATmega168P; full Cowgol and checked DOS programs booted through the guest kernel with live shell input and rendered text on 386; regression runs for existing compiler targets; canonical producer identity/gallery/mirror checks; normal enabled PR checks. No physical-board or production-app release claim follows merely from these software checks.

## Delivered implementation

- Actual 80386 booted MS-DOS 2.0, with separate `dos-boot` machine configuration, a copied checksum-pinned floppy image, guest-owned INT 21h, live shell input and Controller text display. Four CPUs now have console and display routes through both the DOS-service bench and the booted OS.
- A distinct bare `atmega168p` compiler and checked-generator profile: 16 MHz, 16 KiB flash with no bootloader reservation, 1 KiB SRAM, 128-byte allocation arena and a 512-byte C-stack reservation. The exact MCU and memory limits survive service, editor, CLI, download and AVR execution handoffs.
- Exact target selection in full Cowgol, checked Blocks/pseudocode, keyboard Run, menus and downloads, with existing source/project/device/cancellation ownership retained.
- Reconciled producer main changes, including portable CrispBASIC guards, Pico serial/export fixes and the current gallery. Canonical source and gallery syncs own all generated app copies and tracked mirrors; no local producer fork is introduced.

## Supplier identities

| Component | Reviewed source |
| --- | --- |
| Cowgol compiler/runtime | `89b13e71030f929b40f82018a19b5b3386650342` |
| Compiler service | `597b52f7464313c9774206e570ee8ee47a667a16` |
| Shared producer | `edd30b11967747774cfddd01f8eb888509866c5c` |
| GUI board engine | `d21d6d8b819263eb08231134b7556efa82289a90` (unchanged) |
| GUI AVR engine | `feea84c43e36e578841b5fce640202823b69b7f7` (unchanged) |

The compiler/runtime landed through [Cowgol PR #1](https://github.com/CrispStrobe/cowgol/pull/1), verified on `master` at `84cd7402889e6412a49b04bf68d15503454c2541`.
The compiler service landed through [service PR #22](https://github.com/CrispStrobe/stc-compiler/pull/22), verified on `main` at `bf9da5c4ef669e6039f6e53b326f5bbc3b2f2bd6`.
Producer landing is tracked in [producer PR #264](https://github.com/CrispStrobe/sb3-creator/pull/264); its owning default-branch merge must precede the app merge.
The pins identify tested source commits retained by those merges. Producer test-contract follow-up `1004579ee7bf41b9faa5de7dd69a8f42c0cd0efc` changes only tests, helpers and its workflow; the mapped source roots and gallery are byte-identical to the app's `edd30b1` pin.

## Qualification receipts available before the final app candidate

- Runtime: [normal bridge and AVR PR qualification](https://github.com/CrispStrobe/cowgol/actions/runs/46148703948) passed 19 host, 9 Eater and 22 AVR tests without skips; the [full legacy cross-build](https://github.com/CrispStrobe/cowgol/actions/runs/46148704137) also passed. The 168P oracle uses the actual smaller flash/SRAM model, cold memory, allocator reuse/exhaustion and bounded chip-sized semantic programs.
- Service: [dedicated Cowgol PR qualification](https://github.com/CrispStrobe/stc-compiler/actions/runs/46148706646) passed all 53 tests without skips for the complete nine-target bundle. All eight jobs in [normal service CI](https://github.com/CrispStrobe/stc-compiler/actions/runs/46148706616) passed before merge. Ordinary pytest had 571 passes, 37 conditional skips and 47 passed subtests; those counts are distinct from the unskipped Cowgol suite.
- Producer: [final-source conversion and native PR qualification](https://github.com/CrispStrobe/sb3-creator/actions/runs/46150165902) passed 68 conversion tests and 31 native groups without skips. Native coverage includes all 59 arithmetic cases in programs that fit the 168P. [CrispBASIC boundary qualification](https://github.com/CrispStrobe/sb3-creator/actions/runs/46150165927) passed 474 tests without skips. The normal producer PR workflow remains a separate merge gate. Its complete refusal-call inventory and shared sibling-revision guard requirements are retained; test-only omissions found by that workflow are repaired upstream before landing.
- The earlier app checkpoint `94e1bc50` passed the [full HTTP/CLI CP/M, DOS and C witness](https://github.com/CrispStrobe/brickwright/actions/runs/46148464876/job/140989568413), including all eight DOS-service and all eight real OS-boot surfaces. Its [archived report](https://github.com/CrispStrobe/brickwright/actions/runs/46148464876/artifacts/15265696828) records the exact older service/runtime pins. Both 386 OS surfaces returned to COMMAND.COM with zero ERRORLEVEL and accepted fresh shell input. The final app candidate reruns the witness with the supplier revisions above.

The [canonical supplier snapshot](https://github.com/CrispStrobe/brickwright/actions/runs/46151709712) was saved at `301316b0736180ee84bedb4439b8f33689f65bd3`. It changed 347 generated files, retained all 37 repository root entries, and verified all 6,140 gallery files across 812 directories. Exact transformed-source identity, gallery identity, tracked mirrors and the complete SPIKE round trip passed; all seven focused tests ran without skips. The [archived receipt](https://github.com/CrispStrobe/brickwright/actions/runs/46151709712/artifacts/15266858559) records producer `edd30b11967747774cfddd01f8eb888509866c5c`.

Preflight also pins the dedicated workflow actions to full existing/upstream revisions, explicitly classifies seven provenance-only Git reads under the existing gate-shape rules, and preserves the exact CP/M final-prompt predicate (137,257 equivalence cases, no mismatch). The new verifier CLI suite passes 23 reported tests across 22 real subprocess cases and is included in the editor workflow. Reader coverage and the six missing workflow census entries are regenerated by their canonical tools from the final tree and real observed runs; the five inherited census omissions have successful observations.

The one-use snapshot/evidence workflow is removed from the final candidate. The normal app PR fast tier and dedicated editor, CP/M/DOS/C and all-three-AVR HTTP/CLI jobs must pass before its merge; no failed gate is waived. Automatic identical postmerge runs remain alarms, rather than a second blocking qualification cycle.

## Explicit limits

These are source, emulator and software execution qualifications. Production app/service deployment, physical boards and bootloader upload transports remain separate. The 386 routes use ordinary real mode with a BIOS service adapter; they do not qualify protected mode or a full ROM-BIOS PC. A bare 168P target does not imply ATmega168 Nano/Duemilanove board support, and no ARM board runtime is introduced.
