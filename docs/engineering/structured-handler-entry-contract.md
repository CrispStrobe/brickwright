# Physical structured handler prerequisites

The completion and preview utilities do not define an executable handler.
Parser refusal and default terminal exception retirement remain in force.
This contract describes the missing lowering/consumer layout; none of its new
block names or transfer outcomes are registered or enabled by this change.

## First engine dependency implemented

The real overlay producer now instruments the actual execute wrapper, Promise
consumer and Thread mutators with `bw-engine-activations`. Execute entry issues
a private identity for its current runtime, sequencer, thread, target, block
container, command root and frame. Capture is permitted only inside that actual
entry; validation can outlive synchronous execution while a Promise waits.
A ticket is observation authority, never a handler-transfer acknowledgement.

Every real Thread push/pop/reuse invalidates the current activation. The actual
frame reset also invalidates entries, including direct reuse and release into
the free list. Reissuing the same frame object cannot revive its old ticket.
A later execute entry gets a new identity. Start/Stop/load/dispose invalidate
runtime entries, including suspended callbacks. No frame or status fields are
changed by invalidation itself.

The actual `handlePromise` fulfillment and rejection branches now check their
captured activation before reporting a value, popping a frame or marking a
Promise result. A missing engine entry retains existing behavior; it grants no
transfer authority. The exception coordinator and its terminal consumption
hooks remain unchanged. Overlay reapplication strips these exact owned hooks
before earlier strict producers run, then reapplies them; partial hooks refuse.

The implementation is source-only until its new controls run. Its pure control
file evaluates the real selected Thread source after production instrumentation
and the actual produced `handlePromise` body. It does not run a VM, PXT, guest or
model. Other exception/report services are observation callbacks; they provide
no proof of exception-coordinator integration or native stack unwinding.

## Required owned entry layout

A future `arcade_structuredTry` control command needs explicit `HAS_CATCH` and
`HAS_FINALLY` flags, a literal catch-binding name, and three actual branch
inputs: `SUBSTACK` for try, `SUBSTACK2` for catch, `SUBSTACK3` for finally. Explicit
flags distinguish an absent branch from an authored empty branch. These names
are a proposed exact lowering ABI, not available vocabulary or accepted blocks.

Entry must be proved from the current cached operation and installed primitive,
its real target/block container, the original try-control block object and its
unchanged branch-input objects. It creates a private per-invocation boundary
bound to the exact enclosing activation/stack prefix. A body ID, preview plan,
public handler property or copied metadata cannot register a continuation.
Catch value storage belongs to that invocation's private lexical cells.

The real sequencer must also recognize completion of each branch before it
pops/reuses the owning control frame. Normal try/catch completion enters the
finally branch when present. A throw from catch cannot re-enter that catch.
A running finally must finish before an outer handler can be selected. Return,
break, continue and throw completion are private records, not fabricated normal
values; a normal finalizer resumes the saved record and an abrupt one replaces
it. Lexical jump destinations need actual owned enclosing control frames.

## Required commit and managed-call outcome

The engine consumer must retain the validated throw origin and immutable
managed-call edge identity before the primitive loan unwinds. At the actual
execute catch or Promise rejection boundary it validates those leases and the
owned entry above, installs the exact handler stack/status/lexical state, then
issues a private one-use acknowledgement of that concrete mutation. A Boolean
acknowledgement, preview identity or old pointer/membership check cannot do it.
No current code can issue or consume that acknowledgement.

`callFunction` / `_pumpFunctionCalls` currently finish a child by resolving a
normal return value or rejecting terminal failure, with unlink/retirement.
They need a distinct privately owned transfer settlement tied to that actual
pending call. It must not call ordinary `handleReport` or ordinary rejection
logging/pop. The Promise consumer must recognize an acknowledged transfer
before its stale-origin early return: a real transfer intentionally invalidates
the old activation while installing the new one. Both old-origin and new-entry
identity must be linked by the acknowledgement, not by accepting any stale
settlement. No such discriminant or shortcut is implemented here.

Only an accepted physical acknowledgement may suppress `retireLineage`.
Unknown, changed, foreign, stale or unowned transfers must retain the existing
uncaught path. Stop invalidates all pending transfers and performs existing
host cleanup without executing stale authored catch/finally work.

Actual owned handler entry, sequencer branch completion, immutable caller-edge
leases, transfer commit/ack, managed-call settlement and real guest controls
remain the next coupled implementation. These prerequisites must exist before
parser acceptance. No project-coverage or structured-exception support is earned
by activation tickets alone.
