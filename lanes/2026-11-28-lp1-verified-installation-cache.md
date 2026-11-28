# LP1b — verified optional SDCC installation and cache retention — 2026-11-28

Status: DONE — bounded source implementation and focused qualification complete;
hosted qualification and main landing remain pending.

Owner: Language/platform extension maintainer, continuing the repository owner's
request to advance LP1 after the shared inventory in PR #1856.
Consumer main at claim: `90c34f0ef042061881b3e67c2c8465036ea6b107`.
Implementation base: `bd142bc3c4aa2b9275f9ee04b43388c3d57831e1`.
Use isolated source work and guarded non-force remote checkpoints.

## Scope

- Pin SHA-256 and byte-length evidence for all nine existing SDCC members from
  immutable supplier revision `64ea6915733cf6d6563dfe9424c8cc71b4731e06`.
  Independently hash the downloaded immutable bytes, verify their Git blob
  identities, and reconcile the supplier's published four WASM hashes.
- Extend both runtime-package-inventory.json mirrors and the inventory
  validator without changing the optional-only distribution boundary or
  claiming component/runtime/output license clearance.
- Own both sdcc-wasm/toolchain-source.js mirrors and, only where required,
  toolchain-store.js mirrors. Verify downloads before storage, cached bytes
  before reuse, offline installed-state inspection and browser blob imports.
  Refuse unknown members and unchecked network fallback. Preserve cancellation,
  partial resume, explicit user opt-in and distribution denial before requests.
- Own both sw.js mirrors to retain the exact inventoried optional cache across
  activation while removing obsolete application caches. No prefix exemption
  and no service-worker toolchain fetch or new cache prepopulation.
- Qualification owns existing download/GPL/inventory controls, a new focused
  integrity suite and service-worker activation controls, the corresponding
  verify-service-worker.mjs browser/mutation checks, necessary test fixtures and
  source-suite registration. Record bounded plan/roadmap progress.

## Boundaries

PR #1855 retains Code document, simulator, worker, supplier adoption and build
ownership. The separate Pico serial upstream-identity prerequisite retains
its pin repair. Do not edit either owner's implementation paths or rewrite
other branches.

This slice qualifies managed optional downloads, browser imports and the CLI's
existing inspected installation route. Explicit development mode and direct
Node staged-toolchain harnesses remain development inputs, not verified package
installation claims. No new compiler/runtime, GPL payload, NC material or
physical-device qualification is added. Full compiler-component, linked-runtime
and generated-output license evidence remains a separate checkpoint.

## Qualification

Exercise every member with valid and corrupted bytes, corrupt-cache repair,
real partial cancellation/resume, offline inspection, policy denial before
network/cache execution setup, unknown-member rejection and missing crypto
failure. Test the real worker activation with exact retained/deleted names,
unchanged optional payload bytes, settled cleanup, zero network calls and no
new optional cache on a fresh installation. Keep both browser mutations
load-bearing: deletion of old app caches and retention of the optional cache.

Maintain byte-identical tracked mirrors and a complete repository tree.
Independently review the implementation. Applicable hosted qualification and
upstream identity remain required for landing; inherited failures are recorded
with evidence and never waived or rerun unchanged.

## Completion and qualification receipt

Implementation is saved in `1e337b223aa8946bdece16530aaa4dae9f407981`.
It preserves PR #1856 and merges the two preceding documentation-only claims.
The completing documentation commit does not change the reviewed executable
source.

**49 focused controls pass on Node 24.22.3, with no skips:**

- Existing download/GPL boundary, shared inventory and output guard: 32.
- New integrity suite: 13, including same-size corruption of each of the nine
  downloaded and cached members, verified offline snapshots/MIME types,
  individual repair, unknown-member rejection, policy-before-network,
  missing-crypto/manifest refusal and cancellation during digest/final storage.
- Actual service-worker activation: four, covering exact retained/deleted sets,
  unchanged optional bytes, cleanup-before-claim, no prefetch or new optional
  cache, mirror equality and a retention-removal negative control.

All nine SHA-256 values and lengths were independently calculated from
SHA-addressed supplier files and matched their Git blob identities. The four
published WASM hashes agree. The current GitHub Pages origin matched those same
nine byte sequences. A separate real-loader probe accepted **6,737,737 bytes**
through `primeToolchainCache`, reported a complete verified installation, and
resolved all nine members offline from that in-memory store. No downloaded GPL
payload was written into this repository or its deliverable.

Independent review found and reproduced a final-cache-write cancellation gap;
post-write/pre-URL checks and a regression exercising both operations close it.
The accepted loader blob is `74e035d406e452dad4f4d2e37fcd012480e2aeeb`.
Tracked inventory, loader and worker mirrors are byte-identical. Script syntax
and scoped whitespace checks pass. Both new suites are registered in the
bounded source suite.

The browser gate now performs a real worker update and offline cache readback,
with mutations for both obsolete-cache deletion and optional-cache retention.
**Local browser execution is not qualified:** the Chromium wrapper points to an
absent executable and Playwright has no installed browser. Its launch failed
before product code; no environment failure is counted as a passing gate.

PR #1856's official build and its nine LP1a controls passed, but inherited vendor
identity and broader unit/integration failures still block landing. Its available
unit failures are in unchanged integration inputs; this receipt does not claim
a complete baseline rerun or waive any gate. The Pico prerequisite is preserved
in [sb3-creator PR #260](https://github.com/CrispStrobe/sb3-creator/pull/260);
its consumer pin must wait for qualified upstream landing.

Component/runtime/output license statuses stay explicitly pending. Explicit
development mode, arbitrary direct Node staging and physical-device behavior
are not covered by this managed optional-installation guarantee.

