// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {openCodeActions, closeCodeActions} from './lib-code-actions.mjs';
import {typeIntoEditor} from './lib/type-into-editor.mjs';

const url = process.argv[2];
assert.ok(url, 'Pass the URL of the assembled Brickwright frontend');
const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1800, height: 1000}, acceptDownloads: true,
    locale: 'en-US', serviceWorkers: 'block'});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
    localStorage.setItem('bw-starter-v1-complete', '1');
    const proof = window.picoSerialProof = {ports: 0, baud: [], commands: [], closes: 0};
    Object.defineProperty(navigator, 'serial', {value: {
        async requestPort () {
            proof.ports++;
            const enc = new TextEncoder();
            const decoder = new TextDecoder();
            let readSide;
            let input = '';
            return {
                async open ({baudRate}) {
                    proof.baud.push(baudRate);
                    this.readable = new ReadableStream({start (controller) { readSide = controller; }});
                    this.writable = new WritableStream({write (bytes) {
                        input += decoder.decode(bytes, {stream: true});
                        if (!input.endsWith('\r')) return;
                        const command = input.slice(0, -1);
                        input = '';
                        proof.commands.push(command);
                        const response = command === 'RUN' ? 'RUN\r\n? ' :
                            command === '21' ? '21\r\n42\r\n> ' : command + '\r\n> ';
                        readSide.enqueue(enc.encode(response));
                    }});
                    proof.boot = () => readSide.enqueue(enc.encode("Stefan's Basic 2.0\r\n> "));
                },
                async close () { proof.closes++; }
            };
        }
    }});
});

try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.getByRole('tab', {name: 'Code', exact: true}).click();
    await openCodeActions(page);
    await page.getByTestId('bw-device-select-menu').selectOption('pico');
    await closeCodeActions(page);
    await page.getByTestId('bw-lang-row').getByRole('button', {name: '📺 BAS', exact: true}).click();
    await page.getByTestId('bw-basic-profile').selectOption('pico-stefan');
    await typeIntoEditor(page, '10 INPUT A\n20 PRINT A*2');
    await openCodeActions(page);
    const downloaded = page.waitForEvent('download');
    await page.getByTestId('bw-pico-basic-download').click();
    const uf2 = await downloaded;
    assert.equal(uf2.suggestedFilename(), 'stefan-basic-rp2040.uf2');
    const bytes = await readFile(await uf2.path());
    assert.equal(bytes.readUInt32LE(0), 0x0a324655);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),
        '86343f53953f958d3aa3cc29b4035d15cbf05b336b5cb1e787dfc8b15be72a73');
    assert.equal(await page.evaluate(() => window.picoSerialProof.ports), 0);
    await openCodeActions(page);
    await page.getByTestId('bw-pico-basic-hardware-send').click();
    const terminal = page.getByTestId('bw-picobb-terminal');
    const rows = terminal.locator('.xterm-rows');
    await rows.getByText(/^Reset the Pico now/).waitFor();
    assert.deepEqual(await page.evaluate(() => window.picoSerialProof.commands), []);
    await page.evaluate(() => window.picoSerialProof.boot());
    await rows.getByText('?', {exact: true}).waitFor();
    await terminal.locator('textarea').focus();
    await page.keyboard.type('21');
    await page.keyboard.press('Enter');
    await rows.getByText('42', {exact: true}).waitFor();
    const proof = await page.evaluate(() => window.picoSerialProof);
    assert.deepEqual(proof.baud, [9600]);
    assert.deepEqual(proof.commands, ['NEW', '10 INPUT A', '20 PRINT A*2', 'RUN', '21']);
    await openCodeActions(page);
    await page.getByTestId('bw-pico-basic-disconnect').click();
    await terminal.waitFor({state: 'detached'});
    await page.waitForFunction(() => window.picoSerialProof.closes === 1);
    assert.deepEqual(errors, []);
    console.log('The Pico UF2 downloaded with the pinned checksum, and the Code and Controller serial controls passed.');
} finally {
    await browser.close();
}
