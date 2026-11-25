# Arcade source startup and loops

MakeCode source startup imports as `WHEN arcade source starts:`. Source `while`
and `for` loops import as `arcade repeat while CONDITION:`. These are genuine
Arcade hat and loop blocks, available to Code and Blocks authoring through the
shared dialect. Ordinary Scratch green-flag and control blocks retain their
existing identities.

The source loop reevaluates its positive Boolean condition on every iteration.
It preserves changing bounds, expression initializers, multiple declarations,
omitted tests and break guards. It exports a TypeScript `while` loop without an
invented `pause(20)`. Stock Scratch loops continue to use their existing exporter.
Source startup queues after the Arcade extension resets its run state; the body
runs after the VM finishes green-flag initialization.

## Qualification boundary

Five focused controls pass, including unchanged original/native variable values,
Code decompilation, fresh SB3 reload, original compiler/runtime execution of the
export and reimport. Five importer line/decompiler checks and eight existing
legacy scroller, character-animation and SpriteKind roundtrip controls pass on
the updated consumer. The shared producer adds two explicit forms and reports
620 passing checks without skips. A hosted signature-dependent census failed;
its AST method locator repair preserves the rule floor and passes twelve command
census and ninety-three Boolean value controls. Hosted checks are separate.

These controls establish graph structure and eventual loop results. They do not
establish exact original frame scheduling for finite loops that draw, mixed
ordinary/source threads, scene replacement, debugger suspension or the physical
GUI cadence. Those requirements belong to the
[frame scheduler lane](https://github.com/CrispStrobe/brickwright/pull/881). Its diagnostic prototype
must be integrated and qualified through actual consumer, GUI and original
runtime controls before a full-game promotion. Unknown or unsupported loop
expressions remain reported rather than silently replaced.


### Required phase qualification

Set `BW_REQUIRE_EXACT_ARCADE_PHASE=1` for the kind, custom terminal and native
text-dialog tests. This turns the preserved strict timing/pixel TODO checks into
required failing checks until the scheduler is fixed. Existing assertions and
original capture events remain unchanged. A default test run with TODO results
cannot establish exact phase compatibility.

## Loop exits

Arcade imports lower `break` and `continue` before lazy expressions. Hygienic
invocation cells hold each loop's exit state, including recursive and overlapping
function calls. Every nested `if` or block guards statements after an exit. A
`for` update executes after `continue` and is skipped after `break`; for-of keeps
its array alias and reevaluated length. Nested loops and functions own their
exits. Nonfallthrough switches have independent break cells, while `continue`
reaches the enclosing loop. Unsupported switch fallthrough remains diagnosed.

Focused original/native controls compare results through Code, blocks, saved
SB3 reopening, executed original export, and reimport. They cover nested exits,
side effectful conditions and updates, mutable for-of arrays, switch boundaries,
recursive and overlapping invocations, and generated-name collisions. This
lowering does not change the other MakeCode target translators or establish
frame scheduling parity.

### Selected SDK do-while boundary

The parser retains explicit original do-while body and condition metadata.
Arcade consumes it before namespace and lazy-value lowering: the first body is
unconditional, `continue` evaluates the posttest once, and `break` skips it.
Other target translators keep their existing body-plus-tail lowering.

The selected original SDK compiler instead jumps a do-while `continue` directly
to the body, skipping the posttest. A bounded authored safety-break control
retains this original-source discrepancy as a failing TODO. Native standard
semantics are not claimed equivalent to that compiler bug. Native export uses
normalized `while` and invocation-cell guards; executing that export in the
original compiler/runtime must match native results. No unbounded original
probe or silent bug emulation is needed for these controls.

Imports containing a continue owned by do-while carry a named source warning
for the qualified pxt-arcade 4.2.1 / pxt-core 13.2.1 pair. It appears in the GUI
import status, CLI notes and editable Code comment. The warning does not block
native authoring or normalized export. Nested loop/function continues do not
receive it, and normalized reimport has no original do-while continue warning.
