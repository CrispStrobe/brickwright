# Complete private-input Arcade assessment

## Manual entry registration and first hosted qualification

GitHub requires a manual workflow to exist on the default branch before it can
be dispatched; a subsequent `--ref` selects the candidate branch.
[GitHub's manual-run documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow?tool=cli)
describes this requirement and the CLI branch selector.

The default-branch `arcade-private-assessment.yml` is an inert registration entry.
It has no checkout, credentials, controller, private inputs, privileged setup or
artifact upload. Its registration job does not establish any isolation,
conversion, runtime or corpus result. The kernel implementation remains on its
separate candidate until independently qualified.

Use a source-reviewed candidate ref for the first public metadata probe:

```sh
gh workflow run arcade-private-assessment.yml --ref REVIEWED_CANDIDATE_BRANCH -f mode=metadata-probe
```

Admit the actual run's workflow/source SHA, runner image and public tool metadata
before updating the candidate's tool policy. Unknown identities must fail before
privileged setup. Then qualify the entire fixed nine-control synthetic cohort
on that reviewed candidate. Preserve original failures and all output/resource
and cleanup checks; no private inputs or live assessment are enabled by this
registration. Normal exact-head checks and matched-head landing still apply.

Status: the claim and inert registration are merged in
[PR1167](https://github.com/CrispStrobe/brickwright/pull/1167) and
[PR1186](https://github.com/CrispStrobe/brickwright/pull/1186).
The first metadata-only dispatch returned failure before a run could be
admitted; its error text was not retained, so its cause is unestablished.
A separate reviewed candidate fixes an invalid job environment reference by
binding the temporary directory in step environments, where GitHub permits
`runner.temp`. See [GitHub context availability](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability).
That source correction is not a successful dispatch or isolation result.
Controller qualification remains in progress: the public tool policy has no
admitted runner/tool profile and the fixed nine-control kernel cohort remains
unqualified. No private input, credential setup or complete-corpus result is
enabled. Preserve the failed dispatch and the one-shot operation boundary;
a source update alone does not authorize repeating a consumed event.

Honor actual configured environment policies; this proposal introduces no mandatory human reviewer or confirmation gate. Scope a manual, reviewed Actions workflow and bounded input-admission, isolated-converter and ciphertext-only upload controllers. Use a repository-specific read-only deploy key, remove credential access before conversion, and admit every original raw and contextual subject without filtering. Use the already selected private input repository; a separate minimal input repository is an optional alternative, not a prerequisite.

Run the existing `scripts/compat-audit.mjs` operation with its normal integrated dependencies. Independently verify the pinned input manifest: the CLI corpus-commit field is currently declarative. Retain all diagnostics, original compiler outcomes and incomplete stages. Additional journey, compiler or runtime gates remain separate assessments.

The hosted aggregate resource envelope needs a concrete reviewed source contract and qualification; this proposal neither changes the local execution limits nor establishes that the full assessment fits. Keep finite per-file and aggregate output limits without truncating reports.

Encrypt complete outputs to an approved public recipient before uploading ordinary Actions artifacts. Keep the private decryption identity outside Actions. Public logs and artifacts must contain no raw application inputs, diagnostics or input-repository identifiers. Independently admit the official ciphertext and read the decrypted report privately without executing producer code.

Acceptance requires real credential-free isolation controls, ciphertext-only inventory, complete ordered subject coverage, stable source/dependency guards and a separately admitted single execution. Historical partial counts remain historical until a complete current report is independently accepted. This does not qualify full-game behavior, browser rendering or original-SDK equivalence.

Proposed owned paths: a new dated claim in `lanes/`; a manual workflow; controllers under `scripts/private-assessment/`; complete policy/controller tests; and `docs/ARCADE-PRIVATE-ASSESSMENT.md`. No converter semantics, dependency pins or existing thresholds change in this work package.

## Registration census and qualification

The registration entry has a generated declaration with zero observed runs.
The existing census APIs preserve all 23 older workflow records, 320 ordered
runs and main provenance. Its dated pointer explicitly records the unobserved
state. The complete unchanged census module passes six tests without skips;
this is source qualification, not evidence that the workflow ran.

The final registration head still needs its enabled hosted checks before
landing. After default-branch registration, admit fresh official workflow
metadata before the separate reviewed metadata probe. Neither registration nor
a successful source test authorizes private inputs or the live assessment.

## Implementation and remaining work

The original catalogue contains 225 observations of 184 applications: 184 RAW_BASELINE rows and 41 RETAINED_CONTEXT revisits. All 41 revisits intentionally share baseline IDs. Admission uses `(kind, ID)` identity and never renames or drops them. The report reader returns separate baseline and retained-context tallies; the historical 36 partials belong to the baseline tally.

The independently reviewable components are [pinned Git input admission](ARCADE-PRIVATE-ASSESSMENT-INPUT.md), [output encryption](ARCADE-PRIVATE-ASSESSMENT-ENVELOPE.md) [the independent receiver](ARCADE-PRIVATE-ASSESSMENT-RECEIVER.md) and [independent report DATA admission](ARCADE-PRIVATE-ASSESSMENT-REPORT.md). Their source and synthetic controls are separate from hosted isolation or a live corpus run. Never publish their private return values or raw failures.

The complete encryption/independent-receiver modules pass all 13 controls. The complete actual synthetic-Git admission module, including the original 225-subject catalogue mode, passes all eight. The complete independent report/journal DATA reader passes all seven. These 28 current component controls have no failures, skips or TODOs; earlier predecessor results are not added again. Independent source review preceded execution. Original source-review holds are retained: IV acquisition now sits inside the key-cleanup region, and filesystem reads allocate only the admitted initial size before checking EOF and final identity. The exact original catalogue and every referenced blob have also passed pinned Git-object and staged-byte admission, followed by an independent DATA reader. The first real admission exposed the incorrect globally unique-ID assumption; its failure is retained and the corrected composite identity is covered by both complete modules. These are input/component results; no hosted isolation or corpus conversion is implied.

Complete these steps in order:

1. Preserve the recorded complete component qualifications, including negative identities, original byte retention, authenticated tampering and bounds. Repeat only changed sources or a concrete remaining risk. Record original failures rather than replacing their evidence.
2. Freeze the exact original ordered 225-subject catalogue (184 RAW_BASELINE, then 41 RETAINED_CONTEXT) and every referenced blob into an admitted Git manifest. Preserve its existing catalogue-only invocation and all baseline lineage metadata. A separately hashed 41-subject view and 184 positional files are an optional distinct mode; passing both those positional inputs and the full original 225-subject catalogue would double count. Pin every retained source, configuration, asset and original outcome by bytes, hash and Git object identity. The known frozen invocation selects Arcade for every subject; a mixed target catalogue must fail the current CLI's target rule explicitly.
3. Implement the hosted controller with a trusted controller revision separate from the immutable converter candidate revision. Admit the normal dependency roles and actual source identity; an absent Git identity or declarative corpus-commit field cannot stand in for verified provenance.
4. Prove real credential removal, disabled network access, nonroot execution, read-only admitted inputs/source, descendant CPU accounting, finite writable storage and bounded termination. Preserve the original outputs and incomplete termination status. A Docker command-line policy test alone does not prove isolation.
5. Connect the manual workflow and scoped read-only input credential. Keep the recipient identity outside Actions. Run complete synthetic isolation and encrypted-artifact controls before reserving the single live assessment. Honor configured environment policies.
6. Admit the official run and ciphertext once, verify the receiver independently, and read every ordered report result privately. Reconcile completeness, original failures and diagnostics before replacing the historical count. Then prioritize remaining gaps by shared missing capability and qualify execution/export/reimport and GUI authoring separately.

The proposed hosted converter envelope is 600 cumulative descendant CPU seconds, TERM at 900 wall seconds, KILL at 903 and terminal refusal at 905, with a 512 MiB Node heap, 16 GiB address space, 8 MiB per output leaf and 64 MiB aggregate owned output. These are an unqualified hosted proposal until the actual controller and complete controls establish them; they are not a measured fit or a change to local bounds. Credential collection, setup, sealing and receiver admission need their own finite bounds. Never reinterpret a resource failure as a complete census or split a failed full census into passing prefixes.

The [Linux child-tree supervisor](ARCADE-PRIVATE-ASSESSMENT-SUPERVISOR.md)
separately passes its complete seven groups using actual finite subprocesses,
with saved-data review of all 12 launched operations. It does not provide
namespace or credential isolation. Persistent bounded sandbox storage, actual
isolation controls, normal provider admission and the manual workflow remain
pending before the complete assessment.

## Registration landed; first metadata attempt — 2026-10-22

[PR1186](https://github.com/CrispStrobe/brickwright/pull/1186) is merged.
All 29 enabled checks on the reviewed head succeeded; six conditional jobs were
skipped. The actual merge tree and parents matched the reviewed composition,
and the registered manual workflow is active. This qualifies registration only.

The separately reviewed metadata-only candidate was published normally. Its one
dispatch command failed, and the subsequent run list contained no dispatched
run. The command wrapper did not retain the original error text; the cause is
unestablished. Preserve that evidence limitation. No retry, runner profile,
kernel-control result, private input or complete assessment is admitted by this
attempt. Recover the dispatch diagnostic under an explicitly scoped next
operation before authorizing further hosted qualification; do not guess tool
identities or silently repeat the event.
