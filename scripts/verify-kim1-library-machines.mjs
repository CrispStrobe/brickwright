// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}, locale: 'en-US', serviceWorkers: 'block'});
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    const library = page.getByTestId('bw-machine-manager');
    const openLibrary = async () => {
        await page.getByTestId('bw-file-menu-trigger').click();
        await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
        await library.getByRole('combobox', {name: 'Machine type'}).selectOption('kim1');
    };
    const run = async preset => {
        await openLibrary();
        const item = library.locator('[data-machine-media="kim1-expansion-demos/' + preset + '"]');
        await item.getByTestId('bw-mm-item-info').click();
        assert.match(await item.getByRole('link', {name: 'MIT', exact: true}).getAttribute('href'),
            /\/[a-f0-9]{40}\/projects\/kim1-expansion-demos\/LICENSE$/);
        await item.getByRole('button', {name: 'Run', exact: true}).click();
        await library.waitFor({state: 'hidden'});
    };
    const front = page.getByTestId('bw-ctl-widget-kim1').locator('[data-kim1-view="front"]');

    const waitForSuccess = () => page.waitForFunction(() => {
        const state = window.__board?.getDeviceState('kim1');
        return state?.ram[0x300] === 0x5a && !state.running && /^BRK/.test(state.lastStop);
    });

    if (!process.argv.includes('--storage-only')) {
        await run('ram-check');
        await front.waitFor();
        await waitForSuccess();
        assert.deepEqual(await page.evaluate(() => {
            const {type} = window.__board.getDeviceState('kim1').backplane;
            return [type[0x2000], type[0x4000], type[0x6000]];
        }), [1, 1, 1]);
        const source = page.locator('[data-kim1-view="code"] .cm-content');
        assert.match(await source.textContent(), /^;180200A2008A9D0020/);
        console.log('Machines launched the KIM-4 tape and its three RAM modules produced $5A at $0300.');

        await run('video');
        const screen = page.getByRole('img', {name: 'K-1008 video', exact: true});
        await screen.waitFor();
        await page.waitForFunction(() => {
            const state = window.__board?.getDeviceState('kim1');
            return state?.k1008 && !state.running && /^BRK/.test(state.lastStop);
        }, null, {timeout: 180000});
        await page.waitForFunction(() => {
            const canvas = document.querySelector('canvas[aria-label="K-1008 video"]');
            const frame = canvas?.getContext('2d').getImageData(0, 0, 320, 200).data;
            if (!frame || frame[0] !== 238) return false;
            for (let row = 0; row < 200; row++) {
                for (let x = 0; x < 320; x++) {
                    const light = (row + (x >> 3)) % 2 === 0 ? 238 : 16;
                    const offset = (row * 320 + x) * 4;
                    if (frame[offset] !== light || frame[offset + 1] !== light || frame[offset + 2] !== light ||
                        frame[offset + 3] !== 255) return false;
                }
            }
            return true;
        });
        await front.waitFor();
        assert.equal(await page.getByTestId('bw-ctl-machine-header-kim1-video').textContent(), 'K-1008');
        console.log('Machines launched the K-1008 tape and Controller displayed all 64,000 expected pixels beside the keypad.');
    }

    await run('memory-map');
    await waitForSuccess();
    assert.deepEqual(await page.evaluate(() => {
        const {memoryCard} = window.__board.getDeviceState('kim1');
        return [memoryCard.data[0x400], memoryCard.data[0xfff9], memoryCard.type[0xfffc]];
    }), [0x34, 0xa7, 0]);
    for (const key of ['AD', '0', '4', '0', '0']) {
        await front.locator('[data-kim1-key="' + key + '"]').click();
    }
    await front.locator('[data-kim1-display="040034"]').waitFor();
    console.log('The programmable card kept the reset vectors clear and the keypad showed the guest write at $0400.');

    const expected = Array.from({length: 16}, (_, i) => (102 + i * 37) & 255);
    for (const [preset, device] of [['sd-read', 'sdCard'], ['corsham-read', 'corshamDisk']]) {
        await run(preset);
        await waitForSuccess();
        const result = await page.evaluate(deviceKey => {
            const state = window.__board.getDeviceState('kim1');
            return {bytes: Array.from(state.ram.subarray(0x310, 0x320)),
                active: state[deviceKey]?.image.length, interfaces: Number(!!state.sdCard) + Number(!!state.corshamDisk)};
        }, device);
        assert.deepEqual(result, {bytes: expected, active: 2048, interfaces: 1});
        console.log(preset + ' read the expected 16 bytes of block 1 through the mounted device.');
    }
    assert.deepEqual(errors, []);
} catch (error) {
    console.error(await page.evaluate(() => {
        const state = window.__board?.getDeviceState('kim1');
        return state && {running: state.running, pc: state.pc, address: state.address, executed: state.executed,
            error: state.error, lastStop: state.lastStop, result: state.ram[0x300], backplane: !!state.backplane,
            video: !!state.k1008, program: state.programSource};
    }));
    console.error(await page.getByTestId('bw-machine-manager').allTextContents());
    throw error;
} finally {
    await browser.close();
}
