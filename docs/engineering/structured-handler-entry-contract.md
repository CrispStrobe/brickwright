# Physical structured handler prerequisites

Structured source exceptions remain disabled. Parser refusal, default uncaught
retirement and the seven unrun guest fixtures remain in force. No handler
primitive is registered. The extension constructor still selects `create()`;
`createStructuredPreview()` remains terminal. `createStructuredEngine()` is a
separate internal experimental seam for the coupled source dependencies below.
It does not grant source-language support or project-coverage credit.

## Actual engine entry and lifetime

The real overlay producer instruments executeWithContext, handlePromise and
Thread mutators with `bw-engine-activations`. Entry captures the runtime,
sequencer, thread, target, block container, command root and frame. Only an
actual current execute scope can capture that identity. It can remain valid
while its operation awaits a Promise. Every push/pop/reuse invalidates the
execution identity. Frame reset and free-list release invalidate frame leases;
reusing the same object cannot revive them. Start/Stop/load/dispose invalidate
run leases and pending transfers.

The canonical disabled entry binder checks the current primitive loan and cache,
actual control object, explicit HAS_CATCH/HAS_FINALLY/CATCH_NAME fields,
SUBSTACK/SUBSTACK2/SUBSTACK3 input objects, branch parents, installed primitive,
frame lifetime and enclosing stack prefix. Flags distinguish absent branches
from authored empty branches. A copied body ID, preview plan or public metadata
cannot bind an entry. Rebinding a frame supersedes the old entry.

## Owned throw and physical consumption

In the experimental engine seam, raise stages only an actual current cached
arcade_throwValue invocation. It retains its private original Error, primitive
value, current execution identity and physical transfer request before the
primitive loan unwinds. The nearest registered boundary is decisive. Try throws enter their catch when
present; otherwise they enter finally while retaining the original completion.
Catch throws enter that boundary's finally. Throws escaping a running finally
replace its pending completion and continue outward. Empty authored branches
retain their flags and complete through the actual sequencer null-branch path.
Same-thread handlers and linked managed callers have disabled source consumers.

The actual execute catch and Promise rejection consumer use the coordinator's
private signal identity. Commit revalidates run, origin, stack, branch and entry,
prepares a fresh branch frame, preserves the owning control frame and params,
clears reporter state and invalidates discarded frames. Only then can its
private one-use installation receipt suppress terminal retirement. Changed or
unowned requests fall back to the original signal and existing retirement.
Stop/restart tombstones absorb old signals without executing authored handlers
or publishing an old failure into a new run.

Promise rejection consumes owned transfers before checking origin staleness,
because physical installation intentionally invalidates the old activation.
Ordinary fulfillment and unknown rejection retain their prior behavior. Overlay
reapplication accepts only the complete exact current or previous hook shape;
partial hooks still refuse.

## Lexical cells and managed calls

The physical catch owns a private cell map tied to its actual frame prefix and
run lifetime. Actual getLocal/setLocal methods reach that map through their real
primitive/cache loans. No opaque body pointer or copied params object supplies
catch binding authority. Outer procedure params remain separate. Reader/writer
checks expire on Stop, reuse, supersession or changed control metadata.

The actual callFunction path admits its managed link through the cached call or
retained construction caller lease. Each edge is immutable and retains its
actual caller activation and frame lease. Staging and consumption must observe
the identical still-linked edge, preventing unlink/relink substitution. A local
boundary on the throwing child cannot be skipped for a caller catch.

Managed throws retain an immutable chain of the actual linked call edges before
any finalizer executes. Each procedure first finishes its local catch/finally
selection. Only a current execute activation or a one-use completed-finalizer
token can issue its physical escape receipt; an actionable local boundary
refuses escape. The receipt is consumed before cleanup and retirement. The
actual synchronous callFunction or queued _pumpFunctionCalls then delivers a
private transport to the immediate caller, before stale-origin filters. No
normal reporter value or ordinary rejection pop substitutes for settlement.

