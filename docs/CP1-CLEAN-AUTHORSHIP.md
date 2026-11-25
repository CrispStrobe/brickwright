# CP1 editor, examples and teaching content: authorship record

Authored 2026-11-24 for Brickwright. The parser, project schema, panel, key-owner
helper, three CP1 example programs and eight bilingual lessons were written
independently for this implementation.

Factual inputs were the documented CP1 opcode/cell/port facts supplied in the
task and the separately authored hardware module's interface contract. The
hardware work reported the primary-schematic display order and separator
wiring; this view consumes those raw segment masks without numeric decoding.

Repository conventions consulted were Brickwright's controller panel, Arduboy
pane, localization and download helpers, gallery index/fixture structure,
ordinary button/resistor/LED/ground connector contracts, project tests and the
existing lesson JSON format. These informed integration and styling only.

No asig or lambdamikel CP1 emulator implementation, GPL CP1 emulator source,
third-party assembler implementation, or prohibited local CP1 reference tree
was opened or reused in this work. No monitor ROM was bundled, translated,
reconstructed or automatically fetched. Example programs and English/German
instructions are new text, not copied listings or manual exercises.

The parser's separate upstream record is
`sb3-creator/reference/cp1-program-format.md`. This authorship record covers the
editor/content contribution; the CPU and peripheral contributors maintain
their own primary-source and implementation records.

## 2026-11-25 continuation

Fresh independent contributors authored the semantic observer/debug target and
CP5-style example without receiving GPL emulator code, translated algorithms or
reference implementation structure. The semantic profile uses hash-specific
hardware facts and observed outcomes from original experiments on the independently
authored machine. The implementation does not decode or translate historical ROM
instructions into a separate teaching-language interpreter.

The coordinator supplied a separately held 2048-byte monitor image to optional
acceptance tools. Only behavioral observations, exact ROM identity and source
hashes were retained in reports. Historical bytes remain external and are absent
from all four repositories and their package dependencies. The optional scripts
accept a user's local file and do not fetch it.

The CP5 workbench uses ordinary circuit components and newly written bilingual
instructions/programs. It is a simplified 5 V educational circuit; no original
scanned artwork, manual listings or power-rating claims were imported. New UI
source matching, lesson events and the two additional lessons were written from
the independent engine API and actual circuit observations. Browser fixtures
use short original synthetic firmware and preserve that distinction from
historical-monitor acceptance.
