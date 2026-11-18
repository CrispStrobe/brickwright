# Detached structured-completion foundation

This is an unqualified local foundation, not try/catch/finally support. The
TypeScript reader still rejects those statements. The later disabled preview
seam imports the foundation only for an explicit inspection claim; production
does not activate it. No compiler bridge, vendor pin or workflow changes. The
foundation executes no authored body and observes no actual VM thread. See
[the preview contract](structured-continuation-preview.md) for its separate
source hooks, pure fake-frame controls and unqualified physical bridge.

The completion owner holds all invocation, frame, target, completion and
suspension identities privately. A completion is normal, return, break,
continue or throw. Break/continue carry a target from the same invocation;
continue requires a loop target. An immutable description is only a data view,
not a replacement capability. Lexical containment of jump targets is still a
compiler/bridge responsibility; the detached token alone grants no VM jump.

The owner emits catch/finally/complete actions. Only a throw from a try phase
enters its catch. The catch cannot catch a throw from its own catch or finally.
Each boundary can be finished only at the top of its invocation's stack. A
normal finally resumes the saved completion. Any abrupt finally replaces it.
The caller must explicitly propagate an inner completed action to its parent;
the module does not infer actual Scratch caller edges.

Suspension freezes an invocation until its matching one-use lease resumes it.
Other invocations can progress independently. Stop/cancel invalidate pending
leases and release retained boundary entries without requesting authored catch
or finally work. A fresh run cannot consume old completions or settlements.
This cancellation rule is separate from the host generator's resource cleanup;
that existing cleanup remains unchanged. An eventual bridge must preserve both
contracts rather than suppressing cleanup or executing stale authored blocks.

## Exact integration boundary

`bw-arcade-exceptions.js` currently routes an owned throw through `raise` into
`retireLineage`: it marks failure, walks actual managed caller edges, retires the
threads and publishes the uncaught error. A catch route must intercept the
owned signal before that retirement. Arbitrary JavaScript errors/properties
cannot become authored thrown values.

`_registeredCallbackSteps` currently creates callback threads, waits until
termination, and reads terminal failure. It has no catch continuation frame.
`_runTerrainGenerator` closes suspended host iterators after epoch changes and
runs bounded host cleanup. A JavaScript try around that generator is not an
implementation of catching a thrown Scratch value inside a user procedure.

The next seam must bind a completion invocation to actual current thread and
stack-frame identity, extend the existing managed-call edge through yields,
and supply a private handler continuation before retirement. Only then can a
TryStatement AST/lowering route consume the foundation. Parser acceptance stays
refused until all of those stages and finalizer control transfers exist.

## Controls and qualification

`test/structured-completions-foundation.test.cjs` is a dependency-free, in-process
state-machine control. Run directly (not Node's worker-spawning `--test` mode):

```
node --max-old-space-size=128 test/structured-completions-foundation.test.cjs
```

The eight groups cover completion propagation, catch selection, finalizer
replacement, nested ordering, suspension and stale leases, Stop/restart,
foreign identity refusal and independent invocations. One governed in-process
run passed all eight groups with zero failures or skips, exit zero, 0.421 seconds
and 51,261,440 bytes peak owned RSS under a 256 MiB limit. The run bound the
exact module and test bytes; no repeat was performed. This qualifies only the
detached state controls, not a Scratch project or the absent compiler bridge.

`test/fixtures/makecode/structured-completion-controls.mjs` contains seven
original source fixtures for future compiler/guest qualification. They remain
UNRUN: nested catch/finally, return preservation, both finalizer override
forms, loop completion, yielding handlers and external Stop/restart ownership.
The Stop case needs a real driver observing before cancellation, then settling
an old wait after a new invocation; a manufactured completion flag is not a
substitute. These fixtures are not research-project extracts.

No coverage, guest-equivalence or full structured-exception claim is made.
