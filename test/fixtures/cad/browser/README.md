# Pinned inputs for the CAD browser gates

The DWG and STEP browser checks require specific external geometry. These files
make those inputs available from the repository, with no CI download or mutable
branch lookup. `provenance.json` records full source commits, Git blob identities,
SHA256 hashes, sizes, licenses and the DWG reproduction recipe.

| Input | Bytes | SHA256 |
| --- | ---: | --- |
| `inch-plate.dwg` | 6,448 | `8f84ee202b78ae048d584a35adf00c46c8df933e995fb35718940dca79464b5a` |
| `Adafruit3777.step` | 112,694 | `12e0fa54576085011cc9f5221ad95aca62d565e051d995523d192d0a65797ce3` |

## Sources and reproduction

The DWG comes from the [canonical CrispCAD fixture factory](https://github.com/CrispStrobe/CrispCAD/blob/7b736aa0407584af9b2b276917e97a2a2740a2aa/tests/sketch-dwg-fixture.ts)
at the CAD SDK commit used when the fixture was first recorded. CrispCAD was
formerly named `CrispStrobe/brickwright-cad`. Its source is retained unchanged
here as `sketch-dwg-fixture.ts`, with the upstream BSD 3-Clause license. The
current SDK `02287df59bdb8ba7f3685a9241dd6b299276b1c3` retains the same factory
Git blob `8ec6f4e2771d1297450dafa03081b4e8e1c62492`. The original source and
license commits remain recorded; the top-level `cadSdk` identity and generation
worker identify the current reviewed reproduction inputs.

The default factory builds a closed 2 by 1 inch CUT outline with a bulged and
variable-width first segment, a separate GUIDES line and a paper-space circle.
Those features are the existing browser gate's scale, layer, paper-space and
round-trip witnesses. No geometry was simplified to satisfy the gate.

Reproduce it with the repository's Node 24 runtime:

```sh
TZ=UTC node scripts/gen-cad-browser-dwg-fixture.mjs
```

The generator verifies the factory and the exact bundled DWG worker hashes. It
uses the worker's existing codec classes, strips the factory's TypeScript
non-null assertions with Node's type stripper, and binds its original import to
those classes. The factory's runtime expressions and default options are
preserved. The clock is fixed at 2026-01-01 UTC and UUIDs use a recorded sequence,
so metadata does not change the fixture. Two fresh contexts must produce
identical bytes. The unmodified worker read protocol must decode both CUT and
GUIDES before the file is written. A changed codec or factory fails before
generation; updating the SDK requires a reviewed provenance update.

The STEP is the unchanged [Adafruit 3777 TT Motor source](https://github.com/adafruit/Adafruit_CAD_Parts/blob/9f2a89f3d5c3491886d58cb7fe83385417563cf4/3777%20TT%20Motor/3777%20TT%20Motor.step),
under the accompanying MIT license. It is also the identical Git blob retained
in the [pinned CrispCAD source archive](https://github.com/CrispStrobe/CrispCAD/blob/7b736aa0407584af9b2b276917e97a2a2740a2aa/library/sources/adafruit-motors/3777%20TT%20Motor/3777%20TT%20Motor.step).
The browser gate uses the generic `import` command (Import STL or STEP geometry)
and still requires eight colored reference bodies, print exclusion and a complete
SB3 save/reopen cycle. SDK `02287df` retains that version-30 path. Its separate
`import-step` command imports exact B-rep bodies at version 45; adding that route
does not change this generic-import contract or qualify it through this proof.

## Admission and validation

Both browser commands verify byte count and SHA256 before creating a browser.
They give Playwright the validated bytes, so a later file replacement cannot
substitute a different input after validation. The commands still accept an
explicit fixture path, but the bytes must match the reviewed fixture identity.

```sh
node --import ./scripts/lib/register-gui-scope.mjs --test \
  test/cad-browser-fixtures.test.mjs test/no-nul-in-text.test.mjs
```

Controls verify source/license Git blobs, the shipping SDK identity, two fresh
DWG reproductions, rejection of altered generator inputs, and refusal of both
same-size and truncated fixtures. Same-size mutants run through the actual
browser command entry points and must fail before browser launch. The NUL gate
classifies `.dwg` by its binary format; STEP, STP, DXF and source files remain
text and reject the same NUL bytes. There is no per-filename exemption.

These controls establish reproducible inputs and fail-closed admission. The
actual import/export and UI results belong to the served-build browser runs;
fixture reproduction alone is not a browser qualification.