That caller revalidates the captured edge suffix, frame lifetimes, activation
and run before selecting its local handler. A handler-free caller escapes via
its own receipt and actual pending call. This repeats through deeper managed
calls without prematurely entering the grandparent handler. Unlink/relink of
the same child cannot replace an edge in the frozen chain. Local finalizers,
rethrows and exact original Error fallback remain decisive.

Foreign, copied or reused transports cannot settle a call; changed branch state falls back to the original thrown Error. Generation
checks after metadata and cleanup prevent Stop/restart callbacks from reviving
or terminally reporting stale work.

## Actual branch exit and finalization

The disabled control body starts a private branch lease through its current
canonical entry. Thread.goToNextBlock intercepts branch completion before frame
reuse. Sequential successors preserve the lease only across its observed native
reuse; a reset or pool release revokes it. Sequencer.stepThread intercepts both
null-branch pop sites. Promise fulfillment hands the owned command branch back
to this same advancement path before its ordinary pop/push loop.

Normal try or catch completion enters finally once when present; normal
finalizer completion restores the saved completion. A saved throw enters the
nearest enclosing same-thread catch/finally, or uses its original terminal
signal. Normal completion advances past the owning control while preserving an
outer branch's own advancement. Metadata refusal during a pending throw uses
that exact original Error. Stop/restart cancels only the retained old branch
and gives the sequencer a private one-use cancellation handoff; it does not
repeat old authored work or adopt a reset/reissued frame.

A completed child finalizer can relay its saved throw through the retained
managed-call edge chain. The engine issues a one-use completion token bound to the
actual branch, run, frame and original signal. Only its private coordinator sink
can combine that token with the retained caller edge/activation and physical
installation receipt. Each caller catch/finally waits for its actual synchronous callFunction or
queued _pumpFunctionCalls settlement, including handler-free intervening calls.

## Owned return and procedure settlement

The experimental return path captures the actual cached return primitive before
observing its inputs. It retains the destination procedure frame, stack prefix,
params identity, reporter identity and frame lifetime in the current run. Its
value is read under the original synchronous primitive loan and remains private
until finalization finishes. Command procedures retain their ordinary discarded
return value behavior.

Return skips catches, executes lexical finalizers inside out, and then settles
only its retained procedure. A return or throw from a running finalizer replaces
the saved completion. Promise fulfillment uses the same branch completion path;
Stop/restart, frame reset and changed handler metadata cannot publish a retained
value. Relay revalidates the actual origin branch after value and outer-handler
observation; a reset branch cannot be adopted into a new finalizer. Cancellation during cache admission consumes the old invocation instead
of falling through to ordinary settlement. These are disabled source consumers,
not parser admission or completed language support.

New selected-source return controls exercise actual returnValue, callFunction,
queued settlement, Thread advancement, execute/Promise and Sequencer methods.
Their graph, registration and unrelated value services remain authored. A
separate real cached VM return probe failed on missing minilog before VM
construction, after private restoration of the pinned JSZip dependency closure.
It did not execute a program or qualify this candidate in a VM.

## Owned unlabelled loop jumps

The experimental owner admits unlabelled break/continue through the actual
cached `arcade_structuredJump` primitive. No jump primitive is registered in
getInfo. The compiler still refuses structured source. A native loop destination
is issued only when the real Sequencer enters a branch of the current cached
repeat, forever, repeat-until or while command. A public isLoop flag, copied body
ID, jump argument object or dynamic caller frame cannot issue that destination.

Each destination retains the actual loop frame lifetime, run generation,
command/cache/primitive identities, fields, inputs, params and stack prefix.
Its iteration has a separate private body-frame identity, preserved only across
observed native sequential reuse. Reset, pool release, a new iteration or changed
metadata revokes it. Actual block ancestry must reach the admitted loop body;
procedure parameter/reporter frames prevent borrowing a caller's loop.

