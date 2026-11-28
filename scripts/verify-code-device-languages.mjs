// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import {chromium} from 'playwright';
import {closeCodeActions, openCodeActions} from './lib-code-actions.mjs';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1800, height: 1000}, locale: 'en-US', acceptDownloads: true, serviceWorkers: 'block'});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
const row = page.getByTestId('bw-lang-row');
const tab = name => row.getByRole('button', {name, exact: true});
const target = async device => {
    await openCodeActions(page);
    await page.getByTestId('bw-device-select-menu').selectOption(device);
    await closeCodeActions(page);
};
const hasTabs = async (...names) => {
    const buttons = await row.locator('button[aria-pressed]').evaluateAll(elements =>
        elements.map(el => el.getAttribute('aria-label')).filter(label => /^(🧩|🐍|🟨|🔧|📺|🔩)/u.test(label)));
    assert.deepEqual(buttons, names);
};
const profiles = () => page.getByTestId('bw-basic-profile').locator('option').evaluateAll(items => items.map(item => item.value));
const pseudo = '🧩 Pseudo', py = '🐍 Py', js = '🟨 JS', c = '🔧 C', bas = '📺 BAS', asm = '🔩 ASM';

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await row.waitFor();
    await hasTabs(pseudo, py, js, c, bas, asm);
    await tab(js).click();
    await typeIntoEditor(page, 'console.log("Preserved draft");');
    await target('eater6502');
    await hasTabs(pseudo, c, bas, asm);
    assert.equal(await tab(pseudo).getAttribute('aria-pressed'), 'true');
    assert.equal(await row.getByTestId('bw-lang-more').count(), 0);
    await tab(bas).click();
    assert.deepEqual(await profiles(), ['ms']);
    await target('i8086');
    assert.deepEqual(await profiles(), ['i8086', 'i8086-dos', 'i8086-ubasic']);
    await target('z80');
    assert.deepEqual(await profiles(), ['bbc']);
    await target('pico');
    await hasTabs(pseudo, py, c, bas, asm);
    assert.deepEqual(await profiles(), ['pico-bbcbasic', 'pico-piccolo', 'pico-stefan']);

    await openCodeActions(page);
    const menu = page.getByTestId('bw-code-actions-menu');
    await menu.locator('summary').filter({hasText: 'Languages'}).click();
    assert.equal(await menu.getByRole('button', {name: 'JavaScript', exact: true}).count(), 0);
    assert.equal(await menu.getByRole('button', {name: 'BASIC', exact: true}).count(), 1);
    await closeCodeActions(page);

    await typeIntoEditor(page, '10 A=40\n20 PRINT "PICO-CODE ";A+2\n30 END');
    await openCodeActions(page);
    await page.getByTestId('bw-basic-run-menu').click();
    const rows = page.getByTestId('bw-picobb-terminal').locator('.xterm-rows');
    await rows.getByText(/^PICO-CODE\s+42$/).waitFor({timeout: 120000});

    await typeIntoEditor(page, 'PRINT "PICO-FLAG ";6*7');
    await page.locator('[class*="green-flag_green-flag"]:visible').first().click();
    await rows.getByText(/^PICO-FLAG\s+42$/).waitFor({timeout: 120000});

    const profile = page.getByTestId('bw-basic-profile');
    await profile.selectOption('pico-piccolo');
    await typeIntoEditor(page, 'let a=40\nprint "PICCOLO-GUI ";a+2\nend');
    await openCodeActions(page);
    assert.ok(await menu.getByRole('button', {name: /to blocks/i}).isDisabled());
    assert.ok(await menu.getByRole('button', {name: /from blocks/i}).isDisabled());
    await page.getByTestId('bw-basic-run-menu').click();
    await rows.getByText('PiccoloBASIC UART', {exact: true}).waitFor();
    await rows.getByText(/^PICCOLO-GUI\s+42$/).waitFor({timeout: 120000});
    const piccoloCommand = async (target, input, response) => {
        const terminal = target.getByTestId('bw-picobb-terminal');
        await terminal.locator('textarea').focus();
        await target.keyboard.type(input, {delay: 14});
        await target.keyboard.press('Enter');
        const results = terminal.locator('.xterm-rows').getByText(response, {exact: true});
        await results.last().waitFor();
    };
    await piccoloCommand(page, 'SAVE "piccolo.bas"', 'Saved piccolo.bas');
    await piccoloCommand(page, 'FILES', 'piccolo.bas');

    await profile.selectOption('pico-stefan');
    await typeIntoEditor(page, '10 INPUT A\n20 PRINT A*2');
    await page.locator('[class*="green-flag_green-flag"]:visible').first().click();
    await rows.getByText(/^Stefan's Basic 2\.0/).waitFor();
    await rows.getByText('?', {exact: true}).waitFor();
    await page.getByTestId('bw-picobb-terminal').locator('textarea').focus();
    await page.keyboard.type('21');
    await page.keyboard.press('Enter');
    await rows.getByText('42', {exact: true}).waitFor();
    const terminal = page.getByTestId('bw-picobb-terminal');
    const command = async text => {
        await terminal.locator('textarea').focus();
        await page.keyboard.type(text);
        await page.keyboard.press('Enter');
        await rows.getByText(`> ${text}`, {exact: true}).last().waitFor();
    };
    await command('NEW');
    await command('10 PRINT "STEFAN-SESSION-FILE"');
    await command('SAVE "session.bas"');
    await command('CATALOG');
    await rows.getByText(/^session\.bas\s+\d+$/).waitFor();
    await command('NEW');
    await command('LOAD "session.bas"');
    await command('RUN');
    await rows.getByText('STEFAN-SESSION-FILE', {exact: true}).waitFor();

    const previousTerminal = await terminal.elementHandle();
    await page.locator('[class*="green-flag_green-flag"]:visible').first().click();
    await page.waitForFunction(el => !el.isConnected, previousTerminal);
    await rows.getByText('?', {exact: true}).waitFor();
    await terminal.locator('textarea').focus();
    await page.keyboard.type('0');
    await page.keyboard.press('Enter');
    await rows.getByText('0', {exact: true}).waitFor();
    await command('NEW');
    await command('LOAD "session.bas"');
    await command('RUN');
    await rows.getByText('STEFAN-SESSION-FILE', {exact: true}).waitFor();

    await profile.selectOption('pico-bbcbasic');
    await page.getByTestId('bw-code-editor').locator('.cm-content').getByText('PRINT "PICO-FLAG ";6*7', {exact: true}).waitFor();
    await profile.selectOption('pico-piccolo');
    await page.getByTestId('bw-code-editor').locator('.cm-content').getByText('let a=40', {exact: true}).waitFor();

    await profile.selectOption('pico-bbcbasic');
    await target('');
    await tab(js).click();
    await page.waitForFunction(() =>
        document.querySelector('.cm-content')?.cmTile.root.view.state.doc.toString() === 'console.log("Preserved draft");');
    await openCodeActions(page);
    await page.getByTestId('bw-device-select-menu').selectOption('__manage__');
    await menu.waitFor({state: 'hidden'});
    const manager = page.getByTestId('bw-machine-manager');
    await manager.getByRole('searchbox', {name: 'Search firmware'}).fill('Stefan');
    await manager.getByTestId('bw-mm-downloadable-media').getByRole('button', {name: 'Run', exact: true}).click();
    await manager.waitFor({state: 'hidden'});
    await rows.getByText(/^Stefan's Basic 2\.0/).waitFor();
    await tab(bas).click();
    assert.equal(await profile.inputValue(), 'pico-stefan');
    await page.waitForFunction(() => {
        const saved = JSON.parse(localStorage.getItem('bw-code-autosave') || 'null');
        return saved?.profile === 'pico-stefan' && saved.code.includes('10 INPUT A');
    });
    await page.getByText('File', {exact: true}).click();
    const download = page.waitForEvent('download');
    await page.getByText('Save to your computer', {exact: true}).click();
    const projectFile = await readFile(await (await download).path());
    const archived = await JSZip.loadAsync(projectFile);
    const state = JSON.parse(await archived.file('brickwright/state.json').async('text')).state;
    const stefanPartitions = state.picoFlash.partitions.filter(partition => partition.offset === 0x1df000);
    assert.equal(stefanPartitions.length, 1);
    assert.equal(stefanPartitions[0].length, 128 * 1024);
    const piccoloPartitions = state.picoFlash.partitions.filter(partition => partition.offset === 0xa0000);
    assert.equal(piccoloPartitions.length, 1);
    assert.equal(piccoloPartitions[0].length, 128 * 1024);

    await page.getByRole('button', {name: 'History', exact: true}).click();
    await page.getByTestId('bw-history-tab-autosave').click();
    await page.getByTestId('bw-autosave-save-now').click();
    const manualVersion = page.getByTestId('bw-autosave-versions').locator(':scope > div')
        .filter({hasText: / · manual/}).first();
    const versionDownload = page.waitForEvent('download');
    await manualVersion.getByRole('button', {name: 'Download', exact: true}).click();
    const version = await JSZip.loadAsync(await readFile(await (await versionDownload).path()));
    assert.deepEqual(JSON.parse(await version.file('brickwright/state.json').async('text')).state.picoFlash,
        state.picoFlash);
    await page.getByTestId('bw-history-close').click();

    const reopened = await browser.newPage({viewport: {width: 1800, height: 1000}, locale: 'en-US',
        serviceWorkers: 'block'});
    reopened.on('pageerror', error => errors.push(error.message));
    await reopened.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
    await reopened.goto(url, {waitUntil: 'domcontentloaded'});
    await reopened.getByText('File', {exact: true}).click();
    await reopened.getByText('Load from your computer', {exact: true}).click();
    await reopened.locator('body > input[type="file"][accept*=".sb3"]').setInputFiles({
        name: 'pico-storage.sb3', mimeType: 'application/x.scratch.sb3', buffer: projectFile
    });
    await reopened.getByRole('tab', {name: 'Code', exact: true}).click();
    await reopened.getByTestId('bw-code-editor').locator('.cm-content').getByText('10 INPUT A', {exact: true}).waitFor();
    assert.equal(await reopened.getByTestId('bw-basic-profile').inputValue(), 'pico-stefan');
    await openCodeActions(reopened);
    await reopened.getByTestId('bw-basic-run-menu').click();
    const reopenedTerminal = reopened.getByTestId('bw-picobb-terminal');
    const reopenedRows = reopenedTerminal.locator('.xterm-rows');
    await reopenedRows.getByText('?', {exact: true}).waitFor({timeout: 120000});
    await reopenedTerminal.locator('textarea').focus();
    for (const input of ['0', 'NEW', 'LOAD "session.bas"', 'RUN']) {
        await reopened.keyboard.type(input);
        await reopened.keyboard.press('Enter');
        if (input === '0') await reopenedRows.getByText('0', {exact: true}).waitFor();
        else await reopenedRows.getByText(`> ${input}`, {exact: true}).last().waitFor();
    }
    await reopenedRows.getByText('STEFAN-SESSION-FILE', {exact: true}).waitFor();
    await openCodeActions(reopened);
    await reopened.getByTestId('bw-device-select-menu').selectOption('__manage__');
    const reopenedManager = reopened.getByTestId('bw-machine-manager');
    await reopenedManager.getByRole('searchbox', {name: 'Search firmware'}).fill('PiccoloBASIC');
    await reopenedManager.getByTestId('bw-mm-downloadable-media').getByRole('button', {name: 'Run', exact: true}).click();
    await reopenedRows.getByText('PiccoloBASIC UART', {exact: true}).waitFor();
    await piccoloCommand(reopened, 'LOAD "piccolo.bas"', 'Loaded piccolo.bas');
    await piccoloCommand(reopened, 'RUN', /^PICCOLO-GUI\s+42$/);
    await reopened.close();

    await page.reload({waitUntil: 'domcontentloaded'});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await page.getByTestId('bw-code-editor').locator('.cm-content').getByText('10 INPUT A', {exact: true}).waitFor();
    assert.equal(await profile.inputValue(), 'pico-stefan');
    assert.deepEqual(errors, []);
    console.log('Code tabs, overflow, retained draft, four BASIC profile sets, three Pico UART interpreters, and Pico storage in a reopened SB3 passed.');
} catch (error) {
    const terminal = page.getByTestId('bw-picobb-terminal').locator('.xterm-rows');
    if (await terminal.count()) console.error(await terminal.innerText());
    throw error;
} finally {
    await browser.close();
}
