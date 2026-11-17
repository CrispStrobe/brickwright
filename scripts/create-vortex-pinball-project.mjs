// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Linear shooter plunger slider C launches the puck up the playfield while
// Adafruit 1143 micro-servos A (left flipper) and B (right flipper) bat it back.
export const CAD_VORTEX_PINBALL_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run slider C for 32 mm at 120 mm per second
  cad run motor A for 45 degrees at 180 degrees per second
  cad run motor B for -45 degrees at 180 degrees per second
  cad run motor A for -45 degrees at 180 degrees per second
  cad run motor B for 45 degrees at 180 degrees per second
  cad stop motor A brake
  cad stop motor B brake
  cad stop slider C brake
  cad stop
`;

/**
 * Package a Vortex 3-axis pinball arena CAD document and its Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createVortexPinballProject(documentText) {
    const document = parseDocument(documentText);
    for (const port of ['A', 'B']) {
        const joint = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === port);
        if (!joint) {
            throw new Error(`Vortex pinball requires an angular servo hinge at port ${port}`);
        }
        if (!joint.limits) {
            throw new Error(`Vortex pinball requires angular limits at servo port ${port}`);
        }
    }
    const plunger = document.joints?.find(item => item.kind === 'slider' && item.control?.port === 'C');
    if (!plunger) {
        throw new Error('Vortex pinball requires a linear shooter plunger slider at port C');
    }
    if (!plunger.limits) {
        throw new Error('Vortex pinball requires stroke limits at plunger slider port C');
    }
    const creator = new SB3Creator();
    creator.parse(CAD_VORTEX_PINBALL_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/vortex-pinball-program.txt', CAD_VORTEX_PINBALL_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-vortex-pinball-project.mjs <vortex-pinball.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/vortex-pinball');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createVortexPinballProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'vortex-pinball.bcad': documentText,
        'vortex-pinball.sb3': project,
        'vortex-pinball-program.txt': CAD_VORTEX_PINBALL_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-vortex-pinball-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'left flipper servo',
            B: 'right flipper servo',
            C: 'linear shooter plunger slider'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'vortex-pinball.sb3')} with its CAD model, A/B/C pinball program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
