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
    let openingExample = null;
    const openPage = async () => {
        const fresh = await browser.newPage({viewport: {width: 1530, height: 1000},
            locale: 'en-US', serviceWorkers: 'block'});
        fresh.setDefaultTimeout(60_000);
        fresh.on('dialog', async dialog => {
            if (dialog.type() === 'confirm' && openingExample && dialog.message().includes(openingExample)) {
                await dialog.accept();
            } else {
                await dialog.dismiss();
            }
        });
        await fresh.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
        await fresh.goto(base, {waitUntil: 'domcontentloaded'});
        return fresh;
    };
    let page = await openPage();
    async function chooseExample(id, item) {
        openingExample = id;
        try {
            const loaded = page.waitForResponse(response =>
                response.ok() && new URL(response.url()).pathname.endsWith(`/examples/${id}/circuit.json`));
            await item.click();
            // The shell can confirm in its own dialog or via browser confirm.
            // The dialog event above accepts the latter without a DOM button.
            const ok = page.getByRole('button', {name: 'OK', exact: true});
            await Promise.race([loaded, ok.waitFor().then(() => ok.click()).then(() => loaded)]);
        } finally {
            openingExample = null;
        }
    }

    async function openExample(id, title) {
        await page.getByRole('tab', {name: 'Circuit', exact: true}).click();
        const examples = page.locator('[data-testid="bw-circuit-panel-examples"]:visible').first();
        const more = page.getByRole('button', {name: 'More circuit controls'}).first();
        await examples.or(more).first().waitFor();
        if (!await examples.isVisible()) await more.click();
        await examples.click();
        await page.getByPlaceholder(/^Search \d+ examples/).first().fill(title);
        await chooseExample(id, page.locator(`[data-example-id="${id}"]:visible`).getByText(title, {exact: true}));
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

    async function vdpHelloFrame(selector) {
        await page.waitForFunction(selector => {
            const canvas = document.querySelector(selector);
            if (!canvas || canvas.width !== 256 || canvas.height !== 192) return false;
            const context = canvas.getContext('2d');
            const pixel = (x, y) => context.getImageData(x, y, 1, 1).data.join(',');
            return pixel(0, 0) === '84,85,237,255' &&
                pixel(105, 88) === '255,255,255,255' &&
                pixel(107, 88) === '84,85,237,255' &&
                pixel(107, 91) === '255,255,255,255' &&
                pixel(140, 88) === '255,255,255,255';
        }, selector);
    }

    async function activeFrame(widget, width, height) {
        await page.waitForFunction(({widget, width, height}) => {
            const canvas = document.querySelector(`[data-testid="bw-ctl-simplevga-${widget}"] canvas`);
            if (!canvas || canvas.width !== width || canvas.height !== height) return false;
            return canvas.getContext('2d').getImageData(0, 0, width, height).data
                .some((value, i) => i % 4 !== 3 && value > 30);
        }, {widget, width, height});
    }

    const debuggerPanel = () => page.locator('[data-debugger-solo-pane]:visible');
    const terminal = () => debuggerPanel().getByTestId('bw-serial-console');
    const controller = () => page.locator('[data-bw-stage-dock="controller"]');
    const controllerTerminal = () => controller().getByTestId('bw-serial-console');
    const controllerInput = () => controller().getByTestId('bw-serial-input');
    const consoleOutput = () => debuggerPanel().getByRole('combobox', {name: 'Console output'});
    const monitorConsole = widget => page.getByTestId(`bw-ctl-simplevga-${widget}`)
        .locator('[data-6502-monitor-serial]');
    async function checkDebuggerHasNoVideo() {
        await rightView('Debugger');
        await debuggerPanel().waitFor();
        assert.equal(await debuggerPanel().locator('[data-vdp-screen]').count(), 0);
    }

    async function sendLine(input, line) {
        await input.fill(line);
        await input.press('Enter');
    }

    async function waitingForResult(output, expected) {
        await output.getByText(expected).waitFor();
    }

    async function routeToMonitor(widget, source) {
        await consoleOutput().selectOption(widget);
        await terminal().waitFor({state: 'hidden'});
        await rightView('Controller');
        const console = monitorConsole(widget);
        await console.waitFor();
        assert.equal(await console.getAttribute('data-6502-monitor-serial'), source);
        return console;
    }

    const vdpWidget = '[data-testid="bw-ctl-simplevga-Video"] canvas';
    // Cold Code entry. A compiled declaration alone can show a wired VDP and
    // a controller widget while leaving the ROM slot empty.
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await page.getByTestId('bw-device-select').selectOption('eater6502');
    await page.getByTestId('bw-code-actions-trigger').click();
    await page.getByTestId('bw-catalog-toggle').click();
    await chooseExample('eater6502-vdp-hello',
        page.locator('[data-testid="bw-catalog-item"][title="eater6502-vdp-hello"]'));
    await vdpHelloFrame(vdpWidget);
    await checkDebuggerHasNoVideo();
    console.log('Loading the VDP example from Code boots its ROM and displays HELLO in Controller.');

    // Run the established Circuit gallery journey in its own fresh workspace.
    await page.close();
    page = await openPage();

    await openExample('eater6502-full-build', '6502 Computer with LCD');
    await page.getByTestId('bw-ctl-lcd-LCD').waitFor();
    await presets();
    await page.getByTestId('bw-machine-preset-lcdhello').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="bw-ctl-lcd-LCD"]')
        ?.getAttribute('data-shown')?.includes('HI BRICKWRIGHT'));
    console.log('6502 LCD Hello reaches the wired Controller LCD.');

    await openExample('eater6502-vdp-hello', '6502 + VDP Video');
    await vdpHelloFrame(vdpWidget);
    await checkDebuggerHasNoVideo();
    await presets();
    await checkDebuggerHasNoVideo();
    await rightView('Controller');
    await vdpHelloFrame(vdpWidget);
    await page.getByTestId('bw-machine-preset-basic').click();
    await rightView('Controller');
    await waitingForResult(controllerTerminal(), /MICROSOFT BASIC V1.1/);
    await checkDebuggerHasNoVideo();
    const basicMonitor = await routeToMonitor('Video', 'ACIA');
    await waitingForResult(basicMonitor, /MICROSOFT BASIC V1.1/);
    await sendLine(basicMonitor.getByRole('textbox', {name: '6502 console input'}), 'print 2+2');
    await waitingForResult(basicMonitor, /(?:^|\n)\s*4\s*(?:\n|$)/);
    await checkDebuggerHasNoVideo();
    await consoleOutput().selectOption('debugger');
    await waitingForResult(terminal(), /(?:^|\n)\s*4\s*(?:\n|$)/);
    console.log('MS BASIC can use the Debugger console or the Controller VDP monitor.');

    await page.getByTestId('bw-machine-preset-forth').click();
    await waitingForResult(terminal(), /Tali Forth 2/i);
    const forthMonitor = await routeToMonitor('Video', 'py65mon');
    await sendLine(forthMonitor.getByRole('textbox', {name: '6502 console input'}), '2 2 + .');
    await waitingForResult(forthMonitor, /2 2 \+ \.[\s\S]*?\b4\b[\s\S]*?ok/i);
    await checkDebuggerHasNoVideo();
    await consoleOutput().selectOption('debugger');
    await waitingForResult(terminal(), /2 2 \+ \.[\s\S]*?\b4\b[\s\S]*?ok/i);
    console.log('Tali Forth accepts commands on the same VDP monitor and retains its output when switched back.');

    await consoleOutput().selectOption('Video');
    await page.getByTestId('bw-machine-preset-vdphello').click();
    await consoleOutput().waitFor({state: 'hidden'});
    await rightView('Controller');
    await monitorConsole('Video').waitFor({state: 'hidden'});
    await vdpHelloFrame(vdpWidget);
    console.log('Reloading VDP Hello restores the Controller framebuffer.');

    await openExample('aurora65-workstation', 'Aurora-65 Display Workstation');
    await activeFrame('vgaMonitor', 160, 128);
    console.log('Aurora/65 boots into its SimpleVGA Controller display.');
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
    await checkDebuggerHasNoVideo();
    await consoleOutput().selectOption('controller');
    await rightView('Controller');
    await waitingForResult(controllerTerminal(), /MICROSOFT BASIC V1.1/);
    await sendLine(controllerInput(), 'print 2+2');
    await waitingForResult(controllerTerminal(), /(?:^|\n)\s*4\s*(?:\n|$)/);
    await checkDebuggerHasNoVideo();
    const vgaConsole = await routeToMonitor('vgaMonitor', 'ACIA');
    await sendLine(page.getByRole('textbox', {name: 'BASIC serial input'}), 'print "Mixed Case"');
    await waitingForResult(vgaConsole, /Mixed Case/);
    assert.doesNotMatch(await vgaConsole.textContent(), /\?SN ERROR/);
    await checkDebuggerHasNoVideo();
    console.log('Aurora BASIC boots from the firmware library and accepts the wired Controller keyboard.');

    await debuggerPanel().locator('[data-debug-history] > summary').waitFor();
    assert.equal(await debuggerPanel().locator('[data-debug-record]').isVisible(), false);
    await debuggerPanel().locator('[data-debug-history] > summary').click();
    assert.equal(await debuggerPanel().locator('[data-debug-record]').isVisible(), true);
    await openExample('kim1-wired-io', 'KIM-1: Wired I/O');
    await rightView('Debugger');
    await debuggerPanel().locator('[data-kim1-view="debugger"]').waitFor();
    assert.equal(await debuggerPanel().locator('[data-vdp-screen]').count(), 0);
    assert.equal(await debuggerPanel().getByRole('alert').count(), 0);
    await rightView('Controller');
    await page.getByTestId('bw-ctl-widget-kim1').locator('[data-kim1-display]').waitFor();
    console.log('Switching from running BASIC to KIM-1 releases the old runner and displays the new device.');

    await rightView('Scratch Stage');
    await debuggerPanel().waitFor({state: 'hidden'});
    console.log('Scratch Stage removes the right-pane debugger and the History disclosure works.');
} finally {
    await browser.close();
}
