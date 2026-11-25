# Arcade bounded assessment stdout transport

Owner: Codex, Arcade assessment lane.
Branch: `lane/arcade-assessment-stdio-claim-20261021`.
Base: `c99c397f6ae0a3162f7fda9a0c4827d186585429`.
Claim merged in [PR1177](https://github.com/CrispStrobe/brickwright/pull/1177).
Implementation branch: `lane/arcade-assessment-stdio-source-20261021`.
Status: source implementation complete; actual CLI and final hosted
qualification pending before landing.

Add an explicit optional stdout transcript to the actual conversion audit CLI,
preserving its default file outputs, catalogue, full diagnostics, progress,
journey, conversion options and exit policy. Compose against the current audit
candidate rather than replacing the public CLI with an older interface.

Own `scripts/compat-audit.mjs`, the narrowly factored byte sink in
`scripts/lib/conversion-progress.mjs`, new `scripts/lib/audit-stdio-transport.mjs`,
independent `scripts/private-assessment/read-stdio-transcript.mjs`, complete
`test/conversion-audit-stdio.test.mjs` and `test/private-assessment-stdio.test.mjs`,
affected existing CLI/progress controls and
`docs/ARCADE-PRIVATE-ASSESSMENT-STDIO.md`. No workflow, resource-limit, dependency,
pin, credential, namespace or storage-controller change. This is prerequisite
transport work, not a live private assessment or isolation claim.

Use a strict finite binary frame protocol carrying exact original JSONL,
gzip JSON report and Markdown bytes, with terminal lengths/hashes and intended
exit status. Maximum complete transcript eight MiB including every header and
terminal; reserve terminal space before payload writes. No truncation/sampling,
extra stdout, arbitrary output FD option, synthetic progress or console patch.
Route only the CLI summary to stderr in this opt-in mode. Reject conflicts with
file-output options; keep existing exclusive fresh-path file contracts.

The independent bounded reader imports no producer or CLI module. Preserve
payload bytes, strict sequence/order/UTF8/gzip/trailing-byte checks and unchanged
report admission. Real child exit remains external authority. Qualify complete
new writer/parser and actual synthetic CLI tests, default-path regressions and
existing report admission. Preserve failure evidence and local resource caps;
no filtered modules or corpus promotion. Actual read-only process isolation,
normal provider provenance, hosted bounds and complete private corpus remain
separate gates before use. No full-CI label or live dispatch for this claim.

## Source qualification

The complete three-module writer, existing journal and independent decoder
cohort passes 23 controls with no skips or TODOs. Independent saved-output
review verified the entire selection and actual source, interpreter, dependency
and scope identities. The original writer review finding and its correction
are retained. Default filename journal controls are unchanged.

A distinct seven-invocation static CLI cohort also passes, including both
output modes, complete mixed-catalogue graphs, actual parse-failure exit and
all three output conflicts. Independent saved-output review checks the full
retained payloads and actual source/dependency/exit identities. This does not
replace the complete affected public CLI module with real SB3/VM prerequisites.
That module, report admission, VM/original-SDK regressions and hosted checks
remain pending. The optional
transport has not yet qualified real read-only process isolation, hosted
resource bounds or a complete private corpus assessment. Historical corpus
counts remain unchanged.
