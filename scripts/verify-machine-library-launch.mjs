// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {FUNSCII} from 'bw-board/funscii-font.js';

const base = process.argv[2];
assert.ok(base, 'Pass the URL of the assembled Brickwright frontend.');
const browser = await chromium.launch({headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
    const freshProject = async ({macDesktop = false} = {}) => {
        const page = await browser.newPage({viewport: {width: 1440, height: 900}, locale: 'en-US'});
        page.setDefaultTimeout(45000);
        await page.addInitScript(useMacPicker => {
            if (useMacPicker) {
                Object.defineProperty(navigator, 'platform', {value: 'MacIntel'});
                window.__TAURI__ = {};
            }
            localStorage.setItem('bw-starter-v1-complete', '1');
            localStorage.setItem('bw-right-pane-hidden', '1');
        }, macDesktop);
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
    const consoleOutput = dos.locator('[data-bw-stage-dock="controller"]').getByTestId('bw-serial-console');
    await consoleOutput.getByText(/partcl on DOS[\s\S]*?42[\s\S]*?120[\s\S]*?720/).waitFor();
    const result = await consoleOutput.textContent();
    for (const value of ['42', '120', '720']) assert.match(result, new RegExp(`\\b${value}\\b`));
    console.log('File → Machines → partcl Tcl (DOS) → Run executes the real sample Tcl script.');
    await dos.close();

    const forth = await freshProject();
    await openFromFile(forth, 'i8086');
    await forth.getByRole('searchbox', {name: 'Search firmware'}).fill('zForth (DOS)');
    await forth.getByTestId('bw-mm-downloadable-media').getByRole('button', {name: 'Run', exact: true}).click();
    await forth.locator('[data-bw-stage-dock="controller"]').getByTestId('bw-serial-console')
        .getByText(/zForth on DOS[\s\S]*49 42 64[\s\S]*5 4 3 2 1/).waitFor({timeout: 60000});
    await forth.close();
    console.log('File → Machines → zForth (DOS) → Run displays the sample output.');

    const vdp = await freshProject();
    await openFromFile(vdp, 'z80');
    await vdp.locator('[data-lesson-id="lesson-cpm-z80-vdp"]').getByTestId('bw-mm-lesson-run').click();
    const screen = vdp.getByTestId('bw-machine-canvas');
    await screen.waitFor();
    const waitForVdpText = (value, atStart = false) => vdp.waitForFunction(({glyphs, length, atStart}) => {
        const screenCanvas = document.querySelector('[data-testid="bw-machine-canvas"]');
        if (!screenCanvas || screenCanvas.width !== 256 || screenCanvas.height !== 192) return false;
        const {data} = screenCanvas.getContext('2d').getImageData(0, 0, 256, 192);
        // Read the six visible pixels of each character cell from the actual frame.
        for (let row = 0; row < 24; row++) {
            for (let col = 0; col <= (atStart ? 0 : 40 - length); col++) {
                if (glyphs.every((pattern, chr) => pattern.every((bits, y) =>
                    Array.from({length: 6}, (_, x) => x).every(x => {
                        const pixel = ((row * 8 + y) * 256 + 8 + (col + chr) * 6 + x) * 4;
                        return (data[pixel] > 128) === Boolean((bits >> (x + 1)) & 1);
                    })))) return true;
            }
        }
        return false;
    }, {
        glyphs: Array.from(value, ch => Array.from(FUNSCII.slice(ch.charCodeAt(0) * 8, ch.charCodeAt(0) * 8 + 8))),
        length: value.length, atStart
    }, {timeout: 15000});
    await waitForVdpText('A>');
    await screen.click();
    await vdp.keyboard.type('DIR');
    await vdp.keyboard.press('Enter');
    await waitForVdpText('BBCBASIC COM');
    await vdp.keyboard.type('BBCBASIC');
    await vdp.keyboard.press('Enter');
    await waitForVdpText('BBC BASIC (Z80)');
    await waitForVdpText('>', true);
    await vdp.keyboard.type('PRINT 2+2', {delay: 30});
    await vdp.keyboard.press('Enter');
    await waitForVdpText('         4', true).catch(async error => {
        await screen.screenshot({path: 'artifacts/cpm-vdp-failure.png'});
        throw error;
    });
    await vdp.close();
    console.log('BBC BASIC on CP/M produces the directory and arithmetic result on the TMS9918A raster.');

    const pico = await freshProject();
    await openFromFile(pico, 'rp2040js');
    await pico.getByRole('searchbox', {name: 'Search firmware'}).fill('PicoBB');
    await pico.getByTestId('bw-mm-downloadable-media').getByRole('button', {name: 'Run', exact: true}).click();
    await pico.getByTestId('bw-serial-console').getByText(/BBC BASIC for Pico Console/).waitFor();
    await pico.close();
    console.log('PicoBB wakes and reaches the BBC BASIC banner on the serial console.');

    const benchmark = await freshProject();
    await openFromFile(benchmark, 'i80386');
    await benchmark.getByRole('searchbox', {name: 'Search firmware'}).fill('TOPBENCH');
    await benchmark.getByTestId('bw-mm-downloadable-media').getByRole('button', {name: 'Run', exact: true}).click();
    await benchmark.getByTestId('native-benchmark-result').waitFor({timeout: 120000});
    const benchmarkResult = JSON.parse(await benchmark.getByTestId('native-benchmark-result').textContent());
    assert.equal(benchmarkResult.accepted, true);
    assert.equal(benchmarkResult.exitCode, 4);
    assert.match(benchmarkResult.screen.join('\n'), /Score:/);
    await benchmark.close();
    console.log('TOPBENCH runs from Machines and publishes the validated 386 result.');

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

    const cp1 = await freshProject();
    await loadCircuitExample(cp1, 'CP1: First display', 'cp1-first-display');
    await cp1.getByRole('tab', {name: 'Code', exact: true}).click();
    await cp1.locator('[data-cp1-code-editor]').getByRole('button', {name: 'Run CP1 program'}).click();
    await cp1.waitForFunction(() => {
        const face = document.querySelector('[data-cp1-controller-face]');
        const digits = face?.querySelectorAll('[data-cp1-digit]');
        return digits?.length === 6 && Number(digits[4].dataset.segments) === 0x66 &&
            Number(digits[5].dataset.segments) === 0x5b;
    });
    await cp1.close();
    console.log('The CP1 Code editor runs the independent monitor and displays 42 on the Controller keypad face.');

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

    const night = await freshProject({macDesktop: true});
    let reloads = 0;
    let crashes = 0;
    night.on('crash', () => crashes++);
    night.on('framenavigated', frame => { if (frame === night.mainFrame()) reloads++; });
    await loadCircuitExample(night, 'Automatic night light', '03-night-light');
    await night.getByRole('tab', {name: 'Code', exact: true}).click();
    const target = night.getByTestId('bw-device-picker-trigger');
    await target.click();
    const options = night.getByTestId('bw-mac-device-menu');
    const bench = night.waitForResponse(response => response.ok() &&
        new URL(response.url()).pathname.endsWith('/03-night-light/circuit.stm32f030.json'));
    await options.getByRole('menuitemradio', {name: 'STM32F030', exact: true}).click();
    await bench;
    await night.waitForFunction(() => document.querySelector('.cm-content')?.textContent?.includes('DEVICE STM32F030'));
    await night.getByRole('tab', {name: 'Circuit', exact: true}).click();
    await night.waitForFunction(() => Boolean(document.querySelector('[data-part-id]') &&
        [...document.querySelectorAll('[data-part-id]')].some(part => /stm32/i.test(part.outerHTML.slice(0, 450)))));
    assert.equal(crashes, 0);
    assert.equal(reloads, 0);
    console.log('The Mac device picker reseats Automatic Night Light to STM32F030 without a reload.');
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
