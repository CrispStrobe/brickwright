# SAMD engine adoption handoff — updated 2026-11-02

## Current 9c release and consumer boundary

**Supplier qualification is complete; fresh Lite consumer qualification remains
pending.** Immutable [release `labwired-wasm-9c420649`](https://github.com/CrispStrobe/bw-board/releases/tag/labwired-wasm-9c420649),
ID `430923343`, binds Core
`9c4206499a39a04f56cd11c0b8c9b4cb94a06e62` (tree
`c1afbd283c510b755129a1fa38b45b497d6204ca`) to producer
`1c9ed301819f21bdab9fc5c0fb35e82d858e821d`.
[Campaign 41359378516](https://github.com/CrispStrobe/bw-board/actions/runs/41359378516),
attempt 1, passed two fresh hosted builds, comparison of eight deterministic
executable/configuration/license files, 127 engine cases without failures/skips,
six SAMD profile controls and three actual producer game samples. BUILD-INFO
differs only by build time. All nine published assets were verified against the
admitted originals; the fresh SAMD audit joined 565 source-fixture files and
51 independently decoded frames.

| Current released asset | Bytes | SHA-256 |
| --- | ---: | --- |
| Web glue | 154,119 | `d464625236ee199651679c5bb9148b2cd6f2e8bc25726cc2cbd4a22d1272127d` |
| Node glue | 151,452 | `b79c99c23545af5c173b63f5403f99cf3003cc7c57b8cce74bfb47d5f5f80674` |
| Web/Node WASM | 29,165,165 | `41c31ae388ce4389794eb9c6ee1f602bf361d792928dfabf2a1ef917d0796264` |
| SAMD profile | 17,838 | `37d146fbb2c590fa2655a2a4630025049ed824867544aa967a412926ba218b0a` |

[bw-board PR723](https://github.com/CrispStrobe/bw-board/pull/723) merged at
`cda9d13b3e5b4a3e40854f45e04d110ab2a57ef3`, tree
`043d1da0232bbc9c78195b2fe85c24d89e22c181`. Its build PIN, generated catalog
and fixture engines use the same Core release.
[Default CI 41374193811](https://github.com/CrispStrobe/bw-board/actions/runs/41374193811)
passed `test`, `vectors`, `corpus` and `vectors186` with all required named
steps in one exact-head run, admitted by Lite's unchanged `verifyBwBoardCi`.
The dedicated [S040 run 41374193796](https://github.com/CrispStrobe/bw-board/actions/runs/41374193796)
executed 31 passing cases; [S3 run 41374193817](https://github.com/CrispStrobe/bw-board/actions/runs/41374193817)
executed 23 passing retained-flash cases plus the original ELF case, all with
zero failures/skips. M1 firmware and ROM source remain
`3b655aef4085082152129c84849d4e2ad5004a7f`.

The independently retained unchanged Core S040 checker passed on the identical
released source, engine and guest. Its verified stdout is 4,876 bytes, SHA-256
`a4738f7874699a995c25658ffcaa32ae9ab31bd2246a4fd5bf53ded4df39462a`.
The supplier manifest separately declares a 4,869-byte result, SHA-256
`3b24d6c506a1ebb050f964bef02d6da58657449beb3b5734169a4a94d5a423ec`;
those original output bytes are unavailable in this review and that digest is
not independently verified. The report includes variable elapsed wall time.
The separate declaration is unchanged; the independently verified pass and
landed firmware gates satisfy the supplier prerequisite. Neither report is
relabeled as the other. See the [S040 plan](ESP32-S3-4848S040-PLAN.md#qualified-release-and-landed-supplier--2026-11-02)
for the full scope.

Both genuine package installations pass the unchanged exact-content verifier:
13,448 Board cda9 files and 1,367 CUI 380dc8b7 files match in each tree, with
single-engine resolution. Fresh Lite source/build and emitted bytes, native
executable/source/frontend admission, and both actual game realms remain to
qualify on the final consumer. The earlier consumer runs below retain their
own 3b engine and original source/executable identities; other historical
consumer receipts likewise remain attached to their recorded inputs. Their
successful frames, timings, RSS and failures are not transferred to 9c.
The producer's fresh game run is independent evidence for the release and
does not qualify Lite's browser or installed application. Selected-motion,
physical capture, general SDK/LVGL/radio/native-USB support and a normal native
SAMD compile/import/export GUI route remain outside this adoption.

## Historical 3b consumer evidence — recorded 2026-10-29

The following source, supplier, runtime measurements and failure records retain
their original scope. Statements of completed or pending work in this ledger
describe that earlier adoption; current 9c consumer status is stated above.

**Source landed; enabled-check closure remains open.**
[PR1533](https://github.com/CrispStrobe/brickwright/pull/1533) merged as
`9f1a620f2aae5ee988ed02069a8bf34c18949123`, folding PR1547. On reviewed head
`4e225970574ca517d7908811fe9bf9c3ed2f4fb4`, 17 checks succeeded and 11 were
conditionally skipped. The enabled
[`full CI requested` check](https://github.com/CrispStrobe/brickwright/actions/runs/40836953746/job/123335306292)
failed before the merge because the executing policy required the `ci:full`
label. The operator's fast-tier preference did not change that source policy or
turn its failed verdict into success. The landed tree matches the merge of the
reviewed parents; that structural proof does not close the enabled-check failure.
Original source branches, guest evidence and failures remain retained.

The full [source run40783464522](https://github.com/CrispStrobe/brickwright/actions/runs/40783464522)
and [native run40803428616](https://github.com/CrispStrobe/brickwright/actions/runs/40803428616)
passed on consumer `48df0f93f9b6b642238c13448e6f075d8871eb83`. Independent original
archive/source audit joined all 8,563 frontend files, 184 native sources and
binary `b1e644b68b203e196f25203ed2424220b2fcff15766f31cee32ba245b45c8a38`.
Compile defaults and qualified original inputs remained unchanged.

**Both actual game realms passed:** Chromium in
[40826297334](https://github.com/CrispStrobe/brickwright/actions/runs/40826297334),
installed Tauri/WebKit in
[40828345515](https://github.com/CrispStrobe/brickwright/actions/runs/40828345515).
Each ran three fresh instances and retained 51 RGB frames. Independent decoding
confirmed eight targets, ball motion, eight-pixel press displacement and stopped
movement after release in all six instances. Original source/frontend/executable,
observer/transport and engine/profile/firmware identities joined exactly.

| Realm | Sample wall seconds | RSS observations | Maximum observed summed RSS |
| --- | --- | --- | --- |
| Chromium | 165.3971 / 164.9345 / 164.3794 | 496 | 1,059,164,160 bytes |
| Installed Tauri/WebKit | 157.864 / 154.202 / 153.912 | 470 | 1,487,085,568 bytes |

RSS is a one-second process-tree sum including observer processes and shared
pages per process; it is not PSS or a continuous peak. These functional results
do not establish real-time playability, physical capture or a normal SAMD GUI
compile/import/export route.

The installed result uses observer
`e859cecd3adcfa001c9311b585ffe6983db49c76`, the original consumer above,
frontend40783464522, native40803428616, producer40699886470 and producer head
`8ea3767903d5135f4bd1e74914e25663b530d502`. Observer and HTTP transport hashes
are retained in its original result. Reuse the original artifacts for review.

Preserved failures and bounded repairs:

- Run40826003752 stopped before guests: current gh refused ANSI-bearing job
  logs. The reader captures raw responses into buffers/files and records its
  own source/hash separately from the exact guest checkout.
- The installed job in40826297334 lacked Tauri's resource directory. The same
  admitted binary is now installed in a local usr/bin plus usr/lib/Brickwright
  prefix. SAMD uses embedded frontend assets; no private SPIKE resources were
  added to this qualification.
- Installed40827218429 reached the game RPC before Node fetch's implicit
  300-second header cutoff aborted it. The node:http transport honors the
  existing 4,900-second RPC and 4,800-second script deadlines. Guest frame/input
  budgets, startup limits, picture assertions and workflow deadline remain.
  Twelve metadata/archive/RGB/memory/HTTP controls passed. The successful
  installed game exceeds five minutes without changing these declared limits.
- Native40827224550 retained a real timing failure: fastest exchange 3.12547 ms
  exceeded the unchanged 2.5 ms bound. Maintainer commit
  `fb43bdf543c6bb8b54cddc2aeaa6775cff5a7b46` repairs only mock JSON-line writes,
  with identical wire bytes/order, all 1,000 exchanges and original assertions.
  Production prefixes are byte-identical. Hosted40828350448 passed 275 standard
  native tests (11 existing ignored) plus nine explicit ignored-suite controls.
  Seventeen final-head checks passed; the enabled admission failure recorded above
  remains open. The original native failure remains retained.

- Fast run40830119499 passed five unit shards and build, but shard2 correctly
  rejected the installed gate's unrecognized reader/scripts invocation. The
  workflow now uses working-directory reader and the canonical node scripts
  command. All six observer/input/output paths resolve identically. The observer,
  game, arguments, budgets and successful originals are unchanged. Twenty-three
  coverage/census controls and45 related workflow/budget/skip controls passed;
  the failed original remains retained. No successful guest is replayed.

The separate composed private SPIKE package passed all 13 installed lifecycle
cases, including view switching, exact owned-process loss and natural session
expiry at 120.14 seconds with fresh-session recovery. Independent audit joined
one installed image, binary, firmware, source/helper identities, zero exits and
unchanged CPU/memory/network bounds across all 13 cases. See
[the delivery record](SPIKE-CURRENT-RUNTIME-DELIVERY-2026-10-28.md). Its existing
redistribution false marker remains; it is separate from official SAMD input
admission and makes no external MicroPython or physical-silicon claim.

## Historical completed supplier work

Core [PR262](https://github.com/CrispStrobe/labwired-core/pull/262) merged as
`3b655aef4085082152129c84849d4e2ad5004a7f` after fleet, selected guest and CLI
qualification. BW [PR711](https://github.com/CrispStrobe/bw-board/pull/711) merged
as `1f92a1aa85e808827a4c28b219bf11a572f07882` after all 12 enabled checks succeeded;
reviewed parents and landed tree were verified.

The [locked release](https://github.com/CrispStrobe/bw-board/releases/tag/labwired-wasm-3b655aef-locked)
has API `immutable: true`; all nine publisher digests match retained qualified
originals. The earlier unlocked tag remains preserved and is not the proposed pin.
Producer [40699886470](https://github.com/CrispStrobe/bw-board/actions/runs/40699886470)
passed two builds, determinism, 125 existing tests and three game samples.
Independent review checked 565 files and 51 RGB frames. Motion remains deferred.
Keep component notices and the narrow Node 22 inlining workaround documented by
the [producer handoff](https://github.com/CrispStrobe/bw-board/blob/master/docs/SAMD-ENGINE-RELEASE-HANDOFF.md).
Infrastructure [PR1456](https://github.com/CrispStrobe/brickwright/pull/1456)
merged as `dea504b32a9a4bd43a2a9d25b587590a0ac9763f`. The package owner released
the former PR1318-first hold for this exact adoption and its claimed repairs;
no general package boundary is open.

## Historical prerequisite identity evidence

PR1533 updates web engine/glue/profile identity in `scripts/sync-labwired-wasm.mjs`
and matching Node identity in `.github/workflows/target-performance.yml`.
No board/compiler/CUI package pin, native producer or compile default changes.

- All 88 focused Node 22 controls passed without skips. All six hosted unit shards
  now passed. Shard6 reports 1,885 passes, zero failures, one existing TurboWarp
  checkout skip and four existing Arcade TODOs; keep their documented limits in
  [ARCADE-888-OPEN-FAILURES.md](ARCADE-888-OPEN-FAILURES.md).
- [Tauri40783464531](https://github.com/CrispStrobe/brickwright/actions/runs/40783464531)
  passed full Rust tests (273 passed, zero failed, 11 existing ignored) and E2E.
  Vendor, GUI infrastructure and historical-study controls passed. The separate
  actual historical study is correctly skipped on this event.
- The official frontend
  [producing job123176209089](https://github.com/CrispStrobe/brickwright/actions/runs/40783464522/job/123176209089)
  succeeded. Artifact12866901737 was acquired once after metadata admission.
  Independent review hashed all 8,563 emitted files (298,288,470 bytes) and verified
  actual checkout `5b6d453136967e943fd36ef29c3c8054a295a1fb`, its parents/tree,
  source stamp and complete inventory. Its only difference from the reviewed
  head is `docs/EDITOR-WORKSPACE-UX-HANDOFF.md`.
- Emitted assets exactly match the locked release: glue
  `a29729658f267617e7d2539d756bd4dbe0662b25768348ecaeab723a9b032e1f`,
  Wasm `1ad2947b99df8a13fce29c9240a79c61fb66e4d57ede26ca50880f141f3e3978`,
  profile `0fe1e72ae684153696efbca5874d2633007b92a9c9144f38cd62fdd28d030750`.
  This proves byte binding, not successful overall source CI or actual guests.
- [Native40803428616](https://github.com/CrispStrobe/brickwright/actions/runs/40803428616)
  uses this reviewed consumer, frontend40783464522 and the unchanged closed
  `compile_pins` object from the reviewed
  [qualification profile](https://github.com/CrispStrobe/brickwright/blob/48df0f93f9b6b642238c13448e6f075d8871eb83/scripts/native-installed-qualification-profile.json).
  Both producing jobs succeeded. Its official originals were acquired once;
  independent audit joined 184 native source files, all 8,563 frontend files and
  executable SHA256 `b1e644b68b203e196f25203ed2424220b2fcff15766f31cee32ba245b45c8a38`.
  Compile defaults are unchanged. This is an identity audit, not installed-game
  acceptance; the remaining source workflow is still pending.

The retained [five-target benchmark](https://github.com/CrispStrobe/brickwright/actions/runs/40730146231)
passed its unchanged floor at source `317c069003803f9e8bfbe570ca7c371da6e52c10`.
Its inputs are unchanged; do not repeat it. Core-loop ceilings do not qualify
active-game or hardware speed.

## Historical failures and bounded repairs

Original [Build40734487998](https://github.com/CrispStrobe/brickwright/actions/runs/40734487998)
failed historical-study controls. Its successful producing job also minified the
verified 153,114-byte glue to 51,263 bytes. Strict byte admission refused that
frontend. Preserve both failures; this quarantined original must never feed
native or actual-game acceptance.

Both webpack configurations now preserve only the exact runtime glue through
the existing copy hook. Broker proof rules and unrelated minification remain
intact. The source owner's released three-path study repair seals four complete
historical inputs and preserves the exact historical UI manifest. Original
experiment pins, identity sources, thresholds, captures and intent are unchanged.
Current-pin/never-pinned guards remain strict. Do not import the supplier's
entire PR. Hosted shard6 now passes all four sealed historical-role controls.

Original [Tauri40765450230](https://github.com/CrispStrobe/brickwright/actions/runs/40765450230)
reported 269 passed, one failed and11 ignored: the owner-crash test observed a
child surviving its existing three-second bound. Its original fixture/test
matched commit `3d77472b518ae4e9a57fd8cfb154e31ecba1b432`; SAMD had changed no
Rust. The original cause remains unknown, not a proven flake or engine regression.
The original log is retained once; do not rerun the unchanged failure.

Test-only successor: the
[Linux observation claim](../lanes/2026-10-28-linux-owner-death-observation.md)
owns only the supervisor's test module; production bytes remain unchanged.
The candidate binds parent/group identity and a held process descriptor, requires
complete PID publication, retains bounded failure snapshots and signals only the
admitted child. The original three-second assertion stays intact. The original immediate-crash
case remains; the100 ms live-owner case uses a separate fresh fixture. A negative
fixture observes the actual supervisor's kill signal before deliberately
clearing it and requiring survival through the same window, then exact cleanup.
Private extracted-method controls and three adversarial cuts passed; their
explicit synthetic supervisor boundary is not full Rust or guest qualification.
Full hosted Rust CI now passes these cases, as recorded above. Actual SAMD
acceptance remains pending; the original failure is not reclassified as a flake.
Production bytes and the original assertion are unchanged. Preserve other owners'
MicroPython manifest hunks and old dirty worktrees.

## Continuation boundaries

For the current 9c adoption, complete fresh final-consumer qualification using
the existing source, artifact and actual-game gates. Review the older receipts
with their original identities; a current supplier pass does not promote an
older frontend or native executable into a new qualified consumer.

The earlier source landing and software acceptance results recorded above remain
separate from closure of the failed enabled check. The selected-tier policy
repair is owned by [PR1536](https://github.com/CrispStrobe/brickwright/pull/1536).
Its final source and artifact-event admission must qualify before a preserving
normal composition reaches main. Require every enabled check on that final head
to succeed; a manual run does not replace an enabled PR admission check.

Confirm custody and reuse the retained actual-game originals for source, frontend,
executable, observer and asset binding review. Do not describe a new review as an
independent original audit until those retained originals have been accessed.
Record the qualified forward landing and its checks when available. Physical
capture and a normal SAMD GUI route remain separate work.

Normal project compile/import/export and GUI-route adoption remain separate,
scoped work in [the adoption guide](SAMD-NATIVE-GAME-ADOPTION.md). No current
result claims hardware capture, panel accuracy, active-game performance or motion
qualification. Keep private paths, raw logs and operational details out of Git.
