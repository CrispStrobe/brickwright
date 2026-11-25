#!/usr/bin/env node
// The guest source and circuits belong to bw-board. Copy only an immutable,
// committed tree matching vendor-pins.json; never a sibling's working files.
export const NOTICE = {"name":"STC15lib","licence":"Apache-2.0","holder":"mgoblin"};
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dest = path.join(root, 'overlay/scratch-gui/static/firmware/bw8051-1');
const pin = JSON.parse(readFileSync(path.join(root, 'vendor-pins.json'), 'utf8'))['bw-board'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const check = process.argv.includes('--check');
if (!/^[0-9a-f]{40}$/.test(pin)) throw new Error('bw-board must have an exact commit pin');

if (check) {
    const manifest = JSON.parse(readFileSync(path.join(dest, 'manifest.json'), 'utf8'));
    if (manifest.bwBoard !== pin) throw new Error('Firmware assets do not match the bw-board pin; resync them');
    for (const [file, expected] of Object.entries(manifest.files)) {
        if (hash(readFileSync(path.join(dest, file))) !== expected) throw new Error(`Firmware asset drift: ${file}`);
    }
    console.log(`bw8051_1: ${Object.keys(manifest.files).length} assets match bw-board ${pin}`);
} else {
    const sourceIndex = process.argv.indexOf('--source');
    if (sourceIndex < 0 || !process.argv[sourceIndex + 1]) {
        throw new Error('Usage: node scripts/sync-bw8051-firmware.mjs --source /path/to/bw-board (or --check)');
    }
    const source = path.resolve(process.argv[sourceIndex + 1]);
    const git = args => execFileSync('git', ['-C', source, ...args], {maxBuffer: 16 * 1024 * 1024});
    git(['cat-file', '-e', `${pin}^{commit}`]);
    const fixture = 'test/fixtures/bw8051_1';
    const files = {};
    mkdirSync(dest, {recursive: true});
    const save = (name, bytes) => {
        writeFileSync(path.join(dest, name), bytes);
        files[name] = hash(bytes);
    };
    for (const id of ['hourglass-stage2', 'clock-mod4']) {
        save(`${id}.hex`, git(['show', `${pin}:${fixture}/images/${id}.hex`]));
        save(`${id}.json`, git(['show', `${pin}:${fixture}/circuits/${id}.json`]));
    }
    for (const [name, file] of [
        ['STC15lib.LICENSE.txt', 'vendor/stc15lib/LICENSE'],
        ['ElectronicHourGlassKit.LICENSE.txt', 'vendor/hourglass/LICENSE'],
        ['stc_diyclock.LICENSE.txt', 'vendor/clock/LICENCE'],
        ['sources.json', 'sources.json'], ['build-manifest.json', 'images/manifest.json']
    ]) save(name, git(['show', `${pin}:${fixture}/${file}`]));
    save('README.md', git(['show', `${pin}:docs/BW8051-1-FIRMWARE.md`]));
    save('sources.tar.gz', gzipSync(git(['archive', '--format=tar', '--prefix=bw8051-1/',
        pin, fixture, 'docs/BW8051-1-FIRMWARE.md']), {level: 9}));
    writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify({schema: 1, bwBoard: pin, files}, null, 2) + '\n');
    console.log(`Synced ${Object.keys(files).length} bw8051_1 assets from ${pin}`);
}
