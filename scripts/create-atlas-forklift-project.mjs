// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Linear slider D lifts the pallet crate along the mast, micro-servo C tilts
// the tines back to cradle it, and twin TT gearmotors A/B carry it forward.
export const CAD_ATLAS_FORKLIFT_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run slider D for 30 mm at 25 mm per second
  cad run motor C for -12 degrees at 60 degrees per second
  cad run motor A at 120 degrees per second
  cad run motor B at 120 degrees per second
  wait 1.5 seconds
  cad stop motor A brake
  cad stop motor B brake
  cad stop motor C brake
  cad stop slider D brake
  cad stop
`;

/**
 * Package an Atlas forklift CAD document and its lift/tilt/drive Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createAtlasForkliftProject(documentText) {
    const document = parseDocument(documentText);
    for (const port of ['A', 'B', 'C']) {
        const joint = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === port);
        if (!joint) {
            throw new Error(`Atlas forklift requires an angular hinge drive at port ${port}`);
        }
    }
    const tiltJoint = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === 'C');
    if (!tiltJoint?.limits) {
        throw new Error('Atlas forklift requires angular limits at servo port C');
    }
    const liftJoint = document.joints?.find(item => item.kind === 'slider' && item.control?.port === 'D');
    if (!liftJoint || !liftJoint.limits) {
        throw new Error('Atlas forklift requires a limited linear slider at port D');
    }
    const creator = new SB3Creator();
    creator.parse(CAD_ATLAS_FORKLIFT_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/atlas-forklift-program.txt', CAD_ATLAS_FORKLIFT_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-atlas-forklift-project.mjs <atlas-forklift.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/atlas-forklift');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createAtlasForkliftProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'atlas-forklift.bcad': documentText,
        'atlas-forklift.sb3': project,
        'atlas-forklift-program.txt': CAD_ATLAS_FORKLIFT_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-atlas-forklift-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'left rear drive wheel',
            B: 'right rear drive wheel',
            C: 'fork tilt micro-servo',
            D: 'vertical mast slider'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'atlas-forklift.sb3')} with its CAD model, A/B/C/D program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
