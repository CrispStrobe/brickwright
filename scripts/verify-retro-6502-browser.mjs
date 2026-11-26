// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base = process.argv[2];
assert.ok(base, 'Pass the URL of the assembled Brickwright frontend.');
const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?
        {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})
});

try {
    const page = await browser.newPage({viewport: {width: 1530, height: 1000},
        locale: 'en-US', serviceWorkers: 'block'});
    page.setDefaultTimeout(60_000);
    let openingExample = null;
    page.on('dialog', async dialog => {
        if (dialog.type() === 'confirm' && openingExample && dialog.message().includes(openingExample)) {
            await dialog.accept();
        } else {
            await dialog.dismiss();
        }
    });
    await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
    await page.goto(base, {waitUntil: 'domcontentloaded'});
    async function openExample(id, title) {
        await page.getByRole('tab', {name: 'Circuit', exact: true}).click();
        const examples = page.locator('[data-testid="bw-circuit-panel-examples"]:visible').first();
        const more = page.getByRole('button', {name: 'More circuit controls'}).first();
        await examples.or(more).first().waitFor();
        if (!await examples.isVisible()) await more.click();
        await examples.click();
        await page.getByPlaceholder(/^Search \d+ examples/).first().fill(title);
        await page.locator(`[data-example-id="${id}"]:visible`).getByText(title, {exact: true}).click();
        openingExample = id;
        const circuit = page.waitForResponse(response =>
            response.ok() && new URL(response.url()).pathname.endsWith(`/examples/${id}/circuit.json`));
        await page.getByRole('button', {name: 'OK', exact: true}).click();
        await circuit;
        openingExample = null;
        await page.getByTestId('bw-circuit-panel-designer').first().waitFor();
    }

    async function rightView(label) {
        const picker = page.getByTestId('bw-right-pane-view');
        if (await picker.isVisible()) await picker.selectOption({label});
        else await page.getByRole('button', {name: label, exact: true}).click();
    }

    async function presets() {
        await page.getByRole('button', {name: /Build Machine/}).click();
        const disclosure = page.locator('[data-build-machine] details').filter({hasText: 'Presets and files'});
        if (!(await disclosure.evaluate(node => node.open))) {
            await disclosure.getByText('Presets and files', {exact: true}).click();
        }
    }

    async function activeFrame(widget, width, height) {
        await page.waitForFunction(({widget, width, height}) => {
            const canvas = document.querySelector(`[data-testid="bw-ctl-simplevga-${widget}"] canvas`);
            if (!canvas || canvas.width !== width || canvas.height !== height) return false;
            return canvas.getContext('2d').getImageData(0, 0, width, height).data
                .some((value, i) => i % 4 !== 3 && value > 30);
        }, {widget, width, height});
    }

    await openExample('eater6502-full-build', '6502 Computer with LCD');
    await page.getByTestId('bw-ctl-lcd-LCD').waitFor();
    await presets();
    await page.getByTestId('bw-machine-preset-lcdhello').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-ctl-lcd-LCD"]')
        ?.getAttribute('data-shown')?.includes('HI BRICKWRIGHT'));
    console.log('6502 LCD Hello reaches the wired Controller LCD.');

    await openExample('eater6502-vdp-hello', '6502 + VDP Video');
    await activeFrame('Video', 256, 192);
    console.log('The VDP example boots into its Controller display.');

    await openExample('aurora65-workstation', 'Aurora-65 Display Workstation');
    await activeFrame('vgaMonitor', 160, 128);
    console.log('Aurora/65 boots into its SimpleVGA Controller display.');
    await presets();
    assert.equal(await page.getByTestId('bw-machine-preset-lcdhello').count(), 0);
    await page.getByRole('button', {name: 'Firmware library', exact: true}).click();
    const machine = page.getByRole('combobox', {name: 'Machine type', exact: true});
    await machine.waitFor();
    assert.equal(await machine.inputValue(), 'eater6502');
    assert.equal(await page.getByTestId('bw-mm-local-386').count(), 0);
    await page.getByTestId('bw-mm-wired-forth').waitFor();
    await page.getByTestId('bw-mm-wired-aurora65').waitFor();
    await page.getByTestId('bw-mm-wired-basic').click();
    await rightView('Debugger');
    const debuggerPanel = page.locator('[data-debugger-solo-pane]:visible');
    const terminal = debuggerPanel.getByTestId('bw-serial-console');
    const input = debuggerPanel.getByTestId('bw-serial-input');
    await terminal.getByText('MICROSOFT BASIC V1.1', {exact: false}).waitFor();
    await page.waitForFunction(() => /(?:^|\n)OK\s*$/.test(
        document.querySelector('[data-testid="bw-serial-console"]')?.textContent || ''
    ));
    await input.fill('PRINT 2+2');
    await input.press('Enter');
    await page.waitForFunction(() => /(?:^|\n)\s*4\s*(?:\n|$)/
        .test(document.querySelector('[data-testid="bw-serial-console"]')?.textContent || ''));
    console.log('BASIC boots directly to OK from the filtered firmware library and computes PRINT 2+2.');

    await debuggerPanel.locator('[data-debug-history] > summary').waitFor();
    assert.equal(await debuggerPanel.locator('[data-debug-record]').isVisible(), false);
    await debuggerPanel.locator('[data-debug-history] > summary').click();
    assert.equal(await debuggerPanel.locator('[data-debug-record]').isVisible(), true);
    await rightView('Scratch Stage');
    await debuggerPanel.waitFor({state: 'hidden'});
    console.log('Scratch Stage removes the right-pane debugger and the History disclosure works.');
} finally {
    await browser.close();
}
