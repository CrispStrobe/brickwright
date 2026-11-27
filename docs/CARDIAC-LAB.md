# CARDIAC Lab

CARDIAC connects a small decimal program to an observable machine, an optional
circuit experiment, and a guided lesson. The Code editor, Controller view and
debugger share one machine. A circuit attachment uses the machine already in
the selected CARDIAC part.

The historical Bell Laboratories CARDIAC was a cardboard teaching computer
operated by a person. Brickwright models its instruction-level behavior. The
electrical terminals, simulation rate and circuit adapter are modern additions;
they are not historical CARDIAC hardware specifications. The implementation
uses the explicitly named **Brickwright CARDIAC v1** contract below.

## Start with Code and Controller

1. Open **Code** and choose **CARDIAC** in the language row. This creates a
   standalone decimal target when no CARDIAC circuit part has been selected.
   No MCU, firmware image or compiler server is required.
2. Choose **A number makes a round trip** from **Example program**. The Code
   picker replaces the editable source and input-deck draft; loading remains
   an explicit action.
3. Choose **Assemble & load**. A successful load installs a fresh initial image,
   pauses execution and clears runtime input/output trays. Errors identify a
   source line and column and leave the accepted machine image intact.
4. In **Controller**, inspect the input deck, choose **Queue cards**, and press
   **One instruction**. For the supplied `042`, `INP 80` writes cell `80`,
   `OUT 80` emits `042`, and `HRS` halts. The accumulator stays zero.
5. For a fresh complete run, use **Run source + cards** in Code. It validates
   the source and, in Manual cards mode, the deck before replacing the machine,
   queues that deck once, and starts the shared runner.

**Continue** operates on the current loaded machine. It does not assemble the
draft, restore the initial image or repeat an input deck. **Reset loaded
program** restores the last accepted initial image and pauses. **Assemble &
load** and **Run source + cards** use the current source draft.

The dedicated source format supports the ten CARDIAC mnemonics, labels, `ORG`,
`ENTRY`, `DAT`, decimal listings, comments and checked label expressions. The
default address is `01`, leaving fixed cell `00` alone. An input deck is a
separate sequence of signed decimal values, not an addressed memory listing.
See the [pinned source-format contract][assembler-contract] for the grammar,
diagnostics and limits. There is no general Scratch/Python/C-to-CARDIAC compiler.

The Examples gallery also contains the six CARDIAC programs. Gallery loading
routes their `files.cardiac` sources and input decks through the CARDIAC host;
it does not create a generic MCU bench. The night-light entry additionally
loads its circuit. Opening an example does not automatically run it.

## Observe and predict an instruction

The Controller view shows decimal PC, accumulator, instruction register,
completed-instruction count, input queue, output tray and all 100 memory cells.
Selecting a cell exposes its live value, a paused live-memory edit, **Set PC**
and **Toggle breakpoint**. Cell `00` cannot be overwritten. Breakpoints stop
before execution; a deliberate single step can execute the selected instruction.

The last-instruction view reports the actual fetched word, PC and accumulator
changes, memory reads/writes, consumed card, output and branch decision. The
memory grid marks the current PC and the latest reads/writes. It does not run
instructions while rendering.

In **You are the processor**, enter a predicted next PC and accumulator, then
choose **Step & compare**. Feedback compares those values with one actual
completed instruction. If the machine is waiting and no instruction completes,
it reports that condition instead of awarding a correct prediction. This
exercise is separate from guided-lesson completion.

Source correspondence is checked against the live word at the current PC. An
unloaded edit or self-modifying `STO` can make the source listing differ from
memory. In that case the UI displays the mismatch and does not highlight a
source line as an exact match. The live memory remains the execution authority.

### Waiting for input

An empty `INP` waits at the same PC without changing IR, memory or the completed
instruction count. It does not manufacture a zero.

In the full lab, input wait pauses the shared debugger runner. **Queue cards**
or **Sample circuit once** supplies input; choose **Continue** to resume, or
**One instruction** to consume it deliberately. Changing the deck text alone
does not queue anything.

