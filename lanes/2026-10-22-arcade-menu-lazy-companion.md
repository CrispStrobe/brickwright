# Arcade menu table: prove its emitted lazy companion — IMPLEMENTED

Owner: Codex, Arcade integration repair. Isolated branch:
`lane/arcade-menu-lazy-companion-claim-v2-20261022`, based on `fd61f8c1ef`.
Merge this claim before implementation.

## Observed failure

The [official build failure](https://github.com/CrispStrobe/brickwright/actions/runs/39705808582/job/119587378144)
rejects the extension-menu positive marker in the named lazy entry. Independent
inspection of the admitted artifact finds the table exclusively in a shared
lazy companion that the actual menu loader requests before invoking its bound
normalizer module. The named entry exists; eager scripts contain no marker.
First load is 1173 KiB gzip, below the unchanged 1300 KiB limit. This is a
marker-location failure, not a size overrun.

## Owned paths

- `scripts/verify-boot-payload.mjs` and complete `test/boot-payload.test.mjs`.
- Optional new `scripts/lib/boot-lazy-companion.mjs` and complete
  `test/boot-lazy-companion.test.mjs` for a factored recognizer.
- `package.json` and `package-lock.json` only for a pinned Acorn build/test
  parser dependency. Use real JavaScript syntax and lexical bindings instead
  of treating comments, strings or regular expressions as executable loaders.
- `docs/ARCADE-CI-REPAIR-STATUS.md` and this claim.

Earlier boot campaigns are done. The ten newly merged school claims leave
these paths unclaimed. No bundler configuration, supplier pins,
runtime, menu table, SPIKE model or unrelated browser gates are in scope.
The parser is tooling only; retain its MIT notice and keep it out of app boot.

## Required proof and acceptance

Recognize the actual named menu entry and its same-runtime literal load and
module-binding chain. A companion must be a unique actual requested chunk
containing the table dependency used by the bound normalizer. Reject unrelated,
ambiguous, comment/string-only and mixed-runtime lookalikes. Never accept a
marker merely because it appears somewhere among all lazy scripts. Keep the
named-entry, eager-marker and all matched-file preload checks, with every size
limit unchanged. Do not hardcode observed chunk IDs or hashes.

Preserve both existing test bodies and qualify both complete test modules.
Cover genuine shared-lazy acceptance and wrong-entry, missing/unrelated
companion, eager/preloaded companion and malformed/ambiguous negatives.
Independently recheck the already acquired artifact without a build replay or
another download. Final affected hosted qualification uses one complete
integration candidate; no duplicate dispatch or unnecessary `ci:full` label.
Normal landing requires every enabled final-head check, matched head and
verified parents/tree. A guard pass is not an application or corpus completion.

## Local source and retained-artifact acceptance

All ten complete control groups pass, including the two unchanged boot tests.
The production guard also passes against the admitted hosted artifact's retained
JavaScript and HTML inputs. Its actual runtime filename resolver selects the
named entry despite an unrequested compiler chunk sharing its chunk ID; the
bound normalizer reaches the shared table through genuine module dependencies.
Comment/string, unrelated, eager, preloaded, mutable and ambiguous alternatives
remain refused. Tooling uses pinned Acorn 8.14.0 with its MIT licence retained;
it is not part of application boot. Earlier fixture and recognition failures
remain recorded. Final new-build and integrated hosted qualification remain
required. These results do not change application or corpus completion counts.
