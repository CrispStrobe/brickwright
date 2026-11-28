# CrispBASIC named board targets and prior-work reconciliation

- Owner: ChatGPT, implementing the user's CrispBASIC platform-target request.
- Branch: `feature/crispbasic-board-targets-20261128`.
- Base main: `ccc5c6405bd2065ab85d42fe660fb0bee391422f`.
- Integration source: `integ/followup-lanes-20261128` at `75ef242745ee83ce208835909c88a1b309f9200a`, preserving the recovered CrispBASIC, Code runtime and relevant supplier history.
- Status: DONE (implementation complete; current qualification and landing are tracked in PR #1866).
- Scope: named CrispBASIC board-target discovery and portable execution for 8051/STC, STM32F030, Pico/RP2040, Arduino Nano, ESP8266 and micro:bit; strict target pin validation; CLI/API integration; examples, documentation and focused qualification. Preserve the distinction between host-driven logical simulation and firmware executing on the target CPU.
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

## Initial shared workflow scanner findings

Hosted qualification of `8918704a` exposed one additional shared-tool defect:
JavaScript receipt properties inside a YAML block scalar were interpreted as
checkout fields. CP1/CP5 browser execution passed, but that census failure also
blocked the PXT controls gate.

The canonical owner is `CrispStrobe/bw-circuit-ui`. Its initial proposed fix was saved
in PR #186 at `f2ee9d32244f898a7c329a10e36070e46c72eed6`, scanner Git blob
`6e79894bc2c4f09a38f13c4c98de04eb33ade3c3`. Independent review then found a
multiline quoted-YAML counterexample, prompting further producer corrections
before adoption. The initial checkpoint saved the consumer regression while
canonical repair, hosted qualification and normal merge were pending.

The exact 43 consumer workflow sources were loaded with the actual scanner,
vendor-pin helper and complete existing consumer test file. With the added
regression, the old scanner passes 7/9 and fails the two scalar cases at the
same production workflow line. The proposed canonical scanner passes all 9,
auditing all 33 external checkout sites. The new regression retains exact
line numbers and rejects missing, moving, dynamic and duplicate checkout refs,
as well as raw clones inside scripts.

This standalone tooling adoption has its own producer history. The installed
runtime CUI pin and sealed HDD/source identities remain unchanged.

## Independent hosted-gate repairs

The desktop UART fixture was probing the same reader mutex as the worker.
The worker could therefore correctly return Busy before the observer detected
ownership. Commit `3fe655d9ceaee0edb3b840e4fba9e4b3b1f3ea53` replaces that
competing probe with a per-connection, one-shot `cfg(test)` rendezvous after a
real retryable read under acquired ownership. Busy, Close, Cancelled, peer EOF
and second-socket assertions remain. The five-second setup bound and 300 ms
cancellation bound are unchanged. Independent source review found no trait,
lifetime or lock issue; actual Rust compilation/execution requires hosted CI.

Build preflight and focused debugger qualification also found exactly two
tracked-pair mismatches. Commit `9f719245aa4c7e5c5f95f49fba59f4005089e7f0`
copies the canonical overlay ROM provenance blobs to the package mirrors:

- `i8086-bios.provenance.json`: `8030af9615a3fd225491d82036fd15981603cc7b`.
- `i8086-demos.provenance.json`: `5c4a04ef505bbeac76fb85ee68553e44bd872075`.

The current Board pin is `cda715c16d4b733ceb73f7720a236b5ea9e3f21d`;
all ROM, assembler and source-content hashes already agree. This preserves the
canonical original metadata verbatim and retains the existing parity gate.

The known mirror preflight prevents every unit shard from reaching its full
tests. These independent repairs are integrated now to let that matrix advance.
The separately reviewed shared-scanner adoption is recorded below.

At the preceding `8918704a` head, native x64/ARM64, real WASM including
14 mounted-browser scenarios, ARM CPU emulation and all three portable CLI
platforms passed. These results are historical evidence; this new candidate
must receive its own required hosted qualification.

## Reviewed canonical scanner adoption

The quoted-YAML counterexample is corrected in canonical producer commit
`ad3941e5417da7ffe162dc31cc5f5de8bdca5c67`. The helper is copied byte-for-byte
from its checked normal merge, `a89c071ce4abba1323a701d7bd09d3c9372e35df`, in
`CrispStrobe/bw-circuit-ui` PR #186. Its exact Git blob is
`e3b63262b4d80167130b4a882833d2f459628b75`.

All nine focused producer tests and 31 YAML fixtures passed. Independent source
review also passed. All ten complete consumer tests passed using the exact
43 workflow sources and 33 external checkout sites. The quoted-YAML consumer
regression was separately checkpointed in
`999abb5f265a302200ea87d8e9c987b4ce33e23a`; this integration preserves it.
The original raw-clone and invoked-script validation remains intact.

Canonical [CI run 46176227396](https://github.com/CrispStrobe/bw-circuit-ui/actions/runs/46176227396) completed successfully on exact producer head `ad3941e5417da7ffe162dc31cc5f5de8bdca5c67`: the `test`, `interaction-gate` and `kicad-oracle` jobs all passed before its normal merge.

The installed CUI runtime pin is unchanged. This tooling adoption records its
own canonical source history here; it does not alter runtime supplier pins,
sealed source hashes or artifact receipts.

The combined integration commit still requires its own selected hosted CI
and completed production-editor qualification before landing on main.

## Hosted evidence for the UART repair

On integration commit `cd5770a0cf92ab67d75e23b779bbb5236630986d`,
the [actual hosted Rust job](https://github.com/CrispStrobe/brickwright/actions/runs/46175419688/job/141072872684) passed. Its repaired
`synthetic_close_cancels_pending_read_and_only_its_own_socket` test passed;
the default suite reported 276 passed, zero failed and 11 existing ignored.
The isolated lockstep test and all nine peer tests also passed. This verifies
real Rust compilation and execution of the test rendezvous. The debugger
contracts passed on that same checkpoint. The subsequent combined head
still requires its own selected CI qualification.

## Concurrent compiler stack

Draft [PR #1867](https://github.com/CrispStrobe/brickwright/pull/1867) at
`f9d828a9b320d26b163c9d4566bf2fa4d933277f` explicitly targets this PR's
branch and has the sole parent `8918704a62ba0a5534ed12ec334456c73933a82d`.
It adds an independent C99 compiler/editor route. Against current
`cd5770a0cf92ab67d75e23b779bbb5236630986d`, its entire
`packages/crisp-basic` tree (`f6ee41984d41beeddbe8f0f379741e226ffe99d4`)
and `vendor-pins.json` blob (`9ade41e99c3cf94d2fabffe07c1f1d798a85c8d8`)
are identical. It is subsequent work that depends on this integration, not
an omitted prerequisite. Its draft and source branch remain untouched.

## Concurrent STC15 distribution provenance repair

Preserve concurrent commit `0f4920cbba99214fd5262439e274d0eb67d20210`,
a direct child of the scanner adoption checkpoint. It regenerates the outer
STC15 distribution manifest and source archive at the installed Board pin
`cda715c16d4b733ceb73f7720a236b5ea9e3f21d`, following the unchanged
`scripts/sync-bw8051-firmware.mjs` contract.

Independent review compared both archives and exactly reproduced the new gzip:
`0007ad2a1db63b048186c5422f0a63ed4799996e073ed1dbc62ba4fefa084b54`.
All 71 real entries preserve names, payloads, modes, links and ownership fields;
all 52 archived regular-file blobs match the exact pinned Board tree. All ten
loose assets match the upstream blobs and unchanged manifest hashes. Only Git
archive commit/time metadata, tar checksums and the resulting digest change.
The existing HEX images, source/build records (including SDCC 4.5.0), licenses
and README retain their bytes. The tracked package static tree has no firmware
directory; the unchanged integration copy stages these overlay assets.
This is distribution regeneration, not new compilation or measured evidence.

## Fetch-pinning fixture correction

The canceled `6d3d685d` unit job exposed a real failed guard before cancellation:
[unit (5/8)](https://github.com/CrispStrobe/brickwright/actions/runs/46179137996/job/141088390274)
reported a red fetch-pinning baseline, 15/16 passing, and exited 2. Its sole
undeclared census hit is the inert unsafe-clone command inside the new workflow
scanner regression fixture. The gate correctly treats literal content-fetch
commands as census subjects even in test sources.

The one-file repair checkpoint is `98f5016ddc411a64e0e6701da13cd1f3f26366ad`,
with tested consumer blob `207fb1a705e60751dda4445e1972532dfe984146`.
On Node 24.22.3, the unchanged full fetch-pinning gate reproduces 15/16 before
and passes 16/16 after the correction, with zero skips. All ten complete
consumer workflow regressions pass with zero skips. The unchanged prover
catches all eleven mutations for their stated reasons, restores seven files
byte-for-byte and finishes with a green gate. Capturing the actual regression's
generated `clone.yml` before and after proves identical runtime fixture bytes
and the same real unsafe-clone refusal.

This runs against the exact `0f4920` Git index: the untruncated source inventory
contains 24,241 entries and 22,298 tracked blobs. The audit materializes and
Git-blob-verifies all 12,479 required census-visible/dependency files
(196,933,826 bytes); the census is not replaced with a reduced mock.

The correction assembles the exact same fixture command at runtime. It keeps
the unsafe-clone negative assertion and all checkout/ref cases intact. The
fetch census, declared inventory, production fetch sites, canonical scanner
and mutation prover remain unchanged. Implementation release is recorded as
DONE in this same integration candidate; the selected exact-head hosted suite
and completed production-editor qualification are still the landing gates.
Their final outcomes and the guarded main advance are recorded in PR #1866,
without a later ledger-only successor or duplicate qualification cycle.
