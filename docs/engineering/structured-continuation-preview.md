# Disabled structured-continuation preview seam

This builds on the detached completion foundation without enabling structured
exceptions. `create()` still claims the default exception owner. The production
Arcade constructor does not call the explicitly separate
`createStructuredPreview()` inspection entry. The TypeScript parser continues
to refuse try/catch/finally. No engine consumption hook or compiler word changes.

## Source seam

An opt-in preview claim owns a completion instance and actual invocation
bindings. The callback generator can open a binding only after making the real
child thread active and capturing its actual initial stack frame. The binding
is suspended around the existing callback wait and closed on every generator
exit. Deferred callbacks deliberately have no inferred initial binding: their
actual first sequencer activation needs its own private entry hook.

Only actual stack-frame ancestry and the existing private managed-call edges
are followed. Retained caller leases keep their original frame rather than a
later nearer frame. Plan inspection rechecks the origin's current top frame,
every traversed parent edge, invocation revision and run epoch. An event token,
shared target, copied plan, public caller property or foreign completion is not
an authority. A new top frame or changed parent path invalidates the plan.

`raise` first performs the existing primitive ownership/value checks and stores
its privately issued signal. Only then may the opt-in owner offer a catch or
finally preview, before `retireLineage` marks failures or retires threads. The
observation records only kind/preview status. It is not an engine exception
loan. Preview failures cannot replace the original uncaught signal.

Even a successful preview unconditionally follows the existing uncaught
retirement/publication path. A preview plan must never be used to justify
consuming an engine exception or allowing the throwing primitive to continue.
Default throw-value validation, signal construction and terminal retirement
remain in place. Their actual runtime behavior has not been rerun or qualified
by these new controls.

Start, Stop, project load and claim disposal invalidate preview run ownership.
Retirement releases matching bindings. Old plans and suspension leases cannot
settle a fresh invocation. Host generator resource cleanup remains distinct
from executing an authored finalizer after cancellation.

## Observed validation

One governed pure-JS run passed eight new groups, zero failures/skips, exit
zero, 0.195 seconds and 52,297,728 bytes peak owned RSS under 256 MiB. The helper,
new test and unchanged foundation were bound to exact file hashes. These tests
use fake frame and parent observations. They do not load the actual exception
coordinator or Arcade callback runner, create a Scratch VM, or qualify native
stack ownership. The previous foundation's eight tests were not rerun.

Self-contained files for the new in-process control:

- `overlay/scratch-vm/src/util/bw-structured-completions.js`
- `overlay/scratch-vm/src/util/bw-structured-continuations.js`
- `test/structured-continuations-preview.test.cjs`

Run the new file directly, without a worker-spawning test-runner flag:

```
node --max-old-space-size=128 test/structured-continuations-preview.test.cjs
```

Actual coordinator/callback integration remains UNRUN. The seven original
future source/guest fixtures remain UNRUN. No corpus, model, compiler, guest,
PXT, Code/SB3 or project-coverage result is earned here.

## Next physical continuation proof

A private engine consumer must atomically install a real current handler
continuation and retire only the frames actually being unwound, before the
throw can bypass terminal retirement. It must acknowledge that actual change
with a privately issued current receipt. A Boolean returned by a callback, an
Error property or a preview-plan identity cannot stand in for that commit.

The existing execute-context and Promise-rejection hooks recognize terminal
private failures. They need a distinct nonterminal transfer contract that does
not advance the throwing block, report a caught value as uncaught, or resume a
stale Promise. Unwinding must handle noncatching inner boundaries and active
finalizers in order; the preview conservatively refuses both cases today.

Only after deferred first-entry, managed calls, current frame installation,
yield settlement and Stop behavior have an actual engine contract should the
compiler introduce TryStatement lowering. Nested catch/finally, abrupt override,
return/jump propagation and cancellation then need real guest qualification.
The preview seam alone is insufficient to remove parser refusal.
