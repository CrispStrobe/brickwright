// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Two Adafruit 1143 micro-servos (shoulder A, elbow B) swing the SCARA arm
// horizontally while Z-quill slider C plunges to tap and sweep the target puck.
export const CAD_APEX_SCARA_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run slider C for -12 mm at 40 mm per second
  cad run motor A for 35 degrees at 120 degrees per second
  cad run motor B for 35 degrees at 120 degrees per second
  cad run slider C for 12 mm at 40 mm per second
  cad stop motor A brake
  cad stop motor B brake
  cad stop slider C brake
  cad stop
`;

/**
 * Package an Apex SCARA 3-axis arm CAD document and its Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createApexScaraProject(documentText) {
    const document = parseDocument(documentText);
    for (const port of ['A', 'B']) {
        const joint = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === port);
        if (!joint) {
            throw new Error(`Apex SCARA requires an angular servo hinge at port ${port}`);
        }
        if (!joint.limits) {
            throw new Error(`Apex SCARA requires angular limits at servo port ${port}`);
        }
    }
    const quill = document.joints?.find(item => item.kind === 'slider' && item.control?.port === 'C');
    if (!quill) {
        throw new Error('Apex SCARA requires a linear Z-quill slider at port C');
    }
    if (!quill.limits) {
        throw new Error('Apex SCARA requires stroke limits at Z-quill slider port C');
    }
    const creator = new SB3Creator();
    creator.parse(CAD_APEX_SCARA_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/apex-scara-program.txt', CAD_APEX_SCARA_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-apex-scara-project.mjs <apex-scara.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/apex-scara');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createApexScaraProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'apex-scara.bcad': documentText,
        'apex-scara.sb3': project,
        'apex-scara-program.txt': CAD_APEX_SCARA_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-apex-scara-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'shoulder yaw servo',
            B: 'elbow yaw servo',
            C: 'vertical Z-quill slider'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'apex-scara.sb3')} with its CAD model, A/B/C SCARA program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
