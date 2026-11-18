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

Labelled jumps, switch destinations, for-each targets, captured catch bindings
and complete structured lowering remain
unimplemented. Unlabelled jumps are confined to the admitted native loop kinds.
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
