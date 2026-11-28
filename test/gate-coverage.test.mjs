/**
 * A browser gate that CI never runs decays into decoration.
 *
 * THE EVIDENCE THIS RESTS ON (swept 2026-08-27, against a current build, with
 * the servers and PROOF_URL each script expects — so these are not setup
 * failures):
 *
 *   17 scripts/verify-*.mjs are referenced by no workflow. FOUR still pass.
 *   THIRTEEN do not. Two more had already rotted and were repaired that day:
 *   verify-debugger-solo could not get past its first click (a starter overlay
 *   it never dismissed, a textarea the editor stopped being, and two button
 *   titles from a UI model that no longer exists), and verify-labwired-engine
 *   was written and simply never wired in.
 *
 * The failures are not interesting individually — they are stale selectors and
 * expired assumptions, exactly what happens to any check nothing exercises. The
 * structural point is that NOTHING NOTICED. Each one was written to catch a
 * regression its author had just been bitten by, and each stopped being able to.
 *
 * So: a new gate must be wired into a workflow, or listed below as knowingly
 * unwired. The list is a ratchet, not a blessing — it should only ever shrink.
 * Adding to it is a deliberate act that shows up in review; forgetting to wire
 * a gate in is not.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {directlyExecutesGate} from '../scripts/lib/gate-execution.mjs';
import {directlyExecutesPromisifiedGate} from '../scripts/lib/gate-promisified-exec.mjs';
import {stepReferenceProblems} from '../scripts/lib/workflow-step-refs.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

/**
 * Gates that no workflow runs, with their state when this list was made.
 * REMOVE an entry by wiring the gate into .github/workflows/build.yml — after
 * making it pass, which for most of these means bringing it up to the current
 * UI rather than tweaking a selector.
 */
// The complete source-frozen historical report is not an admission list.
// Only entries with independently documented manual/local scope in the reviewed
// audit may enter KNOWN_UNWIRED. The other entries remain explicit failures.
// Source identity, new-orphan, newly-wired and missing-entry checks stay active.
const inheritedInventory = JSON.parse(readFileSync(
    new URL('./fixtures/gate-coverage-inherited.json', import.meta.url), 'utf8'));
const documentedScopeSource = readFileSync(new URL(
    '../docs/receipts/2026-11-28-cowgol-gate-wiring-audit.json', import.meta.url), 'utf8');
const documentedScopeAudit = JSON.parse(documentedScopeSource);
const scopeSignature = scope => {
    if (!scope || !['manual_command', 'local_scope_or_historical_receipt'].includes(scope.category) ||
        !Array.isArray(scope.evidence) || !scope.evidence.length ||
        scope.evidence.some(item => typeof item.path !== 'string' || !item.path.startsWith('docs/') ||
            !Number.isInteger(item.line) || item.line < 1 ||
            (item.endLine !== undefined && (!Number.isInteger(item.endLine) || item.endLine < item.line)))) return null;
    return JSON.stringify([scope.script, scope.category,
        scope.evidence.map(item => [item.path, item.line, item.endLine ?? null]), scope.match ?? null]);
};
const documentedScopeFor = (entry, audit) => {
    const matches = audit.documented.filter(scope => scope.script === 'scripts/' + entry.name);
    if (matches.length !== 1) return null;
    const signature = scopeSignature(matches[0]);
    return signature !== null && signature === scopeSignature(entry.documentedScope) ? matches[0] : null;
};
const documentedInventoryReasons = (inventory, audit) => Object.fromEntries(inventory.entries.flatMap(entry => {
    const scope = documentedScopeFor(entry, audit);
    if (!scope) return [];
    return [[entry.name, 'documented ' + scope.category + ' at ' + inventory.verifiedCommit + ': ' + entry.purpose +
        '. Requires ' + entry.prerequisites + '. Evidence: ' +
        scope.evidence.map(item => item.path + ':' + item.line +
            (item.endLine === undefined ? '' : '-' + item.endLine)).join(', ') + '. ' +
        (entry.pendingWiring ? 'Pending PR #' + entry.pendingWiring.pullRequest + ' at ' +
            entry.pendingWiring.commit + '; that wiring is not adopted here. ' : 'No pending wiring owner is recorded. ') +
        'No current execution or pass is claimed.']];
}));
const inheritedReasons = documentedInventoryReasons(inheritedInventory, documentedScopeAudit);

const gitBlobSha = source => {
    const bytes = Buffer.isBuffer(source) ? source : Buffer.from(source);
    return createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
};

const frozenInventoryProblems = (entries, sourceFor) => {
    const problems = [], seen = new Set();
    for (const entry of entries) {
        const name = entry.name;
        if (typeof name !== 'string' || !/^(?:verify|smoke|oracle)-[\w-]+\.mjs$/.test(name) || seen.has(name)) {
            problems.push('invalid or duplicate inherited gate name: ' + String(name));
        } else {
            seen.add(name);
            if (!/^[0-9a-f]{40}$/.test(entry.blobSha || '') ||
                typeof entry.purpose !== 'string' || !entry.purpose.trim() ||
                typeof entry.prerequisites !== 'string' || !entry.prerequisites.trim()) {
                problems.push('incomplete inherited gate state: ' + name);
            }
            const owner = entry.pendingWiring;
            if (owner !== null && (!owner || !Number.isInteger(owner.pullRequest) || owner.pullRequest <= 0 ||
                !/^[0-9a-f]{40}$/.test(owner.commit || ''))) {
                problems.push('invalid pending wiring provenance: ' + name);
            }
            const source = sourceFor(name);
            if (source === undefined) problems.push('missing inherited gate: ' + name);
            else if (gitBlobSha(source) !== entry.blobSha) problems.push('changed inherited gate source: ' + name);
        }
    }
    return problems;
};

const unlistedGates = (gates, known, wired) => gates.filter(gate => !wired(gate) && !(gate in known));
const newlyWiredKnown = (known, wired) => Object.keys(known).filter(wired);

