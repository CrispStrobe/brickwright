# Browser gate source repairs — 2026-11-27

The original gate-shape scanner and all its baselines remain unchanged.
After the separate Git executable-authority repair cleared the first failure,
the complete scan exposed five appearance-only findings, three truncated-path
findings and one silently skipped controller census. These were repaired at
their source sites.

| Site | Concrete repair |
| --- | --- |
| Costume toolbar | After the public Close action, require the Send to CAD dialog to become hidden. |
| CP1 CP5 browser | After collapsing the instruments panel, require all eight live switch controls to be hidden before measuring the narrow workbench; their later re-expansion and hit-target checks remain. |
| Owned console | After input submission and real worker completion, require both the input form and Stop control to disappear. |
| Shared 3D navigation | Each CAD/Robots tab switch requires the other editor canvas to be hidden before exercising camera input. |
| Gallery artwork | Require the Robot Lab examples dialog to disappear after Close; retain full origin and directory identity for index and catalog requests. |
| Robot Lab startup downloads | Compare complete model request routes, including origin and base path, instead of final filenames. |
| Controller widget census | Read the actual shipped `examples/` controller files, fail on missing/unreadable members and empty coverage, and remove the obsolete optional `static/` walk. |

The census now observes **14 controller files, 98 widgets, 26 content-sized**.
Previously, it searched a directory with no controller files and returned
without asserting any coverage. A valid controller beside malformed JSON must
now fail; an empty corpus and a controller without a widget list also fail.

`test/browser-request-inventory.test.mjs` executes the request callbacks from
the actual browser scripts with controlled requests. It proves that matching
basenames from another origin or an obsolete base directory remain distinct,
and drives the gallery's real index verdict in both directions. These controls
do not launch browsers or substitute editor implementations.

Local validation:

```sh
node --import ./scripts/lib/register-gui-scope.mjs --test \
  test/gate-shapes.test.mjs \
  test/controller-widget-editor.test.mjs \
  test/browser-request-inventory.test.mjs
```

Result: **21/21 passed, zero skips**, with a writable `TMPDIR` and
`BW_TEST_TMPDIR`. The full scanner passes without any additional allow marker,
baseline increase or narrowed search scope.

This result qualifies the source controls and scanner. It does not record a
fresh execution of the browser journeys; their actual CI callers, served build,
browser prerequisites, fixture inputs and retained runtime evidence are the
separate browser-wiring checkpoint.
