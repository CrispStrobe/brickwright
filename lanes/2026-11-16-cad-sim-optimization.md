# CAD SIM robot optimization and integration

Status: DONE, 2026-11-16; implementation and local qualification saved on the continuation branch for review.
Owner: Codex, user-requested CAD SIM continuation.
Branch: `feat/cad-sim-optimization-20261116`.
Continuation branch: `feat/cad-sim-optimization-resume-20261116`.
Base: Lite main `6e8f065c6798cc4bfa1261f5c9413e69c4cbf367`; integrated CAD starting head `79bb97e3e182141459bb2297f1acc3e1366e0ec7`.
Worktree: isolated checkout on the named branch.

Scope: reconcile all recent Lite commits, open PRs and feature branch heads without discarding their work; preserve the latest compatible upstream CAD SDK and pinned dependencies. Optimize Lite-owned CAD/circuit robot controls and simulation lifecycle in `overlay/scratch-gui/src/lib/bw-cad-*`, `overlay/scratch-gui/src/components/tw-pseudocode/cad-*.{jsx,css}`, their generated tracked package mirrors, focused tests and CAD verification scripts. Any reusable CAD physics/worker optimization belongs in `CrispStrobe/brickwright-cad` first, with an exact committed SDK pin here.

Qualification: focused behavioral tests, integration and mirror/hash checks, and bounded local browser/physics checks where dependencies permit. The user explicitly requires incremental remote branch checkpoints and proceeding without waiting for GitHub Actions because its free-tier queue is starved. Hosted checks are not awaited or represented as passed. No release or deployment is included.

## Recovered continuation

The original checkpoint `b85ffc5334fa338c08d812f0a9656c59a12dc3a6`
is already an ancestor of current Lite main
`259a563d71391f8b310b2c4b7fb2d3bb4d607971`. Resume from that current
main, preserving the compact 200 Hz feedback, panel optimization and newer
qualified CAD SDK `fb8c3671aef1a2d5dc3673e7eb04bde38cc3f77b`.

Bring forward the public Mantis project packager and packaging tests from
`59376b45ced382c3a9f8dcadddc9bd876c8e9b58` while retaining the current SDK.
The older walker SDK lacks the newer library cohort. Mantis's generated
sequential movement program has not been physically qualified; its model stays
on the upstream feature branch. Kestrel's recorded gripper failure and the
dependency-tooling deferral remain in force.

Completed: Stop/disposal cancels pending Circuit readiness and ownership waits;
cancellation during initial CAD sensing immediately releases circuit ports and
clock ownership. Late success/failure cannot disturb a restarted run. The newly
pushed x86 current/historical pin correction was integrated at `77b392bcb`.

Fresh local qualification: 57 CAD integration tests and six focused x86 identity
controls pass. The unchanged shipped Jolt worker produces 100 identical control
samples and 25 identical complete frames at 200 Hz with 71.1585% fewer serialized
feedback bytes. The production CAD+FPGA build passes in 360,957 ms with zero
errors and two size warnings; all ten packaged SDK hashes verify. Canonical
dependency, mirror and integrated-source checks pass.

The [continuation evidence](../docs/evidence/2026-11-16-cad-sim-continuation.md)
and linked dated receipts record exact identities, reproduction and limitations.
Chromium cannot start under this executor's Unix-socket policy, so no fresh
browser pass is claimed. GitHub Actions were not awaited, dispatched or rerun.
No deployment or native application release is included.
