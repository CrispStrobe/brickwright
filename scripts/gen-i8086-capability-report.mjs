#!/usr/bin/env node
/** Generate the reviewable 8086/80186/80286 capability statement from shipped evidence. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'docs/generated/I8086-CAPABILITY-REPORT.md');
const rel = p => path.relative(root, p).replaceAll(path.sep, '/');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

function capture(text, re, label) {
    const match = text.match(re);
    if (!match) throw new Error(`8086 capability evidence disappeared: ${label}`);
    return match.slice(1);
}

const fmt = n => Number(String(n).replaceAll(',', '')).toLocaleString('en-US');

export function buildI8086CapabilityReport() {
    const cpu = read('node_modules/bw-board/src/i8086.js');
    const disasm = read('node_modules/bw-board/src/i8086-disasm.js');
    const machine = read('node_modules/bw-board/src/i8086-machine.js');
    const upstreamWorkflow = read('node_modules/bw-board/.github/workflows/ci.yml');
    const harrisReceipt = JSON.parse(read('node_modules/bw-board/docs/receipts/2026-09-19-harris-real-mode.json'));
    const harrisSemantic = harrisReceipt.report;
    const compiledDos = JSON.parse(read('node_modules/bw-board/docs/HARRIS-COMPILED-DOS-BOOT-REPORT.json'));
    const runner = read('overlay/scratch-gui/src/lib/bw-debug/debug-runner.js');
    const ciVerifier = read('scripts/verify-bw-board-ci.mjs');
    const browserGate = read('scripts/verify-i8086-browser.mjs');
    const browserBench = read('scripts/bench-i8086-browser.mjs');
    const buildWorkflow = read('.github/workflows/build.yml');
    const pins = JSON.parse(read('vendor-pins.json'));

    const [cpuFiles, cpuVectors] = capture(cpu,
        /STATUS: VECTOR-COMPLETE[^\n]*?(\d+)\/\1 files, ([\d,]+) vectors/,
        '8086 vector-complete status');
    const [v20Vectors] = capture(cpu, /runs ([\d,]+)\/\1 vectors from the[\s\S]{0,80}\*\*v20\*\* suite/,
        '80186/V20 execution-vector total');
    const [disasm8086Vectors] = capture(disasm, /every one of its ([\d,]+) vectors/,
        '8086 disassembly-vector total');
    const [disasm186Vectors] = capture(disasm, /\*\*(\d[\d,]+)\/\1 on text and length\*\*/,
        '80186/V20 disassembly-vector total');
    capture(cpu, /variant:\s*\n?\s*\*?\s*'80186'/, '80186 selectable core variant');
    capture(machine, /@property \{'8086'\|'80186'\|'80286'\}/, 'machine CPU variant contract');
    capture(cpu, /expected '8086', '80186' or '80286'/, '80286 selectable core variant');
    capture(cpu, /80286 two-byte \(0x0F\) group — real-mode EXECUTING subset only/,
        '80286 real-mode execution boundary');
    const [fast286Sample] = capture(upstreamWorkflow,
        /this ([\d,]+)-vector sample stays affordable on every CI run/,
        'blocking 80286 per-push sample size');
    const [fast286Files] = capture(upstreamWorkflow,
        /coverage of every opcode file[\s\S]{0,120}?all (\d+) files/,
        'blocking 80286 opcode-file coverage');
    capture(ciVerifier, /FAST 286 real-mode — 200 vectors from every opcode file/,
        'Lite requires the blocking 80286 upstream step');
    capture(machine, /TWENTY-BIT MEMORY\. A megabyte/, 'shipped 80286 machine memory boundary');
    if (harrisSemantic.summary?.accepted !== true || harrisSemantic.summary.fullSuite !== true
        || harrisSemantic.summary.pass !== 1477997 || harrisSemantic.summary.fail !== 0
        || harrisSemantic.summary.unsupported !== 0 || harrisSemantic.summary.budget !== 0
        || harrisSemantic.summary.revoked !== 3 || harrisSemantic.summary.timingGraded !== false
        || harrisSemantic.summary.physicalBoardGraded !== false) {
        throw new Error('8086 capability evidence disappeared: accepted full Harris semantic receipt');
    }
    const receiptSources = new Map([
        ['../src/experimental/harris-80c286-boot-cpu.js', 'node_modules/bw-board/src/experimental/harris-80c286-boot-cpu.js'],
        ['./lib/sst286.mjs', 'node_modules/bw-board/scripts/lib/sst286.mjs'],
        ['./grind-i80286.mjs', 'node_modules/bw-board/scripts/grind-i80286.mjs'],
    ]);
    for (const [receiptPath, shippedPath] of receiptSources) {
        const actual = createHash('sha256').update(read(shippedPath)).digest('hex');
        if (harrisSemantic.summary.sourceHashes?.[receiptPath] !== actual) {
            throw new Error(`8086 capability evidence is historical: Harris receipt hash for ${receiptPath} `
                + 'does not match the pinned engine');
        }
    }
    if (compiledDos.accepted !== true || compiledDos.outcome?.status !== 'dos-prompt'
        || compiledDos.netBackend !== 'compiled') {
        throw new Error('8086 capability evidence disappeared: accepted compiled wired DOS receipt');
    }
    capture(cpu, /Accuracy tier: architectural state/, 'instruction-level accuracy boundary');
    capture(machine, /Execution is instruction-stepped/, 'machine timing boundary');
    for (const job of ['test', 'vectors', 'corpus', 'vectors186']) {
        capture(ciVerifier, new RegExp(`^    ${job}: \\[`, 'm'), `upstream CI ${job} requirement`);
    }
    capture(buildWorkflow,
        /npm run verify:bwboard-ci[\s\S]*?npm run vendor/,
        'upstream evidence precedes vendoring');
    capture(browserGate, /the 8086 journey made no hosted compiler request/,
        'offline 8086 browser journey');
    const [workloadId] = capture(browserBench, /const workloadId = '([^']+)'/,
        'browser CPU-bound workload identity');
    const [maximumPumpMs] = capture(browserBench,
        /const maximumSimulatedMsPerPump = (\d+)/,
        'browser simulated-time pump limit');
    const [minimumSamples] = capture(browserBench, /minimumSamples: (\d+)/,
        'browser performance sample floor');
    const [minimumRatio] = capture(browserBench, /if \(ratio < ([\d.]+)\)/,
        'browser performance ratio floor');
    capture(browserBench, /pumpBreakdown: summarizeI8086Pump\(samples\)/,
        'browser pump phase breakdown');
    capture(browserBench, /setupTimeline: timeline/,
        'browser setup and steady-state attribution');
    const [wallBudgetMs, maxQuantumNs] = capture(runner,
        // The object may continue with further fields (e.g. a DOS fast-start speed).
        /targetKind === 'i8086' \? \{wallBudgetMs: (\d+), maxQuantumNs: ([\d_]+)[,}]/,
        '8086 adaptive pump budget');
    const [snapshotMs] = capture(runner, /DEBUG_LIVE_SNAPSHOT_MS = (\d+)/,
        'debug live-snapshot interval');

    const imports = [...machine.matchAll(/^import \{ ([A-Za-z0-9]+) \} from '\.\/(.+\.js)';$/gm)]
        .map(([, symbol, file]) => ({symbol, file}));
    const wanted = new Map([
        ['I8255', 'parallel I/O'], ['I8254', 'timer'], ['I8259', 'interrupt controller'],
        ['I8251', 'serial'], ['I8237', 'DMA'], ['UPD765', 'floppy'],
        ['CGACard', 'CGA'], ['EGACard', 'EGA'], ['VGACard', 'VGA'],
        ['HerculesCard', 'Hercules'], ['PCSpeaker', 'PC speaker'],
        ['SBDSP', 'Sound Blaster DSP'], ['YM3812', 'OPL2']
    ]);
    const devices = imports.filter(x => wanted.has(x.symbol));
    if (devices.length !== wanted.size) {
        const found = new Set(devices.map(x => x.symbol));
        throw new Error(`8086 machine device inventory changed: missing ${[...wanted.keys()].filter(x => !found.has(x)).join(', ')}`);
    }

    const testGroups = [
        ['Assembly → machine → screen', 'test/i8086-asm-examples.test.mjs'],
        ['C → 80186 → DOS result', 'test/c-to-8086.test.mjs'],
        ['Pseudocode execution and refusals', 'test/pseudocode-8086.test.mjs'],
        ['Pin, ADC, timer, speaker and display paths', 'test/pseudocode-8086-pins.test.mjs'],
        ['Chip configuration propagation', 'test/i8086-chips-wiring.test.mjs'],
        ['Keyboard scan-code routing', 'test/i8086-keyboard-routing.test.mjs']
    ].map(([claim, file]) => {
        const source = read(file);
        const sites = (source.match(/\btest\s*\(/g) || []).length;
        if (!sites) throw new Error(`8086 capability evidence has no test declarations: ${file}`);
        return {claim, file, sites};
    });

    const limitations = [
        ['CPU timing', 'Instruction-level architectural state; no prefetch/BIU or T-state schedule', 'node_modules/bw-board/src/i8086.js', /NOT modeled, deliberately: the prefetch queue and the BIU/],
        ['80286 machine memory', 'The core retains real-mode addresses above 1 MiB, but the shipped breadboard machine decodes only 1 MiB; no PC/AT extended-memory or A20-gate model', 'node_modules/bw-board/src/i8086-machine.js', /TWENTY-BIT MEMORY\. A megabyte/],
        ['8088 BIU experiment', 'Orders bus operations, but omits wait states, DMA stealing and exact transfer T-states', 'node_modules/bw-board/src/i8088-biu.js', /WHAT THIS DOES NOT MODEL/],
        ['8255', 'Mode 0 exact; modes 1/2 fall back with a warning and no handshake IRQ', 'node_modules/bw-board/src/i8255.js', /MODES 1 AND 2 ARE NOT MODELLED/],
        // Modes 1 and 5 and BCD decade counting were all added 2026-09-05, so the
        // old anchor /NO MODES 1 OR 5/ no longer appears and the row read as
        // "evidence disappeared" -- which sounds like a capability was LOST when
        // in fact two limitations were lifted. The anchor now names the one
        // limitation that remains, so the row fails again only if that changes.
        ['8254', 'Modes 0-5 and BCD decades; no sub-instruction timing', 'node_modules/bw-board/src/i8254.js', /STILL NO SUB-INSTRUCTION TIMING/],
        // RE-ANCHORED 2026-09-05 with the pin bump, text and anchor together.
        // Rotation, poll mode and special mask mode landed upstream, so
        // /NO PRIORITY ROTATION/ stopped matching -- and the discriminator
        // called it correctly: "boundary MOVED, not lost ... a doc update, not
        // a regression". First real case it handled, and it routed to a doc
        // edit instead of sending someone hunting a regression.
        //
        // Anchored on LEVEL-SENSED rather than ONE CONTROLLER. Both are still
        // true and both now occur exactly once, but LEVEL-SENSED is the
        // limitation least likely to be lifted next, so it is the one that
        // costs the fewest re-anchors. ONE CONTROLLER matched TWICE until this
        // afternoon, because a stale summary line repeated it while also
        // claiming FIXED PRIORITY in the very commit that implemented
        // rotation; the ambiguity check would now catch that.
        ['8259', 'Modes and priority rotation, poll and special mask; one controller, no cascaded slave; level-sensed, no LTIM edge/level distinction', 'node_modules/bw-board/src/i8259.js', /LEVEL-SENSED/],
        ['8251', 'Byte protocol only; no bit timing, parity/framing, or synchronous data path', 'node_modules/bw-board/src/i8251.js', /NO BIT TIMING/],
        ['8237', 'Programmer-visible transfer model without bus-cycle arbitration', 'node_modules/bw-board/src/i8237.js', /programmer-visible register model, cycle-count-free/i],
        ['uPD765', 'Sector-level phase machine; no magnetic encoding or physical drive timing', 'node_modules/bw-board/src/upd765.js', /ACCURACY TIER: SECTOR-LEVEL, PHASE-EXACT/],
        ['Video', 'Useful CGA/EGA/VGA/Hercules subsets; frame cadence is not scanline/cycle exact', 'node_modules/bw-board/src/vga-card.js', /NOT THE RASTER/],
        ['OPL2', 'Pitch and envelope-shape target, not chip-identical timbre', 'node_modules/bw-board/src/ym3812.js', /PITCH AND ENVELOPE SHAPE, not timbre/],
        ['Sound Blaster', 'SB 1.x/2.0 8-bit mono subset; no SB16, mixer, or ADC', 'node_modules/bw-board/src/sb-dsp.js', /NOT a 16-bit SB16/]
    ];
    // A missing accuracy anchor has TWO opposite causes and they want opposite
    // responses, so they must not share a sentence. On 2026-09-05 the 8254 anchor
    // /NO MODES 1 OR 5/ stopped matching because modes 1 and 5 had been
    // IMPLEMENTED -- the limitation was lifted -- and the report said "evidence
    // disappeared", which reads as a capability being lost. A reader who trusts
    // that wording goes hunting a regression that is actually an improvement.
    // A fixed explanation attached to a variable outcome is the defect this
    // repository keeps finding; here it is in our own generator.
    for (const [, , file, anchor] of limitations) {
        const text = read(file);
        if (anchor.test(text)) {
            // AN ANCHOR THAT MATCHES TWICE IS NOT AN ANCHOR. If the phrase also
            // appears in a summary line or a prose aside, the row survives
            // deletion of the very limitation it exists to pin -- it silently
            // stops being a gate while still reporting success. Found 2026-09-05
            // when a proposed 8259 anchor, /ONE CONTROLLER/, turned out to match
            // both the limitation line and a stale summary above it; the summary
            // was itself false, written in the commit that lifted the limit.
            // A comment a gate anchors on IS code, and restating it elsewhere in
            // the file weakens the gate where nobody looks for that.
            const all = text.match(new RegExp(anchor.source,
                anchor.flags.includes('g') ? anchor.flags : `${anchor.flags}g`));
            if (all && all.length > 1) {
                throw new Error(`8086 capability anchor is ambiguous: ${anchor} matches `
                    + `${all.length} times in ${file}. An anchor that matches more than once `
                    + `survives deletion of the line it pins. Re-anchor on a phrase that occurs `
                    + `exactly once, or stop restating it elsewhere in the file.`);
            }
            continue;
        }
        // A dated "added"/"implemented" line is the file saying a limit moved.
        const lifted = text.match(/\b(?:added|implemented|modelled)\s+\d{4}-\d{2}-\d{2}/i);
        if (lifted) {
            throw new Error(`8086 capability boundary MOVED, not lost: ${file} no longer matches `
                + `${anchor} and records "${lifted[0]}". A limitation was LIFTED. Update this row's `
                + `text and re-anchor it on a limitation that is still true — a doc update, not a `
                + `regression.`);
        }
        throw new Error(`8086 capability evidence disappeared: ${file} accuracy boundary. `
            + `${anchor} no longer matches and nothing in the file records a capability being `
            + `added, so the boundary was REMOVED rather than moved. Read the file before `
            + `touching this row.`);
    }

    const rows = devices.map(({symbol, file}) => `| ${wanted.get(symbol)} | \`${file}\` | shipped in \`I8086Machine\` |`).join('\n');
    const tests = testGroups.map(({claim, file, sites}) => `| ${claim} | \`${file}\` | ${sites} declared test site${sites === 1 ? '' : 's'} |`).join('\n');
    const limits = limitations.map(([area, boundary, file]) => `| ${area} | ${boundary} | \`${file}\` |`).join('\n');

    return `# 8086/80186/80286 capability report

Generated by \`scripts/gen-i8086-capability-report.mjs\` from the vendored engine and Lite tests. Do not hand-edit. A normal \`npm test\` run checks that this file matches its evidence.

Vendored engine: \`CrispStrobe/bw-board@${pins['bw-board']}\`.

## CPU evidence

| Surface | Result recorded by the pinned engine | Evidence scope |
|---|---:|---|
| 8086 execution | **${cpuFiles}/${cpuFiles} opcode files; ${fmt(cpuVectors)}/${fmt(cpuVectors)} vectors** | Hardware-generated SingleStepTests architectural end state; cycles excluded |
| 8086 disassembly | **${fmt(disasm8086Vectors)}/${fmt(disasm8086Vectors)} text and length** | Same hardware-derived corpus |
| 80186 execution additions | **${fmt(v20Vectors)}/${fmt(v20Vectors)} usable V20 vectors** | NEC V20 oracle for shared 80186 encodings; not a V20-compatibility claim |
| 80186 disassembly | **${fmt(disasm186Vectors)}/${fmt(disasm186Vectors)} text and length** | V20 disassembly strings, with documented syntax exclusions |
| 80286 real-mode execution | **blocking ${fmt(fast286Sample)}-vector sample across all ${fast286Files} opcode files** | Fast functional core; every push rejects failures, unsupported results, exhausted budgets or incomplete accounting; full-corpus qualification is separate |

The selectable instruction variants are **8086**, **80186**, and **80286 real mode**. The first two instruction sets also serve 8088 and 80188 machines respectively; their external bus width is outside this instruction-stepped core. The 80286 target is deliberately a fast functional real-mode variant: it includes the 186 ISA, 286 flag/PUSH-SP differences, 24-bit real-mode physical-address formation and the implemented SGDT/SIDT/LGDT/LIDT/SMSW/LMSW/CLTS group. It is **not** a complete protected-mode or cycle-accurate 80286.

The pinned engine also carries a source-hash-matched semantic receipt for the Harris test-only adapter: **${fmt(harrisSemantic.summary.pass)}/${fmt(harrisSemantic.summary.pass)} executed vectors** across ${harrisSemantic.summary.files} files, with ${harrisSemantic.summary.revoked} upstream revocations and zero failures, unsupported results or budget exits. Generation verifies the three embedded source hashes in \`docs/receipts/2026-09-19-harris-real-mode.json\` against the pinned package. That adapter result does not grade timing or a physical board and does not substitute for the fast core's separate full-corpus qualification. An accepted historical compiled-wired receipt reaches the DOS prompt; it is functional evidence for the source hashes recorded in \`HARRIS-COMPILED-DOS-BOOT-REPORT.json\`, not evidence that the semantic SST adapter boots DOS.

The production \`i80286\` debug target still uses \`I8086Machine\`'s one-megabyte, twenty-address-line breadboard map. Core addresses above 1 MiB read as unmapped/open bus there and writes are dropped. Lite does not claim a PC/AT extended-memory map or an A20 gate.

The vector totals above are declarations carried by the pinned, byte-verified engine source and maintained by its upstream grinders. Networked product and release builds run \`npm run verify:bwboard-ci\`, which requires successful upstream \`test\`, \`vectors\`, \`corpus\`, and \`vectors186\` jobs at this exact SHA. Lite does not download the large vector corpora during its own test run. Its local tests instead protect the integration surfaces below.

## Release and browser gates

The upstream-CI verifier fails closed on missing, partial, wrong-SHA or unreachable GitHub evidence and runs before \`npm run vendor\`. It checks named successful steps inside all four required jobs, rather than accepting a workflow's overall badge.

The production-browser gate exercises local assembly with the hosted compiler blocked, DOS-bench startup, CGA pixels, keyboard input and the 8255 face. The companion desktop/mobile benchmark runs the service-free \`${workloadId}\` workload, requiring both CPU-cycle and DS-relative memory-heartbeat progress so sleeping or doing no work cannot count as throughput. Its raw and aggregate JSON receipts bind the positive GitHub run ID and full head SHA, split pump time into emulator execution, board advancement and debug/UI publication, and attribute long tasks and script resources across named setup, attach, first-render and steady-pump windows. It rejects fewer than **${minimumSamples}** useful pump samples, any pump advancing more than **${maximumPumpMs} ms** of simulated time, or less than **${minimumRatio}x XT real time**. Those are regression floors, not claims that every device matches one benchmark runner.

The shipped 8086 runner also bounds one browser callback to **${wallBudgetMs} ms**, with a maximum simulated-time quantum of **${Number(maxQuantumNs.replaceAll('_', '')).toLocaleString('en-US')} ns**, carrying debt forward. Progress-only debug snapshots are built at most every **${snapshotMs} ms**; semantic transitions and failures remain immediate.

## Lite integration evidence

| Claim | Test evidence | Static declaration count |
|---|---|---:|
${tests}

Counts are test declaration sites, not claimed pass totals. The current run result is supplied by the test runner; this document deliberately cannot turn an old run into a permanent green badge.

## Machine inventory

This inventory is extracted from \`i8086-machine.js\` imports; generation fails if the declared set and the machine diverge.

| Device | Module | Status |
|---|---|---|
${rows}

The framebuffer renderer and DOS/BIOS service layer also ship as \`i8086-cga.js\` and \`i8086-dos.js\`. Real-ROM boot acceptance (including MS-DOS) belongs to the pinned upstream system suite; it is not relabelled here as a Lite-local test.

## Accuracy boundaries

| Area | Current boundary | Source of truth |
|---|---|---|
${limits}

These are intentional boundaries, not an exhaustive bug list. The module headers remain authoritative and generation fails when a named boundary disappears, forcing this summary to be reviewed alongside the implementation.
`;
}

export function checkI8086CapabilityReport() {
    const expected = buildI8086CapabilityReport();
    const actual = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '';
    if (actual !== expected) throw new Error(`${rel(output)} is stale; run npm run gen:8086-report`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.includes('--check')) {
        checkI8086CapabilityReport();
        console.log(`${rel(output)} is current`);
    } else {
        fs.mkdirSync(path.dirname(output), {recursive: true});
        fs.writeFileSync(output, buildI8086CapabilityReport());
        console.log(`wrote ${rel(output)}`);
    }
}
