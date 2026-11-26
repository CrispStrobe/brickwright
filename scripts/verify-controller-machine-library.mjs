// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base = process.argv[2];
assert.ok(base, 'Pass the URL of the assembled Brickwright frontend');
const items = [
    ['i8086', 'zForth (DOS)', 'download', /49 42 64.*5 4 3 2 1/i],
    ['i8086', 'partcl Tcl (DOS)', 'download', /partcl on DOS[\s\S]*720/i],
    ['i8086', 'fe Lisp (DOS)', 'download', /\b(?:fe|42|720)\b/i],
    ['i8086', 'uBASIC (DOS)', 'download', /uBASIC|42|720/i],
    ['i80386', 'TOPBENCH', 'download', /Score:/i],
    ['z80', 'zForth on CP/M', 'download', /total=40/i],
    ['z80', 'CP/M Sieve', 'download', /prime|sieve/i],
    ['rp2040js', 'PicoBB BBC BASIC', 'download', /BBC BASIC/i],
    ['z80', 'lesson-cpm-z80', 'lesson', /A>/],
    ['i8086', 'lesson-elks-i8086', 'lesson', null],
    ['z80','lesson-cpm-z80-vdp','lesson',null],
    ['eater6502', 'lesson-msbasic-6502', 'lesson', /MICROSOFT BASIC/i],
    ['riscv32', 'lesson-linux-riscv32', 'lesson', /bwb#/],
    ['riscv32', 'lesson-linux-riscv32', 'cold', /bwb#/],
    ['i80386', 'bw-mm-at-bios-run', 'preset', null],
    ...['serial-monitor', 'cga-demo', 'cga-gfx-demo', 'vga-demo', 'hercules-demo', 'ega-demo',
        'keyboard-demo', 'desk-demo', 'blink-demo', 'timer-demo'].map(name => (
        ['i8086', `bw-mm-8086-${name}`, 'preset', null]))
].filter(([,name]) => !process.env.BW_MACHINE_FILTER || new RegExp(process.env.BW_MACHINE_FILTER,'i').test(name));
const browser = await chromium.launch({headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const failures = [];
async function run([machine, name, route, expected]) {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}, serviceWorkers: 'block'});
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => {
        localStorage.setItem('bw-starter-v1-complete','1');
        localStorage.setItem('bw-right-pane-hidden','1');
    });
    const visible = () => {
        const dock = document.querySelector('[data-bw-stage-dock="controller"]');
        const canvas = dock?.querySelector('[data-testid="bw-machine-canvas"]');
        const video = canvas?.getClientRects().length > 0 &&
            canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
                .some((value, index) => index % 4 !== 3 && value > 64);
        const surfaces = [...(dock?.querySelectorAll('[data-testid="bw-serial-console"], .xterm-rows') || []),
            ...document.querySelectorAll('[data-testid="native-benchmark-screen"], [data-testid="native-benchmark-status"]')]
            .filter(element => element.getClientRects().length > 0).map(element => element.innerText.trim()).join('\n');
        return {surfaces, video, gpio: Boolean(dock?.querySelector('[data-testid="bw-ctl-bargraph-PC GPIO"]'))};
    };
    try {
        await page.goto(base, {waitUntil:'domcontentloaded'});
        await page.getByTestId('bw-file-menu-trigger').click();
        await page.getByRole('menuitem',{name:'Machines…',exact:true}).click();
        await page.getByRole('combobox',{name:'Machine type'}).selectOption(machine);
        let button;
        if (route === 'download') {
            await page.getByRole('searchbox',{name:'Search firmware'}).fill(name);
            button = page.getByTestId('bw-mm-downloadable-media').locator('div').filter({hasText:name})
                .getByRole('button',{name:'Run',exact:true});
        } else if (route === 'lesson' || route === 'cold') {
            button = page.locator(`[data-lesson-id="${name}"]`).getByTestId(route === 'cold' ? 'bw-mm-lesson-cold' : 'bw-mm-lesson-run');
        } else button = page.getByTestId(name);
        await button.click();
        if (/keyboard-demo|desk-demo/.test(name)) {
            await page.getByTestId('bw-machine-console').focus();
            await page.keyboard.press('z');
            await page.waitForFunction(() => window.__benchTarget?.readMem('mem', 0xb8000, 4000)
                ?.some((value, index) => index % 2 === 0 && (value === 90 || value === 122)));
        }
        const deadline = Date.now() + (name.includes('linux') || name.includes('TOPBENCH') ? 160000 : 55000);
        let state;
        do {
            state = await page.evaluate(visible);
            if (expected ? expected.test(state.surfaces) : state.video || state.gpio) break;
            await page.waitForTimeout(250);
        } while (Date.now() < deadline);
        assert.ok(expected ? expected.test(state.surfaces) : state.video || state.gpio, JSON.stringify(state));
        assert.deepEqual(errors, []);
        if (name !== 'TOPBENCH') {
            const panel = page.locator('[data-bw-stage-dock="controller"]');
            const guestToggle = panel.getByTestId('bw-machine-fullscreen');
            const widgetToggle = panel.getByTestId('bw-widgets-enter-fullscreen');
            await (await guestToggle.isVisible() ? guestToggle : widgetToggle).click();
            const bounds = await panel.boundingBox();
            assert.ok(bounds.width >= 1420 && bounds.height >= 880, JSON.stringify(bounds));
            const exit = panel.getByRole('button', {name: 'Exit full screen', exact: true});
            const exitWidgets = panel.getByTestId('bw-widgets-exit-fullscreen');
            await (await exit.isVisible() ? exit : exitWidgets).click();
            assert.equal(await page.locator('[data-debug-panel] [data-vdp-screen], [data-debug-panel] [data-testid="bw-linux-terminal"]').count(), 0);
        }
        console.log('PASS', name, route);
    } catch (error) {
        const reason = `${name} ${route}: ${error.message}`;
        failures.push(reason);
        console.error('FAIL', reason);
    } finally { await page.close(); }
}
try {
    const queue = [...items];
    await Promise.all(Array.from({length:Math.min(items.length,3)}, async () => {
        while (queue.length) await run(queue.shift());
    }));
    assert.deepEqual(failures, []);
} finally { await browser.close(); }
