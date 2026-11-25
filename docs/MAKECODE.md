# MakeCode interop — what we can cover, and what it costs

The question that started this: *can we support .hex files from MakeCode
Arcade in our micro:bit emulator, and what else from MakeCode Arcade can we
cover?*

We do **not execute the foreign machine code**. We recover its embedded source,
translate the game model to ordinary Scratch sprites and run that project on a
real 160x120 console surface. The distinction matters: imported games play,
but unsupported engine features are reported instead of being emulated badly.

## Headless CLI prerequisites

The MakeCode CLI reads the current integrated GUI libraries from
`packages/scratch-gui/src/lib`, where normal Node resolution reaches the GUI's
installed dependencies. Prepare the repository's vendored sources, run source
integration, install the declared GUI dependencies, and apply the VM overlay.
A frontend build or browser is not needed for conversion. Firmware compilation
and board execution retain their separate runtime requirements.

Before importing a library, the CLI checks the owned library files against the
verbatim source copy made by `scripts/integrate.mjs`, and checks the installed
VM package's canonical procedure-model export. Generated files outside that
copy are not required to match unrelated overlay files. Missing, conflicting
or stale integration reports `CLI_INTEGRATED_GUI_REQUIRED` with prerequisite
exit code 3; it does not repair the installation during conversion. Run the
normal source preparation steps again after editing owned libraries.

The explicitly dependency-free library/corpus test route remains separate;
it is not a fallback for a missing CLI installation. See the
[CLI module boundary](ARCADE-CLI-INTEGRATED-GUI-SCOPE.md).

## Why an Arcade .hex cannot run on our micro:bit simulator

Three independent walls. Any one of them is fatal on its own.

1. **Our simulator is not a CPU emulator.** `static/microbit-sim/` is the
   micro:bit Foundation's MicroPython simulator compiled to WASM, driven from
   `microbit-sim-pane.jsx` by a `{kind:'flash', filesystem}` message carrying
   **`.py` files**. It interprets Python. There is no address space to put ARM
   machine code into.
2. **Wrong instruction set.** MakeCode Arcade's micro:bit build targets V2 =
   nRF52833, Cortex-M4 (ARMv7E-M). Our in-tree ARM core is rp2040js's
   `CortexM0Core`, wrapped by `bw-board/cortex-m0-machine.js` — ARMv6-M. It
   cannot decode M4 encodings. (See "The labwired revision" below: this wall
   is the one that moved.)
3. **Wrong I/O surface.** The arcade shield is a 128x160 ST7735/ILI9163C over
   SPI; our micro:bit face draws 5x5 LEDs. A working CPU would produce a black
   screen until an ST7735 model, the SPI block, the timers and the display
   driver's DMA behaviour all existed.

## What the .hex does give us — and this part is built

MakeCode embeds the project **source** in everything it downloads. So
importing someone's game is a parsing problem, and parsing problems end.

Implemented in `overlay/scratch-gui/src/lib/bw-makecode/`:

| module | what it does |
|---|---|
| `embedded-source.js` | the container: finds the `41 14 0E 2F B8 2F A2 BB` header in a .hex (universal hexes included), a .uf2, an .elf or a .png cartridge, and returns `{meta, source, files}` |
| `lzma.js` | an LZMA1 decoder, because the embedded text is LZMA and every JS implementation available to depend on is unlicensed or a compressor we would never call |
| `png.js` | an 8-bit PNG decoder over `DecompressionStream`, so the cartridge path is testable in `node --test` rather than only in a browser |
| `micropython-hex.js` | the *other* hex: a micro:bit MicroPython .hex from python.microbit.org or uflash, V1 appended script and V2 filesystem both |
| `share.js` | `https://makecode.com/api/{id}/text` — the whole project as JSON, no binary parsing at all |
| `ts-import.js` | a parser for the TypeScript subset MakeCode emits (annotations, `enum`, `namespace`, tagged template literals, function expressions) — needed because the translation has to walk *into* callbacks |
| `translate-base.js` | what both translators share: the walk, the "nothing is dropped in silence" rule (which `test/makecode-nothing-vanishes.test.mjs` holds it to), the slot discipline, and the two bundled extensions the pseudocode borrows — `arrays` and `bitops` |
| `microbit-translate.js` | MakeCode micro:bit → BrickWright pseudocode → blocks, MicroPython, the simulator |
| `arcade-translate.js` | MakeCode Arcade → a playable Scratch project: target selection, sprites, clones, `touching`, score, velocity loops |
| `arcade-assets.js` | the artwork: `img` literals, the `.g.jres` gallery (column-major 4bpp), tilemaps painted whole, the 16-colour palette → SVG costumes |
| `microbit-icons.js` | MakeCode's 40 icons and 8 arrows as our 5x5 patterns — the same bitmaps MicroPython has, so this is an identity |
| `export.js` | the other direction: blocks → MakeCode TypeScript, and a .hex carrying only the source embed — which is all MakeCode's importer reads |
| `index.js` | one `importArtefact(bytes)` door, wired into the Code tab's 📂 Open button |

Evidence: `test/makecode-import.test.mjs` runs against **eight real MakeCode
downloads** — micro:bit, Arcade and Calliope, in .hex and .uf2 (see
`test/fixtures/makecode/README.md`) — plus round-trips for the two containers
we have no committed sample of.

### What actually runs

A **MicroPython .hex** needs no translation at all: our simulator *is* a
MicroPython interpreter, so the extracted `main.py` can be flashed straight
into it. That is the cheapest win in the whole story and it is why
`micropython-hex.js` exists next to the MakeCode reader rather than somewhere
else.

A translated **MakeCode Arcade** game also runs. `DEVICE ARCADE` selects the
game-console pane; its 160x120 viewport mirrors the Scratch renderer and its
eight controls post through Scratch keyboard IO. The same state backs the
Arcade extension's buttons, light, tilt, score and PyBadge NeoPixels. This is
a source-level port, not binary emulation, which is why tilemaps and other
unsupported APIs remain visible in the import report.

## The ladder, and where we are on it

| | what | state |
|---|---|---|
| 0 | sniff + extract project source from .hex/.uf2/.elf/.png | **done** |
| 0b | MicroPython .hex → `.py` → runs in the simulator | **done**, end to end: the extracted script lands in the micro:bit tab (which appears whenever there IS MicroPython to show, not only when a DEVICE line says so) and that tab's **▶ Run on simulator** flashes it |
| 1 | MakeCode **micro:bit** TypeScript → our blocks | **done** |
| 2 | MakeCode **Arcade** → a Scratch project, artwork included | **done** |
| 3 | import from a share link (needs network; the file importer is what works offline and in the packaged app) | **done** — 🔗 MakeCode… in the Code tab |
| 4 | export: a Brickwright project opens *in* MakeCode | **done** — ⬆ To MakeCode writes a .hex whose only content is the source embed, which is what MakeCode's importer actually reads |
| 4b | export: compile a modified project to a board `.uf2` | **not done**, and not the same thing — that needs pxt's own compiler. Opening in MakeCode is not physical deployment |
| 5 | actually emulate a MakeCode hex | see below |
| 6 | **Calliope mini** | **done**, both halves. The **Arcade** editor targeting a Calliope (GameKit shield) always worked — the board changes the binary, not the source, and the fixtures here ARE such builds. `makecode.calliope.cc`, the micro:bit-shaped editor, now routes through the micro:bit translator: **24 of the 25 example programmes on calliope.cc translate and compile**, and the 25th carries no embedded source at all. See below for what that cost |

## Calliope mini: what 25 real programmes changed