const KNOWN_UNWIRED = {
    ...inheritedReasons,
    'verify-sim-floor-contact.mjs': 'retained historical bw.9 scalar-output reader, not executed by current CI. It binds the historical manifest engine integrity to the checkout pin and rejects a later engine pin; run it only in the matching historical source/pin checkout against its retained original eight-case output. Current affected-engine qualification executes scripts/verify-sim-floor-contact-current.mjs in test/bw-sim-sarrus-lift.test.mjs, including missing-case rejection. The source-equivalence check in test/sim-engine-admission.test.mjs does not execute this historical reader or qualify its retained outputs.',
    'verify-multi-board-radio.mjs': 'manual/local: frames the pinned MakeCode micro:bit and Calliope mini simulators side by side through scripts/makecode/host.html and checks the radio relay and motor report (A held, B held, relay cut). It drives the host pages and message protocol from a plain page, not the built app, so it does not show the React pane; test/multi-board-radio-pair.test.mjs covers the per-board compile it loads. Not wired: it needs both served simulator trees and has no reading in browser-gate-readings.json yet',
    'verify-makecode-assets-roundtrip.mjs': 'opt-in live external editor qualification: imports the GUI-exported duplicate-animation .mkcd into arcade.makecode.com, edits Assets through native controls and returns its PNG to Brickwright. Routine CI must not depend on a mutable external editor/network. Passed four journeys against Arcade4.1.25/PXT13.1.23, zero final page errors, on2026-10-07. Run the wired verify-arcade-animation-resource-browser.mjs first, then node scripts/verify-makecode-assets-roundtrip.mjs --input test-results/arcade-animation-resource-browser/animation-duplicate-libraries.mkcd --out test-results/makecode-assets-roundtrip/current.json --bw-url http://localhost:8617/. The offline native-envelope tests and existing Arcade GUI export/reimport gates remain mandatory.',
    'verify-arcade-background-corpus.mjs': 'manual/local: reads programs from the private MakeCode corpus (CrispStrobe/brickwright-firmware-private compat-corpora/makecode/arcade, set BW_ARCADE_CORPUS or check it out beside this repo); the corpus is test data that is never committed here, so CI cannot reach it. Ported from the parked WIP (open task F3); passed against that corpus on main 2026-10-07.',
    'verify-arcade-lazy-value-corpus.mjs': 'manual/local: reads programs from the private MakeCode corpus (CrispStrobe/brickwright-firmware-private compat-corpora/makecode/arcade, set BW_ARCADE_CORPUS or check it out beside this repo); the corpus is test data that is never committed here, so CI cannot reach it. Ported from the parked WIP (open task F3); passed against that corpus on main 2026-10-07.',
    'verify-arcade-literal-image-corpus.mjs': 'manual/local: reads programs from the private MakeCode corpus (CrispStrobe/brickwright-firmware-private compat-corpora/makecode/arcade, set BW_ARCADE_CORPUS or check it out beside this repo); the corpus is test data that is never committed here, so CI cannot reach it. Ported from the parked WIP (open task F3); passed against that corpus on main 2026-10-07.',
    'verify-arcade-nested-array-corpus.mjs': 'manual/local: reads programs from the private MakeCode corpus (CrispStrobe/brickwright-firmware-private compat-corpora/makecode/arcade, set BW_ARCADE_CORPUS or check it out beside this repo); the corpus is test data that is never committed here, so CI cannot reach it. Ported from the parked WIP (open task F3); passed against that corpus on main 2026-10-07.',
    'verify-arcade-optional-corpus.mjs': 'manual/local: reads programs from the private MakeCode corpus (CrispStrobe/brickwright-firmware-private compat-corpora/makecode/arcade, set BW_ARCADE_CORPUS or check it out beside this repo); the corpus is test data that is never committed here, so CI cannot reach it. Ported from the parked WIP (open task F3); passed against that corpus on main 2026-10-07.',
    'verify-arcade-projectile-corpus.mjs': 'manual/local: reads programs from the private MakeCode corpus (CrispStrobe/brickwright-firmware-private compat-corpora/makecode/arcade, set BW_ARCADE_CORPUS or check it out beside this repo); the corpus is test data that is never committed here, so CI cannot reach it. Ported from the parked WIP (open task F3); passed against that corpus on main 2026-10-07.',
    'verify-arcade-reference-array-corpus.mjs': 'manual/local: reads programs from the private MakeCode corpus (CrispStrobe/brickwright-firmware-private compat-corpora/makecode/arcade, set BW_ARCADE_CORPUS or check it out beside this repo); the corpus is test data that is never committed here, so CI cannot reach it. Ported from the parked WIP (open task F3); passed against that corpus on main 2026-10-07.',
    'verify-spike-code-guest-browser.mjs': 'manual/local: requires our locally compiled program-capable ARM guest, '
        + 'a pinned local Renode package, proof driver and GUI build. Seven Code/web-presence checks exercise '
        + 'the real guest through a semantic test transport; receipts must stay private. Source compiler/session '
        + 'and broker checks run in CI. See docs/SPIKE-FIRMWARE-PROGRAMS.md; this is not a Tauri ACL proof.',
    'verify-spike-renode-arena-browser.mjs': 'manual/local: requires an immutable locally built own ARM demo, '
        + 'a pinned Renode package and the compiled tools/renode-arena-proof driver. Execution receipts stay '
        + 'in the private evidence repo. Five real-guest production GUI checks passed; see docs/SPIKE-ARENA.md '
        + 'for the staging/build commands and BW_RENODE_ARENA_PROOF_DRIVER. This transport proof does not '
        + 'replace the wired Tauri webview boundary gates.',
    'verify-i80386-doom-real-browser.mjs': 'manual/local: requires exact external FreeDOS 1.4 '
        + 'floppy and rights-cleared short-demo Doom HDD. It checks Chromium Widgets physical keyboard, '
        + 'a nontrivial 320x200 guest and visible canvas frame, then the 24-gametic timedemo result and C: prompt. '
        + 'Run with DOOM_FREEDOS_IMAGE and DOOM_SHORT_HDD after building the GUI; routine CI has no licensed media.',
    'verify-i80386-freedos-real-browser.mjs': 'manual/local: real FreeDOS 1.4 acceptance in a browser. '
        + 'CANNOT run in CI, and this is the script\'s own contract rather than a judgement about it — it '
        + 'throws immediately unless FREEDOS_IMAGE and FREEDOS_HDD point at local media, and its header says '
        + 'those images "stay outside this repo". Its expected hashes also bind it to one qualified image, one '
        + 'generated type-1 HDD and a fixed viewport, so a CI-fetchable substitute would not satisfy it. '
        + 'Run `FREEDOS_IMAGE=/path/to/x86BOOT-1200.img FREEDOS_HDD=/path/to/type1-hdd.img '
        + 'npm run verify:i80386-freedos-real-browser`.',
    'verify-machine-video-boot.mjs': 'manual/local: launches the real ELKS lesson and verifies video and '
        + 'fullscreen in the built GUI. It downloads the pinned floppy unless ELKS_IMG points to a local copy. '
        + 'Run `node scripts/verify-machine-video-boot.mjs` after building the GUI.',
    'verify-soft-core-synth.mjs': 'manual/local + network: sends the PicoRV32 soft-core example through the '
        + 'LIVE hosted Gowin flow (Yosys -> nextpnr -> gowin_pack) and asserts a real Tang Nano 20K bitstream '
        + 'comes back — ~170s of place-and-route against synth.crispstro.be, which routine CI must not depend '
        + 'on (it self-skips exit 2 when the service is unreachable). The example\'s shape and its tab call path '
        + 'are gated offline by test/fpga-soft-core.test.mjs, and that it is reachable in a real browser by a '
        + 'check folded into the wired scripts/verify-fpga-surface.mjs. Run `node scripts/verify-soft-core-synth.mjs`.',
    // NO FPGA ENTRY REMAINS. verify-fpga-builder.mjs left on 2026-09-23, the
    // second of the two to go, and it is the more delicate departure: its FULL
    // form qualifies the exact deployable candidate against the LIVE hosted
    // synthesis service, and that cannot run in routine CI. What is wired is
    // FPGA_SKIP_SYNTH=1, which omits the synthesis round trip and the
    // demo-circuit journey — so the job runs a REDUCED form of this gate, and
    // its step is named "NO synthesis; not the release receipt" so the reduction
    // travels with it instead of living in a list nobody reads at release time.
    //
    // Running it reduced still beats not running it, because an unrun gate rots:
    // this one had, and the rot was exactly the shape its own header warns about.
    // `following-sibling::details[2]` from the Verilog heading no longer found
    // the canvas (the page grew sections above it) and resolved to two <summary>
    // elements at once; then an unconditional click on a disclosure that ships
    // OPEN shut it, and the gate timed out on a canvas it had hidden itself; and
    // the RAM checks drove a toolbar button with a testid that existed in no file
    // but that one — RAM is a palette item now. All three were repaired against
    // the flag-on artifact of b910ef07a, where the reduced form passes 5 checks,
    // and the Verilog check was falsified by asking for a wire name the design
    // does not have (the first attempt, swapping `&` for `|` inside the regex,
    // PASSED — `|` is alternation, so the mutant pattern still matched; a
    // mutation that cannot fail proves nothing about the check).
    //
    // verify-fpga-surface.mjs LEFT this list on 2026-09-22: the follow-up its own
    // entry named — "wiring a dedicated flag-on browser job" — is now the
    // `fpga-surface` job in build.yml, which builds flag-on (with @yowasp/yosys,
    // which flag-on webpack resolves for real) and runs the drive with
    // BW_FPGA_REQUIRE_SURFACE=1, so the script's flag-off SKIP cannot make it a
    // green check that proves nothing. Evidence it is not decoration, all against
    // the flag-on github-pages artifact of a83ce3c27: 19 checks pass; with the
    // FPGA tab locator mutated to match nothing the job's mode exits 1 naming the
    // tab while the manual mode still exits 0 SKIP; and with the circuit never
    // built, grading cannot pass and the drive goes red. The list shrank, which
    // is the only direction it is allowed to move.
    //
    // Before that entry this was empty, and both entries that were briefly here
    // on 2026-09-03 were WRONG:
    //
    //   smoke-debugger.mjs — recorded as "runs nowhere". It has run on EVERY build since it was
    //     written, through `npm run smoke:debugger`, exiting 2 for want of sdcc and being
    //     downgraded to a warning. `runInvokesGate` could not see an npm ALIAS, so widening this
    //     inventory manufactured a false orphan in the list built to prevent decay. bw-ci caught
    //     it. Alias resolution below closes the blind spot; build.yml now supplies sdcc and the
    //     stc-compiler checkout so the step exercises the debugger instead of announcing it cannot.
    //   oracle-simavr.mjs — not a gate at all. Its header: "Optional local oracle runner. The GPL
    //     simulator is never bundled or linked." Reclassified below, not listed here.
    //
    // An entry here is a gate nothing runs. Adding one is a deliberate act that shows up in
    // review; being WRONG about one sends the next reader to do work already done.
    'verify-cad-fasteners.mjs': 'manual/local (added 2f2a25f00, 2026-11-18): drives the embedded CAD tab of a served GUI (PROOF_URL, default http://127.0.0.1:8150/) in Chrome at the macOS app path (BW_BROWSER_EXECUTABLE overrides) and imports createPresetDocument/screwVariant from a built sibling CAD checkout (CAD_CHECKOUT, default ../circuit-cad-engine-work). Checks screw head/point parameters, exact Undo and trusted touch without a model edit. CI has neither the CAD checkout dist nor that browser path, so it is not wired; its only recorded pass is the local qualification in docs/ROBOT-CAD-EDITOR-PARITY.md, and it has no reading in browser-gate-readings.json.',
    'verify-editor-trackpad.mjs': 'manual/local (added 65463f90c, 2026-11-17): headless WebKit against a served GUI (PROOF_URL, default http://127.0.0.1:8150/) for Blocks wheel/pinch through the native input contract and CAD editing after simulation Stop. The native AppKit trackpad routing it accompanies is checked separately on the Mac; the recorded pass ("nine real-GUI input checks") is in docs/evidence/2026-11-17-quasar-workpiece-cycle.md. Not wired: no CI job serves the GUI for it and it has no reading in browser-gate-readings.json.',
    'verify-quasar-coupling.mjs': 'manual/local (added 695203c6f, reworked 65463f90c, 2026-11-17): couples the packaged quasar.sb3 circuit to the CAD geometry/physics dist of a sibling CAD checkout (argv[2], default ../brickwright-cad) and runs the three-stage press cycle. CI has no built CAD checkout, so it is not wired; its recorded pass ("three complete cycles") is docs/evidence/2026-11-17-quasar-workpiece-cycle.md. The CI-run cad-robot project verifiers cover the archive bytes, not this coupled trajectory.',
};

const workflowTexts = readdirSync(path.join(ROOT, '.github/workflows'))
    .filter(f => f.endsWith('.yml'))
    .map(f => readFileSync(path.join(ROOT, '.github/workflows', f), 'utf8'));

