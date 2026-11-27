// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const examples = [
    {id: '08-led-chaser-595', title: '8-LED chaser with shift register', device: 'pico',
        ledId: bit => `d${bit + 1}`, patterns: [1, 2, 4, 8]},
    {id: '20-shift-register-binary', title: 'Binary counter on shift register', device: 'stc89c52rc',
        ledId: bit => `LED_595_q${bit}`, patterns: [1, 2, 3, 4]}
];

try {
    for (const {id, title, device, ledId, patterns} of examples) {
        const page = await browser.newPage({viewport: {width: 1500, height: 950}, locale: 'en-US', serviceWorkers: 'block'});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
        try {
            await page.goto(url, {waitUntil: 'domcontentloaded'});
            await page.getByRole('tab', {name: 'Circuit', exact: true}).click();
            await page.getByTestId('bw-circuit-panel-examples').first().click();
            await page.getByPlaceholder(/^Search \d+ examples/).first().fill(title);
            await page.locator(`[data-example-id="${id}"]:visible`).getByText(title, {exact: true}).click();
            const confirm = page.getByRole('button', {name: 'OK', exact: true});
            if (await confirm.count()) await confirm.click();
            await page.waitForFunction(example => window.__bwActiveExample?.id === example, id);

            await page.getByRole('tab', {name: 'Code', exact: true}).click();
            const picker = page.getByTestId('bw-device-select');
            const bench = page.waitForResponse(response => response.ok() &&
                new URL(response.url()).pathname.endsWith(`/${id}/circuit.${device}.json`));
            if (await picker.isVisible()) {
                await picker.selectOption(device);
            } else {
                await page.getByTestId('bw-code-actions-trigger').click();
                await page.getByTestId('bw-device-select-menu').selectOption(device);
            }
            await bench;
            await page.waitForFunction(target =>
                window.__brickwrightStore?.getState().scratchGui.vm.runtime.bwDeviceId === target, device);
            await page.getByRole('tab', {name: 'Circuit', exact: true}).click();
            const leds = Array.from({length: 8}, (_, bit) => ledId(bit));
            await page.evaluate(leds => {
                window.shiftRegisterPatterns = [];
                setInterval(() => {
                    const board = window.__board;
                    const mask = leds.reduce((value, id, bit) => {
                        const lit = board?.ledBrightness(id) > 0.02;
                        return lit ? value | (1 << bit) : value;
                    }, 0);
                    if (window.shiftRegisterPatterns.at(-1) !== mask) window.shiftRegisterPatterns.push(mask);
                }, 12);
            }, leds);
            await page.getByRole('radio', {name: 'Sim mode', exact: true}).click();
            await page.waitForFunction(expected => {
                let index = 0;
                for (const mask of window.shiftRegisterPatterns) {
                    if (mask === expected[index]) index++;
                }
                return index === expected.length;
            }, patterns, {timeout: 15000});
            assert.deepEqual(errors, []);
            console.log(`${title} ran in Circuit after switching to ${device} in Code.`);
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
}
