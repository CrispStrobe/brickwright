// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Rear TT motors A and B share the same +Y wheel axis; speed commands return
// immediately so both rear wheels drive together while servo C steers the front
// fork between +-40 degree limits. These commands operate the CAD simulation only.
export const CAD_STEERABLE_ROVER_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run motor A at 120 degrees per second
  cad run motor B at 120 degrees per second
  wait 1.5 seconds
  cad run motor C for 25 degrees at 90 degrees per second
  wait 1.5 seconds
  cad run motor C for -50 degrees at 90 degrees per second
  wait 1.5 seconds
  cad run motor C for 25 degrees at 90 degrees per second
  cad stop motor A brake
  cad stop motor B brake
  cad stop motor C brake
  cad stop
`;

/**
 * Package a steerable Trident CAD document and its Scratch A/B/C steering program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createSteerableRoverProject(documentText) {
    const document = parseDocument(documentText);
    for (const port of ['A', 'B', 'C']) {
        const joint = document.joints?.find(item => item.control?.port === port);
        if (!joint || joint.kind !== 'hinge') {
            throw new Error(`Steerable rover requires an angular drive at port ${port}`);
        }
    }
    const steerJoint = document.joints?.find(item => item.control?.port === 'C');
    if (!steerJoint?.limits) {
        throw new Error('Steerable rover requires angular steering limits at port C');
    }
    const creator = new SB3Creator();
    creator.parse(CAD_STEERABLE_ROVER_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    // Preserve authored CAD bytes rather than normalizing IDs or geometry.
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/trident-steerable-rover-program.txt', CAD_STEERABLE_ROVER_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-steerable-rover-project.mjs <trident-steerable-rover.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/steerable-rover');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createSteerableRoverProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'trident-steerable-rover.bcad': documentText,
        'trident-steerable-rover.sb3': project,
        'trident-steerable-rover-program.txt': CAD_STEERABLE_ROVER_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-steerable-rover-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'left rear wheel',
            B: 'right rear wheel',
            C: 'front steering servo'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'trident-steerable-rover.sb3')} with its CAD model, A/B/C program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
