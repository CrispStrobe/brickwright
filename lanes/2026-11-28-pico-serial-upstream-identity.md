# Pico serial adapter upstream identity repair — 2026-11-28

Status: CLAIMED.

Owner: Language/platform extension maintainer, continuing the repository owner's
request to carry LP1 forward from PR #1856.
Consumer base: `e64c6df1c1183a5a0c3c5ea7ce2bb2879b451f11`.
Supplier shipping base: `1b414786039b9cc412a498a8307126ee6422066b`.
Use isolated source checkouts and guarded non-force publication.

## Purpose and bounded ownership

Hosted vendor-freshness fails on the inherited Pico serial adapter divergence.
Preserve the behavior introduced by consumer commit
`c417fd8982d9ecfe2c988724c6fe331a69e2df46`: opt-in disconnect errors and
streaming UTF-8 decoding. Carry that upstream-owned change to sb3-creator
before adopting its exact identity in this consumer.

- Supplier: `src/utils/picoRepl.js` and focused serial adapter tests.
- Consumer: the sb3-creator entry in `vendor-pins.json`, official compiler
  sync outputs and generated references required by that exact pin, plus this
  claim and a bounded qualification receipt.
- Existing vendored executable bytes must remain identical to the consumer
  baseline. No exception, declared divergence, stale-source override, weakened
  gate, or changed compiler/gallery behavior is part of this repair.

The existing Code integration in PR #1855 retains its document, simulator,
worker, Code/game/CrispBASIC and broad supplier-adoption ownership. This
prerequisite repairs the already-shipped serial adapter identity only. No
other owner's branch is rewritten.

## Exact source strategy

Review a minimal supplier backport based on the shipping pin, containing only
the existing adapter delta and its behavioral tests. Land it on supplier main
with its commit identity preserved. Verify both the complete old-pin-to-repair
tree diff and that the reviewed repair is reachable from supplier main.

Adopt that deliberate immutable supplier revision through the official remote
SHA-addressed sync with explicit `--pin`. A stale local `--dir` checkout is
not the source, and no `--allow-stale` mutation is authorized. This avoids
adopting the unrelated accumulated supplier range. Retain the full mapped-file,
gallery, generated-reference, mirror and hosted vendor checks.

## Qualification and completion

Prove split multibyte UTF-8, compatible default EOF, opt-in disconnect rejection,
and reader/writer cleanup with real adapter behavior. Run existing Pico REPL and
chunking tests, independently review the exact repair, and satisfy applicable
upstream CI before merge. Then verify all mapped consumer bytes against the
adopted revision, gallery identity and mirrors; run applicable hosted consumer
qualification. An unchanged failure is never rerun or waived.

Update this claim to DONE in the final consumer candidate with available exact
identities and results. Preserve PR #1856 and incremental remote checkpoints.
