// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {decodeTextPixels, fixedTextGlyphs} from './lib/i80386-vga-text.mjs';

const [url, floppyPath] = process.argv.slice(2);
assert.ok(url && floppyPath, 'Pass the built app URL and the official FreeDOS 1.4 ZIP or 120m/x86BOOT.img.');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(90000);
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('crash', () => errors.push('Chromium page crashed.'));
page.on('requestfailed', request => {
    if (request.url().includes('alicepascal')) console.error(request.failure()?.errorText, request.url());
});
const manager = page.getByTestId('bw-machine-manager');
const canvas = page.getByTestId('bw-machine-canvas');
const decoder = decodeTextPixels.toString();
const glyphs = fixedTextGlyphs();
const guestText = `(() => {try { return (${decoder})(window.__benchTarget?.video?.(), ${JSON.stringify(glyphs)}); } catch { return ''; } })()`;
const waitForGuest = async (pattern, timeout = 90000) => {
    await page.waitForFunction(`(() => ${pattern}.test(${guestText}))()`, null, {polling: 250, timeout});
    return page.evaluate(guestText);
};
const press = async (...keys) => {
    for (const key of keys) {
        await page.keyboard.press(key, {delay: 35});
        const before = await page.evaluate(() => Number(window.__benchTarget?.timeNs?.()));
        await page.waitForFunction(before => Number(window.__benchTarget?.timeNs?.()) > before + 30_000_000, before);
    }
};
const openMachines = async () => {
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    await manager.getByRole('combobox', {name: 'Machine type'}).selectOption('i80386');
};
const runDosCommand = async command => {
    await press('F8');
    await waitForGuest(/DOS command/i);
    await press('f');
    await waitForGuest(/System Command:/i);
    const keys = {' ': 'Space', '.': 'Period', ';': 'Semicolon', '>': 'Shift+Period'};
    await press(...Array.from(command, char => keys[char] || char), 'Enter');
};
const listSavedResult = async () => {
    await runDosCommand('dir result.pas');
    const listing = await waitForGuest(/RESULT\s+PAS\s+[1-9]\d*/i, 15000);
    assert.doesNotMatch(listing, /file not found/i);
};
try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await openMachines();
    const row = manager.locator('[data-machine-media="alice-pascal"]');
    const run = row.getByRole('button', {name: 'Run', exact: true});
    assert.ok(await run.isDisabled());
    await row.getByTestId('bw-mm-alice-floppy').setInputFiles(floppyPath);
    await run.click();
    await manager.waitFor({state: 'hidden'});
    await canvas.waitFor();
    const editor = await waitForGuest(/writeln\s*\(6\s*\*\s*7\)/i);
    assert.match(editor, /File.*DEMO[.]AP/i);
    console.log('ALICE booted in Controller and loaded DEMO.AP.');
    const fullscreen = page.getByTestId('bw-machine-fullscreen');
    await fullscreen.click();
    await fullscreen.getByText('Exit full screen', {exact: true}).waitFor();
    await fullscreen.click();
    await fullscreen.getByText('Full screen', {exact: true}).waitFor();
    await canvas.click();
    await press('F1');
    await waitForGuest(/^\s*42\s*$/m);
    console.log('The Pascal program printed 42.');
    await waitForGuest(/Program finished.*SPACE/i);
    await press('Space');
    await waitForGuest(/writeln\s*\(6\s*\*\s*7\)/i);
    await press('Control+x');
    await waitForGuest(/^\s*>\s*$/m);
    await press('t','e','x','t','Space','r','e','s','u','l','t','Period','p','a','s','Enter');
    await waitForGuest(/Printing to file.*result[.]pas/i, 15000);
    await listSavedResult();
    console.log('ALICE saved RESULT.PAS and the guest DOS directory listed it.');
    await waitForGuest(/Hit SPACE to continue/i, 15000);
    await press('Space');
    await waitForGuest(/File.*DEMO[.]AP/i);
    // A stale startup script would recompile this different source over the saved workspace.
    const changedSource = 'program changed; begin writeln end.';
    await runDosCommand(`echo ${changedSource}>demo.pas`);
    await waitForGuest(/Hit SPACE to continue/i, 15000);
    const saveImage = page.getByTestId('bw-machine-console').getByRole('button', {name: 'Save image', exact: true});
    const downloadEvent = page.waitForEvent('download', {timeout: 15000});
    await saveImage.click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), 'freedos-session.img');
    const buffer = await readFile(await download.path());
    assert.equal(buffer.length, 1228800);
    assert.equal(buffer.readUInt16LE(510), 0xaa55);
    assert.ok(buffer.includes(changedSource), 'the exported disk contains the changed input to APIN');
    console.log('Controller downloaded the 1.2 MB floppy.');

    await page.evaluate(() => { window.__aliceBeforeReload = window.__benchTarget; });
    await openMachines();
    await manager.getByTestId('bw-mm-free386-floppy').setInputFiles({
        name: download.suggestedFilename(), mimeType: 'application/octet-stream', buffer
    });
    await manager.getByTestId('bw-mm-free386-run').click();
    await manager.waitFor({state: 'hidden'});
    await page.waitForFunction(() => window.__benchTarget && window.__benchTarget !== window.__aliceBeforeReload);
    const reopened = await waitForGuest(/writeln\s*\(6\s*\*\s*7\)/i);
    assert.match(reopened, /File.*DEMO[.]AP/i);
    await canvas.click();
    await listSavedResult();
    console.log('The downloaded floppy booted again and preserved DEMO.AP and RESULT.PAS.');
    assert.deepEqual(errors, []);
} catch (error) {
    console.error(errors, await manager.allTextContents(), await page.evaluate(guestText));
    if (process.env.ALICE_FAILURE_SCREEN && await canvas.isVisible()) {
        await canvas.screenshot({path: process.env.ALICE_FAILURE_SCREEN});
    }
    throw error;
} finally {
    await browser.close();
}
