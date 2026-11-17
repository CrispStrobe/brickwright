// SPDX-License-Identifier: GPL-3.0-or-later

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';

// Adafruit 1143 micro-servo A aims the turret, continuous flywheel roller B
// spins up to launch speed, and linear feeder slider C feeds the ball.
export const CAD_BOREAL_LAUNCHER_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run motor A for 25 degrees at 90 degrees per second
  cad run motor B for 720 degrees at 720 degrees per second
  cad run slider C for 28 mm at 80 mm per second
  cad run slider C for -28 mm at 80 mm per second
  cad stop motor A brake
  cad stop motor B brake
  cad stop slider C brake
  cad stop
`;

/**
 * Package a Boreal 3-axis ball launcher CAD document and its Scratch program into an SB3 archive.
 * @param {string} documentText Serialized Brickwright CAD document JSON.
 * @returns {Promise<Uint8Array>} Compressed SB3 archive bytes.
 */
export async function createBorealLauncherProject(documentText) {
    const document = parseDocument(documentText);
    const yaw = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === 'A');
    if (!yaw || !yaw.limits) {
        throw new Error('Boreal launcher requires an angular aiming servo with limits at port A');
    }
    const roller = document.joints?.find(item => item.kind === 'hinge' && item.control?.port === 'B');
    if (!roller || roller.limits) {
        throw new Error('Boreal launcher requires a continuous flywheel roller hinge at port B');
    }
    const feeder = document.joints?.find(item => item.kind === 'slider' && item.control?.port === 'C');
    if (!feeder || !feeder.limits) {
        throw new Error('Boreal launcher requires a linear ball feeder slider with limits at port C');
    }
    const creator = new SB3Creator();
    creator.parse(CAD_BOREAL_LAUNCHER_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/boreal-launcher-program.txt', CAD_BOREAL_LAUNCHER_PROGRAM);
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        throw new Error(
            'Usage: node --import ./scripts/lib/register-gui-scope.mjs ' +
            'scripts/create-boreal-launcher-project.mjs <boreal-launcher.bcad> [output-directory]'
        );
    }
    const output = resolve(process.argv[3] || 'artifacts/boreal-launcher');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createBorealLauncherProject(documentText);
    const sdk = JSON.parse(
        await readFile(
            resolve(dirname(fileURLToPath(import.meta.url)), '../overlay/scratch-gui/static/cad-sdk/manifest.json'),
            'utf8'
        )
    );
    const files = {
        'boreal-launcher.bcad': documentText,
        'boreal-launcher.sb3': project,
        'boreal-launcher-program.txt': CAD_BOREAL_LAUNCHER_PROGRAM
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) {
        await writeFile(resolve(output, name), bytes);
    }
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-boreal-launcher-example',
        version: 1,
        sdkCommit: sdk.commit,
        controls: {
            A: 'aiming yaw servo',
            B: 'continuous launch flywheel',
            C: 'linear ball feeder slider'
        },
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(
            Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])
        )
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'boreal-launcher.sb3')} with its CAD model, A/B/C launcher program and hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
