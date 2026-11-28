# LP1 inventory module interop — 2026-11-28

Status: DONE — source repair and focused qualification complete; exact-head
hosted CP5/build qualification still controls landing.

Owner: Language/platform extension maintainer continuing the repository owner's
request. Main at claim: `f3fd3ad963aec8bd1ec20c15daa7b2df07f82ca2`.
Consumer bases: LP1a `258a115abe397ffb12bc9fad388aa4625207c396` and LP1b
`e782cfa196520f6a95c7af52ab0e7c141a62898a`.
Preserve isolated work and guarded non-force checkpoints on both existing PRs.

## Evidence and owned scope

The CP5 React 16 browser artifact at run 46143585511, job 140974669942,
reports that the newly added `runtime-package-inventory.cjs?import` provides
no ESM default export. The shared debug runner eagerly imports toolchain-source,
so this fails Vite development-server bootstrap before CP5 circuit loading.
Earlier build/preview checks do not cover that serving path.

This is an LP1a regression. Own both runtime-package-inventory entry/mirror
files and the toolchain-source import boundary, preserving the canonical
inventory data and all installation, distribution and integrity behavior.
Choose a module representation supported by the repository's actual Node,
webpack/Babel and Vite consumers. If a generated ESM entry is necessary, own
its deterministic generator and exact source/mirror consistency checks.

Qualification owns focused module import controls, existing inventory and
downloader controls, direct Node CLI behavior, actual Vite development-server
module delivery/linking and production transformation. Update source-suite,
fixture imports and fetch census only where required by the chosen entry.
Retain meaningful negative proof for the original CommonJS browser failure.

## Boundaries

Do not patch CP5 fixtures or Vite configuration to hide the production import
failure. No metadata fetch, new compiler download, network fallback, larger
timeout, detector/waiver change or optional-policy relaxation belongs here.
The separate Code lane retains workflow evidence mapping and Robot Lab behavior.
No compiler/runtime payload is vendored. Preserve both existing PRs and all
other work.

Finish this claim and record available exact identities and qualification in
the source candidate before hosted qualification. Complete CP5 browser and
app qualification remains required; a development-server module control does
not alone claim full CP5 or hardware qualification.

## Completed implementation and qualification

The canonical JSON now generates a synchronous, data-only
`runtime-package-inventory.mjs` in both tracked trees. The renderer preserves
JSON semantics and exact canonical bytes in the JSON mirror; `--check` refuses
stale output without repairing it. Both loaders and shared fixtures import the
same ESM instance. The two unused CJS bridges are removed. The loader diff is
only its import extension; package identities, integrity data, policy decisions
and download/cache behavior are unchanged.

Seven new source controls pass on both LP1a and LP1b. They check the actual
checked-in generated outputs, link the real browser module graph without
CommonJS/Node/network globals under allowed and denied policies, reproduce the
original CJS default-export failure, and prove stale output, canonical edits,
invalid JSON, invalid UTF-8 and special JSON keys/string characters are handled
correctly. The tests use native Node ESM linking; they are not a Vite run.

The LP1b candidate passes 70 focused tests: 63 existing download, inventory,
build-boundary, distribution-policy, integrity and worker-activation controls,
plus seven module/generator controls. Independent review re-ran 22 relevant
inventory, integrity and module controls. The exact LP1a variant separately
passes its two original inventory controls plus all seven new controls.
Direct native Node CLI status also succeeds in loading both variants and
reports the expected empty installation (0/9, exit 1) without creating a cache.

Canonical inventory identities remain separate: LP1a JSON
`93c676ea0e17f24d914fadcee75de76af3a97b89` remains unverified, and LP1b JSON
`84ea367a2bb149891829c2c930fb4d7478a5032f` retains its reviewed hashes.
Generated entries are `0420228b70dd6b08e77a309c846ca77feb33045a` (LP1a) and
`666827c2069bd8077c029af7810019f42965650e` (LP1b).
The generator is `615cccb2249ff170ed0280b54f57738e48458b83` and final new test
is `b303d00e2268a8d80e6932d7a5dd63fc503ca324`.

LP1b's generated immutable provenance URL has an explicit fetch-census row
and full-SHA extractor. The actual existing detector and new extractor accept
the exact URL and reject branch names, shortened/uppercase refs and a missing
pin; no detector, exclusion, waiver or assertion is weakened. LP1a has no
generated provenance URL and receives no inapplicable census row.

The reviewed main advance to `ca1e54a6733d17f9a97ffca12747af28c8f3849d`
adds only the separate CrispBASIC crash-recovery claim; both candidates carry
that file unchanged. Its implementation scope remains with its owner.

No Vite, webpack/Babel or Chromium installation is available locally. The
existing hosted CP5 job uses Node 22, locked Vite 8.2.1 and the installed GUI's
React 16 through the real development server; that and the production build
must qualify the published candidates. Separate workflow evidence mapping
and Robot Lab failures remain outside this repair and are not waived.
