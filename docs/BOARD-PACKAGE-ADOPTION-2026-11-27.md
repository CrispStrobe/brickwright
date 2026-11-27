# Landed Board package adoption — 2026-11-27

## Scope and result

This checkpoint adopts the landed Board repair from
[bw-board PR #782](https://github.com/CrispStrobe/bw-board/pull/782), at merge
commit `b47e7e09ed873b33ca2fd912b21e136decc5e677`. The merge has the same Git tree
as its qualified candidate `6b9e281ca0104ebccacca6d8020295fe18ceb929`.
The consumer manifest, both package locks, installed payloads, current source
contracts, generated reports, static provenance and controller bundle record
now agree on the landed commit.

| Input | This checkpoint |
| --- | --- |
| `bw-board` | `b47e7e09ed873b33ca2fd912b21e136decc5e677` |
| `bw-circuit-ui` | `0a1b15edb0daecd723c7c07126450d84b86e3e68`, unchanged |
| `sb3-creator` compiler/gallery | `1c29f69fd22c86ecb0051938eedb246921cb3b88`, unchanged |

This is a Board package checkpoint. Supplier qualification and the subsequent
compiler/gallery adoption remain separate pending work. The local results
below do not claim a freshly built consumer bundle, hosted consumer browser
qualification or shipping evidence for the new pin.

## Exact adoption and derived identities

The existing `scripts/pin-packages.mjs --set bw-board=<landed commit>` writer
moved only the Board package pin and its root package metadata. The official
producers then renewed the dependent material:

- `sync-i8086-bios.mjs` compared the committed BIOS with the landed source
  before its `--record` pass. Both source and binary match; no ROM was replaced.
- `admit-static-provenance.mjs` re-admitted all three registered static records
  against the landed source. The recorded asset bytes remain unchanged.
- `sync-i8086-demo-roms.mjs --write` confirmed all seven committed demo ROMs
  byte-for-byte and refreshed their source identity.
- `gen-bw-board-census.mjs` generated the 40-row capability census and its
  tracked mirror. `gen-part-profiles.mjs`, `gen-i8086-capability-report.mjs`
  and `gen-language-device-matrix.mjs` regenerated their current reports.
- `package-upstream-notices.mjs` generated and then checked all six outputs.
- `scripts/spike/vendor-bundles.mjs --only controller` fetched the controller
  from the exact landed commit. Its 15,127 bytes and SHA-256
  `e7c35e7ae3d45ec2bdb1a7b1b9d51c727889bfd3780b852ffb11fe13a92ad079`
  are unchanged; only the generated per-file Board commit changed. Other
  extension bundles and pin records were preserved.

Integration and the VM, paint and render overlay applicators synchronized the
installed consumer inputs. The final part-profile source and VM controller pin
record each equal their corresponding installed mirror byte-for-byte.

The package contract literals in the nine physical adoption controls and the
instrument regression source contract now name the landed Board commit. All
numeric thresholds and mutation controls are unchanged. The two workflows that
check out Board directly also name the landed commit:
`circuit-instrument-regression.yml` and
`i80386-freedos-circuits-direct-actual.yml`. The latter retains its exact HEAD
and pin-admission checks. Dated reports and historical receipts retain the
source identities at which they were measured.

## Reviewed registry additions

The new Board registry exposed three kinds not yet classified by the Code-tab
part-profile inventory. Inspection of the actual landed device models supports
the existing refusal vocabulary without adding emitter capabilities:

| Kind | Classification | Model authority |
| --- | --- | --- |
| `kim-1` | `host` | `src/devices/kim1.js`: dedicated 6502 machine execution and machine control. |
| `cardiac` | `host` | `src/devices/cardiac.js`: dedicated decimal instruction machine and input/output control. |
| `mc6845` | `dip-surface` | `src/devices/retro-dips.js`: CRT controller DIP surface and video-frame state, used through the host bus. |

The conformance checks still require complete and unique registry coverage,
the closed classification vocabulary, emitter verb agreement, the exact
verb/family matrix and a current generated document. No device is hidden from
the inventory.

## Dependency identity and local evidence

The worktree originally used dependency-store key `e1d4298dbe243f763de0976f`.
After the package update, the normal `worktree-deps.mjs link --replace` helper
populated and linked the new input key `db491bd694351b5e9ed0341f`. The old store's
content digest was intact. The final `worktree-deps.mjs verify` check confirms
the current lockfiles, pins and linked inputs agree.

`pin-packages.mjs --verify-installed` compared both installed roots with clean
checkouts of the exact Board and Circuit UI pins: **13,850 Board files and
1,463 Circuit UI files in each root**, all matching the pinned Git/npm-pack
payload. Both roots also passed single-engine resolution. This check explicitly
reports `dependenciesVerified: false`; the separate content-keyed dependency
helper supplies the worktree dependency identity check.

| Check | Result |
| --- | --- |
| Thirteen-file physical adoption, part-profile, circuit and instrument batch | 86/87 initially passed, zero skips. Its sole failure was the newly exposed `mc6845` profile omission described above. |
| Final part-profile conformance after the reviewed classification and generation | **5/5 passed**, zero skips; resolves that sole failure. |
| Sixteen-file package, ROM, static provenance, current-pin and NUL batch | **153 passed, zero failures**; six checkout-dependent controls reported their missing environment inputs explicitly. |
| Controller bundle/integration, targeted producer, live BIOS ancestry and complete repository-history batch | 86/87 initially passed, zero skips. The sole failure named four old live Board literals in the two workflows above. |
| Final repository-history scan plus both existing workflow/source contract suites | **79/79 passed**, zero skips, after those four authorities were updated. |
| Official notices, generated reports and final dependency identity | All producers/checks completed successfully. |

The complete repository-history scan was supplied all three actual checkouts
through `BW_BOARD_DIR`, `BW_CIRCUIT_UI_DIR` and `SB3_CREATOR_DIR`. It therefore
checked commits beyond previously recorded consumer pins. Its gate and
historical-evidence rules were not changed for this adoption. The final scan
passed without stale current identities or new exemptions.

The local logs retained for review are:

- `consumer-board-installed-both-identity.log`
- `consumer-board-official-provenance.log`
- `consumer-board-deps-before-relink.log` and `consumer-board-deps-relink.log`
- `consumer-board-model-controls.log` and `consumer-board-profile-final-controls.log`
- `consumer-board-provenance-controls.log`
- `consumer-board-controller-refresh.log`
- `consumer-board-history-controller-controls.log`
- `consumer-board-final-history-workflow-controls.log`
- `consumer-board-generated-reports.log`

These are local execution records; this document does not substitute them for
the pending consumer CI artifacts. The existing hosted run of consumer
`29e5265583bf9ae4d07d58e3fb28fe6f2df89696` remains evidence only for that earlier
consumer source, before this Board adoption.

## Reproduction

Use writable `TMPDIR` and `BW_TEST_TMPDIR`, and exact clean Board/Circuit UI
checkouts. The main identity and final history checks are:

```sh
node scripts/pin-packages.mjs --verify-installed \
  --source bw-board="$BW_BOARD_DIR" \
  --source bw-circuit-ui="$BW_CIRCUIT_UI_DIR" \
  --installed-root node_modules \
  --installed-root packages/scratch-gui/node_modules
node scripts/worktree-deps.mjs verify
node --import ./scripts/lib/register-gui-scope.mjs --test \
  test/pin-move-chain.test.mjs \
  test/i80386-freedos-circuits-source.test.mjs \
  test/circuit-instrument-regression.test.mjs
node --import ./scripts/lib/register-gui-scope.mjs --test \
  test/bundled-extensions-match-upstream.test.mjs \
  test/controller-integration.test.mjs \
  test/vendor-bundles-targeted.test.mjs \
  test/bw-parts-conformance.test.mjs
```

Set `SB3_CREATOR_DIR` as well for the complete three-repository history scan.
These commands use local package/source controls; they do not invoke the broad
importer/compiler suite or submit fixtures to a compilation service.