// Only shell in a step's `run:` value executes. A gate name in a comment,
// step name, environment value, or `echo` must not make an orphaned gate look
// protected. This intentionally supports the small YAML subset GitHub Actions
// uses for run scalars without adding a production YAML dependency to the test.
const workflowRunScalars = text => {
    const lines = text.split('\n');
    const scalars = [];
    for (let index = 0; index < lines.length; index++) {
        const match = lines[index].match(/^(\s*)(?:-\s*)?run:\s*(.*)$/);
        if (!match) continue;
        const [, indent, value] = match;
        if (value && !/^[|>][-+]?\s*(?:#.*)?$/.test(value)) {
            scalars.push(value);
            continue;
        }
        const block = [];
        while (index + 1 < lines.length) {
            const next = lines[index + 1];
            if (!next.trim()) {
                block.push('');
                index++;
                continue;
            }
            const nextIndent = next.match(/^\s*/)[0].length;
            if (nextIndent <= indent.length) break;
            block.push(next.slice(indent.length + 1));
            index++;
        }
        scalars.push(block.join('\n'));
    }
    return scalars;
};

const shellQuote = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Exec wrappers count as running the gate. `xvfb-run -a dbus-run-session -- node scripts/x.mjs`
// runs x.mjs; without this the e2e harness read as orphaned for seven hours while CI was
// executing it on every push that touched its paths. The list is a WHITELIST, not a free prefix:
// the strictness exists so a gate named in an `echo` cannot look protected, and `echo` is not a
// wrapper. Each token must be a wrapper name, a flag, `--`, or a timeout duration.
const WRAPPERS = '(?:xvfb-run|dbus-run-session|timeout|env|nice|stdbuf|setsid|--|-{1,2}[A-Za-z0-9-]+|\\d+[smh]?)';
// Node's module preload precedes the entry script; it does not replace it.
const NODE_IMPORTS = `(?:--import(?:=|\\s+)(?:"[^"]+"|'[^']+'|[^\\s]+)\\s+)*`;
const runInvokesGate = (run, gate) => new RegExp(
    `(?:^|[;&|]\\s*)\\s*(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\\s]+)\\s+)*` +
    `(?:${WRAPPERS}\\s+)*` +
    `node\\s+${NODE_IMPORTS}(?:\\./)?scripts/${shellQuote(gate)}(?=\\s|$)`,
    'm'
).test(run);
const workflowRuns = workflowTexts.flatMap(workflowRunScalars);
// A gate is exercised either by a workflow `run:` OR by a test file, because CI runs the whole
// Node suite. Widening the inventory past `verify-*` surfaced `oracle-trace` and
// `oracle-differential`, which ARE exercised — through tests — and calling them "unwired" would
// have been false. The distinction that matters is exercised-by-something versus run-by-nothing:
// `smoke-debugger` and `oracle-simavr` are referenced by no test and no workflow at all.
//
// Comment-stripped, so a gate NAMED in a comment does not look covered. That is the same trap as
// a `doesNotMatch` reading its own documentation, one direction over.
// Excluding THIS file, because KNOWN_UNWIRED names its entries as string literals — so reading
// every test would make each documented-orphan look exercised by the very list that documents it
// as an orphan. Caught by the paired assertion below firing in the opposite direction, which is
// the argument for having both.
const testSources = readdirSync(path.join(ROOT, 'test'))
    .filter(f => f.endsWith('.test.mjs') && f !== 'gate-coverage.test.mjs')
    .map(f => { const raw = readFileSync(path.join(ROOT, 'test', f), 'utf8'); return {file: f, raw, text: raw
        .replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')}; });
// npm-script ALIASES count as invocations. build.yml reaches the debugger smoke test through
// `npm run smoke:debugger`, which `runInvokesGate` — looking for a literal `node scripts/<gate>` —
// could not see. That blind spot manufactured a false orphan. A gate that cannot fail reports
// green when it should be red; this is the MIRROR, an inventory reporting orphaned when the thing
// is running, and it wastes the reader on work already done.
const packageScripts = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts || {};
const aliasInvokes = (run, gate, scripts = packageScripts) => Object.entries(scripts)
    .filter(([, body]) => runInvokesGate(body, gate))
    .some(([alias]) => new RegExp(
        // THE SAME ENV-PREFIX CLAUSE runInvokesGate has carried all along, and its
        // absence here was a real asymmetry: `PROOF_URL=… node scripts/x.mjs`
        // counted and `PROOF_URL=… npm run verify:x` did not, though they run the
        // same gate. Two browser gates and one hardware gate were reported as
        // wired only because a TEST happened to name them, and two more lanes
        // wrote the direct `node` form specifically to dodge this — which is a
        // check shaping the code around it rather than measuring it.
        //
        // The WRAPPER clause comes with it, for the same reason and by the same
        // argument: `timeout 600 npm run verify:x` runs the gate exactly as
        // `timeout 600 node scripts/x.mjs` does, and the whitelist is what keeps
        // `echo npm run verify:x` from counting. Two spellings of one fact had
        // two different rules; now they have one.
        `(?:^|[;&|]\\s*)\\s*(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\\s]+)\\s+)*` +
        `(?:${WRAPPERS}\\s+)*` +
        `npm\\s+run\\s+${shellQuote(alias)}(?=\\s|$)`, 'm').test(run));

/**
 * TWO FACTS, NOT ONE, and collapsing them is what let three gates read as wired
 * while nothing ran them.
 *
 * The old rule was `run by a workflow OR the string appears in some test`. The
 * second half is not a claim that anything RUNS the gate — a test that asserts
 * build.yml mentions a script names that script, and so did the gate. Reported
 * together, "exercised by something" quietly included "written down somewhere".
 *
 * So: RUN BY A WORKFLOW is a `run:` scalar that invokes it, directly or through
 * an npm alias. EXERCISED BY A TEST imports the gate or passes its path as the
 * actual Node/fork entry argument. Immutable values and called local wrappers
 * can carry that path; an unrelated spawn elsewhere cannot. Anything else is a
 * MENTION, which is worth reporting and is not coverage.
 *
 * The execution helper follows syntax and dataflow without executing a test.
 * Source-link metadata alongside a Git or Python subprocess stays metadata.
 */
const runByWorkflow = gate => workflowRuns.some(run =>
    runInvokesGate(run, gate) || aliasInvokes(run, gate));
/**
 * IMPORTING A GATE EXERCISES IT, and leaving that out was my first cut's error.
 * `test/oracle-trace.test.mjs` imports compareTraces, normalizeTrace,
 * parseUcsimTrace and parseVcd straight from `scripts/oracle-trace.mjs` and
 * drives them — no child process anywhere. A spawn-only rule called that gate an
 * orphan, which is the same false-orphan this file was widened to stop making,
 * arriving from the opposite side.
 */
const importsGate = (text, gate) =>
    new RegExp(`from\\s*['"][^'"]*scripts/${shellQuote(gate)}['"]`).test(text) ||
    new RegExp(`import\\s*\\(\\s*['"][^'"]*scripts/${shellQuote(gate)}['"]`).test(text);
/**
 * A test REFERENCES a gate as a program when it builds a path to it, not when it
 * merely names it.
 *
 * The literal `scripts/<gate>` is the easy half. The half that caught me is that
 * neither test in this repo writes it: both do
 * `join(here, '..', 'scripts', 'oracle-differential.mjs')` and pass the binding
 * to execFileSync several lines later. A rule keyed on the literal, or on the
 * spawn and the name sharing a statement, calls those orphans — which is the
 * false orphan this file exists to stop producing, arriving by a third route.
 * lego-b9 hit the same shape in the docs trigger the same day: a constructed
 * path is invisible to anything looking for a written-out one.
 *
 * A bare occurrence of the name — a string in an assertion about build.yml, a
 * key in a fixture — is a MENTION, and stays one.
 */
const referencesGatePath = (text, gate) => {
    const name = shellQuote(gate);
    if (new RegExp(`['"\`][^'"\`]*scripts/${name}`).test(text)) return true;
    return text.split(';').some(statement =>
        /\b(?:join|resolve)\s*\(/.test(statement) &&
        new RegExp(`['"]scripts['"][\\s\\S]*?['"]${name}['"]`).test(statement));
};
const exercisedIn = ({text, raw, file}, gate) => {
    // Never let an unrelated direct call credit this promisified path.
    if (/\bpromisify\s*\(\s*execFile\s*\)/.test(raw || '') && raw.includes(`scripts/${gate}`)) {
        return directlyExecutesPromisifiedGate(raw, gate);
    }
    return importsGate(text, gate) || directlyExecutesGate(raw || text, gate, {
        root: ROOT,
        filename: path.join(ROOT, 'test', file || 'fixture.test.mjs')
    });
};

/**
 * The classification, as a pure function, so the RULE can be exercised on
 * fixtures rather than only on this repo's current state.
 *
 * Without this the important regression is invisible: restoring the old
 * `sources.some(s => s.includes(gate))` makes the inventory MORE permissive, so
 * every real gate still passes and no test goes red. A rule that can only be
 * checked against a tree that already satisfies it cannot catch its own
 * loosening — which is the failure mode this whole file is about, one level up.
 *
 * @returns {'workflow'|'test'|'mention'|'none'}
 */
const classifyGate = (gate, {runs, sources, scripts}) => {
    if (runs.some(run => runInvokesGate(run, gate) || aliasInvokes(run, gate, scripts))) return 'workflow';
    if (sources.some(source => exercisedIn(source, gate))) return 'test';
    if (sources.some(({text}) => text.includes(gate))) return 'mention';
    return 'none';
};
const world = {runs: workflowRuns, sources: testSources, scripts: packageScripts};
const gateIsWired = gate => ['workflow', 'test'].includes(classifyGate(gate, world));

/** What is actually known about a gate, in the words the failure message uses. */
const coverageOf = gate => {
    switch (classifyGate(gate, world)) {
    case 'workflow': return 'run by a workflow';
    case 'test': return `exercised by test/${testSources.find(x => exercisedIn(x, gate)).file}`;
    case 'mention': return `NAMED in test/${testSources.find(({text}) => text.includes(gate)).file}` +
        ' but never executed there, and run by no workflow';
    default: return 'run by nothing and named by nothing';
    }
};

// Every script that renders a VERDICT, not only those named `verify-`. This file's own opening
// line is "a browser gate that CI never runs decays into decoration" — which was true of
// `smoke-*` and `oracle-*` too, and they were escaping the inventory purely by naming. The same
// convention the gate-shape sweep keys on, for the same reason.
// `oracle-simavr` is excluded BY NAME: its own header reads "Optional local oracle runner. The
// GPL simulator is never bundled or linked." A developer tool, not a gate. Excluding a file is
// how decay hides, so the reason lives here and every other oracle must still be run by something.
const TOOLS_NOT_GATES = new Set(['oracle-simavr.mjs']);
const gates = readdirSync(path.join(ROOT, 'scripts'))
    .filter(f => /^(?:verify|smoke|oracle)-/.test(f) && f.endsWith('.mjs'))
    .filter(f => !TOOLS_NOT_GATES.has(f));

test('the inherited unwired inventory stays bound to the reviewed source bytes and explicit state', () => {
    assert.equal(inheritedInventory.schema, 1);
    assert.equal(inheritedInventory.baselineCommit, '44e08bc8eb2c5a283cfe199d611c0b9253dedb68');
    assert.equal(inheritedInventory.verifiedCommit, '689feabf5d68086865448ecdb362ceecf0b00df4');
    assert.match(inheritedInventory.state, /No current execution or pass is claimed/);
    const present = new Set(gates);
    assert.deepEqual(frozenInventoryProblems(inheritedInventory.entries, name =>
        present.has(name) ? readFileSync(path.join(ROOT, 'scripts', name)) : undefined), []);
    assert.equal(gitBlobSha(documentedScopeSource), '3a2706d2726dd04d9cc655abee729e99f232bf68',
        'admission is bound to the independently reviewed documentation audit');
    assert.deepEqual(inheritedInventory.documentedScopeAudit, {
        path: 'docs/receipts/2026-11-28-cowgol-gate-wiring-audit.json',
        blobSha: '3a2706d2726dd04d9cc655abee729e99f232bf68',
        sourceRef: inheritedInventory.verifiedCommit
    });
    assert.equal(documentedScopeAudit.sourceRef, inheritedInventory.verifiedCommit);
    const documentedSources = new Map([
        'docs/CAD-ROBOT-PROJECTS.md',
        'docs/WORKBENCH-OWNER-ROADMAP.md',
        'docs/ROBOT-CAD-EDITOR-PARITY.md'
    ].map(file => [file, readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/)]));
    for (const scope of documentedScopeAudit.documented) {
        for (const reference of scope.evidence) {
            const lines = documentedSources.get(reference.path);
            assert.ok(lines, 'unreviewed documentation source: ' + reference.path);
            const end = reference.endLine ?? reference.line;
            assert.ok(reference.line >= 1 && end >= reference.line && end <= lines.length,
                scope.script + ': documentation reference is outside ' + reference.path);
            assert.ok(lines[reference.line - 1].trim() && lines[end - 1].trim(),
                scope.script + ': documentation reference names an empty boundary line in ' + reference.path);
        }
    }

    assert.equal(documentedScopeAudit.documented.length, 32);
    assert.equal(documentedScopeAudit.unresolved.length, 24);
    assert.equal(inheritedInventory.entries.length, 56);
    assert.deepEqual(Object.keys(inheritedReasons).sort(),
        documentedScopeAudit.documented.map(scope => scope.script.replace(/^scripts\//, '')).sort());
    assert.deepEqual(inheritedInventory.entries.filter(entry => !documentedScopeFor(entry, documentedScopeAudit))
        .map(entry => entry.name).sort(),
    documentedScopeAudit.unresolved.map(script => script.replace(/^scripts\//, '')).sort(),
    'the unresolved 24 remain in the report without admission to KNOWN_UNWIRED');
});


test('an inventory entry cannot admit itself without independently documented scope', () => {
    const known = 'verify-documented-fixture.mjs', unknown = 'verify-unresolved-fixture.mjs';
    const scope = {script: 'scripts/' + known, category: 'manual_command',
        evidence: [{path: 'docs/FIXTURE.md', line: 7}]};
    const audit = {documented: [scope]};
    const entry = {name: known, purpose: 'Fixture state', prerequisites: 'Fixture setup', pendingWiring: null};
    const inventory = entries => ({verifiedCommit: 'fixture', entries});
    assert.deepEqual(documentedInventoryReasons(inventory([entry]), audit), {},
        'being in the historical inventory does not establish documented scope');
    const admitted = {...entry, documentedScope: scope};
    assert.deepEqual(Object.keys(documentedInventoryReasons(inventory([admitted]), audit)), [known]);
    const forged = {...entry, name: unknown,
        documentedScope: {...scope, script: 'scripts/' + unknown}};
    assert.deepEqual(documentedInventoryReasons(inventory([forged]), audit), {},
        'a self-declared scope cannot add a gate absent from the independent audit');
    for (const documentedScope of [
        {...scope, category: 'unresolved'},
        {...scope, evidence: []},
        {...scope, evidence: [{path: 'docs/FIXTURE.md', line: 8}]}
    ]) assert.deepEqual(documentedInventoryReasons(inventory([{...entry, documentedScope}]), audit), {},
        'missing or mismatched documentation cannot grant admission');
    const reasons = documentedInventoryReasons(inventory([admitted, forged]), audit);
    assert.deepEqual(unlistedGates([known, unknown], reasons, () => false), [unknown],
        'the unresolved gate remains a real coverage failure');
});

test('an inherited inventory cannot admit a new orphan, changed source or newly wired gate', () => {
    const gate = 'verify-inherited-fixture.mjs', added = 'verify-new-fixture.mjs';
    const source = 'export const fixture = 1;\n';
    const entry = {name: gate, blobSha: gitBlobSha(source),
        purpose: 'Fixture verdict', prerequisites: 'Fixture setup', pendingWiring: null};
    const known = {[gate]: 'inherited/unwired'};
    const world = {runs: [], sources: [], scripts: {}};
    const wired = name => ['workflow', 'test'].includes(classifyGate(name, world));
    assert.deepEqual(frozenInventoryProblems([entry], () => source), []);
    assert.deepEqual(unlistedGates([gate, added], known, wired), [added],
        'a new unlisted gate remains a coverage failure');
    assert.deepEqual(frozenInventoryProblems([entry], () => source + 'export const changed = true;\n'),
        ['changed inherited gate source: ' + gate], 'changing a reviewed gate invalidates its frozen state');
    assert.deepEqual(frozenInventoryProblems([entry], () => undefined),
        ['missing inherited gate: ' + gate]);
    world.runs = ['node scripts/' + gate];
    assert.deepEqual(newlyWiredKnown(known, wired), [gate],
        'real workflow wiring requires removal from the inherited inventory');
});

// Execution provenance fixtures: source strings are parsed, never executed.
const EXECUTION_PROOF_GATE = 'verify-fixture.mjs';
const EXECUTION_PROOF_CASES = [
    [
        "direct literal Node launch",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>spawnSync(process.execPath,['scripts/verify-fixture.mjs']));",
        true
    ],
    [
        "joined immutable path",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const here=dirname(fileURLToPath(import.meta.url)); const S=join(here,'..','scripts','verify-fixture.mjs'); test('x',()=>execFileSync(process.execPath,[S]));",
        true
    ],
    [
        "real descriptor wrapper",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const verifiers=[{script:'scripts/verify-fixture.mjs'}]; test('x',async t=>{const run=(script,args)=>spawnSync(process.execPath,[resolve(ROOT,script),...args]); for(const {script} of verifiers) await t.test(script,()=>run(script,['--help']));});",
        true
    ],
    [
        "descriptor Array.forEach wrapper",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const verifiers=[{script:'scripts/verify-fixture.mjs'}]; const run=script=>spawnSync(process.execPath,[resolve(ROOT,script)]); test('x',()=>verifiers.forEach(({script})=>run(script)));",
        true
    ],
    [
        "imported namespace child process",
        "import test from 'node:test'; import * as cp from 'node:child_process'; test('x',()=>cp.spawnSync(process.execPath,['scripts/verify-fixture.mjs']));",
        true
    ],
    [
        "imported child alias",
        "import test from 'node:test'; import {execFileSync as launch} from 'node:child_process'; test('x',()=>launch(process.execPath,['scripts/verify-fixture.mjs']));",
        true
    ],
    [
        "node:test namespace",
        "import * as t from 'node:test'; import {spawnSync} from 'node:child_process'; t.test('x',()=>spawnSync(process.execPath,['scripts/verify-fixture.mjs']));",
        true
    ],
    [
        "node preload plus real entry",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>spawnSync(process.execPath,['--import','./scripts/lib/register-gui-scope.mjs','scripts/verify-fixture.mjs']));",
        true
    ],
    [
        "fork real entry",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>fork('scripts/verify-fixture.mjs',[]));",
        true
    ],
    [
        "assertion callback",
        "import test from 'node:test'; import assert from 'node:assert/strict'; import {spawnSync} from 'node:child_process'; test('x',()=>assert.doesNotThrow(()=>spawnSync(process.execPath,['scripts/verify-fixture.mjs'])));",
        true
    ],
    [
        "metadata with unrelated Git and Python launches",
        // gate-shapes-allow: parsed adversarial source, never executed; Git metadata cannot prove a gate launch.
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const CENSUS=[{file:'scripts/verify-fixture.mjs',kind:'raw'}]; test('x',()=>{execFileSync('git',['status']);spawnSync('/usr/bin/python3',['-I','-B','-c','pass']);});",
        false
    ],
    [
        "uncalled wrapper",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const script='scripts/verify-fixture.mjs'; const run=()=>spawnSync(process.execPath,[script]); test('x',()=>42);",
        false
    ],
    [
        "descriptor unused by wrapper",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const verifiers=[{script:'scripts/verify-fixture.mjs'}]; const run=script=>spawnSync(process.execPath,['scripts/other.mjs']); test('x',()=>{for(const {script} of verifiers)run(script);});",
        false
    ],
    [
        "gate is merely data argv",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>spawnSync(process.execPath,['scripts/other.mjs','scripts/verify-fixture.mjs']));",
        false
    ],
    [
        "gate is preload only",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>spawnSync(process.execPath,['--import','scripts/verify-fixture.mjs']));",
        false
    ],
    [
        "eval argument is not an entry",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>spawnSync(process.execPath,['-e','0','scripts/verify-fixture.mjs']));",
        false
    ],
    [
        "Python receives gate argument",
        // gate-shapes-allow: parsed negative fixture; a non-Node executable receiving the path is not gate execution.
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>spawnSync('python',['scripts/verify-fixture.mjs']));",
        false
    ],
    [
        "spawner is locally declared",
        "import test from 'node:test'; const spawnSync=()=>{}; test('x',()=>spawnSync(process.execPath,['scripts/verify-fixture.mjs']));",
        false
    ],
    [
        "spawner import has wrong provenance",
        "import test from 'node:test'; import {spawnSync} from './fake-process.mjs'; test('x',()=>spawnSync(process.execPath,['scripts/verify-fixture.mjs']));",
        false
    ],
    [
        "spawner is shadowed by parameter",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const run=spawnSync=>spawnSync(process.execPath,['scripts/verify-fixture.mjs']); test('x',()=>run(()=>{}));",
        false
    ],
    [
        "process is shadowed",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const run=process=>spawnSync(process.execPath,['scripts/verify-fixture.mjs']); test('x',()=>run({execPath:'python'}));",
        false
    ],
    [
        "immutable path is reassigned",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); let script='scripts/verify-fixture.mjs'; script='scripts/other.mjs'; test('x',()=>spawnSync(process.execPath,[script]));",
        false
    ],
    [
        "descriptor mutation through alias",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const verifiers=[{script:'scripts/verify-fixture.mjs'}]; const alias=verifiers; alias[0].script='scripts/other.mjs'; test('x',()=>{for(const {script} of verifiers)spawnSync(process.execPath,[script]);});",
        false
    ],
    [
        "removed descriptor",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const verifiers=[{script:'scripts/verify-fixture.mjs'}]; verifiers.pop(); test('x',()=>{for(const {script} of verifiers)spawnSync(process.execPath,[script]);});",
        false
    ],
    [
        "explicitly skipped test",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test.skip('x',()=>spawnSync(process.execPath,['scripts/verify-fixture.mjs']));",
        false
    ],
    [
        "literal false branch",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{if(false)spawnSync(process.execPath,['scripts/verify-fixture.mjs']);});",
        false
    ],
    [
        "unproven callback consumer",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const script='scripts/verify-fixture.mjs'; test('x',()=>unknownWrapper(()=>spawnSync(process.execPath,[script])));",
        false
    ],
    [
        "unknown executable",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>spawnSync(process.env.NODE,['scripts/verify-fixture.mjs']));",
        false
    ],
    [
        "relative entry with a different cwd",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>spawnSync(process.execPath,['scripts/verify-fixture.mjs'],{cwd:'/elsewhere'}));",
        false
    ],
    [
        "fork relative entry with options shorthand cwd",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>fork('scripts/verify-fixture.mjs',{cwd:'/elsewhere'}));",
        false
    ],
    [
        "malformed syntax",
        "import {spawnSync} from 'node:child_process'; scripts/verify-fixture.mjs ; {",
        false
    ],
    [
        "for-of break stops entry",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{for(const script of ['scripts/verify-fixture.mjs']){break;spawnSync(process.execPath,[script]);}});",
        false
    ],
    [
        "for-of continue stops entry",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{for(const script of ['scripts/verify-fixture.mjs']){continue;spawnSync(process.execPath,[script]);}});",
        false
    ],
    [
        "for-of return stops later iterations",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{for(const script of ['other','scripts/verify-fixture.mjs']){if(script==='other')return;spawnSync(process.execPath,[script]);}});",
        false
    ],
    [
        "some short circuits",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>[true,false].some(stop=>{if(stop)return true;spawnSync(process.execPath,['scripts/verify-fixture.mjs']);return false;}));",
        false
    ],
    [
        "every short circuits",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>[true,false].every(stop=>{if(stop)return false;spawnSync(process.execPath,['scripts/verify-fixture.mjs']);return true;}));",
        false
    ],
    [
        "unhandled explicit throw stops entry",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{try {throw Error('stop');}finally{}spawnSync(process.execPath,['scripts/verify-fixture.mjs']);});",
        false
    ],
    [
        "throw in invoked wrapper stops entry",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); function halt(){throw Error('stop');} test('x',()=>{halt();spawnSync(process.execPath,['scripts/verify-fixture.mjs']);});",
        false
    ],
    [
        "unknown options cannot imply root cwd",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const options=JSON.parse('{\"cwd\":\"/elsewhere\"}');test('x',()=>spawnSync(process.execPath,['scripts/verify-fixture.mjs'],options));",
        false
    ],
    [
        "unknown options spread cannot imply root cwd",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const options=JSON.parse('{\"cwd\":\"/elsewhere\"}');test('x',()=>spawnSync(process.execPath,['scripts/verify-fixture.mjs'],{...options}));",
        false
    ],
    [
        "unknown descriptor spread can overwrite path",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const entry={script:'scripts/verify-fixture.mjs',...JSON.parse('{\"script\":\"other\"}')};test('x',()=>spawnSync(process.execPath,[entry.script]));",
        false
    ],
    [
        "unknown computed key can overwrite path",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const entry={script:'scripts/verify-fixture.mjs',[process.env.KEY]:'other'};test('x',()=>spawnSync(process.execPath,[entry.script]));",
        false
    ],
    [
        "later lexical spawner declaration shadows throughout block",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{spawnSync(process.execPath,['scripts/verify-fixture.mjs']);const spawnSync=()=>{};});",
        false
    ],
    [
        "later lexical process declaration shadows throughout block",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{spawnSync(process.execPath,['scripts/verify-fixture.mjs']);const process={execPath:'python'};});",
        false
    ],
    [
        "var spawner shadows throughout function",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{spawnSync(process.execPath,['scripts/verify-fixture.mjs']);if(false){var spawnSync=()=>{};}});",
        false
    ],
    [
        "explicit cwd following spread is known",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const options=JSON.parse('{}');test('x',()=>spawnSync(process.execPath,['scripts/verify-fixture.mjs'],{...options,cwd:ROOT,shell:false}));",
        true
    ],
    [
        "absolute entry does not depend on unknown cwd",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const options={cwd:process.env.SOME_CWD,shell:false};test('x',()=>spawnSync(process.execPath,[resolve(ROOT,'scripts/verify-fixture.mjs')],options));",
        true
    ],
    [
        "fork with non-Node executable",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>fork('scripts/verify-fixture.mjs',[],{execPath:'python'}));",
        false
    ],
    [
        "fork unknown shorthand options",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const options=JSON.parse('{\"cwd\":\"/elsewhere\"}');test('x',()=>fork('scripts/verify-fixture.mjs',options));",
        false
    ],
    [
        "fork eval execArgv does not run the gate entry",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>fork('scripts/verify-fixture.mjs',[],{execArgv:['-e','0']}));",
        false
    ],
    [
        "fork another execArgv entry does not run the gate",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>fork('scripts/verify-fixture.mjs',[],{execArgv:['scripts/other.mjs']}));",
        false
    ],
    [
        "fork known preload retains the gate entry",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>fork('scripts/verify-fixture.mjs',[],{execArgv:['--import','./scripts/lib/register-gui-scope.mjs'],cwd:ROOT}));",
        true
    ],
    [
        "custom shell cannot claim direct execution",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>execFileSync(process.execPath,['scripts/verify-fixture.mjs'],{shell:'/other-shell'}));",
        false
    ],
    [
        "boolean shell cannot claim direct execution",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>spawnSync(process.execPath,['scripts/verify-fixture.mjs'],{shell:true}));",
        false
    ],
    [
        "unknown shell options cannot claim an absolute entry",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const options=JSON.parse('{}');test('x',()=>spawnSync(process.execPath,[resolve(ROOT,'scripts/verify-fixture.mjs')],options));",
        false
    ],
    [
        "chdir invalidates a relative child entry",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{process.chdir('/elsewhere');spawnSync(process.execPath,['scripts/verify-fixture.mjs']);});",
        false
    ],
    [
        "chdir invalidates cwd and relative path builders",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{process.chdir('/elsewhere');spawnSync(process.execPath,[resolve('scripts/verify-fixture.mjs')],{cwd:process.cwd()});});",
        false
    ],
    [
        "imported chdir alias invalidates the current directory",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); import {chdir as move} from 'node:process';test('x',()=>{move('/elsewhere');spawnSync(process.execPath,['scripts/verify-fixture.mjs']);});",
        false
    ],
    [
        "absolute entry remains independent after chdir",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{process.chdir('/elsewhere');spawnSync(process.execPath,[resolve(ROOT,'scripts/verify-fixture.mjs')]);});",
        true
    ],
    [
        "explicit absolute child cwd remains known after chdir",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{process.chdir('/elsewhere');spawnSync(process.execPath,['scripts/verify-fixture.mjs'],{cwd:ROOT});});",
        true
    ],
    [
        "prototype inherited cwd cannot imply repository root",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>execFileSync(process.execPath,['scripts/verify-fixture.mjs'],{__proto__:{cwd:'/elsewhere'}}));",
        false
    ],
    [
        "prototype inherited shell cannot imply a direct child",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>execFileSync(process.execPath,[resolve(ROOT,'scripts/verify-fixture.mjs')],{__proto__:{shell:'/other-shell'}}));",
        false
    ],
    [
        "computed prototype key is an ordinary own property",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>execFileSync(process.execPath,['scripts/verify-fixture.mjs'],{['__proto__']:{cwd:'/elsewhere'}}));",
        true
    ],
    [
        "switch selects a known matching case",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const target='selected';test('x',()=>{switch(target){case 'other':break;case 'selected':spawnSync(process.execPath,['scripts/verify-fixture.mjs']);break;}});",
        true
    ],
    [
        "switch selects default after no matching case",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{switch('selected'){case 'other':break;default:spawnSync(process.execPath,['scripts/verify-fixture.mjs']);}});",
        true
    ],
    [
        "switch preserves case fallthrough",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{switch(1){case 1:case 2:spawnSync(process.execPath,['scripts/verify-fixture.mjs']);break;}});",
        true
    ],
    [
        "switch local break prevents later case execution",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{switch(1){case 1:break;case 2:spawnSync(process.execPath,['scripts/verify-fixture.mjs']);}});",
        false
    ],
    [
        "switch local break permits following function statements",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{switch(1){case 1:break;}spawnSync(process.execPath,['scripts/verify-fixture.mjs']);});",
        true
    ],
    [
        "switch propagates function return",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{switch(1){case 1:return;}spawnSync(process.execPath,['scripts/verify-fixture.mjs']);});",
        false
    ],
    [
        "switch propagates explicit throw",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{switch(1){case 1:throw Error('stop');}spawnSync(process.execPath,['scripts/verify-fixture.mjs']);});",
        false
    ],
    [
        "switch propagates enclosing loop continue",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{for(const value of [1]){switch(value){case 1:continue;}spawnSync(process.execPath,['scripts/verify-fixture.mjs']);}});",
        false
    ],
    [
        "unknown switch discriminant cannot invent later execution",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); const target=process.env.TARGET;test('x',()=>{switch(target){default:break;}spawnSync(process.execPath,['scripts/verify-fixture.mjs']);});",
        false
    ],
    [
        "unknown switch case cannot select a default",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{switch('selected'){case process.env.TARGET:break;default:spawnSync(process.execPath,['scripts/verify-fixture.mjs']);}});",
        false
    ],
    [
        "switch cases share lexical shadowing before declaration",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{switch('selected'){case 'selected':spawnSync(process.execPath,['scripts/verify-fixture.mjs']);break;case 'other':const spawnSync=()=>{};break;}});",
        false
    ],
    [
        "switch default before a matching case is skipped",
        "import test from 'node:test'; import {spawnSync,execFileSync,fork} from 'node:child_process'; import {resolve,join,dirname} from 'node:path'; import {fileURLToPath} from 'node:url'; const ROOT=resolve(import.meta.dirname,'..'); test('x',()=>{switch('selected'){default:spawnSync(process.execPath,['scripts/verify-fixture.mjs']);break;case 'selected':break;}});",
        false
    ]
];