Jumps visit intervening lexical finalizers inside out, skipping catches. An
abrupt finalizer return, throw or new jump replaces the pending completion.
Break advances through ordinary Thread control flow; continue preserves the
loop counter/context and uses a null branch to resume native scheduling. Neither
route can select an outer loop merely because its destination is easier to
validate. Promise finalization retains the same ownership checks. Stop/restart
at admission or ordinary loop successor observation consumes only retained old
work, without publishing an old invariant failure or running its successor.

New controls execute selected actual native control, Cast and Color source in
addition to Thread, execute/Promise, Sequencer and the extension jump/return
methods. Graph registration and unrelated service adapters remain authored.
They provide no full VM, guest, compiler or project coverage. A separate cached
VM jump probe passed private restoration of pinned minilog/microee but failed on
missing format-message before VM construction; JSZip and minilog setup failures
from previous attempts remain separate originals.

## Remaining coupled work and qualification boundary

Labelled jumps, switch destinations, for-each targets and complete structured
lowering remain unimplemented. Captured catch bindings and held dispatch have
disabled selected-source consumers below; source lowering remains absent. Unlabelled jumps are confined to the admitted native loop kinds.
Implemented abrupt replacement covers returns, throws and those loop jumps. A running finally must finish before
an outer handler can be selected. The compiler must prove lexical jump targets
against actual enclosing control frames. These gaps forbid parser admission and
default enablement.

Separate bounded pure controls evaluate selected real executeWithContext and
handlePromise bodies, Sequencer.stepThread, the actual primitive/cache owners,
coordinator, instrumented selected Thread, disabled control body, lexical methods
and direct callFunction/pump methods. Cache graphs, registration, value adapters and unrelated services are
authored test data. This is stronger than detached helper/Boolean checks but
does not execute the full execute loop, production overlay, VM, native guest,
PXT, Code/SB3 journey or project corpus. A separate targeted cached VM probe was
admitted but failed on a missing cached dependency before VM construction; it
provides no program output or VM qualification. The earlier entry and stack proofs stay
separate; successful source controls do not count as completed guest fixtures
or structured-exception support.

Separate new multi-edge controls execute selected Thread, execute/Promise,
Sequencer, callFunction and _pumpFunctionCalls with authored graphs and unrelated
services. They cover synchronous/queued grandchild throws, inner finalization,
rethrow, same-child edge replacement, frame reset, Stop/reuse, normal managed
value reading and exact original Error on refusal. They do not rerun the prior
jump/return/branch suites. A separately guarded private cached VM bootstrap
restored pinned format-message bytes, then failed on missing immutable before
VM construction; it earns no VM program, guest or project credit.

The thrown-value reader retains the admitted run before reading. Stop/restart
inside that reader issues only a private old-run cancellation tombstone, which
the actual execute/Promise consumer absorbs before stale-origin filtering. It
cannot stage a new handler, deliver a call value, or publish a failure into a
reused root frame. The pre-fix disposed-owner error is preserved separately.

## Disabled captured-binding source candidate

The previous capture gap was that createCallable selected procedure
locals or inherited maps while active catch bindings live in a separate private
handler cell map. A same-named outer procedure local can therefore supply the
capture. The disabled candidate gives the nearest admitted catch cell
precedence and retains an opaque token instead of exposing that private map.
An explicitly observed lexical exit detaches the cell from its physical frame;
Stop/load/dispose still expire its run lifetime. Direct callable invocations
retain the actual issued map and child sentinel lifetime, and cached captured
read/write methods validate that ownership before touching the cell.

Eleven new selected-source controls pass after correcting the callable caller-lease
opcode allowlist. The ordinary-local control now retains a procedure sentinel
instead of placing persistent locals on a transient body frame. All eleven
original failures and earlier lock/cgroup admission refusals remain retained.
Five targeted mutations produce failing controls. In that initial batch, removing only lifetime.live
survives because frame registration still rejects reset; removing both checks
is detected. These controls cover escaped cell/value captures,
normal locals, sharing, writes, map copying, sentinel reset, Stop/reuse and a
Stop during the actual value reader. No full captured-binding, invocation,
source-lowering or guest qualification follows. Captured event/held dispatch,
labelled/switch/for-each destinations and complete lowering remain open.


