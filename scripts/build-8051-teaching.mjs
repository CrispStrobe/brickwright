#!/usr/bin/env node
/** Build the exact source offered by the ASM picker with the existing SDCC tools. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {STC8051_TEACHING_EXAMPLES} from '../overlay/scratch-gui/src/lib/bw-asm/examples-stc8051.js';

const root = path.resolve(import.meta.dirname, '..');
const fixture = path.join(root, 'test/fixtures/bw8051-1/compiled');
const shippedGuest = path.join(root, 'overlay/scratch-gui/static/teaching/bw8051-1/cute-os-timer0.ihx');
const args = process.argv.slice(2);
const write = args.includes('--write-fixtures');
const outIndex = args.indexOf('--out');
if (outIndex !== -1 && (!args[outIndex + 1] || args[outIndex + 1].startsWith('--'))) {
    throw new Error('--out needs a directory');
}
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') {i++; continue;}
    if (!['--check', '--write-fixtures'].includes(args[i])) throw new Error(`Unknown argument: ${args[i]}`);
}
if (write && (args.includes('--check') || outIndex !== -1)) {
    throw new Error('Choose --write-fixtures, --check, or --out DIRECTORY');
}
const out = write ? fixture : outIndex !== -1 ? path.resolve(args[outIndex + 1]) : null;
const bin = name => process.env.BW_SDCC_BIN ? path.join(process.env.BW_SDCC_BIN, name) : name;
const env = process.env.BW_SDCC_BIN ? {...process.env,
    PATH: `${process.env.BW_SDCC_BIN}${path.delimiter}${process.env.PATH || ''}`} : process.env;
const sha = text => createHash('sha256').update(text).digest('hex');
const version = execFileSync(bin('sdcc'), ['--version'], {encoding: 'utf8', env}).split('\n')[0].trim();
mkdirSync(path.join(root, 'artifacts'), {recursive: true});
const work = mkdtempSync(path.join(root, 'artifacts/8051-teaching-'));
const manifest = {schema: 1, toolchain: version, examples: []};
const outputs = new Map();
const run = (name, argv, cwd) => execFileSync(bin(name), argv, {cwd, env, stdio: 'pipe'});

try {
    for (const example of STC8051_TEACHING_EXAMPLES) {
        const dir = path.join(work, example.id);
        mkdirSync(dir);
        writeFileSync(path.join(dir, 'program.asm'), example.source);
        run('sdas8051', ['-plosgff', 'program.asm'], dir);
        run('sdld', ['-n', '-i', 'program.ihx', 'program.rel'], dir);
        const hex = readFileSync(path.join(dir, 'program.ihx'), 'utf8');
        outputs.set(`${example.id}.ihx`, hex);
        outputs.set(`${example.id}.asm`, example.source);
        manifest.examples.push({id: example.id, sourceSha256: sha(example.source), hexSha256: sha(hex),
            upstream: example.upstream});
    }

    const cuteSource = readFileSync(path.join(root,
        'overlay/scratch-gui/static/teaching/bw8051-1/cute-os-timer0.c'), 'utf8');
    const cuteDir = path.join(work, 'cute-os-timer0');
    mkdirSync(cuteDir);
    writeFileSync(path.join(cuteDir, 'cute-os-timer0.c'), cuteSource);
    run('sdcc', ['-mmcs51', '--std-sdcc11', '--model-small', '--data-loc', '0x40',
        '--iram-size', '256', '--xram-size', '1024', '--code-size', '61440',
        '-o', 'cute-os-timer0.ihx', 'cute-os-timer0.c'], cuteDir);
    const cuteHex = readFileSync(path.join(cuteDir, 'cute-os-timer0.ihx'), 'utf8');
    outputs.set('cute-os-timer0.ihx', cuteHex);
    outputs.set('cute-os-timer0.c', cuteSource);
    manifest.cuteOS = {
        id: 'cute-os-timer0', sourceSha256: sha(cuteSource), hexSha256: sha(cuteHex),
        upstream: {repo: 'https://github.com/makaram99/cute-os',
            ref: 'c489ebfb1a9186903b6c60db66bd1154ec703d71', path: 'code/src/cuteOS.c'},
        part: 'stc89c52rc', clockHz: 12000000, timer: 'Timer0 mode 1',
        expectedIram: {address: 0x30, bytes: [25, 12, 6, 0, 240, 0, 0xa5]},
        expectedP1: 0xf6
    };
    const metadata = `${JSON.stringify(manifest, null, 2)}\n`;
    if (out) {
        mkdirSync(out, {recursive: true});
        for (const [name, content] of outputs) writeFileSync(path.join(out, name), content);
        writeFileSync(path.join(out, 'manifest.json'), metadata);
        if (write) writeFileSync(shippedGuest, cuteHex);
        console.log(`Built six assembly lessons and the Timer0 scheduler guest in ${out}`);
    } else {
        const expected = JSON.parse(readFileSync(path.join(fixture, 'manifest.json'), 'utf8'));
        // Tool version is evidence, not a platform-specific text equality gate.
        const same = {...expected, toolchain: version};
        if (JSON.stringify(same) !== JSON.stringify(manifest)) {
            throw new Error('Teaching fixture metadata differs; review and rebuild with --write-fixtures');
        }
        for (const [name, content] of outputs) {
            if (readFileSync(path.join(fixture, name), 'utf8') !== content) {
                throw new Error(`Compiled fixture differs: ${name}`);
            }
        }
        if (readFileSync(shippedGuest, 'utf8') !== cuteHex) throw new Error('The downloadable scheduler HEX is stale');
        console.log('Six assembly lessons and the Timer0 scheduler reproduce their checked-in HEX fixtures.');
    }
} finally {
    rmSync(work, {recursive: true, force: true});
}
