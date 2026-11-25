# x86 GUI checkpoint and task handoff

Updated 2026-10-27. Shared CPU/device work belongs in bw-board; UI behavior belongs here. Start with the [board checkpoint and seven implementation lanes](https://github.com/CrispStrobe/bw-board/blob/master/docs/X86-NEXT-LANES.md), [GUI guide](I80386-GUI.md), [loading scope](X86-LOADING-SCOPE.md), and [generated language/device matrix](generated/LANGUAGE-DEVICE-MATRIX.md). Refresh both default branches and inspect completed receipts before repeating a task.

## Current handoff (2026-10-28)

This section is the current handoff. Older dated sections below remain historical
records. Lanes 2 and 3 of the 2026-10-27 handoff are finished; lane 1 is the
only open x86 lane, and three optional follow-ups are scoped after it.

### Done since 2026-10-27

- **Board read16 fast path measured and adopted.** The bw-board
  [paired-v2 plan](https://github.com/CrispStrobe/bw-board/blob/master/docs/I80386-READ16-PAIRED-V2-PLAN.md)
  was claimed (board PR712) and implemented (PR714, path fix PR716). One admitted
  hosted capture, [run 40531608266](https://github.com/CrispStrobe/bw-board/actions/runs/40531608266),
  ran 18 children of ten million retirements on one Intel Xeon Platinum 8370C
  runner. The standalone reader admitted it: all architecture/device goldens
  passed; CPU A/B median **1.0685**, minimum **1.0509** (every pair > 1), wall
  B/A median **0.9365**. Gate PASS. The one capfit attempt before it,
  run 40490918699, failed before measuring (harness path bug) and is retained.
  The five-line contiguous-page `size === 2` arm of `_readLinear` was then
  adopted in board PR718 (merged `8785e4688cc308b34fea434c1734523caa621f74`)
  after every enabled exact-head check, including the full tier and the
  x86-xv6 protected guest job. This is an authored-loop result only: no
  physical 386 timing, whole-OS or general-workload speed claim.
- **Lite consumes it.** [PR1503](https://github.com/CrispStrobe/brickwright/pull/1503)
  moved the board pin from `c7bcbe4b` to `8785e468` on all current-role surfaces
  (merged `e6fa377008c677b6dcd24f177453d4118955666d`, all 38 enabled checks
  including the full browser tier). `vendor-pins.json` now selects board
  `8785e4688cc308b34fea434c1734523caa621f74`.
- **Protected-mode VM86 common-context fixture reached.** Board PR713
  (merged `4c793d1d6fe68c1d36e8f43694c16026928a2ad7`) compares the ordinary JS
  CPU with Bochs CPU3 on one frozen VM86 context. Its finite-fixture boundary
  is unchanged: no full-OS or enhanced-mode claim.
- **Process deviation, recorded.** Board PR715 (the paired-v2 request file)
  merged while its "full CI requested" tier gate was red, because `ci:full` had
  been removed under a later-reversed instruction. All its other checks
  passed, and PR718's full tier on a later base was entirely green.

### Lane 1: close current GUI qualification first (PR1540)

**Status 2026-11-02.** PR1540 merged into main as
`86f95bbd4833f877363488ad2bf122c592256fff` with its source-arming flags; no
Actual-V9 event, ACK or guest acceptance has occurred, so the GUI HDD and
forward-debug result remains unqualified. Since that merge, pin moves on main
re-stamp `FINITE_V10_PINS` in the producer and reader, so their bytes now differ
from the PR1540 head; every external admission and private controller must bind
the reader, producer and pins of the selected event head, not of PR1540.
The prelude guard requires an *open, ready* pull request whose head equals the
dispatched lane branch head, so the merged PR1540 can no longer carry an event.
A successor pull request on a `lane/` branch carries the event; it must pass
every enabled exact-head check (with `ci:full`) and bind its own successful
Build artifact before selection. Steps 1-5 below otherwise apply unchanged.

The first successor event (run 41449169306) failed its source guard before any
setup, inventory or ACK: GitHub omits empty-string dispatch inputs, so the
event lacked `request_sha256` and `tag_name`. That slot is spent. PR1627 now
admits exactly the omitted form as well (see
[the claim](../lanes/2026-11-02-x86-actual9-dispatch-inputs.md)); a new event
needs its own selection, Build and audit.

**Scope:** [PR1540](https://github.com/CrispStrobe/brickwright/pull/1540),
the successor to the now-closed PR1318. Start with
[`lanes/2026-10-28-x86-finite-v10-resolver-kind.md`](../lanes/2026-10-28-x86-finite-v10-resolver-kind.md),
`scripts/run-i80386-hdd-gui-actual.py`,
`scripts/read-i80386-hdd-gui-originals.py`, their tests and
`.github/workflows/i80386-hdd-gui-actual.yml` at the actual candidate head.
The initial published checkpoint is `4257afa4052c4b14667ac4c54f482b2cc0cb1c40`;
obtain PR1540's current head from GitHub before acting.
Main's older producer is not this prepared implementation.

The published test-only repair at `6da13f73194b316d2c4030c7c82ac161e9035474`
binds the merge-history regression to the system Git executable and verifies
that a hostile executable on `PATH` is ignored. The 34 pin controls and 11
static gate controls pass; the scanner baseline remains unchanged. This fixes
one CI failure and does not qualify the GUI guest or establish a speed result.

Prepare the final qualification as one source head: complete the source/event
admission and one-shot controller review, make the PR ready and apply `ci:full`
**before** pushing that final source. Then admit its single synchronize Build
with both tiers enabled. Do not combine a prior head's checks or treat a skipped
browser tier as success. If readiness or label events create multiple Build runs
on the selected final head, stop and review the cohort instead of relaxing the
single-run admission rule. Current unarmed checks are preparation evidence.

**Do not select V9 again.** Its one selected hosted attempt failed because the
resolver was a symlink; the earlier V8 attempt had required a symlink and found
a regular file. Both attempts are consumed and their failures remain retained.
The [V10 claim](../lanes/2026-10-28-x86-finite-v10-resolver-kind.md) is on
main and its implementation has a reviewed source-arming candidate in PR1540.
Its activated source flags do not authorize an actual event; separate source,
Build, reference and once-only operational admission is still required. The owner-released sealed-study repair passes 83 affected source controls;
hosted checks and actual guest acceptance remain pending. Keep the resolver in the complete observed runtime graph, bind the
explicit selected branch and endpoint, and reject unknown targets or drift.
A different actual runner must still satisfy the frozen request; supporting two
inventory forms does not establish cross-job byte or role stability.

**Same-job acceptance is required.** Supporting two resolver forms does not
make either form transferable to a different hosted machine. The new claim
therefore includes a distinct Actual-V9 prelude: capture the V10 inventory on
the retained actual job, finalize its early artifact, obtain separate external
admission, install the exact request once, and re-observe before guest entry.
The bounded admission uses a unique immutable ACK Git ref with complete
run/job/source/inventory/request bindings. Preserve the final terminal reader,
all runtime identity checks, scenario caps and the 35-minute outer deadline.
Keep the previous Actual-V8 route disabled. Do not spend a standalone V10
inventory event hoping the next runner has identical configuration.

**Body capacity.** PR1318's consumed transport body is near its size limit.
Preserve that body and its historical events. PR1540 provides the compact
successor body for the new selection and current actual request; bind its own
PR number, exact source head and dispatch inputs. Historical references
retain their original event identities. No previous admission transfers.

**Current and historical pins have separate roles.** The candidate normally
composes current main and preserves its canonical `vendor-pins.json`. Consumed
F7/F8/F9 constants retain their historical meanings; the new F10 pin map and
witnesses bind the current suppliers. Read the canonical pins again before any
source refresh. A later pin move needs explicit review of the new current map,
witnesses and fixed body profiles; never rewrite historical constants to make a
receipt look current. No previous head's qualification transfers automatically.

1. Refresh main, PR1540's exact head, every enabled check, full run/job pagination
   and raw numbered steps. Retain any terminal failure before changing source.
   Do not rerun an unchanged failure or borrow a previous head's success.
   Normally merge current main, preserve other owners' changes and all reviewed
   source/profile bytes. Review the implemented template, guard, collector,
   independent reader, workflow and connected controls. Complete and review the
   external phase-admission, request/ACK and final-reader tooling before arming.
   Keep actual event selection closed until that separate review. Preserve the strict historical V8/V9
   readers, retire V9 execution, and requalify the final head.
2. Admit the successful frontend Build's actual checkout, tree, dependency and
   source closure from its selected original. A proposed PR merge SHA or a later
   live PR base is not proof of what that Build checked out. Rebind preparations
   explicitly when the source or event changes; never edit a receipt to fit.
3. Only after final source and Build admission, separately select one new
   Actual-V9 prelude. Capture V10 inventory on that retained job and finalize
   its early immutable artifact.
   Join official event/run/job/step/artifact metadata; acquire each selected log
   and artifact once; run the independent reader once. Preserve strict file,
   alias and directory roles and all existing limits. Missing custody or a spent
   slot is a recovery task, not permission to select another event.
4. Independently read the phase original and bind its job, completed upload
   step and artifact. Join the retained Native2 reference; publish one immutable
   ACK with the exact admitted request identity. The same job installs that
   request exclusively, re-observes runtime, and acquires the sole selected Build
   ZIP. Require adequate remaining time before entry. Exercise FreeDOS HDD
   export/reload and forward debugging in the actual browser, with guest-rendered
   responses, final terminal observations, independent audit and finite cleanup.
5. Merge the successor source only after affected actual acceptance and every
   enabled final-head check succeeds (Lite code PRs need the `ci:full` label), with declared skips
   proved from source and the matched merge head/tree/parents checked. Update the
   user guide and result boundary from the observed result.

**Done when:** the exact tested app/build/dependency identities and bounded
FreeDOS export/reload/debug result are published, failures remain preserved, and
that qualified source is on main. Source-only tests do not finish this lane.
The public request body is already close to its cap; preserve its consumed
markers and do not append routine status prose to it. The predecessor's
Circuit UX `ADC_POINT_REARM_REUSED_RECORD` failure stays preserved; its cause
is not established.

### Follow-up A: observe the faster read path in the browser (optional, unclaimed)

**Why:** the read16 speed-up is proven only for the authored board loop.
Nothing has yet timed it inside the Lite app. **Scope:** claim a new
`lanes/<date>-x86-read16-browser-observation.md`; add no product source.
Use an existing free-media 386 scenario (xv6 or FreeDOS from the GUI guide)
on current main and record guest-rendered output plus wall time for the same
scenario at board `c7bcbe4b` and `8785e468`, on one host, in alternating order.
**Done when:** both identities, host facts and the raw observations are
published, whatever the result. Do not call this physical 386 timing.

### Diagnostic profiling checkpoint (2026-10-28)

Read-only diagnostics against board master
`260126831d76c297ac1ca8481eb89f953b5da203` executed the authored loop in
Node 24.22.1 and Chromium 153, for CPU-only and AT paths. Each used 25,000 separate
warmup instructions followed by one million measured retirements. Architectural
state checks passed. The Node children were bounded to one CPU, 512 MiB and
10 seconds each; the browser service to one CPU, 1 GiB and 20 seconds, with
terminal cleanup verified. No build, install or CPU source change occurred.

Node recorded 317 CPU and 503 AT samples; Chromium recorded 284 and 435.
Instruction dispatch dominated both. Node AT attributed 43 samples to
`_read386`; Chromium AT attributed 15 there and 28 to `_snapshotInstruction`.
These are short diagnostic samples, not a speed comparison or physical RTx.
The browser result is engine execution, **not actual Lite app profiling**.
The app still needs an admitted build and a sustained guest workload after
lane 1; the existing halted marker scenario cannot measure sustained speed.

A narrow candidate for a future claim is handling the 16-bit absolute `disp16`
address case before constructing the unused address table in `_decodeEA`.
Preserve displacement fetch order, DS/segment overrides and result shape;
exercise fetch faults and paging/trace controls. Array construction is visible
in source, but allocation elimination by the JS engine is not measured.
Do not reuse one shared rollback snapshot: ordinary CPU bus callbacks can
reenter execution. Any optimization still needs independent paired timing and
affected fresh guest qualification before adoption.

### Follow-up B: next CPU hot path with the paired-v2 harness (optional, unclaimed)

**Repository:** bw-board. The merged `scripts/i80386-read16-paired-v2/`
harness (fixture, `run.py`, standalone `reader.py`, `controls.py`, default-off
workflow `.github/workflows/i80386-read16-paired-v2.yml`) can grade a new CPU
candidate. **Steps:** profile current master's authored loop first (the old
profiles predate `8785e468`); claim one narrow CPU change plus a *new* harness
namespace (copy, do not edit, the v2 files, so its frozen rows and request stay
valid); freeze arm A = current master and arm B = the candidate in new source
rows; keep the same gate (CPU median >= 1.03, every pair > 1, wall <= 1.02,
18 children, 10M retirements); one capfit dispatch, then one paired dispatch,
originals acquired once and audited with the standalone reader. Adoption then
needs its own PR with every enabled check incl. `ci:full` and x86-xv6.

### Follow-up C: tighten the paired-v2 device goldens (optional, unclaimed)

The v2 reader asserts machine cycles, deadline/debt bounds, CGA frame count and
retrace phase, the PIT fraction's range and no-I/O PIT/PIC/RTC/8042
invariants. The exact PIT fractional carry, RTC phases and 8042 queue
progression are recorded, not asserted, because no independent derivation
exists. **Work:** derive them from `src/i8254.js`, the RTC and 8042 sources and
the wake-horizon scheduler in `src/i8086-machine.js`, never from a child's
output; check them against the two retained admitted originals of runs
40521350218 and 40531608266 with a new reader version (keep the v2 reader
unchanged). **Done when:** the new assertions pass on both originals and a
deliberately perturbed copy is refused.

### User entry points and reporting

Existing CLI, Circuits, Widgets, Code, debugger and media-loading routes remain
in [the user guide](X86-USER-PATHS.md), [GUI guide](I80386-GUI.md) and
[board loading guide](https://github.com/CrispStrobe/bw-board/blob/master/docs/X86-LOADING-GUIDE.md).
Keep functional 8086/386 execution separate from wired 8086/Harris 286 execution;
there is no wired 386 route. A DOSBox configuration/package is a constrained
input format, not DOSBox compatibility, and selecting an ISO cannot supply an
unimplemented CD-ROM device. Record observed freely licensed/freeware tests and
exact limitations; retain private operational details outside public Markdown.

## Current boundary

The selected actual V6 attempt failed its Python startup check before media or
guest work. Its retained log establishes the guard-mode mismatch; the later
preflight and actual mode mismatches are source findings, not observed later
steps. The distinct [V7 startup-mode lane](../lanes/2026-10-25-x86-gui-actual-v7-startup-mode.md)
qualified source checks but was never selected for an actual event. Its three
CLI modes and reader remain available for historical review. A pure V7 control
used memory originals and produced 157 registered roles, above the real
producer's 128-role limit; it did not establish a reachable sealed actual
packet or a guest result. The [V8 dispatch lane](../lanes/2026-10-25-x86-gui-actual-v8-head-pinned-dispatch.md)
has an armed source candidate awaiting hosted qualification, still
unselected for any actual event. It packs the 35 Git capture triplets into
bounded physical envelopes while retaining their raw bytes and independent
reader checks. Its controls use mocked host and child edges; dormant
default-branch dispatch registration has landed, and V8 still needs exact-head
source CI, a qualified Build and request, and a separately selected one-shot
event before any hosted claim. V7 execution is retired in this candidate while
its wire and reader remain; V6 execution remains retired while its original
reader and failed attempt remain available.

The functional experimental 386 AT exposes console/VGA and keyboard/mouse routes through Circuits, Widgets and Code. Machine Manager accepts raw HDD media with supported CHS geometry and partial DOSBox configs; the named FreeDOS VGA route has its own documented floppy/HDD constraints. Widgets supports a large screen and full screen. Media selection remains tab-local and mouse reporting depends on the guest enabling it. These capabilities have different synthetic, headless-adapter and actual-browser evidence boundaries; consult the guide rather than treating them as one broad compatibility claim.

The board's native page-fault recovery result remains a finite diagnostic fixture, and its previous compact native paired result was slower than JS. The new [ABI 5 same-DSO direct-RAM checkpoint](https://github.com/CrispStrobe/bw-board/blob/0f295116f9543cdfc57762e120b2e1567bbce125/docs/I80386-COLD-DIRECT-RAM-RESULTS.md), merged in [board PR420](https://github.com/CrispStrobe/bw-board/pull/420), passes actual direct/companion/callback cold guest parity at tested source `acdb5dcef438c0ac7bc3c7794d43af4371d6e0d1` in [run 37605762900](https://github.com/CrispStrobe/bw-board/actions/runs/37605762900). Independent raw audits reproduce the whole RAM hash by replaying all 91,958 writes, with complete CPU/board/ordered-PIO parity and closed sessions. JavaScript physical-memory entries are zero, but clock/page/PIO/device callbacks remain. The separate [paired result](https://github.com/CrispStrobe/bw-board/blob/b1d982b57e220f3e980f28a0d11ee00d4cd51a24/docs/I80386-COLD-DIRECT-RAM-PAIRED-RESULTS.md) at harness `447fb5bfbc913db0ef00fca333ecb5be28b0e156` passes all 36 semantic children but fails adoption in [run 37609656584](https://github.com/CrispStrobe/bw-board/actions/runs/37609656584): direct uses 5.035176× JS execution CPU and 9.870393× execution wall, with 0/7 favorable pairs, on EPYC 9V45 with four logical CPUs. Ordinary JS remains the default. Configured RTx is JS 2.657023 / direct 0.269191 under the fixed six-clock/6 MHz pacing model; this is not physical 16 MHz 386DX calibration. Older compact timings remain separate historical evidence.

This fixed-A20, ROM-execution-only coherence fixture does not introduce a general native GUI backend or qualify a complete OS. The GUI's **Native blocks** checkbox selects the JS native-block dispatcher, not a Bochs Node addon. There is no wired 386 target. The next native step is a pure model for explicit clock authority in the board repository, followed by its own guest and paired timing gates; this handoff changes no consumer pin or frontend behavior.

Read [vendor-pins.json](../vendor-pins.json), the package manifests and lockfile for the selected board revision. Board diagnostics and merged supplier APIs do not qualify a newer installed consumer. Coordinate the existing supplier-adoption owner before changing pins.

## Task A: real free-media GUI acceptance

**Start:** `scripts/verify-i80386-freedos-real-browser.mjs`, `scripts/verify-i80386-freedos-vga-browser.mjs`, `scripts/verify-i80386-local-hdd-gui.mjs`, `scripts/verify-machine-widgets.mjs`, and the corresponding media/mouse tests. First inspect existing results and distinguish synthetic media, headless adapter and actual browser execution; extend a proven harness rather than creating a parallel one.

**Work:** use a freely licensed FreeDOS image and redistributable BIOS with recorded hashes. Boot via Machine Manager; verify a visible guest prompt, typed command response, guest-enabled mouse, tab transitions, focus, resizing, full-screen entry/exit and drag capture. Retain failure UI and media-lifetime checks. Cover browser-reserved keys and the documented absence of Pointer Lock.

The [optional real FreeDOS interaction probe](I80386-FREEDOS-INTERACTION.md) extends the existing harness with an owned PS/2 guest program and nonmutating pixel observation. Its exact observed result must accompany any completion claim. The [corrected-build receipt](receipts/2026-10-07-freedos-interaction-acceptance.json) clears real boot/listing, Widgets keyboard, fullscreen, pane growth, guest PS/2 packet readback and a working shell after the Circuits/Code roundtrip. The separate [direct-Circuits result](I80386-FREEDOS-CIRCUITS-DIRECT-RESULTS.md) at tested source `327143c40bfd0e0655395ec7c6cdb940de72c305` now clears physical typing through the focused Circuit VDP with a changed guest-rendered canvas, followed by retained output and a working shell after tab switching. Next cover drag capture outside the canvas, reserved keys and an actual guest mouse driver/application; do not repeat either cleared subset merely because main advanced.

**Deliverable:** a bounded browser scenario, exact build/dependency identities and screen/input evidence. **Done when:** the actual guest responds through Widgets and remains usable in Circuits and Code. Update `docs/I80386-GUI.md` and matrix inputs from the observed result. If the existing receipt already clears a criterion, preserve it and take the next uncovered criterion.

## Task B: DOSBox packages and disk formats

**Start:** `test/local-dosbox.test.mjs`, `scripts/machine-manager.mjs`, and the [board loading guide](https://github.com/CrispStrobe/bw-board/blob/master/docs/X86-LOADING-GUIDE.md). Shared parsing changes land in bw-board first.

**Work:** align config-relative media resolution, explicit CHS validation, unsupported-command reporting and CLI/GUI selection. Add bounded ZIP admission with traversal/count/size protections, deterministic config choice and no host-shell execution. A DOSBox package is an input format, not a promise of DOSBox compatibility. ISO support needs a real upstream CD-ROM/ATAPI path; do not enable a file picker that implies an absent device. Disk writeback/export is a separate explicit workflow.

The first connected GUI slice is proposed in
[PR992](https://github.com/CrispStrobe/brickwright/pull/992). It admits only a
STORED ZIP of at most 16 MiB and 32 regular ASCII-named files: one `dosbox.conf`,
one matching config-relative `.img` HDD and optional `LICENSE.txt` notices.
Raw local/central records, extents, CRCs and paths are checked before extraction;
commands are checked against a closed subset around the canonical board AST.
Only explicit HDD CHS plus `boot -l c` selects the existing ordinary 386 route.
DEFLATE, COM/MZ virtual files, host mounts and ISO devices remain unsupported.
Source controls and an activation sink do not qualify a browser or guest boot.
Same-archive CLI loading, installed GUI input and tab retention remain next
acceptance work; claim the CLI entry/test changes before implementing them.

**Deliverable:** shared parser tests and one freely licensed package loaded in both CLI and GUI. **Done when:** the same bytes reach the intended functional target, malformed inputs produce useful persistent errors, and actual guest input/output passes. Document unsupported formats and disk persistence accurately.

## Task C: upstream adoption and matrix gaps

**Start:** `package.json`, the npm lockfile, `docs/VENDORING-REGIME.md`, `docs/generated/LANGUAGE-DEVICE-MATRIX.md`, and its source generator.

**Work:** choose an upstream board revision only after the required behavior and checks pass there. Move the exact pin and lockfile together; verify mirrored/derived ownership invariants and relevant GUI tests. Distinguish wired, functional JS, JS block/WASM dispatch and diagnostic native addon support in the capability source. Keep unavailable language/backend combinations explicit.

**Deliverable:** a focused pin-adoption PR and generated matrix diff. **Done when:** changed shared behavior passes an actual Lite scenario, source ownership checks pass, and the published matrix describes the selected dependency. A documentation-only checkpoint does not require a pin move or imply backend adoption.

## Task D: console interaction and free guest expansion

**Start:** the [board CLI/GUI guide](https://github.com/CrispStrobe/bw-board/blob/master/docs/X86-LOADING-GUIDE.md) and [guest acceptance lanes](https://github.com/CrispStrobe/bw-board/blob/master/docs/X86-NEXT-LANES.md).

**Work:** keep direct DOS-service loading distinct from BIOS boot; qualify terminal input/redraw/exit separately from browser interaction. Choose one freely licensed guest/application with a reproducible manifest and concrete success criterion. FreeDOS, ELKS and appropriate small-Unix fixtures are candidates; verify each exact release's redistribution terms before bundling. Keep strict 386DX and later-feature xv6 profiles separate.

**Deliverable:** one media/license manifest and bounded guest scenario. **Done when:** boot plus meaningful application/shell interaction passes, with the first uncovered CPU/device gap recorded as a follow-up task. Restricted media and their test details belong in the private repository.

## Working order and ownership

A frontend worker can take A while a shared-media worker takes B; coordinate Machine Manager and adapter edits. C follows an upstream implementation change. D supplies regression scenarios for either lane. CPU RAM ownership, clock batching, protected-mode oracle expansion and RTx calibration remain the board lanes. Each task should end in a reviewable change with relevant evidence and an updated handoff, not a stale implicit SHA.


## Qualified 386 debugging and media workflows

Source checkpoints and remaining acceptance work are recorded below. Refresh board PR599,
its subscribed free-guest qualification, performance decisions and this app's
actual selected supplier. The shared adoption owner in PR961 must hand off
package/lock/vendor work explicitly before x86 changes those surfaces. Adopt
only qualified source and preserve unrelated supplier changes; a successful
board diagnostic does not qualify the installed app.

First qualify forward debugging in the actual installed package. Source support
for target-declared physical bounds and read-only memory is merged in
[PR970](https://github.com/CrispStrobe/brickwright/pull/970) and
[PR972](https://github.com/CrispStrobe/brickwright/pull/972). The drawer uses
those descriptors for address jumps, bounded pages, refusals and editing controls.
Legacy targets retain their 64 KiB behavior. A newer drawer does not supply
missing metadata to an older installed board package.
Use explicit validated target memory bounds and read/write capabilities, not
linear code-address limits as a substitute for physical memory metadata.
This reviewed extension owns canonical
`overlay/scratch-gui/src/lib/bw-debug/debug-capabilities.js` and existing
`test/debug-capabilities.test.mjs`. Preserve schema-1 legacy spaces and normalize
the board's optional `spaces.mem` fields: `addressSpace: 'physical'`, inclusive
`addressMin`/`addressMax`, `maxReadBytes`, and existing `read`/`write`/`passiveRead`.
The 386 target contract uses 0 through `0xffffffff`, at most 1048576 bytes per
read, and `write: false`. This is a physical bus domain, not mapped RAM; passive
read claims require board observation controls. Absent optional metadata keeps
legacy behavior; presence of any new metadata field selects complete strict
validation. Partial or malformed descriptors fail closed without an editable
64 KiB fallback. Read lengths must be nonnegative safe integers. Preserve an
empty read at `addressMax + 1`, but never treat that endpoint as an addressable
byte or valid UI jump/page start; nonempty reads stay within inclusive bounds.
Test zero-length reads, the top byte and one-past empty endpoint explicitly. Use `write: false` as the read-only authority, not a duplicate
contradictory flag. Freeze normalized nested descriptors. Board metadata is
merged in [PR615](https://github.com/CrispStrobe/bw-board/pull/615); verify the
selected installed supplier before claiming those capabilities in the app.
Preserve other targets' declared address spaces.
Display full-width registers and physical addresses without truncation. Offer a
bounded address jump/page view, report read refusals, and disable editing when
the target refuses writes. Unsupported 386 disassembly, step-over/out, symbols
and reverse execution must be clearly unavailable, not rendered as valid legacy
operations. Keep ordinary 8086 controls and inspection working.

Use an existing free client through the exact installed supplier: visible guest
completion/input, pause, linear code breakpoint, one instruction, full-width
register/physical-memory observation, resume and Circuits/Widgets/Code transitions
without session loss. Retain source/package/media/build identities and actual
browser/native observations. A synthetic adapter test is not this acceptance.
Historical application/browser receipts remain source-bound; do not repeat them
as missing capability or promote them to a newer package without evidence.

Next add explicit raw-HDD download after the board export API qualifies. The
action applies to the active paused target and downloads detached raw bytes plus
geometry/hash metadata. Revoke Blob URLs on success, failure and disposal; never
write the originally selected file, silently autosave or store binary media in
the configuration library. Machine Manager's existing chooser supplies reload.
Controls cover live-session selection, unsupported/busy/capped export, download
failure/disposal and byte isolation. Actual installed acceptance captures the
genuine browser download, reloads those exact bytes through the real chooser
into a fresh machine, and verifies the guest-written marker and unchanged input.
Preserve the original session independently.

Then add one bounded DOS package chooser using the board's canonical admission
policy. Reuse the existing ZIP dependency only with raw-record preflight and
bounded extraction; no shared dependency edits belong here. Accept only the
explicit COM/MZ-plus-virtual-files or raw-HDD/CHS subset. Show deterministic config
selection and persistent useful rejection for ambiguity, unsupported commands,
unsafe paths, malformed archives or unsupported devices. No host-shell, package
JavaScript or network fallback runs. Actual CLI and GUI acceptance use the same
free/authored archive bytes and demonstrate guest input/output, target selection,
error recovery and tab/session retention. Keep raw-image loading available.

ISO/CD-ROM support remains a separate board/device task; do not advertise an ISO
picker before that path qualifies. Free application expansion follows these user
journeys: requalify an existing protected client first, then an explicitly licensed
engine/assets build with visible frames, live input and a repeatable workload.
Public examples and new notes use free/authored media with exact notices; private
licensed-media records remain in the private repository. No calibrated RTx,
physical 386 timing, whole-OS, broad DOSBox or release claim follows from this lane.


## Master-disk export continuation

Updated 2026-10-15. The board's master-copy API is merged in
[PR623](https://github.com/CrispStrobe/bw-board/pull/623); explicit CLI raw output
is merged in [PR618](https://github.com/CrispStrobe/bw-board/pull/618).
The two-session FreeDOS persistence fixture is merged in
[PR625](https://github.com/CrispStrobe/bw-board/pull/625). Its first actual run
[38790214003](https://github.com/CrispStrobe/bw-board/actions/runs/38790214003)
failed before command completion and left the disk unchanged. Accepted controller
scan bytes did not prove that the guest consumed the complete command. The live
console pacing correction is merged in
[PR627](https://github.com/CrispStrobe/bw-board/pull/627). The corrected
[actual run 38806122785](https://github.com/CrispStrobe/bw-board/actions/runs/38806122785)
passed at source `b8f95cfdb8ee654407b63e626e46eb8859ce7b41`. Root and independent
original-artifact audits reproduce the 19-byte `BWKEEP.TXT`, 43 permitted changed
bytes, and byte-identical first/fresh-readback exports. Both sessions boot the
same floppy; this is master-data persistence, not HDD boot, GUI acceptance,
crash durability or a full-OS result. Preserve the original failure; the passing
finite run does not establish a general BIOS failure cause.

GUI memory descriptor normalization and the memory drawer are merged in
[PR970](https://github.com/CrispStrobe/brickwright/pull/970) and
[PR972](https://github.com/CrispStrobe/brickwright/pull/972). These source
checkpoints do not adopt a newer board package or qualify the installed app.
The runner bridge is in
[PR986](https://github.com/CrispStrobe/brickwright/pull/986); the complete
download helper and panel consumer are in
[PR987](https://github.com/CrispStrobe/brickwright/pull/987). PR987 supersedes
the standalone helper PR984. Source checks, supplier adoption and installed
browser acceptance remain distinct gates.

The bounded CLI write/export/fresh-process reload is now qualified at the source
and run above. Continue with the pending runner bridge, complete helper/panel
feature, supplier handoff and actual installed-browser download/reload; do not
repeat the cleared CLI subset merely because main advances. The bridge calls
only the current target's
`snapshotAtaMaster()` and rejects stale session ownership after stop,
replacement, or destroy. Do not expose the target object or infer support merely
because a bridge method exists on every runner. Preserve the board's copy-time
boundary and refusals; no continuous pause or guest flush is implied.

Before installed acceptance, coordinate the supplier handoff and verify the
actual package includes the qualified API. Capture genuine browser image and
metadata downloads, compare the downloaded image hash, then use the real
**Boot FreeDOS VGA** chooser with the same free boot floppy and the exported
306×4×17 master data image. Start a fresh machine and read the guest-written
marker without rewriting it. Preserve the original input and session separately.
The **Boot disk** shortcut boots an HDD and is not the data-disk reload route.
Keep the existing authored boot-sector acceptance intact when extending its
harness. Exercise browser download permission behavior: two mocked anchor clicks
do not prove two files were saved.

The optional real download/reload scenario is proposed in
[PR989](https://github.com/CrispStrobe/brickwright/pull/989), extending
`scripts/verify-i80386-local-hdd-gui.mjs`. Its default authored boot-sector
scenario stays unchanged. After qualified supplier/consumer adoption and an
externally reviewed source/build/input manifest, run from the repository root:

```sh
PROOF_SCENARIO=freedos-hdd-persistence \
PROOF_ADMISSION=reviewed-admission.json \
PROOF_OUTPUT=new-owned-output \
node scripts/verify-i80386-local-hdd-gui.mjs
```

The optional scenario refuses missing required APIs or mismatched identities
before browser execution. It captures both genuine browser downloads, reloads
the exact image through the chooser in a fresh session, and retains the original
paused session. Its finite source/build profile does not establish complete
package or compiled-source authenticity. Mock controls are not a browser result;
the harness observes deadlines, while a hosted external controller must enforce
hard resource limits. Nonlocal page HTTP blocking and disabled service workers
do not establish OS network isolation. No actual GUI persistence pass is recorded
by this source-preparation checkpoint.

Board export geometry is broader than the current GUI BIOS loader's accepted
geometry. Do not promise arbitrary exports can be reloaded: the named FreeDOS
route accepts the fixture's 306×4×17 image, while the generic DOSBox-config route
has its own CHS limits. Geometry metadata is a sidecar, not a config import
format. A wider chooser or ISO/CD-ROM path needs its own claim and qualification.


## Proposed 386 Board HDD adoption handoff

Proposed 2026-10-16; documentation only. This is a serialized next task for a
fresh agent, not a transfer of package or pin ownership. The
[ledger proposal](../lanes/2026-10-16-proposed-386-board-hdd-adoption-handoff.md)
owns only these two documents. Refresh both repositories and the existing
adopters before implementation; do not treat this dated checkpoint as a current
merge decision.

The STM32 owner holds [PR975](https://github.com/CrispStrobe/brickwright/pull/975),
branch `chore/stm32-faithful-pins-20261015`, at
`fb9961382287f5981d70ea6a15f504ee45101d39`. Its merged claim PR969 covers
Board/SB3 pins, package specifications and locks, notices and generated outputs,
and the STM32 runner changes. The PR says **Not for agent merge**. The CUI
adopter holds [PR965](https://github.com/CrispStrobe/brickwright/pull/965),
at `fcf39b5cdfa1d4422ec4da685730baef429b43c1`, under merged claim PR961,
including shared lock surfaces. Preserve both owners and their recorded
coordination; this proposal changes neither their order nor their merge authority.
Obtain an explicit recorded handoff, agree one dependency writer and merge a
precise implementation claim before touching those shared surfaces.

At Lite main `9226b7522f69a287a9de77330d8d129ab043bdd7`, Board is pinned to
`b4b4c87f70624dfb570a6d21391c5a2d5a40a0e8`. PR975 instead proposes Board
`04f19952cea008b7498c701c16be5cc7ea1bdf63` and SB3
`a13f92b8bc4b06f0cb9ffec22bab71f06db7ac76`. Neither of those Board revisions
contains the 386 target's `snapshotAtaMaster()` implementation. A successful
STM32 adoption alone therefore cannot qualify the HDD export workflow. PR965
moves CUI separately while preserving its base Board/SB3 pins; the HDD feature
does not require its new CUI API.

The required Board source anchor is
[PR623](https://github.com/CrispStrobe/bw-board/pull/623), merged as
`48635add0807dc37c8c26551949fb58dcc9858e7`: inspect
[`src/i80386-debug.js`](https://github.com/CrispStrobe/bw-board/blob/48635add0807dc37c8c26551949fb58dcc9858e7/src/i80386-debug.js)
and its factory connection in
[`src/debug-target-factory.js`](https://github.com/CrispStrobe/bw-board/blob/48635add0807dc37c8c26551949fb58dcc9858e7/src/debug-target-factory.js).
Preserve the helper and metadata prerequisites rather than copying only a
method name. The related CLI persistence qualification is PR625, merged as
`cb5058e5f8865110aa099ff3fbc84092668563c0`, tested with PR627's pacing correction
at `b8f95cfdb8ee654407b63e626e46eb8859ce7b41` in
[run 38806122785](https://github.com/CrispStrobe/bw-board/actions/runs/38806122785).
The [master-disk continuation](#master-disk-export-continuation) records the
original failed run and the finite two-session data-disk result. Preserve both;
neither result proves installed GUI persistence or HDD boot.

The pending Lite consumers are PR986 (runner bridge, `a28ac3546cf5feb1541bc636ec626faf8cd24b74`),
PR987 (download helper/panel, `bb19267c36cda7648cdfd013344185bdeaf18716`),
PR989 (download/reload scenario, `f1c6bcf745d99c7ea96844bb67d27962d50b5eb6`),
and PR992 (bounded package chooser, `5b593cba63ec42896f0567b1a05fc653861e4468`).
These are source checkpoints, not a composed installed qualification. The
package chooser's existing canonical DOSBox parser is a separate boundary from
the snapshot API. Keep both boundaries explicit in the composed candidate.

After the owner handoff and merged claim, the fresh agent should:

1. Freeze the exact supplier revision, its qualification and ancestry, and the
   installed package's complete selected blob graph. Verify the snapshot API,
   factory wiring, metadata and persistence prerequisites. A later Board main
   revision is not automatically qualified by the historical tested source.
2. Review the component diff against each current adopter. Preserve STM32 and
   SB3 behavior and the agreed CUI revision; record unchanged component and
   unrelated pin identities. Use the canonical dependency/notices writers and
   inspect specifications, both locks, generated twins, notices and existing
   provenance, pin, matrix and integration gates. Claim any extra change first.
3. Compose one owned GUI candidate with the reviewed x86 consumers and exact
   installed supplier identities. Retain ordinary targets, source ownership,
   mirror equality, snapshot refusals and stale-session controls. Require every
   enabled final-head CI check; host controls alone do not qualify the app.
4. Admit a finite hosted source/build/free-input/resource manifest, then capture
   genuine image and metadata downloads and reload those exact bytes through
   the real chooser into a fresh machine. Verify the guest-written marker and
   original input/session independently, using the documented free boot floppy
   and 306×4×17 data image route. Qualify PR992's own package selection,
   rejection, input/output and tab-retention route separately. Retain original
   failures and acquire each official original once for independent audit.

No implementation is authorized by this proposal. No new dependency, lock,
notice, workflow, package or source change is made here. A future adoption is
complete only after qualified supplier and affected clean consumer results,
owner review and every enabled exact-head check, followed by the normal
matched-head merge and tree/parent verification. This finite handoff grants no
full-OS, broad DOSBox, physical-timing, RTx or release claim.


## Next finite GUI composition and hosted acceptance

Current Arcade composition selects compiler `37bfe28760f60c836097854fb141fd114bbee518` from
main's reviewed supplier adoption. Its compiler source is identical to D7;
both x86 consumer literals match the current selection. Actual execution remains
disabled. The preceding F9 hosted source workflow passed all 67 Node control
groups, including twelve GUI groups; it supplies no current composed GUI/guest,
tool or external-event qualification. Keep the following D7 record as historical
source maintenance and preserve its original reader identities.

Current D7 supplier-consumer maintenance is a SOURCE candidate: the fixed SB3
selection in `scripts/run-i80386-hdd-gui-actual.py` and
`scripts/read-i80386-hdd-gui-originals.py` is
`d7c258910dd3837021a7a8c4b85d38a4e28e138a`. Both actual gates remain disabled;
all other script bytes, dependency declarations and historical readers stay held.
The complete unchanged source-control module and exact-head checks are pending.
Fresh affected GUI/guest qualification still needs its own admitted D7 source,
installed supplier/browser and tool graph, finite resources, external request and
event, and independent original reader. No earlier source result or consumed
event qualifies this candidate; no guest attempt is authorized here.

The earlier GUI source work in
[PR #1095](https://github.com/CrispStrobe/brickwright/pull/1095) has merged.
The current-main compiler selection is an ancestor of the explicit D7 adoption;
D7 adds the source operators, score callbacks and motor-power support. The
candidate's twenty mapped compiler files and mirrors match D7. Preserve that
adoption and the two matching consumer fences while qualifying the combined
head. This refresh supplies no new tool availability, request, event or guest
result; retain the earlier consumed failures and their historical readers.

A separate source-only exact-entry chain slice is being reviewed on top of
PR1013's `79afc8bc` checkpoint. It adds `font-chain-guard` and `font-chain`
controller modes plus independent `--font-chain` observation validation, all
behind `FONT_CHAIN_ENABLED = False`. Closed `bw.gui-hdd.font-chain-request.v1`,
`bw.gui-hdd.font-chain-original.v1` and `bw.gui-hdd.font-chain-expectation.v1` formats are distinct
from the retained discovery/delivery v1 formats. No hosted chain job or outer
official-delivery validation is implemented, and no new input or event is sent.

The slice follows one selected font-root entry, with root-owned canonical
parent witnesses, held symbolic-link text/readback/close, eight-link and cycle
limits, an explicit finite alternatives bridge, and an observed terminal regular
file under the original font roots. It does not enumerate directories, run
package probes or establish font-format/native/browser selection. Source command
hash/extent descriptors join selected source21; raw process/stream sidecars are
retained separately and need a future outer reader. Output caps and reserve,
first/secondary failures and all legacy formats remain held.

The independently audited consumed observation contains a root-owned parent
with mode040777. This stricter source policy would refuse before that alias;
its mock positives cannot establish traversal of that layout. Before a future
hosted event, separately resolve the observation-policy boundary. An independently
selected, already observed alternatives-bridge entry would be a different bounded
question; it must not imply a current link through the writable font parent or
silently widen this request's admitted starting roots. Current actual execution
and this new mode stay disabled pending those separate decisions.

The focused source controls pass 65 Node tests including 117 Python controls.
All 107 earlier Python test bodies remain unchanged. Nine critical source
predicate-removal mutations are detected, and independently retained failed-packet
counterexamples now refuse. Failed link suffixes, unrelated terminal/parent paths
and irrelevant role fields are rejected while legitimate partial read/close
failures remain failed observations. These are mocked source controls, with no
hosted chain observation or guest qualification. The earlier frozen reader and
consumers remain selected for the retained v1 original; no consumer pin is
silently changed by this source slice.
Further bridge review exposed a separate partial-prefix defect in the earlier
chain reader: a failed close or identity readback with retained link text could
still authorize later rows in an incomplete packet. The separately scoped repair
now changes only `verify_font_chain` and adds focused manufactured controls in
`test/i80386-hdd-gui-actual.test.mjs`. Each link must complete before its next
hop can authorize further observations, and every parent consumed by a retained
link or terminal must have a successful witness. A genuinely failed final link,
parent or terminal remains admissible as failed evidence. No global parent-array
ordering is invented, and shared ancestors remain supported.

Earlier accepted counterexamples remain retained as failures of the old reader;
the fix deliberately rejects those packets. Existing discovery, delivery and
bridge versions, guards, caps and baseline remain unchanged. This is a disabled
source repair with independent source review complete; exact-head CI remains
pending. The full suite passes 65 Node tests including 128 Python controls.
Three new focused methods detect both repair-omission mutations. All 125 earlier
Python test bodies and helpers, and all reader bytes outside `verify_font_chain`,
remain unchanged. Independent review rejects 13 negative packets and accepts six
valid complete or partial packets. This grants no hosted chain observation,
activation or guest qualification.

A separate disabled `font-bridge` source slice asks only about a selected direct
child of `/etc/alternatives/` named in the retained incomplete alias. Its request
must carry bounded exact prior request/original bytes and independently selected
source, run, workflow and digest bindings. The independent reader must regrade
that prior discovery observation and additionally require stable root-owned
symlink witnesses and the exact historical literal link text. Prior discovery
validation alone does not establish those new reference requirements.

Its distinct controller modes are `font-bridge-guard` and `font-bridge`, with
standalone reader mode `--font-bridge`. The closed formats are
`bw.gui-hdd.font-bridge-request.v1`, `bw.gui-hdd.font-bridge-original.v1`,
`bw.gui-hdd.font-bridge-expectation.v1`, embedded
`bw.gui-hdd.font-bridge-prior.v1` and externally selected
`bw.gui-hdd.font-bridge-prior-reference.v1`. The current source proposal enables
`FONT_BRIDGE_ENABLED`; actual and chain guards remain false.
Each embedded prior byte stream and the complete new request have a 1 MiB
cap; the existing 4 MiB JSON cap and 2 MiB output reserve remain unchanged.
Prior descriptors bind immutable bytes, source, run and workflow. Official
metadata authenticity still requires the separately admitted delivery boundary.

This question must never read the old font entry or its writable parent to
claim a current association. Both source-entry reobservation and current-entry
association stay explicitly false. New bridge parents, held links and terminal
font files retain the strict ownership, identity, path and output limits; a later
unsafe terminal parent can still produce a failed observation. Existing discovery
and font-chain versions retain their admission rules. New formats, manufactured
controls and independent source review precede any job activation, official
observation, consumer selection or distinct event. Actual execution remains disabled.
The new bridge reader must also reject newly derived historical-entry ancestors
after a forbidden rebound, and suffixes after failed link close or identity
readback. Preserve the original failed witnesses and legitimate common ancestors;
do not discard failures or make every incomplete packet unacceptable.
The corrected source passes 65 Node tests, including 125 Python controls. Eight
new focused methods exercise the bridge, with six detected predicate-removal
mutations. All 117 earlier Python test bodies and helpers, and the existing
controller/reader module code apart from CLI dispatch, remain unchanged. The
retained prior also fits the new request limits without any observation calls;
that parser check neither selects a new event nor approves the current host.

A further source-only bridge delivery slice adds separate
`--font-bridge-metadata` and `--font-bridge-delivery` reader modes. Its closed
`bw.gui-hdd.font-bridge-delivery-expectation.v1` selects the current source,
request, historical prior reference, executing workflow and official
run/job/artifact metadata independently of the uploaded ZIP. Metadata grading
does not read an archive and does not authorize acquisition. Raw labeled-event
and marker checks remain deferred until original grading; the run API's
`pull_request` value alone cannot establish those bytes. The executing merge
commit remains distinct from source head, while selected workflow bytes must
match the current source's workflow descriptor.

The archive reader checks the complete header census before inflation: 81 exact
file roles, optional uniform upload prefix, bounded known directories, and no
extra, mixed, duplicate, encrypted, truncated or special-file members. It retains
the 32 MiB archive/inflation and 96-entry caps. Twenty-three Git commands have
69 raw process/stdout/stderr sidecars joined to the inner descriptors, selected
source bytes, fixed argv, environment, identity and serial chronology. These are
finite original-consistency checks, not complete host or continuous ownership
authentication. All runtime, qualification and current-association flags stay false.
The selected aggregate child span is bounded to 200 seconds; it does not bound
controller work before the first child or after the last child, prove preemption,
or anchor monotonic observations to official API UTC timestamps.

The initial supported profile requires all source commands to succeed, then a
complete observation or an ordinary retained chain/close failure. Failed
collection remains a failed producing job even when the reader validates its
evidence. A primary failure must name the rederived attempted path, and secondary
close failures must refer to that same path. Missing raw triples,
setup/source/retention failures, cancellation and
official timeouts are refused; preserve unsupported originals externally. Existing
discovery/delivery readers and their selected consumers remain unchanged.

The `font-bridge` source proposal enables only its leading literal and source
guard. Its full predicate still requires the exact owned label, actor, repository,
first attempt, nonfork source and main base. It preserves the selected actions, package
setup and runtime pins, installs one immutable request with credentials confined
to that step, collects without credentials, and always retains the owned output.
Its finite backstops have no measured sufficiency or containment claim. No new
request, transport setting, event, archive acquisition or hosted bridge observation
is selected by this source implementation.

The activation proposal configures no variable, marker, immutable transport or
event. A source proposal publication cannot select its reserved bridge label.
The earlier disabled-source request is historical preparation: rebuild source21,
request and current workflow bindings only after the final source commit, then
independently review them and every enabled exact-head check before any event.
The historical failed original and selected standalone consumer remain unchanged.

Independent review of this activation proposal confirms exactly two production
guard changes. Three focused Python controls pass, including nine invalid-event
cases and zero-observation guard checks; nine workflow mutations are detected.
The local full run passed 78 of 79 Node tests and hit the unchanged 60-second
Python timeout. Its original failure is retained; host load was elevated, and
the cause is not established. A complete exact-head hosted run remains required.
Resource limits, event checks, baseline and actual-execution guards remain unchanged.

The hosted source suite at `3f71e4eafc2d60c2c885b3cca3aba520161d31ff`
passes 67 tests on Node 22.23.3 with no failures or skips. This suite includes
the embedded original-reader controls; the separate HDD snapshot suite is not
attributed to that job. Its retained workflow selection and limited diagnostic
resource review are prepared, while the remaining enabled checks still gate any
event. These results do not qualify a browser, guest or runtime.

Keep `ci:full` present before publishing the final source checkpoint: the CI tier
uses the triggering event's label snapshot. A later label event cannot change an
earlier run's captured tier. Preserve the earlier results, require every enabled
check on the final head, and rebind source/request/workflow selections after any
new commit. Do not rerun or relabel a consumed diagnostic to obtain a green gate.

The scoped census refresh records 19 recent completed runs at their actual source;
new bridge steps are younger than those readings. Every unrelated workflow row,
ordered run and main provenance remains held. Four inventory pointers preserve the
two consumed failed events now outside that window, and five pointers explain the
new bridge job and named steps, which require separate event admission. No event was run to populate coverage;
the explicit generator check remains required alongside the census tests.

This checkpoint passes 66 Node tests, including 135 embedded Python controls,
with no failures or skips. Seven new focused methods include eight detected
critical omissions; eight workflow mutations are also detected. Independent
reader-only checks accept four manufactured positive cases, reject 30 coherent
metadata/raw mutations, and reject 19 malformed archive cases before inflation.
All 128 earlier Python methods/helpers, legacy reader branches and existing
workflow bytes remain held. These controls qualify the source checkpoint only.

Next, review this draft and its parent composition against current main and
finish every enabled exact-head check. Before any activation, separately freeze
the full source/request/prior/consumer selections, executing workflow, resource
envelope and official event/job/artifact joins. The metadata-only verdict cannot
authorize retrieval; acquisition requires that external admission, once. Audit
the retained original independently, preserve failed producing conclusions, then
close native font selection and the complete runtime/frontend graph before any
clean affected browser/guest qualification. Keep actual execution disabled.

The existing runner bridge [PR986](https://github.com/CrispStrobe/brickwright/pull/986),
download action [PR987](https://github.com/CrispStrobe/brickwright/pull/987)
and persistence scenario [PR989](https://github.com/CrispStrobe/brickwright/pull/989)
are composed in [draft PR1013](https://github.com/CrispStrobe/brickwright/pull/1013)
under their merged ownership, with canonical manifest admission corrected.
The source candidate remains at `79afc8bc4c67c71ae251cc60fed5c5aff9231fec`;
its 17 enabled final-head checks passed, with seven declared conditional skips.
PR1013 is not merged or qualified on main. This historical candidate selection
is separate from current main's dependency declarations; refresh those before
any later integration without changing pins as part of this handoff.
The [merged acceptance claim](../lanes/2026-10-16-386-gui-hdd-and-forward-debug-hosted-acceptance.md)
adds only one hosted entry controller, one standalone original reader, focused
inert controls and a separate workflow around the existing probe. Ownership
was merged in [PR1014](https://github.com/CrispStrobe/brickwright/pull/1014)
before implementation; the hosted acceptance remains unfinished.

The [acceptance source checkpoint](https://github.com/CrispStrobe/brickwright/commit/37cf9a63cb6da453145b031fc682880e448dbb11)
implements the controller, standalone reader, workflow and two probe scenarios
in the same draft composition. The HDD scenario uses genuine
browser downloads and a fresh chooser session. The separate self-authored boot
image exercises existing breakpoint, instruction-step, full-width register,
physical readonly-memory and pane-retention controls. Source controls pass 59
Node tests, including 33 embedded Python original-byte controls; they include a
complete controller-to-reader mocked attempt and coherently rehashed negatives.
Twenty targeted source cuts are detected. They are not an executed browser or
guest result. The independent reader also
grades captured rendered memory and register text, not only target values.
The initial checkpoint kept both guards false. A subsequent separately reviewed
activation enables metadata inventory only; actual source/workflow guards remain
false. An immutable template and explicit own-PR event are still required.
The first inventory selects source/runtime metadata only: locally assumed Python
cache paths are excluded. This inventory does not establish executing Python
import/bytecode closure; selected hosted system interpreter/native libraries
remain an explicit trusted platform boundary.

The [startup checkpoint](https://github.com/CrispStrobe/brickwright/commit/7e11a159c)
versions the future actual request and reader as v3 while preserving v2 metadata
inventory. Before CPython entry, the actual workflow exclusively creates and
records an empty cache prefix; fixed isolated, no-site and no-bytecode-write
options redirect cache reads to it. Controller and reader join the original
installation, before/after flags, path and directory snapshots, plus ordered
successful official steps. Fifty Python controls and 59 Node tests pass, with
nine detected startup source cuts. These controls do not prove source/native
import closure, whole-host authenticity or a browser/guest result.

The first metadata event is already consumed for source `671702949709dc78da7d0cc8d0e064f9799ff399`:
[run 39106669518](https://github.com/CrispStrobe/brickwright/actions/runs/39106669518).
Its template digest is `668f81ce67ad7bd4313da934e0bddbd0e78e6cd152e67b68e55bb695fbdaf583`.
It failed because the required selected font configuration
`/etc/fonts/conf.avail/65-droid-sans-fallback.conf` was absent. Its sole official
artifact is already acquired and independently audited; do not repeat the label
or download. There is no successful inventory original or observed runtime/source
graph. Later source changes do not qualify that failed selection.

The [GUI readiness checkpoint](https://github.com/CrispStrobe/brickwright/commit/ad636dbd1)
waits for actual configuration text, drawer controls, the requested memory page
and rendered full-width registers. It preserves the existing debugger assertions;
four removed-wait mutations are detected. The
[failure-diagnostic checkpoint](https://github.com/CrispStrobe/brickwright/commit/ca1867592)
collects bounded selected-file and alias problems in a distinct
`inventory-failure.json`, preserves the first error, and returns nonzero before
runtime/Git probes after any required-path failure. Successful v2 output and
actual v3 guards remain held. Sixty-two Node tests, including 58 Python controls,
pass; eight diagnostic source mutations are detected. These are source controls,
not actual browser or guest qualification.

The collector's cooperative selected-path budget is now 180 seconds, inside the
unchanged four-minute recording step and fifteen-minute metadata job. Remaining
paths are explicitly `unvisited-deadline` with `attempted: false`; an expired
read remains an attempted failure. The original first failure stays primary.
The cross-layer timeout control and all 63 Node tests pass, including 58 Python
controls; three targeted timeout/status mutations are detected. This bounds the
diagnostic attempt without claiming per-read preemption or job sufficiency.
The earlier missing-font roster remains mandatory in a distinct diagnostic
selection; actual execution remains disabled.

Failure-only inventory now uses `bw.gui-hdd.inventory-failure.v2`: exact raw event
bytes are embedded with a 256 KiB cap, separate hash/extent and reserved diagnostic
budget. Unavailable originals or incomplete path diagnostics remain explicit
failures. The standalone reader recomputes event/template/source-head and
run/workflow joins against an independently frozen policy. It never imports the
producer or converts a failed observation into a runtime candidate. Successful
inventory v2, actual request v3, executable size rules and actual guards remain
unchanged. The 63 Node tests include 65 Python controls for this continuation.

For a future v2 failure original, after official artifact and source metadata
admission, audit the selected original files from the repository root:

```sh
/usr/bin/python3 -B scripts/read-i80386-hdd-gui-originals.py \
  --inventory-failure gui-inventory/inventory-failure.json \
  --template gui-inventory/runtime-template.json \
  --expected reviewed-failure-policy.json
```

The policy schema is `bw.gui-hdd.inventory-failure-expectation.v2`: supply
independently selected source21 `head`/`tree`/`files`, template and failure
`byteLength`/`sha256`, official `runId` and executing `workflowSha`. Consult the
reader's closed field checks; do not derive these pins from the untrusted
failure payload itself. A successful audit still reports `candidate: false`
and `qualified: false`. Earlier failure v1 originals lack the raw event and
cannot gain this joined-event result retroactively.

Preserve the previous head's separate [native test failure](https://github.com/CrispStrobe/brickwright/actions/runs/39111138775/job/117627344977):
`renode_brick_state::tests::lockstep_steps_land_exactly_one_quantum_apart_without_polling`
failed while 252 tests passed and ten were ignored. Its cause is unestablished;
do not relabel it as flaky or lower the timing threshold. Coordinate diagnosis
with the native/Renode owner in `apps/tauri/src-tauri/src/renode_brick_state.rs`;
that source is outside this five-path lane. Every enabled final-head check still
has to succeed before source integration.

Continue within the already claimed five implementation paths; dependency
writers and other workflows remain outside this lane. Next tasks are:

1. **Bounded reads and alias source delivered.** The subsequent
   [v2 source checkpoint](https://github.com/CrispStrobe/brickwright/commit/7dd18548e)
   bounds held proc reads to 4097 bytes before parsing and both lazy censuses to
   8192 entries. Explicit directory aliases have a combined 256-alias cap,
   bounded declared resolution and observed target-directory identities. The
   request, inventory template, inventory original/admission and reader are v2;
   result and probe-admission schemas remain v1. All 33 earlier Python test
   bodies are held, with nine additional methods and thirteen detected source
   cuts. The four focused Node wrappers pass independently. No real process,
   browser or guest result is inferred from these mocked controls.
2. Review the fixed `bw.gui-hdd.inventory-template.v2` path roster against the
   locked Playwright package and selected Node/Python/tool closure. Select the
   real pinned headless-shell executable; do not substitute a larger browser or
   silently raise the file cap. The template must contain no operator paths.
   With only the reviewed metadata guards enabled, freeze the exact source head
   and template. The first own-PR `x86-hdd-gui-inventory` event above is already
   consumed and its failed original is already audited. First freeze the new
   failure-collector source. Review the locked Playwright platform dependency
   roster and package-owned font/configuration paths; do not silently remove the
   missing mandatory font or substitute local-host observations. A distinct
   diagnostic event needs its own independently reviewed source/template/event
   admission. Its failure-only original must never become a successful inventory.
   Independently audit the new original once, retaining all failures, before
   freezing any complete runtime input.
   The inventory is an observation, not automatic actual approval or a complete
   host attestation. Preserve any mismatch; do not install a fallback.
   The distinct [diagnostic run39111308927](https://github.com/CrispStrobe/brickwright/actions/runs/39111308927)
   is now consumed and its original acquired once: 288/306 selected files,
   84/101 file aliases and all three directory aliases were observed, with
   no unvisited paths. Thirty-four missing font/configuration paths and one
   zero-length named Python source account for the refusals. Git observation
   was not reached; no successful runtime inventory exists.

   Two source prerequisites are now delivered: exact raw-event failure retention
   and the explicit metadata-only empty Python-source policy described below.
   The earlier original still has only named0644, size-zero stat for the empty
   path, with no observed content hash. Actual-request v4 mapping remains pending;
   existing v3 must not accept the new typed map. Review any package-derived font roster
   as a distinct declared scope, retaining the old failed selection and explaining
   every changed row. Do not delete failed entries solely to obtain green.
3. Independently admit the official frontend Build checkout log, full source
   head/tree/selected closure and producing workflow before selecting its ZIP
   digest from official metadata. The actual controller acquires that original
   once and derives bounded member inventories from authenticated bytes; the
   reader recomputes them. Freeze the `bw.gui-hdd.actual-request.v3` identity
   separately from the producer, including the prior inventory admission.
4. Review final source, exact official event/job/step/artifact joins and resource
   margin before the separate actual activation. The HDD and forward scenarios
   keep 1250/180-second bounds under the 1800-second controller and 35-minute job;
   package/browser setup consumes that same job budget. Per-process limits do
   not prove aggregate containment or continuous process-group ownership.
   After every enabled final-head check passes, admit one bounded actual event
   and audit its original packet with `scripts/read-i80386-hdd-gui-originals.py`,
   without producer imports or browser/guest replay. Preserve failures.
5. Only qualified original evidence plus all enabled final-head checks can
   close the component/composition merge gates. Refresh ownership and normal
   merge parents/tree before merging; source controls alone do not qualify it.

The [typed metadata checkpoint](https://github.com/CrispStrobe/brickwright/commit/1f8565a7a)
delivers template, successful-original, failure and admission v3 with a separate
`emptyPythonSources` map. Only `/usr/lib/python3.12/urllib/__init__.py` is admitted
under the declared `python-empty-package-source` role: root-owned0644, zero
extent, exact empty digest, held one-byte EOF read, four strict metadata snapshots
and successful close. Positive and typed entries share the existing 512-file
limit. Generic file reads and executable/library positive-size checks stay held.
All 63 Node tests and 74 Python controls pass; 17 source mutations are detected,
and the legacy v2 success fixture is byte-identical. These are mocked source
controls, not an observed hosted empty-file result.

For a future externally pinned v3 metadata original, the independent endpoint is:

```sh
/usr/bin/python3 -B scripts/read-i80386-hdd-gui-originals.py \
  --inventory-original gui-inventory/inventory-original.json \
  --template gui-inventory/runtime-template.json \
  --expected reviewed-metadata-policy.json
```

The policy schema is `bw.gui-hdd.inventory-admission.v3`: supply source21,
original/template byte lengths and hashes, official run ID and workflow SHA.
Its verdict keeps `candidate` and `qualified` false and explicitly reports
`actualRequestSupported: false`. Existing template/inventory v2, failure v2 and
actual request/reader v3 stay distinct; this metadata map is not accepted by
actual v3. The new source candidate explicitly maps that role through actual
request/reader v4. Its `bw.gui-hdd.actual-inventory-reference.v1` contains the
unchanged metadata admission v3 descriptor plus independently selected producing
job, artifact and workflow identities. A separately versioned
`bw.gui-hdd.actual-expectation.v4` pins the reference and exact retained metadata
original/template; the independent reader rechecks the metadata observations.
The metadata-only verdict continues to report `actualRequestSupported: false`:
it cannot authorize an actual run.

The actual v4 runtime observations retain and independently grade typed EOF,
empty digest, four strict identity snapshots and close before and after the
guest. They preserve the isolated Python startup envelope, generic positive
file predicates, caps and first/secondary errors. Request/expectation/schema
mixing, wrong role/path/hash, coherent nonempty data and failed readback/close
must refuse. The source candidate passes 63 Node tests including 80 embedded Python controls.
The 74 earlier Python test bodies and the old actual v3 packet verdict remain
unchanged; 22 source mutations and eight independent packet counterexamples
are detected. These tests use manufactured inputs and mocked OS boundaries.
Legacy actual v3 remains separate. Actual execution stays disabled
until complete runtime, Build, source and event admission plus affected clean
browser/guest qualification. The 34 missing baseline font/configuration inputs remain unresolved; the later
font observation below does not change the required roster.

The separate font-discovery source candidate now sets
`FONT_DISCOVERY_ENABLED = True` and enables its distinct conditional
`font-discovery` workflow job. This source activation grants no event or runtime
admission. The exact request was subsequently published and one separately
admitted font event was consumed, as recorded below; `ACTUAL_ENABLED = False`
remains held. Its `bw.gui-hdd.font-discovery-request.v1` pins source21 and
embeds the unchanged baseline template. It collects fixed configuration and
font-directory censuses, held file hash/extent/EOF/identity/close observations,
raw configuration bytes and at most three read-only `dpkg-query` probes:
installed packages, path ownership and the selected owners' manifest union.
The combined manifest output proves union membership only, not individual
package boundaries. Root-owned nonwritable selected system tools are an explicit
platform trust boundary; this is not complete tool/runtime attestation.

The new job uses the held Ubuntu 24.04, Node 22.23.3 and action selections.
A source guard runs before package setup or input retrieval. Setup installs the
unchanged selected packages and Chromium without building the frontend; it has
a ten-minute ceiling. A separate one-minute input step uses the existing
immutable own-repository blob transport. Only that run step receives the API token in its environment.
The token-free recording step runs isolated Python with a four-minute ceiling
around the collector's 180-second cooperative budget. The sixteen-minute job
backstop includes setup and upload; these limits do not prove measured
sufficiency, syscall preemption or aggregate containment. Existing metadata and
actual jobs remain unchanged. The job still requires the selected own-repository
actor, label, first attempt, base/fork conditions and exact request/source/event
joins; source activation alone admits no event.

The delivery controls pass 64 Node tests, including 91 embedded Python controls.
All 88 earlier Python test bodies remain unchanged. Twenty-six workflow drift
variants and independent mocked input/event/token counterexamples refuse. The
Python test wrapper now sends its controls through stdin to avoid the operating
system's single-argument limit; assertions and timeouts remain unchanged. These
are source controls, not hosted setup, font-selection or browser qualification.

The upload step runs after failure and retains the outputs actually created:
guard/setup/input/collector diagnostics, the request when installed, and separate
process originals when collected. An early refusal does not invent missing
request or collection evidence. A failure stays a failure. Admit the producing
job and artifact metadata independently
before acquiring the original once; do not infer executing workflow identity
from the source run head or retry a consumed event.

The distinct `bw.gui-hdd.font-discovery-original.v1` preserves partial probe
streams and the first refusal. Its standalone reader accepts independently
selected source/request/original/run/workflow identities through
`bw.gui-hdd.font-discovery-expectation.v1`. It recomputes structural XML
include/directory references and cycles from bounded raw originals. It never
executes Fontconfig, loads a DTD or proves native traversal/active font selection.
Unsupported syntax and incomplete observations remain explicit. The verdict
always keeps `candidate`, `qualified`, `activeFontSelectionProved` and
`actualRequestSupported` false, including after a complete discovery.

To audit an admitted discovery original without executing its producer:

```sh
/usr/bin/python3 -B scripts/read-i80386-hdd-gui-originals.py \
  --font-discovery font-discovery.original.json \
  --request reviewed-font-request.json \
  --expected reviewed-font-expectation.json
```

The distinct `bw.gui-hdd.font-discovery-delivery-expectation.v1` adds a
read-only delivery envelope around that observation audit. Independently select
the source21/request/archive identities, official run/job/artifact IDs and raw
metadata, plus the executing workflow proof and bytes. The reader checks the
bounded ZIP without extraction, closes its role roster, and joins raw process
and stream originals to the embedded observations. It refuses duplicate,
traversing, symbolic-link, encrypted, oversized or unexpected members before
using their contents. Archive and aggregate member limits are each 32 MiB,
with at most 96 entries; per-role limits apply before inflation.

A terminal producing job is required; unrelated queued jobs do not require the
whole workflow to have concluded successfully. The artifact joins the selected
run, source head, name, digest and size. Historical source is checked against
the retained event and immutable run/job/artifact head fields. A later PR
association may show another head, so its moving nested head is not historical
source authority. The executing workflow commit remains separate from that
source head. Its independently pinned official commit/tree observations join
the workflow entry and raw blob SHA1/SHA256 to source21. Official metadata
provenance is an external admission boundary, not a self-issued payload flag;
the reader does not recompute the complete Git commit/tree object graph.

This first delivery reader requires the original request and discovery
observation, including their asserted raw process/stream roles. It conservatively
refuses early artifacts missing them; preserve those failure originals outside
this reader without inventing observations. A supported terminal failed partial
collection retains its original primary error and producing conclusion. This
initial profile supports success or ordinary collector failure with completed
predecessor/upload steps; cancellation, timeout and other incomplete deliveries
refuse. Every verdict remains observation-only and grants no runtime,
font-selection or actual execution approval. Admit official metadata before acquiring the selected ZIP
once, then audit the retained bytes; this tool never fetches or replays anything.

Audit the already retained delivery without fetching or extracting it:

```sh
/usr/bin/python3 -B scripts/read-i80386-hdd-gui-originals.py \
  --font-discovery-delivery gui-font-discovery.zip \
  --request reviewed-font-request.json \
  --expected reviewed-font-delivery-expectation.json \
  --run metadata/run.json --job metadata/job.json \
  --artifact metadata/artifact.json \
  --workflow-proof metadata/workflow-proof.json \
  --workflow metadata/executing-workflow.yml
```

The expectation pins each metadata original and the complete ZIP independently.
The canonical `bw.gui-hdd.workflow-api-proof.v1` wrapper contains the retained
commit and recursive-tree API original bytes with their exact extents and hashes.
Freeze those originals and executing workflow content separately; never derive
the trusted expectation from an untrusted archive's own declarations.

The separate `bw.gui-hdd.workflow-api-proof.v2` carries those exact API originals
as bounded zlib streams. A recursive tree original can fit its own 4 MiB limit
while its v1 base64 wrapper exceeds the separate 4 MiB proof limit; preserve that
refusal and the retained originals. The v2 representation addresses this size
gap without truncating the tree, fetching it again or increasing either limit.
Each `commit` and `tree` role has closed `codec`, `original` and `compressed`
fields: codec `zlib`, the original extent/hash, and the compressed extent/hash/
canonical base64. Validate both declared bounds and the compressed bytes before
inflation. Decode at most the declared original extent plus one sentinel byte,
then require the exact extent/hash, stream EOF, no unconsumed data and no trailing
or concatenated stream. No flush allocates additional output. The same strict
JSON, ordered parents, complete tree and workflow-blob joins then apply. The v1
format remains supported unchanged. Neither representation authenticates API
provenance or reconstructs the complete Git commit/tree object graph.

The proof-v2 checkpoint passes 76 Node tests, including 102 embedded Python
controls and 12 held snapshot controls. All 98 earlier Python test bodies stay
unchanged. Seven source mutations and 23 independent codec/API counterexamples
are detected; complete and failed-partial offline CLI verdicts preserve v1
behavior. A manufactured 12057-entry recursive tree exercises the size gap.
These are source and original-format controls, not hosted or guest qualification.

Changing the reader changes source21. Rebuild the final canonical request and
explicitly review any private consumer's reader selection; an earlier request or
historical merge proof cannot authorize the new source. Offline tests using
retained API bytes establish format compatibility only, not a new hosted event.


The envelope checkpoint passes 64 Node tests including 96 embedded Python
controls, preserving all 91 earlier Python test bodies. Nineteen source
mutations and 27 independent re-pinned counterexamples are detected. Separate
offline CLI controls cover complete and failed partial manufactured artifacts;
these controls do not establish an actual hosted observation or guest result.

The activation checkpoint passes 64 Node tests including 98 Python controls.
It adds two controls for enabled-default refusal boundaries and changes only
three earlier guard/fixture methods to model the intentional activation; the
remaining 108 earlier methods stay held. Twenty-six workflow drift cases and
seven activation mutations are detected, with six independent controls and
three independent mutation cuts. Guards perform no input or runtime work. These
source results establish no hosted font observation or guest qualification.

The actual frontend and original-delivery ZIP readers now validate the complete
header census before inflating any member. They require exact untruncated names,
unique paths, regular file or directory types, empty directory payloads, and
unencrypted stored/deflated entries under the held role and aggregate limits.
This closes manufactured packets previously accepted with NUL-truncated names,
special-file types or ignored directory payloads. Both the controller and the
independent frontend reader apply this policy; the original-delivery reader
retains its own prefix, role and inventory checks. Ordinary frontend ZIP, Pages
TAR delivery, and prefixed/unprefixed actual originals remain supported. Positive
file-size predicates, TAR policy, v3/v4 schemas and actual guards are unchanged.
These are source counterexamples and controls, not observed hosted guest results.
The ZIP repair passes nine Node tests including 107 Python controls; all 102
earlier Python test bodies stay unchanged. Twelve source mutations and 21
independent coherent header counterexamples are detected. Valid frontend formats
and both actual versions retain their earlier prefixed/unprefixed verdicts.

The full source CI then found two integration failures: the GUI workflow was
absent from generated CI readings, and the original-control test parsed only the
last stdout line. The helper now requires one complete JSON summary and rejects
prefix, suffix and concatenated output. Ten Node tests including all 107 Python
controls pass, as do the eleven existing gate-shape tests; two parsing mutations
are detected. No threshold, detector baseline, runtime or workflow condition
changed. The earlier failed CI results remain failures.

The scoped census claim
[PR1079](https://github.com/CrispStrobe/brickwright/pull/1079) is merged.
The unchanged generator refreshed only this workflow from 19 completed historical
runs, retaining all 21 unrelated workflow rows, their 299 ordered runs and main
provenance. Eleven exact dated pointers document the actual/font paths that
those readings never executed. Actual remains disabled; font discovery still
requires its separate source/request/workflow/event admission. The two failed
inventory runs remain failed observations, with no replay or new event to seed
coverage. No generator, census assertion, detector baseline or workflow condition
changed. Run the existing census tests and explicit generator `--check`; `--fetch`
alone prints uncovered steps without failing for them. Finish final-head CI and
rebuild source21/request/workflow selections before any discovery event.
The explicit generator check and 25 affected census, gate-shape and build-trigger
controls pass. These are source and metadata checks; final hosted CI and clean
affected browser/guest qualification remain separate requirements.

The one admitted font event is consumed:
[run39170725966](https://github.com/CrispStrobe/brickwright/actions/runs/39170725966),
[job117803003700](https://github.com/CrispStrobe/brickwright/actions/runs/39170725966/job/117803003700).
The collector failed after guard, setup and input installation succeeded;
upload also succeeded. Sole artifact `12152507881`, 491,919 bytes, SHA256
`b0188bdde17b0645ae2707a74b494512531b352c14fbef484ffff96b887173db`,
was retained once after official metadata admission. The independent standalone
delivery reader, selected by SHA256
`f075f669c4950d5fece113a57490b9b4bc94eaf90743f70715462c8270ac0a0b`,
exited zero when validating that failed partial delivery. This validates the
retained evidence; it does not make the producing job successful.
The executing workflow `e983be1c6b22a685107dae75794903bb42c470d2`
was joined separately from source head `79afc8bc`.

The first refusal was an alias outside the admitted font roots while visiting
`/usr/share/fonts/truetype`. The retained alias
`fonts-japanese-gothic.ttf` points to
`/etc/alternatives/fonts-japanese-gothic.ttf`; the next hop and terminal file
type were not observed. Do not invent the next target. The partial original
contains 246 file observations, 38 aliases and 34 missing baseline paths.
Packages remain null and no package probes ran. These are validated partial
observations, not a successful inventory, new roster, native font selection,
rendering, runtime or guest qualification. All 38 retained configuration
rows also have unsupported or opaque content; 15 retain DTD-parser refusals.
Recorded references cover only the supported structural subset. Neither those
references nor an absence of recorded cycles proves native traversal or selection.
The retained `truetype` parent also has root ownership and mode `040777`.
A policy requiring nonwritable parents would refuse before reaching this alias.
Resolve and document that metadata observation boundary before any later hosted
chain event; do not silently relax existing runtime checks or claim traversal
of the retained environment from manufactured positives.

Separate source continuations remain unmerged drafts:
[the exact-entry chain reader (PR1084)](https://github.com/CrispStrobe/brickwright/pull/1084)
and [the historical bridge observation (PR1086)](https://github.com/CrispStrobe/brickwright/pull/1086),
followed by [the chain dependency repair (PR1088)](https://github.com/CrispStrobe/brickwright/pull/1088).
They keep chain, bridge and actual execution disabled. The chain's strict parent
policy would refuse the retained `040777` parent. The bridge asks a different
question: it starts at the selected alternatives child named in the prior
observation, independently binds and regrades the historical bytes, and cannot
claim a current association through the old font entry. Existing discovery and
delivery formats, the baseline and all earlier failures remain preserved.

Independent manufactured packets also exposed a partial-prefix defect in the
earlier chain reader: a failed link or parent witness could still authorize a
later observation in an incomplete packet. The separately scoped PR1088 repair in
`verify_font_chain` requires successful dependencies before accepting later path
facts, while preserving genuine failed final witnesses. Its source and test
checkpoint passes 65 Node tests including 128 Python controls. Independent review
rejects 13 negative packets and accepts six valid complete or partial packets;
all 125 earlier Python test bodies and helpers remain unchanged. Final-head CI
is still pending. Passing a failed original through a reader never makes that
observation successful.

A fresh agent should continue in these bounded lanes:

1. Preserve the v1 original, unchanged baseline, first failures and all earlier
   consumed observations. Do not replay this event or download the artifact
   again. Keep the existing probe failure rules, caps and required roster;
   passing a partial original through its reader cannot make collection green.
2. Continue the existing disabled chain/bridge source drafts and the older chain
   reader's partial-prefix repair. Require coherent failed-close, identity-drift
   and writable-parent negatives, valid complete/failed-prefix positives and
   predicate-removal mutations.
   Then separately implement the bridge's disabled official delivery boundary:
   a literal job/event policy, externally selected prior/source/workflow joins,
   exact original roles and raw source-process/stdout/stderr sidecars. Its inner
   observation reader alone does not authenticate official metadata or child
   processes. Preserve the strict parent, eight-hop, cycle, escape and terminal
   font-root policy, existing caps and all prior formats. Review the exact new
   reader and consumer selection independently before any activation.
3. Require all enabled exact-head source checks to succeed. Separately admit a
   later versioned observation's request, source, executing workflow, event,
   finite resources and original roles before its single event. Never remove
   and reapply the old label, rerun the consumed run or use a fallback dispatch.
   Admit official producing metadata before acquiring its sole original once,
   then audit retained bytes independently, preserving partial failure.
4. Establish native Fontconfig configuration, version, cache, include and alias
   selection evidence separately before reviewing a new versioned runtime
   template. Admit package ownership without guessing from filenames or
   subtracting failed baseline paths. Then close the complete runtime and
   frontend Build/source/archive graph and qualify actual HDD persistence and
   forward debugging through clean affected browser/guest runs. Every enabled
   exact-head source check and separate actual admission remains mandatory.

Main [PR1066](https://github.com/CrispStrobe/brickwright/pull/1066) advanced
CUI from `055930e` to `fe89e3425bf323b1acd9e3f98df6a7383e9b836b`.
The [separate consumer update](https://github.com/CrispStrobe/brickwright/commit/d07be38c7)
explicitly matches that canonical selection without writing dependencies. The
four CUI commits change five module-label/layout and supporting files; existing
386 target/API source is unchanged. Full rendering and this scenario's browser
acceptance still need their own qualification. Board and SB3 selections stay held.

The earlier composition explicitly advanced only the GUI consumer expectation
to canonical CUI `bda0157410a6704ae859a19398a8a742cdfae50b`, checking root
devDependencies, GUI dependencies, both lock roots/resolutions and vendor pins.
The dependency declarations remain main bytes. Earlier request/source selections
are historical and cannot admit this source without rebuilding their bindings.
All actual and new observation guards remain held; no browser qualification is inferred.
The supplier changes chip/discrete faces, crowded terminal labels and aliased
terminal geometry. No 386 engine API files change, but rendering needs fresh
qualification. The composed source passes 79 Node tests, including 135 embedded
Python controls and HDD snapshot controls, with no failures or skips. The new
canonical consistency control detects the stale consumer and drift in all seven
declarations. The original reader and historical requests remain tied to their
selected source; this composition does not authorize a hosted event.

Both controller and reader CUI declarations must match the canonical package,
lock and vendor selection. A synthetic noncurrent consumer tests refusal without
retaining a stale active supplier pin. The earlier CI failure stays retained;
this repair changes no dependency version or runtime qualification.

The earlier main pin adoption explicitly selected Board
`fac3a5a9928c8b53a778b0c42d8d91d5e693e4b7` and CUI
`a7621be4d40d089826d78cd1e656b7c592ef16db` in both consumers, preserving main
package/lock/vendor declarations. Board controls actual v3/v4 admission and
scenario proof grading; historical actual originals require their retained
historical reader. Font-prior formats and bytes remain held. New source, reader
and request bindings, exact-head CI and affected guest qualification remain
pending; this pin refresh establishes no new runtime result.

The 2026-10-20 consumer composition follows main's canonical CUI selection
`989f9541de610d2a742b36867c12df61d36b0c24` in both the controller and reader.
Root and GUI package/lock declarations and vendor pins remain unchanged;
Board and SB3 selections are also unchanged. This explicitly updates the
consumer identity after the B27 part-face adoption, not a dependency selection
or browser/guest qualification. Actual execution stays disabled. Historical
originals retain their historical readers and source bindings. Any new actual
needs a freshly admitted complete source, request, workflow/event and artifact
envelope, followed by the existing affected GUI/guest acceptance.

After the bw-circuit-ui bump to `989f9541de610d2a742b36867c12df61d36b0c24`
(Lite #1122, B27 part faces) both consumers' CUI declarations follow it, so the
controls check again matches the canonical package, lock and vendor selection.
Board is unchanged. This adoption also establishes no new runtime result; the
pending qualification above still applies.

The dependency-free focused check is:

```sh
node --test test/i80386-hdd-gui-actual.test.mjs test/i80386-hdd-download.test.mjs
```

The earlier handoff proposal above is a dated snapshot. Read-only source
observations on 2026-10-16 found PR975 head `e553bb7a` selecting Board `f00f8ff5`,
then head `943d540c` selecting Board `f84ba60e`. These are historical observations,
not a supplier selection or qualification for a future actual. The latter
source contains the snapshot target and factory wiring; the selected 386
module graph matches the retained CLI source anchor, while an unrelated
labwired source change means the entire supplier source tree is not identical.
Source equality does not qualify an installed browser or transfer ownership.

At the 2026-10-18 refresh, [PR975](https://github.com/CrispStrobe/brickwright/pull/975)
has merged. Canonical main selects Board
`f84ba60ead0a90deb9830f0c1468839c293ecf05`, CUI
`055930ec51300e0d71466c696ce1bf76284bde38` and SB3
`a13f92b8bc4b06f0cb9ffec22bab71f06db7ac76`. Historical proposal holds above
are superseded by the merged adoption, not a transfer of dependency writers.
Refresh canonical package, lock and vendor-pin declarations immediately before
source and actual admission. Independently admit the complete installed graph;
a merged pin alone does not qualify these GUI scenarios. The root manifest's
authoritative Board field is `devDependencies`; the GUI manifest's is
`dependencies`. Refuse missing, conflicting or duplicate declarations.

After qualified adoption and source/build admission, run the existing genuine
download/reload scenario with its fixed free floppy and 306×4×17 data image.
Retain actual canvas/input/download evidence, the exact exported image and JSON,
fresh-session marker readback, the paused original session's identity/counters,
and terminal process/resource/cleanup observations. Freeze a standalone reader
and the attempt-1 official event/job/step/artifact joins before execution.
Preserve all current predicates and limits; source controls cannot replace an
original or justify an automatic retry.

The candidate user flow is **Code → device selector → Manage machines… →
FreeDOS VGA (named 386 profile)**. Select the boot floppy and a type-1 HDD
(306×4×17), then **Boot FreeDOS VGA**. After the guest closes its files, pause
and use **Download HDD image + JSON**. To reopen it, start a fresh machine with
the same floppy and the downloaded image in the HDD chooser. This is an
explicit exported copy; the original selected file is not an automatic save
destination. The download action is still in the unmerged composition, and
its installed browser acceptance is the task above. Optional AT BIOS and VGA
ROM choosers and the bundled free firmware remain existing profile choices;
other disk geometries and ISO/CD images are outside this acceptance.

A separate bounded forward-debug scenario must demonstrate actual UI pause,
code breakpoint, instruction step, full-width register and read-only physical
memory inspection, resume and pane retention. Dedicated supplier support does
not provide mode-aware disassembly, step-over/out, architectural checkpoint or
reverse execution. ZIP selection in PR992 remains a separate acceptance task;
ISO/CD/ATAPI and general DOSBox compatibility are outside this claim.

## Finite inventory bootstrap checkpoint — 2026-10-26

The [once-selected finite V7 inventory](https://github.com/CrispStrobe/brickwright/actions/runs/40352829291)
failed Chromium dependency setup before inventory observation. Its failure is
retained and the event is spent. The [distinct F8 lane](../lanes/2026-10-26-x86-finite-v8-browser-bootstrap.md)
starts disabled and reuses the existing official-Ubuntu mirror preparation
helper unchanged, with explicit Git/workspace source admission before package
setup. Historical readers, supplier identities and limits remain separate.

This bootstrap source change adds no GUI feature or successful installed graph.
Fresh source/Build and F8 original qualification are required before the
separate actual-V8 HDD/JSON export, fresh reload/readback and forward-debug
acceptance. Those actual GUI results remain pending; no whole-OS, physical or
performance result follows from bootstrap or synthetic controls.

## Reviewed F8 source arming — 2026-10-26

The preceding bootstrap checkpoint records disabled Phase A. A separately
reviewed source commit now arms only the F8 producer, independent reader and
workflow route. F7 execution stays retired; its failed original and historical
reader are retained. Fixed supplier epochs, the unchanged mirror helper and
all limits are held. Source controls pass, but final exact-head source/Build
qualification and separate one-shot F8 admission remain pending. Actual V8
GUI export/reload and forward-debug acceptance remain unselected and unproved.

## Finite V9 resolver-role source checkpoint — 2026-10-27

The [once-selected V8 inventory](https://github.com/CrispStrobe/brickwright/actions/runs/40422314383)
passed source and trusted setup, then refused `/etc/resolv.conf` because its
selected alias role did not match the observed regular file. Its independent
negative reader joined the event with qualification false. Preserve that
failure and the earlier V7 setup failure; both events are spent.

The [distinct V9 continuation](../lanes/2026-10-27-x86-finite-v9-resolver-role.md)
has a disabled source candidate selecting only that path as a regular file.
Historical V8 wire meanings and strict alias checks remain held. Source controls
and pin-role separation do not qualify a new hosted inventory. Separate reviewed
arming, exact-head source/Build admission, one V9 event and independent original
reading precede native/runtime joins and the still-pending actual-V8 FreeDOS
export/reload and forward-debug GUI acceptance.

Current source status: [separately reviewed V9 arming](../lanes/2026-10-27-x86-finite-v9-resolver-role.md#separate-v9-source-arming-checkpoint--2026-10-27)
is armed but unselected; final source CI, Build admission and actual events remain pending.

## GUI HDD and forward-debug follow-through (2026-11-12)

The selected eighth GUI acceptance event failed at the editor-tab round trip:
the application exposes the accessible label `Circuit`, while the scenario
looked for `Circuits`. Its HDD export and fresh readback passed, and the
forward-debug trace reached pause after resume; the tab round trip did not
execute. Preserve the failed event and its original evidence; it is spent.

PR #1627 corrects the exact accessible-label lookup and adds a focused control
against the actual GUI label. Refresh its head and all enabled checks before
acting. A clean source-bound current-head UI rehearsal passed all 11 phases, including
Circuit to Code with the same target and all 90 returned register and cycle
fields unchanged. It does not establish fresh HDD persistence or an official
actual-event pass. Refresh the source/request bindings and separately admit and
run the next appropriately authorized acceptance event, then independently
join its original evidence. Require the Circuit-to-Code round trip to preserve
the same target, paused state and complete register readback. Do not repeat the
spent event or claim whole-system qualification from the earlier HDD success.
