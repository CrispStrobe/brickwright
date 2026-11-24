// SPDX-License-Identifier: BSD-3-Clause
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, renameSync, rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {MODELS} from '../overlay/scratch-gui/src/lib/bw-sim/sim-session.js';
import {EXPERIMENTAL_MODELS} from '../overlay/scratch-gui/src/lib/bw-sim/model/experimental-models.js';
import {createRobotArtwork} from './lib/gallery-robot-artwork.mjs';
import {createCircuitArtwork} from './lib/gallery-circuit-artwork.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {values: args} = parseArgs({options: {
    editor: {type: 'string', default: 'robots'},
    only: {type: 'string', multiple: true},
    out: {type: 'string'},
    'circuit-ui': {type: 'string'},
    'source-root': {type: 'string'}
}});
if (!['robots', 'circuits'].includes(args.editor)) throw new Error('--editor must be robots or circuits');
const staticSrc = resolve(args['source-root'] ?? join(root, 'overlay/scratch-gui'));
const output = resolve(args.out ?? join(root, 'overlay/scratch-gui/static/thumbnails/gallery-artwork'));
const sourcePath = (parent, relative) => {
    const absolute = resolve(parent, relative);
    if (!absolute.startsWith(parent + sep)) throw new Error(`Invalid source path: ${relative}`);
    return absolute;
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fingerprint(inputs) {
    const out = createHash('sha256');
    for (const [name, bytes] of inputs) out.update(JSON.stringify([name, hash(bytes)]) + '\n');
    return out.digest('hex');
}
const versionFiles = [
    'scripts/generate-gallery-artwork.mjs',
    `scripts/lib/gallery-${args.editor === 'robots' ? 'robot' : 'circuit'}-artwork.mjs`
];
const sim = 'overlay/scratch-gui/src/lib/bw-sim/';
const robotDependencies = [
    'ldraw/ldraw-geometry.js', 'ldraw/motor-phase.js', 'ldraw/visual-assemblies.js',
    'model/motor-phase.js', 'model/ldraw-model.js', 'contracts.js', 'view/ldraw-colors.js',
    'part-meta/parts.json'
];
if (args.editor === 'robots') versionFiles.push(...robotDependencies.map(name => sim + name));
const renderer = fingerprint(versionFiles.map(name => [name, readFileSync(join(root, name))]));
let candidates, inputRoot, prepare, ext;
if (args.editor === 'robots') {
    candidates = [...new Set([...MODELS, ...EXPERIMENTAL_MODELS].filter(model => !model.blocked).map(model => model.file))]
        .map(file => ({key: file, file}));
    inputRoot = join(staticSrc, 'static/sim-lab/models');
    prepare = createRobotArtwork(join(staticSrc, 'static/ldraw'), JSON.parse(readFileSync(join(root, sim, 'part-meta/parts.json'))));
    ext = 'png';
} else {
    inputRoot = join(staticSrc, 'examples');
    const data = JSON.parse(readFileSync(join(inputRoot, 'index.json')));
    candidates = (Array.isArray(data) ? data : data.examples).filter(example => example.files?.circuit)
        .map(example => ({key: example.id, file: example.files.circuit}));
    ext = 'svg';
    const require = createRequire(import.meta.url);
    let packageRoot = args['circuit-ui'];
    if (!packageRoot) {
        try { packageRoot = resolve(dirname(require.resolve('bw-circuit-ui')), '..'); }
        catch { packageRoot = join(root, 'packages/scratch-gui/node_modules/bw-circuit-ui'); }
    }
    const circuit = await createCircuitArtwork(resolve(packageRoot), fingerprint);
    prepare = source => ({dependencies: new Map([['bw-circuit-ui', circuit.digest]]), render: () => circuit.render(source)});
}
const requested = new Set(args.only);
const selected = requested.size ? candidates.filter(item => requested.has(item.key)) : candidates;
for (const {key} of selected) requested.delete(key);
if (requested.size) throw new Error(`Unknown gallery entries: ${[...requested].join(', ')}`);

mkdirSync(output, {recursive: true});
const lock = join(output, '.generation-lock');
mkdirSync(lock);
const manifestPath = join(output, 'manifest.json');
const writeAtomic = (path, bytes) => {
    const temp = `${path}.${process.pid}.tmp`;
    try {
        writeFileSync(temp, bytes);
        renameSync(temp, path);
    } finally {
        rmSync(temp, {force: true});
    }
};
function currentFile(record) {
    if (!record || !/^[a-f0-9]{64}\.(png|svg)$/.test(record.artwork)) return false;
    try {
        const bytes = readFileSync(join(output, record.artwork));
        return bytes.length === record.bytes && `${hash(bytes)}.${ext}` === record.artwork;
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return false;
    }
}

try {
    let previous = {schema: 1, robots: {}, circuits: {}};
    try { previous = JSON.parse(readFileSync(manifestPath)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous.schema !== 1 || !previous.robots || !previous.circuits) throw new Error('Unsupported artwork manifest');
    const entries = args.only ? {...previous[args.editor]} : {};
    let generated = 0, reusable = 0, failed = 0;
    for (const {key, file} of selected) {
        try {
            const source = readFileSync(sourcePath(inputRoot, file), 'utf8');
            const {dependencies, render} = prepare(source);
            const input = fingerprint([['source', source], ...[...dependencies].sort(([a], [b]) => a.localeCompare(b))]);
            const old = previous[args.editor][key];
            if (old?.input === input && old.renderer === renderer && currentFile(old)) {
                entries[key] = old;
                reusable++;
                continue;
            }
            const image = render();
            const artwork = `${hash(image)}.${ext}`;
            writeAtomic(join(output, artwork), image);
            entries[key] = {source: file, input, renderer, artwork, bytes: image.length};
            generated++;
            console.log(`generated ${key} → ${artwork}`);
        } catch (error) {
            delete entries[key];
            failed++;
            console.error(`failed ${key}: ${error.message}`);
        }
    }
    const next = {...previous, [args.editor]: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)))};
    const text = JSON.stringify(next, null, 2) + '\n';
    if (text !== JSON.stringify(previous, null, 2) + '\n') writeAtomic(manifestPath, text);
    const currentImages = new Set([...Object.values(next.robots), ...Object.values(next.circuits)].map(item => item.artwork));
    for (const entry of [...Object.values(previous.robots), ...Object.values(previous.circuits)]) {
        if (/^[a-f0-9]{64}\.(png|svg)$/.test(entry.artwork) && !currentImages.has(entry.artwork)) {
            rmSync(join(output, entry.artwork), {force: true});
        }
    }
    console.log(`${args.editor}: ${generated} generated, ${reusable} current, ${failed} failed`);
    if (failed) process.exitCode = 1;
} finally {
    rmSync(lock, {recursive: true, force: true});
}