for (const [name, source, expected] of EXECUTION_PROOF_CASES) {
    test('gate execution provenance: ' + name, () => {
        const fixtureFile = path.join(ROOT, 'test/gate-execution-fixture.test.mjs');
        assert.equal(directlyExecutesGate(source, EXECUTION_PROOF_GATE, {
            root: ROOT, filename: fixtureFile,
            loadModule: file => file === path.join(ROOT, 'test/fake-process.mjs') ?
                'export function spawnSync() {}' : null
        }), expected, name);
    });
}

test('actual Cowgol descriptor CLIs reach all three imported Node launches', () => {
    const filename = path.join(ROOT, 'test/cowgol-verifier-cli.test.mjs');
    const source = readFileSync(filename, 'utf8');
    for (const gate of ['verify-cowgol-cpm-system.mjs', 'verify-cowgol-dos.mjs', 'verify-cowgol-dos-disk.mjs']) {
        assert.equal(directlyExecutesGate(source, gate, {root: ROOT, filename}), true, gate);
    }
});

test('actual corpus callback wrapper reaches its immutable oracle path', () => {
    const filename = path.join(ROOT, 'test/corpus-differential.test.mjs');
    assert.equal(directlyExecutesGate(readFileSync(filename, 'utf8'), 'oracle-differential.mjs',
        {root: ROOT, filename}), true);
});

