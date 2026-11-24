// SPDX-License-Identifier: BSD-3-Clause
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {gzipSync, gunzipSync} from 'node:zlib';
import {OWNED_PART_FILES} from '../overlay/scratch-gui/src/lib/bw-sim/ldraw/owned-parts.js';

const root = new URL('../overlay/scratch-gui/static/', import.meta.url);
const lockPath = 'ldraw/ldraw-lock.json';
const output = new URL('sim-lab/robot-build-ldraw.pack', root);
const read = path => readFileSync(new URL(path, root));

export const robotBuildPackContents = () => {
    const lockText = read(lockPath).toString('utf8');
    const files = [[lockPath, lockText]];
    const lock = JSON.parse(lockText);
    for (const [path, expected] of Object.entries(lock.files)) {
        if (!/^(?:parts\/|p\/)|^LDConfig\.ldr$/i.test(path)) continue;
        const bytes = read('ldraw/' + path);
        if (createHash('sha256').update(bytes).digest('hex') !== expected.sha256) {
            throw new Error(`Vendored LDraw part differs from its lock: ${path}`);
        }
        files.push(['ldraw/' + path, bytes.toString('utf8')]);
    }
    for (const part of OWNED_PART_FILES) files.push(['sim-lab/parts/' + part, read('sim-lab/parts/' + part).toString('utf8')]);
    return JSON.stringify(files);
};

export const packRobotBuildLDraw = ({check = false} = {}) => {
    const contents = robotBuildPackContents();
    if (check) {
        const existing = gunzipSync(readFileSync(output)).toString('utf8');
        if (existing !== contents) throw new Error('Robot Lab Build pack is stale. Run node scripts/pack-robot-build-ldraw.mjs.');
    } else {
        const bytes = gzipSync(contents, {level: 9});
        writeFileSync(output, bytes);
        console.log(`Robot Lab Build pack: ${JSON.parse(contents).length} files, ${bytes.length} bytes`);
    }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) packRobotBuildLDraw({check: process.argv.includes('--check')});
