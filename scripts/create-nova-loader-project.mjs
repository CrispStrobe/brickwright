// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Continuous differential drive wheels A (left) and B (right) move the loader
// forward into the payload while Adafruit 1143 servo C tilts the front bucket.
export const CAD_NOVA_LOADER_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run motor A for 360 degrees at 360 degrees per second
  cad run motor B for 360 degrees at 360 degrees per second
  cad run motor C for 35 degrees at 90 degrees per second
  cad run motor C for -35 degrees at 90 degrees per second
  cad stop motor A brake
  cad stop motor B brake
  cad stop motor C brake
  cad stop
`;

/**
 * Package a Nova 3-axis wheeled loader CAD document and its Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createNovaLoaderProject(documentText) {
    const document = parseDocument(documentText);
    for (const port of ['A', 'B']) {
        const wheel = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === port);
        if (!wheel || wheel.limits) {
            throw new Error(`Nova loader requires a continuous drive wheel hinge at port ${port}`);
        }
    }
    const bucket = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === 'C');
    if (!bucket || !bucket.limits) {
        throw new Error('Nova loader requires an angular bucket servo with limits at port C');
    }
    const creator = new SB3Creator();
    creator.parse(CAD_NOVA_LOADER_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/nova-loader-program.txt', CAD_NOVA_LOADER_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-nova-loader-project.mjs <nova-loader.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/nova-loader');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createNovaLoaderProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'nova-loader.bcad': documentText,
        'nova-loader.sb3': project,
        'nova-loader-program.txt': CAD_NOVA_LOADER_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-nova-loader-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'left differential drive wheel',
            B: 'right differential drive wheel',
            C: 'front dump bucket servo'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'nova-loader.sb3')} with its CAD model, A/B/C loader program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
