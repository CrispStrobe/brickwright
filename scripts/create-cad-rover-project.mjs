// SPDX-License-Identifier: BSD-3-Clause
// Package the actual CAD rover and its two-wheel demonstration in one SB3.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import SB3Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {CAD_PROJECT_PATH} from '../overlay/scratch-gui/src/lib/bw-cad-project.js';
import {parseCadRoverDocument, assertCadRoverProgram} from './lib/cad-rover-contract.mjs';

const distributionLicences = async () => ({
    'ADAFRUIT-MIT-LICENSE.txt': await readFile(new URL('../licenses/adafruit-cad-parts-MIT.txt', import.meta.url)),
    'BRICKWRIGHT-BSD-3-CLAUSE.txt': await readFile(new URL('../LICENSE', import.meta.url))
});

// Both wheel axes must be authored in the same direction. Speed commands return
// immediately, so both wheels run together. A degree command would wait before
// starting the second wheel. These commands operate the CAD simulation only.
export const CAD_ROVER_PROGRAM = `WHEN green flag clicked:
  cad reset
  cad start
  cad run motor A at 120 degrees per second
  cad run motor B at 120 degrees per second
  wait 2 seconds
  cad stop motor A brake
  cad stop motor B brake
  wait 0.5 seconds
  cad run motor A at 90 degrees per second
  cad run motor B at -90 degrees per second
  wait 1 second
  cad stop motor A brake
  cad stop motor B brake
  wait 0.5 seconds
  cad run motor A at -120 degrees per second
  cad run motor B at -120 degrees per second
  wait 1 second
  cad stop motor A brake
  cad stop motor B brake
  say "TT rover demo complete"
  cad stop
`;

export async function createCadRoverProject(documentText) {
    // Use the shipped SDK and require the mobile, independent, same-direction
    // wheel drives assumed by this particular demonstration.
    parseCadRoverDocument(documentText);
    const creator = new SB3Creator();
    creator.parse(CAD_ROVER_PROGRAM);
    const archive = await JSZip.loadAsync(await (await creator.generateSB3()).arrayBuffer());
    assertCadRoverProgram(JSON.parse(await archive.file('project.json').async('text')));
    // Preserve authored CAD bytes rather than normalizing IDs or geometry.
    archive.file(CAD_PROJECT_PATH, documentText);
    archive.file('brickwright/tt-rover-program.txt', CAD_ROVER_PROGRAM);
    for (const [name, bytes] of Object.entries(await distributionLicences())) {
        archive.file(`brickwright/licenses/${name}`, bytes);
    }
    return archive.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

async function main() {
    const input = process.argv[2];
    if (!input) throw new Error('Usage: node --import ./scripts/lib/register-gui-scope.mjs scripts/create-cad-rover-project.mjs <rover.bcad> [output-directory]');
    const output = resolve(process.argv[3] || 'artifacts/cad-rover');
    const documentText = await readFile(resolve(input), 'utf8');
    const project = await createCadRoverProject(documentText);
    const document = JSON.parse(documentText); // Already checked by the SDK above.
    const files = {
        'tt-rover.bcad': documentText,
        'tt-rover.sb3': project,
        'tt-rover-program.txt': CAD_ROVER_PROGRAM,
        ...await distributionLicences()
    };
    await mkdir(output, {recursive: true});
    for (const [name, bytes] of Object.entries(files)) await writeFile(resolve(output, name), bytes);
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
        format: 'brickwright-cad-rover-example', version: 1,
        // Artifact identity is independent of the SDK used to validate it.
        // verify-cad-rover-project reports the current SDK separately, so a
        // later SDK pin never requires rewriting the saved private project.
        cadDocument: {format: document.format, version: document.version, units: document.units, id: document.id},
        program: {format: 'brickwright-pseudocode', entry: 'green-flag'},
        controls: {A: 'left wheel', B: 'right wheel'},
        execution: 'CAD simulation; no physical Adafruit transport',
        files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')]))
    }, null, 2) + '\n');
    console.log(`Wrote ${resolve(output, 'tt-rover.sb3')} with its CAD model, A/B program and source hashes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
