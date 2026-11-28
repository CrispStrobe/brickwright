# CAD browser compatibility after SDK 02287df — 2026-11-27

## Result and exact scope

**Both unchanged CAD browser journeys passed** on clean published consumer
[`dd65496e36e98b3e48642eed025ad0cbe3cefbeb`](https://github.com/CrispStrobe/brickwright/commit/dd65496e36e98b3e48642eed025ad0cbe3cefbeb),
tree `70abbf347c29452ff1e4c7d5dce044243122e411`, after the incoming main adopted CrispCAD SDK
`02287df59bdb8ba7f3685a9241dd6b299276b1c3`. Classification: `diagnostic-current-sdk-checkpoint`;
`shippingEvidence: false`.

The runs cover DWG import/export/reimport and generic STEP reference import,
including real Brickwright SB3 save/reopen, in desktop headless Chromium. They
do not qualify the separate exact-body STEP route, other browser proofs or
platforms, a later supplier pin, or a later consumer revision. Final Code-tab
and applicable hosted qualification remain separate.

The earlier [10fd fixture receipt](CAD-BROWSER-FIXTURE-RECEIPT-2026-11-27.md)
remains byte-identical, SHA-256
`99ded00c60442515760d67ee172de507f9965f408ef90b9b7d24398bdc3f6333`.
It retains its original SDK, build and outcome. This is a new run.

## Contract review and bounded reproduction repair

Incoming main `b2912f4a081cf0bf0721b29f781e065429e5741c` was incorporated in
consumer `32a7b117f2eaffcdbadee83e30a2b5bb6893b4d7`. Official integration
completed with no tracked changes. The existing four fixture controls then
reported two concrete failures: current-SDK provenance still expected
`7b736aa0407584af9b2b276917e97a2a2740a2aa`, and the generator opened the removed
`sketch-dwg.worker-CZuNwPHc.js` path. Both altered-fixture prelaunch controls
already passed.

The repair changed only the generator's current worker path/hash, the current
SDK/worker provenance, and the fixture README. It was published as the tested
consumer commit above. The new worker is
`assets/sketch-dwg.worker-FWEoDxb0.js`, 1,850,080 bytes, SHA-256
`b61636ee4049a98623f2eea55d3bd514d4536de4a2f9ff11958c5037e6e21d4d`.
Two fresh codec contexts reproduce the original committed DWG bytes exactly.
**All four unchanged fixture controls pass, with zero skips.** Modified-worker,
modified-factory, same-size fixture mutation and truncated-input refusals remain
active. Neither golden fixture nor browser proof changed.

The original factory/STEP/license source commits remain recorded as their true
origins. SDK `02287df` retains the identical
[canonical DWG factory](https://github.com/CrispStrobe/CrispCAD/blob/02287df59bdb8ba7f3685a9241dd6b299276b1c3/tests/sketch-dwg-fixture.ts)
Git blob `8ec6f4e2771d1297450dafa03081b4e8e1c62492` from the original `7b736aa`
source. The current producer identity was updated; historical evidence was not
restamped.

The new SDK adds a distinct exact STEP command while preserving generic import:

| Editor command | Accepted picker input | Document contract | Evidence in this receipt |
| --- | --- | --- | --- |
| `executeCommand('import')` | `.stl,.step,.stp` | Generic STEP creates version-30 `mesh` nodes with `reference: true` and `surface: true`; excluded from printable geometry | Actual eight-body browser import and SB3 restoration passed |
| `executeCommand('import-step')` | `.step,.stp` | Exact-kernel import creates version-45 `exact-body` nodes retaining B-rep, measures and display mesh | Source reviewed only; no new feature qualification claimed |

This distinction follows the delivered SDK's command dispatch and geometry
importer. Its [generic upstream tests](https://github.com/CrispStrobe/CrispCAD/blob/02287df59bdb8ba7f3685a9241dd6b299276b1c3/tests/step-import.test.ts)
still require eight motor meshes, first color `#fff985`, version-30 reference
surfaces, zero printable triangles and export refusal. The separate
[exact-import tests](https://github.com/CrispStrobe/CrispCAD/blob/02287df59bdb8ba7f3685a9241dd6b299276b1c3/tests/step-import-exact.test.ts)
cover exact-body persistence and measurements, whole-file refusal of malformed,
truncated or open-surface input, and unchanged model state on refusal. Replacing
the generic proof's assertions would remove a supported contract's coverage.

## Source and build identity

| Item | Recorded value |
| --- | --- |
| Consumer | `dd65496e36e98b3e48642eed025ad0cbe3cefbeb` |
| Consumer tree | `70abbf347c29452ff1e4c7d5dce044243122e411` |
| CAD SDK | `02287df59bdb8ba7f3685a9241dd6b299276b1c3` |
| CAD SDK manifest SHA-256 | `c83c917d00d9d68d750fcdafadf050c216f903370d050e99603173e37112fdb2` |
| DWG proof SHA-256 | `b2701d9826b0d1c56ca39057d4fa4cc304e5afe3d49ec538ff0d81976d0573a9` |
| STEP proof SHA-256 | `0f9e7137716dae20136a0aec2bc7de68316d5460581f9d2b59628437ed047d37` |
| Root package-lock SHA-256 | `f7a9a7ba2c13eadee46a2470856ca80da1a90d5a82fa1cbd1743ad6d697da684` |
| GUI package-lock SHA-256 | `b907c19b5589b14e25e33d9b600e99c0eece5d75abf0ad71669933c528eb261b` |

Both proof hashes match the earlier run. The complete source pin record was:

| Dependency | Exact commit |
| --- | --- |
| bw-circuit-ui | `0a1b15edb0daecd723c7c07126450d84b86e3e68` |
| bw-board | `b47e7e09ed873b33ca2fd912b21e136decc5e677` |
| sb3-creator | `1c29f69fd22c86ecb0051938eedb246921cb3b88` |
| stc-compiler-flasher | `30f43384a9f226de3c3cb753e119dd93ca2e81ff` |
| arrays-values | `035ab22a4d946fe5b8e367013caf898cd763e5f4` |
| microbitplus | `3dc133320c2b9c3725bfc69b0f2d2406c4e8900f` |
| circuitplayground | `0c4e3b4a0cee57d65474082938c352818426eebb` |
| wedo2unified | `a6950fac246c28c6299b31a708f6071fd7b8e388` |
| spikeprime | `ff74f1309b8807713508884048292182a369f8f5` |
| ev3comprehensive | `ff74f1309b8807713508884048292182a369f8f5` |
| legoboostunified | `ff74f1309b8807713508884048292182a369f8f5` |
| legonxt | `cc7b802cd4c149d401ef0d289baa975aed6ea443` |
| legopoweredup | `817f01ac3c8edbc4bf3e4a19af6b1cc3bf3c22ec` |

The normal build ran from `/workspace/scratch/6490e3182008/brickwright`:

```sh
TMPDIR=/workspace/scratch/6490e3182008/test-temp BW_TEST_TMPDIR=/workspace/scratch/6490e3182008/test-temp BW_ENABLE_CAD=1 NODE_ENV=production NODE_OPTIONS=--max-old-space-size=2560 npm run build:gui
```

It passed load and native-broker preflights, cleaned the normal output and exited
zero. Webpack 5.96.1 completed in **19,491 ms** with the
same three disclosed warnings: Microtronic CSS `start`/`flex-start` compatibility,
asset-size guidance and entrypoint-size guidance. No threshold override was used.
The build's identity records commit `dd65496`, time
`2026-11-27T15:59:25.557Z`. It contains **12,569 files,
229,959,591 bytes**.

The existing built-SDK admission ran against that fresh output:

```sh
node scripts/verify-built-cad-sdk.mjs packages/scratch-gui/build
```

Complete output, exit zero:

```text
PASS final app preserves all 842 CAD SDK file digests (02287df59bdb8ba7f3685a9241dd6b299276b1c3)
PASS all 22 built robot projects match the source manifest and content hashes
```

The consumer was clean before and after the build and journeys. HEAD, pins,
locks, proof scripts, fixtures, current provenance, generator and CAD manifest
all retained their recorded values. This document was added after the run.

## Served build and browser

A normal Python HTTP server served the fresh build at
`http://127.0.0.1:8618/`. Server and unchanged browser commands were sibling
processes in one execution session. Readiness had a 30-second bound and required
the actual entry response to have SHA-256
`84f9ec01d4b8151c345885661e618b852cc6983bf761294aefde004bd0032412`. The server was stopped in the runner's finalizer.

The browser was the separately installed `@sparticuz/chromium@158.0.0`, extracted
through its official `executablePath()`, reporting **Chromium 158.0.8127.0**.
Node was `v24.22.3`; Playwright was `1.62.1` from the consumer's root dependencies.
The executable was `/workspace/scratch/6490e3182008/test-temp/chromium`, SHA-256
`1f698044a68e18c1ce0cce74be25413f176806f19f15a44de5bb02cd578996af`.
The separate runtime lock SHA-256 remains
`44c230aa1ef8652c49f0e72ad193b444bf17cfe123dbda8b35263613ceaf4bfc`.

The scripts used normal Playwright headless defaults with only their documented
`executablePath` option. No extra launch flags, distribution arguments, browser
patch, security override or test modification was supplied. Both scripts retain
their 1024 × 768 touch-enabled context and `serviceWorkers: 'block'`.

Environment for both commands:

```text
TMPDIR=/workspace/scratch/6490e3182008/test-temp
BW_TEST_TMPDIR=/workspace/scratch/6490e3182008/test-temp
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/workspace/scratch/6490e3182008/test-temp/chromium
```

## Exact fixture and export identities

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `test/fixtures/cad/browser/inch-plate.dwg` | 6448 | `8f84ee202b78ae048d584a35adf00c46c8df933e995fb35718940dca79464b5a` |
| `test/fixtures/cad/browser/Adafruit3777.step` | 112694 | `12e0fa54576085011cc9f5221ad95aca62d565e051d995523d192d0a65797ce3` |
| New exported `roundtrip.dwg` | 6445 | `8141de97a1030af18d96d695181bd3a2208e496235f1f9067f182732ff9efd55` |

Input hash/size admission runs before browser creation, and the validated buffers
are the actual uploaded fixtures. The export starts with `AC1032` and is
reimported and checked geometrically. Export bytes are not required to equal the
original fixture or a previous run's export.

## DWG — passed

```sh
node --import ./scripts/lib/register-gui-scope.mjs scripts/verify-cad-dwg-browser.mjs http://127.0.0.1:8618/ test/fixtures/cad/browser/inch-plate.dwg /workspace/scratch/6490e3182008/cad-browser-current-sdk-20261127/roundtrip.dwg
```

Exit **0**; `2026-11-27T16:00:20.939926+00:00` to
`2026-11-27T16:00:28.386057+00:00`. The unchanged assertions cover the actual
worker, layer and paper-space selection, 50.8 × 25.4 mm inch-scaled outline,
bulge/width preservation, editable extrusion, binary export/reimport and actual
SB3 Save/Open.

Complete output:

```text
(node:29) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///workspace/scratch/6490e3182008/brickwright/overlay/scratch-gui/src/lib/bw-cad-project.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /workspace/scratch/6490e3182008/brickwright/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
PASS DWG import, binary export and reimport, layer selection, inch scale, editable geometry and Brickwright SB3 save and reopen
```

## Generic STEP — passed

```sh
node --import ./scripts/lib/register-gui-scope.mjs scripts/verify-cad-step-browser.mjs http://127.0.0.1:8618/ test/fixtures/cad/browser/Adafruit3777.step
```

Exit **0**; `2026-11-27T16:00:28.386112+00:00` to
`2026-11-27T16:00:33.526966+00:00`. The unchanged assertions require the actual
STEP worker, eight named reference/surface bodies including `body A`, the retained
color, print-export exclusion and actual SB3 Save/Open preserving all nodes.

Complete output:

```text
(node:228) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///workspace/scratch/6490e3182008/brickwright/overlay/scratch-gui/src/lib/bw-cad-project.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /workspace/scratch/6490e3182008/brickwright/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
PASS STEP supplier motor imported with colors and eight references, print exclusion and SB3 reopen
```

The successful server log records no request under `/assets/exact/`. This is the
generic-import run, not an exact-kernel measurement. It retains four HEAD and
four GET 404 responses for `/static/labwired/labwired_wasm_bg.wasm`. The scripts
do not provide a complete page-error or console-error census, so no zero-error
claim is made. Their temporary SB3 archives are removed by their existing
finalizers; the optional DWG export is retained.

## Retained evidence

New local evidence is separate from the earlier run, under
`/workspace/scratch/6490e3182008/cad-browser-current-sdk-20261127`. The bounded
pre-repair and post-repair fixture logs are under
`/workspace/scratch/6490e3182008/cad-main-compatibility-20261127` as
`fixture-before.log` and `fixture-after.log`. The prior separate-session
connection failure remains documented in the earlier receipt; neither of these
new commands failed navigation.

| New artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `source-before.json` | 2462 | `d6019228560904a6a0a73315707457489ee1f580af45d6a243df6903783ac30a` |
| `build-inventory.json` | 2134189 | `cb9d36b9370c6d0f5a5fda874b391d412633b5f678404d7437072faf0d4e68ba` |
| `build.log` | 25506 | `5a41e46a62daaa521c59fe19e0df14f64eae6412f3286f0b24ef4f0803c46c88` |
| `built-cad-sdk.log` | 175 | `a86f9eb630dc51da06a19ce1744e61c97029fe3eaaead1de0369b6282ff786d8` |
| `server.log` | 13938 | `dff6c501d597ffaf9e88d6ec1e0817224d2363af86a28fc94510da631fd08ed2` |
| `cad-dwg-browser.log` | 617 | `9bf199b1f8f6ddfb55dd69ef82ca18cc72a696914698c69391f4bc5bd094bb0f` |
| `cad-step-browser.log` | 589 | `a3ecc36bc4d0ce9484bc820a802d2674b086501e61827f0bbe6d751c7cdf2182` |
| `roundtrip.dwg` | 6445 | `8141de97a1030af18d96d695181bd3a2208e496235f1f9067f182732ff9efd55` |
| `results.json` | 2015 | `57b3707c235e7db39e36407692529df2f2defa4ea5d7c352e069de82f242ca35` |
| `run-diagnostic.py` | 4371 | `7c9feb68f1bfa978e8e534737240c569000f2a91a0b6cfb73d586e28936b8548` |

The complete static build and full inventory are not duplicated into this
repository document. Commands, outcomes, source identities, original short
outputs and artifact digests above stand alone as this bounded diagnostic record.