### Captured lifetime counterexample

The first eleven controls do not detect removal of the captured-map live flag.
That original mutation remains undetected. Three new controls restore sentinel
fields and identities after reset, pop, or Stop/restart: the live-flag-only cut
still passes those controls, while removal of frame registration exposes the
reset/pop cases. Completed invalidation removes registration as well as clearing
live, so those cases cannot distinguish the checks.

A fourth new control observes the actual reset callback interval: invalidation
clears live, calls the lifetime Set delete method, then removes frame registration.
A temporarily instrumented delete method attempts the actual captured read during
that interval. Current source refuses; the live-flag-only mutation reads the stale
value 31. The original guard is therefore retained. This is selected-source
callback evidence, with authored graph/services; no full VM or language result
follows. The new four-control batch and mutation are separate from the original
six mutations and eleven controls.


### Held callable service admission

The disabled captured-binding consumer now carries the actual service command's
argument object from runCallableDispatch through the dispatch service to
_callableProcedure. Its separate service opcode must match the current primitive
loan and canonical cached command before issuing the caller/frame witness.
The managed child then uses the same one-use map and sentinel lifetime admission
as a direct callable. A held reference, copied argument object or copied capture
map cannot replace that admission. The default owner still uses ordinary cells.

Eight new selected-source controls exercise the actual held dispatch, callable,
primitive/cache, Thread, execute and Sequencer methods with authored graph and
unrelated value services. They cover escaped cell/value reads, repeated service
invocations, shared writes, primitive replacement, copied arguments/maps, Stop
cancellation and ordinary default-owner behavior. The original baseline has
three positive-case failures. Removing argument forwarding, service opcode
admission or the primitive role causes three failures each. The opcode cut
removes both invocation and caller-lease allowlist entries; it is not an isolated
caller-lease mutation. Earlier tests and mutations were not rerun or added to
these counts.

A separate private cached VM probe has not constructed the VM or executed a
program. Its first setup failure was an incorrectly rooted private UUID resolver;
a corrected resolver reached missing htmlparser2. Restoring only the exact pinned
local parser dependency closure then reached missing scratch-svg-renderer.
These are setup failures, not program failures or passes. The cached source is
unchanged; no downloads or shared dependency writes occurred. No compiler,
full extension, source import, PXT, Code/SB3, guest or project result follows.
Captured event registration/lowering and labelled/switch/for-each destinations
still require their own coupling and qualification. Parser refusal, default
uncaught retirement and all seven original guest reservations remain in force.


### Canonical engine argument shape

The first actual cached Runtime execution refused the disabled handler before
entering its body: BlockCached always adds a mutation argument, while the
entry binder required exactly the three literal fields. The candidate now
admits that extra engine argument only as an own data property equal to the
canonical operation mutation. It retains the exact argument-key set and checks
that property again while the handler is live. Extra keys, accessor replacement,
changed values and deletion still refuse. The three-field selected-source
adapter shape remains supported; no authored handler mutation is admitted.

Seven new selected-source controls pass for canonical argument admission and
refusal before and after entry. Removing live mutation-property revalidation
makes the changed-value and accessor counterexamples fail. These counts are
separate from earlier dispatch and lifetime suites, which were not rerun.

One authored graph now passes through the actual cached Runtime, RenderedTarget,
Blocks, complete execute loop, Thread and Sequencer with private experimental
hooks and selected extension methods. It observes the real catch-created
capture read of 31 after a native list-block finalizer and held service dispatch.
The same final graph with the previous engine-activation module refuses entry.
The graph, sprite metadata, procedure resolver, value/reference services and
managed-return adapter are authored; this is not a complete production extension,
VM wrapper, source import, PXT, Code/SB3, renderer or original guest proof.

