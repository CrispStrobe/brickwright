// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Adafruit 1143 micro-servo A rotates the 4-blade turntable to index the cargo cube,
// linear slider B pushes the cube down the exit chute, and servo C steers the diverter gate.
export const CAD_ORION_CAROUSEL_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run motor A for 75 degrees at 120 degrees per second
  cad run motor C for -40 degrees at 120 degrees per second
  cad run slider B for 36 mm at 60 mm per second
  cad run slider B for -36 mm at 60 mm per second
  cad stop motor A brake
  cad stop slider B brake
  cad stop motor C brake
  cad stop
`;

/**
 * Package an Orion 3-axis sorting carousel CAD document and its Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createOrionCarouselProject(documentText) {
    const document = parseDocument(documentText);
    for (const port of ['A', 'C']) {
        const joint = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === port);
        if (!joint) {
            throw new Error(`Orion carousel requires an angular servo hinge at port ${port}`);
        }
        if (!joint.limits) {
            throw new Error(`Orion carousel requires angular limits at servo port ${port}`);
        }
    }
    const pusher = document.joints?.find(item => item.kind === 'slider' && item.control?.port === 'B');
    if (!pusher) {
        throw new Error('Orion carousel requires a linear ejection slider at port B');
    }
    if (!pusher.limits) {
        throw new Error('Orion carousel requires stroke limits at pusher slider port B');
    }
    const creator = new SB3Creator();
    creator.parse(CAD_ORION_CAROUSEL_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/orion-carousel-program.txt', CAD_ORION_CAROUSEL_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-orion-carousel-project.mjs <orion-carousel.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/orion-carousel');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createOrionCarouselProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'orion-carousel.bcad': documentText,
        'orion-carousel.sb3': project,
        'orion-carousel-program.txt': CAD_ORION_CAROUSEL_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-orion-carousel-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'rotary turntable servo',
            B: 'linear ejection pusher slider',
            C: 'exit chute diverter gate servo'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'orion-carousel.sb3')} with its CAD model, A/B/C carousel program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