test('actual fetch-pinning metadata does not execute the machine video gate', () => {
    const filename = path.join(ROOT, 'test/fetch-pinning.test.mjs');
    assert.equal(directlyExecutesGate(readFileSync(filename, 'utf8'), 'verify-machine-video-boot.mjs',
        {root: ROOT, filename}), false);
});

test('the existing imported promisify recognizer keeps real launches separate from metadata', () => {
    const imports = "import {execFile} from 'node:child_process'; import {promisify} from 'node:util'; ";
    assert.equal(directlyExecutesPromisifiedGate(imports +
        "promisify(execFile)(process.execPath,['scripts/verify-fixture.mjs']);", EXECUTION_PROOF_GATE), true);
    assert.equal(directlyExecutesPromisifiedGate(imports +
        "const metadata={file:'scripts/verify-fixture.mjs'}; promisify(execFile)('git',['status']);",
    EXECUTION_PROOF_GATE), false);
});

test('a local callback helper cannot escape the repository through a symlink', async () => {
    const {mkdtempSync, mkdirSync, writeFileSync, symlinkSync, unlinkSync, rmSync} = await import('node:fs');
    const {tmpdir} = await import('node:os');
    const temporary = mkdtempSync(path.join(tmpdir(), 'gate-execution-boundary-'));
    try {
        const root = path.join(temporary, 'repo'), directory = path.join(root, 'scripts/lib');
        mkdirSync(directory, {recursive: true});
        const external = path.join(temporary, 'outside.mjs'), link = path.join(directory, 'wrapper.mjs');
        const wrapper = 'export function run(callback) { return callback(); }';
        writeFileSync(external, wrapper);
        symlinkSync(external, link);
        const source = "import test from 'node:test'; import {spawnSync} from 'node:child_process'; " +
            "import {run} from '../scripts/lib/wrapper.mjs'; " +
            "test('x',()=>run(()=>spawnSync(process.execPath,['scripts/verify-fixture.mjs'])));";
        assert.equal(directlyExecutesGate(source, EXECUTION_PROOF_GATE, {
            root, filename: path.join(root, 'test/escaped.test.mjs')
        }), false);
        unlinkSync(link);
        writeFileSync(link, wrapper);
        assert.equal(directlyExecutesGate(source, EXECUTION_PROOF_GATE, {
            root, filename: path.join(root, 'test/local.test.mjs')
        }), true);
    } finally { rmSync(temporary, {recursive: true, force: true}); }
});

