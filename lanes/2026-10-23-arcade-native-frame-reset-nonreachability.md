# Arcade native-frame entry-reset nonreachability — claim

Status: implemented after claim #1283 merged. Independent source review and
all 11 whole-module source controls passed at
`41b8c0dce0e379bba7530a692b192c10689673c7`, including four immutable
built-in kind literals. The exact captured-input source receiver check passed
at `4a5d5e6574d874b35c75fcaecaf711430677bf9b`. Final-head hosted/native/GUI qualification remains
pending; no runtime, GUI or application completion is asserted.
Owner: Arcade integration. Isolated branch:
`lane/arcade-native-frame-reset-claim-20261023`.
Base: `95b5b97034058abffe5b2e8746581ee64e23691c`.
Continue the same owner's Array authority work after the lexical-frontier
candidate in [PR #1128](https://github.com/CrispStrobe/brickwright/pull/1128).
That candidate is not asserted as merged or fully qualified. Preserve every
other owner's source, pending checks and original failures.

## Problem and resulting behavior

The owned numeric authoring journey exports a source-start procedure whose
local first receives null, then a genuine Array allocation after background,
Sprite, scalar and loop setup. Two pushes and a same-key StringArray settings
write/read follow. The retained exact input and semantic result confirm two
initialized-producer/all-writer refusals. They do not identify every internal
predicate or prove a unique cause. Existing reset proofs stop before this
prefix, so the entry reset can remain a possible non-Array writer.

Implement an additive proof that the entry reset cannot reach the relevant
read on any normal path through an independently verified later overwrite.
This proof may discard only that actual reset writer. It supplies no Array,
element, input, type or initialized-value fact: actual allocation and every
remaining writer still decide those obligations.

## Exact implementation envelope

Production paths under `overlay/scratch-gui/src/lib/bw-makecode/`:

- `array-reference-export-authority.js`: integrate an additive reset proof;
  retain existing four reset routes and their original predicates.
- New `array-native-frame-reset.js`: privately held current-frame, full-prefix
  effects and nonreachability proof, with no public input certificate.
- `array-definite-overwrite.js`: only if needed to share the existing branded
  owned-graph/frame admission; preserve all old proof bodies and behavior.

Add complete `test/array-native-frame-reset.test.mjs`; preserve original Array,
SDK and numeric browser assertions. Add self-contained capability/acceptance
notes in `docs/ARCADE-NATIVE-FRAME-RESET.md`,
`docs/ARCADE-COMPATIBILITY-NEXT-STEPS.md` and
`docs/CONVERSION-CAPABILITIES-AND-GUI-GAPS.md`, and update this claim's status.
Read actual adopted VM/Arcade runtime implementations to establish effects;
those runtime files are outside the edit envelope. No parser/class/emitter,
supplier, dependency pin, workflow, browser fixture, policy or public diagnostic
API changes. Stop for an exact amendment if another capability/path is needed.

## Required proof boundary

Bind the actual local cell, owned physical procedure body, current zero-argument
source-start caller, native fresh params frame and complete caller census.
Entry reset and later overwrite must refer to that same cell. Reject omitted,
extra, dynamic, callback, recursive or reentrant entries unless separately proved.

Audit the entire prefix and every argument evaluation against actual runtime
contracts. Background/Sprite/Math/scalar/loop operations qualify only where their
actual behavior cannot read, publish or mutate this frame. Numeric results or
an opcode name alone do not establish effect safety. Account for coercion,
prototype writes, getters, callback/event registration, yield and existing
handlers. Preserve refusal when any required effect remains unproved. A loop
need not terminate to prove a normal path reaching the later overwrite, but
all condition/body paths, returns and callback exposure remain obligations.
Earlier source registrations cannot disappear from the effect census.

Require independently established owned-JSON admission and current physical
binding identity. No temp-name, annotation, destination socket, renderer label,
observed saved value, source flag or caller assertion grants authority. Retain
currentness observations and permanent expiration after an observed mutation,
reflection failure or restore/ABA. Do not globally ignore null/undefined,
weaken adjacency in old routes or infer settings presence from Array identity.

## Complete acceptance and controls

Build a public regression from the existing self-authored numeric journey or
actual Creator API, with real local null reset, full intervening setup, fresh
allocation, Unicode/String pushes and same-key StringArray read/index. Test
alpha-renamed locals and each prefix effect as well as their whole composition.
Keep genuine producer and every-writer checks separate from reset reachability.

Pair positives with reads before overwrite and in RHS, non-dominating writes,
branch/loop paths, frame capture/publication, prior registrations, foreign
callbacks/extensions, dynamic/prototype names, omitted/extra/reentrant callers,
second unsafe writer, active monitors, malformed physical edges/menus,
currentness edits/ABA and reflection errors. Keep settings wrong-key/type,
intervening remove/clear/write, absent-key and element-presence negatives.
Detect meaningful mutations removing identity, effect or dominance guards.

Qualify affected clean guest/browser behavior on the final source head, including
unchanged Code/Blocks/current export/reimport/save/reopen and actual numeric
authoring assertions. Focused source tests alone do not establish runtime,
GUI or application completion. Reassess genuine complete corpus inputs before
claiming any reduction from the historical 36 partial applications.
