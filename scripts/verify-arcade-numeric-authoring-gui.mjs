#!/usr/bin/env node
// Actual full IDE controls only. Blockly/VM access observes, never mutates.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import JSZip from 'jszip';
import {openCodeActions, closeCodeActions as closeSharedCodeActions, openCodeInfo} from './lib-code-actions.mjs';
import {waitForArcadeStageFrame} from './lib/arcade-stage-frame.mjs';
import {inspectGuiHarnessSource} from './lib/gui-harness-source.mjs';
import {inspectGuiArtifactResponse} from './lib/gui-artifact-response.mjs';
import {makeCodeProjectFile, readMakeCodeProjectText} from '../overlay/scratch-gui/src/lib/bw-makecode/project-file.js';
import {runPxtArcade} from '../test/helpers/pxt-arcade-runtime.mjs';
import {numericAuthoringFiles, numericSample} from '../test/fixtures/arcade-numeric-authoring-game.mjs';
import {snakeSource, snakeExpected, numberSource, frameSource, connectedProject} from '../test/fixtures/arcade-connected-authoring.mjs';
import {elapsedMatches} from './lib/clock-elapsed.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const base = process.env.PROOF_URL;
assert.ok(base, 'PROOF_URL must identify the admitted full production build');
assert.ok(process.env.BW_GUI_BUILD_RECEIPT, 'An admitted exact-source official build receipt is required');
assert.ok(process.env.BW_GUI_BUILD_ARCHIVE, 'The sole already acquired official archive is required');
const receipt = JSON.parse(await readFile(process.env.BW_GUI_BUILD_RECEIPT, 'utf8'));
const inspected = inspectGuiHarnessSource({root, executable: process.env.BW_GUI_GIT_EXECUTABLE});
const source = inspected.sourceSha;
const pins = JSON.parse(await readFile(path.join(root, 'vendor-pins.json'), 'utf8'));
assert.equal(receipt.sourceSha, source, 'Harness and admitted build must use the exact reviewed source');
assert.equal(receipt.producerSha, pins['sb3-creator']);
assert.equal(receipt.arraysValuesSha, pins['arrays-values']);
assert.equal(receipt.sdk.version, '4.2.1');
assert.equal(receipt.sdk.pxtVersion, '13.2.1');
assert.equal(receipt.sdk.targetCommit, '2d7d59b5226e8a1a1e05e8042dd9f5248ed68fea');
const sdkRoot = path.join(root, 'packages/scratch-gui/static/makecode/arcade');
const targetBytes = await readFile(path.join(sdkRoot, 'target.json'));
const sdkVersions = JSON.parse(targetBytes).versions;
assert.equal(sdkVersions.target, receipt.sdk.version);
assert.equal(sdkVersions.pxt, receipt.sdk.pxtVersion);
assert.equal(sdkVersions.commits, `https://github.com/microsoft/pxt-arcade/commits/${receipt.sdk.targetCommit}`);
assert.equal(digest(targetBytes), receipt.sdk.targetSha256, 'Original comparison SDK target must match admitted production SDK');
assert.equal(digest(await readFile(path.join(sdkRoot, 'pxtworker.js'))), receipt.sdk.workerSha256);
assert.equal(receipt.build.conclusion, 'success');
assert.equal(receipt.build.checkoutSha, source);
for (const key of ['runId', 'jobId', 'artifactId']) assert.match(String(receipt.build[key]), /^\d+$/);
assert.equal(receipt.build.runUrl, `https://github.com/CrispStrobe/brickwright-lite/actions/runs/${receipt.build.runId}`);
assert.equal(digest(await readFile(process.env.BW_GUI_BUILD_ARCHIVE)), receipt.build.archiveSha256);
assert.ok(Object.keys(receipt.assets).length, 'Receipt must inventory the actual extracted build assets');
for (const name of Object.keys(receipt.assets)) assert.ok(Number.isSafeInteger(receipt.assetBytes?.[name]) && receipt.assetBytes[name] >= 0, `Receipt must inventory original extracted asset length ${name}`);
const out = path.resolve(process.env.BW_NUMERIC_GUI_REPORT_DIR || 'test-results/arcade-numeric-authoring-gui');
await mkdir(out, {recursive: true});
const report = {status: 'running', source, sourceTool: inspected.tool, receipt, journeys: [], samples: [], original: [], pageErrors: [], bundleObservations: [],
    boundary: 'Owned numeric/settings/source-loop and connected snake, number-entry and frame-delta authoring only. Random values are bounded, not seeded or compared across independent runs. Script preparation is not GUI qualification.'};
