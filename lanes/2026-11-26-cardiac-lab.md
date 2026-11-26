## CARDIAC Lab — REVIEW CANDIDATE, 2026-11-26

Default-branch claim publication and merges are pending approval. Automatic
approval review refused direct default-branch pushes during claim publication.
Implementation is isolated on the feature branch and published through the
draft supplier PRs below. This records candidate ownership; the lane has not
published its claims or merged these candidates on default branches.

Owner: Brickwright CARDIAC implementation lane, requested by CrispStrobe.
Isolated branch: `feat/cardiac-lab-20261126`.
Base: `b3c7db9e6a3cb49274ba8b925db71bad6b2d0b89`.
Scope: Code/Controller CARDIAC panel and shared runner, decimal-word debugger presentation, portable project state, guided lessons and original examples, owning-upstream sync/pins, connected night-light journey, focused source/browser qualification.

Companion package boundaries: Brickwright, bw-board, bw-circuit-ui and
sb3-creator. Preserve all unrelated CP1, Microtronic, KIM and other work.
One authoritative machine and simulation clock; original CARDIAC opcode order.
Modern circuit I/O is explicitly identified as a Brickwright extension.
Independent code, lesson text and artwork; comparison implementations are
references, with license and semantic differences recorded. No historical
manual assets or incompatible emulator code are imported.

Qualify decimal overflow/shift/branch/input boundaries, source-to-memory
correspondence, actual circuit I/O, execution ownership, incomplete-source
persistence, and desktop/narrow browser operation. Exact downstream pins are
prepared in this review candidate. The full upstream release gate below is
still pending; local checks do not substitute for that hosted evidence.

### Owning suppliers and published draft candidates

