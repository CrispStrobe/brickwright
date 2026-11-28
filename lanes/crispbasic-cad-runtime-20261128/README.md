# Required CAD physics runtime gate — 2026-11-28

Base: `3f1f9a41d6d986027b41bcec9eb29e55ac1d8331`.
Failure: [unit shard 6 job 141103859713](https://github.com/CrispStrobe/brickwright/actions/runs/46185229797/job/141103859713).

Four real CAD physics tests were in the root-level fast source suite, where the
unit workflow does not build BBCSDL WASM. They failed because
`packages/crisp-basic/.build/wasm/crispbasic.mjs` did not exist. The dedicated
CrispBASIC WASM job already builds both real interpreter backends and verifies
their provenance and lifecycle before running integration tests.

The four tests now live in `test/crispbasic-wasm/cad-physics.test.mjs`. Their
assertions are byte-identical after normalizing the one changed relative fixture
import. The same WASM job explicitly executes that file once after its build and
existing integration step. Both push and pull-request path filters include the
runtime test directory. Missing runtime files still fail normally; there is no
skip, replacement physics, conditional job or softened exit status. The existing
broad integration globs do not match this new directory, so execution is not
duplicated and no additional SDK installation is needed.

The fast suite retains clock, electrical solver, cancellation and source tests.
A new fast route guard verifies the exact runtime command, working directory,
build-before-test order, hard job/step status, both path triggers and downstream
production dependency. Fourteen workflow mutations prove those checks reject
missing, misplaced, disabled or softened execution. Existing fast shard and
census tests continue to pass without changing their selection logic.

Fresh local qualification:

- Built the exact board prerequisite's WASM source with pinned Emscripten
  3.1.64 and permitted BBCSDL `6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f`.
  `createCrispBasicPackage` authenticated all recorded source, artifact, notice
  and import hashes. The newer integration runtime was not substituted for this
  build: its builder includes a later memory-alias flag.
- All **4 real physics tests passed**, with no skips. They execute BBC BASIC,
  the saved Scout electrical circuit, the public CAD controller and the shipped
  geometry/Jolt worker, including reversed motor leads, retained-world reuse and
  cancellation after command submission.
- All **83 focused source and routing tests passed**, with no skips: the three
  new CI route tests, existing unit shard/census checks, CAD clock checks,
  circuit cancellation and CrispBASIC circuit-session tests.

`runtime.json` records the exact runtime hashes, original/moved test hashes and
CAD producer/manifest identity. `physics.log` and `source-guards.log` retain the
actual test output with workspace paths normalized. No browser or physical
hardware execution is claimed by this qualification. Exact composed-head hosted
unit and WASM gates remain required before landing.
