# Bounded CI cost reporting for long browser jobs

Owner: Codex SAMD continuation. Status: DONE; claim merged in PR #1332 before implementation.
Base: `835e96acb9557df07f8e7eb0797b895bded9592a`.

The completed CI-cost run 40061586196 fails because browser(robotlink) exceeds
its legacy reporter's200-step-per-job bound. Preserve that failed original and
leave `scripts/report-ci-run-metrics.mjs`, its bounds and behavior unchanged.

Own new `scripts/lib/ci-run-metrics-windowed.mjs`,
`scripts/report-ci-run-metrics-windowed.mjs`,
`test/ci-run-metrics-windowed.test.mjs`,
`docs/CI-COST-WINDOWED-REPORT.md`, `.github/workflows/ci-metrics.yml` and this
claim only. Other CI classifiers, qualification census, workflows and owners
retain their boundaries.

Introduce a separately named report/profile that traverses every actual step
through windows of at most 200. Keep input8MiB and1000jobs ceilings; constrain
the new profile to at most 1,000nonempty windows/200000total steps, no more than
the legacy profile's global worst case. Never truncate/filter steps, discard
failed/cancelled jobs, invent absent times or treat pagination as complete.
Keep runner cost per real job, not per window; first-debugger verdict ranges
over the complete original union. Admit exact input digests/counts and preserve
first errors. The legacy over200 refusal remains a required negative control.

Require actual legacy-CLI parity for admitted small inputs, multiwindow early/
late debugger and timestamp/job-cost controls, and refusal of incomplete input,
extra counts/windows, oversize/overflow and malformed metadata. Only after these
pass switch the reporting command to the new explicit profile. Keep all input
bounds and product/guest performance gates unchanged; one normal final-head source qualification uses the required `ci:full` label.
No actual-campaign label/dispatch, guest/model or pin change is in scope. Validate
all enabled exact-head source checks before normal matched-head merge.

Implementation uses the separately named schema 2/windowed profile. Legacy source
and limits remain byte-identical. Focused actual-CLI parity and refusal controls,
third-window verdict/cost controls, and retained real 29-job/4,151-step metadata
exercise the repair without a build/guest rerun. See
[the report contract](../docs/CI-COST-WINDOWED-REPORT.md).

Qualified implementation landed in [PR1333](https://github.com/CrispStrobe/brickwright/pull/1333)
with 29 enabled checks successful and six source-declared conditional skips.
The separate postmerge operational report also passed for 14 jobs/288 steps/nine
windows; see the [qualified results](../docs/CI-COST-WINDOWED-REPORT.md#qualified-source-and-postmerge-operation--2026-10-24).
No CI-cost implementation or operational follow-up remains in this claim.
