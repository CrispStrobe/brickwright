# Pinned package migration takeover

2026-09-12. User authorized continuing the stalled migration without waiting
for the previous session's usage limit to reset.

## Preservation and ownership

The prior worktree `<owned checkout>` remains unchanged.
Its tracked diff from `411828a304dd84759cd4c1fb82444e72944ffbdc` plus the two new
pin-script/test files was captured using a separate temporary Git index in
checkpoint `44872243ae64a6bb1a3cad62dd05c54c51b00e69`. Its tree is
`8b4b7a3caf21854d0dc165141ae13c25bfe77285`. The original tracked diff SHA-256 was
`68735a195840726669a0035ac56f9d8849556242ddb115a4a70a6eae2b6e252b` before and
after capture. No stash, reset, original-index mutation or untracked-file removal
was used. The checkpoint is preserved work, **not a qualified migration**.

Root owns `feat/package-migration-takeover` in an isolated worktree. The previous
screen session was notified not to resume conflicting writes without coordination.

## Acceptance work

- Verify removed copied roots do not discard local behavior or required assets.
- Verify exact package URL/repository/SHA consistency and installed source
  identity; a lockfile containing a SHA is not proof of installed bytes.
- Reconcile the restart-only execution-policy GUI candidate, using an actual
  installed engine package that exports the policy contract.
- Regenerate pin-derived census, notices and capability/provenance reports.
- Build from the pinned dependencies and run focused plus full app tests.
- Reproduce circuit-UI `sweep-canvas-live` failure without weakening its drag
  assertion; preserve default full interaction coverage and diagnostic artifacts.
- Run actual app browser selection/persistence/refusal/reconstruction journeys.
- Keep native experiments gated. Package migration does not establish native
  CPU/peripheral support, a wired GUI backend, or 4.77 MHz capacity.

## Initial facts

Snapshot dependencies: bw-board `d7436dc782dd1c499f0fb29ae5cfaa8ab78ec2d6`,
bw-circuit-ui `657e0217fa14fe345ad2781ae87d7f1e9b1e42fe`; sb3-creator remains
copied and pinned separately. Engine policy implementation is on the reviewed
engine feature branch, not the snapshot's engine pin. Circuit UI PR20 has a
33/34 interaction result, with only live-sweep dragging failing; cause still
requires reproduction. Its package metadata says MIT but its LICENSE is MPL-2.0;
do not label both imported packages MIT or erase the actual license notice.

No merge or deployment is established by this document.

## Takeover integration progress

The execution-policy GUI candidate is integrated with installed engine
`7fbdfa9f575ba6c7da36e253b98c92e9093d8837`; exact upstream CI run
`34687110308` completed successfully. UI remains pinned at `657e0217` above.
Both packages in both root and GUI installs passed pinned Git-archive/npm-pack
byte verification (engine 1114 files and UI 1109 files per install). This does
not certify all transitive dependencies. The installed-package focused policy
suite passed 16 tests, zero skips, without the test-only source loader.

`docs/PACKAGE-FORK-PRESERVATION-AUDIT.md` classifies every deleted-copy delta;
no current declared local behavior is missing. Optional timing data is present
in the package payload, so production bundle reachability remains a build check.

Both CI build paths now verify actual installed sources and static license
assets before building. Metadata-only `pin:packages:check` is explicitly not a
byte-identity verdict. Exact MIT and MPL-2.0 license files and pinned public
source links are preserved in the application static assets. The inaccurate
claim that circuit UI is MIT has been corrected in app notices and tests.

The first full integrated run was **diagnostic**, spanning repairs: 3164 tests,
3066 passed, 47 failed, 51 skipped. Its failures include removed copied-source
paths and clean-checkout assumptions; it is not a release verdict. Test repairs
retain explicit package authority, lazy-import contracts and failure mutations.
Full tests/build/browser verification after repairs remain required.

Subsequent local receipts (Node 22.23.2):

- Repaired package-path suite: 537/537, zero skips.
- Source suite: 175/175, zero skips.
- Production browser: 23/23 scenarios before the later served-license checks;
  actual DOS assembly, keyboard/8255 effects, settings persistence, Wired
  refusal and Auto reconstruction passed. No hosted compiler request or
  uncaught page error. This is DOS-services acceptance, not a full BIOS DOS boot.
- Full repaired diagnostic: 3262 tests, 3231 passed, one setup failure,
  30 skipped. The failing history-completeness assertion had only BW_BOARD_DIR;
  supplying all three histories passed the 10-test history suite without code
  changes. A fully configured final rerun is still required.