test('a wrapper runs a gate; a mention of one does not', () => {
    // The whitelist that lets `xvfb-run -a dbus-run-session -- node …` count must not also let a
    // gate named in an echo or a comment look protected — that strictness is the whole reason
    // this file reads `run:` scalars rather than grepping the workflow.
    const gate = 'verify-example.mjs';
    for (const run of [
        `node scripts/${gate}`,
        `node --import ./scripts/lib/register-gui-scope.mjs scripts/${gate}`,
        `node --import=./scripts/lib/register-gui-scope.mjs scripts/${gate}`,
        `xvfb-run -a dbus-run-session -- node scripts/${gate}`,
        `PROOF_URL=http://localhost:8617/ node scripts/${gate}`,
        `timeout 600 node scripts/${gate}`,
        `set -e; xvfb-run -a node scripts/${gate}`
    ]) {
        assert.ok(runInvokesGate(run, gate), `should count as running the gate: ${run}`);
    }
    for (const run of [
        `echo node scripts/${gate}`,
        `echo node --import ./scripts/lib/register-gui-scope.mjs scripts/${gate}`,
        `node --import scripts/${gate}`,
        `echo "remember to run node scripts/${gate}"`,
        `# node scripts/${gate}`
    ]) {
        assert.equal(runInvokesGate(run, gate), false, `must NOT count as running it: ${run}`);
    }
});

