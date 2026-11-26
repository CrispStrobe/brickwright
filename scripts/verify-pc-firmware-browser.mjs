// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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

    page.on('pageerror', error => console.error(error));
    await openExample('i8086-blink', 'Blink an LED on the 8086');
    await presets();
    async function choosePreset(id) {
        await page.getByTestId(`bw-machine-preset-${id}`).click();
    }
    async function frameEnabled() {
        await page.waitForFunction(() => {
            const canvas = document.querySelector('[data-testid=bw-machine-canvas]');
            if (!canvas || canvas.width < 300 || canvas.height < 150) return false;
            return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
                .some((value, i) => i % 4 !== 3 && value > 80);
        });
    }
    for (const [id, display] of Object.entries({
        cgademo: 'CGA', cgagfx: 'CGA', vgademo: 'VGA', egademo: 'EGA',
        hercdemo: 'Hercules', kbddemo: 'CGA', deskdemo: 'CGA', timerdemo: 'CGA'
    })) {
        await choosePreset(id);
        await page.getByTestId('bw-machine-console').getByText(`PC ${display}`, {exact: false}).waitFor();
        if (['kbddemo', 'deskdemo'].includes(id)) {
            await page.getByTestId('bw-ctl-keyboard-PC keyboard').waitFor();
            const screen = page.getByTestId('bw-machine-console');
            await screen.focus();
            await page.keyboard.press('z');
            await page.waitForFunction(() => {
                const target = window.__benchTarget;
                const bytes = target?.readMem('mem', 0xb8000, 4000);
                return bytes?.some((byte, offset) => offset % 2 === 0 && (byte === 122 || byte === 90));
            });
        }
        await frameEnabled();
        console.log(`${id} boots against its virtual hardware and paints the Controller ${display}.`);
    }

    await choosePreset('serialmon');
    const terminal = page.getByTestId('bw-ctl-terminal-PC serial');
    await terminal.waitFor();
    await terminal.getByText(/8086/i).waitFor();
    const input = page.getByRole('textbox', {name: 'PC serial input'});
    await input.fill('HELLO');
    await input.press('Enter');
    await terminal.getByText(/HELLO/).waitFor();
    assert.equal(await page.getByTestId('bw-machine-console').count(), 0);

    openingExample = 'wired breadboard';
    await choosePreset('blink');
    const gpio = page.getByTestId('bw-ctl-bargraph-PC GPIO');
    await gpio.waitFor();
    await page.waitForFunction(() => window.__bwMachineBoard?.why?.startsWith('designer board attached'));
    assert.equal(await page.getByTestId('bw-ctl-button-PC switch').count(), 0);

    openingExample = null;
    await choosePreset('blink');
    await page.getByTestId('bw-ctl-button-PC switch').waitFor();
    assert.equal(await page.evaluate(() => window.__bwMachineBoard?.why), 'virtual PC');
    await page.getByTestId('bw-ctl-button-PC switch').press('Space');
    console.log('Blink loads on the compatible wired board or as a virtual GPIO machine.');

    const rom = await readFile(new URL('../overlay/scratch-gui/static/roms/i8086-cga-demo.bin', import.meta.url));
    const upload = page.getByTestId('bw-machine-load-file');
    await upload.setInputFiles({name: 'local-cga.bin', mimeType: 'application/octet-stream', buffer: rom});
    await page.getByTestId('bw-machine-console').getByText('PC CGA', {exact: false}).waitFor();
    await frameEnabled();
    console.log('A local binary boots through the same virtual PC path.');

    await page.evaluate(async () => {
        const response = await fetch('static/roms/free-386-bochs-bios.rom');
        if (!response.ok) throw new Error('The bundled AT BIOS fixture could not be loaded');
        const bytes = new Uint8Array(await response.arrayBuffer());
        window.dispatchEvent(new CustomEvent('bw-machine-media-load',
            {detail: {name: 'AT BIOS', kind: 'i80386', slotId: 'bios', bytes}}));
    });
    await page.getByTestId('bw-machine-console').getByText('AT VGA', {exact: false}).waitFor();
    await frameEnabled();
    await page.getByTestId('bw-machine-console').getByText(/Mouse/).waitFor();
    console.log('A 386 BIOS boots directly with an AT VGA, keyboard and mouse surface in Controller.');
} finally {
    await browser.close();
}
