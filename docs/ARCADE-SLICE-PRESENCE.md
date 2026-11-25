# Bounded slice results and nested Array presence

Source candidate under the claim merged in [#1148](https://github.com/CrispStrobe/brickwright/pull/1148).
The complete `test/makecode-array-reference-export-authority.test.mjs` passes
50 tests with zero skips or TODOs. Its original 45 test bodies are unchanged.
This is pure importer, Creator, exporter and exported-file reimport evidence.
It does not establish runtime, browser, fresh-SB3 or corpus completion.

## Implemented proof

A slice now derives a conservative minimum result length from its source at the
actual slice operation. Only finite integer numeric shadows and the exact
source-generated `0 + shadow` wrapper qualify as bounds. Start must be
nonnegative; end may have either sign. In that domain, result length is monotone
in source length, so a proven lower source length gives a lower result length.
The reader is local to slices and grants no general Number or Array type.

Source and copy aliases, complete element unions, initialization, all writers,
result shrink ordering and recursive-length guards remain in force. Later
source pushes cannot establish earlier slice contents. Negative-start windows,
unknown or fractional bounds, mixed element unions and incompatible writers
remain conservative refusals. No positional type inference is added.

## Remaining acceptance

1. Run genuine native and original-PXT slice controls for values, shallow alias
   identity, source/result shrink ordering and errors, using unchanged runtimes.
2. Save and reopen a genuine SB3, then export and reimport it. Verify values,
   aliases and the actual slice block inputs; clean partial exports are not credit.
3. Edit bounds in Blocks and Code. Empty, unknown or fractional windows must
   invalidate presence, and returning to a proved window must use the edited
   graph. Save/reopen the edited project in the browser.
4. Require every enabled final-head hosted check before merging. Preserve
   original failures, resource limits and all refusal assertions.

The historical 36-partial count is unchanged. A full ordered corpus run, with
per-project parsing, runtime, roundtrip and visible-authoring results, remains
necessary before reporting a new completion count.
