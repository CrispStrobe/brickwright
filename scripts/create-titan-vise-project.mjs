// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Adafruit 1143 micro-servo A rotates the indexing bed while opposing
// linear jaw sliders B (left) and C (right) clamp and release the workpiece.
export const CAD_TITAN_VISE_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run motor A for 45 degrees at 120 degrees per second
  cad run slider B for 14 mm at 40 mm per second
  cad run slider C for 14 mm at 40 mm per second
  cad run slider B for -14 mm at 40 mm per second
  cad run slider C for -14 mm at 40 mm per second
  cad stop motor A brake
  cad stop slider B brake
  cad stop slider C brake
  cad stop
`;

/**
 * Package a Titan 3-axis rotary vise CAD document and its Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createTitanViseProject(documentText) {
    const document = parseDocument(documentText);
    const indexer = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === 'A');
    if (!indexer) {
        throw new Error('Titan vise requires an angular rotary indexer servo at port A');
    }
    if (!indexer.limits) {
        throw new Error('Titan vise requires angular limits at indexer servo port A');
    }
    for (const port of ['B', 'C']) {
        const jaw = document.joints?.find(item => item.kind === 'slider' && item.control?.port === port);
        if (!jaw) {
            throw new Error(`Titan vise requires a linear clamping jaw slider at port ${port}`);
        }
        if (!jaw.limits) {
            throw new Error(`Titan vise requires stroke limits at jaw slider port ${port}`);
        }
    }
    const creator = new SB3Creator();
    creator.parse(CAD_TITAN_VISE_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/titan-vise-program.txt', CAD_TITAN_VISE_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-titan-vise-project.mjs <titan-vise.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/titan-vise');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createTitanViseProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'titan-vise.bcad': documentText,
        'titan-vise.sb3': project,
        'titan-vise-program.txt': CAD_TITAN_VISE_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-titan-vise-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'rotary indexing bed servo',
            B: 'left clamping jaw slider',
            C: 'right clamping jaw slider'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'titan-vise.sb3')} with its CAD model, A/B/C vise program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
