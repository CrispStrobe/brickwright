# Robot Lab checkpoint — 24 October 2026

The user explicitly requested a checkpoint now, rather than completion of the
previous release/API/pilot loop. Continue from draft PR
[#1336](https://github.com/CrispStrobe/brickwright/pull/1336), branch
`lane/robot-delivery-final-20261024`. This is an experimental integration, not
release qualification. Preserve other owners' worktrees and all original
failure/interruption evidence. Private machine paths and credentials belong
only in the local gitignored `CLAUDE.md`.

## What is integrated

Twenty-one supplied models are packaged as experimental examples, with matching
BW programs, equivalent MPD wrappers, individual CrispStrobe BSD-3-Clause notices,
searchable mechanism keywords and 42 draft EN/DE lessons. Original supplied
program bytes and geometry are preserved; LDraw author/license comments are
normalized under the user's ownership instruction. Source archive, original
entry and canonical file digests are in
[data/robot-lab-experimental-checkpoint.json](data/robot-lab-experimental-checkpoint.json).
Standard LDraw part geometry retains its own notices.

The app combines the established 109 choices and these 21 experimental entries.
Enable **Include experimental (21)** in the Examples dialog to see the candidates;
the compact selector also labels them experimental. The experimental badge means motion is unchecked, not that the proposed physical
principle has been demonstrated. Counts below are LDraw placements; inferred
pieces and physical BOM completeness are not established. Vector Delta is
visibly blocked because six instances of `5996.dat` are missing from the current
catalogue. Its original model and program are retained for repair. Loading a
blocked example must leave the current scene intact.

The existing native/qualified registry, generated catalogue, construction tests
and standard library ZIP exporter are intentionally unchanged. Their green
results do not cover the new candidates.

## Per-model source checks

All 21 have proper rigid source matrices, unique explicit semantic IDs and
BW parsing without compiler errors. Twenty compile with complete catalogue
coverage; Vector Delta has the missing part above. These checks do not run the
physics. Compiler diagnostics remain in the manifest, including warnings.

| Model | Placements | Compiled motors | Basic readiness | Compiler issue codes |
|---|---:|---:|---|---|
| `cross-ratio` | 127 | 1 | Parsed/compiled | none |
| `bend-ripple` | 156 | 2 | Parsed/compiled | none |
| `apex` | 477 | 1 | Parsed/compiled | none |
| `bloom` | 781 | 1 | Parsed/compiled | locked-hinges |
| `vector-delta` | 353 | 3 | BLOCKED: missing 5996.dat | loose-part, unknown-part |
| `cadence-geneva` | 200 | 1 | Parsed/compiled | none |
| `equinox-differential` | 98 | 3 | Parsed/compiled | none |
| `kestrel-flapper` | 61 | 1 | Parsed/compiled | none |
| `lumen-iris` | 146 | 1 | Parsed/compiled | none |
| `helios-transmission` | 156 | 2 | Parsed/compiled | none |
| `aster-governor` | 144 | 1 | Parsed/compiled | none |
| `orion-cardan` | 118 | 1 | Parsed/compiled | loose-part |
| `meridian-linkage` | 91 | 1 | Parsed/compiled | none |
| `solstice-pumpjack` | 93 | 1 | Parsed/compiled | none |
| `inertia-loop` | 314 | 2 | Parsed/compiled | gear-not-on-hinge |
| `offset-relay` | 456 | 2 | Parsed/compiled | none |
| `rack-decoder` | 245 | 2 | Parsed/compiled | none |
| `tangent-table` | 297 | 2 | Parsed/compiled | none |
| `pan-shift` | 197 | 2 | Parsed/compiled | none |
| `remote-pivot` | 153 | 1 | Parsed/compiled | none |
| `vesper-quickreturn` | 91 | 1 | Parsed/compiled | none |

**Unchecked for every new model at initial integration:** powered program
completion, the intended passive law, causal physical comparison, continuous
clearance/contact, support and post-completion hold, connected instructions,
physical BOM, manual controls and complete saved-project replay. Draft lessons
state intended observations, rather than claim measured success. Browser/build
checkpoint results are recorded below after verification.

## Where to continue

- `overlay/scratch-gui/src/lib/bw-sim/model/experimental-models.js`: experimental
  entries, metadata, aliases and blocked status.
- `overlay/scratch-gui/src/lib/bw-sim/sim-lab.js`: combines interactive discovery;
  `sim-session.js` keeps the established native registry separate.
- `overlay/scratch-gui/static/sim-lab/models/`: canonical LDR and MPD files.
- Matching `programs/`, `lessons/` and `licenses/` directories contain the BW,
  bilingual draft lessons and full notices.
- `docs/data/robot-lab-experimental-checkpoint.json`: source provenance and
  explicit per-model checks, diagnostics and remaining work.

Start with one unblocked small model. Follow
[the model handoff](ROBOT-LAB-AGENT-HANDOFF.md) and
[the intake harness](ROBOT-LAB-MODEL-INTAKE-20261022.md); find the actual runner
in `scripts/qualify-robot-lab-models.mjs`. Define an independent quantitative law,
world-frame support checks, a physical causal control and an unchanged full
post-completion hold before tuning geometry. Check actual compatible connectors;
do not prescribe output poses or silence compiler issues. Preserve failed
specimens and reports. Vector Delta needs actual catalogue/geometry support or
a documented compatible design replacement; do not stub the missing part.

Promote a candidate only after independent acceptance: move its entry into the
established `sim-session.js` registry, remove the experimental duplicate, add its
reviewed native test/judge/contract, update catalogue/lesson generators and
classical aliases, then run affected construction, both-browser, manual,
program, save/reopen and export checks. Retain original inputs and state the
physical piece count separately from placements. Claim any engine or supplier
change under its proper owner before implementation.

## Earlier verified component and unfinished delivery

Source `9c78f3679b5c4f8984c12b7a75b8d48facff8ff5` has a fresh production build,
verified canonical dependencies, 100 focused controls and passing Chromium AND
WebKit Root Bridge and measurement-editor journeys. Root Bridge's saved program
intentionally pauses physics; its replay now captures completion, resumes only
the clock and preserves holding motors through the full continuation. The app's
virtual SPIKE resume no longer reconnects an already connected provider and
clears its holds. Fresh Run and other route admission remain covered. WebKit
export checks observe the actual system-share file and verify its bytes/reopen.

The subsequent broader qualification was interrupted at the user's checkpoint
request. Catalogue, lesson/registration and construction stages passed on that
source; the native stage was still running. Hosted qualification was also
incomplete/red and is **not** admission: browser audit logs reported missing
step records. Original failures and the scope-change interruptions are retained
locally. Investigate the actual hosted gate records before future release;
do not relabel interrupted or unaudited runs as passing or blindly rerun an
unchanged failure.

No new release tag or native binaries have been produced. Version 0.1.27 notes
and metadata are prepared, but release still needs qualified normal main
landing, immutable tag, actual APK/Windows artifacts and independent iOS AND
macOS TestFlight processing/notes/groups/compliance/review readback. Preserve
the separate frozen 0.1.26 recovery ownership.

Production model API is still the earlier runtime; it has NOT been cut over.
A separate private admission store was initialized once and actual agent-key
isolation checked. Never reset its ledger. Production still needs the qualified
immutable worker pin, private environment/worker-secret setup, real hosted
transport/positive/failure/ownership/source/terminal-release checks, and the
runtime-bound private kit publication. Private repository names, credentials,
operator scripts and exact local evidence paths are in `CLAUDE.md`.

The fresh VPS OpenCode builder trial has NOT run. Existing isolated unit/config
preflights are not a model-building trial. After the API and private kit work,
launch a genuinely fresh session, let it choose and remotely claim a novel idea,
exclude these 21 pending concepts too, then independently review its law/control,
actual app behavior and evidence. Record assistance honestly and finish its
registry transaction. The user authorizes a fresh agent to resume this unfinished
work; no currently running model builder owns it.

## Checkpoint app verification

The production build passes on source
`9ac75abeca6517133f828719a24b17fe781b2f73`, after canonical integration and
byte-for-byte identity checks for the five copied UI modules. All 104 focused
checks pass. The initial standalone build had a stale copied gallery; that
failed probe and build are retained, and the corrected build was produced
without changing assertions or physical limits. Always run `npm run integrate`
after the last UI/source edit and before `npm run build:gui`; a Git manifest
alone does not establish that ignored package copies match the overlay.

Installed Google Chrome 155.0.8059.85 passes the limited checkpoint smoke:

- 109 default cards; enabling experimental examples gives 130 cards and 21 badges.
- Vector Delta's card, draft lesson and public load API refuse the unsupported
  source; the existing scene stays intact.
- Vesper loads 91 recognized placements in the real physics worker, automatically
  loads 285 Blocks, and passes the visible-model screenshot check.
- All 42 new EN/DE lesson JSON files are served and structurally readable.
- Returning to the established driving-base example succeeds; no page errors.

Vesper's powered motion and mechanical law are **not** tested. The other twenty
new models have no GUI load/render acceptance. German interactive journeys and
new-checkpoint WebKit coverage remain unchecked. The packaged Chromium startup
probe timed out locally; a read-only follow-up found it still loading without
page errors. Installed Chrome reached ready with the real worker and passed the
checks above. Preserve this distinction; no browser-parity claim or environmental
cause has been established. The local preview and exact private receipts are in
`CLAUDE.md`.

The final checkpoint's follow-up changes only handoff/validation documentation;
the app build and smoke retain their actual source identity above. It is a
**pushed draft checkpoint**, not main landing, release admission, API deployment
or certification of the 21 candidate mechanisms.