`makecode.calliope.cc` writes the micro:bit's API onto different hardware, so a
Calliope hex goes through `microbit-translate.js` with a `board` note saying which
board it came from. Routing it there was three lines. Everything else in this
section is what the [25 example programmes](https://calliope.cc/calliope-mini/25programme)
found once they could be run through it — the corpus went **0 → 24 of 24**
(the 25th has no embedded source), and it found bugs on the Arcade side too,
because the fixes are in the shared base.

**The parser could not read the language they are written in.** German variable
names (`ausgewählt`, `größe`) failed on an ASCII `IDENT_START`, and two programmes
destructure their radio handler's argument —
`radio.onDataPacketReceived(({receivedString: name}) => …)` — which was rejected
outright, taking the whole file with it. Identifiers are now `\p{L}`-based and the
parameter parser reads object patterns.

**Two things compiled to something plausible and wrong**, which is the failure this
translator exists to prevent:

| written | was becoming | now |
|---|---|---|
| `wert = wert & 255` | `set wert to wert & 255`, which parses as a **string literal** — the variable ends up holding the ten characters `wert & 255` | `bitops` blocks: `bitand`, `bitor`, `bitxor`, `shiftleft`, `shiftright`, `bitnot` |
| `let liste: number[] = []` | `set liste to 0` — and every later `liste[i]` read that number | the `arrays` extension |

Arrays map to the **`arrays` extension rather than to Scratch lists**, and the
reason is indexing: the extension indexes from 0, exactly as TypeScript does.
A Scratch list indexes from 1, so every `a[i]` would need a `+1` that is invisible
in the resulting blocks, and any index the program computed would be silently off
by one. `push`, `pop`, `insertAt`, `removeAt`, `indexOf`, `length` and `a[i] = v`
all map; the methods that take a callback (`filter`, `map`, `some`) are reported,
because inlining an arrow would invent a function name the project does not have.

**`.length` on a call result was dropping the call.** `a.filter(f).length` read the
property and never evaluated `a.filter(f)`, so the refusal never fired and the
program silently got a variable named `length`. Found by a test written for the
callback case, not by the corpus.

**Images are values.** These programmes build arrays of pictures —
`uhrbilder = [images.createImage(…), …]` then `uhrbilder[i].showImage(0)` — so
`images.createImage` and `images.iconImage` now return a pattern string, which
survives being stored in an array. A **literal** pattern reaches
`show pattern`; a runtime-chosen one is refused, and the refusal says why: the
block carries the pattern as a **field**, and a field cannot hold a reporter at
all. That is a limit of the block, not a gap in the grammar.

**What is refused, and named.** `basic.setLedColor` is the single most common
unsupported call in the corpus (18 of 48 reports). It is the Calliope's RGB LED,
and the micro:bit display we model is single-colour. The report says that rather
than printing `basic.setLedColor()`, because the reports ARE the product for
everything we cannot translate. Same for the on-board motor driver and the
microphone.

**Three gaps went upstream and have landed.** All three were found by this
corpus and fixed in sb3-creator
[#4](https://github.com/CrispStrobe/sb3-creator/pull/4), now vendored at pin
`4c714d3`:

- `led.plot(x, y)` with variable coordinates — the ordinary way these
  programmes write to the display, and the third most common refusal. Not
  because the block cannot do it (X and Y are *inputs*) but because only
  `plot x <digits> y <digits>` parsed; `plot x col y row on` matched no rule
  and produced no block. Same shape as the `show text <reporter>` gap fixed
  in #3. **The refusal is gone: 53 → 48.**
- Arrays never reached the device. The reporters emitted `_arrays.length(…)`
  with nothing defining `_arrays` — a `NameError` at the first array read,
  reported as `ok` — and the array *commands* lowered to `pass`. Both halves
  mattered: a program that pushed to an array then read its length got the
  length of an array nothing had written to.
- `timer` on a device was always **0**. It became `scratch.timer()`, which the
  generator's guard turns into 0. The micro:bit has `running_time()`. Found in
  a Calliope stopwatch whose elapsed time was permanently zero.

**A variable named `x` was not a variable.** `set x to 7` compiles to
`motion_setx` — the Scratch *motion* block — and `change x by 1` to
`motion_changexby`, case-insensitively, so a MakeCode program with `let x = 0`
moved a sprite instead of keeping a number. Silently, and while compiling
perfectly. `x` and `y` are the two most ordinary names a program that draws on
a 5x5 grid can have, and the corpus had **eleven** of them. Four other names do
the same: `size`, `volume`, `tempo` (looks, sound and music set-blocks). Reads
are fine — `show text x` reads the variable — so this is only about where the
name is written.

Those five are now renamed on the way in, with as little added as possible
(`x` → `x_`, extended again if the program already uses that), announced once
at the top of the program, and **not counted as a refusal**: the variable is
fully supported, it just cannot keep its name. Counting it would inflate the
one number this work is steered by; hiding it would rename someone's variable
behind their back.

It first showed up as an apparent bitwise bug — `set x to x & 255` looked like
it produced a block with no value, which is what a `motion_setx` with an
unparseable X input looks like from the outside.


## What the grammar will and will not take

Most of what the translators know is not about MakeCode at all — it is
about which pseudocode spellings actually parse. Three slots behave
differently, and every one of them was found by compiling the output
rather than by reading the grammar:

- **single-token** (`radio send number X`, `change score by X`, `set pin
  P1 analog X %`): captured as `\S+`, so a variable fits and `i * 30`
  does not. Computed arguments are hoisted into a temporary.
- **literal-only** (`show text "..."`, `plot x 2 y 3`): the parser reads
  the characters. `show text <expression>` PARSES and compiles to
  nothing — so `basic.showNumber(x)` uses `display <expr>` instead,
  which does take an expression, and `led.plot(x, y)` with variables is
  refused.
- **condition-lowered** (`set pin P0 to 0|1`): only the two literals
  parse, so a computed level becomes the IF/ELSE it really is.

Two spellings sb3-creator's *generator* emitted had no rule in its
*parser*: `<gesture> happening` and `pin P touched`. Written out they
compiled to a comparison against an undefined variable — silence with
the shape of success — so the translator refused them.

**Fixed upstream and vendored in** (sb3-creator `b4a8129`, PR #3): both
now parse, `show text` takes an expression, and the translator
translates gestures and touch instead of reporting them.

That PR also fixed something worse, found on the way: MicroPython's
`accelerometer.is_gesture()` accepts the four tilts spelled WITHOUT the
word "tilt", and the lowering passed the menu label through verbatim —
so `tilt up` and its three neighbours raised
`ValueError("invalid gesture")` the moment the block ran. Every project
that used one, not only imported ones.

## What an Arcade import actually produces

`sprites.create` → a sprite with the real artwork as its costume;
`img` literals and `.g.jres` entries both. `game.onUpdate` → `WHEN flag
clicked` + `FOREVER`. `sprites.onOverlap` → `IF touching <other>`.
`controller.moveSprite` → arrow keys. `info.changeScoreBy` → a `score`
variable, and the per-player API (`info.player2.hasLife()`,
`onLifeZero`) → `score2`/`lives2` — player one shares the plain API's
variables, because in MakeCode the plain API *is* player one and a game
that mixes both would otherwise keep two scores that drift apart. `sprite.vx/vy` → a per-frame motion loop. A mid-game
`sprites.create` → `create clone of <sprite>`, emitted *after* the
positioning that precedes it, because a Scratch clone inherits the
parent's state at the moment it is made. `scene.setBackgroundImage` → a
full-screen sprite sent to the back (the costume route deliberately
skips the Stage).

Tilemaps arrive as pictures: the level is painted tile by tile into one
image and becomes a backdrop costume (the tiles live in the `.g.jres`,
but the MAP is a hex literal inside a generated `switch` in
`tilemap.g.ts`, so it has its own reader). A game with several levels
gets the first four as costumes on one background sprite — a level
renders to a few hundred kilobytes of SVG, and handing the paint editor
eight of those helps nobody.

Animations arrive as ARTWORK. The shape a real game uses is the action
API (`createAnimation` / `attachAnimation` / `addAnimationFrame`), and
every frame used to be lost outright; now each becomes a costume on the
sprite it was attached to, named for the animation it came from. What
does not come with it is the playing: Scratch has costumes but no named
animation with its own timer, and a game binds several animations to one
sprite under the same `ActionKind`, so `setAction` cannot be resolved to
one of them. Said once, not once per call. Capped at 24 frames a sprite.

What does not survive: effects and particles, the physics engine's tile
COLLISIONS (the level is a picture, not terrain), animation PLAYBACK, music —
and, structurally, any script that moves a sprite other than its own,
which Scratch has no way to express. Each is named in the returned `unsupported` list and marked
`# unsupported` where it stood, and the status line says how many.

## Icons are an identity, not an approximation

`basic.showIcon(IconNames.Heart)` is in nearly every beginner MakeCode
program. It maps exactly: our `show pattern` lowers to `display.show()`
in MicroPython, and MakeCode's icon set and MicroPython's built-in images
are the same bitmaps. `microbit-icons.js` carries all 40 icons and 8
arrows, and the export direction reverses the lookup so a heart comes
back out as `basic.showIcon(IconNames.Heart)` rather than a grid.

The one real loss in that direction: our patterns carry brightness 0-9
and MakeCode's display literals are on/off, so a dimmed pattern exports
flattened — and says so.

A sprite's `width`/`height` are constants: the importer decoded the
picture to build the costume, so the bounds arithmetic a game writes is
exact rather than estimated, and `left`/`right`/`top`/`bottom` follow.
Trigonometry converts units — MakeCode's `Math.cos` takes radians and the
block takes degrees, and reading one as the other is wrong in a way that
still runs.

**Velocity is the one cross-sprite write that lands.** `vx`/`vy` already
live in a shared variable that the owning sprite's motion loop reads, so
another script setting it is exact and immediate. Position is not so
lucky: only a sprite can move itself. Scratch's idiom for the rest would
be a shared variable plus a broadcast — which works, one frame later, and
that difference is why it is a refusal here rather than a silent
approximation.

## The round trip is the test

`test/makecode-export.test.mjs` takes each shipped micro:bit example,
exports it to MakeCode TypeScript, imports it back through the
translator, compiles that, and asserts no device block was lost. Six
examples pass with nothing unsupported in either direction. A mapping
added to one side of the table and forgotten on the other shows up there
and nowhere else.

The one legitimate difference: `show text` leaves as `basic.showString`
and comes back as `scroll text`, because MakeCode has no non-scrolling
string block.

**Everything the Calliope corpus needed now has a way back**: all 24 make
the whole loop — import, compile, export to MakeCode — with nothing refused
at either end. Getting there closed four gaps, and three of them were
asymmetries only the round trip could show.

*Arguments to a user-defined function were dropped on the way IN.*
`zeigen(3, n + 1)` translated to the bare word `zeigen`, so the function ran
on whatever its parameters happened to hold. It emitted a line, so the
anti-silence gate below saw nothing wrong; `procedures_call` being the most
common thing the export could not render is what pointed at it. A call is
matched token by token against the `DEFINE`'s template, so each argument has
to be a single token — the same slot discipline, and `single()` already
existed for it.

*Procedures, gestures and touch had no export at all.* For procedures the
`proccode` is the only place the argument ORDER lives (`inputs` is keyed by
argument id, and its key order is not the call's), so the proccode is what
gets walked; definitions are emitted above the body because MakeCode is
TypeScript. The definition's input key is `custom_block`, lowercase, not the
`CUSTOM_BLOCK` that Scratch's own files use. Gesture and touch reporters were
added to the importer in sb3-creator#3 and never to the export table.

*A boolean was being compared to a string.* The compiler puts a boolean
reporter into a boolean slot as `equals(reporter, "true")`. Rendered
literally that is `input.isGesture(…) == "true"`, and Static TypeScript will
not compare a boolean to a string — the export would not have built in
MakeCode. A real `n == 3` is left alone.

**Arrays and bitwise had to be given a way back.** They arrive through
*extensions* — the pseudocode has neither an array nor a bitwise operator
of its own — so making them importable opened a hole at the far end: a
Calliope project brought in and exported again came back with
`// unsupported: arrays_push` where its array had been. Reported, so
nothing vanished, but a round trip that drops the arrays is not one.
MakeCode's TypeScript has both natively, so the inverse is exact, and
`a[i]` survives **unshifted** — the 0-based indexing that made the
`arrays` extension the right target on the way in paying for itself in
the other direction. The declaration needs a hoist of its own: an array's
name is an *input* on the block rather than a Scratch variable, so it is
only met while emitting and nothing in `target.variables` declares it.

## Counting refusals cannot catch a silent drop

The number this work is steered by is the refusal count, and it has one
blind spot that matters more than everything it sees: **a silent drop
lowers it**. A statement that produces neither a block nor a report makes
the corpus look like it improved.

Four defects in this file's history were exactly that, and all four
compiled:

| written | became | not caught by |
|---|---|---|
| `wert & 255` | a string literal whose text is `wert & 255` | compiling — it parses |
| `let liste: number[] = []` | `set liste to 0` | compiling, and the refusal count went *down* |
| `a.filter(f).length` | a variable named `length`, the call unevaluated | either |
| `led.plot(x, y)` | no block at all (upstream) | either |

So `test/makecode-nothing-vanishes.test.mjs` counts nothing. It wraps the
walk and asserts every statement either emits a line, files a report, or
hoists a definition, over every committed fixture on both sides. Two
categories legitimately emit nothing *where they stand*, and they are
listed at exact spellings rather than by pattern, because a broad
exemption is how the next silent drop gets back out of reach: an `enum`
(read into the substitution table, its members substituted at each use)
and the Arcade animation API (gathered in pass 1 and turned into
costumes, since Scratch has no named animation with its own timer).

A third test breaks the walk on purpose and checks the instrument notices
it — a gate that cannot fail is decoration, and a refactor that stopped
calling `statement()` would otherwise turn the file green.

## The imported game RUNS

Compiling is a parse-level claim, and this repo's bar is higher — a
project can compile into blocks that start no thread and change nothing.
`test/makecode-arcade-runs.test.mjs` packages each translated game as a
real `.sb3`, loads it into the real Scratch VM with lite's real
extensions, pulls the green flag and steps it: threads must start, blocks
must survive packaging, something must change, and the VM must report no
block errors.

Three real games pass, including the pong whose cross-sprite work is
mostly refused — what is left still has to be a program, not a shell that
throws.

The micro:bit half asks for more (`makecode-microbit-runs.test.mjs`),
because its blocks are lite's OWN bundled extension rather than core
Scratch: a bundled extension method must actually be INVOKED. The
imported pin-reading program calls `microbitplus_analogread` about 34 000
times in 30 frames, which is the difference between blocks that exist and
blocks that run.

The device referee in `trace-oracle.js` cannot do this job: it models
hardware programs and refuses motion/looks/sensing outright.

## The labwired revision

The claim in wall 2 — "no permissive JS ARMv7E-M core" — was true of this
repo's *light* tier and is no longer true of its heavy tier. **labwired**
(`lib/labwired-engine.js`, fetched by `npm run sync:labwiredwasm`) covers
Cortex-M0+/M3/**M4**/M7/M33, RISC-V and Xtensa, and as of 2026-08-27 it
demonstrably RUNS from the browser in this app — `verify-labwired-engine.mjs`
drives an F030 program and insists the program counter moves.

Reading its target contract (`debug-target-factory.js`, `createLabwiredTarget`)
makes the Arcade path unusually concrete, because two of the three inputs
already exist:

| what labwired wants | what we would have to do |
|---|---|
| `firmware` — an **ELF** | nothing. MakeCode ships an `.elf` beside the `.hex`, and our importer already reads the embedded source out of one |
| `chipYaml` — a chip **descriptor** | **done upstream:** LabWired `1cf3d3b8` carries an L3-gated nRF52833 descriptor (GPIO/GPIOTE, timers/RTC, EasyDMA serial, clock and more). Lite still has to vendor the descriptor and board pin map |
| `pins` + a `board` | the arcade shield's header map, and an ST7735 model with a framebuffer the stage can show |

So the remaining cost is integration and a display model, not a CPU or chip
description. What it
would buy is running an unmodified Arcade game — someone else's binary — with
no translation. What it would NOT buy is any of the *editing* story: a running
binary is not a project you can open, read or change, which is what the import
path gives.

The order therefore stands — import first, emulate later, and only if the
demand is for playing other people's games rather than learning from them —
but "later" is now a week of peripheral work rather than a rewrite.

## The command line: every target, and `run` (2026-10-13)

`npm run makecode -- <command>` (scripts/makecode.mjs) covers the targets the
Code tab translates, and runs a micro:bit or Calliope program without the app.

| `--target` | to-sb3 | to-ts / to-project | to-hex (firmware) | run |
|---|---|---|---|---|
| `microbit` | yes | yes | universal V1 + V2 `.hex` | yes, the V1 board model; `--board v2` the V2 |
| `calliopemini` (`calliope`) | yes | yes, export-calliope.js | `.hex` | yes, the V1 board model |
| `arcade` | yes | yes | `.uf2` for a `--board` | refused by name |
| `ev3` | yes | yes, export-ev3.js | `.uf2` | refused by name |

A Calliope project exports through the micro:bit walk with pxt-calliope's own
packages (`core`, `radio`), and `wait until` becomes the polling loop it stands
for: pxt-calliope 3.0.30 has no `pauseUntil` (pxt-microbit's core poll.ts), and
a Calliope corpus program failed to compile on it until this (task A6).

The Code tab also selects the micro:bit, Calliope or EV3 emitter from the
project's device and writes the matching MakeCode target and editor guidance
(task A11, PR971). A Calliope export uses the polling form of `wait until`;
a real downloaded Calliope project has been reopened, compiled and run in the
browser qualification. Unchanged imported MakeCode files retain their own
target, and multi-board projects keep their existing export behavior.

`run <file> [--target microbit|calliopemini] [--seconds N] [--json]` (task A7)
runs the program on LabWired's `microbit-v1` board: an nRF51822 with the Nordic
S110 SoftDevice EMULATED (only the application window of the `.hex` is loaded;
no Nordic byte runs), the same board model the Debug pane uses. A firmware
`.hex` runs as it is (a universal hex's V1 section); a `.ts`, `.sb3`/`.bw` or a
`.hex` that only carries a project is compiled first. Time is GUEST time: the
serial console prints as it arrives, the 5x5 matrix when it changes. It needs
`npm run sync:labwiredwasm` (the app's own engine artifact, run in Node through
its glue's `initSync`) and, to compile, `npm run sync:makecode`; either missing
is exit 3, by name. A Calliope mini runs on the same board model: its matrix and
serial are real, its RGB LED, motor driver and pin labels are not modelled.

Found while building it: a program that reads an analog pin faults with a
BusFault at `0x4000_7500`, the nRF51 ADC, which LabWired's nRF51822 descriptor
does not model yet. `run` reports the fault and exits 1; it does not fake a
reading.

### The micro:bit V2: `run --board v2` and the Code tab's ▶ Run on the emulated micro:bit V2 (task A8)

The V2 (nRF52833) has no emulated SoftDevice: the official V2 base carries
Nordic's S113, MBR and bootloader, which the emulator never runs. So a V2 run
is compiled for the EMULATOR: `compileMakeCodeForEmulator` in the app, and its
CLI twin `compile(target, files, {emulator: true})` in scripts/lib/pxt-node.mjs,
link the program onto a Bluetooth-free base (the `mbcodal` variant only,
through the same `emulatorBase` check), and the plain V2 `.hex` that results
becomes an ELF where its own records say (vector table at 0) for LabWired's
`microbit-v2` board. A universal `.hex` is refused on `--board v2`: its V2
section is linked onto the official base. A Calliope program is a V1 program.

The bases reach a build from the published release `makecode-emu-bases-1` of
this repository: the build workflow's own bytes (run 38091323448), pinned by
sha256 in `MICROBIT_EMU_BASES`, with the manifest and the components' licence
texts beside them. `npm run sync:makecode` fetches them unless a local build is
present, and serves only the pinned bytes (test/makecode-emu-bases-fetch.test.mjs).
The workflow that BUILDS them syncs with `--no-emu-fetch`, so the published
copy can never stand in for the build it is meant to reproduce.

In the Code tab, a micro:bit MakeCode project has **▶ Run on the emulated
micro:bit V2**: the image goes to the Debug pane on the `board:microbit-v2`
LabWired board through the same firmware hand-off a compiled sketch takes, and
the LED matrix shows in Widgets.

The CLI reports the V2 firmware's serial text in both JSON and text mode, and
the Code tab sends it to the Debug console. The pinned
`labwired-wasm-de14721e` engine fixes the UARTE buffer lifetime and interrupt
completion faults that corrupted CODAL output. Real compiled programs passed
complete greeting/ordered-counter checks with the matrix, fault and guest-time
bounds intact; a fresh browser V2 ELF reached Running and printed its complete
unique greeting ([A10, PR988](https://github.com/CrispStrobe/brickwright/pull/988)).

MakeCode's `serial.writeLine` pads records to 32 bytes including CRLF by default.
Use `serial.setWriteLinePadding(0)` in the program for unpadded lines.

## Two things found on the way that are not built here

**The pxteditor iframe protocol.** MakeCode editors accept
`?controller=1` and then talk `postMessage` in a documented shape
(`{type: "pxteditor", action: "renderblocks" | "importproject" | …}`,
answered with `{type: "pxthost"}`). That is how you would embed the real
editor, or render a block image of a snippet, without any of the parsing
above. It needs the network and a remote origin, which is exactly what
this fork exists to avoid — but it is the right tool if we ever want
"edit this in MakeCode, come back with the result".

**The Arcade block vocabulary as an extension.** We ship a 5x5 `arcade`
extension (sprites on the LED matrix). Growing it into a stage-backed
sprite/tilemap/scene extension would let people *write* Arcade-shaped
programs here, which is the mirror of importing them. Separate feature,
not interop.

## Licensing (this matters more here than elsewhere)

Checked via the GitHub API on 2026-08-27:

- `microsoft/pxt`, `microsoft/pxt-arcade`, `microsoft/pxt-common-packages` —
  **MIT**. Format details and even runtime pieces are compatible with lite's
  fully-permissive rule.
- `microsoft/pxt-microbit` — GitHub's detector says **NOASSERTION**, but its
  `LICENSE.txt` was read: it is **plain MIT**, 25 lines, no extra clauses. The
  detector is thrown by the "PXT - Programming Experience Toolkit" line above
  the MIT header. So its tables are usable here — which is where two of the
  icon patterns come from.
- `bbcmicrobit/micropython` — **MIT**. 38 of the 40 icon patterns and all 8
  arrows come from its `microbitconstimage.cpp`, which is also where MakeCode's
  icons and MicroPython's built-in images both originate.
- `microbit-foundation/microbit-fs`, `microbit-universal-hex` — **MIT** (the
  V1/V2 storage formats implemented in `micropython-hex.js` are documented
  there).
- `maehw/microbit-pxt-code-extractor` — **GPL**. Do not read or borrow from
  it; the format is documented publicly at <https://makecode.com/source-embedding>
  and that is what this implementation follows.
- The LZMA decoder is written from the specification. The LZMA SDK the
  algorithm comes from is public domain.

### The firmware a MakeCode program is linked onto (added 2026-09-25)

The list above covers MakeCode's *source*. The precompiled micro:bit bases
pxt-microbit ships (`built/hexcache`, the image a program is linked onto) are
a different matter: each is a Bluetooth build that carries **Nordic's
SoftDevice** — S113, the MBR and a bootloader on V2; S110 v8 on V1 and on the
Calliope mini — whose licences allow it to run only on a Nordic chip and forbid
disassembling it (quoted in THIRD-PARTY-NOTICES.md). Downloading such a .hex to
a real micro:bit is exactly its licensed use. Running it in lite's emulator, or
stepping through it in the debugger, is not.

So the emulator has its own bases. `scripts/build-makecode-emu-bases.mjs`
builds pxt-microbit's own V2 request with `DEVICE_BLE 0` and Nordic's binary
objects removed; the build refuses to write a base whose linker map shows an
nRF5 SDK member or a SoftDevice/MBR/bootloader/UICR section
(`scripts/makecode/firmware-licence-gate.mjs`). `lib/bw-makecode/base-licences.js`
classifies every base lite can serve by the sha256 of its bytes —
`clean`, `chip-restricted` (naming the component) or `unaudited` — and
`compileMakeCodeForEmulator` links only onto a clean one, refusing anything
else by name. The official bases stay the download path.

**Which base a DOWNLOAD uses (2026-09-27).** Microsoft's official base wherever
one exists; ours only where none does. For {core, radio} — a project without the
microphone package — pxt-microbit's npm hexcache has none, but MakeCode's CDN has
both halves, content-addressed by pxt's own sha: V1 `f7b3cfda…` (S110 inside) and
V2 `137d8c97…` (S113 inside; MBR and SoftDevice byte-identical to the npm bases').
They are pinned in `BASES.microbit` of the sync script, so such a project
downloads a full universal .hex (V1 + V2) on the official bases. Our
Bluetooth-free build of the same V2 request stays in `hexcache-emu/`, for the
emulator only; the V1 half has no from-source build, so the official route is
also the only one that gives a V1 board a file at all.

**Arcade firmware** is built per board: the ⤓ firmware action on an Arcade
project asks for the board first, from pxt-arcade's own hardware list
(`targetconfig.json` `hardwareOptions` — "Adafruit PyBadge", "Meowbit"… — plus
the per-chip `hw---<variant>` cards "R2", "D5"…), which the sync serves as
`arcade/hardware.json`, keeping only boards whose base it served. The build is
compiled with that `hwVariant`; a .uf2 for most boards, an Intel .hex for the
nRF52833 ones (micro:bit shields). With no board chosen there is no base, and
the download says so instead of building.

What this does NOT cover: micro:bit V1 and the Calliope mini 1/2 (nRF51,
microbit-dal). The DAL makes SoftDevice supervisor calls even with Bluetooth
off — `MicroBitThermometer` asks `sd_softdevice_is_enabled` unconditionally, and
`ble_running()` does whenever pxt's `pairing_mode` is set — and it builds with
yotta. A SoftDevice-free V1 base needs a DAL change or an SVC stub, not a
switch; measured and not attempted.

## Author a full-screen Arcade backdrop

In **Code**, choose **Arcade**, then open **Backdrops → Pixel**. Use the target
picker to choose **Backdrops** if a sprite is selected. Open **More** and choose
**Arcade background160×120**. Paint with the palette and tools, add layers if
needed, then **Save**. The preset displays each Arcade pixel at three Scratch
units. Native160×120 PNG uploads keep their logical dimensions even when
Scratch stores the bitmap at double resolution.

Use a backdrop-switch block, or the corresponding Code command:

```text
DEVICE ARCADE
BACKDROP art
WHEN flag clicked:
  switch backdrop to "art"
```

Replace `art` with your actual backdrop name. **From Blocks → Code edit → To
Blocks** retains the current artwork; save an SB3 to carry the editable layers
and palette to another device. Plain Code text alone does not carry the binary
artwork. Arcade export includes the background. Transparent Scratch Stage
pixels keep their white matte; a custom palette without white produces a named
quantization warning.

This journey is covered by `scripts/verify-arcade-background-browser.mjs`:
actual PNG chooser, painting, layers, Code/Blocks, SB3 reopen, playback and all
19,200 original-PXT export pixels. Tilemap painting, animation action binding,
custom-palette RGB equivalence and mixed native Arcade/Scratch Stage composition
remain separate authoring/qualification work.


## Published animation resources (candidate)

The animation candidate adds **Frames → animation name → Publish animation**
in Pixel. Create at least two frames with the same duration. Save/reopen as SB3
preserves their editable source and stable identity; duplicating a costume
creates another identity. Unequal timing produces an explicit error.

The candidate native Code/Blocks binding uses these reporters:

```text
(arcade animation frames resource "RESOURCE-UUID")
(arcade animation interval resource "RESOURCE-UUID")
```

The Code picker inserts the selected UUID at the cursor. The frame reporter
feeds the native image-animation block and the interval reporter supplies its
uniform timing. Shared compiler PR62 is merged and adopted at `33ce738`.
Actual native Blocks drag/drop and resource menu selection are qualified.
The candidate full Code/Blocks/controller/export/reimport journey passes locally
on production source `897002047`; hosted qualification remains pending before
merge. This is not a claim that current main includes the candidate.

The reached browser qualification covers painting, publication, invalid timing,
SB3 reopen, native binding, controller stop/restart, rename/reorder and original
Arcade export/reimport playback. All19,200 pixels match original Arcade.
Exports now include native animation gallery files, including unused published
resources. Native animation imports preserve playback and typed image-array
behaviour. A validated companion also carries layers, frame IDs and resource UUIDs;
matching conversion imports recover that source separately from playback code.
Restoring it into Pixel timelines and original Assets editor qualification remain
open. The CLI reads current SB3 artwork bundles and exports these resources too.
See [the authoring gap ledger](CONVERSION-CAPABILITIES-AND-GUI-GAPS.md#u04--animation-binding)
for the remaining acceptance criteria.

## Recover complete tutorial inputs offline

A saved tutorial code fence can reference gallery art, custom code and packages
that live elsewhere in its Markdown document. Assemble those declared inputs
with the exact saved program before comparing it with a full project:

```sh
node scripts/makecode.mjs tutorial-to-project tutorial.md --main main.ts --target arcade -o tutorial.mkcd
node scripts/makecode.mjs to-sb3 tutorial.mkcd -o tutorial.sb3 --bw tutorial.bw
node scripts/compat-audit.mjs --target arcade --compile --execute --out audit.json tutorial.mkcd
```

The assembler preserves `assetjson` files, palette/configuration, `customts`
files, and `package` declarations, including bare bundled package names. It
replaces the template `main.ts` with the explicitly selected source, rejects
conflicting or missing files, and performs no package download or code execution.
The native project is suitable as an input to the existing MakeCode file route;
assembly itself is not a compatibility claim. Arcade imports translate local
TypeScript declared in `pxt.json.files` and root `testFiles`, in original PXT
order: supplemental files, then `main.ts`, then `_onCodeStop.ts`. Reopened
namespaces share exports while retaining private declaration scopes. Unlisted
files do not execute. Missing files, conditional package-dependent files,
ambient declarations, assembly/Python sources and nondefault palette rendering
retain named diagnostics. Generated resource factories use the asset readers. Audits discover `.mkcd` and `.pxt` files and report missing
offline extension packages as unavailable compilation gates with their names.
See the [pinned ten-project input receipt](receipts/2026-10-08-tutorial-project-inputs.json).


### Declared Arcade helper resource types

Local helper declarations can use supported PXT resource types (`Image`,
`Sprite`, `tiles.Location`, `animation.Animation`, `scene.Scene` and
`ArcadePhysicsEngine`) on parameters, variables and named function returns.
Nested `T[]` and `Array<T>` retain array element resource types through aliases,
indexing and procedure calls, even before any call-site image is available.
Function and arrow callbacks retain parameter annotations. These constraints
select native resource operations; they do not cast values or provide missing
package artwork. Unknown type aliases, unions and callable types are not
resolved by this type-constraint slice. See the capability ledger for runtime,
GUI and original-export qualification boundaries.


### Synchronous callback helpers

Arcade imports can specialize helper parameters declared with function types,
for example `handler: (value: number) => number`, when the argument is an inline
function/arrow or a known global function. The full helper body becomes native
procedures, preserving loops, conditions, arguments, returns, forwarding,
recursion and pauses. Callbacks may read and mutate globals. Code and Blocks
expose the resulting ordinary procedures; exporting writes equivalent Arcade
procedures, without restoring the original higher-order source abstraction.

Stored/dynamic callable values and callbacks capturing a caller's local cells
remain named gaps. Namespace-function values, callable type aliases and
callbacks that themselves accept callable arguments are outside this slice.
This support does not provide missing extension packages or implement APIs
inside a callback that already have their own named gaps.

### Built-in namespace augmentation

Arcade source can reopen built-in namespaces such as `sprites` and `game`
with local exported helpers. Qualified calls and unqualified built-in members
inside these declarations retain their original PXT bindings. Nested built-in
namespaces can also be extended; source-private declarations stay private to
their own declaration block. A generated catalog from the pinned official PXT
device API metadata identifies exact exports. Recognizing a name does not
implement its operation: unsupported APIs retain their operation diagnostics.
Unknown members, conflicting built-in declarations, namespace object escapes
and reads of source exports before initialization remain explicit errors.

Code and Blocks expose the lowered procedures and ordinary Arcade operations.
Native export emits equivalent flat procedures. Namespace-preserving editing,
multi-file navigation and general callable values remain open GUI/runtime work.

### Array random selection

Arcade's `values._pickRandom()` imports as the existing Arrays & Vectors
`random item of array reference (values)` reporter. The receiver is evaluated
once. Image, sprite and nested-array selections keep reference identity and
propagate their element types; an empty array produces the native missing value.
Code and Blocks can author the same reporter. Native export uses equivalent
`Math.pickRandom(values)` syntax. Non-array receivers and calls with arguments
remain unsupported. No new runtime opcode or graphics-editor tool is needed.

For example, `let chosen = actors._pickRandom(); chosen.x = 41` uses a native
sprite reference. In pseudocode the selection is
`set chosen to (random item of array reference (actors))`, followed by
`arcade set x of chosen to 41`.

### Multiplayer player values

Arcade supports `mp.playerSelector`, `mp.getPlayerByNumber`,
`mp.getPlayerByIndex`, `mp.allPlayers`, `mp.setPlayerSprite`,
`mp.getPlayerSprite`, `mp.getPlayerBySprite`, and `mp.getPlayerProperty`.
`mp.PlayerNumber`/`mp.PlayerProperty` constants and typed Player `index`/`number`
reads are supported. Each scene owns four stable player identities. Arrays from
`mp.allPlayers()` are copies; their elements retain player identity. Sprite
association retains exact Sprite references and distinguishes null from missing.
Older scene player references remain usable after pushing or popping a scene.

The Arcade extension exposes six corresponding Blocks operations. Pseudocode:

```text
set player to (arcade player by number (3))
arcade set sprite of player (player) to (actor)
set chosen to (arcade sprite of player (player))
arcade set x of chosen to 70
set number to (arcade player safe property (2) of (player))
```

Use `arcade all players`, `arcade player of sprite (actor)`, or lookup mode
`index` for the other operations. Property selector1 is index;2 is number.
Safe property queries return0 for a missing player; direct member reads retain
an error on missing players. Native export writes typed `mp.Player` references
and arrays and declares the bundled `multiplayer` dependency automatically.

### Multiplayer controller movement

`mp.moveWithButtons(player, vx?, vy?)` controls the player's assigned sprite.
Omitted or undefined speeds default to100; a zero speed leaves that axis under
program control. Movement settings can be assigned before the sprite. Replacing
the player's sprite detaches the old binding and binds the replacement. As in
PXT, detaching alone retains the old sprite's velocity.

The Arcade palette has a matching movement block. Equivalent pseudocode:

```text
set player to (arcade player by number (2))
arcade set sprite of player (player) to (actor)
arcade move player (player) with buttons vx (60) vy (0)
```

Choose Player1–4 in the controller pane. Directional inputs route independently;
switching players releases the previous player's held buttons. Keyboard input
and existing button hats still use player one. Each scene retains its own
movement bindings while physical button state is shared across scene push/pop.
Native export emits `mp.moveWithButtons` and the bundled multiplayer dependency.

Multiplayer connection/score/life events, direct `controller.player2/3/4`
API conversion, analog pressure, arbitrary player data, presence/indicator
effects and multiplayer networking remain explicit work. The local player
selector does not establish network connectivity. No new graphics tools were
added in this slice.


### Multiplayer button callbacks and queries

`mp.onButtonEvent(button, event, function (player) { ... })` supports pressed,
released and repeated callbacks with the actual scene-local `mp.Player`.
`mp.isButtonPressed(player, button)` reads that player's current input.
`mp.MultiplayerButton` supports A, B, Up, Right, Down and Left. Callback player
references retain identity and support sprite lookup and properties.
Native export emits the original APIs and the bundled multiplayer dependency.

The Arcade palette exposes a multiplayer registration command, matching handler
hat, event-player reporter and pressed query. Pseudocode uses the same operations:

```text
DEVICE arcade
WHEN flag clicked:
  arcade register multiplayer button (0) event (2049) as "pressed" capturing ""
WHEN arcade multiplayer button handler "pressed" runs:
  arcade set local player to arcade event player
  arcade change score by (arcade player member property (2) of (arcade local player))
```

Button selectors0–5 mean A/B/Up/Right/Down/Left. Event selectors2049/2048/2054
mean pressed/released/repeated. Registration and handler tokens must match.
Choose the player in the controller pane; both edges of a short tap are queued.
Repeated registrations replace the shared callback; direct player-one button
registrations can override that player's slot. Scene push/pop restores each
scene's registrations while physical held/repeat state stays shared.

Friendly button enum pickers and a callback authoring form that creates the
registration/handler pair remain GUI work. Custom repeat settings, direct
controller-instance APIs, connection events, network state and presence effects
remain separate gaps. Queued callback replacement races and long-running
handler timing still need dedicated differential qualification.


### Numeric player state

`mp.getPlayerState`, `mp.setPlayerState` and `mp.changePlayerStateBy` support
per-player numeric state. `MultiplayerState.score` and `.life` use the same
values as the Info APIs; their writes use PXT's integer conversion. Custom
states preserve fractional values. Missing custom states and missing players
read as0; missing-player writes do nothing.

`MultiplayerState.create()` allocates a fresh key at runtime, globally across
scenes. Built-in keys are0(score) and1(life), so custom keys start at2. Source
can reopen `namespace MultiplayerState` with exported keys using qualified or
unqualified `create()`. Export preserves runtime allocation and declares the
bundled multiplayer dependency.

The palette exposes key creation, state lookup, set and change blocks. Code:

```text
DEVICE arcade
WHEN flag clicked:
  set player to (arcade player by number (2))
  set cooldown to (arcade create player state key)
  arcade set state (cooldown) of player (player) to (7.5)
  arcade change state (cooldown) of player (player) by (0.25)
  set value to (arcade state (cooldown) of player (player))
  arcade set state (0) of player (player) to (10)
```

Custom states belong to the Player identity. An older scene's Player retains
its custom state; its score/life access uses the active scene's Info state,
matching PXT. Key allocation resets when the project starts again.

Arbitrary `player.data` objects and direct Player getState/setState method calls
remain named gaps. Friendly state-key labels/management and per-player Info HUD
rendering/layout need separate implementation and visual qualification. This
slice qualifies state values and controller-driven sprite behavior.

### Legacy color-coded maps

`scene.setTileMap(image, scale?)` and `scene.setTile(index, image, wall?)` now
use live image references and scene-owned tile definitions. The default scale
is16 pixels and the default tile wall flag is false. Standard TileScale values
and the numeric Location.tileSet property roundtrip through native Blocks and
export with the bundled color-coded-tilemap dependency. Exact-size tile images
remain live; cropped/padded tiles retain the original package's cached view.
Replacing/clearing a map preserves definitions; scene push/pop restores them.

```text
arcade set color-coded map image (mapImage) scale (4)
arcade set color tile (1) image (tileImage) wall (false)
set colorIndex to (arcade tile tileSet of (location))
```

The tile-location property block now has a real dropdown, preserving its
selected property through GUI loading. Legacy collision callbacks, mixed legacy/modern mutations and the dedicated
color-index map painter remain open. See the capability/GUI gap ledger and
[qualification receipt](receipts/2026-10-08-arcade-legacy-tilemap.json).

### Legacy Tile values and placement

`scene.getTile`, `scene.getTilesByType`, `scene.setTileAt`, `scene.place`,
`scene.placeOnRandomTile` and `Tile.place` now have native Blocks, pseudocode,
runtime and MakeCode export support. Legacy `tiles.Tile` values retain their
creating map and expose x/y/tileSet. Their arrays and procedure arguments/results
preserve identity and export as tiles.Tile/tiles.Tile[]. Modern tiles.Location
values remain a distinct type. Reading tileSet on a disabled legacy map throws,
matching the original simulator.

```text
set spot to (arcade color tile column (1) row (3))
set spots to (arcade color tile array index (6))
set center to (arcade color tile x of (spot))
arcade set color tile (spot) index (4)
arcade on color tile (spot) place sprite (actor)
arcade place sprite (actor) on random color tile (6)
```

The property block has an x/y/tileSet dropdown. The map painter, color-index
picker and map resource lifecycle remain separate GUI work; numeric index inputs
support authoring now. The same184 import-only baseline is100 translated,
83 partial and1 malformed. Two newly translated original examples execute in
Brickwright and original/exported MakeCode with matching finite sprite
observables. In the production GUI, the flower example responds to the visible
right controller button. These checks do not establish complete-game equivalence.
See the [qualification receipt](receipts/2026-10-08-arcade-legacy-tile-values.json).

### Legacy color-index wall callbacks — 2026-10-08

`scene.onHitTile`, `scene.tileHitFrom` and `Sprite.tileHitFrom` now have native
conversion, runtime and MakeCode export support. Three dialect words expose
registration, callback hats and the hit-index reporter in Blocks and pseudocode:

```text
arcade register color wall kind "Player" index (2) as "wallCallback" capturing []
WHEN arcade color wall handler "wallCallback" runs:
    set hit to (arcade sprite (arcade event first) wall hit index (2))
```

The callback sprite is the normal Arcade event-sprite handle; the converter
binds the authored callback parameter to it. The reporter's Blocks menu names
left/top/right/bottom and accepts numeric reporters. Callback captures remain
live. Registrations belong to their scene and restore after popScene. Matching
legacy handlers are selected before they run; newly registered handlers wait
for a later collision. Modern wall handlers are selected afterward and observe
sprite-kind changes. Obstacle color indices are snapshots and survive map edits.
Missing sprites report0; existing sprites without an obstacle report-1.

Qualification covers22 affected/regression tests, a final2-test rerun after the
menu change, and1 producer roundtrip, without skips. It covers original PXT,
native decompile, MakeCode export/reimport and SB3. Production gui.6891b0d9.js
passes file→Code→Blocks→visible A, including callback order ABCABC, captured
count25, index2 after a map edit, parent/child scene isolation and kind-change
order ABFABLF. Previous browser journeys and boot checks pass, with0 build/page
errors and unchanged4,360,525 initial bytes.

The same184 import-only baseline advances100/83/1→102 translated/81 partial/
1 malformed. Two newly translated originals run through the visible controller:
a wall collision resets the first player's position to50,50 and the second
advances to level2. Original/exported PXT with an explicit observer/input-driving
suffix agree on finite collision observables. Unchanged originals also step240
native frames without block errors or creator warnings. These observations do
not establish complete-game or full-screen equivalence.

**Open timing gap:** when a callback moves with nonzero velocity during pause,
the current original-wall-clock versus forced-native-frame probe reports final
x15 versus11.16796875. Callback order and index snapshots match. A trial ownership
lock matched x but changed obstacle clearing; it was removed. The passing
fixture holds velocity at0 during its pause. No timing freeze or workaround is
shipped. Next qualify comparable clocks and shared callback/physics scheduling,
then fix any demonstrated semantic defect. The map painter/color-index picker,
mixed map semantics, artwork packages, palettes, effects and music also remain
open. [Qualification receipt](receipts/2026-10-08-arcade-legacy-tile-collisions.json).

### Completed callback scheduling — 2026-10-08

The VM now reports `ARCADE_FRAME_END` after executing its threads. Arcade drains
completed function, creation and terrain callback waits at that point. This
lets the next inline handler resume before the following physics tick. Motion
continues during a yielding handler; the change adds no scene ownership lock.
No new dialect opcode or editor control is needed.

The original PXT and native wall-clock regression both verify that movement
continues during pause70, then the next legacy handler, modern wall handler and
caller observe the preceding handler's final position. Disabling the new
notification makes the regression fail: next-handler x8.61328125 versus previous
handler x9.890625. Thirty unique regressions pass, covering legacy collisions,
creation callbacks, yielding function results and scene registrations; the final
fixture has a separate one-test rerun. No test skips. Production gui.cf6a1da8.js
passes file import→Code→Blocks→green flag→visible A repeat with no page/block errors; boot
checks pass. The first direct-Code browser driver omitted imported image assets;
its failed runs are retained. The corrected driver imports the native project
through the file chooser, carrying code and costumes together. Initial JavaScript is4,360,555 bytes under unchanged4,467,136.

This closes the extra physics tick between completed callbacks. Absolute timing
compatibility remains open. With normal wall-clock schedulers, the original
fixture reproduced original x15/native12.4453125 in three trials before this
change. Afterward, a simplified pause20 case ends at original15/native13.72265625,
with no extra movement between the final callback observations. A pause0 case
matches x15 but reads original obstacle-1/native2. Real long-pause positions vary
with scheduling, so those probes are retained rather than treated as equality
gates. The runtime still advances33ms per VM tick although the default VM
interval is about16.7ms. PXT EventContext initializes its previous timestamp
immediately before its first frame, producing a near-zero initial delta; startup
phase and frame-polled waits also need qualification.

Next: establish one controlled monotonic timeline for VM waits and Arcade scene
frames, including initial zero delta, ordinary60Hz/compatibility30Hz operation,
yielding frame callbacks, pause0/20/70 and push/pop/restart. Compare event traces
and obstacle lifetimes against the pinned original scheduler before changing
shared physics timing. Do not introduce timing freezes or close this lane from
import counts. The last import-only corpus remains102 translated/81 partial/
1 malformed; it was not rerun for this runtime-only change. U03 painter and
resource lifecycle, ranked artwork/maps, palettes, effects and music remain open.
[Receipt](receipts/2026-10-08-arcade-callback-scheduling.json).

### Elapsed Arcade frame clock — 2026-10-08

Arcade now advances by elapsed VM millisecond time rather than a fixed33ms for
every tick. This removes the clock-rate mismatch at the default60Hz VM cadence.
The first VM tick seeds the baseline with0ms, and green flag/scheduler restart
reset it. Backward timestamps produce0ms, then rebase. Explicit offline frame
durations remain available; test helpers now state their deliberate33ms physics
step instead of relying on the production clock. Ordinary helper frames do not
fast-forward wait timers; controlled tests inject the VM clock as well.

Elapsed time during a pending registered scene callback is carried into the
next frame rather than discarded. Physics retains the original100ms per-move
clamp. A registered child-scene callback waiting70ms remains pending at80ms,
completes at100ms and reports scene elapsed120ms on the next frame. General
nested registration without a scene-stack selector remains an explicit
`game.onUpdate()` conversion gap; its reproducer is retained.

Qualification:60 affected tests pass without failures/skips. Thirty, sixty
and irregular ticks spanning1000ms match original PXT physics exactly:
x109.3359375,108.59375 and109.80859375, respectively, from x80/vx30. These small
differences between schedules are the original fixed-point rounding, not a
reason to replace the oracle with idealized floating-point motion. The comparison
uses the same explicit physics time schedule in each engine; it does not claim
complete original event-loop equivalence. Existing prompt, image, flag, speech,
collision and scene-registration behavior passes. An old prompt assertion was
updated for the reporter parentheses already emitted by the unchanged importer;
answer suspension and delivery remain checked.

Production gui.0f84bfdb.js passes native file→Code→Blocks→flag→visible A callback
repeat, plus a separate visible-right hold checking game time against VM wall
time and sprite motion. No page/block/build errors; boot checks pass. Initial
JavaScript4,360,790 bytes remains below unchanged4,467,136.

Remaining: first scene-worker phase versus first VM tick, push/pop, legacy
update hats versus sequential registered callbacks, nested registrations outside
the scene-stack path, and original whole-loop pause0/20/70/obstacle ordering.
The clock follows the VM's existing millisecond source; this does not certify
all system-clock adjustments or background scheduler behavior. Next unify the
registration paths and qualify these traces against the original scheduler.
U03 painter/resource lifecycle and ranked artwork, palette/effect/music gaps
remain open. No importer/corpus promotion is claimed: last184 import-only
102 translated/81 partial/1 malformed, not rerun here.
[Receipt](receipts/2026-10-08-arcade-frame-clock.json).

### Unified frame callback registration — 2026-10-08

`game.onUpdate` and `game.onUpdateInterval` now use scene-owned runtime
registrations without requiring `game.pushScene()` elsewhere in the program.
Registration occurs at the authored call site, including inside procedures.
Repeated installation creates distinct captured cells; callbacks from one
installation share live cells. Interval expressions are evaluated at registration.
A yielding update completes before its next inline successor runs.

Captured assignments now export their Arcade value type, preserving booleans
instead of coercing them to Scratch numeric values. Shadowed `game` bindings,
invalid arity and non-inline callbacks remain diagnosed.

Qualification: 22 affected tests pass without failures/skips. Original and
exported MakeCode simulators agree on order `IAaB`, sum25 and one completed
installation. Native execution, decompilation, MakeCode reimport and SB3 reload
retain those observations; repeat input produces `IAaBAaB`, sum54 and two
installations. The registered100ms interval ignores a later assignment of1ms.
Production `gui.13e19d9b.js` passes native file→Code→Blocks→flag→visible A repeat;
no page/block/build errors. Initial JavaScript 4,360,790 bytes remains below the
unchanged4,467,136 limit; boot checks pass.

GUI handoff: existing registration, named callback, local/captured value and
assignment blocks/pseudocode words support these programs. No new producer pin
or opcode was needed. Dedicated callback authoring guidance and the remaining
editor/map-painter/resource work still need their separate GUI qualification.

The same184 immutable apps still report102 translated/81 partial/1 malformed,
with no changed diagnostic rows. These are import-only results. Other callback
families still depend on scene-stack selection for their native registration
path; first scene-worker phase, push/pop, legacy authored hats and whole-loop
pause/obstacle ordering remain open. This section supersedes the prior nested
frame-registration gap; it does not establish full event-loop compatibility.
Exact-head hosted CI and stacked integration remain pending.
[Receipt](receipts/2026-10-08-arcade-update-registration.json).

### Unified controller callback registration — 2026-10-08

`controller.A/B/up/down/left/right.onEvent` now registers at its authored call
site without requiring a scene-stack program. Nested procedures retain live
captured cells; registering the same button/event replaces its earlier handler.
Pressed, Released and Repeated retain their original event values, including
dynamic event expressions passed through procedures. Released callbacks observe
mutations made by the matching pressed callback. Invalid callbacks and shadowed
controller/event namespace bindings remain diagnosed.

Qualification:27 distinct affected tests pass after10 focused final reruns;
no skips. The initial regression run had26 passes and one failure: a firework
test sent A before execution reached registration. It now sends real keyboard
input after setup and verifies no launch beforehand; the original failure is
retained. Background, flags, controller bindings, scenes and frame callbacks
remain covered. Original/exported PXT and native/decompile/reimport/SB3 agree
on trace `P7R8P10R11`, two presses/releases, three installations and a held-right
repeat. Native short taps deliver both edges with no intervening frame. Exact
wall-clock repeat counts and whole-loop startup timing are not claimed.

GUI: existing native button registration, event menu, named callback and
local/captured-value blocks/pseudocode cover this path. Production `gui.0cc1f4bb.js`
passes native file→Code→Blocks→flag→visible A/B/A, plus held-right repeat, with
no page/block/build errors. Initial JavaScript 4,360,790 bytes is below the
unchanged4,467,136 budget; boot checks pass. No new opcode/producer pin is needed.
Dedicated callback authoring guidance and graphics/resource editor work remain
separate GUI tasks.

The same184 immutable apps remain102 translated/81 partial/1 malformed with
zero changed diagnostic rows; this is an import-only measure. Forever,
life/countdown and sprite overlap/destruction registration paths still need
unification. Initial phase, push/pop, legacy authored hats and whole-loop
pause/obstacle ordering remain open, as do U03 painter/resource lifecycle and
ranked artwork/palette/effect/music gaps. Exact-head hosted CI and stacked
integration remain pending.
[Receipt](receipts/2026-10-08-arcade-button-registration.json).

### Unified life-zero and countdown registration — 2026-10-08

`info.onLifeZero`, player1–4 life-zero callbacks and `info.onCountdownEnd` now
register at their authored call sites without a scene-stack selector. Repeated
registration replaces the matching handler and retains live shared captures.
Programs containing these callbacks use native player life/score state and its
hasLife/hasScore queries. Assigning zero or negative life invokes the appropriate
handler without an artificial positive-life prerequisite; revival rearms it.
Countdown handlers can continue play and run again after a new countdown.

Original and exported PXT agree with native/decompile/reimport/SB3 on trace
`L9M10T10`, revived life2/player2 life3 and one callback of each kind. Visible A
input and original PXT input agree on `L9M10T10L10M11T11` with two of each callback.
Existing registration, callback, player-state and local/captured-value blocks
and pseudocode words cover this path; no producer pin/opcode change is needed.
Dedicated callback authoring guidance and graphics/resource editor work remain
separate GUI tasks.

Qualification:88 distinct affected tests pass after focused reruns, no skips:
61 Arcade tests,14 gate-inventory checks and13 source-policy/legacy Tile checks.
The broad suite's old fixed-target assumptions were replaced with native VM
coordinate, neighbour-write, velocity, geometry, trigonometry and20-case compound
operator observations. Timed-spawn checks now distinguish the immediate first
spawn from the newest periodic spawn. Initial failures remain in private evidence.
Four callback browser journeys are now wired into hosted CI; the inventory
recognizes Node module preloads while still rejecting mere mentions/preload-only
commands. A legacy Tile test now resolves shared value state through the audited
VM source helper.

Production `gui.b9f5aa3d.js` passes native file→Code→Blocks→flag→visible A revival and
countdown repeat, plus all three preceding callback journeys on that bundle.
No page/block/build errors; boot checks pass. Initial JavaScript 4,360,790 bytes
is below the unchanged4,467,136 budget.

The same184 immutable apps still report102 translated/81 partial/1 malformed,
with zero changed diagnostic rows: an import-only measure. Forever and sprite
overlap/destruction registration, first phase, push/pop and whole-loop pause/
obstacle timing remain open. Legacy authored hats and variable-based info paths
outside these callback-bearing/native scene programs remain separate boundaries.
U03 painter/resource lifecycle and ranked artwork/palette/effect/music gaps are
still tracked. The preceding controller head's hosted build had44 unit failures
and heavy browser camera/pixel/physics/speech failures. This slice repairs some
local contracts; it does not claim overall hosted integration is green. Next
finish that gate cleanup alongside the remaining callback families. Exact-head
CI and stacked integration remain pending.
[Receipt](receipts/2026-10-08-arcade-info-registration.json).


### Scene-owned forever closures — 2026-10-08

Source `94882c6a57d9f32462ec2579efc56fe2d9e35e45` routes `forever`, `game.forever` and `basic.forever` through native registrations at their execution sites, independently of scene-stack calls. Nested calls preserve live captured locals and yielding order. Invalid callback arguments and shadowed API bindings stay explicit diagnostics. Existing scene-local runtime registries suspend new iterations while another scene is active; the pending-frame regression requires elapsed time to survive a callback pause.

All61 affected checks pass after reruns,0 skips. Original and exported PXT agree with native/decompile/reimport/SB3 on finite trace `S12E13S14E15`. Production `gui.4e20cd56.js` passes native file import→Code→Blocks→Run→visible A→From blocks plus all four prior callback journeys,0 page/block/build errors. Initial payload remains4,360,790 bytes under the unchanged limit. Same184 import-only102/81/1,0 changed diagnostic rows. Initial failures remain privately archived.

The native Blocks command is `arcade register forever as TOKEN capturing CAPTURES`, paired with `when arcade forever handler TOKEN runs`; Code decompilation retains the pair. Captures are shared cells of the enclosing function. Dedicated guidance for creating callback pairs and editing captures remains a GUI task. Sprite callback unification, common startup/scene/obstacle timing and the remaining hosted export/browser gates are still open. [Receipt](receipts/2026-10-08-arcade-scene-continuation.json).


### Scene-owned sprite overlap and destruction closures — 2026-10-08

Source `d606023f2455a0e0a213da65a34d76a31ed91445` routes `sprites.onOverlap` and `sprites.onDestroyed` through native registrations at their execution sites, independently of scene-stack calls. Nested handlers preserve shared captured locals, both event sprite arguments, and sequential destruction handlers across pauses. Invalid callbacks and shadowed API/kind bindings remain explicit diagnostics. Destruction before registration and skipped conditional registrations do not invoke callbacks. Existing authored legacy hats remain available.

All57 affected checks pass after focused reruns,0 skips. Original/exported PXT and native/decompile/reimport/SB3 agree on finite repeated-input trace `O12D13:20d14B14X16O16D17:20d18B18X20`, four destruction callback invocations and one remaining player. Production `gui.3c9f1746.js` passes native file→Code→Blocks→Run→visible A→From blocks and all five preceding callback journeys,0 page/block/build errors. Initial payload remains4,360,790 bytes. Same184 import-only102/81/1; one existing destruction refusal now explicitly names its unrendered effect/duration. No compatibility promotion or full-game equivalence is claimed.

Native Blocks use `arcade register overlap kind … with kind … as TOKEN capturing CAPTURES` and `arcade register destroyed kind … as TOKEN capturing CAPTURES`, paired with their overlap/destroyed-kind handler hats. Code decompilation retains the pairs and maps event sprites to callback locals. Dedicated callback-pair/capture guidance remains a GUI task. Instance destruction captures, nested parallel calls, common startup/scene/obstacle timing, effects and remaining hosted export/browser gates remain open. [Receipt](receipts/2026-10-08-arcade-sprite-registration.json).


### Instance destruction callback captures — 2026-10-08

Source `a0500049b29809f2a2f69b41e47ed7eb9a78ccb0` imports typed `Sprite.onDestroyed` calls using the common live-capture registration machinery. Registration replaces the previous instance callback and stays bound to the actual sprite when its variable changes. Number and boolean captures survive the enclosing procedure; yielding instance handlers complete before kind handlers and the caller resumes. Invalid callback signatures remain explicit diagnostics. Existing authored destruction words remain readable.

Original/exported PXT and native/decompile/reimport/SB3 agree on repeated-input trace `I12i13KXI14i15KY`. Producer dialect checks pass230/230. Browser gate inventory checks pass21/21. Same184 import-only102/81/1,0 changed diagnostic rows. Initial schema-sync and premature-observation test failures are preserved privately. All23 distinct affected Arcade checks pass after a focused rerun,0 skips.

Code and Blocks now expose `arcade register instance destruction of ID as TOKEN capturing CAPTURES` and `when arcade instance destruction handler TOKEN runs`. The visible file→Code→Blocks→Run→controller A→From blocks test is wired to the hosted heavy shard. A fresh production bundle and visible GUI execution are pending; this source qualification does not substitute for those gates. Dedicated callback-pair/capture guidance remains open. Nested parallel call timing/captures are next, alongside scene/startup timing, corpus gaps and hosted integration failures. [Receipt](receipts/2026-10-08-arcade-instance-registration.json).


### Parallel execution at call sites — 2026-10-08

Source `9697810a2529b1b6aaaa31e7dc9699d5dad828ee` imports `control.runInParallel` as a one-shot launch at its execution site. Each call queues an independent VM thread and the caller continues without awaiting it. Nested inline callbacks retain live number/boolean cells after the enclosing procedure returns; repeated calls have separate invocation cells. Unexecuted branches launch nothing. Invalid signatures and shadowed `control` bindings remain diagnostics.

All38 affected checks pass,0 skips:16 Arcade,1 canonical SPIKE artifact and21 browser gate inventory checks. Producer dialect232/232 passes. Original/exported PXT and native/decompile/reimport/SB3 agree on repeated-input trace `L12SP12Q13E13N13L14P14Q15E15N15`. Concurrent launches across scene push/pop agree on total26; native stop/restart cancels old queued work and launches one fresh fiber. The SPIKE gate now names the new producer pin and passes its unchanged artifact behavior assertions, resolving the observed parent build refusal.

Code and Blocks expose `arcade run parallel as TOKEN capturing CAPTURES` and `when arcade parallel handler TOKEN runs`; export reconstructs `control.runInParallel(function () { … })`. The visible file→Code→Blocks→Run→A→From blocks test is wired to the hosted heavy shard. Eight GUI journeys are prepared, including instance destruction. The local cold production build was interrupted when shared-host swap was exhausted; no fresh bundle or visible GUI result is claimed. Exact-head hosted build and browser checks remain required. Callback-pair/capture guidance and function-valued callbacks remain GUI/conversion tasks.

Same184 import-only102/81/1,0 changed diagnostic rows. The largest next group is10 unreadable backgrounds: each references a named asset or external image namespace. Audit complete original project resources and dependencies before treating these as renderer gaps. Next groups include7 tilemap-resource refusals and7 destruction effect/duration refusals. Recover actual assets with provenance; do not substitute blank art or count unavailable inputs as implemented features. Scene/startup timing and overall hosted integration remain open. [Receipt](receipts/2026-10-08-arcade-parallel-registration.json).
