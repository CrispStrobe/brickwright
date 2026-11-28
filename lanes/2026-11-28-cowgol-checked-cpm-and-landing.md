# Cowgol checked CP/M surfaces and landing — 2026-11-28

Status: active. Owner: ChatGPT, at the repository owner's request.
Branch: `feat/cowgol-platforms-20261128`; continuation checkpoint: `689feabf5d68086865448ecdb362ceecf0b00df4`. Default-branch base at claim: `f93b83ce4fda4525eea79d54bc8b036078bfb1a1`.

Continue the already claimed Cowgol platform integration. Expose the qualified 8080-compatible CP/M compiler to checked pseudocode/Blocks source on the existing Z80 machine, including serial/display OS routes and checked COM download. Preserve exact target validation, current-source ownership, cancellation, distribution policy, and truthful CPU identity. This adds user surfaces for an existing compiler; it does not claim a new 8080 emulator or an ARM runtime.

Owned implementation paths: the Cowgol methods and menus in the pseudocode importer, the shared `bw-lang/cowgol-compile.js` target selector, and their tracked mirrors; Cowgol computer/download/ownership tests and focused native witnesses; `docs/COWGOL.md`; this lane and the existing Cowgol platform lane. No producer or machine-engine pin movement is planned.

Landing prerequisites are limited to the concrete failures observed in the existing Cowgol evidence workflow: browser-gate invocation accounting (`test/gate-coverage.test.mjs` and its direct helper/tests), the added ambient-dependency site reported by the gate-shape audit, and the newly introduced fixed delay reported by the wait census. Repair causes or document genuine existing manual coverage with source evidence; do not raise ceilings, remove refusal checks, invent execution receipts, or treat unrelated open PRs as qualified. Preserve other active lanes; broader unrelated failures remain explicit landing blockers.

Use the existing one-use Cowgol evidence workflow to regenerate canonical reader/workflow evidence, retain exact supplier and mirror identity, and remove that workflow only after its qualified final tree is verified. Save implementation checkpoints to GitHub and merge through the normal enabled pull-request checks, with guarded head identities. Existing merged runtime, compiler-service and producer revisions remain authoritative.

Qualification: actual editor-method tests for both compiler variants and serial/display/download routes, wrong-target/device refusal, policy and stale/cancelled build behavior; existing exact-machine HTTP/CLI qualification; meaningful negative controls for repaired gate accounting; unchanged wait/gate-shape budgets; canonical generated evidence and ordinary enabled PR checks. Software/emulator execution does not imply physical hardware or deployment qualification.
