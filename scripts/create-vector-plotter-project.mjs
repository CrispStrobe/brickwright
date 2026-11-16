// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Linear Y-gantry slider A and X-carriage slider B position the toolhead while
// Adafruit 1143 rotary stylus servo C sweeps across the plotting bed.
export const CAD_VECTOR_PLOTTER_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run slider A for 22 mm at 50 mm per second
  cad run slider B for 20 mm at 50 mm per second
  cad run motor C for 40 degrees at 120 degrees per second
  cad run motor C for -40 degrees at 120 degrees per second
  cad stop slider A brake
  cad stop slider B brake
  cad stop motor C brake
  cad stop
`;

/**
 * Package a Vector 3-axis XY plotter CAD document and its Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createVectorPlotterProject(documentText) {
    const document = parseDocument(documentText);
    for (const port of ['A', 'B']) {
        const axis = document.joints?.find(item => item.kind === 'slider' && item.control?.port === port);
        if (!axis || !axis.limits) {
            throw new Error(`Vector plotter requires a linear gantry slider with limits at port ${port}`);
        }
    }
    const pen = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === 'C');
    if (!pen || !pen.limits) {
        throw new Error('Vector plotter requires an angular stylus arm servo with limits at port C');
    }
    const creator = new SB3Creator();
    creator.parse(CAD_VECTOR_PLOTTER_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/vector-plotter-program.txt', CAD_VECTOR_PLOTTER_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-vector-plotter-project.mjs <vector-plotter.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/vector-plotter');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createVectorPlotterProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'vector-plotter.bcad': documentText,
        'vector-plotter.sb3': project,
        'vector-plotter-program.txt': CAD_VECTOR_PLOTTER_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-vector-plotter-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'Y-axis gantry bridge slider',
            B: 'X-axis sliding carriage',
            C: 'rotary stylus arm servo'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'vector-plotter.sb3')} with its CAD model, A/B/C plotter program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
