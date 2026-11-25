## Scoped WeDo2 inventory gate repair — 2026-10-15

IMPLEMENTED, hosted qualification pending — SPIKE G02 integration follow-up.
Ownership claim [PR994](https://github.com/CrispStrobe/brickwright/pull/994)
merged before implementation. Source branch `fix/scoped-wedo-inventory-20261016`.

The existing `wedo2unified` artifact pin is present in `vendor-pins.json`, but
the notices census treats it as an unknown vendored repository and the scoped
pin inventory omits it. Both checks fail on the unchanged integration source.
The retained generated bundle declares MPL-2.0 and records its source commit
and SHA-256; those inputs must remain unchanged.

Envelope: this ledger, `scripts/lib/notices-census.mjs`,
`THIRD-PARTY-NOTICES.md`, `test/notices-drift.test.mjs`, and
`test/pin-move-chain.test.mjs`. Register the already shipped scoped bundle,
retain its declared author and license in the notices, and correlate the
existing pin with its exact per-file bundle receipt. Missing, malformed,
unlicensed, wrongly attributed or mismatched bundles must still fail.
No dependency adoption, generated bundle, product runtime, firmware, model,
workflow or budget change. This repair does not establish broader license or
release clearance. The claim must land before implementation; then run the
affected inventory controls and every enabled exact-head CI check.

The repair reads the existing scoped bundle's MPL declaration and separate By
attribution, requires its notice, and correlates the pin with the source repo,
path, commit, byte count and SHA-256 in the retained per-file receipt. A By
header does not grant a copyright-holder or own-code exemption. Seven focused
host controls pass, including the actual bundled source and negative receipt
and notice cases; the unchanged baseline fails the two intended inventory
checks. Initial sparse-input and historical Git-object failures are retained
separately from those baseline results. Runtime, generated bundles and pins
remain unchanged. Full hosted checks remain required before merge; this does
not qualify a new installed package or close SPIKE G02.
