#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
/**
 * Rendered Code-tab acceptance for the owned console JavaScript contract.
 *
 * Run against an actual built Brickwright editor, for example:
 *   PROOF_URL=http://localhost:8617/ node scripts/verify-owned-console-code-tab.mjs
 *
 * BW_BROWSER selects a Chromium executable. BW_BROWSER_RUNTIME_ROOT may point
 * at another installed runtime containing playwright and jszip. --out chooses
 * the JSON receipt; screenshots, saved projects and generated sources sit beside
 * it. --qualification-manifest binds either an experimental supplier integration
 * or a clean committed-pin local build to its sources, mirrors and asset hashes.
 * BW_CHROMIUM_RUNTIME_ROOT optionally names an installed @sparticuz/chromium
 * runtime; web-security and forced SharedArrayBuffer overrides are removed.
 * This harness does not install dependencies, build, or change the app.
 *
 * All editor changes, generation, execution and project Save/Open use visible
 * controls. CodeMirror, the VM and autosave are observed only. No component
 * setter, replacement Worker, mock runtime or direct VM loading is used.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {openCodeActions} from './lib-code-actions.mjs';
import {verifyOwnedConsoleBundleSource, settleOwnedConsoleScriptReads,
    assertOwnedConsoleLoadedScripts} from './lib/owned-console-bundle.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '..');
const fixturePath = path.join(root, 'scripts/probes/code-runtime/owned-code-tab/boolean-value.fixture.json');
const argument = (name, fallback) => {
    const equal = process.argv.find(value => value.startsWith(`${name}=`));
    if (equal) return equal.slice(name.length + 1);
    const index = process.argv.indexOf(name);
    if (index < 0) return fallback;
    assert(process.argv[index + 1] && !process.argv[index + 1].startsWith('--'), `${name} requires a value`);
    return process.argv[index + 1];
};
const base = argument('--url', process.env.BW_BASE_URL || process.env.PROOF_URL || 'http://localhost:8617/');
const out = path.resolve(argument('--out', process.env.BW_OWNED_CONSOLE_REPORT ||
    path.join(root, 'scripts/probes/code-runtime/owned-code-tab/results.json')));
const artifacts = path.dirname(out);
const requireRuntime = createRequire(path.join(path.resolve(process.env.BW_BROWSER_RUNTIME_ROOT || root), 'package.json'));
const {chromium} = requireRuntime('playwright');
const JSZip = requireRuntime('jszip');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const owned = 'owned-console-v1';
const inputHoldMs = 4500; // Deliberately longer than the production four-second execution budget.
const qualificationPath = argument('--qualification-manifest', process.env.BW_OWNED_CONSOLE_QUALIFICATION || null);
const qualificationBytes = qualificationPath ? await fs.readFile(path.resolve(qualificationPath)) : null;
const qualification = qualificationBytes ? JSON.parse(qualificationBytes) : {
    classification: 'unbound-local-build',
    shippingEvidence: false,
    note: 'No build/source identity manifest was supplied; this receipt proves only the observed local UI journey.'
};
let observedGit = null;
if (qualificationBytes) {
    observedGit = await verifyOwnedConsoleBundleSource({root, qualification,
        executable: argument('--git-executable', process.env.BW_GUI_GIT_EXECUTABLE)});
}

const concurrentPseudo = [
    'SPRITE OwnedConsole:',
    '  DEFINE finish:',
    '    wait 0.08 seconds',
    '    say "procedure"',
    '  WHEN flag clicked:',
    '    say "first"',
    '    finish',
    '    ask "Name?" and wait',
    '    say answer',
    '    say "last"',
    '  WHEN flag clicked:',
    '    say "second"',
    ''
].join('\n');
const stopPseudo = [
    'SPRITE OwnedConsole:',
    '  WHEN flag clicked:',
    '    say "ready"',
    '    wait 10 seconds',
    '    say "late"',
    ''
].join('\n');
const authoredJavaScript = [
    'codeRun.spawn(async task => {',
    '    console.log("saved-before");',
    '    await task.sleep(25);',
    '    console.log("saved-after");',
    '});',
    '// Authored source: this comment and Unicode Ω must survive save and reopen.',
    ''
].join('\n');
const authoredOutput = 'saved-before\nsaved-after\n';
const authoredPython = '# Ordinary Python remains executable source.\nprint(7 // 2)\n';

await fs.mkdir(artifacts, {recursive: true});
const fixtureBytes = await fs.readFile(fixturePath);
const fixture = JSON.parse(fixtureBytes);
const report = {
    schema: 'bw.owned-console-code-tab-acceptance.v1',
    status: 'running',
    startedAt: new Date().toISOString(),
    url: base,
    scope: 'Actual built editor, CodeMirror edits, visible generation target, production console worker, ' +
        'read-only VM observations, and actual SB3 File Save/Open. Desktop Chromium only; ' +
        'no device, simulator, stage scheduler or other browser/platform qualification.',
    fixtureSha256: sha256(fixtureBytes),
    harnessSha256: sha256(await fs.readFile(scriptPath)),
    qualification,
    ...(qualificationBytes ? {qualificationManifestSha256: sha256(qualificationBytes)} : {}),
    environment: {node: process.version, platform: process.platform, arch: process.arch,
        playwright: requireRuntime('playwright/package.json').version,
        ...(observedGit ? {git: observedGit} : {})},
    checks: [],
    sources: {},
    runs: [],
    workers: [],
    loadedScripts: [],
    nonEmittedScriptResponses: [],
    assetBindingScope: 'Every same-origin HTTP(S) script response is hashed against the emitted build inventory. ' +
        'Dynamic Blob worker URLs are outside that inventory; their creation and closure are observed separately.',
    screenshots: [],
    errors: [],
    consoleErrors: []
};
let browser;
let page;
const scriptReads = [];
const step = async (name, body) => {
    const check = {name, status: 'running', startedAt: new Date().toISOString()};
    report.checks.push(check);
    const start = performance.now();
    try {
        const detail = await body();
        Object.assign(check, {status: 'passed', durationMs: Math.round(performance.now() - start), ...(detail || {})});
        console.log(`ok   ${name}`);
    } catch (error) {
        Object.assign(check, {status: 'failed', durationMs: Math.round(performance.now() - start),
            error: error.stack || String(error)});
        throw error;
    }
};
const codeEditor = () => page.getByTestId('bw-code-editor').locator('.cm-content');
const langTab = label => page.getByTestId('bw-lang-row').getByRole('button', {name: label, exact: true});
const editorText = () => codeEditor().evaluate(element => element.cmTile.root.view.state.doc.toString());
const outputText = () => page.getByTestId('bw-code-output').textContent();
const targetSelect = () => page.getByTestId('bw-js-execution-target');
const idle = () => page.waitForFunction(() => {
    // The merged toolbar also contains legitimately disabled conversion and
    // scroll buttons. Only the language controls expose the importer's busy
    // state; an empty source must still count as an idle, editable document.
    const languages = [...document.querySelectorAll('[data-testid="bw-lang-row"] button')]
        .filter(button => ['🧩 Pseudo', '🐍 Py', '🟨 JS'].includes(button.textContent.trim()));
    return languages.length === 3 && languages.every(button => !button.disabled);
}, null, {timeout: 30000});
const openCode = async () => {
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await codeEditor().waitFor({state: 'visible', timeout: 30000});
    await idle();
};
const waitEditorText = text => page.waitForFunction(expected => {
    const element = document.querySelector('[data-testid="bw-code-editor"] .cm-content');
    return element?.cmTile?.root?.view?.state.doc.toString() === expected;
}, text, {timeout: 30000});
const replaceSource = async text => {
    await codeEditor().click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText(text);
    await waitEditorText(text);
};
const waitOutput = expected => page.waitForFunction(text =>
    document.querySelector('[data-testid="bw-code-output"]')?.textContent === text,
expected, {timeout: 30000});
const waitRunComplete = () => page.waitForFunction(() => {
    const run = document.querySelector('[data-testid="bw-code-run"]');
    return run && !run.disabled && !document.querySelector('[data-testid="bw-code-stop"]') &&
        !document.querySelector('[data-testid="bw-code-input"]');
}, null, {timeout: 30000});
const chooseOwned = async () => {
    await langTab('🟨 JS').click();
    await idle();
    await targetSelect().waitFor({state: 'visible'});
    assert.equal(await targetSelect().locator(`option[value="${owned}"]`).textContent(), 'Console program');
    await targetSelect().selectOption(owned);
    await idle();
    assert.equal(await targetSelect().inputValue(), owned);
};
const rememberSource = async name => {
    const source = await editorText();
    const file = path.join(artifacts, `${name}.js`);
    await fs.writeFile(file, source);
    report.sources[name] = {file: path.basename(file), sha256: sha256(source), bytes: Buffer.byteLength(source)};
    return source;
};
const generatedProgram = async (source, name) => {
    await langTab('🧩 Pseudo').click();
    await idle();
    assert.equal(await langTab('🧩 Pseudo').getAttribute('aria-pressed'), 'true');
    await replaceSource(source);
    await chooseOwned();
    await page.waitForFunction(() => {
        const editor = document.querySelector('[data-testid="bw-code-editor"] .cm-content');
        return /codeRun\.spawn/.test(editor?.cmTile?.root?.view?.state.doc.toString() || '');
    }, null, {timeout: 30000});
    const generated = await rememberSource(name);
    assert.match(generated, /\/\/ owned-console-v1:/);
    assert.match(generated, /codeRun\.spawn/);
    return generated;
};
const screenshot = async name => {
    const file = path.join(artifacts, `${name}.png`);
    await page.screenshot({path: file, fullPage: true});
    report.screenshots.push(path.basename(file));
};
const vmGraph = () => page.evaluate(() => {
    const vm = window.__brickwrightStore.getState().scratchGui.vm;
    const project = JSON.parse(vm.toJSON());
    return project.targets.map(target => ({isStage: target.isStage, name: target.name,
        blocks: target.blocks, variables: target.variables, lists: target.lists,
        broadcasts: target.broadcasts, comments: target.comments}));
});
const fileOpen = async file => {
    const previousTarget = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.editingTarget?.id);
    await page.getByText('File', {exact: true}).click();
    await page.getByText('Load from your computer', {exact: true}).click();
    await page.locator('body > input[type="file"][accept*=".sb3"]').setInputFiles(file);
    await page.waitForFunction(previous => {
        const target = window.__brickwrightStore.getState().scratchGui.vm.editingTarget;
        return target && target.id !== previous;
    }, previousTarget, {timeout: 30000});
};
const fileSave = async name => {
    await page.getByText('File', {exact: true}).click();
    const pending = page.waitForEvent('download', {timeout: 30000});
    await page.getByText('Save to your computer', {exact: true}).click();
    const download = await pending;
    const file = path.join(artifacts, `${name}.sb3`);
    await download.saveAs(file);
    const bytes = await fs.readFile(file);
    const zip = await JSZip.loadAsync(bytes);
    const bundleEntry = zip.file('brickwright/state.json');
    assert(bundleEntry, 'actual File Save includes the Brickwright project bundle');
    const bundle = JSON.parse(await bundleEntry.async('text'));
    return {file, sha256: sha256(bytes), bundle};
};
const newRun = async name => {
    const run = {name, startedAt: new Date().toISOString(), workerStartIndex: report.workers.length};
    report.runs.push(run);
    await page.getByTestId('bw-code-run').click();
    return run;
};
const finishRun = async (run, expected) => {
    await waitRunComplete();
    if (expected !== undefined) await waitOutput(expected);
    run.output = await outputText();
    // Observe the browser's actual dedicated-worker lifecycle. No monkeypatch
    // or injected worker factory is needed to prove these runs really close.
    const deadline = performance.now() + 10000;
    let workers;
    while (performance.now() < deadline) {
        workers = report.workers.slice(run.workerStartIndex).filter(worker => worker.url.startsWith('blob:'));
        if (workers.length && workers.every(worker => worker.closedAt)) break;
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert(workers?.length, `${run.name}: the actual app created a Blob Worker`);
    assert(workers.every(worker => worker.closedAt), `${run.name}: production workers closed after settlement`);
    run.workerIndexes = workers.map(worker => report.workers.indexOf(worker));
    run.finishedAt = new Date().toISOString();
    return run;
};
const assertAuthoredView = async () => {
    await waitEditorText(authoredJavaScript);
    assert.equal(await langTab('🟨 JS').getAttribute('aria-pressed'), 'true');
    assert.equal(await targetSelect().inputValue(), owned);
};
const assertAuthoredRecord = record => {
    assert(record, 'saved archive contains a Code document');
    assert.equal(record.version, 1);
    assert.equal(record.lang, 'javascript');
    assert.equal(record.selectedLang, 'javascript');
    assert.equal(record.code, authoredJavaScript, 'authored source survives byte for byte');
    assert.equal(record.execution, owned, 'the contract survives deleting the generated header');
    assert(!Object.hasOwn(record.projections, 'javascript'), 'authored JavaScript is not demoted into a projection');
};

try {
    const launchOptions = {headless: true, args: ['--enable-automation'],
        ...(process.env.BW_BROWSER ? {executablePath: process.env.BW_BROWSER} : {})};
    if (process.env.BW_CHROMIUM_RUNTIME_ROOT) {
        const runtime = path.resolve(process.env.BW_CHROMIUM_RUNTIME_ROOT);
        const requireChromium = createRequire(path.join(runtime, 'package.json'));
        const imported = requireChromium('@sparticuz/chromium');
        const distribution = imported.default || imported;
        const excluded = arg => /disable-web-security|SharedArrayBuffer|sharedarraybuffer/.test(arg);
        launchOptions.executablePath = process.env.BW_BROWSER || await distribution.executablePath();
        launchOptions.args = [...new Set([...distribution.args.filter(arg => !excluded(arg)), '--enable-automation'])];
        report.environment.chromiumDistribution = {
            package: '@sparticuz/chromium',
            version: JSON.parse(await fs.readFile(path.join(runtime, 'node_modules/@sparticuz/chromium/package.json'), 'utf8')).version,
            excludedArgs: distribution.args.filter(excluded)
        };
    }
    report.environment.suppliedBrowserArgs = launchOptions.args || [];
    report.environment.browserExecutable = launchOptions.executablePath || 'Playwright-managed Chromium';
    browser = await chromium.launch(launchOptions);
    report.environment.browser = browser.version();
    const browserSession = await browser.newBrowserCDPSession();
    report.environment.browserCommandLine = (await browserSession.send('Browser.getBrowserCommandLine')).arguments;
    await browserSession.detach();
    page = await browser.newPage({viewport: {width: 1440, height: 1000}, locale: 'en-US', acceptDownloads: true});
    page.setDefaultTimeout(30000);
    page.on('dialog', dialog => dialog.accept());
    page.on('pageerror', error => report.errors.push(error.stack || error.message));
    page.on('console', message => {if (message.type() === 'error') report.consoleErrors.push(message.text());});
    page.on('response', response => {
        if (response.request().resourceType() !== 'script') return;
        const site = new URL('.', base);
        const url = new URL(response.url());
        if (!['http:', 'https:'].includes(url.protocol) || url.origin !== site.origin || !url.pathname.startsWith(site.pathname)) {
            report.nonEmittedScriptResponses.push({url: response.url(), status: response.status(),
                reason: url.protocol === 'blob:' ? 'Dynamic Blob URL; actual worker lifecycle is recorded separately.' :
                    'Outside the same-origin emitted build asset inventory.'});
            return;
        }
        const observation = {url: response.url(), status: response.status()};
        report.loadedScripts.push(observation);
        scriptReads.push((async () => {
            try {
                const bytes = await response.body();
                Object.assign(observation, {sha256: sha256(bytes), bytes: bytes.length});
                if (qualificationBytes) {
                    const relative = decodeURIComponent(url.pathname.slice(site.pathname.length));
                    observation.buildPath = relative;
                    assert.equal(observation.sha256, qualification.build.files[relative],
                        `loaded app script matches the recorded build: ${relative}`);
                    observation.matchesQualifiedBuild = true;
                }
            } catch (error) {
                observation.error = error.message;
            }
        })());
    });
    page.on('worker', worker => {
        const observation = {url: worker.url(), createdAt: new Date().toISOString(), closedAt: null};
        report.workers.push(observation);
        worker.on('close', () => {observation.closedAt = new Date().toISOString();});
    });
    // A fresh browser context starts empty. Do not clear storage here: the last
    // step deliberately reloads and requires the genuine autosave to survive.
    await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));

    await step('built editor opens its real Code tab', async () => {
        const response = await page.goto(base, {waitUntil: 'domcontentloaded', timeout: 60000});
        assert(response && response.ok(), 'the actual app entry document loads');
        report.entryDocumentSha256 = sha256(await response.body());
        if (qualificationBytes) assert.equal(report.entryDocumentSha256, qualification.build.files['index.html']);
        report.environment.pageCapabilities = await page.evaluate(() => ({
            crossOriginIsolated,
            sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined'
        }));
        await openCode();
        assert.equal(await codeEditor().getAttribute('contenteditable'), 'true');
        assert(Array.isArray(await vmGraph()), 'the full editor VM is present');
    });

    let concurrentJavaScript;
    await step('visible Console program target generates owned JavaScript and preserves its authored source', async () => {
        concurrentJavaScript = await generatedProgram(concurrentPseudo, 'concurrent-generated');
        assert.equal((concurrentJavaScript.match(/codeRun\.spawn\(/g) || []).length, 2);
        await langTab('🧩 Pseudo').click();
        await waitEditorText(concurrentPseudo);
        await langTab('🟨 JS').click();
        await waitEditorText(concurrentJavaScript);
        assert.equal(await targetSelect().inputValue(), owned);
        await screenshot('01-generated-console');
    });

    await step('multiple flags, awaited procedure, finite wait and long human input complete in the actual worker', async () => {
        const before = await vmGraph();
        const run = await newRun('generated-concurrent-procedure-input');
        await page.getByTestId('bw-code-input').waitFor({state: 'visible'});
        assert.match(await page.getByTestId('bw-code-input').innerText(), /Name\?/);
        await waitOutput('first\nsecond\nprocedure\n');
        assert(await page.getByTestId('bw-code-run').isDisabled());
        const holdStart = performance.now();
        await page.waitForTimeout(inputHoldMs);
        run.humanInputHeldMs = Math.round(performance.now() - holdStart);
        assert(await page.getByTestId('bw-code-input').isVisible(), 'human input remains pending beyond the execution budget');
        assert(await page.getByTestId('bw-code-stop').isVisible());
        await screenshot('02-awaiting-human-input');
        await page.locator('#bw-code-input-answer').fill('Ada');
        await page.getByTestId('bw-code-input').locator('button[type="submit"]').click();
        await finishRun(run, 'first\nsecond\nprocedure\nAda\nlast\n');
        await page.getByTestId('bw-code-input').waitFor({state: 'hidden'});
        await page.getByTestId('bw-code-stop').waitFor({state: 'hidden'});
        assert.deepEqual(await vmGraph(), before, 'console execution does not replace or mutate the block graph');
        return {humanInputHeldMs: run.humanInputHeldMs};
    });

    const fixtureArchive = path.join(artifacts, 'boolean-value.fixture.sb3');
    await step('real File Open and From blocks preserve a Boolean in an ordinary value socket', async () => {
        assert.equal(fixture.schema, 'bw.owned-console-boolean-fixture.v1');
        const zip = new JSZip();
        const fixedDate = new Date('2026-01-01T00:00:00Z');
        zip.file('project.json', JSON.stringify(fixture.project), {date: fixedDate});
        for (const [filename, asset] of Object.entries(fixture.assets)) {
            assert.equal(asset.encoding, 'base64');
            zip.file(filename, Buffer.from(asset.data, 'base64'), {date: fixedDate});
        }
        await fs.writeFile(fixtureArchive, await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'}));
        await fileOpen(fixtureArchive);
        await page.waitForFunction(() => window.__brickwrightStore.getState().scratchGui.vm.runtime.targets
            .some(target => target.getName() === 'BooleanConsole'), null, {timeout: 30000});
        await openCode();
        await chooseOwned();
        await page.getByRole('button', {name: 'From blocks ⇨', exact: true}).click();
        await idle();
        await page.waitForFunction(() => {
            const element = document.querySelector('[data-testid="bw-code-editor"] .cm-content');
            const text = element?.cmTile?.root?.view?.state.doc.toString() || '';
            return text.includes('BooleanConsole') && text.includes('codeRun.spawn');
        }, null, {timeout: 30000});
        const source = await rememberSource('boolean-generated');
        assert.match(source, /\(2 > 1\)/);
        const graph = await vmGraph();
        const blocks = graph.find(target => target.name === 'BooleanConsole').blocks;
        const say = Object.values(blocks).find(block => block.opcode === 'looks_say');
        assert.equal(blocks[say.inputs.MESSAGE[1]].opcode, 'operator_gt');
        const run = await newRun('generated-boolean-value');
        await finishRun(run, fixture.expectedOutput);
        assert.deepEqual(await vmGraph(), graph);
        await screenshot('03-boolean-output');
        return {fixtureArchive: path.basename(fixtureArchive), output: run.output};
    });

    await step('Stop closes a generated delayed task before its later effect', async () => {
        await generatedProgram(stopPseudo, 'stop-generated');
        const run = await newRun('generated-stop');
        await waitOutput('ready\n');
        await page.getByTestId('bw-code-stop').click();
        await finishRun(run);
        assert.match(run.output, /^ready\n/);
        assert.match(run.output, /Stopped\./);
        assert(!run.output.includes('late'), 'stopped delayed output is never published');
        await screenshot('04-stopped');
    });

    await step('editing generated JavaScript keeps its contract and a fresh run succeeds after Stop', async () => {
        await replaceSource(authoredJavaScript);
        assert(!authoredJavaScript.includes('// owned-console-v1:'), 'this edit deliberately removes the generated marker');
        await assertAuthoredView();
        const run = await newRun('edited-fresh-run-after-stop');
        await finishRun(run, authoredOutput);
        await rememberSource('authored-javascript');
    });

    await step('owned source explicitly refuses unsupported reverse conversion without changing source or VM', async () => {
        const before = await vmGraph();
        const limit = page.getByTestId('bw-code-conversion-limit');
        await limit.waitFor({state: 'visible'});
        assert.match(await limit.innerText(), /cannot be converted|not supported|unsupported|conversion .* unavailable/i);
        await page.getByRole('button', {name: '⇦ To blocks', exact: true}).click();
        await idle();
        assert.match(await page.getByTestId('bw-code-status').innerText(), /cannot be converted|not supported|unsupported/i);
        await assertAuthoredView();
        assert.deepEqual(await vmGraph(), before, 'refused To blocks does not reload or rewrite the VM');
        await langTab('🐍 Py').click();
        await idle();
        await assertAuthoredView();
        assert.match(await page.getByTestId('bw-code-status').innerText(), /cannot be converted|not supported|unsupported/i);
        assert.deepEqual(await vmGraph(), before, 'refused language conversion does not mutate the VM');
        await screenshot('05-explicit-conversion-limit');
    });

    let saved;
    await step('actual File Save persists authored bytes and owned execution metadata', async () => {
        // Make a fresh edit immediately before File Save; bundle collection has
        // to flush the current document rather than relying on debounce timing.
        await replaceSource(`${authoredJavaScript}// temporary edit\n`);
        await replaceSource(authoredJavaScript);
        saved = await fileSave('authored-owned-console');
        assertAuthoredRecord(saved.bundle.state.code);
        report.savedProject = {file: path.basename(saved.file), sha256: saved.sha256,
            codeDocument: saved.bundle.state.code};
        return {file: path.basename(saved.file), sha256: saved.sha256};
    });

    await step('real project replacement and File Open restore source, target and executable behavior', async () => {
        // Replace the project through the same visible file path first, so this
        // cannot pass merely because the original Code component stayed mounted.
        await fileOpen(fixtureArchive);
        await openCode();
        await replaceSource('// Different project: must not leak into the reopened source.\n');
        assert.notEqual(await editorText(), authoredJavaScript);
        await fileOpen(saved.file);
        await openCode();
        await assertAuthoredView();
        const run = await newRun('reopened-saved-project');
        await finishRun(run, authoredOutput);
        await screenshot('06-reopened-project');
    });

    await step('page reload restores the same authored source and target from real autosave', async () => {
        await page.waitForFunction(() => {
            try {
                const record = JSON.parse(localStorage.getItem('bw-code-autosave'));
                return record?.version === 1 && record.lang === 'javascript' && record.execution === 'owned-console-v1';
            } catch { return false; }
        }, null, {timeout: 10000});
        const before = await page.evaluate(() => JSON.parse(localStorage.getItem('bw-code-autosave')));
        assertAuthoredRecord(before);
        await page.reload({waitUntil: 'domcontentloaded', timeout: 60000});
        await openCode();
        await assertAuthoredView();
        const run = await newRun('autosave-reopened-page');
        await finishRun(run, authoredOutput);
        await screenshot('07-reloaded-autosave');
        return {authoredSourceSha256: sha256(authoredJavaScript)};
    });

    await step('fresh authored Python refuses lossy block conversion by line and still runs in Skulpt', async () => {
        const file = path.join(artifacts, 'authored-floor-division.py');
        await fs.writeFile(file, authoredPython);
        await openCodeActions(page);
        await page.getByTestId('bw-open-file').locator('input[type="file"]').setInputFiles(file);
        await waitEditorText(authoredPython);
        assert.equal(await langTab('🐍 Py').getAttribute('aria-pressed'), 'true');
        const graph = await vmGraph();
        await page.getByRole('button', {name: '⇦ To blocks', exact: true}).click();
        await idle();
        const status = await page.getByTestId('bw-code-status').innerText();
        assert.match(status, /floor division|\/\/|unsupported|cannot|not supported|refus/i);
        assert.match(status, /line\s*2\b|\bL2\b|\b2:\d+/i, 'the refusal identifies the original authored line');
        assert.equal(await editorText(), authoredPython);
        assert.deepEqual(await vmGraph(), graph, 'refused Python conversion preserves the VM graph');
        await screenshot('08-python-conversion-refusal');
        const run = await newRun('authored-python-floor-division');
        await finishRun(run, '3\n');
        assert.equal(await editorText(), authoredPython, 'running Python preserves authored source');
        assert.deepEqual(await vmGraph(), graph);
        report.sources.authoredPython = {file: path.basename(file), sha256: sha256(authoredPython),
            bytes: Buffer.byteLength(authoredPython)};
        await screenshot('09-python-runs');
        return {refusal: status, output: run.output};
    });

    await step('the complete rendered journey has no uncaught page errors', async () => {
        await settleOwnedConsoleScriptReads(scriptReads);
        assert.deepEqual(report.errors, []);
        assertOwnedConsoleLoadedScripts(report.loadedScripts, {bound: Boolean(qualificationBytes)});
    });
    report.status = 'passed';
} catch (error) {
    report.status = 'failed';
    report.failure = error.stack || String(error);
    console.error(`FAIL ${error.message}`);
    if (page) {
        report.failureView = await page.evaluate(() => ({
            source: document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile?.root?.view?.state.doc.toString() ?? null,
            output: document.querySelector('[data-testid="bw-code-output"]')?.textContent ?? null,
            status: document.querySelector('[data-testid="bw-code-status"]')?.textContent ?? null
        })).catch(error => ({unavailable: error.message}));
        await screenshot('failure').catch(() => {});
    }
} finally {
    if (browser) await browser.close();
    // Closing the browser ends response delivery. Admit the complete inventory,
    // including responses received while the final UI check was settling.
    if (report.status === 'passed') {
        try {
            await settleOwnedConsoleScriptReads(scriptReads);
            assertOwnedConsoleLoadedScripts(report.loadedScripts, {bound: Boolean(qualificationBytes)});
            report.finalAssetAdmission = {status: 'passed', scripts: report.loadedScripts.length};
        } catch (error) {
            report.status = 'failed';
            report.failure = error.stack || String(error);
            report.finalAssetAdmission = {status: 'failed', error: error.message};
            console.error(`FAIL ${error.message}`);
        }
    }
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${report.status.toUpperCase()} ${report.checks.filter(check => check.status === 'passed').length}/${report.checks.length} checks; ${out}`);
    process.exitCode = report.status === 'passed' ? 0 : 1;
}
