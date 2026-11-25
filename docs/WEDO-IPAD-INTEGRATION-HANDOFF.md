# WeDo / iPad / CPX integration handoff — 2026-10-18

This is the current delivery record; older session notes are historical. Follow [LANES.md](../LANES.md) for claims and qualification (a claim is a new `lanes/<YYYY-MM-DD>-<slug>.md` file; never edit LANES.md), and the [owner queue](OPEN-TASKS-2026-09-29.md) for other work. Machine paths, device identifiers, signing details, screenshots, build receipts and continuation commands belong only in the **gitignored local `CLAUDE.md`**.

## Landed source

- WeDo LED support is on extensions main through [PR49](https://github.com/CrispStrobe/extensions/pull/49), adopted by Lite [PR980](https://github.com/CrispStrobe/brickwright/pull/980). External 88005 uses motor power with selectable polarity, independently of the hub RGB light. Brightness defaults to 100%; no motor-speed curve caps it.
- WeDo connection recovery [supplier PR50](https://github.com/CrispStrobe/extensions/pull/50) merged as `c0223a134d1be45dbe939a3f078224f22229b71f`. Published immutable source `98eca46ed343ffe186e737062fdc68716f28ca6c` adds bounded waits, failed-attempt cleanup, stale-callback rejection and concurrent-attempt protection. It permits a clean subsequent Connect without restarting the app; it does not automatically retry indefinitely. Lite adoption claim [PR1059](https://github.com/CrispStrobe/brickwright/pull/1059) merged before implementation; the pin and canonical wrapper landed in [PR1050](https://github.com/CrispStrobe/brickwright/pull/1050), merge `fc385cada4d2ff6aab21e22bdcc38dc696d9c787`.
- STM32 composition [PR1017](https://github.com/CrispStrobe/brickwright/pull/1017) **merged** as `97e359ef4f0f01c51bdf85b6de62fa012cb24da7`. Its earlier pending-CI instructions are obsolete. Do not restart the historical source controller or open a competing adoption.
- A12 CPX MakeCode translation landed through [PR1009](https://github.com/CrispStrobe/brickwright/pull/1009): ten exact-parity programs and five explicit timing-boundary controls. A13 live ring/buttons/switch and File Open/Save repair landed through [PR1015](https://github.com/CrispStrobe/brickwright/pull/1015), with subsequent [PR1057](https://github.com/CrispStrobe/brickwright/pull/1057). D13 remains a separate producer-first task.
- SimLab's subsequent composition [PR1058](https://github.com/CrispStrobe/brickwright/pull/1058) merged as `fa7f69bdf076312d53ab2b3e28651af1c1e40d4b`. Preserve its new physics host/actuator layout when composing main.
- iOS signing and duplicate-resource repairs landed, including [PR1020](https://github.com/CrispStrobe/brickwright/pull/1020). The latest actually installed snapshot at this checkpoint is source `fc385cada4d2ff6aab21e22bdcc38dc696d9c787`, 84.36 MiB, strict-signed for physical iOS with the qualified frontend embedded and no duplicate frontend `assets` or `libapp.a`. WLAN installation succeeded on 2026-10-18; automatic launch was denied because the iPad was locked. This delivers the qualified PR1050/recovery snapshot, not a rebuild of subsequent main. The earlier `bc5685b9` artifact and receipts are retained. Physical caret acceptance remains pending; do not infer visible success from browser geometry or installation.

## Current source qualification

[Lite PR1050](https://github.com/CrispStrobe/brickwright/pull/1050) normally composes current main and the published WeDo recovery pin. It fixes iPad tab widths and EN/DE menu labels, moves the collapse control outside the clipped scrollable tab list, and preserves fullscreen hiding. Two genuine browser failures were repaired: the phone menu height is within the existing 44-pixel allowance, and About credits load as a separate local chunk to satisfy the unchanged startup-JavaScript budget. A browser check deliberately fails the credits request and verifies retry plus the complete credit list. No size budget was increased.

Final source `8b7ae49e239cbfa2e790c50ca0efd48f62046c10` passed every enabled exact-head check, including both full unit shards, both browser suites, production build, corpus, FPGA, supplier freshness and native end-to-end/contract tests. [PR1050 merged normally](https://github.com/CrispStrobe/brickwright/pull/1050) as `fc385cada4d2ff6aab21e22bdcc38dc696d9c787`; the merged tree matches that qualified source. The production GUI and physical-iOS compilation for that merged snapshot also completed. Original `errSecInternalComponent` failures and the expired signing continuation are retained. On 2026-10-18, the frozen compiled identity was reverified, a separate copy was signed in one bounded attempt and its strict signature was verified before WLAN installation succeeded. The shared compiled original was preserved; no rebuild was needed. The old continuation treated an absent screen-lock property as locked; the replacement relies on the actual signing result. Launch failed with the explicit device-locked error, so foreground and physical acceptance remain pending. Focused local controls passed (51). Canonical dependency provenance, the exact-source production build and unchanged startup ownership gate pass (4.25 MiB initial JavaScript). Eight EN/DE Chromium/WebKit painted-icon checks, twelve responsive-control observations, phone-fit in both orientations and About credit failure/retry/full-list checks pass on this new bundle. These browser checks do not establish physical iPad acceptance. Read the PR and current remote main before acting; do not restart a controller with an obsolete expected head.

## Remaining work, in order

1. **Launch the installed integrated snapshot.** Signing, strict verification and WLAN installation are complete for `fc385cada4d2ff6aab21e22bdcc38dc696d9c787` (84.36 MiB). Dependency: unlocked iPad; its locked state prevented automatic launch. Open Brickwright or retry launch once unlocked, retaining the existing signed artifact and installation receipt. Do not rebuild, resign or reinstall this unchanged snapshot merely to retry launch. Done when foreground launch is observed; physical toolbar and hub acceptance remain separate.
2. **Accept iPad UI and connection recovery.** UI dependency: unlocked iPad with Brickwright in the foreground; the hub is needed only for connection cases. Capture the expanded toolbar with no video overlay, inspect a visible chevron, activate collapse and inspect ellipsis; verify tabs fit in both orientations, German menus, fullscreen exit and offline startup. Separately test cold app launch, first connection, timeout/cancel, immediate retry and disconnect/reconnect without restart. Record actual results rather than infer them from deterministic mocks. If native Bluetooth readiness/session teardown still fails, claim that native work separately before implementation (see next item).
3. **Native Bluetooth follow-up if reproduced.** A deterministic review of the native-channel JavaScript bridge now reproduces
   cancellation and listener-cleanup defects independently of hardware. The
   cancellation/reconnect claim [PR1087](https://github.com/CrispStrobe/brickwright/pull/1087)
   merged before implementation. Its JavaScript candidate now passes 28 bridge
   controls, including seven which fail on the baseline. Cancellation cannot
   reopen a closed socket, listeners are released, old native close completes
   before reconnect, and a live owner cannot be silently replaced. Full hosted
   qualification, source merge and delivery remain pending; the installed app
   does not contain this candidate. A rejected native close blocks unsafe reuse;
   a native call which never settles still needs the separate native work.
   Native Rust/Swift readiness and session ownership retain the envelope below.
    Ownership envelope to claim: iOS bridge readiness acknowledgement and bounded error delivery, per-connection generation/session ownership, pending operation rejection on close, and deterministic stale-callback/overlap controls. Begin with logs from one failed cold attempt and successful retry; distinguish WebSocket readiness, discovery, pairing and notification initialization. Preserve the extension's bounded single-attempt semantics; do not add arbitrary long sleeps or concurrent automatic retries. Done when real cold/retry/reconnect tests pass without restarting the app and stale callbacks cannot operate on a newer connection.
4. **Accept 88005 on the clone.** Dependency: same hub and iPad, physical port A populated, B empty. User confirmed the external lights work. Direct full-power output was visibly brighter, but the earlier app brightness value is unknown. Verify app values 100/50/0, both logical port choices, polarity, Stop All and disconnect/reconnect. Last direct observations: physical A maps to numeric port 2 (logical B); negative 100 lights the pair brightly, negative 50 dims it, zero turns it off; numeric port 1 did not light it. Preserve selectable polarity; do not globally reverse genuine-hub mappings or mistake green hub RGB for the external pair. Done when the app reproduces these results and stops power reliably.
5. **Clone buzzer investigation remains bounded and hardware-dependent.** The user confirms connection beeps, so working sound hardware is established. Remote tone commands remain silent after correct output-characteristic tests using LEGO/OpenRoberta, Python and actual node-poweredup. See [protocol notes](WEDO-HUB-PROTOCOL-NOTES.md). No Powered Up service was exposed, so sending the other protocol blindly is unsupported. Next optional experiment, only with an available hub/listener: keep one legacy connection and outputs off, wait out connection chimes, compare Python-style notification initialization with the existing path, then send a short distinctive pattern and stop. Prepared unsubscribe/reset probes did not reach the hub and are not negative evidence; a generic reset is not an established piezo-enable command. Retain exact frames and observation privately. Stop if still silent; compare a genuine hub or obtain firmware-specific command evidence before further commands. No compatible replacement firmware, identified clone chipset/bootloader or recovery path exists. No flashing is scoped. Done when a reproducible remote tone is heard or the remaining firmware limitation and exact negative experiment are documented.
6. **D13 requires upstream producer support.** The runtime does not publish red-LED state. Claim extension producer state/opcode and tests first, then circuit-UI consumption and immutable Lite adoption. Done when actual native blocks drive D13 and pane/face agree in a real browser with negative controls. Never derive D13 from the ten-pixel ring or count it as completed A13 coverage.
7. **Further size work is optional.** Duplicate frontend/archive resources are already removed. About credits now leave startup JavaScript while remaining packaged. PNG/GIF source totals are not additive to compressed app size; a previous recompression audit suggested only about 0.42 MiB. Any new asset audit needs a separately claimed scope, measured signed-app before/after, visual/offline checks and no unapproved feature removal.

## Repository reconciliation

The relevant default remote refs were fetched. Clean default-branch checkouts for Android, iOS, Tauri, SPIKE firmware and Scratch GUI foundation were verified current. The iOS repository's default is `turbowarp-lego-ios`, not `main`. Dirty/diverged/nondefault checkouts and the pinned detached compiler checkout were preserved. This is not a claim that every local branch was rebased. Remaining repository work is owner-dependent:

- `brickwright`: the default `develop` comparison was 78 behind / 2 ahead while the active `gh-pages` checkout had edits. Review those two commits in an isolated checkout with that owner, compose current `develop`, and run its build before publishing. Preserve the active site's edits.
- `scratch-lego-bluetooth-extensions`: the retained backup/default comparison was 28 behind / 9 ahead of `master`. Review the nine retained commits and reconcile them in an isolated branch; do not discard or publish unknown work automatically.
- `cs-extensions`: the active `feat/rcx-download-to-brick` checkout belongs to another lane. The separate owned WeDo worktree is current with supplier main; the RCX owner must compose its own branch.
- `sb3c`: the clean detached checkout was three commits behind main. It is a pinned supplier; any advance requires review and the canonical immutable pin/adoption workflow, rather than a pull on the detached checkout.

These counts are snapshots, not permanent targets. Refresh actual default refs, current ownership and branch status before acting. Done when each owning lane has reconciled and qualified its own work, with its edits preserved; no blanket history rewrite is scoped.

Other owners retain AVR C9, H1–H7, Array, CPX firmware B19–B22 and release ownership. Do not tag/publish a release from this handoff.

## Buzzer documentation

The [OpenRoberta output codec](https://github.com/OpenRoberta/app-ios/blob/6639a2d3d0e47fcfb69b138bb4790b3ab2ff5d3c/LEGODevice/LEGODevice/LEOutputCommand.m) and [tone player](https://github.com/OpenRoberta/app-ios/blob/6639a2d3d0e47fcfb69b138bb4790b3ab2ff5d3c/LEGODevice/LEGODevice/LEPiezoTonePlayer.m) use piezo command 02 with four-byte frequency/duration and command 03 to stop. The Python codec and node-poweredup send the same valid tested frames; no established extra enable sequence has been found. [Pybricks maintainers](https://github.com/orgs/pybricks/discussions/658) explain that genuine WeDo 2 cannot run Pybricks. That does not identify this clone's update mechanism or a compatible firmware image.


### Robot Lab preview repairs — 2026-10-21

Axis Plotter's automatically loaded calibration program now uses loops and
shared receivers instead of thousands of expanded blocks. Native motor feedback
still draws the square and detached diagonal. A collapsible live ink view exposes
the measured floor trace when the machine occludes it. Vendored file-index lookup
eliminates failed primitive probes. Static extension definitions survive identical
refreshes, while language, theme and menu changes replace the appropriate factory.
Camera following uses the main frame's translation rather than changing bounds,
so rotating governor arms no longer shake the view. Explicit part following works
as before. Rigid assembly notes group repeated part names and clarify their scope.

Production build and 67 focused controls pass. Real-worker Chromium and WebKit
checks pass cold automatic loading, no post-display blanking, no DAT failures or
duplicate-definition warnings, both physical strokes (257/53 points), and governor
camera stability below 0.02 mm. This is local source/build qualification in draft
#1138; main composition and exact-head hosted CI remain release gates. Phase
Bridge and Magnetic Chess intake remains in progress separately.

### Phase Bridge intake — locally qualified

Two original CrispStrobe / BSD-3-Clause double-Cardan comparisons are bundled.
Equal bends cancel the outer-shaft speed ripple with correct phasing; rotating
the second fork assembly by a quarter turn makes the ripple accumulate. The
actual hinge/cross solver is adopted from the already published universal-joint
implementation, preserving existing core fixes. It does not prescribe shaft poses.
The 144 explicit placements need two inferred crosses, for 146 physical pieces;
lessons and notices distinguish the placement BOM from this physical total.

Eight geometry/native-program/stress controls pass, including frozen-output
negatives, as do fourteen affected registry/lesson/lazy-load controls. Chromium
and WebKit actual-worker native programs, manual A, 64-page connected manuals,
144-placement BOMs and bilingual lessons pass. Maximum measured angle-law error
is below 0.020°, with roughly ±6.38° intermediate variation and ±12.70° misphased
output variation. Production build, adapter reproduction and vendored-asset
freshness pass. Export grows to 48 assemblies and 56 choices. Magnetic Chess is
still being adapted and has no functioning-library claim. Draft #1138 still
requires current-main composition and exact-head hosted CI before release.
