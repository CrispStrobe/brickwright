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
primitive loan unwinds. The nearest registered boundary is decisive: unsupported
finally, an already running catch or an empty catch refuses rather than skipping
to an outer handler. Only same-thread and direct managed-caller catch destinations
without finally are currently implemented.

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

## Lexical cells and direct managed calls

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

After installing a direct caller catch, the engine consumes its receipt and
parks the destination until that actual call settles. Child cleanup and
retirement precede transfer delivery. Synchronous callFunction throws a private
transfer settlement; queued _pumpFunctionCalls rejects with the same distinct
private transport. Neither route returns a normal value or runs ordinary
handleReport/rejection popping. Consumption revalidates the parked installation
before making it runnable. Foreign, copied or reused transports cannot consume
it; changed branch state falls back to the original thrown Error. Generation
checks after metadata and cleanup prevent Stop/restart callbacks from reviving
or terminally reporting stale work.

## Remaining coupled work and qualification boundary

Normal try/catch completion, branch completion before sequencer pop/reuse,
finally entry/continuation, abrupt finalizer replacement, return/break/continue
relay, deeper managed-call unwinding, captured catch bindings and complete
structured lowering remain unimplemented. A running finally must finish before
an outer handler can be selected. The compiler must prove lexical jump targets
against actual enclosing control frames. These gaps forbid parser admission and
default enablement.

New bounded pure controls evaluate selected real executeWithContext and
handlePromise bodies, the actual primitive owner, cached owner, coordinator,
instrumented selected Thread, lexical methods and direct callFunction/pump
methods. Cache graphs, registration, value adapters and unrelated services are
authored test data. This is stronger than detached helper/Boolean checks but
does not execute the full execute loop, production overlay, VM, native guest,
PXT, Code/SB3 journey or project corpus. The earlier entry and stack proofs stay
separate; successful source controls do not count as completed guest fixtures
or structured-exception support.
