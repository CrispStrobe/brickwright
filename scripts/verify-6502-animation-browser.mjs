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
    const dialog = page.getByTestId('bw-machine-manager');
    await dialog.getByRole('searchbox', {name: 'Search firmware'}).fill('6502 Animation Lab');
    const row = dialog.locator('[data-machine-media="6502-animation"]');
    await row.getByTestId('bw-mm-item-info').click();
    await row.getByText(/copies four frames|copy four frames/).waitFor();
    assert.match(await row.getByRole('link', {name: 'MIT', exact: true}).getAttribute('href'), /6502-animation\/LICENSE$/);
    await row.getByRole('button', {name: 'Run', exact: true}).click();
    await dialog.waitFor({state: 'hidden'});

    const controller = page.locator('[data-bw-stage-dock="controller"]');
    const canvas = controller.getByTestId('bw-machine-canvas');
    await canvas.waitFor();
    const full = controller.getByTestId('bw-machine-fullscreen');
    await full.click();
    assert.equal(await full.innerText(), 'Exit full screen');
    const sequence = await canvas.evaluate(node => new Promise((resolve, reject) => {
        const centers = [15, 37, 59, 81];
        const seen = [];
        const timer = setTimeout(() => reject(new Error(`Only observed ${seen.join(', ')}`)), 90000);
        const finish = error => {
            clearTimeout(timer);
            if (error) reject(new Error(error));
            else resolve(seen);
        };
        function sample () {
            if (node.width !== 100 || node.height !== 64) return requestAnimationFrame(sample);
            const rgba = node.getContext('2d').getImageData(0, 0, 100, 64).data;
            const index = centers.findIndex(x => rgba[(26 * 100 + x) * 4] === 255);
            if (index === -1 && seen.length === 0 && !rgba.some((v, i) => i % 4 !== 3 && v)) {
                return requestAnimationFrame(sample);
            }
            if (index < 0) return finish('Published image is missing its top diamond pixel');
            for (let y = 0; y < 64; y++) {
                for (let x = 0; x < 100; x++) {
                    const gray = Math.abs(x - centers[index]) + Math.abs(y - 31) <= 5 ? 255 : 0;
                    const offset = (y * 100 + x) * 4;
                    if (rgba[offset] !== gray || rgba[offset + 1] !== gray || rgba[offset + 2] !== gray || rgba[offset + 3] !== 255) {
                        return finish(`Incomplete or incorrect frame ${index}, pixel ${x},${y}`);
                    }
                }
            }
            if (seen.at(-1) !== index) seen.push(index);
            if (seen.length >= 8) return finish();
            return requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
    }));
    assert.deepEqual(sequence, Array.from({length: 8}, (_, i) => (sequence[0] + i) % 4));
    await full.click();
    assert.equal(await full.innerText(), 'Full screen');
    assert.equal(await controller.getByTestId('bw-machine-terminal').count(), 0);
    assert.deepEqual(errors, []);
    console.log('6502 Animation Lab played two complete loops in Controller. Every sampled pixel matched a published guest frame.');
} catch (error) {
    console.error(await page.getByTestId('bw-machine-manager').getByRole('alert').allTextContents());
    throw error;
} finally {
    await browser.close();
}
