#!/usr/bin/env node
/**
 * Acceptance for the MakeCode importer, in a browser, on the real build.
 *
 * bw-makecode has 67 unit tests against real .hex files, and every one of
 * them would still pass if the Open button never called it. What only a
 * browser can prove:
 *
 *  1. dropping a MakeCode .hex on 📂 Open actually reaches the importer
 *     (the routing is by filename, in the JSX);
 *  2. the on-demand chunk loads at all — the importer is behind a
 *     dynamic import() and a webpack misconfiguration would show up
 *     here and in no test;
 *  3. what lands in the editor is the TRANSLATION, not the TypeScript;
 *  4. an Arcade game brings its sprites with it.
 *
 * Checks run against a production build (npm run build:gui). With no
 * PROOF_URL this serves packages/scratch-gui/build itself; with one it
 * drives whatever is already there, which is how the CI gates are wired.
 *   node scripts/verify-makecode.mjs
 *   PROOF_URL=http://localhost:8617/ node scripts/verify-makecode.mjs
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {extname, join, normalize, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import JSZip from 'jszip';
import {openCodeActions, closeCodeActions} from './lib-code-actions.mjs';
import {makeCodeProjectFile} from '../overlay/scratch-gui/src/lib/bw-makecode/project-file.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(root, 'packages', 'scratch-gui', 'build');
const fixtures = join(root, 'test', 'fixtures', 'makecode');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.wasm': 'application/wasm'};

let server = null;
let url = process.env.PROOF_URL || process.env.BW_URL || null;
if (!url) {
    if (!existsSync(join(build, 'index.html'))) throw new Error('Build first: packages/scratch-gui/build/index.html is missing');
    server = createServer(async (req, res) => {
        let body = null;
        try {
            let path = decodeURIComponent(req.url.split('?')[0]);
            if (path.endsWith('/')) path += 'index.html';
            const file = join(build, normalize(path));
            if (!file.startsWith(build)) throw new Error('escape');
            body = await readFile(file);
            res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
        } catch (e) {
            // The 404 has to be decided BEFORE any header goes out: writing
            // a 200 and then failing to read the file throws
            // ERR_HTTP_HEADERS_SENT and takes the whole gate with it.
            res.writeHead(404);
        }
        res.end(body || 'not found');
    });
    // Concurrent sessions run these probes side by side; take the first
    // free port rather than dying on EADDRINUSE.
    const first = Number(process.env.BW_PORT || 8171);
    let port = null;
    for (let p = first; p < first + 20 && port === null; p++) {
        try {
            await new Promise((done, fail) => {
                server.once('error', fail);
                server.listen(p, () => {
                    server.removeListener('error', fail);
                    done();
                });
            });
            port = p;
        } catch (e) {
            if (e.code !== 'EADDRINUSE') throw e;
        }
    }
    if (port === null) throw new Error('no free port');
    url = `http://localhost:${port}/`;
}

const failures = [];
// Every console error, in order, so a check can say WHICH step produced one.
const browserErrors = [];
const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
};

/** Poll rather than guess an interval: a CI runner is slower than a laptop. */
const waitFor = async (read, ok, timeoutMs, stepMs = 400) => {
    const until = Date.now() + timeoutMs;
    let value = await read();
    while (!ok(value) && Date.now() < until) {
        await new Promise(done => setTimeout(done, stepMs));
        value = await read();
    }
    return value;
};

const browser = await chromium.launch();

