# Robot Lab: restart and qualification handoff

Checkpoint: 2026-10-29. This is a continuation plan, not a declaration that the
open candidates have landed. Refresh `main`, each PR head, ownership, and the
complete current check inventory before acting. The source and test results
below are tied to the named revisions; an updated branch needs its own evidence.

## Existing integration dependency

[Lite PR #1536](https://github.com/CrispStrobe/brickwright/pull/1536) is
owned by the existing combined editor/Circuit delivery maintainer. At this
checkpoint its head is `2e7846f8a901726a296e3a8ef006cff24bc457b5`; it is open
and its current checks are queued. Its owner also reports an already dispatched
full run; inspect that run rather than dispatching a duplicate. See the
[delivery follow-up](DELIVERY-FOLLOWUP-2026-10-29.md). The Circuit campaign owner retains the
numerical study originals and their independent readers. The delivery owner
owns combined application qualification, source composition and landing. Do not
take over their paths or acquire their originals without coordination.

The current Robot Lab branches have encountered the same three unit-six
failures: three live-role references still use an older Board identity, and two
instrument-collector controls fail their existing expectations. Preserve the
historical study seals, source identities, assertions and original failures.
The owners must return a normally merged and qualified main commit and tree;
then compare that main with each candidate and its actual CI checkout before
composing. Do not treat a source-only repair or an old head's green job as the
combined acceptance.

The operator removed `ci:full` labels to reduce queue pressure. Keep those
labels off and do not dispatch duplicate broad runs. The existing integration
owner has claimed the fast-tier gate alignment in
[its lane](../lanes/2026-10-29-fast-ci-tier-admission.md). Until an appropriate
policy change lands, a failing `full CI requested` verdict remains a failing
check. Every enabled current-head check must succeed, only declared skips are
allowed, and affected actual guest/application evidence remains necessary.

## Open Robot Lab candidates

### Cross Ratio — PR #1537

[PR #1537](https://github.com/CrispStrobe/brickwright/pull/1537) is open at
`f5844d3bf5df6eb513b533a96e44fd983826fcec`. Its checkout identity supplier and
acknowledgment framing were corrected without raising a gate baseline; the
source-bound gate-policy checks passed. The current unit-six artifact reports
all 13 selected Cross Ratio tests passing, but that job failed the three shared
instrument checks. This is partial test-report evidence, not complete job,
checkout, browser, or guest acceptance. The legacy full-CI gate also failed.

Current main conflicts with the branch in `CI-POINTERS.md`: main updates the
SAMD source-game entry while this branch adds the Cross Ratio browser-gate
entry. When the shared repair is qualified, refresh both parents and resolve by
preserving the current main entry and the Cross Ratio entry once. Review the
complete resulting tree and all other owners' changes. Then qualify the actual
CI checkout and the affected native VM/Jolt and browser/save-reopen cases,
independently read the retained originals, pass every enabled check, and merge
normally with a matched head and verified parents/tree. Do not rerun successful
original cases merely to recover output; retain the earlier missing-raw-record
and mechanism-causation limits.

### Model-source line endings — PR #1549

[PR #1549](https://github.com/CrispStrobe/brickwright/pull/1549) is open at
`f6ebe4276bf46b79ef0614da6b8b2a2751d29aec`. It uses an LF matching view for
physical-part disconnection while preserving the original source bytes for
provenance. Tests cover LF, CRLF, mixed endings, exact IDs, duplicate/missing
IDs, and the real Sine Shuttle source, attribution and provenance consumer.
A lone CR is left unchanged; the candidate does not claim to reject every
malformed separator.

CPU runs passed the five source controls and the real-source consumer check.
The first consumer run failed because its test bundle omitted the parts catalog;
the corrected run exercised only that failed case. The current GitHub unit-six
job fails the three shared instrument checks. After qualified main composition,
run the affected clean physical Jolt disconnection and existing qualification
checks on the actual source, admit originals independently, require all enabled
checks and merge normally with matched-head and tree/parent verification.

### NXT IOMap — PR #1550

[PR #1550](https://github.com/CrispStrobe/brickwright/pull/1550) is open at
`959dd4a4ee314f2b911d140cb16d5e5581d376ef`. It implements a bounded
`Button.mod` projection for IOMap read/write syscalls: short/long/total release
counters, held bits, exact three-counter zeroing, signed errors and conservative
refusal of unmodeled slices. It preserves the separate direct-command behavior.
The compiled fixture, late unsupported-byte atomicity, direct-command shared
state, and independent restored-state controls have bounded CPU evidence;
10 pure and two selected virtual-brick/state tests passed. This does not qualify
the complete current GitHub run or real hardware.

The current unit-six job fails the same three shared instrument checks and the
legacy full-CI gate fails. Unit shards 1 and 2, which contain the IOMap test
files, completed successfully at the checkpoint; their originals and actual
checkout have not yet been independently admitted. After the shared repair,
compose against qualified main, bind each required checkout and fixture, retain
and independently review required originals once, complete the affected clean
virtual-brick qualification and all enabled checks, then merge normally with a
matched head and verified tree/parents.

### EV3 note conversion — branch, no PR yet

[EV3 candidate details](ROBOT-LAB-EV3-NOTE-CANDIDATE-2026-10-29.md).

`lane/ev3-note-to-frequency-20261029` is at
`b8d10ffcdcba72e83518a76d990f1deb24f88901`. The landed
[claim](../lanes/2026-10-29-ev3-note-frequency.md) owns the EV3 VM instruction,
focused tests and fixtures. The candidate implements `NOTE_TO_FREQ`: the
firmware's 36 uppercase natural/sharp note names in octaves 4–6 map to integer
frequencies, and other strings return 440 Hz. Fixed strings, compiled array
handles, invalid handles and snapshot continuation are covered. The owned
compiler produced each distinct fixture input once; do not compile an unchanged
successful input again.

A source-bound CPU run passed seven note tests, 26 VM regressions and three
selected virtual-brick cases. Its other ten brick tests were deliberately
filtered out; this is not a full browser, hardware or GitHub all-checks result.
An earlier CPU wrapper rejected intentional filter skips; retain that original
failure. After the integration repair is available, review main impact, open
one PR for the current branch, qualify the affected clean virtual brick and all
currently enabled checks, independently read required originals, and merge
normally with matched-head/tree/parent proof. Update the claim and VM docs from
candidate to landed only after that happens.

## Final handoff and safety

The three Robot PRs and EV3 branch are separate candidates; no open one is
qualified or merged at this checkpoint. Preserve current owners' source, pins,
workflow and artifact custody. Do not weaken tests, timing, scope selectors,
identity checks or thresholds. Each official original is acquired once after
metadata admission and then read from saved bytes without producer imports or
guest replay. Previously retained originals are reused.

Use hosted CI or an authorized CPU worker for heavy work. A passing bounded CPU
run does not replace required current-head GitHub checks or broaden the observed
boundary. No physical accuracy, device equivalence, release, deployment or
licence-clearance conclusion follows from these tests. After the last qualified
merge, update the public Robot Lab status and this handoff with exact landed
commits, tests and remaining limits. Keep private machine details and evidence
locations out of public files.
