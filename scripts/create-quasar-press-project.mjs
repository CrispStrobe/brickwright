// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Adafruit 1143 micro-servo A indexes the rotary dial plate while linear
// sliders B (stamping ram) and C (ejector wiper) stamp and clear the blank.
export const CAD_QUASAR_PRESS_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run motor A for 90 degrees at 120 degrees per second
  cad run slider B for -10 mm at 40 mm per second
  cad run slider B for 10 mm at 40 mm per second
  cad run slider C for 24 mm at 60 mm per second
  cad run slider C for -24 mm at 60 mm per second
  cad stop motor A brake
  cad stop slider B brake
  cad stop slider C brake
  cad stop
`;

/**
 * Package a Quasar 3-axis rotary press CAD document and its Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createQuasarPressProject(documentText) {
    const document = parseDocument(documentText);
    const dial = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === 'A');
    if (!dial || !dial.limits) {
        throw new Error('Quasar press requires an angular dial servo with limits at port A');
    }
    for (const port of ['B', 'C']) {
        const slider = document.joints?.find(item => item.kind === 'slider' && item.control?.port === port);
        if (!slider || !slider.limits) {
            throw new Error(`Quasar press requires a linear slider with limits at port ${port}`);
        }
    }
    const creator = new SB3Creator();
    creator.parse(CAD_QUASAR_PRESS_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/quasar-press-program.txt', CAD_QUASAR_PRESS_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-quasar-press-project.mjs <quasar-press.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/quasar-press');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createQuasarPressProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'quasar-press.bcad': documentText,
        'quasar-press.sb3': project,
        'quasar-press-program.txt': CAD_QUASAR_PRESS_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-quasar-press-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'rotary indexing dial servo',
            B: 'vertical stamping ram slider',
            C: 'horizontal ejector wiper slider'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'quasar-press.sb3')} with its CAD model, A/B/C press program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