- Native broker source-isolation browser gate: 1/1 lifecycle and 4/4 blocked
  remote/script/nested-worker/loopback attempts. This gate reads source assets;
  it does not certify emitted proof bytes.

The production module-graph audit traversed 5846 module records (4356 unique
identifiers), with 188 engine and 411 UI identifiers as positive controls.
Neither `i8088-cycles.js` nor `i8088-timing.js` appeared. The policy, 8086 core,
designer and labwired loader were in noninitial chunks. This receipt belongs
to webpack hash `687f5bd2935f7432131d`, before the emitted-proof repair below.

That audit also caught a real emitted-asset defect: Terser changed the
content-addressed native proof source from its reviewed 1421 bytes to 829 bytes,
leaving the manifest digest stale. The targeted copy metadata now preserves
only those content-addressed proof sources. Both CI builds verify the emitted
manifest, aliases, filename, length and exact source bytes. License verification
also has a postbuild mode, and the browser checks actual served files under
`static/licenses/`. These output checks complement, not replace, source checks.
Rebuilt-output acceptance passed: the emitted proof is exactly 1421 bytes with
SHA-256 `109b38c1740624623b31e0782f4e8b09769674dd7302851ef3858bc7c3fd2484`;
all nine source/mirror/emitted notice files match. The final production browser
run passed 26/26 scenarios, including the three served notice/source files.

## Review branch and first CI cycle

Draft PR: https://github.com/CrispStrobe/brickwright/pull/110 . Original
worktree preservation was rechecked: its tracked diff still has the initial
SHA-256 recorded above. No default-branch merge or deployment has been performed.

First candidate `bdbb669fa`:

- Build run `34689291365`: main unit suite 3262 tests, 3254 passed, zero failed,
  eight explicit skips. The production build succeeded with two size warnings.
- Both light and heavy browser jobs succeeded, including 8086 desktop/mobile
  benchmarks, labwired execution and the offline AVR lesson.
- Debugger run `34689291384`: both jobs succeeded. Vendor freshness and Rust
  notices also succeeded.
- The build job as a whole failed because the fetch-pinning mutation prover
  still targeted a deleted sync script. The corpus job lacked a root package
  install. Neither failure is omitted from the qualification result.

The corpus job now installs root packages before solver walks (14 focused
workflow checks passed). The mutation prover targets the surviving equivalent
sb3 sync; its **actual isolated run** caught 11/11 mutations, restored seven
files byte-for-byte and passed the restored control. Follow-up CI must qualify
these changes; the PR remains draft pending that result.

The local full run with all histories reported 3278 tests, 3247 passed, 30
skipped and one audit false positive from a source search needle. That needle
was explicitly classified without changing the audit baseline, and the audit
rerun passed 11/11. The immutable first CI candidate subsequently passed its
complete fast suite as recorded above; these are separate receipts, not a
claim that a failed local summary was green.

The forward helper now installs and verifies both package locations, regenerates
notices/reports only after source verification, checks emitted assets and stages
only declared outputs with checked mirrors. Its tests include the real read-only
BIOS default-check CLI. Unsupported BIOS byte changes require manual review;
unknown flags and conflicting explicit pins refuse. No live forward was run.

Circuit-UI diagnostic-only commit `13a7563` preserves the original drag threshold
and the 34-scenario default. Three local runs moved the resistor; the final
targeted run preserved the original await sequence. The CI zero-motion failure
was not reproduced, so no speculative production fix is claimed.

## Advancing a package pin

Follow-up CI at `7748746f7` passed 3255 unit tests (8 skips), corpus,
debugger and production compilation, but exposed a stale boot-payload assertion:
the package build splits the 6502 extractor into anonymous lazy chunk `8933`
in the named `bw-board` group. The guard now permits shared lazy JS for this
marker while retaining the named entry, positive emitted-byte control, eager
exclusion and preload prohibition (including the actual shared asset names).
Fixture mutations reject missing/map-only markers, eager/script-loaded bytes,
shared preloads and a missing named loader. The real local production output
passes, with 1079 KiB gzipped eager scripts against the unchanged 1300 KiB limit.
This is a guard-layout correction, not a new runtime optimization; final CI
qualification remains required.

After an explicit reviewed pin advance and dependency installation, run installed
source verification against the exact upstream commits before generating notices:
`npm run gen:package-notices`. Commit the generated overlay and GUI license/source
mirrors with the pin. `npm run verify:package-notices` rejects stale bytes or source
links. `integrate.mjs` copies these assets but does not bless unverified installed
bytes or regenerate notices automatically. Regenerate the engine census and ROM
provenance alongside engine pin changes. Final release gates must run on the
resulting immutable candidate, not on a mixture of revisions.
