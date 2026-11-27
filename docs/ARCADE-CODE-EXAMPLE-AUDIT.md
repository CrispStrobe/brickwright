# Code example exports to MakeCode Arcade

The example audit reads the Code menu, its two source banks and the Circuit catalogue from this checkout. The Code menu contains 62 examples. It includes 52 Arcade candidates and 10 explicitly targeted 8051 or 8086 programs. The source banks contain another 15 archived games outside the menu.

The Circuit catalogue contains 807 rows. Of those, 79 publish no program, 537 publish a comment-only description, 179 declare a dedicated device, and 11 provide Controller- or circuit-dependent programs without a dedicated device. `pybadge01-hello` is the remaining structural candidate. It uses Brickwright Controller variables, so any successful Arcade compilation still needs a display and input behavior check. These 68 structural candidates are the export census.

## Run the audit

Use a fixed source checkout with the pinned, integrated MakeCode target and its browser simulator.

```sh
node --import ./scripts/lib/register-gui-scope.mjs scripts/audit-code-arcade-examples.mjs \
  --inventory --report /tmp/arcade-inventory.json

node --import ./scripts/lib/register-gui-scope.mjs scripts/audit-code-arcade-examples.mjs \
  --simulate --report /tmp/arcade-examples.json
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing Chromium executable. Repeat `--only EXAMPLE_ID` to rerun selected rows. Prefix Circuit items with `circuit:`. Use `--portable` to exclude simulated browser pointer support. Add `--output DIRECTORY` to save each converted MakeCode project with its outcome and hash in the report. The source tree, dependency scope and PXT files must stay fixed until the audit completes. The comparison hashes and per-example results are written atomically after each candidate. Record the PXT source hash before reusing an earlier compiler or browser result. The source opcodes identify which programs need targeted reruns after an exporter change.

The receipt records source conversion warnings, asset adaptations, compiler diagnostics and browser results separately. A generic browser check sends controller input and verifies a complete 160×120 frame from the original simulator. The shipped games also check their title gate before sending input. A game-specific check asserts the named mechanism described in its result. The Scratch versions of those checks and the remaining per-title gameplay acceptance inventory live in [pseudocode-game-examples.test.mjs](../test/pseudocode-game-examples.test.mjs).

## Verified changes

- Rift Rally now uses separate Arcade controllers for W/S and Up/Down. The real PXT simulator kept the right paddle at 0 while W moved the left paddle to 135. ArrowDown then moved only the right paddle to −135. All three variable monitors became visible after serve, with 13 colors and 15 observed screen publications in the run.
- Scratch variable monitors display their current values as compact Arcade labels. Saved visible monitors appear on startup. Show and hide blocks update the same monitor by its saved variable ID.
- Browser pointer support follows the bundled MakeCode Arcade browser-events library. A real click hit the visibly upper sprite first, then the lower sprite after the upper sprite hid. The click position also converted to the expected Scratch coordinates. A physical Arcade board needs alternate button controls for mouse-dependent games.

- Scratch motion uses Arcade’s sprite direction, rotation, scale and timing APIs. A real browser run moved an actor north and east, verified its normalized heading and uniform size, and waited for an exact glide destination.
- Arcade delivers a typed answer back to the Scratch script. The Complete Game demo compiles and boots with its game-over prompt and answer comparison intact.
- Canal Command lifted four boats through legal on-screen gate and pump actions. Flux Vault accepted the three authored keyboard solutions and registered 14 pushes. Vector Seven moved its paddle to Scratch x=120 and launched the serve toward its rival.
- Sigil Grid accepted the upper-left tap and the solo rival placed its reply in the center. This verifies the opening and reply. The original forced-win and replay acceptance checks still apply.

- Color and ghost effects use Arcade’s palette and dithered transparency. The browser test rotated a red costume’s hue and verified 32 tinted and 32 transparent pixels in the 8×8 sprite. This is a palette rendering approximation.

Open items include each game’s complete victory, loss and restart sequence on the exported runtime, alongside any refusal recorded by the current census. Palette conversion, embedded audio fidelity and hardware input parity need separate evidence.
