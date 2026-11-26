#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
/**
 * Full Brickwright browser acceptance for the Busch Microtronic in Circuits.
 *
 * Usage:
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
 *     node scripts/verify-microtronic-circuit.mjs http://127.0.0.1:8242/
 *
 * This visits the real host and uses its palette, panel, switch controls and
 * File menu. Production diagnostic hooks are read only. It never imports a
 * model into the browser, installs a harness, advances Board time, or changes
 * device state through a test-only API. Instruction semantics have their own
 * engine tests; this gate verifies their installed application path.
 */
import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {access, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const targetURL = process.argv[2] || process.env.BW_MICROTRONIC_URL ||
    process.env.PROOF_URL || 'http://127.0.0.1:8242/';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.BW_CHROMIUM_EXECUTABLE || undefined;
const output = path.resolve(process.env.BW_MICROTRONIC_BROWSER_OUT || 'artifacts/microtronic-circuit');
const expectedKeys = [
    'C', 'D', 'E', 'F', 'NEXT', 'REG',
    '8', '9', 'A', 'B', 'BKP', 'STEP',
    '4', '5', '6', '7', 'RUN', 'HALT',
    '0', '1', '2', '3', 'C/CE', 'PGM'
];
const checks = [];
const pageErrors = [];
const failedRequests = [];
let browser;
let page;

await mkdir(output, {recursive: true});

const pass = (name, detail = undefined) => {
    checks.push({name, ...(detail === undefined ? {} : {detail})});
    console.log(`PASS ${name}`);
};

const readDownload = async download => {
    assert.equal(await download.failure(), null, 'Circuit file download must finish successfully');
    const stream = await download.createReadStream();
    assert.ok(stream, 'Circuit file download must expose actual bytes');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
};

// These are the production diagnosis hooks set by CircuitTab.onCircuitReady
// and onBoardReady, not the standalone designer's __setCircuitData harness.
const snapshot = id => page.evaluate(partId => {
    const circuit = window.__circuit;
    const board = circuit?.board;
    const state = board?.getDeviceState?.(partId);
    if (!state) return null;
    return {
        id: partId, sameBoard: window.__board === board,
        tNs: String(board.getTime()), pc: state.pc, running: state.running,
        input: state.input, output: state.output, clockHigh: state.clockHigh,
        executed: state.executed, display: state.display, error: state.error,
        program: [...state.program], registers: [...state.registers],
        source: circuit.getPart(partId)?.params?.program,
        wireCount: circuit.wires.length,
        leds: ['lamp1', 'lamp2', 'lamp3', 'lamp4'].map(id => board.ledBrightness(id))
    };
}, id);

const waitForProgram = async (id, expected) => {
    await page.waitForFunction(({id, expected}) => {
        const circuit = window.__circuit;
        const board = circuit?.board;
        const state = board?.getDeviceState?.(id);
        return window.__board === board && state &&
            Object.entries(expected).every(([key, value]) => state[key] === value);
    }, {id, expected});
};

const waitForElapsed = async (startNs, elapsedNs) => {
    await page.waitForFunction(({startNs, elapsedNs}) => {
        const board = window.__circuit?.board;
        return board && board.getTime() >= BigInt(startNs) + BigInt(elapsedNs);
    }, {startNs, elapsedNs: String(elapsedNs)});
};

const saveCircuit = async () => {
    await page.getByText('File', {exact: true}).first().click();
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByText('Save circuit', {exact: true}).click()
    ]);
    assert.equal(download.suggestedFilename(), 'circuit.json');
    return readDownload(download);
};

