# Arcade qualification: isolate the preserved Tauri lockstep timing test

Status: DONE — source implementation; hosted isolation failed, Rust repair pending.
Owner: Arcade integration; Rust-source repair remains separately routed.
Isolated branch: `docs/arcade-tauri-lockstep-scheduling-20261029`.
Base: main `bea6ff04f43c4b053bf5f2bfd01bf21615fa7d8a`.

## Observed failure and hypothesis

The [Tauri unit job](https://github.com/CrispStrobe/brickwright/actions/runs/40801257415/job/123209645340)
failed the existing
`renode_brick_state::tests::lockstep_steps_land_exactly_one_quantum_apart_without_polling`
test: fastest exchange 2.555585 ms against its 2.5 ms assertion, median
7.627335 ms. The remaining result was 269 passed and 11 ignored.
The tested Rust file has the same Git blob as current main. Its original failed
observation is retained; the cause is not established by a green main or source
identity alone.

The bounded hypothesis is that unrelated parallel tests interfere with this
wall-clock observation. Run the unchanged test once in a separate exact Cargo
invocation after the remaining default suite. Preserve its assertion, samples,
protocol checks and failure propagation. A successful isolated run establishes
only that execution; it is not a general latency guarantee or a Rust defect fix.

## Owned scope

- `.github/workflows/tauri.yml`: only the test job's default Cargo invocation
  boundary. Run every remaining default test, then exactly the named timing
  test once with one test thread. Keep all clippy, peers, e2e and firmware jobs,
  pinned Actions, dependencies, permissions and resource limits.
- `test/tauri-lockstep-test-scheduling.test.mjs`: source-policy controls for
  complete selection, exact identity, mandatory ordering and propagated failure.
  Ensure the isolated command cannot pass by selecting zero tests.
- This claim and `docs/ARCADE-AGENT-HANDOFF.md`.

Preserve the Rust source and all existing assertions. No retry, threshold,
timeout, baseline, pin, runtime/model or firmware change. Do not take over a
native/source lane. The older Ubuntu mirror-preparation claim owns a separate
step, which remains intact.

## Qualification and next step

The unchanged isolated test subsequently failed on head `ae22d4a2618`:
[official job](https://github.com/CrispStrobe/brickwright/actions/runs/40813806300/job/123250070998),
fastest 2.591604 ms, median 4.736635 ms; the remaining default suite passed
269 tests with 11 ignored. Original evidence is retained once. Isolation alone
does not resolve the failure. Route a separately claimed Rust-source diagnosis;
do not retry unchanged or change the timing assertion. This workflow change
does not establish a source fix or any latency guarantee.

Register this checked Markdown-only claim on canonical main before changing
implementation. Validate privacy, claim shape and exact parent/tree scope.
The implementation joins the normally pushed Arcade integration candidate;
do not dispatch an extra Rust run. Require the enabled exact-head hosted Cargo,
clippy and e2e checks, all other enabled product checks, and verified landing
parents/tree before merging product changes.

The [Rust test guide](https://doc.rust-lang.org/rustc/tests/) describes exact
selection and test-thread controls. The [libtest filter implementation](https://doc.rust-lang.org/stable/src/test/lib.rs.html#577)
also applies exact matching to exclusion filters. Source-policy controls must
preserve complete coverage when splitting the two invocations. If isolation
still fails, retain that original and return to the separately owned source
diagnosis; do not retry or relax the gate.

## Source checkpoint

The remaining suite excludes only the full timing-test name with exact
matching. The following mandatory step selects that same library test once,
using one test thread and the unchanged Rust assertion. A pipefail-protected
Cargo/tee pipeline preserves failure, and an exact named-pass counter refuses
zero, wrong or duplicated executions. Existing peers and clippy commands stay
intact. No Rust source changed.

Three bounded source controls pass, including actual shell execution against
an authored Cargo-output control. Removing pipefail, the nonempty/count guard
or exact exclusion is detected; original bytes are restored. These controls
invoke no compiler or guest. The scheduling hypothesis still requires the
normal integration candidate's hosted Tauri result. Preserve the original
failure and return to source diagnosis if that isolated execution fails.
