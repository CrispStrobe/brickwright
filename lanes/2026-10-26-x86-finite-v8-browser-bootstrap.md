# X86 finite V8 inventory and browser mirror bootstrap — 2026-10-26

Status: CLAIMED; merge this documentation scope before implementation.
Owner: existing x86 GUI source owner, coordinated with the historical-role gate owner.
Base: main `2318dd8e26ae7c41b928b4d8a537d42f929f1412`.

## Preserved failure and bounded repair

The once-selected [finite V7 run](https://github.com/CrispStrobe/brickwright/actions/runs/40352829291)
failed in trusted package/Chromium setup. Source admission and setup-node passed;
npm reported successful installation, but the Chromium dependency setup reached
its existing timeout while Ubuntu mirror downloads stalled. The inventory
observation did not run. Conditional failure-artifact upload succeeded. This
is a spent failure, not a current runtime, native-font or GUI qualification;
never retry or reinterpret that selected event.

Build already calls `scripts/prepare-playwright-apt.mjs` before browser setup.
The x86 workflow does not. Reuse that helper unchanged before trusted browser
setup in the new finite V8 route and the existing actual V8 route. It rewrites
only the known Azure Ubuntu archive URI to the official Ubuntu archive,
including the supported mirror-list indirection. Preserve suites, components,
keys, package lists, dependency identities and the existing setup deadlines.
This closes a source-policy difference; it does not prove every download or
future runner failure has the same cause.

## Owned implementation envelope

- `scripts/run-i80386-hdd-gui-actual.py` and
  `scripts/read-i80386-hdd-gui-originals.py`: distinct finite V8 template,
  event/source admission, inventory, independent positive/failure readers and
  an explicit current actual-V8 inventory-reference adapter. Retire finite V7
  live execution; retain its reader, historical functions and original meaning.
- `.github/workflows/i80386-hdd-gui-actual.yml`: new finite-inventory-eight job
  and the unchanged helper invocation before new finite V8 and actual V8 setup;
  retire the finite V7 job. Preserve all unrelated job bodies and guard values.
- `test/i80386-hdd-gui-actual.test.mjs` and new
  `test/i80386-hdd-gui-browser-setup.test.mjs`: connected inventory/reader and
  x86-only bootstrap ordering, source-binding and failure controls.
- `test/pin-move-chain.test.mjs` and
  `lanes/2026-10-25-x86-historical-cui-role-gate.md`: only separately reviewed
  fixed whole-body profiles and truthful status for the coordinated source
  changes. No caller-supplied profile, automatic refresh or broad exemption.
- `CI-POINTERS.md`, `docs/generated/ci-step-census.json`, this claim,
  `lanes/2026-10-25-x86-gui-finite-v7-cui408-inventory.md`,
  `docs/I80386-GUI.md`, `docs/X86-USER-PATHS.md` and
  `docs/X86-NEXT-LANES.md`: exact new route/step attribution and scoped status.

Bind the unchanged helper through a finite-V8-specific typed Git and workspace
`bootstrapSource` sidecar, carried by the new template, guard, result, metadata
admission and versioned inventory reference. The fresh, unselected actual-V8
guard must admit that reference and helper identity before trusted setup.
Preserve the historical global SOURCE21 declaration, packets and proofs; do not
widen them or accept an unattested helper. No new actual-V9 route is proposed.
This lane imports no package, pin, lockfile, generator, CPU, model, media or GUI
behavior change. The Arcade-owned helper and `test/ci-playwright-setup.test.mjs`, Build
and Tauri workflows remain outside this envelope. Coordinate one writer per
shared x86 source/profile path. Existing [finite V7 ownership](2026-10-25-x86-gui-finite-v7-cui408-inventory.md)
and [historical-role scope](2026-10-25-x86-historical-cui-role-gate.md) remain intact.

## New wire and acceptance

Use distinct finite-V8 schemas, CLI routes, canonical template, two repository
variables, SHA-only body marker, label, job and artifact namespace. Preserve
every consumed earlier value, label, marker, artifact, failure and reader.
New finite V8 guards start false; any arming needs its own reviewed source
commit. Finite V7 execution becomes false while its independent reader remains
enabled. Preserve the current actual-V8 guards without treating them as event
approval. Current supplier identities, eighteen Git-derived witnesses, four
package roots, six critical roles, row/byte/archive/transport/time/resource
caps, zero-byte/alias rules and raw first/secondary failures stay held. Keep the
existing 15-minute job, 10-minute setup and 4-minute collector bounds and every
pinned Action unchanged.

Require meaningful controls for unchanged-helper ordering before dependency
installation, omitted/wrong helper or source, current versus historical
inventory and coherent cross-version substitutions, malformed body/variables,
partial setup and first-error preservation. Removing the source or bootstrap
guard must fail. Keep all existing GUI, debugger, historical and disabled-route
controls, then independently review final source bodies before profile updates.

Qualify the final owned open ready PR head with every actually enabled
exact-head check, only source-declared skips, and its separately admitted Build
checkout/source. A fresh finite V8 event requires independent request/body/
variables/namespace and source review before one selection. Admit official
run/job/full numbered steps/artifact metadata before acquiring each original
once; grade retained bytes with the independent reader. No failed or partial
inventory authorizes actual V8. Only a separately admitted complete current
inventory and native/runtime joins can precede the distinct actual-V8 GUI
export/reload and forward-debug acceptance. Preserve the consumed V7 event.
No physical accuracy, whole OS, performance, release or broad licence claim.

## Disabled implementation checkpoint

The claim merged in [PR1451](https://github.com/CrispStrobe/brickwright/pull/1451).
Phase A introduces distinct finite V8 schemas and CLI routes with execution
and reader guards false, and retires finite V7 execution while preserving its
reader, fixed 836/1bc identities and eighteen historical witnesses. Current
F8/V8 identities and witnesses are separately named, initially unchanged.

The fixed helper sidecar joins reviewed Git mode/blob/extent/digest with actual
regular workspace bytes. Current V8 installs its immutable request once before
Node, requires source/bootstrap admission, runs the unchanged helper before
npm/Chromium, then reuses the same request. Its preflight, guest-entry path and
independent reader also require the retained matching bootstrap/helper evidence;
workflow ordering alone cannot authorize them. A missing or cross-source packet
refuses before media, frontend acquisition or guest. Bootstrap admission itself
observes source only, not installed runtime or GUI acceptance.

Synthetic controls cover the real collector/finalizer/independent-reader chain,
retained historical F7 parsing, coherent current-role drift, failed partial
inventory, typed event/source cuts and helper/one-request ordering. These are
source controls, not a new official inventory. The prior whole-body profiles
remain held and intentionally refuse changed source until separate independent
review. Fresh exact-head source and Build qualification, separate arming and
one-shot F8 admission, originals and independent reading remain required.

## Separately reviewed source arming and role profiles — 2026-10-26

The preceding disabled Phase A checkpoint remains historical. After review
of the producer, independent reader and workflow, a separate source commit
arms only the three F8 guards. F7 execution remains retired and its reader
continues to accept its fixed historical wire. A genuine successful synthetic
F8 collector now passes exclusive original retention and independent reading;
the first omitted finalizer-version refusal is preserved. These controls do
not create an official inventory or authorize a replacement F7 event.

After independent review of the final armed bodies, a separate gate update
fixes their exact lengths/digests and requires literal fixed F7 pins, distinct
historical/current SB3 declarations and the current F8 pin map. It retains
whole-body guards, the four named historical source slots and all current-input
refusals; no caller profile, automatic refresh or broad exemption is added.
Fresh exact-head source and Build qualification remain pending. A separately
admitted one-shot F8 event and complete independently read originals must
precede any distinct actual-V8 GUI acceptance. No such event is selected.

## Finite V8 failed-attempt checkpoint — 2026-10-27

Source candidate [`2079bf18`](https://github.com/CrispStrobe/brickwright/commit/2079bf1884199a294e7321612ce4cb9ef86807f2)
was under [PR1318](https://github.com/CrispStrobe/brickwright/pull/1318)
and unmerged at this checkpoint. The once-selected
[finite V8 run](https://github.com/CrispStrobe/brickwright/actions/runs/40422314383)
passed source admission, setup-node and trusted package/Chromium setup. Its
inventory step failed; conditional artifact upload succeeded. The independent
failure reader accepted the negative record and joined the selected event,
while `qualified` remained false. Its first refusal was `/etc/resolv.conf`: the
V8 template selected an alias, but the recorded file kind was ordinary regular.
This supplies no positive runtime, native-font or actual GUI qualification.

Preserve the original V7 setup failure and this V8 type-role refusal. The V8
event is spent and must never be retried or reinterpreted. The distinct
[finite V9 resolver-role continuation](2026-10-27-x86-finite-v9-resolver-role.md)
requires its merged claim, separately reviewed source and fresh qualification.
Actual-V8 FreeDOS export/reload and forward-debug acceptance remain pending.

## V8 execution retired; V9 source continuation — 2026-10-27

The failed V8 event above remains spent and unqualified. Its source execution
flag is retired while its historical reader, supplier pins, eighteen witnesses
and alias checks remain fixed. The separately claimed V9 source starts disabled
and selects `/etc/resolv.conf` only as a regular file. It does not repair or
reinterpret the original V8 record. New source/Build qualification and a new
independently admitted V9 observation are required before actual-V8 GUI work.
