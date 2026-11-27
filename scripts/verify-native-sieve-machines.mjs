// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByTestId('bw-file-menu-trigger').click();
    await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
    const library = page.getByTestId('bw-machine-manager');
    await library.getByRole('combobox', {name: 'Machine type'}).selectOption('i80386');
    const item = library.locator('[data-machine-media="x86-benchmarks/native-sieve"]');
    await item.getByTestId('bw-mm-item-info').click();
    assert.match(await item.getByRole('link', {name: 'MIT', exact: true}).getAttribute('href'),
        /\/[a-f0-9]{40}\/projects\/x86-benchmarks\/native-sieve\/LICENSE$/);
    await item.getByRole('button', {name: 'Run', exact: true}).click();
    await library.waitFor({state: 'hidden'});

    const panel = page.getByTestId('native-benchmarks');
    await panel.waitFor();
    assert.equal(await panel.getByTestId('native-benchmark-project').inputValue(), 'native-sieve');
    const status = panel.getByTestId('native-benchmark-status');
    await status.filter({hasText: /^Running native i80386/}).waitFor({timeout: 90000});
    await panel.getByTestId('native-benchmark-stop').click();
    assert.match(await status.textContent(), /^Stopped/);
    assert.equal(await panel.getByTestId('native-benchmark-result').count(), 0);
    await panel.getByTestId('native-benchmark-run').click();
    await status.filter({hasText: /^Complete.*Guest halted/}).waitFor({timeout: 120000});
    const result = JSON.parse(await panel.getByTestId('native-benchmark-result').textContent());
    assert.equal(result.stdout, 'NATIVE386 SIEVE n=8192 passes=20 primes=1028 sum=3908641\n');
    assert.equal(result.backend, 'ExperimentalI80386ATMachine');
    assert.equal(result.imageSha256, 'ec78198054f2c65a49db577c7110c40f807437dc6dea6163231422a5306d8db8');
    assert.equal(result.retired, 2075296);
    assert.equal(result.exitCode, null);
    assert.equal(result.terminated, true);
    assert.equal(result.accepted, true);
    await panel.getByRole('heading', {name: 'UART output', exact: true}).waitFor();
    assert.equal(await panel.getByTestId('native-benchmark-screen').count(), 0);
    assert.match(await panel.getByTestId('native-benchmark-license').textContent(), /Permission is hereby granted/);
    assert.deepEqual(errors, []);
    console.log('Machines launched the native 386 Sieve. Stop and rerun worked, and the guest produced the expected UART totals before halting.');
} catch (error) {
    console.error(await page.getByTestId('native-benchmark-status').allTextContents());
    throw error;
} finally {
    await browser.close();
}
