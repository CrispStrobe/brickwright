# Kosmos CP1 editor and front-panel contract

The CP1 panel displays one machine owned by the debugger. It does not create a
second CPU, execute teaching-language opcodes, synthesize a display from the
source, or fetch a monitor ROM. Source assembly comes from the independently
authored `sb3-creator/src/utils/cp1Program.js`, synced to `lib/cp1-program.js`.

## Component boundary

`components/tw-pseudocode/cp1-panel.jsx` accepts these props:

| Prop | Meaning |
| --- | --- |
| `snapshot` | Detached engine observation. The host owns its refresh rate. |
| `machine` | Optional read-only fallback: `snapshot()`, or `getDisplay()` and `readCell()`. The panel polls reads only. |
| `running`, `expansion`, `clockHz` | Current host execution/configuration state. Default clock is 6 MHz; expansion determines 128 or 256 cells. |
| `source`, `onSourceChange(text)` | Controlled source text. Changes are reported immediately, including incomplete syntax. |
| `romReference` | Optional `{sha256, byteLength: 2048, name?}` metadata; never ROM bytes. |
| `onKey(key, down)`, `onReleaseKeys()` | Logical matrix contacts and complete release. Digits are strings `0`–`9`; function names are uppercase. |
| `onRun()`, `onPause()`, `onStep()`, `onReset?()` | Host CPU controls. `onStep` advances one 8049 instruction, separate from keypad STEP. |
| `onLoad(assembly, {source, clear: true})` | Atomically load a successful assembly. `assembly.words` contains `{address, opcode, operand, line, column}` entries. |
| `onWriteCell?(address, {opcode, operand})` | Optional paused RAM editing. Both cell bytes may be 0–255. |
| `onPortInput?(name, value)` | External input byte for P1, or P3 when expanded. |
| `onImportRom?({bytes, name, reference})` | Explicit local file import, 2048 bytes. If absent, the panel dispatches the existing media-load event. |
| `onSaveProject?(project)` | Optional host export. If absent, uses the existing app download helper. |
| `locale`, `colorMode` | English/German interface copy and light/dark styling. |

The fallback ROM event is `bw-machine-media-load` with detail
`{kind: 'cp1', slotId: 'rom', bytes, name}`. It occurs only after the user chooses
a local file. No default firmware image is packaged or downloaded.

Expected snapshot fields are `display`, `ports`, `cells`, `cpu`, `expansion` and
optional ROM metadata. `display.digits` contains six active-high segment masks,
physical left to right, bits a/b/c/d/e/f/g/dp. The fixed separator arrives as the
third digit's dp bit. The panel renders those bits directly, including blank or
nonnumeric monitor patterns. CPU PC/A/PSW/cycle values are labeled as 8049 state.
They are not presented as the CP1 teaching-program PC or accumulator.

## Key lifetime

`lib/cp1-panel-input.js` declares 30 physical buttons and 20 logical contacts.
The two sets of digit buttons share contacts. Pointer, keyboard and assistive
click owners are tracked independently. A contact opens only when its final
owner releases it. Repeat keydown does not create another owner. Pointer up,
pointer cancel, lost capture, leaving the panel, window blur, hidden documents,
pause, machine replacement and unmount all release the appropriate inputs.

Keyboard shortcuts operate while the panel has focus and ignore source/input
fields and browser modifier shortcuts. Digits map directly; Enter maps RUN,
Escape STP, Backspace/Delete CLR, and F1–F10 the function row. Enter/Space on a
focused keypad button operates that button; ordinary controls keep native
activation. The keypad's physical function names remain CAS, CLR, PC, ACC, CAL,
STEP, STP, RUN, OUT and INP.

## Persistent data

`lib/cp1-project.js` separates a complete program export from editing state.

`brickwright.cp1-project`, version 1, stores `target: kosmos-cp1`, explicit
`configuration`, a nullable ROM digest reference, `source`, and sparse `words`
containing only address/opcode/operand. Source and words must agree when source
is present. A source-free manual RAM image may contain arbitrary bytes. Base
addresses are 0–127; CP3 addresses are 0–255. JSON, source, names and collections
are bounded. Extra fields, duplicate addresses, unsupported versions and embedded
ROM content are rejected.

`brickwright.cp1-workspace`, version 1, stores only configuration, ROM reference
and source. Its validator preserves incomplete or invalid source so ordinary
saving cannot discard a line being edited. It does not create a runnable word
image. Normal projects and workspaces accept no held keys, live CPU state,
debugger resume snapshots, ROM bytes, URLs or prototype fields. Session save
states belong to the engine's independent debugger contract.

## Learning and verification

`lesson-waves/cp1-8.json` contains eight original English/German lessons. Their
checkpoints use manual completion for conceptual reasoning and observations;
opening a panel, loading cells or clicking an input is not claimed to prove a
correct display or output waveform. Timing copy separates requested delay from
measured period and permits an explicit unavailable measurement when no suitable
trace exists. ROM-dependent behavior requires a user-provided compatible image.

Run the focused source suites with:

```sh
node --test --import ./scripts/lib/register-gui-scope.mjs test/cp1-project.test.mjs test/cp1-panel-input.test.mjs test/cp1-lessons.test.mjs
```

These tests cover data boundaries, real key-ownership callbacks, raw segment
preservation, read-only snapshot access, lesson locality and honest observation
metadata. The upstream assembler suite additionally checks exact example bytes,
range/duplicate diagnostics, sparse listings and source-map round trips. Full
React/browser and circuit proofs are separate integration gates and must not be
inferred from passing parser or helper tests.
