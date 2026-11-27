// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {chromium, webkit} from 'playwright';
import {openCodeInfo} from './lib-code-actions.mjs';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const engine = process.env.BW_BROWSER_ENGINE === 'webkit' ? webkit : chromium;
const browser = await engine.launch({headless: true,
    executablePath: engine === chromium ? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH : undefined});
const settings = {viewport: {width: 1440, height: 900}, locale: 'en-US', serviceWorkers: 'block', acceptDownloads: true};
const page = await browser.newPage(settings);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const createProjectPage = async target => {
    await target.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
    await target.goto(url, {waitUntil: 'domcontentloaded'});
};
const getTerminal = target => target.locator('[data-bw-stage-dock="controller"]').getByTestId('bw-picobb-terminal');
const send = async (target, command) => {
    const terminal = getTerminal(target);
    await terminal.locator('textarea').focus();
    await target.keyboard.type(command, {delay: 14});
    await target.keyboard.press('Enter');
    await terminal.locator('.xterm-rows').getByText('>' + command, {exact: true}).waitFor();
};
const openMachines = async target => {
    await target.getByTestId('bw-file-menu-trigger').click();
    await target.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    return target.getByTestId('bw-machine-manager');
};
try {
    await createProjectPage(page);
    const modal = await openMachines(page);
    const group = name => modal.getByRole('region', {name, exact: true});
    const xt = group('8086');
    const at = group('80386');
    const xtToggle = xt.getByRole('button', {name: '8086', exact: true});
    const atToggle = at.getByRole('button', {name: '80386', exact: true});
    assert.equal(await xtToggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await atToggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await xt.getByText('partcl Tcl (DOS)', {exact: true}).isVisible(), false);
    await xtToggle.press('Enter');
    await atToggle.click();
    await xt.getByText(/ELKS/).first().waitFor();
    await xt.getByText('partcl Tcl (DOS)').waitFor();
    await xt.getByTestId('bw-mm-8086-cga-demo').waitFor();
    await at.getByText(/TOPBENCH/).waitFor();
    await at.getByText('Local DOS package (STORED ZIP)', {exact: true}).waitFor();
    assert.equal(await at.getByTestId('bw-mm-item-description').count(), 0);
    const info = at.getByRole('button', {name: 'About 386 AT BIOS', exact: true});
    await info.click();
    await at.getByText('Start the virtual 386 with the bundled BIOS and no boot disk.').waitFor();
    assert.equal(await atToggle.getAttribute('aria-expanded'), 'true');
    await info.click();
    assert.equal(await at.getByTestId('bw-mm-item-description').count(), 0);
    const graphics = xt.getByRole('combobox', {name: '8086 graphics'});
    await graphics.selectOption('ega-demo');
    await xt.getByTestId('bw-mm-8086-ega-demo').waitFor();
    assert.equal(await xt.getByTestId('bw-mm-8086-cga-demo').count(), 0);
    await xtToggle.click();
    assert.equal(await xt.getByTestId('bw-mm-8086-ega-demo').isVisible(), false);
    assert.equal(await xt.getByText(/TOPBENCH/).count(), 0);
    assert.equal(await at.getByText(/ELKS/).count(), 0);
    const sections = await modal.locator('[data-machine-kind]').evaluateAll(rows => rows.map(row => row.dataset.machineKind));
    assert.equal(new Set(sections).size, sections.length);
    assert.ok(sections.indexOf('i8086') < sections.indexOf('i80386'));
    const type = modal.getByRole('combobox', {name: 'Machine type'});
    await type.selectOption('i80386');
    assert.equal(await xt.count(), 0);
    await type.selectOption('');
    const search = modal.getByRole('searchbox', {name: 'Search firmware'});
    await search.fill('PicoBB');
    assert.equal(await at.count(), 0);
    const pico = group('Raspberry Pi Pico (RP2040)');
    await pico.getByTestId('bw-mm-downloadable-media').getByRole('button', {name: 'Run', exact: true}).click();

    const terminal = getTerminal(page);
    const rows = terminal.locator('.xterm-rows');
    await rows.getByText(/^BBC BASIC for Pico Console/).waitFor();
    await rows.getByText(/^LittleFS image v2\.1, Size = 128KB, Origin = 0x10050000$/).waitFor();
    assert.doesNotMatch(await rows.innerText(), /Corrupted dir pair|Unable to locate LittleFS|Unable to format|^\s*L\s*$/m);
    await send(page, '10 PRINT "PICO-GUI-FILE"');
    await send(page, 'SAVE "FLASH"');
    await send(page, 'NEW');
    await send(page, 'LOAD "FLASH"');
    await send(page, 'RUN');
    await rows.getByText('PICO-GUI-FILE', {exact: true}).waitFor();
    await page.getByTestId('bw-machine-fullscreen').click();
    const bounds = await terminal.boundingBox();
    assert.ok(bounds.width >= 1420, JSON.stringify(bounds));
    await page.getByTestId('bw-machine-fullscreen').click();
    await send(page, 'PRINT 9*7');
    await rows.getByText(/^\s*63\s*$/, {exact: true}).waitFor();
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    const code = page.getByTestId('bw-lang-row');
    await code.getByRole('button', {name: '📺 BAS', exact: true}).click();
    const help = await openCodeInfo(page);
    await help.getByText(/SAVE and LOAD use LittleFS/).waitFor();
    await help.getByRole('button', {name: 'Close Code help'}).click();
    assert.equal(await code.getByRole('button', {name: '🟨 JS', exact: true}).count(), 0);
    await page.getByTestId('bw-file-menu-trigger').click();
    const download = page.waitForEvent('download');
    await page.getByText('Save to your computer', {exact: true}).click();
    const buffer = await readFile(await (await download).path());
    const sb3 = await JSZip.loadAsync(buffer);
    const {state} = JSON.parse(await sb3.file('brickwright/state.json').async('text'));
    assert.deepEqual(state.picoFlash.partitions.map(({offset, length}) => [offset, length]), [[0x50000, 0x20000]]);

    const reopened = await browser.newPage(settings);
    reopened.on('pageerror', error => errors.push(error.message));
    await createProjectPage(reopened);
    await reopened.evaluate(() => window.addEventListener('bw-project-bundle-loaded', event => {
        document.body.dataset.picoBundleStatus = event.detail.outcome;
    }, {once: true}));
    await reopened.getByTestId('bw-file-menu-trigger').click();
    await reopened.getByText('Load from your computer', {exact: true}).click();
    await reopened.locator('body > input[type="file"][accept*=".sb3"]').setInputFiles({
        name: 'picobb-littlefs.sb3', mimeType: 'application/x.scratch.sb3', buffer
    });
    await reopened.locator('body[data-pico-bundle-status="loaded"]').waitFor();
    const reopenedMachines = await openMachines(reopened);
    await reopenedMachines.getByRole('searchbox', {name: 'Search firmware'}).fill('PicoBB');
    await reopenedMachines.getByTestId('bw-mm-downloadable-media').getByRole('button', {name: 'Run', exact: true}).click();
    const reopenedRows = getTerminal(reopened).locator('.xterm-rows');
    await reopenedRows.getByText(/^BBC BASIC for Pico Console/).waitFor();
    await send(reopened, 'LOAD "FLASH"');
    await send(reopened, 'RUN');
    await reopenedRows.getByText('PICO-GUI-FILE', {exact: true}).waitFor();
    assert.deepEqual(errors, []);
    console.log('CPU groups filter correctly. PicoBB ran the same LittleFS file in Controller before and after reopening its SB3.');
} finally {
    await browser.close();
}
