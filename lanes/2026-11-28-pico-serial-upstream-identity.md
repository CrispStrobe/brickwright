# Pico serial adapter upstream identity repair — 2026-11-28

Status: DONE — upstream repair merged and consumer adoption candidate prepared;
consumer hosted qualification and main landing remain pending.

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

## Completion receipt

The minimal supplier backport is
`09533f6938e6be310973d0f7aa6fdd4905339ac8`, merged through
[sb3-creator #260](https://github.com/CrispStrobe/sb3-creator/pull/260) in
`120bc30281f80e65f2474f52219c72c12ff9e95d`. Its two-file tree changes only
the existing adapter behavior and focused tests. All 12 adapter/REPL/chunking
controls pass; the old adapter fails the two new behavior controls.
Independent review approved it, and
[upstream CI](https://github.com/CrispStrobe/sb3-creator/actions/runs/46138958292)
passed all four lint/test/build shards and browser rendering. The merge
preserves the reviewed backport as a parent; the consumer adopts that minimal
revision without the unrelated accumulated supplier range.

The official SHA-addressed compiler `--check` passes all 25 mapped entries
(24 unique files) at the adopted revision. All mapped consumer source and 20
tracked mirror pairs retain their baseline Git blob identities. No vendored
executable or gallery payload changes in this candidate.

The corrected gallery CLI has **13 passing controls, zero failures/skips**,
independently reproduced at source blob
`795a83427c9e0ee58dbe7dd32f1b40a0eec229f6` and test blob
`c1141d84c7828e39cce2c6346e82a06f68215fdc`. They cover full local/remote
parity, genuine orphan and byte failures, missing source/reference refusal,
truncated trees, explicit pin authorization, nested paths, backslash traversal,
literal URL path characters and preservation of original index bytes. The
original script fails the positive complete-gallery parity test. The focused
suite is registered in the bounded source suite.

Complete untruncated tree comparison establishes that all **6,112** consumer
gallery files (**21,368,998 bytes**) have identical supplier blobs. There are
no mismatches or consumer-only files. The four supplier-only root documents
are intentionally excluded by both discovery modes. Supplier examples tree:
`e7334bb5ccc96e9f964b8a3e3d80d9f56cf2aacf`; consumer examples tree:
`2d72836bc65efbde0cb9c39dccca65deec582d27`.

The official remote `sync-sb3creator.mjs --pin` recorded the reviewed revision
after finding every mapped source current. **Its full local gallery phase is
not qualified:** this sparse environment has insufficient free space for the
complete gallery, and the remote phase was timeboxed at 45 seconds (exit 124).
No gallery mutation was run. The independent complete Git-tree proof above is
recorded separately; it is not represented as a successful local sync.
The official vocabulary generator was run separately, changing only its pin
line. The complete checkout's hosted vendor, gallery, identity, mirror and
generated-reference gates remain mandatory before consumer landing.

## Pin-linked SPIKE qualification

The first consumer candidate passes vendor freshness and all 13 gallery CLI
controls, but `test/lego-spike-roundtrip.test.mjs` deliberately asserts the
old sb3-creator pin before artifact generation. This lane also owns the exact
pin acknowledgement and a brief provenance note in that test. Preserve every
SB3 generation, canonical variable/extension, motor/distance and decompile
assertion, and rerun the complete existing test at the reviewed backport.
This is qualification of the unchanged compiler bytes, not a SPIKE behavior change.

## Hosted vendor result and SPIKE requalification

The complete hosted
[vendor-freshness run](https://github.com/CrispStrobe/brickwright/actions/runs/46141726925)
**passed** at consumer candidate
`bb557027ba0b8efef41c9b78a5193b9f5992ce8e`. Its upstream-byte identity,
transpiler, complete examples gallery and runtime gallery-pin checks all
succeeded. This supplies the complete-checkout qualification unavailable
locally; the original Pico vendor blocker is cleared.

The bounded source run at that candidate passed **200 of 201** controls,
including all 13 gallery tests. Its sole failure was the intentional old-pin
assertion before SPIKE artifact generation. The follow-up changes only that
exact pin literal and three provenance comment lines; removing those changes
reconstructs baseline test blob
`5cb70d8aa1caaddc6395d588054b9ecb59afb429` exactly.

The complete existing SPIKE artifact/round-trip test now passes **1/1**, with
all assertions retained, using preinstalled repository-pinned JSZip 3.10.1
through a scratch import resolver. No dependency was installed and no source
or artifact was mocked. The reviewed test blob is
`37adc4d9d90344a768f8acdbc964017c33337bcd`. The following candidate still
requires applicable hosted source and integration qualification.

## Gallery fixture fetch-census declaration

The new gallery CLI fixture contains a raw GitHub URL template intercepted by
its offline fetch recorder. This lane also owns its exact `source-link` row
in `test/fetch-pinning.test.mjs`, with the synthetic SHA and zero-network
fixture behavior stated explicitly. Preserve detectors, exclusions, waivers
and mutation proofs; carry the declaration through both consumer candidates.

### Fixture declaration receipt

The offline test URL is classified explicitly in the existing census; the
fixture recorder returns local bytes and rejects unexpected URLs with no
network fallback. The production sync URL remains separately declared.
This adds nine declaration lines and changes no detector, exclusion, waiver,
assertion or prover. The LP1a gate blob is
`89d0801db37630887cd432a10631055af6cdc535`.

Independent review matched the actual detector hit and exercised the unchanged
census assertion: the row passes; removing it, changing the URL or removing the
fixture fails. A sweep of 16 changed/new scanner-eligible code files identifies
only the separately declared production, provenance and fixture raw URLs.
The full repository scanner and mutation prover remain hosted requirements.
