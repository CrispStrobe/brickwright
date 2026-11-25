# SPIKE execution: current state and next lanes

The current integration closeout, completed-work summary and scoped pending
tasks are in the [fresh-agent handoff](INTEGRATION-NEXT-STEPS.md#start-here-current-closeout).
Read that section before treating an older dated pending statement below as
current work. The G02/G03 finite results and remaining platform boundaries stay
recorded here.

Recorded 2026-10-05; adoption checkpoint 2026-10-07; lifecycle follow-up 2026-10-15. Refresh the public default branches and `LANES.md` before
claiming a task. This is a bounded handover, not full firmware compatibility or
physical SPIKE qualification. Repository-relative paths below belong to the
named owner. Operational locations, reference images and raw transcripts are
not public documentation inputs.

## G02 current-main installed matrix — 2026-10-24

Installed Linux qualification of current main (`d7fde5bf`, with the compiled
MicroPython support that matches the packaged runtime), each case run once in
a fresh owned container (2 CPU, 2 GiB, no network, unchanged 120 s startup):

- **MicroPython startup root cause.** Legacy source-overlay support paired with
  a compiled-model runtime aborted the model include, so the debugger endpoint
  never opened (`rsp-connect unavailable` after 60 s). Pin preparation now
  refuses that pairing and the native producer accepts the compiled profile pin
  ([PR1349](https://github.com/CrispStrobe/brickwright/pull/1349)). With
  compiled support, startup attaches at 32.6 s.
- **MicroPython matrix:** raw-REPL completion and guest error with six motors,
  Stop during final sampling, ownership release and distinct fresh recovery
  across UART generations 1–6, with native wrong-caller-generation refusal.
  An independent reader accepted all six cases.
- **NuttX cases:** dual Stop (source and Python), active cancellation,
  storage, Python storage, Python cancellation, app-restart storage (source and
  Python), backend switch and view switch pass. The first app-restart attempt
  failed because the controller's one-shot Code-tab click after restart did not
  select the tab; a revision that retries the click until the tab is selected
  passed. That failure is retained.
- **Pane disposal:** found a real defect. Closing the arena during a
  dual-ultrasonic run left port F's sensor in the shared hub for the next pane.
  [PR1355](https://github.com/CrispStrobe/brickwright/pull/1355) returns
  port F after the disposed Stop settles unless a newer session owns the hub;
  the installed case passes on an executable built from that head (merged as
  `b06ad7c6`).
- **Selected-image races:** a real native selection of the operator image, with
  only its return delayed, is published normally and is ignored as stale after
  Reset or arena closure.
- **Generation process census:** a host-side collector sampled the app's
  process tree every 100 ms during the six-generation MicroPython matrix:
  2,177 samples, largest gap 132 ms (limit 250 ms), six distinct Renode
  processes, never more than one at a time, none after the app exited. A first
  run at a 200 ms period missed the 250 ms limit once (252.7 ms); it is
  retained and the collector, not the limit, was changed.
- **Late polls:** the session's poll fence is shared by every backend; NuttX
  late-error adversaries (PR936) and the MicroPython final-sampling Stop cover it.

These are finite installed Linux results for the named sources. They make no
physical, reference-firmware, performance, release or licence claim.

## Current integration checkpoint — 2026-10-17

The newer [integration handoff](INTEGRATION-NEXT-STEPS.md) scopes the remaining
work, qualification gates and release prerequisites. Older dated sections below
retain their original source and observation boundaries.

[PR990](https://github.com/CrispStrobe/brickwright/pull/990) is merged as
`6d9dfeb1d50139de517cfbdf302055b71eab125f`. Finite installed Linux Stop,
held teardown-return, cleanup and two own-NuttX startup cases passed. This does
not qualify two actual UI Stops or close G02. The later generation diagnostic
refused readiness before an armed native run; its 4.809-second capture does not
qualify the required 250 ms cadence. The bounded collector/reader source
controls remain unwired and require independent review before live admission.

Next: complete actual source-bound G02 generation/chooser/final-sampling,
late-poll, deferred-storage and two-UI-Stop coverage without weakening the
original observation, resource, ownership, cleanup or recovery requirements.
G03 usability, G05 provenance/distribution and physical/reference behavior remain
separate. Mobile packaging and TestFlight gates are listed in the handoff;
Linux component success does not satisfy them.

## Pending native Stop serialization — 2026-10-15

A direct second pane Stop can arrive after session detachment but before native
clock ownership release. The separate G02 follow-up remembers and joins that
pending teardown before shared clock/backend/topology cleanup or a later Start.
It retains intent and bridge ownership, waits for overlapping teardown results,
and preserves the original failure for the current caller. Twelve new host
controls pass, six broken guards are caught, and 220 affected controls passed
before the final focused case was added. Older timing controls preserve late
reply delivery after actual teardown instead of waiting circularly.

The Code caller/output follow-up [PR985](https://github.com/CrispStrobe/brickwright/pull/985) is merged. Its three frozen
package cases do not qualify repeated Stop. Fresh installed own-guest repeated-Stop cleanup/recovery and final-head CI are still
required; the earlier lifecycle package does not qualify this implementation.
Full G02, physical/reference, licensing and release qualification remain open.


## Installed G02 Code caller and output qualification — 2026-10-15

Frozen consumer `59ddd74174f644f330f06ce567fac6b8c5f7dde3` passes three
installed own-NuttX cases and their standalone readers, with six successful
native startup transactions, full cleanup and distinct recovery in every case.
Official frontend checkout and consumer trees match; independent package/input
audits pass. Its eleven enabled source-head checks pass in
[run38790549120](https://github.com/CrispStrobe/brickwright/actions/runs/38790549120)
and the separate vendor check; two conditional GUI/deployment jobs skip.

- An older Code call's original successful return cannot clear a newer pending
  caller's busy flag, completed status or exact `42\n` output.
- An authored error delivered from the older call likewise leaves the newer
  caller's feedback unchanged. Both cases begin through the real Code control,
  preserve the original pane/native calls for two Python uploads, and explicitly
  author concurrent mounted-handler entry while the ordinary toolbar is busy.
  They do not establish two clickable busy toolbar runs or arbitrary scheduling.
- A fresh original old-Python output frame is held across actual replacement,
  STOP and upload preparation. No old/preparatory output reaches the new Code
  consumer before the original START reply is accepted. Current output first
  arrives in a later `state.read`; immediate START output remains host-covered.

Three failed test attempts remain preserved: a missing expected print newline,
a snapshot of a not-yet-created log, and a guest-time delay that did not fit the
unchanged observation window. Corrected controls require exact print bytes,
record absent logs explicitly and use a shorter authored guest delay. They
retain fresh native frame/sequence/reply provenance, original calls, cleanup,
recovery and the same observation/resource bounds. Successful cases were not
replayed to read evidence. Product sources and the installed package did not
change during these corrections.

This result belongs to the named frozen package. Integration preserves its
SPIKE/native inputs and both importer copies while retaining newer main work.
Final documentation-head CI, the lifecycle integration in
[PR979](https://github.com/CrispStrobe/brickwright/pull/979), and exact-head
merge review remain required. The repeated-Stop follow-up in
[PR990](https://github.com/CrispStrobe/brickwright/pull/990) is separate and
not installed-qualified here. Whole G02, reference/physical behavior, rollback,
licensing, distribution and release qualification remain open.

## G02 replacement-output phase follow-up — 2026-10-15

`lane/spike-g02-output-phase-20261015` keeps prior poll/STOP and upload-preparation
output out of the new Code consumer. The existing reply decoder must admit the
requested START operation/id with success and an executing or terminal state
before that consumer receives output. Immediate and terminal START output,
delayed fresh output, Stop reentry and retry stay covered.

Thirteen authored session/client/pane controls pass; the original baseline fails
eight, and ten broken guards are detected. All 112 affected host controls pass.
The initial broader run lacked a sparse importer input; it is preserved, the
tracked input was materialized, and the final affected run passes. These are host
controls. The frozen consumer above now passes source-bound installed output,
frame/reply, cleanup and recovery qualification; final documentation-head CI
and merge review remain pending. This is separate from the frozen composed qualification below;
it changes no firmware/native/model pin or importer logic and does not establish
physical UART attribution or close G02.

## Composed G02 qualification target — 2026-10-15

`lane/spike-g02-lifecycle-batch-20261015` integrates the existing fixes from
[PR966](https://github.com/CrispStrobe/brickwright/pull/966),
[PR967](https://github.com/CrispStrobe/brickwright/pull/967),
[PR973](https://github.com/CrispStrobe/brickwright/pull/973) and
[PR974](https://github.com/CrispStrobe/brickwright/pull/974), in that order.
The Pause conflict preserves full-session pending-upload cancellation and the
retained-session ownership guard. All 176 affected host controls pass; a new
combined sequence rejects both single-fix baselines. Eleven unchanged pane
methods and the session file match their reviewed inputs.

The frozen consumer `f903a966ea348fd7c3abd0ba693194fc813b4997` now passes
all fifteen source-bound installed own-NuttX cases: Pause four, world/manual
drive four, upload/Stop four and Code three. All individual readers and the
combined reader pass, with cleanup, distinct recovery and thirty successful
native startups. Official frontend checkout and consumer trees match; package
payload/input audits pass. All eleven enabled source-head checks pass in
[run38769805667](https://github.com/CrispStrobe/brickwright/actions/runs/38769805667)
(two conditional GUI/deployment jobs skip).

Five earlier failed test attempts remain preserved. Corrections address held
reply ordering, both React component-pointer forms, real editor clearing before
recovery language selection, native recorder lifetime through retry, and waiting
the original visible Stop's returned teardown promise. Neither deadlines nor
the requirement to capture both real retry START replies was weakened. A direct
second pane Stop before the first teardown completes still has an open clock
ownership boundary; see the proposed continuation in [LANES.md](../LANES.md).

Current main's separate importer/debug work is retained; SPIKE session/pane/
native inputs and the NuttX dispatcher method remain unchanged from the tested
consumer. Final documentation-head checks and merge review are pending. Earlier
and current installed results remain attributed to their exact packages. The
new overlapping caller/output changes in
[PR985](https://github.com/CrispStrobe/brickwright/pull/985) are separate and
are not installed-qualified by this result. G02, physical/reference behavior,
rollback, licensing and release qualification remain open.

Qualification receipts must name the final consumer commit, including any
documentation checkpoint. A checkpoint retains the tested product sources and
uses a current fully labelled PR event for both enabled CI tiers.

## Pause integration qualification — 2026-10-15

The pane ownership fix on `lane/spike-g02-pause-ownership-20261015` preserves
current Pause/Reset/Step actions while rejecting obsolete continuations. Its
first tested consumer `beb518eaba4597afe6ee75fe14a699cc7d9c8ab9` passed four
installed own-NuttX Pause success/error-delivery cases, including real Reset
replacement, cleanup and distinct recovery. Eight native startup transactions
and four standalone readers passed. Generic Step/backend paths remain host-only.

The branch now integrates main's separately qualified compiled MicroPython
launch work. Three native inputs differ from that first NuttX consumer. The
composed source therefore still needs a fresh source-bound own-NuttX matrix and
final exact-head CI; the earlier result does not qualify every evolving package.
Firmware, Runtime/model and dependency pins are unchanged by this lane. Full G02,
physical safety, reference boot, release and licensing remain outside this result.

## Pending replacement Code feedback fix — 2026-10-15

On `lane/spike-g02-code-feedback-20261015`, Code receives a starting notification
before replacement waits for the previous poll and STOP. The session retains
internal observations while withholding old/preparatory program feedback until
upload/START succeeds; subsequent completion stays observable. A current upload
rejection reports its error and clears Code's running state. The live native pane
continues observing firmware, while that failed Code consumer keeps its error.
Retried uploads and fresh cold runs invalidate previous upload listeners.
An already closed session's cancellation keeps Stop feedback.

Twelve authored controls use the real session/client/feedback, the original Code
dispatcher and shipped pane methods with authored native replies. All twelve and
99 affected host controls pass; eleven broken guards are detected. The initial
explicit-cancellation regression remains preserved. Exact-head CI and fresh
installed own-NuttX Code re-upload/visible Stop/completion/live-error/retry/cold
recovery remain pending. This is stacked on the pending-upload Arena Stop fix.
Concurrent caller completion and broader output attribution remain separate
boundaries. These controls do not qualify every evolving package or close G02,
G03, physical safety, rollback, distribution or licensing.

## G02 Code caller ownership — 2026-10-15

The scope claim in [PR978](https://github.com/CrispStrobe/brickwright/pull/978)
is merged. The implementation gives each NuttX Code run its own caller token:
old completions, errors, output and callbacks cannot replace a newer caller's
feedback, and Stop cancels the current waiter before it can submit code. Delayed
Stop dispatch and error delivery also check the caller. Other target dispatchers
retain their existing owners. The existing generated importer twin receives the
same method change. See [LANES.md](../LANES.md) for the bounded ownership scope.

Twenty focused authored host controls pass; the original dispatcher passes six
and fails fourteen. All ten deliberately weakened variants are detected by
behavioral tests. These controls cover caller scheduling rather than native
UART output attribution or rendered cold-phase controls. The frozen consumer
above now passes both finite installed caller cases, cleanup and distinct
recovery. Final documentation-head CI and exact-head merge review remain
required. The separate frozen lifecycle-batch package contains neither this
caller change nor the later output-phase follow-up.

## Qualified G02 lifecycle boundaries — 2026-10-15

Seven focused changes have landed, each with a separately frozen installed
consumer. These observations qualify the named source and owned guest scenarios;
they do not qualify every later package assembled from main.

- [PR895](https://github.com/CrispStrobe/brickwright/pull/895), tested
  consumer `b776bef598ae4608d93fa8c07ce17a842abc7dde`: after the old pane's real
  firmware Stop returns, its resumed cleanup cannot stop a replacement VM.
  The installed case retains positive Stop, Reset/Start and fresh guest recovery.
- [PR898](https://github.com/CrispStrobe/brickwright/pull/898), tested
  consumer `3be3c02ed72ac79d5dbf447100073cc46fd88e56`: the fresh native package
  passes two owned-NuttX startups, teardown/replacement and subsequent recovery.
  The closed startup trace records two complete transactions. Its shared EV3
  path separately passes both exact public guest tests in
  [run38516801049](https://github.com/CrispStrobe/brickwright/actions/runs/38516801049),
  with one executed test and no failures or ignored tests in each invocation.
  The EV3 workflow's Runtime pin remains separate from the NuttX package pin.
- [PR905](https://github.com/CrispStrobe/brickwright/pull/905), tested
  consumer `ecc0ccb36006c871ab3e40109d7c92f6268e8c8a`: Stop invoked synchronously
  by the real final-frame or NuttX program-state observer suppresses a later
  completion callback. Each installed case observes the real owned guest reach
  COMPLETE, invokes the original pane Stop, verifies ownership/clock/session
  release, then completes a different guest session normally and stops it.
  The baseline frame case had reproduced Stop requested → completion → stopped;
  both candidate cases produce only Stop requested → stopped. This concerns late
  notification after Stop, not a claim of continued guest execution after Stop.
- [PR912](https://github.com/CrispStrobe/brickwright/pull/912), tested
  consumer `2d5e560b0357c924b434916e590a24070397fa22`, merged as
  `c5e31b8324fea454afe08ad682f8b98f2ab43596`: closure checks between observers
  and after an awaited packet input-write reply suppress later native input
  requests or frame callbacks after Stop. Both installed own-NuttX race cases
  pass: Stop from real Python output, and Stop while a real correlated STOP
  packet's following input-write return is held. Each releases all owned
  configuration, external backend, clock and pane session references, then
  completes a distinct fresh guest and stops it normally.


- [PR928](https://github.com/CrispStrobe/brickwright/pull/928), tested
  consumer `aaa60836f1375a44cb69224e95dc511dd56e8d1c`, merged as
  `fff84dc6ead5c1da7a89fee52a256497d6cc32f2`: deferred-storage closure checks
  suppress later frame/program-state publication after observer Stop. Both
  installed own-NuttX cases first complete ordinary durable SAVE and LOAD to
  READY without START, then cancel a newly correlated operation and complete
  a distinct fresh guest. The terminal LOAD/frame Stop succeeds. Pending
  SAVE/hub Stop retains the native checkpoint-refusal response while local
  cleanup and recovery pass; this does not fix that refusal or promise rollback.
- [PR930](https://github.com/CrispStrobe/brickwright/pull/930), tested
  consumer `59c78f3bee80b496dcd2b76180397bbae563a634`, merged as
  `9a6706dc430472345031a82a2f83e04d4ec79035`: Stop from configuration
  notification prevents native startup, and Stop from first-frame publication
  prevents subsequent input/program requests. Both installed cases release
  ownership, produce no monitored frame/output/program-state notification
  beginning after closure, complete a distinct fresh guest and release it on
  final Stop. Configuration cancellation admits zero arena-session native calls; first-frame
  cancellation permits only native start/read/close.

- [PR936](https://github.com/CrispStrobe/brickwright/pull/936), tested
  consumer `65494ed81b8751f2f6f2f3e9e6c57e5f07e125c0`, merged as
  `e22fd9fe0017b4e8291b4ff2af44ff6b9d6efde1`: a scheduled poll failure delivered
  after original pane Stop no longer invokes an obsolete error observer. Both
  installed own-NuttX cases pass after real native state reads and explicitly
  authored client-delivery errors: the closed case has no error callback; the
  live case still reports exactly one error before cleanup. Each releases all
  ownership, completes a distinct fresh guest and releases final Stop. This is
  not evidence of an actual native or firmware fault.

PR912 also passes eight installed GUI regressions on that same consumer:
native Start, backend change, Reset and closure; real Code Stop during pending
native startup followed by a completed fresh guest; and real native chooser
cancellation with normal return, Reset and closure. The seven native/chooser
cases do not execute an additional firmware guest. The chooser cases cancel the
actual dialog without selecting an image; they do not qualify selected-image
admission or every chooser/error race. Startup cancellation admits no program
packet before Stop, exits the owned emulator and restores defaults and ownership.

PR912’s 41 affected session controls pass; six new controls fail on the baseline,
and removing each new closure guard is detected. All nine enabled exact-head
hosted checks passed, with only the declared deployment/verification jobs skipped.
Independent readers bind all ten installed cases to the source, application and
configuration hashes and captured controls. Both new race cases retain two
complete 14-record native startup transactions. The predicted and landed merge
trees match, and the landed implementation/test blobs match the qualified source.
The first recovery fixture failed when marker-only Python could not convert into
an empty Pseudo buffer; its corrected successor clears the real editor, selects
Pseudo and waits for the accepted selection before the unchanged recovery program.
That failure and resource-wait expirations remain preserved. No product assertion,
deadline, resource threshold or dependency pin changed to obtain these passes.

PR905's 34 affected session controls pass; three new controls fail on the
baseline, and removing either closure fence is detected. Its nine enabled
exact-head hosted checks passed, including both unit shards and all browser
legs; deployment/verification jobs are conditional. Independent readers checked
all 180 installer files and 23 directories against staged bytes, permissions and
root ownership, and bound native/frontend inputs to the reviewed consumer.
Retained firmware, Runtime and support payloads did not change. Original build,
fixture and startup failures remain preserved in private evidence.


PR928’s 49 session controls and PR930’s 52 controls pass; their new guards are
individually detected by removal controls. Standalone readers bind the fresh
packages and installed cases to the reviewed source, application/configuration
hashes and 191 captured control files per case. Each PR928 case retains 28 raw
startup records. PR930 configuration cancellation retains 14 records from its
fresh recovery guest, and first-frame cancellation plus recovery retain 28.
Both landed changes have only the declared session, test and ledger paths;
qualified implementation/test blobs match their landed versions. The PR928
merge tree matches its prior prediction. The PR930 tree matches independent
recomputation from its actual parents; the intervening main change was ledger
only. These observations do not qualify all later main packages.

All current required hosted contexts pass. PR928’s final
[Build run](https://github.com/CrispStrobe/brickwright/actions/runs/38607200124)
and vendor check have 11 enabled successes. PR930’s
[FAST run](https://github.com/CrispStrobe/brickwright/actions/runs/38610739555),
[THOROUGH run](https://github.com/CrispStrobe/brickwright/actions/runs/38610753537)
and vendor check have 13 successful required executions representing 11 current
named contexts. Its initial code-event full-CI gate failed before the label was
present in that event snapshot; the newer label-event gate passes under the
inherited split-tier contract. That original failure, the earlier PR928 browser
failure and failed baseline/fixture attempts remain preserved. The later PR928 browser pass came from its already-triggered ready-for-review
run. Qualification kept the existing product deadlines, acceptance thresholds
and dependency pins.

PR936's 55 affected session controls pass; the late-rejection baseline fails,
and removing its new closure check restores that failure. Both installed cases
retain 191 control-file hashes and 28 raw startup records. Package readers bind
180 installer files/23 directories, 177 native source files, 5919 frontend files and
126 runtime inputs. The [final readiness run](https://github.com/CrispStrobe/brickwright/actions/runs/38673916767)
passes all ten enabled build jobs; its vendor check also passes. The original
pre-label full-CI gate failure remains preserved, with the later label verdict
and final readiness gate successful. Qualified session/test blobs match their
landed versions, and the landed tree equals the reviewed prediction. Independent
main pin adoptions are retained; this is not qualification of every evolving-main
package. Existing product budgets and firmware/Runtime/model pins did not change.

The [compiled-profile claim PR946](https://github.com/CrispStrobe/brickwright/pull/946)
is merged. Its implementation is in progress: explicit native descriptor/runtime
pins select native platform types while retaining the legacy source-overlay
route. Initial host packaging and actual Rust planner checks pass, including
rejection of mismatched profiles and motor attachment order in both routes.
The source-bound installed Linux package now passes six actual MicroPython
contexts: selected-image Code execution and raw-REPL completion, guest ValueError,
Stop during final sampling, two authored client-delivery identity adversaries
and distinct fresh recovery. A native UART request with a wrong caller generation
is refused, then a read confirms the original attachment remains ready. The
client-delivery adversaries do not simulate actual native attachment transitions.
A standalone reader checks ten original UART reads, six completed native startups,
six distinct generations, ownership release and stopped/non-OOM container state.
The built implementation is `8c1ec5ef066b4d18ab99bd80d569620425c89c03`;
fixture-only follow-up `1058d91cacad66c1a4bf88d08c7e12d0374f4bca` has identical
production sources. All enabled final-head CI checks remain required for
[implementation PR948](https://github.com/CrispStrobe/brickwright/pull/948).
This finite package result does not qualify unrelated later main changes.
Earlier chooser-control, backend-button and sanitized-error expectation failures
remain preserved separately; they are not product fixes or passing matrix runs.
No image download or bundling is implied.

G02 remains open for its full deferred-storage matrix, selected-image and chooser
error races, and complete installed startup/final-sampling, UART-generation and
late-poll matrix across supported backends, beyond the finite own-NuttX
client-delivery cases above. The older opaque
cold-start failures remain unexplained; successful new startups do not diagnose
them. No timeout increase, dependency adoption, physical/reference compatibility,
release or G05 licence/source-to-binary clearance follows from these receipts.
Continue G02 before G03's sandbox/editor usability matrix and the later lanes.

## Stop from a terminal frame callback candidate — 2026-10-14

A focused host control found that firmware polling could notify completion after
its frame observer had synchronously stopped the session. The NuttX program-state
observer could invalidate the session at the same boundary. The candidate checks
closure after each observer so Stop wins before any subsequent completion callback.

Three new authored-boundary controls fail on the baseline: the legacy program
frame, the NuttX frame, and the NuttX program-state callback. All 34 affected
session controls pass with the candidate, including existing MicroPython final
sampling and generation cases. Removing either fence is detected. These are
actual-method host controls, not guest or hardware evidence. At candidate
publication, fresh source-bound installed own-guest cancellation/recovery and
enabled exact-head CI remained required; the qualified follow-up is above. No native/Rust, firmware, Runtime, model pin, request
deadline or physical-accuracy change is proposed.

## Native startup observation candidate — 2026-10-13

The merged [PR891](https://github.com/CrispStrobe/brickwright/pull/891)
claim covers a native-only startup trace candidate. Closed phase/result names
and monotonic elapsed milliseconds distinguish session lock, launch, RSP
connection, interrupt handle, state connection/readiness, applicable identity
checks and attachment. Errors and early returns close the active phase as failed.
The trace emits at most 24 records per call and accepts no paths, arguments,
leases, image identities or backend error text. Public error responses and
startup/session deadlines are unchanged; logging I/O errors are ignored.

Three extracted standard-library controls pass, and three deliberate mutations
are detected: mislabelling failure as completion, adding failure after success,
and removing the log ceiling. These controls do not compile or qualify the full
native app. At candidate publication, affected native compilation, exact-head
hosted gates and fresh installed cold-start, Stop/reset/close/recovery and
owned-guest observations remained required; the qualified follow-up is above. Earlier generic cold-start failures are preserved and their
cause remains unknown. No timeout increase or firmware/Runtime/model adoption
is proposed by this observation work.

## Code Stop startup feedback candidate — 2026-10-13

The source candidate adds a cold-start notification through the existing arena
and Code feedback callbacks. Code Stop becomes available while startup is
pending, with the pane's localized starting message; it does not report a
firmware RUNNING observation. Notification follows input validation, observer
binding and invocation of the new session's startup. Retained uploads keep their
existing path, and late starting notifications cannot overwrite observed running,
READY, completion, cancellation or failure feedback.

All 14 focused feedback controls pass under Node 22. Four mutations fail the
controls: allowing late startup to overwrite terminal feedback, removing the
notification, notifying before session startup, and notifying on retained upload.
At candidate publication, hosted checks and a fresh source-bound installed
Code Stop cancellation, cleanup/restoration and subsequent-run check remained
required. The older bb293
Arena Stop observations below do not qualify this new source or close G02.

### Qualified startup Stop follow-up

[PR860](https://github.com/CrispStrobe/brickwright/pull/860) merged the
focused fix at `5e69e8ac85c006a0d5724e3be17bc3d03729f88b`. Tested consumer
[`da373394`](https://github.com/CrispStrobe/brickwright/commit/da37339468a1080d22812b8747eb9659ac85d6c5)
passed all seven enabled hosted checks, including
[Build38359601487](https://github.com/CrispStrobe/brickwright/actions/runs/38359601487).
Its emitted CI checkout has exactly the same tracked tree. Offline native
compilation passed, and independent installer verification matched all 180 files
and 23 directories and their bytes/modes to staging, and checked root ownership. Retained
Runtime, firmware and support payloads remained unchanged.

The actual installed Code Stop check passed before the first firmware frame:
the control is visible and enabled with localized starting feedback, the owned
native emulator exists, and actual cancellation uploads no program packet.
Deferred cleanup releases configuration/clock ownership, exits the owned
emulator, restores defaults and preserves stopped feedback without sampled late
world motion. A fresh run completes in a different session; the old closed
session remains without a frame. These results are bound to the tested consumer,
not every later main package or instantaneous process abort.

Original assembly/cache failures and the first installed Forth guard failure
remain preserved. The revised asset guard matches this consumer's committed
provenance, exact size/hash and emitted inventory; assertions and time limits
were retained. Raw results stay private. The normal source merge tree matched
the reviewed tree and preserved independently merged vendor changes. G02's
chooser/final-sampling/generation/late-poll cases and G05 closure remain open.

## Stale firmware cleanup follow-up — 2026-10-13

[PR879](https://github.com/CrispStrobe/brickwright/pull/879) merged finite
native Start and chooser intent guards. Its separately reviewed installed
consumer [`f1772cf0`](https://github.com/CrispStrobe/brickwright/commit/f1772cf0fe96988f7a4a3c665a478ef8fac4b065)
qualified seven UI cases and own-NuttX Code Stop during startup. These observations
do not qualify every later main package or close G02.

A later actual installed run on that consumer completed an owned NuttX program
and reproduced another lifecycle gap. After the old pane's firmware session
closed, delaying only the real Stop return allowed a new pane to start the
shared VM. The disposed pane's resumed cleanup then called `stopAll` on that VM.
Original VM calls were observed and invoked; no guest implementation was substituted.

The source candidate fences shared cleanup after firmware teardown using pane
disposal, Stop revision and bridge identity. Stale teardown errors are suppressed;
current Stop and current errors retain their behavior. All 14 actual-method
controls pass, and five deliberate guard/error mutations fail. At candidate
publication, hosted checks and fresh installed teardown/replacement and positive
Stop qualification remained pending; the qualified follow-up is above. Earlier cold-start failures are preserved and unexplained;
startup succeeding on the new diagnostic does not resolve their cause.
Firmware, Runtime, model pins and startup deadlines remain unchanged.

## Installed dual-ultrasonic checkpoint — 2026-10-12

[PR755](https://github.com/CrispStrobe/brickwright/pull/755) is merged at
`a2517162000246e40c1d1a10e510ae685cfb48ab`. The installed package was built
from reviewed consumer `bb293fad02d3448c5ea2d187b07ebedc82283fa6`;
[its exact-head CI](https://github.com/CrispStrobe/brickwright/actions/runs/38291405858)
and the separate native/vendor checks passed all nine enabled checks. Four
conditional profile/publication jobs skipped. The authenticated frontend's actual
CI checkout, `c7064a182363568db4cde6e8ccc2f5bfd6bc4819`, differs from the
consumer only in `LANES.md`.

The reviewed merge tree matched the actual merge, and all 25 affected SPIKE
source, test and handoff paths matched the installed consumer. Unrelated main
Forth/DOS compiler and importer changes were preserved. The whole merge tree
and every later main package are therefore not installed-qualified by these
receipts. The subsequent privacy merge changes only the task ledger.

The own NuttX dual-ultrasonic profile has A/B motors, C color, D detached and
E/F ultrasonic inputs. Fresh package assembly and installation passed; independent
checks authenticated all 180 payload files and 23 directories, including bytes,
Unix modes and ownership. Fresh installed Code native and embedded-Python routes
passed addressed E/F feedback, shared-arena motion, completion and default
restoration. Active Stop/restart/Stop and two unsupported caller-profile refusals
also passed. The installed frontend served the exact publisher zForth notice and
matching executable/provenance; that observation does not close other component
licensing obligations.

Both native and Python saved programs now pass actual installed-app quit and
relaunch using the same owned profile. Load remains READY without arena movement
while guest telemetry advances; explicit Run executes the saved original and
preserves replacement editor text. Native execution reaches original instruction
PC7 rather than replacement PC1. Saved Python prints actual E/F readings of
61 and 1410 mm. A deliberate Python `OSError(74)` repeats on retained retry
without uploading the editor replacement; explicit Code upload then recovers
to COMPLETE in the same session. Original failed preparations and exact
controls/results are preserved privately.

Fresh installed lifecycle checks also pass on the same bb293 package:

| GUI action during active guest motor commands | Observed result |
| --- | --- |
| Close the arena, then reopen it | Old pane/session closes, configuration and clock ownership release, its emulator exits, defaults restore, and a new pane completes a fresh guest |
| Change execution backend | Same pane survives; old session closes and its emulator exits, defaults restore, and a replacement guest completes; the old closed frame remains unchanged across that run |
| Switch 2D → 3D → 2D → 3D → 2D | Same pane, world, hub, bridge and firmware session remain; both 3D visits use a visible WebGL canvas and guest telemetry advances with motor demand; actual Stop reaches a fresh zero-demand frame and a subsequent upload completes |

The first new view-switch run passed the view identities but failed an immediate
Stop observation: program status was STOPPED while its sampled motor demand was
still active. The next captured frame had zero demand. The consumed [Runtime observer](https://github.com/CrispStrobe/renode-spike-prime/blob/413380963e54b64f94f18d26466e1c6e941be8d2/scripts/spike-state-server.py#L289)
reads motor `Power`, and the [electrical model](https://github.com/CrispStrobe/renode-infrastructure-spike-prime/blob/1253d925accca23dfda66d5bca61e78498dcb64f/src/Emulator/Peripherals/Peripherals/UART/LegoLpf2ElectricalPort.cs#L41)
samples bridge drive on its periodic tick; acknowledgement alone is therefore
insufficient for this observation. The revised private controller waits, within the unchanged
30-second host bound, for a fresh STOPPED frame with both motor demands zero.
The existing zero-demand, identity, telemetry and restoration assertions remain.
Six observation controls pass; mutations accepting acknowledgement alone,
ignoring demand or accepting stale frames fail. The original guest failure and
the later full successful run remain separately preserved. No simulator, model,
firmware, timing limit or package bytes changed for this controller correction.
This records observed demand removal, not an instantaneous stop or safety bound.

A separate fresh bb293 installed startup check now passes cancellation through
**Arena Stop** while the owned native emulator exists and the session is still
starting, before any firmware frame. The admitted native audit contains session
start and close, with no program-packet upload. Startup unwinds, configuration
and clock ownership release, the emulator exits, default sensors return, and
stopped Code feedback remains visible without later world motion in the sampled
interval. A fresh Code run then completes in a different session; the old closed
session never acquires a frame. This is deferred cleanup, not instantaneous
native process abort or an arbitrary race guarantee.

The same run observes a usability gap: **Code Stop** is hidden during pending
startup even though **Arena Stop** is available. The focused lane in `LANES.md`
will add an explicit starting feedback callback through the arena pane, then
require fresh installed qualification of the actual Code Stop action. No source
fix or completion of that new lane is claimed by this documentation.

These are finite installed Linux simulator observations. Earlier A383
storage, ABI, ACL and lifecycle receipts retain their own source/package binding.
The fresh results do not establish OS reboot, physical power loss, arbitrary
concurrent actions, general rendering correctness or release/licensing clearance.
G02 still needs its remaining chooser/startup/final-sampling, generation and
late-poll adversaries; G03 responsive controls and G05 distribution closure remain
separate lanes. The source merge's
[main Build](https://github.com/CrispStrobe/brickwright/actions/runs/38305155209)
passed its build, corpus, light/heavy browser, FPGA, deployment and published-GUI
verification checks. The separate native and vendor main checks also passed.
These results remain bound to that source merge rather than every later main.

## What works

The same virtual hub and arena serve browser execution and desktop firmware
execution. The execution selector chooses the program owner; 2D and 3D are views
of the same world, not separate simulation backends. Open **SPIKE arena** from
the Code view, use sandbox mode for free exploration, and select a supported
execution route. Native firmware routes need a configured desktop package;
they are unavailable in the ordinary web build.

| Route | Program execution | Established scope | Remaining boundary |
|---|---|---|---|
| Browser simulator | Independent JavaScript backend runs Scratch/native commands and the supported converted LEGO Python subset | Shared motors, sensors, deterministic clock and arena; works without a firmware runtime | Not arbitrary Python or a physical hub model |
| Small ARM simulation guest | Supported blocks/native program is compiled to the guest's bounded instruction format and executed by ARM code in Renode | Guest-driven motors, arena observations, completion and Stop | A small interpreter fixture, not the full operating system or arbitrary C loader |
| Full NuttX firmware | Source-built kernel/userspace executes the native program runner or embedded MicroPython with the `brickwright` API | Upload, run, output, Stop, retained program and explicit storage workflows | Bounded APIs/limits; no general desktop Python, automatic webserver or qualified physical transport |
| Upstream MicroPython application | User chooses an application image; Code-tab Python runs through raw REPL in the emulated CPU with `bwspike`/`bwhub` support | Default sensors, six-motor topology, feedback motor commands, hub I/O and shared arena | Different API from LEGO modules and NuttX; synchronous feedback commands, no active position hold |
| Unchanged stock LEGO image | Separately supplied image admitted for bounded emulator/reference experiments | Image validation and recorded execution milestones | Complete boot, Code-tab program upload and modern IMU wire mapping remain unqualified; not a working interchangeable editor backend |

No external firmware image is bundled or downloaded by the image chooser. C is
used to build the source firmware and fixtures; the Code-tab native instruction
runner does not imply arbitrary uploaded C executables. NuttX's embedded Python
and the separate upstream MicroPython application are distinct routes.

Firmware sessions own motor evolution. Native observations update the hub/world
and arena inputs return to modeled devices; JavaScript must not advance a second
motor controller over the same session. See [arena](SPIKE-ARENA.md),
[firmware programs](SPIKE-FIRMWARE-PROGRAMS.md),
[MicroPython GUI](spike-micropython-gui.md) and
[Linux package](SPIKE-LINUX-DESKTOP.md).

## Evidence and version boundaries

[PR #631](https://github.com/CrispStrobe/brickwright/pull/631) merged as
`9c999cdd6274278e5e54f1c135d35af11fb5feac`. Code-tab feedback now follows
actual firmware completion, faults and cancellation; Stop is installed during
startup and terminal results survive cleanup. Its 73 focused tests passed;
[merged-main qualification](https://github.com/CrispStrobe/brickwright/actions/runs/37249838252)
reported 5,512 passing tests, 15 documented skips and no failures. A terminal-state
mutation was detected. These counts describe that qualification, not every later head.

An installed Linux desktop run exercised actual Code-tab entry and arena controls:
small-guest blocks/native execution, full NuttX Python driving A–F followed by
Arena Stop, and upstream MicroPython 1.29.0 through the native image chooser,
with motor/world motion, display/output and completion. Small-guest and
MicroPython completion release ownership; full NuttX retains its program/storage
session until explicit close or backend switch. Program completion does not
promise electrical braking unless the program or route contract requests it.
This is installed-GUI evidence, not signed-release or physical-hardware evidence.

Newer [firmware PR #34](https://github.com/CrispStrobe/brickwright-spike-prime-fw/pull/34)
qualified retained restart, virtual Bluetooth peers and LittleFS interruption
fixtures. Its [current handover](https://github.com/CrispStrobe/brickwright-spike-prime-fw/blob/main/docs/project/next-steps.md)
is authoritative for firmware L01–L13. Those newer capabilities are not implicitly
present in the already tested desktop package. Firmware consumes specific Runtime
and Infrastructure revisions; Runtime main's newer MicroPython SDK likewise does
not automatically advance every consumer. Record each route's actual pins.

## 2026-10-07 desktop adoption candidate

[PR #695](https://github.com/CrispStrobe/brickwright/pull/695) merged as
`0faacb84211a5d6df8b4d3ed8ed9127c14b76fc5`, adding retained NuttX program
restart to the arena. All seven enabled
[reviewed-head checks](https://github.com/CrispStrobe/brickwright/actions/runs/37579912369)
passed; the two main-only deployment jobs were not enabled on the PR. The merge
tree matched the reviewed plan, preserving the tested production source and
unrelated task/claim documentation. Tested package source is
`2b36862fb39f34a990eb296c734e9e800ed884c8`; its production frontend was built at
`0af782bdfe15774416690d09c724b19b4019c23c`, with no production overlay/Tauri
source changes between those heads. This is a private qualification candidate,
not a newly distributed installer or an automatic update to every desktop.

The own NuttX build used firmware source
`4e326e7a62624acc865002b256230042d1f50d63`, full-NuttX Runtime inputs
`756b684eee56ba698a931a14b3f4885cb8d8ada6` and Infrastructure inputs
`fe4ad383c7392527433783fcec455daa7ddc2bb7`. The native Renode executable was
retained from the earlier verified desktop input; matching newer helper/model
source does not establish its source-to-binary provenance. G05 remains open.
Compiler/config/linker/notice/TI-exclusion gates passed. Measured userspace flash
was 592,780 bytes and static RAM 88,144 bytes for this build.

Actual extracted-candidate GUI checks passed Code-tab Python execution on all
six motors, Arena Stop, retained restart and repeated Stop with matching Code
feedback. Save/Load reached READY without automatically running, and explicit
Run completed with output. A fresh app process recovered the saved Python
program, ran it explicitly and moved the motor. From a fresh editor profile,
Code-tab pseudocode compiled into Scratch blocks, ran in full NuttX, moved the
shared motor/arena and completed. GUI fault/restart checks retained the failed
status and traceback while clearing Code Stop. Stop during pending native
startup closed the owned session, retained terminal feedback and published no
late motor motion after cleanup. Cleanup can wait for native startup to unwind;
this is not an instantaneous native process abort. The separate small ARM guest GUI route also
passed Start, motion and Stop. Native-driver guest checks additionally passed
native/Python retained restart, repeated runtime fault, SAVE and fresh-process
native-program recovery. The JavaScript regression set passed 81 tests; the
native driver's Rust suite passed 129, with 10 ignored. Restart availability,
cancellation and pane-ownership mutations were detected. Raw receipts remain
private.

The desktop supervisor still bounds a session to 120 wall-clock seconds. A
long combined scenario reached that bound; shorter separate sessions passed.
The first comprehensive six-motor guest fixture reached its 300-second external
wall bound. A later run passed with a 900-second external bound: per-port native
speed and relative position, concurrent six-port motion, cancellation and Python.
For the six -30-degree position moves, observed final deltas ranged from
-28.90 to -28.17 degrees, within the declared 3-degree fixture tolerance. Both
the failed attempt and the later pass remain preserved. This does not establish
every motor/control case or physical SPIKE behavior. Firmware/reference and
release licence boundaries from the preceding handover remain in force.

A separate UI limitation was observed: starting from a saved Python view,
requesting Pseudocode with an empty conversion buffer can leave the editor in
Python mode with an error. G03 should reproduce that transition and provide an
explicit usable path into an empty Pseudocode editor; the fresh-profile native
execution result does not qualify that transition. Keep changes in
`overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx` with its
current owner until the overlapping claim is released.

## How a fresh agent starts

1. Refresh the owning public repository; read its current claims and the linked
   contracts. Claim only the paths needed by one lane, preserving other work.
2. State the observable contract, required inputs, units, timing, cancellation,
   ownership and unsupported errors before changing behavior. Use synthetic
   fixtures for public tests and declare their limits.
3. Add a regression that fails the old behavior; use a meaningful mutation where
   practical. Test the actual guest/GUI when that is the capability being claimed.
4. Land model/runtime work in its owning fork before advancing exact consumer
   pins. Preserve notices and the overlay/package mirror in this repository.
5. Record tested source, route/dependency pins, public CI, acceptance results and
   remaining exclusions. Never relabel host-only evidence as guest or hardware proof.

These are proposed tasks, not ownership claims. Existing non-SPIKE actuator work
in `LANES.md` and [the broader queue](OPEN-TASKS-2026-09-29.md) retains its ownership.

## Next-step lanes

### G01 — Adopt the newer qualified firmware in the desktop package

**Owner:** Brickwright Lite, after firmware L11. **Start:**
`scripts/prepare-spike-nuttx-package.mjs`, `scripts/build-spike-linux-desktop.mjs`,
`test/spike-linux-package.test.mjs`, `test/spike-nuttx-storage-exchange.test.mjs`.
Read the firmware handover and actual current manifests first.

Build/stage the reviewed source profiles using existing tools; record immutable
Runtime/model/firmware inputs and retain their notices. Rebuild the configured
package without external images. Exercise the actual Code tab for native and
embedded Python: upload, complete, restart without upload, Stop, fault, save,
close/reopen/load and retry. Define expected persistence and terminal feedback.
**Done:** real guest and installed GUI observations establish every advertised
operation; invalid manifests and stale sessions fail closed; package receipts
match the tested artifacts. New firmware guest qualification is required before
claiming adoption. Doable now with the documented build prerequisites.

### G02 — Preserve lifecycle correctness under concurrent GUI actions

A new source candidate on `lane/spike-g02-dual-preflight-stop-20261019` fences
Stop during preflight frame observation and the awaiting continuation. Previously,
a dual-ultrasonic observer could Stop and still allow SAVE, LOAD or START; upload
could send an additional STOP, and dual/six-motor preflight could publish a frame
after closure. Checks after frame acceptance and after the awaited validation
prevent those effects. Fifteen controls use the real session, bridge and program
client with authored native frames: ten baseline failures, five live controls,
74 passing session tests and five detected guard mutations. This source is not
installed-qualified; require the final tested package, affected own-guest cases,
normal recovery and every enabled final-head check before merging it.

The separately retained installed two-UI-Stop case passed on source
`f7b3bf03b1468a81e26228d052c4164d7081dc73`. It does not qualify this newer source.
The native-interface late-UART diagnostic failed during debugger attachment
before submitting the test program, so generation/late-return acceptance remains
open. Preserve that failure and the held process collector's original assertions;
new source controls and older successful packages do not close the full G02 matrix.

**Owner:** Lite. **Start:** `overlay/scratch-gui/src/lib/spike-arena/code-run-feedback.js`,
`renode-arena-session.js` in that directory,
`overlay/scratch-gui/src/components/tw-pseudocode/`,
`test/spike-code-run-feedback.test.mjs`, `test/spike-micropython-code-tab.test.mjs`.

Add actual GUI cases for Stop during chooser/startup/final sampling, backend
switch, pane disposal, reopen/reupload, UART generation change and late polls.
Use a delayed/error-capable synthetic native boundary for races, then verify
representative races with an actual owned guest. Preserve all #631 regressions.
**Done:** one terminal result, no late world publication, no stale owner stopping
its replacement and no leaked owned process. Mutating a terminal/ownership guard
must fail the comparison. Doable now; no externally supplied firmware needed for
small-guest/NuttX cases.

The source candidate on `lane/spike-g02-lifecycle-20261013` invalidates a
pending native Start when Stop or Reset runs, and checks pane disposal, bridge
identity and backend intent after asynchronous teardown and connection. It also
keeps late connection errors from replacing newer feedback. Focused controls in
`test/spike-arena-pane-lifecycle.test.mjs` retain normal Start and Start after
Reset; removing cancellation or ownership guards must fail these comparisons.
The installed baseline reproduced late native starts after backend selection,
Reset and pane unmount using an explicitly delayed real connection return.
Those observations qualify the baseline defect, not this source candidate.
The candidate also invalidates pending image choices on Stop, backend changes
and newer chooser requests. Stale selections and errors return cancellation;
current selection, cancellation and errors retain their existing behavior.
Focused actual-method controls include backend round trips and disposal.
At candidate publication, exact-head CI and a fresh installed candidate package
remained required. The qualified follow-up above records the frozen consumers
and finite cases now completed. Selected-image/error, deferred-storage,
final-sampling, generation and late-poll closure across backends remains open.

A replacement-upload continuation on
`lane/spike-g02-upload-cancellation-20261015` now checks closure after awaiting
the previous program's STOP, before replacing current code or enqueueing BEGIN.
It also checks closure after the upload reply, before retained-program state
and observers are published. The latter cancellation cannot roll back a program
that has already executed.
A real-session/production-codec control with an authored delayed native response
shows the baseline accepting a replacement after session Stop; the live control
passes. A completed-upload return control separately reproduces late publication
after closure. All 59 session controls pass with both checks; each removal must
fail its corresponding cancellation control. Fresh installed own-NuttX cancellation/recovery and
all enabled exact-head CI checks remain pending; this finite host result does
not close G02 or qualify guest execution. Existing transport ordering and
firmware/Runtime/model/native pins and deadlines remain unchanged.

The replacement-upload follow-up now passes four installed own-NuttX cases on
consumer `516557dae2f3b29710318a0e9ee647715728376f`: held original STOP or
completed-upload return, each with live delivery and actual Reset cancellation.
Every case releases session/configuration/clock ownership, completes a distinct
fresh guest and releases it. Standalone readers validate eight complete native
startup transactions, original correlated packets and guest identity. Original
selector/state-interval test failures are preserved. Initial retained state and
held-return retained state are distinct observations. These finite results cover
full session Stop through Reset; pending-upload Arena Stop and Code-feedback UX
remain open. Integration preserves the qualified session/test blobs and requires
fresh final-head CI. Later whole packages need their own qualification.

A stacked world-action continuation on
`lane/spike-g02-world-action-ownership-20261015` extends the existing G02 pane
ownership checks to delayed lesson/world selection, sandbox persistence and
manual driving. Old teardown or load returns cannot replace a newer world or
feedback; old render callbacks cannot report readiness. Stop during a manual
motor notification prevents further motor commands and running feedback.
All 32 new authored-boundary controls and 44 inherited pane controls pass; the
baseline fails 18 new cases, and eight ownership/callback mutations are detected.
Fresh source-bound installed representative cancellation/recovery and final-head
CI remain pending. This changes lifecycle admission, not sandbox features or
model behavior, and does not close G02.

A pending-upload Stop continuation on
`lane/spike-g02-upload-stop-control-20261015` keeps Arena Stop visible while a
replacement upload is pending and routes that action through full session Stop.
Ordinary retained program Stop keeps its storage session; current cancellation
errors remain visible and old delivery errors cannot overwrite a replacement.
All 14 new predicate/actual-method controls and 14 existing lifecycle controls
pass, with five detected mutations. Installed visible-control cancellation and
recovery plus final-head CI remain pending. Code-feedback generation remains open.

### G03 — Qualify usable sandbox and responsive editor controls

The scoped ownership claim is recorded in
[the lane ledger](../lanes/2026-10-15-spike-g03-sandbox-and-editor-ui-qualification.md)
on `docs/spike-g03-ui-claim-20261015`. Implementation follows PR948, PR962 and
G02's remaining acceptance review. The first pass records working rendered
features and fixes only demonstrated gaps; shared project-world and unrelated
importer owners keep their own files and behavior.

**Owner:** Lite. **Start:** `docs/SPIKE-ARENA.md`,
`overlay/scratch-gui/src/components/tw-pseudocode/`,
`test/spike-arena-3d-pane.test.mjs`, `test/spike-arena-pane-units.test.mjs`.

Inspect existing controls before adding UI. Test free sandbox access, shared
2D/3D state, topology selection, reset/edit/save/reopen, and firmware ownership
across view switches. Cover narrow desktop/mobile widths, long conversion/error
messages, dismissible reports, collapsed/moved lessons and a right pane taking
50–75% of the available width. Check keyboard/touch controls and translations.
Include explicit image/backdrop selection, familiar undo icons, compact run
controls and clearly labeled import actions in the overflow menu.
Document what Identify A–F actually observes; unresolved identification must
show a bounded error rather than an indefinite ellipsis.
**Done:** real rendered UI remains resizable and usable; mode switches preserve
one world and cannot start an unavailable backend. Doable now; this lane first
records already working features and fixes only demonstrated gaps.

**Status (2026-10-25):** the finite G03 work is merged. The rendered-UI
pass checked EN/DE labels, touch, long conversion reports, a 50–75 % right pane,
mat save/reopen and bounded Identify; PR1354 repaired touch dragging with the
Move tool. PR1358 then closed the saved-Python/empty-Pseudocode case: after a
failed conversion, the error line offers an empty destination-language editor
when idle, preserving the source buffer. Successful conversion is unchanged.
Its three focused controls include two that reject the original source. This
records the scoped UI work; it does not imply physical or firmware accuracy.

### G04 — Extend API/topology parity through declared capabilities

**Owners:** firmware L01/L02/L05/L06/L09, Runtime, then Lite. **Start:**
[Runtime tasks](https://github.com/CrispStrobe/renode-spike-prime/blob/0bb3f3e40ec8e84afe6c7a63a03374a5a0553969/docs/SPIKE-STATUS-AND-LANES.md),
`test/independent-spike-backend.test.mjs`, `test/spike-renode-arena-session.test.mjs`.

Choose one supported command slice; compare identical external scenarios across
browser, small guest, NuttX and upstream MicroPython only where each advertises
it. Specify units, tolerances, simulated time, end actions and errors. Cover
sequence/concurrency, boundary values, detach/load/no-progress and cancellation.
Avoid claiming a timeout is measured stall or a completed move is active HOLD.
**Done:** a published route-specific capability table and comparisons reject a
broken observable behavior; shared hub/arena state remains single-owned. Contract
work is doable now; guest motor/hotplug extensions depend on firmware lanes.

### G05 — Finish portable packaging and dependency/licence closure

**Owner:** Lite packaging, coordinated with firmware L11 and Runtime. **Start:**
`scripts/build-spike-linux-desktop.mjs`, `test/spike-linux-package.test.mjs`,
`docs/spike-micropython-installed-resources.md`, `docs/SPIKE-LINUX-DESKTOP.md`.

Inventory exact distributed runtime/native libraries and source-built components;
verify selected versions, licences, notices and applicable MPL/LGPL obligations.
Resolve open source-to-binary provenance without rewriting artifact bytes.
Test relocation, missing/tampered files, constrained resource admission and owned
child cleanup. Add non-Unix staging as a separate reviewed contract rather than
advertising it from Linux results. Signed installers/update channels need their
own packaging and platform acceptance evidence.
**Done:** an exact distributable closure, reproducible assembly instructions and
platform-specific installed tests. Linux inventory work is doable now; other
platform/signing tests require their build environment and credentials.

**Linux status (2026-10-25):** the linked crate inventory is bound to
`Cargo.lock`; all 13 supplemental crate texts have reviewed origins and digests.
The shipped runtime's corresponding-source joins are recorded for
`renode-spike-prime@41338096`, `renode-infrastructure-spike-prime@1253d925`,
`tlib@d50c868f`, NetMQ 4.0.1.12 and PacketDotNet 1.0.0. Gtk# and mcs are not
shipped. The real Linux package exercise from `f51ec8c2` passed all 36 installed
layout checks. PR1360 also made the crate-notice check reject empty directories
left by a package-manager documentation exclusion.

The hosted packaging workflow landed in PR1368. Its current-main v0.1.27
exercise passed compilation, packaging and all 36 layout checks. An independent
review of a successful official exercise with byte-identical executable inputs
also accepted 651 reported crate-notice files and all 36 checks. Runtime,
support and frontend inputs are explicitly labelled placeholders, so this proves
the packaging pipeline and layout. Application startup and guest execution need
their own evidence. No Linux package is uploaded. See
[SPIKE-LINUX-DESKTOP.md](SPIKE-LINUX-DESKTOP.md#hosted-packaging-exercise).

**Separate contracts, not met by Linux evidence:**
- *Non-Unix staging (Windows, macOS):* needs its own builder path and runner (Windows
  x64; macOS arm64/x64). Evidence required: that target's linked crate inventory
  (`--filter-platform` for the target triple), a Renode distribution for that
  platform with its native-library and notice closure, resource-path checks for the
  platform's Tauri resource directory, its own refusal tests, and an installed-app
  layout check run on that OS.
- *Signed installers and update channels:* signing material lives in repository
  secrets, never in this repository. **macOS (exists, general app):** `.github/workflows/release.yml`
  signs on `macos-latest` with a Mac App Store identity and builds a `productbuild` `.pkg`
  (no notarization). Release run 39680422030 (tag v0.1.26) logs `Brickwright.app: valid on
  disk`, `satisfies its Designated Requirement`, and `productbuild: Wrote product ...
  Brickwright.pkg`. That delivery does **not** stage the SPIKE Renode runtime, which is
  Linux-only today. **Windows:** blocked. No Authenticode certificate exists. **Debian:**
  no repository signing key or update channel. Evidence still required for any SPIKE
  installer: signature verification of the exact artifact digest, notarization receipts
  where they apply, update-manifest signature checks, and installed tests of the signed
  artifact. Signing must not change the recorded resource bytes.
- *SPIKE runtime on macOS (packaged in the release workflow's macOS leg; not released):*
  [SPIKE-MACOS.md](SPIKE-MACOS.md). The multi-file Renode, with tlib as a separate signed
  file (Infrastructure #39, Runtime #62), is staged under `Contents/Resources/renode` and
  signed with the Mac App Store identity: child `app-sandbox` + `inherit` + `allow-jit`,
  app `network.server`/`client`. The supervisor passes the container `TMPDIR`, the shipped
  tlib directory and a loopback bind. Signed dry run 40507444319: the installed `.pkg`'s
  own child booted the own NuttX guest with the real Team ID. Open: guest speed on
  `macos-latest` (first emulated second ~9 min, independent of signing), launching the
  real app (needs TestFlight), App Review, and the Linux Packet.Net/pip removal.
- *Firmware L11 / Runtime inputs Lite depends on:* the NuttX/guest staged profile
  manifest and file list in `scripts/lib/spike-resource-profile.mjs` (including the
  licence files it requires), `state-config.json` `identity.firmware` and
  `identity.imageSha256`, the 8192-byte `initial-flash.bin` geometry, and the
  MicroPython support `manifest.json` digests. Those owners must provide source pins,
  complete notice sets for every staged binary, and corresponding-source pointers for
  Apache/BSD/MIT firmware parts. The LGPL `tlib` source pointer is recorded
  (`antmicro/tlib@d50c868f` via `renode-infrastructure-spike-prime@1253d925`).

### G06 — Improve model fidelity and unchanged-image bringup

**Owners:** Infrastructure and Runtime; firmware L07/L08/L11. **Start:**
[model tasks](https://github.com/CrispStrobe/renode-infrastructure-spike-prime/blob/5a519ce5d9b5122bcf2ecedcbfd6f49d2735bbeb/docs/SPIKE-STATUS-AND-LANES.md).

Implement one evidenced public peripheral contract at a time, then adopt exact
pins and rerun affected guest workflows. Keep unknown modern IMU mapping false.
Prepare source-only fixtures now; unchanged-image experiments require lawful
operator-supplied inputs and remain separate from Code-tab compatibility.
**Done:** model regression plus bounded real guest milestones, not elapsed time
alone. Complete original-firmware boot and upload are explicitly pending.

### G07 — Define program delivery over supported transports

**Owners:** firmware transport/runner, Runtime virtual peers, Lite client UI.
**Start:** firmware `docs/hubprogram.md`, `docs/project/classic-protocol.md`,
`docs/project/ble-protocol.md`; Runtime `docs/spike-program-uart.md`; Lite
`SPIKE-NUTTX.md` and `docs/SPIKE-FIRMWARE-PROGRAMS.md`.

Inventory actual upload/run/output/Stop/status/storage endpoints before promising
another listener. Define a bounded common program-delivery contract, protocol
version, authentication/admission, chunk limits and failure/ownership rules.
Qualify a virtual Bluetooth peer against real guest handling where supported.
Specify a web-facing service as an external bridge unless an actual guest network
interface and server are established; the editor's local Renode state service
is not an on-hub webserver. Native program upload does not imply an arbitrary C
executable loader; decide that ABI separately if required.
**Done:** public capability tables name each implemented transport, actual guest
upload/run/Stop/fault/reconnect tests pass, and unsupported modes refuse clearly.
Contract and virtual transport work is doable now; physical USB/BLE and remote
service deployment need separate hardware/security/platform qualification.

## Reproducible starting checks

From the Lite repository root, Node 22, with repository-prescribed dependencies:

```sh
node --test test/overlay-packages-pairs.test.mjs test/spike-code-run-feedback.test.mjs test/spike-micropython-code-tab.test.mjs test/spike-renode-arena-session.test.mjs test/spike-nuttx-storage-exchange.test.mjs test/spike-arena-pane-units.test.mjs test/spike-arena-3d-pane.test.mjs
node --test test/independent-spike-backend.test.mjs test/independent-spike-controller.test.mjs test/spike-arena-sim.test.mjs
```

These are focused starting checks; they do not replace actual guest/installed GUI
qualification. Follow the linked route guides for source assembly and image
selection. Firmware source changes need its affected clean-build/guest matrix;
documentation-only work needs documentation/source-policy checks. LabWired has
no qualified SPIKE peripheral/firmware integration and is not a substitute for
these Renode gates. Physical USB/BLE, radio security, electrical calibration and
hardware release remain outside the demonstrated simulation scope.


## Addressed-reader package discovery candidate — 2026-10-09

Package preparation now recognizes the optional
`g_bw_program_addressed_sensor_abi` version1 constant in the own userspace ELF.
It validates a global four-byte OBJECT in an allocated nonwritable section,
exact section/load file mapping, flash bounds and absence of virtual or physical
load aliases. NuttX merged-text/RWE layouts remain accepted through section
metadata. Unsupported or malformed present markers fail packaging; absent
markers retain legacy package behavior.

The optional `addressedSensorCapability` configuration object contains `abi`,
`address` and `userspaceSha256`. Packaging writes the captured kernel/userspace
buffers used for vector/feature discovery, preventing a changed source file
from replacing the qualified bytes during a later copy. Existing configuration,
manifest and pin hashes bind the staged metadata and image. This is package
metadata preparation; the current state adapter does not advertise a live
addressed capability from it.

Eight focused new/legacy tests pass, including three source mutations that must
fail their intended version, section-write and physical-alias assertions. The
first mutation runner inherited Node's child-test context and falsely returned
zero; the corrected isolated runner removes that context and requires a named
assertion failure. Hosted consumer qualification remains required.

Firmware [PR52](https://github.com/CrispStrobe/brickwright-spike-prime-fw/pull/52)
source `6648a21548dcc3c40e000cd13374d113f7d85d3c` passed
[CI37916873278](https://github.com/CrispStrobe/brickwright-spike-prime-fw/actions/runs/37916873278);
its [clean ARM matrix37916873239](https://github.com/CrispStrobe/brickwright-spike-prime-fw/actions/runs/37916873239)
is still pending at this checkpoint. No firmware, Runtime or Infrastructure
package pin is adopted by this slice. Next require exact image-bound live
marker detection, a declared E/F ultrasonic topology through the state adapter
and shared arena, gated native/Python callers, and actual installed Code/Blocks
qualification. Default D-distance/E-force and six-motor configurations retain
their existing contracts; package metadata alone does not qualify those next
steps or arbitrary A–F addressed reads.


## Dual ultrasonic sandbox integration candidate (2026-10-09)

The own-firmware live addressed API is now merged in
[Runtime PR56](https://github.com/CrispStrobe/renode-spike-prime/pull/56).
[Firmware PR53](https://github.com/CrispStrobe/brickwright-spike-prime-fw/pull/53)
qualified the actual Runtime snapshot on both protected firmware profiles in
[matrix37934995031](https://github.com/CrispStrobe/brickwright-spike-prime-fw/actions/runs/37934995031):
the bound live marker advertised the API, legacy configuration omitted it and
foreign metadata was refused. This is own-firmware simulation evidence.

This candidate adds **Ultrasonic E/F (NuttX sandbox)** to the arena's Firmware
devices chooser. Open the free sandbox and select Full NuttX (desktop), then
choose that profile. It keeps driving motors A/B and color sensor C, detaches
D and replaces E/F with distance sensors. The existing default layout keeps D
distance and E force. Six motors remains a separate profile. The E/F geometry
uses forward-facing probes at x=9 cm and y=-3/+3 cm; these are arena choices,
not physical sensor calibration.

Scratch literal distance comparisons/waits on E/F compile to addressed
selectors 0x121/0x122 and 0x129/0x12a. Supported mm/cm/in thresholds round to
integer millimeters in 0..65535. Color/reflection on C remains supported;
legacy D distance, E force and C..F motor commands are refused for this
profile. Programs retain the existing bounded sequential guest instruction
contract; this change does not add parallel scripts or arbitrary Python APIs.

The native launcher admits only a verified own full NuttX package with an
image-bound addressed marker declaration and bounded program mailbox. Before
upload, the arena session also requires the actual live addressed capability
and exactly A/B motors, C color, D detached and E/F distance. It checks this
contract on subsequent frames, replacement upload, retained restart and storage
operations. Native and Python-source upload share the same hub and arena;
closing the profile restores default devices. Unsupported packages fail closed.

Reproduce source controls with Node22:

```sh
node --test test/spike-dual-ultrasonic-topology.test.mjs test/spike-six-motor-topology.test.mjs test/spike-code-run-feedback.test.mjs test/spike-renode-arena-session.test.mjs test/spike-nuttx-upload-protocol.test.mjs test/spike-nuttx-storage-exchange.test.mjs
node --test test/spike-arena-pane-units.test.mjs test/spike-firmware-program.test.mjs
cargo test --manifest-path apps/tauri/src-tauri/Cargo.toml --lib
```

The rendered-pane/compiler suites require the repository's normal locked GUI
dependencies. Focused source controls cover selector bounds, units, wrong
firmware/type/attachment/capability, native and Python rejection before packets,
replacement/restart, cancellation, distinct world-derived E/F ranges and default
restoration. Three changed actual gate implementations are detected by the
negative admission assertions. Rust controls check preboot attachment order,
closed metadata, address bounds and image identity. These source controls are
not installed-package qualification.

**Pending acceptance:** exact-head hosted web/native checks, consumer package
adoption of the qualified firmware and Runtime, and actual installed GUI runs
of Scratch and Code-tab E/F programs through the real guest. No package pin is
changed in this candidate. Existing installed packages can lack the required
capability and will refuse this profile; browser-only simulation does not launch
NuttX. Do not claim shipped availability or complete equivalence from this
source integration.


### Prepared real-guest E/F browser modes

The existing managed arena proof now accepts `BW_SPIKE_PROOF_MODE=nuttx-dual-source`
and `nuttx-dual-python`. The first waits for the actual GUI reader to install
both intended E/F reporters and wait predicates, then requires their addressed
selectors, real guest completion, A/B encoder movement and shared arena motion.
The second waits for the intended idle Scratch program, then replaces it through
the actual Code editor with bounded embedded Python reads. E/F must return distinct
millimeters matching the unchanged authored arena geometry. The retained GUI
session object, native start count, image, connection generation and advancing
sequence/clock must establish replacement in the same live guest.

Run each mode separately with the compiled production Rust proof driver, emitted
GUI and a verified full NuttX package using the qualified addressed Runtime.
The existing private evidence destination requirement and owned process/time
bounds remain mandatory. Both modes verify default device restoration on close.
Missing capabilities fail the proof. These are **prepared scenarios, not actual
execution evidence**; the test host is also separate from installed Tauri WebView
and ACL qualification. No package or guest pins are adopted by these scripts.

### First hosted execution checkpoint (2026-10-09)

At source `24b12b154dc3d901e622c701cd9c957ad5e6e53f`, the source-built firmware
resource/TI/marker gates, Runtime build, package staging, production Rust proof
controls and GUI build passed. The rendered-pane, actual reader/compiler and
browser-proof control suites passed all 35 tests with no skips.

The first real-guest browser attempt failed during native session startup with
`Renode debugger unavailable`, before any live frame or E/F program execution.
The Python scenario did not run after that failure. Bounded private startup
diagnostics are the next step; the original failed evidence remains preserved
privately. This checkpoint does not qualify either E/F execution scenario,
installed Tauri behavior or a distributed package. The acceptance requirements
above remain open.

The subsequent private monitor diagnostic identified a package/runtime mismatch:
the package included dynamic model definitions already compiled into the
qualified source Runtime, so loading stopped on a duplicate `ILpf2Device` type.
The package producer now accepts an explicit `--compiled-models` option for a
source-built Runtime containing the matched Infrastructure models. It uses the
Runtime's compiled-platform staging interface, omits dynamic model loading and
retains the source bundle/notices in the verified support manifest for provenance.
The default source-loading profile is unchanged. Match the executable/build and
Infrastructure revisions explicitly; this option is not automatic discovery or
proof of their compatibility. Actual guest and installed acceptance remains open.

```sh
node --test test/spike-package-model-loading.test.mjs
node scripts/prepare-spike-nuttx-package.mjs FIRMWARE_REPO RENODE_REPO INFRASTRUCTURE_REPO RENODE_EXECUTABLE NEW_OUTPUT_DIRECTORY --compiled-models
```

The compiled-model package subsequently started successfully and published the
required live addressed capability with A/B motors, C color, E/F distance and D
detached. The first frame exposed a wire-format mismatch in the candidate:
detached native ports use `kind: null`, whereas the candidate validator expected
`"none"`. The validator and proof fixtures now require the canonical null kind
and `attached: false`; an attached D port or string `"none"` is still refused.
The GUI hub's internal `none` configuration remains a separate representation.
This startup observation does not yet qualify upload, motion or Python execution.

The prior public CI failure also showed a stale tracked VM capability mirror,
now synchronized, and a browser prerequisite skipped after the independent
SPIKE gate failed. Browser-backed unit tests still ran and reported a missing
Chromium executable. The existing pre-unit browser installer now has an explicit
independent-check condition and uses the installed Playwright package without
fetching a replacement package. Seven workflow checks pass locally; hosted
checks still need to establish the complete candidate result. Unit assertions
and downstream browser gates remain unchanged.


The next own-source guest run at Lite `bffdbf52e95659b2e40d3a934a0922c6900eacd7`
completed the Scratch E/F waits, stopped both drive motors and restored the
original sensor profile through the GUI. The observed A/B positions were
−2.380118°/+2.380118°; the rover moved 0.116315 cm. A separate read-only
standard-library artifact audit verified addressed selectors, image identity,
completion, stopped demands and shared telemetry. This is a bounded Scratch
browser/test-transport result, not installed desktop acceptance.

Python reached the live guest but raised `OSError: 74` at the exact expected-range
assertion. Its first fixture accepted any nonnegative sample rather than waiting
for the expected pair. The revised fixture waits within the existing 100×20 ms
bound, prints its actual readings and retains the same final equality assertion.
The test transport now maintains separate client leases and supports the actual
GUI client's 512-request bookkeeping renewal. Queued requests refuse an exited
driver, and failed results retain the exception. Three synthetic controls pass,
including real GUI capability clients across renewal; two source mutants are
detected. The corrected Python guest run and installed desktop acceptance remain
pending. The original failed receipts are preserved privately.

```sh
node --test test/spike-proof-transport.test.mjs
```


A subsequent API review found that this fixture used `b.wait(20)` although the
pinned firmware exports `b.sleep_ms(20)`. The fixture now uses that embedded API,
and its synthetic module exposes only `sleep_ms`, so the old call fails the
control. This changes test preparation only; it does not add a firmware API or
establish Python guest success. Preserve the earlier run's result.


The corrected own-source guest qualification passed at Lite
`b2bc7a5affa9f9861fc904616222347d120350f5`, using the firmware, Runtime and
Infrastructure pins above. Scratch completed both addressed waits, moved the
shared rover 0.116315 cm and stopped A/B at −2.380118°/+2.380118°. Code-tab Python
observed E=61 mm and F=1410 mm, matched those actual arena readings and completed
on the same live guest session with advancing sequence and time. A frozen,
read-only Python standard-library artifact auditor passed for both modes,
checking image identity, selectors, completion, shared motor telemetry and
session continuity. Exact original successes and earlier failures remain private.
This qualifies the finite browser/test-transport scenarios; installed Tauri,
portable Runtime distribution and selected-component notices remain open.

Public full CI then found two test-audit mismatches. The broker source audit now
requires the supported SixMotors/DualUltrasonic match arm and detects removal of
either profile. The synthetic Python fixture explicitly documents its required
host CPython interpreter; absence remains a failure, and that fixture does not
qualify the embedded interpreter. No audit baseline was raised. Seventeen focused
controls pass without skips; the repaired public head still requires every enabled
hosted check. Product and guest fixture source remain unchanged from the qualified
head above.

```sh
node --test test/tauri-broker-topology.test.mjs test/spike-proof-transport.test.mjs test/gate-shapes.test.mjs
```

### Desktop profile relocation follow-up

Installed qualification reached successful input staging and protected firmware
build/resource gates, then stopped before native desktop compilation. The
resource freezer accepted the source-model scenario only, while explicit
`--compiled-models` staging correctly omitted the model-source include. The
freezer now accepts both exact authored templates and preserves that distinction
when relocating resources. Compiled Runtime profiles retain `models.cs` as
provenance without loading its types again. Arbitrary monitor commands, damaged
digests, linked files and incomplete profiles remain refused.

Thirteen focused packaging controls pass, including compiled profiles with and
without the flash seed, repeated portable relocation and rejection of an added
model include. This is package preparation evidence. No new installed Code,
arena, cancellation or ACL result is established by these controls. Qualification
must use the corrected source and its exact frontend/native closure; earlier
guest observations do not qualify the refreshed consumer. Public binary
redistribution review remains open, and installers/raw records remain private.

```sh
node --test test/spike-resource-profile.test.mjs test/spike-linux-package.test.mjs test/spike-package-model-loading.test.mjs test/spike-initial-flash.test.mjs
```

## Caller profile preflight candidate — 2026-10-12

The native capability adapter rejects unknown string topologies and unsupported
custom-profile/backend pairings before reserving a broker request. Its two fixed
caller messages are `unknown SPIKE topology` and
`custom topology requires own NuttX firmware`. Default starts remain unchanged;
NuttX supports the declared custom profiles, and the existing MicroPython
six-motor pairing remains forwarded unchanged. Dual ultrasonic is still subject
to the separate [PR755](https://github.com/CrispStrobe/brickwright/pull/755)
package adoption and native guards; forwarding is not package support evidence.

A local refusal preserves an existing session, pending replies and contiguous
request IDs. Validation runs when the queued request reaches dispatch, so edits
to a queued topology cannot evade the check. It reads data descriptors without
evaluating profile getters. Other malformed DTOs remain subject to the closed
native boundary. Native lease, caller, sequence, image and API authorization
errors retain their opaque fixed failure responses; no native error text or
private paths are disclosed.

Twenty focused adapter tests pass, including valid profile forwarding, both
local refusals, queue ordering, session survival, malformed DTO failure handling
and packaged mirror identity. Removing either profile guard makes its dedicated
refusal test fail. These are caller/transport tests; fresh combined installed
qualification of the actual Code/arena path, profile refusals, cancellation and
addressed-API/image negatives remains required before closing package adoption.


The following retained-installer record and proposed slices describe their older
consumer and capture point. Use the newer checkpoint above for reached work;
these original observations are not relabelled as results for a later package.

## Retained Linux installer qualification — 2026-10-12

The fixed broker-failure classification in [PR805](https://github.com/CrispStrobe/brickwright/pull/805)
merged as `8f2cdf8a8867a7c996c5f68b8ca2fcbfcf303769` after every enabled
check passed. It preserves fixed failure codes and does not expose native
exception text. Its reviewed adapter/test files match the merged files.

Separate direct-server tests used the retained installer for consumer
`7282de2b426979c211efb2e67cd1902a8be7f4aa`, firmware
`c99412b39a97e5ca74c90fdde2ef84d282794fc2`, Runtime
`413380963e54b64f94f18d26466e1c6e941be8d2` and Infrastructure
`1253d925accca23dfda66d5bca61e78498dcb64f`. They did not rebuild a package
or adopt those pins on current main. Raw receipts and transcripts stay private.

With two CPU cores, 2 GiB RAM and the default headless rendering configuration,
opening the arena caused native debugger startup to fail. Captured own-runtime
boot output showed GDB opening beyond the native startup deadline. Disabling
WebKit compositing for the headless test (`WEBKIT_DISABLE_COMPOSITING_MODE=1`)
restored actual broker startup with Code and arena open: READY in 57.4 seconds,
a valid firmware frame and clean close. Native deadlines, guest simulated time,
resource checks and permissions stayed unchanged. This is an observed test-host
condition, not a general WebKit defect or a new application rendering default.

Real installed Code/arena tests then observed:

| Test | Observed boundary |
| --- | --- |
| Source/pseudocode | Actual upload, signed A/B motor motion, completion, second retained-session run and restoration of the default shared hub/sensors passed |
| Python in own NuttX | Actual Python upload and completion passed; firmware frames/time advanced with the same session, followed by default hub restoration |
| Active cancellation | Running → stopped → running → stopped, zero demands at both stops and retained-session identity passed; the overall scenario subsequently failed its specific-refusal assertion |
| Native ACL | Actual broker acknowledgement, editor denial, replay rejection, real lease expiry and navigation/reload revocation passed |
| Unsupported profiles | Both requests were rejected and left no GUI firmware session, but the retained installer did not distinguish the intended reasons; specific refusal qualification remains open |

The initial GUI wait was the separately recorded 120-second diagnostic setting;
assertions and numerical tolerances were unchanged. These observations establish
neither current-main package qualification nor physical motor accuracy, external
firmware compatibility or complete distribution licensing. The adoption
[PR755](https://github.com/CrispStrobe/brickwright/pull/755) remains draft.

### Next implementation and qualification slices

1. **Closed caller profile validation.** Review
   `overlay/scratch-vm/src/extension-support/native-renode-capability.js`, the
   start argument schema in `capability-broker.js`, and native policy/semantic
   guards. Give callers distinguishable, fixed refusals for an unknown topology
   and a custom topology without own NuttX. A frontend preflight can explain
   these inputs without widening native error disclosure; label it as caller
   validation and retain independent native refusal tests. Reject malformed
   inputs, preserve a valid existing session after a local refusal, and prove
   no broker dispatch/guest launch occurs. Keep native authorization denials
   opaque and never forward arbitrary exception strings. Include negative
   controls for an accepted invalid profile and a generic unrelated failure.
2. **Image-bound API refusal.** Exercise absent/wrong addressed-sensor ABI and
   wrong userspace identity through an actual installed package. Require refusal
   before upload or motor demand and restoration of the shared hub. A generic
   transport failure does not prove this reason. Keep valid E/F coverage and
   existing default/six-motor profiles passing.
3. **Fresh combined package.** Refresh main and the adoption candidate in an
   isolated branch. Integrate the qualified source, error reporting and caller
   validation normally, then build an exact source-bound package. Repeat actual
   Code source/Python, completion, retained restart, active Stop, restoration,
   profile/API refusal and native ACL tests. Record the tested consumer and pins;
   do not transfer this retained-installer result to a newer package by inference.
4. **Headless and distribution boundaries.** Preserve the default-rendering
   failures and the explicit successful host setting. Qualification receipts
   must record rendering mode, CPU/memory limits and initial wait. Continue G05
   selected-component provenance/notices review before a release claim. Run CPU
   qualification through the authorized direct-server route; private Actions and
   Kaggle are not the test route for this work.

## G02 terminal debugger startup reason — 2026-10-19

Candidate in the existing merged native-startup diagnostic envelope, branch
`lane/spike-g02-rsp-terminal-reason-20261019`. The frontend's original startup
error retains only `operation-failed`; native phase observations end at debugger
connection. Emit one closed native reason for the terminal RSP error after existing
retries. Unknown or decorated error strings map to `other`; backend text is never
echoed. Preserve original error propagation, retry timing, teardown and public
redaction. `unavailable` still combines connection, socket setup and closed-socket
failures; it does not establish TCP refusal, child-exit cause or a startup fix.

Source tests cover all declared reasons and hostile/decorated text. Candidate only:
require every enabled exact-head native CI check and fresh source-bound installed
cold-start, Stop/reset/closure and distinct recovery qualification before merge.
The retained installed failure does not exercise this new diagnostic. No pin,
firmware, model, timeout, workflow, broker policy or public error change; broader
G02 and release gates remain open.

## Current-main source composition of the two native candidates — 2026-10-22

The PR repair sweep composes the published preflight-cancellation and terminal
reason candidates with current main in `lane/native-pr-current-main-repair-20261022`.
The migrated claim files and short LANES header remain unchanged; the legacy
monolithic ledger is not restored. The original cancellation guards,
their complete session controls, and the closed native diagnostic are retained.

All 74 session controls and six claim/migration controls pass together with no
skips or TODOs. Both existing terminal-reason tests also pass when compiled from
the actual composed Rust function and test bodies. This is source qualification,
not a full native-crate or installed-app result. Every enabled final-head check
and fresh installed own-NuttX startup, Stop/cancel, normal-operation and recovery
acceptance remain required; the successor remains a draft until those gates pass.
