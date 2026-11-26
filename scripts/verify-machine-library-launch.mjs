// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base = process.argv[2];
assert.ok(base, 'Pass the URL of the assembled Brickwright frontend.');
const browser = await chromium.launch({headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    const freshProject = async () => {
        const page = await browser.newPage({viewport: {width: 1440, height: 900}, locale: 'en-US'});
        page.setDefaultTimeout(45000);
        await page.addInitScript(() => {
            localStorage.setItem('bw-starter-v1-complete', '1');
            localStorage.setItem('bw-right-pane-hidden', '1');
        });
        await page.goto(base, {waitUntil: 'domcontentloaded'});
        return page;
    };
    const openFromFile = async (page, kind) => {
        await page.getByTestId('bw-file-menu-trigger').click();
        await page.getByRole('menuitem', {name: 'Machines…', exact: true}).click();
        await page.getByRole('combobox', {name: 'Machine type'}).selectOption(kind);
    };
    const paintedDisplay = async page => page.waitForFunction(() => {
        const canvas = document.querySelector('[data-testid="bw-machine-canvas"]');
        if (!canvas || canvas.width < 300 || canvas.height < 150) return false;
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        return data.some((value, i) => i % 4 !== 3 && value > 70);
    });

    const dos = await freshProject();
    await openFromFile(dos, 'i8086');
    await dos.getByRole('searchbox', {name: 'Search firmware'}).fill('partcl Tcl');
    const row = dos.getByTestId('bw-mm-downloadable-media').locator('div').filter({hasText: 'partcl Tcl (DOS)'});
    await row.getByRole('button', {name: 'Run', exact: true}).click();
    const consoleOutput = dos.getByTestId('bw-ctl-terminal-DOS Console');
    await consoleOutput.getByText(/partcl on DOS[\s\S]*?42[\s\S]*?120[\s\S]*?720/).waitFor();
    const result = await consoleOutput.textContent();
    for (const value of ['42', '120', '720']) assert.match(result, new RegExp(`\\b${value}\\b`));
    console.log('File → Machines → partcl Tcl (DOS) → Run executes the real sample Tcl script.');
    await dos.close();

    const at = await freshProject();
    await openFromFile(at, 'i80386');
    await at.getByTestId('bw-mm-at-bios-run').click();
    await at.getByTestId('bw-machine-console').getByText('AT VGA', {exact: false}).waitFor();
    await paintedDisplay(at);
    console.log('Start 386 boots the bundled BIOS from a blank workspace.');
    await at.close();

    const xt = await freshProject();
    await openFromFile(xt, 'i8086');
    await xt.getByTestId('bw-mm-8086-cga-demo').click();
    await xt.getByTestId('bw-machine-console').getByText('PC CGA', {exact: false}).waitFor();
    await paintedDisplay(xt);
    console.log('The virtual 8086 CGA preset boots without a Circuit example.');
    await xt.close();

    async function loadCircuitExample(page, title, id) {
        await page.getByRole('tab', {name: 'Circuit', exact: true}).click();
        const examples = page.locator('[data-testid="bw-circuit-panel-examples"]:visible').first();
        const more = page.getByRole('button', {name: 'More circuit controls'}).first();
        await examples.or(more).first().waitFor();
        if (!await examples.isVisible()) await more.click();
        await examples.click();
        await page.getByPlaceholder(/^Search \d+ examples/).first().fill(title);
        page.once('dialog', dialog => dialog.accept());
        const loaded = page.waitForResponse(response => response.ok() &&
            new URL(response.url()).pathname.includes(`/examples/${id}/circuit`));
        await page.locator(`[data-example-id="${id}"]:visible`).getByText(title, {exact: true}).click();
        const ok = page.getByRole('button', {name: 'OK', exact: true});
        await Promise.race([loaded, ok.waitFor().then(() => ok.click()).then(() => loaded)]);
        await page.getByTestId('bw-circuit-panel-designer').first().waitFor();
    }

    const micro = await freshProject();
    await loadCircuitExample(micro, 'Busch Microtronic 2090: Wired I/O', 'busch-microtronic-wired-io');
    const front = micro.locator('[data-microtronic-view="front"]');
    await front.locator('[data-microtronic-display]').waitFor();
    assert.equal(await front.locator('[data-microtronic-load]').count(), 0);
    assert.equal(await micro.locator('[data-instruments-column] [data-microtronic-panel]').count(), 0);
    await micro.getByRole('tab', {name: 'Code', exact: true}).click();
    await micro.getByTestId('bw-code-microtronic-tab').click();
    const code = micro.locator('[data-microtronic-view="code"]');
    await code.locator('.cm-content').waitFor();
    assert.equal(await code.locator('[data-microtronic-key]').count(), 0);
    await code.locator('.cm-content').fill('F00');
    await code.locator('[data-microtronic-load]').click();
    await code.getByText(/Program loaded/).waitFor();
    await front.locator('[data-microtronic-display]').waitFor();
    console.log('Microtronic source and front panel use the same device from Code and Controller.');
    await micro.close();

    const night = await freshProject();
    let reloads = 0;
    let crashes = 0;
    night.on('crash', () => crashes++);
    night.on('framenavigated', frame => { if (frame === night.mainFrame()) reloads++; });
    await loadCircuitExample(night, 'Automatic night light', '03-night-light');
    await night.getByRole('tab', {name: 'Code', exact: true}).click();
    const target = night.getByTestId('bw-device-select');
    await target.waitFor();
    const bench = night.waitForResponse(response => response.ok() &&
        new URL(response.url()).pathname.endsWith('/03-night-light/circuit.stm32f030.json'));
    await target.selectOption('stm32f030');
    await bench;
    await night.waitForFunction(() => document.querySelector('.cm-content')?.textContent?.includes('DEVICE STM32F030'));
    await night.getByRole('tab', {name: 'Circuit', exact: true}).click();
    await night.waitForFunction(() => Boolean(document.querySelector('[data-part-id]') &&
        [...document.querySelectorAll('[data-part-id]')].some(part => /stm32/i.test(part.outerHTML.slice(0, 450)))));
    assert.equal(crashes, 0);
    assert.equal(reloads, 0);
    console.log('Automatic Night Light reseats to STM32F030 without a browser reload.');
    await night.close();

    if (!process.env.BW_SKIP_ZOOM) {
        const circuit = await freshProject();
        await circuit.getByRole('tab', {name: 'Circuit', exact: true}).click();
        const menu = circuit.getByRole('button', {name: 'More circuit controls'});
        await menu.click();
        await circuit.getByTestId('bw-circuit-machines').click();
        await circuit.getByRole('combobox', {name: 'Machine type'}).waitFor();
        await circuit.getByTestId('bw-mm-close').click();
        await menu.click();
        const zoom = circuit.getByRole('spinbutton', {name: 'Zoom percent'});
        await zoom.fill('47');
        await zoom.press('Enter');
        assert.equal(await zoom.inputValue(), '47');
        await circuit.getByRole('button', {name: 'Zoom in', exact: true}).click();
        assert.equal(await zoom.inputValue(), '57');
        await circuit.getByRole('button', {name: 'Zoom out', exact: true}).click();
        assert.equal(await zoom.inputValue(), '47');
        console.log('The Circuit menu applies typed zoom and both zoom buttons.');
    }
} finally {
    await browser.close();
}
