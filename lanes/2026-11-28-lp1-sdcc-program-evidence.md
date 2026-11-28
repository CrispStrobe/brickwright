# LP1 — generated-program link evidence — 2026-11-28

Status: DONE — bounded evidence produced and independently reviewed; LP1 implementation merge gates remain open.

Owner: Language/platform extension maintainer, continuing the repository
owner's LP1 request and incremental GitHub checkpoints.
Branch: `codex/lp1-sdcc-program-evidence-2026-11-28`.
Main at claim: `f93b83ce4fda4525eea79d54bc8b036078bfb1a1`.
Isolation: dedicated remote branch and source-only workspace; Git data changes
use the verified complete parent tree while local full-clone storage is unavailable.

## Bounded evidence slice

Preserve the bounded read-only in-memory canary experiment in
`docs/receipts/2026-11-28-lp1-sdcc-generated-program.json`, the original
`docs/receipts/2026-11-28-lp1-sdcc-generated-program-probe.cjs`
in-memory harness and
`docs/receipts/2026-11-28-lp1-sdcc-generated-program-probe.py`
transport/reproduction runner, and this claim only.

Use the exact pinned supplier compiler/runtime bytes and the historical
producer's existing `generated-multimeter-idle.c` canary and compile driver.
Record pre-execution input integrity, actual stage exits, the explicit
host-adapter differences, genuine MEMFS linker-map evidence, selected archive
members and opened headers, output hashes, and the experiment's limits.
Independently review the exit-unwind adapter and fail-closed stage checks.

This slice stores metadata and original probe source only: no compiler,
runtime, header, third-party source/notice payload or generated program binary.
It does not change the approved historical-build receipt, inventory pins,
license-review flags, application, downloader, service worker, workflows or
other lanes' integration fixes. One generated-program canary does not establish
coverage for other programs, a fresh native-library rebuild, identical historical
execution conditions, or aggregate license clearance.

## Qualification

Bind all inputs to independently computed hashes before executing. Retain real
nonzero stage failures and exceptions; promise fulfillment alone is not success.
Observe header reads after MEMFS seeding and obtain the map from the real linker.
Cross-check selected object hashes against the approved historical receipt.
Publish only after independent review, with exact source identities and adapter
code sufficient to explain and reproduce the evidence. Preserve the complete
remote tree and all existing claims through guarded non-force updates. No failing
implementation gate is waived.

## Result and frozen identities

Claim-only PR #1863 merged at `6a9f6051edb157511b0ae80e1c02843036d07731`.
Reviewed core evidence was incrementally checkpointed at
`fa504aeeb010d0984d1c70799eceb50a97e261e6` before replay-wrapper review finished.
The earlier historical-build receipt remains byte-identical at SHA-256
`bf526df79ca7e0c3cbe361dec564effbeb178d6f85085b016ed9a28257b390e5`.

The actual pinned `generated-multimeter-idle.c` canary completed `cc1`, `sdcc`,
`sdas8051` and `sdld`, each with one original `ExitStatus(0)`. Its real linker
map selects 11 objects across `liblong.lib`, `mcs51.lib` and `libsdcc.lib`.
All selected object hashes and inherited primary-source mappings match the
historical receipt. Three opened headers were observed after MEMFS seeding:
`8051.h`, `compiler.h`, `stc12.h`; read modes and incorporated byte coverage
were not recorded. Opened libraries are not counted as selected objects.

The unchanged historical driver's returning quit callback produced an observed
assembler `[0, 1]` failure on this host. Both failed attempts remain in the
receipt. The final host adapter invokes the original logger and throws the
identical supplied exception, matching the pinned generated glue's default
unwinding. It preserves nonzero and unexpected-exception refusal. Driver bytes,
stage arguments, linker script and compiler/runtime inputs remain verified.
This is an adapted Node/WASM execution, not an identical historical environment.

| Preserved file | Bytes | SHA-256 |
| --- | ---: | --- |
| `2026-11-28-lp1-sdcc-generated-program.json` | 24584 | `5642418139cc4caf9cc8aacbc2b226cbe8a1c5e8e30231e31f8cf2d17e8a6730` |
| `2026-11-28-lp1-sdcc-generated-program-probe.cjs` | 10802 | `72154853c3dfd2e030cceede215c37cfa38f88f3c41001342b60e0369c9c2d60` |
| `2026-11-28-lp1-sdcc-generated-program-probe.py` | 12596 | `28d772c057abea650b640c24bac9da4ef8d12dca445fb24576d6e0e97e55a8a3` |

All three files are in `docs/receipts/`. The CJS is the exact executed harness.
The Python direct-supplier transport was not used for the recorded compile and
has not been exercised end to end; the recorded compile used the verified
historical ZIP with runtime reconstruction. The wrapper fetches pinned supplier
Git blobs and verifies the same bytes, avoiding dependence on that expiring ZIP.
It checks structured result and all stage exits before returning success because
the preserved CJS can emit a structured failure while exiting zero.

### Verification

- Independent review approved all three exact hashes, adapter semantics, driver
  argument/linker-script equivalence, 11 map/object bindings, three header
  identities, and scope limits. Root separately checked the input bindings,
  successful stage trace and every selected object/header against the approved
  historical receipt.
- CJS and Python syntax checks passed. The wrapper accepted the recorded success
  and reproduced all 11 map bindings. Eight negative controls rejected failed
  structured results, nonzero Node/compiler exits, absent exits, boolean false
  status, unexpected RuntimeError, wrong stage order and unknown map members.
- Review found and corrected the transport response limit for JSON-escaped
  base64 line wraps. An offline stub accepted a valid 4,528,473-byte envelope
  for 3,286,732 decoded bytes and rejected decoded corruption. The final cap is
  bounded at `2 * expected bytes + 65536`; decoded length, SHA-256 and Git-blob
  identity checks remain unchanged. No further payload compile was needed.
- Real map: 24,733 bytes, SHA-256
  `a50af3689ca2169980f2f76aa56f596d3f0760e93c6111e14d0778695ed33653`.
  IHX: 9,864 bytes, SHA-256
  `84ba3cfebf6f69fd644b4e2cc1c29e81f796d58c89b58b8aaa5b66e03f8a42cb`.
  Their payloads stay out of the repository; metadata is retained.

Reproduction invocation from the repository root:

```sh
python docs/receipts/2026-11-28-lp1-sdcc-generated-program-probe.py --historical-receipt docs/receipts/2026-11-28-lp1-sdcc-historical-build.json
```

No generated firmware behavior, native-versus-WASM equivalence, fresh native
compiler/library rebuild, browser compiler path or aggregate license clearance
is claimed. Review flags and distribution boundaries stay unchanged. The
implementation PRs remain #1856/#1857; this evidence does not waive their gates.
