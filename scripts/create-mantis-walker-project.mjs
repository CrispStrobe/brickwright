// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Experimental movement sequence for a supplied Mantis CAD document. Packaging
// checks preserve the document and commands; they do not qualify a walking gait.
// Roll pendulum C shifts weight while left/right leg rockers A and B alternate.
export const CAD_MANTIS_WALKER_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run motor C for 25 degrees at 120 degrees per second
  cad run motor A for -25 degrees at 120 degrees per second
  cad run motor B for 25 degrees at 120 degrees per second
  cad run motor C for -50 degrees at 120 degrees per second
  cad run motor A for 50 degrees at 120 degrees per second
  cad run motor B for -50 degrees at 120 degrees per second
  cad run motor C for 25 degrees at 120 degrees per second
  cad stop motor A brake
  cad stop motor B brake
  cad stop motor C brake
  cad stop
`;

/**
 * Package a Mantis CAD document and its experimental Scratch movement program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createMantisWalkerProject(documentText) {
    const document = parseDocument(documentText);
    for (const port of ['A', 'B', 'C']) {
        const joint = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === port);
        if (!joint) {
            throw new Error(`Mantis walker requires an angular servo hinge at port ${port}`);
        }
        if (!joint.limits) {
            throw new Error(`Mantis walker requires angular limits at servo port ${port}`);
        }
    }
    const creator = new SB3Creator();
    creator.parse(CAD_MANTIS_WALKER_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/mantis-walker-program.txt', CAD_MANTIS_WALKER_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-mantis-walker-project.mjs <mantis-walker.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/mantis-walker');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createMantisWalkerProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'mantis-walker.bcad': documentText,
        'mantis-walker.sb3': project,
        'mantis-walker-program.txt': CAD_MANTIS_WALKER_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-mantis-walker-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'left leg rocker servo',
            B: 'right leg rocker servo',
            C: 'weight-shift roll pendulum servo'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'mantis-walker.sb3')} with its CAD model, experimental A/B/C movement sequence and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
