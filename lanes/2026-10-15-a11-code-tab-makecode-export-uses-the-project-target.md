## A11: Code-tab MakeCode export uses the project target — 2026-10-15

DONE — merged 2026-10-15 in [PR #971](https://github.com/CrispStrobe/brickwright/pull/971)
as `f1440691`. Original branch `lane/a11-project-target-export-20261015`,
base `c6f1ff5c3`. Single-board Code-tab MakeCode export selects the existing
micro:bit, Calliope or EV3 emitter from the parsed project device and writes
matching project metadata and editor guidance. Preserve unchanged imported
original files for their own supported target and the multi-board early return.
Envelope: `overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx`
and its tracked `packages/` twin; a focused export-routing helper under
`overlay/scratch-gui/src/lib/bw-makecode/` if needed; focused tests;
`scripts/verify-makecode.mjs`; existing browser CI wiring only if needed;
this ledger and `docs/OPEN-TASKS-2026-09-29.md`. Do not change exporters,
applied-device routing, board model, dependency pins or another lane's behavior.
Claim landed at `015e1bdc7`. The actual handler now selects each target's
existing emitter and file metadata, retains matching unchanged originals,
reports the correct editor in both locales and offers EV3 export. The target
is captured with the source before lazy compiler loading; generated micro:bit
filename conventions and the multi-board early return are preserved.
Validation: 39 focused export/UI/document-policy checks pass without skips;
the old source and wrong-routing/metadata/editor/original/visibility mutations
fail. Final hosted browser job `116518382899` downloaded a Calliope export,
checked its own packages/editor and polling loop, reopened those exact bytes,
and compiled and ran it in the real Calliope PXT simulator. All 11 enabled
checks passed on the reviewed head; deployment and deployed-site verification
were conditional skips for the pull request. Heavy-browser retry `116562834180`
ran all 31 assigned gates with zero skips. The original harness-policy and
npm install connection-reset failures remain recorded. The normal matched-head
merge preserved the separately qualified debugger-capability parent, and its
landed tree and parents matched the reviewed composition.
