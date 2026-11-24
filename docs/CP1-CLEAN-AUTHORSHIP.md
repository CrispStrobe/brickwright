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
