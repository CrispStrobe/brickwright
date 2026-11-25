# Browser audit runner step outcomes — claim, 2026-10-24

**IMPLEMENTED SOURCE CANDIDATE; hosted qualification pending.** Owner: Codex CI audit repair,
explicitly authorized to take over this narrow CI boundary. Base:
`5cb3c30b12055e22ddbd027163d4e8285cfd28b0`. Public branch:
`lane/ci-browser-runner-step-outcomes-claim-20261024`. The isolated checkout
and detailed original audit are recorded privately. This takeover excludes
Arcade application/features and every other owner's product work.

[Build40113882924](https://github.com/CrispStrobe/brickwright/actions/runs/40113882924)
at source `2ffb3bb8327053b939cf14bb243c4392253a17e5` retains browser gate PASS
output followed by an unauditable step API snapshot. Completed job envelopes
still contain pending/missing step records after job completion. Unique read
keys and direct job reads already exist; preserve these original failures and
their unchanged legacy refusal. Do not infer a skipped or successful gate from
missing API evidence or replay unchanged failed qualification.

Own exactly these implementation paths after the claim merges:

- `.github/workflows/build.yml` only browser-job step IDs, explicit terminal
  scalar input mapping and selection of the new mode in its final audit step.
- `scripts/audit-job-steps.mjs` and `test/audit-job-steps.test.mjs` for a
  separately selected runner-evidence mode and complete pure controls.
- `scripts/lib/workflow-gates.mjs` only the narrow step-ID parsing and source
  mapping needed by that mode; preserve its existing shard partition behavior.
- `test/browser-gate-shards.test.mjs` only to add complete input/ID/name/order/
  shard mapping closure and meaningful mutations while retaining old tests.
- `test/browser-gate-timeouts.test.mjs` only to strengthen the unchanged
  always-last audit position, conditions and existing limits.
- `CI-POINTERS.md` only a truthful browser audit evidence-mode pointer; preserve
  every other row and every historical census observation.
- `lanes/2026-10-24-ci-browser-runner-step-outcomes.md` only.

No new job or step name is proposed. The workflow source definition changes
through the scoped IDs, scalar mapping and audit mode; stored census snapshots
and their recorded definitions remain historical and byte-held. The narrow
CI-POINTERS update records the evidence-mode change without inventing execution
observations. No classifier, shard reassignment, application, supplier/pin,
native/GUI actual controller or guest change is owned.

Keep the audit inline, exactly once, `if: always()` and last in the browser
job. Preserve every existing preceding command, condition, timeout, dependency,
action pin, permission and existing step ID. Add deterministic unique IDs only
where absent; the current source has 242 preceding steps, 22 existing IDs and 220
missing IDs, including unnamed setup/upload actions. Bind all preceding steps,
not just the gates assigned to the current shard.

Use the documented [GitHub steps context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#steps-context)
as the distinct input boundary. Map explicit scalar
`steps[<id>].outcome` and `steps[<id>].conclusion` references only. Never export
`toJSON(steps)`, outputs, secrets or the whole environment. Never substitute an
empty value with `skipped`, `success` or an inferred condition result. Missing
context must refuse, including if the runner cannot supply a skipped record.
Document the before/after `continue-on-error` distinction; this mode must not
convert an unsuccessful gate outcome into successful evidence.

A closed versioned scalar wire may carry exact ID/outcome/conclusion rows,
with checked workflow names and order derived from the source. Bound input to
64 KiB and 512 rows; retain at most 128 KiB of sanitized complete evidence in the
existing job log. Refuse oversize rather than truncate or silently omit facts.
Retain only the mapped fields, source/workflow fingerprint, run/attempt/job/
shard identity and verdict. No new artifact family or transport is owned.

Require an exact one-to-one map to the checked workflow's preceding IDs,
names and order, including companions and unnamed actions. Refuse missing,
empty, extra, duplicate, reordered, malformed or contradictory terminal states
and mismatched source/run/job/shard input. Permit only documented terminal
values. Preserve skipped-in-green, wrong-shard/double-run, unassigned-gate,
partition, real-earlier-failure and missing-record assertions. All old API,
`--file`, direct identity/cache handling and six 10-second polls and refusal behavior
remain held; the new mode never relabels incomplete API evidence as complete.

Before source publication, require full manufactured workflow-context-to-CLI
positive controls for every current shard and coherent negatives for each
boundary above. Exercise actual scalar expressions and source-derived IDs,
not a second hand-maintained gate list. Source mutants must fail when an
expression references another step, an ID/map row disappears or duplicates,
outputs/whole-context/default-state substitution appears, a terminal state
is contradictory, a shard gate runs elsewhere, or old absence assertions are
removed. Prove old functions/tests and all preceding workflow commands,
conditions, IDs and limits remain unchanged except the claimed mapping scope.

Source qualification remains all enabled exact-head checks with declared skips
only. Fresh hosted use must show the runner supplies complete mapped terminal
states; synthetic controls cannot establish that platform availability. Keep
all retained failures, native event guards and unrelated ownership boundaries.
This claim selects no native/GUI event, variable, label, original GET or guest.


## Implementation boundary

The claim merged at `f040ab0ee122fe1e72c34139fcfe77185e6ddc80`. The source
keeps the final inline audit and adds 220 absent IDs while preserving all 22
existing IDs and all 242 preceding commands, conditions and limits. The new
`--runner-terminals-v1` mode reads three explicit scalar parts for the current
100/100/42 rows, with the identity header in the first part. Each part is
checked against its exact source expressions before complete ordered assembly;
missing or extra parts refuse. Aggregate input remains 64 KiB and 512 rows.

The parts also respect the runner's [expression constants](https://github.com/actions/runner/blob/main/src/Sdk/DTExpressions2/Expressions2/ExpressionConstants.cs)
and [interpolated scalar construction](https://github.com/actions/runner/blob/main/src/Sdk/DTObjectTemplating/ObjectTemplating/TemplateReader.cs):
a single field over the current rows exceeds the format-parameter and expression
length bounds. Source controls check each compiled scalar stays within 255
parameters and 21,000 characters. No whole-context or output value is exported.

The auditor checks the workspace workflow against its current Git HEAD/blob,
records its UTF-8 hash and source mapping, and matches the runner header to the
current repository/run/attempt/job/shard and checkout SHA. The executing workflow
SHA is recorded separately; no moving PR preview is consulted. A complete
sanitized receipt is bounded at 128 KiB in the existing official job log.
Unknown input or Git diagnostics are never echoed into failure receipts.

The current browser body has no `continue-on-error` declaration. The documented
failure/success pair is valid for a continued failure, but is explicitly outside
this no-continuation profile, including on non-gate steps. Other differing pairs
refuse as contradictions. A future declared continuation needs reviewed support;
a failed gate is never recorded as successful evidence. Ordinary failed outcomes
and earlier-red handling keep the old judge semantics and cannot produce the
all-assigned-gates-succeeded flag.

Pure controls render the actual scalar expressions through the genuine CLI for
every current shard and exercise checked Git/source drift, full mapping, unsafe
expressions, missing/extra/duplicate states and parts, wrong run/job/shard,
continued failure, source/receipt caps and guard-deletion mutants. Legacy API
functions and their refusal tests remain held. Actual runner field availability
and every enabled final-head check still require fresh hosted qualification;
manufactured context is not a hosted browser, native or guest result.
