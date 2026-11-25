# Signed current in a 5 ms passive capture

Owner: Circuit/instrument integration maintainer. Status: DONE, 2026-11-05; PR1656 merged as `e1f3d152b912db90baf917227a3b46a111b2dac3`.
Base: `5922efcb237223f1a8ef9eb935eb7397a71e7aec`.

Own one new `test/circuit-signed-current-5ms.test.mjs` and this claim leaf.
Use two newly authored RC cases with opposite source polarities, a 5 ms / 1 MHz
capture, actual installed `bwc measure`, and current meters at both resistor
terminals. Freeze the component values, clock, whole-capture limits, signed
terminal convention and tolerances before observing the CLI. Compare all 5,000
voltage samples and both signed meter-window readings against independent analytic
expectations. Include a meaningful nonzero reversed-current negative; preserve
CLI refusals and output handling.

An independent ngspice 42 comparison of the new reference covers 5,001 time-grid
points per polarity including t=0; it is reference evidence only. Report actual
CLI outcomes separately. Do not replay the earlier completed circuit cohort,
change historical seals or source pins, or infer physical calibration. The Lite
S040 package/binding owner keeps its existing paths. Qualify the installed-pinned
CLI test on hosted CI and keep sample count, budget and tolerances unchanged;
no model, importer, runtime, workflow, pin, lock or deployment change is owned.

Reference preparation: analytic signed current and a separate trapezoidal
integral agree for both polarities. Frozen newly authored ngspice 42 inputs agree
with analytic voltage and source current over 5,001 points per polarity; worst
errors are 8.54 nV and 10.2 pA, and integrated current differs by 41.1 pA.
These are independent reference observations. On the installed Lite pins,
[Build42120820267](https://github.com/CrispStrobe/brickwright/actions/runs/42120820267)
passed both actual CLI cases and the comparator's reversed-current and nonfinite
controls. The original log retains assertions, not exact observed values. This
is no physical calibration or broad corpus claim.