const browser = await chromium.launch(process.env.BW_BROWSER ? {executablePath: process.env.BW_BROWSER} : {});
let page;
const bodyChecks = [];
const editor = () => page.getByTestId('bw-code-editor').locator('.cm-content');
const codeTab = async () => { await page.getByRole('tab', {name: 'Code', exact: true}).click(); await editor().waitFor({state: 'visible'}); };
const readCode = () => editor().evaluate(element => element.cmTile.root.view.state.doc.toString());
// Read only actual component data. The pre-click handle is local to this
// verifier; it never becomes a product hook, cache or report identity token.
const observeCleanExport = (element, {phase, held, visibleText}) => {
    const nonData = {};
    const unavailable = (reasonCode, beforeReason) => {
        const result = {captureStatus: 'UNAVAILABLE_FRESHNESS', reasonCode};
        if (typeof beforeReason === 'string' && beforeReason.length <= 80) result.beforeReason = beforeReason;
        return result;
    };
    try {
        const own = (value, name) => {
            if (!value || typeof value !== 'object') return undefined;
            const descriptor = Object.getOwnPropertyDescriptor(value, name);
            if (!descriptor) return undefined;
            if (!Object.hasOwn(descriptor, 'value')) throw nonData;
            return descriptor.value;
        };
        const vm = window.__brickwrightStore.getState().scratchGui.vm;
        let fiber;
        for (let node = element, count = 0; node && count < 64; node = node.parentElement, count++) {
            const keys = Object.getOwnPropertyNames(node).filter(key => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$'));
            if (keys.length > 1) return unavailable('FIBER_POINTER_AMBIGUOUS');
            if (keys.length === 1) { fiber = own(node, keys[0]); break; }
        }
        if (!fiber) return unavailable('FIBER_POINTER_MISSING');
        const candidates = [], seenFibers = [];
        for (let count = 0; fiber && count < 128; fiber = own(fiber, 'return'), count++) {
            if (seenFibers.includes(fiber)) return unavailable('FIBER_CYCLE');
            seenFibers.push(fiber);
            const instance = own(fiber, 'stateNode'), state = own(instance, 'state'), props = own(instance, 'props');
            if (state && Object.hasOwn(state, 'conversionReport') && own(props, 'vm') === vm && !candidates.includes(instance)) candidates.push(instance);
        }
        if (fiber) return unavailable('FIBER_DEPTH');
        if (candidates.length !== 1) return unavailable('OWNER_AMBIGUOUS');
        const instance = candidates[0], state = own(instance, 'state'), revision = own(instance, '_arcadeReportRevision') ?? 0;
        if (!Number.isSafeInteger(revision) || revision < 0) return unavailable('REVISION_INVALID');
        if (own(instance, '_unmounted')) return unavailable('COMPONENT_DISPOSED');
        if (own(state, 'busy') !== false) return unavailable('COMPONENT_BUSY');
        const requestDescriptor = Object.getOwnPropertyDescriptor(instance, '_arcadeReportRequest');
        if (requestDescriptor && !Object.hasOwn(requestDescriptor, 'value')) throw nonData;
        const request = requestDescriptor?.value, report = own(state, 'conversionReport');
        if (phase === 'before') {
            if (report !== null && (!report || typeof report !== 'object' || Array.isArray(report))) return unavailable('PRE_REPORT_INVALID');
            // Imports and completed/dismissed reports can leave an idle prior
            // report or request. Hold their identities, not a completion guess.
            // The next phase must prove a genuinely NEW request AND report.
            if (!requestDescriptor) {
                if ('_arcadeReportRequest' in instance) return unavailable('PRE_REQUEST_INHERITED');
            } else if (request === undefined) {
                return unavailable('PRE_REQUEST_UNDEFINED');
            } else if (request !== null && (!request || typeof request !== 'object' ||
                own(request, 'vm') !== vm || own(request, 'revision') !== revision)) {
                return unavailable('PRE_REQUEST_INVALID');
            }
            return {status: 'READY', instance, vm, revision, request, report};
        }
        if (phase !== 'after') return unavailable('OBSERVATION_SHAPE');
        if (own(held, 'status') !== 'READY') return unavailable('HELD_NOT_READY', own(held, 'reasonCode'));
        if (own(held, 'instance') !== instance) return unavailable('OWNER_CHANGED');
        if (own(held, 'vm') !== vm) return unavailable('VM_CHANGED');
        if (own(held, 'revision') !== revision) return unavailable('REVISION_CHANGED');
        if (!requestDescriptor || !request || typeof request !== 'object' || own(request, 'vm') !== vm || own(request, 'revision') !== revision) return unavailable('REQUEST_INVALID');
        if (request === own(held, 'request')) return unavailable('REQUEST_REUSED');
        if (report === own(held, 'report')) return unavailable('REPORT_REUSED');
        if (own(report, 'operation') !== 'export') return unavailable('REPORT_OPERATION');
        const unsupported = own(report, 'unsupported');
        if (!Array.isArray(unsupported)) return unavailable('OBSERVATION_SHAPE');
        let reasons = '';
        for (let i = 0; i < unsupported.length; i++) {
            const reason = own(unsupported, String(i));
            if (typeof reason !== 'string') return unavailable('OBSERVATION_SHAPE');
            reasons += (i ? ' · ' : '') + reason;
        }
        if (visibleText !== 'Unsupported: ' + (reasons || 'nothing reported')) return unavailable('VISIBLE_TEXT_CHANGED');
        const observation = own(report, 'observation');
        if (!observation || own(observation, 'schema') !== 'arcade-clean-export-observation-v1') return unavailable('OBSERVATION_MISSING');
        const result = {};
        for (const name of ['schema', 'origin', 'captureStatus', 'inputJson', 'resultJson', 'inputUtf8Bytes', 'resultUtf8Bytes', 'totalUtf8Bytes', 'limitUtf8Bytes']) {
            const value = own(observation, name);
            if (value !== undefined) {
                if (typeof value !== 'string' && typeof value !== 'number') return unavailable('OBSERVATION_SHAPE');
                result[name] = value;
            }
        }
        if (result.captureStatus === 'COMPLETE') {
            if (result.origin !== 'owned-json-export' || typeof result.inputJson !== 'string' || typeof result.resultJson !== 'string') return unavailable('OBSERVATION_SHAPE');
            if (result.limitUtf8Bytes !== 8388608 || !Number.isSafeInteger(result.totalUtf8Bytes) || result.totalUtf8Bytes > result.limitUtf8Bytes ||
                result.inputJson.length + result.resultJson.length > result.limitUtf8Bytes) return unavailable('OBSERVATION_SIZE');
            const inputBytes = new TextEncoder().encode(result.inputJson).byteLength, resultBytes = new TextEncoder().encode(result.resultJson).byteLength;
            if (inputBytes !== result.inputUtf8Bytes || resultBytes !== result.resultUtf8Bytes || inputBytes + resultBytes !== result.totalUtf8Bytes ||
                inputBytes + resultBytes > result.limitUtf8Bytes) return unavailable('OBSERVATION_SIZE');
        } else if (typeof result.inputJson === 'string' || typeof result.resultJson === 'string') return unavailable('OBSERVATION_SHAPE');
        return result;
    } catch (error) { return unavailable(error === nonData ? 'NON_DATA_STATE' : 'OBSERVER_ERROR'); }
};
const fresh = async ({controlledClock = false} = {}) => {
    const context = await browser.newContext({viewport: {width: 1600, height: 1100}, acceptDownloads: true});
    if (controlledClock) await context.clock.install({time: 0});
    const tab = await context.newPage();
    tab.on('dialog', dialog => dialog.accept());
    tab.on('pageerror', error => report.pageErrors.push(error.message));
    tab.on('response', response => {
        const url = new URL(response.url()), prefix = new URL(base);
        if (url.origin !== prefix.origin || !(/\.js$/.test(url.pathname) || /\/makecode\/arcade\/target\.json$/.test(url.pathname))) return;
        bodyChecks.push((async () => {
            const name = decodeURIComponent(url.pathname.slice(prefix.pathname.endsWith('/') ? prefix.pathname.length : prefix.pathname.lastIndexOf('/') + 1));
            const observed = await inspectGuiArtifactResponse(response, {name, sha256: receipt.assets[name], bytes: receipt.assetBytes[name]});
            if (observed.method === 'HEAD') (report.bundleHeaders ||= []).push(observed);
            else report.bundleObservations.push(observed);
        })().catch(error => { (report.bundleFailures ||= []).push(String(error)); }));
    });
    await tab.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('bw-starter-v1-complete', '1'); localStorage.setItem('bw-right-pane-hidden', '0'); });
    await tab.goto(base, {waitUntil: 'domcontentloaded', timeout: 90000});
    await tab.waitForFunction(() => !!window.__brickwrightStore?.getState()?.scratchGui?.vm, null, {timeout: 60000});
    await tab.evaluate(() => {
        const ownDescriptor=Object.getOwnPropertyDescriptor,own=Object.hasOwn,define=Object.defineProperty;
        const summaryFields=['rootIndex','rootLabel','keyKind','key','symbolPosition','comparison','changedField',
            'actualType','savedType','actualFlag','savedFlag'];
        const intrinsicSummary=error=>{try{
            // No property getters, primitive calls, stack reads or coercion.
            // Constraint signals wrap the newly-created native error as cause.
            const direct=error&&(typeof error==='object'||typeof error==='function')?ownDescriptor(error,'bwArrayIntrinsicMismatch'):null;
            const cause=error&&(typeof error==='object'||typeof error==='function')?ownDescriptor(error,'cause'):null;
            const source=direct&&own(direct,'value')?direct:
                cause&&own(cause,'value')&&cause.value&&typeof cause.value==='object'?ownDescriptor(cause.value,'bwArrayIntrinsicMismatch'):null;
            if(!source||!own(source,'value')||!source.value||typeof source.value!=='object')return null;
            const copy={};
            for(let i=0;i<summaryFields.length;i++){
                const key=summaryFields[i],descriptor=ownDescriptor(source.value,key);
                if(!descriptor||!own(descriptor,'value'))return null;
                const value=descriptor.value;
                if(value!==null&&typeof value!=='string'&&typeof value!=='number'&&typeof value!=='boolean')return null;
                define(copy,key,{value,enumerable:true});
            }
            return copy;
        }catch(_observationFailure){return null;}};
        window.__bwNumericErrors = [];
        window.__bwNumericIntrinsicRefusals = [];
        window.__brickwrightStore.getState().scratchGui.vm.runtime.on('BLOCKS_ERROR', error => {
            window.__bwNumericIntrinsicRefusals.push(intrinsicSummary(error));
            window.__bwNumericErrors.push(String(error));
        });
    });
    return tab;
};
const apply = async (expectedOpcode = 'arcade_clampNumber') => {
    const prior = await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.runtime.getTargetForStage()?.id);
    await page.getByRole('button', {name: /To blocks/}).first().click();
    await page.waitForFunction(id => { const next = window.__brickwrightStore.getState().scratchGui.vm.runtime.getTargetForStage()?.id; return Boolean(next && next !== id); }, prior);
    await page.getByText('Blocks loaded.', {exact: true}).waitFor();
    await page.getByRole('tab', {name: 'Blocks', exact: true}).click();
    await page.waitForFunction(opcode => window.Blockly?.getMainWorkspace()?.getAllBlocks(false).some(block => block.type === opcode), expectedOpcode);
};
// Downloads do not close the Code actions menu. Close it the way a user does
// before interacting with the report underneath the actions popover.
const closeCodeActions = async () => {
    // The Code actions are a popup trigger since #1536; the shared helper closes either form.
    await closeSharedCodeActions(page);
    await page.waitForFunction(() => {
        const trigger = document.querySelector('[data-testid="bw-code-actions-trigger"]');
        if (trigger) return trigger.getAttribute('aria-expanded') !== 'true';
        const menu = document.querySelector('[data-testid="bw-code-actions"]');
        return !menu || !menu.open;
    });
};
const openFile = async file => {
    await codeTab(); await openCodeActions(page);
    await page.getByTestId('bw-open-file').locator('input[type=file]').setInputFiles(file);
    await (await openCodeInfo(page)).getByTestId('bw-code-status').filter({hasText: /Imported the Arcade game/}).waitFor({timeout: 60000});
    assert.doesNotMatch(await page.getByTestId('bw-code-status').innerText(), /unsupported|not translated|could not|partial/i);
    await page.getByRole('button', {name: 'Close Code help'}).click();
    assert.doesNotMatch(await readCode(), /# unsupported:/);
};
const fieldInfo = spec => page.evaluate(({opcode, input, value}) => {
    const workspace = window.Blockly.getMainWorkspace();
    const block = workspace.getAllBlocks(false).find(block => block.type === opcode && (value === undefined || String(block.getFieldValue(input)) === value || block.getInputTargetBlock(input)?.getDescendants(false).some(node => node.inputList.flatMap(i => i.fieldRow).some(f => String(f.getValue()) === value))));
    const child = block?.getInputTargetBlock(input);
    // Fixed native menus live on the command/reporter itself; accepting menus
    // live on its connected shadow. Edit the real field in either case.
    const direct = block?.getField(input);
    const candidates = direct ? [{node: block, field: direct}] : [];
    const walk = node => { if (!node) return; for (const input of node.inputList) for (const field of input.fieldRow) if (field.name) candidates.push({node, field}); for (const next of node.getChildren(false)) walk(next); };
    walk(child);
    const selected = candidates.find(({field}) => value === undefined || String(field.getValue()) === value);
    const field = selected?.field;
    if (!field) throw new Error(`Missing ${opcode}.${input} field`);
    const rect = field.getSvgRoot().getBoundingClientRect(), svg = workspace.getParentSvg().getBoundingClientRect();
    return {id: selected.node.id, name: field.name, value: field.getValue(), x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, left: svg.left + workspace.getMetrics().absoluteLeft, right: svg.right, top: svg.top};
}, spec);
const reachField = async spec => {
    const field = await fieldInfo(spec), center = {x: (field.left + field.right) / 2, y: field.top + 160};
    await page.mouse.move(center.x, center.y); await page.mouse.wheel(field.x - center.x, field.y - center.y);
    await page.waitForFunction(({id, name}) => {
        const block = window.Blockly.getMainWorkspace().getBlockById(id), field = block?.getField(name), rect = field?.getSvgRoot().getBoundingClientRect();
        return Boolean(rect && block.getSvgRoot().contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)));
    }, field);
    return fieldInfo(spec);
};
const editNumber = async (spec, value) => {
    const field = await reachField(spec); await page.mouse.click(field.x, field.y);
    const input = page.locator('input.blocklyHtmlInput'); await input.waitFor({state: 'visible'}); await input.fill(String(value)); await input.press('Enter');
    await input.waitFor({state: 'hidden'});
    await page.waitForFunction(({id, name, value}) => String(window.Blockly.getMainWorkspace().getBlockById(id)?.getFieldValue(name)) === value, {...field, value: String(value)});
};
const editMenu = async (spec, choice, required) => {
    const field = await reachField(spec); await page.mouse.click(field.x, field.y);
    const items = page.getByRole('menuitemcheckbox'); await items.first().waitFor({state: 'visible'});
    const labels = await items.allTextContents(); for (const text of required) assert.ok(labels.includes(text), `${text} is a real visible choice`);
    await page.getByRole('menuitemcheckbox', {name: choice, exact: true}).click();
    await items.first().waitFor({state: 'hidden'});
    await page.waitForFunction(({id, name, choice}) => window.Blockly.getMainWorkspace().getBlockById(id)?.getFieldValue(name) === choice, {...field, choice});
    report.journeys.push({action: 'visible dropdown edit', opcode: spec.opcode, choice, labels});
};
const observe = () => page.evaluate(() => {
    const vm = window.__brickwrightStore.getState().scratchGui.vm;
    const variables = Object.fromEntries(vm.runtime.targets.filter(t => t.isOriginal).flatMap(t => Object.values(t.variables)).map(v => [v.name.replace(/^(?:Game_)+/, ''), v.value]));
    return {variables, errors: window.__bwNumericErrors, intrinsicRefusals: window.__bwNumericIntrinsicRefusals};
});
const waitSample = sample => page.waitForFunction(sample => {
    const variables = Object.fromEntries(window.__brickwrightStore.getState().scratchGui.vm.runtime.targets.filter(t => t.isOriginal).flatMap(t => Object.values(t.variables)).map(v => [v.name.replace(/^(?:Game_)+/, ''), v.value]));
    return Object.entries(sample).every(([key, value]) => variables[key] === value);
}, sample);
const compareFrame = async original => {
    await page.getByTitle('Scratch Stage', {exact: true}).click();
    const pixels = await waitForArcadeStageFrame(page, original);
    return digest(Buffer.from(Uint32Array.from(pixels).buffer));
};
const original = async (files, options, pressed) => {
    const sample = numericSample({...options, pressed});
    const source = files['main.ts'];
    const actualName = key => new RegExp(`\\b(?:let|var|const)\\s+((?:Game_)*${key})\\b`).exec(source)?.[1] || key;
    const actualSample = Object.fromEntries(Object.entries(sample).map(([key, value]) => [actualName(key), value]));
    const result = await runPxtArcade(files, {buttonActions: {afterGlobals: {[actualName('ready')]: 1}, steps: pressed ? [{button: 5, held: true, delay: 80}, {button: 5, held: false, delay: 80}] : []}, waitForGlobals: actualSample, inspectDisplay: true, waitForDisplay: true});
    const globals = Object.fromEntries(Object.entries(result).map(([key, value]) => [key.replace(/^(?:Game_)+/, ''), value]));
    for (const [key, value] of Object.entries(sample)) assert.equal(globals[key], value, `original ${key}`);
    assert.ok(globals.noise >= 0 && globals.noise < 1, 'Real entropy is bounded; no equality against another run');
    report.original.push({sample, screenSha256: digest(Buffer.from(Uint32Array.from(result.$display.screen).buffer))}); return result.$display.screen;
};
const cycle = async (label, options, files) => {
    if (!await page.getByTestId('bw-arcade-a').isVisible()) await page.getByTitle('Game Console', {exact: true}).click();
    await page.locator('[class*="green-flag_green-flag"]:visible').first().click();
    await waitSample(numericSample(options)); const initial = await observe();
    assert.deepEqual(initial.errors, []); assert.ok(initial.variables.noise >= 0 && initial.variables.noise < 1);
    const initialFrame = await compareFrame(await original(files, options, false));
    await page.getByTitle('Game Console', {exact: true}).click();
    await page.getByTestId('bw-arcade-a').click(); await waitSample(numericSample({...options, pressed: true}));
    const pressedFrame = await compareFrame(await original(files, options, true));
    const pressed = await observe(); assert.deepEqual(pressed.errors, []);
    report.samples.push({label, initial, pressed, initialFrame, pressedFrame}); await page.getByTitle('Stop', {exact: true}).first().click();
};
// The snake fixture changes its result when a real array element is edited.
// The original simulator receives exactly the same source or exported files.
const connectedSnake = async () => {
    const fixture = path.join(out, 'connected-snake.mkcd');
    const files = connectedProject(snakeSource());
    await writeFile(fixture, makeCodeProjectFile(files, {target: 'arcade'}));
    await page.context().close(); page = await fresh();
    await codeTab(); await page.getByTestId('bw-device-select').selectOption('arcade');
    await page.getByText('Blocks loaded.', {exact: true}).waitFor({timeout: 60000});
    await page.waitForFunction(() => window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime?.bwDeviceId === 'arcade' && document.querySelector('[data-testid="bw-open-file"] input[type=file]')?.disabled === false);
    await openFile(fixture); await apply('arrays_mutateReference');
    const sample = async (label, expected, originalFiles) => {
        const names = Object.fromEntries(Object.entries(expected).map(([key, value]) => {
            const name = new RegExp(`\\b(?:let|var|const)\\s+((?:Game_)*${key})\\b`).exec(originalFiles['main.ts'])?.[1] || key;
            return [name, value];
        }));
        const original = await runPxtArcade(originalFiles, {fakeClock: true, waitForGlobals: names});
        for (const [name, value] of Object.entries(names)) assert.equal(original[name], value, `original snake ${name}`);
        await page.locator('[class*="green-flag_green-flag"]:visible').first().click();
        await waitSample(expected); const actual = await observe(); assert.deepEqual(actual.errors, []);
        for (const [name, value] of Object.entries(expected)) assert.equal(actual.variables[name], value, `Lite snake ${name}`);
        (report.connectedSnake ||= []).push({label, expected, original: Object.fromEntries(Object.keys(names).map(name => [name, original[name]])), actual});
        await page.getByTitle('Stop', {exact: true}).first().click();
    };
    await sample('unchanged-import', snakeExpected(), files);
    await editNumber({opcode: 'arrays_mutateReference', input: 'VALUE', value: '2'}, 3);
    await sample('visible-block-edit', snakeExpected({item: 3}), connectedProject(snakeSource({item: 3})));
    await codeTab(); await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.waitForFunction(() => /mutate array reference[^\n]*value \(0 \+ 3\)/.test(document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile.root.view.state.doc.toString() || ''));
    const edited = await readCode();
    const authored = edited.replace(/(mutate array reference[^\n]*value \(0 \+ )3(\))/, (_match, before, after) => `${before}2${after}`);
    assert.notEqual(authored, edited, 'A visible Code edit restores the published array element');
    await editor().click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText(authored);
    assert.equal(await readCode(), authored); await apply('arrays_mutateReference');
    await sample('visible-code-edit', snakeExpected(), files);
    await page.getByText('File', {exact: true}).first().click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('Save to your computer', {exact: true}).click()]);
    const archive = path.join(out, 'connected-snake.sb3'); await download.saveAs(archive);
    const bytes = await readFile(archive); assert.ok((await JSZip.loadAsync(bytes)).file('project.json'));
    report.connectedSnakeArchive = {sha256: digest(bytes), bytes: bytes.length};
    await page.context().close(); page = await fresh(); await page.getByText('File', {exact: true}).first().click();
    const chooser = page.waitForEvent('filechooser'); await page.getByText('Load from your computer', {exact: true}).click(); await (await chooser).setFiles(archive);
    await page.waitForFunction(() => typeof window.__brickwrightStore.getState().scratchGui.vm.runtime._primitives.arrays_mutateReference === 'function');
    await sample('fresh-sb3-reopen', snakeExpected(), files);
    await codeTab(); await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.waitForFunction(() => /mutate array reference/.test(document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile.root.view.state.doc.toString() || ''));
    await openCodeActions(page);
    const [exported] = await Promise.all([page.waitForEvent('download'), page.getByTestId('bw-makecode-arcade-export').click()]);
    const exportedPath = path.join(out, 'connected-snake-export.mkcd'); await exported.saveAs(exportedPath); await closeCodeActions();
    const exportedBytes = await readFile(exportedPath), embedded = await readMakeCodeProjectText(exportedBytes.toString('utf8'), 'mkcd');
    report.connectedSnakeExport = {sha256: digest(exportedBytes), bytes: exportedBytes.length};
    await openFile(exportedPath); await apply('arrays_mutateReference');
    await sample('export-reimport', snakeExpected(), embedded.files);
};
// Numeric replies pass through the actual visible question input in both apps.
const connectedNumber = async () => {
    const fixture = path.join(out, 'connected-number.mkcd');
    const files = connectedProject(numberSource());
    await writeFile(fixture, makeCodeProjectFile(files, {target: 'arcade'}));
    await page.context().close(); page = await fresh();
    await codeTab(); await page.getByTestId('bw-device-select').selectOption('arcade');
    await page.getByText('Blocks loaded.', {exact: true}).waitFor({timeout: 60000});
    await page.waitForFunction(() => window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime?.bwDeviceId === 'arcade' && document.querySelector('[data-testid="bw-open-file"] input[type=file]')?.disabled === false);
    await openFile(fixture); await apply('arcade_askForNumber');
    const sample = async (label, question, originalFiles, reply = '1.5') => {
        const numericReply = Number(reply);
        const name = key => new RegExp(`\\b(?:let|var|const)\\s+((?:Game_)*${key})\\b`).exec(originalFiles['main.ts'])?.[1] || key;
        const expected = {[name('response')]: numericReply, [name('done')]: 1};
        const original = await runPxtArcade(originalFiles, {fakeClock: true,
            buttonActions: {afterGlobals: {[name('ready')]: 1}, steps: [{delay: 500, text: reply}, {delay: 20, key: 'Enter'}]}, waitForGlobals: expected});
        for (const [key, value] of Object.entries(expected)) assert.equal(original[key], value, `original prompt ${key}`);
        await page.locator('[class*="green-flag_green-flag"]:visible').first().click();
        // Wait for the visible prompt itself; the same text is also the
        // question block's own label in the code area.
        await page.locator('[class*="question_question-label"]').getByText(question, {exact: true}).waitFor();
        const input = page.locator('input[inputmode="decimal"]:visible');
        await input.fill(reply); await input.press('Enter');
        await waitSample({ready: 1, response: numericReply, done: 1});
        const actual = await observe(); assert.deepEqual(actual.errors, []);
        (report.connectedNumber ||= []).push({label, question, reply, original: Object.fromEntries(Object.keys(expected).map(name => [name, original[name]])), response: actual.variables.response, done: actual.variables.done});
        await page.getByTitle('Stop', {exact: true}).first().click();
    };
    await sample('unchanged-import', 'Difficulty?', files);
    await editNumber({opcode: 'arcade_askForNumber', input: 'QUESTION', value: 'Difficulty?'}, 'Level?');
    await sample('visible-block-edit', 'Level?', connectedProject(numberSource({question: 'Level?'})));
    await codeTab(); await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.waitForFunction(() => /arcade ask number "Level\?"/.test(document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile.root.view.state.doc.toString() || ''));
    const edited = await readCode(), authored = edited.replace('arcade ask number "Level?"', 'arcade ask number "Difficulty?"');
    assert.notEqual(authored, edited); await editor().click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText(authored);
    assert.equal(await readCode(), authored); await apply('arcade_askForNumber');
    await sample('visible-code-edit', 'Difficulty?', files, '2.5');
    await page.getByText('File', {exact: true}).first().click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('Save to your computer', {exact: true}).click()]);
    const archive = path.join(out, 'connected-number.sb3'); await download.saveAs(archive);
    const bytes = await readFile(archive); assert.ok((await JSZip.loadAsync(bytes)).file('project.json'));
    report.connectedNumberArchive = {sha256: digest(bytes), bytes: bytes.length};
    await page.context().close(); page = await fresh(); await page.getByText('File', {exact: true}).first().click();
    const chooser = page.waitForEvent('filechooser'); await page.getByText('Load from your computer', {exact: true}).click(); await (await chooser).setFiles(archive);
    await page.waitForFunction(() => typeof window.__brickwrightStore.getState().scratchGui.vm.runtime._primitives.arcade_askForNumber === 'function');
    await sample('fresh-sb3-reopen', 'Difficulty?', files);
    await codeTab(); await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.waitForFunction(() => /arcade ask number/.test(document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile.root.view.state.doc.toString() || ''));
    await openCodeActions(page);
    const [exported] = await Promise.all([page.waitForEvent('download'), page.getByTestId('bw-makecode-arcade-export').click()]);
    const exportedPath = path.join(out, 'connected-number-export.mkcd'); await exported.saveAs(exportedPath); await closeCodeActions();
    const exportedBytes = await readFile(exportedPath), embedded = await readMakeCodeProjectText(exportedBytes.toString('utf8'), 'mkcd');
    report.connectedNumberExport = {sha256: digest(exportedBytes), bytes: exportedBytes.length};
    await openFile(exportedPath); await apply('arcade_askForNumber');
    await sample('export-reimport', 'Difficulty?', embedded.files);
};
// Compare the stable branch selected by a positive frame delta, rather than
// pretending independently scheduled simulators have identical frame lengths.
const connectedFrame = async () => {
    const fixture = path.join(out, 'connected-frame.mkcd');
    const files = connectedProject(frameSource());
    await writeFile(fixture, makeCodeProjectFile(files, {target: 'arcade'}));
    await page.context().close(); page = await fresh({controlledClock: true});
    await codeTab(); await page.getByTestId('bw-device-select').selectOption('arcade');
    await page.getByText('Blocks loaded.', {exact: true}).waitFor({timeout: 60000});
    await page.waitForFunction(() => window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime?.bwDeviceId === 'arcade' && document.querySelector('[data-testid="bw-open-file"] input[type=file]')?.disabled === false);
    await openFile(fixture); await apply('arcade_frameDeltaTime');
    const sample = async (label, value, originalFiles) => {
        const name = key => new RegExp(`\\b(?:let|var|const)\\s+((?:Game_)*${key})\\b`).exec(originalFiles['main.ts'])?.[1] || key;
        const expected = {[name('ticks')]: 3, [name('seen')]: value};
        const original = await runPxtArcade(originalFiles, {fakeClock: true, waitForGlobals: expected});
        for (const [key, wanted] of Object.entries(expected)) assert.equal(original[key], wanted, `original frame ${key}`);
        assert.ok(Number.isFinite(original[name('delta')]) && original[name('delta')] > 0, 'original observed a positive frame delta');
        const flag = page.locator('[class*="green-flag_green-flag"]:visible').first();
        await flag.waitFor({state: 'visible'}); const box = await flag.boundingBox();
        assert.ok(box && box.width > 0 && box.height > 0, 'the real green flag has visible bounds');
        await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
        const before = await page.evaluate(() => Date.now());
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.clock.runFor(1000);
        const after = await page.evaluate(() => Date.now());
        assert.ok(elapsedMatches(before, after, 1000), `the admitted clock advanced exactly one second (${after - before} ms)`);
        await page.clock.resume();
        await waitSample({ticks: 3, seen: value}); const actual = await observe();
        assert.deepEqual(actual.errors, []);
        assert.ok(Number.isFinite(actual.variables.delta) && actual.variables.delta > 0, 'Lite observed a positive frame delta');
        (report.connectedFrame ||= []).push({label, original: Object.fromEntries(Object.keys(expected).map(name => [name, original[name]])), originalDelta: original[name('delta')], liteDelta: actual.variables.delta, ticks: actual.variables.ticks, seen: actual.variables.seen, clockAdvance: after - before});
        await page.getByTitle('Stop', {exact: true}).first().click();
    };
    await sample('unchanged-import', 7, files);
    await editNumber({opcode: 'data_setvariableto', input: 'VALUE', value: '7'}, 9);
    await sample('visible-block-edit', 9, connectedProject(frameSource({value: 9})));
    await codeTab(); await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.waitForFunction(() => /set seen to \(0 \+ 9\)/.test(document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile.root.view.state.doc.toString() || ''));
    const edited = await readCode(), authored = edited.replace('set seen to (0 + 9)', 'set seen to (0 + 7)');
    assert.notEqual(authored, edited); await editor().click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText(authored);
    assert.equal(await readCode(), authored); await apply('arcade_frameDeltaTime');
    await sample('visible-code-edit', 7, files);
    await page.getByText('File', {exact: true}).first().click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('Save to your computer', {exact: true}).click()]);
    const archive = path.join(out, 'connected-frame.sb3'); await download.saveAs(archive);
    const bytes = await readFile(archive); assert.ok((await JSZip.loadAsync(bytes)).file('project.json'));
    report.connectedFrameArchive = {sha256: digest(bytes), bytes: bytes.length};
    await page.context().close(); page = await fresh({controlledClock: true}); await page.getByText('File', {exact: true}).first().click();
    const chooser = page.waitForEvent('filechooser'); await page.getByText('Load from your computer', {exact: true}).click(); await (await chooser).setFiles(archive);
    await page.waitForFunction(() => typeof window.__brickwrightStore.getState().scratchGui.vm.runtime._primitives.arcade_frameDeltaTime === 'function');
    await sample('fresh-sb3-reopen', 7, files);
    await codeTab(); await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.waitForFunction(() => /arcade frame delta time/.test(document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile.root.view.state.doc.toString() || ''));
    await openCodeActions(page);
    const [exported] = await Promise.all([page.waitForEvent('download'), page.getByTestId('bw-makecode-arcade-export').click()]);
    const exportedPath = path.join(out, 'connected-frame-export.mkcd'); await exported.saveAs(exportedPath); await closeCodeActions();
    const exportedBytes = await readFile(exportedPath), embedded = await readMakeCodeProjectText(exportedBytes.toString('utf8'), 'mkcd');
    report.connectedFrameExport = {sha256: digest(exportedBytes), bytes: exportedBytes.length};
    await openFile(exportedPath); await apply('arcade_frameDeltaTime');
    await sample('export-reimport', 7, embedded.files);
};
const paletteCreate = async () => {
    await page.locator('.scratchCategoryId-arcade').click();
    let point;
    for (let attempt = 0; attempt < 80; attempt++) {
        point = await page.evaluate(() => {
            const flyout = window.Blockly.getMainWorkspace().getFlyout().getWorkspace(), block = flyout.getAllBlocks(false).find(b => b.type === 'arcade_clampNumber');
            const rect = block?.getSvgRoot().getBoundingClientRect(); return rect && {x: rect.x + 40, y: rect.y + rect.height / 2};
        });
        assert.ok(point, 'New clamp reporter is present in actual Arcade flyout');
        if (point.y > 130 && point.y < 900) break;
        await page.mouse.move(220, 500); await page.mouse.wheel(0, point.y > 900 ? 450 : -450);
        await page.waitForFunction(previousY => {
            const flyout = window.Blockly.getMainWorkspace().getFlyout().getWorkspace();
            const block = flyout.getAllBlocks(false).find(value => value.type === 'arcade_clampNumber');
            const rect = block?.getSvgRoot().getBoundingClientRect();
            return Boolean(rect && rect.y !== previousY);
        }, point.y);
    }
    assert.ok(point.y > 130 && point.y < 900, 'Clamp is reachable by real palette scrolling');
    const before = await page.evaluate(() => window.Blockly.getMainWorkspace().getAllBlocks(false).filter(b => b.type === 'arcade_clampNumber').map(b => b.id));
    await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(700, 350, {steps: 20}); await page.mouse.up();
    await page.waitForFunction(ids => window.Blockly.getMainWorkspace().getAllBlocks(false).filter(b => b.type === 'arcade_clampNumber').some(b => !ids.includes(b.id)), before);
    // Remove the selected orphan through the normal keyboard to keep the game executable.
    await page.keyboard.press('Delete');
    await page.waitForFunction(ids => window.Blockly.getMainWorkspace().getAllBlocks(false).filter(b => b.type === 'arcade_clampNumber').every(b => ids.includes(b.id)), before);
    report.journeys.push('Real Arcade palette scroll, clamp drag into workspace, keyboard delete');
};
try {
    const files = numericAuthoringFiles(), fixture = path.join(out, 'numeric-authoring.mkcd');
    await writeFile(fixture, makeCodeProjectFile(files, {target: 'arcade'})); report.fixtureSha256 = digest(await readFile(fixture));
    page = await fresh(); await codeTab(); await page.getByTestId('bw-device-select').selectOption('arcade');
    // Retargeting loads a new project asynchronously. Wait for its visible
    // completion before opening a file owned by that new stage.
    await page.getByText('Blocks loaded.', {exact: true}).waitFor({timeout: 60000});
    await page.waitForFunction(() => window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime?.bwDeviceId === 'arcade' && document.querySelector('[data-testid="bw-open-file"] input[type=file]')?.disabled === false);
    await openFile(fixture); await apply();
    const blockTypes = await page.evaluate(() => window.Blockly.getMainWorkspace().getAllBlocks(false).map(b => b.type));
    for (const opcode of ['arcade_randomNumber', 'arcade_mathBinary', 'arcade_percentChance', 'arcade_clampNumber', 'arcade_settingsWrite', 'arcade_settingsRead', 'arcade_sourceWhile']) assert.ok(blockTypes.includes(opcode), `${opcode} is a real imported block`);
    await cycle('unchanged-import', {}, files);
    await paletteCreate();
    await editNumber({opcode: 'arcade_clampNumber', input: 'MAX', value: '10'}, 12);
    const mathOperations = ['min', 'max', 'randomRange', 'atan2'];
    await editMenu({opcode: 'arcade_mathBinary', input: 'OP', value: 'min'}, 'max', mathOperations);
    await editMenu({opcode: 'arcade_settingsRead', input: 'TYPE', value: 'StringArray'}, 'String', ['StringArray', 'String']);
    await editMenu({opcode: 'arcade_settingsRead', input: 'TYPE', value: 'String'}, 'StringArray', ['StringArray', 'String']);
    const edited = {maximum: 12, operation: 'max'}; await cycle('visible-block-edits', edited, numericAuthoringFiles(edited));
    await editMenu({opcode: 'arcade_mathBinary', input: 'OP', value: 'max'}, 'atan2', mathOperations);
    const angle = {maximum: 12, operation: 'atan2'}; await cycle('visible-atan2-edit', angle, numericAuthoringFiles(angle));
    await editMenu({opcode: 'arcade_mathBinary', input: 'OP', value: 'atan2'}, 'max', mathOperations);
    await cycle('visible-math-restored', edited, numericAuthoringFiles(edited));
    await codeTab(); await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.waitForFunction(() => {
        const code = document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile.root.view.state.doc.toString();
        return Boolean(code && /arcade clamp minimum[^\n]*maximum .*12/.test(code));
    });
    const code = await readCode(); report.codeFromBlocks = code; assert.match(code, /arcade math max first/); assert.match(code, /arcade repeat while/); assert.match(code, /StringArray/); assert.match(code, /maximum .*12/); assert.ok(code.includes('猫'));
    const editedCode = code.replaceAll('猫', 'PLAY');
    report.editedCode = editedCode;
    await editor().click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText(editedCode);
    assert.equal(await readCode(), editedCode, 'The visible Code editor contains the authored program before compilation');
    await apply();
    const finalOptions = {...edited, message: 'PLAY'}, finalFiles = numericAuthoringFiles(finalOptions);
    await cycle('edited-Code-to-Blocks', finalOptions, finalFiles);
    await page.getByText('File', {exact: true}).first().click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('Save to your computer', {exact: true}).click()]);
    const archive = path.join(out, 'numeric-authoring.sb3'); await download.saveAs(archive);
    const bytes = await readFile(archive), zip = await JSZip.loadAsync(bytes); assert.ok(zip.file('project.json')); report.sb3 = {sha256: digest(bytes), bytes: bytes.length};
    await page.context().close(); page = await fresh(); await page.getByText('File', {exact: true}).first().click();
    const chooser = page.waitForEvent('filechooser'); await page.getByText('Load from your computer', {exact: true}).click(); await (await chooser).setFiles(archive);
    await page.waitForFunction(() => typeof window.__brickwrightStore.getState().scratchGui.vm.runtime._primitives.arcade_clampNumber === 'function');
    await cycle('fresh-SB3-reopen', finalOptions, finalFiles);
    await codeTab(); await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.waitForFunction(() => {
        const code = document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile.root.view.state.doc.toString();
        return Boolean(code && /arcade clamp minimum[^\n]*maximum .*12/.test(code) && code.includes('PLAY'));
    });
    await openCodeActions(page);
    const [exported] = await Promise.all([page.waitForEvent('download'), page.getByTestId('bw-makecode-arcade-export').click()]);
    const exportedPath = path.join(out, 'numeric-authoring-export.mkcd'); await exported.saveAs(exportedPath);await closeCodeActions();
    const exportedBytes = await readFile(exportedPath), embedded = await readMakeCodeProjectText(exportedBytes.toString('utf8'), 'mkcd');
    report.export = {sha256: digest(exportedBytes), bytes: exportedBytes.length};
    await original(embedded.files, finalOptions, false); await original(embedded.files, finalOptions, true);
    await openFile(exportedPath); await apply(); await cycle('actual-export-reimport', finalOptions, embedded.files);
    await Promise.all(bodyChecks); assert.deepEqual(report.bundleFailures || [], []); assert.ok(report.bundleObservations.length); assert.deepEqual(report.pageErrors, []);
    // Refusal reporting acceptance follows every original numeric journey.
    // No compiler success is inferred from a downloaded partial project.
    await codeTab();await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.waitForFunction(() => /DEVICE ARCADE/.test(document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile.root.view.state.doc.toString() || ''));
    const cleanAuthoringCode = await readCode();assert.match(cleanAuthoringCode, /DEVICE ARCADE/);
    const partialCode = cleanAuthoringCode.replace('DEVICE ARCADE', 'DEVICE ARCADE\nGLOBAL refusalDiagnosticResult') +
        '\nSPRITE RefusalDiagnostics:\nWHEN flag clicked:\n  set refusalDiagnosticResult to (calculate value (arcade music tempo) op "+" with (1))\n';
    const authorCode = async text => {
        await codeTab();await editor().click();await page.keyboard.press('Control+a');await page.keyboard.insertText(text);
        assert.equal(await readCode(), text);await apply();await codeTab();
    };
    const currentAssets = () => page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.runtime.targets
        .filter(target => target.isOriginal).map(target => ({name: target.getName(),
            costumes: target.sprite.costumes.map(costume => ({assetId: costume.assetId, bytes: Array.from(costume.asset.data)})),
            sounds: target.sprite.sounds.map(sound => ({assetId: sound.assetId, bytes: Array.from(sound.asset.data)}))})));
    await authorCode(partialCode);const assetsBeforeRefusal = await currentAssets();
    await openCodeActions(page);
    const [partialDownload] = await Promise.all([page.waitForEvent('download'), page.getByTestId('bw-makecode-arcade-export').click()]);
    const partialPath = path.join(out, 'numeric-authoring-refusal.mkcd');await partialDownload.saveAs(partialPath);await closeCodeActions();
    const panel = (await openCodeInfo(page)).getByTestId('bw-conversion-report');await panel.waitFor({state: 'visible'});
    const unsupported = page.getByTestId('bw-conversion-unsupported');await unsupported.waitFor({state: 'visible'});
    // An unproved `+` operand (music tempo here) exports through the runtime-dispatch helper
    // rather than refusing (owner decision 2026-10-30); the report therefore lists nothing.
    assert.doesNotMatch(await unsupported.innerText(), /native addition requires/);
    assert.equal(await page.getByTestId('bw-conversion-refusal-details').count(), 0);
    const dispatched = (await readMakeCodeProjectText(await readFile(partialPath, 'utf8'), 'mkcd')).files['main.ts'];
    const helper = /function ([A-Za-z_$][\w$]*)\(left: any, right: any\): any \{[^\n]*Array\.isArray\(left\)/.exec(dispatched);
    assert.ok(helper, 'the export carries the runtime-dispatch helper');
    assert.ok(new RegExp(`${helper[1].replace(/\$/g, '\\$')}\\(\\s*music\\.tempo\\(\\)\\s*,\\s*1\\s*\\)`).test(dispatched),
        'the unproved addition goes through the helper');
    const details = [];
    assert.match(await page.getByTestId('bw-conversion-preserved').innerText(), /not been compiled or run/);
    await panel.locator('summary').click();assert.equal(await unsupported.isVisible(), false);
    await panel.locator('summary').click();assert.equal(await unsupported.isVisible(), true);
    assert.deepEqual(await currentAssets(), assetsBeforeRefusal, 'export reporting retains current asset bytes');
    report.refusalReporting = {details, unsupported: await unsupported.innerText(), assets: assetsBeforeRefusal};
    await page.getByTestId('bw-dismiss-conversion-report').click();assert.equal(await panel.count(), 0);
    await authorCode(cleanAuthoringCode);const assetsBeforeClean = await currentAssets();
    assert.equal(await page.getByTestId('bw-conversion-refusal-details').count(), 0, 'editing cannot display a previous export result');
    let cleanObservationOwner;
    try { cleanObservationOwner = await page.getByTestId('bw-code-editor').evaluateHandle(observeCleanExport, {phase: 'before'}); }
    catch { /* Missing freshness evidence cannot replace the original journey. */ }
    await openCodeActions(page);
    const [cleanDownload] = await Promise.all([page.waitForEvent('download'), page.getByTestId('bw-makecode-arcade-export').click()]);
    await cleanDownload.saveAs(path.join(out, 'numeric-authoring-clean-after-refusal.mkcd'));await closeCodeActions();
    await (await openCodeInfo(page)).getByTestId('bw-conversion-report').waitFor({state: 'visible'});
    const cleanUnsupported = page.getByTestId('bw-conversion-unsupported');
    if (!await cleanUnsupported.isVisible()) await page.getByTestId('bw-conversion-report').locator('summary').click();
    await cleanUnsupported.waitFor({state: 'visible'});
    assert.equal(await page.getByTestId('bw-conversion-refusal-details').count(), 0);
    const cleanUnsupportedText = await cleanUnsupported.innerText();
    report.cleanAfterRefusal = {unsupported: cleanUnsupportedText};
    try {
        const observed = await page.getByTestId('bw-conversion-report').evaluate(observeCleanExport,
            {phase: 'after', held: cleanObservationOwner, visibleText: cleanUnsupportedText});
        if (observed.captureStatus === 'COMPLETE') {
            const input = Buffer.from(observed.inputJson, 'utf8'), result = Buffer.from(observed.resultJson, 'utf8');
            if (input.length !== observed.inputUtf8Bytes || result.length !== observed.resultUtf8Bytes ||
                input.length + result.length !== observed.totalUtf8Bytes || observed.totalUtf8Bytes > 8388608) throw new Error('observation byte mismatch');
            const inputFile = 'clean-export-consumed-project.json', resultFile = 'clean-export-semantic-result.json';
            await writeFile(path.join(out, inputFile), input);await writeFile(path.join(out, resultFile), result);
            report.cleanAfterRefusal.observation = {schema: observed.schema, origin: observed.origin, captureStatus: 'COMPLETE',
                inputFile, resultFile, inputUtf8Bytes: input.length, resultUtf8Bytes: result.length,
                inputSha256: digest(input), resultSha256: digest(result)};
        } else {
            // Retain only small status data, never an incomplete graph as COMPLETE.
            report.cleanAfterRefusal.observation = {captureStatus: observed.captureStatus || 'UNAVAILABLE_OBSERVATION',
                schema: observed.schema, origin: observed.origin, reasonCode: observed.reasonCode, beforeReason: observed.beforeReason};
        }
    } catch { report.cleanAfterRefusal.observation = {captureStatus: 'UNAVAILABLE_OBSERVER'}; }
    finally { try { await cleanObservationOwner?.dispose(); } catch { /* The original assertion stays authoritative. */ } }
    try { await writeFile(path.join(out, 'clean-export-observation.json'), JSON.stringify(report.cleanAfterRefusal.observation, null, 2)); }
    catch { report.cleanAfterRefusal.observation = {captureStatus: 'UNAVAILABLE_ARTIFACT_WRITE'}; }
    assert.match(cleanUnsupportedText, /nothing reported/);
    assert.deepEqual(await currentAssets(), assetsBeforeClean, 'later clean export also retains actual assets');
    await Promise.all(bodyChecks);assert.deepEqual(report.bundleFailures || [], []);assert.deepEqual(report.pageErrors, []);
    await page.screenshot({path: path.join(out, 'numeric-authoring.png')});
    await connectedSnake();
    await connectedNumber();
    await connectedFrame();
    await Promise.all(bodyChecks); assert.deepEqual(report.bundleFailures || [], []); assert.deepEqual(report.pageErrors, []);
    report.status = 'passed';
} catch (error) {
    report.status = 'failed'; report.failure = String(error.stack || error);
    if (page) { report.failureSample = await observe().catch(e => ({error: String(e)})); report.importObservation = await page.evaluate(() => ({status: document.querySelector('[data-testid="bw-code-editor"]')?.dataset.codeOperationStatus ?? null, code: document.querySelector('[data-testid="bw-code-editor"] .cm-content')?.cmTile?.root?.view?.state?.doc?.toString() ?? null, stageId: window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime?.getTargetForStage()?.id ?? null})).catch(e => ({error: String(e)})); report.body = (await page.evaluate(() => document.body?.innerText || '').catch(e => `Body observation failed: ${String(e)}`)).slice(-14000); await page.screenshot({path: path.join(out, 'failure.png')}).catch(() => {}); }
    throw error;
} finally {
    await Promise.allSettled(bodyChecks); await writeFile(path.join(out, 'current.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close();
}
