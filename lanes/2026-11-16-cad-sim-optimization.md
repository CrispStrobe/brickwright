# CAD SIM robot optimization and integration

Status: CLAIMED, 2026-11-16.
Owner: Codex, user-requested CAD SIM continuation.
Branch: `feat/cad-sim-optimization-20261116`.
Base: Lite main `6e8f065c6798cc4bfa1261f5c9413e69c4cbf367`; integrated CAD starting head `79bb97e3e182141459bb2297f1acc3e1366e0ec7`.
Worktree: isolated checkout on the named branch.

Scope: reconcile all recent Lite commits, open PRs and feature branch heads without discarding their work; preserve the latest compatible upstream CAD SDK and pinned dependencies. Optimize Lite-owned CAD/circuit robot controls and simulation lifecycle in `overlay/scratch-gui/src/lib/bw-cad-*`, `overlay/scratch-gui/src/components/tw-pseudocode/cad-*.{jsx,css}`, their generated tracked package mirrors, focused tests and CAD verification scripts. Any reusable CAD physics/worker optimization belongs in `CrispStrobe/brickwright-cad` first, with an exact committed SDK pin here.

Qualification: focused behavioral tests, integration and mirror/hash checks, and bounded local browser/physics checks where dependencies permit. The user explicitly requires incremental remote branch checkpoints and proceeding without waiting for GitHub Actions because its free-tier queue is starved. Hosted checks are not awaited or represented as passed. No release or deployment is included.
