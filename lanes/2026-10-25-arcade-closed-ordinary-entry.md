# Closed ordinary procedure execution roots

Status: DONE implementation candidate; exact-head hosted, SDK/native and visible editor qualification pending.
Base: `7f9edea2cc648d7139d1f57099d5121361d48a01`.
Owner: Arcade integration, isolated source lane. Preserve the active Arcade
integration publisher and its Sprite factory/property proof.

Claim [#1398](https://github.com/CrispStrobe/brickwright/pull/1398) merged at
`d11627829b514398368a5e782e148f3386161983` before implementation, with all four
required checks successful and declared conditional skips. The source component
and actual project component each derive their own private current proof; no
caller metadata supplies unreachable owners. Project proof accepts owned frozen
JSON only. Complete actual Array storage writers can establish entry neutrality,
but never type, initialization or successful execution.

Twenty-one composed source controls pass. The affected source cohort has
seventy-five passes; counts overlap. Eleven source guard cuts and five project
guard cuts were detected across the retained cohorts; initial surviving cuts,
namespace-alias and malformed-shadow failures were retained and corrected.
Code reconstruction, three JSON generations, saved SB3 reopening and a separate
loop/math conversion pass. A retained sorting source now imports/reconstructs
cleanly and its retained project exports without unsupported diagnostics while
keeping every authored procedure. No aggregate or application completion is
claimed. Native helper lowering required no change for this bounded case.

Next: coordinate the active integration publisher, qualify one final exact head,
run the unchanged original/emitted MakeCode and native controls, verify visible
Code/Blocks and saved-project behavior, then measure the full corpus. Broader
callable/class/default/namespace entries and live Array read readiness remain
separate work; this proof conservatively declines those entry shapes.

## Problem and intended behavior

An uncalled ordinary procedure chain can supply an opaque argument to a shared
procedure and contaminate its reachable numeric callers. Existing source and
project checks consider every syntactic incoming call and Array writer.

Prove execution roots for a closed, unique, unchanged, unescaped set of ordinary
procedures. Omit runtime caller/effect obligations only for owners proved
unreachable from every actual entry. Preserve all procedure declarations,
signatures, bodies, expressions and output; no pruning, placeholders or invented
Number, Array allocation or initialization facts. A newly reachable call must
reactivate its obligations. Unknown entry or uncertain currentness keeps the
existing refusal. This is not general dead-code elimination.

## Exact scope

- New private `closed-ordinary-source-entry.js` and
  `closed-ordinary-project-entry.js` in `overlay/scratch-gui/src/lib/bw-makecode/`.
- `source-value-producers.js`: ordinary formal edge propagation and primitive
  constraint validation only; preserve the separately owned Sprite proof.
- `procedure-constraint-source.js`: bind ordinary selection/validation to actual
  current source roots; retain structural/signature/escape checks.
- `procedure-constraint-export.js`: actual current caller/writer obligations.
- `array-reference-export-authority.js`: procedure-owned runtime occurrences and
  reachable writer propagation; retain all live allocation/readiness checks.
- `native-array-binary-domain.js`: actual source caller/effect propagation only.
- `export-arcade.js`: consume the same current owner boundary at the existing
  obligation, Array expression and reconstructed-source validation sites.
- One new complete source/control test module, its exact GUI scope rows and
  Arcade handoff/next-steps/GUI gap documentation.

No vendor pin, runtime, firmware, SDK source, clock, test threshold, original
fixture or other active lane changes. Broader edits require an updated claim.

## Admission and controls

Derive facts from actual AST bindings and physical project owners/call edges,
with unique declarations, exact root/callback inventory and currentness. Caller
metadata, annotations or supplied callbacks cannot issue the proof. Dynamic,
foreign, malformed, duplicate, aliased, escaped and uncertain entries must retain
refusal or conservatively remain reachable. Supported event entries are roots.

Cover a live Number caller sharing a callee with an uncalled opaque forwarding
chain, and the sorting-shaped retained source with every unused function still
present. Test source import, Code/Blocks reconstruction, admitted JSON export
and repeated export/import with real project assets. Assert full bodies survive.
Activate the previously unused function, add a live String/Opaque caller, alias
or callback entry, mutate the graph, or add a mixed/foreign Array writer: checks
must reactivate/refuse. A live Array length read still needs actual allocation,
normal result, initialized receiver and all-writer proof. Meaningful mutations
must detect removal of root, binding, currentness and live-writer guards.

## Qualification and limits

Use bounded source controls first. One final exact-head hosted qualification
set, including affected original/emitted MakeCode and native execution, remains
required before landing source. Preserve original failures and all assertions.
No new application completion, visible editor result, physical claim or corpus
count reduction follows merely from clean conversion diagnostics.
