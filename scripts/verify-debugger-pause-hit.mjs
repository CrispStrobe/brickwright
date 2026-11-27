// Browser gate: on the REAL app page, the debugger docked beside a running
// x86 machine (Widgets pane open) must own its own controls. A hosted 386
// event's real click on Pause landed on the Widgets "Full screen" button, and
// an earlier fix proved only a rebuilt fixture. Neither surface may cover the
// other: Pause, Full screen and the machine display are each hit-tested. This drives the served build:
// Code tab, right pane, Machine Manager, a local x86 run from an authored
// four-head disk, then hit-tests the centre of Pause and clicks it for real
// (no force, no synthetic dispatch).
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base = process.env.PROOF_URL || 'http://localhost:8617/';
const browser = await chromium.launch();
let failed = false;
const ok = (label, cond, detail = '') => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${detail ? ' - ' + detail : ''}`); if (!cond) failed = true; };
try {
    const context = await browser.newContext({viewport: {width: 1600, height: 1200}, serviceWorkers: 'block', locale: 'en-US'});
    const page = await context.newPage();
    await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('bw-starter-v1-complete', '1'); });
    await page.goto(base, {waitUntil: 'domcontentloaded', timeout: 90000});
    const dismiss = page.getByTestId('bw-starter-backdrop').getByRole('button', {name: 'Not now'});
    if (await dismiss.count()) await dismiss.click();
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    const toggle = page.locator('[data-right-pane-toggle]');
    if (await toggle.count() && await toggle.getAttribute('aria-pressed') === 'false') await toggle.click();
    await page.getByTestId('bw-device-select').selectOption('__manage__');
    await page.getByTestId('bw-machine-manager').waitFor();
    await page.getByRole('combobox', {name: 'Machine type'}).selectOption('i80386');
    // Authored boot sector: cli; xor ax,ax; mov ds,ax; mov edi,0x89abcdef; spin.
    const disk = Buffer.alloc(512 * 4 * 17);
    Buffer.from('fa31c08ed866b87856341266bfefcdab896640ebfc', 'hex').copy(disk); disk[510] = 0x55; disk[511] = 0xaa;
    const conf = '[cpu]\ncputype=auto\n[autoexec]\nimgmount c "pause-hit.img" -t hdd -size 512,17,4,1\n';
    await page.getByTestId('bw-mm-local-disk').setInputFiles({name: 'pause-hit.img', mimeType: 'application/octet-stream', buffer: disk});
    await page.getByTestId('bw-mm-local-conf').setInputFiles({name: 'pause-hit.conf', mimeType: 'text/plain', buffer: Buffer.from(conf)});
    await page.waitForFunction(e => document.querySelector('[data-testid="bw-mm-import-text"]')?.value === e, conf, {timeout: 10000});
    await page.getByTestId('bw-mm-local-run').click();
    await page.getByTestId('bw-machine-manager').waitFor({state: 'detached', timeout: 60000});
    await page.waitForFunction(() => window.__benchTarget?.regs?.()?.edi === 0x89abcdef, undefined, {timeout: 60000});
    const pause = page.locator('[data-debug-panel]').getByRole('button', {name: /Pause|⏸/});
    await pause.waitFor({state: 'visible', timeout: 30000});
    ok('the Widgets pane is open beside the debugger', await page.getByTestId('bw-widgets-enter-fullscreen').count() > 0);
    // Each control must be the topmost element at its own centre: Pause in
    // the debugger, and Full screen plus the machine display in the Widgets.
    // Raising one surface over the other would pass one half and fail the other.
    const topAt = async locator => locator.evaluate(el => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return {own: !!top && (top === el || el.contains(top)), top: top && (top.dataset?.testid || top.tagName), rect: [r.x, r.y, r.width, r.height].map(Math.round)};
    });
    const pauseHit = await topAt(pause);
    ok('the topmost element at the centre of Pause is Pause', pauseHit.own, JSON.stringify(pauseHit));
    const fsHit = await topAt(page.getByTestId('bw-widgets-enter-fullscreen'));
    ok('the topmost element at the centre of the Widgets Full screen button is that button', fsHit.own, JSON.stringify(fsHit));
    const canvas = page.getByTestId('bw-machine-canvas');
    if (await canvas.count()) {
        const canvasHit = await topAt(canvas.first());
        ok('the machine display is not covered at its centre', canvasHit.own, JSON.stringify(canvasHit));
    }
    try {
        await pause.click({timeout: 10000});
        await page.locator('[data-debug-panel][data-debug-phase="paused"]').waitFor({timeout: 30000});
        ok('a real click on Pause pauses the machine', true);
    } catch (e) { ok('a real click on Pause pauses the machine', false, String(e).split('\n').slice(0, 12).join(' | ')); }
} finally { await browser.close(); }
assert.equal(failed, false, 'debugger Pause hit-test failed');
