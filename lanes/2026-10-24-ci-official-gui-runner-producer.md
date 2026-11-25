# Same-workflow official GUI producer evidence — claim amendment

**SOURCE CANDIDATE; hosted qualification pending.** Claim merged in
[PR 1350](https://github.com/CrispStrobe/brickwright/pull/1350). Owner: Codex CI audit repair,
continuing the user-authorized narrow CI audit takeover in
[the browser evidence claim](2026-10-24-ci-browser-runner-step-outcomes.md).
Base: `97518e42cac77f146bbe79113a9e91dbaaec5342`. Public branch:
`lane/ci-official-gui-runner-producer-claim-20261024`. The isolated checkout
and retained original evidence are recorded privately. This amendment extends
only producer evidence admission; it does not transfer Arcade feature work.

## Observed boundary

[Build 40113882924](https://github.com/CrispStrobe/brickwright/actions/runs/40113882924)
at source `2ffb3bb8327053b939cf14bb243c4392253a17e5` retains a failed official
numeric GUI consumer. Its `needs: build` dependency has finished successfully,
but the official API still reports a required producer step as pending.
`admitGuiArtifactMetadata` correctly refuses `Build the editor` before the
sole frontend archive GET. This is an evidence-admission failure, not an
observed numeric application failure. Preserve the original refusal and all
existing API-only semantics; do not rerun the unchanged failed qualification.

## Exact additional envelope

After this amendment merges, own only these six paths for this repair:

- `.github/workflows/build.yml`: the `build` job's explicit scalar outputs,
  deterministic IDs for its currently unnamed manifest and upload steps, and
  the `arcade-numeric-authoring` consumer's explicit evidence input mapping
  and selection. Preserve the existing `build_editor` ID and every command,
  condition, dependency, timeout, permission, action pin and other job.
- `scripts/admit-official-gui-artifact.mjs`: an explicitly selected,
  same-workflow runner-evidence admission mode and bounded retained receipt.
- `scripts/lib/official-gui-artifact.mjs`: separate runner-evidence validation
  and only the narrow factoring required to share unchanged common official
  run, producer-job and artifact assertions with the legacy validator.
- New `test/official-gui-runner-producer.test.mjs`: complete workflow-output
  mapping, genuine admission/CLI flow and coherent boundary controls.
- `CI-POINTERS.md`: only a truthful official GUI producer evidence-mode pointer;
  retain all other rows and historical census observations.
- `lanes/2026-10-24-ci-official-gui-runner-producer.md` only.

The earlier eight-path browser claim remains separate and unchanged in scope.
Existing artifact and producer-completion test files remain byte-held. No
manifest writer, archive format, application, SDK, supplier/pin, classifier,
browser gate, native controller, guest or stored census definition is owned.

## Distinct evidence mode

Use the documented [steps context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#steps-context),
[job outputs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/pass-job-outputs)
and [needs context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#needs-context)
for this same-workflow dependency only. Export explicit scalar outcome and
conclusion pairs for exactly `Build the editor`, `Write GUI build source
manifest` and `Upload GUI Pages artifact`, with checked IDs, names and order.
Map explicit public run, attempt, source and logical job identity and require
the exact successful `needs.build.result`. Bind producer and consumer source
identity to their inspected workflow and actual checkout. Keep reviewed PR
head, run head and checkout SHA distinct where the existing contract does.

Never export `toJSON(steps)`, whole contexts, action outputs, tokens, secrets
or the environment. Missing, empty, extra, duplicate, malformed, contradictory
or unsuccessful critical-step evidence must refuse. A documented
`continue-on-error` outcome/conclusion difference cannot turn a failed
critical producer outcome into success. Do not infer a terminal state from
an empty output or rewrite pending API step records as completed.

Keep the default legacy API-only validator and its pending-step refusal.
Retain the existing 60-second producer-completion observation, identity
freezing, transport-error, completed-failure and timeout behavior. The new
route still requires a completed, successful official producer job and all
existing repository/run/attempt/head/source/job checks, exact sole artifact
census and ID, artifact lifetime, original byte count/digest, ZIP/TAR safety,
embedded source/tree/pins/SDK manifest and owned extraction checks. Only the
explicitly selected critical-step evidence source changes. Raw metadata
remains unchanged and retained beside the distinct evidence receipt.

Bound new scalar input to 16 KiB and at most 32 rows, and the complete sanitized
receipt to 32 KiB. Refuse oversize rather than truncate facts. Use the existing
consumer admission directory and failure retention; no new artifact family,
eager archive GET, second original fetch, retry or increased timeout is owned.

## Required proof and qualification

Exercise the actual workflow scalar expressions through producer context,
consumer inputs and the genuine admission/CLI path using mocked official
metadata and an authored archive. A completed official job with pending API
steps may pass only the explicitly selected, matching runner-evidence mode;
the unchanged legacy route must still refuse that same metadata. Require zero
archive GETs before every admission check passes. Retain complete positive
manifest/digest/ZIP validation and meaningful coherent negatives for source,
run, attempt, job, dependency result, ID/name/order, state, bounds, artifact
uniqueness, original digest and archive safety. Mutations removing source-map
or identity checks must be caught. Preserve every existing artifact and
completion test, including its closed 60-second boundary.

Prove all preceding workflow commands, conditions, timeouts, existing IDs and
unrelated source remain held. Workflow source definitions change only through
the scoped IDs, outputs and consumer mapping; stored census snapshots and
their recorded definitions remain historical and byte-held. Require all
enabled final-head checks with declared skips only. Local manufactured inputs
do not prove runner output availability or application qualification. Native
helpers stay inactive pending fresh source qualification and rebinding. This
claim selects no event, variable, label, archive GET, build or guest execution.


## Local source candidate

The new `--runner-producer-v1` route maps one explicit build-job scalar wire
through `needs.build.outputs.gui_producer_runner_v1` and checks the separately
mapped dependency result. Only the manifest/upload steps gain IDs. The wire
contains public run/attempt/job/source/workflow identity and exactly three
outcome/conclusion rows. Executing workflow identity is joined between producer
and consumer and recorded separately from the inspected checkout, without
claiming equality of their whole trees.

The receipt is retained in the existing admission directory. Pending or absent
REST critical-step observations are retained as such; a conflicting API failure
or duplicate observation refuses. The completed-successful official job,
artifact/source admission and sole original acquisition remain mandatory.
New genuine CLI tests use authored Git/archive fixtures and mocked HTTP edges;
no browser, application, native tool, guest, archive acquisition or API write
runs locally. All existing artifact and completion tests remain unchanged.
Fresh enabled exact-head CI and actual runner output availability remain
unqualified; source tests do not authorize native or GUI event selection.

## Combined source qualification

The browser and producer evidence repairs qualify together in a separate
implementation PR. Its initial documentation checkpoint carries the full-CI
label before executable source is published, so the final source head can
receive one qualification set without a concurrent opening-label transition.
Claim checks and this publication checkpoint establish no runner metadata,
artifact admission, numeric GUI or native guest result. Preserve the original
REST refusals; require the final source checks and affected consumers to pass.


The producer wire's logical job field is the source-bound literal `build`,
checked against the exact job key and `needs: build`. It is not a projected
runtime observation: `github.job` is available only within execution steps,
so job-output evaluation must not reference it. The consumer still checks its
actual `GITHUB_JOB`. Pure rendering controls deliberately omit `github.job`
from the output context and reject a source mutation that introduces it.
The earlier source candidate and review finding remain retained.
