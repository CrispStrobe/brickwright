# Lite and CAD integration improvements — 2026-11-16

## Saved work

Lite branch: `feat/cad-integration-improvements-20261116`, draft PR [#1798](https://github.com/CrispStrobe/brickwright-lite/pull/1798).

Final runtime source checkpoint: `072dd0faab399132faa01db5d9375046ba143305`.
Runtime source tree: `32c8a157604aac8f1c95b17c5b76502dc13a0b87`.

CAD branch: `feat/lite-cad-integration-20261116`, draft PR [#69](https://github.com/CrispStrobe/brickwright-cad/pull/69).
CAD source merge: `adac88f945d654bbf0af62ffee049d5380782362`; documented checkpoint: `0df09ad88148eeb2b89240a2bfafdfe8aa764cf5`.

Both branches were saved incrementally. No GitHub Actions run was requested, rerun or awaited. Neither main branch was changed.

## Recent source reconciliation

Lite main was `259a563d71391f8b310b2c4b7fb2d3bb4d607971`. The continuation PR #1796 was still open, so its complete head `773971932cf6e6aa4f2ef1cf163787626a33d77b` became this branch's starting point.

| Source | Integration decision |
| --- | --- |
| PR #1797 / `bd4853afca3db570d3f0a67f3f76b03aef3b4ef6` | Preserve its ancestry. Its three provenance files already matched #1796 exactly. |
| Helios / `bc049a7231570c09cb15e21b0e698044e9189e5b` | Preserve branch ancestry and add the Cyclone/Helios project packagers and tests. |
| Cyclone / `d957ab0a2ce64e7d2a81be183e235dcbc8f25445` | Already included by Helios. |
| Mantis clearance / `c48ed5dbb5b9189c4a2cb559798f3da82bfb0d82` | Already included by Helios; the actual model source is combined upstream. |
| PR #1776 original branch | Already squash-merged as `444eb3611`; its older workflow changes were not replayed. |
| Scout, steerable rover, Atlas, Kestrel, earlier CAD optimization | Already ancestors of the continuation. Existing deferrals remain documented. |

The model branches carried SDKs built before the latest library cohorts. Lite therefore retains the previously qualified SDK `fb8c3671aef1a2d5dc3673e7eb04bde38cc3f77b` while the combined CAD source awaits a clean build.

Upstream CAD combines current main `57d63940175a3585c691d58f9db2c30a2dd25a5d` (including PRs #67 and #68) with Helios `abb65b419ec8f03443a476584393d2023c861d18`, which also contains Cyclone and the Mantis clearance fix. Direct Git tree comparison confirms all 2,943 existing main files remain, six model/test files are added, and only the existing shape registration file changes. All 2,245 library files preserve exact blob and mode identity. See the [CAD integration record](https://github.com/CrispStrobe/brickwright-cad/blob/0df09ad88148eeb2b89240a2bfafdfe8aa764cf5/docs/evidence/lite-cad-integration-2026-11-16.md).

## Runtime changes

### Stop during CAD reset or clock acquisition

The earlier continuation cancelled Circuit readiness, Circuit ownership and initial sensing. A pending CAD reset or mechanical-clock acquisition could still leave Run unresolved after Stop or disposal.

Each of those worker preparation waits now observes cancellation. Run settles immediately; a lease arriving later is released; late replies and failures cannot affect a restarted run. Genuine reset/acquisition failures still propagate and release circuit ownership.

Ten new behavioral controls cover late success/failure, restart isolation, disposal, genuine errors and synchronous Stop. Six of those controls failed against the preceding implementation.

The scope is these CAD worker preparation phases. Firmware compilation can still keep its old startup promise pending until compilation completes, although existing generation checks prevent that attempt from starting a later simulation.

### CAD project and file ownership

A structurally valid future-version CAD sidecar could load into project storage, fail in the mounted editor's parser, and leave the previous document writable. Its next edit could overwrite the incoming sidecar.

Successful project replacement now retires the previous CAD view and undo surface. A parse failure preserves the incoming bytes and displays the error; a later supported project recovers automatically. Project-load listening starts before SDK loading. Persistence checks project generation and view disposal.

Open/Import selections are cancelled when their view is disposed and discarded when their project, session or document revision changes. The same ownership check applies to successful and failed reads, so an obsolete file-read failure cannot become an error on a newer document. Current errors and the 64 MiB limit remain observable. Input nodes, handlers and abort listeners are cleaned up.

Ordinary settings remounts retain the CAD session and Undo history. A successful persisted project replacement also clears the previous document's storage warning.

## Fresh verification and limits

| Check | Observed result |
| --- | --- |
| Local cancellation and telemetry tests | **28 passed, 0 failed, 0 skipped** |
| Negative controls on preceding bridge source | Six new regressions failed before the fix |
| Final picker functions in V8 with explicit DOM/signal/session doubles | **13 passed, 0 failed** |
| Actual React host + SDK session + SB3 regression file | Nine cases written; **not executed** |
| CAD source/library preservation | Verified through Git tree objects |
| Combined CAD model/physics tests and SDK build | **Not executed** |
| New Lite production build and browser/UI pass | **Not executed** |

The local runtime command completed before disk exhaustion:

```sh
node --test test/circuit-cad-cancellation.test.mjs test/circuit-cad-telemetry.test.mjs
```

The tested bridge blob is `b33689c7013bfea49dec2b1f233d52ed93fc50ef`; its cancellation test blob is `8e399fac8bdabf20e7f0b28ccb4ae9c91433c487`.

The 13 V8 controls execute the exact picker functions from host blob `a6e5f6caaced76071f4e311e22fc641c2c46c584`. Those functions are byte-identical in final host blob `057d292aaa958ebd247d68cadc64b01b7e4cd445`; the final change only resets a storage warning. These bounded controls do not execute React, the actual SDK session, SB3 loading, WebGL or a browser. Their [receipt](../receipts/2026-11-16-cad-host-picker-v8.json) includes every case, the stale-error negative control and the API compatibility review.

The nine actual-host regression cases are saved in `test/cad-tab-lifecycle.test.mjs` (blob `b2f7b04c20673ccf4ee5139210755cf86ec61bd3`). Source review confirms their SDK API usage and explicit GUI dependency routing; no measured dependency-scope run is claimed.

The [validation receipt](../receipts/2026-11-16-cad-integration-improvements.json) separates all these scopes. The earlier production receipt in #1796 remains historical evidence; this continuation has no new production result.

## Executor blocker and recovery

The canonical `worktree-deps.mjs link` installation completed its root dependency install, then the GUI install failed with `ENOSPC`. The filesystem reported no available disk space. Sandbox bootstrap subsequently failed before every new command, including deletion of the incomplete dependency directory.

A narrowly scoped escalation to delete only that reproducible incomplete GUI install was rejected by the environment's automatic permission policy because sandbox approvals are disabled. No cleanup succeeded. The completed changes were reconstructed from their recorded edits, preserved as exact Git blobs, and committed through the authorized GitHub connector. The bridge blob matches its locally tested identity.

Use an executor with sufficient free space for the remaining work. In a fresh checkout, fetch the saved branches and use the canonical dependency installation:

```sh
node scripts/worktree-deps.mjs link
node --test --import ./scripts/lib/register-gui-scope.mjs \
  test/circuit-cad-cancellation.test.mjs \
  test/circuit-cad-telemetry.test.mjs \
  test/cad-tab-lifecycle.test.mjs \
  test/cad-project-bundle.test.mjs \
  test/cad-program-api.test.mjs \
  test/cyclone-sorter-project.test.mjs \
  test/helios-catapult-project.test.mjs \
  test/mantis-walker-project.test.mjs
```

Follow CAD PR #69's local package/model test commands, build `build:brickwright-sdk` from its clean committed source, then use Lite's `scripts/sync-cad-sdk.mjs`. Verify the SDK manifest and hashes, rerun shipped-worker telemetry, and perform the production CAD build plus browser checks. Do not adopt older prebuilt model-branch SDKs.

Mantis's simultaneous-motor test does not qualify its generated sequential Lite program. Kestrel and other previously documented physical/dependency-tooling deferrals remain in force.

## Remote checkpoints

| Lite checkpoint | Saved change |
| --- | --- |
| `8d2aac3fd9dc62ecd16b8c89d9087796506ca5ec` | PR #1797 ancestry |
| `78a27b2008dccbd1adba719b8ac617ffa5f378f5` | Recent model branch ancestry and packagers |
| `3a086b0ff101ebf07ccddfbb4a9c58f7fcf569b4` | Tested CAD preparation cancellation |
| `40afeb8d1d206287a555d7b70220a2c987ce5111` | Project/sidecar ownership and initial host regressions |
| `93e15b9f3a1b1103ca6e1d00a2e4f7bab61fef55` | Stale read-error isolation and two further host cases |
| `072dd0faab399132faa01db5d9375046ba143305` | Clear obsolete storage warning after successful replacement |

These commits are all reachable from the draft PR branch; the following documentation checkpoint records their evidence.

## Completed local integration — 2026-11-16

PRs #1798 and CAD #69 are merged into the respective main branches. Their
ancestry is retained alongside the compact CAD toolbar and all 482 local
Adafruit thumbnails. Lite now pins the clean combined CAD SDK
`b1f6fa43fa175298248094fbc8b9f1d1b500dca9`, built locally with the three new
models and the latest qualified library cohorts; it no longer relies on the
old `fb8c3671` SDK. No existing library file was removed or modified.

All 49 checks from the saved continuation command passed, including all nine
actual React-host/SDK-session/SB3 cases. The test boundary now also accounts
for the host's light-DOM toolbar container and shared menu registration. The
broader circuit/CAD/packager/rover suite passed 74 cases with zero failures or
skips. The nine host cases were repeated against the exact shipping SDK and
passed. No GUI-scope redirects occurred in this locally installed dependency
tree, so that run does not claim a newly measured fallback dependency boundary.

The shipped worker's compact and legacy feedback, motor stepping, body ray and
immutable source checks pass on the exact combined SDK bytes. CAD's 53 distinct
model/physics cases have passing executions, with a rover deadline failure and
resource-isolated retry documented in the upstream qualification record.

The signed Mac bundle and final optimized GUI/browser verification are recorded
in [the completion receipt](../receipts/2026-11-16-cad-branch-integration-completed.json).
The original disk-exhaustion receipts above remain historical evidence. The
new model packagers have structural/SB3 tests; their complete sequential physical
tasks are not claimed as newly browser-qualified. Kestrel remains deferred.
No GitHub Actions were dispatched, rerun or awaited.
