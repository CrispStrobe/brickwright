# CrispBASIC named board targets and prior-work reconciliation

- Owner: ChatGPT, implementing the user's CrispBASIC platform-target request.
- Branch: `feature/crispbasic-board-targets-20261128`.
- Base main: `ccc5c6405bd2065ab85d42fe660fb0bee391422f`.
- Integration source: `integ/followup-lanes-20261128` at `75ef242745ee83ce208835909c88a1b309f9200a`, preserving the recovered CrispBASIC, Code runtime and relevant supplier history.
- Status: in progress.
- Scope: named CrispBASIC board-target discovery and portable execution for 8051/STC, STM32F030, Pico/RP2040, Arduino Nano, ESP8266 and micro:bit; strict target pin validation; CLI/API integration; examples, documentation and focused qualification. Preserve the distinction between host-driven electrical/logical simulation and firmware executing on the target CPU.
- Paths: `packages/crisp-basic/`, direct CrispBASIC integration tests and packaging/qualification files, and this claim. Reconcile inherited integration failures without weakening gates or changing other owners' branches.
- Producer boundaries: reuse exact qualified `bw-board`, `sb3-creator` and CrispCAD revisions; canonical upstream behavior stays upstream.
- Qualification: source/API/CLI negative tests, real WASM execution for each new target, existing runtime and integration CI, mirrored asset identity and guarded remote integration. Missing artifacts and failed checks remain failures.
- Authorization: the user requests incremental remote checkpoints and an eventual proper merge to remote main. Preserve existing branch history; use ordinary non-force updates.
