# CAD browser fixture diagnostic receipt — 2026-11-27

## Result and scope

**Both unchanged browser journeys passed** on consumer
[`10fd4689f0addcb63acba6a3e92d108449470525`](https://github.com/CrispStrobe/brickwright/commit/10fd4689f0addcb63acba6a3e92d108449470525)
with a fresh CAD-enabled GUI build. The successful runs took place between
`2026-11-27T15:45:49.189541+00:00` and
`2026-11-27T15:46:02.086243+00:00`. The classification is
`diagnostic-current-checkpoint`, with `shippingEvidence: false`.

This closes the local question of whether the two newly enrolled fixtures drive
their real browser import/export and project-restoration paths. It covers these
two journeys in desktop headless Chromium. It does not qualify the other newly
wired browser proofs, a later supplier pin, a later consumer source revision,
other platforms, or a hosted release. The final Code-tab and hosted qualification
remain separate requirements.

The browser scripts, fixtures, dependency pins and installed source payloads were
not modified for this run. The consumer was clean before the build, after the
build and after the journeys. Its HEAD, pins, two package-lock digests, two proof
script digests and fixture digests remained unchanged. This receipt was written
only after the diagnostic finished; it does not relabel the tested commit.

## Exact source identities

| Item | Recorded identity |
| --- | --- |
| Consumer commit | `10fd4689f0addcb63acba6a3e92d108449470525` |
| Consumer tree | `5df3c37ef595218ad7e0e120e42ae4363648dea9` |
| Root package lock SHA-256 | `f7a9a7ba2c13eadee46a2470856ca80da1a90d5a82fa1cbd1743ad6d697da684` |
| GUI package lock SHA-256 | `b907c19b5589b14e25e33d9b600e99c0eece5d75abf0ad71669933c528eb261b` |
| DWG proof script SHA-256 | `b2701d9826b0d1c56ca39057d4fa4cc304e5afe3d49ec538ff0d81976d0573a9` |
| STEP proof script SHA-256 | `0f9e7137716dae20136a0aec2bc7de68316d5460581f9d2b59628437ed047d37` |
| CAD SDK commit | `7b736aa0407584af9b2b276917e97a2a2740a2aa` |
| CAD SDK manifest SHA-256 | `840cfc1bde62ced37c4316a20fea9da4420506e2ec1a276b5fafb1652a7ccd57` |

The retained CAD manifest declares `format: brickwright-cad-sdk`, `dirty: false`,
entry `sdk.js`, and repository `https://github.com/CrispStrobe/brickwright-cad`.
Those are the manifest's recorded identities. The source pin record was:

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

The complete unchanged scripts at the tested commit are
[DWG](https://github.com/CrispStrobe/brickwright/blob/10fd4689f0addcb63acba6a3e92d108449470525/scripts/verify-cad-dwg-browser.mjs)
and [STEP](https://github.com/CrispStrobe/brickwright/blob/10fd4689f0addcb63acba6a3e92d108449470525/scripts/verify-cad-step-browser.mjs).
Fixture origin, generation and licensing remain described in the
[fixture provenance](../test/fixtures/cad/browser/README.md).

## Actual build

Working directory: `/workspace/scratch/6490e3182008/brickwright`.

```sh
TMPDIR=/workspace/scratch/6490e3182008/test-temp BW_TEST_TMPDIR=/workspace/scratch/6490e3182008/test-temp BW_ENABLE_CAD=1 NODE_ENV=production NODE_OPTIONS=--max-old-space-size=2560 npm run build:gui
```

The normal load preflight and both packaged native-broker checks passed.
The command exited zero. GUI `npm run build` performed its normal clean before
webpack. Webpack 5.96.1 completed in **94,957 ms**, reporting three warnings:
Microtronic CSS uses `start` where autoprefixer recommends `flex-start`, asset-size
guidance, and entrypoint-size guidance. No build override or load-threshold
change was used.

The emitted `brickwright-build.json` records commit `10fd468` and build time
`2026-11-27T15:42:07.964Z`. Its recorded distribution policies are
`allow` for remote extensions, executable toolchains and machine images. The
complete local inventory contains **12,569 files, 229,731,530 bytes**. The
inventory was retained separately; the build output is not copied into this
repository receipt.

A local HTTP server served that build at `http://127.0.0.1:8618/`. Before either
journey, the response for `/` was required to match the freshly recorded entry
hash:

```text
4f1945cb6a6fee9d413caee0a462ec22d4903a66d728ddbce1b9a613a073dfb2
```

The server and browser commands ran in one process tree. Readiness was bounded
at 30 seconds, and the server was stopped after the commands completed.

## Browser runtime and launch settings

| Item | Recorded value |
| --- | --- |
| Node | `v24.22.3` |
| Playwright | `1.62.1` from the consumer's own root dependencies |
| Browser package | `@sparticuz/chromium@158.0.0` |
| Extracted browser | `Chromium 158.0.8127.0` |
| Executable | `/workspace/scratch/6490e3182008/test-temp/chromium` |
| Executable SHA-256 | `1f698044a68e18c1ce0cce74be25413f176806f19f15a44de5bb02cd578996af` |
| Browser package-lock SHA-256 | `44c230aa1ef8652c49f0e72ad193b444bf17cfe123dbda8b35263613ceaf4bfc` |
| Browser archive | `https://registry.npmjs.org/@sparticuz/chromium/-/chromium-158.0.0.tgz` |
| Browser archive integrity | `sha512-Rm/Jg2u7SVYAz/GTqAg4IqGoa1VDZEuqW8OPIe92T/vUa32r+Y5nIM7MnkFIXmjkBBEj/4OezoUnU+rsLxYz/g==` |

The system `/usr/bin/chromium` was only a wrapper whose target was absent.
The separate pinned package was installed through normal npm with
`--ignore-scripts --no-audit --no-fund`, preserving its lock, then extracted with
its official `executablePath()`. No consumer dependency or system package was
changed.

For these CAD commands, the unchanged scripts call
`chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH})`.
They used Playwright's normal headless defaults. **No extra launch flags,
distribution arguments, Playwright patch, security override or test modification
was supplied.** The separate blank-page runtime readiness probe is not the CAD
journey and is not substituted for it.

Both scripts use their existing 1024 × 768 touch-enabled context, download
handling and `serviceWorkers: 'block'`. Their existing startup preferences enable
the CAD surface and mark the starter tour complete. The commands used:

```text
TMPDIR=/workspace/scratch/6490e3182008/test-temp
BW_TEST_TMPDIR=/workspace/scratch/6490e3182008/test-temp
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/workspace/scratch/6490e3182008/test-temp/chromium
```

## Fixtures and exported bytes

Each script calls the existing fixture reader before browser launch, checking
the tracked input's byte size and SHA-256 and passing that validated buffer to
the browser. The paths are the same ones enrolled in CI.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `test/fixtures/cad/browser/inch-plate.dwg` | 6448 | `8f84ee202b78ae048d584a35adf00c46c8df933e995fb35718940dca79464b5a` |
| `test/fixtures/cad/browser/Adafruit3777.step` | 112694 | `12e0fa54576085011cc9f5221ad95aca62d565e051d995523d192d0a65797ce3` |
| Exported `roundtrip.dwg` | 6445 | `cd8f500f7e2dfa53747834be6cafe048621a767f497afeeadd2894c752707e78` |

The exported DWG starts with `AC1032`. The journey verifies its reimported
geometry; it does not require the export to be byte-identical to the original
input.

## DWG journey — passed

Exact command, with the environment above:

```sh
node --import ./scripts/lib/register-gui-scope.mjs scripts/verify-cad-dwg-browser.mjs http://127.0.0.1:8618/ test/fixtures/cad/browser/inch-plate.dwg /workspace/scratch/6490e3182008/cad-browser-diagnostic-20261127/roundtrip.dwg
```

Exit status: **0**. Start: `2026-11-27T15:45:49.189541+00:00`.
Finish: `2026-11-27T15:45:56.948229+00:00`.

The unchanged assertions cover the actual DWG worker, CUT/GUIDES layer choice,
skipping paper-space layout entities, inch-to-mm conversion to 50.8 × 25.4 mm,
bulge and width preservation, creating an editable extrusion, binary export and
reimport, and actual Brickwright SB3 Save/Open with the same editable profile.

Complete command output:

```text
(node:29) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///workspace/scratch/6490e3182008/brickwright/overlay/scratch-gui/src/lib/bw-cad-project.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /workspace/scratch/6490e3182008/brickwright/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
PASS DWG import, binary export and reimport, layer selection, inch scale, editable geometry and Brickwright SB3 save and reopen
```

## STEP journey — passed

Exact command, with the environment above:

```sh
node --import ./scripts/lib/register-gui-scope.mjs scripts/verify-cad-step-browser.mjs http://127.0.0.1:8618/ test/fixtures/cad/browser/Adafruit3777.step
```

Exit status: **0**. Start: `2026-11-27T15:45:56.948283+00:00`.
Finish: `2026-11-27T15:46:02.086243+00:00`.

The unchanged assertions cover the actual STEP worker, eight named bodies
including `body A`, reference/surface metadata and color, print-export exclusion,
and actual SB3 Save/Open preserving all saved nodes.

Complete command output:

```text
(node:229) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///workspace/scratch/6490e3182008/brickwright/overlay/scratch-gui/src/lib/bw-cad-project.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /workspace/scratch/6490e3182008/brickwright/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
PASS STEP supplier motor imported with colors and eight references, print exclusion and SB3 reopen
```

Both scripts remove their temporary SB3 working directories in their existing
`finally` blocks. The optional DWG export is retained; this receipt does not
claim that those temporary SB3 archives were retained.

## Earlier orchestration attempt and retained diagnostics

The first attempt started the HTTP server in a separate execution session. Its
log recorded `Serving HTTP on 127.0.0.1 port 8618`, but both the separate readiness
request and the browser could not reach that loopback listener. The DWG script
exited 1 at navigation with:

```text
page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8618/
```

No application assertion ran in that attempt. Its server and browser logs remain
in `attempt1-separate-exec-loopback/`; they were not overwritten or counted as a
pass. The correction was to start the HTTP server and both unchanged commands
as sibling processes in a single execution session, requiring entry-byte
readiness first. No application, fixture, browser argument or assertion changed.

The successful server log retains four HEAD and four GET 404 responses for
`/static/labwired/labwired_wasm_bg.wasm`, one pair for each page context. These
are disclosed resource-probe failures. The two scripts do not produce an
uncaught-page-error or console-error census, so their passes are not a claim of
zero page or console errors.

## Evidence inventory

Local diagnostic evidence was retained under
`/workspace/scratch/6490e3182008/cad-browser-diagnostic-20261127`.
The original byte digests below identify the full logs, metadata and export;
this document preserves both complete command outputs and their tested source
identities without duplicating the 229 MB build or full static inventory.

| Retained artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `source-before.json` | 2046 | `678ad852ce4df3af718d2dba18d54e92f850b71a2df07e4549aed5c9a83db02b` |
| `build-inventory.json` | 2134112 | `4460c8f4446ca080abc3f1606e80cbda97cdd31d52a6a4b7235eddce7a99d079` |
| `build.log` | 32629 | `7bea65289209bcc715a2d8df234f956171e0f9bf58bd4c9cef3dac8bbad0e389` |
| `server.log` | 13938 | `921f82a7b61dd074637345869c8bc2d107f42aad9f936cb8b238091b77e3ef04` |
| `cad-dwg-browser.log` | 617 | `9bf199b1f8f6ddfb55dd69ef82ca18cc72a696914698c69391f4bc5bd094bb0f` |
| `cad-step-browser.log` | 589 | `e7121b0a17bd20557cde60f8b167e44fb130779b564a2b930d4d7e311c3c823f` |
| `roundtrip.dwg` | 6445 | `cd8f500f7e2dfa53747834be6cafe048621a767f497afeeadd2894c752707e78` |
| `results.json` | 2168 | `ef1f21d23d2cc4c886a1071ca6177b5e7f258c918b0bf0ce92f9acfbc6c87c18` |
| `run-diagnostic.py` | 4740 | `153d8a817d3710319388d2ff9c5bf31c945318906371e769a2772d0be58731cf` |
| `attempt1-separate-exec-loopback/server.log` | 65 | `40f0e2cc6d0d11254d0ed17080127b1028316d2e85989984c3660e26d057baf2` |
| `attempt1-separate-exec-loopback/cad-dwg-browser.log` | 1037 | `2ebd1bd92a81e5c6d3f2a3f3a47ee41180a34bcb59ba6eb2a690e1501de8e5ab` |
