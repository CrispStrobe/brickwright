# Scout TT carrier and SDK completion

Date: 2026-11-16. Environment: Node 24.22.1, npm 11.9.0.

This completes the interrupted Scout TT continuation from Lite
`7b9e191691081e9b1b608a18674eb86c7f5d9e87` on
`feat/scout-tt-integration-20261116`. The two preceding commits retain the
control and executable-program corrections described in the
[control-contract receipt](2026-11-16-scout-control-contract.md).
The refreshed SDK is saved in Lite checkpoint
[`0bbc92e932c3ea8d1a1b8d43b816924947ecaebd`](https://github.com/CrispStrobe/brickwright/commit/0bbc92e932c3ea8d1a1b8d43b816924947ecaebd).
The [machine-readable receipt](scout-tt-sdk-completion-2026-11-16.json)
records the same identities and results.

## Saved source and scope

The SDK now pins clean CAD source
[`5922e226ae98ed8b99a7054d27adcd9fca0c2245`](https://github.com/CrispStrobe/brickwright-cad/commit/5922e226ae98ed8b99a7054d27adcd9fca0c2245).
That commit completes the printable electronics carrier and its kit, retains
the qualified Scout model, and includes latest CAD main
`850bfb93f21c6244028e0ba1b4174d1281859649` through its integration ancestry.
The SDK manifest records `dirty: false`, the exact source commit, and all ten
runtime/notice SHA-256 values.

The private CAD kit remains the source of the robot geometry, printable parts,
assembly guide and ready-to-run demonstration. This public Lite change
contains the pinned SDK and this integration evidence. The saved private BCAD
and SB3 were verified without rewriting them.

## Fresh local results

| Check | Result |
| --- | --- |
| Clean CAD SDK synchronization and `--check` | PASS; source `5922e226ae98ed8b99a7054d27adcd9fca0c2245` |
| SDK source, Lite overlay, and integrated static directory | PASS; identical manifest bytes, all 10 file hashes, and exact 11-file sets including the manifest |
| CAD `verify-brickwright-sync.mjs` | PASS; common Jolt release and integrity, four shared interaction sources, and current SDK pin |
| Five focused Lite test files | PASS; 18 tests, zero failures, zero skips |
| Normal `integrate.mjs` | PASS; native broker proof/assets current; tracked host source and lockfiles unchanged |
| `check-mirrors.mjs` and `git diff --check` | PASS; optional unrelated vendored-tree probes not invoked |
| Existing private Scout `lite/` example | PASS; exact BCAD, mobile A/B drive contract, executable graph, notices and all five artifact hashes |
| Fresh scratch regeneration from the final BCAD | PASS; normal generator and verifier accept the new SDK; CAD/program/license entries match the saved example exactly |
| Saved versus regenerated executable graph | PASS; identical commands, literals, menu shadows and linkage after consistently renaming random block IDs |

The focused files cover CAD opt-in preferences, block/Code/Python/JavaScript
round trips, project save/load and rollback, real extension bridge calls and
pending-control cancellation, the rover's free-base drive topology, transformed
connector anchors, continuous hinges, and the saved executable program.
The corruption cases reject edited motor speeds and injected executable
monitors even after their SB3 artifact hashes are refreshed.

The previously blocked `cad-program-api.test.mjs` now passes. The isolated
test dependency scope contains JSZip 3.10.1, format-message 6.2.4 and the
Scratch VM 4.8.115 source from its exact registry package, matching the GUI
lockfile. Its upstream argument/block types and cast implementation support
the actual overlay CAD extension loaded by the test. The repository's normal
`BW_INTEGRATED_ROOT` resolver announces this dependency scope; it does not
replace any owned source module. No dependency manifest or lockfile changed.

## Verification commands

Run from the Lite checkout after the clean CAD SDK build:

```sh
node scripts/sync-cad-sdk.mjs ../brickwright-cad
node scripts/sync-cad-sdk.mjs ../brickwright-cad --check
node scripts/integrate.mjs
node ../brickwright-cad/scripts/verify-brickwright-sync.mjs .
node scripts/check-mirrors.mjs
git diff --check

BW_INTEGRATED_ROOT=/path/to/prepared-test-dependencies \
node --test --import ./scripts/lib/register-gui-scope.mjs \
  test/cad-rover-project.test.mjs test/cad-lab-dialect.test.mjs \
  test/cad-project-bundle.test.mjs test/bw-cad-preferences.test.mjs \
  test/cad-program-api.test.mjs

BW_INTEGRATED_ROOT=/path/to/prepared-test-dependencies \
node --import ./scripts/lib/register-gui-scope.mjs \
  scripts/verify-cad-rover-project.mjs \
  ../brickwright-cad/examples/scout-tt-rover/lite

BW_INTEGRATED_ROOT=/path/to/prepared-test-dependencies \
node --import ./scripts/lib/register-gui-scope.mjs \
  scripts/create-cad-rover-project.mjs \
  ../brickwright-cad/examples/scout-tt-rover/scout-tt-rover.bcad \
  artifacts/scout-continuation/regenerated

BW_INTEGRATED_ROOT=/path/to/prepared-test-dependencies \
node --import ./scripts/lib/register-gui-scope.mjs \
  scripts/verify-cad-rover-project.mjs artifacts/scout-continuation/regenerated
```

Before integration, the old untracked generated
`packages/scratch-gui/static/cad-sdk` directory was removed. The normal overlay
copy then produced exactly the new manifest's file set; obsolete hashed
filenames from the old SDK are absent. The tracked overlay itself is replaced
by `sync-cad-sdk.mjs`.

The saved artifact identities remain:

| Artifact | SHA-256 |
| --- | --- |
| `scout-tt-rover.bcad`, its saved Lite copy and SB3 CAD sidecar | `5f12065a6162370c070ab9206cf7d9123d2c72c80b8ca14bc5c488af0b3e3c85` |
| Saved `tt-rover.sb3` | `553a30d0d98f5230d3294d4aae853720449632df31189004f84c7db8a64cbe8b` |

The generator intentionally creates random block identifiers and its upstream
default sound asset can vary. ZIP metadata also varies. Regeneration therefore
establishes the same executable graph and exact CAD, program and license
sidecars, not a byte-identical SB3 archive. The original saved archive retains
its own verified hash above.

## Build and browser boundary

The previous [resumption receipt](2026-11-16-scout-tt-cad-resumption.md)
records a successful full production Lite build and SDK byte-preservation
check. That is historical evidence for its recorded SDK pin. This continuation
does not claim a new full GUI build: only 526 MiB remained before a full GUI
dependency installation, and the host/build configuration is unchanged.

Fresh verification covers the new SDK build, pinned files, actual generated
static copy, host/control tests and saved project. The production configuration
copies `static/cad-sdk/` with its existing `minimized: true` asset marker,
preserving those files through Terser. The generated static copy checked here
is not a newly emitted full production GUI bundle. Native applications still
need to be rebuilt to include the new SDK.

A fresh browser preflight with system Chromium and a writable workspace
temporary directory again fails before page startup at
`process_singleton_posix.cc:297`: `socket() failed: Operation not permitted`.
No fresh browser interaction, application deployment or native release is
claimed. GitHub Actions were neither used nor awaited.

## Robot qualification

CAD's [completion receipt](https://github.com/CrispStrobe/brickwright-cad/blob/5922e226ae98ed8b99a7054d27adcd9fca0c2245/docs/evidence/scout-tt-completion-2026-11-16.md)
and [final physics report](https://github.com/CrispStrobe/brickwright-cad/blob/5922e226ae98ed8b99a7054d27adcd9fca0c2245/docs/evidence/scout-tt-final-physics-2026-11-16.json)
cover the final assembly separately from Lite's nominal control checks. The
report identifies the same saved BCAD hash above, 4,017 collision hulls, and a
200 Hz qualification sequence with approximately 179.07 mm forward,
185.00 mm reverse and 131.11 degrees of turning. That qualification sequence
uses its own 180 degrees/s commands and timing; these distances are not claimed
as results of Lite's separate 120/90 degrees/s demonstration.

The model remains a hardware prototype. Printed fit, real motor/battery
performance and physical Adafruit transport require their own hardware work.
