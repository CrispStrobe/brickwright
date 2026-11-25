# Repair moved lane references

Owner: Codex SAMD integration. Status: DONE in this implementation commit.
Base: `9d037ce742`.

Own this claim and only the three moved `LANES.md#...` link targets in
`docs/X86-NEXT-LANES.md` and `docs/SPIKE-STATUS-AND-LANES.md`. Repoint each to
its exact migrated claim using `lanes/MIGRATION-2026-10-20.tsv`. Check the
reported companion links in `docs/I80386-GUI.md` and
`docs/spike-micropython-gui.md`; leave already valid targets unchanged.

Preserve historical statuses, evidence, acceptance limits and active owners'
source/additive documentation scopes. No runtime, pin, workflow or qualification
change. The separate integration handoff closeout owner retains
`docs/INTEGRATION-NEXT-STEPS.md`.

Validate all changed local targets and headings, migration identity, prose
privacy, whitespace and enabled exact-head documentation checks. No repeated
ARM/native/guest build is required. Keep private operational context ignored.

## Completion and validation

Claim [PR1304](https://github.com/CrispStrobe/brickwright/pull/1304) merged
before implementation. All three guide targets now name the exact migrated
claim files. The two companion guide anchors already resolve and stay unchanged.
Historical statuses, qualification limits and other owners' sections remain.

Six existing lane-claim controls, exact migration/target and companion-heading
checks, documentation-only classification, private-path scan and whitespace
pass. Final exact-head documentation checks remain the merge gate; no runtime,
pin, workflow or repeated guest qualification change.
