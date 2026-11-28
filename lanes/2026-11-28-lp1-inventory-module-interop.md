# LP1 inventory module interop — 2026-11-28

Status: CLAIMED.

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
