// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';
import {openCodeActions, openCodeInfo} from './lib-code-actions.mjs';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const base = process.argv[2];
assert.ok(base, 'Pass the URL of a Brickwright build with the MakeCode Arcade runtime');
const engine = process.env.BW_ARCADE_ENGINE === 'webkit' ? webkit : chromium;
const browser = await engine.launch({headless: true,
    executablePath: engine === chromium ? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH : undefined});

async function run(visibilityBlocks) {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}, locale: 'en-US', serviceWorkers: 'block'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.addInitScript(() => {
            localStorage.setItem('bw-starter-v1-complete', '1');
            window.addEventListener('bw-makecode-load', ({detail}) => {
                if (detail.target === 'arcade') window.arcadeSpeechCompiled = detail.js.includes('Hello world');
            });
        });
        await page.goto(base, {waitUntil: 'domcontentloaded'});
        const code = page.getByRole('tab', {name: 'Code', exact: true});
        await code.click();
        await typeIntoEditor(page, [
            ...(visibilityBlocks ? ['GLOBAL score', ''] : []),
            'STAGE:',
            '  WHEN flag clicked:',
            ...(visibilityBlocks ? ['    show variable score', '    hide variable score'] : []),
            '    say "Hello world"',
            ''
        ].join('\n'));
        await openCodeActions(page);
        const menu = page.getByTestId('bw-code-actions-menu');
        await menu.getByRole('button', {name: /To blocks$/}).click();

        // Check the authored program reached the actual project before
        // exporting. A simulator running the default project could also draw.
        await page.waitForFunction(showHide => {
            const vm = window.__brickwrightStore?.getState().scratchGui.vm;
            const xml = vm?.runtime.getTargetForStage()?.blocks.toXML(1) || '';
            return xml.includes('Hello world') && (!showHide ||
                (xml.includes('data_showvariable') && xml.includes('data_hidevariable')));
        }, visibilityBlocks);
        if (await code.getAttribute('aria-selected') !== 'true') await code.click();

        await openCodeActions(page);
        await page.getByTestId('bw-makecode-arcade-run').click();
        await openCodeInfo(page);
        await page.getByTestId('bw-code-status').filter({hasText: 'Running as a MakeCode Arcade game.'}).waitFor();
        const report = page.getByTestId('bw-conversion-report');
        assert.match(await report.innerText(), /Blocks → Arcade run/);
        const unsupported = report.getByTestId('bw-conversion-unsupported');
        if (!await unsupported.isVisible()) {
            await report.getByText('Conversion report: Blocks → Arcade run', {exact: false}).first().click();
        }
        const labels = (await unsupported.innerText()).replace(/^Unsupported:\s*/, '').split(' · ').sort();
        assert.deepEqual(labels, ['nothing reported']);
        if (visibilityBlocks) {
            assert.match(await report.getByTestId('bw-conversion-changed').innerText(), /variable monitors use compact labels/i);
        }
        assert.match(await report.getByTestId('bw-conversion-preserved').innerText(), /compiled and sent to the player/i);
        assert.equal(await page.evaluate(() => window.arcadeSpeechCompiled), true, 'compiled program contains the speech');

        const pane = page.locator('[data-testid="bw-makecode-pane"][data-target="arcade"]');
        await pane.getByTestId('bw-makecode-state').filter({hasText: /^Running$/}).waitFor();
        const sim = pane.frameLocator('[data-testid="bw-makecode-frame"]').frameLocator('iframe[src*="simulator.html"]');
        const canvas = sim.locator('canvas').first();
        await canvas.waitFor({state: 'visible'});
        const colours = await canvas.evaluate(element => {
            const {data} = element.getContext('2d').getImageData(0, 0, element.width, element.height);
            const colours = new Set();
            for (let idx = 0; idx < data.length; idx += 4) {
                colours.add((data[idx] << 16) | (data[idx + 1] << 8) | data[idx + 2]);
            }
            return colours.size;
        });
        assert.ok(colours > 1, 'the simulator painted a speech bubble');
        assert.deepEqual(errors, []);
        console.log(`PASS ${engine.name()} Arcade speech and conversion report ${visibilityBlocks ? 'with show/hide variable blocks' : 'for the minimal Stage script'}`);
    } finally {
        await page.close();
    }
}

try {
    await run(false);
    await run(true);
} finally {
    await browser.close();
}
