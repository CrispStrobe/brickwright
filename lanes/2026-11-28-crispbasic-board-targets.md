# CrispBASIC named board targets and prior-work reconciliation

- Owner: ChatGPT, implementing the user's CrispBASIC platform-target request.
- Branch: `feature/crispbasic-board-targets-20261128`.
- Base main: `ccc5c6405bd2065ab85d42fe660fb0bee391422f`.
- Integration source: `integ/followup-lanes-20261128` at `75ef242745ee83ce208835909c88a1b309f9200a`, preserving the recovered CrispBASIC, Code runtime and relevant supplier history.
- Status: implementation complete; hosted integration qualification pending.
- Scope: named CrispBASIC board-target discovery and portable execution for 8051/STC, STM32F030, Pico/RP2040, Arduino Nano, ESP8266 and micro:bit; strict target pin validation; CLI/API integration; examples, documentation and focused qualification. Preserve the distinction between host-driven electrical/logical simulation and firmware executing on the target CPU.
- Paths: `packages/crisp-basic/`, direct CrispBASIC integration tests and packaging/qualification files, and this claim. Inherited integration repairs cover the Code example-loader/serial fixtures, mirrored Circuit teardown and KIM-1 UI localization, source/pin identity checks, and the unchanged BASIC-oracle workflow's reviewed notice projection. Existing feature branches remain preserved.
- Producer boundaries: reuse exact qualified `bw-board`, `sb3-creator` and CrispCAD revisions; canonical upstream behavior stays upstream.
- Qualification: source/API/CLI negative tests, real WASM execution for each new target, existing runtime and integration CI, mirrored asset identity and guarded remote integration. Missing artifacts and failed checks remain failures.
- Authorization: the user requests incremental remote checkpoints and an eventual proper merge to remote main. Preserve existing branch history; use ordinary non-force updates.

## Saved result and verification

The target API, CLI and browser package expose all 18 canonical board profiles.
Named aliases include the requested 8051/STC, STM32F030, Pico/RP2040, classic
Nano, ESP8266 and micro:bit families. Eight executable program/fixture pairs
exercise the real interpreter; all capability reports distinguish logical
simulation from MCU firmware or physical equipment.

Focused checks passed: 15 target API tests, 32 CLI discovery/refusal checks,
25 real-WASM tests with zero skips, and two real-WASM CLI executions. The
archived runtime's unchanged compiler/C inputs and binary identities were
verified; its sole lock delta is two native ARM32 records. This is execution
evidence, not a fresh distribution build. The detailed scope is in
`docs/receipts/2026-11-28-crispbasic-board-targets.json`.

Inherited repairs preserve their negative controls: four browser-harness tests,
two touch-release tests, the scoped-pin receipt controls, eight oracle/source
seal checks, 52 JSX routing checks, 15 confirmation probes, 11 delivered-output
observer checks, and four locale behavior tests passed. Both modified KIM JSX
sources parse and their locale attributes satisfy the existing literal rule.

Current-head CI, the fresh runtime build, supplier/mirror identity and complete
production-editor qualification remain required before merging implementation
to main. Queued/unassigned hosted jobs are not treated as successful checks.

## Concurrent integration review

The later aggregate `0f56c8be9ed2dfd2e5ce589cc746eda7a54ebd31` was
reviewed against the chosen `75ef2427` base. It leaves the Board and Circuit UI
pins unchanged and does not modify the CrispBASIC package or runtime tests.
Its additional `crispBasicMode.js` copy has the same Git blob as the existing
prefixed module. The newer sb3-creator pin adds Cowgol/RISC-V work and leaves
that CrispBASIC mode source unchanged. No missing target dependency was found;
the exact, already reviewed producer pins remain authoritative for this lane.

## Final inherited-gate corrections

The old integration logs exposed four further deterministic failures in the
inherited tests/inventory. Each correction keeps the product behavior and
existing enforcement in place:

- The console blur fixture now uses the production AT VGA widget shape, so the
  four existing lifecycle and pointer tests execute their assertions. The exact
  original test file passes 0/4 before the fixture correction and 4/4 after it.
- The Arcade motion test is declared for its exact existing GUI package import.
  Six checks through the unchanged boundary judge confirm the old missing-entry
  failure, the reviewed entry, unrelated-test and unknown-specifier refusals,
  and preservation of all remaining inventory entries.
- The supported-language test now executes the actual render method and
  examines its output. Six tests pass, including the original locale/ASM
  checks; four deliberate mutations are refused (lost null guard, wrong
  language, lost standalone exclusion and empty disclosure).
- Arcade tests now accept the implemented hue path and still refuse unsupported
  saturation/brightness/transparency, dynamic parameters and legacy opcodes.
  Three focused tests pass using the actual parser, exporter statement methods
  and emitted helper, including wrapped hue changes and negative controls.
  The committed tests invoke the full project exporter, which remains part of
  the hosted integration gate.