The compact circuit panel can also run a part without an attached debugger. A
directly running Board device remains armed while waiting and resumes when a
card is supplied. When the debugger owns it, its pause/continue boundary applies
to that same machine. The difference is scheduling ownership, not a second
instruction dialect.

## Connect a circuit

In Circuits, place **CARDIAC + Brickwright I/O adapter** from Boards, or open
the **A transparent night-light** gallery example. The compact instrument panel
offers Run, Pause, Step, Restart, starter images and **Open CARDIAC lab**.
Opening the full lab selects this part's existing Board machine; it does not
create another computer behind the display.

| Terminal | Modern adapter behavior |
| --- | --- |
| `IN` | Explicitly sample the most recently solved voltage relative to `gnd`. Clamp to 0–5 V and queue `round(voltage × 999 / 5)` as one card. |
| `OUT` | Latch a nominal 5 V drive only when the most recent output word is `001`. Every other word drives 0 V. |
| `5v` | Simplified 5 V supply for the experiment. |
| `gnd` | Electrical reference and return. |

The full signed output still appears in the numeric tray, including words that
drive OUT low. Clearing that tray does not change the output latch. Input has a
33 kΩ pull-down; the output model uses 220 Ω for its high drive and 10 Ω for
its low drive. These are teaching-interface choices. Use an external series
resistor for the LED. The [pinned circuit contract][circuit-contract] and
[engine adapter contract][engine-contract] specify the electrical model.

Choose **Manual cards** to submit a numeric deck or **Circuit adapter** to take
one explicit sample. Queue entries retain their manual/circuit source labels.
Changing a potentiometer, switching an input selector, viewing memory or
refreshing the screen does not generate cards. Sampling does not execute an
instruction or update OUT by itself.

### Night-light experiment

The authored circuit contains a CARDIAC adapter, a potentiometer representing a
light-level signal, a 1 kΩ resistor and a yellow LED. Six editable wires connect
the power rails, potentiometer wiper to IN, and OUT through the resistor and LED
to ground. The program uses entry `01` and data cells `80`–`84`.

For a numeric trial, select Manual cards and run the supplied deck
`200, 500, 800, 300`. The output is `001, 000, 000, 001`, then input wait. The
threshold is strict: a sample below `500` lights the LED; `500` and above turn
it off.

For an electrical trial, select Circuit adapter, use **Assemble & load** for a
fresh empty queue, adjust the potentiometer, and choose **Sample circuit once**.
Read the sampled card and input voltage, then choose **Continue**. The engine
executes the comparison, emits a word, updates its latch and drives the solved
LED branch. Repeat at another knob position. Use the measured card rather than
assuming the knob's fraction is the voltage fraction: the circuit includes
electrical loading. A paused input change must leave the output unchanged until
the next sample is consumed and an `OUT` executes.

The full Code editor can retain an earlier draft when a circuit part is opened.
The handoff adopts the part's accepted image and live state; it does not silently
replace that draft with inferred assembly. The dirty indicator and live/source
mismatch report keep those states visible. The gallery night-light entry supplies
the matching authored source explicitly.

## Drafts, accepted programs and saved projects

| State | Meaning | Saved with the CARDIAC workspace? |
| --- | --- | --- |
| Source draft | Editable text, including unfinished or invalid source. | Yes. |
| Input-deck draft and selected input source | Text to queue deliberately later; manual/circuit choice. | Yes. |
| Accepted initial image | The last successfully loaded `{words, entry}` program. | Yes, independently of the draft. |
| Selection state | Whether CARDIAC was active when the workspace was saved. | Yes. |
| Live memory, PC, accumulator, queued/consumed cards and outputs | Results of execution and live edits. | No. |
| Running clock or held controls | Transient execution activity. | No. |

**Save workspace** downloads `cardiac.bwcardiac.json`. **Open source /
workspace** reads that format or a `.cardiac`/text source file. Opening source
text edits the draft; it does not imply an accepted machine load. **Export
listing** exports the valid assembled draft as reparsable decimal source, not a
snapshot of self-modified RAM.

