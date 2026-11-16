// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Three Adafruit 1143 micro-servos operate in sequence: B lowers the shoulder boom,
// C pinches the cargo cube, B lifts, A swings across the table, B lowers, C releases.
export const CAD_KESTREL_ARM_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run motor B for 25 degrees at 60 degrees per second
  cad run motor C for 25 degrees at 90 degrees per second
  cad run motor B for -30 degrees at 60 degrees per second
  cad run motor A for 60 degrees at 90 degrees per second
  cad run motor B for 25 degrees at 60 degrees per second
  cad run motor C for -25 degrees at 90 degrees per second
  cad stop motor A brake
  cad stop motor B brake
  cad stop motor C brake
  cad stop
`;

/**
 * Package a Kestrel 3-servo robotic arm CAD document and its pick-and-place Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createKestrelArmProject(documentText) {
    const document = parseDocument(documentText);
    for (const port of ['A', 'B', 'C']) {
        const joint = document.joints?.find(item => item.control?.port === port);
        if (!joint || joint.kind !== 'hinge') {
            throw new Error(`Kestrel arm requires an angular servo hinge at port ${port}`);
        }
        if (!joint.limits) {
            throw new Error(`Kestrel arm requires angular limits at port ${port}`);
        }
    }
    const creator = new SB3Creator();
    creator.parse(CAD_KESTREL_ARM_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/kestrel-arm-program.txt', CAD_KESTREL_ARM_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-kestrel-arm-project.mjs <kestrel-arm.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/kestrel-arm');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createKestrelArmProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'kestrel-arm.bcad': documentText,
        'kestrel-arm.sb3': project,
        'kestrel-arm-program.txt': CAD_KESTREL_ARM_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-kestrel-arm-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'base yaw servo',
            B: 'shoulder lift servo',
            C: 'gripper jaw servo'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'kestrel-arm.sb3')} with its CAD model, A/B/C servo program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
