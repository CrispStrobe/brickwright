# Current-consumer and imported-circuit measurement campaign

DONE — bounded five-item consumer acceptance and public result reconciliation.
The limits and unclaimed follow-ons are recorded below. Codex circuit/instrument owner. Initial Lite base
`23ec908232f6d4c4604ed6f7dcb23b75af19053d`; isolated branch
`lane/circuit-measurement-next-claim-20261025`. Merge this claim before
implementation or the new operational campaign. The previous five-item
sequence is closed; its results retain their original source identities.

## Repository authority and boundaries

Work only in the operator-owned CrispStrobe repositories. Here a shared source
authority means `CrispStrobe/bw-board` for electrical models/integration and
`CrispStrobe/bw-circuit-ui` for import/export and instruments. It never means
patching or contacting a third-party original. Lite consumes exact qualified
packages; do not create a local model/importer fork or silently change pins.

This claim owns the ordered campaign, its operational readback, this file and
the campaign sections of `PLAN.md`, `ROADMAP.md` and
`docs/CIRCUIT-INSTRUMENT-REGRESSION.md`. Phase 1 uses the existing manual fixed
CLI workflow, runner and independent oracle with no source or workflow edit.
Any needed harness extension, imported-case harness, model patch or instrument
implementation requires a measured exact-path envelope and the appropriate
repository's separately merged claim before those implementation edits.
Do not reserve whole repositories or take unrelated owners' paths.

Preserve release/TestFlight, model delivery, Robot Lab, x86, SPIKE and Arcade
ownership. Aperture/audio is already adopted through Lite PR1338 and CUI PR118;
retain its actual capture, browser, WAV and lifecycle proofs rather than
reimplementing it. The release owner retains v0.1.27 distribution/readback;
this campaign performs no release upload, signing, deployment or hardware flash.

## Five ordered acceptance steps

1. **Current-consumer baseline.** Freeze the exact consumer, Board
   `761153ff92d521c01107ee7b32922ba7adc10ee2` and CUI
   `91d8434a79d373cef2837c137ab356356f1a3b44`, case inputs, oracle equations,
   tolerances, reader code and expected runtime joins before measurement.
   Dispatch the existing 312-case campaign once after source admission; no
   duplicate run or old-source result relabelling. Acquire original outputs
   once after metadata admission and independently audit the 264 ngspice and
   48 explicitly nominal cases, topology/input hashes, complete traces, signed
   currents, meter windows, missing/refused cases and retained negatives.
   Preserve every original failure and correct its actual cause before moving on.
2. **Imported-circuit campaign.** Reconcile a frozen licensed inventory and
   classify the historical failure/partial groups against their exact old
   receipts before selecting about 300 distinct supported or explicit-refusal
   schematic inputs. Stratify useful resistor/filter/diode/transistor/op-amp/
   regulator circuits; distinguish unique records, topology families and
   parameter variants. Use meaningful differential-voltage and signed-current
   probes, time traces and multimeter windows with independent SPICE or
   explicitly stated analytical expectations. Freeze selection and bounds
   before execution. Publish requested, attempted, comparable, passed, failed,
   partial, refused and not-run counts without dropping inconvenient rows.
   Private originals remain private; only reviewed redistributable inputs or
   independently authored minimal reproducers may enter public repositories,
   workflows, logs or artifacts. Heavy work runs in owned hosted CI.
3. **Repair demonstrated recurring causes.** Isolate minimal reproducers and
   assign each failure to import loss, dependencies, unsupported physics,
   solver/integration, acquisition or the oracle/harness. Fix high-value shared
   causes in the appropriate owned repository, with load-bearing negative or
   mutation proof and unchanged original acceptance bounds. Recheck the affected
   strata and adopt one purposeful qualified package batch. Unsupported physics
   must refuse honestly; do not fake convergence or substitute a convenient model.
4. **One existing part's accuracy.** Start with the implemented LM741 unless
   current ownership or evidence establishes a better bounded existing part.
   Admit a lawful independent reference and specify rails, load, saturation,
   frequency response and slew limits before testing. Distinguish nominal-model
   agreement from part-specific accuracy. Correct only demonstrated deviations
   within a stated model domain, then qualify actual packaged CLI/GUI behavior.
