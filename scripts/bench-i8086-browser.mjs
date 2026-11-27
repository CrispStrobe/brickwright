#!/usr/bin/env node
// Production-bundle 8086 benchmark, measured at the same pump boundary the UI
// uses. It records repeated desktop, phone-sized and honestly CPU-throttled
// minimum-device runs; thresholds are deliberately limited to catching a machine
// that cannot sustain one quarter of an XT, while raw and statistical JSON
// receipts carry the distributions used for performance work.
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {
    attributeReactCommits,
    summarizeI8086Pump,
    summarizeI8086Repetitions,
    summarizeI8086SimulatedPump,
    summarizeI8086Timeline,
    summarizeReactProfiles,
    validateI8086ReceiptIdentity,
    validateI8086WorkloadIntegrity
} from './lib/i8086-performance.mjs';
import {auditWebpackResourceWindow, summarizeWebpackOwnership} from './lib/webpack-ownership.mjs';
import {measureUnpacedTarget} from './lib/i8086-unpaced-target.mjs';

const url = process.env.PROOF_URL || process.env.BW_URL || 'http://localhost:8617/';
const outDir = resolve(process.env.I8086_PERF_ARTIFACTS || 'artifacts/i8086-performance');
const rawDir = resolve(outDir, 'raw');
const requestedRepetitions = Number.parseInt(process.env.I8086_PERF_REPETITIONS || '3', 10);
const repetitions = Number.isFinite(requestedRepetitions) ? Math.max(3, requestedRepetitions) : 3;
const evidence = Object.freeze({
    runId: Number(process.env.GITHUB_RUN_ID),
    headSha: String(process.env.GITHUB_SHA || '')
});
const evidenceIssues = validateI8086ReceiptIdentity({evidence}, evidence);
if (evidenceIssues.length) {
    throw new Error(`8086 browser benchmark requires exact GitHub provenance: ${evidenceIssues.join('; ')}`);
}
const workloadId = 'i8086-cpu-bound-v1';
const heartbeatOffset = 0x110;
const maximumSimulatedMsPerPump = 50;
// Loading the lazy assembly editor is setup, outside every measured window.
// Shared CI runners can spend more than 15 s compiling/painting this chunk
// while the other browser and unit jobs are busy, and the minimum-device
// profile deliberately adds 4x CPU throttling. Give setup enough time without
// weakening any benchmark duration or performance threshold.
const assemblySetupTimeoutMs = 60000;
const workloadSource = `; BW-I8086-CPU-BOUND-V1
    ORG 100H

    JMP START

    ORG 110H
HEARTBEAT DD 0

    ORG 120H
START:
    PUSH CS
    POP DS

    MOV AX, 1
    MOV BX, 3
    MOV SI, 0200H
    MOV WORD PTR [HEARTBEAT], 0
    MOV WORD PTR [HEARTBEAT + 2], 0

MAIN:
    MOV CX, 1024
INNER_LOOP:
    ADD AX, BX
    XOR AX, 5A5AH
    MOV [SI], AX
    INC SI
    INC SI
    CMP SI, 0300H
    JB IN_RANGE
    MOV SI, 0200H

IN_RANGE:
    LOOP INNER_LOOP
    ADD WORD PTR [HEARTBEAT], 1
    ADC WORD PTR [HEARTBEAT + 2], 0
    JMP MAIN
`;
const workloadSourceSha256 = createHash('sha256').update(workloadSource).digest('hex');
const webpackStatsPath = process.env.I8086_WEBPACK_STATS;
const webpackStats = webpackStatsPath ? JSON.parse(await readFile(resolve(webpackStatsPath), 'utf8')) : null;
const webpackOwnership = webpackStats ? summarizeWebpackOwnership(webpackStats) : null;
const optionalGrammarAssets = new Set(webpackOwnership?.optionalCodeMirrorGrammars.files || []);
const lazyPaintAssets = new Set(webpackOwnership?.lazyPaintEditor.files || []);
const profiles = [
    {name: 'desktop', viewport: {width: 1440, height: 900}, deviceScaleFactor: 1, cpuThrottleRate: 1},
    {name: 'mobile', viewport: {width: 412, height: 915}, deviceScaleFactor: 2, isMobile: true,
        hasTouch: true, cpuThrottleRate: 1},
    // Honest minimum-device proxy: small touch viewport plus Chromium renderer
    // CPU throttling. This does not claim to emulate RAM, core count or network.
    {name: 'minimum-device-4x', viewport: {width: 360, height: 640}, deviceScaleFactor: 2,
        isMobile: true, hasTouch: true, cpuThrottleRate: 4},
];
const percentile = (xs, p) => xs[Math.min(xs.length - 1, Math.floor(xs.length * p))];

