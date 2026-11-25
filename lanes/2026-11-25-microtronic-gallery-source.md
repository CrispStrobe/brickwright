# Microtronic gallery source adoption — CLAIMED, 2026-11-25

Owner: the coordinated Microtronic integration session, requested by CrispStrobe.
Consumer PR: #1846. Canonical base: `dc8b60e28e1161cdbb2bfe6c18f9f1e4253a6a10`.
Investigated candidate: `ad492c7ac87d2ca393e0da9ceed4d96a3da16563`.

The incoming main gallery addition is runnable in the production browser but
fails the actual vendor-freshness examples-gallery step: the pinned
`sb3-creator` tree has no `busch-microtronic-wired-io` files and its canonical
index therefore differs. Preserve the working gallery entry and repair its
source ownership in the owning package.

Own the following narrow package boundary and its normal adoption:

- In `sb3-creator`, `examples/busch-microtronic-wired-io/circuit.json`,
  `intro.md`, `intro.de.md`, the required `EXPECTED.md`, and the canonical
  example registration/index generator inputs for this same wired experiment.
- In `sb3-creator`, `test/fixtures/siblings.json` and its two matching sibling
  checkout refs in `.github/workflows/ci.yml`, only to select the already
  qualified Microtronic-capable Board `cc18f3c8d84d68e008450e65ddf838b8ec03c7f7`
  and UI `0a1b15edb0daecd723c7c07126450d84b86e3e68` for the existing whole-corpus
  circuit-load and parameter-consumption gates. Verify ancestry or review the
  exact delta from the former sibling inputs; preserve all their assertions.
  Brickwright's Board and UI package pins remain unchanged.
- If the existing upstream provenance gate requires it, the normal generated
  `examples/*/EXPECTED.md` records for that same sibling pair. Remeasure against
  the declared qualified inputs; do not hand-restamp observations. Review any
  numerical delta against the prior inputs, retaining all thresholds, assertions
  and historical source records. No workflow structural or selection change.
- In `sb3-creator`, `test/circuit-params-are-read.test.mjs` only to activate
  Microtronic through its public Run control and observe a sufficient simulated
  interval for the declared instruction rate. Other benches retain their current
  sampling. Keep all parameter assertions, thresholds and `KNOWN_INERT` entries
  unchanged; a disconnected or rate-ignoring model must still be rejected.
- In Brickwright, the exact `sb3-creator` pin and the normal compiler/gallery
  sync outputs, required mirrored/generated current-pin records and focused
  adoption evidence. Review incoming upstream changes before choosing the pin.
- This claim's completion and the Microtronic usage/qualification receipt.

Do not remove the incoming gallery, hide an orphan, loosen the sync judge,
add a host-only example exemption, or change extension-content policy. Keep
Board and Circuit UI at their already qualified Microtronic commits. Preserve
all current CAD, CP1, KIM-1 and other lanes. The native TMS1600 and cleanroom
firmware phase remains deferred.

Qualify the upstream example registration and generated index, preserve
computed compatibility metadata, run the appropriate existing upstream tests,
and publish the owning change before adopting its exact source identity.
Use the normal explicit pin-and-sync transaction for both compiler and gallery.
The host's real `sync-examples --check`, compiler identity, mirrors, pin-history
and vendor-freshness checks must pass with no exclusions. Recheck the actual
gallery-to-wired-I/O browser path if the generated example changes. Retain the
failed CI observation; an unchanged rerun is not a repair.

## Review candidate; adoption blocked

The narrow upstream example is published as explicitly blocked
[draft PR #237](https://github.com/CrispStrobe/sb3-creator/pull/237),
commit `0491192eaff4a99fdb19ea5a4a567f0c810d9623`,
tree `0065d5abf658d6ca0e4b490485175fec297269bb`.
Before publication, upstream main advanced to
`b76c34e38e58ad1e1bcf5dfd9f4b0dec0ed2e37f`. Preserve its Board test input
`e744ede765c76ce15b9e5c101aa23f56210eab09` unchanged; it descends from the
qualified Microtronic engine. The final draft therefore changes only the still
older UI sibling fixture and its matching CI ref to `0a1b15edb0daecd723c7c07126450d84b86e3e68`.
Brickwright's Board/UI and SB3 pins do not move.

The draft preserves all 792 incoming EXPECTED pages and 796 existing catalog
and enrollment entries. Its nine changed files contain only the new example,
required registration/expectations, UI test input and Microtronic observation.
The new experiment passes all switch combinations and both clock phases,
halt/reset/save behavior, and the real instruction-rate observation; a
constant-rate mutation fails. Seven gallery checks pass, with eight ordinary
no-program skips. The focused draft measurements use the retained upstream
Board input; the host production receipt remains tied to Board `cc18f3c8`.

The original upstream baseline's failures are retained in the draft review.
Recent upstream fixes are preserved without claiming a fresh all-green full
suite. Corpus-wide provenance remeasurement and full upstream qualification
remain pending. `docs/UPSTREAM-WIP.md` permits publishing a candidate plus its
unresolved findings for review; adoption still requires the upstream change to
land and the source identity/mirror gates to pass. Keep this lane claimed.