try {
    const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
    page.on('dialog', d => d.dismiss());
    page.on('console', message => {
        if (message.type() === 'error') {
            console.log(`  browser error: ${message.text().slice(0, 160)}`);
            browserErrors.push(message.text());
        }
    });
    await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        sessionStorage.clear();
    });
    await page.goto(url, {waitUntil: 'networkidle', timeout: 90000});
    await page.waitForSelector('[role="tab"]', {timeout: 60000});
    await page.locator('[role="tab"]', {hasText: 'Code'}).first().click();
    // Open/Save moved into the `...` actions menu (31c5a815); a closed
    // <details> hides them, so wait for the menu and open it first.
    await openCodeActions(page);
    await page.waitForSelector('[data-testid="bw-open-file"]', {timeout: 30000});

    // The importer's own input (.mkcd is its alone): the Debug pane's Firmware…
    // input also takes a .hex once a LabWired session is showing (section 1c).
    const input = page.locator('input[type="file"][accept*=".hex"][accept*=".mkcd"]');
    const offersHex = await input.count() > 0;
    check('the Open button offers .hex', offersHex,
        offersHex ? '' : 'this build predates the MakeCode importer');
    if (!offersHex) {
        // Everything below drops a file on that input; without it the run
        // would die in a 30-second locator timeout and report nothing.
        console.error('\nthe importer is not in this build — nothing further can be checked');
        process.exitCode = 1;
        throw new Error('skip the rest');
    }

    const paneText = () => page.evaluate(() => document.body.innerText || '');

    // MakeCode's own compiler + simulator (lib/bw-makecode/pxt-runtime.js) ride
    // on a runtime the build FETCHES (scripts/sync-makecode-runtime.mjs,
    // tolerated absent). Absent, those checks say so by name and do not run.
    const runtime = await page.evaluate(async () =>
        (await fetch('static/makecode/VERSIONS.json').catch(() => null))?.ok === true);
    if (!runtime) console.log('SKIP MakeCode runtime checks: static/makecode is not in this build (npm run sync:makecode did not run)');
    const clickAction = async testid => {
        await openCodeActions(page);
        await page.locator(`[data-testid="${testid}"]`).click({timeout: 20000});
    };
    /** The simulator frame inside the pane's host frame, once pxtsim created it. */
    const simFrame = target => waitFor(async () =>
        page.frames().find(f => f.url().includes(`makecode/${target}/sim/simulator.html`)) || null, f => !!f, 60000);

    // ── 1. a micro:bit project, translated all the way to pseudocode ──
    await input.setInputFiles(join(fixtures, 'microbit-blocks.hex'));
    let text = await waitFor(paneText, t => /pins test 1/.test(t), 30000);
    check('a MakeCode .hex is recognised and named', /pins test 1/.test(text),
        (text.match(/.{0,80}pins test 1.{0,60}/) || [''])[0].replace(/\s+/g, ' '));
    check('the on-demand importer chunk loaded', !/Could not read/.test(text));

    const code = await waitFor(
        () => page.evaluate(() => {
            const editor = document.querySelector('.cm-content') || document.querySelector('textarea');
            return editor ? (editor.innerText || editor.value || '') : '';
        }),
        t => /DEVICE MICROBIT/.test(t), 20000);
    check('what lands in the editor is the translation, not the TypeScript',
        /DEVICE MICROBIT/.test(code) && !/basic\.forever/.test(code),
        code.split('\n').slice(0, 4).join(' / '));
    check('and it is the program that was in the hex',
        /analog value of pin P0/.test(code), code.replace(/\s+/g, ' ').slice(0, 120));

    // ── 1b. …and runs AS MAKECODE WROTE IT, in MakeCode's simulator ──
    if (runtime) {
        await clickAction('bw-makecode-run');
        const pane = page.locator('[data-testid="bw-makecode-pane"][data-target="microbit"]');
        await pane.waitFor({state: 'visible', timeout: 60000}).catch(() => {});
        check('▶ Run in MakeCode simulator opens the MakeCode pane', await pane.count() > 0);
        const frame = await simFrame('microbit');
        const lit = frame ? await waitFor(() => frame.evaluate(() =>
            [...document.querySelectorAll('.sim-led')].filter(l => parseFloat(getComputedStyle(l).opacity) > 0.5).length)
            .catch(() => 0), n => n >= 3, 30000) : 0;
        // The program shows analogReadPin(P0) as a number: a digit lights LEDs.
        check('the imported program runs on MakeCode\'s micro:bit board (LEDs lit)', lit >= 3, `${lit} LEDs lit`);
        const state = await waitFor(() => page.locator('[data-testid="bw-makecode-state"]').innerText().catch(() => ''),
            t => /Running|Läuft/.test(t), 20000);
        check('the pane says the simulator is running', /Running|Läuft/.test(state), state);

        const download = page.waitForEvent('download', {timeout: 120000});
        await clickAction('bw-makecode-firmware');
        const file = await download.then(d => d.path()).catch(() => null);
        const hex = file ? await readFile(file, 'utf8') : '';
        check('⤓ firmware downloads a real universal .hex (V1 + V2 images, > 600 KB)',
            hex.length > 600000 && hex.startsWith(':'), `${hex.length} bytes`);
        // pxt packs the project 16-byte aligned, so its magic sits in one record.
        check('with the project embedded, so MakeCode reopens it',
            /41140E2FB82FA2BB/i.test(hex), '');
    }

    // ── 1c. …and as REAL FIRMWARE on the emulated micro:bit V2 (task A8) ──
    // MakeCode's compiler links the program onto a Bluetooth-free base
    // (compileMakeCodeForEmulator), and the image runs on LabWired's micro:bit V2
    // board in the Debug pane. Needs the emulator bases and the LabWired engine
    // served (both synced in CI's build); absent, said by name.
    const served = async rel => page.evaluate(async r => (await fetch(r, {method: 'HEAD'}).catch(() => null))?.ok === true, rel);
    const emuServed = runtime && await served('static/makecode/microbit/hexcache-emu/354b97da4696027afdaa3977420ec181bfc88a2faa2d2c0174842767718551e7.hex') &&
        await served('static/labwired/labwired_wasm_bg.wasm');
    if (!emuServed) {
        console.log('SKIP the emulated micro:bit V2 run: the emulator bases or the LabWired engine are not in this build ' +
            '(npm run sync:makecode, npm run sync:labwiredwasm)');
    } else {
        // The Debug pane's own phase (data-debug-phase), not a status word found
        // by its text: other panes show one too, and the word follows the locale.
        const statusText = () => page.evaluate(() => {
            const panel = [...document.querySelectorAll('[data-debug-panel]')].find(n => n.offsetParent !== null);
            return panel ? panel.getAttribute('data-debug-phase') || '' : '';
        });
        await clickAction('bw-makecode-emulate');
        // The status words are transient: sample them all, as verify-labwired-engine.mjs does.
        const seen = [];
        await waitFor(async () => {
            const t = await statusText();
            if (t && seen[seen.length - 1] !== t) seen.push(t);
            return t;
        }, t => /^(running|error)$/.test(t), 60000, 200);
        // An error phase has a sentence beside it; a gate that fails without
        // quoting it sends the reader to a browser to find out why.
        const phaseLine = () => page.evaluate(() => {
            const panel = [...document.querySelectorAll('[data-debug-panel]')].find(n => n.offsetParent !== null);
            const word = panel && [...panel.querySelectorAll('strong')].find(n => n.parentElement.style.alignItems === 'baseline');
            return word ? word.parentElement.innerText.replace(/\s+/g, ' ') : '';
        });
        const hiddenState = seen.length ? null : await page.evaluate(() => ({
            dock: localStorage.getItem('bw-debug-dock'),
            panels: [...document.querySelectorAll('[data-debug-panel]')].map(node => ({
                phase: node.getAttribute('data-debug-phase'), visible: node.offsetParent !== null
            })),
            errorCount: document.querySelectorAll('[data-debug-panel][data-debug-phase="error"]').length,
        }));
        const trail = `${seen.join('  ·  ')}${seen.includes('error') ? ` — ${await phaseLine()}` : ''}${hiddenState ? ` — ${JSON.stringify(hiddenState)}` : ''}`.slice(0, 600);
        check('▶ Run on the emulated micro:bit V2 reaches a running LabWired session', seen.includes('running'), trail);
        check('and never the error phase', seen.length > 0 && !seen.includes('error'), trail);
        const body = await page.evaluate(() => document.body.innerText);
        check('on the micro:bit V2 board, from the emulator image (not the official base)',
            /microbit-v2 board \(nrf52833/i.test(body) && /microbit-v2-emu\.elf/.test(body),
            (body.match(/[^\n]*microbit-v2[^\n]*/i) || [''])[0].slice(0, 160));
        check('the V2 status no longer withholds serial output',
            !/serial output is not faithful|serielle Ausgabe ist auf diesem Board-Modell noch nicht/.test(await paneText()));

        // A10: an authored program through the actual import/compiler/emulator
        // path, with a unique complete line observed in the real UART console.
        const greeting = 'A10 browser serial';
        const serialProject = {meta: {name: 'a10-serial', cloudId: 'pxt/microbit', editor: 'tsprj'},
            source: JSON.stringify({'main.ts': `serial.setWriteLinePadding(0)\nserial.writeLine("${greeting}")\n`, 'pxt.json': JSON.stringify({
                name: 'a10-serial', dependencies: {core: '*', radio: '*'}, files: ['main.ts'], preferredEditor: 'tsprj'
            })})};
        await input.setInputFiles({name: 'a10-serial.mkcd', mimeType: 'application/octet-stream',
            buffer: Buffer.from(JSON.stringify(serialProject))});
        await waitFor(paneText, t => /a10-serial/.test(t), 30000);
        await clickAction('bw-makecode-emulate');
        const compactPane = page.getByTestId('bw-right-pane-view');
        const setPane = async (value, title) => {
            if (await compactPane.isVisible()) await compactPane.selectOption(value);
            else await page.getByTitle(title, {exact: true}).click();
        };
        await setPane('controller', 'Controller');
        const widgets = page.locator('[data-bw-stage-dock="controller"]');
        await widgets.getByRole('combobox', {name: 'Controller surface'}).selectOption('terminal');
        const serial = await waitFor(() => widgets.getByTestId('bw-serial-console')
            .innerText().catch(() => ''), t => t.replace(/\r/g, '').split('\n').includes(greeting), 60000);
        check('the compiled V2 guest prints the complete ordered line in the Controller terminal',
            serial.replace(/\r/g, '').split('\n').includes(greeting), serial.slice(0, 160));
        await setPane('debugger', 'Debugger');
        const serialIdentity = await page.evaluate(() => document.body.innerText);
        check('the serial proof uses its own micro:bit V2 board and emulator ELF',
            /microbit-v2 board \(nrf52833/i.test(serialIdentity) &&
            /a10-serial-microbit-v2-emu\.elf/i.test(serialIdentity), serialIdentity.slice(-600));
        check('the serial guest remains on a running V2 emulator session', await statusText() === 'running');
        // This scenario owns a firmware override. The real global green flag
        // intentionally restarts retained firmware as well as VM blocks; clear
        // our image through the product control before later native scenarios.
        // Its display can own the dock now, so reach the debugger explicitly.
        await closeCodeActions(page);
        await page.locator('[data-testid="bw-open-circuit-debugger"]').click();
        await page.locator('[data-debug-panel]:visible [data-firmware-back]').click();
        await page.locator('[data-debug-panel]:visible [data-firmware-chip]').waitFor({state: 'detached', timeout: 30000});
        check('the serial scenario releases its own firmware override before another device starts',
            await page.locator('[data-debug-panel] [data-firmware-chip]').count() === 0 && await statusText() === 'idle');
    }

    // A11: the actual Code-tab download must compile in its own target.
    // This fixture contains wait-until: the old micro:bit exporter writes
    // pauseUntil, which pxt-calliope does not provide.
    await input.setInputFiles(join(fixtures, 'calliope-images.hex'));
    const calliopeCode = await waitFor(() => page.evaluate(() => {
        const editor = document.querySelector('.cm-content');
        return editor ? editor.innerText : '';
    }), t => /DEVICE CALLIOPEMINI/.test(t), 30000);
    check('a Calliope project selects its own device before export', /DEVICE CALLIOPEMINI/.test(calliopeCode));
    const calliopeDownload = page.waitForEvent('download', {timeout: 30000});
    await clickAction('bw-makecode-export');
    const calliopeFile = await calliopeDownload;
    const calliopeBytes = await readFile(await calliopeFile.path());
    const calliopeEnvelope = JSON.parse(calliopeBytes.toString('utf8'));
    const calliopeFiles = JSON.parse(calliopeEnvelope.source);
    check('Code export downloads a Calliope .mkcd with Calliope packages',
        /\.mkcd$/i.test(calliopeFile.suggestedFilename()) && calliopeEnvelope.meta.cloudId === 'pxt/calliopemini' &&
        JSON.stringify(JSON.parse(calliopeFiles['pxt.json']).dependencies) === JSON.stringify({core: '*', radio: '*'}));
    check('Calliope wait-until is a polling loop, not micro:bit pauseUntil',
        !/pauseUntil/.test(calliopeFiles['main.ts']) && /basic\.pause\(20\)/.test(calliopeFiles['main.ts']));
    const calliopeStatus = await paneText();
    check('the Code export points to the Calliope editor', /https:\/\/makecode\.calliope\.cc\//.test(calliopeStatus));
    if (runtime) {
        // Reopen exactly the downloaded bytes, preserving their .mkcd name.
        // Running this recovered project invokes Calliope's real PXT compiler.
        await input.setInputFiles({name: calliopeFile.suggestedFilename(), mimeType: 'application/octet-stream', buffer: calliopeBytes});
        await waitFor(paneText, t => /calliopemini|Calliope/.test(t), 30000);
        await clickAction('bw-makecode-run');
        const pane = page.locator('[data-testid="bw-makecode-pane"][data-target="calliopemini"]');
        await pane.waitFor({state: 'visible', timeout: 60000});
        const state = await waitFor(() => pane.locator('[data-testid="bw-makecode-state"]').innerText().catch(() => ''),
            t => /Running|Läuft|Error|Fehler/.test(t), 60000);
        check('the downloaded Calliope project compiles and runs in its own simulator', /Running|Läuft/.test(state), state);
        const frame = await simFrame('calliopemini');
        check('the exported project uses the real Calliope simulator frame', !!frame);
    }

    // ── A12. Source-only CPX import -> real native blocks/device inputs. ──
    {
        const inputOnly = {'main.ts': 'input.onLoudSound(function () { music.playTone(440,100) })',
            'pxt.json': JSON.stringify({name: 'CPX package identity',
                dependencies: {'circuit-playground': '*'}, files: ['main.ts']})};
        await input.setInputFiles({name: 'cpx-input-only.mkcd', mimeType: 'application/octet-stream',
            buffer: Buffer.from(makeCodeProjectFile(inputOnly, {name: 'CPX package identity', target: 'unknown'}))});
        const inputCode = await waitFor(() => page.locator('.cm-content').first().innerText().catch(() => ''),
            value => /when loud sound:/.test(value), 30000);
        check('shared CPX input APIs use the project board package rather than micro:bit inference',
            /^DEVICE CPX\b/.test(inputCode) && /when loud sound:/.test(inputCode) && /play tone 440 Hz for 100 ms/.test(inputCode));
        const source = 'light.setBrightness(255)\nlight.setAll(0xff0000)\n' +
            'input.buttonA.onEvent(ButtonEvent.Click, function () { light.setAll(0x0000ff) })\n' +
            'input.onGesture(Gesture.Shake, () => light.setAll(0x00ff00))\n';
        const files = {'main.ts': source, 'pxt.json': JSON.stringify({name: 'A12 CPX',
            dependencies: {'circuit-playground': '*'}, files: ['main.ts']})};
        await input.setInputFiles({name: 'a12-cpx.mkcd', mimeType: 'application/octet-stream',
            buffer: Buffer.from(makeCodeProjectFile(files, {name: 'A12 CPX', target: 'adafruit'}))});
        const code = await waitFor(() => page.locator('.cm-content').first().innerText().catch(() => ''),
            value => /^DEVICE CPX\b/.test(value) && /when button A click:/.test(value) &&
                /when gesture shake:/.test(value), 30000);
        check('CPX source-only import produces DEVICE CPX and native event words',
            /^DEVICE CPX\b/.test(code) && /when button A click:/.test(code) && /when gesture shake:/.test(code));
        check('CPX import names Circuit Playground rather than micro:bit',
            /Circuit Playground Express/.test(await paneText()));
        const unexpectedDownloads = [];
        const onDownload = download => unexpectedDownloads.push(download.suggestedFilename());
        page.on('download', onDownload);
        await clickAction('bw-makecode-export');
        const refused = await waitFor(paneText, value => /MakeCode export is not available for cpx/.test(value), 30000);
        page.off('download', onDownload);
        check('CPX translated MakeCode export is refused by name without a micro:bit download',
            /MakeCode export is not available for cpx/.test(refused) && unexpectedDownloads.length === 0);
        const originalDownload = page.waitForEvent('download', {timeout: 30000});
        await clickAction('bw-export-makecode-source');
        const original = await originalDownload;
        const recovered = await JSZip.loadAsync(await readFile(await original.path()));
        check('CPX original-source download keeps its own target and untouched source',
            /\.zip$/i.test(original.suggestedFilename()) && await recovered.file('main.ts').async('string') === source &&
            /Recovered adafruit source/.test(await recovered.file('BRICKWRIGHT-IMPORT.txt').async('string')));

        const available = await page.evaluate(async () => (await fetch('static/makecode/adafruit/target.json')).ok);
        check('the pinned CPX MakeCode runtime is present for the preserved run path', available);
        if (available) {
            await clickAction('bw-makecode-run');
            const pane = page.locator('[data-testid="bw-makecode-pane"][data-target="adafruit"]');
            await pane.waitFor({state: 'visible', timeout: 60000});
            const state = await waitFor(() => pane.locator('[data-testid="bw-makecode-state"]').innerText(),
                value => /Running|Läuft|Error|Fehler/.test(value), 60000);
            check('the CPX original still compiles and runs in its own MakeCode simulator', /Running|Läuft/.test(state), state);
            check('the CPX MakeCode run uses the real adafruit simulator frame', !!(await simFrame('adafruit')));
            await pane.locator('[data-testid="bw-makecode-stop"]').click();
        }
        await closeCodeActions(page);
        await page.getByRole('button', {name: /To blocks|Zu Blöcken/i}).first().click();
        const loaded = await waitFor(() => page.evaluate(() => {
            const vm = window.__brickwrightStore?.getState().scratchGui.vm;
            const stage = vm?.runtime.getTargetForStage();
            return {device: vm?.runtime.bwDeviceId, ops: Object.values(stage?.blocks?._blocks || {}).map(b => b.opcode)};
        }), value => value.device === 'cpx' && value.ops.includes('circuitplayground_whengesture'), 30000);
        check('CPX translated source loads the actual native CPX command and handler blocks',
            loaded.device === 'cpx' && ['circuitplayground_setall', 'circuitplayground_whenbutton',
                'circuitplayground_whengesture'].every(op => loaded.ops.includes(op)));
        await page.locator('[title="Circuit Playground"]:visible').click();
        await page.locator('[data-testid="bw-cpx-pane"]').waitFor({state: 'visible', timeout: 30000});
        const ring = () => page.locator('[data-testid^="bw-cpx-pixel-"]').evaluateAll(elements =>
            elements.map(element => element.getAttribute('fill')));
        const all = (pixels, color) => pixels.length === 10 && pixels.every(p => p === color);
        const nativeState = () => page.evaluate(() => {
            const vm = window.__brickwrightStore?.getState().scratchGui.vm;
            const rt = vm?.runtime;
            return {device: rt?.bwDeviceId, stcDevice: rt?.stc?.device,
                dock: localStorage.getItem('bw-debug-dock'),
                paneCount: document.querySelectorAll('[data-testid="bw-cpx-pane"]').length,
                ring: Array.from(document.querySelectorAll('[data-testid^="bw-cpx-pixel-"]'), e => e.getAttribute('fill')),
                board: Boolean(rt?.bwCpx), state: rt?.bwCpxState,
                threads: rt?.threads?.map(t => ({topBlock: t.topBlock, status: t.status})),
                stageOps: Object.values(rt?.getTargetForStage()?.blocks?._blocks || {}).map(b => b.opcode)};
        });
        console.log('CPX native before Start', JSON.stringify(await nativeState()));
        await page.locator('[class*="green-flag_green-flag"]').first().click();
        const red = await waitFor(ring, pixels => all(pixels, 'rgb(255, 0, 0)'), 30000);
        console.log('CPX native after Start', JSON.stringify(await nativeState()));
        check('actual native CPX Start renders all ten translated red pixels', all(red, 'rgb(255, 0, 0)'));
        if (!all(red, 'rgb(255, 0, 0)')) throw new Error('CPX native Start observation failed; original state recorded');
        await page.locator('[data-testid="bw-cpx-button-A"]').click();
        const blue = await waitFor(ring, pixels => all(pixels, 'rgb(0, 0, 255)'), 30000);
        check('actual CPX pane button A runs the translated handler and renders ten blue pixels', all(blue, 'rgb(0, 0, 255)'));
        await page.locator('[data-testid="bw-cpx-gesture-shake"]').click();
        const green = await waitFor(ring, pixels => all(pixels, 'rgb(0, 255, 0)'), 30000);
        check('actual CPX pane shake executes the expression-bodied callback and renders ten green pixels', all(green, 'rgb(0, 255, 0)'));
        await page.evaluate(() => window.__brickwrightStore.getState().scratchGui.vm.stopAll());
        await page.locator('[title="Scratch Stage"], [title="Scratch-Bühne"]').first().click();
        await page.locator('[role="tab"]', {hasText: 'Code'}).first().click();
    }

    // ── 2. an Arcade game brings its sprites ──────────────────────────
    await input.setInputFiles(join(fixtures, 'arcade-assets.hex'));
    // Both locales, because the browser's language decides which string
    // the status line uses and a CI runner is not necessarily English.
    text = await waitFor(paneText, t => /sprite\(s\)/i.test(t), 30000);
    // The general form of the bug this file already caught once: a
    // message template that grew a parameter its call site did not pass
    // renders the word "undefined" into the status line, and every other
    // check still passes.
    // Scoped to the status SENTENCE, not the whole page: somewhere in a
    // large app the word will legitimately appear, and a gate that cries
    // wolf gets ignored.
    const statusLine = (text.match(/[^\n]*sprite\(s\)[^\n]*/i) || [''])[0];
    check('no status line leaks an undefined interpolation',
        !/\bundefined\b/.test(statusLine), statusLine.replace(/\s+/g, ' ').slice(0, 140));
    // Since task E1 the game runs on the Arcade runtime: a Game sprite holds
    // the scripts, one template sprite per sprite image carries its art, named
    // after the game's variable (mySprite's is `mySprite`), and the background is
    // an image resource named `background`.
    check('an Arcade game imports as sprites and costumes',
        /5 sprite\(s\)/i.test(text) && /4 (costume\(s\)|Kostüm\(e\))/i.test(text),
        (text.match(/.{0,40}sprite\(s\).{0,40}/i) || [''])[0].replace(/\s+/g, ' '));

    const arcadeCode = await page.evaluate(() => {
        const editor = document.querySelector('.cm-content');
        return editor ? editor.innerText : '';
    });
    check('with the sprite sections the game names',
        /SPRITE Game:/.test(arcadeCode) && /SPRITE mySprite:/.test(arcadeCode) &&
        /GLOBAL mySprite/.test(arcadeCode) && /set mySprite to \(arcade create template "mySprite"/.test(arcadeCode),
        arcadeCode.split('\n').slice(0, 6).join(' / '));

    // ── 2b. …and plays in MakeCode's Arcade simulator ─────────────────
    if (runtime) {
        await clickAction('bw-makecode-run');
        const frame = await simFrame('arcade');
        const lit = frame ? await waitFor(() => frame.evaluate(() => {
            const c = document.querySelector('canvas');
            if (!c || !c.width) return 0;
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) n++;
            return n;
        }).catch(() => 0), n => n > 50, 60000) : 0;
        check('the imported Arcade game draws in MakeCode\'s Arcade simulator', lit > 50, `${lit} lit pixels`);

        // Native PXT controls must reach the running board, not merely appear.
        // Arcade's pinned Board has no CommonButtonState. Observe its native
        // event handler instead, after forwarding the untouched call. This
        // verifier never injects input or invokes the handler directly.
        await frame.evaluate(() => {
            const board = window.pxsim?.board();
            if (typeof board?.handleKeyEvent !== 'function' || !window.pxsim.Key?.A) {
                throw new Error('Arcade native key-event contract unavailable');
            }
            const original = board.handleKeyEvent;
            const own = Object.getOwnPropertyDescriptor(board, 'handleKeyEvent');
            const events = [];
            board.handleKeyEvent = function (...args) {
                const result = Reflect.apply(original, this, args);
                if (args[0] === window.pxsim.Key.A) events.push(Boolean(args[1]));
                return result;
            };
            window.bwArcadeInputProof = {events, restore: () => {
                if (own) Object.defineProperty(board, 'handleKeyEvent', own);
                else delete board.handleKeyEvent;
                delete window.bwArcadeInputProof;
            }};
        });
        const nativeEvents = () => frame.evaluate(() => window.bwArcadeInputProof.events.slice());
        const aButton = frame.locator('.button-a');
        const box = await aButton.boundingBox();
        check('PXT Arcade exposes an on-screen A control', Boolean(box && box.width >= 20 && box.height >= 20), JSON.stringify(box));
        try {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            const down = await waitFor(nativeEvents, events => events.includes(true), 5000);
            check('on-screen A presses a real PXT board button', down.includes(true), JSON.stringify(down));
            await page.mouse.up();
            const released = await waitFor(nativeEvents, events => events.indexOf(false) > events.indexOf(true), 5000);
            check('on-screen A releases the real PXT board button', released.indexOf(false) > released.indexOf(true), JSON.stringify(released));
        } finally {
            await page.mouse.up();
            await frame.evaluate(() => window.bwArcadeInputProof?.restore());
        }

        // ── 2b'. …and downloads as firmware for the board picked from pxt-arcade's own list ──
        // The picker is filled from static/makecode/arcade/hardware.json when the Arcade
        // project arrives; wait for it to be filled, never for a fixed time.
        await openCodeActions(page);
        const picker = page.locator('[data-testid="bw-makecode-arcade-board"]');
        const filled = await page.waitForFunction(
            () => Number(document.querySelector('[data-testid="bw-makecode-arcade-board"]')?.dataset.boards || 0) > 0,
            null, {timeout: 30000}).then(() => true).catch(() => false);
        check('an Arcade project offers a board picker, filled from pxt-arcade\'s hardware list', filled,
            filled ? '' : `${await picker.count()} picker(s), no boards`);
        if (filled) {
            // Adafruit PyBadge = pxt's hw---samd51adafruit, UF2 family 0x55114460 (SAMD51).
            await picker.selectOption({label: 'Adafruit PyBadge'});
            await page.waitForFunction(
                () => /samd51adafruit:/.test(document.querySelector('[data-testid="bw-makecode-arcade-board"]')?.value || ''),
                null, {timeout: 10000});
            const download = page.waitForEvent('download', {timeout: 120000});
            await clickAction('bw-makecode-firmware');
            const dl = await download.catch(() => null);
            const file = dl ? await dl.path().catch(() => null) : null;
            const uf2 = file ? await readFile(file) : Buffer.alloc(0);
            const blocks = uf2.length / 512;
            let magic = uf2.length > 0 && uf2.length % 512 === 0;
            let family = magic;
            for (let o = 0; magic && o < uf2.length; o += 512) {
                magic = uf2.readUInt32LE(o) === 0x0A324655 && uf2.readUInt32LE(o + 4) === 0x9E5D5157 && uf2.readUInt32LE(o + 508) === 0x0AB16F30;
                family = family && (uf2.readUInt32LE(o + 8) & 0x2000) !== 0 && uf2.readUInt32LE(o + 28) === 0x55114460;
            }
            check('⤓ firmware for the picked Arcade board downloads a .uf2', !!dl && /\.uf2$/.test(dl.suggestedFilename()),
                dl ? dl.suggestedFilename() : 'no download');
            check('every block carries the UF2 magics', magic, `${blocks} blocks`);
            check('and the picked board\'s UF2 family id (SAMD51, 0x55114460)', family,
                uf2.length >= 32 ? `family 0x${uf2.readUInt32LE(28).toString(16)}` : '');
        }
    }

    // ── 2c. the imported art edits AS pixels (costume tab → ▦ Pixel editor) ──
    {
        // The import only WRITES the program; its sprites and costumes exist in the
        // project once ⇦ To blocks builds it. Without this the Costumes tab shows the
        // default sprite, and "reads it exactly" would be a question about the cat.
        // Close the actual actions popup before using the editor toolbar below it.
        await closeCodeActions(page);
        await page.getByRole('button', {name: /To blocks|Zu Blöcken/i}).first().click({force: true}).catch(() => {});
        const built = await waitFor(() => page.evaluate(() => {
            const vm = window.__brickwrightStore && window.__brickwrightStore.getState().scratchGui.vm;
            return vm ? vm.runtime.targets.filter(t => !t.isStage).map(t => t.getName()) : [];
        }).catch(() => []), names => names.includes('mySprite'), 30000);
        check('⇦ To blocks builds the imported Arcade sprites',
            ['Game', 'mySprite', 'gegner', 'einfangen', 'background'].every(name => built.includes(name)), built.join(', '));
        // Edit mySprite's template, which carries its Arcade art. Selected through
        // the VM (what a click in the sprite list does): on the Costumes tab the
        // `sprite-selector-item` class also matches the COSTUME tiles, so a click by
        // name selected nothing, and the editor showed whichever sprite To blocks
        // auto-selected (the first with scripts: now Game, which has no art).
        const selected = await page.evaluate(() => {
            const vm = window.__brickwrightStore && window.__brickwrightStore.getState().scratchGui.vm;
            const target = vm && vm.runtime.targets.find(t => t.getName && t.getName() === 'mySprite');
            if (!target) return null;
            vm.setEditingTarget(target.id);
            return vm.editingTarget && vm.editingTarget.getName();
        }).catch(() => null);
        check('the imported Arcade sprite\'s template can be selected for editing', selected === 'mySprite', String(selected));
        // Its costume carries the art's name, not the creator's default costume1.
        const costumeNames = await page.evaluate(() => {
            const vm = window.__brickwrightStore && window.__brickwrightStore.getState().scratchGui.vm;
            return vm && vm.editingTarget ? vm.editingTarget.getCostumes().map(c => c.name) : [];
        }).catch(() => []);
        check('the imported art\'s costume is named after it', costumeNames[0] === 'mySprite', costumeNames.join(', '));
        const costumesTab = page.locator('[role="tab"]', {hasText: /Costumes|Kostüme/}).first();
        if (await costumesTab.count()) {
            await costumesTab.click();
            // A crash here would be the paint editor itself on the imported costume, not the toggle.
            const tabErrors = browserErrors.filter(e => /Costume Tab/.test(e)).length;
            check('the costume tab opens on an imported Arcade sprite without crashing', tabErrors === 0,
                tabErrors ? browserErrors.filter(e => /Costume Tab/.test(e))[0].slice(0, 140) : '');
            await page.locator('[data-testid="bw-pixel-toggle"]').click({timeout: 20000}).catch(() => {});
            const canvas = page.locator('[data-testid="bw-pixel-canvas"]');
            await canvas.waitFor({state: 'visible', timeout: 20000}).catch(() => {});
            const cells = await canvas.evaluate(c => {
                if (!c.width) return 0;
                const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
                let coloured = 0;
                for (let i = 0; i < d.length; i += 4) {
                    const grey = Math.abs(d[i] - d[i + 1]) < 8 && Math.abs(d[i + 1] - d[i + 2]) < 8;
                    if (!grey) coloured++;
                }
                return coloured;
            }).catch(() => 0);
            check('the costume tab\'s pixel editor opens an imported Arcade costume as palette pixels', cells > 0, `${cells} coloured canvas pixels`);
            const toggleErrors = browserErrors.filter(e => /Costume Tab/.test(e)).length - tabErrors;
            check('switching to the pixel editor does not crash the tab', toggleErrors === 0,
                toggleErrors ? 'the paint editor was torn down mid-import' : '');
            const converted = await page.locator('text=/was not pixel art|keine Pixelgrafik/').count();
            check('and reads it exactly, not by conversion', converted === 0);
            await page.locator('[role="tab"]', {hasText: 'Code'}).first().click();
        } else {
            check('a Costumes tab exists', false);
        }
    }

    // ── 2d. …and the Scratch project it became goes BACK to Arcade and plays ──
    // After 2c pressed ⇦ To blocks, so this exports the IMPORTED game's sprites;
    // run before it, it exported the default project and passed for the wrong reason.
    if (runtime) {
        await clickAction('bw-makecode-arcade-run');
        const frame = await simFrame('arcade');
        const lit = frame ? await waitFor(() => frame.evaluate(() => {
            const c = document.querySelector('canvas');
            if (!c || !c.width) return 0;
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) n++;
            return n;
        }).catch(() => 0), n => n > 20, 60000) : 0;
        check('▶ Run as MakeCode Arcade: the live Scratch project exports, compiles and draws', lit > 20, `${lit} lit pixels`);
    }

    // ── 2d'. F10: the imported original travels with the project and is what ⤓ exports, until an edit ──
    // After 2d, so the run above exported the untouched game. Needs no MakeCode runtime:
    // the export writes a .mkcd (JSON) without compiling.
    {
        const vmRecord = () => page.evaluate(() => {
            const vm = window.__brickwrightStore && window.__brickwrightStore.getState().scratchGui.vm;
            const r = vm && vm.runtime.bwMakeCode;
            return r ? {target: r.target, fingerprint: r.fingerprint, main: r.files && r.files['main.ts']} : null;
        }).catch(() => null);
        const exportedMain = async () => {
            const download = page.waitForEvent('download', {timeout: 60000});
            await clickAction('bw-makecode-arcade-export').catch(() => {});
            const dl = await download.catch(() => null);
            const path = dl ? await dl.path().catch(() => null) : null;
            if (!path) return null;
            try {
                const parsed = JSON.parse(await readFile(path, 'utf8'));
                const files = typeof parsed.source === 'string' ? JSON.parse(parsed.source) : parsed.source;
                return files && typeof files['main.ts'] === 'string' ? files['main.ts'] : null;
            } catch (e) {
                return null;
            }
        };
        const imported = await vmRecord();
        check('⇦ To blocks keeps the imported MakeCode files in the project, fingerprinted (F10)',
            !!imported && imported.target === 'arcade' && /^[0-9a-f]{16}$/.test(imported.fingerprint || '') &&
                /sprites\.create/.test(imported.main || ''),
            JSON.stringify(imported && {target: imported.target, fingerprint: imported.fingerprint}));
        // Save and reopen through the real .sb3 (zip) path; the record must come back from the file.
        const reopened = await page.evaluate(async () => {
            const vm = window.__brickwrightStore && window.__brickwrightStore.getState().scratchGui.vm;
            if (!vm) return null;
            const sb3 = await (await vm.saveProjectSb3()).arrayBuffer();
            vm.runtime.bwMakeCode = null;
            await vm.loadProject(sb3);
            const r = vm.runtime.bwMakeCode;
            return r ? {fingerprint: r.fingerprint, main: r.files && r.files['main.ts']} : null;
        }).catch(e => ({error: String(e)}));
        check('the saved .sb3 carries the original files back on reopen (F10)',
            !!imported && !!reopened && reopened.main === imported.main && reopened.fingerprint === imported.fingerprint,
            reopened && reopened.error ? reopened.error : '');
        const unchangedExport = await exportedMain();
        check('⤓ Arcade export of the unchanged project writes the original main.ts byte for byte (F10)',
            !!imported && unchangedExport === imported.main,
            unchangedExport === null ? 'no .mkcd downloaded' : `${unchangedExport.length} chars`);
        // Edit the program: delete one script's top block. The original stays for reference,
        // but no longer describes the program, so the export must come from the blocks.
        const edited = await page.evaluate(() => {
            const vm = window.__brickwrightStore && window.__brickwrightStore.getState().scratchGui.vm;
            const target = vm && vm.runtime.targets.find(t => !t.isStage &&
                Object.values(t.blocks._blocks).some(b => b.topLevel && !b.shadow));
            if (!target) return null;
            const top = Object.values(target.blocks._blocks).find(b => b.topLevel && !b.shadow);
            target.blocks.deleteBlock(top.id);
            vm.runtime.emitProjectChanged();
            return {kept: !!JSON.parse(vm.toJSON()).bwMakeCode, sprite: target.getName()};
        }).catch(() => null);
        check('after a block edit the original is still saved, for reference (F10)', !!edited && edited.kept,
            edited ? `edited ${edited.sprite}` : 'no sprite with scripts');
        const editedExport = await exportedMain();
        check('⤓ Arcade export after the edit comes from the blocks, not the stale original (F10)',
            typeof editedExport === 'string' && editedExport.length > 0 && !!imported && editedExport !== imported.main,
            editedExport === null ? 'no .mkcd downloaded' : `${editedExport.length} chars`);
    }

    // ── 2e. a LEGO MINDSTORMS EV3 program runs in MakeCode's EV3 simulator ──
    if (runtime) {
        await input.setInputFiles(join(fixtures, 'ev3-button-events.uf2'));
        await waitFor(paneText, t => /ev3|EV3/.test(t), 30000);
        await clickAction('bw-makecode-run');
        const pane = page.locator('[data-testid="bw-makecode-pane"][data-target="ev3"]');
        await pane.waitFor({state: 'visible', timeout: 60000}).catch(() => {});
        check('an imported EV3 program opens MakeCode\'s EV3 simulator', await pane.count() > 0);
        const frame = await simFrame('ev3');
        const drawn = frame ? await waitFor(() => frame.evaluate(() => document.querySelectorAll('svg *').length).catch(() => 0),
            n => n > 20, 60000) : 0;
        check('and the brick is drawn', drawn > 20, `${drawn} svg elements`);
    }

    // ── 2f. two boards in one program run side by side and share one radio ──
    // The tutorial pair (a micro:bit remote, a Calliope mini car) as one program
    // with two board sections. This is the only place the multi-board pane is
    // rendered by the real build: its unit tests build the boards, and
    // verify-multi-board-radio.mjs drives the simulator host pages from a
    // plain page.
    if (runtime) {
        // State, not just event: the one-board program of 2e is still on screen,
        // and a one-board program must not get the multi-board pane.
        const multi = page.locator('[data-testid="bw-makecode-multi-pane"]');
        check('a one-board program runs without the multi-board pane', await multi.count() === 0);
        await input.setInputFiles(join(root, 'test', 'fixtures', 'multi-board', 'radio-pair.bw'));
        const pairCode = await waitFor(
            () => page.evaluate(() => {
                const editor = document.querySelector('.cm-content') || document.querySelector('textarea');
                return editor ? (editor.innerText || editor.value || '') : '';
            }),
            t => /AS Remote:/.test(t) && /AS Car:/.test(t), 20000);
        check('a program with two board sections opens in the Code tab',
            /AS Remote:/.test(pairCode) && /AS Car:/.test(pairCode), pairCode.split('\n').slice(0, 2).join(' / '));
        await clickAction('bw-makecode-run');
        await multi.waitFor({state: 'visible', timeout: 90000}).catch(() => {});
        const shown = await page.locator('[data-testid="bw-makecode-board"]').evaluateAll(
            els => els.map(e => `${e.dataset.board}:${e.dataset.target}`)).catch(() => []);
        check('▶ Run opens one simulator per board, each for its own target',
            shown.join(' ') === 'Remote:microbit Car:calliopemini', shown.join(' ') || 'no multi-board pane');
        const remote = await simFrame('microbit');
        const car = await simFrame('calliopemini');
        check('both simulator frames exist', !!remote && !!car);
        if (remote && car) {
            const press = (button, down) => remote.evaluate(([b, d]) => {
                pxsim.board().buttonPairState[b].pressed = d; // eslint-disable-line no-undef
            }, [button, down]).catch(() => {});
            const motors = () => page.evaluate(() => {
                const read = m => document.querySelector(`[data-testid="bw-makecode-motor-${m}"]`)?.dataset.power;
                return `A=${read('A')} B=${read('B')}`;
            });
            // The remote sends on every loop, so the car's first motor report arrives unprompted.
            const idle = await waitFor(motors, t => t === 'A=0 B=0', 45000);
            check('the car reports its motors, both stopped, with no button held', idle === 'A=0 B=0', idle);
            await press('aBtn', true);
            const held = await waitFor(motors, t => t === 'A=50 B=0', 20000);
            check('holding A on the remote drives the car\'s motor A over the radio', held === 'A=50 B=0', held);
            await press('aBtn', false);
            const released = await waitFor(motors, t => t === 'A=0 B=0', 20000);
            check('releasing A stops it', released === 'A=0 B=0', released);
        }
    }

    // ── 3. a file with nothing in it says so, rather than failing ─────
    await input.setInputFiles(join(fixtures, 'README.md'));
    text = await waitFor(paneText, t => /README/.test(t), 15000);
    check('a file that is not a MakeCode artefact is refused in words',
        /Don't know that file type|Unbekannter Dateityp/.test(text));
} catch (err) {
    if (!/skip the rest/.test(String(err && err.message))) throw err;
} finally {
    await browser.close();
    if (server) server.close();
}

if (failures.length) {
    console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`);
    process.exit(1);
}
console.log('\nMakeCode import verified in the browser.');
