#!/usr/bin/env node
// Drives the real Code/Blocks/flag/face/pane controls of a production build.
// VM access below observes state and loaded blocks; it never supplies output.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {openCodeInfo} from './lib-code-actions.mjs';

const url = process.env.PROOF_URL || process.env.BW_URL;
if (!url) throw new Error('PROOF_URL must name the production build under qualification');
const output = resolve(process.env.CPX_FACE_REPORT || 'test-results/cpx-circuit-face.json');
const report = {url, status: 'running', steps: [], pageErrors: [],
    limits: ['D13 runtime state is not published; no D13 closure or hardware result is claimed']};
const program = `DEVICE CPX
WHEN flag clicked:
  set pixel brightness to 255
  set all pixels to red
WHEN button A down:
  set all pixels to blue
WHEN button B down:
  set all pixels to green
WHEN switch moved left:
  set all pixels to yellow
WHEN switch moved right:
  set all pixels to white
`;
let browser;
let page;
try {
    browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
    page = await browser.newPage({viewport: {width: 1600, height: 1100}, locale: 'en-US'});
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '0');
    });
    await page.goto(url, {waitUntil: 'networkidle', timeout: 90000});
    report.build = await page.evaluate(async () => {
        const response = await fetch('brickwright-build.json');
        if (!response.ok) throw new Error('Production build identity missing');
        return response.json();
    });
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    const editor = page.getByTestId('bw-code-editor').locator('.cm-content');
    await editor.waitFor({state: 'visible'});
    await editor.fill(program);
    await page.getByRole('button', {name: /To blocks/}).first().click();
    const codeInfo = await openCodeInfo(page);
    await codeInfo.getByText('Blocks loaded.', {exact: true}).waitFor({state: 'visible'});
    await page.getByTestId('bw-code-info').click();
    await page.waitForFunction(() => {
        const runtime = window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime;
        return runtime?.stc?.device === 'cpx' && runtime.targets.some(target =>
            Object.values(target.blocks?._blocks || {}).some(block => block.opcode === 'circuitplayground_whenbutton'));
    });
    report.steps.push('real native CPX blocks loaded through Code');
    await page.getByRole('tab', {name: /Circuit/i}).first().click();
    await page.locator('[class*="green-flag"]').first().click();
    await page.waitForFunction(() => {
        const state = window.__brickwrightStore.getState().scratchGui.vm.runtime.bwCpxState;
        return state?.shown.length === 10 && state.shown.every(rgb => rgb === 0xff0000);
    });
    report.steps.push('actual VM program emits ten full-brightness red pixels');
    await page.locator('[data-board-face="circuit_playground_express"]:visible').waitFor();
    const face = page.locator('[data-cpx-live-face="live"]:visible').first();
    await face.waitFor();
    const expectFace = async fill => {
        await page.waitForFunction(expected => {
            const faces = [...document.querySelectorAll('[data-cpx-live-face="live"]')];
            return faces.some(node => node.getClientRects().length &&
                node.querySelectorAll('[data-cpx-pixel]').length === 10 &&
                [...node.querySelectorAll('[data-cpx-pixel]')].every(pixel => pixel.getAttribute('fill') === expected));
        }, fill);
    };
    const expectPane = async fill => {
        await page.locator('[title="Circuit Playground"]').first().click();
        await page.locator('[data-testid="bw-cpx-pane"]:visible').waitFor();
        await page.waitForFunction(expected => {
            const pixels = [...document.querySelectorAll('[data-testid^="bw-cpx-pixel-"]')];
            return pixels.length === 10 && pixels.every(pixel => pixel.getAttribute('fill') === expected);
        }, fill);
        await page.getByRole('tab', {name: /Circuit/i}).first().click();
        await face.waitFor();
        await expectFace(fill);
    };
    await expectFace('rgb(255, 0, 0)');
    await expectPane('rgb(255, 0, 0)');
    report.steps.push('visible face and pane preserve the same red state across view changes');
    await face.locator('[data-cpx-button="A"]').click();
    await expectFace('rgb(0, 0, 255)');
    await expectPane('rgb(0, 0, 255)');
    // And the red state is GONE from the face, not merely joined by blue.
    await page.waitForFunction(() => [...document.querySelectorAll('[data-cpx-live-face="live"] [data-cpx-pixel]')]
        .filter(pixel => pixel.getClientRects().length && pixel.getAttribute('fill') === 'rgb(255, 0, 0)').length === 0);
    report.steps.push('face A starts the actual native hat; pane and face turn blue and no red remains');
    await face.locator('[data-cpx-button="B"]').focus();
    await page.keyboard.press('Space');
    await expectFace('rgb(0, 255, 0)');
    report.steps.push('keyboard face B starts the native green handler');
    const slide = face.locator('[data-cpx-switch]');
    const expectSwitch = async (right, fill) => {
        await page.waitForFunction(expected =>
            window.__brickwrightStore.getState().scratchGui.vm.runtime.bwCpxState?.switchRight === expected,
        right);
        assert.equal(await slide.getAttribute('data-cpx-switch'), right ? 'right' : 'left');
        assert.equal(await slide.getAttribute('aria-pressed'), String(right));
        await expectFace(fill);
        await expectPane(fill);
        const paneSlide = page.getByTestId('bw-cpx-switch');
        assert.equal(await paneSlide.getAttribute('aria-pressed'), String(right));
    };
    // The real extension starts with the switch on the right. A pointer and a
    // keyboard toggle must change both views and fire distinct native hats.
    assert.equal(await slide.getAttribute('data-cpx-switch'), 'right');
    await slide.click();
    await expectSwitch(false, 'rgb(255, 255, 0)');
    report.steps.push('pointer slide switch fires the native left hat; both views turn yellow');
    await slide.focus();
    await page.keyboard.press('Enter');
    await expectSwitch(true, 'rgb(255, 255, 255)');
    report.steps.push('keyboard slide switch fires the native right hat; both views turn white');
    const declarations = await page.evaluate(() => {
        const runtime = window.__brickwrightStore.getState().scratchGui.vm.runtime;
        return {device: runtime.stc?.device, source: runtime.stc?.pinsSource,
            buttons: runtime.bwCpxState?.buttons};
    });
    assert.equal(declarations.device, 'cpx');
    report.programDeclarations = declarations;
    assert.equal(declarations.buttons.A, false);
    assert.equal(declarations.buttons.B, false);
    await mkdir(resolve(output, '..'), {recursive: true});
    report.liveScreenshot = output.replace(/\.json$/i, '') + '.live.png';
    await page.screenshot({path: report.liveScreenshot});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    // Leaving the Circuit tab must take the live face off screen.
    await page.locator('[data-cpx-live-face="live"]:visible').first().waitFor({state: 'hidden'});
    await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-editor"] .cm-content .cm-line')?.textContent.trim() === 'DEVICE CPX');
    report.steps.push('native CPX identity survives the real From Blocks round trip');
    // Export the actual inferred circuit, then load it in an independent blank
    // project. This proves reverse declarations without using the program's
    // existing DEVICE CPX as the answer or changing any VM state directly.
    await page.getByRole('tab', {name: /Circuit/i}).first().click();
    await face.waitFor();
    await page.getByText('File', {exact: true}).first().click();
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByText('Save circuit', {exact: true}).click()
    ]);
    assert.equal(download.suggestedFilename(), 'circuit.json');
    const circuitBytes = await readFile(await download.path());
    const savedCircuit = JSON.parse(circuitBytes);
    assert.ok(savedCircuit.parts.some(part => part.kind === 'circuit_playground_express'));
    await page.close();
    page = await browser.newPage({viewport: {width: 1600, height: 1100}, locale: 'en-US'});
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => report.pageErrors.push(error.message));
    await page.addInitScript(() => {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        localStorage.setItem('bw-right-pane-hidden', '0');
    });
    await page.goto(url, {waitUntil: 'networkidle', timeout: 90000});
    await page.getByRole('tab', {name: /Circuit/i}).first().click();
    await page.locator('.bw-circuit-designer:visible').first().waitFor();
    await page.getByText('File', {exact: true}).first().click();
    const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByText('Open circuit…', {exact: true}).click()
    ]);
    await chooser.setFiles({name: 'circuit.json', mimeType: 'application/json', buffer: circuitBytes});
    await page.waitForFunction(() => {
        const stc = window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime?.stc;
        return stc?.device === 'cpx' && stc.pinsSource === 'derived';
    });
    report.steps.push('actual saved CPX circuit imports into a fresh project and derives DEVICE CPX');
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await page.getByRole('button', {name: /From blocks/}).first().click();
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-code-editor"] .cm-content .cm-line')?.textContent.trim() === 'DEVICE CPX');
    report.steps.push('circuit-derived DEVICE CPX survives the fresh project From Blocks round trip');
    assert.deepEqual(report.pageErrors, []);
    report.status = 'passed';
    console.log(JSON.stringify(report));
} catch (error) {
    report.status = 'failed'; report.error = String(error);
    report.observed = await page?.evaluate(() => {
        const runtime = window.__brickwrightStore?.getState()?.scratchGui?.vm?.runtime;
        return {device: runtime?.stc?.device, shown: runtime?.bwCpxState?.shown,
            parts: window.__circuit?.parts?.map(part => ({id: part.id, kind: part.kind})),
            visibleFaces: [...document.querySelectorAll('[data-board-face]')].filter(face =>
                face.getClientRects().length).map(face => face.getAttribute('data-board-face'))};
    }).catch(() => null);
    throw error;
} finally {
    try {
        await mkdir(resolve(output, '..'), {recursive: true});
        if (page && !page.isClosed()) {
            const screenshot = output.replace(/\.json$/i, '') + '.png';
            try {
                await page.screenshot({path: screenshot, timeout: 10000});
                report.screenshot = screenshot;
            } catch (error) {
                // Keep the original assertion failure and its JSON observations
                // even when a crashed renderer cannot provide an image.
                report.screenshotError = String(error);
            }
        }
        await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    } finally {
        await browser?.close();
    }
}
