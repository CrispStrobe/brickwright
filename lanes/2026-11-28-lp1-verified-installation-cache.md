# LP1b — verified optional SDCC installation and cache retention — 2026-11-28

Status: CLAIMED.

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

## Discovered fetch-pinning prerequisite

Hosted qualification at `eadf983a7f327e51b073562e4ffe537f21a76abc` finds the
new integrity manifest's SHA-addressed raw GitHub origin absent from the
repository's fetch-site census. This is an LP1b integration omission.

This lane also owns the bounded declaration in `test/fetch-pinning.test.mjs`:
register the inventory origin as a SHA-constant fetch site and extract its
commit segment for the existing exact 40-hex assertion. Do not change detector
scope, exclusions, waivers or the mutation prover. Run the scanner and retain
the existing proof that an unpinned fetch is rejected before publication.
