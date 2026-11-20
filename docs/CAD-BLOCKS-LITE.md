# CAD shapes: modelling with blocks and pseudocode

Enable **Settings → Workspace → CAD Editor**, then add the **CAD shapes**
extension. The blocks follow TinkerCAD's Codeblocks palette, with three
differences: the model stays parametric, transforms wrap what they act on, and the
same program is readable as pseudocode.

```text
WHEN green flag clicked:
  set holes to 4
  cad model "Peg board":
    set pos to (0 - ((holes - 1) * 12 / 2))
    cad box (holes * 12) by 20 by 4
    REPEAT holes:
      cad move x pos y 0 z 0:
        cad hole:
          cad cylinder radius 3 height 10 sides 48
      change pos by 12
```

**build CAD model [name]** is a C-block. Running it (green flag, or a click)
does not execute its body. It compiles the body into one Brickwright CAD code body
named after the model. Running it again updates that object as one undo step;
local parameter overrides made in CAD are kept. The CAD Editor opens lazily when
needed.

- **Shapes**: box, cylinder, cone, sphere, half sphere, tube, torus, wedge, roof,
  round roof, pyramid, polygon, star, heart, paraboloid and text. All are in
  millimetres and centred on their own origin.
- **C-blocks**: move, rotate, scale, mirror, group, hole, intersect, hull, and
  count with. Each wraps the shapes it acts on; there is no hidden selection.
  `hole` works like TinkerCAD's hole shapes: it cuts every solid of its group, or
  of the model, also through moves, loops and ifs.
- **Scratch blocks inside a model**: `repeat`, `if`/`if else`, `set`/`change`
  variable, the arithmetic, comparison and logic operators, `round`, the maths
  functions, and `pick random`. Random values are fixed per block, so a model is
  reproducible.
- **Parameters**: a Scratch variable the model reads but never sets becomes a
  model parameter with the variable's current value. When its stage monitor is a
  slider, the slider range is included.

The model is compiled by Brickwright CAD's block compiler (`compileBlocksToCadScript`
in the pinned SDK; see Brickwright CAD `docs/CAD-BLOCKS.md`). Variables become named
formulas and loop accumulators become closed formulas. Anything that cannot be
expressed that way is reported on the block concerned instead of being guessed.
`runtime.cadShapes.exportModel(blockId, target, name, 'openscad' | 'jscad')`
returns the parametric OpenSCAD or JSCAD text of a model.

Pseudocode words are `lib/cadShapesDialect.js`. Each C-block header ends in `:`
with an indented body, read through the compiler's `parseBodyHeader` hook
(`lib/cad-shapes-pseudocode.js`). Python/JavaScript views do not yet carry models.

Tests: `test/cad-shapes-dialect.test.mjs` round-trips every word through blocks and
pseudocode. `test/cad-shapes-vm.test.mjs` runs a model in the real Scratch VM
through the bridge and the pinned SDK, and checks extension defaults against the
SDK's shape table.