5. **One demonstrated instrument-physics gap.** Audit existing probe loading,
   coupling, capture, bandwidth and range behavior first. Implement one missing
   deterministic measurement-chain effect justified by that audit, preserving
   ideal/raw acquisition and identifying the actual modeled effect in CLI
   receipts and GUI labels. Require analytical/SPICE time-domain controls,
   actual CLI/multimeter/scope evidence, real built-GUI lifecycle controls and
   a load-bearing negative. Do not add decorative noise or infer physical ADC
   accuracy, hardware calibration or acoustics from a display or audio filter.

## Qualification and endpoint

Maintain shared-package source identity only within these owned repositories. Require
all enabled exact-head checks, affected clean application/guest qualification
and independently admitted originals before normal matched-head merges.
Keep every original failed receipt. No threshold, deadline, row census, refusal
or required observation may be weakened merely to get green. No automatic
rerun of a completed experiment, force push, foreign-repository patch or
unsupported physical/full-corpus claim. Poll hosted status at most once per
minute, in batches, and do not run heavy builds or simulations on the workspace
host. Stop after the fifth accepted step and reconcile results, remaining
limits and narrowly scoped future work in the public handoff.

## Step 1 result / remaining ownership

ClaimPR1370 landed as `4c416bcfe1a219faaec371ac638f607628f347a7` after all
four enabled source-policy checks succeeded; only the new lane file changed.
The frozen operational branch has that exact commit. The single
[baseline40172711900](https://github.com/CrispStrobe/brickwright/actions/runs/40172711900)
passes independent original-only admission: 312/312 cases, 87,488 numerical
checks, 4,448 retained files and matching installed source/runtime identities.
All 240 waveform CSVs equal the preceding retained baseline; no original was
replayed. Full hashes and limits are in the
[result handoff](../docs/CIRCUIT-INSTRUMENT-REGRESSION.md).

Step 2 evidence is collected with explicit unsupported/refusal states:307
source-admitted graph-distinct structures,67 pass/8 partial/4 disagree/228
not-run at unchanged bounds. ActualCLI 32-input cross-checks yield19 consistent
cases,169 conservation checks and 81 descriptive oracle agreements,with unknown
reference-method eligibility. Two requested long RC watch captures refuse
before artifacts; their references remain not-run. No waveform or physical
accuracy claim is manufactured. The private research cohort is not public
redistribution clearance or a balanced300-design teaching catalogue.

Step3 is accepted: owned CUI PR120 landed408c179a and Lite PR1397 adopted it
at `7f9edea2cc648d7139d1f57099d5121361d48a01`, with both actual built-GUI
PMOS journeys and all34 enabled checks successful. Six declared conditional
skips remain explicit. The one affected307-input native recheck preserved
previous observable results; it did not qualify unknown reference methods.

Steps4–5 have qualified shared-source implementations. Board PR704 corrects
unmodelled supply-current false zero without changing a device law; the LM741
assessment distinguishes endpoint/continuous mean and unsupported rail current.
CUI PR122 supplies opt-in ideal ADC reconstruction of actual primary voltage
point samples, preserving the raw/default path. The single
[final package lane](2026-10-25-meter-adc-package-adoption.md) owns their
consumer qualification and campaign reconciliation. PR1413 matched-merged as
`b26ae0aedde4e53a254b0bc48c83b156be7cb026`: 36 successful checks, six
source-declared skips, and accepted original-log readback of 10 new browser
checks, six preserved browser checks and three required unit checks. Actual
checkout/reviewed/landed trees match. The protected312 recheck retains its
original source/run identity, including its original whole-head rejection.
Earlier intermittent mode-publication/rearm causes remain open. The current
success does not prove a causal product fix, compiled-artifact provenance,
physical part/ADC calibration, release or deployment. See the
[result handoff](../docs/CIRCUIT-INSTRUMENT-REGRESSION.md) and
[unclaimed follow-ons](../ROADMAP.md#scoped-follow-ons-after-consumer-acceptance).
The fifth-item endpoint is reached; ask for the next priority and stop.