try {
    if (executablePath) await access(executablePath, constants.X_OK);
    browser = await chromium.launch({headless: true, executablePath});
    page = await browser.newPage({
        viewport: {width: 1480, height: 1000}, locale: 'en-US',
        serviceWorkers: 'block', acceptDownloads: true
    });
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => pageErrors.push(String(error)));
    page.on('requestfailed', request => failedRequests.push({
        url: request.url(), error: request.failure()?.errorText
    }));
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => {
        // A new browser context is used, so these are only this test's stores.
        localStorage.setItem('bw-starter-v1-complete', '1');
    });
    console.log(`Opening full Brickwright host: ${targetURL}`);
    await page.goto(targetURL, {waitUntil: 'commit', timeout: 120000});
    const circuitTab = page.getByRole('tab', {name: 'Circuit', exact: true});
    await circuitTab.waitFor({state: 'visible', timeout: 120000});
    assert.ok(await page.getByRole('tab', {name: 'Code', exact: true}).count(),
        'This gate requires the full Brickwright host, not a standalone CircuitDesigner harness');
    await circuitTab.click();
    const designer = page.locator('.bw-circuit-designer:visible').last();
    await designer.waitFor({state: 'visible', timeout: 120000});
    const palette = page.locator('[data-parts-palette]:visible').first();
    await palette.getByRole('textbox').first().fill('microtronic');
    const card = palette.locator('[data-palette-kind="busch-microtronic"]').first();
    await card.scrollIntoViewIfNeeded();
    const art = await card.locator('img').elementHandle();
    assert.ok(art, 'The installed palette must include the Microtronic artwork');
    await page.waitForFunction(image => image.complete && image.naturalWidth > 0, art);
    await card.click();
    // Palette cards arm a placement ghost; a real canvas click commits it.
    await designer.locator('[data-canvas]').click({position: {x: 400, y: 150}});
    let panel = page.locator('[data-microtronic-panel]:visible').first();
    await panel.waitFor();
    const firstId = await panel.getAttribute('data-microtronic-panel');
    assert.ok(firstId);
    await page.waitForFunction(id => Boolean(window.__circuit?.board?.getDeviceState?.(id)), firstId);
    assert.deepEqual(await panel.locator('[data-microtronic-key]').allTextContents(), expectedKeys);
    const placed = await snapshot(firstId);
    assert.equal(placed.sameBoard, true, 'The panel must observe the host-owned circuit Board');
    pass('Full host palette places the Microtronic with its 24-key front panel');

    await panel.getByRole('textbox', {name: 'Microtronic program', exact: true})
        .fill('00: 1A0\n01: FE0\n02: F00');
    await panel.locator('[data-microtronic-action="run"]').click();
    await waitForProgram(firstId, {output: 10, pc: 2, running: false});
    assert.equal(await panel.locator('[data-microtronic-bit="OUT2"]').getAttribute('data-high'), 'true');
    assert.equal(await panel.locator('[data-microtronic-bit="OUT4"]').getAttribute('data-high'), 'true');
    pass('Run applies the visible program draft and executes it on the installed engine');

    const accepted = (await snapshot(firstId)).source;
    await panel.getByRole('textbox', {name: 'Microtronic program', exact: true}).fill('00: WRONG');
    await panel.locator('[data-microtronic-load]').click();
    await panel.getByRole('alert').waitFor();
    assert.equal((await snapshot(firstId)).source, accepted, 'Invalid text must not replace the accepted program');
    await panel.getByLabel('Microtronic program file', {exact: true}).setInputFiles({
        name: 'microtronic-echo.mic', mimeType: 'text/plain', buffer: Buffer.from('FD0\nFE0\nC00')
    });
    await page.waitForFunction(id => document.querySelector(
        `[data-microtronic-panel="${id}"] textarea`)?.value === 'FD0\nFE0\nC00', firstId);
    await panel.locator('[data-microtronic-load]').click();
    assert.equal(await panel.getByRole('alert').count(), 0);
    pass('Program file input works and an invalid draft leaves the accepted program intact');

    await panel.getByRole('button', {name: 'Open wired I/O example', exact: true}).click();
    panel = page.locator('[data-microtronic-panel="microtronic"]:visible');
    await panel.waitFor();
    await page.waitForFunction(() => window.__circuit?.board?.getDeviceState?.('microtronic'));
    const example = await snapshot('microtronic');
    assert.equal(example.wireCount, 25, 'The example must load all switch, LED and CLOCK wires');
    await panel.locator('[data-microtronic-action="run"]').click();
    await page.locator('[data-switch-control="input1"]').click();
    await page.locator('[data-switch-control="input3"]').click();
    await page.waitForFunction(() => {
        const board = window.__circuit?.board, state = board?.getDeviceState('microtronic');
        const faces = [...document.querySelectorAll('.bw-circuit-designer wokwi-led')];
        return state?.running && (state.input & 7) === 5 && (state.output & 7) === 5 &&
            board.ledBrightness('lamp1') > 0.01 && board.ledBrightness('lamp2') <= 0.01 &&
            board.ledBrightness('lamp3') > 0.01 && faces.length === 4 &&
            Boolean(faces[0].value) && !faces[1].value && Boolean(faces[2].value);
    });
    pass('Visible switch contacts drive IN1/IN3 through the drawn circuit and light external LED faces');
    const clockPhases = [];
    for (const outputValue of [13, 5]) {
        await page.waitForFunction(value => {
            const state = window.__circuit?.board?.getDeviceState('microtronic');
            return state?.output === value && state.input === value && state.clockHigh === Boolean(value & 8);
        }, outputValue);
        const observed = await snapshot('microtronic');
        clockPhases.push({output: observed.output, input: observed.input, clockHigh: observed.clockHigh, tNs: observed.tNs});
    }
    pass('Independent CLOCK reaches IN4 and changes OUT4 through the loaded echo program', clockPhases);
    await page.locator('[data-switch-control="input1"]').click();
    await page.waitForFunction(() => {
        const board = window.__circuit?.board, state = board?.getDeviceState('microtronic');
        const faces = [...document.querySelectorAll('.bw-circuit-designer wokwi-led')];
        return state?.running && (state.output & 7) === 4 && board.ledBrightness('lamp1') <= 0.01 &&
            board.ledBrightness('lamp3') > 0.01 && faces.length === 4 && !faces[0].value && Boolean(faces[2].value);
    });
    pass('Opening a physical switch removes its input and extinguishes the corresponding external LED');
    // Switch controls sit below the panel in the independently scrolling rail.
    // Restore the whole front panel before capturing the circuit for review.
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({path: path.join(output, 'wired-experiment.png'), fullPage: true});

    await panel.locator('[data-microtronic-action="halt"]').click();
    const halted = await snapshot('microtronic');
    assert.equal(halted.running, false);
    await waitForElapsed(halted.tNs, 600_000_000n);
    const held = await snapshot('microtronic');
    assert.equal(held.pc, halted.pc, 'Halt retains the program counter while the circuit keeps running');
    assert.equal(held.output, halted.output, 'Halt retains the output latch');
    await panel.locator('[data-microtronic-action="step"]').click();
    const stepped = await snapshot('microtronic');
    assert.notEqual(stepped.pc, halted.pc);
    assert.equal(stepped.running, false);
    await panel.locator('[data-microtronic-action="reset"]').click();
    const reset = await snapshot('microtronic');
    assert.equal(reset.pc, 0);
    assert.equal(reset.output, 0);
    assert.equal(reset.running, false);
    assert.deepEqual(reset.program, halted.program, 'Reset must retain all loaded program words');
    assert.ok(BigInt(reset.tNs) >= BigInt(stepped.tNs), 'Resetting the computer must not rewind the shared circuit clock');
    pass('Halt, Step and Reset operate on the computer while preserving the independent circuit clock');

    for (const key of ['HALT', 'NEXT', '0', '5', '1', 'A', '2', 'NEXT']) {
        await panel.locator(`[data-microtronic-key="${key}"]`).click();
    }
    const keyed = await snapshot('microtronic');
    assert.equal(keyed.program[5], 0x1A2);
    assert.match(keyed.source, /05: 1A2/);
    pass('Physical keypad NEXT commits a word into both the running model and the saved circuit source');

    const draft = '00: 1B0\n01: FE0\n02: F00';
    await panel.getByRole('textbox', {name: 'Microtronic program', exact: true}).fill(draft);
    const beforeDraftTick = await snapshot('microtronic');
    await waitForElapsed(beforeDraftTick.tNs, 300_000_000n);
    assert.equal(await panel.getByRole('textbox', {name: 'Microtronic program', exact: true}).inputValue(), draft);
    await panel.locator('[data-microtronic-action="run"]').click();
    await waitForProgram('microtronic', {output: 11, pc: 2, running: false});
    pass('Unloaded editor text survives live rerenders and Run executes the retained draft');

    const savedBytes = await saveCircuit();
    const saved = JSON.parse(savedBytes.toString('utf8'));
    const savedPart = saved.parts.find(part => part.id === 'microtronic');
    assert.equal(savedPart?.kind, 'busch-microtronic');
    assert.match(savedPart.params.program, /00: 1B0/);
    assert.equal(saved.wires.length, 25);
    await writeFile(path.join(output, 'saved-circuit.json'), savedBytes);
    await panel.getByRole('textbox', {name: 'Microtronic program', exact: true}).fill('F00');
    await panel.locator('[data-microtronic-load]').click();
    assert.equal((await snapshot('microtronic')).program[0], 0xF00, 'The load check must restore a genuinely different program');
    await page.getByText('File', {exact: true}).first().click();
    const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByText('Open circuit…', {exact: true}).click()
    ]);
    await chooser.setFiles({name: 'microtronic-round-trip.json', mimeType: 'application/json', buffer: savedBytes});
    await page.waitForFunction(source => {
        const circuit = window.__circuit, state = circuit?.board?.getDeviceState('microtronic');
        return state?.program[0] === 0x1B0 && state.output === 0 && !state.running &&
            circuit.getPart('microtronic')?.params?.program === source;
    }, savedPart.params.program);
    panel = page.locator('[data-microtronic-panel="microtronic"]:visible');
    await panel.locator('[data-microtronic-action="run"]').click();
    await waitForProgram('microtronic', {output: 11, pc: 2, running: false});
    pass('The real File menu saves and reopens the wired circuit with its accepted program, which runs again');
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({path: path.join(output, 'round-trip-program.png'), fullPage: true});

    assert.deepEqual(pageErrors, [], 'The complete application flow must not throw browser page errors');
    const result = {
        status: 'passed', targetURL, browser: browser.version(), executablePath,
        fullApplicationBuild: true,
        scope: 'Installed Brickwright Circuit tab; real palette, learner program, switch/LED nets, shared clock and File menu',
        checks, pageErrors, failedRequests
    };
    await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
} catch (error) {
    const diagnostic = page ? await page.evaluate(() => ({
        title: document.title,
        alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent),
        panels: [...document.querySelectorAll('[data-microtronic-panel]')].map(node => ({
            id: node.getAttribute('data-microtronic-panel'), text: node.textContent
        })),
        boardTime: window.__circuit?.board ? String(window.__circuit.board.getTime()) : null,
        parts: window.__circuit?.parts?.map(part => ({id: part.id, kind: part.kind}))
    })).catch(() => null) : null;
    if (page) await page.screenshot({path: path.join(output, 'failure.png'), fullPage: true}).catch(() => {});
    await writeFile(path.join(output, 'failure.json'), JSON.stringify({
        status: 'failed', targetURL, executablePath, error: String(error.stack || error),
        checks, pageErrors, failedRequests, diagnostic
    }, null, 2) + '\n');
    throw error;
} finally {
    await browser?.close();
}
