// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Adafruit 1143 micro-servos drive yaw A, pitch B, and roll C of the stabilized sensor pod.
export const CAD_STRATOS_GIMBAL_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run motor A for 60 degrees at 120 degrees per second
  cad run motor B for 35 degrees at 90 degrees per second
  cad run motor C for -45 degrees at 120 degrees per second
  cad run motor A for -60 degrees at 120 degrees per second
  cad stop motor A brake
  cad stop motor B brake
  cad stop motor C brake
  cad stop
`;

/**
 * Package a Stratos 3-axis gimbal stage CAD document and its Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createStratosGimbalProject(documentText) {
    const document = parseDocument(documentText);
    for (const port of ['A', 'B', 'C']) {
        const joint = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === port);
        if (!joint || !joint.limits) {
            throw new Error(`Stratos gimbal requires an angular servo hinge with limits at port ${port}`);
        }
    }
    const creator = new SB3Creator();
    creator.parse(CAD_STRATOS_GIMBAL_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/stratos-gimbal-program.txt', CAD_STRATOS_GIMBAL_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-stratos-gimbal-project.mjs <stratos-gimbal.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/stratos-gimbal');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createStratosGimbalProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'stratos-gimbal.bcad': documentText,
        'stratos-gimbal.sb3': project,
        'stratos-gimbal-program.txt': CAD_STRATOS_GIMBAL_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-stratos-gimbal-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'yaw turret servo',
            B: 'pitch cradle servo',
            C: 'roll sensor servo'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'stratos-gimbal.sb3')} with its CAD model, A/B/C gimbal program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