test('every browser gate is either run by CI or knowingly listed as not', () => {
    const undeclared = unlistedGates(gates, KNOWN_UNWIRED, gateIsWired);
    // NAME WHICH FACT EACH ONE HAS. "Not wired" is three different situations
    // and they want three different actions: a gate NAMED in a test needs
    // wiring or listing; one named nowhere at all may be dead. Reporting them
    // identically sent readers to look for a workflow step that was never the
    // problem.
    assert.deepEqual(undeclared, [],
        'these gates are run by nothing and are not in KNOWN_UNWIRED:\n  ' +
        undeclared.map(g => `${g} — ${coverageOf(g)}`).join('\n  ') +
        '\nWire them into .github/workflows/build.yml, or document and review their manual/local ' +
        'scope before listing them. An inherited inventory entry alone grants no admission. ' +
        'A gate nothing runs stops working and nobody finds out — 13 of 17 already had. ' +
        'A gate a test only NAMES is in that category: naming is not running.');
});

test('the unwired list only shrinks — entries that are now wired must be removed', () => {
    // Without this the list rots too: a gate could be wired into CI and still
    // sit here claiming to be unwatched, which is exactly the kind of stale
    // bookkeeping that made the sweep necessary.
    const wrongly = newlyWiredKnown(KNOWN_UNWIRED, gateIsWired);
    assert.deepEqual(wrongly, [],
        `these are in KNOWN_UNWIRED but ARE run by a workflow — delete them from the list: ${wrongly.join(', ')}`);
});

test('only executable run commands count as wired browser gates', () => {
    const gate = 'verify-fixture.mjs';
    const falsePositives = [
        '# node scripts/verify-fixture.mjs',
        'name: node scripts/verify-fixture.mjs',
        'env:\n  GATE: verify-fixture.mjs',
        'run: echo node scripts/verify-fixture.mjs',
    ];
    for (const yaml of falsePositives) {
        assert.ok(!workflowRunScalars(yaml).some(run => runInvokesGate(run, gate)),
            `non-executable YAML must not wire a gate: ${yaml}`);
    }

    const truePositives = [
        'run: node scripts/verify-fixture.mjs',
        'run: PROOF_URL=http://localhost:8617/ node scripts/verify-fixture.mjs --flag',
        'run: |\n  npm run build\n  node ./scripts/verify-fixture.mjs',
    ];
    for (const yaml of truePositives) {
        assert.ok(workflowRunScalars(yaml).some(run => runInvokesGate(run, gate)),
            `an executable run command must wire a gate: ${yaml}`);
    }
});

test('an npm alias counts however the run line reaches it', () => {
    // THE DEFECT THIS CLOSES. runInvokesGate has always accepted an env prefix;
    // aliasInvokes did not. So `PROOF_URL=… node scripts/x.mjs` counted and
    // `PROOF_URL=… npm run verify:x` did not, though they run the same gate
    // through the same CI step. The consequence was not a red gate — it was
    // WORSE: three gates read as covered because a test happened to name them,
    // and two lanes wrote the direct `node` form specifically to satisfy this
    // check. A check the code is shaped around has stopped measuring anything.
    const gate = 'verify-example.mjs';
    const scripts = {'verify:example': `node scripts/${gate}`};
    for (const run of [
        'npm run verify:example',
        'PROOF_URL=http://localhost:8617/ npm run verify:example',
        'CI=1 PROOF_URL=http://x/ npm run verify:example',
        'set -e; npm run verify:example',
        'BW_PORT=8617 timeout 600 npm run verify:example'
    ]) assert.ok(aliasInvokes(run, gate, scripts), `should count as running the gate: ${run}`);

    for (const run of [
        'echo npm run verify:example',
        'echo "then npm run verify:example"',
        'npm run verify:example-other'
    ]) assert.equal(aliasInvokes(run, gate, scripts), false, `must NOT count: ${run}`);
});

test('naming a gate is not running it, and a path to one is not a mention', () => {
    // The two facts, at the level where they are decided. A gate a test only
    // NAMES was previously indistinguishable from one a workflow runs, and the
    // three that reached this state did so honestly — nobody wired anything
    // wrong, the rule simply counted a string.
    const gate = 'verify-example.mjs';

    // Mentions. None of these runs anything.
    for (const text of [
        `assert.match(workflow, /verify-example\\.mjs/);`,
        `const NAMES = ['verify-example.mjs', 'verify-other.mjs'];`,
        `assert.ok(buildYml.includes('verify-example.mjs'));`
    ]) {
        assert.equal(referencesGatePath(text, gate), false, `a mention must not read as a path: ${text}`);
        assert.equal(importsGate(text, gate), false, `a mention must not read as an import: ${text}`);
    }

    // Real references. Both shapes this repo actually uses.
    assert.ok(importsGate(`import {x} from '../scripts/${gate}';`, gate),
        'a test that imports the gate and drives its functions exercises it — oracle-trace does '
        + 'exactly this, with no child process anywhere');
    assert.ok(referencesGatePath(`const S = 'scripts/${gate}';`, gate));
    assert.ok(referencesGatePath(`const S = join(here, '..', 'scripts', '${gate}');`, gate),
        'the constructed path is the shape BOTH real callers use; a rule that cannot see it calls '
        + 'them orphans, which is the false orphan this file exists to stop producing');
    assert.ok(referencesGatePath(`const S = resolve(ROOT, 'scripts', '${gate}');`, gate));
});

test('a gate named only in a comment counts as nothing', () => {
    // Comments are stripped before any of this runs, so the check below is about
    // the STRIPPER still working — the same trap as a source gate reading its own
    // documentation, which this repo has now hit three times in two days.
    const stripped = `const x = 1;\n`
        .concat(`\n`)
        .concat(`const y = 2;\n`);
    const withComment = `// see scripts/verify-example.mjs for the browser journey\n`
        .concat(`/* also scripts/verify-example.mjs */\n`)
        .concat(`const x = 1;\n`);
    const strip = t => t.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!strip(withComment).includes('verify-example.mjs'),
        'a gate named only in a comment must vanish before classification — otherwise the file '
        + 'that documents an orphan makes it look exercised');
    assert.ok(strip(withComment).includes('const x = 1'), 'the stripper must not eat the code');
    assert.ok(strip(stripped).includes('const y = 2'));
});

test('the rule reports two facts and does not confuse them', () => {
    // Exercised on FIXTURES, because the regression that matters makes the rule
    // MORE permissive: restore `sources.some(s => s.includes(gate))` and every
    // real gate still passes, so nothing in this repo goes red. The loosening is
    // only visible against a world built to show it.
    const gate = 'verify-example.mjs';
    const scripts = {'verify:example': `node scripts/${gate}`};
    const mentionOnly = [{file: 'a.test.mjs', text: `assert.ok(yml.includes('${gate}'));`}];
    const exercises = [{file: 'b.test.mjs',
        text: `import {join} from 'node:path';
            import {execFileSync} from 'node:child_process';
            const S = join(process.cwd(), 'scripts', '${gate}');
            execFileSync(process.execPath, [S]);`}];

    assert.equal(classifyGate(gate, {runs: [`node scripts/${gate}`], sources: [], scripts}), 'workflow');
    assert.equal(classifyGate(gate, {runs: ['PROOF_URL=x npm run verify:example'], sources: [], scripts}),
        'workflow', 'an env-prefixed alias is a workflow run, which is the whole point of this lane');
    assert.equal(classifyGate(gate, {runs: [], sources: exercises, scripts}), 'test');
    for (const source of [
        // gate-shapes-allow: adversarial source fixture proves metadata plus an unrelated Python child earns no execution credit.
        `import {execFileSync} from 'node:child_process';
            const rows = [{file: 'scripts/${gate}'}];
            execFileSync('/usr/bin/python3', ['-c', probe]);`,
        `import {execFileSync} from 'node:child_process';
            execFileSync(process.execPath, ['scripts/other.mjs', 'scripts/${gate}']);`
    ]) assert.equal(classifyGate(gate, {runs: [], scripts,
        sources: [{file: 'inventory.test.mjs', text: source, raw: source}]}), 'mention',
    'path data and arguments to a different program cannot claim child execution');
    assert.equal(classifyGate(gate, {runs: [], sources: mentionOnly, scripts}), 'mention',
        'a gate a test merely NAMES must classify as a mention. If this reads "test", the two '
        + 'facts have been collapsed again and the inventory is counting strings.');
    assert.equal(classifyGate(gate, {runs: [], sources: [], scripts}), 'none');

    // And the consequence, which is what the inventory acts on.
    const wired = w => ['workflow', 'test'].includes(classifyGate(gate, w));
    assert.equal(wired({runs: [], sources: mentionOnly, scripts}), false,
        'a mention must not make a gate count as wired');
    assert.equal(wired({runs: [], sources: exercises, scripts}), true);
});

test('every listed gate still exists', () => {
    const missing = Object.keys(KNOWN_UNWIRED).filter(g => !gates.includes(g));
    assert.deepEqual(missing, [],
        `KNOWN_UNWIRED names gates that no longer exist: ${missing.join(', ')}`);
});

/**
 * The runtime twin of the invariant above.
 *
 * A gate wired into CI can still produce no verdict on any run, and the tests
 * above cannot see it, because they read `run:` and never `if:`.
 *
 * MEASURED 2026-09-02. GitHub folds an implicit `success()` into any `if:` that
 * names no status function, so `if: steps.playwright.outcome == 'success'` on a
 * gate step really means "playwright installed AND nothing has failed yet".
 * `scripts/verify-project-bundle-integrity.mjs` — step 41 of 61 — was the sole
 * failure on every one of the 17 consecutive `main` builds from `f15fd3e6c`
 * (06:26 UTC 09-01) to `62385f4c5`, and it SKIPPED the 17 gate steps after it,
 * covering 23 distinct verify scripts, on all 17 runs. For 23 hours About,
 * intro, interaction, schematic, Code chrome, Controller, faceplates,
 * Instruments, Aurora-65, the debugger dock, both labwired tiers, the offline
 * 8051 pair, the AVR bench, the pinned worker, Web Bluetooth, MakeCode and both
 * micro:bit gates produced NOTHING, and each run reported only "build failed".
 *
 * Wiring a gate in is therefore not enough; it must also be unskippable by an
 * unrelated gate's failure. `!cancelled()` is the whole fix, and this asserts it
 * so the next hand that adds a gate by copying its neighbour cannot lose it.
 */
