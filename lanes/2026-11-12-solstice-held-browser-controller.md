# Robot Lab — held Solstice browser diagnostic controller

Status: DONE — controller source candidate prepared; browser qualification and merge remain HELD.
Owner: Robot Lab held diagnostic lane.
Branch: `lane/solstice-held-browser-controller-20261112`.
Base: `ec14e24f2054bc8d077a077efc11a0458e5e6326`.

Scope: explicit held-only Solstice selection, contract and R4 causal-control routing, independent base/control failure retention, source/build observations (no producer admission) and focused nonvacuity controls in exactly:

- `scripts/lib/sim-lab-q5-held.mjs` (new)
- `scripts/lib/sim-lab-q5-browser-gate.mjs`
- `scripts/lib/sim-lab-intake-roundtrip.mjs` (held-only page-error retention and primary-error-preserving cleanup)
- `scripts/verify-sim-lab-browser.mjs`
- `test/robot-lab-held-solstice.test.mjs` (new)

This coordinates with the existing R4 start-guard lane and supersedes its browser-controller ownership only for this held diagnostic. Existing promoted cases and ordinary example-filter behavior stay unchanged. No model, program, pose, solver, judge implementation, threshold, capture implementation, promoted registry, dependency pin, workflow or concurrency block is owned here.

Solstice remains experimental. Preserve the original full-track browser refusal: beam 0.1158895856 degrees and piston 0.1717399387 mm exceed the unchanged 0.1 degree / 0.1 mm limits. No hidden startup exclusion or guest, promotion or physical-build claim.

Qualification: actual-source controller tests, distinct nonvacuous mutation controls, unchanged corrected-judge refusal of the retained failing track, and affected clean observation-only browser diagnostics on the approved external execution route. Source/fake tests alone qualify no guest. Do not add `ci:full` or dispatch full CI; use only already authorized automatic checks. Record remaining failures and limits before implementation landing.

Source validation: twenty selected dependency-free repository controls pass on Node 22, including held cleanup/reopen error retention and the two authored-origin regressions. Twenty-two isolated source mutants are detected. The corrected actual source judge still refuses the hash-bound retained browser track at the original 0.11589 degree / 0.17174 mm errors. These are source controls only.

Qualification limit: the complete twenty-four-case controller suite currently has eighteen passing controls and six module-load failures because its required jszip dependency is unavailable in this isolated checkout. The prescribed dependency helper refused a sparse-missing broker-proof input; its exact content-keyed store entry was absent, so no fresh install or borrowed dependency was used. Resolve dependency ownership, pass every focused source control, and run the affected clean external browser diagnostic before merge. No actual guest has run for this candidate, and no CI dispatch or full-CI label was added.

Review correction: matching a self-reported seven-character build stamp plus a byte inventory establishes no producer/source binding. Every held identity now explicitly reports observation-only and not admitted; this controller cannot qualify a source or promote Solstice. Any future qualifying claim requires a separately independently admitted exact producer/source/build receipt.

Raw tracks and original failures must remain private. Held CLI runs require explicit `--part=examples` and `--held-private-output` pointing outside the checkout to a runner-owned, nonsymlink mode-0700 directory; public Actions execution is refused. Generic private-runner CI flags are allowed. Summaries omit URLs, query strings, hostnames, VM block content, target names and raw track data. Existing raw error objects are preserved unchanged in the private evidence path. Held consumed model bytes come from the module root and must equal the exact committed git blob; the launcher working directory is irrelevant.

Containment review correction: a dot-prefixed descendant such as `..private` remains inside the checkout. Private-output admission now requires an actual parent path component boundary; the inside-descendant refusal, private-sibling acceptance and restored-unsafe-predicate mutation controls pass.

Roundtrip source review correction: only the actual held Q5 caller supplies the fixed reviewed `heldModelSource` reader to the generic capture helper. Ordinary callers retain their existing source reads. An actual imported capture-method control verifies both LDR and MPD buffers from a counterfeit alternate working directory; removing either the capture hook or held call-site hook is detected. This remains a source control with fake UI edges, not a guest result.