The normal project `.sb3` bundle carries an optional, validated CARDIAC section
alongside the circuit and other project state. A circuit part also stores its
accepted image in `params.program`. A successful host load synchronizes that
image back to the circuit. Repeated equivalent saves do not reset PC or erase
runtime stores.

Reopening restores the authored image paused, with fresh runtime state. It
preserves a draft that differs from that image, including unfinished source and
deck text. Runtime state is not replayed. Project selection first respects a
restored CP1 part, then a CARDIAC part; standalone CARDIAC is restored only when
its saved active flag is true. Merely retaining an old CARDIAC draft must not
take over a later project for another device. Leaving CARDIAC preserves its
draft and clears its active selection.

## Six examples and six bilingual lessons

The programs and English/German introductions are original Brickwright material.
Their canonical sources come from `sb3-creator`; they are not converted generic
pseudocode examples.

| Example id | Main idea | Input | Expected numeric output | End |
| --- | --- | --- | --- | --- |
| `cardiac-echo` | Input, address and value | `042` | `042` | HRS |
| `cardiac-add` | Accumulator, store and output | `017 025` | `042` | HRS |
| `cardiac-countdown` | Zero is not negative | `003` | `003 002 001 000` | HRS |
| `cardiac-night-light` | One decision per sample | `200 500 800 300` | `001 000 000 001` | Input wait |
| `cardiac-bootstrap` | A program loads another program | Supplied strip, ending with `035` | `042` | HRS |
| `cardiac-self-modify` | An instruction is writable data | None | `011 022 033` | HRS |

The bootstrap starts at fixed cell `00`. Its input strip constructs a loader,
writes an add-seven payload at `20`–`25` plus data at `81`, transfers to that
payload, and supplies `035`. The self-modification example changes the OUT
instruction at `10` from `580` through `581` and `582`; it leaves `583` in memory
after the final, unexecuted patch.

Open **Lessons** and choose the CARDIAC sequence:

| Lesson | German title | Example |
| --- | --- | --- |
| You are the processor | Du bist der Prozessor | Echo |
| A calculator that remembers | Ein Rechner mit Gedächtnis | Addition |
| Zero chooses a different path | Null nimmt einen anderen Weg | Countdown |
| A number controls a light | Eine Zahl steuert ein Licht | Night-light and circuit |
| A program loads a program | Ein Programm lädt ein Programm | Bootstrap |
| The instruction in RAM changes | Der Befehl im RAM verändert sich | Self-modification |

Each lesson has three bilingual checkpoints: predict, observe, then explain or
transfer the idea. All **18 checkpoints use explicit manual acknowledgement**.
They do not mark completion merely because a source contains a mnemonic, an
example was opened, or an expected result is written in a document. The live
Step & compare exercise can check a particular PC/accumulator prediction; it
does not automatically certify the lesson's explanation or completion.

## Execution contract and historical boundaries

