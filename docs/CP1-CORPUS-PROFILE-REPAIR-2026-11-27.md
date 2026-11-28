# CP1 corpus and part-profile qualification repair — 2026-11-27

## Result

The three consumer gates pass together: **23 tests, 23 passed, zero skipped**.
The repaired assertions cover the existing shipping sources: Board
`cc18f3c8d84d68e008450e65ddf838b8ec03c7f7`, Circuit UI
`0a1b15edb0daecd723c7c07126450d84b86e3e68`, and the supplier corpus at
`1c29f69fd22c86ecb0051938eedb246921cb3b88`. This checkpoint changes no pin,
example circuit, CP1 listing, engine model, emitter capability or physics threshold.

| Gate | Reproduced failure | Repair |
| --- | --- | --- |
| `bw-parts-conformance.test.mjs` | Fourteen registered kinds lacked reviewed profiles. | Classify their existing model behavior in the established refusal vocabulary; regenerate `PART-PROFILES.md`. |
| `declared-pins-wired.test.mjs` | Eleven valid internal CP1 lessons had zero external nets; the next assertion also counted circuit-only lessons in pseudocode extractor yield. | Validate the narrow internal-machine role and reject every unexplained empty circuit; retain the 25% yield threshold on actual program text. |
| `circuit-corpus-invariants.test.mjs` | The exact coverage assertion still expected 1650 files, before checking its collected endpoint failures. | Renew the exact count to 1947 from immutable upstream membership. All electrical and placement assertions pass unchanged. |

## CP1: an internal bus is not an external net

The installed Board sources define `kosmos-cp1` as a whole-system connector.
`src/devices/cp1.js` delegates execution to `Cp1Machine`; its real device has
40 terminals. `src/cp1-extract.js` requires a single execution target, validates
the fixed 6 MHz configuration and expansion selection, and states that the
internal CPU bus is fixed by the machine schematic.

The eleven bare circuits each load successfully as one real CP1 part with all
40 terminals and zero external nets. Their catalog entries point to successfully
assembled CP1 listings containing no port instructions:

- `cp1-first-display`, `cp1-descending-sum`, `cp1-crate-division`
- `cp1-lookup-card`, `cp1-instruction-patch`, `cp1-batch-ticker`
- `cp1-display-postcard`, `cp1-dual-workbench`, `cp1-fraction-stream`
- `cp1-tile-bundles`, `cp1-wide-tile-count`

`test/helpers/onboard-cp1-circuit.mjs` establishes this role from the catalog,
authored source, canonical circuit and solver board, actual registered device,
canonical machine extraction and parsed listing. It requires exactly one CP1,
no authored wires/jumpers/nets, no declared pseudocode pins, real terminals in
both loaded views and the registry, consistent valid machine configurations,
and a nonempty instruction listing with no `P1E`, `P1A`, `P2A`, `P3E`, `P4A`
or `P5A` cells. Numeric cell notation is checked through the same assembler.
The role is structural and source-based; it does not claim to prove arbitrary
self-modifying programs cannot manufacture new instructions.

All 45 CP1 lessons with external components remain on the electrical path.
The tolerance for unexplained empty external circuits is now **zero**, replacing
the former allowance of one. Existing pin, affordance, device-only, alias and
ratchet controls remain active. `kosmos-cp1` also joins the instrument's explicit
multi-terminal fallback check.

The new negative controls drive the actual classification with wrong metadata,
missing/extra parts, a dangling wire, a hole jumper, malformed nets, unsupported
clock and expansion values, a missing registry, `a/b` fallback terminals,
netlist errors and an empty canonical board. Program controls include all six
valid I/O instructions with CP3 enabled, numeric `17.001`, empty/data-only/invalid
source, and the real `cp1-blink` lesson with its wires and then its peripherals
removed. The real internal-display lesson is accepted before and after these
negative cases.

