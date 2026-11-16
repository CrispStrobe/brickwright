// SPDX-License-Identifier: BSD-3-Clause
// Check a privately stored/generated example without copying it into Lite.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import JSZip from 'jszip';
import {CAD_ROVER_PROGRAM} from './create-cad-rover-project.mjs';
import {parseDocument} from '../overlay/scratch-gui/static/cad-sdk/sdk.js';
import {inspectBrickwrightState} from '../overlay/scratch-gui/src/lib/bw-project-bundle.js';

const input = process.argv[2];
if (!input) throw new Error('Usage: node --import ./scripts/lib/register-gui-scope.mjs scripts/verify-cad-rover-project.mjs <example-directory>');
const base = resolve(input);
const manifest = JSON.parse(await readFile(resolve(base, 'manifest.json'), 'utf8'));
const sdk = JSON.parse(await readFile(new URL('../overlay/scratch-gui/static/cad-sdk/manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.format, 'brickwright-cad-rover-example');
assert.equal(manifest.version, 1);
assert.deepEqual(manifest.program, {format: 'brickwright-pseudocode', entry: 'green-flag'});
const files = ['tt-rover.bcad', 'tt-rover.sb3', 'tt-rover-program.txt', 'ADAFRUIT-MIT-LICENSE.txt', 'BRICKWRIGHT-BSD-3-CLAUSE.txt'];
assert.deepEqual(Object.keys(manifest.files).sort(), [...files].sort());
for (const name of files) {
    const bytes = await readFile(resolve(base, name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.files[name], name);
}
const source = await readFile(resolve(base, 'tt-rover.bcad'), 'utf8');
const document = parseDocument(source);
assert.deepEqual(manifest.cadDocument, {format: document.format, version: document.version, units: document.units, id: document.id});
for (const port of ['A', 'B']) assert.equal(document.joints?.find(j => j.control?.port === port)?.kind, 'hinge');
const bytes = await readFile(resolve(base, 'tt-rover.sb3'));
const archive = await JSZip.loadAsync(bytes);
assert.equal(await archive.file('brickwright/cad.json').async('text'), source);
assert.equal(await archive.file('brickwright/tt-rover-program.txt').async('text'), CAD_ROVER_PROGRAM);
for (const name of files.filter(name => name.endsWith('LICENSE.txt') || name.endsWith('CLAUSE.txt'))) {
    assert.equal(await archive.file(`brickwright/licenses/${name}`).async('text'), await readFile(resolve(base, name), 'utf8'));
}
assert.notEqual((await inspectBrickwrightState(bytes)).outcome, 'invalid');
console.log(`PASS complete Scout TT project: exact CAD bytes, A/B drives, program, notices and ${files.length} hashes; independently validated with SDK ${sdk.commit}`);
