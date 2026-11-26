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

    async function vdpDebuggerFrame() {
        await rightView('Debugger');
        await page.waitForFunction(() => {
            const canvas = document.querySelector('[data-debugger-solo-pane] [data-vdp-screen] canvas');
            if (!canvas || canvas.width !== 256 || canvas.height !== 192) return false;
            const rgba = canvas.getContext('2d').getImageData(0, 0, 256, 192).data;
            return rgba.some((value, i) => i % 4 === 0 && value !== rgba[i + 2]);
        });
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
    await vdpDebuggerFrame();
    await presets();
    await vdpDebuggerFrame();
    await rightView('Controller');
    await activeFrame('Video', 256, 192);
    console.log('VDP colors reach both panes after loading the example and rebuilding the machine.');

    await openExample('aurora65-workstation', 'Aurora-65 Display Workstation');
    await activeFrame('vgaMonitor', 160, 128);
    console.log('Aurora/65 boots into its SimpleVGA Controller display.');
    const monitor = page.getByTestId('bw-ctl-simplevga-vgaMonitor').locator('canvas');
    const rawVga = await monitor.evaluate(canvas => canvas.toDataURL());
    assert.equal(await page.getByTestId('bw-open-logikus').count(), 0);
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
    const screen = debuggerPanel.locator('canvas').first();
    await screen.waitFor();
    const pixel = canvas => canvas.getContext('2d').getImageData(0, 0, 1, 1).data.slice(0, 3).join(',');
    await page.waitForFunction(() => {
        const canvas = document.querySelector('[data-debugger-solo-pane] canvas');
        return canvas?.getContext('2d').getImageData(0, 0, 1, 1).data.slice(0, 3).join(',') === '37,70,90';
    });
    const bootFrame = await screen.evaluate(canvas => canvas.toDataURL());
    await input.fill('print 2+2');
    await input.press('Enter');
    await page.waitForFunction(() => /(?:^|\n)\s*4\s*(?:\n|$)/
        .test(document.querySelector('[data-testid="bw-serial-console"]')?.textContent || ''));
    console.log('BASIC boots directly to OK from the filtered firmware library and computes PRINT 2+2.');

    await page.waitForFunction(previous =>
        document.querySelector('[data-debugger-solo-pane] canvas')?.toDataURL() !== previous, bootFrame);
    const basicFrame = await screen.evaluate(canvas => canvas.toDataURL());
    await rightView('Controller');
    await activeFrame('vgaMonitor', 480, 384);
    assert.equal(await monitor.evaluate(pixel), '37,70,90');
    assert.equal(await monitor.evaluate(canvas => canvas.toDataURL()), basicFrame);
    assert.notEqual(basicFrame, rawVga);
    const keyboard = page.getByRole('textbox', {name: 'BASIC serial input'});
    await keyboard.fill('print "Mixed Case"');
    await keyboard.press('Enter');
    await page.waitForFunction(previous =>
        document.querySelector('[data-testid="bw-ctl-simplevga-vgaMonitor"] canvas')?.toDataURL() !== previous, basicFrame);
    await rightView('Debugger');
    await terminal.getByText('Mixed Case', {exact: false}).waitFor();
    assert.doesNotMatch(await terminal.textContent(), /\?SN ERROR/);
    console.log('BASIC commands work from the serial console and the wired Controller keyboard.');

    await debuggerPanel.locator('[data-debug-history] > summary').waitFor();
    assert.equal(await debuggerPanel.locator('[data-debug-record]').isVisible(), false);
    await debuggerPanel.locator('[data-debug-history] > summary').click();
    assert.equal(await debuggerPanel.locator('[data-debug-record]').isVisible(), true);
    await openExample('kim1-wired-io', 'KIM-1: Wired I/O');
    await rightView('Debugger');
    await debuggerPanel.locator('[data-kim1-view="debugger"]').waitFor();
    assert.equal(await debuggerPanel.locator('[data-vdp-screen]').count(), 0);
    assert.equal(await debuggerPanel.getByRole('alert').count(), 0);
    await rightView('Controller');
    await page.getByTestId('bw-ctl-widget-kim1').locator('[data-kim1-display]').waitFor();
    console.log('Switching from running BASIC to KIM-1 releases the old runner and displays the new device.');

    await rightView('Scratch Stage');
    await debuggerPanel.waitFor({state: 'hidden'});
    console.log('Scratch Stage removes the right-pane debugger and the History disclosure works.');
} finally {
    await browser.close();
}