The model identifier is `brickwright-cardiac-v1`. The authoritative contract and
testable software conventions live in [bw-board's CARDIAC documentation][engine-contract].

| Opcode | Instruction | Effect |
| --- | --- | --- |
| 0 | INP | Consume a card into memory. |
| 1 | CLA | Load a memory word into ACC. |
| 2 | ADD | Add a memory word to ACC. |
| 3 | TAC | Branch only when ACC is negative. |
| 4 | SFT | Shift decimal digits left, then right. |
| 5 | OUT | Emit a memory word. |
| 6 | STO | Store ACC's signed low three digits. |
| 7 | SUB | Subtract a memory word from ACC. |
| 8 | JMP | Write a return instruction at 99, then jump. |
| 9 | HRS | Halt and set PC to its operand. |

Addresses are decimal `00`–`99`, memory words are `-999`–`999`, and ACC is
`-9999`–`9999`. Fetch advances PC modulo 100 before the instruction acts. ADD
and SUB retain the signed remainder modulo 10000. STO retains the signed
remainder modulo 1000. For instruction word `4LR`, SFT multiplies by `10^L`,
keeps the signed four-digit remainder, then divides by `10^R` with truncation
toward zero.

Cell `00` is fixed at `001`; instruction writes to it are ignored, although
`INP 00` still consumes a card. Cell `99` initially contains `800` and is fully
writable in v1. JMP writes `800 + nextPC` there before transferring to its
already-fetched operand. TAC does not write a link. Negative instruction words
retire as skipped instructions. HRS preserves memory, ACC and trays; host Reset
restores the accepted initial image. These named software conventions must not
be presented as agreement among every historical or modern implementation.
The alternate Kaleberg numbering swaps opcodes 0 and 9 and is not auto-detected.

### Sources and independent authorship

Historical references used by the owning engine:

- [Bell Laboratories CARDIAC instruction manual, Drexel scan](https://www.cs.drexel.edu/~bls96/museum/CARDIAC_manual.pdf).
- [Bell Laboratories Record, July 1969 CARDIAC article](https://cs.drexel.edu/~bls96/museum/cardiac.pdf).
- [Drexel Computer Museum technical description](https://www.cs.drexel.edu/~bls96/museum/cardiac.html).
- [Smithsonian collection record](https://americanhistory.si.edu/ne/collections/object/nmah_1465426).

Comparisons considered include [StrangeQuery/heartburn](https://github.com/StrangeQuery/heartburn),
[jawhitti/Cardiac](https://github.com/jawhitti/Cardiac),
[fzaca/CardiacVisualizer](https://github.com/fzaca/CardiacVisualizer) (formerly
Xukay101), [cinc/jcinc](https://sourceforge.net/projects/cinc/),
[Kaleberg CARDIAC](https://www.kaleberg.com/software/cardiac/) and
[Al Williams's spreadsheet project](https://hackaday.io/project/197615-cardiac-paper-computer-spreadsheet).
They helped identify differences worth specifying and testing. The engine
contract records the comparison and licensing observations. The cited Dr.
Dobb's archive and FPGA details were not directly verified and are not
implementation evidence for this feature.

The new core, adapter, assembler, UI, connector SVG, examples and lesson copy
were independently authored. No comparator emulator/assembler code, historical
manual pages, cardboard artwork, ROM, HDL or historical sample listing is
bundled by the CARDIAC addition. New engine and Circuit UI JavaScript sources
carry MIT SPDX headers; the assembler and Brickwright additions carry
BSD-3-Clause headers. Existing unrelated licenses, notices and asset records
are retained. Circuit UI has a pre-existing metadata inconsistency: its
[`LICENSE`](https://github.com/CrispStrobe/bw-circuit-ui/blob/42aaddc8aaa93b4f584b2e9d81303b2673fdb9a5/LICENSE)
is MPL-2.0 while its
[`package.json`](https://github.com/CrispStrobe/bw-circuit-ui/blob/42aaddc8aaa93b4f584b2e9d81303b2673fdb9a5/package.json)
declares MIT. CARDIAC does not resolve that inconsistency or establish a
repository-wide MIT license claim.

## Supplier revisions and adoption review

### Review candidate and ownership

The 2026-11-26 implementation is a review candidate on
`feat/cardiac-lab-20261126`. The supplier changes are published as draft pull
requests. Brickwright owns the Code/Controller host, shared-runner integration,
project persistence and lesson registration; the supplier boundaries below own
their reusable implementation.

Automatic approval review rejected direct default-branch pushes during claim
publication. This lane therefore records candidate ownership, not a landed
default-branch claim. Default-branch publication and merges remain unapproved;
the local results below do not change that approval state.

The feature candidates use these exact published revisions; `vendor-pins.json`
and the package lockfiles remain the build authority:

| Supplier | CARDIAC revision | Draft review | Boundary |
| --- | --- | --- | --- |
| `bw-board` | `0f6b38a8d6d3b15861ee7b35eda45e5db45035f2` | [PR 777](https://github.com/CrispStrobe/bw-board/pull/777) | Machine, Board adapter and debug target. |
| `sb3-creator` | `fd5ea63fc4bda8696fbe6c672b4f11c1c8171d12` | [PR 243](https://github.com/CrispStrobe/sb3-creator/pull/243) | Assembler, decks, examples and gallery metadata. |
| `bw-circuit-ui` | `42aaddc8aaa93b4f584b2e9d81303b2673fdb9a5` | [PR 182](https://github.com/CrispStrobe/bw-circuit-ui/pull/182) | Original circuit part, compact controls and host notifications. |

The Circuit UI's actual npm-installed Board package was compared with the
identified clean source runtime. Its runtime SHA-256 is
`3b5eb5ea51549df034daf2e91ed3d96668a40c8f7d0dd9560661c348ad8ff120`.
Its focused provenance check rejects a different loaded tree or a dirty
development link. A successful local check does not establish hosted CI or a
deployed build.

These candidates were built on current upstream bases. Advancing Brickwright's
older pins therefore also adopts work that predates CARDIAC:

| Supplier | Existing root pin → upstream base | Baseline delta, before CARDIAC |
| --- | --- | --- |
| Board | [`cc18f3c8` → `de8083c5`][board-adoption] | 18 commits; 42 files; +4,249 / -46 lines. |
| Circuit UI | [`0a1b15ed` → `ee2b4127`][cui-adoption] | 19 commits; 27 files; +1,693 / -263 lines. |
| Assembler/examples | [`1c29f69f` → `8aa66c50`][sb3-adoption] | 33 commits; 472 files; +23,362 / -607 lines. |

The Board baseline includes KIM-1/NMOS-6502, its authored monitor, tape,
expansion/peripheral/storage support and tests. It also changes shared analog
behavior: LM358/LM324 input bias/offset currents, 555/556 rail clamps, treatment
of open transistor leads, optical receiver current reporting, and an RF
integrator consistency fix. Shared SD SPI write handling and floppy sector-base
support change as well. Those are broader physics/storage changes and deserve
their upstream qualification; the CARDIAC LED test does not requalify every
affected circuit or machine.

The Circuit UI baseline adds KIM-1 controls, art, tape/storage/expansion/video
surfaces, qualification scripts and tests, and changes the warning chip to
distinguish informational findings from warnings/errors. These are retained
upstream features, not work authored for CARDIAC.

The `sb3-creator` baseline has no changes under `src/utils`. Its larger diff is
gallery/generator/test work: 27 new entries take the gallery from 773 to 800,
including Microtronic and KIM-1 wired I/O plus 25 analog, optical, temperature,
timer and radio experiments. It updates 323 `EXPECTED.md` files, mostly engine
provenance with some measured expectations, and changes two existing circuit
JSON files (`lab-opamp-meter-stages` and `lab-transistor-thermometer`). The
op-amp example removes its substitute bias-current source now that the engine
models the chip's own bias. Generator ownership, fixture pins, measured
threshold annotations and CP1 verification documentation also change. The six
CARDIAC entries are an additional feature delta, bringing that base to 806.

Counts above come from complete local Git diffs. The GitHub comparison endpoint
returns only the first 300 changed files for the large examples comparison.
The comparison links are review boundaries, not evidence that every adopted
baseline behavior was re-tested by this feature's focused gates.

## Qualification snapshot, 2026-11-26

The Board and Circuit UI receipts use the exact runtime pins above. The GUI
and browser receipts initially used assembler candidate
`94e48cf1d32e4c2fd89a2894ff383c9cc588a6b5`; its replacement
`fd5ea63fc4bda8696fbe6c672b4f11c1c8171d12` repairs CI inputs, parameter checks
and provenance text while leaving `src/utils` and every CARDIAC program, deck
and circuit unchanged. Final source sync/pin checks and the full GUI rebuild
are separate from those earlier interaction receipts. The named logs and
generated browser directories are retained in the review workspace; they are
evidence from these runs, not committed build artifacts or hosted CI receipts.

| Check | Observed result | Evidence |
| --- | --- | --- |
| Root CARDIAC source, routing, bundle, host, debugger and lesson tests | 38 passed; no failures or skips, using the installed packages. | `cardiac-root-final-tests.log` |
| Final producer sync and SPIKE compatibility | Seven checks passed at `fd5ea63f`: 23 distinct vendored source files match their pinned transforms; 24 mappings have zero declared deltas; the real SPIKE compiler artifact passes. | `cardiac-final-supplier-gates.log` |
| Installed package bytes | Board's 13,773 packed files and Circuit UI's 1,488 packed files match their pinned Git/npm-pack contents at both root and GUI install locations. Both locations also pass single-engine resolution. | `cardiac-installed-proof.log` |
| Full GUI production build at the final supplier pins | After the final compiler/gallery sync and integration, `npm run build:gui` exited 0 through its normal preflights and webpack build. Webpack reports one pre-existing Microtronic CSS/autoprefixer warning. | `cardiac-final-pin-build.log` |
| Shared-host browser, React 18.3.1 | 10 checks passed in Chromium 158.0.8127.0, with strict zero page/console errors and no generic compiler requests. | `test-results/cardiac-browser-final-react18/result.json` |
| Shared-host browser, installed GUI React 16.14.0 | The same 10 checks passed in Chromium 158.0.8127.0, including German Code/Controller surfaces at 390px. | `test-results/cardiac-browser-final-react16/result.json` |
| Circuit UI browser | 9 checks passed against the qualified installed engine, including actual LED current, independent parts and transformed wire anchors. | `cardiac-circuit-evidence/result.json` |
| Built full GUI with the real Scratch VM | All four functional checks passed: Code entry, one shared Controller host, echo `042` in three instructions and `017 + 025 → 042` with ACC `0042` in seven instructions. The strict whole-app diagnostic gate failed; see below. | `test-results/cardiac-built-app-smoke/result.json` |
| Repaired supplier CI boundary | 48 assembler/workflow/pin/integrity tests, two owning-machine/UI parameter checks and 12 actual program executions passed. All 2,875 canonical circuit load/save/load cases passed. | `cardiac-sb3-pins-tests.log`, `cardiac-sb3-parameter-tests.log`, `cardiac-sb3-program-execution.json`, `cardiac-sb3-corpus-tests.log` |
| Final generated Board records | 35 Board census, matrix, BIOS/provenance and 8086 assertions passed without skips. Seven demo ROMs and six notice files are current. Mirror checking reports no findings. | `cardiac-pin-integrity-after.log` |

The installed-package proof compares the two owning packages' packed bytes;
it explicitly does **not** verify every transitive dependency's bytes. Package
metadata consistency alone is a weaker check and is not the evidence claimed
here.

Final compiler/gallery synchronization checks, mirror equality, generated
Arcade inventory and notices also passed. The gallery check covers 6,102 files
across 806 entries. These final source/pin results are distinct from the
earlier browser interaction receipts and the successful final GUI rebuild.

The two shared-host browser runs use the production host, portals, runner,
CircuitDesigner and Board inside an authored shell, with a validator-only
PropTypes shim and a minimum archive-loading VM delegate. Their result files
correctly retain `fullApplicationBuild: false`. The full GUI production build
is a separate successful compilation/asset result; it does not turn those
fixtures into full-application interaction or deployment tests.

### Built GUI smoke and inherited diagnostic limits

The separate smoke boots the unmodified webpack GUI and its real Scratch VM.
Its four CARDIAC functional checks passed, but its result correctly remains
`status: failed`: the strict console/network gate observed two optional
LabWired WASM 404s and three React warnings. There were no uncaught page errors.

The two fullscreen-handler warnings and two missing-WASM responses occurred
before CARDIAC selection. The `flex`/`flexGrow` warning occurred while the new
route opened the existing Controller pane. Source comparison against baseline
`4b33f4d93a73b424a33a9b2ed353289b1a38f2d3` found the relevant GUI/Box/pane
regions and LabWired loader unchanged. No warning stack named a CARDIAC engine
or component. That is source attribution and observed timing, not an independent
browser run of the baseline. Details are retained in
`test-results/cardiac-built-app-smoke/diagnostics-attribution.json`. The smoke
does not establish an error-free full application or a successful deployment.

### Supplier CI repair and remaining corpus findings

The initial `sb3-creator` [CI run 45791133905](https://github.com/CrispStrobe/sb3-creator/actions/runs/45791133905)
used older Board/Circuit UI fixtures and rejected the gallery's CARDIAC and KIM
parts as unknown kinds. The final producer pin updates both fixture authorities
to the published runtime candidates and runs actual CARDIAC execution and
parameter ownership checks before the long whole-corpus suite. The existing
provenance generator completed its full measurement and restamped 313 pages;
only the two pin strings changed in those pages.

On that exact pair, all 2,875 canonical circuit round trips pass. The
1,974-bench invariant run retains one original failure:
`lab-chopper-tacho` has a motor without the correctly oriented flyback diode
required by that gate. The original hosted job also reported device-current
readback gaps, four VHF claim mismatches, a 900-second parameter-file timeout
and a 30-minute overall timeout. Those are not claimed as repaired.

The four `lab-vhf-superhet` mismatches were already recorded before CARDIAC;
the new pair still reports 16 checked, four mismatched and 23 declined claims.
No numeric tolerance, exception list or skip was widened. The
[supplier handoff][supplier-handoff] records the original evidence and the
replacement candidate's bounded qualification. Replacement hosted CI remains
required.

### Inherited root pin-history gates

A clean baseline at `b3c7db9e6a3cb49274ba8b925db71bad6b2d0b89` passed 36 of
43 pin-history checks and failed seven. The final producer-pin candidate
passed 38 and failed five; every remaining failing
test name already failed on that baseline. They concern historical F7/F8 CUI
admission, current-pin inventory, sealed Board F10 positions, live SB3 versus
sealed epochs, and the frozen historical-admission inventory.

The comparison is retained in `cardiac-pin-chain-baseline.log` and
`cardiac-final-pin-chain.log`. All 70 final stale-token occurrences match
baseline path/line/SHA triples: there are zero new occurrences. The final
producer sync updated the SPIKE literal only after its actual artifact checks
passed, and regenerated its inventories. This bounded comparison
does not make the broader inherited pin-history gates green.

### Remaining upstream release gate

Board [CI run 45793266751](https://github.com/CrispStrobe/bw-board/actions/runs/45793266751)
for the draft PR's `ci:full` tier completed successfully with `vectors`,
`corpus`, `vectors186` and `vectors-full` green. Its `test` job was skipped by
the existing pull-request tier policy. This is useful hosted evidence, but it
does not satisfy Brickwright's full upstream gate.

[`scripts/verify-bw-board-ci.mjs`](../scripts/verify-bw-board-ci.mjs) requires
`test`, `vectors`, `corpus` and `vectors186`, including their required steps,
to succeed in **one CI run for the exact pinned SHA**. It cannot combine the
fast push run with the thorough PR run. A qualifying full run, such as an
authorized workflow dispatch or eligible default-branch push under the
[pinned upstream workflow](https://github.com/CrispStrobe/bw-board/blob/0f6b38a8d6d3b15861ee7b35eda45e5db45035f2/.github/workflows/ci.yml),
is still required. The verifier has not been weakened, and default merges
remain pending approval.

## Reproduce the checks

Use Node 22, the committed lockfiles, and separate checkouts at the supplier
revisions above. The commands below assume the three upstream directories are
siblings of this Brickwright checkout. Install each checkout's normal locked
dependencies before its checks.

Core and assembler/example execution:

```sh
cd ../bw-board
node --test test/cardiac-machine.test.mjs test/cardiac-circuit.test.mjs test/cardiac-debug.test.mjs
cd ../sb3-creator
node --test test/cardiac-program.test.mjs
node scripts/verify-cardiac-examples.mjs --board ../bw-board
BW_BOARD=../bw-board BW_CIRCUIT_UI=../bw-circuit-ui \
  node --test --test-name-pattern='CARDIAC|the engine loads' test/circuit-params-are-read.test.mjs
```

Circuit UI, including its real installed-engine provenance:

```sh
cd ../bw-circuit-ui
npm ci --ignore-scripts --no-audit --no-fund
npm run verify:board-provenance
npm run verify:cardiac
npx playwright install --with-deps chromium
npm run verify:cardiac:browser
```

From the Brickwright root, run all CARDIAC source, portable-workspace, routing,
live/source correspondence and lesson/gallery checks:

```sh
node --test --import ./scripts/lib/register-gui-scope.mjs test/cardiac-*.test.mjs
```

Verify the actual installed Board and Circuit UI package bytes at both install
locations, then run the separate full GUI production build:

```sh
node scripts/pin-packages.mjs --verify-installed \
  --source bw-board=../bw-board --source bw-circuit-ui=../bw-circuit-ui \
  --installed-root node_modules \
  --installed-root packages/scratch-gui/node_modules
npm run build:gui
```

The shared-host browser gate uses production CardiacHost/portal/runner,
CircuitDesigner and Board modules in an authored browser shell:

```sh
node scripts/verify-cardiac-lab-browser.mjs \
  --deps ../bw-circuit-ui/node_modules \
  --board ../bw-board --circuit ../bw-circuit-ui \
  --out test-results/cardiac-browser/react18
```

For the GUI's React runtime, install `packages/scratch-gui` with its committed
lock using `npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund`,
then run from the Brickwright root:

```sh
node scripts/verify-cardiac-lab-browser.mjs \
  --deps packages/scratch-gui/node_modules \
  --compiler-deps ../bw-circuit-ui/node_modules \
  --board ../bw-board --circuit ../bw-circuit-ui \
  --out test-results/cardiac-browser/react16
```

An existing compatible Chromium binary can be selected with the host gate's
`--executable /absolute/path/to/chromium`. The Circuit UI gate accepts
`BW_CHROMIUM_EXECUTABLE`. Missing browsers fail; `--compile-only` reports only
fixture compilation and never a browser pass.

The shared-host gate records the runtime, machine identity, source/deck
execution, input wait, breakpoint/prediction behavior, live/source mismatch,
unfinished-draft workspace and `.sb3` round trips, and solved night-light output.
Its result explicitly identifies the authored shell, validator-only PropTypes
shim and minimum archive-loading VM delegate. It is not a full Scratch GUI
production-build or deployment test. The Circuit UI gate additionally checks
desktop/390px layout, independent machines, save notifications and rotated/
mirrored wire anchors. Hosted results and full application qualification must
be reported separately from these bounded local results.

[engine-contract]: https://github.com/CrispStrobe/bw-board/blob/0f6b38a8d6d3b15861ee7b35eda45e5db45035f2/docs/CARDIAC.md
[assembler-contract]: https://github.com/CrispStrobe/sb3-creator/blob/fd5ea63fc4bda8696fbe6c672b4f11c1c8171d12/reference/cardiac-program-format.md
[supplier-handoff]: https://github.com/CrispStrobe/sb3-creator/blob/fd5ea63fc4bda8696fbe6c672b4f11c1c8171d12/reference/cardiac-lane.md
[circuit-contract]: https://github.com/CrispStrobe/bw-circuit-ui/blob/42aaddc8aaa93b4f584b2e9d81303b2673fdb9a5/docs/CARDIAC-CIRCUITS.md
[board-adoption]: https://github.com/CrispStrobe/bw-board/compare/cc18f3c8d84d68e008450e65ddf838b8ec03c7f7...de8083c5a894a49c9fa4c6f0fb6f8866e2d758c0
[cui-adoption]: https://github.com/CrispStrobe/bw-circuit-ui/compare/0a1b15edb0daecd723c7c07126450d84b86e3e68...ee2b4127a88f1b308f8d749cae4d7c1db1deae9e
[sb3-adoption]: https://github.com/CrispStrobe/sb3-creator/compare/1c29f69fd22c86ecb0051938eedb246921cb3b88...8aa66c500abcd0b99041a6d5f3351127095ac155
