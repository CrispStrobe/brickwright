# Browser proof CI coverage — 2026-11-27

The coverage gate found 38 browser proof scripts with no executable CI caller.
This repair gives each script a direct step against the existing official
integration and production build. The unwired allowlist, scanner baselines and
existing numerical limits are unchanged.

| New browser shard | Independent proofs | Required setup |
| --- | ---: | --- |
| `lightcad1` | 7 | CAD sketches and constraints |
| `lightcad2` | 7 | CAD operations, preview and persistence |
| `lightcad3` | 6 | CAD formats, drawings and Microtronic |
| `lightartwork` | 11 | Artwork, help, owned console and navigation |
| `robotview` | 7 | Robot Lab runtime and rendering, Chromium and Firefox |

The existing browser matrix now contains 37 shards. New light shards enable
CAD in the same build as the existing light shard. The scope step combines
their outputs into the light or Robot Lab family before applying exclusions,
including when a pull request also changes another family.

Each proof has its own process verdict, provisional eight-minute step limit
and retained log. `pipefail` preserves a failed proof through `tee`. Independent
proofs continue after a preceding proof fails, while a missing served build
prevents execution. Each new shard retains its logs and any exported artifacts.
The DWG and STEP steps use the committed fixtures and provenance in
`test/fixtures/cad/browser/`, without a mutable fixture download during CI.

The runner audit covers all 329 preceding steps using four scalar parts of at
most 100 rows each. Its existing expression, input and receipt bounds remain
unchanged. The scalar-delivery negative control now checks missing, empty and
malformed delivery for every current part, plus an extra part.

## Validation and limits

Local checks passed 66 distinct controls: 51 coverage, scope, shard, timeout,
budget and workflow-shell controls, plus 15 genuine runner and local-CLI
controls. Tests execute the actual 38 workflow commands with a deliberately
failing local child and require exit status 42, preserved logs and the exact
URL and fixture arguments. They also exercise the actual tier-selection shell
and bounded browser installer offline.

The official budget generator added 38 entries with **zero observations**.
All 216 previous entries, their observations and the top-level metadata are
preserved. A provisional budget is not a timing measurement or passing browser
receipt.

This checkpoint establishes executable CI coverage and its failure behavior.
The 38 real browser journeys still require hosted qualification. The ordinary
owned-console report emitted by this workflow is an `unbound-local-build`
report; it does not replace the separately bound experimental or shipping
bundle qualification receipt.