const buildYml = readFileSync(path.join(ROOT, '.github/workflows/build.yml'), 'utf8');

/** The build job's steps, in order, each as {name, ifs, run}. */
/**
 * The steps of the job that CONTAINS THE BROWSER GATES, found by content.
 *
 * This resolved `^  build:$` by name until 2026-09-05, when the browser gates
 * moved to their own job because the build was being killed by its own
 * `timeout-minutes: 30` -- reported by GitHub as `cancelled`, which sent five
 * sessions hunting an external canceller for a day.
 *
 * Keying on the job NAME made three assertions here silently describe a job
 * that no longer holds what they assert about. They would not have failed
 * open -- `id: serve` vanished from the named job and they went red -- but red
 * for the wrong reason is its own cost, and the property these tests are about
 * has always been "wherever the gates are", not "the job called build".
 *
 * The anchor is `id: serve`, the same one the assertions already use, so the
 * lookup and the thing looked up cannot drift apart.
 */
const gateJobSteps = text => {
    const lines = text.split('\n');
    const jobStarts = lines.map((l, i) => (/^  [a-z][a-z-]*:$/.test(l) ? i : -1)).filter(i => i >= 0);
    const start = jobStarts.find((s, n) => {
        const stop = jobStarts[n + 1] ?? lines.length;
        return lines.slice(s, stop).some(l => /^\s*id:\s*serve\s*$/.test(l));
    });
    if (start === undefined) throw new Error(
        'no job in build.yml declares `id: serve` — the browser gates hang off that server ' +
        'step, so either it was renamed or the gates are gone. Refusing to reason over a ' +
        'job chosen by name instead.');
    const end = lines.findIndex((l, i) => i > start && /^  [a-z][a-z-]*:$/.test(l));
    const body = lines.slice(start, end === -1 ? lines.length : end);
    const steps = [];
    let current = null;
    for (let i = 0; i < body.length; i++) {
        const line = body[i];
        if (/^      - /.test(line)) {
            if (current) steps.push(current);
            current = {name: '', ifs: '', run: '', lines: []};
        }
        if (!current) continue;
        current.lines.push(line);
        const name = line.match(/^      (?:- )?name:\s*(.*)$/);
        if (name) current.name = name[1];
        const cond = line.match(/^        if:\s*(.*)$/);
        if (cond) current.ifs = cond[1];
    }
    if (current) steps.push(current);
    for (const step of steps) step.run = workflowRunScalars(step.lines.join('\n')).join('\n');
    return steps;
};

test('a browser gate cannot be skipped by an unrelated gate failing before it', () => {
    const steps = gateJobSteps(buildYml);
    const serve = steps.findIndex(s => /id:\s*serve/.test(s.lines.join('\n')));
    assert.ok(serve > 0, 'the build job has no server step to hang the gates off');
    // The anchor must be UNIQUE. It is found by searching step text, so a COMMENT naming it
    // moves it: on 2026-09-03 a comment reading "placed before `id: serve`" put the anchor 85
    // lines early and made every later gate look mis-keyed. The gate then failed for a reason
    // that had nothing to do with what it gates.
    const anchors = steps.filter(s => /id:\s*serve/.test(s.lines.join('\n'))).length;
    assert.equal(anchors, 1,
        `${anchors} steps contain the server anchor. It is matched as TEXT, so a comment that ` +
        'names it counts — describe that step, do not spell its id.');

    const skippable = steps
        .slice(serve + 1)
        .filter(s => gates.some(g => runInvokesGate(s.run, g)))
        .filter(s => !/!cancelled\(\)/.test(s.ifs))
        .map(s => s.name || s.run.split('\n')[0]);

    assert.deepEqual(skippable, [],
        'these steps run a browser gate but are skipped the moment any earlier step fails, so ' +
        `they report nothing on exactly the runs that need them most: ${skippable.join(' | ')}. ` +
        "Guard them with `if: ${{ !cancelled() && steps.serve.outcome == 'success' }}` like their " +
        'neighbours. Measured cost of getting this wrong: 23 distinct gates silent for 23 hours.');
});

/**
 * A gate whose failure a step swallows, with the reason it is allowed to.
 *
 * The shape this catches: a step invokes a gate, the gate exits nonzero, and the step turns that
 * into a warning. The gate then reports "skipped" forever and nobody looks again. Found the hard
 * way on 2026-09-03 — `smoke:debugger` had exited 2 for want of sdcc on EVERY build since it was
 * written, so its assertions had never run, and behind that skip were three defects including a
 * product bug. It is not a gate that cannot fail; it is a gate nobody ever let start.
 *
 * A swallow is not automatically wrong — an infra outage should not freeze a deploy. It has to be
 * ARGUED, here, where the next person reads it.
 */
const KNOWN_SWALLOWED = {
    // EMPTY, and that is the point. The single entry here was
    // 'Smoke-test the debugger', excused as "deliberate until the sdcc-wasm
    // toolchain can run under Node" and explicitly labelled a promise to come
    // back rather than a resolution. It was kept 2026-09-03: the toolchain runs
    // under Node, native sdcc turned out never to have been required (measured
    // — the script exits 0 with sdcc absent from PATH), CI now checks out the
    // disassembly oracle, and the step swallows nothing. Three real defects had
    // been sitting behind that swallow the whole time.
};

/**
 * A gate keyed on a step id that does not exist, or that is declared LATER, never runs.
 *
 * Species 15's cousin, and the cheaper half of it. `steps.<id>.outcome` for an id nothing
 * declares evaluates to empty, so `if: steps.serv.outcome == 'success'` — one character off — is
 * permanently false and the gate is silently disabled. Same for a forward reference: a step's
 * `outcome` is empty until it has run, so keying a gate on a step declared BELOW it can never be
 * true. Neither produces an error, a warning, or a skipped-step line anyone reads: the step just
 * quietly does not appear.
 *
 * Every reference in this repo resolves correctly today. That is exactly when to pin it — the
 * failure is a typo away and would look like nothing at all.
 */
test('no gate is keyed on a step id that does not exist, or that comes later', () => {
    for (const file of readdirSync(path.join(ROOT, '.github/workflows')).filter(f => f.endsWith('.yml'))) {
        const broken = stepReferenceProblems(readFileSync(path.join(ROOT, '.github/workflows', file), 'utf8'), file);
        assert.deepEqual(broken, [],
            `a condition references a step that cannot have an outcome in its job: ${broken.join(' | ')}`);
    }
});

test('a step that swallows a gate failure has to say why', () => {
    const steps = gateJobSteps(buildYml);
    const swallows = step => /\|\|\s*(?:true|:)\b/.test(step.run) ||
        /-eq\s+\d+\s*\]/.test(step.run) ||
        /continue-on-error:\s*true/.test(step.lines.join('\n'));
    const undocumented = steps
        .filter(s => gates.some(g => runInvokesGate(s.run, g) || aliasInvokes(s.run, g)))
        .filter(swallows)
        .map(s => s.name)
        .filter(name => !(name in KNOWN_SWALLOWED));
    assert.deepEqual(undocumented, [],
        `these steps swallow a gate's failure without a recorded reason: ${undocumented.join(' | ')}. ` +
        'A swallowed exit turns a gate into a permanent "skipped" that nobody re-reads — the ' +
        'assertions behind it may never have run. Add it to KNOWN_SWALLOWED with what it costs, ' +
        'or stop swallowing.');
});

test('the swallow list only shrinks', () => {
    // Same ratchet as KNOWN_UNWIRED: an entry that no longer swallows must be deleted, so the
    // list cannot quietly outlive the thing it excuses.
    const steps = gateJobSteps(buildYml);
    const byName = new Map(steps.map(s => [s.name, s]));
    const stale = Object.keys(KNOWN_SWALLOWED).filter(name => {
        const step = byName.get(name);
        if (!step) return true;
        return !(/\|\|\s*(?:true|:)\b/.test(step.run) || /-eq\s+\d+\s*\]/.test(step.run) ||
            /continue-on-error:\s*true/.test(step.lines.join('\n')));
    });
    assert.deepEqual(stale, [],
        `these are in KNOWN_SWALLOWED but no longer swallow anything (or no longer exist) — ` +
        `delete them: ${stale.join(' | ')}`);
});

test('the gates stay keyed on the served app, not on the playwright install', () => {
    // `serve` is itself skipped when playwright fails, so keying on it covers
    // that case AND stops 30 gates being fired at a dead server, each burning a
    // navigation timeout, when the server never came up. A gate that reverts to
    // `steps.playwright.outcome` loses the second half silently.
    const steps = gateJobSteps(buildYml);
    const serve = steps.findIndex(s => /id:\s*serve/.test(s.lines.join('\n')));
    const misKeyed = steps
        .slice(serve + 1)
        .filter(s => gates.some(g => runInvokesGate(s.run, g)))
        .filter(s => !/steps\.serve\.outcome == 'success'/.test(s.ifs))
        .map(s => s.name);
    assert.deepEqual(misKeyed, [],
        `these browser gates are not keyed on the served app: ${misKeyed.join(' | ')}`);
});
