// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Linear trolley slider A (X) and hoist slider B (Z) position the crane over the crate
// while Adafruit 1143 swivel servo C rotates the spreader paddle to sweep the cargo crate.
export const CAD_HERMES_CRANE_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run slider B for -12 mm at 40 mm per second
  cad run slider A for 24 mm at 50 mm per second
  cad run motor C for 60 degrees at 120 degrees per second
  cad run slider B for 12 mm at 40 mm per second
  cad stop slider A brake
  cad stop slider B brake
  cad stop motor C brake
  cad stop
`;

/**
 * Package a Hermes 3-axis overhead bridge crane CAD document and its Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createHermesCraneProject(documentText) {
    const document = parseDocument(documentText);
    for (const port of ['A', 'B']) {
        const slider = document.joints?.find(item => item.kind === 'slider' && item.control?.port === port);
        if (!slider) {
            throw new Error(`Hermes crane requires a linear slider at port ${port}`);
        }
        if (!slider.limits) {
            throw new Error(`Hermes crane requires stroke limits at slider port ${port}`);
        }
    }
    const swivel = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === 'C');
    if (!swivel) {
        throw new Error('Hermes crane requires an angular swivel spreader servo at port C');
    }
    if (!swivel.limits) {
        throw new Error('Hermes crane requires angular limits at swivel servo port C');
    }
    const creator = new SB3Creator();
    creator.parse(CAD_HERMES_CRANE_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/hermes-crane-program.txt', CAD_HERMES_CRANE_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-hermes-crane-project.mjs <hermes-crane.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/hermes-crane');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createHermesCraneProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'hermes-crane.bcad': documentText,
        'hermes-crane.sb3': project,
        'hermes-crane-program.txt': CAD_HERMES_CRANE_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-hermes-crane-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'lateral bridge trolley slider',
            B: 'vertical hoist carriage slider',
            C: 'swivel spreader servo'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'hermes-crane.sb3')} with its CAD model, A/B/C crane program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
