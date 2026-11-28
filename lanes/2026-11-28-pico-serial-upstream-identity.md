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

## Discovered remote gallery prerequisite

Complete, untruncated supplier and consumer Git-tree comparisons establish that
all 6,112 currently vendored gallery blobs equal the proposed repair revision;
the supplier's four extra top-level internal documents are intentionally absent.
The official remote gallery discovery nevertheless omits 2,116 existing circuit
files and calls them orphans because it enumerates only index-declared assets.
A remote sync mutation would therefore delete valid files. Do not run it that way.

This lane also owns the bounded discovery correction in
`scripts/sync-examples.mjs`, a small shared discovery helper if required, and
focused local/remote discovery tests. Remote discovery must enumerate the same
complete source set as local discovery with identical internal-file exclusions,
refusing truncated listings and retaining byte comparison/orphan checks. No
allowlist expansion, excluded circuit family or stale-source bypass is allowed.
Qualify the real omitted-file cases before using the corrected official tool.

## Pin-linked SPIKE qualification

The first consumer candidate passes vendor freshness and all 13 gallery CLI
controls, but `test/lego-spike-roundtrip.test.mjs` deliberately asserts the
old sb3-creator pin before artifact generation. This lane also owns the exact
pin acknowledgement and a brief provenance note in that test. Preserve every
SB3 generation, canonical variable/extension, motor/distance and decompile
assertion, and rerun the complete existing test at the reviewed backport.
This is qualification of the unchanged compiler bytes, not a SPIKE behavior change.

## Gallery fixture fetch-census declaration

The new gallery CLI fixture contains a raw GitHub URL template intercepted by
its offline fetch recorder. This lane also owns its exact `source-link` row
in `test/fetch-pinning.test.mjs`, with the synthetic SHA and zero-network
fixture behavior stated explicitly. Preserve detectors, exclusions, waivers
and mutation proofs; carry the declaration through both consumer candidates.
