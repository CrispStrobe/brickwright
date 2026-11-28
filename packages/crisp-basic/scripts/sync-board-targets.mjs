#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Snapshot only the canonical upstream pad data, never its solver implementation.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';

const HEADER = '// SPDX-License-Identifier: MIT\n' +
    '// Generated from the exact bw-board pin by scripts/sync-board-targets.mjs.\n' +
    '// Do not edit profile data here; change the owning upstream and regenerate.\n';
const OUTPUT = new URL('../src/board-target-catalog.mjs', import.meta.url);
const PINS = new URL('../../../vendor-pins.json', import.meta.url);
const LOCK = new URL('../../../package-lock.json', import.meta.url);
const require = createRequire(new URL('../../../package.json', import.meta.url));

export function renderBoardTargetCatalog({profiles, pin, source}) {
    if (!Array.isArray(profiles) || profiles.length === 0) throw new Error('Missing upstream GPIO profiles');
    if (typeof pin !== 'string' || !/^[0-9a-f]{40}$/.test(pin)) throw new Error('bw-board must have an exact commit pin');
    const bytes = Buffer.isBuffer(source) ? source : Buffer.from(source);
    const blobSha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    const catalog = {schemaVersion: 1, provenance: {
        repository: 'CrispStrobe/bw-board', commit: pin, path: 'src/portable-gpio.js', blobSha
    }, profiles};
    return HEADER + 'export default ' + JSON.stringify(catalog, null, 2) + ';\n';
}

async function main() {
    const {values, positionals} = parseArgs({options: {
        check: {type: 'boolean'}, 'board-dir': {type: 'string'}
    }, strict: true});
    if (positionals.length) throw new Error('Unexpected positional argument');
    const pin = JSON.parse(readFileSync(PINS, 'utf8'))['bw-board'];
    let sourcePath;
    if (values['board-dir'] !== undefined) {
        const directory = resolve(values['board-dir']);
        const git = args => execFileSync('git', ['-C', directory, ...args], {encoding: 'utf8'}).trim();
        if (git(['rev-parse', 'HEAD']) !== pin) {
            throw new Error('--board-dir must be checked out at vendor-pins.json bw-board=' + pin);
        }
        if (git(['status', '--porcelain', '--untracked-files=no'])) {
            throw new Error('--board-dir has tracked changes; regenerate from the clean pinned upstream');
        }
        sourcePath = resolve(directory, 'src/portable-gpio.js');
    } else {
        if (!values.check) {
            throw new Error('Regeneration requires --board-dir PATH to a clean bw-board checkout at its exact pin');
        }
        // Existing vendoring gates install this exact lockfile. Refuse a lock
        // that would bless an unrelated installed package as the new source.
        const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
        const resolved = lock.packages?.['node_modules/bw-board']?.resolved;
        if (typeof resolved !== 'string' || !resolved.endsWith('#' + pin)) {
            throw new Error('The root lockfile does not install the exact bw-board pin');
        }
        sourcePath = require.resolve('bw-board/portable-gpio.js');
    }
    const source = readFileSync(sourcePath);
    const {PORTABLE_GPIO_PROFILES} = await import(pathToFileURL(sourcePath).href);
    const expected = renderBoardTargetCatalog({profiles: PORTABLE_GPIO_PROFILES, pin, source});
    if (values.check) {
        if (readFileSync(OUTPUT, 'utf8') !== expected) {
            throw new Error('CrispBASIC target catalog differs from the pinned bw-board source; ' +
                'regenerate with --board-dir after landing the owning upstream');
        }
        console.log('CrispBASIC target catalog matches bw-board ' + pin);
    } else {
        writeFileSync(OUTPUT, expected);
        console.log('Regenerated CrispBASIC target catalog from bw-board ' + pin);
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
