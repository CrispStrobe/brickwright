// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Linear barrier slider C raises the crossing gate while Adafruit 1143
// micro-servos A (west leaf) and B (east leaf) tilt the dual bascule spans.
export const CAD_CHRONOS_DRAWBRIDGE_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run slider C for 20 mm at 40 mm per second
  cad run motor A for 45 degrees at 90 degrees per second
  cad run motor B for -45 degrees at 90 degrees per second
  cad run motor A for -45 degrees at 90 degrees per second
  cad run motor B for 45 degrees at 90 degrees per second
  cad run slider C for -20 mm at 40 mm per second
  cad stop motor A brake
  cad stop motor B brake
  cad stop slider C brake
  cad stop
`;

/**
 * Package a Chronos 3-axis bascule drawbridge CAD document and its Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createChronosDrawbridgeProject(documentText) {
    const document = parseDocument(documentText);
    for (const port of ['A', 'B']) {
        const joint = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === port);
        if (!joint) {
            throw new Error(`Chronos drawbridge requires an angular leaf servo at port ${port}`);
        }
        if (!joint.limits) {
            throw new Error(`Chronos drawbridge requires angular limits at leaf servo port ${port}`);
        }
    }
    const barrier = document.joints?.find(item => item.kind === 'slider' && item.control?.port === 'C');
    if (!barrier) {
        throw new Error('Chronos drawbridge requires a linear crossing barrier slider at port C');
    }
    if (!barrier.limits) {
        throw new Error('Chronos drawbridge requires stroke limits at barrier slider port C');
    }
    const creator = new SB3Creator();
    creator.parse(CAD_CHRONOS_DRAWBRIDGE_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/chronos-drawbridge-program.txt', CAD_CHRONOS_DRAWBRIDGE_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-chronos-drawbridge-project.mjs <chronos-drawbridge.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/chronos-drawbridge');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createChronosDrawbridgeProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'chronos-drawbridge.bcad': documentText,
        'chronos-drawbridge.sb3': project,
        'chronos-drawbridge-program.txt': CAD_CHRONOS_DRAWBRIDGE_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-chronos-drawbridge-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'west bascule leaf servo',
            B: 'east bascule leaf servo',
            C: 'vertical crossing barrier slider'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'chronos-drawbridge.sb3')} with its CAD model, A/B/C drawbridge program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
