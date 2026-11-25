## A10: micro:bit V2 serial consumer adoption — 2026-10-15

DONE 2026-10-16 — Codex, branch `lane/a10-v2-serial-consumer-20261015`, base `015e1bdc7`.
Adopt the qualified deterministic LabWired engine release after its source fix
lands. Remove V2 serial withholding and verify real compiled firmware through
both CLI modes and the visible Debug console. Preserve A11's landed export fix.

Consumer scope is engine-only. The affected nRF52833 and micro:bit V2 catalog
payloads are unchanged. The producer's canonical catalog also carries the
qualified STM32F103 C8 flash and clock-gate descriptor; do not describe every
chip payload as identical to this shipped client. No client API change is
needed for the UARTE source fix; actual released-engine qualification against
this shipped client remains mandatory.
The separate STM32 package/compiler adoption belongs to its existing owner.
This lane leaves board, compiler and circuit-UI package pin fields untouched;
qualified mainline changes from those owners are preserved when integrated.

Envelope: this ledger and `docs/OPEN-TASKS-2026-09-29.md`;
`scripts/sync-labwired-wasm.mjs` PIN/TAG/EXPECT and
`.github/workflows/target-performance.yml` matching engine identity;
`scripts/makecode.mjs`, `scripts/lib/makecode-run.mjs` if needed,
`test/makecode-cli-run.test.mjs`,
`overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx`
and its tracked twin; `scripts/verify-makecode.mjs` serial assertions only;
affected engine provenance/notices through canonical writers if required.
No NPM package/compiler pin bump, copied engine, invented source/hash, SDK
rebuild, optional motion run, physical-accuracy claim or threshold relaxation.

The first release, `labwired-wasm-6a769a59`, passed its original 123-test suite,
but consumer PR988's real compiled CLI and browser programs still produced
corrupt serial bytes. Preserve those failures. The follow-up interrupt-completion
fix is merged in labwired-core PR247 as `1ea67f9c`; its reviewed source
`de14721e4ae1d34a428f91d232e4520d50f1ceba` is the adopted engine pin.
Producer PR629 is merged as `a72acc06`: all 13 enabled final checks pass,
including the five release jobs; four skips are declared. Fresh engine run
38855838615 passed two independent matching builds and all 125 release tests
with zero failures or skips. Release `labwired-wasm-de14721e` has five assets
whose digests and sizes match the original build bytes. Node test and benchmark
callers supply their CommonJS marker explicitly.
[Consumer PR988](https://github.com/CrispStrobe/brickwright/pull/988) now
pins that source/tag and the two admitted web hashes. Its matching performance
workflow verifies both downloaded Node executable hashes before benchmarking;
methods, sample counts and thresholds are unchanged. The automatic pin-push benchmark
(run 38861990788) passed all five targets with three samples each; its input
blobs are byte-identical in the final candidate. Retain the original run identity
and its finite CPU-loop/AVR-adapter scope.

Consumer PR988 merged as `3753d3b48014d50574a417970dfd75b940129f16`, retaining
tested head `18484cfeb1a124f2352f100c1a5d9744275ba879`. All 12 enabled exact-head
checks passed across Build, vendor freshness and Rust notices; deploy/verify-gui
were declared conditional skips. Both actual compiled JSON/text CLI proofs
passed the complete greeting, ordered counters and unchanged matrix/fault/
one-second bounds. The browser's own fresh nRF52833 V2 emulator ELF reached
Running and printed its complete unique greeting in the visible Debug console.
The full tracked-file inventory and notices passed in the clean hosted checkout.
Reviewed, predicted and landed merge parents/tree match; peer notes and A11's
export implementation are preserved.

The authored proof guests explicitly set `serial.setWriteLinePadding(0)` because
MakeCode otherwise pads `writeLine` records to 32 bytes including CRLF. Existing
exact output assertions, waits and budgets are unchanged. Original first-engine
corruption and the later padding-expectation failures remain retained. No
physical re-capture, hardware or broader performance claim is added.
