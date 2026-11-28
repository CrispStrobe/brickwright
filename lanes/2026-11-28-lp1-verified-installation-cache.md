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

**63 focused controls pass on Node 24.22.3, with no skips:**

- Existing download/GPL boundary, shared inventory and output guard: 32.
- Native distribution policy: 14, including all eight profiles and denial
  before network access.
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

PR #1856's initial official build and its nine LP1a controls passed. Its Pico
prerequisite is now merged through
[sb3-creator PR #260](https://github.com/CrispStrobe/sb3-creator/pull/260),
after upstream lint/test/build and browser success. Consumer candidate
`bb557027ba0b8efef41c9b78a5193b9f5992ce8e` adopts the preserved minimal
revision and passes the complete hosted
[vendor-freshness job](https://github.com/CrispStrobe/brickwright/actions/runs/46141726925).
That job includes upstream byte identity, transpiler, examples gallery and
runtime gallery pins; the inherited Pico blocker is cleared. Its independent
remote discovery repair has 13 passing real CLI controls.

Earlier broader unit/integration failures remain unresolved. Their available
failures are in unchanged integration inputs; this receipt does not claim a
complete baseline rerun or waive any gate.

Component/runtime/output license statuses stay explicitly pending. Explicit
development mode, arbitrary direct Node staging and physical-device behavior
are not covered by this managed optional-installation guarantee.

## Discovered fetch-pinning prerequisite

Hosted qualification at `eadf983a7f327e51b073562e4ffe537f21a76abc` finds the
new integrity manifest's SHA-addressed raw GitHub origin absent from the
repository's fetch-site census. This is an LP1b integration omission.

This lane also owns the bounded declaration in `test/fetch-pinning.test.mjs`:
register the inventory origin as a SHA-constant fetch site and extract its
commit segment for the existing exact 40-hex assertion. Do not change detector
scope, exclusions, waivers or the mutation prover. Run the scanner and retain
the existing proof that an unpinned fetch is rejected before publication.

### Qualification correction

The actual optional download origin remains `https://crispstrobe.github.io/sdcc-wasm/`.
The new URL is `integrity.sourceBaseUrl`, used as immutable provenance. The
fetch-site census records that distinction with a `source-link` row; the
existing `SHA_CONSTANTS` assertion now extracts and checks its exact commit
segment. The detector, exclusions, three-row waiver set and mutation prover
are unchanged. This corrects a failure introduced by LP1b, not an inherited
baseline defect.

Local complete scanner/prover execution remains unavailable: their unchanged
CAD pin input hashes require over 20 MB of absent tracked payloads, exceeding
this sparse workspace's free space. No missing payload or skipped input is
counted as a passing full gate. The combined candidate must pass the unchanged
hosted scanner and mutation proof before landing.

Bounded local proof uses the unchanged raw detector and pin-constant assertion:
the real manifest yields exactly the declared source hit; its full SHA passes,
while `main`, a seven-character abbreviation, an uppercase SHA and a missing
source URL all fail. The manifest is unchanged at blob
`84ea367a2bb149891829c2c930fb4d7478a5032f`. The initial provenance correction added
11 lines in `test/fetch-pinning.test.mjs`, reviewed at blob
`dc6f87ee7a928e883d41921106580c764f701384`; syntax and scoped whitespace pass.

## Combined-candidate census follow-up

Candidate `8d5e5673ecec3e4fba029e64cb430fb8bb73ed52` passes the complete hosted
bounded source suite in
[run 46142558391](https://github.com/CrispStrobe/brickwright/actions/runs/46142558391).
The fetch census then identifies the newly introduced offline gallery fixture's
URL template. Its nine-line declaration belongs to the gallery prerequisite
and is carried through both branches; no fixture URL is hidden or rewritten.

The combined gate blob is `ed89290ecc9e572935398328bfa281d0948f9f9b`.
Independent review confirms that all three raw sites in 16 changed/new code
files are declared. Existing detector/census assertions accept the correct
declarations and reject missing, changed and vanished fixtures. Their full
repository execution remains an unchanged hosted requirement.

The exact app, loader, inventory and worker subtrees remain those already
reviewed. Request the supported fast and thorough CI tiers for the corrected
candidate, preserving mandatory real-worker scenario and mutation proof.
