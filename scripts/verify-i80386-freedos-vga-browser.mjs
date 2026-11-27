/**
 * Browser smoke for Machine Manager's named 386 media route. Synthetic disks
 * prove attachment and Widgets wiring; they are not a FreeDOS boot fixture.
 * Build packages/scratch-gui first, then run this script. Failures are fatal.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {extname, join, normalize, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages/scratch-gui/build');
if (!existsSync(join(build, 'index.html'))) throw new Error('Build packages/scratch-gui first');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png',
    '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const server = createServer(async (req, res) => {
    try {
        let route = decodeURIComponent((req.url || '/').split('?')[0]);
        if (route === '/' || route.endsWith('/')) route += 'index.html';
        const file = join(build, normalize(route));
        if (!file.startsWith(build + '/')) throw new Error('path escaped build');
        const body = await readFile(file);
        res.writeHead(200, {'content-type': mime[extname(file)] || 'application/octet-stream'});
        res.end(body);
    } catch {
        res.writeHead(404); res.end('not found');
    }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const context = await browser.newContext({viewport: {width: 1600, height: 1000},
    serviceWorkers: 'block'});
const floppy = Buffer.alloc(360 * 1024);
const hdd = Buffer.alloc(306 * 4 * 17 * 512);
floppy[0] = 0xeb;
hdd[0] = 0xfa;
const localFile = (name, buffer) => ({name, mimeType: 'application/octet-stream', buffer});
const openManager = async page => {
    await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        indexedDB.deleteDatabase('bw-machines');
        window.__free386Events = [];
        window.addEventListener('bw-machine-media-load', e => {
            const d = e.detail;
            if (d?.machinePreset === 'freedos-vga') window.__free386Events.push({
                slot: d.slotId, primaryBytes: d.bytes?.length,
                hddBytes: d.i80386Media?.hdd?.length,
                floppyBytes: d.i80386Media?.floppy?.length
            });
        });
    });
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    const device = page.getByTestId('bw-device-select');
    await device.waitFor({state: 'visible', timeout: 60000});
    await device.selectOption('__manage__');
    await page.getByTestId('bw-machine-manager').waitFor({state: 'visible'});
    await page.getByRole('combobox', {name: 'Machine type'}).selectOption('i80386');
};
const errors = [];
try {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await openManager(page);
    await page.getByTestId('bw-mm-free386-floppy').setInputFiles(localFile('boot.img', floppy));
    await page.getByTestId('bw-mm-free386-hdd').setInputFiles(localFile('disk.img', hdd));
    await page.waitForFunction(() => typeof window.bwMirrorMachineVideo === 'function');
    await page.evaluate(() => {
        window.__free386Inputs = [];
        const mirror = window.bwMirrorMachineVideo;
        if (typeof mirror !== 'function') throw new Error('Widgets video bridge is absent');
        window.bwMirrorMachineVideo = payload => mirror({
            ...payload,
            keyInFn: sc => {
                const result = payload.keyInFn?.(sc);
                window.__free386Inputs.push({kind: 'key', code: sc, result});
                return result;
            },
            mouseInFn: event => {
                const result = payload.mouseInFn?.(event);
                window.__free386Inputs.push({kind: 'mouse', dx: event.dx, dy: event.dy,
                    buttons: event.buttons, result});
                return result;
            }
        });
    });
    await page.getByTestId('bw-mm-free386-run').click();
    await page.getByTestId('bw-machine-manager').waitFor({state: 'detached', timeout: 90000});
    const seen = await page.evaluate(() => window.__free386Events);
    assert.ok(seen.some(e => e.slot === 'floppy' && e.primaryBytes === floppy.length &&
        e.hddBytes === hdd.length), 'both selected disks must reach the media event');
    const consoleFace = page.getByTestId('bw-machine-console');
    await consoleFace.waitFor({state: 'visible', timeout: 30000});
    const canvas = page.getByTestId('bw-machine-canvas');
    await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="bw-machine-canvas"]');
        return el?.width > 0 && el?.height > 0;
    }, null, {timeout: 30000});
    await canvas.click();
    await page.keyboard.press('a');
    await canvas.click({button: 'right'});
    const inputs = await page.evaluate(() => window.__free386Inputs);
    assert.ok(inputs.some(e => e.kind === 'key' && e.code === 0x1e),
        'Widgets keyboard must send PC set-1 A');
    assert.ok(inputs.some(e => e.kind === 'mouse' && e.buttons === 2 &&
        typeof e.result === 'boolean'),
        'Widgets pointer must reach the named PS/2 adapter');

    // Dispatch DOM PointerEvents on the real canvas, through MachineConsole,
    // the Widgets mirror, the attached runner and its board adapter. No guest
    // disk bytes are needed to prove this input route or its release edges.
    await consoleFace.evaluate(el => el.blur());
    const pointerPackets = await canvas.evaluate(canvasElement => {
        window.__free386Inputs = [];
        const send = (type, x, y, button = 0) => canvasElement.dispatchEvent(
            new PointerEvent(type, {bubbles: true, pointerId: 17,
                pointerType: 'mouse', clientX: x, clientY: y, button}));
        send('pointermove', 100, 600); // Relative origin, no guest packet.
        send('pointermove', 600, 100); // Both axes clamp to PS/2 range.
        send('pointerdown', 600, 100, 0);
        send('pointermove', 100, 600);
        send('pointerup', 100, 600, 0);
        send('pointerdown', 100, 600, 1);
        send('lostpointercapture', 100, 600, 1);
        send('pointerdown', 100, 600, 2);
        document.querySelector('[data-testid="bw-machine-console"]').blur();
        return window.__free386Inputs.filter(e => e.kind === 'mouse');
    });
    assert.deepEqual(pointerPackets.map(({dx, dy, buttons}) => ({dx, dy, buttons})), [
        {dx: 127, dy: -127, buttons: 0},
        {dx: 0, dy: 0, buttons: 1},
        {dx: -127, dy: 127, buttons: 1},
        {dx: 0, dy: 0, buttons: 0},
        {dx: 0, dy: 0, buttons: 4},
        {dx: 0, dy: 0, buttons: 0}, // Lost capture releases middle.
        {dx: 0, dy: 0, buttons: 2},
        {dx: 0, dy: 0, buttons: 0}  // Blur releases right.
    ], 'canvas movement, buttons and release edges reach the attached runner');
    assert.ok(pointerPackets.every(e => typeof e.result === 'boolean'),
        'each pointer packet calls the attached 386 board mouseIn adapter');
    // The synthetic disks do not initialize the guest 8042 auxiliary port;
    // the real board may decline packets until mouse reporting is enabled.
    const acceptedPackets = pointerPackets.filter(e => e.result).length;
    assert.deepEqual(errors, [], 'browser must have no uncaught page errors');
    console.log(`ok named 386 attached both synthetic disks; Widgets canvas ${await canvas.getAttribute('width')}x${await canvas.getAttribute('height')}; keyboard and ${pointerPackets.length} bounded PS/2 packets forwarded (${acceptedPackets} accepted by uninitialized guest)`);

    // The forward debugger drawer must list real, clickable 386 code rows that
    // start at the paused PC (linear CS base + EIP). Before the Board 386
    // disassembly the drawer said "no disassembly on this target".
    const panel = page.locator('[data-debug-panel]');
    await panel.getByRole('button', {name: /Pause|\u23f8/}).click();
    await page.locator('[data-debug-panel][data-debug-phase="paused"]').waitFor({timeout: 30000});
    await panel.getByRole('button', {name: /Under the hood/}).click();
    await panel.getByRole('button', {name: 'Step instruction', exact: true}).waitFor({state: 'visible', timeout: 10000});
    const pausedPc = await page.evaluate(() => window.__benchTarget?.regs?.().pc);
    assert.ok(Number.isSafeInteger(pausedPc), 'paused 386 target exposes a linear PC');
    const codeRows = panel.locator('[title="Click to pause here"]');
    await codeRows.first().waitFor({state: 'visible', timeout: 10000});
    const rowCount = await codeRows.count();
    assert.ok(rowCount > 1, `386 drawer lists several code rows (saw ${rowCount})`);
    const firstAddress = parseInt(await codeRows.first().locator('span').nth(1).innerText(), 16);
    assert.equal(firstAddress, pausedPc, 'first 386 code row is the paused PC');
    assert.equal(/no disassembly on this target/i.test(await panel.innerText()), false,
        '386 drawer no longer reports a missing disassembly');
    assert.deepEqual(errors, [], 'debugger drawer must have no uncaught page errors');
    console.log(`ok 386 debugger drawer lists ${rowCount} code rows from PC ${pausedPc.toString(16)}`);
    await page.close();

    // The named GUI option must make the built browser fetch and instantiate
    // the packaged WASM modules. This is an attachment smoke, not a claim that
    // synthetic media reached protected32 or retired a native block.
    const native = await context.newPage();
    native.on('pageerror', error => errors.push(error.message));
    await openManager(native);
    await native.getByTestId('bw-mm-free386-floppy').setInputFiles(localFile('boot.img', floppy));
    await native.getByTestId('bw-mm-free386-native-blocks').check();
    const ramWasm = native.waitForResponse(response =>
        /i80386-ram-bridge[^/]*\.wasm(?:\?|$)/.test(response.url()), {timeout: 30000});
    const blockWasm = native.waitForResponse(response =>
        /i80386-block-spike[^/]*\.wasm(?:\?|$)/.test(response.url()), {timeout: 30000});
    await native.getByTestId('bw-mm-free386-run').click();
    const [ramResponse, blockResponse] = await Promise.all([ramWasm, blockWasm]);
    assert.equal(ramResponse.status(), 200, 'native RAM bridge WASM must load');
    assert.equal(blockResponse.status(), 200, 'native block WASM must load');
    await native.getByTestId('bw-machine-manager').waitFor({state: 'detached', timeout: 90000});
    await native.getByTestId('bw-machine-canvas').waitFor({state: 'visible', timeout: 30000});
    assert.deepEqual(errors, [], 'native attachment must have no uncaught page errors');
    console.log('ok named 386 native option attached and fetched both emitted WASM assets');
    await native.close();

    const failing = await context.newPage();
    failing.on('pageerror', error => errors.push(error.message));
    let blockedBios = 0;
    await failing.route('**/static/roms/free-386-bochs-bios.rom', route => {
        blockedBios++;
        return route.fulfill({status: 404, body: 'missing test BIOS'});
    });
    await openManager(failing);
    await failing.getByTestId('bw-mm-free386-floppy').setInputFiles(localFile('boot.img', floppy));
    await failing.getByTestId('bw-mm-free386-run').click();
    try { await failing.waitForFunction(() => /Failed to load the free-386 BIOS/i.test(
        document.querySelector('[data-testid="bw-mm-status"]')?.textContent || ''),
    null, {timeout: 15000}); } catch (error) {
        console.log('failure probe', {blockedBios,
            modal: await failing.getByTestId('bw-machine-manager').count(),
            status: await failing.getByTestId('bw-mm-status').allTextContents(),
            events: await failing.evaluate(() => window.__free386Events), errors});
        throw error;
    }
    assert.ok(blockedBios > 0, 'test must intercept a real browser firmware fetch');
    assert.equal(await failing.getByTestId('bw-machine-manager').isVisible(), true,
        'the manager must stay open and show a later attachment failure');
    assert.deepEqual(errors, [], 'attachment refusal must not become an unhandled page error');
    console.log('ok later 386 attachment failure remains visible in Machine Manager');
    await failing.close();

} finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}
