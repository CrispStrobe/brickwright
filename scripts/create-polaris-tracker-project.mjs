// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Linear rail slider A translates the tracker carriage while Adafruit 1143
// micro-servos B (pan) and C (tilt) aim the sensor pod toward the beacon target.
export const CAD_POLARIS_TRACKER_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run slider A for 24 mm at 50 mm per second
  cad run motor B for 45 degrees at 120 degrees per second
  cad run motor C for -30 degrees at 90 degrees per second
  cad run motor B for -45 degrees at 120 degrees per second
  cad run motor C for 30 degrees at 90 degrees per second
  cad stop slider A brake
  cad stop motor B brake
  cad stop motor C brake
  cad stop
`;

/**
 * Package a Polaris 3-axis pan-tilt tracker CAD document and its Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createPolarisTrackerProject(documentText) {
    const document = parseDocument(documentText);
    const rail = document.joints?.find(item => item.kind === 'slider' && item.control?.port === 'A');
    if (!rail) {
        throw new Error('Polaris tracker requires a linear rail carriage slider at port A');
    }
    if (!rail.limits) {
        throw new Error('Polaris tracker requires stroke limits at rail slider port A');
    }
    for (const port of ['B', 'C']) {
        const joint = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === port);
        if (!joint) {
            throw new Error(`Polaris tracker requires an angular servo hinge at port ${port}`);
        }
        if (!joint.limits) {
            throw new Error(`Polaris tracker requires angular limits at servo port ${port}`);
        }
    }
    const creator = new SB3Creator();
    creator.parse(CAD_POLARIS_TRACKER_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/polaris-tracker-program.txt', CAD_POLARIS_TRACKER_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-polaris-tracker-project.mjs <polaris-tracker.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/polaris-tracker');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createPolarisTrackerProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'polaris-tracker.bcad': documentText,
        'polaris-tracker.sb3': project,
        'polaris-tracker-program.txt': CAD_POLARIS_TRACKER_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-polaris-tracker-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'linear rail carriage slider',
            B: 'pan yaw servo',
            C: 'tilt pitch servo'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'polaris-tracker.sb3')} with its CAD model, A/B/C tracker program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
