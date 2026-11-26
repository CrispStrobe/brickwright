#!/usr/bin/env node
/** Browser proof: imported controlled sources reach Instruments and round-trip. */
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const proofUrl = process.env.PROOF_URL || 'https://crispstrobe.github.io/brickwright-lite/';
const outDir = path.resolve(process.env.PROOF_DIR || 'artifacts/circuit-operating-point');
const mutation = process.env.BW_OP_BROWSER_MUTATION || '';
const originalDeck = `Self-authored ideal controlled-source operating point
V1 ctl 0 DC 1
E1 eout 0 ctl 0 2
R1 eout 0 1k
G1 gout 0 ctl 0 1m
R2 gout 0 1k
.op
.end
`;
const inputDeck = mutation === 'reverse-g'
    ? originalDeck.replace('G1 gout 0 ctl 0 1m\n', 'G1 0 gout ctl 0 1m\n')
    : originalDeck;

await mkdir(outDir, {recursive: true});
const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 900}, acceptDownloads: true});
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));

const importSpice = async (designer, name, body) => {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-circuit-file', {
        detail: {action: 'import'}
    })));
    const dialog = designer.locator('[data-host-file-command]');
    await dialog.waitFor({state: 'visible', timeout: 10000});
    const chooserPromise = page.waitForEvent('filechooser', {timeout: 10000});
    await dialog.locator('[data-import-format="spice"]').click();
    const chooser = await chooserPromise;
    await chooser.setFiles({name, mimeType: 'text/plain', buffer: Buffer.from(body)});
    await page.locator('[data-transfer-report][data-transfer-kind="import"]').waitFor({state: 'visible', timeout: 10000});
    const report = page.locator('[data-transfer-report][data-transfer-kind="import"]');
    const tone = await report.getAttribute('data-transfer-tone');
    const text = await report.innerText();
    if (tone !== 'info' || !/6 parts, 11 connections \(spice\)/.test(text)) {
        throw new Error(`SPICE import was not lossless: tone=${tone} ${text}`);
    }
    await report.locator('[data-transfer-report-close]').click();
    await report.waitFor({state: 'hidden', timeout: 5000});
};

const runOperatingPoint = async designer => {
    const expand = designer.getByRole('button', {name: 'Expand instruments panel'});
    if (await expand.count()) await expand.click({force: true});
    const sim = designer.getByRole('radio', {name: 'Sim mode'});
    await sim.click({force: true});
    await designer.getByText('Circuit analysis', {exact: true}).click();
    const run = designer.getByTestId('bw-operating-point-run');
    await run.scrollIntoViewIfNeeded();
    await run.click();
    const result = designer.getByTestId('bw-operating-point-result');
    await result.waitFor({state: 'visible', timeout: 10000});
    const text = await result.innerText();
    for (const expected of [
        // Descriptor snapshot of bw-board's solver device coverage. Grew when the
        // bw-board pin bump (a031fbea) pulled in the NPN level-1 / NMOS / PMOS
        // small-signal model work (already green on bw-board master): the list
        // gained z-q-m and the -z-npn-level1-nmos-pmos suffix. Grew again on the
        // bump to 00af429e, which admitted the LED operating point (bw-board
        // 157caed0 — mna.js already treats led and diode as one junction, and
        // operatingPoint() now stops refusing 'led' by kind): the device list
        // gained -led- after r-c-l-d, and the model list gained -led- after
        // shockley-d. The numeric currents below are unchanged, so the physics of
        // this controlled-source circuit (which has no LED) is intact.
        /Converged — grounded-static-native-r-c-l-d-led-z-q-m-v-i-e-g-exact-ideal-l-explicit-shockley-d-led-z-npn-level1-nmos-pmos/,
        /controlled sources: ideal-explicit-finite-parameters-only/i,
        /supported kinds:.*vcvs.*vccs/i,
        /G1\.outn: 0\.00100000 A/,
        /R2\.a: -0\.00100000 A/,
    ]) {
        if (!expected.test(text)) throw new Error(`operating-point result misses ${expected}: ${text}`);
    }
    return text;
};

let result;
try {
    await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('bw-starter-v1-complete', '1');
        sessionStorage.clear();
    });
    await page.goto(proofUrl, {waitUntil: 'domcontentloaded', timeout: 60000});
    await page.getByRole('tab', {name: /Circuit/}).click();
    const designer = page.locator('.bw-circuit-designer:visible').last();
    await designer.waitFor({state: 'visible', timeout: 60000});

    await importSpice(designer, 'controlled-op.cir', inputDeck);
    const before = await runOperatingPoint(designer);

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('bw-circuit-file', {
        detail: {action: 'export'}
    })));
    const exportDialog = designer.locator('[data-host-file-command]');
    await exportDialog.waitFor({state: 'visible', timeout: 10000});
    const [download] = await Promise.all([
        page.waitForEvent('download', {timeout: 10000}),
        exportDialog.locator('[data-export-format="spice"]').click(),
    ]);
    if (download.suggestedFilename() !== 'circuit.cir') {
        throw new Error(`wrong SPICE export filename: ${download.suggestedFilename()}`);
    }
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const exported = Buffer.concat(chunks).toString('utf8');
    for (const card of ['E1 ', 'G1 ']) {
        if (!exported.includes(card)) throw new Error(`export omitted ${card.trim()} card: ${exported}`);
    }

    await importSpice(designer, 'roundtrip.cir', exported);
    const after = await runOperatingPoint(designer);
    if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join(' | ')}`);

    result = {
        url: proofUrl,
        importedParts: 6,
        controlledSources: 2,
        signedCurrent: {source: 'G1.outn', amperes: 0.001, load: 'R2.a', loadAmperes: -0.001},
        exportedBytes: Buffer.byteLength(exported),
        roundTrip: true,
        mutation: mutation || null,
        beforeLines: before.split('\n').length,
        afterLines: after.split('\n').length,
    };
    await writeFile(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
    await page.screenshot({path: path.join(outDir, 'controlled-source-op.png'), fullPage: true});
    console.log(JSON.stringify(result));
} catch (error) {
    await page.screenshot({path: path.join(outDir, 'failure.png'), fullPage: true}).catch(() => {});
    await writeFile(path.join(outDir, 'page-errors.txt'), `${pageErrors.join('\n')}\n`).catch(() => {});
    throw error;
} finally {
    await browser.close();
}
