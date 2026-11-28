# LP1a — optional toolchain inventory and artifact boundary — 2026-11-28

Status: DONE — bounded LP1a source implementation and focused controls complete.

Owner: Language/platform extension maintainer, at the repository owner's request.
Branch: `codex/lp1-toolchain-inventory-2026-11-28`.
Base: `e6ee2f286a50a2a72e2d26dd2f111bf23454755d`.
Use an isolated source checkout and guarded non-force publication. Push bounded
remote checkpoints so the implementation is recoverable throughout the lane.

## Scope

The plan/roadmap are already on main. This first implementation seeds LP1 with
the existing optional SDCC package; it does not add a compiler or change pins.

- New data-only `overlay/scratch-gui/src/lib/runtime-package-inventory.json`
  and the tiny `runtime-package-inventory.cjs` Node/webpack interop adapter,
  with their tracked mirrors: declared source/license/distribution/integrity facts,
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

## Incremental checkpoints

The first implementation checkpoint adds the shared SDCC record, its Node/webpack
interop adapter and the existing loader's inventory-derived constants. Direct
Node import preserves the current origin, cache key and all nine download members.
The record has an independent source/license metadata review; complete component
license review and download digest verification remain pending. Build-guard
integration and focused regression qualification follow before lane completion.

## Completion and qualification receipt

Implementation is saved incrementally in `d59a9b908e467e9e26a4bacf356b0d0e31e6e38b`
(shared record/loader) and `04dc4ff0c2f2c460f525c2e9523f819c4de041e8`
(inventory-driven artifact gate and tests). The completing commit adds only this
receipt and bounded progress notes to the plan/roadmap; executable source remains
the tested checkpoint's source.

**46 unique focused controls pass on Node 24.22.3**, with no dependency install:

- `node --test test/toolchain-download.test.mjs test/gpl-toolchain-not-bundled.test.mjs`:
  23 passes, including the real cancellation/partial-cache/resume flow and CLI.
- `node --test test/native-store-code-policy.test.mjs`: 14 passes, including
  eight independent distribution profiles and refusal before network access.
- `node --test test/runtime-package-inventory.test.mjs test/runtime-package-build-boundary.test.mjs`:
  nine passes, including actual downloader identity mutation, mirror equality,
  invalid inventory controls, real emitted-file fixtures and retained signatures.
- Syntax checks pass for the validator, output guard and compliance report;
  whitespace checks are clean. Existing tests required no loader rewrites.

The environment required a writable temporary directory for fixture creation;
the initial absent-temp-directory failure occurred before product logic. This
receipt is focused source evidence, not a full build or browser/native/hardware
result. The repository's selected automatic PR qualification remains required
for main landing; GitHub checks bind that hosted evidence to the candidate head.
Independent reviews checked source/license metadata, Node/webpack interop,
output-guard behavior, retained signature branches and test non-vacuity.

Schema v1 admits only optional-user-download records and refuses reclassification
as bundled/external, malformed origins, empty cache names and unsupported integrity
claims. The actual record explicitly retains component-review-required and
unverified statuses. No additional license family or runtime payload is approved.

## Follow-on boundaries

Pin/verify every JS/WASM/runtime member before accepting cache/import; finish
compiler-stage/runtime/output license evidence; qualify optional cache retention
across service-worker activation and behavioral no-prefetch rules. These require
new bounded claims. LP1a does not close LP1 as a whole or any Simulator/silicon
language route. Existing Code/Pico integration ownership remains untouched.