The instrument reports **774 catalog entries, 191 noncomment pseudocode
sources, 145 PIN-bearing sources, 748 circuits, 737 nonempty external netlists
and 11 validated internal CP1 listings**. The 25% extractor-yield threshold is
unchanged and now measures the 191 actual sources. A direct parser canary checks
digital, dotted-port and analog declarations, comment-only lessons, and a real
program shape with neither `DEVICE` nor `PIN`; the latter must still contribute
to the denominator.

## Reviewed profiles

These additions catalog existing behavior; they add no emitter verbs or
verb/family claims. Microtronic's host classification carries the existing
reviewed candidate from consumer PR #1846.

| Reason | Added kinds | Installed model authority |
| --- | --- | --- |
| `host` | `busch-microtronic`, `kosmos-cp1` | Whole teaching computers executing their own instruction listings in their panels. |
| `passive` | `ptc_sensor`, `humidity_comb`, `induction_loop`, `coil_pendulum` | `devices/sensing-parts.js`: resistive sensors, coupled winding and induced/motional EMF. |
| `passive` | `dipole`, `ceramic_filter`, `spark_gap` | `devices/radio-parts.js`, `devices/spark-gap.js`: antenna/filter and voltage-triggered breakdown gap. |
| `analog-only` | `bending_ruler`, `cd4046` | `devices/sensing-parts.js`, `devices/pll-4046.js`: Hall displacement output and PLL/VCO controlled by the circuit. |
| `analog-only` | `sa612`, `fm_if`, `dual_gate_mosfet` | `mixer-ic.js`, `devices/mixer-ic-parts.js`, `fm-if-ic.js`, `dual-gate-mosfet.js`: mixer, limiter/detector and dual-gate transistor stages. |

The official generator produced the updated
[`PART-PROFILES.md`](generated/PART-PROFILES.md). Its passive, host and
analog-only categories contain 65, 24 and 54 kinds respectively. The profile
conformance gate still checks complete registry coverage, unique classification,
closed refusal vocabulary, emitter verb agreement, derived family agreement
and generated-document freshness. `scripts/integrate.mjs` synchronized the
package mirror successfully; the two profile source files are byte-identical.

## Exact circuit inventory

The inventory uses the gate's existing glob: one example directory followed by
`circuit.json` or `circuit.<device>.json`. Comparing the supplier git trees gives:

| Tree | Circuit files | Change |
| --- | ---: | --- |
| `2dace046a449041124e64729433f353668022a58` | 1650 | Previously asserted cohort. |
| `1c29f69fd22c86ecb0051938eedb246921cb3b88` | 1946 | Adds 56 `cp1-*` and 240 `lab-*` base circuits; removes none. |
| Current consumer overlay | 1947 | Exactly that pinned file set plus `busch-microtronic-wired-io/circuit.json`. |

The extra canonical Microtronic circuit was integrated in consumer commit
`d45e87a32252c6413ab32be4ec0c752950a5fbd6` (PR #1845). No pinned upstream
circuit is missing locally and no other local-only circuit matches the glob.
The gate retains its exact count and adds named cohort anchors. Its endpoint,
reachability, flyback, controller-placement, pot-clearance and seated-part
checks all pass without exemptions or threshold changes.

## Reproduction

Run from the consumer root with a writable temporary directory:

```sh
TMPDIR=/workspace/scratch/6490e3182008/test-temp \
BW_TEST_TMPDIR=/workspace/scratch/6490e3182008/test-temp \
node --import ./scripts/lib/register-gui-scope.mjs --test \
  test/bw-parts-conformance.test.mjs \
  test/declared-pins-wired.test.mjs \
  test/circuit-corpus-invariants.test.mjs
```

Result: **23/23**, zero skips. The official derivation and mirror steps are
`node --import ./scripts/lib/register-gui-scope.mjs scripts/gen-part-profiles.mjs`
and `node scripts/integrate.mjs`.