| Owner | Scope | Published revision | Review |
| --- | --- | --- | --- |
| `bw-board` | Decimal machine, modern electrical adapter, target and debugger contract | `0f6b38a8d6d3b15861ee7b35eda45e5db45035f2` | [Draft PR 777](https://github.com/CrispStrobe/bw-board/pull/777) |
| `bw-circuit-ui` | Original four-terminal part, compact controls, palette, handoff and accepted-image persistence | `42aaddc8aaa93b4f584b2e9d81303b2673fdb9a5` | [Draft PR 182](https://github.com/CrispStrobe/bw-circuit-ui/pull/182) |
| `sb3-creator` | Assembler, input decks, six examples and bilingual gallery material | `fd5ea63fc4bda8696fbe6c672b4f11c1c8171d12` | [Draft PR 243](https://github.com/CrispStrobe/sb3-creator/pull/243) |
| Brickwright | Code/Controller surfaces, shared runner, portable project state, six bilingual lessons, integration and exact supplier adoption | This feature branch | Root review candidate |

The adoption also retains preceding upstream KIM-1, analog/storage and gallery
work. The exact old-pin-to-base boundaries, counts and broader qualification
limits are recorded in [CARDIAC-LAB.md](../docs/CARDIAC-LAB.md). They are not
attributed to the CARDIAC implementation.

### Final local qualification snapshot

- Root CARDIAC tests: 38 passed, zero failures or skips using the installed
  packages (`cardiac-root-final-tests.log`).
- Final producer sync/SPIKE: seven checks passed at `fd5ea63f`; 23 distinct
  transformed source files match the pin, 24 mappings have zero declared deltas,
  and the real SPIKE compiler artifact passes. Compiler/gallery checks, mirror
  equality, Arcade inventory and notices pass; the gallery covers 6,102 files.
- Installed Board and Circuit UI npm-pack bytes match their pinned sources at
  both root and GUI locations: 13,773 Board files and 1,488 Circuit UI files
  per location. Single-engine resolution passes in both locations. This proof
  excludes transitive dependency bytes (`cardiac-installed-proof.log`).
- Full `npm run build:gui` at the final supplier pins, after compiler/gallery
  sync and integration: exit 0 through normal preflights and webpack; one
  existing Microtronic CSS/autoprefixer warning (`cardiac-final-pin-build.log`).
- Shared-host browser: 10 checks passed separately with React 18.3.1 and the
  installed GUI React 16.14.0 under Chromium 158.0.8127.0. Both require zero
  page/console errors and no generic compiler requests. Evidence is in
  `test-results/cardiac-browser-final-react18/` and
  `test-results/cardiac-browser-final-react16/`.
- Circuit UI browser: nine checks passed against the qualified installed Board,
  including actual sampled voltage/LED current, distinct machines and rotated/
  mirrored wire anchors (`cardiac-circuit-evidence/result.json`).
- Built full GUI/real VM: four functional CARDIAC checks passed (entry, shared
  Controller host, echo in three instructions, addition in seven). The strict
  diagnostic gate remains failed on two optional LabWired WASM 404s and three
  shared React warnings, with zero uncaught page errors
  (`test-results/cardiac-built-app-smoke/result.json`).
- Final supplier CI repair: 48 pin/assembler/integrity tests, two actual
  machine/UI parameter observations, 12 CARDIAC executions and all 2,875
  canonical circuit round trips pass. Full provenance measurement restamped
  313 pages, changing only the two pin strings.

The shared-host interaction gates run production modules in an authored shell,
with a validator-only PropTypes shim and a minimum archive-loading VM delegate.
Their `fullApplicationBuild: false` classification is retained. The separate
full GUI production build is a compilation/asset result, not a deployment or
an exhaustive full-application interaction result. Local generated evidence
is retained in the review workspace; it is not a hosted CI receipt.

The browser/build receipts initially used producer `94e48cf1`; the final
`fd5ea63f` repair leaves `src/utils` and CARDIAC program/deck/circuit bytes
unchanged. Final source sync and build identity are recorded separately. In
the built GUI smoke, fullscreen/WASM diagnostics precede CARDIAC selection;
the flex warning occurs as CARDIAC opens the existing Controller pane. The
relevant source regions match baseline `4b33f4d93a73b424a33a9b2ed353289b1a38f2d3`.
This is source attribution, not a separate baseline browser run; the recorded
strict failure is retained.

### Pending hosted release evidence and approval

Board [CI run 45793266751](https://github.com/CrispStrobe/bw-board/actions/runs/45793266751)
passed the draft PR's `ci:full` jobs: `vectors`, `corpus`, `vectors186` and
`vectors-full`. The fast `test` job was skipped by the existing PR-tier rule.
Brickwright's unchanged [upstream verifier](../scripts/verify-bw-board-ci.mjs)
requires `test`, `vectors`, `corpus` and `vectors186` with their required steps
successful in one run for the exact Board pin. Combining separate push/PR runs
does not meet that gate. A qualifying full run remains required before release.

The supplier's first CI run also failed on old fixture pins that did not know
CARDIAC/KIM. The final producer candidate repairs those inputs and observes
CARDIAC parameters through their actual machine/UI owners. Its remaining
`lab-chopper-tacho` flyback-diode invariant, VHF claim mismatches, current-readback
gaps and original hosted timeouts are explicitly recorded in the
[supplier handoff](https://github.com/CrispStrobe/sb3-creator/blob/fd5ea63fc4bda8696fbe6c672b4f11c1c8171d12/reference/cardiac-lane.md).
No unrelated numeric tolerance or ratchet was widened; replacement hosted CI
is still required.

Root pin-history qualification is also bounded: clean baseline `b3c7db9e`
passes 36/43 and the final producer-pin candidate 38/43, with all five remaining
failure names already failing on the baseline. All 70 final stale-token
occurrences match baseline path/line/SHA triples, with zero new occurrences;
the SPIKE literal and generated inventories were updated by the final producer
sync after the real artifact assertions passed. These
inherited history-role gates are not represented as green.

The candidate is ready for review with those limits recorded. No default-branch
merge or claim publication is authorized by these results; the earlier
automatic approval block remains in force.
