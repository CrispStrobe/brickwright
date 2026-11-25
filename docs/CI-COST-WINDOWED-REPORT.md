# Bounded windowed CI metrics

`report-ci-run-metrics-windowed.mjs` uses the explicit
`bounded-step-windows-v1` profile and emits schema 2. It traverses every step in
every admitted job through nonempty windows of at most 200 steps. It never
truncates a long job or drops failed/cancelled jobs. Runner cost is measured once
per real job; windows do not create additional billable jobs.

Both input files retain the 8 MiB limit and the union retains the 1,000-job limit.
The new profile admits at most 1,000 nonempty windows and 200,000 total steps, the
legacy profile's maximum global step count. The byte ceiling may refuse inputs
before those count ceilings. Missing/malformed totals, pagination, duplicate job
IDs, missing step arrays, malformed timestamps and overflow refuse the entire
report. There is no partial report or repeated API request.

The report binds SHA-256 digests of both exact raw input files, job/step/window
counts, and each window's job ID, offset and count. Windows cover the complete
original ordered step union. Missing timestamp witnesses remain unmeasured,
with zero contribution and explicit `coverage.unmeasuredJobIds`. GitHub sometimes
records completion before start, including for skipped/cancelled jobs. Preserve
the legacy zero clamp and record those jobs in `coverage.clampedNegativeJobIds`.
No absent start/end time is invented.

Existing runner seconds, per-job billing rounding, verdict regex, terminal
conclusions, first-verdict ordering and latency clamping retain legacy semantics.
“Debugger verdict” remains that existing name-based heuristic; matching a setup
step does not prove that a debugger test passed. This reporting change changes
no product, guest, performance or qualification gate.

The legacy `scripts/report-ci-run-metrics.mjs` remains unchanged, including its
200-step-per-job refusal. Tests execute the actual legacy CLI to prove parity
for its admitted inputs and preserve that long-job refusal. Separate tests place
the earliest debugger verdict in a third window, retain failed/cancelled jobs,
check that cost is counted once, and exercise complete-input and bound refusals.

The original recurring failure was CI-cost run 40061586196 measuring completed
Build 40048175395: browser(robotlink) exceeded the legacy per-job step bound.
The retained completed metadata contains 29 jobs and 4,151 steps, covered by 42
windows. The new reporter admits all of them without a build or guest replay.
Only the workflow's reporter command switches; its single completed-run jobs API
request remains unchanged and still refuses a paginated response.

## Qualified source and postmerge operation — 2026-10-24

[PR1333](https://github.com/CrispStrobe/brickwright/pull/1333) merged after
all 29 enabled exact-head checks passed, with six source-declared conditional
skips. Eleven focused actual-CLI/limit/coverage tests pass. An independent audit
of the retained 29-job/4,151-step failure input reproduces complete coverage
through 42 windows without a build or guest replay. The legacy reporter and its
200-step refusal remain unchanged.

A new postmerge [operational run40091607422](https://github.com/CrispStrobe/brickwright/actions/runs/40091607422)
successfully reported completed Build40085834852: 14 jobs, 288 steps and nine
nonempty windows. Its actual checkout's reporter/workflow blobs equal the
qualified source; the retained official artifact's digest, schema/profile,
counts and cost sums pass independent audit. The report emits input hashes;
this operational check does not claim to reconstruct the exact raw event input
from later API responses. Source and operational follow-up are complete.
