// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Linear sliders A (X) and B (Y) position the gantry shuttle beside each puck
// while Adafruit 1143 micro-servo C sweeps the paddle to sort them across the bed.
export const CAD_CYCLONE_SORTER_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run slider A for 18 mm at 40 mm per second
  cad run slider B for 24 mm at 40 mm per second
  cad run motor C for 45 degrees at 120 degrees per second
  cad run slider B for -48 mm at 40 mm per second
  cad run motor C for -90 degrees at 120 degrees per second
  cad run motor C for 45 degrees at 120 degrees per second
  cad stop slider A brake
  cad stop slider B brake
  cad stop motor C brake
  cad stop
`;

/**
 * Package a Cyclone 2-axis gantry sorter CAD document and its sorting Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createCycloneSorterProject(documentText) {
    const document = parseDocument(documentText);
    for (const port of ['A', 'B']) {
        const joint = document.joints?.find(item => item.kind === 'slider' && item.control?.port === port);
        if (!joint || !joint.limits) {
            throw new Error(`Cyclone sorter requires a limited linear slider at port ${port}`);
        }
    }
    const sweepJoint = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === 'C');
    if (!sweepJoint || !sweepJoint.limits) {
        throw new Error('Cyclone sorter requires a limited servo hinge at port C');
    }
    const creator = new SB3Creator();
    creator.parse(CAD_CYCLONE_SORTER_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/cyclone-sorter-program.txt', CAD_CYCLONE_SORTER_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-cyclone-sorter-project.mjs <cyclone-sorter.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/cyclone-sorter');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createCycloneSorterProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'cyclone-sorter.bcad': documentText,
        'cyclone-sorter.sb3': project,
        'cyclone-sorter-program.txt': CAD_CYCLONE_SORTER_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-cyclone-sorter-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'X-axis gantry bridge slider',
            B: 'Y-axis shuttle slider',
            C: 'sweeper paddle servo'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'cyclone-sorter.sb3')} with its CAD model, A/B/C sorting program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
