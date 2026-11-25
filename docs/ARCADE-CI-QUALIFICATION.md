# Arcade CI qualification and unit shards

## Why the workload is split

[PR845 build](https://github.com/CrispStrobe/brickwright/actions/runs/38306464578/job/115001603045)
passed7037 units in20m42s. Setup, source checks and later guards consumed most
of the remaining30-minute job budget. Webpack started at21:40:11UTC and the
job was cancelled at21:42:48UTC. Unit success did not establish distribution
success. Retain that failure; do not report the job as a passed build.

## Required jobs and unchanged boundaries

The build job keeps integrated preparation, source and provenance guards,
mutation proofs, webpack, emitted-distribution checks and the sole Pages
artifact upload. Six required unit matrix legs prepare the same integrated
inputs and partition the complete non-corpus suite. Corpus and browser/FPGA
jobs retain their own acceptance contracts. Deploy requires all those jobs.
The external main-publication audit also requires all six named unit legs.
No timeout, test assertion, skip-pointer rule or distribution guard is relaxed.

`test/unit-shards.test.mjs` checks preparation equality between build and unit,
so a later preparation edit must be carried to both jobs. This intentional
setup duplication avoids exchanging a mutable dependency/build tree between
jobs. Unit artifacts contain TAP, per-file census and GUI-resolution records;
unit jobs cannot produce the Pages artifact. Matrix fail-fast is disabled so
one failure preserves the other legs’ results.

## Selection and reproduction

`scripts/list-tests.mjs` remains the source of test membership. Corpus retains
its two existing files. Fast shards select each remaining filename by the
first32 bits of its SHA256 modulo shard count. New files automatically join
exactly one shard. Index/count is one-based, validated and bounded; unsupported,
invalid or empty selections fail explicitly. Full local commands remain full.

```sh
for leg in 1 2 3 4 5 6; do
  node scripts/list-tests.mjs fast --shard "$leg/6"
done
BW_TEST_SHARD=1/4 npm run test:fast:shard
npm run test:fast
```

Each CI leg checks its actual selected files, not the complete fast list:

```sh
node scripts/check-test-run.mjs --set fast --shard 1/4 --tap /tmp/unit.tap --census test-results/fast.census.json --max-stdout-bytes 0
node scripts/check-gui-scope.mjs --log test-results/fast.gui-scope.tsv
```

The auditor still rejects vanished/empty/unexpected files, missing summaries,
uncounted failures, raw stdout transport writers and undocumented skips. Tests
exercise missing-file, wrong-shard, failure and skip adversaries against the
actual auditor. `gen-ci-skips.mjs` reads all four current unit names and both historical unit names and historical
build/corpus jobs; existing generated historical evidence is not rewritten.

## Qualification still required

Source controls establish partition and gate behavior, not observed hosted
runtime or throughput. Obtain every enabled exact-head check, all four complete
unit censuses, completed emitted-build guards and the visible editor journey
before acceptance. Preserve named failures and compare measured durations.
No whole-app MakeCode compatibility promotion follows from sharding CI.

## First hosted split and audit correction — 2026-10-13

[First split run](https://github.com/CrispStrobe/brickwright/actions/runs/38314745493)
completed build in6m57s and unit legs in16m24s/16m57s. Heavy browser and FPGA
passed. Unit1 passed; unit2 reported two source-audit failures. The full candidate
was not qualified. These observations establish reached job durations, not a
repeatable performance ratio or completed editor acceptance.

The checkout census assumed one dynamically pinned flasher checkout; the new
unit and retained build each legitimately require one. Both job bodies now
independently prove the full-SHA validator precedes their checkout. Extra moving
or unknown refs still fail. Build's separate literal-pinned compiler checkout
remains distinct and must retain its own full pin.

The old step-outcome audit flattened all IDs across a workflow. A build step
with the same ID overwrote the earlier unit step and produced false forward
references. `scripts/lib/workflow-step-refs.mjs` resolves declarations and
conditions per job. Controls reject sibling-only IDs, later local declarations,
duplicate local IDs, same-step outcomes and multiline missing references;
identical IDs in separate jobs are valid. Every workflow is still checked.

The light browser reached actual Buffer field edits, all three controller
cycles, Code reconstruction and saved-project replacement/reopen, then timed
out waiting for an export download. Its export action was inside a collapsed
Code actions menu. The script now opens that menu and handles action/event
promises together so failure observation and screenshot recording can complete.
The original artifact contains SB3 and a reached screenshot but no failure JSON;
preserve that absence. Fresh full GUI export/original-runtime proof is required.


## Four required legs after a later unit cancellation — 2026-10-15

The earlier two-leg qualification does not establish that the growing suite
still fits its unchanged job budget. A later required unit job started at
09:00:48 UTC, began its unit step at 09:06:50, and was canceled at 09:31:03.
Its census is incomplete and must not be reported as a passing full suite.

The four-way filename partition retains the complete fast set and the same
30-minute job bounds, integrated preparation, per-file census, skip and GUI
resolution audits. Modulo four exactly refines the previous modulo-two split:
old leg 1 is new legs 1 and 3; old leg 2 is new legs 2 and 4. Every file runs
once. Corpus and full local selection remain unchanged. Pages needs the matrix
job to succeed; external main admission requires all four exact current names.
Missing, failed, canceled, skipped or unfinished legs block admission even if
the two historical job names passed. The skip collector retains historical
names for evidence without treating them as current admission authority.

Focused partition and gate controls do not establish hosted completion or a
speedup. Fresh complete four-leg censuses and all other enabled checks remain
required before acceptance; no source compatibility count changes.

## Six required legs after unit (3/4) neared its budget — 2026-10-25

On main `unit (3/4)` took 26–29.5 minutes of its unchanged 30-minute bound
and was cancelled at the bound twice on one pull request. The partition is
now modulo six under the same bound, integrated preparation and per-file
census, skip and GUI-resolution audits. Modulo six refines both earlier
splits: old two-way leg k is new legs k, k+2, k+4, and the three-way leg k
is new legs k and k+3. (It does not refine modulo four.) Admission now
requires all six exact current names; the two- and four-way names stay in
the skip collector as historical evidence only. No test, assertion, skip or
timeout changed.

## Six legs balanced by measured time — 2026-10-25

The modulo-six split ran its legs' test steps in 8–17 minutes: one leg held
twice the measured test time of another. `scripts/list-tests.mjs` now assigns
files from `scripts/data/unit-test-timings.json` (per-file top-level test
seconds read from one hosted run's `unit-shard-*` TAP and census artifacts by
`scripts/gen-unit-test-timings.mjs`), longest first to the lightest leg, plus
a small per-file start-up constant. Files the table does not know fall back to
name hashing. The partition guarantees are unchanged: complete, disjoint,
equal to the fast set, CLI identical. The legs no longer refine the older
modulo splits. Regenerate the table when the legs drift apart.
