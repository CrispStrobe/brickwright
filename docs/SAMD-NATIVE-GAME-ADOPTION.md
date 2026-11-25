# SAMD software-profile engine adoption

Status: the 9c engine release and landed Board supplier are qualified,
2026-11-02. Fresh Lite Chromium and installed Tauri/WebKit game qualification
on the final consumer remain pending. Earlier consumer receipts retain their
original engine, source, frontend and executable identities.

## Current 9c supplier admission

Immutable [release `labwired-wasm-9c420649`](https://github.com/CrispStrobe/bw-board/releases/tag/labwired-wasm-9c420649),
ID `430923343`, uses Core
`9c4206499a39a04f56cd11c0b8c9b4cb94a06e62`.
[Producer 41359378516](https://github.com/CrispStrobe/bw-board/actions/runs/41359378516)
passed two fresh independent builds, deterministic executable/configuration/
license comparison, 127 engine cases without failures/skips, six SAMD profile
controls and three actual producer game samples. All nine published assets
match the admitted originals; the fresh SAMD audit joined 565 source-fixture
files and independently decoded 51 frames. These are producer results.

[bw-board PR723](https://github.com/CrispStrobe/bw-board/pull/723) merged at
`cda9d13b3e5b4a3e40854f45e04d110ab2a57ef3`, with build PIN, generated catalog
and fixture engine identities aligned.
[Run 41374193811](https://github.com/CrispStrobe/bw-board/actions/runs/41374193811)
passed all four required supplier CI jobs and their named steps in one run;
Lite's unchanged `verifyBwBoardCi` admitted that exact head.
[S040 41374193796](https://github.com/CrispStrobe/bw-board/actions/runs/41374193796)
passed 31 cases; [S3 41374193817](https://github.com/CrispStrobe/bw-board/actions/runs/41374193817)
passed 23 retained-flash cases plus the original ELF case, all without skips.
These S040/S3 results qualify the supplier routes and do not replace SAMD
consumer acceptance.

The new root and GUI installations pass exact Git/npm-pack content verification
for Board cda9 (13,448 files each) and CUI 380dc8b7 (1,367 files each), including
single-engine resolution in both trees. The final Lite adoption still needs
emitted engine/glue/profile admission, source/frontend/native-executable joins,
and fresh Chromium and installed Tauri/WebKit game results under the existing
qualifier. Prior `3b655aef` and later historical consumer results, including
their timing/RSS measurements and retained failures, are not reassigned to 9c.
Selected-motion qualification remains deferred. An engine update does not add
a normal native SAMD compile/import/export route or physical/SDK/LVGL/radio/
native-USB support. See the [current handoff](SAMD-NATIVE-GAME-HANDOFF.md#current-9c-release-and-consumer-boundary)
for released byte identities and the preserved evidence boundary.

## Historical 3b adoption record

The following supplier and consumer records describe the earlier
`labwired-wasm-3b655aef-locked` adoption. Their status and measurements remain
attached to those original inputs.

For that earlier adoption, supplier assembly/release and actual consumer game
acceptance completed. Build run40783464522 supplied the admitted frontend; actual game
runs40826297334 (Chromium) and40828345515 (installed Tauri/WebKit) passed three
fresh instances each. Independent audits decoded all 102 original RGB frames,
verified press/release and sampled RSS, and joined source/frontend/executable/
engine/profile/firmware identities. Consumer
[PR1533](https://github.com/CrispStrobe/brickwright/pull/1533) folds the
SPIKE support closure and merged as
`9f1a620f2aae5ee988ed02069a8bf34c18949123`. Seventeen final-head checks passed,
but the enabled `full CI requested` check failed before that merge. The source
landed; enabled-check closure and retained-evidence custody review remain open.
No normal native SAMD GUI compile/import/export route is claimed. See
[the current handoff](SAMD-NATIVE-GAME-HANDOFF.md) for results and preserved
failures; reuse successful originals rather than replaying guests.

The owned supplier fixes are qualified and merged:

- [CODAL PR91](https://github.com/CrispStrobe/codal-samd/pull/91) selects TC/TCC
  using the actual timer id in the owned compile copy. Both scheduler profiles
  pass natural TCC0 runtime/USB/HF2 checks, original-source panic90 and masked
  interrupt controls; all84 native results and source/config/image joins passed.
- [CODAL PR92](https://github.com/CrispStrobe/codal-samd/pull/92) adds an opt-in
  authored RGB444 runtime profile that sends its complete RGBSET table over the
  actual SPI path. The positive and short/missing-upload controls pass in both
  profiles; all90 native results and independent controller-memory audits passed.

The explicit [Core PR262](https://github.com/CrispStrobe/labwired-core/pull/262)
assembly registers the existing controller-memory codec and qualified peripheral
models under a separate software profile. The historical PyBadge descriptor is
not substituted for this assembly. The two1KiB input windows contain authored
calibration/serial packets; they are not hardware captures or physical page-size
measurements. A colour is unknown until the actual guest uploads the complete
RGBSET table. No host-installed default LUT is permitted.

## Historical completed work and recorded acceptance

1. **Done — explicit Core assembly.**
   [Core PR262](https://github.com/CrispStrobe/labwired-core/pull/262) merged as
   `3b655aef4085082152129c84849d4e2ad5004a7f` after fleet, selected guest and CLI
   qualification. Do not substitute the historical PyBadge descriptor. Original
   failures, authored inputs and qualification limits remain retained.
2. **Done — source-built native and Node game evidence.** The
   [native/Node campaign](https://github.com/CrispStrobe/codal-samd/pull/93)
   passed six independently audited samples. The original paused-menu failure
   came from active-high virtual input IDs; the authored game selects the
   runtime's existing active-low IDs1050–1057. Budgets, runtime, physical input
   model and picture assertions remain unchanged.
   [Results and limits](https://github.com/CrispStrobe/codal-samd/blob/35ca8138ae4f7b9b9ecb5dc9a1d04dbf02e5619f/docs/SAMD-NATIVE-GAME-RESULTS.md)
   establish functional execution, not real-time playability or Lite acceptance.
3. **Done — production WASM and immutable release.**
   [BW PR711](https://github.com/CrispStrobe/bw-board/pull/711) merged after its
   enabled checks and independent retained-original audit.
   [Producer40699886470](https://github.com/CrispStrobe/bw-board/actions/runs/40699886470)
   passed two hosted builds, determinism, 125 legacy tests and three production
   game samples. Engine, glue, Node loader marker and exact-source profile bytes
   match across builds. The
   [locked release](https://github.com/CrispStrobe/bw-board/releases/tag/labwired-wasm-3b655aef-locked)
   has API `immutable: true`; its nine asset digests match the qualified originals.
   Motion qualification remains deferred. Keep component notices and the narrow
   Node 22 inlining workaround documented by the
   [producer handoff](https://github.com/CrispStrobe/bw-board/blob/master/docs/SAMD-ENGINE-RELEASE-HANDOFF.md).
4. **Done — source, emitted assets and original native identity.** The full
   source run40783464522 and native40803428616 passed on consumer48df0f93.
   Independent original audit verified all 8,563 frontend files, 184 native sources
   and executable SHA256 b1e644b68b203e196f25203ed2424220b2fcff15766f31cee32ba245b45c8a38.
   Runtime glue, Wasm and profile exactly match the locked release. Native compile
   defaults are unchanged. Original acquisition, installation and test failures
   remain retained with the bounded repairs in the current handoff.
5. **Consumer acceptance recorded; source landed with an enabled-check failure.**
   Three fresh actual Chromium and three installed Tauri/WebKit game instances
   passed, with the recorded independent RGB, input, memory and identity readback.
   The composed SPIKE package passed 13 installed lifecycle cases. PR1533 merged
   as `9f1a620f2aae5ee988ed02069a8bf34c18949123`; reviewed parents and tree matched
   the landed merge. Seventeen checks passed, but the enabled admission check
   failed. Follow the [handoff's forward qualification steps](SAMD-NATIVE-GAME-HANDOFF.md#continuation-boundaries)
   for the selected-tier policy, final-head checks and retained-original binding
   review before claiming that closure.

## Separate work

A new native SAMD compile/import/export/GUI route needs its own target selection,
configuration, supported-format/refusal, input/display and installed interaction
contract. An engine asset pin does not add that route. Physical panel/aperture,
gamma, analogue colour, electrical timing, silicon recaptures and universal
real-time speed need their own evidence. This lane makes none of those claims.

## Hosted qualifier registration

The dispatch-only `samd-native-game-qualification.yml` accepts full consumer and
producer commits plus exact automatic frontend, native executable and engine
producer run identities. Its admission job checks official metadata before one
acquisition of each original, verifies publisher archive digests, checks safe
closed archive membership, independently joins the actual CI checkout, complete
frontend inventory, native source and executable receipt, and admits the exact
engine/profile/guest inputs. Only declared Markdown composition differences are
allowed between the reviewed consumer and its actual frontend checkout.

Subsequent jobs run three fresh engine instances in actual Chromium and the
actual embedded Tauri/WebKit editor, using its shipped assets. The collector
independently decodes each returned RGB frame and checks targets, movement and
press/release phases. The observer canvas is a raw controller-memory view; it
does not implement a product native compile/import route. No private runtime
resource is supplied or claimed. Registering this infrastructure does not change
the engine pin or qualify an actual guest; retain status as pending until the
exact consumer has passed both jobs and the remaining enabled checks.

Memory observations distinguish JavaScript heap statistics from process RSS.
The hosted collectors sample summed RSS once per second over the Node observer
and descendants (including Chromium and sampler overhead), or the owned Tauri
driver and installed-app/WebKit descendants. Results state the scope, sample times and largest observed sum.
Shared pages count in each process; this is neither proportional memory nor a
continuous peak. WebKit may omit JavaScript heap statistics; RSS observations
remain required. No actual memory result is claimed before those runs pass.
