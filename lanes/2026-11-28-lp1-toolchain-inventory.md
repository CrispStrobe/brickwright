# LP1a — optional toolchain inventory and artifact boundary — 2026-11-28

Status: CLAIMED.

Owner: Language/platform extension maintainer, at the repository owner's request.
Branch: `codex/lp1-toolchain-inventory-2026-11-28`.
Base: `e6ee2f286a50a2a72e2d26dd2f111bf23454755d`.
Use an isolated source checkout and guarded non-force publication. Push bounded
remote checkpoints so the implementation is recoverable throughout the lane.

## Scope

The plan/roadmap are already on main. This first implementation seeds LP1 with
the existing optional SDCC package; it does not add a compiler or change pins.

- New data-only `overlay/scratch-gui/src/lib/runtime-package-inventory.json`
  and its tracked mirror: declared source/license/distribution/integrity facts,
  download members, cache identity and known prohibited build markers.
- `overlay/scratch-gui/src/lib/sdcc-wasm/toolchain-source.js` and its mirror:
  derive existing package constants from that inventory without changing
  opt-in, cancellation, resume, policy-denial or resolver behavior.
- `scripts/lib/runtime-package-inventory.mjs`,
  `scripts/verify-no-gpl-in-build.mjs` and the report wording in
  `scripts/package-store-compliance.mjs`: validate the inventory, use its
  known-payload exclusions and accurately describe the resulting guarantee.
- Focused `test/runtime-package-inventory.test.mjs`,
  `test/runtime-package-build-boundary.test.mjs`, necessary existing
  toolchain test loader adaptations and `test/source-suite.json` registration.
- Bounded progress notes in the new LP1 sections of `PLAN.md`/`ROADMAP.md`
  and this claim.

## Ownership boundaries

PR #1855 owns Code document/Pico simulator/integration work; this lane does not
touch its component, worker, compiler supplier, pin, webpack, notice or workflow
changes. Preserve existing runtime policy flags, output signature checks and
component-specific LGPL treatment. No package-manager UI rewrite, generalized
license scanner, transitive license clearance, verified download installation,
service-worker cache migration or physical-device qualification is claimed.

## Qualification

Behavior tests execute the real build guard on clean and prohibited fixtures,
including metadata/notice and generic-runtime-name false-positive controls.
Inventory validation rejects inconsistent classifications. Existing real
download cancellation/resume and distribution-denial tests remain required,
with unchanged exported package identities and byte-identical tracked mirrors.
Retain existing boot-media and sparse-solver signature controls. Check tree
shape and exact changed paths before publication. Run the repository's applicable
automatic PR qualification; do not bypass a failing gate or infer whole-app
acceptance from focused source controls.
