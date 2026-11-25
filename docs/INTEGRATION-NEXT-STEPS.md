# Integration closeout and next tasks — 2026-10-27

## Start here: current closeout

This section is the fresh-agent entry point. The sections below retain the
qualification history; an older pending statement there does not reopen a task
marked complete here. Refresh remote main, the linked PRs and the relevant
`lanes/` claims before making changes. This closeout publishes completed work
and explicitly hands off unfinished operations; it does not claim that pending
deployment work has succeeded.

### Completed work to preserve

| Work | Landed result | Scope of the evidence |
| --- | --- | --- |
| Core, native handover and models | PR1322 and PR1327; API integration PR1337 | Qualified combined source, finite installed own-NuttX handover, and named Sine Shuttle/Quartermaster comparisons. Reuse the retained originals. |
| Measurement editor | PR1339, `23514574` | 19 React tests and actual Jolt Edit/Save/Cancel plus CRC-checked SB3 save/reopen. Successful standalone SB3 bytes were not retained; no separate downloaded-file audit is claimed. |
| Installed lifecycle and usability | PR1345/PR1354/PR1355/PR1358 and the G02/G03 sections in the [SPIKE guide](SPIKE-STATUS-AND-LANES.md) | Finite installed Linux matrix, generation census and UI fixes; original timing/controller failures remain recorded. |
| Linux package and release exercise | PR1368 and the v0.1.27 hosted package exercise | Hosted packaging and upload evidence; placeholder exercise inputs do not qualify a production runtime, signed delivery or TestFlight availability. |
| Versioned TestFlight availability | [Existing read-only audit](https://github.com/CrispStrobe/brickwright/actions/runs/40378785039), release `v0.1.27` / `23ec9082` | iOS and macOS valid, unexpired, linked to internal/external tester groups and in beta testing; review approved and EN/DE notes matched at the recorded observation. This does not deliver newer main features or qualify installed hardware/runtime behavior. |
| Experimental registry | PR1336 and subsequent model/control updates | 61 active experimental entries, 63 checkpoint records and 14 qualification contracts at the inspected snapshot. Registry inclusion does not establish model-wide mechanical acceptance. |
| NXT data-file calls | PR1430, `2f3ba1fa` | 83 affected cases across ten files; 40 checks, 33 successful and seven declared skips. Details: [NXT RXE VM](NXT-RXE-VM.md). |
| API sparse timestamp correction | PR1444, `696f0076` | Three hosted Jolt regressions; 44 checks, 37 successful and seven declared skips. Source and finite operator adoption are accepted; the cutover used dense recording and did not exercise deployed sparse sampling. |
| Driven linkage floor contact | PR1445, `7b4f2f84` | Eight floor cases and the unchanged broader gates; 41 checks, 34 successful and seven declared skips. [Contact contract](ROBOT-LAB-FLOOR-CONTACT.md); issue #1436 is closed. |

Earlier API transport, ownership, positive/negative job and terminal-release
checks passed for their recorded worker. They do not establish acceptance of a
new deployment merely because its source or worker tag exists.

### Operator cutover accepted — 2026-10-27

The deployment owner promoted the unaliased candidate at 05:51:54 UTC using
lightweight tag `model-api-worker-696f007`, source
`696f00761b92cc2a4121a568d94b496241ef8afe`, and `tools/model-api` tree
`b3015561950a9174249163c94162b451d72c2e1d`. Recorded environment updates are
limited to `MODEL_API_REF` and `MODEL_API_WORKER_REVISION`. The private delivery
kit now identifies this revision; the previous production remains the rollback.

Independent retained-original readback accepted candidate and production Sine
Shuttle reports: 1,421 aligned dense samples each, completed program, unchanged
input identities, actual provider/source and measurement-reader joins, engine
identity matching the pinned lockfile, and a 31-file deployment manifest matching
Git. Operator judge outputs bind to the reports; two scalar metrics were also
recomputed independently. Twelve deliberately corrupted report copies were
refused. Reservation snapshots show candidate release before promotion and
production release afterward, ending at zero active reservations. The existing
terminal reservation was reconciled through the service before the candidate
job was reserved; no reset or duplicate job was used for this readback.

This is finite acceptance of the recorded cutover. It does not claim a new
independent full-judge implementation, signing-key/MAC audit, loaded engine
binary inspection, physical calibration or model-library acceptance. The dense
jobs did not exercise the sparse branch; its separate three source regressions
remain the evidence for that correction. The original stalled-prefix probe
remains inconclusive with its admission flag false. Reuse the existing originals;
no new cutover job, promotion, request comment or receipt acquisition is needed.

### Pending work: exact pickup and stopping conditions

1. **Keep resting-frame creep separate.** [Issue #1435](https://github.com/CrispStrobe/brickwright/issues/1435)
   remains open. [PR1472](https://github.com/CrispStrobe/brickwright/pull/1472)
   owns the diagnostic implementation at this checkpoint; preserve its source,
   runs and original acquisition. Start with the [resting-creep handoff](ROBOT-LAB-RESTING-CREEP.md),
   refresh that PR and coordinate before implementing.
   Preserve the unpowered intact/control geometry and existing drift limits;
   diagnose against the actual engine without borrowing #1436's contact result
   as acceptance. Any fix needs affected clean hosted qualification and a normal
   exact-head merge. No physical-calibration claim follows from either lane.
2. **Qualify experimental models individually when requested.** Start from the
   registry/checkpoint and the model's existing contract, original program,
   licence and control. Refresh counts rather than hardcoding this snapshot.
   A checkpoint marked `NOT_RUN` is not a completed replay. Admit only the named
   model/law/control/browser result; do not rerun already accepted established
   models or claim that every experimental entry is qualified.
3. **Keep platform and redistribution work separately scoped.** The existing
   v0.1.27 TestFlight availability check is complete, as recorded below; do not
   repeat it merely to inspect its successful original. Signed/non-Linux runtime
   packaging, redistribution review, physical hardware and reference-firmware
   acceptance still require their own claims and exact evidence. A new release
   or changed-availability request needs its own admitted readback; an old
   observation is not a permanent availability guarantee.

### Rules for the next agent

Read this section, then only the linked contract for the task being continued.
Check current ownership before coding; active owners keep their source, runs and
originals. Keep raw receipts, credentials, deployment identifiers and machine
locations in ignored local handoffs. Public records contain repository paths,
source identities and bounded conclusions only. Acquire each official original
once after metadata admission, audit it independently, and retain failures.
Do not change pins, assertions, deadlines or capacity to obtain a pass. Source
changes need affected clean hosted qualification; documentation-only updates use
the source-policy/docs gates. Merge normally only after every enabled exact-head
check succeeds, allowing only source-declared skips, and verify actual parents
and tree against the reviewed prediction. Update this current section in the
same final commit rather than creating a second commit just to record its hash.

## Retained integration history

Refresh GitHub heads, checks and the current owner claims before acting. This
queue covers integration follow-through; it does not transfer other lanes.
Private paths, raw originals and acquisition reservations stay in ignored local
handoffs and private evidence. Reuse retained originals; never acquire or replay
a successful original just to inspect it.

Qualified core base: `1825cf0308d3ba0e217a3117fedefbe959cab8c8`
([PR1322](https://github.com/CrispStrobe/brickwright/pull/1322) and
[PR1327](https://github.com/CrispStrobe/brickwright/pull/1327), including the
qualified native producer and metadata integration).

Final API integration: [PR1337](https://github.com/CrispStrobe/brickwright/pull/1337), merged as
`0576e01408145c79a03508909adbde388710dfe1`; the landed parents and tree matched
the reviewed composition with current main.

## What has landed

- The CAD settled-hover repair from PR1101 is on main through `b0a7291548`.
  Its PR state is closed because integration used a normal merge; the actual
  ancestry and source confirm the change. Do not reopen or repeat that repair.
- Optional iOS audit PR1078 merged as `8e71729713`. This is not an installed-map,
  signed delivery or physical-device acceptance result. PR1044 is closed.
- Circuit widgets and sampled-audio measurements, PR1280, landed as
  `6ed78045cb`. Robot Lab measurements, plots and the
  [43-cell hub coverage](ROBOT-LAB-HUB-COVERAGE.md) also landed; their named
  observations remain bounded to their recorded source and builds.

## Completion order and remaining gates

### 1. Original retention and resource admission

Reuse the retained successful originals and their standalone audits. Before any
new affected qualification, admit its exact source, inputs and existing resource
limits. Preserve original failures; do not replay a successful case to restate it
or expand its claim beyond the observed boundary.

### 2. Native installed acceptance — [PR1279](https://github.com/CrispStrobe/brickwright/pull/1279) and its producer

The frozen PR1279 consumer completed all 25 finite installed cases, including
untouched cold own-NuttX completion, output-boundary Stop, distinct recovery,
preflight cancellation and native UI lifetime controls. A separate seven-asset
served-body binding passed. The original resource-timing probe remains failed;
the narrower result does not claim executed-response or full timing-census proof.

The final combined source is
[PR1322](https://github.com/CrispStrobe/brickwright/pull/1322), frozen at
`ccf990c4`. It includes the native repair, model/renderer changes and merged
virtual transport routing. The old matrix remains finite component evidence.
Its new hosted executable producer
[PR1326](https://github.com/CrispStrobe/brickwright/pull/1326) passed; an
independent reader joined its executable, 182 native source files, ten resource
pins and all 7,997 frontend file hashes. The installed image audit confirmed the
original resource base plus only the current executable. A fresh running-app
check passed the seven critical served files and script DOM, with a separate
container audit. The resource-timing predicate remains failed; this result does
not establish original executed-response identity.

The affected installed case passed on the combined source. It observed real Lab program activity, complete release of the shared provider, global wrappers, threads and clock, actual return to the Code tab, then untouched cold own-NuttX completion, output-boundary Stop and distinct recovery. Independent readers accepted the retained originals and the stopped-container resource envelope. The original runner refusal from a stale consumer-source binding remains recorded; a separately admitted reader changed only that binding and accepted the originals without replaying the guest. This is one finite current-package handover result, separate from the earlier 25 component cases.

All enabled checks and the predicted/landed source trees were subsequently admitted before the matched core merges. This result does not close the whole G02 matrix or qualify physical/reference accuracy, performance, portable installers, signed delivery, release or licence clearance.

Product1322 merged as `ab7c288fe7b` after all 56 current enabled checks succeeded,
with 20 declared skips. Its actual merge parents and tree matched the reviewed
prediction, preserving the current main additions with no qualified application
source delta. The joint producer/model workflow integration landed through PR1327, including
the native producer by ancestry. Its actual merge parents and tree matched the
reviewed prediction, with all current main additions preserved.

### 3. Robot Lab model/WebKit qualification — [PR1322](https://github.com/CrispStrobe/brickwright/pull/1322)

The current renderer prepares each line instance's clip transform in the early
scene hooks, before Three uploads the attribute buffers. Eight actual-Three
controls pass; the unfixed parent and ten source mutations are rejected. The
change preserves the face transforms, geometry, counts, model programs, clocks,
viewport, physical oracles and qualification deadlines.

The fresh immutable-runtime comparison
[PR1327](https://github.com/CrispStrobe/brickwright/pull/1327), frozen at
`2f3bbff0`, passed its actual hosted job. An independent original reader accepted
all four actual/reopened traces, saved projects and the complete 7,997-file
frontend inventory. Sine Shuttle completed with completed 1, failed 0 and stage
4. Quartermaster reached more than 100 simulated seconds with done 1, fault 0
and stage 99; its reopened project also completed. The original 324-second
per-example deadline and runtime identity remained unchanged.

Earlier Quartermaster deadline failures and the separate outer-job cancellation
remain retained. PR1306 and PR1320 are closed unqualified; their branches and
originals are preserved. Passing the new candidate does not prove a measured
speedup, an environment-only explanation or physical accuracy.

The official source head and literal producer checkout remain distinct roles.
The current checkout `a80ee12f` has exactly the reviewed `ccf990c4` tree and
reviewed ordered parents, with no file delta. Keep consumed producer heads
immutable. Every enabled final-head check passed before matched-head integration. The
native producer is an ancestor of the model comparison; PR1327 landed both while
preserving current main and every other owner's records. The reviewed core
predecessors are included on main, and the remaining older native producer PRs
were closed as included. Their original failed or held requests and branches
remain preserved; source inclusion does not relabel those older outcomes.

### 4. Virtual transport integration — [PR1274](https://github.com/CrispStrobe/brickwright/pull/1274)

PR1274 merged as `ec36c07d8b`; the owner closeout also landed. All 31 enabled
source checks succeeded, with six declared skips. The actual browser packet
passed all ten assigned cases without skips, including the supported real UI
handover, serial closure and global-wrapper disposal. The exact source, producer
and actual browser outputs were independently joined. Do not repeat or reopen
this completed transport lane. Its effect on the installed shared SPIKE provider
is covered by the combined qualification above.

### 5. Submitted-model API integration — [PR1282](https://github.com/CrispStrobe/brickwright/pull/1282)

At the PR1282/PR1337 source-only stage, the API had resource/authentication/refusal
controls, private SHA-CAS admission evidence and a source-bound hosted VM/Jolt
fixture-worker result. That stage did not establish production dispatch or
deployment. Its zero/unobserved production steps remain historical observations;
the subsequent configured-service readback is recorded in Delivery readback below.
Never dispatch merely to populate a census.

[PR1337](https://github.com/CrispStrobe/brickwright/pull/1337) preserves
PR1282 and normally composes qualified main in a new owned branch. Its fresh
hosted fixture worker passed, and an unchanged independent reader accepted the
retained encrypted result, 335 source blobs, 185 actual Jolt samples and six real
VM controls without skips. Authentication, encrypted-result CRC/source joins,
finite input/output bounds, atomic admission and conservative ambiguous-job
retention remain intact. All 36 current enabled checks passed, with 21 declared skips. The original
pre-label full-CI guard failure remains recorded; the successful current-label
guard superseded that verdict under the workflow policy. No actual test failure
was waived. PR1337 merged normally with the reviewed parents and tree, and
PR1282 was closed as included with its branch and original outcomes retained. Keep deployment and actual configured Node-host service acceptance
separate. The PR1337 source closeout performed no environment, secret or
production-dispatch writes and did not claim a live API from a manufactured
terminal ledger or an unconfigured response. The
[model-delivery lane](../lanes/2026-10-24-robot-model-delivery-loop.md) retained
ownership of the subsequent hosted-service follow-through; its later retained
results are recorded below without relabeling the earlier source-only evidence.

## Saved measurement definition editing

[PR1339](https://github.com/CrispStrobe/brickwright/pull/1339) merged as
`2351457441a5188247ba3600d9192583d735ccda` after all 28 enabled checks passed, with
seven declared skips. Its actual parents and tree matched the fresh-main
prediction, preserving the current main and API entries. The production GUI
inputs match the independently bound browser composition.

An independent reader accepted the successful official job log and audited
gate predicates. The observed checkout joins to Git commit metadata and an
independently computed composition. The real Jolt editor exercised Edit, Save
and Cancel, preserved saved IDs and plots, refreshed target bindings, and checked
the downloaded project's CRC and sidecar contents before actual reopen. The
workflow does not retain successful JSON/SB3 files, so no separate independent
audit of original saved-project bytes is claimed.

Existing teaching presets, units and provenance are already present. The narrow
follow-on is Edit/Save/Cancel for a saved definition, preserving its stable ID,
order, visibility and plots. Its owning claim is
[PR1330](https://github.com/CrispStrobe/brickwright/pull/1330). Implementation
[PR1339](https://github.com/CrispStrobe/brickwright/pull/1339), at `e774a119`,
repairs an idle preset callback that unnecessarily waited for a React state
callback; active editing still clears its state before continuing. The original
failed lesson assertion is unchanged and now passes, alongside the new deferred
control. All 19 affected actual React/Babel tests passed without failures, skips
or TODOs. The source-bound browser flow also passed. Every enabled current-head
check succeeded before the normal matched-head merge; its actual parents and
tree matched the reviewed prediction. No schema, persistence, physics, native, transport, pin
or workflow change is included in this panel follow-on.

## Measurement experiments — qualified follow-on

[PR1375](https://github.com/CrispStrobe/brickwright/pull/1375) landed as
`eef726fe67d505733b31c599a677ab1897f96a94`; its owning
[closeout](../lanes/2026-10-25-robot-measurement-experiments.md) landed through
[PR1387](https://github.com/CrispStrobe/brickwright/pull/1387). The source
passed 31 checks, with six declared conditional skips, including all 18 browser
shards. This adds scene-assisted measurement picks, sampled acceleration and
pneumatic gauge pressure, bounded two-run recording and CSV comparison, and
four additional authored lesson families.

The owner acquired the four successful official originals once. A standalone
reader accepted the saved-project CRCs, model/sidecar/reopened-definition joins
and both recorded CSV runs' source, time, unit and definition joins. These are
retained originals from this later workflow; PR1339's earlier successful files
remain unavailable for a separate byte audit. Material estimates and tracked
coasting/steering limits remain documented. The subsequent
[PR1404](https://github.com/CrispStrobe/brickwright/pull/1404) adds completed-step
signed motor torque, separate local stop reactions and mechanical power, plus
bounded saved histories and finite inspector properties. Its 39 checks completed
with 33 successes and six declared skips; retained saved-project and CSV joins
passed a standalone audit. Mechanical power is not electrical consumption, and
local joint reactions are not total contact force. These virtual controls do not
establish physical accuracy or experimental-model qualification.

## Virtual-brick data and crane winch — qualified follow-on

[PR1415](https://github.com/CrispStrobe/brickwright/pull/1415) landed normally
as `5cd027707e`, with the predicted parents and tree. It adds bounded NXT
FLATTEN/UNFLATTEN and EV3 virtual program-data files, including handle and
snapshot lifecycle controls. The shipped crane gains a retained motor-C winch
and an independent rope-hung payload. Its revised mechanical leverage trades
example range for lower angular sensitivity: the same luff command predicts
about 16.7 degrees of movement and 26 mm of lift, rather than 30.5 degrees and
35 mm. Motor commands, timing, payload masses and motion tolerances are preserved.

All 340 affected tests across 13 files passed; the exact head completed 38
checks with 31 successes and seven declared skips. The sole retained official
originals passed independent hash, checkout, census and result readers. Crane
measurements were 26.1 mm lift against 26.5 mm predicted, 0.29 mm hold sink,
and 16.6 degrees of hook turn against 16.7 degrees predicted. Its reverse and
removed-counterweight controls passed. Both bounded 5 ms physics windows and
the actual GUI save/CRC-sidecar/fresh-context reopen gate passed. The existing
workflow did not retain successful SB3 bytes, so this does not add an independent
downloaded-SB3 byte audit.

The earlier global position-precision experiment remains a retained failure;
the product restores the previous solver setup. The unchanged actuator and
excavator checks pass on the landed candidate. Eight-decimal model coordinates
preserve the existing catalogue-mass balance assertion. These virtual results
qualify the named software cases, not physical calibration or a new deployment.

## NXT VM virtual file calls

[PR1430](https://github.com/CrispStrobe/brickwright/pull/1430) implements
FileOpenRead, FileOpenWrite, FileOpenAppend, FileRead, FileWrite, FileClose,
FileResolveHandle, FileRename, FileDelete and ListFiles for compiled programs.
They share bounded virtual flash with telegram file operations while preserving
fixed-upload completion, program-owned handle retirement and snapshot state.
Unsupported calls still refuse by name. These calls do not access the host
filesystem or establish physical flash behavior or broad NXC compatibility.

All 83 affected hosted tests across ten files passed, including the owned
compiled NXC fixture's source identity and three runtime cases. Each of the six
unit artifacts was acquired once and accepted by independent retained-original
readers. The exact head completed 40 checks: 33 successes and seven declared
conditional skips, with no legacy status contexts. PR1430 then merged normally
as `2f3ba1fa`, with the predicted parents and tree. All 15 lane files match the
qualified candidate and all 15,839 other entries match the preceding main,
including its additive Sarrus control and other owners' claims.

## Delivery readback — 2026-10-26

The published `v0.1.27` tag identifies `23ec9082`; the release and mobile
workflows succeeded, including signed iOS upload, tester-note synchronization and the TestFlight
internal/external distribution step. The separate versioned, GET-only audit
completed on 2026-10-26 from observer source `29f30420`, admitting the immutable
`v0.1.27` release source `23ec908232f6d4c4604ed6f7dcb23b75af19053d` before
credential access. Its retained categorical artifact was independently checked
against provider metadata, archive digest/CRC and the release version/bundle
identity. Both iOS and macOS report `VALID`, not expired, internal and external
group relationships, `IN_BETA_TESTING` for both tester classes, `APPROVED`
review, and matching English/German notes. Ten changed-source/version,
missing-platform, unavailable/expired, note and privacy-envelope corruptions
were refused by the standalone reader.

This closes the named release-availability verification without another build,
upload, audit dispatch, recovery action or tester-policy change. It is retained
categorical observer evidence, not an independent raw App Store response or
signed-binary audit, installed-runtime/hardware acceptance, or a claim that
newer main features are already in that release. Source/readback ownership is
preserved for any genuinely new release or changed-state request.

The accepted PR1327 model/browser results above remain complete. The separate
[PR1336](https://github.com/CrispStrobe/brickwright/pull/1336) merged as
`c62595f6`, bringing 60 experimental entries. The subsequent
[PR1432](https://github.com/CrispStrobe/brickwright/pull/1432) merged as
`22329fc1` and added the Sarrus single-chain control, for 61 entries at that
checkpoint. Its observe-only headless completion and simulator agreement remain
distinct from browser load and saved-project replay, which are recorded NOT_RUN.

At inspected main `560cf7e6`, [PR1446](https://github.com/CrispStrobe/brickwright/pull/1446)
and [PR1449](https://github.com/CrispStrobe/brickwright/pull/1449) have promoted
Toggle Lever and Thirdline and added Phasor Twin and its control. There are now
61 active experimental entries, 63 retained checkpoint records and 14 separate
qualification contracts. The prior twelve contracts are unchanged; the two
promoted models have new contracts and retain their named browser and causal
control results. Their source-fixture provenance hashes match the retained Git
blobs. The Phasor pair remains experimental, with recorded headless and browser
passes but no full-qualification contract; its canonical model/program hashes
match the checkpoint, while its original builder archive was not independently
rehashed in this readback.

Catalogue presence, lessons and individual evidence records do not establish
full model qualification. The checkpoint retains all prior records, including
promotion annotations, and records saved-project replay as NOT_RUN for all 63.
The active experimental IDs have no exact registration in the separate fourteen
contracts. These are the recorded boundaries, not a claim of new failed runs or
universal mechanical acceptance. Availability in a deployed client still requires
a build of the corresponding merged source.


PR1367 qualified the streamed-body refusal repair and engine-asset identity.
The retained report on that earlier qualified worker contains 306 samples;
independent checks joined its input hashes, normalized submission,
measurement-reader source and reported engine version to that immutable source
and lockfile metadata. That report remains historical evidence after a runtime
change; it does not verify the current deployment, the signed grant or the
selected engine entry's bytes.

Independent review of retained candidate and production cutover records joins
the same normalized input and immutable worker `bd47d9b3`. Both reports contain
1,421 dense 5 ms samples and pose frames over a 7,100 ms scene, with fourteen
available columns and no program errors. Their parsed motion records are identical;
only wall time differs. Input travel and peak hinge gap were independently
reproduced, with separate full-trace sine/cosine deviations below 0.008 mm. This
is not a complete independent reimplementation of every judge window or model
admission. The 31-file deployment manifest matches the source Git objects;
candidate readiness and promotion records, worker-run identities and reservation
snapshots are retained. No historical model job was rerun to read these records.

Current configured-service observations include authenticated capabilities,
1,048,577-byte declared and chunked requests refused with `413 too-large`, and
malformed JSON refused with `400 invalid-json`. One separate single-part,
unpowered 250 ms control was submitted once: authenticated status and result reads
returned 200, the worker completed, and its six-sample report joined the input,
normalized grant, worker, reader source and reported engine/lock identity.
A deliberately nonexistent pose target then produced the expected failed worker
report, also returned through the authenticated result endpoint with HTTP 200.
The actual terminal release removed that request's reservation while preserving
another reservation unchanged. Neither request was resubmitted.

A subsequent current-credential request returned `404 not-found` for an unexpired
retained receipt with a different decoded owner. The pre-response launch record
binds the request to that grant and response. This is an operational refusal,
not an independent audit of server MACs, key continuity or the internal rejection
cause. The reported engine is Jolt `1.1.0-bw.7`; installed engine-entry bytes were
not separately acquired. The original transport-only packet remains unadmitted;
its source, ledger and worker-result checks are joined separately here. The host-buffered stalled upload did not establish the application's deadline;
client abort did not establish origin-side cancellation. These inconclusive
boundaries and the original deadlines are preserved.

These observations provide finite operational readback, not physical, model,
library or full security qualification.
The retained zero-cold sparse trace also exposed an elapsed-label defect: the
first observation follows a 25 ms VM tick but carries elapsed time zero. Its
scene timestamp remains available; this operational readback does not qualify
that elapsed-label interpretation. The separate source correction in
[PR1444](https://github.com/CrispStrobe/brickwright/pull/1444) qualified three
actual hosted Jolt cases for zero-cold sampling, cold-start phase association and
early-completion phase boundaries. All 44 exact-head checks completed with 37
successes and seven declared skips. The normal merge `696f00761b92` preserves
the qualified API files and all other main entries; its parents and tree match
the predicted composition. Sparse elapsed labels now use observed scene time,
while phase association follows the actual observation index. The original
reports are retained unchanged; the 25 ms VM frame, 5 ms physics step, recording
cadence and resource caps are unchanged.

The worker used for the earlier retained operational observations is reachable
from main after PR1336, while remaining an older snapshot. Its API tools and
worker workflow match the inspected commit `8bf40b2c` byte-for-byte. Those earlier
checks changed no worker pin, server configuration or credential registry. The
immutable-worker adoption of `696f00761b92` subsequently completed. Candidate and
production retained readback, promotion and delivery-kit source update are
accepted under the finite boundary in the current closeout section above.

## Independent follow-up and ownership

Refresh each owning claim before starting. These tasks remain separate from the
finite qualifications above; their detailed contracts are in the
[SPIKE lane guide](SPIKE-STATUS-AND-LANES.md).

| Next lane | Concrete scope | Acceptance boundary |
| --- | --- | --- |
| G02 generation collector | DONE 2026-10-24: host-side 100 ms process census during the six-generation MicroPython matrix, largest gap 132 ms, six distinct Renode processes, no overlap or leak; see the [SPIKE guide](SPIKE-STATUS-AND-LANES.md#g02-current-main-installed-matrix--2026-10-24). | Finite installed Linux result; the first 200 ms-period run that missed the limit by 2.7 ms is retained. |
| Remaining G02 cases | DONE 2026-10-24 on current main: MicroPython matrix, NuttX storage/restart/cancellation/backend/view cases, selected-image races and the pane-disposal fix (PR1355); see the SPIKE guide. | Finite installed Linux results; no physical, reference or release claim. |
| G03 sandbox/editor usability | DONE finite scoped work: PR1345/PR1354 record rendered controls and repair touch Move-drag; PR1358 adds an idle empty-editor action after failed conversion while preserving the source buffer. See the current G03 section in the SPIKE guide. | EN/DE, touch, large pane, long reports, mat save/reopen and bounded Identify retain their observed UI boundary; no firmware or physical accuracy claim. |
| G05 packaging/provenance | Finite Linux source/notices and real installed layout work landed through PR1347/PR1353/PR1356/PR1360. The hosted workflow landed in PR1368 and its post-merge v0.1.27 package exercise passed. | Real Linux installation and hosted pipeline results with placeholder runtime/support/frontend inputs stay distinct. Signed/non-Unix delivery and redistribution clearance remain separate. |
| Configured API host | Finite operational readback completed: authenticated transport refusals, one current owned status/result, a different-owner receipt refusal, input/worker/report joins and actual terminal reservation release. The unchanged worker commit is now reachable from main. | No key/MAC audit, separately acquired installed engine bytes, capacity saturation or model/library qualification. Host-buffered stalled upload remains inconclusive; source deadlines are unchanged. |
| Experimental-model floor contacts | PR1445 landed the finite driven-linkage contact repair for [#1436](https://github.com/CrispStrobe/brickwright/issues/1436) at `7b4f2f84`: eight hosted old/current drop, driven single-chain, intact and held controls passed alongside the unchanged broader gates. See [the floor-contact contract](ROBOT-LAB-FLOOR-CONTACT.md). The separate unpowered coplanar-frame drift report [#1435](https://github.com/CrispStrobe/brickwright/issues/1435) remains with its owning lane. | The repair preserves authored geometry, drive programs, numerical limits and pins. Its finite footprint and downward linear-risk trigger do not establish general contact stability or physical calibration; retain the rejected geometry candidates and original failures. |

The retained two-UI-Stop result qualifies its named older package. The current
finite G02 matrix closure comes from the separate installed matrix referenced
above. Preserve original cold-start and collector failures
without assigning a cause from later successful runs. No physical-accuracy,
reference-firmware, full-OS, performance or blanket licence-clearance claim
follows from these software results.

Extra iOS SDK/namespace/family-resource infrastructure remains deferred unless a
concrete blocker requires it. The
[circuit/instrument closeout](CIRCUIT-INSTRUMENT-REGRESSION.md) records verified
existing v0.1.26 TestFlight availability, the fixed 312-case campaigns across
12 authored topologies, and the qualified scope-display adoption. Preserve those
named source/build identities and finite limits; do not repeat the campaigns or
relabel them as physical-instrument, newer-native or signed-application proof.
PR1043 released its old prospective harness reservation; use the current dated
claims for any new work.

The [versioned TestFlight readback lane](../lanes/2026-10-24-versioned-testflight-readback.md)
separately owns source-bound observation of the next release. Readback of an
existing release does not build, upload, assign groups or obtain review for a
new release. Refresh current release ownership before acting. Android and
physical-device acceptance remain bounded by their own evidence.


Deferred iOS audit pickup starts with the audit jobs in
[mobile.yml](../.github/workflows/mobile.yml),
[resource-preparation controls](../test/ios-workflow-resource-preparation.test.mjs)
and [embedded-asset controls](../test/ios-workflow-embedded-asset-audit.test.mjs).
The [retained Darwin design contract](https://github.com/CrispStrobe/brickwright/blob/14e9e199c389a4beedfa5f37ec1d9f1078d7c9b1/docs/INTEGRATION-NEXT-STEPS.md#darwin-sampler-admission-before-controller-wiring)
provides the detailed identity and transaction boundaries. Refresh actual source
and ownership before implementing this deferred lane.

Its remaining work is to admit the selected SDK and executable environment;
join device-set creation and boot to the app and delegated services through
actual platform/kernel/code identities; bound family membership, resources and
the complete retained original union; and compose the prepared receiver,
transaction, invoker and directory context under one sticky Stop intent. Cleanup
and receiver release must remain available after cancellation, preserving partial
bytes and the first interrupt. Missing authority or readback remains a refusal.
The fixed-helper, catalog and directory-only observations retain their named
boundaries. The sampler failure and original ten-second command/three-second
diagnostic limits remain preserved. Before an installed-map event, join that
job's SDK/runtime/build/architecture/model, source, artifact, active asset map and
served bytes, with independent originals. Keep the app entry and qualification
flags disabled until those admissions and affected actual qualification pass.

New source work needs its merged owning claim and affected qualification. Update
only the owning claim under `lanes/`, not the stable `LANES.md` index. Preserve
other owners' in-flight work and successful originals throughout closeout.