The full VM wrapper remains unconstructed. The bounded renderer restoration
attempt refused a pinned dependency archive whose root is dompurify rather
than package; no restored dependency tree was written. Original archive lookup,
abstract-target sound setup, omitted executable-target registration and load
pressure refusals are retained separately. The corrected graph uses the real
RenderedTarget and Runtime.addTarget; engine source is not modified to bypass
those setup requirements. Coverage totals and the seven original guest
reservations are unchanged, and structured source/default behavior stays disabled.


### Disabled registered-event capture consumer

The emitted TOKEN/CAPTURES registration boundary now has an experimental
catch-cell consumer shared by admitted update, interval, button and other
registration primitives delivered through the common callback scheduler. An actual current cached registration selects the
nearest lexical catch cell before ordinary locals, or validates an inherited
cell against its current callback invocation. The private engine retains the
issued map, exact entries, target, token and run generation. Record spreads used
by event-specific registration retain that same issued map.

Delivery validates that registration before executing its actual callback and
uses a fresh inert Thread sentinel to retain the cells while the native
sequencer replaces callback body frames. Repeated delivery gets a new sentinel.
Copied maps, changed tokens, Stop/restart and sentinel reset cannot grant a
captured read. The ordinary default owner retains its previous registration
behavior. No new primitive is registered and structured source is still refused.

Eleven new selected-source controls exercise the actual registration and callback
methods with Thread/execute/Sequencer and authored metadata. The pinned previous
source exposes the original outer-local capture and lacks registration-map
admission. Targeted cuts of catch precedence and the callback sentinel are
detected separately. An additional authored event
graph passes the actual cached Runtime/RenderedTarget/Blocks/complete execute
engine: repeated deliveries read 31 four times after one finalizer and report
zero errors. This graph uses private experimental hooks, selected extension
methods and authored sprite metadata; it does not construct the VM wrapper or
run source import, PXT, Code/SB3, original guest fixtures or a corpus.

The initial shared consumer did not admit separate creation, wall/tile or
tilemap delivery. The later consumer below addresses those runtime paths.
General structured binding/lowering, remaining event families, labelled jumps,
switch and for-each destinations and complete source lowering remain open.
Parser/default admission and corpus totals remain unchanged. Full VM/import
setup is still unqualified because the pinned renderer dependency closure has
not been admitted under the current dependency/license bounds.


### Separate creation and terrain callback consumers

The disabled event capture consumer now reaches the separate creation,
wall/tile and tilemap delivery paths as well as the common callback scheduler.
Creation binds a fresh sentinel before either immediate nested execution or
queued scheduler delivery; queue admission failure retires its new thread and
rejects its original pending creation request. Legacy unregistered creation
hats keep their prior behavior. Wall/tile and tilemap delivery bind their own
issued registration map before any authored callback executes.

Thirteen new controls use actual registration and separate delivery methods,
Thread, execute and Sequencer with authored metadata and unrelated services.
They cover repeated delivery, immediate/queued creation, copied maps, queued
Stop cancellation, ordinary default-owner behavior and an unadmitted opcode.
The previous common-callback suite is retained separately; its formerly
unsupported wall command is replaced by an unadmitted external command in the
negative control, without rerunning that suite.

A separate graph passes actual cached Runtime/RenderedTarget/Blocks/complete
execute source with immediate creation once, queued creation once, wall and
tile delivery twice each and tilemap delivery twice. Its sixteen captured reads
are 31, its finalizer runs once and no errors are reported. The graph uses
selected actual extension methods, authored blocks and sprite/tile metadata,
private experimental engine hooks and unrelated value adapters. It is not a
full VM wrapper, source import/compiler/PXT/Code/SB3 or original guest result.
General lexical binding and complete structured lowering, labelled/switch/
for-each destinations and affected original guest qualification remain open.
Parser/default admission and corpus totals are unchanged.