await mkdir(rawDir, {recursive: true});
const browser = await chromium.launch({headless: true});
const results = [];
const summaries = [];
try {
    for (const profile of profiles) {
        const profileResults = [];
        for (let repetition = 1; repetition <= repetitions; repetition++) {
        const {name, cpuThrottleRate, ...contextOptions} = profile;
        const context = await browser.newContext(contextOptions);
        const page = await context.newPage();
        let cdp = null;
        try {
        cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', {rate: cpuThrottleRate});
        await page.addInitScript(() => {
            localStorage.clear();
            localStorage.setItem('bw-starter-v1-complete', '1');
            window.__BW_I8086_PERF__ = {
                samples: [], longTasks: [], reactProfiles: [], reactUpdateSources: [], milestones: [
                    {name: 'probe-installed', at: performance.now()}
                ], limit: 1000, profileLimit: 2000, sourceLimit: 4000
            };
            if (typeof PerformanceObserver === 'function') {
                try {
                    new PerformanceObserver((list) => {
                        for (const e of list.getEntries()) {
                            window.__BW_I8086_PERF__.longTasks.push({at: e.startTime, ms: e.duration});
                        }
                    }).observe({entryTypes: ['longtask']});
                } catch { /* unsupported browsers report an empty list */ }
            }
        });
        const mark = name => page.evaluate(markName => {
            const probe = window.__BW_I8086_PERF__;
            if (probe) probe.milestones.push({name: markName, at: performance.now()});
        }, name);
        await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});
        await mark('dom-ready');
        await page.getByRole('tab', {name: 'Code', exact: true}).click();
        const device = page.getByTestId('bw-device-select');
        // This is setup synchronisation; the durable `running` phase below proves the bench.
        // gate-shapes-allow
        await device.waitFor({state: 'visible', timeout: 30000});
        await mark('device-ready');
        // Clear the home GPIO starter before requesting a different device. The
        // picker request below is still a real retarget operation (and may load
        // sb3-creator), but it must not inherit pins from the starter program.
        const initialEditor = page.locator('.cm-content:visible').first();
        await initialEditor.waitFor({state: 'visible', timeout: assemblySetupTimeoutMs});
        await initialEditor.click();
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
        await page.keyboard.press('Backspace');
        await page.waitForFunction(() => [...document.querySelectorAll('.cm-content')]
            .filter(node => node.getClientRects().length > 0)
            .every(node => !(node.textContent || '').trim()),
        null, {timeout: assemblySetupTimeoutMs});
        await page.waitForFunction(() =>
            document.querySelector('[data-testid="bw-device-select"]')?.value === '',
        null, {timeout: assemblySetupTimeoutMs});
        await page.waitForLoadState('networkidle', {timeout: 20000}).catch(() => {});
        await mark('dos-load-start');
        // The resource window before this mark proves that merely revealing
        // Code did not fetch the compiler. The retarget request after it is a
        // legitimate compiler consumer.
        await mark('retarget-request');
        await device.selectOption('i8086');
        await page.waitForFunction(() =>
            document.querySelector('[data-testid="bw-device-select"]')?.value === 'i8086',
        null, {timeout: assemblySetupTimeoutMs});
        await mark('i8086-selected');
        // Device selection briefly marks the language row busy. A forced click
        // on its disabled ASM button is silently discarded by the browser, so
        // first wait for the actual production control to become enabled. The
        // minimum-width row can overlap siblings visually; dispatching the
        // click after that readiness check avoids charging layout quirks to a
        // benchmark whose measured window has not started yet.
        const asmTab = page.getByTestId('bw-lang-row').getByRole('button', {name: /ASM/});
        await page.waitForFunction(() => [...document.querySelectorAll(
            '[data-testid="bw-lang-row"] button'
        )].some(button => /ASM/.test(button.textContent || '') && !button.disabled),
        null, {timeout: assemblySetupTimeoutMs});
        await asmTab.dispatchEvent('click');
        await page.getByTestId('bw-asm-examples').waitFor({
            state: 'visible', timeout: assemblySetupTimeoutMs
        });
        const dialect = page.getByTestId('bw-asm-dialect');
        await dialect.waitFor({state: 'visible', timeout: assemblySetupTimeoutMs});
        await dialect.selectOption('masm');
        await mark('asm-ready');
        const editor = page.locator('.cm-content:visible').first();
        await editor.waitFor({state: 'visible', timeout: assemblySetupTimeoutMs});
        await editor.click();
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
        await page.keyboard.press('Backspace');
        await page.keyboard.insertText(workloadSource);
        await page.waitForFunction(marker => [...document.querySelectorAll('.cm-content')].some(node =>
            node.getClientRects().length > 0 && (node.textContent || '').includes(marker)),
        'BW-I8086-CPU-BOUND-V1', {timeout: assemblySetupTimeoutMs});
        await page.waitForFunction(() => {
            const button = document.querySelector('[data-testid="bw-asm-assemble"]');
            return button && !button.disabled;
        }, null, {timeout: assemblySetupTimeoutMs});
        await mark('example-ready');
        // On the phone layout the example picker can overlap this control.
        // Setup is not the subject of this benchmark; click the enabled
        // production button and measure only the resulting machine pump.
        await page.getByTestId('bw-asm-assemble').click({force: true});
        await mark('assemble-clicked');
        try {
            await page.locator('[data-debug-panel][data-debug-phase="running"]')
                .waitFor({state: 'attached', timeout: 30000});
        } catch (cause) {
            const state = await page.evaluate(() => ({
                codeStatus: document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus || '',
                debugPhase: document.querySelector('[data-debug-panel]')?.getAttribute('data-debug-phase') || '',
                device: document.querySelector('[data-testid="bw-device-select"]')?.value || '',
                assembleDisabled: document.querySelector('[data-testid="bw-asm-assemble"]')?.disabled ?? null,
                visibleEditor: [...document.querySelectorAll('.cm-content')]
                    .find(node => node.getClientRects().length > 0)?.textContent || ''
            }));
            throw new Error(`the assembled 8086 benchmark did not reach running: ${JSON.stringify(state)}`,
                {cause});
        }
        await mark('bench-booted');
        await mark('runner-running');
        await mark('circuit-open-request');
        await page.getByRole('tab', {name: /Circuit/}).click({force: true});
        await page.locator('[data-debug-panel]').waitFor({state: 'visible', timeout: 30000}); // gate-shapes-allow: synchronization before the measured two-frame paint boundary below; this persistent panel must not disappear
        // The click promise ends after the event handler, not after React's
        // commit and paint. Two frames put the sample window on the far side
        // of the first visible Circuit render instead of quietly charging
        // that setup task to steady execution.
        await page.evaluate(() => new Promise(resolve =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await mark('steady-window-ready');
        const readHeartbeat = offset => page.evaluate(heartbeatOffsetValue => {
            const target = window.__benchTarget;
            if (!target || typeof target.regs !== 'function' || typeof target.readMem !== 'function') {
                throw new Error('the production runner exposed no readable benchmark target');
            }
            const registers = target.regs();
            if (!Number.isInteger(registers?.ds)) throw new Error('the 8086 target exposed no integer DS');
            if (registers.ds !== registers.cs) throw new Error('the CPU-bound COM lost its explicit DS=CS');
            if (typeof target.state !== 'function' || target.state() !== 'running') {
                throw new Error('the benchmark target is not running');
            }
            const address = (((registers.ds & 0xffff) << 4) + heartbeatOffsetValue) & 0xfffff;
            const bytes = target.readMem('mem', address, 4);
            if (!(bytes instanceof Uint8Array) || bytes.length !== 4) {
                throw new Error('the 8086 heartbeat read did not return four memory bytes');
            }
            const value = (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
            return {ds: registers.ds & 0xffff, address, value, cycles: Number(registers.cycles)};
        }, offset);
        const heartbeatBefore = await readHeartbeat(heartbeatOffset);
        const steadyBaseline = await page.evaluate(() => window.__BW_I8086_PERF__?.samples?.length || 0);
        await page.waitForFunction(baseline =>
            window.__BW_I8086_PERF__?.samples?.length >= baseline + 180,
        steadyBaseline, {timeout: 30000, polling: 'raf'});
        const heartbeatAfter = await readHeartbeat(heartbeatOffset);
        const raw = await page.evaluate(() => ({
            ...window.__BW_I8086_PERF__,
            heapBytes: performance.memory?.usedJSHeapSize ?? null,
            userAgent: navigator.userAgent,
            resources: [...performance.getEntriesByType('navigation'),
                ...performance.getEntriesByType('resource')].map(entry => ({
                name: entry.name,
                kind: entry.entryType === 'navigation' ? 'document' : entry.initiatorType,
                at: entry.startTime,
                ms: entry.duration,
                transferSize: entry.transferSize || 0,
                encodedBodySize: entry.encodedBodySize || 0,
                decodedBodySize: entry.decodedBodySize || 0
            }))
        }));
        const steadySamples = raw.samples.slice(steadyBaseline);
        const simulatedMsPerPump = summarizeI8086SimulatedPump(
            steadySamples, maximumSimulatedMsPerPump);
        const samples = steadySamples.filter(s => Number.isFinite(Number(s.simNs)) && Number(s.simNs) > 0);
        const pump = samples.map(s => s.wallMs).sort((a, b) => a - b);
        const simMs = samples.reduce((n, s) => n + s.simNs / 1e6, 0);
        const sampleStart = samples[0].at;
        const sampleEnd = samples.at(-1).at + samples.at(-1).wallMs;
        const elapsedMs = sampleEnd - sampleStart;
        const runtimeLongTasks = raw.longTasks.filter(task =>
            task.at <= sampleEnd && task.at + task.ms >= sampleStart);
        const steadyLongTasks = raw.longTasks.filter(task =>
            task.at >= sampleStart && task.at < sampleEnd);
        const startupProfiles = raw.reactProfiles.filter(sample => sample.commitTime < sampleStart);
        const runtimeProfiles = raw.reactProfiles.filter(sample =>
            sample.commitTime >= sampleStart && sample.commitTime <= sampleEnd);
        const timeline = summarizeI8086Timeline({
            milestones: raw.milestones,
            longTasks: raw.longTasks,
            resources: raw.resources,
            sampleStart,
            sampleEnd
        });
        const probeInstalledAt = raw.milestones.find(mark => mark.name === 'probe-installed')?.at ?? 0;
        const circuitOpenMilestone = raw.milestones.find(mark => mark.name === 'circuit-open-request');
        if (!circuitOpenMilestone) {
            throw new Error(`${name} #${repetition} lost the pre-Circuit resource boundary`);
        }
        const circuitOpenAt = circuitOpenMilestone.at;
        const retargetMilestone = raw.milestones.find(mark => mark.name === 'retarget-request');
        if (!retargetMilestone) {
            throw new Error(`${name} #${repetition} lost the pre-retarget resource boundary`);
        }
        const retargetAt = retargetMilestone.at;
        const dosLoadAt = raw.milestones.find(mark => mark.name === 'dos-load-start')?.at ?? 0;
        const runnerRunningAt = raw.milestones.find(mark => mark.name === 'runner-running')?.at ?? sampleStart;
        const dosLoadResources = webpackStats ? auditWebpackResourceWindow(webpackStats, raw.resources, {
            from: dosLoadAt,
            to: runnerRunningAt,
            origin: new URL(url).origin
        }) : null;
        // The causal window above answers what selection/assembly requested.
        // This cold journey also includes chunks fetched when opening Code;
        // otherwise an eager bw-board barrel looks "absent" merely because it
        // finished downloading before the device picker appeared.
        const dosJourneyResources = webpackStats ? auditWebpackResourceWindow(webpackStats, raw.resources, {
            from: 0,
            to: runnerRunningAt,
            origin: new URL(url).origin
        }) : null;
        // Product gate for the debugger-only Code-tab layout. The existing
        // milestone is recorded immediately before the Circuit click, so this
        // reuses the same cold journey and cannot accidentally charge the
        // designer's intentional post-click load to the deferral verdict.
        const preCircuitResources = webpackStats ? auditWebpackResourceWindow(webpackStats, raw.resources, {
            from: 0,
            to: circuitOpenAt,
            origin: new URL(url).origin
        }) : null;
        const preRetargetResources = webpackStats ? auditWebpackResourceWindow(webpackStats, raw.resources, {
            from: 0,
            to: retargetAt,
            origin: new URL(url).origin
        }) : null;
        const startupAttribution = attributeReactCommits(
            raw.reactProfiles, raw.reactUpdateSources, {from: probeInstalledAt, to: sampleStart});
        const circuitOpenAttribution = attributeReactCommits(
            raw.reactProfiles, raw.reactUpdateSources, {from: circuitOpenAt, to: sampleStart});
        const ratio = simMs / elapsedMs;
        const heartbeatDelta = (heartbeatAfter.value - heartbeatBefore.value) >>> 0;
        const cycleDelta = heartbeatAfter.cycles - heartbeatBefore.cycles;
        // A separate synchronous phase on the actual webpack target. Do not
        // mix these samples with paced UI latency or startup attribution.
        const unpacedTarget = await page.evaluate(measureUnpacedTarget, {});
        const result = {
            unpacedTarget,
            profile: name,
            repetition,
            cpuThrottleRate,
            samples: samples.length,
            simulatedMs: simMs,
            elapsedMs,
            realTimeRatio: ratio,
            workload: {
                id: workloadId,
                sourceSha256: workloadSourceSha256,
                heartbeatOffset,
                heartbeatSegment: heartbeatBefore.ds,
                heartbeatAddress: heartbeatBefore.address,
                heartbeatBefore: heartbeatBefore.value,
                heartbeatAfter: heartbeatAfter.value,
                heartbeatDelta,
                cyclesBefore: heartbeatBefore.cycles,
                cyclesAfter: heartbeatAfter.cycles,
                cycleDelta
            },
            simulatedMsPerPump,
            pumpMs: {p50: percentile(pump, 0.50), p95: percentile(pump, 0.95), max: pump.at(-1)},
            pumpBreakdown: summarizeI8086Pump(samples),
            longTasks: runtimeLongTasks,
            steadyLongTasks,
            setupTimeline: timeline,
            startupLongTaskCount: raw.longTasks.filter(task => task.at + task.ms < sampleStart).length,
            reactProfiles: {
                startup: summarizeReactProfiles(startupProfiles),
                runtime: summarizeReactProfiles(runtimeProfiles),
                all: summarizeReactProfiles(raw.reactProfiles)
            },
            reactAttribution: {
                startup: startupAttribution,
                circuitOpen: circuitOpenAttribution
            },
            dosLoadResources,
            dosJourneyResources,
            preCircuitResources,
            preRetargetResources,
            heapBytes: raw.heapBytes,
            userAgent: raw.userAgent,
        };
        results.push(result);
        profileResults.push(result);
        const rawReceipt = {
                schema: 'brickwright/i8086-browser-performance-raw/v5',
                evidence,
                url,
                profile: {name, ...contextOptions, cpuThrottleRate},
                repetition,
                raw,
                result
        };
        const rawIdentityIssues = validateI8086ReceiptIdentity(rawReceipt, evidence);
        if (rawIdentityIssues.length) {
            throw new Error(`${name} #${repetition} lost receipt provenance: ${rawIdentityIssues.join('; ')}`);
        }
        await writeFile(resolve(rawDir, `${name}-${String(repetition).padStart(2, '0')}.json`),
            `${JSON.stringify(rawReceipt, null, 2)}\n`);
        console.log(`${name} #${repetition}: ${ratio.toFixed(2)}x XT, pump p50 `
            + `${result.pumpMs.p50.toFixed(2)} ms, p95 ${result.pumpMs.p95.toFixed(2)} ms, `
            + `${runtimeLongTasks.length} runtime long task(s)`);
        console.log(`  workload: ${heartbeatDelta} completed heartbeat iteration(s), simulated pump p95 `
            + `${simulatedMsPerPump.p95?.toFixed(2)} ms, ${simulatedMsPerPump.overshootCount} overshoot(s)`);
        console.log(`  long tasks: ${steadyLongTasks.length} started during steady pump, `
            + `${timeline.boundaryCrossingLongTasks.length} crossed into it from setup`);
        console.log(`  setup ownership: ${timeline.phases
            .filter(phase => phase.name !== 'steady-pump' && phase.longTasksStarted)
            .map(phase => `${phase.name}=${phase.longTasksStarted}`)
            .join(', ') || 'no setup long tasks'}`);
        console.log(`  pump CPU: run ${result.pumpBreakdown.phases.runMs.percentOfPump.toFixed(1)}%, `
            + `board ${result.pumpBreakdown.phases.boardMs.percentOfPump.toFixed(1)}%, `
            + `publish ${result.pumpBreakdown.phases.publishMs.percentOfPump.toFixed(1)}%; `
            + `${result.pumpBreakdown.snapshots.built}/${samples.length} snapshots built`);
        const startupDesigner = startupAttribution.boundaries.CircuitDesigner;
        if (startupDesigner) console.log(`  React attribution: CircuitDesigner `
            + `${startupDesigner.attributedCommits}/${startupDesigner.commits} startup commits attributed, `
            + `${startupDesigner.unattributedCommits} unknown`);
        const missingProfiles = ['DebugPanel', 'CircuitDesigner', 'BoardCanvas'].filter(id =>
            !raw.reactProfiles.some(sample => sample.id === id));
        if (missingProfiles.length) {
            throw new Error(`${name} #${repetition} profiling build emitted no ${missingProfiles.join(', ')} commits`);
        }
        if (dosLoadResources) {
            console.log(`  DOS load: ${(dosLoadResources.encodedBodyBytes / 1024).toFixed(1)} KiB encoded, ` +
                `${dosLoadResources.assets.length} webpack asset(s), ` +
                `${dosLoadResources.forbiddenModules.length} forbidden module(s)`);
            if (dosLoadResources.unmatchedAssets.length) {
                throw new Error(`${name} #${repetition} DOS load fetched JavaScript absent from webpack stats: ` +
                    dosLoadResources.unmatchedAssets.join(', '));
            }
            if (dosLoadResources.forbiddenModules.length) {
                throw new Error(`${name} #${repetition} DOS load fetched unrelated webpack modules: ` +
                    dosLoadResources.forbiddenModules.map(module =>
                        `${module.reason}: ${module.name}`).join(', '));
            }
        }
        if (dosJourneyResources) {
            console.log(`  cold DOS journey: ${(dosJourneyResources.encodedBodyBytes / 1048576).toFixed(2)} MiB ` +
                `encoded, ${dosJourneyResources.forbiddenModules.length} unrelated module(s)`);
        }
        if (preCircuitResources) {
            const eagerCircuitAssets = preCircuitResources.assets.filter(asset =>
                /(?:^|\/)bw-(?:board|circuit-ui)\.js$/.test(asset));
            const speculativeCompilerAssets = (preRetargetResources?.assets || []).filter(asset =>
                /(?:^|\/)sb3-creator\.js$/.test(asset));
            const speculativeExampleAssets = preCircuitResources.assets.filter(asset =>
                /(?:^|\/)pseudocode-examples\.js$/.test(asset));
            const eagerGrammarAssets = preCircuitResources.assets.filter(asset =>
                optionalGrammarAssets.has(asset));
            const eagerPaintAssets = preCircuitResources.assets.filter(asset => lazyPaintAssets.has(asset));
            console.log(`  pre-Circuit: ${(preCircuitResources.encodedBodyBytes / 1048576).toFixed(2)} MiB ` +
                `encoded, ${eagerCircuitAssets.length} deferred circuit asset(s) and ` +
                `${speculativeCompilerAssets.length} pre-retarget compiler asset(s), ` +
                `${speculativeExampleAssets.length} speculative examples asset(s), and ` +
                `${eagerGrammarAssets.length} optional grammar asset(s), and ` +
                `${eagerPaintAssets.length} paint asset(s) fetched early`);
            if (preCircuitResources.unmatchedAssets.length) {
                throw new Error(`${name} #${repetition} pre-Circuit window fetched JavaScript absent ` +
                    `from webpack stats: ${preCircuitResources.unmatchedAssets.join(', ')}`);
            }
            if (eagerCircuitAssets.length) {
                throw new Error(`${name} #${repetition} debugger-only Code layout fetched deferred assets ` +
                    `before Circuit opened: ${eagerCircuitAssets.join(', ')}`);
            }
            if (speculativeCompilerAssets.length) {
                throw new Error(`${name} #${repetition} Code layout fetched the compiler without a ` +
                    `retarget, conversion, compile, or export request: ${speculativeCompilerAssets.join(', ')}`);
            }
            if (speculativeExampleAssets.length) {
                throw new Error(`${name} #${repetition} Code layout fetched bundled examples before ` +
                    `the no-device Tools menu opened: ${speculativeExampleAssets.join(', ')}`);
            }
            if (eagerGrammarAssets.length) {
                throw new Error(`${name} #${repetition} ASM journey fetched unused CodeMirror grammars: ` +
                    eagerGrammarAssets.join(', '));
            }
            if (eagerPaintAssets.length) {
                throw new Error(`${name} #${repetition} debugger-only journey fetched paint before Costume: ` +
                    eagerPaintAssets.join(', '));
            }
        }
        for (const [windowName, attribution] of Object.entries(result.reactAttribution)) {
            for (const [id, boundary] of Object.entries(attribution.boundaries)) {
                if (boundary.attributedCommits + boundary.unattributedCommits !== boundary.commits) {
                    throw new Error(`${name} #${repetition} ${windowName}/${id} attribution lost commits`);
                }
            }
        }
        const integrityIssues = validateI8086WorkloadIntegrity(result, {
            workloadId,
            sourceSha256: workloadSourceSha256,
            heartbeatOffset,
            maximumSimulatedMsPerPump,
            minimumSamples: 150
        });
        if (heartbeatBefore.address !== heartbeatAfter.address) {
            integrityIssues.push('heartbeat address changed during the steady window');
        }
        if (integrityIssues.length) {
            throw new Error(`${name} #${repetition} invalid CPU-bound workload receipt: `
                + integrityIssues.join('; '));
        }
        if (ratio < 0.25) {
            throw new Error(`${name} #${repetition} 8086 benchmark did not sustain 0.25x real time`);
        }
        } finally {
            if (cdp) await cdp.detach().catch(() => {});
            await context.close();
        }
        }
        const summary = summarizeI8086Repetitions(profileResults);
        summaries.push({profile: profile.name, cpuThrottleRate: profile.cpuThrottleRate, ...summary});
        console.log(`${profile.name}: ${summary.realTimeRatio.median.toFixed(2)}x XT median `
            + `[${summary.realTimeRatio.min.toFixed(2)}, ${summary.realTimeRatio.max.toFixed(2)}], `
            + `range ${summary.realTimeRatio.range.toFixed(2)} across ${summary.repetitions} repetitions`);
    }
} finally {
    const report = {
        schema: 'brickwright/i8086-browser-performance/v6', evidence, url, repetitions, results, summaries,
    };
    const reportIdentityIssues = validateI8086ReceiptIdentity(report, evidence);
    if (reportIdentityIssues.length) {
        throw new Error(`aggregate receipt lost provenance: ${reportIdentityIssues.join('; ')}`);
    }
    await writeFile(resolve(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await browser.close();
}
