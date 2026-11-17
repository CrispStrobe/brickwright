// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Linear feed slider A pushes the parcel onto the conveyor, continuous paddle
// wheel B bats it down the lane, and Adafruit 1143 diverter servo C routes the exit.
export const CAD_ZEPHYR_CONVEYOR_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run motor B for 720 degrees at 720 degrees per second
  cad run motor C for 45 degrees at 120 degrees per second
  cad run slider A for 36 mm at 80 mm per second
  cad run slider A for -36 mm at 80 mm per second
  cad stop slider A brake
  cad stop motor B brake
  cad stop motor C brake
  cad stop
`;

/**
 * Package a Zephyr 3-axis sorting conveyor CAD document and its Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createZephyrConveyorProject(documentText) {
    const document = parseDocument(documentText);
    const feed = document.joints?.find(item => item.kind === 'slider' && item.control?.port === 'A');
    if (!feed || !feed.limits) {
        throw new Error('Zephyr conveyor requires a linear feed slider with limits at port A');
    }
    const roller = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === 'B');
    if (!roller || roller.limits) {
        throw new Error('Zephyr conveyor requires a continuous paddle wheel hinge at port B');
    }
    const gate = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === 'C');
    if (!gate || !gate.limits) {
        throw new Error('Zephyr conveyor requires an angular diverter servo with limits at port C');
    }
    const creator = new SB3Creator();
    creator.parse(CAD_ZEPHYR_CONVEYOR_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/zephyr-conveyor-program.txt', CAD_ZEPHYR_CONVEYOR_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-zephyr-conveyor-project.mjs <zephyr-conveyor.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/zephyr-conveyor');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createZephyrConveyorProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'zephyr-conveyor.bcad': documentText,
        'zephyr-conveyor.sb3': project,
        'zephyr-conveyor-program.txt': CAD_ZEPHYR_CONVEYOR_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-zephyr-conveyor-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'linear feed pusher slider',
            B: 'continuous overhead paddle wheel',
            C: 'exit diverter gate servo'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'zephyr-conveyor.sb3')} with its CAD model, A/B/C conveyor program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
