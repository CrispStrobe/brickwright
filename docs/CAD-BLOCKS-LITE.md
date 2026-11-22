# CAD shapes: modelling with blocks and pseudocode

Enable **Settings → Workspace → CAD Editor**, then add the **CAD shapes**
extension. The model stays parametric, transforms wrap what they act on, and the
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
does not execute its body. It compiles the body into a Brickwright CAD code object
named after the model, one per colour (`name`, then `name (#rrggbb)`). Running it
again updates those objects as one undo step. Parameter overrides made in CAD are
kept, and colour parts the model no longer has are removed. The CAD Editor opens
lazily when needed.

**Right-click** a model block, or any block inside one:

- **Build CAD model** builds it without running the script.
- **Show CAD code…** shows the model as parametric CAD Script, OpenSCAD
  (Customizer parameters, `.scad`) or JSCAD (`getParameterDefinitions()`, `.js`),
  to copy or download. It needs only the CAD SDK, so the editor stays closed.
- **Live preview** rebuilds the model about 0.4 s after each edit of the project
  while it is on (per model block, until switched off or the block is deleted).

- **Shapes**: box, cylinder, cone, sphere, half sphere, tube, torus, wedge, roof,
  round roof, pyramid, polygon, star, heart, paraboloid and text. All are in
  millimetres and centred on their own origin.
- **C-blocks**: move, rotate, scale, mirror, color, group, hole, intersect, hull,
  and count with. Each wraps the shapes it acts on; there is no hidden selection.
  `hole` cuts every solid of its group, or
  of the model, also through moves, loops and ifs. `color` paints what it wraps
  (picked colour; the innermost colour wins); a group is one solid, so it takes
  one colour.
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
`runtime.cadShapes.exportModel(blockId, target, name, 'cadcode' | 'openscad' | 'jscad')`
returns a model's text. OpenSCAD and JSCAD keep colours (`color()`, `colorize()`).
JSCAD draws text in its own single-stroke font at the same cap height.

Pseudocode words are `lib/cadShapesDialect.js`. Each C-block header ends in `:`
with an indented body, read through the compiler's `parseBodyHeader` hook
(`lib/cad-shapes-pseudocode.js`). The Code tab's Python and JavaScript views keep
models too, and read back to the same blocks:

```python
with _cadshapes.model("Peg board"):
    _cadshapes.box((holes * 12), 20, 4)
    for _ in range(int(holes)):
        with _cadshapes.move(pos, 0, 0):
            with _cadshapes.hole():
                _cadshapes.cylinder(3, 10, 48)
        pos += 12
```

```javascript
_cadshapes.model("Peg board", () => {
  _cadshapes.box((holes * 12), 20, 4);
  ...
});
```

The `_cadshapes` driver in that code runs each body once and builds nothing; the
blocks build the model. The `with` and `() => { … }` readers and `parseBodyHeader`
are sb3-creator doors (upstream `layered-c-block-hooks` test); lite vendors them.

Tests: `test/cad-shapes-dialect.test.mjs` round-trips every word through blocks,
pseudocode, Python and JavaScript, and runs the generated Python and JavaScript.
`test/cad-shapes-vm.test.mjs` runs models in the real Scratch VM through the
bridge and the pinned SDK (colour parts, live preview after a block edit, all three
exports). It also tests the code dialog and the right-click menu, and checks
extension defaults against the SDK's shape table.
