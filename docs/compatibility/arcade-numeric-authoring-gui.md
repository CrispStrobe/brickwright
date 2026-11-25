# Numeric, settings and source-loop GUI acceptance

## Status

`scripts/verify-arcade-numeric-authoring-gui.mjs` is a prepared **full production IDE** journey. Preparing it and checking its owned fixture with the original simulator does **not** qualify the GUI. The matching official hosted build must run it successfully before recording acceptance. No whole-game compatibility count changes follow from this bounded fixture.

The fixture is owned code and four-pixel art in `test/fixtures/arcade-numeric-authoring-game.mjs`. Its portable StringArray settings helper retains MPL-2.0 attribution. It uses the pinned original Arcade 4.2.1 / PXT 13.2.1 SDK. It contains no private corpus application or unverified-license BetterSettings source.

## Latest hosted result

[Numeric authoring job 116143137971](https://github.com/CrispStrobe/brickwright/actions/runs/38645260680/job/116143137971)
failed during the initial file import, before any completed authoring journey or
original execution comparison. The reviewed PR head was
`249dc22ddee151159b72b36d183b5f2545db0949`; the actual admitted build and
harness checkout was merge reference
`409aa0c376c523a45533b30ee37ed6ae3b4aad06`. Keep those source identities distinct.

The retained report times out waiting for the imported-game status. Its error
handler subsequently fails because Blockly comment content introduces a second
HTML `body`, making the body locator ambiguous. The diagnostic correction reads
the document body directly and captures the Code status, current text and stage
identity. It retains the original import error and all acceptance assertions.
An exact-source delayed-device control subsequently reproduced a reachable
race: device selection replaces the stage asynchronously, and importing before
completion can discard the file result. The repair disables file intake while
compiling, preserves prior authoring state on a busy handler call, and makes all
four authoring journeys wait for visible completion, applied Arcade state and an
enabled file input. Fourteen deferred-device controls and independent source
review pass. The hosted report lacks a stage timeline, so this reproduced race
is a supported cause candidate; a fresh hosted journey remains required. Earlier successful numeric journeys remain evidence for
their own exact builds.

## Required identity

Run from the exact admitted tested consumer checkout (including the tested merge commit for a pull request). Set `PROOF_URL` to a server serving the sole admitted official full-app artifact, `BW_GUI_BUILD_ARCHIVE` to that already acquired archive, and `BW_GUI_BUILD_RECEIPT` to its independently reviewed JSON receipt. Set `BW_GUI_GIT_EXECUTABLE` to the explicitly reviewed absolute source-inspection executable. Its resolved path, SHA256 and version are recorded in the report; PATH discovery is never used. Tracked edits to the harness checkout are refused. This source-inspection tool is separate from the app's runtime and compiler provenance. This script does not acquire artifacts, dispatch builds or assert that supplied metadata independently proves GitHub provenance. The operator must first admit the original run, successful build job, actual checkout, artifact ID and archive hash using official GitHub metadata.

Receipt shape:

```json
{
  "sourceSha": "full actual tested checkout SHA",
  "producerSha": "full matching sb3-creator pin",
  "arraysValuesSha": "full matching arrays-values pin",
  "sdk": {
    "version": "4.2.1",
    "pxtVersion": "13.2.1",
    "targetCommit": "2d7d59b5226e8a1a1e05e8042dd9f5248ed68fea",
    "targetSha256": "SHA256 of exact original SDK target.json",
    "workerSha256": "SHA256 of exact original SDK pxtworker.js"
  },
  "build": {
    "runId": "numeric official run ID",
    "jobId": "numeric successful official build job ID",
    "artifactId": "numeric original artifact ID",
    "runUrl": "https://github.com/CrispStrobe/brickwright/actions/runs/RUN_ID",
    "conclusion": "success",
    "checkoutSha": "same actual tested checkout SHA",
    "archiveSha256": "SHA256 of original acquired ZIP"
  },
  "assets": {
    "gui.js": "SHA256 of this original extracted artifact member"
  },
  "assetBytes": {
    "gui.js": 12345
  }
}
```

Inventory every served JavaScript asset and the Arcade SDK target.json using its URL path relative to `PROOF_URL`, including lazy chunks. The original comparison SDK must match the admitted target and worker hashes. Record the original extracted byte length of every inventoried member in `assetBytes` (the example length is illustrative). The runner refuses an unlisted or different actual GET response body or byte length. HEAD responses are separate metadata observations: identity-encoded resource lengths must match the admitted length, while compressed resource lengths describe the transferred representation. A HEAD observation never attests body bytes or counts as JavaScript consumption. Successful GET body observations remain required. Keep the receipt, acquisition mapping, source paths and raw reports private when they include local operational data. Public acceptance records should link the official [Actions runs](https://github.com/CrispStrobe/brickwright/actions) and reviewed source, with the exact tested pins and boundary.

## Actual user journey

1. Open the owned MakeCode project using Code actions; choose Arcade and use **To blocks**. Observe real random fraction, min/max/randomRange, percent chance, clamp, settings read/write and source-while blocks.
2. Run via green flag. Select the real **Scratch Stage** view and verify its actual presented sprite/HUD pixels against the original simulator. Select **Game Console** before using its visible controller **A**; score and sprite position change.
3. Stop. Scroll the actual Arcade toolbox to clamp, drag a new reporter into the workspace, then delete the selected orphan through the keyboard.
4. Edit the actual clamp maximum number from 10 to 12. Change the actual math menu from min to max. Open the real settings read menu and select String, then StringArray. Verify available choices and resulting fields through read-only observations.
5. Run the edited project and use A. Stop. Use **From blocks**, then ordinary CodeMirror keyboard input to change the stored Unicode text to PLAY. Use **To blocks**, run and use A again.
6. Use **File → Save to your computer**. Close the browser context; load the actual downloaded SB3 through **File → Load from your computer** in a fresh context. Run and use A.
7. Use the actual MakeCode Arcade export action. Compile and run those exact downloaded files in the original SDK. Import the actual exported file back through the UI, reconstruct blocks, run and use A.

All VM and Blockly accesses only observe variables, errors, field coordinates, types and actual presented canvas pixels. They never load a program, create a block, call an Arcade primitive, teleport a sprite, set a field, dispatch a green flag, replace entropy or change the clock. Input actions use real page controls, mouse/keyboard and file choosers. Original-SDK controller inputs belong to the separate reference comparison, not the production user flow.

Math.random consumes real entropy. It is checked only for `[0,1)`; independent random draws are never required to match. Equal randomRange bounds and percent chance 0/100 provide deterministic visible-state assertions. The fixture deliberately keeps random samples out of the Stage pixels.

## Review and next steps

The owned fixture preflight is `test/arcade-numeric-authoring-fixture.test.mjs`. It checks ordinary source conversion admission and original simulator behavior for baseline and edited variants with and without A. It is not a substitute for running the full IDE journey.

Execution writes `current.json`, exact saved/exported files and a success or failure screenshot under `BW_NUMERIC_GUI_REPORT_DIR` (default `test-results/arcade-numeric-authoring-gui`). Retain failures. Add an enabled hosted workflow step only after reviewing the script and exact build receipt integration. A failure identifies an actual UI step to fix; do not substitute a component proxy or direct VM operation.

## Hosted artifact consumer contract

The existing `build` job owns the one `github-pages` artifact. Its completed successful job can be the producer for a separate dependent numeric GUI consumer job. The existing browser shard builds its own bundle; that different output must not be relabeled as the downloaded official archive. A running job cannot truthfully supply its own completed-success receipt. Do not substitute environment success flags or a knowingly-unwired exemption for the consumer.

The workflow owner must provide these stages:

1. Produce an embedded source manifest alongside the built bundle: actual checkout commit/tree, reviewed pull-request head separately, exact producer/arrays pins, target and worker hashes. Preserve the actual checkout witness in the original job log. A pull-request run's `head_sha` does not by itself establish the checkout merge commit.
2. After `needs: build` succeeds, read the original run, producer job and artifact metadata for that same run. Require the producer job to be completed/successful, its actual build and upload steps successful, the exact expected artifact name/ID, matching repository/run, nonexpired artifact and matching source witness. The artifact API binds to a workflow run, not a producer job; correlate the unique upload step and source workflow explicitly.
3. Admit the metadata before one archive acquisition by artifact ID. Record the original ZIP SHA256 and size; compare the API artifact digest when supplied and refuse a discrepancy. Extract that admitted archive into an owned served directory. Verify its embedded source manifest, every served JavaScript member (including lazy chunks), SDK target and worker. Generate the receipt from those original records and bytes.
4. Check out the exact tested source named by that manifest, install only the gate dependencies/original SDK comparison prerequisites, and serve the admitted extraction. No second GUI build is needed. Run `node --import ./scripts/lib/register-gui-scope.mjs scripts/verify-arcade-numeric-authoring-gui.mjs` with `PROOF_URL`, `BW_GUI_BUILD_RECEIPT`, `BW_GUI_BUILD_ARCHIVE`, explicit `BW_GUI_GIT_EXECUTABLE` and the report directory. Pass a repository token with Actions read permission to the metadata/acquisition steps; no new secret or wider admin token is required.
5. Retain the source/tool/metadata/archive receipt and the success or failure journey artifacts. Make this enabled consumer a required deployment dependency. Its timeout needs a measured full-journey reading; the canvas wait retains the existing 10000ms bound and the helper tests are not a full GUI timing measurement.

Primary metadata contracts: [GitHub artifact REST API](https://docs.github.com/en/rest/actions/artifacts#get-an-artifact) and [GitHub job REST API](https://docs.github.com/en/rest/actions/workflow-jobs#get-a-job-for-a-workflow-run). The Actions workflow mutation belongs to its owner. Until that real consumer is wired and passes, the numeric journey remains unqualified and the repository coverage gate should continue reporting the missing workflow invocation.

## Observable wait policy

The three fixed sleeps introduced by the two Arcade GUI journeys are removed: both frame comparisons now wait for an actual complete 19200-pixel presentation on animation-frame observation, and toolbox scrolling waits for its actual block rectangle to move. The observer never calls the renderer's draw method. Number and dropdown editors must close after commitment before their fields are checked. The repository sleep ceiling and gate-shape thresholds are unchanged. `test/arcade-stage-frame-observer.test.mjs` proves that a last-pixel mismatch, zero-size canvas and incomplete expected frame cannot pass; it uses a small canvas fixture and does not qualify the application. `test/gui-harness-source.test.mjs` checks explicit Git identity and refusal of dirty tracked source. `test/gui-artifact-response.test.mjs` checks separate HEAD metadata and strict GET body identity, including wrong same-length bodies and compressed HEAD metadata. These controls do not qualify a hosted build or the full journey.

## Admission implementation

`scripts/write-gui-build-manifest.mjs` writes `bw-gui-build-source.json` into the existing built app before its sole Pages upload. It inspects the clean actual checkout using the explicit Git binding, requires that commit to equal the producer's `GITHUB_SHA`, and records the complete tree, reviewed head, run/attempt, pins and actual built SDK hashes. The successful producer steps must be named `Build the editor`, `Write GUI build source manifest` and `Upload GUI Pages artifact`.

`scripts/admit-official-gui-artifact.mjs` reads original metadata for the run, attempt, sole completed `build` job and unique `github-pages` artifact. The entire run may still be active while this dependent consumer runs; the producer job and its three authority steps must have completed successfully. Metadata ties the official run head and repository to the producer/artifact; the embedded manifest additionally ties the actual merge checkout to the consumer's inspected checkout and tree. API `head_sha` alone does not prove a pull-request merge checkout.

The helper refuses mismatched metadata before requesting the archive. It retains those records, acquires the original ZIP by admitted ID once, checks its reported length/digest, and records an acquisition receipt. `BW_GUI_RETAINED_ARCHIVE` can name that same retained archive for a new owned output directory; its matching acquisition receipt and byte hash are mandatory, and changed bytes are refused without another download. Tokens are sent to the official API only, never to the signed archive CDN request.

Extraction validates ZIP central records before normalization and TAR headers before writing. It rejects duplicate or escaping paths, symlinks, hardlinks, special files, corrupt checksums and incomplete containers. The current Pages ZIP containing one GNU `artifact.tar` is supported; ZIP64, PAX and other layouts are explicitly refused. A new owned site directory is required. After verifying the full-source manifest, the helper inventories all extracted members with both SHA256 and original byte length and writes the private receipt.

The comparison compiler must use that admitted site's `static/makecode` directory through the consumer checkout's ignored `packages/scratch-gui/static/makecode` path. A preexisting different SDK must be refused, never relabeled or silently replaced. No MakeCode SDK download or second GUI build belongs in the consumer. The full journey checks target and worker bytes before using the original compiler. `test/official-gui-artifact.test.mjs` covers metadata/checkout/pin/SDK refusals, unsafe ZIP/TAR entries, one acquisition and reuse, and a producer manifest generated from an actual owned Git fixture. Its synthetic archive/worker fixtures do not qualify a hosted app or original SDK; actual artifact execution remains separate.


## Official five-journey result — 2026-10-15

The official [authoring job](https://github.com/CrispStrobe/brickwright/actions/runs/38793608489/job/116659147575)
passes all five journeys. The [retained proof artifact](https://github.com/CrispStrobe/brickwright/actions/runs/38793608489/artifacts/12006424917)
binds reviewed consumer `777aae8e0d49cf692ba7bb6ca6915fe4f47016e1` and actual
merge checkout `1d0336a2e60cb95c8063f82d3376ef59975d02db` to the same tree
`3861ed9baa1d2d85d66f17ea1f5b3505ed0e169f`. Its compiler is
`f2d4f879ba40dd9025070ed51af11ebe1ef14808`; its admitted Array-values source is
`4db2813d366af8a110fc79599afb55d1cd42d8df`. Newer development compositions
and supplier fixes need separate consumer qualification.

| Journey | Actual editor and persistence observations |
| --- | --- |
| Numeric/settings/source loop | Visible dropdown and Number edits; Code feedback; File save and Load in a fresh context; current export/reimport. Ten initial/pressed state and frame phases agree with retained original observations. |
| Foreground event/wait and multiplayer connection | Real palette drag/delete, player 2→3 dropdown edit and Code trace edit; fresh SB3 reopen and export/reimport. Ten state and frame phases agree with retained originals. |
| Live Font | Visible font and metric fields, Code charWidth→charHeight, fresh SB3 reopen and export/reimport. Four distinct original compilation inputs and raw original frame hashes are independently joined to retained results. |
| Two-player repeat controller | Actual pane hold/release/repress for player 1 A and player 2 B; Blocks and Code delay/interval edits, fresh reopen and export/reimport. Ten initial/held state and frame phases agree with retained originals. |
| Owned literal Image | Real Pixel canvas strokes/save, Code and Blocks color edits, fresh reopen and export/reimport. Saved SVG pixels and asset digest persist; the current export no longer adds an unintended GameSprite declaration. |

The Image journey observes native HUD changes separately from resource pixels;
it does not draw the literal Image on the game screen or provide an exact HUD
glyph oracle. A pointer press is observed as input state; this fixture has no A
handler. It performs no new original execution. Random values in the numeric
journey are bounded, not seeded or equated across independent executions.

The earlier `9133a871b` Image export failure remains a failure on its own build;
the owned source fixture is unchanged. The passing `777aae8e` GUI job does not
remove its workflow's three failed unit shards: network setup, initial clock
setup and the ambient shell gate. No complete authentic corpus game is promoted
by these five owned editor fixtures; the immutable raw census remains
147 translated / 36 partial / one parse failure.
