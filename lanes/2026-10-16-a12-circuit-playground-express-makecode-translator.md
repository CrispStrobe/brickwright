## A12 — Circuit Playground Express MakeCode translator — 2026-10-16

DONE — Codex CPX translator lane. [PR1009](https://github.com/CrispStrobe/brickwright/pull/1009)
merged as `e0b89072` on 2026-10-16, with reviewed source `16dda603`.
All 11 enabled exact-head checks passed; deploy and verify-gui were declared
conditional skips. Both complete unit shards passed, including all fifteen
CPX comparisons and the zero-raw-stdout census. Ten programs match exactly;
five separately named controls enforce both exact documented timing boundaries.
The complete actual CPX browser journey passed import, original-source export
and simulation, native Start, button A and Shake. The reviewed merge preserves
newer peer work, with landed parents and tree matching the prediction.
[Behaviour, evidence and limits](docs/A12-CPX-TRANSLATOR.md).

Own a new `overlay/scratch-gui/src/lib/bw-makecode/adafruit-translate.js`;
CPX-only target inference/import dispatch in that directory's `index.js`;
narrow CPX translated-view and named-export-refusal branches of
`components/tw-pseudocode/pseudocode-importer.jsx`; and exact tracked packages
mirrors. Existing translators, shared base/parser, conversion ownership,
Arcade resources and other owners' importer methods remain outside this claim.
Own focused CPX translator/inference/behaviour tests, the CPX section of
`scripts/makecode-census.mjs` and its generated census document, affected CPX
browser controls in the existing MakeCode verifier, and
`docs/A12-CPX-TRANSLATOR.md`. Preserve CPX MakeCode simulation and the pin bridge.
Also own only gesture/acceleration input injection in the existing
`scripts/lib/{makecode-adafruit-sim,cpx-extension-run}.mjs` test helpers, so the
same scheduled inputs reach each original device implementation. Existing
clock, snapshots and sound decoding remain unchanged. Ten comparisons require
exact equality; five named runtime-boundary tests assert both exact recorded
sides at five exceptional frames and two tone sequences, with equality at all
other captures. These explicit limits do not claim timing parity. Existing
CPX event hats are preferred to invented polling when they express the source
handler exactly; dynamic registration and unsupported event semantics stay
named refusals.

Acceptance: reproduce the hint-less inference defect first; account for all
149 pinned pxt-adafruit docs programs without silent call loss; compare at least
ten translated programs against the actual target simulator; preserve adjacent
target inference; refuse CPX re-export by name until its emitter is separately
qualified. Name polling/event and newer-API limits. Reuse existing 45 device
words; missing supplier words require separate upstream work. No firmware
execution, engine/package pin, workflow budget or threshold change. Land this
claim before implementation; require fresh affected browser qualification and
all enabled final-head checks before source merge. Preserve every other lane.
